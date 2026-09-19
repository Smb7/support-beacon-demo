from datetime import date, datetime
from typing import Optional
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings

from .data import ROOMS


class Settings(BaseSettings):
    github_token: str = ""
    github_owner: str = "Smb7"
    github_repo: str = "support-beacon-demo"
    github_dispatch: bool = False


settings = Settings()
app = FastAPI(title="The Marlowe House")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

bookings: list[dict] = []
reports: list[dict] = []


class StayQuery(BaseModel):
    check_in: date
    check_out: date
    guests: int = Field(ge=1, le=8)


class BookingIn(StayQuery):
    room_id: str
    guest_name: str = Field(min_length=1, max_length=80)


class SupportMeta(BaseModel):
    url: Optional[str] = None
    userAgent: Optional[str] = None
    viewport: Optional[str] = None
    timestamp: Optional[str] = None


class SupportIn(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    body: str = Field(min_length=1, max_length=10000)
    type: str = "support"
    email: Optional[str] = None
    labels: list[str] = Field(default_factory=list)
    metadata: SupportMeta = Field(default_factory=SupportMeta)


def nights(check_in: date, check_out: date) -> int:
    if check_out <= check_in:
        raise HTTPException(400, "Check-out must be after check-in.")
    if check_in < date.today():
        raise HTTPException(400, "Check-in cannot be in the past.")
    return (check_out - check_in).days


def overlaps(room_id: str, check_in: date, check_out: date) -> bool:
    for booking in bookings:
        if booking["room_id"] != room_id:
            continue
        if check_in < booking["check_out"] and check_out > booking["check_in"]:
            return True
    return False


def room_by_id(room_id: str) -> dict:
    for room in ROOMS:
        if room["id"] == room_id:
            return room
    raise HTTPException(404, "Room not found.")


@app.get("/api/health")
def health():
    return {"ok": True, "inn": "The Marlowe House"}


@app.get("/api/rooms")
def list_rooms(check_in: Optional[date] = None, check_out: Optional[date] = None, guests: int = 1):
    stay_nights = nights(check_in, check_out) if check_in and check_out else 1
    result = []
    for room in ROOMS:
        available = True
        if check_in and check_out:
            available = room["sleeps"] >= guests and not overlaps(room["id"], check_in, check_out)
        elif guests:
            available = room["sleeps"] >= guests
        result.append({**room, "available": available, "nights": stay_nights, "total": room["price"] * stay_nights})
    return result


@app.post("/api/bookings")
def create_booking(payload: BookingIn):
    stay_nights = nights(payload.check_in, payload.check_out)
    room = room_by_id(payload.room_id)
    if payload.guests > room["sleeps"]:
        raise HTTPException(400, f"{room['name']} sleeps {room['sleeps']}.")
    if overlaps(payload.room_id, payload.check_in, payload.check_out):
        raise HTTPException(409, "Those dates are taken.")
    booking = {
        "id": str(uuid4()),
        "room_id": room["id"],
        "room_name": room["name"],
        "guest_name": payload.guest_name.strip(),
        "guests": payload.guests,
        "check_in": payload.check_in,
        "check_out": payload.check_out,
        "nights": stay_nights,
        "total": room["price"] * stay_nights,
    }
    bookings.append(booking)
    return booking


@app.get("/api/bookings")
def list_bookings():
    return bookings


@app.get("/api/support")
def list_support():
    return reports


@app.post("/api/support")
async def create_support(payload: SupportIn):
    allowed = {"bug", "feature", "question", "support"}
    kind = payload.type.lower() if payload.type.lower() in allowed else "support"
    record = {
        "id": str(uuid4()),
        "title": payload.title.strip(),
        "body": payload.body.strip(),
        "type": kind,
        "email": payload.email,
        "labels": payload.labels,
        "metadata": payload.metadata.model_dump(),
        "github": None,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    if settings.github_token:
        record["github"] = await publish_github(record)
    reports.append(record)
    return {"ok": True, "id": record["id"], "github": record["github"]}


async def publish_github(record: dict) -> dict:
    owner, repo, token = settings.github_owner, settings.github_repo, settings.github_token
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "support-beacon-demo",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    meta = record["metadata"] or {}
    body = "\n".join(
        [
            record["body"],
            "",
            "---",
            "### Environment",
            f"- **Page:** {meta.get('url') or 'n/a'}",
            f"- **Browser:** {meta.get('userAgent') or 'n/a'}",
            f"- **Viewport:** {meta.get('viewport') or 'n/a'}",
            f"- **When:** {meta.get('timestamp') or record['created_at']}",
            *([f"- **Contact:** {record['email']}"] if record.get("email") else []),
            f"- **Type:** {record['type']}",
            "",
            "_Submitted via Support Beacon_",
        ]
    )
    async with httpx.AsyncClient(timeout=20) as client:
        if settings.github_dispatch:
            response = await client.post(
                f"https://api.github.com/repos/{owner}/{repo}/dispatches",
                headers=headers,
                json={
                    "event_type": "support-beacon",
                    "client_payload": {
                        "title": record["title"],
                        "body": record["body"],
                        "type": record["type"],
                        "email": record["email"],
                        "labels": record["labels"],
                        "metadata": record["metadata"],
                    },
                },
            )
            if response.status_code not in (204, 200):
                raise HTTPException(502, "GitHub dispatch failed.")
            return {"mode": "dispatch"}

        response = await client.post(
            f"https://api.github.com/repos/{owner}/{repo}/issues",
            headers=headers,
            json={
                "title": f"[Support] {record['title']}",
                "body": body,
                "labels": list({*record["labels"], "support", record["type"]}),
            },
        )
        if response.status_code >= 300:
            raise HTTPException(502, "GitHub issue creation failed.")
        data = response.json()
        return {"mode": "issue", "number": data.get("number"), "url": data.get("html_url")}

# Support Beacon Demo — The Marlowe House

One-page boutique inn: **React** frontend, **FastAPI** backend, **Docker Compose**.
Use the floating support button to file a report; the API can turn it into a GitHub issue via [Support Beacon](https://github.com/Smb7/support-beacon).

## Run

```bash
docker compose up --build
```

Open http://localhost:3000

## Try it

1. Pick check-in / check-out and guests, then book a room.
2. Click the support icon (bottom-right) and submit a bug, feature, or question.
3. Without a GitHub token, reports are stored in the API only (`GET http://localhost:8000/api/support`).
4. With a token, the backend creates a GitHub issue on this repo.

```bash
SUPPORT_BEACON_TOKEN=ghp_xxx GITHUB_OWNER=Smb7 GITHUB_REPO=support-beacon-demo docker compose up --build
```

## Stack

| Service  | Port | Role |
| -------- | ---- | ---- |
| frontend | 3000 | Vite/React UI (nginx in Docker) |
| backend  | 8000 | FastAPI rooms, bookings, support |

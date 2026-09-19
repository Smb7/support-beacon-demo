import { useEffect, useMemo, useState } from "react";

function isoPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [checkIn, setCheckIn] = useState(isoPlus(7));
  const [checkOut, setCheckOut] = useState(isoPlus(10));
  const [guests, setGuests] = useState(2);
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const query = useMemo(
    () => `/api/rooms?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}`,
    [checkIn, checkOut, guests]
  );

  useEffect(() => {
    setError("");
    fetch(query)
      .then((r) => r.json())
      .then(setRooms)
      .catch(() => setError("Could not load rooms."));
  }, [query, confirmation]);

  useEffect(() => {
    if (!window.SupportBeacon) return undefined;
    window.SupportBeacon.init({
      mode: "endpoint",
      endpoint: "/api/support",
      position: "bottom-right",
      theme: "light",
      accent: "#b85c38",
      title: "Innkeeper",
      buttonLabel: "Help",
    });
    return () => window.SupportBeacon.destroy();
  }, []);

  async function book(room) {
    setError("");
    if (!name.trim()) {
      setPicked(room);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: room.id,
          guest_name: name.trim(),
          guests,
          check_in: checkIn,
          check_out: checkOut,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Booking failed.");
      setConfirmation(data);
      setPicked(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="top">
        <a className="mark" href="#stay">
          The Marlowe House
        </a>
        <nav>
          <a href="#rooms">Rooms</a>
          <a href="#house">The house</a>
        </nav>
      </header>

      <section className="hero" id="stay">
        <p className="eyebrow">Mendocino headland · est. 1912</p>
        <h1>Fog, cedar, and a bed you will not leave early.</h1>
        <p className="lede">
          Four rooms, one kitchen table, and breakfast that waits until you come downstairs.
        </p>
      </section>

      <form className="bar" onSubmit={(e) => e.preventDefault()}>
        <label>
          Arrive
          <input type="date" value={checkIn} min={isoPlus(0)} onChange={(e) => setCheckIn(e.target.value)} />
        </label>
        <label>
          Depart
          <input type="date" value={checkOut} min={checkIn} onChange={(e) => setCheckOut(e.target.value)} />
        </label>
        <label>
          Guests
          <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name for the ledger
          <input value={name} placeholder="Ada Marlowe" onChange={(e) => setName(e.target.value)} />
        </label>
      </form>

      {error && <p className="banner">{error}</p>}
      {confirmation && (
        <p className="banner ok">
          Held: {confirmation.room_name} for {confirmation.guest_name}, {confirmation.nights} night
          {confirmation.nights > 1 ? "s" : ""} · ${confirmation.total}
        </p>
      )}

      <section id="rooms" className="rooms">
        <h2>Rooms</h2>
        <div className="grid">
          {rooms.map((room) => (
            <article key={room.id} className="card">
              <div className="swatch" style={{ background: room.tone }} />
              <div className="card-body">
                <div className="row">
                  <h3>{room.name}</h3>
                  <p className="price">
                    ${room.price}
                    <span>/night</span>
                  </p>
                </div>
                <p>{room.blurb}</p>
                <ul>
                  {room.amenities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <button disabled={!room.available || busy} onClick={() => book(room)}>
                  {!room.available ? "Unavailable" : `Book · $${room.total}`}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="house" className="house">
        <h2>The house</h2>
        <p>
          A former captain’s place on the lee of the bluff. We still keep the original key hooks.
          Coffee at seven, porridge until eleven, and the path to the cove is lit after dusk.
        </p>
      </section>

      {picked && (
        <div className="modal" onClick={() => setPicked(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <h3>Name for the ledger</h3>
            <p>We hold {picked.name} once we know who to expect.</p>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <div className="actions">
              <button type="button" className="ghost" onClick={() => setPicked(null)}>
                Cancel
              </button>
              <button type="button" disabled={!name.trim() || busy} onClick={() => book(picked)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <footer>
        <p>The Marlowe House · Support reports go through the life-ring button.</p>
      </footer>
    </>
  );
}

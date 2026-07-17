import { useMemo, useState } from "react";

/* ========= Helpers ========= */
const TZ = "America/Los_Angeles";

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function formatHeaderDate(date) {
  // "Tue, Feb 10"
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "2-digit",
  });
  return fmt.format(date);
}

/* ========= Styles (match your current clean look) ========= */
const styles = {
  page: {
    minHeight: "100dvh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    background: "#000",
    boxSizing: "border-box",
  },
  card: {
    width: "min(760px, 92vw)",
    background: "#fff",
    borderRadius: 28,
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    boxSizing: "border-box",
  },

  /* ✅ APPLY FIX: make sure any top/summary-like area is never skinny */
  cardSection: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    margin: 0,
  },

  header: {
    padding: "22px 24px 16px",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    display: "flex",
    justifyContent: "center",
  },
  logo: {
    width: "clamp(320px, 65vw, 600px)",
    height: "auto",
    display: "block",
  },

  row: {
    display: "grid",
    gridTemplateColumns: "70px 1fr 70px",
    alignItems: "center",
    padding: "22px 18px",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  },
  arrowBtn: {
    height: 54,
    width: 54,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "#fff",
    cursor: "pointer",
    fontSize: 26,
    fontWeight: 900,
    lineHeight: "54px",
    textAlign: "center",
    userSelect: "none",
    boxSizing: "border-box",
  },
  center: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  big: {
    fontSize: 34,
    fontWeight: 900,
    letterSpacing: 0.2,
    color: "#111",
  },
  label: {
    fontSize: 14,
    color: "rgba(17,17,17,0.55)",
    fontWeight: 700,
  },

  footer: {
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  btn: {
    height: 62,
    borderRadius: 16,
    border: "none",
    background: "#2F3E4A",
    color: "#fff",
    fontSize: 20,
    fontWeight: 900,
    cursor: "pointer",
  },
  small: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "rgba(17,17,17,0.55)",
  },
};

export default function SearchReservation() {
  // ✅ Date state (starts today in local device, displayed as Las Vegas TZ)
  const [date, setDate] = useState(() => startOfDay(new Date()));

  const dateText = useMemo(() => formatHeaderDate(date), [date]);

  function prevDay() {
    setDate((d) => addDays(d, -1));
  }
  function nextDay() {
    setDate((d) => addDays(d, 1));
  }

  function onSearch() {
    // por ahora solo prueba: ver en consola el date seleccionado
    console.log("Selected date:", date.toISOString());
    alert(`Searching availability for: ${dateText}`);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ ...styles.cardSection, ...styles.header }}>
          {/* ✅ logo desde /public/logo.png */}
          <img src="/logo.png" alt="Il Toro E La Capra" style={styles.logo} />
        </div>

        {/* ✅ DATE ROW (connected) */}
        <div style={{ ...styles.cardSection, ...styles.row }}>
          <button type="button" onClick={prevDay} style={styles.arrowBtn} aria-label="Previous day">
            ‹
          </button>

          <div style={styles.center}>
            <div style={styles.big}>{dateText}</div>
            <div style={styles.label}>Date</div>
          </div>

          <button type="button" onClick={nextDay} style={styles.arrowBtn} aria-label="Next day">
            ›
          </button>
        </div>

        {/* (Guests/Time rows will go here later) */}

        <div style={{ ...styles.cardSection, ...styles.footer }}>
          <button type="button" onClick={onSearch} style={styles.btn}>
            Search
          </button>
          <div style={styles.small}>Max party size: 12 · Time slots every 15 minutes</div>
        </div>
      </div>
    </div>
  );
}

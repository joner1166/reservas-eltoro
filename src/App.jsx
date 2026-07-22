// @ts-nocheck
/*******************************************************
 * BLOQUE 0 — IMPORTS
 *******************************************************/
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";
import logo from "/logo.png"; // Logo principal para la interfaz

/*******************************************************
 * BLOQUE 1 — CONFIG / CONSTANTES
 *******************************************************/
const MAX_GUESTS = 12;
const MAX_CLIENT_GUESTS = 25;
function getInitials(name) {
  const clean = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}
const COUNTRY_CODES = [
  { code: '+1',  label: '🇺🇸 +1'  },
  { code: '+52', label: '🇲🇽 +52' },
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+61', label: '🇦🇺 +61' },
  { code: '+33', label: '🇫🇷 +33' },
  { code: '+34', label: '🇪🇸 +34' },
  { code: '+49', label: '🇩🇪 +49' },
];
const SLOT_MINUTES = 15;
const MAX_RESERVATIONS_PER_HOUR = 5;
// Placeholder — confirmar capacidad real de Il Toro E La Capra
const RESTAURANT_CAPACITY = 200;
// Placeholder temporal — reemplazar por PINs definitivos
const HOSTESS_PASSWORD = "1234";
const MANAGER_PASSWORD = "1234";

// Horarios por día (0=Dom, 1=Lun, ..., 6=Sáb)
const RESTAURANT_HOURS = {
  0: { open: "10:00", close: "22:00" }, // Domingo
  1: { open: "11:00", close: "22:00" }, // Lunes
  2: { open: "11:00", close: "22:00" }, // Martes
  3: { open: "11:00", close: "22:00" }, // Miércoles
  4: { open: "11:00", close: "22:00" }, // Jueves
  5: { open: "11:00", close: "23:00" }, // Viernes
  6: { open: "10:00", close: "23:00" }, // Sábado
};

// Tiempo mínimo antes del cierre para aceptar reservaciones (en minutos)
const LAST_RESERVATION_BUFFER = 0;
// Tiempo mínimo de anticipación para reservaciones same-day en client view (en minutos)
const SAME_DAY_BUFFER = 30;

const responsiveStyles = `
  * { box-sizing: border-box; }
  @media (max-width: 900px) {
    .hostess-layout { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .sr-hostess-sidebar { width: 100%; min-height: auto; flex-direction: row; align-items: center; padding: 10px; border-right: none; border-bottom: 1px solid #eee; overflow-x: auto; white-space: nowrap; background: #fff; z-index: 10; }
    .sr-logo-small { height: 30px; margin-right: 15px; }
    .sr-sidebar-nav { flex-direction: row; display: flex; gap: 8px; width: 100%; }
    .sr-sidebar-nav button { padding: 6px 12px; font-size: 0.85rem; flex-shrink: 0; }
    .sr-sidebar-footer { display: none; }
    .sr-hostess-main { padding: 10px; height: 100%; overflow-y: auto; }
    .sr-floor-manager { height: 60vh; }
    .sr-map-canvas { overflow: auto; }
    .sr-image-wrapper { min-width: 600px; }
  }
  @media (max-width: 600px) {
    .sr-page { padding: 0; height: 100vh; overflow: hidden; }
    .sr-card { height: 100%; width: 100%; border-radius: 0; box-shadow: none; overflow-y: auto; display: flex; flex-direction: column; padding-bottom: 20px; }
    .sr-form { flex: 1; }
    .sr-formGrid { gap: 20px; padding-bottom: 30px; }
    .sr-field { margin-bottom: 5px; }
    .sr-view-toggle { border-radius: 0; padding: 15px; margin-top: 0; width: 100%; flex-shrink: 0; }
  }
`;

const FLOOR_CONFIG = {
  BAR: [
    ...Array.from({ length: 9 }, (_, i) => ({ id: `B${i + 1}`, cap: 1, top: '22%', left: `${11.5 + (i * 9.5)}%`, status: [3, 5].includes(i + 1) ? 'occ' : 'av', shape: 'circle' })),
    { id: 'B12', cap: 2, top: '53%', left: '54%', status: 'av', shape: 'circle' }, { id: 'B11', cap: 2, top: '53%', left: '64.5%', status: 'av', shape: 'circle' }, { id: 'B10', cap: 2, top: '53%', left: '75%', status: 'av', shape: 'circle' },
    { id: 'B16', cap: 2, top: '86%', left: '7%', status: 'av', shape: 'square' }, { id: 'B15', cap: 2, top: '86%', left: '17%', status: 'av', shape: 'square' }, { id: 'B14', cap: 2, top: '86%', left: '27%', status: 'av', shape: 'square' }, { id: 'B13', cap: 2, top: '86%', left: '37%', status: 'av', shape: 'square' },
    { id: 'B17', cap: 5, top: '42%', left: '6%', status: 'av', shape: 'square' }
  ],
  ROOM1: [
    { id: '1', cap: 4, top: '82%', left: '12%', status: 'occ', shape: 'square' }, { id: '2', cap: 4, top: '82%', left: '32%', status: 'occ', shape: 'square' }, { id: '3', cap: 4, top: '82%', left: '52%', status: 'occ', shape: 'square' }, { id: '4', cap: 4, top: '82%', left: '72%', status: 'occ', shape: 'square' },
    { id: '5', cap: 4, top: '65%', left: '88%', status: 'occ', shape: 'square' }, { id: '6', cap: 4, top: '48%', left: '88%', status: 'av', shape: 'square' }, { id: '7', cap: 4, top: '31%', left: '88%', status: 'occ', shape: 'square' },
    { id: '8', cap: 4, top: '15%', left: '72%', status: 'occ', shape: 'square' }, { id: '9', cap: 4, top: '15%', left: '52%', status: 'occ', shape: 'square' }, { id: '10', cap: 4, top: '15%', left: '32%', status: 'av', shape: 'square' }, { id: '11', cap: 4, top: '15%', left: '12%', status: 'av', shape: 'square' },
    { id: '12', cap: 8, top: '48%', left: '22%', status: 'av', shape: 'rect' }, { id: '14', cap: 8, top: '48%', left: '42%', status: 'occ', shape: 'rect' }, { id: '16', cap: 8, top: '48%', left: '62%', status: 'av', shape: 'rect' }
  ],
  ROOM2: [
    { id: '21', cap: 4, top: '78%', left: '18%', status: 'occ', shape: 'square' }, { id: '22', cap: 4, top: '78%', left: '39%', status: 'av', shape: 'square' }, { id: '23', cap: 4, top: '78%', left: '61%', status: 'occ', shape: 'square' }, { id: '24', cap: 4, top: '78%', left: '82%', status: 'av', shape: 'square' },
    { id: '31', cap: 10, top: '48%', left: '32%', status: 'occ', shape: 'rect' }, { id: '32', cap: 10, top: '48%', left: '68%', status: 'occ', shape: 'rect' },
    { id: '30', cap: 4, top: '18%', left: '10%', status: 'av', shape: 'square' }, { id: '29', cap: 4, top: '18%', left: '26%', status: 'occ', shape: 'square' }, { id: '28', cap: 4, top: '18%', left: '42%', status: 'av', shape: 'square' }, { id: '27', cap: 4, top: '18%', left: '58%', status: 'occ', shape: 'square' }, { id: '26', cap: 4, top: '18%', left: '74%', status: 'av', shape: 'square' }, { id: '25', cap: 4, top: '18%', left: '90%', status: 'av', shape: 'square' }
  ],
  ROOM3: [
    ...Array.from({ length: 7 }, (_, i) => ({ id: `${56 - i}`, cap: 4, top: '18%', left: `${9 + (i * 13.5)}%`, status: i % 3 === 0 ? 'occ' : 'av', shape: 'square' })),
    { id: '57', cap: 8, top: '48%', left: '18%', status: 'occ', shape: 'rect' }, { id: '58', cap: 8, top: '48%', left: '34%', status: 'av', shape: 'rect' }, { id: '59', cap: 8, top: '48%', left: '50%', status: 'occ', shape: 'rect' }, { id: '60', cap: 8, top: '48%', left: '66%', status: 'av', shape: 'rect' }, { id: '61', cap: 8, top: '48%', left: '82%', status: 'occ', shape: 'rect' },
    ...Array.from({ length: 7 }, (_, i) => ({ id: `${43 + i}`, cap: 4, top: '78%', left: `${9 + (i * 13.5)}%`, status: i % 2 === 0 ? 'av' : 'occ', shape: 'square' }))
  ]
};

/*******************************************************
 * BLOQUE 2 — HELPERS (PUROS)
 *******************************************************/
function pad2(n) { return String(n).padStart(2, "0"); }
function minutesFromHHMM(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}
function hhmmFromMinutes(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}
function dateISOFromDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function addDaysISO(dateISO, days) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dateISOFromDate(dt);
}
function formatDateLabel(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(dt);
}
function formatTimeLabel(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const dt = new Date(2000, 0, 1, h, m, 0);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(dt);
}
function clampGuests(n) {
  const x = Number(n);
  return Math.min(Math.max(Number.isFinite(x) ? x : 1, 1), MAX_GUESTS);
}
function toLocalDateTimeISO(dateISO, timeHHMM) {
  return `${dateISO}T${timeHHMM}:00`;
}
function addMinutesToLocalDateTimeISO(dateISO, timeHHMM, addMins) {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const [h, mi] = timeHHMM.split(":").map(Number);
  const dt = new Date(y, mo - 1, d, h, mi, 0);
  dt.setMinutes(dt.getMinutes() + addMins);
  const endDateISO = dateISOFromDate(dt);
  const endTimeHHMM = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
  return toLocalDateTimeISO(endDateISO, endTimeHHMM);
}

// --- NUEVOS HELPERS DE HORARIO ---
function getDayHours(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Dom
  return RESTAURANT_HOURS[dow] || null;
}

function isRestaurantOpen(dateISO) {
  return !!getDayHours(dateISO);
}

function isTimeAllowed(dateISO, timeHHMM) {
  const hours = getDayHours(dateISO);
  if (!hours) return false;
  const requested = minutesFromHHMM(timeHHMM);
  const open = minutesFromHHMM(hours.open);
  const lastSlot = minutesFromHHMM(hours.close) - LAST_RESERVATION_BUFFER;
  return requested >= open && requested <= lastSlot;
}

function getTimeSlots(dateISO, applySameDayBuffer = false) {
  const hours = getDayHours(dateISO);
  if (!hours) return [];
  const open = minutesFromHHMM(hours.open);
  const lastSlot = minutesFromHHMM(hours.close) - LAST_RESERVATION_BUFFER;
  let earliest = open;
  if (applySameDayBuffer && dateISO === dateISOFromDate(new Date())) {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    earliest = Math.max(open, Math.ceil((nowMins + SAME_DAY_BUFFER) / SLOT_MINUTES) * SLOT_MINUTES);
  }
  const slots = [];
  for (let m = earliest; m <= lastSlot; m += SLOT_MINUTES) slots.push(hhmmFromMinutes(m));
  return slots;
}

function getAvailableTimeRange(dateISO) {
  const hours = getDayHours(dateISO);
  if (!hours) return null;
  return {
    open: hours.open,
    lastSlot: hhmmFromMinutes(minutesFromHHMM(hours.close) - LAST_RESERVATION_BUFFER),
  };
}

/*******************************************************
 * BLOQUE 3 — DATA LAYER (SUPABASE)
 *******************************************************/
const supabaseUrl = 'https://odaluoxziggitprieffs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kYWx1b3h6aWdnaXRwcmllZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODM0OTMsImV4cCI6MjA5OTg1OTQ5M30.Q6gwX_jZFzriuOnpXwkw9vvfZSadZPjWXWWh1-2Xo4I';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fetchRowsForDay(supabaseClient, dateISO) {
  return supabaseClient
    .from("reservations")
    .select("*")
    .eq("dateISO", dateISO)
    .in("status", ["reserved", "waitlist", "seated", "cancelled"])
    .order("id", { ascending: false });
}

async function insertWaitlistRecord(entry) {
  return supabase.from("reservations").insert([entry]);
}

async function insertReservationRecord(entry) {
  return supabase.from("reservations").insert([entry]);
}

let _audioCtx = null;
function _getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return _audioCtx;
}
function unlockAudio() {
  const ctx = _getAudioCtx();
  if (ctx?.state === 'suspended') ctx.resume();
}
function playAlertSound() {
  const ctx = _getAudioCtx();
  if (!ctx) return;
  const schedule = () => {
    [0, 0.35, 0.7, 1.2, 1.7, 2.1].forEach(t => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.25);
    });
  };
  if (ctx.state === 'suspended') ctx.resume().then(schedule);
  else schedule();
}

async function updatePartyToSeated(id) {
  return supabase
    .from("reservations")
    .update({ status: "seated", seated_at: new Date().toISOString() })
    .eq("id", id);
}

async function updateReservationRecord(id, data) {
  return supabase.from("reservations").update(data).eq("id", id);
}

async function cancelReservation(id) {
  return supabase
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", id);
}

async function revertPartyFromSeated(id, originalStatus) {
  return supabase
    .from("reservations")
    .update({ status: originalStatus, seated_at: null })
    .eq("id", id);
}

async function markPartyNotified(id) {
  return supabase
    .from("reservations")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", id);
}

async function assignServersToTable(tableId, serverNames) {
  return supabase.from("table_status").upsert({ id: tableId, server_names: serverNames });
}

async function logTableOcc(tableId, serverNames, dateISO) {
  if (!serverNames?.length) return;
  const rows = serverNames.map(name => ({ table_id: tableId, server_name: name, date_iso: dateISO }));
  return supabase.from("table_events").insert(rows);
}

async function fetchTableEvents(dateISO) {
  return supabase.from("table_events").select("*").eq("date_iso", dateISO);
}

async function fetchServers() {
  return supabase.from("servers").select("id, name").order("name");
}

async function insertServer(name) {
  return supabase.from("servers").insert({ name });
}

async function updateServerName(id, name) {
  return supabase.from("servers").update({ name }).eq("id", id);
}

async function deleteServer(id) {
  return supabase.from("servers").delete().eq("id", id);
}

/*******************************************************
 * BLOQUE 4 — REALTIME (HOOK INTERNO)
 *******************************************************/
function useReservationsRealtime({ supabase, dateISO, setRows, onInsert }) {
  useEffect(() => {
    let isMounted = true;

    (async () => {
      const { data, error } = await fetchRowsForDay(supabase, dateISO);
      if (error) return console.error("Supabase fetch error:", error);
      if (isMounted) setRows(data || []);
    })();

    const channel = supabase
      .channel(`reservations-realtime-${dateISO}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        (payload) => {
          const newRow = payload.new;
          const oldRow = payload.old;
          const affectsThisDay =
            (newRow && newRow.dateISO === dateISO) ||
            (oldRow && oldRow.dateISO === dateISO);

          if (!affectsThisDay) return;

          if (payload.eventType === "INSERT" && newRow?.dateISO === dateISO) {
            onInsert?.();
          }

          setRows((prev) => {
            if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== oldRow.id);
            if (payload.eventType === "INSERT") {
              if (prev.some((r) => r.id === newRow.id)) return prev;
              return [newRow, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              if (newRow.dateISO !== dateISO) return prev.filter((r) => r.id !== newRow.id);
              return prev.map((r) => (r.id === newRow.id ? newRow : r));
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, dateISO, setRows]);
}

/*******************************************************
 * BLOQUE 6 — UI COMPONENTES INTERNOS
 *******************************************************/

const LM_COLORS = {
  navy: 'oklch(15% 0.015 255)', navyLight: 'oklch(17% 0.015 255)', navyBorder: 'oklch(25% 0.015 255)',
  gold: 'oklch(80% 0.14 85)', goldDim: 'oklch(72% 0.14 82)', goldDark: 'oklch(18% 0.02 85)', goldText: 'oklch(62% 0.13 80)',
  danger: 'oklch(62% 0.16 28)', warn: 'oklch(70% 0.14 70)', success: 'oklch(65% 0.15 145)', info: 'oklch(55% 0.12 250)',
  textMuted: 'oklch(48% 0.01 90)', textFaint: 'oklch(60% 0.01 90)', textDark: 'oklch(20% 0.01 90)', border: 'oklch(88% 0.006 90)',
};

const HostessView = React.memo(function HostessView({
  // Acciones
  onAddWaitlist, onAddPhoneRes, onSeatParty, onUnseatParty, onCancelRes, onSaveEdit, onNotifyReady, onRemoveFromWaitlist, onUndoCancel, toggleBlackoutDate,
  handleTableSelection, onRefresh,

  // Estado y UI
  activeFloor, setActiveFloor, isBlackout, isWalkInOnly,
  dateISO, setDateISO, onDateChange, dateLabel, stepDate,
  guests, setGuests,
  estimatedWait, setEstimatedWait,
  timeHHMM, setTimeHHMM, timeLabel, stepTime,

  // Datos
  walkInForm, setWalkInForm, phoneResForm, setPhoneResForm,
  waitList, history, seatedList, canceledList, blackoutDates, tableStatuses, tableServerNames,
  walkinLoading, phoneResLoading, newReservationTick,

  // Servers
  servers, editingServer, setEditingServer, newServerName, setNewServerName,
  onAddServer, onUpdateServer, onDeleteServer,
}) {
  const blackoutInputRef = useRef(null);
  const bookingDateRef = useRef(null);
  const headerDateRef = useRef(null);
  const autoCancelledRef = useRef(new Set());
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("hostessTab") || "reservations");
  useEffect(() => { localStorage.setItem("hostessTab", activeTab); }, [activeTab]);
  const [newResAlert, setNewResAlert] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const notifChannelRef = useRef(null);

  // Enciende el badge "!" cuando llega una reservación nueva por realtime (no en el primer render)
  const isFirstTick = useRef(true);
  useEffect(() => {
    if (isFirstTick.current) { isFirstTick.current = false; return; }
    setNewResAlert(true);
  }, [newReservationTick]);

  // Canal para avisarle a otras terminales de hostess que ya se vio la reservación nueva
  useEffect(() => {
    const ch = supabase
      .channel('hostess-notifications')
      .on('broadcast', { event: 'reservations_seen' }, () => setNewResAlert(false))
      .subscribe();
    notifChannelRef.current = ch;
    return () => supabase.removeChannel(ch);
  }, []);

  const clearResAlert = () => {
    setNewResAlert(false);
    notifChannelRef.current?.send({ type: 'broadcast', event: 'reservations_seen', payload: {} });
  };
  const [editingRes, setEditingRes] = useState(null);
  const [editingWaitItem, setEditingWaitItem] = useState(null);
  const [blackoutForm, setBlackoutForm] = useState({ date: '', notes: '' });
  const [showWaitPicker, setShowWaitPicker] = useState(false);
  const [exitingIds, setExitingIds] = useState(new Set());
  const [assignMode, setAssignMode] = useState(false);
  const [unassignMode, setUnassignMode] = useState(false);
  const [assigningServers, setAssigningServers] = useState(new Set());
  const [pendingAssignTables, setPendingAssignTables] = useState(new Set());
  const [showAssignServerList, setShowAssignServerList] = useState(false);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [serverMenuMode, setServerMenuMode] = useState(null);
  const [tableEvents, setTableEvents] = useState([]);
  useEffect(() => {
    fetchTableEvents(dateISO).then(({ data }) => setTableEvents(data || [])).catch(() => setTableEvents([]));
  }, [dateISO]);

  const mainRef = useRef(null);
  const notifiedCount = waitList.filter(i => i.notified_at).length + history.filter(i => i.notified_at).length;
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [notifiedCount]);

  const animateThenAct = (id, action) => {
    setExitingIds(prev => new Set([...prev, id]));
    action(); // acción inmediata, no espera la animación
    setTimeout(() => {
      setExitingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 200);
  };
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const [nowSec, setNowSec] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowSec(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    waitList.forEach(item => {
      if (!item.notified_at || autoCancelledRef.current.has(item.id)) return;
      const elapsed = nowSec - new Date(item.notified_at).getTime();
      if (elapsed >= 10 * 60 * 1000) {
        autoCancelledRef.current.add(item.id);
        onRemoveFromWaitlist(item);
      }
    });
  }, [nowSec, waitList]);

  const seatButtonStyle = {
    background: `linear-gradient(180deg, ${LM_COLORS.gold}, ${LM_COLORS.goldDim})`,
    color: LM_COLORS.goldDark, border: 'none', padding: '10px 18px', borderRadius: '0', fontWeight: '600',
    fontSize: '0.72rem', letterSpacing: '1px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    transition: 'all 0.2s ease', textTransform: 'uppercase', minWidth: '86px', textAlign: 'center'
  };

  const range = getAvailableTimeRange(dateISO);

  return (
    <div className="sr-page hostess-view">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,500&family=Jost:wght@300;400;500;600&display=swap');`}</style>
      <main className="sr-card hostess-layout">
        <aside className="sr-hostess-sidebar">
          <div className="sr-sidebar-header"><img src="/logo.png" alt="Il Toro E La Capra" className="sr-logo-small" /></div>
          <nav className="sr-sidebar-nav">
            <button className={activeTab === 'walkin' ? 'active' : ''} onClick={() => setActiveTab('walkin')}>Walk-in</button>
            <button className={activeTab === 'phoneres' ? 'active' : ''} onClick={() => setActiveTab('phoneres')}>Phone Reservation</button>
            <button className={activeTab === 'waitlist' ? 'active' : ''} onClick={() => setActiveTab('waitlist')}>Wait List <span className="sr-nav-badge">{waitList.length}</span></button>
            <button className={activeTab === 'reservations' ? 'active' : ''} onClick={() => { setActiveTab('reservations'); clearResAlert(); }}>Reservations <span className="sr-nav-badge">{history.length}</span>{newResAlert && <span style={{ display: 'inline-block', background: LM_COLORS.danger, color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', fontWeight: '900', lineHeight: '16px', textAlign: 'center', marginLeft: '6px', verticalAlign: 'middle' }}>!</span>}</button>
            <button className={activeTab === 'seated' ? 'active' : ''} onClick={() => setActiveTab('seated')}>Seated <span className="sr-nav-badge">{seatedList.length}</span></button>
            <button className={`${activeTab === 'canceled' ? 'active' : ''} sr-nav-danger`} onClick={() => setActiveTab('canceled')}>Canceled <span className="sr-nav-badge">{canceledList.length}</span></button>
            <button className={activeTab === 'floorplan' ? 'active' : ''} onClick={() => setActiveTab('floorplan')}>Floor Plan</button>
            <button className={activeTab === 'servers' ? 'active' : ''} onClick={() => setActiveTab('servers')}>Servers</button>
            <button className={activeTab === 'blackout' ? 'active' : ''} onClick={() => setActiveTab('blackout')} style={{marginTop: 'auto', borderTop: `1px solid ${LM_COLORS.navyBorder}`}}>Blackout</button>
          </nav>
        </aside>
        <section className="sr-hostess-main" ref={mainRef}>
          <header className="sr-main-header">
            <div style={{display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap'}}>
              <h2>{activeTab === 'walkin' ? 'New Walk-in' : activeTab === 'phoneres' ? 'New Phone Reservation' : activeTab === 'waitlist' ? 'Wait List' : activeTab === 'reservations' ? 'Reservations' : activeTab === 'seated' ? 'Seated History' : activeTab === 'canceled' ? 'Canceled' : activeTab === 'blackout' ? 'Manage Blackout' : activeTab === 'servers' ? 'Servers' : 'Floor Plan'}</h2>
              {isBlackout && <span style={{background: LM_COLORS.danger, color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '0.64rem', fontWeight: 'bold'}}>CLOSED TODAY</span>}
              {isWalkInOnly && <span style={{background: LM_COLORS.warn, color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '0.64rem', fontWeight: 'bold'}}>ONLY WALK-IN</span>}
            </div>
            <div className="sr-hostess-date-picker" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="sr-btn-mini" onClick={() => stepDate(-1)}>‹</button>
              <div style={{ position: 'relative', cursor: 'pointer' }}>
                <div className="sr-current-date" style={{ fontWeight: '500' }}>{dateLabel}</div>
                <input ref={headerDateRef} type="date" value={dateISO} onChange={e => setDateISO(e.target.value)}
                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 2 }} />
              </div>
              <button className="sr-btn-mini" onClick={() => stepDate(1)}>›</button>
              <button
                className="sr-btn-mini"
                onClick={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }}
                title="Refresh"
                style={{ fontSize: '16px', opacity: refreshing ? 0.6 : 1 }}
                disabled={refreshing}
              >↺</button>
            </div>
          </header>
          <div className="sr-main-content">
            {activeTab === 'walkin' && (
              <div className="sr-walkin-form">
                {isBlackout && <div style={{padding: '15px', background: 'oklch(93% 0.03 25)', color: 'oklch(45% 0.16 25)', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold', textAlign: 'center'}}>The restaurant is closed.</div>}
                {dateISO !== dateISOFromDate(new Date()) && <div style={{padding: '10px 14px', background: 'oklch(93% 0.06 85)', border: `1px solid ${LM_COLORS.warn}`, borderRadius: '8px', marginBottom: '12px', color: 'oklch(45% 0.12 70)', fontSize: '0.85rem'}}>Warning: You are viewing <strong>{dateLabel}</strong>, not today. Walk-ins cannot be added for this date.</div>}
                {isWalkInOnly && <div style={{padding: '12px 15px', background: 'oklch(93% 0.06 85)', color: 'oklch(45% 0.12 70)', borderRadius: '8px', marginBottom: '16px', fontSize: '0.78rem', lineHeight: '1.6'}}><strong>Only Walk-In today.</strong> If a customer calls to make a reservation, please tell them: <em>"We are only accepting walk-ins today, but please come by and we will try to seat you as fast as we can."</em></div>}
                <div className="sr-formGrid" style={{marginBottom:'10px'}}>
                  <div style={{textAlign:'center', background:'#fff', border: `1.5px solid ${LM_COLORS.border}`, borderRadius:'0', padding:'12px 20px', boxShadow:'0 2px 10px rgba(0,0,0,0.07)'}}>
                    <label style={{fontSize:'0.62rem', fontWeight:'500', letterSpacing:'0.08em', color: LM_COLORS.textMuted, display:'block', marginBottom:'6px', fontFamily:"'Jost',sans-serif"}}>PARTY SIZE</label>
                    <input type="number" min="1" placeholder="—" value={guests === null ? "" : guests} onChange={e => setGuests(e.target.value === "" ? null : parseInt(e.target.value))} disabled={isBlackout} style={{width:'60px', textAlign:'center', fontSize:'2rem', fontWeight:'800', border:'none', outline:'none', background:'transparent', color: LM_COLORS.textDark, display:'block', margin:'0 auto', fontFamily:"'Playfair Display',serif"}} />
                  </div>
                  <div style={{textAlign:'center', background:'#fff', border: `1.5px solid ${LM_COLORS.border}`, borderRadius:'0', padding:'12px 20px', boxShadow:'0 2px 10px rgba(0,0,0,0.07)', position:'relative'}}>
                    <label style={{fontSize:'0.62rem', fontWeight:'500', letterSpacing:'0.08em', color: LM_COLORS.textMuted, display:'block', marginBottom:'6px', fontFamily:"'Jost',sans-serif"}}>ESTIMATED WAIT</label>
                    <button onClick={() => !isBlackout && setShowWaitPicker(v => !v)} disabled={isBlackout} style={{fontSize:'2rem', fontWeight:'800', border:'none', background:'transparent', color: LM_COLORS.textDark, cursor:'pointer', padding:0, display:'block', margin:'0 auto', width:'100%', fontFamily:"'Playfair Display',serif"}}>
                      {estimatedWait}<span style={{fontSize:'1rem', fontWeight:'500', color: LM_COLORS.textMuted}}> min</span>
                    </button>
                    {showWaitPicker && (
                      <div style={{position:'absolute', zIndex:50, top:'100%', left:'50%', transform:'translateX(-50%)', marginTop:'4px', background:'#fff', border: `1px solid ${LM_COLORS.border}`, borderRadius:'0', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', padding:'10px', display:'flex', flexWrap:'wrap', gap:'6px', width:'220px', justifyContent:'center'}}>
                        {Array.from({length: 24}, (_, i) => (i + 1) * 5).map(m => (
                          <button key={m} onClick={() => { setEstimatedWait(m); setShowWaitPicker(false); }} style={{padding:'4px 10px', borderRadius:'20px', border: `1px solid ${LM_COLORS.border}`, background: estimatedWait === m ? LM_COLORS.goldDark : 'oklch(97% 0.006 90)', color: estimatedWait === m ? '#fff' : LM_COLORS.textDark, fontSize:'0.78rem', fontWeight:'600', cursor:'pointer'}}>
                            {m} min
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="sr-formGrid">
                  <div className="sr-field"><label className="sr-fieldLabel">First Name</label><input className="sr-input" value={walkInForm.firstName} onChange={e => setWalkInForm({...walkInForm, firstName: e.target.value})} disabled={isBlackout}/></div>
                  <div className="sr-field"><label className="sr-fieldLabel">Last Name</label><input className="sr-input" value={walkInForm.lastName} onChange={e => setWalkInForm({...walkInForm, lastName: e.target.value})} disabled={isBlackout}/></div>
                  <div className="sr-field"><label className="sr-fieldLabel">Phone</label><div style={{display:'flex',gap:'6px'}}><select className="sr-input" style={{width:'95px',flexShrink:0}} value={walkInForm.phoneCode} onChange={e => setWalkInForm({...walkInForm, phoneCode: e.target.value})} disabled={isBlackout}>{COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select><input className="sr-input" style={{flex:1}} value={walkInForm.phone} onChange={e => setWalkInForm({...walkInForm, phone: e.target.value})} placeholder="000-000-0000" disabled={isBlackout}/></div></div>
                  <div className="sr-field"><label className="sr-fieldLabel">Celebration</label><select className="sr-input" value={walkInForm.celebration} onChange={e => setWalkInForm({...walkInForm, celebration: e.target.value})} disabled={isBlackout}><option>None</option><option>Birthday</option><option>Anniversary</option><option>Wedding</option><option>Graduation</option><option>Other</option></select></div>
                  <div className="sr-field"><label className="sr-fieldLabel">Dietary Restrictions</label><select className="sr-input" value={walkInForm.dietary} onChange={e => setWalkInForm({...walkInForm, dietary: e.target.value})} disabled={isBlackout}><option>None</option><option>Vegetarian</option><option>Vegan</option><option>Gluten Free</option><option>Dairy Free</option><option>Nut Allergy</option><option>Shellfish Allergy</option></select></div>
                  <div className="sr-field sr-span2"><label className="sr-fieldLabel">Notes</label><textarea className="sr-textarea" value={walkInForm.notes} onChange={e => setWalkInForm({...walkInForm, notes: e.target.value})} disabled={isBlackout}/></div>
                </div>
                <p style={{fontSize:'0.72rem',color: LM_COLORS.textFaint,margin:'16px 0 0',lineHeight:'1.5'}}><strong style={{color: LM_COLORS.danger}}>IMPORTANT NOTE:</strong> By providing their phone number, the guest consents to receive up to 2 SMS notifications (waitlist confirmation + table ready). Msg &amp; data rates may apply. Reply <strong>STOP</strong> to opt out.</p>
                <button className="sr-btn sr-btnPrimary" style={{marginTop: '20px', opacity: (isBlackout || walkinLoading) ? 0.5 : 1}} onClick={async () => { const ok = await onAddWaitlist(); if (ok) setActiveTab("waitlist"); }} disabled={isBlackout || walkinLoading}>{walkinLoading ? 'Adding...' : 'Add to Wait List'}</button>
              </div>
            )}
            {activeTab === 'phoneres' && (
              <div className="sr-walkin-form">
                {isBlackout && <div style={{padding: '15px', background: 'oklch(93% 0.03 25)', color: 'oklch(45% 0.16 25)', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold', textAlign: 'center'}}>The restaurant is closed.</div>}
                {isWalkInOnly && <div style={{padding: '12px 15px', background: 'oklch(93% 0.06 85)', color: 'oklch(45% 0.12 70)', borderRadius: '8px', marginBottom: '16px', fontSize: '0.78rem', lineHeight: '1.6'}}><strong>Only Walk-In today.</strong> If a customer calls to make a reservation, please tell them: <em>"We are only accepting walk-ins today, but please come by and we will try to seat you as fast as we can."</em></div>}
                {!isBlackout && range && (
                  <div style={{padding: '10px 15px', background: 'oklch(93% 0.05 145)', color: 'oklch(40% 0.1 145)', borderRadius: '8px', marginBottom: '16px', fontSize: '0.68rem', textAlign: 'center'}}>
                    Reservations accepted: {formatTimeLabel(range.open)} – {formatTimeLabel(range.lastSlot)}
                  </div>
                )}
                <div className="sr-booking-bar" style={{marginBottom: '25px'}}>
                  <div className="sr-booking-field" style={{cursor: 'pointer'}} onClick={() => bookingDateRef.current?.showPicker()}>
                    <label className="sr-fieldLabel" style={{cursor: 'pointer'}}>Date</label>
                    <input ref={bookingDateRef} type="date" className="sr-booking-input" value={dateISO} onChange={e => onDateChange(e.target.value)} disabled={isBlackout} />
                  </div>
                  <div className="sr-booking-divider" />
                  <div className="sr-booking-field">
                    <label className="sr-fieldLabel">Time</label>
                    <select className="sr-booking-input" value={timeHHMM} onChange={e => setTimeHHMM(e.target.value)} disabled={isBlackout}>
                      {getTimeSlots(dateISO).map(slot => (
                        <option key={slot} value={slot}>{formatTimeLabel(slot)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sr-booking-divider" />
                  <div className="sr-booking-field">
                    <label className="sr-fieldLabel">Guests</label>
                    <input type="number" className="sr-booking-input" min="1" placeholder="—" value={guests === null ? '' : guests} onChange={e => setGuests(e.target.value === '' ? null : parseInt(e.target.value))} onFocus={() => setGuests(null)} disabled={isBlackout} />
                  </div>
                </div>
                <div className="sr-formGrid">
                  <div className="sr-field"><label className="sr-fieldLabel">First Name</label><input className="sr-input" value={phoneResForm.firstName} onChange={e => setPhoneResForm({...phoneResForm, firstName: e.target.value})} disabled={isBlackout}/></div>
                  <div className="sr-field"><label className="sr-fieldLabel">Last Name</label><input className="sr-input" value={phoneResForm.lastName} onChange={e => setPhoneResForm({...phoneResForm, lastName: e.target.value})} disabled={isBlackout}/></div>
                  <div className="sr-field"><label className="sr-fieldLabel">Phone</label><div style={{display:'flex',gap:'6px'}}><select className="sr-input" style={{width:'95px',flexShrink:0}} value={phoneResForm.phoneCode} onChange={e => setPhoneResForm({...phoneResForm, phoneCode: e.target.value})} disabled={isBlackout}>{COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select><input className="sr-input" style={{flex:1}} value={phoneResForm.phone} onChange={e => setPhoneResForm({...phoneResForm, phone: e.target.value})} placeholder="000-000-0000" disabled={isBlackout}/></div></div>
                  <div className="sr-field"><label className="sr-fieldLabel">Email</label><input className="sr-input" value={phoneResForm.email} onChange={e => setPhoneResForm({...phoneResForm, email: e.target.value})} disabled={isBlackout}/></div>
                  <div className="sr-field"><label className="sr-fieldLabel">Celebration</label><select className="sr-input" value={phoneResForm.celebration} onChange={e => setPhoneResForm({...phoneResForm, celebration: e.target.value})} disabled={isBlackout}><option>None</option><option>Birthday</option><option>Anniversary</option><option>Wedding</option><option>Graduation</option><option>Other</option></select></div>
                  <div className="sr-field"><label className="sr-fieldLabel">Dietary Restrictions</label><select className="sr-input" value={phoneResForm.dietary} onChange={e => setPhoneResForm({...phoneResForm, dietary: e.target.value})} disabled={isBlackout}><option>None</option><option>Vegetarian</option><option>Vegan</option><option>Gluten Free</option><option>Dairy Free</option><option>Nut Allergy</option><option>Shellfish Allergy</option></select></div>
                  <div className="sr-field sr-span2"><label className="sr-fieldLabel">Notes</label><textarea className="sr-textarea" value={phoneResForm.notes} onChange={e => setPhoneResForm({...phoneResForm, notes: e.target.value})} disabled={isBlackout}/></div>
                </div>
                <button className="sr-btn sr-btnPrimary" style={{marginTop: '20px', opacity: (isBlackout || phoneResLoading) ? 0.5 : 1}} onClick={async () => { const ok = await onAddPhoneRes(); if (ok) setActiveTab("reservations"); }} disabled={isBlackout || phoneResLoading}>{phoneResLoading ? 'Saving...' : 'Confirm Phone Reservation'}</button>
              </div>
            )}
            {activeTab === 'waitlist' && (
              <div className="sr-res-list">
                {waitList.length === 0 ? <div className="sr-empty-state">No guests on the wait list.</div> : [...waitList].sort((a, b) => {
                  const nA = a.notified_at ? 1 : 0, nB = b.notified_at ? 1 : 0;
                  if (nB !== nA) return nB - nA;
                  return new Date(a.created_at) - new Date(b.created_at);
                }).map(item => (
                  <div key={item.id} className={`sr-list-item${exitingIds.has(item.id) ? ' sr-item-exit' : ''}`} style={item.notified_at ? {borderLeft: `4px solid ${LM_COLORS.navy}`, borderBottom: 'none', background: 'oklch(15% 0.015 255 / 0.08)', boxShadow: '0 2px 14px oklch(15% 0.015 255 / 0.2)', borderRadius: '0', margin: '4px 8px'} : {}}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '1.1rem', fontWeight: '600', fontFamily: "'Playfair Display',serif" }}>{item.firstName} {item.lastName}</strong>
                        <span style={{ background: LM_COLORS.textDark, color: '#fff', borderRadius: '0', padding: '4px 10px', fontSize: '0.68rem', fontWeight: '500', letterSpacing: '1.4px', textTransform: 'uppercase', fontFamily: "'Jost',sans-serif", whiteSpace: 'nowrap' }}>{item.guests} guests</span>
                        {item.celebration && item.celebration !== "None" && <span style={{ fontSize: '0.66rem', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', color: LM_COLORS.goldText }}>{item.celebration}</span>}
                        {item.dietary && item.dietary !== "None" && <span style={{ fontSize: '0.66rem', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', color: LM_COLORS.danger }}>{item.dietary}</span>}
                        {item.created_at && (() => {
                          const mins = Math.floor((now - new Date(item.created_at).getTime()) / 60000);
                          const color = mins >= 30 ? LM_COLORS.danger : mins >= 15 ? LM_COLORS.warn : LM_COLORS.success;
                          return (
                            <span style={{ background: color, color: '#fff', borderRadius: '20px', padding: '2px 10px', fontSize: '0.62rem', fontWeight: '700' }}>
                              {mins < 1 ? '< 1 min' : `${mins} min`}
                            </span>
                          );
                        })()}
                        {item.estimated_wait && item.created_at && (() => {
                          const endTime = new Date(item.created_at).getTime() + item.estimated_wait * 60000;
                          const remaining = Math.max(0, endTime - nowSec);
                          const mins = Math.floor(remaining / 60000);
                          const secs = Math.floor((remaining % 60000) / 1000);
                          const isExpired = remaining === 0;
                          const color = isExpired ? LM_COLORS.danger : remaining < 2 * 60 * 1000 ? LM_COLORS.warn : LM_COLORS.info;
                          return (
                            <span style={{ background: color, color: '#fff', borderRadius: '20px', padding: '2px 10px', fontSize: '0.62rem', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
                              {isExpired ? 'Wait exp.' : `${mins}:${String(secs).padStart(2, '0')}`}
                            </span>
                          );
                        })()}
                      </div>
                      <small style={{ color: LM_COLORS.textFaint }}>In at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{item.phone ? ` · ${item.phone}` : ''}</small>
                      {item.notes && <div style={{ fontSize: '0.68rem', fontStyle: 'italic', color: LM_COLORS.textMuted, marginTop: '2px' }}>"{item.notes}"</div>}
                      {item.notified_at && (() => {
                        const remaining = Math.max(0, 10 * 60 * 1000 - (nowSec - new Date(item.notified_at).getTime()));
                        const mins = Math.floor(remaining / 60000);
                        const secs = Math.floor((remaining % 60000) / 1000);
                        const isExpired = remaining === 0;
                        const color = isExpired ? LM_COLORS.danger : remaining < 2 * 60 * 1000 ? LM_COLORS.warn : LM_COLORS.success;
                        return (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px dashed ${LM_COLORS.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.68rem', color: LM_COLORS.textMuted }}>Hold time:</span>
                            <span style={{ fontSize: '0.76rem', fontWeight: '800', color, fontVariantNumeric: 'tabular-nums' }}>
                              {isExpired ? 'Expired' : `${mins}:${String(secs).padStart(2, '0')}`}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => setEditingWaitItem({...item})} style={{ ...seatButtonStyle, background: '#fff', color: LM_COLORS.textDark, border: `1px solid ${LM_COLORS.border}` }}>Edit</button>
                      <button
                        style={{ ...seatButtonStyle, border: 'none', background: item.notified_at ? LM_COLORS.success : LM_COLORS.goldDark, color: '#fff', cursor: item.notified_at ? 'default' : 'pointer' }}
                        onClick={() => !item.notified_at && onNotifyReady(item)}
                      >
                        {item.notified_at ? 'Notified' : 'Notify'}
                      </button>
                      <button style={seatButtonStyle} onClick={() => animateThenAct(item.id, () => onSeatParty(item))}>
                        Seat
                      </button>
                      <button style={{ ...seatButtonStyle, background: '#fff', color: LM_COLORS.danger, border: `1px solid ${LM_COLORS.danger}` }} onClick={() => animateThenAct(item.id, () => onRemoveFromWaitlist(item))}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'reservations' && (
              <div className="sr-res-list">
                {history.length === 0 ? <div className="sr-empty-state">No active reservations.</div> : history.map(res => (
                  <div key={res.id} className={`sr-list-item${exitingIds.has(res.id) ? ' sr-item-exit' : ''}`} style={res.notified_at ? {borderLeft: `4px solid ${LM_COLORS.navy}`, borderBottom: 'none', background: 'oklch(15% 0.015 255 / 0.08)', boxShadow: '0 2px 14px oklch(15% 0.015 255 / 0.2)', borderRadius: '0', margin: '4px 8px'} : {}}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '1.2rem', fontWeight: '600', fontFamily: "'Playfair Display',serif" }}>{res.firstName} {res.lastName}</strong>
                          <span style={{ background: LM_COLORS.textDark, color: '#fff', borderRadius: '0', padding: '4px 12px', fontSize: '0.72rem', fontWeight: '500', letterSpacing: '1.4px', textTransform: 'uppercase', fontFamily: "'Jost',sans-serif", whiteSpace: 'nowrap' }}>{res.guests} guests</span>
                          {res.celebration && res.celebration !== "None" && <span style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', color: LM_COLORS.goldText }}>{res.celebration}</span>}
                          {res.dietary && res.dietary !== "None" && <span style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', color: LM_COLORS.danger }}>{res.dietary}</span>}
                        </div>
                        <span style={{ fontWeight: '700', fontFamily: "'Playfair Display',serif", fontSize: '1.1rem' }}>{res.timeHHMM ? formatTimeLabel(res.timeHHMM) : ""}</span>
                      </div>
                      {res.phone && <div style={{ fontSize: '0.68rem', color: LM_COLORS.textMuted, marginTop: '6px', fontWeight: '500' }}>{res.phone}</div>}
                      {res.notes && <div style={{ color: LM_COLORS.textMuted, fontSize: '0.68rem', background: 'oklch(95% 0.006 90)', padding: '6px 12px', borderRadius: '6px', marginTop: '6px', display: 'inline-block' }}>"{res.notes}"</div>}
                      {res.notified_at && (() => {
                        const remaining = Math.max(0, 10 * 60 * 1000 - (nowSec - new Date(res.notified_at).getTime()));
                        const mins = Math.floor(remaining / 60000);
                        const secs = Math.floor((remaining % 60000) / 1000);
                        const isExpired = remaining === 0;
                        const color = isExpired ? LM_COLORS.danger : remaining < 2 * 60 * 1000 ? LM_COLORS.warn : LM_COLORS.success;
                        return (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px dashed ${LM_COLORS.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.68rem', color: LM_COLORS.textMuted }}>Hold time:</span>
                            <span style={{ fontSize: '0.76rem', fontWeight: '800', color, fontVariantNumeric: 'tabular-nums' }}>
                              {isExpired ? 'Expired' : `${mins}:${String(secs).padStart(2, '0')}`}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button style={seatButtonStyle} onClick={() => animateThenAct(res.id, () => onSeatParty(res))}>Seat</button>
                      <button style={{ ...seatButtonStyle, background: res.notified_at ? LM_COLORS.success : LM_COLORS.goldDark, color: '#fff', cursor: res.notified_at ? 'default' : 'pointer' }} onClick={() => !res.notified_at && onNotifyReady(res)}>{res.notified_at ? 'Notified' : 'Notify'}</button>
                      <button style={{ ...seatButtonStyle, background: '#fff', color: LM_COLORS.textDark, boxShadow: 'none', border: `1px solid ${LM_COLORS.border}` }} onClick={() => setEditingRes({...res})}>Edit</button>
                      <button style={{ ...seatButtonStyle, background: '#fff', color: LM_COLORS.danger, border: `1px solid ${LM_COLORS.danger}` }} onClick={() => animateThenAct(res.id, () => onCancelRes(res))}>Cancel</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'seated' && (
              <div className="sr-res-list">
                {seatedList.length === 0 ? <div className="sr-empty-state">No tables currently seated.</div> : seatedList.map(item => (
                  <div key={item.id} className="sr-list-item">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '1.2rem', fontWeight: '600', fontFamily: "'Playfair Display',serif" }}>{item.firstName} {item.lastName}</strong>
                          <span style={{ color: LM_COLORS.textMuted }}>({item.guests} pax)</span>
                          {item.celebration && item.celebration !== "None" && <span style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', color: LM_COLORS.goldText }}>{item.celebration}</span>}
                          {item.dietary && item.dietary !== "None" && <span style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', color: LM_COLORS.danger }}>{item.dietary}</span>}
                        </div>
                        <span style={{ fontWeight: '700', color: LM_COLORS.success }}>Seated {item.seated_at ? new Date(item.seated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                      </div>
                      {item.timeHHMM && <div style={{ fontSize: '0.68rem', color: LM_COLORS.textFaint, marginTop: '2px' }}>Res. time: {formatTimeLabel(item.timeHHMM)}</div>}
                      {item.phone && <div style={{ fontSize: '0.68rem', color: LM_COLORS.textMuted, marginTop: '2px', fontWeight: '500' }}>{item.phone}</div>}
                      {item.notes && <div style={{ color: LM_COLORS.textMuted, fontSize: '0.68rem', background: 'oklch(95% 0.006 90)', padding: '6px 12px', borderRadius: '6px', marginTop: '6px', display: 'inline-block' }}>"{item.notes}"</div>}
                    </div>
                    <button
                      onClick={() => onUnseatParty(item)}
                      style={{ ...seatButtonStyle, background: '#fff', color: LM_COLORS.textDark, border: `1px solid ${LM_COLORS.border}` }}
                    >
                      Undo
                    </button>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'canceled' && (
              <div className="sr-res-list">
                {canceledList.length === 0 ? <div className="sr-empty-state">Canceled reservations will appear here.</div> : canceledList.map(item => (
                  <div key={item.id} className="sr-list-item">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '20px' }}>
                        <div><strong style={{ fontSize: '1.2rem', fontWeight: '600', fontFamily: "'Playfair Display',serif", textDecoration: 'line-through', color: LM_COLORS.textFaint }}>{item.firstName} {item.lastName}</strong><span style={{ color: LM_COLORS.textFaint, marginLeft: '8px' }}>({item.guests} pax)</span>{item.notified_at && <span style={{ background: LM_COLORS.danger, color: '#fff', borderRadius: '3px', padding: '3px 9px', fontSize: '0.62rem', fontWeight: '700', marginLeft: '8px', verticalAlign: 'middle' }}>Didn't Show</span>}</div>
                        <span style={{ fontWeight: '700', color: LM_COLORS.textFaint }}>{item.timeHHMM ? formatTimeLabel(item.timeHHMM) : ""}</span>
                      </div>
                      {item.phone && <div style={{ fontSize: '0.68rem', color: LM_COLORS.textFaint, marginTop: '2px' }}>{item.phone}</div>}
                      {item.notes && <div style={{ color: LM_COLORS.textFaint, fontSize: '0.68rem', marginTop: '4px', fontStyle: 'italic' }}>"{item.notes}"</div>}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <button style={{ ...seatButtonStyle, background: '#fff', color: LM_COLORS.textDark, border: `1px solid ${LM_COLORS.border}` }} onClick={() => onUndoCancel(item)}>
                        Undo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'floorplan' && (
              <>
              <div className="sr-floor-manager">
                <div className="sr-floor-header">
                  <div className="sr-zone-selector">
                    {Object.keys(FLOOR_CONFIG).map(f => (
                      <button key={f} className={activeFloor === f ? 'active' : ''} onClick={() => setActiveFloor(f)}>{f}</button>
                    ))}
                  </div>
                  <div className="sr-floor-legend">
                    <span className="sr-legend-dot available" /><span>Available</span>
                    <span className="sr-legend-dot occupied" /><span>Occupied</span>
                  </div>
                  <button onClick={async () => {
                    if (!window.confirm('Clear ALL server assignments for all floors?')) return;
                    const allKeys = Object.keys(FLOOR_CONFIG).flatMap(floor =>
                      FLOOR_CONFIG[floor].map(t => `${floor}-${t.id}`)
                    );
                    const { error } = await supabase.from('table_status').upsert(allKeys.map(id => ({ id, server_names: [], status: 'av' })));
                    if (error) alert('Clear All failed: ' + error.message);
                  }} style={{ background: '#fff', color: LM_COLORS.danger, border: `1px solid ${LM_COLORS.danger}`, borderRadius: '8px', padding: '4px 10px', fontWeight: '700', fontSize: '0.68rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Jost',sans-serif" }}>
                    Clear All
                  </button>
                  {!assignMode && !unassignMode ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowAssignServerList(p => !p)} style={{ background: `linear-gradient(180deg, ${LM_COLORS.gold}, ${LM_COLORS.goldDim})`, color: LM_COLORS.goldDark, border: 'none', borderRadius: '8px', padding: '4px 10px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Jost',sans-serif" }}>
                          Assign Tables ▾
                        </button>
                        {showAssignServerList && (
                          <div style={{ position: 'absolute', top: '110%', right: 0, background: LM_COLORS.navyLight, border: `1px solid ${LM_COLORS.navyBorder}`, borderRadius: '10px', padding: '8px', zIndex: 100, minWidth: '160px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                            {servers.map(s => (
                              <button key={s.id} onClick={() => setAssigningServers(prev => { const set = new Set(prev); set.has(s.name) ? set.delete(s.name) : set.add(s.name); return set; })}
                                style={{ display: 'block', width: '100%', textAlign: 'left', background: assigningServers.has(s.name) ? LM_COLORS.info : 'transparent', color: 'oklch(90% 0.01 90)', border: 'none', borderRadius: '6px', padding: '6px 10px', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer', fontFamily: "'Jost',sans-serif" }}>
                                {s.name}
                              </button>
                            ))}
                            <div style={{ borderTop: `1px solid ${LM_COLORS.navyBorder}`, marginTop: '6px', paddingTop: '6px' }}>
                              <button onClick={() => { if (assigningServers.size > 0) { setAssignMode(true); setShowAssignServerList(false); } }}
                                style={{ width: '100%', background: assigningServers.size > 0 ? LM_COLORS.success : LM_COLORS.navyBorder, color: assigningServers.size > 0 ? '#fff' : 'oklch(55% 0.01 90)', border: 'none', borderRadius: '6px', padding: '6px', fontWeight: '700', fontSize: '0.75rem', cursor: assigningServers.size > 0 ? 'pointer' : 'default', fontFamily: "'Jost',sans-serif" }}>
                                Assign {assigningServers.size > 0 ? `(${assigningServers.size}) →` : ''}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <button onClick={() => { setUnassignMode(true); setPendingAssignTables(new Set()); }}
                        style={{ background: '#fff', color: LM_COLORS.danger, border: `1px solid ${LM_COLORS.danger}`, borderRadius: '8px', padding: '4px 10px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Jost',sans-serif" }}>
                        Unassign
                      </button>
                    </div>
                  ) : assignMode ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: LM_COLORS.textMuted, fontWeight: '600', whiteSpace: 'nowrap', fontFamily: "'Jost',sans-serif" }}>
                        {[...assigningServers].map(n => n.split(' ')[0]).join(', ')} — {pendingAssignTables.size}
                      </span>
                      <button onClick={async () => {
                        if (pendingAssignTables.size === 0) { alert('Select at least one table on the floor plan before confirming.'); return; }
                        const servers = [...assigningServers];
                        const results = await Promise.all([...pendingAssignTables].map(id => assignServersToTable(id, servers)));
                        const failed = results.find(r => r?.error);
                        if (failed) { alert('Assign failed: ' + failed.error.message); return; }
                        await Promise.all([...pendingAssignTables].map(id => logTableOcc(id, servers, dateISO)));
                        const { data } = await fetchTableEvents(dateISO);
                        setTableEvents(data || []);
                        setAssignMode(false); setAssigningServers(new Set()); setPendingAssignTables(new Set());
                      }} style={{ background: LM_COLORS.success, color: '#fff', border: 'none', borderRadius: '8px', padding: '4px 10px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Jost',sans-serif" }}>
                        Confirm
                      </button>
                      <button onClick={() => { setAssignMode(false); setAssigningServers(new Set()); setPendingAssignTables(new Set()); }}
                        style={{ background: 'transparent', color: LM_COLORS.textMuted, border: `1px solid ${LM_COLORS.border}`, borderRadius: '8px', padding: '4px 8px', fontSize: '0.72rem', cursor: 'pointer' }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: LM_COLORS.textMuted, fontWeight: '600', whiteSpace: 'nowrap', fontFamily: "'Jost',sans-serif" }}>
                        Remove: {pendingAssignTables.size} table(s)
                      </span>
                      <button onClick={async () => {
                        if (pendingAssignTables.size === 0) { alert('Select at least one table on the floor plan before confirming.'); return; }
                        const results = await Promise.all([...pendingAssignTables].map(id => assignServersToTable(id, [])));
                        const failed = results.find(r => r?.error);
                        if (failed) { alert('Unassign failed: ' + failed.error.message); return; }
                        setUnassignMode(false); setPendingAssignTables(new Set());
                      }} style={{ background: LM_COLORS.danger, color: '#fff', border: 'none', borderRadius: '8px', padding: '4px 10px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Jost',sans-serif" }}>
                        Confirm
                      </button>
                      <button onClick={() => { setUnassignMode(false); setPendingAssignTables(new Set()); }}
                        style={{ background: 'transparent', color: LM_COLORS.textMuted, border: `1px solid ${LM_COLORS.border}`, borderRadius: '8px', padding: '4px 8px', fontSize: '0.72rem', cursor: 'pointer' }}>
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <div className="sr-map-canvas">
                  <div className="sr-image-wrapper">
                    <img src={activeFloor === 'BAR' ? '/BAR.png' : activeFloor === 'ROOM1' ? '/FLOOR 1.jpg' : activeFloor === 'ROOM2' ? '/ROOM 2.jpg' : '/ROOM 3.jpg'} alt={activeFloor} className="sr-floor-img" onError={e => { e.target.style.display = 'none'; }} />
                    {FLOOR_CONFIG[activeFloor].map(table => {
                      const key = `${activeFloor}-${table.id}`;
                      const status = tableStatuses[key] ?? 'av';
                      const servers = tableServerNames?.[key] ?? [];
                      return (
                        <button
                          key={table.id}
                          className={`sr-table-marker shape-${table.shape || 'square'} ${status === 'occ' ? 'is-occupied' : 'is-available'}`}
                          style={{ top: table.top, left: table.left, outline: assignMode && pendingAssignTables.has(key) ? `3px solid ${LM_COLORS.success}` : unassignMode && pendingAssignTables.has(key) ? `3px solid ${LM_COLORS.danger}` : undefined, outlineOffset: '2px' }}
                          onClick={() => {
                            if (assignMode || unassignMode) {
                              setPendingAssignTables(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
                            } else {
                              handleTableSelection(table);
                            }
                          }}
                        >
                          <span className="table-id">{table.id}</span>
                          <span className="table-cap">{table.cap}p</span>
                          {servers.length > 0 && (
                            <span style={{ position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', background: LM_COLORS.info, color: '#fff', fontSize: '8px', fontWeight: '800', letterSpacing: '0.5px', borderRadius: '3px', padding: '2px 5px', whiteSpace: 'nowrap', lineHeight: 1.2, zIndex: 6, boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
                              {servers.map(n => getInitials(n)).join(' · ')}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              </>
            )}
            {activeTab === 'blackout' && (
              <div className="sr-walkin-form">
                <div className="sr-formGrid" style={{marginBottom: '16px'}}>
                  <div className="sr-field">
                    <label className="sr-fieldLabel">Date</label>
                    <input
                      ref={blackoutInputRef}
                      type="date"
                      className="sr-input"
                      style={{cursor: 'pointer'}}
                      value={blackoutForm.date}
                      onChange={e => setBlackoutForm(f => ({ ...f, date: e.target.value }))}
                      onClick={() => blackoutInputRef.current?.showPicker()}
                    />
                  </div>
                  <div className="sr-field">
                    <label className="sr-fieldLabel">Reason</label>
                    <input
                      className="sr-input"
                      placeholder="e.g. Evento privado, Chismas…"
                      value={blackoutForm.notes}
                      onChange={e => setBlackoutForm(f => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                  <button
                    className="sr-btn"
                    disabled={!blackoutForm.date}
                    style={{background: LM_COLORS.danger, color: '#fff', border: 'none', flex: 1, opacity: !blackoutForm.date ? 0.5 : 1}}
                    onClick={async () => {
                      await toggleBlackoutDate(blackoutForm.date, blackoutForm.notes, 'closed');
                      setBlackoutForm({ date: '', notes: '' });
                    }}
                  >
                    Closed Today
                  </button>
                  <button
                    className="sr-btn"
                    disabled={!blackoutForm.date}
                    style={{background: LM_COLORS.warn, color: '#fff', border: 'none', flex: 1, opacity: !blackoutForm.date ? 0.5 : 1}}
                    onClick={async () => {
                      await toggleBlackoutDate(blackoutForm.date, blackoutForm.notes, 'walkin_only');
                      setBlackoutForm({ date: '', notes: '' });
                    }}
                  >
                    Only Walk-In
                  </button>
                </div>

                <div style={{marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                  {blackoutDates.length === 0 && <p style={{color: LM_COLORS.textFaint, fontSize: '0.72rem'}}>No blocked dates.</p>}
                  {blackoutDates.map(b => (
                    <div key={b.date_iso} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: b.type === 'walkin_only' ? 'oklch(93% 0.06 85)' : 'oklch(93% 0.03 25)', border: `1px solid ${b.type === 'walkin_only' ? 'oklch(80% 0.1 80)' : 'oklch(85% 0.06 25)'}`, borderRadius: '0', padding: '12px 16px'}}>
                      <div>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <span style={{fontWeight: '700', fontSize: '0.76rem'}}>{b.date_iso}</span>
                          <span style={{fontSize: '0.6rem', fontWeight: '800', padding: '2px 8px', borderRadius: '20px', background: b.type === 'walkin_only' ? LM_COLORS.warn : LM_COLORS.danger, color: '#fff'}}>
                            {b.type === 'walkin_only' ? 'WALK-IN' : 'CLOSED'}
                          </span>
                        </div>
                        {b.notes && <div style={{fontSize: '0.66rem', color: b.type === 'walkin_only' ? 'oklch(45% 0.12 70)' : 'oklch(45% 0.16 25)', marginTop: '2px'}}>{b.notes}</div>}
                      </div>
                      <button
                        style={{background: 'none', border: 'none', cursor: 'pointer', color: LM_COLORS.danger, fontSize: '1.1rem', fontWeight: '700', padding: '4px 8px'}}
                        onClick={() => toggleBlackoutDate(b.date_iso)}
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'servers' && (
              <div className="sr-walkin-form">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px', position: 'relative' }}>
                  <button
                    onClick={() => { setServerMenuOpen(o => !o); setServerMenuMode(null); }}
                    style={{ background: 'transparent', border: `1px solid ${LM_COLORS.navyBorder}`, borderRadius: '8px', width: '34px', height: '34px', fontSize: '1.1rem', color: LM_COLORS.textDark, cursor: 'pointer' }}
                  >⚙</button>
                  {serverMenuOpen && (
                    <div style={{ position: 'absolute', top: '110%', right: 0, background: LM_COLORS.navyLight, border: `1px solid ${LM_COLORS.navyBorder}`, borderRadius: '10px', padding: '8px', zIndex: 100, minWidth: '200px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                      {serverMenuMode === null && (
                        <>
                          <button onClick={() => setServerMenuMode('add')} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', color: 'oklch(90% 0.01 90)', border: 'none', borderRadius: '6px', padding: '8px 10px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', fontFamily: "'Jost',sans-serif" }}>+ Add Server</button>
                          <button onClick={() => setServerMenuMode('edit')} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', color: 'oklch(90% 0.01 90)', border: 'none', borderRadius: '6px', padding: '8px 10px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', fontFamily: "'Jost',sans-serif" }}>✎ Edit Server</button>
                          <button onClick={() => setServerMenuMode('delete')} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', color: LM_COLORS.danger, border: 'none', borderRadius: '6px', padding: '8px 10px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', fontFamily: "'Jost',sans-serif" }}>✕ Delete Server</button>
                        </>
                      )}
                      {serverMenuMode === 'add' && (
                        <>
                          <button onClick={() => setServerMenuMode(null)} style={{ background: 'transparent', border: 'none', color: LM_COLORS.textFaint, fontSize: '0.72rem', cursor: 'pointer', padding: '4px 6px 10px', fontFamily: "'Jost',sans-serif" }}>← Back</button>
                          <input
                            autoFocus
                            className="sr-input"
                            placeholder="New server name"
                            value={newServerName}
                            onChange={e => setNewServerName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && newServerName.trim()) { onAddServer(newServerName); setNewServerName(''); setServerMenuOpen(false); } }}
                            style={{ marginBottom: '8px' }}
                          />
                          <button
                            className="sr-btn sr-btnPrimary"
                            style={{ width: '100%' }}
                            disabled={!newServerName.trim()}
                            onClick={() => { onAddServer(newServerName); setNewServerName(''); setServerMenuOpen(false); }}
                          >
                            Add
                          </button>
                        </>
                      )}
                      {(serverMenuMode === 'edit' || serverMenuMode === 'delete') && (
                        <>
                          <button onClick={() => setServerMenuMode(null)} style={{ background: 'transparent', border: 'none', color: LM_COLORS.textFaint, fontSize: '0.72rem', cursor: 'pointer', padding: '4px 6px 10px', fontFamily: "'Jost',sans-serif" }}>← Back</button>
                          {servers.length === 0 && <div style={{ color: LM_COLORS.textFaint, fontSize: '0.75rem', padding: '4px 10px' }}>No servers yet.</div>}
                          {servers.map(s => (
                            <button
                              key={s.id}
                              onClick={() => {
                                if (serverMenuMode === 'edit') {
                                  setEditingServer({ id: s.id, name: s.name });
                                } else if (window.confirm(`Remove ${s.name} from servers?`)) {
                                  onDeleteServer(s.id);
                                }
                                setServerMenuOpen(false);
                              }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', color: serverMenuMode === 'delete' ? LM_COLORS.danger : 'oklch(90% 0.01 90)', border: 'none', borderRadius: '6px', padding: '8px 10px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', fontFamily: "'Jost',sans-serif" }}
                            >
                              {s.name}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {servers.length === 0 && <p style={{color: LM_COLORS.textFaint, fontSize: '0.72rem'}}>No servers yet.</p>}
                  {servers.map(s => {
                    const myCount = tableEvents.filter(e => e.server_name === s.name).length;
                    const cleanName = s.name.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: LM_COLORS.navyLight, border: `1px solid ${LM_COLORS.navyBorder}`, borderRadius: '0', padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: LM_COLORS.navyBorder, border: `1px solid ${LM_COLORS.goldText}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', color: LM_COLORS.goldText, fontFamily: "'Jost',sans-serif", flexShrink: 0 }}>{getInitials(s.name)}</div>
                          <div style={{ fontWeight: '500', fontSize: '0.88rem', color: 'oklch(90% 0.01 90)', fontFamily: "'Jost',sans-serif", textTransform: 'uppercase', letterSpacing: '1px' }}>{cleanName}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: '700', fontFamily: "'Playfair Display',serif", color: myCount > 0 ? LM_COLORS.goldDim : 'oklch(45% 0.01 90)' }}>{myCount}</div>
                          <div style={{ fontSize: '0.62rem', color: 'oklch(55% 0.01 90)', fontWeight: '600', fontFamily: "'Jost',sans-serif" }}>tables today</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      {editingWaitItem && (
        <div className="sr-modal-overlay" onClick={() => setEditingWaitItem(null)}>
          <div className="sr-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{margin: '0 0 20px', fontSize: '1.4rem'}}>Edit Walk-in</h3>
            <div className="sr-formGrid">
              <div className="sr-field">
                <label className="sr-fieldLabel">Guests</label>
                <input className="sr-input" type="number" min="1" value={editingWaitItem.guests ?? ''} onFocus={e => e.target.select()} onChange={e => setEditingWaitItem({...editingWaitItem, guests: e.target.value === '' ? '' : parseInt(e.target.value) || 1})} />
              </div>
              <div className="sr-field sr-span2">
                <label className="sr-fieldLabel">Notes</label>
                <textarea className="sr-textarea" value={editingWaitItem.notes || ''} onChange={e => setEditingWaitItem({...editingWaitItem, notes: e.target.value})} />
              </div>
            </div>
            <div className="sr-actions" style={{marginTop: '20px'}}>
              <button className="sr-btn" onClick={() => setEditingWaitItem(null)}>Cancel</button>
              <button className="sr-btn sr-btnPrimary" onClick={async () => {
                await updateReservationRecord(editingWaitItem.id, { guests: editingWaitItem.guests, notes: editingWaitItem.notes });
                setEditingWaitItem(null);
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
      {editingRes && (
        <div className="sr-modal-overlay" onClick={() => setEditingRes(null)}>
          <div className="sr-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{margin: '0 0 20px', fontSize: '1.4rem'}}>Edit Reservation</h3>
            <div className="sr-formGrid">
              <div className="sr-field"><label className="sr-fieldLabel">First Name</label><input className="sr-input" value={editingRes.firstName} onChange={e => setEditingRes({...editingRes, firstName: e.target.value})} /></div>
              <div className="sr-field"><label className="sr-fieldLabel">Last Name</label><input className="sr-input" value={editingRes.lastName} onChange={e => setEditingRes({...editingRes, lastName: e.target.value})} /></div>
              <div className="sr-field"><label className="sr-fieldLabel">Phone</label><input className="sr-input" value={editingRes.phone || ''} onChange={e => setEditingRes({...editingRes, phone: e.target.value})} /></div>
              <div className="sr-field"><label className="sr-fieldLabel">Email</label><input className="sr-input" value={editingRes.email || ''} onChange={e => setEditingRes({...editingRes, email: e.target.value})} /></div>
              <div className="sr-field"><label className="sr-fieldLabel">Date</label><input className="sr-input" type="date" style={{cursor:'pointer'}} value={editingRes.dateISO || ''} onChange={e => setEditingRes({...editingRes, dateISO: e.target.value, timeHHMM: getTimeSlots(e.target.value)[0] || editingRes.timeHHMM})} onClick={e => e.target.showPicker()} /></div>
              <div className="sr-field"><label className="sr-fieldLabel">Time</label><select className="sr-input" value={editingRes.timeHHMM || ''} onChange={e => setEditingRes({...editingRes, timeHHMM: e.target.value})}>{getTimeSlots(editingRes.dateISO).map(slot => (<option key={slot} value={slot}>{formatTimeLabel(slot)}</option>))}</select></div>
              <div className="sr-field"><label className="sr-fieldLabel">Guests</label><input className="sr-input" type="number" min="1" placeholder="—" value={editingRes.guests ?? ''} onFocus={e => e.target.select()} onChange={e => setEditingRes({...editingRes, guests: e.target.value === '' ? '' : parseInt(e.target.value) || 1})} /></div>
              <div className="sr-field"><label className="sr-fieldLabel">Celebration</label><select className="sr-input" value={editingRes.celebration || 'None'} onChange={e => setEditingRes({...editingRes, celebration: e.target.value})}><option>None</option><option>Birthday</option><option>Anniversary</option><option>Wedding</option><option>Graduation</option><option>Other</option></select></div>
              <div className="sr-field"><label className="sr-fieldLabel">Dietary</label><select className="sr-input" value={editingRes.dietary || 'None'} onChange={e => setEditingRes({...editingRes, dietary: e.target.value})}><option>None</option><option>Vegetarian</option><option>Vegan</option><option>Gluten Free</option><option>Dairy Free</option><option>Nut Allergy</option><option>Shellfish Allergy</option></select></div>
              <div className="sr-field sr-span2"><label className="sr-fieldLabel">Notes</label><textarea className="sr-textarea" value={editingRes.notes || ''} onChange={e => setEditingRes({...editingRes, notes: e.target.value})} /></div>
            </div>
            <div className="sr-actions" style={{marginTop: '20px'}}>
              <button className="sr-btn" onClick={() => setEditingRes(null)}>Cancel</button>
              <button className="sr-btn sr-btnPrimary" onClick={async () => { await onSaveEdit(editingRes.id, { firstName: editingRes.firstName, lastName: editingRes.lastName, phone: editingRes.phone, email: editingRes.email, guests: editingRes.guests, dateISO: editingRes.dateISO, timeHHMM: editingRes.timeHHMM, celebration: editingRes.celebration, dietary: editingRes.dietary, notes: editingRes.notes }); setEditingRes(null); }}>Save</button>
            </div>
          </div>
        </div>
      )}
      {editingServer && (
        <div className="sr-modal-overlay" onClick={() => setEditingServer(null)}>
          <div className="sr-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{margin: '0 0 20px', fontSize: '1.4rem'}}>Edit Server</h3>
            <div className="sr-formGrid">
              <div className="sr-field sr-span2">
                <label className="sr-fieldLabel">Name</label>
                <input className="sr-input" value={editingServer.name} onChange={e => setEditingServer({...editingServer, name: e.target.value})} />
              </div>
            </div>
            <div className="sr-actions" style={{marginTop: '20px'}}>
              <button className="sr-btn" onClick={() => setEditingServer(null)}>Cancel</button>
              <button className="sr-btn sr-btnPrimary" disabled={!editingServer.name.trim()} onClick={async () => {
                await onUpdateServer(editingServer.id, editingServer.name);
                setEditingServer(null);
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const CLIENT_STEP_ORDER = ['search', 'contact', 'preferences'];
const CLIENT_STEP_LABELS = ['Reservation', 'Guest Details', 'Preferences'];

function ClientStepShell({ step, setStep, dateLabel, timeLabel, guests, children }) {
  const idx = CLIENT_STEP_ORDER.indexOf(step);
  return (
    <div className={`sr-page${idx > 0 ? ' sr-form-step' : ''}`}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,500&family=Jost:wght@300;400;500;600&display=swap');`}</style>
      <div className="sr-client-col">
        <img src="/logo.png" alt="Il Toro E La Capra" className="sr-logo" />
        <div className="sr-client-divider" />
        {idx >= 0 && (
          <div className="sr-step-tracker">
            {CLIENT_STEP_ORDER.map((s, i) => (
              <button
                key={s}
                type="button"
                className={`sr-step-item${i === idx ? ' current' : ''}${i <= idx ? ' done' : ''}`}
                onClick={() => i <= idx && setStep(s)}
              >
                <span className="sr-step-dot" />
                <span className="sr-step-text">{CLIENT_STEP_LABELS[i]}</span>
              </button>
            ))}
          </div>
        )}
        {idx > 0 && (
          <div className="sr-summary"><div className="sr-summaryTitle">{dateLabel} · {timeLabel} · {guests} guests</div></div>
        )}
        {children}
        <div style={{ marginTop: 28, fontSize: 12, letterSpacing: '0.5px', color: 'oklch(45% 0.015 90)', textAlign: 'center' }}>© 2026 Software developed by joner1166 all rights reserved</div>
      </div>
    </div>
  );
}

// --- COMPONENTE CLIENT CONFIRMATION (Paso 3) ---
const ClientConfirmationView = React.memo(function ClientConfirmationView({ firstName, setStep, setClientForm }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px', padding: '8px 0 24px' }}>
      <div style={{ fontSize: '12px', letterSpacing: '5px', color: 'oklch(78% 0.13 85)', textTransform: 'uppercase', marginBottom: '20px', fontFamily: "'Jost',sans-serif" }}>
        Reservation Confirmed
      </div>
      <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: '600', fontSize: '2.4rem', lineHeight: '1.25', color: 'oklch(97% 0.01 90)', maxWidth: '480px' }}>
        Thank you for your reservation, {firstName}!
      </div>
      <div style={{ fontSize: '15px', color: 'oklch(70% 0.02 90)', marginTop: '14px', fontFamily: "'Jost',sans-serif" }}>
        We look forward to seeing you soon.
      </div>
      <div className="sr-client-divider" />
      <button
        className="sr-btn sr-btnPrimary"
        onClick={() => {
          setClientForm({ firstName: '', lastName: '', phone: '', phoneCode: '+1', email: '', celebration: 'None', dietary: 'None', notes: '', smsOptIn: false });
          setStep('search');
        }}
        style={{ width: '100%', maxWidth: '340px', marginTop: '4px' }}
      >
        Make Another Reservation
      </button>
    </div>
  );
});

// --- COMPONENTE CLIENT SEARCH (Paso 1) ---
const ClientSearchView = React.memo(function ClientSearchView({
  dateISO, onDateChange, dateLabel, stepDate,
  guests, setGuests,
  timeHHMM, setTimeHHMM,
  isBlackout, isWalkInOnly, setStep,
  bookedHourCounts, bookedHourGuests
}) {
  const range = getAvailableTimeRange(dateISO);
  const [tick, setTick] = useState(0);
  const [searchError, setSearchError] = useState('');
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const availableSlots = getTimeSlots(dateISO, true).filter(slot => {
    const hour = Math.floor(minutesFromHHMM(slot) / 60);
    return (bookedHourCounts[hour] || 0) < MAX_RESERVATIONS_PER_HOUR &&
           (bookedHourGuests[hour] || 0) < RESTAURANT_CAPACITY;
  });
  // Auto-reset time if selected slot is no longer available (e.g. same-day cutoff advancing)
  useEffect(() => {
    if (availableSlots.length > 0 && !availableSlots.includes(timeHHMM)) {
      setTimeHHMM(availableSlots[0]);
    }
  }, [dateISO, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
      <main className="sr-card">
        <section className="sr-form">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
            <div>
              <label className="sr-fieldLabel" style={{ display: 'block', marginBottom: '10px' }}>Date</label>
              <input
                type="date"
                className="sr-input"
                value={dateISO}
                min={dateISOFromDate(new Date())}
                onChange={(e) => { setSearchError(''); onDateChange(e.target.value); }}
                style={{ colorScheme: 'dark', cursor: 'pointer' }}
              />
            </div>
            <div>
              <label className="sr-fieldLabel" style={{ display: 'block', marginBottom: '10px' }}>Time</label>
              {availableSlots.length > 0 ? (
                <select className="sr-input" value={timeHHMM} onChange={e => setTimeHHMM(e.target.value)} style={{ cursor: 'pointer' }}>
                  {availableSlots.map(slot => (
                    <option key={slot} value={slot}>{formatTimeLabel(slot)}</option>
                  ))}
                </select>
              ) : (
                <div className="sr-input" style={{ display: 'flex', alignItems: 'center', color: 'oklch(70% 0.16 28)' }}>No availability</div>
              )}
            </div>
            <div>
              <label className="sr-fieldLabel" style={{ display: 'block', marginBottom: '10px' }}>Guests</label>
              <div className="sr-guest-box">
                <input
                  type="number"
                  min="1"
                  max={MAX_CLIENT_GUESTS}
                  inputMode="numeric"
                  className="sr-guest-box-value"
                  placeholder="Guest Number"
                  value={guests ?? ''}
                  onChange={e => { setSearchError(''); setGuests(e.target.value === '' ? null : Math.min(Math.max(parseInt(e.target.value) || 1, 1), MAX_CLIENT_GUESTS)); }}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button type="button" className="sr-stepper-btn" onClick={() => { setSearchError(''); setGuests(g => Math.max((g ?? 0) - 1, 1)); }}>−</button>
                  <button type="button" className="sr-stepper-btn" onClick={() => { setSearchError(''); setGuests(g => Math.min((g ?? 0) + 1, MAX_CLIENT_GUESTS)); }}>+</button>
                </div>
              </div>
            </div>
          </div>
          {isBlackout ? (
            <div style={{marginTop: '20px', textAlign: 'center', color: 'oklch(78% 0.13 28)', background: 'oklch(30% 0.08 28 / 0.3)', border: '1px solid oklch(60% 0.14 28 / 0.4)', padding: '15px', borderRadius: '8px'}}>We are closed today, but please visit us on any other date! We will be more than happy to host your party.</div>
          ) : isWalkInOnly ? (
            <div style={{marginTop: '20px', textAlign: 'center', color: 'oklch(82% 0.1 80)', background: 'oklch(30% 0.06 80 / 0.3)', border: '1px solid oklch(65% 0.12 80 / 0.4)', padding: '15px', borderRadius: '8px', fontWeight: '600'}}>Today we are only accepting walk-ins, but please come by and we will do our best to seat you as quickly as possible!</div>
          ) : availableSlots.length === 0 ? (
            <div style={{marginTop: '20px', textAlign: 'center', color: 'oklch(78% 0.13 28)', background: 'oklch(30% 0.08 28 / 0.3)', border: '1px solid oklch(60% 0.14 28 / 0.4)', padding: '15px', borderRadius: '8px'}}>No availability for this date. Please try another day.</div>
          ) : (
            <>
              {searchError && (
                <div style={{ margin: '16px 0 8px', padding: '12px 16px', background: 'oklch(30% 0.06 80 / 0.3)', border: '1px solid oklch(65% 0.12 80 / 0.4)', borderRadius: '12px', color: 'oklch(82% 0.1 80)', fontSize: '0.88rem', textAlign: 'center', fontWeight: '500' }}>
                  {searchError}
                </div>
              )}
              <button className="sr-search" onClick={() => {
                setSearchError('');
                if (dateISO < dateISOFromDate(new Date())) {
                  setSearchError('Please select another date, bookings in past dates are not allowed.');
                  return;
                }
                if (!guests || guests < 1) return alert("Please enter the number of guests.");
                setStep("contact");
              }}>Search</button>
            </>
          )}
          <div className="sr-foot">
            If your party is over 25 people please{' '}
            <a href="tel:7023316090">
              call us at (702) 331-6090
            </a>
            {' '}so we can properly accommodate you.
          </div>
        </section>
      </main>
  );
});

// --- COMPONENTE CLIENT CONTACT (Paso 2) ---
const ClientContactView = React.memo(function ClientContactView({
  formState, setFormState, setStep
}) {
  const { firstName, lastName, phone, phoneCode, email } = formState;
  const updateForm = (key, val) => setFormState(prev => ({ ...prev, [key]: val }));

  return (
      <main className="sr-card">
        <section className="sr-form">
          <div className="sr-formGrid">
            <div className="sr-field"><label className="sr-fieldLabel">First name</label><input className="sr-input" placeholder="Jane" value={firstName} onChange={e => updateForm('firstName', e.target.value)} /></div>
            <div className="sr-field"><label className="sr-fieldLabel">Last name</label><input className="sr-input" placeholder="Doe" value={lastName} onChange={e => updateForm('lastName', e.target.value)} /></div>
            <div className="sr-field sr-span2"><label className="sr-fieldLabel">Telephone</label><div style={{display:'flex',gap:'10px'}}><select className="sr-input" style={{width:'110px',flexShrink:0}} value={phoneCode} onChange={e => updateForm('phoneCode', e.target.value)}>{COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select><input className="sr-input" style={{flex:1}} value={phone} onChange={e => updateForm('phone', e.target.value)} placeholder="000-000-0000"/></div></div>
            <div className="sr-field sr-span2"><label className="sr-fieldLabel">Email</label><input className="sr-input" placeholder="jane@doe.com" value={email} onChange={e => updateForm('email', e.target.value)} /></div>
          </div>
          <div className="sr-actions">
            <button className="sr-btn" onClick={() => setStep("search")}>Back</button>
            <button className="sr-btn sr-btnPrimary" onClick={() => setStep("preferences")}>Continue</button>
          </div>
        </section>
      </main>
  );
});

// --- COMPONENTE CLIENT PREFERENCES (Paso 3) ---
const ClientPreferencesView = React.memo(function ClientPreferencesView({
  formState, setFormState,
  setStep, onSubmitClientRes, submitting
}) {
  const { celebration, dietary, notes, smsOptIn } = formState;
  const updateForm = (key, val) => setFormState(prev => ({ ...prev, [key]: val }));
  const [smsReminderShown, setSmsReminderShown] = useState(false);

  const handleSubmit = () => {
    if (!smsOptIn && !smsReminderShown) {
      setSmsReminderShown(true);
      return;
    }
    onSubmitClientRes();
  };

  return (
      <main className="sr-card">
        <section className="sr-form">
          <div className="sr-formGrid">
            <div className="sr-field sr-span2"><label className="sr-fieldLabel">Celebration</label><select className="sr-input" value={celebration} onChange={e => updateForm('celebration', e.target.value)}><option>None</option><option>Birthday</option><option>Anniversary</option><option>Wedding</option><option>Graduation</option><option>Other</option></select></div>
            <div className="sr-field sr-span2"><label className="sr-fieldLabel">Dietary Restrictions</label><select className="sr-input" value={dietary} onChange={e => updateForm('dietary', e.target.value)}><option>None</option><option>Vegetarian</option><option>Vegan</option><option>Gluten Free</option><option>Dairy Free</option><option>Nut Allergy</option><option>Shellfish Allergy</option></select></div>
            <div className="sr-field sr-span2"><label className="sr-fieldLabel">Notes</label><textarea className="sr-textarea" placeholder="Anything we should know?" value={notes} onChange={e => updateForm('notes', e.target.value)} /></div>
          </div>
          {smsReminderShown && !smsOptIn && (
            <div style={{margin:'12px 0 0',padding:'10px 14px',background:'oklch(93% 0.06 85)',border:'1px solid oklch(80% 0.1 80)',borderRadius:'10px',fontSize:'0.78rem',color:'oklch(45% 0.12 70)',display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontSize:'1.1rem'}}>📱</span>
              <span>Don't miss reservation updates! Check the box below to receive SMS notifications. You can still proceed without it.</span>
            </div>
          )}
          <label style={{display:'flex',alignItems:'flex-start',gap:'10px',margin:'12px 0 4px',cursor:'pointer',fontSize:'0.78rem',color:'oklch(62% 0.02 90)',lineHeight:'1.7',outline: smsReminderShown && !smsOptIn ? '2px solid oklch(80% 0.1 80)' : 'none',borderRadius:'8px',padding: smsReminderShown && !smsOptIn ? '6px 8px' : '0'}}>
            <input type="checkbox" checked={smsOptIn} onChange={e => updateForm('smsOptIn', e.target.checked)} style={{marginTop:'3px',flexShrink:0,width:'16px',height:'16px',accentColor:'oklch(78% 0.13 85)'}} />
            <span>
              I agree to receive SMS notifications about my reservation from Il Toro E La Capra (up to 2 messages per reservation). Msg &amp; data rates may apply. Reply <strong>STOP</strong> to cancel, <strong>HELP</strong> for help. Consent is not required to complete your reservation.{' '}
              <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>
              {' | '}
              <a href="/terms.html" target="_blank" rel="noopener">Terms &amp; Conditions</a>
            </span>
          </label>
          <div className="sr-actions">
            <button className="sr-btn" onClick={() => setStep("contact")}>Back</button>
            <button className="sr-btn sr-btnPrimary" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Enviando...' : 'Submit'}</button>
          </div>
        </section>
      </main>
  );
});

/*******************************************************
 * BLOQUE 7 — MANAGER VIEW
 *******************************************************/

function ManagerPinView({ onSuccess }) {
  const [pin, setPin] = useState('');
  const check = () => { if (pin === MANAGER_PASSWORD) onSuccess(); else alert('Incorrect PIN'); };
  return (
    <div style={{ minHeight: '100vh', background: '#120D08', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: '24px 20px', fontFamily: "'Space Grotesk',system-ui,sans-serif", position: 'relative', overflow: 'hidden' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,600&family=Space+Grotesk:wght@400;500;600;700&display=swap'); @keyframes lmPop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}} .sr-manager-pin::placeholder{font-size:0.95rem;letter-spacing:1px;}`}</style>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(1300px 640px at 50% -12%,rgba(227,169,74,0.12),transparent 62%),radial-gradient(900px 500px at 100% 110%,rgba(226,123,92,0.07),transparent 60%)' }} />
      <img src="/logo.png" alt="Logo" style={{ height: 163, position: 'relative', filter: 'drop-shadow(0 8px 26px rgba(0,0,0,.6))' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 380, background: 'linear-gradient(180deg,#201911,#17110A)', border: '1px solid rgba(227,169,74,0.16)', borderRadius: 22, padding: '34px 30px 30px', boxShadow: '0 34px 90px -34px rgba(0,0,0,.85)', animation: 'lmPop .5s ease both' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ textTransform: 'uppercase', letterSpacing: '.3em', fontSize: 11, color: '#8A7C6B' }}>Restaurant Manager</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: 32, color: '#F1E8DA', marginTop: 4 }}>Manager Access</div>
        </div>
        <input type="password" className="sr-manager-pin" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()} placeholder="Enter access number"
          style={{ width: '100%', padding: '17px 18px', borderRadius: 13, border: '1px solid rgba(227,169,74,0.22)', background: 'rgba(255,255,255,0.03)', color: '#F1E8DA', fontSize: '1.6rem', textAlign: 'center', letterSpacing: '6px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', colorScheme: 'dark' }} autoFocus />
        <button onClick={check} style={{ width: '100%', marginTop: 18, padding: 15, borderRadius: 13, border: 'none', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '.14em', textTransform: 'uppercase', cursor: pin ? 'pointer' : 'not-allowed', ...(pin ? { background: 'linear-gradient(90deg,#E9B65C,#E27B5C)', color: '#241505', boxShadow: '0 14px 32px -14px rgba(227,169,74,.75)' } : { background: 'rgba(255,255,255,0.05)', color: '#6B5F52' }) }}>
          Access
        </button>
      </div>
      <div style={{ position: 'relative', fontSize: 12, color: '#6B5F52' }}>© 2026 Software developed by joner1166 all rights reserved</div>
    </div>
  );
}

function HostessPinView({ onSuccess }) {
  const [pin, setPin] = useState('');
  const check = () => { if (pin === HOSTESS_PASSWORD) onSuccess(); else alert('Incorrect PIN'); };
  const hasCode = pin.trim().length > 0;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', fontFamily: "'Jost',sans-serif", position: 'relative', overflow: 'hidden' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,500&family=Jost:wght@300;400;500;600&display=swap'); .sr-hostess-pin::placeholder{color:oklch(55% 0.02 90);}`}</style>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(1100px 700px at 15% -10%, oklch(30% 0.03 250 / 0.5), transparent 60%), radial-gradient(900px 600px at 100% 100%, oklch(38% 0.07 45 / 0.35), transparent 55%), linear-gradient(180deg, oklch(15% 0.015 255) 0%, oklch(11% 0.012 255) 100%)' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img src="/logo.png" alt="Logo" style={{ width: '100%', maxWidth: 532, height: 'auto', display: 'block', marginBottom: 40 }} />
        <div style={{ width: '100%', padding: '44px 40px', borderRadius: 4, background: 'oklch(14% 0.015 255 / 0.55)', border: '1px solid oklch(70% 0.11 85 / 0.28)', backdropFilter: 'blur(10px)', boxShadow: '0 30px 60px -20px oklch(5% 0 0 / 0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: 'oklch(70% 0.11 85)', textTransform: 'uppercase' }}>Restaurant Hostess</div>
          <div style={{ marginTop: 12, fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 32, color: 'oklch(96% 0.01 90)' }}>Hostess Access</div>
          <div style={{ width: 40, height: 1, background: 'oklch(70% 0.11 85 / 0.5)', margin: '24px 0 32px' }} />
          <input type="password" className="sr-hostess-pin" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()} placeholder="Enter access number"
            style={{ width: '100%', height: 56, padding: '0 20px', textAlign: 'center', border: '1px solid oklch(70% 0.11 85 / 0.28)', background: 'oklch(18% 0.01 255 / 0.6)', color: 'oklch(94% 0.01 90)', fontSize: 16, letterSpacing: '2px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', borderRadius: 0 }} autoFocus />
          <button onClick={check} style={{ width: '100%', marginTop: 24, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500, border: 'none', borderRadius: 0, transition: 'background 0.15s ease, color 0.15s ease', ...(hasCode ? { background: 'linear-gradient(180deg, oklch(80% 0.14 85), oklch(72% 0.14 82))', color: 'oklch(18% 0.02 85)' } : { background: 'oklch(30% 0.01 260)', color: 'oklch(60% 0.01 90)' }) }}>
            Access
          </button>
        </div>
        <div style={{ marginTop: 28, fontSize: 12, letterSpacing: '0.5px', color: 'oklch(45% 0.015 90)', textAlign: 'center' }}>© 2026 Software developed by joner1166 all rights reserved</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, onClick }) {
  const active = !!onClick;
  return (
    <div onClick={onClick} style={{ background: active ? 'linear-gradient(180deg,#201911,#181109)' : 'linear-gradient(180deg,#1D170F,#161009)', border: `1px solid rgba(227,169,74,${active ? 0.28 : 0.10})`, borderRadius: 16, padding: '16px 16px 15px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 104, cursor: active ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ textTransform: 'uppercase', letterSpacing: '.18em', fontSize: 11, color: active ? '#C9A876' : '#8A7C6B' }}>{label}</div>
          <div style={{ fontSize: 12, color: active ? '#8A7C6B' : '#5A5145', marginTop: 5 }}>{sub}</div>
        </div>
        {active && <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#7A6D5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 40, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: active ? color : '#5A5145', marginTop: 10 }}>{value}</div>
    </div>
  );
}

const SECTION_COLORS = { reservations: '#60a5fa', waitlist: '#fbbf24', seated: '#4ade80', canceled: '#f87171' };
const SECTION_LABELS = { reservations: 'Reservations', waitlist: 'Wait List', seated: 'Seated', canceled: 'Canceled' };

function StatusBadge({ status, source, notified }) {
  const isWalkin = source === 'walkin' && status !== 'seated' && status !== 'cancelled';
  const isNotified = status === 'waitlist' && notified;
  const color = isNotified ? '#5B8FCB'
    : isWalkin ? '#E3A94A'
    : status === 'reserved' ? '#5B8FCB'
    : status === 'waitlist' ? '#E3A94A'
    : status === 'seated' ? '#8CC98F'
    : status === 'cancelled' ? '#E27B5C'
    : 'rgba(255,255,255,0.3)';
  const label = isNotified ? 'Notified'
    : isWalkin ? 'Walk-in'
    : status === 'reserved' ? 'Reserved'
    : status === 'waitlist' ? 'Waiting'
    : status === 'seated' ? 'Seated'
    : status === 'cancelled' ? 'Canceled'
    : status;
  return (
    <span style={{ background: `${color}1A`, border: `1px solid ${color}55`, color, borderRadius: 99, padding: '5px 13px', fontSize: '0.72rem', fontWeight: 600 }}>{label}</span>
  );
}

function RecordCard({ r, onClick }) {
  const name = [r.firstName, r.lastName].filter(Boolean).join(' ') || '—';
  const sourceLabel = r.source === 'walkin' ? 'Walk-in' : r.source === 'phone' ? 'Phone' : r.source === 'online' ? 'Online' : r.source || '';
  return (
    <div onClick={onClick} style={{ background: 'linear-gradient(180deg,#201911,#181109)', border: '1px solid rgba(227,169,74,0.14)', borderRadius: 16, padding: 20, marginBottom: 14, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 18, letterSpacing: '.02em', color: '#F1E8DA' }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusBadge status={r.status} source={r.source} notified={!!r.notified_at} />
          {onClick && <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#7A6D5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 34px', fontSize: 14, color: '#8A7C6B' }}>
        {r.guests != null && <div>Guests: <strong style={{ color: '#F1E8DA', fontWeight: 600 }}>{r.guests}</strong></div>}
        {r.source === 'walkin'
          ? r.created_at && <div>Time: <strong style={{ color: '#F1E8DA', fontWeight: 600 }}>{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
          : r.timeHHMM && <div>Time: <strong style={{ color: '#F1E8DA', fontWeight: 600 }}>{r.timeHHMM}</strong></div>
        }
        {r.phone && <div>Phone: <strong style={{ color: '#F1E8DA', fontWeight: 600 }}>{r.phone}</strong></div>}
        {sourceLabel && <div>Source: <strong style={{ color: '#F1E8DA', fontWeight: 600 }}>{sourceLabel}</strong></div>}
        {r.celebration && r.celebration !== 'None' && <div>Celebration: <strong style={{ color: '#E9B65C', fontWeight: 600 }}>{r.celebration}</strong></div>}
        {r.dietary && r.dietary !== 'None' && <div>Dietary: <strong style={{ color: '#E9B65C', fontWeight: 600 }}>{r.dietary}</strong></div>}
      </div>
      {r.notes && <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(227,169,74,0.08)', fontSize: 14, color: '#8A7C6B' }}>Notes: <strong style={{ color: '#F1E8DA', fontWeight: 600 }}>{r.notes}</strong></div>}
    </div>
  );
}

const CELEBRATION_OPTIONS = ['None','Birthday','Anniversary','Quinceañera','Graduation','Baby Shower','Other'];
const DIETARY_OPTIONS = ['None','Vegetarian','Vegan','Gluten-Free','Nut Allergy','Dairy-Free','Other'];
const mgInput = { width: '100%', padding: '13px 14px', borderRadius: 10, border: '1px solid rgba(227,169,74,0.18)', background: 'rgba(255,255,255,0.03)', color: '#F1E8DA', fontFamily: "'Space Grotesk',system-ui,sans-serif", fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' };
const mgLabel = { display: 'block', fontSize: '0.68rem', color: '#C9A876', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 7 };

const ManagerView = React.memo(function ManagerView({ dateISO, dateLabel, stepDate, onDateChange, history, waitList, seatedList, canceledList, rows, tableStatuses, isBlackout, onRefresh, onSignOut }) {
  const [activeSection, setActiveSection] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [addMode, setAddMode] = useState(null);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', phone: '', guests: 2, timeHHMM: '19:00', celebration: 'None', dietary: 'None', notes: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [clock, setClock] = useState('');
  useEffect(() => { const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })); tick(); const iv = setInterval(tick, 10000); return () => clearInterval(iv); }, []);
  const aef = (field) => (e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }));
  const resetAdd = () => { setAddMode(null); setAddForm({ firstName: '', lastName: '', phone: '', guests: 2, timeHHMM: '19:00', celebration: 'None', dietary: 'None', notes: '' }); };
  const mkToken = () => { try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch(_){} return `${Date.now()}-${Math.random().toString(16).slice(2)}`; };

  const handleAddWalkin = async () => {
    if (isBlackout) return alert('Cannot add walk-ins on a closed day.');
    if (dateISO !== dateISOFromDate(new Date())) return alert('Walk-ins can only be added for today\'s date.');
    if (!addForm.firstName.trim()) return alert('First name is required.');
    setAddSaving(true);
    try {
      const cancelToken = mkToken();
      const { error } = await insertWaitlistRecord({ firstName: addForm.firstName.trim().toUpperCase(), lastName: (addForm.lastName || '').trim().toUpperCase(), guests: Number(addForm.guests) || 1, dateISO, timeHHMM: addForm.timeHHMM, phone: addForm.phone || null, celebration: addForm.celebration, dietary: addForm.dietary, notes: addForm.notes || null, status: 'waitlist', source: 'walkin', cancel_token: cancelToken, estimated_wait: 15 });
      if (error) throw error;
      if (addForm.phone) {
        try { await fetch('/.netlify/functions/send-sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'waitlist', phone: addForm.phone, firstName: addForm.firstName, guests: Number(addForm.guests) || 1, cancel_token: cancelToken }) }); } catch(e) { console.error('SMS fail', e); }
      }
      resetAdd();
    } catch(e) { alert('Error: ' + (e?.message || e)); }
    finally { setAddSaving(false); }
  };

  const handleAddReservation = async () => {
    if (isBlackout) return alert('Cannot make reservations on a closed day.');
    if (dateISO < dateISOFromDate(new Date())) return alert('Cannot make reservations for a past date.');
    if (!addForm.firstName.trim() || !addForm.lastName.trim()) return alert('First and last name are required.');
    if (!isTimeAllowed(dateISO, addForm.timeHHMM)) {
      const range = getAvailableTimeRange(dateISO);
      return alert(range ? `Reservations only accepted between ${formatTimeLabel(range.open)} and ${formatTimeLabel(range.lastSlot)}.` : 'The restaurant is closed this day.');
    }
    setAddSaving(true);
    try {
      const cancelToken = mkToken();
      const phone = addForm.phone || null;
      const { error } = await insertReservationRecord({ firstName: addForm.firstName.trim().toUpperCase(), lastName: addForm.lastName.trim().toUpperCase(), guests: Number(addForm.guests) || 1, dateISO, timeHHMM: addForm.timeHHMM, phone, celebration: addForm.celebration, dietary: addForm.dietary, notes: addForm.notes || null, status: 'reserved', source: 'reservation', cancel_token: cancelToken });
      if (error) throw error;
      if (phone) {
        try { await fetch('/.netlify/functions/send-sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'confirm', phone, firstName: addForm.firstName, dateLabel, timeLabel: formatTimeLabel(addForm.timeHHMM), guests: Number(addForm.guests) || 1, cancel_token: cancelToken }) }); } catch(e) { console.error('SMS fail', e); }
      }
      resetAdd();
    } catch(e) { alert('Error: ' + (e?.message || e)); }
    finally { setAddSaving(false); }
  };

  const openEdit = (r) => {
    setEditingRecord(r);
    setEditForm({ firstName: r.firstName || '', lastName: r.lastName || '', guests: r.guests ?? '', timeHHMM: r.timeHHMM || '', phone: r.phone || '', notes: r.notes || '', celebration: r.celebration || 'None', dietary: r.dietary || 'None' });
  };
  const closeEdit = () => { setEditingRecord(null); setEditForm({}); };

  const handleSave = async () => {
    setEditSaving(true);
    try {
      await updateReservationRecord(editingRecord.id, { firstName: editForm.firstName, lastName: editForm.lastName, guests: Number(editForm.guests) || editingRecord.guests, timeHHMM: editForm.timeHHMM || null, phone: editForm.phone, notes: editForm.notes, celebration: editForm.celebration, dietary: editForm.dietary });
      closeEdit();
    } finally { setEditSaving(false); }
  };

  const handleCancelReservation = async () => {
    if (!window.confirm('Cancel this reservation?')) return;
    setEditSaving(true);
    try { await cancelReservation(editingRecord.id); closeEdit(); }
    finally { setEditSaving(false); }
  };

  const ef = (field) => (e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }));

  const totalResGuests = history.reduce((s, r) => s + (r.guests || 0), 0);
  const seatedGuests = seatedList.reduce((s, r) => s + (r.guests || 0), 0);
  const tableKeys = Object.keys(tableStatuses);
  const occupiedTables = tableKeys.filter(k => tableStatuses[k] === 'occ').length;
  const totalTables = tableKeys.length;
  const occupancyPct = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0;
  const allDayGuests = rows.reduce((s, r) => s + (r.guests || 0), 0);

  const hourlyRes = {};
  history.forEach(r => { if (r.timeHHMM) { const h = r.timeHHMM.split(':')[0]; hourlyRes[h] = (hourlyRes[h] || 0) + 1; } });

  const sectionData = { reservations: history, waitlist: waitList, seated: seatedList, canceled: canceledList };

  return (
    <div style={{ minHeight: '100vh', background: '#120D08', fontFamily: "'Space Grotesk',system-ui,sans-serif", color: '#F1E8DA', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        @keyframes lmFade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
        @keyframes lmPulse { 0%,100%{opacity:1;} 50%{opacity:.5;} }
        @keyframes lmSpin { to { transform: rotate(360deg); } }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.6) sepia(0.4) hue-rotate(0deg); opacity:.5; }
        input::placeholder, textarea::placeholder { color: #6B5F52; }
        select option { background: #1C1309; }
      `}</style>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(1300px 640px at 50% -12%,rgba(227,169,74,0.10),transparent 62%),radial-gradient(900px 500px at 100% 110%,rgba(226,123,92,0.06),transparent 60%)' }} />

      {/* ── HEADER ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid rgba(227,169,74,0.10)', background: 'rgba(18,13,8,0.94)', backdropFilter: 'blur(12px)' }}>
        {/* Row 1: logo + clock + sign out — only on dashboard */}
        {!activeSection && !editingRecord && !addMode && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0', maxWidth: 480, margin: '0 auto' }}>
            <img src="/logo.png" alt="Il Toro E La Capra" style={{ height: 82, filter: 'brightness(0.9)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 99, border: '1px solid rgba(123,174,126,0.25)', background: 'rgba(123,174,126,0.08)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8CC98F', animation: 'lmPulse 2s infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#8A7C6B', fontVariantNumeric: 'tabular-nums' }}>{clock}</span>
              </div>
              <button onClick={onSignOut} style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid rgba(227,169,74,0.18)', background: 'rgba(255,255,255,0.03)', color: '#B9A48A', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
            </div>
          </div>
        )}
        {/* Row 2: nav + label + date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: activeSection || editingRecord || addMode ? '14px 16px' : '10px 16px 14px', maxWidth: 480, margin: '0 auto' }}>
          <button onClick={() => { if (addMode) resetAdd(); else if (editingRecord) closeEdit(); else if (activeSection) setActiveSection(null); else stepDate(-1); }}
            style={{ flexShrink: 0, width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(227,169,74,0.18)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#E3A94A' }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 6 9 12 15 18"/></svg>
          </button>
          <div style={{ textAlign: 'center', flex: 1, margin: '0 8px' }}>
            <div style={{ textTransform: 'uppercase', letterSpacing: '.22em', fontSize: 11, color: '#8A7C6B', marginBottom: 4 }}>
              {addMode === 'walkin' ? 'Add Walk-in' : addMode === 'reservation' ? 'Add Reservation' : editingRecord ? 'Edit Record' : activeSection ? SECTION_LABELS[activeSection] : 'Manager Dashboard'}
            </div>
            {activeSection || editingRecord || addMode ? (
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: 22, color: '#F1E8DA' }}>{dateLabel}</div>
            ) : (() => {
              const [yyyy, mm, dd] = dateISO.split('-');
              const wday = new Date(`${dateISO}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
              return (
                <div style={{ position: 'relative' }}>
                  <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: '.02em', color: '#F1E8DA', lineHeight: 1.15 }}>
                    {mm}<span style={{ color: '#E3A94A', margin: '0 6px' }}>/</span>
                    {dd}<span style={{ color: '#E3A94A', margin: '0 6px' }}>/</span>
                    {yyyy}
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontSize: 14, color: '#B9A48A', marginTop: 2 }}>{wday}</div>
                  <input type="date" value={dateISO} onChange={e => e.target.value && onDateChange(e.target.value)}
                    style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer', zIndex: 1 }} />
                </div>
              );
            })()}
          </div>
          {activeSection || editingRecord || addMode ? (
            <div style={{ width: 42 }} />
          ) : (
            <button onClick={() => stepDate(1)} style={{ flexShrink: 0, width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(227,169,74,0.18)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#E3A94A' }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto', paddingBottom: '96px', animation: 'lmFade .4s ease both' }}>

        {/* ADD FORM */}
        {addMode ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div><label style={mgLabel}>First Name *</label><input style={mgInput} value={addForm.firstName} onChange={aef('firstName')} autoFocus /></div>
              <div><label style={mgLabel}>Last Name</label><input style={mgInput} value={addForm.lastName} onChange={aef('lastName')} /></div>
              <div><label style={mgLabel}>Guests</label><input type="number" min="1" max="20" style={mgInput} value={addForm.guests} onChange={aef('guests')} /></div>
              {addMode === 'reservation' && <div><label style={mgLabel}>Time</label><input type="time" style={mgInput} value={addForm.timeHHMM} onChange={aef('timeHHMM')} /></div>}
            </div>
            <div style={{ marginBottom: 14 }}><label style={mgLabel}>Phone</label><input type="tel" style={mgInput} value={addForm.phone} onChange={aef('phone')} placeholder="+1..." /></div>
            <div style={{ marginBottom: 14 }}>
              <label style={mgLabel}>Celebration</label>
              <select style={{ ...mgInput, appearance: 'none' }} value={addForm.celebration} onChange={aef('celebration')}>
                {CELEBRATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={mgLabel}>Dietary</label>
              <select style={{ ...mgInput, appearance: 'none' }} value={addForm.dietary} onChange={aef('dietary')}>
                {DIETARY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 22 }}><label style={mgLabel}>Notes</label><textarea rows={3} style={{ ...mgInput, resize: 'vertical', lineHeight: 1.5 }} value={addForm.notes} onChange={aef('notes')} /></div>
            <button onClick={addMode === 'walkin' ? handleAddWalkin : handleAddReservation} disabled={addSaving}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, borderRadius: 14, border: '1px solid rgba(233,182,92,0.55)', background: 'linear-gradient(180deg,#E9B65C,#E27B5C)', color: '#2A1704', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.95rem', cursor: addSaving ? 'not-allowed' : 'pointer', opacity: addSaving ? 0.7 : 1, boxShadow: '0 16px 34px -16px rgba(226,123,92,.6)' }}>
              {addSaving ? 'Saving…' : addMode === 'walkin' ? 'Add to Wait List' : 'Confirm Reservation'}
            </button>
          </div>

        ) : editingRecord ? (
          /* EDIT FORM */
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div><label style={mgLabel}>First Name</label><input style={mgInput} value={editForm.firstName} onChange={ef('firstName')} /></div>
              <div><label style={mgLabel}>Last Name</label><input style={mgInput} value={editForm.lastName} onChange={ef('lastName')} /></div>
              <div><label style={mgLabel}>Guests</label><input type="number" min="1" max="20" style={mgInput} value={editForm.guests} onChange={ef('guests')} /></div>
              {(editingRecord.status === 'reserved' || editingRecord.status === 'seated') && (
                <div><label style={mgLabel}>Time</label><input type="time" style={mgInput} value={editForm.timeHHMM} onChange={ef('timeHHMM')} /></div>
              )}
            </div>
            <div style={{ marginBottom: 14 }}><label style={mgLabel}>Phone</label><input style={mgInput} value={editForm.phone} onChange={ef('phone')} /></div>
            <div style={{ marginBottom: 14 }}>
              <label style={mgLabel}>Celebration</label>
              <select style={{ ...mgInput, appearance: 'none' }} value={editForm.celebration} onChange={ef('celebration')}>
                {CELEBRATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={mgLabel}>Dietary</label>
              <select style={{ ...mgInput, appearance: 'none' }} value={editForm.dietary} onChange={ef('dietary')}>
                {DIETARY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 22 }}><label style={mgLabel}>Notes</label><textarea rows={3} style={{ ...mgInput, resize: 'vertical', lineHeight: 1.5 }} value={editForm.notes} onChange={ef('notes')} /></div>
            <button onClick={handleSave} disabled={editSaving}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, borderRadius: 14, border: '1px solid rgba(233,182,92,0.55)', background: 'linear-gradient(180deg,#E9B65C,#E27B5C)', color: '#2A1704', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.95rem', cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.7 : 1, boxShadow: '0 16px 34px -16px rgba(226,123,92,.6)', marginBottom: 12 }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
            {editingRecord.status === 'waitlist' && (
              <button onClick={async () => { setEditSaving(true); try { await updatePartyToSeated(editingRecord.id); closeEdit(); } finally { setEditSaving(false); } }} disabled={editSaving}
                style={{ width: '100%', padding: 17, borderRadius: 14, border: '1px solid rgba(140,201,143,0.35)', background: 'rgba(140,201,143,0.10)', color: '#8CC98F', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem', cursor: editSaving ? 'not-allowed' : 'pointer', marginBottom: 12 }}>
                Seat Party
              </button>
            )}
            {editingRecord.status !== 'cancelled' && (
              <button onClick={handleCancelReservation} disabled={editSaving}
                style={{ width: '100%', padding: 17, borderRadius: 14, border: '1px solid rgba(226,123,92,0.35)', background: 'rgba(226,123,92,0.07)', color: '#E27B5C', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem', cursor: editSaving ? 'not-allowed' : 'pointer' }}>
                Cancel Reservation
              </button>
            )}
          </div>

        ) : activeSection ? (
          /* SECTION LIST */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: 24, color: SECTION_COLORS[activeSection] }}>{SECTION_LABELS[activeSection]}</div>
              <span style={{ minWidth: 26, height: 26, padding: '0 9px', borderRadius: 99, background: `${SECTION_COLORS[activeSection]}1A`, border: `1px solid ${SECTION_COLORS[activeSection]}44`, color: SECTION_COLORS[activeSection], fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{sectionData[activeSection].length}</span>
            </div>
            {sectionData[activeSection].length === 0 ? (
              <div style={{ textAlign: 'center', color: '#5A5145', padding: '48px 0', fontSize: '0.9rem' }}>No records for this date</div>
            ) : (
              sectionData[activeSection].map((r, i) => <RecordCard key={r.id || i} r={r} onClick={() => openEdit(r)} />)
            )}
          </>

        ) : (
          /* DASHBOARD SUMMARY */
          <>
            {/* 2×2 KPI grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 12 }}>
              <StatCard label="Reservations" value={history.length} sub={`${totalResGuests} guests`} color="#E27B5C" onClick={() => setActiveSection('reservations')} />
              <StatCard label="Wait List" value={waitList.length} sub="currently waiting" color="#E27B5C" onClick={() => setActiveSection('waitlist')} />
              <StatCard label="Seated" value={seatedList.length} sub={`${seatedGuests} guests`} color="#E27B5C" onClick={() => setActiveSection('seated')} />
              <StatCard label="Canceled" value={canceledList.length} sub="today" color="#E27B5C" onClick={() => setActiveSection('canceled')} />
            </div>

            {/* Occupancy */}
            {totalTables > 0 && (
              <div style={{ background: 'linear-gradient(180deg,#201911,#181109)', border: '1px solid rgba(227,169,74,0.14)', borderRadius: 18, padding: 22, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <div>
                    <div style={{ textTransform: 'uppercase', letterSpacing: '.24em', fontSize: 11, color: '#C9A876' }}>Occupancy</div>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontSize: 16, color: '#8A7C6B', marginTop: 5 }}>{occupiedTables} of {totalTables} tables seated</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 40, lineHeight: 1, color: '#E3A94A', fontVariantNumeric: 'tabular-nums' }}>
                    {occupancyPct}<span style={{ fontSize: 22, color: '#B9884A' }}>%</span>
                  </div>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 18 }}>
                  <div style={{ height: '100%', width: `${occupancyPct}%`, borderRadius: 99, background: 'linear-gradient(90deg,#E9B65C,#E27B5C)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(totalTables, 16)},1fr)`, gap: 4, marginBottom: 12 }}>
                  {Array.from({ length: totalTables }).map((_, i) => (
                    <div key={i} style={{ aspectRatio: '1', borderRadius: 3, background: i < occupiedTables ? 'linear-gradient(180deg,#E9B65C,#E27B5C)' : 'rgba(255,255,255,0.06)' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#8A7C6B' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: 'linear-gradient(180deg,#E9B65C,#E27B5C)', flexShrink: 0 }} /> Seated</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} /> Available</span>
                </div>
              </div>
            )}

            {/* Total guests */}
            <div style={{ background: 'linear-gradient(180deg,#201911,#181109)', border: '1px solid rgba(227,169,74,0.14)', borderRadius: 18, padding: 22, marginBottom: 12 }}>
              <div style={{ textTransform: 'uppercase', letterSpacing: '.24em', fontSize: 11, color: '#C9A876' }}>Total Guests Today</div>
              <div style={{ fontWeight: 700, fontSize: 62, lineHeight: 0.9, color: '#E27B5C', fontVariantNumeric: 'tabular-nums', margin: '8px 0 18px' }}>{allDayGuests}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[['Seated', seatedGuests, '#F1E8DA'], ['Expected (Reservations)', totalResGuests, '#E3A94A']].map(([l, v, col]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: 13, color: '#8A7C6B' }}>{l}</span>
                    <span style={{ fontWeight: 600, fontSize: 16, color: col }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hourly chart */}
            {Object.keys(hourlyRes).length > 0 && (() => {
              const maxCount = Math.max(1, ...Object.values(hourlyRes));
              return (
                <div style={{ background: 'linear-gradient(180deg,#201911,#181109)', border: '1px solid rgba(227,169,74,0.14)', borderRadius: 18, padding: 22, marginBottom: 14 }}>
                  <div style={{ textTransform: 'uppercase', letterSpacing: '.24em', fontSize: 11, color: '#C9A876', marginBottom: 18 }}>Reservations by Hour</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {Object.keys(hourlyRes).sort().map(h => (
                      <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ width: 50, fontSize: 13, color: '#B9A48A', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{h}:00</span>
                        <div style={{ flex: 1, height: 13, borderRadius: 99, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#5B8FCB,#7E6FD2)', width: `${Math.max(6, Math.round((hourlyRes[h] / maxCount) * 100))}%` }} />
                        </div>
                        <span style={{ width: 20, textAlign: 'right', fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: '#F1E8DA' }}>{hourlyRes[h]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={() => setAddMode('walkin')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '18px 22px', borderRadius: 15, border: '1px solid rgba(227,169,74,0.42)', background: 'linear-gradient(180deg,rgba(227,169,74,0.12),rgba(227,169,74,0.03))', color: '#EDBE6A', fontFamily: 'inherit', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(237,190,106,0.45)', background: 'rgba(237,190,106,0.10)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>+</span>
                Walk-in
              </button>
              <button onClick={() => setAddMode('reservation')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '18px 22px', borderRadius: 15, border: '1px solid rgba(233,182,92,0.55)', background: 'linear-gradient(180deg,#E9B65C,#E27B5C)', color: '#2A1704', fontFamily: 'inherit', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 16px 34px -16px rgba(226,123,92,.6)' }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(42,23,4,0.16)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>+</span>
                New Reservation
              </button>
            </div>
          </>
        )}
      </div>

      {/* REFRESH FAB */}
      <button onClick={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }}
        style={{ position: 'fixed', bottom: 18, right: 18, width: 54, height: 54, borderRadius: '50%', border: '1px solid rgba(226,123,92,0.4)', background: 'linear-gradient(180deg,#2A1D14,#1C130C)', color: '#E27B5C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 16px 40px -16px rgba(0,0,0,.9)', opacity: refreshing ? 0.6 : 1, zIndex: 50 }}>
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={refreshing ? { transformBox: 'fill-box', transformOrigin: 'center', animation: 'lmSpin .75s linear infinite' } : undefined}>
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
      </button>
    </div>
  );
});

/*******************************************************
 * BLOQUE 8 — APP (CONTROLLER PRINCIPAL)
 *******************************************************/
export default function App() {
  const isSubmitting = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [walkinLoading, setWalkinLoading] = useState(false);
  const walkinSubmittingRef = useRef(false);
  const [phoneResLoading, setPhoneResLoading] = useState(false);
  const phoneResSubmittingRef = useRef(false);
  const [viewMode, setViewMode] = useState(() => {
    if (window.location.pathname === '/managerview') return 'manager-lock';
    if (window.location.pathname === '/hostessview') return 'hostess-lock';
    return 'client';
  });
  const [step, setStep] = useState("search");
  const [dateISO, setDateISO] = useState(() => dateISOFromDate(new Date()));
  const [guests, setGuests] = useState(null);
  const [estimatedWait, setEstimatedWait] = useState(15);
  const [timeHHMM, setTimeHHMM] = useState("19:00");
  const [blackoutDates, setBlackoutDates] = useState([]);
  const [servers, setServers] = useState([]);
  const [editingServer, setEditingServer] = useState(null);
  const [newServerName, setNewServerName] = useState('');
  const [activeFloor, setActiveFloor] = useState("BAR");
  const [rows, setRows] = useState([]);
  const [tableStatuses, setTableStatuses] = useState({});
  const [tableServerNames, setTableServerNames] = useState({});
  const [newReservationTick, setNewReservationTick] = useState(0);
  const [walkInForm, setWalkInForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    phoneCode: "+1",
    celebration: "None",
    dietary: "None",
    notes: "",
  });
  const [phoneResForm, setPhoneResForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    phoneCode: "+1",
    email: "",
    celebration: "None",
    dietary: "None",
    notes: "",
  });
  const [clientForm, setClientForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    phoneCode: "+1",
    email: "",
    celebration: "None",
    dietary: "None",
    notes: "",
    smsOptIn: false,
  });

  const dateLabel = useMemo(() => formatDateLabel(dateISO), [dateISO]);
  const timeLabel = useMemo(() => formatTimeLabel(timeHHMM), [timeHHMM]);

  // dayStatus: 'open' | 'closed' | 'walkin_only'
  const dayStatus = useMemo(() => {
    if (!isRestaurantOpen(dateISO)) return 'closed';
    const entry = blackoutDates.find(b => b.date_iso === dateISO);
    if (!entry) return 'open';
    return entry.type || 'closed';
  }, [dateISO, blackoutDates]);
  const isBlackout = dayStatus === 'closed';
  const isWalkInOnly = dayStatus === 'walkin_only';

  const history = useMemo(() => rows.filter((r) => r.status === "reserved").sort((a, b) => {
    const notifDiff = (b.notified_at ? 1 : 0) - (a.notified_at ? 1 : 0);
    if (notifDiff !== 0) return notifDiff;
    return (a.timeHHMM || "").localeCompare(b.timeHHMM || "");
  }), [rows]);
  const waitList = useMemo(() => rows.filter((r) => r.status === "waitlist").sort((a, b) => (b.notified_at ? 1 : 0) - (a.notified_at ? 1 : 0)), [rows]);
  const seatedList = useMemo(() => rows.filter((r) => r.status === "seated"), [rows]);
  const canceledList = useMemo(() => rows.filter((r) => r.status === "cancelled"), [rows]);

  // Cuenta reservaciones y guests por ventana de 1 hora (para límites en client/hostess view)
  const bookedHourCounts = useMemo(() => {
    const counts = {};
    rows.filter(r => r.status === "reserved").forEach(r => {
      if (r.timeHHMM) {
        const hour = Math.floor(minutesFromHHMM(r.timeHHMM) / 60);
        counts[hour] = (counts[hour] || 0) + 1;
      }
    });
    return counts;
  }, [rows]);

  const bookedHourGuests = useMemo(() => {
    const counts = {};
    rows.filter(r => r.status === "reserved").forEach(r => {
      if (r.timeHHMM) {
        const hour = Math.floor(minutesFromHHMM(r.timeHHMM) / 60);
        counts[hour] = (counts[hour] || 0) + (r.guests || 0);
      }
    });
    return counts;
  }, [rows]);

  useReservationsRealtime({ supabase, dateISO, setRows, onInsert: () => setNewReservationTick(t => t + 1) });

  useEffect(() => {
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Cargar y sincronizar table_status en tiempo real
  useEffect(() => {
    supabase.from('table_status').select('id, status, server_names').then(({ data }) => {
      if (data) {
        const statusMap = {};
        const serverMap = {};
        data.forEach(r => { statusMap[r.id] = r.status; serverMap[r.id] = r.server_names || []; });
        setTableStatuses(statusMap);
        setTableServerNames(serverMap);
      }
    });
    const channel = supabase
      .channel('table_status_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_status' }, ({ new: row }) => {
        if (row?.id) {
          setTableStatuses(prev => ({ ...prev, [row.id]: row.status }));
          setTableServerNames(prev => ({ ...prev, [row.id]: row.server_names || [] }));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Cargar y sincronizar blackout_dates en tiempo real
  useEffect(() => {
    const load = () =>
      supabase.from('blackout_dates').select('date_iso, notes, type').then(({ data }) => {
        if (data) setBlackoutDates(data.map(r => ({ date_iso: r.date_iso, notes: r.notes || '', type: r.type || 'closed' })));
      });
    load();
    const channel = supabase
      .channel('blackout_dates_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blackout_dates' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Cargar y sincronizar servers en tiempo real
  useEffect(() => {
    const load = () =>
      fetchServers().then(({ data }) => { if (data) setServers(data); });
    load();
    const channel = supabase
      .channel('servers_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const isDateBlocked = (d) => !isRestaurantOpen(d);

  const stepDate = (dir) => {
    setDateISO(prev => {
      let next = addDaysISO(prev, dir);
      let i = 0;
      while (isDateBlocked(next) && i++ < 14) next = addDaysISO(next, dir);
      return next;
    });
  };

  const handleDateChange = (val) => {
    let date = val;
    let i = 0;
    while (isDateBlocked(date) && i++ < 14) date = addDaysISO(date, 1);
    setDateISO(date);
  };
  const stepGuests = (dir) => setGuests((prev) => clampGuests((prev ?? 0) + dir));
  const stepWait = (dir) => setEstimatedWait((prev) => Math.min(120, Math.max(5, (prev ?? 15) + dir * 5)));

  // stepTime ahora respeta el horario del restaurante: no puede salir del rango permitido
  const stepTime = (dir) => {
    const hours = getDayHours(dateISO);
    if (!hours) return;
    const open = minutesFromHHMM(hours.open);
    const lastSlot = minutesFromHHMM(hours.close) - LAST_RESERVATION_BUFFER;
    let mins = minutesFromHHMM(timeHHMM) + SLOT_MINUTES * dir;
    mins = Math.max(open, Math.min(lastSlot, mins));
    mins = Math.round(mins / SLOT_MINUTES) * SLOT_MINUTES;
    setTimeHHMM(hhmmFromMinutes(mins));
  };

  const toggleBlackoutDate = async (dateToToggle, notes, type = 'closed') => {
    if (!dateToToggle) return;
    if (blackoutDates.some(b => b.date_iso === dateToToggle)) {
      await supabase.from('blackout_dates').delete().eq('date_iso', dateToToggle);
    } else {
      await supabase.from('blackout_dates').insert({ date_iso: dateToToggle, notes: notes || null, type });
    }
  };

  const handleAddServer = async (name) => {
    const clean = (name || '').trim();
    if (!clean) return;
    const { error } = await insertServer(clean.toUpperCase());
    if (error) alert('Error adding server: ' + error.message);
  };

  const handleUpdateServer = async (id, name) => {
    const clean = (name || '').trim();
    if (!clean) return;
    const { error } = await updateServerName(id, clean.toUpperCase());
    if (error) alert('Error renaming server: ' + error.message);
  };

  const handleDeleteServer = async (id) => {
    const { error } = await deleteServer(id);
    if (error) alert('Error removing server: ' + error.message);
  };

  const handleTableSelection = async (table) => {
    const key = `${activeFloor}-${table.id}`;
    const current = tableStatuses[key] ?? 'av';
    const next = current === 'av' ? 'occ' : 'av';
    setTableStatuses(prev => ({ ...prev, [key]: next }));
    await supabase.from('table_status').upsert({ id: key, status: next });
    if (next === 'occ') {
      const servers = tableServerNames[key] ?? [];
      await logTableOcc(key, servers, dateISO);
    }
  };

  // Helper para generar tokens de cancelación únicos (seguro)
  const generateToken = () => {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    } catch (_) {}
    return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  };

  const handleAddToWaitlist = async () => {
    if (walkinSubmittingRef.current) return;
    walkinSubmittingRef.current = true;
    if (isBlackout) { walkinSubmittingRef.current = false; return alert("Cannot add to waitlist on a closed day."); }
    const todayISO = dateISOFromDate(new Date());
    if (dateISO !== todayISO) { walkinSubmittingRef.current = false; return alert("Walk-ins can only be added for today's date. Please switch to today."); }
    if (!walkInForm.firstName) { walkinSubmittingRef.current = false; return alert("First name is required."); }
    setWalkinLoading(true);

    const cancelToken = generateToken();

    const newEntry = {
      firstName: walkInForm.firstName.toUpperCase(),
      lastName: (walkInForm.lastName || "").toUpperCase(),
      guests: guests || 1,
      dateISO,
      timeHHMM,
      phone: (walkInForm.phoneCode || '+1') + (walkInForm.phone || '').replace(/\D/g, ''),
      email: null,
      celebration: walkInForm.celebration || "None",
      dietary: walkInForm.dietary || "None",
      notes: walkInForm.notes || null,
      status: "waitlist",
      source: "walkin",
      cancel_token: cancelToken,
      estimated_wait: estimatedWait,
      // Consentimiento verbal: la hostess informa al walk-in antes de tomar su teléfono (ver sms-opt-in.html)
      sms_opt_in: !!walkInForm.phone,
    };

    try {
      const { error } = await insertWaitlistRecord(newEntry);
      if (error) throw error;

      // SMS de Waitlist (solo si hay phone)
      if (walkInForm.phone) {
        try {
          await fetch("/.netlify/functions/send-sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "waitlist",
              phone: walkInForm.phone,
              firstName: walkInForm.firstName,
              guests: guests || 1,
              dateLabel,
              timeLabel,
              cancel_token: cancelToken,
            }),
          });
        } catch (e) {
          console.error("SMS waitlist fail:", e);
        }
      }

      setWalkInForm({ firstName: "", lastName: "", phone: "", celebration: "None", dietary: "None", notes: "" });
      setEstimatedWait(15);
      return true;
    } catch (e) {
      console.error(e);
      alert("Error adding to wait list: " + (e?.message || e));
    } finally {
      walkinSubmittingRef.current = false;
      setWalkinLoading(false);
    }
  };

  const handleAddPhoneReservation = async () => {
    if (phoneResSubmittingRef.current) return;
    phoneResSubmittingRef.current = true;

    const _resetPhoneRef = () => { phoneResSubmittingRef.current = false; };

    if (isBlackout) { _resetPhoneRef(); return alert("Cannot make reservations on a closed day."); }
    if (dateISO < dateISOFromDate(new Date())) { _resetPhoneRef(); return alert("Cannot make reservations for a past date."); }
    if (!phoneResForm.firstName || !phoneResForm.lastName || !phoneResForm.phone) {
      _resetPhoneRef(); return alert("Name, Last Name and Phone are required.");
    }

    // Validación de horario
    if (!isTimeAllowed(dateISO, timeHHMM)) {
      const range = getAvailableTimeRange(dateISO);
      _resetPhoneRef();
      return alert(
        range
          ? `Reservations only accepted between ${formatTimeLabel(range.open)} and ${formatTimeLabel(range.lastSlot)}.`
          : "The restaurant is closed this day."
      );
    }

    // Advertencia de overbooking (límite por hora)
    const selectedHour = Math.floor(minutesFromHHMM(timeHHMM) / 60);
    const hourResCount = rows.filter(
      r => r.status === "reserved" && r.timeHHMM &&
           Math.floor(minutesFromHHMM(r.timeHHMM) / 60) === selectedHour
    ).length;
    const hourGuestCount = rows
      .filter(r => r.status === "reserved" && r.timeHHMM &&
                   Math.floor(minutesFromHHMM(r.timeHHMM) / 60) === selectedHour)
      .reduce((sum, r) => sum + (r.guests || 0), 0);

    const resOver = hourResCount >= MAX_RESERVATIONS_PER_HOUR;
    const capOver = hourGuestCount + (guests || 1) > RESTAURANT_CAPACITY;

    if (resOver || capOver) {
      const reasons = [];
      if (resOver) reasons.push(`${hourResCount}/${MAX_RESERVATIONS_PER_HOUR} reservations in this hour`);
      if (capOver) reasons.push(`${hourGuestCount + (guests || 1)} guests would exceed capacity of ${RESTAURANT_CAPACITY}`);
      const proceed = window.confirm(`⚠️ Overbooking warning:\n${reasons.join('\n')}\n\nContinue anyway?`);
      if (!proceed) { _resetPhoneRef(); return; }
    }

    setPhoneResLoading(true);
    const cancelToken = generateToken();

    const newRes = {
      firstName: phoneResForm.firstName.toUpperCase(),
      lastName: phoneResForm.lastName.toUpperCase(),
      guests: guests || 1,
      dateISO,
      timeHHMM,
      phone: (phoneResForm.phoneCode || '+1') + phoneResForm.phone.replace(/\D/g, ''),
      email: phoneResForm.email || null,
      celebration: phoneResForm.celebration || "None",
      dietary: phoneResForm.dietary || "None",
      notes: phoneResForm.notes || null,
      status: "reserved",
      source: "reservation",
      cancel_token: cancelToken,
      // Consentimiento verbal: la hostess informa al cliente antes de tomar su teléfono (ver sms-opt-in.html)
      sms_opt_in: true,
    };

    try {
      const { error } = await insertReservationRecord(newRes);
      if (error) throw error;

      // SMS confirmación (teléfono)
      try {
        await fetch("/.netlify/functions/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "confirm",
            phone: (phoneResForm.phoneCode || '+1') + phoneResForm.phone.replace(/\D/g, ''),
            firstName: phoneResForm.firstName,
            dateLabel,
            timeLabel,
            guests,
            cancel_token: cancelToken,
          }),
        });
      } catch (smsErr) {
        console.error("SMS fail:", smsErr);
      }

      alert("✅ Phone reservation confirmed!");
      setPhoneResForm({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        celebration: "None",
        dietary: "None",
        notes: "",
      });
      return true;
    } catch (e) {
      console.error(e);
      alert("Error saving reservation.");
    } finally {
      phoneResSubmittingRef.current = false;
      setPhoneResLoading(false);
    }
  };
  const handleSeatParty = useCallback(async (party) => {
    setRows(prev => prev.map(r => r.id === party.id ? { ...r, status: 'seated', seated_at: new Date().toISOString() } : r));
    const { error } = await updatePartyToSeated(party.id);
    if (error) {
      setRows(prev => prev.map(r => r.id === party.id ? party : r));
      alert("Error seating party.");
    }
  }, []);

  const handleSaveEdit = useCallback(async (id, data) => {
    const { error } = await updateReservationRecord(id, data);
    if (error) alert("Error updating reservation: " + error.message);
  }, []);

  const handleRemoveFromWaitlist = useCallback(async (item) => {
    setRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'cancelled' } : r));
    const { error } = await updateReservationRecord(item.id, { status: 'cancelled' });
    if (error) {
      setRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'waitlist' } : r));
      alert("Error removing from waitlist.");
    }
  }, []);

  const handleUndoCancel = useCallback(async (item) => {
    const originalStatus = item.source === 'walkin' ? 'waitlist' : 'reserved';
    setRows(prev => prev.map(r => r.id === item.id ? { ...r, status: originalStatus, notified_at: null } : r));
    const { error } = await updateReservationRecord(item.id, { status: originalStatus, notified_at: null });
    if (error) {
      setRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'cancelled', notified_at: item.notified_at } : r));
      alert("Error reverting cancellation.");
    }
  }, []);

  const handleCancelReservation = useCallback(async (res) => {
    if (!window.confirm(`Cancel reservation for ${res.firstName} ${res.lastName}?`)) return;
    setRows(prev => prev.map(r => r.id === res.id ? { ...r, status: 'cancelled' } : r));
    const { error } = await cancelReservation(res.id);
    if (error) {
      setRows(prev => prev.map(r => r.id === res.id ? { ...r, status: 'reserved' } : r));
      alert("Error canceling reservation.");
    }
  }, []);

  const handleUnseatParty = useCallback(async (party) => {
    const originalStatus = party.source === "walkin" ? "waitlist" : "reserved";
    setRows(prev => prev.map(r => r.id === party.id ? { ...r, status: originalStatus, seated_at: null } : r));
    const { error } = await revertPartyFromSeated(party.id, originalStatus);
    if (error) {
      setRows(prev => prev.map(r => r.id === party.id ? party : r));
      alert("Error reverting party.");
    }
  }, []);

  const handleNotifyReady = useCallback(async (party) => {
    if (!party?.phone) { alert("No phone number available for this guest."); return false; }
    try {
      await fetch("/.netlify/functions/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "table_ready",
          phone: party.phone,
          firstName: party.firstName,
          guests: party.guests,
          cancel_token: party.cancel_token,
        }),
      });
      await markPartyNotified(party.id);
      return true;
    } catch (e) {
      console.error("Notify fail:", e);
      alert("Error sending notification.");
      return false;
    }
  }, []);

  const handleClientSubmit = async () => {
    if (isSubmitting.current) return;
    if (!clientForm.firstName || !clientForm.lastName || !clientForm.phone) {
      return alert("Por favor completa Nombre, Apellido y Teléfono.");
    }
    isSubmitting.current = true;
    setSubmitting(true);

    // Validación de fecha y horario
    if (dateISO < dateISOFromDate(new Date())) {
      isSubmitting.current = false;
      setSubmitting(false);
      return;
    }
    if (!isTimeAllowed(dateISO, timeHHMM)) {
      const range = getAvailableTimeRange(dateISO);
      return alert(
        range
          ? `Reservations only accepted between ${formatTimeLabel(range.open)} and ${formatTimeLabel(range.lastSlot)}.`
          : "The restaurant is closed this day."
      );
    }

    const cancelToken = generateToken();

    const newRes = {
      firstName: clientForm.firstName.toUpperCase(),
      lastName: clientForm.lastName.toUpperCase(),
      guests,
      dateISO,
      timeHHMM,
      phone: (clientForm.phoneCode || '+1') + clientForm.phone.replace(/\D/g, ''),
      email: clientForm.email,
      celebration: clientForm.celebration,
      dietary: clientForm.dietary,
      notes: clientForm.notes,
      status: "reserved",
      source: "reservation",
      cancel_token: cancelToken,
      sms_opt_in: clientForm.smsOptIn,
    };

    try {
      const { error } = await insertReservationRecord(newRes);
      if (error) throw error;

      // SMS confirmación (cliente) — solo si optó por recibir SMS
      if (clientForm.smsOptIn) {
        try {
          await fetch("/.netlify/functions/send-sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "confirm",
              phone: (clientForm.phoneCode || '+1') + clientForm.phone.replace(/\D/g, ''),
              firstName: clientForm.firstName,
              dateLabel,
              timeLabel,
              guests,
              cancel_token: cancelToken,
            }),
          });
        } catch (smsErr) {
          console.error("SMS fail:", smsErr);
        }
      }

      setStep("confirmation");
    } catch (e) {
      alert("Error saving reservation: " + e.message);
    } finally {
      isSubmitting.current = false;
      setSubmitting(false);
    }
  };

  const handleRefreshRows = async () => {
    const { data } = await fetchRowsForDay(supabase, dateISO);
    setRows(data || []);
  };

  // --- RENDER ---
  if (viewMode === 'manager-lock') return <ManagerPinView onSuccess={() => setViewMode('manager')} />;
  if (viewMode === 'hostess-lock') return <HostessPinView onSuccess={() => setViewMode('hostess')} />;
  if (viewMode === 'manager') return (
    <ManagerView
      dateISO={dateISO} dateLabel={dateLabel} stepDate={stepDate} onDateChange={handleDateChange}
      history={history} waitList={waitList} seatedList={seatedList}
      canceledList={canceledList} rows={rows} tableStatuses={tableStatuses} isBlackout={isBlackout}
      onRefresh={handleRefreshRows}
      onSignOut={() => setViewMode('manager-lock')}
    />
  );

  if (viewMode === "hostess") {
    return (   
       <HostessView
        onAddWaitlist={handleAddToWaitlist}
        onAddPhoneRes={handleAddPhoneReservation}
        walkinLoading={walkinLoading}
        phoneResLoading={phoneResLoading}
        newReservationTick={newReservationTick}
        onSeatParty={handleSeatParty}
        onUnseatParty={handleUnseatParty}
        onCancelRes={handleCancelReservation}
        onRemoveFromWaitlist={handleRemoveFromWaitlist}
        onUndoCancel={handleUndoCancel}
        onSaveEdit={handleSaveEdit}
        onNotifyReady={handleNotifyReady}
        toggleBlackoutDate={toggleBlackoutDate}
        handleTableSelection={handleTableSelection}
        onRefresh={handleRefreshRows}
        activeFloor={activeFloor}
        setActiveFloor={setActiveFloor}
        isBlackout={isBlackout}
        isWalkInOnly={isWalkInOnly}
        dateISO={dateISO}
        setDateISO={setDateISO}
        onDateChange={handleDateChange}
        dateLabel={dateLabel}
        stepDate={stepDate}
        guests={guests}
        setGuests={setGuests}
        stepGuests={stepGuests}
        estimatedWait={estimatedWait}
        setEstimatedWait={setEstimatedWait}
        stepWait={stepWait}
        timeHHMM={timeHHMM}
        setTimeHHMM={setTimeHHMM}
        timeLabel={timeLabel}
        stepTime={stepTime}
        walkInForm={walkInForm}
        setWalkInForm={setWalkInForm}
        phoneResForm={phoneResForm}
        setPhoneResForm={setPhoneResForm}
        waitList={waitList}
        history={history}
        seatedList={seatedList}
        canceledList={canceledList}
        blackoutDates={blackoutDates}
        tableStatuses={tableStatuses}
        tableServerNames={tableServerNames}
        servers={servers}
        editingServer={editingServer}
        setEditingServer={setEditingServer}
        newServerName={newServerName}
        setNewServerName={setNewServerName}
        onAddServer={handleAddServer}
        onUpdateServer={handleUpdateServer}
        onDeleteServer={handleDeleteServer}
      />
    );
  }

  if (step === "search") {
    return (
      <ClientStepShell step={step} setStep={setStep} dateLabel={dateLabel} timeLabel={timeLabel} guests={guests}>
        <ClientSearchView
          dateISO={dateISO}
          setDateISO={setDateISO}
          onDateChange={handleDateChange}
          dateLabel={dateLabel}
          stepDate={stepDate}
          guests={guests}
          setGuests={setGuests}
          stepGuests={stepGuests}
          timeHHMM={timeHHMM}
          setTimeHHMM={setTimeHHMM}
          timeLabel={timeLabel}
          stepTime={stepTime}
          isBlackout={isBlackout}
          isWalkInOnly={isWalkInOnly}
          setStep={setStep}
          bookedHourCounts={bookedHourCounts}
          bookedHourGuests={bookedHourGuests}
        />
      </ClientStepShell>
    );
  }

  if (step === "contact") {
    return (
      <ClientStepShell step={step} setStep={setStep} dateLabel={dateLabel} timeLabel={timeLabel} guests={guests}>
        <ClientContactView
          formState={clientForm}
          setFormState={setClientForm}
          setStep={setStep}
        />
      </ClientStepShell>
    );
  }

  if (step === "confirmation") {
    return (
      <ClientStepShell step={step} setStep={setStep} dateLabel={dateLabel} timeLabel={timeLabel} guests={guests}>
        <ClientConfirmationView
          firstName={clientForm.firstName || "Guest"}
          setStep={setStep}
          setClientForm={setClientForm}
        />
      </ClientStepShell>
    );
  }

  return (
    <ClientStepShell step={step} setStep={setStep} dateLabel={dateLabel} timeLabel={timeLabel} guests={guests}>
      <ClientPreferencesView
        formState={clientForm}
        setFormState={setClientForm}
        setStep={setStep}
        onSubmitClientRes={handleClientSubmit}
        submitting={submitting}
      />
    </ClientStepShell>
  );
}

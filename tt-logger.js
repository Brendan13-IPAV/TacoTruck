// tt-logger.js
(() => {
  const KEY = 'tt_logs';
  const META_KEY = 'tt_meta';

  // ✅ Add your Apps Script Web App URL here (ends with /exec). Keep placeholder if you don't have it yet.
  const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzZzBC1gQZXVTy1mwC3GvQq8tGeBVacmKcuWdvvElDZR6ZQIjXQVwE9syKl-1prgFcMeQ/exec';

  function postToSheet(ev) {
  // If not configured yet, do nothing (safe while you wait for access)
  if (!SHEET_URL || /REPLACE_WITH_YOURS/.test(SHEET_URL)) return;

  try {
    const payload = JSON.stringify({ event: ev });

    // Prefer sendBeacon so navigation/unload doesn't drop events
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(SHEET_URL, blob);
      return;
    }

    // Fallback: fire-and-forget fetch (opaque response is fine)
    fetch(SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      mode: 'no-cors',
      keepalive: true
    });
  } catch (_) {
    // swallow errors; events still persist in localStorage
  }
}


  function get() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
  function set(v) { localStorage.setItem(KEY, JSON.stringify(v)); }
  function now() { return new Date().toISOString(); }
  function getMeta() { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; } }

  const state = get();
  if (!state.session_id) state.session_id = 'tt_' + Math.random().toString(36).slice(2,10);
  if (!state.started_at) state.started_at = now();
  if (!Array.isArray(state.events)) state.events = [];
  set(state);

  window.TTLOG = {
push(type, data = {}) {
  const s = get();
  const meta = getMeta();           // e.g. { disc: "B" }
  const ev = {
    type, ts: now(),
    ...meta,
    ...data,
    session_id: s.session_id
  };

  s.events.push(ev);
  set(s);

  // NEW: send to Google Sheets (no-op if SHEET_URL is placeholder)
  postToSheet(ev);
},

    exportCSV() {
      const s = get();
      const header = 'session_id,ts,type,disc,detail';
      const body = s.events.map(e => {
        const detail = JSON.stringify(e).replace(/"/g,'""');
        return [e.session_id, e.ts, e.type, (e.disc ?? ''), detail].join(',');
      }).join('\n');
      const csv = header + '\n' + body;
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `tt_logs_${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;
      a.click();
    }
  };

  window.addEventListener('message', (e) => {
    if (!e?.data || typeof e.data !== 'object') return;
    if (e.data.type) window.TTLOG.push(e.data.type, e.data);
  });

  const params = new URLSearchParams(location.search);
  if (params.get('export') === 'csv') window.TTLOG.exportCSV();

  window.TTLOG.push('page_view', { path: location.pathname + location.search });
  window.TTLOG.push('env', { ua: navigator.userAgent });

})();

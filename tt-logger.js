// tt-logger.js
(() => {
  const KEY = 'tt_logs';
  const META_KEY = 'tt_meta';

  // ✅ DOUBLE CHECK: Is this the specific URL that gave you the "SUCCESS" message?
  // If you did a "New Deployment" recently, this URL might have changed.
  const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzFerf9IzNZStaYmVvCZUCk69WqvJT3whp2pU1rhVShPV-kIUOo3nAeVILpOnBD4bZInw/exec';

  function postToSheet(ev) {
    // If not configured yet, do nothing
    if (!SHEET_URL || /REPLACE_WITH_YOURS/.test(SHEET_URL)) return;

    try {
      // FIX 1: Don't wrap it in { event: ev }. Send 'ev' directly so columns match.
      const payload = JSON.stringify(ev);

      // Prefer sendBeacon so navigation/unload doesn't drop events
      if (navigator.sendBeacon) {
        // FIX 2: Use 'text/plain' to avoid CORS preflight (OPTIONS) failures
        const blob = new Blob([payload], { type: 'text/plain' });
        navigator.sendBeacon(SHEET_URL, blob);
        return;
      }

      // Fallback: fire-and-forget fetch
      fetch(SHEET_URL, {
        method: 'POST',
        // FIX 3: Match 'text/plain' here too for consistency
        headers: { 'Content-Type': 'text/plain' }, 
        body: payload,
        mode: 'no-cors',
        keepalive: true
      });
    } catch (_) {
      // swallow errors; events still persist in localStorage
    }
  }

  // --- (Rest of your original code remains unchanged below) ---
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
      const meta = getMeta();
      const ev = {
        type, 
        ts: now(),
        ...meta,
        ...data,
        session_id: s.session_id
      };

      s.events.push(ev);
      set(s);

      // Send to Google Sheets
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

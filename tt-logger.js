<!-- tt-logger.js -->
<script>
(() => {
  const KEY = 'tt_logs';

  function get() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
  function set(v) { localStorage.setItem(KEY, JSON.stringify(v)); }
  function now() { return new Date().toISOString(); }

  // Ensure structure
  const state = get();
  if (!state.session_id) state.session_id = 'tt_' + Math.random().toString(36).slice(2, 10);
  if (!state.started_at) state.started_at = now();
  if (!Array.isArray(state.events)) state.events = [];
  set(state);

  // Public logger
  window.TTLOG = {
    push(type, data={}) {
      const s = get();
      s.events.push({ type, ts: now(), ...data, session_id: s.session_id });
      set(s);
    },
    exportCSV() {
      const s = get();
      const rows = s.events.map(e => ({
        session_id: e.session_id,
        ts: e.ts,
        type: e.type,
        detail: JSON.stringify(e)
      }));
      const header = 'session_id,ts,type,detail';
      const body = rows.map(r =>
        [r.session_id, r.ts, r.type, JSON.stringify(r.detail).replace(/"/g,'""')].join(',')
      ).join('\n');
      const csv = header + '\n' + body;
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `tt_logs_${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;
      a.click();
    }
  };

  // Listen for postMessage (future use by disclaimers)
  window.addEventListener('message', (e) => {
    if (!e?.data || typeof e.data !== 'object') return;
    // e.g., window.parent.postMessage({type:'disc_event', action:'accepted'}, '*')
    if (e.data.type) window.TTLOG.push(e.data.type, e.data);
  });

  // Secret export: add ?export=csv to URL
  const params = new URLSearchParams(location.search);
  if (params.get('export') === 'csv') window.TTLOG.exportCSV();

  // Page view
  window.TTLOG.push('page_view', { path: location.pathname + location.search });
})();
</script>

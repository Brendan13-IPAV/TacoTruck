<!-- tt-logger.js -->
<script>
(() => {
  const KEY = 'tt_logs';
  const META_KEY = 'tt_meta';

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
      const meta = getMeta();           // ← NEW
      s.events.push({
        type, ts: now(),
        ...meta,                        // ← NEW: e.g. { disc: "B" }
        ...data,
        session_id: s.session_id
      });
      set(s);
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
})();
</script>


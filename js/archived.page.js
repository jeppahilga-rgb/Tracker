document.addEventListener("DOMContentLoaded", () => {
  const sessionRaw = localStorage.getItem("qt.session");
  if (!sessionRaw) {
    window.location.href = "index.html";
    return;
  }

  const session = JSON.parse(sessionRaw);
  document.getElementById("archivedSessionBadge").textContent = `${session.name} - ${session.role}`;

  function normalizeWorkflowId(id, profiles) {
    const list = Array.isArray(profiles) ? profiles.map(p => String(p?.id || "").trim()).filter(Boolean) : [];
    const fallback = list.includes("direct_purchase") ? "direct_purchase" : (list[0] || String(APP_CONFIG.defaults.activeWorkflowId || "direct_purchase"));
    const value = String(id || "").trim();
    return list.includes(value) ? value : fallback;
  }

  function loadArchivedRows() {
    const settings = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {});
    const profiles = Array.isArray(settings.workflowProfiles) && settings.workflowProfiles.length
      ? settings.workflowProfiles
      : (APP_CONFIG.defaults.workflowProfiles || []);
    const ids = profiles.map(p => String(p?.id || "").trim()).filter(Boolean);
    const merged = [];
    const scopedIds = new Set();
    let hasBuckets = false;
    ids.forEach(id => {
      const rows = LocalStorageAdapter.load(`${APP_CONFIG.localKeys.archived}.${id}`, null);
      if (!Array.isArray(rows)) return;
      hasBuckets = true;
      scopedIds.add(id);
      rows.forEach(row => merged.push({ ...row, workflowId: normalizeWorkflowId(row.workflowId || id, profiles) }));
    });
    if (hasBuckets) {
      const legacy = LocalStorageAdapter.load(APP_CONFIG.localKeys.archived, []);
      (Array.isArray(legacy) ? legacy : []).forEach(row => {
        const normalized = {
          ...row,
          workflowId: normalizeWorkflowId(row.workflowId || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase", profiles)
        };
        if (!scopedIds.has(normalized.workflowId)) merged.push(normalized);
      });
      return merged;
    }
    const legacy = LocalStorageAdapter.load(APP_CONFIG.localKeys.archived, []);
    return (Array.isArray(legacy) ? legacy : []).map(row => ({
      ...row,
      workflowId: normalizeWorkflowId(row.workflowId || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase", profiles)
    }));
  }

  const archived = loadArchivedRows();
  const settings = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {});
  const profiles = Array.isArray(settings.workflowProfiles) ? settings.workflowProfiles : (APP_CONFIG.defaults.workflowProfiles || []);
  const activeId = normalizeWorkflowId(localStorage.getItem("qt.activeWorkflowId") || settings.activeWorkflowId || profiles[0]?.id || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase", profiles);
  const activeProfile = profiles.find(p => String(p?.id || "") === activeId) || profiles[0] || {};
  const tagLabel = String(activeProfile.tagLabel || settings.tagLabel || APP_CONFIG.defaults.tagLabel || "Origin");
  const state = { search: "", page: 1, size: 15 };
  const debouncedRender = Utils.debounce(() => render(), 180);

  function render() {
    const wrap = document.getElementById("archivedTableWrap");
    const search = String(state.search || "").toLowerCase().trim();
    const filtered = archived.filter(q => {
      if (normalizeWorkflowId(q.workflowId, profiles) !== activeId) return false;
      if (!search) return true;
      return [q.reference, q.customerName, q.origin, q.status, q.dueDate]
        .some(v => String(v || "").toLowerCase().includes(search));
    });
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / state.size));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const start = (state.page - 1) * state.size;
    const rows = filtered.slice(start, start + state.size);
    if (!filtered.length) {
      wrap.innerHTML = `<div class="info-box">No archived quotations found.</div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="basic-table fixed-table no-sticky-header">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Customer</th>
              <th>${Utils.escapeHtml(tagLabel)}</th>
              <th>Status</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(q => `
              <tr>
                <td>${Utils.escapeHtml(q.reference || "")}</td>
                <td>${Utils.escapeHtml(q.customerName || "")}</td>
                <td>${Utils.escapeHtml(q.origin || "")}</td>
                <td>${Utils.escapeHtml(q.status || "")}</td>
                <td>${Utils.escapeHtml(q.dueDate || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div class="list-pagination">
        <button id="btnArchivedPrev" class="btn btn-secondary btn-sm" ${state.page <= 1 ? "disabled" : ""}>Prev</button>
        <span>Page ${state.page} of ${totalPages} (${total} items)</span>
        <button id="btnArchivedNext" class="btn btn-secondary btn-sm" ${state.page >= totalPages ? "disabled" : ""}>Next</button>
      </div>
    `;

    document.getElementById("btnArchivedPrev")?.addEventListener("click", () => { state.page -= 1; render(); });
    document.getElementById("btnArchivedNext")?.addEventListener("click", () => { state.page += 1; render(); });
  }

  document.getElementById("archivedSearch")?.addEventListener("input", e => {
    state.search = e.target.value;
    state.page = 1;
    debouncedRender();
  });
  render();

  document.getElementById("btnBackMain").addEventListener("click", () => {
    window.location.href = "app.html";
  });
});

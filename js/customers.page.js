document.addEventListener("DOMContentLoaded", () => {
  const sessionRaw = localStorage.getItem("qt.session");
  if (!sessionRaw) {
    window.location.href = "index.html";
    return;
  }

  const session = JSON.parse(sessionRaw);
  document.getElementById("customerSessionBadge").textContent = `${session.name} - ${session.role}`;
  const role = String(session.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isRestrictedRole = ["sales", "user"].includes(role);

  function getActiveWorkflowId() {
    return CustomerManager.getActiveWorkflowId();
  }

  function getWorkflowProfiles() {
    return CustomerManager.getWorkflowProfiles();
  }

  function populateWorkflowAssignmentSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = getWorkflowProfiles()
      .map(profile => `<option value="${Utils.escapeHtml(profile.id)}">${Utils.escapeHtml(profile.name)}</option>`)
      .join("");
  }

  function setWorkflowAssignment(prefix, record = null) {
    const scopeEl = document.getElementById(`${prefix}DataScope`);
    const idsEl = document.getElementById(`${prefix}WorkflowIds`);
    if (!scopeEl || !idsEl) return;
    populateWorkflowAssignmentSelect(`${prefix}WorkflowIds`);
    const activeId = getActiveWorkflowId();
    const isAll = record?.scopeAll === true || record?.dataScope === "all";
    const ids = isAll
      ? getWorkflowProfiles().map(profile => profile.id)
      : (Array.isArray(record?.workflowIds) && record.workflowIds.length ? record.workflowIds : [record?.workflowId || activeId]);
    scopeEl.value = isAll ? "all" : (ids.length > 1 || ids[0] !== activeId ? "selected" : "current");
    [...idsEl.options].forEach(option => {
      option.selected = ids.includes(option.value);
    });
    idsEl.closest(".full-row")?.classList.toggle("hidden", scopeEl.value !== "selected");
  }

  function getWorkflowAssignment(prefix) {
    const scopeEl = document.getElementById(`${prefix}DataScope`);
    const idsEl = document.getElementById(`${prefix}WorkflowIds`);
    const scope = String(scopeEl?.value || "current");
    const activeId = getActiveWorkflowId();
    const selected = idsEl ? [...idsEl.selectedOptions].map(option => option.value).filter(Boolean) : [];
    if (scope === "all") {
      return {
        scopeAll: true,
        dataScope: "all",
        workflowIds: getWorkflowProfiles().map(profile => profile.id),
        workflowId: activeId
      };
    }
    const workflowIds = scope === "selected" && selected.length ? selected : [activeId];
    return {
      scopeAll: false,
      dataScope: scope === "selected" ? "selected" : "current",
      workflowIds,
      workflowId: workflowIds.includes(activeId) ? activeId : workflowIds[0]
    };
  }

  function bindWorkflowAssignment(prefix) {
    const scopeEl = document.getElementById(`${prefix}DataScope`);
    const idsEl = document.getElementById(`${prefix}WorkflowIds`);
    if (!scopeEl || !idsEl) return;
    scopeEl.addEventListener("change", () => {
      if (scopeEl.value === "selected" && ![...idsEl.selectedOptions].length) {
        [...idsEl.options].forEach(option => { option.selected = option.value === getActiveWorkflowId(); });
      }
      idsEl.closest(".full-row")?.classList.toggle("hidden", scopeEl.value !== "selected");
    });
  }

  function getWorkflowSyncContext() {
    const settings = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {});
    const profiles = getWorkflowProfiles();
    return {
      profiles,
      activeId: CustomerManager.normalizeWorkflowId(localStorage.getItem("qt.activeWorkflowId") || settings.activeWorkflowId || APP_CONFIG.defaults.activeWorkflowId)
    };
  }

  function getWorkflowStorageKey(type, workflowId = null) {
    const activeId = CustomerManager.normalizeWorkflowId(workflowId || getActiveWorkflowId());
    const baseMap = {
      quotations: APP_CONFIG.localKeys.quotations,
      archived: APP_CONFIG.localKeys.archived
    };
    return `${baseMap[type] || APP_CONFIG.localKeys.quotations}.${activeId}`;
  }

  function loadTrackerRows(type) {
    const activeId = getActiveWorkflowId();
    const scoped = LocalStorageAdapter.load(getWorkflowStorageKey(type, activeId), null);
    if (Array.isArray(scoped)) {
      return scoped.map(row => ({ ...row, workflowId: CustomerManager.normalizeWorkflowId(row.workflowId || activeId) }));
    }
    const legacyKey = type === "archived" ? APP_CONFIG.localKeys.archived : APP_CONFIG.localKeys.quotations;
    const legacy = LocalStorageAdapter.load(legacyKey, []);
    return (Array.isArray(legacy) ? legacy : [])
      .map(row => ({ ...row, workflowId: CustomerManager.normalizeWorkflowId(row.workflowId || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase") }))
      .filter(row => row.workflowId === activeId);
  }

  function saveTrackerRows(type, rows) {
    const activeId = getActiveWorkflowId();
    const normalizedRows = (Array.isArray(rows) ? rows : []).map(row => ({ ...row, workflowId: CustomerManager.normalizeWorkflowId(row.workflowId || activeId) }));
    LocalStorageAdapter.save(getWorkflowStorageKey(type, activeId), normalizedRows.filter(row => row.workflowId === activeId));

    const legacyKey = type === "archived" ? APP_CONFIG.localKeys.archived : APP_CONFIG.localKeys.quotations;
    const profiles = getWorkflowProfiles();
    const merged = [];
    const scopedIds = new Set();
    let hasScopedData = false;
    profiles.forEach(profile => {
      const bucket = LocalStorageAdapter.load(getWorkflowStorageKey(type, profile.id), null);
      if (Array.isArray(bucket)) {
        hasScopedData = true;
        scopedIds.add(profile.id);
        bucket.forEach(row => merged.push({ ...row, workflowId: CustomerManager.normalizeWorkflowId(row.workflowId || profile.id) }));
      }
    });
    if (hasScopedData) {
      (LocalStorageAdapter.load(legacyKey, []) || []).forEach(row => {
        const normalized = {
          ...row,
          workflowId: CustomerManager.normalizeWorkflowId(row.workflowId || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase")
        };
        if (!scopedIds.has(normalized.workflowId)) merged.push(normalized);
      });
    }
    LocalStorageAdapter.save(legacyKey, hasScopedData ? merged : normalizedRows);
  }

  function getAllTrackerRows(type) {
    const profiles = getWorkflowProfiles();
    const merged = [];
    const scopedIds = new Set();
    let hasScopedData = false;
    profiles.forEach(profile => {
      const bucket = LocalStorageAdapter.load(getWorkflowStorageKey(type, profile.id), null);
      if (Array.isArray(bucket)) {
        hasScopedData = true;
        scopedIds.add(profile.id);
        bucket.forEach(row => merged.push({ ...row, workflowId: CustomerManager.normalizeWorkflowId(row.workflowId || profile.id) }));
      }
    });
    if (hasScopedData) {
      const legacyKey = type === "archived" ? APP_CONFIG.localKeys.archived : APP_CONFIG.localKeys.quotations;
      (LocalStorageAdapter.load(legacyKey, []) || []).forEach(row => {
        const normalized = {
          ...row,
          workflowId: CustomerManager.normalizeWorkflowId(row.workflowId || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase")
        };
        if (!scopedIds.has(normalized.workflowId)) merged.push(normalized);
      });
      return merged;
    }
    const legacyKey = type === "archived" ? APP_CONFIG.localKeys.archived : APP_CONFIG.localKeys.quotations;
    return (LocalStorageAdapter.load(legacyKey, []) || []).map(row => ({
      ...row,
      workflowId: CustomerManager.normalizeWorkflowId(row.workflowId || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase")
    }));
  }

  const roleScopeCodes = (() => {
    if (!isRestrictedRole) return null;
    const settings = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {});
    const quotations = loadTrackerRows("quotations");
    const salesName = String(session.name || "").trim().toLowerCase();
    const map = settings.originSalesMap || APP_CONFIG.defaults.originSalesMap || {};
    const origins = Object.entries(map)
      .filter(([, members]) => (members || []).some(name => String(name || "").trim().toLowerCase() === salesName))
      .map(([origin]) => origin);
    return new Set(quotations
      .filter(q => origins.includes(String(q.origin || "").trim()) || String(q.salesPerson || "").trim().toLowerCase() === salesName)
      .map(q => String(q.customerCode || "").trim())
      .filter(Boolean));
  })();

  let editingCode = null;
  let detailsCustomerCode = null;
  const arabicCustomerLabel = "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064a\u0644";
  const filters = { customers: "", clients: "" };
  const pagination = {
    customers: { page: 1, size: 12 },
    clients: { page: 1, size: 12 }
  };
  const customerModal = document.getElementById("customerModal");
  const customerDetailsModal = document.getElementById("customerDetailsModal");
  const customerFormEl = document.getElementById("customerForm");
  const clientModal = document.getElementById("clientModal");
  const customersSectionEl = document.getElementById("customersSection");
  const clientsSectionEl = document.getElementById("clientsSection");
  const btnTabCustomers = document.getElementById("btnTabCustomers");
  const btnTabClients = document.getElementById("btnTabClients");
  let editingClientId = null;
  let activeTab = "customers";
  const customerFieldMap = [
    { key: "code", prop: "code", formField: "custCode", fallback: "Customer Code" },
    { key: "nameAr", prop: "nameAr", formField: "custNameAr", fallback: arabicCustomerLabel, arabic: true },
    { key: "name", prop: "name", formField: "custName", fallback: "Customer Name" },
    { key: "website", prop: "website", formField: "custWebsite", fallback: "Web Site" },
    { key: "sector", prop: "sector", formField: "custSector", fallback: "Sector" },
    { key: "areaCode", prop: "areaCode", formField: "custAreaCode", fallback: "Area Code" },
    { key: "vt", prop: "vt", formField: "custVT", fallback: "V/T" },
    { key: "vendor", prop: "vendor", formField: "custVendor", fallback: "Vendor #" },
    { key: "remark", prop: "remark", formField: "custRemark", fallback: "Remarks" }
  ];

  function getCustomerSchema() {
    return CustomerManager.getCustomerSettings(getActiveWorkflowId());
  }

  function customerLabel(key, fallback = "") {
    const schema = getCustomerSchema();
    return String(schema.labels?.[key] || fallback || key).trim();
  }

  function getVisibleCustomerFields() {
    const schema = getCustomerSchema();
    return customerFieldMap.filter(field => schema.columns?.[field.key] !== false);
  }

  function applyCustomerSchemaToPage() {
    const schema = getCustomerSchema();
    const plural = schema.entityNamePlural || "Customers";
    const singular = schema.entityName || "Customer";
    document.title = `${plural} Master`;
    document.querySelector(".topbar h1").textContent = `${plural} Master`;
    document.querySelector("#customersSection h2").textContent = `${singular} List`;
    document.getElementById("btnTabCustomers").textContent = plural;
    document.getElementById("btnNewCustomer").textContent = `+ New ${singular}`;
    document.getElementById("customerSearch").placeholder = `Search ${singular.toLowerCase()} data...`;
    customerFieldMap.forEach(field => {
      const label = customerLabel(field.key, field.fallback);
      const labelEl = document.querySelector(`[data-form-field="${field.formField}"] label`);
      if (labelEl) labelEl.textContent = label;
      const fieldEl = document.querySelector(`[data-form-field="${field.formField}"]`);
      if (fieldEl) fieldEl.classList.toggle("hidden", schema.columns?.[field.key] === false);
    });
    document.querySelector("#customerDetailsModal .modal-header h3").textContent = `${singular} Details`;
    document.getElementById("btnEditFromDetails").textContent = `Edit ${singular}`;
  }

  if (!isAdmin) {
    document.getElementById("btnNewCustomer")?.classList.add("hidden");
    document.getElementById("btnNewClient")?.classList.add("hidden");
    document.getElementById("btnImportCustomersCsv")?.classList.add("hidden");
    document.getElementById("btnEditFromDetails")?.classList.add("hidden");
  }
  const debouncedCustomerRender = Utils.debounce(() => {
    pagination.customers.page = 1;
    renderCustomers();
  }, 180);
  const debouncedClientRender = Utils.debounce(() => {
    pagination.clients.page = 1;
    renderClients();
  }, 180);

  function applyCustomerFormLayout() {
    if (!customerFormEl) return;
    const settings = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {});
    const activeId = getActiveWorkflowId();
    const activeProfile = (Array.isArray(settings.workflowProfiles) ? settings.workflowProfiles : [])
      .find(profile => CustomerManager.normalizeWorkflowId(profile?.id) === activeId);
    const layout = LayoutEngine.normalize("customer", activeProfile?.customerFormLayout || settings.customerFormLayout);
    LayoutEngine.applyToContainer(customerFormEl, layout);
    const canvas = activeProfile?.formLayoutCanvas || settings.formLayoutCanvas || APP_CONFIG.defaults.formLayoutCanvas || {};
    const canvasWidth = Math.max(520, Number(canvas.width) || 1200);
    const canvasHeight = Math.max(300, Number(canvas.height) || 720);
    const metrics = LayoutEngine.getCanvasMetrics(canvasWidth, {
      fixedColSize: Number(canvas.colSize) || undefined
    });
    const colSize = metrics.colSize;
    const colGap = metrics.colGap;
    const appliedWidth = metrics.width;
    customerFormEl.style.setProperty("--form-cols", "24");
    customerFormEl.style.setProperty("--form-col-size", `${colSize}px`);
    customerFormEl.style.setProperty("--form-gap", `${colGap}px`);
    customerFormEl.style.setProperty("--form-canvas-width", `${appliedWidth}px`);
    customerFormEl.style.setProperty("--form-canvas-height", `${canvasHeight}px`);
  }

  function getPagedRows(key, rows) {
    const state = pagination[key] || { page: 1, size: 12 };
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / state.size));
    const currentPage = Math.min(Math.max(state.page, 1), totalPages);
    state.page = currentPage;
    const start = (currentPage - 1) * state.size;
    return {
      rows: rows.slice(start, start + state.size),
      total,
      totalPages,
      currentPage
    };
  }

  function getPageButtons(totalPages, currentPage) {
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    start = Math.max(1, end - 4);
    const pages = [];
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  }

  function renderPagination(prefix, paged) {
    const pageButtons = getPageButtons(paged.totalPages, paged.currentPage)
      .map(page => `<button class="btn btn-secondary btn-sm page-number ${page === paged.currentPage ? "active" : ""}" data-page="${page}" data-prefix="${prefix}">${page}</button>`)
      .join("");

    return `
      <div class="list-pagination" data-prefix="${prefix}">
        <button class="btn btn-secondary btn-sm" data-role="prev" data-prefix="${prefix}" ${paged.currentPage <= 1 ? "disabled" : ""}>Prev</button>
        ${pageButtons}
        <button class="btn btn-secondary btn-sm" data-role="next" data-prefix="${prefix}" ${paged.currentPage >= paged.totalPages ? "disabled" : ""}>Next</button>
        <span>Page ${paged.currentPage} of ${paged.totalPages} (${paged.total} items)</span>
        <input class="goto-input" data-role="goto-input" data-prefix="${prefix}" type="number" min="1" max="${paged.totalPages}" placeholder="Page" />
        <button class="btn btn-secondary btn-sm" data-role="goto" data-prefix="${prefix}">Go</button>
      </div>
    `;
  }

  function bindPaginationControls(prefix, paged, onChange) {
    const root = document.querySelector(`.list-pagination[data-prefix="${prefix}"]`);
    if (!root) return;

    const setPage = nextPage => {
      const page = Math.max(1, Math.min(paged.totalPages, Number(nextPage) || 1));
      pagination[prefix].page = page;
      onChange();
    };

    root.querySelector('[data-role="prev"]')?.addEventListener("click", () => setPage(paged.currentPage - 1));
    root.querySelector('[data-role="next"]')?.addEventListener("click", () => setPage(paged.currentPage + 1));
    root.querySelectorAll(".page-number").forEach(btn => {
      btn.addEventListener("click", () => setPage(btn.dataset.page));
    });
    root.querySelector('[data-role="goto"]')?.addEventListener("click", () => {
      const input = root.querySelector('[data-role="goto-input"]');
      setPage(input?.value);
    });
  }

  function setModalTitle() {
    const singular = getCustomerSchema().entityName || "Customer";
    document.getElementById("customerModalTitle").textContent = editingCode ? `Edit ${singular}` : `Add ${singular}`;
  }

  function normalizeHeaderKey(key) {
    return Utils.fixArabicMojibake(key).toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, "");
  }

  function parseRobustCSV(text) {
    return Utils.parseCSV(text);
  }

  async function readCsvText(file) {
    return Utils.readCsvText(file);
  }

  function csvEscape(value) {
    const str = String(value ?? "");
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, "\"\"")}"`;
    return str;
  }

  function downloadCSV(filename, headers, rows) {
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => csvEscape(r[h])).join(","))].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function pickFromRow(row, ...keys) {
    const normalizedMap = {};
    Object.entries(row || {}).forEach(([k, v]) => {
      normalizedMap[normalizeHeaderKey(Utils.fixArabicMojibake(k))] = Utils.fixArabicMojibake(v);
    });
    for (const key of keys) {
      const value = normalizedMap[normalizeHeaderKey(key)];
      if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
    }
    return "";
  }

  function normalizeCode(value) {
    return String(value || "").trim();
  }

  function contactMergeKey(customerCode, contactName) {
    return `${normalizeCode(customerCode)}|${String(contactName || "").trim().toLowerCase()}`;
  }

  function getSearchableContacts() {
    const baseContacts = ContactManager.getAll().map(c => ContactManager.normalizeContact(c));
    const quotations = loadTrackerRows("quotations");
    const quoteContacts = quotations.map(q => ContactManager.normalizeContact({
      customerCode: q.customerCode,
      name: q.contactName || q.name,
      phone: q.phone,
      email: q.email
    }));

    const scopedBase = roleScopeCodes ? baseContacts.filter(c => roleScopeCodes.has(String(c.customerCode || "").trim())) : baseContacts;
    const scopedQuoteContacts = roleScopeCodes ? quoteContacts.filter(c => roleScopeCodes.has(String(c.customerCode || "").trim())) : quoteContacts;
    const merged = [...scopedBase];
    const seen = new Set(scopedBase.map(c => `${normalizeCode(c.customerCode)}|${String(c.name || "").trim().toLowerCase()}`));
    scopedQuoteContacts.forEach(c => {
      if (!c.customerCode || !c.name) return;
      const key = `${normalizeCode(c.customerCode)}|${String(c.name || "").trim().toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(c);
    });
    return merged;
  }

  function getStoredContacts() {
    const all = ContactManager.getAll().map(c => ContactManager.normalizeContact(c));
    if (!roleScopeCodes) return all;
    return all.filter(c => roleScopeCodes.has(String(c.customerCode || "").trim()));
  }

  function getCustomerNameByCode(code) {
    const customer = CustomerManager.getByCode(String(code || "").trim());
    return customer?.name || "";
  }

  function getScopeLabel(record = {}) {
    if (record.scopeAll === true || record.dataScope === "all") return "All Trackers";
    const ids = Array.isArray(record.workflowIds) && record.workflowIds.length
      ? record.workflowIds
      : [record.workflowId || getActiveWorkflowId()];
    const profiles = getWorkflowProfiles();
    return ids.map(id => profiles.find(profile => profile.id === id)?.name || id).join(", ");
  }

  function setActiveTab(nextTab) {
    activeTab = nextTab === "clients" ? "clients" : "customers";
    customersSectionEl?.classList.toggle("hidden", activeTab !== "customers");
    clientsSectionEl?.classList.toggle("hidden", activeTab !== "clients");
    btnTabCustomers?.classList.toggle("is-active", activeTab === "customers");
    btnTabClients?.classList.toggle("is-active", activeTab === "clients");
    document.getElementById("btnNewCustomer")?.classList.toggle("hidden", activeTab !== "customers" || !isAdmin);
    document.getElementById("btnNewClient")?.classList.toggle("hidden", activeTab !== "clients" || !isAdmin);
    document.getElementById("btnImportCustomersCsv")?.classList.toggle("hidden", activeTab !== "customers" || !isAdmin);
    document.getElementById("btnExportCustomersCsv")?.classList.toggle("hidden", activeTab !== "customers");
    document.getElementById("btnImportClientsCsv")?.classList.toggle("hidden", activeTab !== "clients" || !isAdmin);
    document.getElementById("btnExportClientsCsv")?.classList.toggle("hidden", activeTab !== "clients");
    if (activeTab === "customers") renderCustomers();
    else renderClients();
  }

  function backupToCloud(tasks) {
    if (!(GitHubStorageAdapter.isEnabled() || GitHubStorageAdapter.isApiMode())) return;
    const changedAt = LocalStorageAdapter.getLastChangedAt(new Date().toISOString());
    const metaTask = GitHubStorageAdapter.syncMeta({
      schemaVersion: APP_CONFIG.schemaVersion,
      lastChangeAt: changedAt,
      backedUpAt: new Date().toISOString(),
      source: "browser-local"
    });
    Promise.all([...tasks, metaTask]).catch(error => {
      console.error(error);
      Toast.show("Saved locally, but backup sync failed: " + (error.message || error), "warning", 5000);
    });
  }

  function syncCustomersTask() {
    const ctx = getWorkflowSyncContext();
    return GitHubStorageAdapter.syncCustomers(CustomerManager.getAll({ allWorkflows: true }), ctx.profiles, ctx.activeId);
  }

  function syncContactsTask() {
    const ctx = getWorkflowSyncContext();
    return GitHubStorageAdapter.syncContacts(ContactManager.getAll({ allWorkflows: true }), ctx.profiles, ctx.activeId);
  }

  function syncQuotationsTask() {
    const ctx = getWorkflowSyncContext();
    return GitHubStorageAdapter.syncQuotations(getAllTrackerRows("quotations"), ctx.profiles, ctx.activeId);
  }

  function syncArchivedTask() {
    const ctx = getWorkflowSyncContext();
    return GitHubStorageAdapter.syncArchived(getAllTrackerRows("archived"), ctx.profiles, ctx.activeId);
  }

  async function importCustomersCSV(file) {
    Toast.show("Reading customers CSV...", "info");
    const text = await readCsvText(file);
    const rows = parseRobustCSV(text);
    if (!rows.length) {
      Toast.show("CSV has no data rows.", "warning");
      return;
    }
    const confirmed = window.confirm(`Import ${rows.length} customer rows?\nSame Customer code will update existing records.`);
    if (!confirmed) {
      Toast.show("Customer import cancelled.", "info");
      return;
    }

    const all = CustomerManager.getAll();
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let mergedDuplicates = 0;
    const seenKeys = new Set();

    rows.forEach(row => {
      const customer = CustomerManager.normalize({
        code: pickFromRow(row, customerLabel("code", "Customer Code"), "customer code", "customer cod", "code"),
        name: pickFromRow(row, customerLabel("name", "Customer Name"), "customer name", "name"),
        nameAr: pickFromRow(row, customerLabel("nameAr", arabicCustomerLabel), "customer name arabic", "name arabic", "arabic name", "اسم العميل", "اســم العميـــــل", arabicCustomerLabel),
        pgType: pickFromRow(row, "p/g", "pg", "pg type"),
        website: pickFromRow(row, customerLabel("website", "Web Site"), "website", "web site"),
        sector: pickFromRow(row, customerLabel("sector", "Sector"), "sector"),
        areaCode: pickFromRow(row, customerLabel("areaCode", "Area Code"), "area code"),
        vt: pickFromRow(row, customerLabel("vt", "V/T"), "v/t", "vt"),
        vendor: pickFromRow(row, customerLabel("vendor", "Vendor #"), "vendor"),
        remark: pickFromRow(row, customerLabel("remark", "Remarks"), "remark", "remarks"),
        dataScope: pickFromRow(row, "scope", "data scope", "use in"),
        workflowIds: pickFromRow(row, "trackers", "workflow ids", "tracker ids").split(/[|;]/).map(x => x.trim()).filter(Boolean),
        workflowId: getActiveWorkflowId()
      });

      if (!customer.code || !customer.name) {
        skipped += 1;
        return;
      }

      customer.code = normalizeCode(customer.code);
      const codeKey = normalizeCode(customer.code);
      if (seenKeys.has(codeKey)) mergedDuplicates += 1;
      seenKeys.add(codeKey);

      const index = all.findIndex(c => normalizeCode(c.code) === codeKey);
      if (index >= 0) {
        all[index] = { ...all[index], ...customer };
        updated += 1;
      } else {
        all.push(customer);
        added += 1;
      }
    });

    CustomerManager.saveAll(all);
    if (GitHubStorageAdapter.isEnabled() || GitHubStorageAdapter.isApiMode()) {
      backupToCloud([
        syncCustomersTask(),
        syncContactsTask()
      ]);
    }
    renderCustomers();
    renderClients();
    Toast.show(`Customers imported. Added: ${added}, Updated: ${updated}, Skipped: ${skipped}, Duplicates merged: ${mergedDuplicates}.`, "success", 5000);
  }

  async function importClientsCSV(file) {
    Toast.show("Reading clients CSV...", "info");
    const text = await readCsvText(file);
    const rows = parseRobustCSV(text);
    if (!rows.length) {
      Toast.show("CSV has no data rows.", "warning");
      return;
    }
    const confirmed = window.confirm(`Import ${rows.length} client rows?\nSame Customer code + Contact Name will update existing records.`);
    if (!confirmed) {
      Toast.show("Client import cancelled.", "info");
      return;
    }

    const customerCodes = new Set(CustomerManager.getAll().map(c => normalizeCode(c.code)));
    const all = ContactManager.getAll().map(c => ContactManager.normalizeContact(c));
    const indexByKey = new Map();
    all.forEach((c, idx) => {
      indexByKey.set(contactMergeKey(c.customerCode, c.name), idx);
    });

    let added = 0;
    let updated = 0;
    let skipped = 0;
    let mergedDuplicates = 0;
    const seenImportKeys = new Set();

    rows.forEach(row => {
      const customerCode = pickFromRow(row, "customer code", "customer cod", "customercode", "code");
      const name = pickFromRow(row, "contact name", "name", "client name");
      const phone = pickFromRow(row, "contact#", "contact no", "contact number", "phone", "mobile");
      const email = pickFromRow(row, "email", "email address", "mail");
      const assignment = {
        dataScope: pickFromRow(row, "scope", "data scope", "use in"),
        workflowIds: pickFromRow(row, "trackers", "workflow ids", "tracker ids").split(/[|;]/).map(x => x.trim()).filter(Boolean),
        workflowId: getActiveWorkflowId()
      };
      const normalized = ContactManager.normalizeContact({ customerCode, name, phone, email, ...assignment });
      if (!normalized.customerCode || !normalized.name) {
        skipped += 1;
        return;
      }
      if (!customerCodes.has(normalizeCode(normalized.customerCode))) {
        skipped += 1;
        return;
      }
      const key = contactMergeKey(normalized.customerCode, normalized.name);
      if (seenImportKeys.has(key)) mergedDuplicates += 1;
      seenImportKeys.add(key);

      if (indexByKey.has(key)) {
        const idx = indexByKey.get(key);
        all[idx] = { ...all[idx], customerCode: normalized.customerCode, name: normalized.name, phone: normalized.phone, email: normalized.email, dataScope: normalized.dataScope, workflowIds: normalized.workflowIds, workflowId: normalized.workflowId };
        updated += 1;
      } else {
        all.push({ ...normalized, id: Utils.uid("ct") });
        indexByKey.set(key, all.length - 1);
        added += 1;
      }
    });

    ContactManager.saveAll(all);
    if (GitHubStorageAdapter.isEnabled() || GitHubStorageAdapter.isApiMode()) {
      backupToCloud([syncContactsTask()]);
    }
    renderClients();
    Toast.show(`Clients imported. Added: ${added}, Updated: ${updated}, Skipped: ${skipped}, Duplicates merged: ${mergedDuplicates}.`, "success", 5000);
  }

  function openCustomerModal() {
    setModalTitle();
    customerModal.classList.remove("hidden");
  }

  function openLivePreviewIfRequested() {
    let viaParam = false;
    try {
      const params = new URLSearchParams(window.location.search || "");
      viaParam = params.get("livePreview") === "1";
    } catch (_error) {
      viaParam = false;
    }
    const storedTarget = localStorage.getItem("qt.liveFormPreview");
    const shouldOpen = storedTarget === "customer" || (viaParam && storedTarget !== "quotation");
    if (!shouldOpen) return;
    localStorage.removeItem("qt.liveFormPreview");
    editingCode = null;
    setCustomerForm();
    openCustomerModal();
  }

  function closeCustomerModal() {
    customerModal.classList.add("hidden");
  }

  function openCustomerDetailsModal(customer) {
    if (!customer) return;
    detailsCustomerCode = customer.code;
    const content = document.getElementById("customerDetailsContent");
    const fields = [
      ...getVisibleCustomerFields().map(field => [customerLabel(field.key, field.fallback), customer[field.prop] || "", field]),
      ["Use In", getScopeLabel(customer), null]
    ];
    const detailsHtml = fields.map(([label, value]) => `
      <div class="label">${Utils.escapeHtml(label)}</div>
      <div class="value ${label === arabicCustomerLabel || /[\u0600-\u06FF]/.test(label) ? "arabic-text" : ""}" title="${Utils.escapeHtml(value)}">${Utils.escapeHtml(value || "-")}</div>
    `).join("");
    const customerContacts = getSearchableContacts().filter(c => String(c.customerCode || "").trim() === String(customer.code || "").trim());
    const contactsHtml = customerContacts.length
      ? customerContacts.map(c => `
          <div class="customer-contact-chip">
            <strong>${Utils.escapeHtml(c.name || "-")}</strong>
            <span>${Utils.escapeHtml(c.phone || "-")}</span>
            <span>${Utils.escapeHtml(c.email || "-")}</span>
          </div>
        `).join("")
      : `<div class="muted">No contacts linked to this customer.</div>`;
    content.innerHTML = `
      ${detailsHtml}
      <div class="label">Linked Contacts</div>
      <div class="value">
        <div class="customer-contact-list">${contactsHtml}</div>
      </div>
    `;
    customerDetailsModal.classList.remove("hidden");
  }

  function closeCustomerDetailsModal() {
    detailsCustomerCode = null;
    customerDetailsModal.classList.add("hidden");
  }

  function setCustomerForm(customer = null) {
    const c = customer || {};
    document.getElementById("custCode").value = c.code || "";
    setWorkflowAssignment("cust", c);
    document.getElementById("custName").value = c.name || "";
    document.getElementById("custNameAr").value = c.nameAr || "";
    document.getElementById("custPgType").value = c.pgType || "G";
    document.getElementById("custWebsite").value = c.website || "";
    document.getElementById("custSector").value = c.sector || "";
    document.getElementById("custAreaCode").value = c.areaCode || "";
    document.getElementById("custVT").value = c.vt || "";
    document.getElementById("custVendor").value = c.vendor || "";
    document.getElementById("custRemark").value = c.remark || "";
  }

  function cascadeCustomerCodeChange(oldCode, newCode) {
    if (!oldCode || !newCode || oldCode === newCode) return { contactsChanged: 0, quotationsChanged: 0 };

    const contactsChanged = ContactManager.reassignCustomerCode(oldCode, newCode);

    const quotations = loadTrackerRows("quotations");
    const archived = loadTrackerRows("archived");
    let quotationsChanged = 0;

    quotations.forEach(q => {
      if (q.customerCode === oldCode) {
        q.customerCode = newCode;
        quotationsChanged += 1;
      }
    });

    archived.forEach(q => {
      if (q.customerCode === oldCode) {
        q.customerCode = newCode;
        quotationsChanged += 1;
      }
    });

    if (quotationsChanged) {
      saveTrackerRows("quotations", quotations);
      saveTrackerRows("archived", archived);
    }

    return { contactsChanged, quotationsChanged };
  }

  function renderCustomers() {
    const search = String(filters.customers || "").toLowerCase().trim();
    const allRows = CustomerManager.getAll().filter(c => {
      if (roleScopeCodes && !roleScopeCodes.has(String(c.code || "").trim())) return false;
      if (!search) return true;
      return [
        c.code, c.nameAr, c.name, c.website, c.sector, c.areaCode, c.vt, c.vendor, c.remark
      ].some(v => String(v || "").toLowerCase().includes(search));
    });
    const paged = getPagedRows("customers", allRows);
    const wrap = document.getElementById("customerTableWrap");
    const visibleFields = getVisibleCustomerFields();
    const columnHeaders = visibleFields.map(field => `
            <th class="${field.arabic ? "arabic-text" : ""}">${Utils.escapeHtml(customerLabel(field.key, field.fallback))}</th>
    `).join("");
    const emptyColspan = visibleFields.length + 2;

    wrap.innerHTML = `
      <div class="table-wrap">
      <table class="basic-table fixed-table no-sticky-header customer-fixed-table customer-compact-table">
        <thead>
          <tr>
            ${columnHeaders}
            <th>Use In</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${paged.rows.length ? paged.rows.map(c => `
            <tr>
              ${visibleFields.map(field => `<td class="${field.arabic ? "arabic-text" : ""}"><span class="cell-ellipsis" title="${Utils.escapeHtml(c[field.prop] || "")}">${Utils.escapeHtml(c[field.prop] || "")}</span></td>`).join("")}
              <td><span class="cell-ellipsis" title="${Utils.escapeHtml(getScopeLabel(c))}">${Utils.escapeHtml(getScopeLabel(c))}</span></td>
              <td>
                <button class="btn btn-secondary btn-sm" data-details="${Utils.escapeHtml(c.code)}">Details</button>
                ${isAdmin ? `<button class="btn btn-danger btn-sm" data-delete="${Utils.escapeHtml(c.code)}">Delete</button>` : ""}
              </td>
            </tr>
          `).join("") : `<tr><td colspan="${emptyColspan}" class="muted" style="text-align:center;padding:1rem;">No records found for current search.</td></tr>`}
        </tbody>
      </table>
      </div>
      ${renderPagination("customers", paged)}
    `;

    bindPaginationControls("customers", paged, renderCustomers);

    wrap.querySelectorAll("[data-details]").forEach(btn => {
      btn.addEventListener("click", () => {
        const customer = CustomerManager.getByCode(btn.dataset.details);
        openCustomerDetailsModal(customer);
      });
    });

    wrap.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const code = btn.dataset.delete;
        const customer = CustomerManager.getByCode(code);
        if (!customer) return;

        const confirmed = window.confirm(`Delete customer ${customer.code} - ${customer.name}?`);
        if (!confirmed) return;

        try {
          CustomerManager.remove(code);
          ContactManager.removeByCustomerCode(code);

          if (GitHubStorageAdapter.isEnabled() || GitHubStorageAdapter.isApiMode()) {
            backupToCloud([
              syncCustomersTask(),
              syncContactsTask()
            ]);
          }

          renderCustomers();
          renderClients();
          Toast.show("Customer deleted.", "success");
        } catch (error) {
          Toast.show(error.message, "error");
        }
      });
    });
  }

  function setClientForm(contact = null) {
    const c = contact ? ContactManager.normalizeContact(contact) : { customerCode: "", name: "", phone: "", email: "" };
    document.getElementById("clientCustomerCode").value = c.customerCode || "";
    setWorkflowAssignment("client", c);
    document.getElementById("clientName").value = c.name || "";
    document.getElementById("clientPhone").value = c.phone || "";
    document.getElementById("clientEmail").value = c.email || "";
    document.getElementById("clientCustomerName").value = getCustomerNameByCode(c.customerCode);
    document.getElementById("clientModalTitle").textContent = editingClientId ? "Edit Client" : "Add Client";
  }

  function openClientModal() {
    clientModal?.classList.remove("hidden");
  }

  function closeClientModal() {
    clientModal?.classList.add("hidden");
  }

  function renderClients() {
    const wrap = document.getElementById("clientTableWrap");
    if (!wrap) return;
    const search = String(filters.clients || "").toLowerCase().trim();
    const allRows = getStoredContacts()
      .filter(c => {
        if (!search) return true;
        const customerName = getCustomerNameByCode(c.customerCode);
        return [c.customerCode, customerName, c.name, c.phone, c.email].some(v => String(v || "").toLowerCase().includes(search));
      })
      .sort((a, b) => String(a.customerCode || "").localeCompare(String(b.customerCode || "")) || String(a.name || "").localeCompare(String(b.name || "")));
    const paged = getPagedRows("clients", allRows);

    wrap.innerHTML = `
      <div class="table-wrap">
      <table class="basic-table fixed-table no-sticky-header contact-fixed-table">
        <thead>
          <tr>
            <th>Customer code</th>
            <th>Customer name</th>
            <th>Contact Name</th>
            <th>Contact#</th>
            <th>Email</th>
            <th>Use In</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${paged.rows.length ? paged.rows.map(c => `
            <tr>
              <td>${Utils.escapeHtml(c.customerCode || "")}</td>
              <td>${Utils.escapeHtml(getCustomerNameByCode(c.customerCode) || "-")}</td>
              <td>${Utils.escapeHtml(c.name || "")}</td>
              <td>${Utils.escapeHtml(c.phone || "")}</td>
              <td>${Utils.escapeHtml(c.email || "")}</td>
              <td><span class="cell-ellipsis" title="${Utils.escapeHtml(getScopeLabel(c))}">${Utils.escapeHtml(getScopeLabel(c))}</span></td>
              <td>
                ${isAdmin ? `<button class="btn btn-secondary btn-sm" data-edit-client="${Utils.escapeHtml(c.id || "")}">Edit</button>` : ""}
                ${isAdmin ? `<button class="btn btn-danger btn-sm" data-delete-client="${Utils.escapeHtml(c.id || "")}">Delete</button>` : ""}
              </td>
            </tr>
          `).join("") : `<tr><td colspan="7" class="muted" style="text-align:center;padding:1rem;">No clients found for current search.</td></tr>`}
        </tbody>
      </table>
      </div>
      ${renderPagination("clients", paged)}
    `;

    bindPaginationControls("clients", paged, renderClients);

    wrap.querySelectorAll("[data-edit-client]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = String(btn.dataset.editClient || "").trim();
        const contact = ContactManager.getAll().find(c => String(c.id || "").trim() === id);
        if (!contact) return;
        editingClientId = id;
        setClientForm(contact);
        openClientModal();
      });
    });

    wrap.querySelectorAll("[data-delete-client]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = String(btn.dataset.deleteClient || "").trim();
        const all = ContactManager.getAll();
        const existing = all.find(c => String(c.id || "").trim() === id);
        if (!existing) return;
        const ok = window.confirm(`Delete client ${existing.name || ""}?`);
        if (!ok) return;
        const next = all.filter(c => String(c.id || "").trim() !== id);
        ContactManager.saveAll(next);
        if (GitHubStorageAdapter.isEnabled() || GitHubStorageAdapter.isApiMode()) {
          backupToCloud([syncContactsTask()]);
        }
        renderClients();
        Toast.show("Client deleted.", "success");
      });
    });
  }

  document.getElementById("btnBackApp").addEventListener("click", () => {
    window.location.href = "app.html";
  });

  btnTabCustomers?.addEventListener("click", () => setActiveTab("customers"));
  btnTabClients?.addEventListener("click", () => setActiveTab("clients"));

  document.getElementById("btnNewCustomer").addEventListener("click", () => {
    editingCode = null;
    setCustomerForm();
    openCustomerModal();
  });
  document.getElementById("btnNewClient")?.addEventListener("click", () => {
    editingClientId = null;
    setClientForm();
    openClientModal();
  });

  document.getElementById("customerSearch").addEventListener("input", e => {
    filters.customers = e.target.value;
    debouncedCustomerRender();
  });
  document.getElementById("clientSearch")?.addEventListener("input", e => {
    filters.clients = e.target.value;
    debouncedClientRender();
  });

  document.getElementById("btnImportCustomersCsv").addEventListener("click", () => {
    document.getElementById("customersCsvInput").click();
  });
  document.getElementById("btnImportClientsCsv")?.addEventListener("click", () => {
    document.getElementById("clientsCsvInput")?.click();
  });
  document.getElementById("btnExportCustomersCsv").addEventListener("click", () => {
    const visibleFields = getVisibleCustomerFields();
    const headers = [...visibleFields.map(field => customerLabel(field.key, field.fallback)), "Scope", "Trackers"];
    const rows = CustomerManager.getAll().map(c => ({
      ...Object.fromEntries(visibleFields.map(field => [customerLabel(field.key, field.fallback), c[field.prop] || ""])),
      "Scope": c.scopeAll ? "all" : ((c.workflowIds || []).length > 1 ? "selected" : "current"),
      "Trackers": (c.workflowIds || []).join("|")
    }));
    downloadCSV(`customers-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  });
  document.getElementById("btnExportClientsCsv")?.addEventListener("click", () => {
    const headers = ["Customer code", "Contact Name", "Contact#", "Email", "Scope", "Trackers"];
    const rows = ContactManager.getAll().map(c => ContactManager.normalizeContact(c)).map(c => ({
      "Customer code": c.customerCode || "",
      "Contact Name": c.name || "",
      "Contact#": c.phone || "",
      "Email": c.email || "",
      "Scope": c.scopeAll ? "all" : ((c.workflowIds || []).length > 1 ? "selected" : "current"),
      "Trackers": (c.workflowIds || []).join("|")
    }));
    downloadCSV(`clients-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  });
  document.getElementById("customersCsvInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importCustomersCSV(file);
    } catch (error) {
      Toast.show(`Customer import failed: ${error.message || error}`, "error", 5000);
    }
    e.target.value = "";
  });
  document.getElementById("clientsCsvInput")?.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importClientsCSV(file);
    } catch (error) {
      Toast.show(`Client import failed: ${error.message || error}`, "error", 5000);
    }
    e.target.value = "";
  });

  document.getElementById("btnCloseCustomerModal").addEventListener("click", () => closeCustomerModal());
  customerModal.addEventListener("click", e => {
    if (e.target.id === "customerModal") closeCustomerModal();
  });
  document.getElementById("btnCloseClientModal")?.addEventListener("click", () => closeClientModal());
  clientModal?.addEventListener("click", e => {
    if (e.target.id === "clientModal") closeClientModal();
  });
  document.getElementById("clientCustomerCode")?.addEventListener("input", () => {
    const code = document.getElementById("clientCustomerCode").value.trim();
    document.getElementById("clientCustomerName").value = getCustomerNameByCode(code);
  });
  bindWorkflowAssignment("cust");
  bindWorkflowAssignment("client");
  document.getElementById("btnSaveClient")?.addEventListener("click", () => {
    if (!isAdmin) {
      Toast.show("Only admin can modify clients.", "warning");
      return;
    }
    const customerCode = document.getElementById("clientCustomerCode").value.trim();
    const name = document.getElementById("clientName").value.trim();
    const phone = document.getElementById("clientPhone").value.trim();
    const email = document.getElementById("clientEmail").value.trim();
    if (!customerCode || !name) {
      Toast.show("Customer code and contact name are required.", "warning");
      return;
    }
    const customer = CustomerManager.getByCode(customerCode);
    if (!customer) {
      Toast.show("Customer code not found. Please enter existing customer code.", "warning");
      return;
    }
    if (editingClientId) {
      ContactManager.update(editingClientId, { customerCode, name, phone, email, ...getWorkflowAssignment("client") });
    } else {
      ContactManager.add({ customerCode, name, phone, email, ...getWorkflowAssignment("client") });
    }
    if (GitHubStorageAdapter.isEnabled() || GitHubStorageAdapter.isApiMode()) {
      backupToCloud([syncContactsTask()]);
    }
    editingClientId = null;
    setClientForm();
    closeClientModal();
    renderClients();
    Toast.show("Client saved.", "success");
  });
  document.getElementById("btnCloseCustomerDetailsModal").addEventListener("click", () => closeCustomerDetailsModal());
  customerDetailsModal.addEventListener("click", e => {
    if (e.target.id === "customerDetailsModal") closeCustomerDetailsModal();
  });
  document.getElementById("btnEditFromDetails").addEventListener("click", () => {
    if (!detailsCustomerCode) return;
    const customer = CustomerManager.getByCode(detailsCustomerCode);
    if (!customer) return;
    editingCode = customer.code;
    setCustomerForm(customer);
    closeCustomerDetailsModal();
    openCustomerModal();
  });

  document.getElementById("btnSaveCustomer").addEventListener("click", async () => {
    if (!isAdmin) {
      Toast.show("Only admin can modify customers.", "warning");
      return;
    }
    try {
      const code = document.getElementById("custCode").value.trim();
      const name = document.getElementById("custName").value.trim();
      const nameAr = document.getElementById("custNameAr").value.trim();
      const pgType = document.getElementById("custPgType").value;
      const website = document.getElementById("custWebsite").value.trim();
      const sector = document.getElementById("custSector").value.trim();
      const areaCode = document.getElementById("custAreaCode").value.trim();
      const vt = document.getElementById("custVT").value.trim();
      const vendor = document.getElementById("custVendor").value.trim();
      const remark = document.getElementById("custRemark").value.trim();

      if (!code || !name) {
        Toast.show("Customer code and customer name are required.", "warning");
        return;
      }

      let cascadeResult = null;
      if (editingCode) {
        CustomerManager.update(editingCode, { code, name, nameAr, pgType, website, sector, areaCode, vt, vendor, remark, ...getWorkflowAssignment("cust") });
        cascadeResult = cascadeCustomerCodeChange(editingCode, code);
      } else {
        CustomerManager.add({ code, name, nameAr, pgType, website, sector, areaCode, vt, vendor, remark, ...getWorkflowAssignment("cust") });
      }

      if (GitHubStorageAdapter.isEnabled() || GitHubStorageAdapter.isApiMode()) {
        const syncTasks = [
          syncCustomersTask()
        ];
        if (cascadeResult?.contactsChanged) {
          syncTasks.push(syncContactsTask());
        }
        if (cascadeResult?.quotationsChanged) {
          syncTasks.push(
            syncQuotationsTask(),
            syncArchivedTask()
          );
        }
        backupToCloud(syncTasks);
      }

      editingCode = null;
      setCustomerForm();
      closeCustomerModal();
      renderCustomers();
      renderClients();
      if (cascadeResult && (cascadeResult.contactsChanged || cascadeResult.quotationsChanged)) {
        Toast.show(`Customer saved. Updated ${cascadeResult.contactsChanged} contacts and ${cascadeResult.quotationsChanged} quotations.`, "success", 4500);
      } else {
        Toast.show("Customer saved.", "success");
      }
    } catch (error) {
      Toast.show(error.message, "error");
    }
  });

  applyCustomerFormLayout();
  applyCustomerSchemaToPage();
  setCustomerForm();
  renderCustomers();
  renderClients();
  setActiveTab("customers");
  openLivePreviewIfRequested();
});

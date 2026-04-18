window.AppState = {
  session: null,
  quotations: [],
  archivedQuotations: [],
  customers: [],
  contacts: [],
  settings: {},
  selectedContactId: null,
  filters: { search: "", status: "", origin: "", customer: "", workflow: "" },
  kanban: { viewMode: "main", showCompleted: false, layoutMode: "kanban", listPage: 1, listPageSize: 12, selectedIds: [] },
  dashboard: { activePage: 1, completedPage: 1, pageSize: 12 },
  sync: { state: "idle", text: "Saved locally" },
  roleScope: { origins: [], customers: [] },
  ui: { density: "compact" },
  activeWorkflowId: "direct_purchase",
  syncQueue: { inProgress: false, pending: false, lastAttemptAt: null }
};

window.App = {
  async init() {
    const sessionRaw = localStorage.getItem("qt.session");
    if (!sessionRaw) {
      window.location.href = "index.html";
      return;
    }

    AppState.session = JSON.parse(sessionRaw);
    document.getElementById("sessionBadge").textContent = `${AppState.session.name} - ${AppState.session.role}`;
    if (!this.isAdmin()) {
      document.getElementById("btnSettings").classList.add("hidden");
    }

    LocalStorageAdapter.initSeedData();

    AppState.settings = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {});
    AppState.settings.ui = AppState.settings.ui && typeof AppState.settings.ui === "object"
      ? { ...APP_CONFIG.defaults.ui, ...AppState.settings.ui }
      : { ...APP_CONFIG.defaults.ui };
    AppState.settings.dashboardWidgets = Array.isArray(AppState.settings.dashboardWidgets) && AppState.settings.dashboardWidgets.length
      ? AppState.settings.dashboardWidgets
      : [...(APP_CONFIG.defaults.dashboardWidgets || [])];
    AppState.settings.dashboardWidgetTypes = AppState.settings.dashboardWidgetTypes && typeof AppState.settings.dashboardWidgetTypes === "object"
      ? { ...(APP_CONFIG.defaults.dashboardWidgetTypes || {}), ...AppState.settings.dashboardWidgetTypes }
      : { ...(APP_CONFIG.defaults.dashboardWidgetTypes || {}) };
    AppState.settings.dashboardMaxWidgets = Math.max(1, Math.min(50,
      Number(AppState.settings.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20) || 20
    ));
    AppState.settings.dashboardColumns = [2, 3, 4].includes(Number(AppState.settings.dashboardColumns))
      ? Number(AppState.settings.dashboardColumns)
      : Number(APP_CONFIG.defaults.dashboardColumns || 3);
    AppState.settings.dashboardWidgetOrder = Array.isArray(AppState.settings.dashboardWidgetOrder)
      ? [...new Set(AppState.settings.dashboardWidgetOrder.map(x => String(x || "").trim()).filter(Boolean))]
      : [...(APP_CONFIG.defaults.dashboardWidgetOrder || [])];
    AppState.settings.workflowProfiles = this.getWorkflowProfilesFromSettings(AppState.settings);
    AppState.quotations = this.loadWorkflowLocalData("quotations");
    AppState.archivedQuotations = this.loadWorkflowLocalData("archived");
    AppState.customers = this.loadWorkflowLocalData("customers");
    AppState.contacts = this.loadWorkflowLocalData("contacts");
    const savedWorkflow = localStorage.getItem("qt.activeWorkflowId");
    const defaultWorkflow = AppState.settings.activeWorkflowId || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase";
    AppState.activeWorkflowId = this.normalizeWorkflowId(savedWorkflow || defaultWorkflow);
    AppState.filters.workflow = AppState.activeWorkflowId;
    this.applyActiveWorkflowScopedSettings();
    AppState.ui.density = AppState.settings.ui.kanbanDensity || "compact";
    const savedLayoutMode = localStorage.getItem("qt.kanbanLayoutMode");
    AppState.kanban.layoutMode = savedLayoutMode === "list" ? "list" : "kanban";
    const savedView = localStorage.getItem("qt.mainView");
    LocalStorageAdapter.load(APP_CONFIG.localKeys.approvals, []);

    await this.syncFromCloud();
    this.applyActiveWorkflowScopedSettings();
    this.applyDensityMode();
    this.getRoleScope();
    this.applyRolePermissions();
    if (localStorage.getItem("qt.cloudBackupPendingAt")) this.setSyncStatus("pending", "Cloud backup pending...");
    else this.setSyncStatus("idle", "Saved locally");

    this.populateOrigins();
    this.populateStatuses();
    this.populateWorkflowSelectors();
    this.applyTagLabelsToUI();
    this.populateFilterControls();
    this.ensureWorkflowAssignments();
    this.applyQuotationFormLayout();
    QuotationForm.clearForm();
    this.bindEvents();
    this.showView(savedView === "dashboard" ? "dashboard" : "board");
    this.setBoardLayoutMode(savedLayoutMode === "list" ? "list" : "kanban");
    Kanban.render();
    Dashboard.render();
    this.openLivePreviewIfRequested();
    this.startRelativeTimeTicker();
    this.startSyncQueueWorker();
  },

  openLivePreviewIfRequested() {
    let shouldOpen = false;
    try {
      const params = new URLSearchParams(window.location.search || "");
      shouldOpen = params.get("livePreview") === "1";
    } catch (_error) {
      shouldOpen = false;
    }
    if (!shouldOpen) {
      shouldOpen = localStorage.getItem("qt.liveFormPreview") === "quotation";
    }
    if (!shouldOpen) return;
    localStorage.removeItem("qt.liveFormPreview");
    this.openQuotationModal(true);
  },

  async syncFromCloud() {
    if (!GitHubStorageAdapter.isEnabled()) return;

    try {
      const localPayload = this.buildSyncPayload();
      const hasLocalSettings =
        AppState.settings &&
        typeof AppState.settings === "object" &&
        Object.keys(AppState.settings).length > 0;
      const hasLocalData =
        (Array.isArray(AppState.quotations) && AppState.quotations.length > 0) ||
        (Array.isArray(AppState.archivedQuotations) && AppState.archivedQuotations.length > 0) ||
        (Array.isArray(AppState.customers) && AppState.customers.length > 0) ||
        (Array.isArray(AppState.contacts) && AppState.contacts.length > 0) ||
        hasLocalSettings;
      const remote = await GitHubStorageAdapter.loadAllData({
        quotations: AppState.quotations,
        archived: AppState.archivedQuotations,
        contacts: AppState.contacts,
        customers: AppState.customers,
        settings: AppState.settings,
        audit: AuditTrail.getAll(),
        approvals: ApprovalWorkflow.getApprovals(),
        meta: {}
      });
      const remoteHasData =
        (Array.isArray(remote.quotations) && remote.quotations.length > 0) ||
        (Array.isArray(remote.archived) && remote.archived.length > 0) ||
        (Array.isArray(remote.customers) && remote.customers.length > 0) ||
        (Array.isArray(remote.contacts) && remote.contacts.length > 0) ||
        (remote.settings && typeof remote.settings === "object" && Object.keys(remote.settings).length > 0);

      const remoteHash = this.computeSyncHash(remote);
      const localHash = this.computeSyncHash(localPayload);
      const localChangedAt = this.getLocalLastChangedAt(localPayload);
      const remoteChangedAt = this.getRemoteLastChangedAt(remote);

      if (hasLocalData && remoteHasData && localHash !== remoteHash) {
        if (!this.isRemoteNewer(remoteChangedAt, localChangedAt)) {
          this.enqueueCloudBackup();
          Toast.show("Local data is latest. Cloud backup queued.", "info", 2500);
          return;
        }
      } else if (hasLocalData && remoteHasData && localHash === remoteHash) {
        if (remoteChangedAt && !LocalStorageAdapter.getLastChangedAt()) {
          LocalStorageAdapter.markChanged(remoteChangedAt);
        }
        return;
      } else if (hasLocalData) {
        return;
      }

      AppState.quotations = Array.isArray(remote.quotations) ? remote.quotations : [];
      AppState.archivedQuotations = Array.isArray(remote.archived) ? remote.archived : [];
      AppState.contacts = Array.isArray(remote.contacts) ? remote.contacts : [];
      AppState.customers = Array.isArray(remote.customers) ? remote.customers : [];
      AppState.settings = remote.settings && typeof remote.settings === "object"
        ? remote.settings
        : (AppState.settings || {});
      AppState.settings.ui = AppState.settings.ui && typeof AppState.settings.ui === "object"
        ? { ...APP_CONFIG.defaults.ui, ...AppState.settings.ui }
        : { ...APP_CONFIG.defaults.ui };
      AppState.settings.dashboardWidgets = Array.isArray(AppState.settings.dashboardWidgets) && AppState.settings.dashboardWidgets.length
        ? AppState.settings.dashboardWidgets
        : [...(APP_CONFIG.defaults.dashboardWidgets || [])];
      AppState.settings.dashboardWidgetTypes = AppState.settings.dashboardWidgetTypes && typeof AppState.settings.dashboardWidgetTypes === "object"
        ? { ...(APP_CONFIG.defaults.dashboardWidgetTypes || {}), ...AppState.settings.dashboardWidgetTypes }
        : { ...(APP_CONFIG.defaults.dashboardWidgetTypes || {}) };
      AppState.settings.dashboardMaxWidgets = Math.max(1, Math.min(50,
        Number(AppState.settings.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20) || 20
      ));
      AppState.settings.dashboardColumns = [2, 3, 4].includes(Number(AppState.settings.dashboardColumns))
        ? Number(AppState.settings.dashboardColumns)
        : Number(APP_CONFIG.defaults.dashboardColumns || 3);
      AppState.settings.dashboardWidgetOrder = Array.isArray(AppState.settings.dashboardWidgetOrder)
        ? [...new Set(AppState.settings.dashboardWidgetOrder.map(x => String(x || "").trim()).filter(Boolean))]
        : [...(APP_CONFIG.defaults.dashboardWidgetOrder || [])];
      AppState.ui.density = AppState.settings.ui.kanbanDensity || "compact";

      LocalStorageAdapter.withSilentChanges(() => {
        this.saveWorkflowLocalData("quotations", AppState.quotations);
        this.saveWorkflowLocalData("archived", AppState.archivedQuotations);
        this.saveWorkflowLocalData("contacts", AppState.contacts);
        this.saveWorkflowLocalData("customers", AppState.customers);
        LocalStorageAdapter.save(APP_CONFIG.localKeys.settings, AppState.settings, { silent: true });
        LocalStorageAdapter.save(APP_CONFIG.localKeys.audit, Array.isArray(remote.audit) ? remote.audit : [], { silent: true });
        LocalStorageAdapter.save(APP_CONFIG.localKeys.approvals, Array.isArray(remote.approvals) ? remote.approvals : [], { silent: true });
      });
      if (remoteChangedAt) LocalStorageAdapter.markChanged(remoteChangedAt);
      localStorage.setItem("qt.lastCloudHash", remoteHash);
      Toast.show("Loaded latest cloud changes.", "info", 2500);
    } catch (error) {
      console.error(error);
      Toast.show("Cloud sync failed on startup. Using local data.", "warning", 4500);
    }
  },

  getRecordTime(value) {
    const time = Date.parse(String(value || ""));
    return Number.isFinite(time) ? time : 0;
  },

  deriveLatestChangedAt(payload) {
    const times = [];
    ["quotations", "archived", "contacts", "customers", "audit", "approvals"].forEach(key => {
      (Array.isArray(payload?.[key]) ? payload[key] : []).forEach(row => {
        times.push(
          this.getRecordTime(row?.updatedAt),
          this.getRecordTime(row?.createdAt),
          this.getRecordTime(row?.date),
          this.getRecordTime(row?.timestamp)
        );
      });
    });
    const latest = Math.max(0, ...times);
    return latest ? new Date(latest).toISOString() : "";
  },

  getLocalLastChangedAt(payload = null) {
    return LocalStorageAdapter.getLastChangedAt() || this.deriveLatestChangedAt(payload || this.buildSyncPayload());
  },

  getRemoteLastChangedAt(remote = {}) {
    const metaTime = String(remote?.meta?.lastChangeAt || remote?.meta?.updatedAt || "").trim();
    return metaTime || this.deriveLatestChangedAt(remote);
  },

  isRemoteNewer(remoteChangedAt, localChangedAt) {
    const remoteTime = this.getRecordTime(remoteChangedAt);
    const localTime = this.getRecordTime(localChangedAt);
    return remoteTime > localTime;
  },

  getFilteredQuotations() {
    const activeWorkflowId = this.getActiveWorkflowId();
    const scoped = this.getScopedQuotations().filter(q => this.normalizeWorkflowId(q.workflowId || activeWorkflowId) === activeWorkflowId);
    return SearchFilter.apply(scoped, AppState.filters);
  },

  getWorkflowStorageKey(type, workflowId) {
    const id = this.normalizeWorkflowId(workflowId || this.getActiveWorkflowId());
    const baseMap = {
      archived: APP_CONFIG.localKeys.archived,
      contacts: APP_CONFIG.localKeys.contacts,
      customers: APP_CONFIG.localKeys.customers,
      quotations: APP_CONFIG.localKeys.quotations
    };
    const base = baseMap[type] || APP_CONFIG.localKeys.quotations;
    return `${base}.${id}`;
  },

  loadWorkflowLocalData(type = "quotations") {
    const legacyKeyMap = {
      archived: APP_CONFIG.localKeys.archived,
      contacts: APP_CONFIG.localKeys.contacts,
      customers: APP_CONFIG.localKeys.customers,
      quotations: APP_CONFIG.localKeys.quotations
    };
    const legacyKey = legacyKeyMap[type] || APP_CONFIG.localKeys.quotations;
    const profiles = this.getWorkflowProfiles();
    const ids = profiles.map(p => p.id);
    const merged = [];
    const scopedIds = new Set();
    let hasBucketData = false;
    ids.forEach(id => {
      const key = this.getWorkflowStorageKey(type, id);
      const rows = LocalStorageAdapter.load(key, null);
      if (Array.isArray(rows)) {
        hasBucketData = true;
        scopedIds.add(id);
        rows.forEach(row => merged.push({ ...row, workflowId: this.normalizeWorkflowId(row.workflowId || id) }));
      }
    });
    if (hasBucketData) {
      const legacyRows = LocalStorageAdapter.load(legacyKey, []);
      (Array.isArray(legacyRows) ? legacyRows : []).forEach(row => {
        const normalized = {
          ...row,
          workflowId: this.normalizeWorkflowId(row.workflowId || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase")
        };
        if (!scopedIds.has(normalized.workflowId)) merged.push(normalized);
      });
      return merged;
    }

    const legacyRows = LocalStorageAdapter.load(legacyKey, []);
    const fallbackWorkflow = this.normalizeWorkflowId(APP_CONFIG.defaults.activeWorkflowId || "direct_purchase");
    const normalized = (Array.isArray(legacyRows) ? legacyRows : []).map(row => ({
      ...row,
      workflowId: this.normalizeWorkflowId(row.workflowId || fallbackWorkflow)
    }));
    if (normalized.length) this.saveWorkflowLocalData(type, normalized);
    return normalized;
  },

  saveWorkflowLocalData(type = "quotations", rows = []) {
    const legacyKeyMap = {
      archived: APP_CONFIG.localKeys.archived,
      contacts: APP_CONFIG.localKeys.contacts,
      customers: APP_CONFIG.localKeys.customers,
      quotations: APP_CONFIG.localKeys.quotations
    };
    const legacyKey = legacyKeyMap[type] || APP_CONFIG.localKeys.quotations;
    const profiles = this.getWorkflowProfiles();
    const ids = profiles.map(p => p.id);
    const normalizedRows = (Array.isArray(rows) ? rows : []).map(row => ({
      ...row,
      workflowId: this.normalizeWorkflowId(row.workflowId || this.getActiveWorkflowId())
    }));

    ids.forEach(id => {
      const key = this.getWorkflowStorageKey(type, id);
      const bucket = normalizedRows.filter(r => this.normalizeWorkflowId(r.workflowId || id) === id);
      LocalStorageAdapter.save(key, bucket);
    });
    LocalStorageAdapter.save(legacyKey, normalizedRows);
  },

  getQuotationsByWorkflow(workflowId) {
    const id = this.normalizeWorkflowId(workflowId || this.getActiveWorkflowId());
    return (AppState.quotations || []).filter(q => this.normalizeWorkflowId(q.workflowId || id) === id);
  },

  getScopedQuotations() {
    const all = Array.isArray(AppState.quotations) ? AppState.quotations : [];
    const scope = this.getRoleScope();
    if (!scope.isRestricted) return all;
    return all.filter(q => {
      const originOk = !scope.origins.length || scope.origins.includes(String(q.origin || "").trim());
      const salesOk = !scope.salesPerson || String(q.salesPerson || "").trim().toLowerCase() === scope.salesPerson.toLowerCase();
      return originOk || salesOk;
    });
  },

  getRoleScope() {
    const role = String(AppState.session?.role || "").toLowerCase();
    if (!["user", "sales"].includes(role)) return { isRestricted: false, origins: [], customers: [], salesPerson: "" };
    const name = String(AppState.session?.name || "").trim();
    const map = this.getActiveTagGroup()?.tags?.reduce((acc, tag) => {
      acc[tag.name] = Array.isArray(tag.subtags) ? tag.subtags : [];
      return acc;
    }, {})
      || this.getActiveWorkflowProfile()?.originSalesMap
      || AppState.settings?.originSalesMap
      || APP_CONFIG.defaults.originSalesMap
      || {};
    const origins = Object.entries(map)
      .filter(([, members]) => (members || []).some(member => String(member || "").trim().toLowerCase() === name.toLowerCase()))
      .map(([origin]) => origin);
    const customers = [...new Set((AppState.quotations || [])
      .filter(q => origins.includes(String(q.origin || "").trim()) || String(q.salesPerson || "").trim().toLowerCase() === name.toLowerCase())
      .map(q => String(q.customerCode || "").trim())
      .filter(Boolean))];
    AppState.roleScope = { origins, customers };
    return { isRestricted: true, origins, customers, salesPerson: name };
  },

  getScopedCustomers() {
    const all = Array.isArray(AppState.customers) ? AppState.customers : [];
    const activeWorkflowId = this.getActiveWorkflowId();
    const activeRows = all.filter(c => this.normalizeWorkflowId(c.workflowId || activeWorkflowId) === activeWorkflowId);
    const scope = this.getRoleScope();
    if (!scope.isRestricted) return activeRows;
    if (!scope.customers.length) return [];
    return activeRows.filter(c => scope.customers.includes(String(c.code || "").trim()));
  },

  searchScopedCustomersByCode(text) {
    const q = String(text || "").toLowerCase().trim();
    return this.getScopedCustomers().filter(c => String(c.code || "").toLowerCase().includes(q));
  },

  searchScopedCustomersByName(text) {
    const q = String(text || "").toLowerCase().trim();
    return this.getScopedCustomers().filter(c => {
      const name = String(c.name || "").toLowerCase();
      const nameAr = String(c.nameAr || "").toLowerCase();
      return name.includes(q) || nameAr.includes(q);
    });
  },

  setSyncStatus(state, text) {
    AppState.sync = { state, text };
    const badge = document.getElementById("syncStatusBadge");
    if (!badge) return;
    badge.className = `sync-badge sync-${state}`;
    badge.textContent = text;
  },

  applyDensityMode() {
    const density = AppState.ui?.density === "comfortable" ? "comfortable" : "compact";
    document.body.classList.remove("density-compact", "density-comfortable");
    document.body.classList.add(`density-${density}`);
    const densityEl = document.getElementById("kanbanDensity");
    if (densityEl) densityEl.value = density;
  },

  getWorkflowProfilesFromSettings(settings) {
    const normalizeTagGroups = (profile, fallbackTagLabel, fallbackMap, fallbackOrigins) => {
      const input = Array.isArray(profile?.tagGroups) && profile.tagGroups.length
        ? profile.tagGroups
        : [{
            id: "origin",
            name: String(fallbackTagLabel || "Origin").trim() || "Origin",
            tags: (Array.isArray(fallbackOrigins) ? fallbackOrigins : []).map(tag => ({
              name: String(tag || "").trim(),
              subtags: Array.isArray(fallbackMap?.[tag]) ? fallbackMap[tag] : []
            }))
          }];
      const used = new Set();
      const groups = input.map((group, index) => {
        const name = String(group?.name || "").trim() || `Tag Group ${index + 1}`;
        let id = String(group?.id || "").trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `tag_group_${index + 1}`;
        if (used.has(id)) id = `${id}_${index + 1}`;
        used.add(id);
        const tags = (Array.isArray(group?.tags) ? group.tags : [])
          .map(t => ({
            name: String(t?.name || "").trim(),
            subtags: [...new Set((Array.isArray(t?.subtags) ? t.subtags : []).map(s => String(s || "").trim()).filter(Boolean))]
          }))
          .filter(t => t.name);
        return { id, name, tags };
      }).filter(g => g.name);
      return groups.length ? groups : [{ id: "origin", name: "Origin", tags: [] }];
    };

    const defaults = APP_CONFIG.defaults.workflowProfiles || [];
    const globalOriginSalesMap = settings?.originSalesMap || APP_CONFIG.defaults.originSalesMap || {};
    const source = Array.isArray(settings?.workflowProfiles) && settings.workflowProfiles.length
      ? settings.workflowProfiles
      : defaults;
    const normalized = source.map(profile => {
      const fallbackOrigins = Array.isArray(profile?.origins) ? profile.origins.map(x => String(x || "").trim()).filter(Boolean) : [];
      const fallbackMap = profile?.originSalesMap && typeof profile.originSalesMap === "object"
        ? profile.originSalesMap
        : globalOriginSalesMap;
      const tagLabel = String(profile?.tagLabel || settings?.tagLabel || APP_CONFIG.defaults.tagLabel || "Origin").trim() || "Origin";
      const tagGroups = normalizeTagGroups(profile, tagLabel, fallbackMap, fallbackOrigins);
      const activeTagGroupId = tagGroups.some(g => g.id === String(profile?.activeTagGroupId || "").trim())
        ? String(profile.activeTagGroupId).trim()
        : tagGroups[0].id;
      const activeGroup = tagGroups.find(g => g.id === activeTagGroupId) || tagGroups[0];
      const origins = (activeGroup?.tags || []).map(t => t.name);
      const originSalesMap = Object.fromEntries((activeGroup?.tags || []).map(t => [t.name, Array.isArray(t.subtags) ? t.subtags : []]));
      return {
      id: String(profile?.id || "").trim(),
      name: String(profile?.name || "").trim() || String(profile?.id || "").trim(),
      tagLabel: String(activeGroup?.name || tagLabel).trim() || "Origin",
      subTagLabel: String(profile?.subTagLabel || settings?.subTagLabel || APP_CONFIG.defaults.subTagLabel || "Sub Tag").trim() || "Sub Tag",
      origins,
      statusGroups: Array.isArray(profile?.statusGroups) ? profile.statusGroups : [],
      referenceFormula: String(profile?.referenceFormula || settings?.referenceFormula || APP_CONFIG.defaults.referenceFormula || "YYMMDD{SEQ}"),
      referenceStartSequence: Math.max(0, Number(profile?.referenceStartSequence ?? settings?.referenceStartSequence ?? APP_CONFIG.defaults.referenceStartSequence ?? 6)),
      referenceSequencePad: Math.max(1, Number(profile?.referenceSequencePad ?? settings?.referenceSequencePad ?? APP_CONFIG.defaults.referenceSequencePad ?? 2)),
      originSalesMap,
      tagGroups,
      activeTagGroupId,
      formLayout: Array.isArray(profile?.formLayout) && profile.formLayout.length
        ? profile.formLayout
        : (Array.isArray(settings?.formLayout) ? settings.formLayout : APP_CONFIG.defaults.formLayout || []),
      customerFormLayout: Array.isArray(profile?.customerFormLayout) && profile.customerFormLayout.length
        ? profile.customerFormLayout
        : (Array.isArray(settings?.customerFormLayout) ? settings.customerFormLayout : APP_CONFIG.defaults.customerFormLayout || []),
      formLayoutCanvas: profile?.formLayoutCanvas && typeof profile.formLayoutCanvas === "object"
        ? { ...profile.formLayoutCanvas }
        : { ...(settings?.formLayoutCanvas || APP_CONFIG.defaults.formLayoutCanvas || {}) },
      dashboardWidgets: Array.isArray(profile?.dashboardWidgets) && profile.dashboardWidgets.length
        ? profile.dashboardWidgets
        : (Array.isArray(settings?.dashboardWidgets) ? settings.dashboardWidgets : APP_CONFIG.defaults.dashboardWidgets || []),
      dashboardWidgetTypes: profile?.dashboardWidgetTypes && typeof profile.dashboardWidgetTypes === "object"
        ? { ...profile.dashboardWidgetTypes }
        : { ...(settings?.dashboardWidgetTypes || APP_CONFIG.defaults.dashboardWidgetTypes || {}) },
      dashboardWidgetOrder: Array.isArray(profile?.dashboardWidgetOrder) && profile.dashboardWidgetOrder.length
        ? profile.dashboardWidgetOrder
        : (Array.isArray(settings?.dashboardWidgetOrder) ? settings.dashboardWidgetOrder : APP_CONFIG.defaults.dashboardWidgetOrder || []),
      dashboardMaxWidgets: Math.max(1, Math.min(50, Number(profile?.dashboardMaxWidgets ?? settings?.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20) || 20)),
      dashboardColumns: [2, 3, 4].includes(Number(profile?.dashboardColumns ?? settings?.dashboardColumns))
        ? Number(profile?.dashboardColumns ?? settings?.dashboardColumns)
        : Number(APP_CONFIG.defaults.dashboardColumns || 3),
      pages: {
        customers: profile?.pages?.customers !== false,
        archived: profile?.pages?.archived !== false
      }
    };
    }).filter(p => p.id);
    return normalized.length ? normalized : [{
      id: "direct_purchase",
      name: "Direct Purchase Quotation",
      tagLabel: String(APP_CONFIG.defaults.tagLabel || "Origin"),
      subTagLabel: String(APP_CONFIG.defaults.subTagLabel || "Sub Tag"),
      origins: APP_CONFIG.defaults.origins || [],
      statusGroups: APP_CONFIG.defaults.statusGroups || [],
      referenceFormula: APP_CONFIG.defaults.referenceFormula || "YYMMDD{SEQ}",
      referenceStartSequence: Math.max(0, Number(APP_CONFIG.defaults.referenceStartSequence ?? 6)),
      referenceSequencePad: Math.max(1, Number(APP_CONFIG.defaults.referenceSequencePad ?? 2)),
      originSalesMap: APP_CONFIG.defaults.originSalesMap || {},
      tagGroups: [{
        id: "origin",
        name: String(APP_CONFIG.defaults.tagLabel || "Origin"),
        tags: (APP_CONFIG.defaults.origins || []).map(tag => ({ name: tag, subtags: (APP_CONFIG.defaults.originSalesMap || {})[tag] || [] }))
      }],
      activeTagGroupId: "origin",
      formLayout: APP_CONFIG.defaults.formLayout || [],
      customerFormLayout: APP_CONFIG.defaults.customerFormLayout || [],
      formLayoutCanvas: APP_CONFIG.defaults.formLayoutCanvas || {},
      dashboardWidgets: APP_CONFIG.defaults.dashboardWidgets || [],
      dashboardWidgetTypes: APP_CONFIG.defaults.dashboardWidgetTypes || {},
      dashboardWidgetOrder: APP_CONFIG.defaults.dashboardWidgetOrder || [],
      dashboardMaxWidgets: Math.max(1, Math.min(50, Number(APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20) || 20)),
      dashboardColumns: Number(APP_CONFIG.defaults.dashboardColumns || 3),
      pages: { customers: true, archived: true }
    }];
  },

  getWorkflowProfiles() {
    const profiles = this.getWorkflowProfilesFromSettings(AppState.settings);
    AppState.settings.workflowProfiles = profiles;
    return profiles;
  },

  normalizeWorkflowId(id) {
    const profiles = this.getWorkflowProfiles();
    const fallback = profiles[0]?.id || "direct_purchase";
    const value = String(id || "").trim();
    return profiles.some(p => p.id === value) ? value : fallback;
  },

  getActiveWorkflowId() {
    AppState.activeWorkflowId = this.normalizeWorkflowId(AppState.activeWorkflowId);
    return AppState.activeWorkflowId;
  },

  getActiveWorkflowProfile() {
    const id = this.getActiveWorkflowId();
    const profiles = this.getWorkflowProfiles();
    return profiles.find(p => p.id === id) || profiles[0];
  },

  applyActiveWorkflowScopedSettings() {
    const profile = this.getActiveWorkflowProfile();
    if (!profile) return;
    AppState.settings.formLayout = Array.isArray(profile.formLayout) ? profile.formLayout : (APP_CONFIG.defaults.formLayout || []);
    AppState.settings.customerFormLayout = Array.isArray(profile.customerFormLayout) ? profile.customerFormLayout : (APP_CONFIG.defaults.customerFormLayout || []);
    AppState.settings.formLayoutCanvas = profile.formLayoutCanvas && typeof profile.formLayoutCanvas === "object"
      ? profile.formLayoutCanvas
      : (APP_CONFIG.defaults.formLayoutCanvas || {});
    AppState.settings.dashboardWidgets = Array.isArray(profile.dashboardWidgets) ? profile.dashboardWidgets : (APP_CONFIG.defaults.dashboardWidgets || []);
    AppState.settings.dashboardWidgetTypes = profile.dashboardWidgetTypes && typeof profile.dashboardWidgetTypes === "object"
      ? profile.dashboardWidgetTypes
      : (APP_CONFIG.defaults.dashboardWidgetTypes || {});
    AppState.settings.dashboardWidgetOrder = Array.isArray(profile.dashboardWidgetOrder) ? profile.dashboardWidgetOrder : (APP_CONFIG.defaults.dashboardWidgetOrder || []);
    AppState.settings.dashboardMaxWidgets = Math.max(1, Math.min(50, Number(profile.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20) || 20));
    AppState.settings.dashboardColumns = [2, 3, 4].includes(Number(profile.dashboardColumns))
      ? Number(profile.dashboardColumns)
      : Number(APP_CONFIG.defaults.dashboardColumns || 3);
    AppState.settings.pages = profile.pages && typeof profile.pages === "object"
      ? { customers: profile.pages.customers !== false, archived: profile.pages.archived !== false }
      : { customers: true, archived: true };
  },

  getActiveTagGroup(workflowId = null) {
    const profile = workflowId
      ? (this.getWorkflowProfiles().find(p => p.id === this.normalizeWorkflowId(workflowId)) || this.getActiveWorkflowProfile())
      : this.getActiveWorkflowProfile();
    const groups = Array.isArray(profile?.tagGroups) ? profile.tagGroups : [];
    const activeId = String(profile?.activeTagGroupId || "").trim();
    return groups.find(g => g.id === activeId) || groups[0] || { id: "", name: String(profile?.tagLabel || "Origin"), tags: [] };
  },

  getTagLabels(workflowId = null) {
    const profile = workflowId
      ? (this.getWorkflowProfiles().find(p => p.id === this.normalizeWorkflowId(workflowId)) || this.getActiveWorkflowProfile())
      : this.getActiveWorkflowProfile();
    const tag = String(profile?.tagLabel || AppState.settings?.tagLabel || APP_CONFIG.defaults.tagLabel || "Origin").trim() || "Origin";
    const subTag = String(profile?.subTagLabel || AppState.settings?.subTagLabel || APP_CONFIG.defaults.subTagLabel || "Sub Tag").trim() || "Sub Tag";
    return { tag, subTag };
  },

  applyTagLabelsToUI() {
    const labels = this.getTagLabels();
    const originLabel = document.querySelector('[data-form-field="origin"] > label');
    const salesLabel = document.querySelector('[data-form-field="salesPerson"] > label');
    if (originLabel) originLabel.textContent = labels.tag;
    if (salesLabel) salesLabel.textContent = labels.subTag;
    const quickSalesLabel = document.querySelector('label[for="quickSales"]');
    if (!quickSalesLabel) {
      const quickWrap = document.getElementById("quickSales")?.closest("div");
      const quickLbl = quickWrap?.querySelector("label");
      if (quickLbl) quickLbl.textContent = labels.subTag;
    } else {
      quickSalesLabel.textContent = labels.subTag;
    }
  },

  getWorkflowReferenceConfig(workflowId = null) {
    const targetId = workflowId ? this.normalizeWorkflowId(workflowId) : this.getActiveWorkflowId();
    const profile = this.getWorkflowProfiles().find(p => p.id === targetId) || this.getActiveWorkflowProfile();
    const defaults = APP_CONFIG.defaults || {};
    return {
      formula: String(profile?.referenceFormula || AppState.settings?.referenceFormula || defaults.referenceFormula || "YYMMDD{SEQ}"),
      startSequence: Math.max(0, Number(profile?.referenceStartSequence ?? AppState.settings?.referenceStartSequence ?? defaults.referenceStartSequence ?? 6)),
      sequencePad: Math.max(1, Number(profile?.referenceSequencePad ?? AppState.settings?.referenceSequencePad ?? defaults.referenceSequencePad ?? 2))
    };
  },

  setActiveWorkflow(id) {
    const next = this.normalizeWorkflowId(id);
    AppState.activeWorkflowId = next;
    localStorage.setItem("qt.activeWorkflowId", next);
    AppState.filters.workflow = next;
    const workflowEl = document.getElementById("activeWorkflow");
    if (workflowEl && workflowEl.value !== next) workflowEl.value = next;
    const formWorkflowEl = document.getElementById("quotationWorkflow");
    if (formWorkflowEl && formWorkflowEl.value !== next) formWorkflowEl.value = next;
    this.applyActiveWorkflowScopedSettings();
    this.applyRolePermissions();
    this.syncActiveWorkflowTabs(next);
    this.populateOrigins();
    this.populateStatuses();
    this.applyTagLabelsToUI();
    if (window.QuotationForm && typeof QuotationForm.syncSequenceForWorkflow === "function") {
      QuotationForm.syncSequenceForWorkflow(next);
    }
    this.populateFilterControls();
    const statuses = this.getAllStatuses();
    if (AppState.filters.status && !statuses.includes(AppState.filters.status)) {
      AppState.filters.status = "";
      const filterStatusEl = document.getElementById("filterStatus");
      if (filterStatusEl) filterStatusEl.value = "";
    }
    const scope = this.getRoleScope();
    const workflowOrigins = (this.getActiveTagGroup()?.tags || []).map(t => t.name);
    const configuredOrigins = workflowOrigins.length
      ? workflowOrigins
      : (AppState.settings.origins || APP_CONFIG.defaults.origins);
    const origins = scope.isRestricted
      ? configuredOrigins.filter(origin => scope.origins.includes(origin))
      : configuredOrigins;
    if (AppState.filters.origin && !origins.includes(AppState.filters.origin)) {
      AppState.filters.origin = "";
      const filterOriginEl = document.getElementById("filterOrigin");
      if (filterOriginEl) filterOriginEl.value = "";
    }
    this.setListPage(1);
    this.clearSelectedListIds();
    this.renderActiveFilterChips();
    Kanban.render();
    Dashboard.render();
  },

  renderWorkflowTabs(containerId, options, activeId) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    wrap.innerHTML = options.map(x => `
      <button
        type="button"
        class="tracker-tab ${x.id === activeId ? "is-active" : ""}"
        data-workflow-id="${Utils.escapeHtml(x.id)}"
      >${Utils.escapeHtml(x.name)}</button>
    `).join("");
    wrap.querySelectorAll(".tracker-tab").forEach(btn => {
      btn.addEventListener("click", () => this.setActiveWorkflow(btn.dataset.workflowId));
    });
  },

  syncActiveWorkflowTabs(activeId) {
    document.querySelectorAll("#activeWorkflowTabs .tracker-tab, #quotationWorkflowTabs .tracker-tab").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.workflowId === activeId);
    });
  },

  populateWorkflowSelectors() {
    const profiles = this.getWorkflowProfiles();
    const options = profiles.map(p => ({ id: p.id, name: p.name }));
    const active = this.getActiveWorkflowId();
    const boardSelect = document.getElementById("activeWorkflow");
    const formSelect = document.getElementById("quotationWorkflow");
    if (boardSelect) {
      boardSelect.innerHTML = options.map(x => `<option value="${Utils.escapeHtml(x.id)}">${Utils.escapeHtml(x.name)}</option>`).join("");
      boardSelect.value = active;
    }
    if (formSelect) {
      formSelect.innerHTML = options.map(x => `<option value="${Utils.escapeHtml(x.id)}">${Utils.escapeHtml(x.name)}</option>`).join("");
      formSelect.value = active;
    }
    this.renderWorkflowTabs("activeWorkflowTabs", options, active);
    this.renderWorkflowTabs("quotationWorkflowTabs", options, active);
  },

  ensureWorkflowAssignments() {
    const defaultWorkflow = this.getActiveWorkflowId();
    let changed = false;
    (AppState.quotations || []).forEach(q => {
      if (!String(q.workflowId || "").trim()) {
        q.workflowId = defaultWorkflow;
        changed = true;
      } else {
        const normalized = this.normalizeWorkflowId(q.workflowId);
        if (normalized !== q.workflowId) {
          q.workflowId = normalized;
          changed = true;
        }
      }
    });
    (AppState.archivedQuotations || []).forEach(q => {
      if (!String(q.workflowId || "").trim()) {
        q.workflowId = defaultWorkflow;
        changed = true;
      } else {
        const normalized = this.normalizeWorkflowId(q.workflowId);
        if (normalized !== q.workflowId) {
          q.workflowId = normalized;
          changed = true;
        }
      }
    });
    if (changed) {
      this.saveWorkflowLocalData("quotations", AppState.quotations);
      this.saveWorkflowLocalData("archived", AppState.archivedQuotations);
    }
  },

  renderActiveFilterChips() {
    const chipsWrap = document.getElementById("activeFilterChips");
    if (!chipsWrap) return;
    const chips = [];
    if (AppState.filters.search) chips.push({ key: "search", label: `Search: ${AppState.filters.search}` });
    if (AppState.filters.status) chips.push({ key: "status", label: `Status: ${AppState.filters.status}` });
    const labels = this.getTagLabels();
    if (AppState.filters.origin) chips.push({ key: "origin", label: `${labels.tag}: ${AppState.filters.origin}` });
    if (AppState.filters.customer) chips.push({ key: "customer", label: `Customer: ${AppState.filters.customer}` });
    if (!chips.length) {
      chipsWrap.classList.add("hidden");
      chipsWrap.innerHTML = "";
      return;
    }
    chipsWrap.classList.remove("hidden");
    chipsWrap.innerHTML = chips.map(chip => `
      <button type="button" class="active-filter-chip" data-chip-key="${Utils.escapeHtml(chip.key)}" title="Click to remove filter">
        ${Utils.escapeHtml(chip.label)}
      </button>
    `).join("");
    chipsWrap.querySelectorAll(".active-filter-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = String(btn.dataset.chipKey || "").trim();
        if (!key) return;
        if (key === "search") {
          AppState.filters.search = "";
          const searchEl = document.getElementById("filterSearch");
          if (searchEl) searchEl.value = "";
        } else if (key === "status") {
          AppState.filters.status = "";
          const statusEl = document.getElementById("filterStatus");
          if (statusEl) statusEl.value = "";
        } else if (key === "origin") {
          AppState.filters.origin = "";
          const originEl = document.getElementById("filterOrigin");
          if (originEl) originEl.value = "";
        } else if (key === "customer") {
          AppState.filters.customer = "";
          const customerEl = document.getElementById("filterCustomer");
          if (customerEl) customerEl.value = "";
        }
        this.setListPage(1);
        this.clearSelectedListIds();
        this.renderActiveFilterChips();
        Kanban.render();
        Dashboard.render();
      });
    });
  },

  applyRolePermissions() {
    const role = String(AppState.session?.role || "user").toLowerCase();
    const matrix = APP_CONFIG.defaults.rolePermissions || {};
    const effective = matrix[role] || matrix.user || { pages: ["board", "dashboard"], actions: [] };
    const pages = new Set(effective.pages || []);
    const actions = new Set(effective.actions || []);
    const trackerPages = AppState.settings?.pages || {};
    const show = (id, ok) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle("hidden", !ok);
    };
    show("btnCustomers", pages.has("customers") && trackerPages.customers !== false);
    show("btnArchived", pages.has("archived") && trackerPages.archived !== false);
    show("btnSettings", pages.has("settings"));
    show("btnImport", actions.has("import"));
    show("btnExport", actions.has("export"));
  },

  buildSyncPayload() {
    const payload = {
      quotations: Array.isArray(AppState.quotations) ? AppState.quotations : [],
      archived: Array.isArray(AppState.archivedQuotations) ? AppState.archivedQuotations : [],
      contacts: Array.isArray(AppState.contacts) ? AppState.contacts : [],
      customers: Array.isArray(AppState.customers) ? AppState.customers : [],
      settings: AppState.settings && typeof AppState.settings === "object" ? AppState.settings : {},
      audit: AuditTrail.getAll(),
      approvals: ApprovalWorkflow.getApprovals()
    };
    const lastChangeAt = LocalStorageAdapter.getLastChangedAt() || this.deriveLatestChangedAt(payload);
    payload.meta = {
      schemaVersion: APP_CONFIG.schemaVersion,
      lastChangeAt,
      backedUpAt: new Date().toISOString(),
      source: "browser-local"
    };
    return payload;
  },

  computeSyncHash(payload) {
    const normalized = {
      quotations: payload?.quotations || [],
      archived: payload?.archived || [],
      contacts: payload?.contacts || [],
      customers: payload?.customers || [],
      settings: payload?.settings || {}
    };
    return Utils.simpleHash(Utils.stableStringify(normalized));
  },

  enqueueCloudBackup() {
    if (!(GitHubStorageAdapter.isEnabled() || GitHubStorageAdapter.isApiMode())) return;
    localStorage.setItem("qt.cloudBackupPendingAt", new Date().toISOString());
    AppState.syncQueue.pending = true;
    this.setSyncStatus("pending", "Cloud backup pending...");
  },

  async processSyncQueue() {
    if (!(GitHubStorageAdapter.isEnabled() || GitHubStorageAdapter.isApiMode())) return { ok: true, skipped: "disabled", failures: [] };
    const pendingAt = localStorage.getItem("qt.cloudBackupPendingAt");
    if (!pendingAt) return { ok: true, skipped: "no-pending", failures: [] };
    if (AppState.syncQueue.inProgress) return { ok: true, skipped: "in-progress", failures: [] };
    AppState.syncQueue.inProgress = true;
    AppState.syncQueue.lastAttemptAt = new Date().toISOString();
    this.setSyncStatus("pending", "Cloud backup pending...");
    const payload = this.buildSyncPayload();
    const tasks = [
      ["quotations", () => GitHubStorageAdapter.syncQuotations(payload.quotations, AppState.settings?.workflowProfiles || [], AppState.settings?.activeWorkflowId || this.getActiveWorkflowId())],
      ["archived", () => GitHubStorageAdapter.syncArchived(payload.archived, AppState.settings?.workflowProfiles || [], AppState.settings?.activeWorkflowId || this.getActiveWorkflowId())],
      ["contacts", () => GitHubStorageAdapter.syncContacts(payload.contacts, AppState.settings?.workflowProfiles || [], AppState.settings?.activeWorkflowId || this.getActiveWorkflowId())],
      ["customers", () => GitHubStorageAdapter.syncCustomers(payload.customers, AppState.settings?.workflowProfiles || [], AppState.settings?.activeWorkflowId || this.getActiveWorkflowId())],
      ["settings", () => GitHubStorageAdapter.syncSettings(payload.settings)],
      ["audit", () => GitHubStorageAdapter.syncAudit(payload.audit)],
      ["approvals", () => GitHubStorageAdapter.syncApprovals(payload.approvals)],
      ["sync metadata", () => GitHubStorageAdapter.syncMeta(payload.meta)]
    ];
    const failures = [];
    for (const [name, run] of tasks) {
      try {
        await run();
      } catch (error) {
        failures.push({ name, error });
      }
    }
    if (failures.length === 0) {
      const latestPendingAt = localStorage.getItem("qt.cloudBackupPendingAt");
      if (latestPendingAt === pendingAt) {
        localStorage.removeItem("qt.cloudBackupPendingAt");
        this.setSyncStatus("idle", "Saved locally + cloud backup");
      } else {
        this.setSyncStatus("pending", "Cloud backup pending...");
      }
      localStorage.setItem("qt.lastCloudHash", this.computeSyncHash(payload));
      AppState.syncQueue.inProgress = false;
      if (localStorage.getItem("qt.cloudBackupPendingAt")) setTimeout(() => this.processSyncQueue(), 50);
      return { ok: true, failures: [] };
    }
    console.error("Cloud sync failed:", failures);
    const firstMessage = failures[0]?.error?.message || "Cloud sync failed";
    this.setSyncStatus("error", `Cloud sync failed (retrying): ${firstMessage}`);
    AppState.syncQueue.inProgress = false;
    return { ok: false, failures };
  },

  startSyncQueueWorker() {
    if (this._syncQueueTimer) clearInterval(this._syncQueueTimer);
    this._syncQueueTimer = setInterval(() => {
      this.processSyncQueue();
    }, 30000);
    this.processSyncQueue();
  },

  createDataSnapshot() {
    return {
      quotations: JSON.parse(JSON.stringify(AppState.quotations || [])),
      archivedQuotations: JSON.parse(JSON.stringify(AppState.archivedQuotations || [])),
      contacts: JSON.parse(JSON.stringify(AppState.contacts || [])),
      customers: JSON.parse(JSON.stringify(AppState.customers || []))
    };
  },

  restoreDataSnapshot(snapshot) {
    if (!snapshot) return;
    AppState.quotations = Array.isArray(snapshot.quotations) ? snapshot.quotations : [];
    AppState.archivedQuotations = Array.isArray(snapshot.archivedQuotations) ? snapshot.archivedQuotations : [];
    AppState.contacts = Array.isArray(snapshot.contacts) ? snapshot.contacts : [];
    AppState.customers = Array.isArray(snapshot.customers) ? snapshot.customers : [];
    this.saveWorkflowLocalData("quotations", AppState.quotations);
    this.saveWorkflowLocalData("archived", AppState.archivedQuotations);
    this.saveWorkflowLocalData("contacts", AppState.contacts);
    this.saveWorkflowLocalData("customers", AppState.customers);
  },

  startRelativeTimeTicker() {
    if (this._relativeTicker) clearInterval(this._relativeTicker);
    this._relativeTicker = setInterval(() => {
      if (document.body.classList.contains("is-dragging-card")) return;
      if (document.getElementById("viewBoard") && !document.getElementById("viewBoard").classList.contains("hidden")) {
        Kanban.render();
      }
      if (document.getElementById("viewDashboard") && !document.getElementById("viewDashboard").classList.contains("hidden")) {
        Dashboard.render();
      }
    }, 60 * 1000);
  },

  getStatusGroups() {
    const activeProfile = this.getActiveWorkflowProfile();
    const configured = Array.isArray(activeProfile?.statusGroups) && activeProfile.statusGroups.length
      ? activeProfile.statusGroups
      : AppState.settings?.statusGroups;
    const defaults = APP_CONFIG.defaults.statusGroups || [];
    const fallbackStatuses = AppState.settings?.statuses || APP_CONFIG.defaults.statuses || [];
    const source = Array.isArray(configured) && configured.length
      ? configured
      : (defaults.length
        ? defaults
        : fallbackStatuses.map(status => ({ name: status, substatuses: [status] })));

    return source
      .map(group => {
        const name = String(group?.name || "").trim();
        const rawSub = Array.isArray(group?.substatuses) ? group.substatuses : [];
        const substatuses = [...new Set(rawSub.map(s => String(s || "").trim()).filter(Boolean))];
        if (!name) return null;
        const isCompletion = typeof group?.isCompletion === "boolean"
          ? group.isCompletion
          : name.toUpperCase() !== "WIP";
        const showOnBoard = typeof group?.showOnBoard === "boolean" ? group.showOnBoard : true;
        const columnView = ["default", "main", "sub"].includes(group?.columnView) ? group.columnView : "default";
        const color = /^#[0-9a-fA-F]{6}$/.test(String(group?.color || "").trim()) ? String(group.color).trim() : "#2563eb";
        const rawSubstatusColors = group?.substatusColors && typeof group.substatusColors === "object"
          ? group.substatusColors
          : {};
        const substatusColors = {};
        substatuses.forEach(status => {
          const rawColor = rawSubstatusColors[status];
          substatusColors[status] = /^#[0-9a-fA-F]{6}$/.test(String(rawColor || "").trim())
            ? String(rawColor).trim()
            : color;
        });
        return { name, substatuses: substatuses.length ? substatuses : [name], isCompletion, showOnBoard, columnView, color, substatusColors };
      })
      .filter(Boolean);
  },

  getAllStatuses() {
    const list = [...new Set(this.getStatusGroups().flatMap(group => group.substatuses))];
    return list.length ? list : (APP_CONFIG.defaults.statuses || ["WIP"]);
  },

  getGroupForStatus(status) {
    const s = String(status || "");
    return this.getStatusGroups().find(group => group.substatuses.includes(s) || group.name === s) || null;
  },

  getDefaultStatusForGroup(groupName) {
    const group = this.getStatusGroups().find(g => g.name === groupName);
    if (!group) return groupName || "WIP";
    return group.substatuses[0] || group.name;
  },

  getCompletionStatuses() {
    const completion = this.getStatusGroups()
      .filter(group => group.isCompletion)
      .flatMap(group => group.substatuses);
    return [...new Set(completion)];
  },

  getKanbanViewMode() {
    return AppState.settings?.kanbanColumnMode === "sub" ? "sub" : "main";
  },

  getBoardLayoutMode() {
    const stored = localStorage.getItem("qt.kanbanLayoutMode");
    if (stored === "list" || stored === "kanban") {
      AppState.kanban.layoutMode = stored;
      return stored;
    }
    const fallback = AppState.kanban?.layoutMode === "list" ? "list" : "kanban";
    localStorage.setItem("qt.kanbanLayoutMode", fallback);
    return fallback;
  },

  setBoardLayoutMode(mode) {
    AppState.kanban.layoutMode = mode === "list" ? "list" : "kanban";
    localStorage.setItem("qt.kanbanLayoutMode", AppState.kanban.layoutMode);
    AppState.kanban.listPage = 1;
    this.clearSelectedListIds();
    this.refreshBoardLayoutSwitch();
    Kanban.render();
  },

  getListPageSize() {
    const size = Number(AppState.kanban?.listPageSize || 12);
    return Number.isFinite(size) && size > 0 ? size : 12;
  },

  getListPage() {
    const page = Number(AppState.kanban?.listPage || 1);
    return Number.isFinite(page) && page > 0 ? page : 1;
  },

  setListPage(page) {
    const next = Number(page);
    AppState.kanban.listPage = Number.isFinite(next) && next > 0 ? next : 1;
  },

  getSelectedListIds() {
    return Array.isArray(AppState.kanban?.selectedIds) ? AppState.kanban.selectedIds : [];
  },

  setSelectedListIds(ids) {
    AppState.kanban.selectedIds = [...new Set((Array.isArray(ids) ? ids : []).map(v => String(v || "").trim()).filter(Boolean))];
  },

  clearSelectedListIds() {
    AppState.kanban.selectedIds = [];
  },

  async bulkUpdateStatus(ids, newStatus) {
    if (!this.canManuallyMoveStatus()) {
      Toast.show("Only admins can bulk update status.", "warning");
      return;
    }
    const idSet = new Set((ids || []).map(v => String(v || "").trim()));
    if (!idSet.size || !newStatus) return;
    let changed = 0;
    (AppState.quotations || []).forEach(q => {
      if (!idSet.has(String(q.id || "").trim())) return;
      if (q.status === newStatus) return;
      const prev = q.status;
      q.status = newStatus;
      changed += 1;
      AuditTrail.add({
        reference: q.reference,
        action: "Bulk Status Changed",
        by: AppState.session.name,
        role: AppState.session.role,
        remarks: `${prev} -> ${newStatus}`
      });
    });
    if (!changed) {
      Toast.show("No selected rows needed status change.", "info");
      return;
    }
    await this.persistAll();
    this.clearSelectedListIds();
    Kanban.render();
    Dashboard.render();
    Toast.show(`Updated ${changed} quotations.`, "success");
  },

  async bulkArchive(ids) {
    if (!this.canArchive()) {
      Toast.show("Only admins can bulk archive.", "warning");
      return;
    }
    const idSet = new Set((ids || []).map(v => String(v || "").trim()));
    if (!idSet.size) return;
    const keep = [];
    let moved = 0;
    (AppState.quotations || []).forEach(q => {
      if (!idSet.has(String(q.id || "").trim())) {
        keep.push(q);
        return;
      }
      AppState.archivedQuotations.push(q);
      moved += 1;
      AuditTrail.add({
        reference: q.reference,
        action: "Bulk Archived",
        by: AppState.session.name,
        role: AppState.session.role,
        remarks: "Archived from list bulk action"
      });
    });
    if (!moved) {
      Toast.show("No matching rows selected.", "info");
      return;
    }
    AppState.quotations = keep;
    await this.persistAll();
    this.clearSelectedListIds();
    Kanban.render();
    Dashboard.render();
    Toast.show(`Archived ${moved} quotations.`, "success");
  },

  async bulkDelete(ids) {
    if (!this.canDelete()) {
      Toast.show("Only admins can bulk delete.", "warning");
      return;
    }
    const idSet = new Set((ids || []).map(v => String(v || "").trim()));
    if (!idSet.size) return;
    const keep = [];
    let deleted = 0;
    (AppState.quotations || []).forEach(q => {
      if (!idSet.has(String(q.id || "").trim())) {
        keep.push(q);
        return;
      }
      deleted += 1;
      AuditTrail.add({
        reference: q.reference,
        action: "Bulk Deleted",
        by: AppState.session.name,
        role: AppState.session.role,
        remarks: "Deleted from list bulk action"
      });
    });
    if (!deleted) {
      Toast.show("No matching rows selected.", "info");
      return;
    }
    AppState.quotations = keep;
    await this.persistAll();
    this.clearSelectedListIds();
    Kanban.render();
    Dashboard.render();
    Toast.show(`Deleted ${deleted} quotations.`, "success");
  },

  refreshBoardLayoutSwitch() {
    const isList = this.getBoardLayoutMode() === "list";
    const btnKanban = document.getElementById("btnBoardKanban");
    const btnList = document.getElementById("btnBoardList");
    const boardTitle = document.getElementById("boardTitle");
    const workspace = document.querySelector(".kanban-workspace");
    if (!btnKanban || !btnList) return;
    btnKanban.classList.toggle("is-active", !isList);
    btnList.classList.toggle("is-active", isList);
    if (boardTitle) boardTitle.textContent = isList ? "List View" : "Kanban Board";
    if (workspace) workspace.classList.toggle("list-mode", isList);
  },

  showCompletedInKanban() {
    return false;
  },

  isAdmin() {
    return AppState.session?.role === "admin";
  },

  canManuallyMoveStatus() {
    return this.isAdmin();
  },

  canArchive() {
    return this.isAdmin();
  },

  canDelete() {
    return this.isAdmin();
  },

  setSelectOptions(selectEl, options, placeholder = "") {
    const safeOptions = Array.isArray(options) ? options : [];
    selectEl.innerHTML = "";

    if (placeholder) {
      const placeholderOption = document.createElement("option");
      placeholderOption.value = "";
      placeholderOption.textContent = placeholder;
      selectEl.appendChild(placeholderOption);
    }

    safeOptions.forEach(optionValue => {
      const option = document.createElement("option");
      option.value = String(optionValue);
      option.textContent = String(optionValue);
      selectEl.appendChild(option);
    });
  },

  refreshContactSaveButton() {
    const btn = document.getElementById("btnSaveContact");
    if (!btn) return;
    const isUpdate = Boolean(AppState.selectedContactId);
    btn.textContent = isUpdate ? "Update Contact" : "Add Contact";
    btn.classList.toggle("btn-warning", isUpdate);
    btn.classList.toggle("btn-success", !isUpdate);
  },

  getFormLayoutDefaults() {
    const defaults = APP_CONFIG.defaults.formLayout || [];
    if (defaults.length) return defaults.map(item => ({ ...item }));
    const form = document.getElementById("quotationForm");
    if (!form) return [];
    return [...form.querySelectorAll("[data-form-field]")].map((el, index) => ({
      key: el.dataset.formField,
      visible: true,
      width: el.classList.contains("full-row") ? "full" : "half",
      order: index + 1
    }));
  },

  normalizeFormLayout(layoutInput) {
    return LayoutEngine.normalize("quotation", layoutInput);
  },

  ensureLayoutCoordinates(layout) {
    const prepared = Array.isArray(layout) ? layout.map(item => ({ ...item })) : [];
    let row = 1;
    let nextCol = 1;
    prepared.forEach(item => {
      const defaultSpan = item.width === "full" ? 12 : 6;
      const colSpan = Math.min(12, Math.max(1, Number(item.colSpan) || defaultSpan));
      const rowSpan = Math.min(4, Math.max(1, Number(item.rowSpan) || 1));
      let col = Math.min(12, Math.max(1, Number(item.col) || 0));
      let r = Math.max(1, Number(item.row) || 0);

      if (!Number(item.col) || !Number(item.row)) {
        if (item.width === "full") {
          col = 1;
          r = row;
          row += rowSpan;
          nextCol = 1;
        } else if (nextCol === 1) {
          col = 1;
          r = row;
          nextCol = 7;
        } else {
          col = 7;
          r = row;
          row += rowSpan;
          nextCol = 1;
        }
      }

      if (col + colSpan - 1 > 12) col = Math.max(1, 13 - colSpan);
      item.col = col;
      item.row = r;
      item.colSpan = colSpan;
      item.rowSpan = rowSpan;
    });
    return prepared;
  },

  applyQuotationFormLayout() {
    const form = document.getElementById("quotationForm");
    if (!form) return;
    const latest = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, AppState.settings || {});
    if (latest && typeof latest === "object") {
      AppState.settings = { ...AppState.settings, ...latest };
    }
    const normalized = this.normalizeFormLayout(AppState.settings?.formLayout);
    LayoutEngine.applyToContainer(form, normalized);
    const canvas = AppState.settings?.formLayoutCanvas || APP_CONFIG.defaults.formLayoutCanvas || {};
    const canvasWidth = Math.max(520, Number(canvas.width) || 1200);
    const canvasHeight = Math.max(300, Number(canvas.height) || 720);
    const metrics = LayoutEngine.getCanvasMetrics(canvasWidth, {
      fixedColSize: Number(canvas.colSize) || undefined
    });
    const colSize = metrics.colSize;
    const colGap = metrics.colGap;
    const appliedWidth = metrics.width;
    form.style.setProperty("--form-cols", "24");
    form.style.setProperty("--form-col-size", `${colSize}px`);
    form.style.setProperty("--form-gap", `${colGap}px`);
    form.style.setProperty("--form-canvas-width", `${appliedWidth}px`);
    form.style.setProperty("--form-canvas-height", `${canvasHeight}px`);
    const modalCard = document.querySelector("#quotationModal .modal-card-wide");
    if (modalCard) {
      const targetWidth = Math.max(760, appliedWidth + 80);
      modalCard.style.width = `min(98vw, ${targetWidth}px)`;
    }
  },

  openQuotationModal(createNew = false) {
    const latestSettings = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, AppState.settings || {});
    if (latestSettings && typeof latestSettings === "object") {
      AppState.settings = { ...AppState.settings, ...latestSettings };
    }
    this.applyQuotationFormLayout();
    this.closeQuickEditDrawer();
    if (createNew) {
      AppState.selectedContactId = null;
      QuotationForm.clearForm();
    }
    this.refreshContactSaveButton();
    this.closeLookupLists(null, true);
    document.getElementById("quotationModal").classList.remove("hidden");
  },

  closeQuotationModal() {
    document.getElementById("quotationModal").classList.add("hidden");
    AppState.selectedContactId = null;
    this.refreshContactSaveButton();
    this.closeLookupLists(null, true);
  },

  async persistAll() {
    this.setSyncStatus("saving", "Saving locally...");
    this.saveWorkflowLocalData("quotations", AppState.quotations);
    this.saveWorkflowLocalData("archived", AppState.archivedQuotations);
    this.saveWorkflowLocalData("contacts", AppState.contacts);
    this.saveWorkflowLocalData("customers", AppState.customers);
    LocalStorageAdapter.save(APP_CONFIG.localKeys.settings, AppState.settings);
    this.setSyncStatus("idle", "Saved locally");
    this.enqueueCloudBackup();
    await this.processSyncQueue();
  },

  async backupToCloud() {
    if (!(GitHubStorageAdapter.isEnabled() || GitHubStorageAdapter.isApiMode())) return { ok: true, failures: [] };
    this.enqueueCloudBackup();
    const result = await this.processSyncQueue();
    if (!result?.ok) {
      const firstError = result?.failures?.[0]?.error?.message || "Manual cloud sync failed";
      throw new Error(firstError);
    }
  },

  bindEvents() {
    window.addEventListener("storage", e => {
      if (e.key !== APP_CONFIG.localKeys.settings) return;
      const latest = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, AppState.settings || {});
      if (!latest || typeof latest !== "object") return;
      AppState.settings = { ...AppState.settings, ...latest };
      AppState.settings.workflowProfiles = this.getWorkflowProfilesFromSettings(AppState.settings);
      this.applyQuotationFormLayout();
      this.applyTagLabelsToUI();
      this.populateFilterControls();
      this.renderActiveFilterChips();
      Kanban.render();
      Dashboard.render();
    });

    document.getElementById("btnLogout").addEventListener("click", () => {
      localStorage.removeItem("qt.session");
      window.location.href = "index.html";
    });

    document.getElementById("btnSettings").addEventListener("click", () => {
      if (!this.isAdmin()) {
        Toast.show("Settings is for admin only.", "warning");
        return;
      }
      window.location.href = "settings.html";
    });
    document.getElementById("btnCustomers").addEventListener("click", () => window.location.href = "customers.html");
    document.getElementById("btnArchived").addEventListener("click", () => window.location.href = "archived.html");

    document.getElementById("btnImport").addEventListener("click", () => document.getElementById("csvImportFile").click());
    document.getElementById("btnSyncNow")?.addEventListener("click", async () => {
      if (!(GitHubStorageAdapter.isEnabled() || GitHubStorageAdapter.isApiMode())) {
        Toast.show("Cloud sync is disabled. Enable GitHub/API mode in Settings.", "warning", 3200);
        return;
      }
      this.setSyncStatus("pending", "Manual sync in progress...");
      try {
        await this.backupToCloud();
        Toast.show("Manual cloud sync completed.", "success", 2200);
      } catch (error) {
        console.error(error);
        Toast.show("Manual cloud sync failed.", "error", 3200);
      }
    });

    document.getElementById("csvImportFile").addEventListener("change", async e => {
      const file = e.target.files[0];
      if (!file) return;
      await this.importCSV(file);
      e.target.value = "";
    });

    document.getElementById("btnNewQuotation").addEventListener("click", () => this.openQuotationModal(true));
    document.getElementById("tabBoard").addEventListener("click", () => { this.showView("board"); Kanban.render(); });
    document.getElementById("tabDashboard").addEventListener("click", () => { this.showView("dashboard"); Dashboard.render(); });
    document.getElementById("kanbanDensity")?.addEventListener("change", async e => {
      const density = e.target.value === "comfortable" ? "comfortable" : "compact";
      AppState.ui.density = density;
      AppState.settings.ui = AppState.settings.ui || {};
      AppState.settings.ui.kanbanDensity = density;
      this.applyDensityMode();
      await this.persistAll();
      Kanban.render();
    });
    document.getElementById("btnBoardKanban")?.addEventListener("click", () => this.setBoardLayoutMode("kanban"));
    document.getElementById("btnBoardList")?.addEventListener("click", () => this.setBoardLayoutMode("list"));
    this.refreshBoardLayoutSwitch();
    document.getElementById("btnCloseQuotationModal").addEventListener("click", () => this.closeQuotationModal());
    document.getElementById("quotationModal").addEventListener("click", e => {
      if (e.target.id === "quotationModal") this.closeQuotationModal();
    });
    document.getElementById("btnCloseQuickDrawer").addEventListener("click", () => this.closeQuickEditDrawer());
    document.getElementById("btnSaveQuickDrawer").addEventListener("click", async () => await this.saveQuickEditDrawer());
    document.getElementById("importReviewModal").addEventListener("click", e => {
      if (e.target.id === "importReviewModal") document.getElementById("btnCancelImportReview").click();
    });

    document.getElementById("btnAddItemRow").addEventListener("click", () => QuotationForm.addItemRow());
    document.getElementById("btnClear").addEventListener("click", () => {
      AppState.selectedContactId = null;
      QuotationForm.clearForm();
      this.refreshContactSaveButton();
      this.closeLookupLists(null, true);
    });

    document.getElementById("btnPrint").addEventListener("click", () => {
      const reference = document.getElementById("reference").value.trim();
      if (!reference) return;
      window.open(`print.html?reference=${encodeURIComponent(reference)}`, "_blank");
    });

    document.getElementById("origin").addEventListener("change", () => this.populateSales());
    document.getElementById("activeWorkflow")?.addEventListener("change", e => {
      this.setActiveWorkflow(e.target.value);
    });
    document.getElementById("quotationWorkflow")?.addEventListener("change", e => {
      this.setActiveWorkflow(e.target.value);
    });

    document.getElementById("customerCode").addEventListener("input", e => {
      const matches = this.searchScopedCustomersByCode(e.target.value);
      this.closeLookupLists("customerCodeMatches");
      this.renderCustomerMatches("customerCodeMatches", matches);
      AppState.selectedContactId = null;
      this.refreshContactSaveButton();
      this.populateSales();
    });
    document.getElementById("customerCode").addEventListener("focus", () => this.closeLookupLists("customerCodeMatches"));

    document.getElementById("customerName").addEventListener("input", e => {
      const matches = this.searchScopedCustomersByName(e.target.value);
      this.closeLookupLists("customerNameMatches");
      this.renderCustomerMatches("customerNameMatches", matches);
      AppState.selectedContactId = null;
      this.refreshContactSaveButton();
      this.populateSales();
    });
    document.getElementById("customerName").addEventListener("focus", () => this.closeLookupLists("customerNameMatches"));

    document.getElementById("contactName").addEventListener("input", e => {
      const customerCode = this.resolveCurrentCustomerCode();
      const matches = this.findContactMatches(customerCode, e.target.value);
      this.closeLookupLists("contactMatches");
      this.renderContactMatches(matches);
    });
    document.getElementById("contactName").addEventListener("focus", e => {
      const customerCode = this.resolveCurrentCustomerCode();
      const matches = this.findContactMatches(customerCode, e.target.value || "");
      this.closeLookupLists("contactMatches");
      this.renderContactMatches(matches);
    });

    document.addEventListener("mousedown", e => {
      if (e.target.closest("#customerCodeMatches, #customerNameMatches, #contactMatches")) return;
      if (e.target.closest("#customerCode, #customerName, #contactName")) return;
      this.closeLookupLists();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        this.closeLookupLists();
        this.closeQuickEditDrawer();
        ["quotationModal", "auditModal", "approvalModal", "completeModal", "importReviewModal"].forEach(id => {
          const modal = document.getElementById(id);
          if (modal && !modal.classList.contains("hidden")) modal.classList.add("hidden");
        });
      }
    });

    document.getElementById("quotationForm").addEventListener("submit", async e => {
      e.preventDefault();

      const formData = QuotationForm.collectFormData();
      formData.workflowId = this.normalizeWorkflowId(formData.workflowId || this.getActiveWorkflowId());
      if (formData.workflowId !== this.getActiveWorkflowId()) {
        this.setActiveWorkflow(formData.workflowId);
      }
      const errors = QuotationValidation.validate(formData);
      if (errors.length) {
        Toast.show(errors.join(" "), "error", 4500);
        return;
      }

      const existingIndex = AppState.quotations.findIndex(q => q.id === formData.id);

      if (existingIndex >= 0) {
        const oldRecord = AppState.quotations[existingIndex];
        AppState.quotations[existingIndex] = { ...oldRecord, ...formData };
        AuditTrail.add({
          reference: formData.reference,
          action: "Quotation Updated",
          by: AppState.session.name,
          role: AppState.session.role,
          remarks: formData.remarks || "Updated quotation"
        });
      } else {
        formData.createdAt = new Date().toISOString();
        AppState.quotations.push(formData);
        AuditTrail.add({
          reference: formData.reference,
          action: "Quotation Created",
          by: AppState.session.name,
          role: AppState.session.role,
          remarks: formData.remarks || "Initial save"
        });
      }

      await this.persistAll();
      Toast.show(`Quotation ${formData.reference} saved successfully.`, "success");
      QuotationForm.clearForm();
      this.closeQuotationModal();
      Kanban.render();
      Dashboard.render();
    });

    document.getElementById("btnSaveContact").addEventListener("click", async () => {
      const customerCode = document.getElementById("customerCode").value.trim();
      const name = document.getElementById("contactName").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const email = document.getElementById("email").value.trim();

      if (!customerCode || !name) {
        Toast.show("Customer code and contact name are required.", "warning");
        return;
      }

      const selected = AppState.selectedContactId
        ? ContactManager.getAll().find(c => c.id === AppState.selectedContactId)
        : null;

      if (selected && String(selected.customerCode || "").trim() !== customerCode) {
        AppState.selectedContactId = null;
        this.refreshContactSaveButton();
        Toast.show("Selected contact belongs to another customer. A new contact will be added for current customer.", "warning", 4500);
      }

      if (AppState.selectedContactId) {
        ContactManager.update(AppState.selectedContactId, { customerCode, name, phone, email });
        AppState.contacts = ContactManager.getAll({ allWorkflows: true });
        AuditTrail.add({
          reference: document.getElementById("reference").value.trim() || "",
          action: "Contact Updated",
          by: AppState.session.name,
          role: AppState.session.role,
          remarks: `${name} for ${customerCode}`
        });
        await this.persistAll();
        Toast.show("Contact updated.", "success");
        this.refreshContactSaveButton();
        return;
      }

      const duplicate = ContactManager.getAll().find(c =>
        String(c.customerCode || "").trim() === customerCode &&
        String(c.name || "").trim().toLowerCase() === name.toLowerCase()
      );

      if (duplicate) {
        ContactManager.update(duplicate.id, { customerCode, name, phone, email });
        AppState.contacts = ContactManager.getAll({ allWorkflows: true });
        AppState.selectedContactId = duplicate.id;
        AuditTrail.add({
          reference: document.getElementById("reference").value.trim() || "",
          action: "Contact Updated",
          by: AppState.session.name,
          role: AppState.session.role,
          remarks: `${name} for ${customerCode}`
        });
        await this.persistAll();
        Toast.show("Existing contact updated for this customer.", "success");
        this.refreshContactSaveButton();
        return;
      }

      const created = ContactManager.add({ customerCode, name, phone, email });
      AppState.contacts = ContactManager.getAll({ allWorkflows: true });
      AppState.selectedContactId = created.id;

      AuditTrail.add({
        reference: document.getElementById("reference").value.trim() || "",
        action: "Contact Added",
        by: AppState.session.name,
        role: AppState.session.role,
        remarks: `${name} for ${customerCode}`
      });

      await this.persistAll();
      Toast.show("Contact added.", "success");
      this.refreshContactSaveButton();
    });

    document.getElementById("btnExport").addEventListener("click", () => this.exportCSV());
    document.getElementById("btnCloseAudit").addEventListener("click", () => document.getElementById("auditModal").classList.add("hidden"));
    document.getElementById("btnCloseApproval").addEventListener("click", () => document.getElementById("approvalModal").classList.add("hidden"));
    document.getElementById("btnConfirmApproval").addEventListener("click", async () => await this.confirmApprovalAction());
    document.getElementById("btnCloseCompleteModal").addEventListener("click", () => document.getElementById("completeModal").classList.add("hidden"));
    document.getElementById("btnConfirmComplete").addEventListener("click", async () => await this.confirmCompleteAction());
    document.getElementById("completeModal").addEventListener("click", e => {
      if (e.target.id === "completeModal") document.getElementById("completeModal").classList.add("hidden");
    });
    const debouncedFilterSearch = Utils.debounce(() => {
      this.setListPage(1);
      this.clearSelectedListIds();
      this.renderActiveFilterChips();
      Kanban.render();
      Dashboard.render();
    }, 180);
    const debouncedFilterCustomer = Utils.debounce(() => {
      this.setListPage(1);
      this.clearSelectedListIds();
      this.renderActiveFilterChips();
      Kanban.render();
      Dashboard.render();
    }, 180);
    const searchInput = document.getElementById("filterSearch");
    searchInput?.addEventListener("input", e => {
      AppState.filters.search = e.target.value;
      debouncedFilterSearch();
    });
    document.getElementById("filterStatus").addEventListener("change", e => {
      AppState.filters.status = e.target.value;
      this.setListPage(1);
      this.clearSelectedListIds();
      this.renderActiveFilterChips();
      Kanban.render();
      Dashboard.render();
    });
    document.getElementById("filterOrigin").addEventListener("change", e => {
      AppState.filters.origin = e.target.value;
      this.setListPage(1);
      this.clearSelectedListIds();
      this.renderActiveFilterChips();
      Kanban.render();
      Dashboard.render();
    });
    document.getElementById("filterCustomer").addEventListener("input", e => {
      AppState.filters.customer = e.target.value;
      debouncedFilterCustomer();
    });
    document.getElementById("btnClearFilters").addEventListener("click", () => {
      AppState.filters = { search: "", status: "", origin: "", customer: "", workflow: this.getActiveWorkflowId() };
      this.setListPage(1);
      this.clearSelectedListIds();
      document.getElementById("filterSearch").value = "";
      document.getElementById("filterStatus").value = "";
      document.getElementById("filterOrigin").value = "";
      document.getElementById("filterCustomer").value = "";
      this.renderActiveFilterChips();
      Kanban.render();
      Dashboard.render();
    });
    this.renderActiveFilterChips();
  },

  resolveCurrentCustomerCode() {
    const scopedCustomers = this.getScopedCustomers();
    const inputCode = document.getElementById("customerCode").value.trim();
    if (inputCode) {
      const byCode = scopedCustomers.find(c => String(c.code || "").trim() === inputCode) || CustomerManager.getByCode(inputCode);
      if (byCode) return byCode.code;
      return inputCode;
    }

    const inputName = document.getElementById("customerName").value.trim().toLowerCase();
    if (!inputName) return "";
    const customer = scopedCustomers.find(c => {
      const name = String(c.name || "").trim().toLowerCase();
      const nameAr = String(c.nameAr || "").trim().toLowerCase();
      return name === inputName || nameAr === inputName;
    });
    if (customer) return customer.code;

    const partial = scopedCustomers.filter(c => {
      const name = String(c.name || "").trim().toLowerCase();
      const nameAr = String(c.nameAr || "").trim().toLowerCase();
      return name.includes(inputName) || nameAr.includes(inputName);
    });
    return partial.length === 1 ? partial[0].code : "";
  },

  closeLookupLists(exceptId = null, clearItems = false) {
    ["customerCodeMatches", "customerNameMatches", "contactMatches"].forEach(id => {
      if (exceptId && id === exceptId) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add("hidden");
      if (clearItems) el.innerHTML = "";
    });
  },

  findContactMatches(customerCode, query) {
    const q = String(query || "").toLowerCase().trim();
    const allRaw = ContactManager.getAll().map(c => ContactManager.normalizeContact(c));
    const scope = this.getRoleScope();
    const all = scope.isRestricted && scope.customers.length
      ? allRaw.filter(c => scope.customers.includes(String(c.customerCode || "").trim()))
      : allRaw;
    const hasCustomer = Boolean(String(customerCode || "").trim());
    const customerKey = hasCustomer ? ContactManager.normalizeCodeKey(customerCode) : "";

    let pool = all;
    if (hasCustomer) {
      pool = all.filter(c => ContactManager.normalizeCodeKey(c.customerCode) === customerKey);
    }

    const filtered = pool.filter(c => {
      if (!q) return true;
      return [c.name, c.phone, c.email].some(v => String(v || "").toLowerCase().includes(q));
    });

    if (filtered.length) return filtered.slice(0, 25);

    if (q && !hasCustomer) {
      return all
        .filter(c => [c.name, c.phone, c.email].some(v => String(v || "").toLowerCase().includes(q)))
        .slice(0, 25);
    }

    return [];
  },

  populateFilterControls() {
    const statuses = this.getAllStatuses();
    const scope = this.getRoleScope();
    const workflowOrigins = (this.getActiveTagGroup()?.tags || []).map(t => t.name);
    const configuredOrigins = workflowOrigins.length
      ? workflowOrigins
      : (AppState.settings.origins || APP_CONFIG.defaults.origins);
    const origins = scope.isRestricted
      ? configuredOrigins.filter(origin => scope.origins.includes(origin))
      : configuredOrigins;
    this.setSelectOptions(document.getElementById("filterStatus"), statuses, "All Statuses");
    this.setSelectOptions(document.getElementById("filterOrigin"), origins, `All ${this.getTagLabels().tag}`);
  },

  openApprovalModal(id, actionType) {
    document.getElementById("approvalQuoteId").value = id;
    document.getElementById("approvalActionType").value = actionType;
    document.getElementById("approvalNote").value = "";
    document.getElementById("approvalModal").classList.remove("hidden");
  },

  async confirmApprovalAction() {
    const id = document.getElementById("approvalQuoteId").value;
    const actionType = document.getElementById("approvalActionType").value;
    const note = document.getElementById("approvalNote").value.trim();

    if (!note) {
      Toast.show("Approval note is required.", "warning");
      return;
    }

    if (actionType === "reviewApprove") await this.reviewQuotation(id, true, note);
    if (actionType === "reviewReturn") await this.reviewQuotation(id, false, note);
    if (actionType === "finalApprove") await this.approveQuotation(id, true, note);
    if (actionType === "finalReturn") await this.approveQuotation(id, false, note);

    document.getElementById("approvalModal").classList.add("hidden");
  },

  openCompleteModal(id) {
    const completionStatuses = this.getCompletionStatuses();
    if (!completionStatuses.length) {
      Toast.show("No completion statuses configured in Settings.", "warning");
      return;
    }
    document.getElementById("completeQuoteId").value = id;
    this.setSelectOptions(document.getElementById("completeStatusSelect"), completionStatuses);
    document.getElementById("completeModal").classList.remove("hidden");
  },

  async confirmCompleteAction() {
    const id = document.getElementById("completeQuoteId").value;
    const status = document.getElementById("completeStatusSelect").value;
    if (!status) {
      Toast.show("Choose a completion status.", "warning");
      return;
    }
    await this.updateQuotationStatus(id, status);
    document.getElementById("completeModal").classList.add("hidden");
  },

  logStatusMove(q, fromStatus, toStatus, context = "Manual Move") {
    if (!q) return;
    const from = String(fromStatus || "").trim();
    const to = String(toStatus || "").trim();
    if (!to || from === to) return;
    AuditTrail.add({
      reference: q.reference,
      action: "Status Moved",
      by: AppState.session.name,
      role: AppState.session.role,
      remarks: `${context}: ${from || "(blank)"} -> ${to}`
    });
  },

  async updateQuotationStatus(id, newStatus) {
    if (!this.canManuallyMoveStatus()) {
      Toast.show("Only admins can move quotations between statuses directly.", "warning");
      return;
    }

    const q = AppState.quotations.find(x => x.id === id);
    if (!q || q.status === newStatus) return;

    const prevStatus = q.status;
    q.status = newStatus;

    AuditTrail.add({
      reference: q.reference,
      action: "Status Changed",
      by: AppState.session.name,
      role: AppState.session.role,
      remarks: `Moved to ${newStatus}`
    });
    this.logStatusMove(q, prevStatus, newStatus, "Board Move");

    await this.persistAll();
    Kanban.render();
    Dashboard.render();
  },

  async reviewQuotation(id, approve = true, note = "") {
    const q = AppState.quotations.find(x => x.id === id);
    if (!q || !ApprovalWorkflow.canReview(AppState.session, q)) return;

    const hasForApproval = this.getAllStatuses().includes("FOR APPROVAL");
    const prevStatus = q.status;
    q.status = approve
      ? (hasForApproval ? "FOR APPROVAL" : this.getDefaultStatusForGroup("WIP"))
      : this.getDefaultStatusForGroup("WIP");
    ApprovalWorkflow.record(q.reference, approve ? "Review Approved" : "Review Returned", AppState.session.name, AppState.session.role, note);
    AuditTrail.add({
      reference: q.reference,
      action: approve ? "Review Approved" : "Review Returned",
      by: AppState.session.name,
      role: AppState.session.role,
      remarks: note
    });
    this.logStatusMove(q, prevStatus, q.status, approve ? "Review Approve" : "Review Return");

    await this.persistAll();
    Toast.show(approve ? "Review approved." : "Returned to WIP.", "success");
    Kanban.render();
    Dashboard.render();
  },

  async approveQuotation(id, approve = true, note = "") {
    const q = AppState.quotations.find(x => x.id === id);
    if (!q || !ApprovalWorkflow.canApprove(AppState.session, q)) return;

    const hasStd = this.getAllStatuses().includes("STD");
    const hasUnderReview = this.getAllStatuses().includes("UNDER REVIEW");
    const fallbackWip = this.getDefaultStatusForGroup("WIP");
    const prevStatus = q.status;
    q.status = approve
      ? (hasStd ? "STD" : fallbackWip)
      : (hasUnderReview ? "UNDER REVIEW" : fallbackWip);
    ApprovalWorkflow.record(q.reference, approve ? "Final Approved" : "Approval Returned", AppState.session.name, AppState.session.role, note);
    AuditTrail.add({
      reference: q.reference,
      action: approve ? "Final Approved" : "Approval Returned",
      by: AppState.session.name,
      role: AppState.session.role,
      remarks: note
    });
    this.logStatusMove(q, prevStatus, q.status, approve ? "Final Approve" : "Approval Return");

    await this.persistAll();
    Toast.show(approve ? "Quotation approved." : "Returned to reviewer.", "success");
    Kanban.render();
    Dashboard.render();
  },

  async archiveQuotation(id) {
    if (!this.canArchive()) {
      Toast.show("Only admins can archive quotations.", "warning");
      return;
    }

    const index = AppState.quotations.findIndex(x => x.id === id);
    if (index < 0) return;

    const q = AppState.quotations[index];
    AppState.archivedQuotations.push(q);
    AppState.quotations.splice(index, 1);

    AuditTrail.add({
      reference: q.reference,
      action: "Quotation Archived",
      by: AppState.session.name,
      role: AppState.session.role,
      remarks: "Archived from active list"
    });

    await this.persistAll();
    Toast.show("Quotation archived.", "success");
    Kanban.render();
    Dashboard.render();
  },

  async deleteQuotation(id) {
    if (!this.canDelete()) {
      Toast.show("Only admins can delete quotations.", "warning");
      return;
    }

    const index = AppState.quotations.findIndex(x => x.id === id);
    if (index < 0) return;

    const q = AppState.quotations[index];
    AppState.quotations.splice(index, 1);

    AuditTrail.add({
      reference: q.reference,
      action: "Quotation Deleted",
      by: AppState.session.name,
      role: AppState.session.role,
      remarks: "Deleted permanently"
    });

    await this.persistAll();
    Toast.show("Quotation deleted.", "success");
    Kanban.render();
    Dashboard.render();
  },

  openImportReviewModal(review) {
    return new Promise(resolve => {
      const modal = document.getElementById("importReviewModal");
      const summary = document.getElementById("importReviewSummary");
      const details = document.getElementById("importReviewDetails");
      const btnConfirm = document.getElementById("btnConfirmImportReview");
      const btnCancel = document.getElementById("btnCancelImportReview");
      const btnClose = document.getElementById("btnCloseImportReview");
      summary.innerHTML = review.summaryHtml;
      details.innerHTML = review.tableHtml;
      modal.classList.remove("hidden");

      const close = (confirmed) => {
        modal.classList.add("hidden");
        btnConfirm.removeEventListener("click", onConfirm);
        btnCancel.removeEventListener("click", onCancel);
        btnClose.removeEventListener("click", onCancel);
        resolve(confirmed);
      };
      const onConfirm = () => close(true);
      const onCancel = () => close(false);
      btnConfirm.addEventListener("click", onConfirm);
      btnCancel.addEventListener("click", onCancel);
      btnClose.addEventListener("click", onCancel);
    });
  },

  validateImportRow(importType, normalized) {
    const issues = [];
    if (importType === "quotations") {
      if (!normalized.reference && !normalized.id) issues.push("Missing reference/id");
      if (!normalized.customerCode) issues.push("Missing customer code");
      if (String(normalized.targetDateRaw || "").trim() && !normalized.targetDate) issues.push("Invalid target date");
      if (String(normalized.dueDateRaw || "").trim() && !normalized.dueDate) issues.push("Invalid due date");
      if (normalized.totalItems && Number.isNaN(Number(normalized.totalItems))) issues.push("Total items is not a number");
      if (normalized.totalValue && Number.isNaN(Number(normalized.totalValue))) issues.push("Total value is not a number");
    } else if (importType === "customers") {
      if (!normalized.code) issues.push("Missing customer code");
      if (!normalized.name) issues.push("Missing customer name");
    } else if (importType === "contacts") {
      if (!normalized.customerCode) issues.push("Missing customer code");
      if (!normalized.name) issues.push("Missing contact name");
    }
    return issues;
  },

  buildImportReview(rows, importType) {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let duplicateRows = 0;
    let validationIssues = 0;
    const sample = [];
    const seen = new Set();

    if (importType === "quotations") {
      rows.forEach((row, index) => {
        const normalized = this.normalizeImportRow(row);
        const issues = this.validateImportRow("quotations", normalized);
        if (issues.length) validationIssues += 1;
        const key = `${normalized.reference}|${normalized.customerCode}|${normalized.id}|${normalized.workflowId || this.getActiveWorkflowId()}`;
        if (seen.has(key)) duplicateRows += 1;
        seen.add(key);
        if (!normalized.id && !normalized.reference && !normalized.customerCode) {
          skipped += 1;
          return;
        }
        const payload = {
          id: normalized.id,
          reference: normalized.reference,
          customerCode: normalized.customerCode,
          workflowId: normalized.workflowId || this.getActiveWorkflowId()
        };
        const existingIndex = this.findQuotationImportMatch(payload);
        const action = existingIndex >= 0 ? "Update" : "Add";
        if (existingIndex >= 0) updated += 1; else added += 1;
        if (sample.length < 12) sample.push({ row: index + 2, action, reference: normalized.reference, customerCode: normalized.customerCode, issues: issues.join(", ") });
      });
    } else if (importType === "customers") {
      const all = CustomerManager.getAll();
      rows.forEach((row, index) => {
        const normalized = this.normalizeCustomerImportRow(row);
        const issues = this.validateImportRow("customers", normalized);
        if (issues.length) validationIssues += 1;
        const key = normalized.code;
        if (seen.has(key)) duplicateRows += 1;
        seen.add(key);
        if (!normalized.code || !normalized.name) {
          skipped += 1;
          return;
        }
        const exists = all.some(c => c.code === normalized.code);
        if (exists) updated += 1; else added += 1;
        if (sample.length < 12) sample.push({ row: index + 2, action: exists ? "Update" : "Add", reference: normalized.name, customerCode: normalized.code, issues: issues.join(", ") });
      });
    } else {
      const all = ContactManager.getAll();
      rows.forEach((row, index) => {
        const normalized = this.normalizeContactImportRow(row);
        const issues = this.validateImportRow("contacts", normalized);
        if (issues.length) validationIssues += 1;
        const key = `${normalized.customerCode}|${String(normalized.name || "").toLowerCase()}`;
        if (seen.has(key)) duplicateRows += 1;
        seen.add(key);
        if (!normalized.customerCode || !normalized.name) {
          skipped += 1;
          return;
        }
        const exists = all.some(c =>
          String(c.customerCode || "").trim() === String(normalized.customerCode || "").trim() &&
          String(c.name || "").trim().toLowerCase() === String(normalized.name || "").trim().toLowerCase()
        );
        if (exists) updated += 1; else added += 1;
        if (sample.length < 12) sample.push({ row: index + 2, action: exists ? "Update" : "Add", reference: normalized.name, customerCode: normalized.customerCode, issues: issues.join(", ") });
      });
    }

    return {
      summaryHtml: `
        <strong>Type:</strong> ${Utils.escapeHtml(importType)} |
        <strong>Rows:</strong> ${rows.length} |
        <strong>Add:</strong> ${added} |
        <strong>Update:</strong> ${updated} |
        <strong>Skipped:</strong> ${skipped} |
        <strong>Duplicate rows in file:</strong> ${duplicateRows} |
        <strong>Rows with validation issues:</strong> ${validationIssues}
      `,
      tableHtml: `
        <table class="import-review-table">
          <thead><tr><th>CSV Row</th><th>Action</th><th>Reference/Name</th><th>Customer Code</th><th>Validation</th></tr></thead>
          <tbody>
            ${sample.map(s => `
              <tr>
                <td>${s.row}</td>
                <td>${Utils.escapeHtml(s.action)}</td>
                <td>${Utils.escapeHtml(s.reference || "")}</td>
                <td>${Utils.escapeHtml(s.customerCode || "")}</td>
                <td>${Utils.escapeHtml(s.issues || "OK")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `
    };
  },

  async importCSV(file) {
    const snapshot = this.createDataSnapshot();
    const text = await this.readCsvText(file);
    const rows = this.parseRobustCSV(text);
    if (!rows.length) {
      Toast.show("CSV has no data rows.", "warning");
      return;
    }

    const importType = this.detectImportType(rows);
    const review = this.buildImportReview(rows, importType);
    const confirmed = await this.openImportReviewModal(review);
    if (!confirmed) {
      Toast.show("Import cancelled.", "info");
      return;
    }

    try {
      if (importType === "customers") {
        const result = this.importCustomersFromCSVRows(rows);
        await this.persistAll();
        Toast.show(`Customers imported. Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped}.`, "success", 4500);
        return;
      }

      if (importType === "contacts") {
        const result = this.importContactsFromCSVRows(rows);
        await this.persistAll();
        Toast.show(`Contacts imported. Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped}.`, "success", 4500);
        return;
      }

      const result = this.importQuotationsFromCSVRows(rows);
      await this.persistAll();
      Toast.show(`Quotations imported. Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped}.`, "success", 4500);
      Kanban.render();
      Dashboard.render();
    } catch (error) {
      this.restoreDataSnapshot(snapshot);
      await this.persistAll();
      Toast.show(`Import rolled back due to error: ${error.message || error}`, "error", 5000);
    }
  },

  importQuotationsFromCSVRows(rows) {
    const fallbackStatus = this.getDefaultStatusForGroup(this.getStatusGroups()[0]?.name || "WIP");
    const defaultWorkflowId = this.getActiveWorkflowId();
    let added = 0;
    let updated = 0;
    let skipped = 0;

    rows.forEach(row => {
      const normalized = this.normalizeImportRow(row);
      if (!normalized.id && !normalized.reference && !normalized.customerCode) {
        skipped += 1;
        return;
      }

      const parsedSN = Number(normalized.sn);
      const rawStatus = normalized.status || fallbackStatus;
      const groupMatch = this.getStatusGroups().find(g => g.name === rawStatus);
      const resolvedStatus = groupMatch ? this.getDefaultStatusForGroup(groupMatch.name) : rawStatus;
      const resolvedCustomerName = normalized.customerName || this.resolveCustomerNameByCode(normalized.customerCode);
      const resolvedWorkflowId = this.normalizeWorkflowId(normalized.workflowId || defaultWorkflowId);
      const workflowQuotes = this.getQuotationsByWorkflow(resolvedWorkflowId);
      const refCfg = this.getWorkflowReferenceConfig(resolvedWorkflowId);
      const quotationPayload = {
        id: normalized.id || Utils.uid("qtn"),
        sn: Number.isFinite(parsedSN) && parsedSN > 0 ? parsedSN : Utils.nextSN(workflowQuotes),
        reference: normalized.reference || Utils.generateReference(workflowQuotes, refCfg),
        workflowId: resolvedWorkflowId,
        targetDate: normalized.targetDate || Utils.tomorrowISO(),
        dueDate: normalized.dueDate || Utils.tomorrowISO(),
        customerCode: normalized.customerCode || "",
        customerName: resolvedCustomerName || "",
        pgType: normalized.pgType || "",
        origin: normalized.origin || "",
        salesPerson: normalized.salesPerson || "",
        rfq: normalized.rfq || "",
        bid: normalized.bid || "",
        quoteTime: normalized.quoteTime || "",
        status: resolvedStatus,
        contactName: normalized.contactName || "",
        phone: normalized.phone || "",
        email: normalized.email || "",
        totalItems: Number(normalized.totalItems || 0),
        totalValue: Number(normalized.totalValue || 0),
        remarks: normalized.remarks || "",
        itemText: normalized.itemText || "",
        items: normalized.itemText ? normalized.itemText.split("\n").map(line => ({ description: line, qty: 0 })) : []
      };

      const existingIndex = this.findQuotationImportMatch(quotationPayload);
      if (existingIndex >= 0) {
        const existing = AppState.quotations[existingIndex];
        AppState.quotations[existingIndex] = {
          ...existing,
          ...quotationPayload,
          id: existing.id || quotationPayload.id,
          sn: Number.isFinite(parsedSN) && parsedSN > 0 ? parsedSN : existing.sn
        };
        updated += 1;
        AuditTrail.add({
          reference: AppState.quotations[existingIndex].reference,
          action: "Quotation Import Updated",
          by: AppState.session.name,
          role: AppState.session.role,
          remarks: "Updated existing quotation from CSV"
        });
        return;
      }

      AppState.quotations.push(quotationPayload);
      added += 1;

      AuditTrail.add({
        reference: quotationPayload.reference,
        action: "Quotation Imported",
        by: AppState.session.name,
        role: AppState.session.role,
        remarks: "Imported from CSV"
      });
    });

    return { added, updated, skipped };
  },

  resolveCustomerNameByCode(code) {
    const target = this.normalizeCodeValue(code);
    if (!target) return "";
    const activeId = this.getActiveWorkflowId();
    const fromState = (AppState.customers || []).find(c =>
      this.normalizeCodeValue(c.code) === target &&
      this.normalizeWorkflowId(c.workflowId || activeId) === activeId
    );
    if (fromState?.name) return String(fromState.name).trim();
    const fromManager = CustomerManager.getByCode(target);
    if (fromManager?.name) return String(fromManager.name || "").trim();
    const fallback = (CustomerManager.getAll() || []).find(c => this.normalizeCodeValue(c.code) === target);
    return String(fallback?.name || "").trim();
  },

  importCustomersFromCSVRows(rows) {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const allCustomers = CustomerManager.getAll();

    rows.forEach(row => {
      const normalized = this.normalizeCustomerImportRow(row);
      if (!normalized.code || !normalized.name) {
        skipped += 1;
        return;
      }

      const index = allCustomers.findIndex(c => c.code === normalized.code);
      if (index >= 0) {
        allCustomers[index] = { ...allCustomers[index], ...normalized };
        updated += 1;
      } else {
        allCustomers.push(normalized);
        added += 1;
      }
    });

    CustomerManager.saveAll(allCustomers);
    AppState.customers = CustomerManager.getAll({ allWorkflows: true });
    return { added, updated, skipped };
  },

  importContactsFromCSVRows(rows) {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const allContacts = ContactManager.getAll();

    rows.forEach(row => {
      const normalized = this.normalizeContactImportRow(row);
      if (!normalized.customerCode || !normalized.name) {
        skipped += 1;
        return;
      }

      const index = allContacts.findIndex(c =>
        c.customerCode === normalized.customerCode &&
        c.name.toLowerCase() === normalized.name.toLowerCase()
      );

      if (index >= 0) {
        allContacts[index] = { ...allContacts[index], ...normalized, id: allContacts[index].id || normalized.id };
        updated += 1;
      } else {
        allContacts.push({
          id: normalized.id || Utils.uid("ct"),
          customerCode: normalized.customerCode,
          name: normalized.name,
          phone: normalized.phone,
          email: normalized.email,
          dataScope: normalized.dataScope,
          workflowIds: normalized.workflowIds,
          scopeAll: normalized.dataScope === "all",
          workflowId: normalized.workflowId || this.getActiveWorkflowId()
        });
        added += 1;
      }
    });

    ContactManager.saveAll(allContacts);
    AppState.contacts = ContactManager.getAll({ allWorkflows: true });
    return { added, updated, skipped };
  },

  findQuotationImportMatch(quotationPayload) {
    if (!quotationPayload) return -1;
    const id = String(quotationPayload.id || "").trim();
    const reference = String(quotationPayload.reference || "").trim();
    const customerCode = this.normalizeCodeValue(quotationPayload.customerCode);
    const workflowId = this.normalizeWorkflowId(quotationPayload.workflowId || this.getActiveWorkflowId());

    if (id) {
      const idxById = AppState.quotations.findIndex(q => String(q.id || "").trim() === id);
      if (idxById >= 0) return idxById;
    }

    if (reference && customerCode) {
      const idxByRefCode = AppState.quotations.findIndex(q =>
        String(q.reference || "").trim() === reference &&
        this.normalizeCodeValue(q.customerCode) === customerCode &&
        this.normalizeWorkflowId(q.workflowId || workflowId) === workflowId
      );
      if (idxByRefCode >= 0) return idxByRefCode;
    }

    if (reference) {
      const idxByRefWorkflow = AppState.quotations.findIndex(q =>
        String(q.reference || "").trim() === reference &&
        this.normalizeWorkflowId(q.workflowId || workflowId) === workflowId
      );
      if (idxByRefWorkflow >= 0) return idxByRefWorkflow;
      return AppState.quotations.findIndex(q => String(q.reference || "").trim() === reference);
    }

    return -1;
  },

  detectImportType(rows) {
    const first = rows[0] || {};
    const keys = Object.keys(first).map(k => this.normalizeHeaderKey(k));
    const has = (...labels) => labels.some(label => keys.includes(this.normalizeHeaderKey(label)));

    const looksQuotation = has("reference", "target date", "due date", "rfq", "status", "item description");
    const looksContact = has("contact name", "contact #", "email") && has("customer code");
    const looksCustomer = has("customer code", "code") && has("customer name", "name") && !looksQuotation;

    if (looksQuotation) return "quotations";
    if (looksContact && !looksCustomer) return "contacts";
    if (looksCustomer) return "customers";
    return "quotations";
  },

  normalizeHeaderKey(key) {
    return Utils.fixArabicMojibake(key).toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, "");
  },

  normalizeCodeValue(value) {
    return String(value || "").trim().replace(/\.0+$/, "");
  },

  normalizeImportRow(row) {
    const normalizedMap = {};
    Object.entries(row || {}).forEach(([k, v]) => {
      normalizedMap[this.normalizeHeaderKey(k)] = Utils.fixArabicMojibake(v);
    });
    const labels = this.getTagLabels();

    const pick = (...keys) => {
      for (const key of keys) {
        const value = normalizedMap[this.normalizeHeaderKey(key)];
        if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
      }
      return "";
    };

    const rawTargetDate = pick("targetDate", "target date", "target dat");
    const rawDueDate = pick("dueDate", "due date", "due dat");
    return {
      id: pick("id"),
      sn: pick("sn", "file no", "fileno"),
      reference: pick("reference"),
      workflowId: pick("workflow", "workflow id", "quotation type", "kanban"),
      targetDate: Utils.normalizeDateInput(rawTargetDate),
      dueDate: Utils.normalizeDateInput(rawDueDate),
      targetDateRaw: rawTargetDate,
      dueDateRaw: rawDueDate,
      customerCode: this.normalizeCodeValue(pick("customerCode", "customer code", "customer cod")),
      customerName: pick("customerName", "customer name"),
      pgType: pick("pgType", "p/g", "pg"),
      origin: pick(labels.tag, "origin", "tag"),
      salesPerson: pick(labels.subTag, "salesPerson", "sales team", "sub tag", "subtag"),
      rfq: pick("rfq", "rfq no", "rfq no."),
      bid: pick("bid", "bidding price"),
      quoteTime: Utils.normalizeTimeInput(pick("quoteTime", "time")),
      status: pick("status"),
      contactName: pick("contactName", "contact name"),
      phone: pick("phone", "contact #", "contact#"),
      email: pick("email"),
      totalItems: pick("totalItems", "total item"),
      totalValue: pick("totalValue", "total value"),
      remarks: pick("remarks"),
      itemText: pick("itemText", "item description")
    };
  },

  normalizeCustomerImportRow(row) {
    const normalizedMap = {};
    Object.entries(row || {}).forEach(([k, v]) => {
      normalizedMap[this.normalizeHeaderKey(k)] = Utils.fixArabicMojibake(v);
    });

    const pick = (...keys) => {
      for (const key of keys) {
        const value = normalizedMap[this.normalizeHeaderKey(key)];
        if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
      }
      return "";
    };

    return {
      code: this.normalizeCodeValue(pick("customer code", "customer cod", "code")),
      name: pick("customer name", "name"),
      nameAr: pick("customer name arabic", "name arabic", "arabic name", "اسم العميل", "اســم العميـــــل"),
      pgType: pick("p/g", "pg", "pg type"),
      website: pick("website", "web site"),
      sector: pick("sector"),
      areaCode: pick("area code"),
      vt: pick("v/t", "vt"),
      vendor: pick("vendor"),
      remark: pick("remark", "remarks"),
      dataScope: pick("scope", "data scope", "use in") || "current",
      workflowIds: pick("trackers", "workflow ids", "tracker ids").split(/[|;]/).map(x => x.trim()).filter(Boolean),
      workflowId: this.getActiveWorkflowId()
    };
  },

  normalizeContactImportRow(row) {
    const normalizedMap = {};
    Object.entries(row || {}).forEach(([k, v]) => {
      normalizedMap[this.normalizeHeaderKey(k)] = Utils.fixArabicMojibake(v);
    });

    const pick = (...keys) => {
      for (const key of keys) {
        const value = normalizedMap[this.normalizeHeaderKey(key)];
        if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
      }
      return "";
    };

    return {
      id: pick("id", "contact id"),
      customerCode: this.normalizeCodeValue(pick("customer code", "customer cod", "code")),
      name: pick("contact name", "name"),
      phone: pick("contact #", "contact#", "phone"),
      email: pick("email"),
      dataScope: pick("scope", "data scope", "use in") || "current",
      workflowIds: pick("trackers", "workflow ids", "tracker ids").split(/[|;]/).map(x => x.trim()).filter(Boolean),
      workflowId: this.getActiveWorkflowId()
    };
  },

  async readCsvText(file) {
    return Utils.readCsvText(file);
  },

  parseRobustCSV(text) {
    return Utils.parseCSV(text);
  },

  showView(view) {
    document.getElementById("viewBoard").classList.add("hidden");
    document.getElementById("viewDashboard").classList.add("hidden");
    if (view === "board") document.getElementById("viewBoard").classList.remove("hidden");
    if (view === "dashboard") document.getElementById("viewDashboard").classList.remove("hidden");
    localStorage.setItem("qt.mainView", view === "dashboard" ? "dashboard" : "board");
    document.getElementById("tabBoard")?.classList.toggle("is-active", view === "board");
    document.getElementById("tabDashboard")?.classList.toggle("is-active", view === "dashboard");
  },

  showAudit(reference) {
    const auditEntries = AuditTrail.forQuotation(reference);
    const approvalEntries = ApprovalWorkflow.forReference(reference);
    const entries = [...auditEntries, ...approvalEntries].sort((a, b) => new Date(b.time) - new Date(a.time));

    const wrap = document.getElementById("auditContent");
    if (!entries.length) {
      wrap.innerHTML = "<p>No audit entries yet.</p>";
    } else {
      wrap.innerHTML = entries.map(e => `
        <div class="audit-entry">
          <div><strong>${Utils.escapeHtml(e.action)}</strong></div>
          <div>${Utils.escapeHtml(e.time)}</div>
          <div>By: ${Utils.escapeHtml(e.by)} (${Utils.escapeHtml(e.role)})</div>
          <div>${Utils.escapeHtml(e.remarks || "")}</div>
        </div>
      `).join("");
    }

    document.getElementById("auditModal").classList.remove("hidden");
  },

  openQuickEditDrawer(id) {
    const q = AppState.quotations.find(x => x.id === id);
    if (!q) return;
    const canEdit = ApprovalWorkflow.canEdit(AppState.session, q);
    document.getElementById("quickEditId").value = q.id;
    document.getElementById("quickReference").value = q.reference || "";
    document.getElementById("quickCustomer").value = `${q.customerCode || ""} - ${q.customerName || ""}`.trim();
    this.setSelectOptions(document.getElementById("quickStatus"), this.getAllStatuses());
    document.getElementById("quickStatus").value = q.status || "";
    document.getElementById("quickDueDate").value = q.dueDate || "";
    document.getElementById("quickSales").value = q.salesPerson || "";
    document.getElementById("quickRemarks").value = q.remarks || "";
    document.getElementById("quickStatus").disabled = !canEdit;
    document.getElementById("quickDueDate").disabled = !canEdit;
    document.getElementById("quickSales").disabled = !canEdit;
    document.getElementById("quickRemarks").disabled = !canEdit;
    document.getElementById("btnSaveQuickDrawer").disabled = !canEdit;
    this.renderQuickTimeline(q.reference);
    document.getElementById("quickEditDrawer").classList.remove("hidden");
  },

  closeQuickEditDrawer() {
    document.getElementById("quickEditDrawer").classList.add("hidden");
  },

  renderQuickTimeline(reference) {
    const wrap = document.getElementById("quickTimeline");
    const auditEntries = AuditTrail.forQuotation(reference);
    const approvalEntries = ApprovalWorkflow.forReference(reference);
    const entries = [...auditEntries, ...approvalEntries].sort((a, b) => new Date(b.time) - new Date(a.time));
    if (!entries.length) {
      wrap.innerHTML = `<div class="quick-timeline-item"><div class="meta">No activity yet.</div></div>`;
      return;
    }
    wrap.innerHTML = entries.map(e => `
      <div class="quick-timeline-item">
        <div class="action">${Utils.escapeHtml(e.action || "")}</div>
        <div class="time">${Utils.escapeHtml(String(e.time || "").replace("T", " ").replace("Z", ""))}</div>
        <div class="meta">${Utils.escapeHtml(e.by || "")} (${Utils.escapeHtml(e.role || "")})</div>
        <div class="meta">${Utils.escapeHtml(e.remarks || "")}</div>
      </div>
    `).join("");
  },

  async saveQuickEditDrawer() {
    const id = document.getElementById("quickEditId").value;
    const q = AppState.quotations.find(x => x.id === id);
    if (!q) return;
    if (!ApprovalWorkflow.canEdit(AppState.session, q)) {
      Toast.show("You cannot edit this quotation at its current stage.", "warning");
      return;
    }
    const prevStatus = q.status;
    q.status = document.getElementById("quickStatus").value || q.status;
    q.dueDate = document.getElementById("quickDueDate").value || q.dueDate;
    q.salesPerson = document.getElementById("quickSales").value.trim();
    q.remarks = document.getElementById("quickRemarks").value.trim();

    AuditTrail.add({
      reference: q.reference,
      action: "Quick Edit Updated",
      by: AppState.session.name,
      role: AppState.session.role,
      remarks: `Updated status ${prevStatus} -> ${q.status}`
    });

    await this.persistAll();
    this.renderQuickTimeline(q.reference);
    Kanban.render();
    Dashboard.render();
    Toast.show("Quick changes saved.", "success");
  },

  populateOrigins() {
    const originEl = document.getElementById("origin");
    const scope = this.getRoleScope();
    const workflowOrigins = (this.getActiveTagGroup()?.tags || []).map(t => t.name);
    const configuredOrigins = workflowOrigins.length
      ? workflowOrigins
      : (AppState.settings.origins || APP_CONFIG.defaults.origins);
    const origins = scope.isRestricted
      ? configuredOrigins.filter(origin => scope.origins.includes(origin))
      : configuredOrigins;
    this.setSelectOptions(originEl, origins);
    this.populateSales();
  },

  populateStatuses() {
    const statusEl = document.getElementById("status");
    const statuses = this.getAllStatuses();
    this.setSelectOptions(statusEl, statuses);
  },

  populateSales() {
    const origin = document.getElementById("origin").value;
    const customerCode = document.getElementById("customerCode").value.trim();
    const map = this.getActiveTagGroup()?.tags?.reduce((acc, tag) => {
      acc[tag.name] = Array.isArray(tag.subtags) ? tag.subtags : [];
      return acc;
    }, {})
      || this.getActiveWorkflowProfile()?.originSalesMap
      || AppState.settings?.originSalesMap
      || APP_CONFIG.defaults.originSalesMap
      || {};
    let sales = QuotationWorkflow.getSalesByOrigin(origin, customerCode, map);
    const scope = this.getRoleScope();
    if (scope.isRestricted) {
      const self = String(scope.salesPerson || "").toLowerCase();
      sales = (sales || []).filter(name => String(name || "").toLowerCase() === self);
      if (!sales.length && scope.salesPerson) sales = [scope.salesPerson];
    }
    const salesEl = document.getElementById("salesPerson");
    this.setSelectOptions(salesEl, sales);
  },

  renderCustomerMatches(targetId, matches) {
    const box = document.getElementById(targetId);
    if (!matches.length) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }

    box.innerHTML = matches.map(c => `
      <div class="lookup-item" data-code="${Utils.escapeHtml(c.code)}">
        ${Utils.escapeHtml(c.code)} - ${Utils.escapeHtml(c.name)}
      </div>
    `).join("");

    box.classList.remove("hidden");

    box.querySelectorAll(".lookup-item").forEach(el => {
      el.addEventListener("click", () => {
        const customer = CustomerManager.getByCode(el.dataset.code);
        document.getElementById("customerCode").value = customer.code;
        document.getElementById("customerName").value = customer.name;
        document.getElementById("pgType").value = customer.pgType;
        document.getElementById("contactName").value = "";
        document.getElementById("phone").value = "";
        document.getElementById("email").value = "";
        AppState.selectedContactId = null;
        this.refreshContactSaveButton();
        this.closeLookupLists(null, true);
        this.populateSales();
      });
    });
  },

  renderContactMatches(matches) {
    const box = document.getElementById("contactMatches");
    if (!matches.length) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }

    box.innerHTML = matches.map((c, index) => `
      <div class="lookup-item" data-index="${index}">
        ${Utils.escapeHtml(c.name)} - ${Utils.escapeHtml(c.phone)} - ${Utils.escapeHtml(c.email)}${c.customerCode ? ` (${Utils.escapeHtml(c.customerCode)})` : ""}
      </div>
    `).join("");

    box.classList.remove("hidden");

    box.querySelectorAll(".lookup-item").forEach(el => {
      el.addEventListener("click", () => {
        const selected = matches[Number(el.dataset.index)];
        if (!selected) return;
        const selectedId = String(selected.id || "").trim();
        if (selectedId) {
          AppState.selectedContactId = selectedId;
        } else {
          const linked = ContactManager.getAll().find(c =>
            String(c.customerCode || "").trim() === String(selected.customerCode || "").trim() &&
            String(c.name || "").trim().toLowerCase() === String(selected.name || "").trim().toLowerCase()
          );
          AppState.selectedContactId = linked?.id || null;
        }

        const selectedCustomerCode = String(selected.customerCode || "").trim();
        if (selectedCustomerCode) {
          const customer = CustomerManager.getByCode(selectedCustomerCode);
          document.getElementById("customerCode").value = selectedCustomerCode;
          if (customer) {
            document.getElementById("customerName").value = customer.name || "";
            document.getElementById("pgType").value = customer.pgType || "";
          }
          this.populateSales();
        }

        document.getElementById("contactName").value = selected.name || "";
        document.getElementById("phone").value = selected.phone || "";
        document.getElementById("email").value = selected.email || "";
        this.refreshContactSaveButton();
        this.closeLookupLists(null, true);
      });
    });
  },

  exportCSV() {
    const rows = AppState.quotations;
    if (!rows.length) {
      Toast.show("No quotations to export.", "warning");
      return;
    }

    const labels = this.getTagLabels();
    const headers = [
      "File No", "Reference", "Item Description", "Customer code", "TARGET DAT", "Due Dat", "DAYS LE",
      "RFQ. No.", "Contact Name", "Contact #", "Email", "Time", "Status", "Remarks",
      "Total Item", "Total Value", labels.subTag, labels.tag, "P/G", "Bidding Price", "Workflow"
    ];

    const csvRows = rows.map(r => {
      const clean = value => Utils.fixArabicMojibake(value);
      const daysLeft = Utils.daysDiff(r.dueDate);
      return {
        "File No": String(Number(r.sn || 0)).padStart(4, "0"),
        "Reference": clean(r.reference || ""),
        "Item Description": clean(r.itemText || ""),
        "Customer code": clean(r.customerCode || ""),
        "TARGET DAT": r.targetDate || "",
        "Due Dat": r.dueDate || "",
        "DAYS LE": daysLeft === null ? "" : daysLeft,
        "RFQ. No.": clean(r.rfq || ""),
        "Contact Name": clean(r.contactName || ""),
        "Contact #": clean(r.phone || ""),
        "Email": clean(r.email || ""),
        "Time": r.quoteTime || "",
        "Status": clean(r.status || ""),
        "Remarks": clean(r.remarks || ""),
        "Total Item": r.totalItems || 0,
        "Total Value": r.totalValue || 0,
        [labels.subTag]: clean(r.salesPerson || ""),
        [labels.tag]: clean(r.origin || ""),
        "P/G": clean(r.pgType || ""),
        "Bidding Price": clean(r.bid || ""),
        "Workflow": clean(r.workflowId || this.getActiveWorkflowId())
      };
    });

    const csv = [headers.join(","), ...csvRows.map(r => headers.map(h => Utils.csvEscape(r[h])).join(","))].join("\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quotations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());




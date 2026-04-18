window.LocalStorageAdapter = {
  _suppressChangeTracking: false,

  shouldTrackChange(key) {
    const keys = APP_CONFIG?.localKeys || {};
    return Object.values(keys).includes(key);
  },

  markChanged(when = new Date().toISOString()) {
    localStorage.setItem("qt.lastLocalChangeAt", when);
  },

  getLastChangedAt(fallback = "") {
    return localStorage.getItem("qt.lastLocalChangeAt") || fallback || "";
  },

  withSilentChanges(callback) {
    this._suppressChangeTracking = true;
    try {
      return callback();
    } finally {
      this._suppressChangeTracking = false;
    }
  },

  load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  save(key, value, options = {}) {
    localStorage.setItem(key, JSON.stringify(value));
    if (!options.silent && !this._suppressChangeTracking && this.shouldTrackChange(key)) {
      this.markChanged();
    }
  },

  initSeedData() {
    const keys = APP_CONFIG.localKeys;

    this.withSilentChanges(() => {
      if (!localStorage.getItem(keys.customers)) {
        this.save(keys.customers, [
          { code: "C001", name: "National Care", pgType: "G" },
          { code: "C002", name: "Dallah Hospital", pgType: "P" },
          { code: "C003", name: "Riyadh Medical Center", pgType: "G" }
        ]);
      }

      if (!localStorage.getItem(keys.contacts)) {
        this.save(keys.contacts, [
          { id: "ct1", customerCode: "C001", name: "John Doe", phone: "+966500000001", email: "john@care.com" },
          { id: "ct2", customerCode: "C002", name: "Jane Smith", phone: "+966500000002", email: "jane@dallah.com" }
        ]);
      }

      if (!localStorage.getItem(keys.quotations)) this.save(keys.quotations, []);
      if (!localStorage.getItem(keys.archived)) this.save(keys.archived, []);
      if (!localStorage.getItem(keys.approvals)) this.save(keys.approvals, []);
      if (!localStorage.getItem(keys.audit)) this.save(keys.audit, []);

      if (!localStorage.getItem(keys.settings)) {
        this.save(keys.settings, {
          workflowProfiles: APP_CONFIG.defaults.workflowProfiles,
          activeWorkflowId: APP_CONFIG.defaults.activeWorkflowId,
          tagLabel: APP_CONFIG.defaults.tagLabel,
          subTagLabel: APP_CONFIG.defaults.subTagLabel,
          origins: APP_CONFIG.defaults.origins,
          statuses: APP_CONFIG.defaults.statuses,
          kanbanColumnMode: APP_CONFIG.defaults.kanbanColumnMode,
          statusGroups: APP_CONFIG.defaults.statusGroups,
          referenceFormula: APP_CONFIG.defaults.referenceFormula,
          referenceStartSequence: APP_CONFIG.defaults.referenceStartSequence,
          referenceSequencePad: APP_CONFIG.defaults.referenceSequencePad,
          originSalesMap: APP_CONFIG.defaults.originSalesMap,
          ui: APP_CONFIG.defaults.ui,
          customerFormLayout: APP_CONFIG.defaults.customerFormLayout,
          dashboardWidgets: APP_CONFIG.defaults.dashboardWidgets
        });
      }
    });

    this.migrateToCurrentSchema();
  },

  migrateToCurrentSchema() {
    const targetVersion = Number(APP_CONFIG.schemaVersion || 1);
    const versionKey = "qt.schemaVersion";
    let currentVersion = Number(localStorage.getItem(versionKey) || 1);
    if (currentVersion >= targetVersion) return;

    const keys = APP_CONFIG.localKeys;
    const settings = this.load(keys.settings, {});
    settings.origins = Array.isArray(settings.origins) && settings.origins.length ? settings.origins : APP_CONFIG.defaults.origins;
    settings.workflowProfiles = Array.isArray(settings.workflowProfiles) && settings.workflowProfiles.length
      ? settings.workflowProfiles
      : APP_CONFIG.defaults.workflowProfiles;
    settings.activeWorkflowId = String(settings.activeWorkflowId || APP_CONFIG.defaults.activeWorkflowId || settings.workflowProfiles?.[0]?.id || "direct_purchase");
    settings.tagLabel = String(settings.tagLabel || APP_CONFIG.defaults.tagLabel || "Origin");
    settings.subTagLabel = String(settings.subTagLabel || APP_CONFIG.defaults.subTagLabel || "Sub Tag");
    settings.statusGroups = Array.isArray(settings.statusGroups) && settings.statusGroups.length ? settings.statusGroups : APP_CONFIG.defaults.statusGroups;
    settings.referenceFormula = settings.referenceFormula || APP_CONFIG.defaults.referenceFormula;
    settings.referenceStartSequence = Number(settings.referenceStartSequence ?? APP_CONFIG.defaults.referenceStartSequence);
    settings.referenceSequencePad = Number(settings.referenceSequencePad ?? APP_CONFIG.defaults.referenceSequencePad);
    settings.originSalesMap = settings.originSalesMap && typeof settings.originSalesMap === "object"
      ? settings.originSalesMap
      : APP_CONFIG.defaults.originSalesMap;
    settings.ui = settings.ui && typeof settings.ui === "object"
      ? { ...APP_CONFIG.defaults.ui, ...settings.ui }
      : { ...APP_CONFIG.defaults.ui };
    settings.customerFormLayout = Array.isArray(settings.customerFormLayout) && settings.customerFormLayout.length
      ? settings.customerFormLayout
      : APP_CONFIG.defaults.customerFormLayout;
    settings.dashboardWidgets = Array.isArray(settings.dashboardWidgets) && settings.dashboardWidgets.length
      ? settings.dashboardWidgets
      : APP_CONFIG.defaults.dashboardWidgets;

    const contacts = (this.load(keys.contacts, []) || []).map(c => ({
      id: c.id || `ct_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customerCode: String(c.customerCode || "").trim(),
      name: String(c.name || "").trim(),
      phone: String(c.phone || "").trim(),
      email: String(c.email || "").trim()
    })).filter(c => c.customerCode && c.name);

    const customers = (this.load(keys.customers, []) || []).map(c => ({
      code: String(c.code || "").trim(),
      name: String(c.name || "").trim(),
      nameAr: String(c.nameAr || "").trim(),
      pgType: String(c.pgType || "").trim(),
      website: String(c.website || "").trim(),
      sector: String(c.sector || "").trim(),
      areaCode: String(c.areaCode || "").trim(),
      vt: String(c.vt || "").trim(),
      vendor: String(c.vendor || "").trim(),
      remark: String(c.remark || "").trim()
    })).filter(c => c.code);

    this.withSilentChanges(() => {
      this.save(keys.settings, settings);
      this.save(keys.contacts, contacts);
      this.save(keys.customers, customers);
    });
    localStorage.setItem(versionKey, String(targetVersion));
  }
};

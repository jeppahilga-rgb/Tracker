window.CustomerManager = {
  getWorkflowProfiles() {
    const settings = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {});
    const configured = Array.isArray(settings.workflowProfiles) ? settings.workflowProfiles : [];
    const defaults = Array.isArray(APP_CONFIG.defaults.workflowProfiles) ? APP_CONFIG.defaults.workflowProfiles : [];
    return (configured.length ? configured : defaults)
      .map(profile => ({
        id: String(profile?.id || "").trim(),
        name: String(profile?.name || profile?.id || "").trim()
      }))
      .filter(profile => profile.id);
  },

  normalizeWorkflowId(id) {
    const profiles = this.getWorkflowProfiles();
    const fallback = profiles[0]?.id || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase";
    const raw = String(id || "").trim();
    if (!raw) return fallback;
    return profiles.some(profile => profile.id === raw) ? raw : fallback;
  },

  getActiveWorkflowId() {
    const settings = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {});
    return this.normalizeWorkflowId(localStorage.getItem("qt.activeWorkflowId") || settings.activeWorkflowId || APP_CONFIG.defaults.activeWorkflowId);
  },

  getStorageKey(workflowId = null) {
    return `${APP_CONFIG.localKeys.customers}.${this.normalizeWorkflowId(workflowId || this.getActiveWorkflowId())}`;
  },

  normalizeWorkflowIds(ids, fallbackId = null) {
    const profiles = this.getWorkflowProfiles();
    const valid = new Set(profiles.map(profile => profile.id));
    const source = Array.isArray(ids) ? ids : [];
    const normalized = [...new Set(source.map(id => String(id || "").trim()).filter(id => valid.has(id)))];
    if (normalized.length) return normalized;
    return [this.normalizeWorkflowId(fallbackId || this.getActiveWorkflowId())];
  },

  getTargetWorkflowIds(record = {}, fallbackId = null) {
    const profiles = this.getWorkflowProfiles();
    if (record.scopeAll === true || record.dataScope === "all") return profiles.map(profile => profile.id);
    return this.normalizeWorkflowIds(record.workflowIds, record.workflowId || fallbackId || this.getActiveWorkflowId());
  },

  normalizeCustomerSettings(input, fallback = {}) {
    const defaultSchema = APP_CONFIG.defaults.customerSettings || {};
    const base = fallback && typeof fallback === "object" ? fallback : {};
    const source = input && typeof input === "object" ? input : {};
    const labelsBase = base.labels && typeof base.labels === "object" ? base.labels : {};
    const labelsSource = source.labels && typeof source.labels === "object" ? source.labels : {};
    const columnsBase = base.columns && typeof base.columns === "object" ? base.columns : {};
    const columnsSource = source.columns && typeof source.columns === "object" ? source.columns : {};
    const requiredBase = base.required && typeof base.required === "object" ? base.required : {};
    const requiredSource = source.required && typeof source.required === "object" ? source.required : {};
    const labels = {
      ...(defaultSchema.labels || {}),
      ...labelsBase,
      ...labelsSource
    };
    const columns = {
      ...(defaultSchema.columns || {}),
      ...columnsBase,
      ...columnsSource
    };
    const required = {
      ...(defaultSchema.required || {}),
      ...requiredBase,
      ...requiredSource
    };
    return {
      entityName: String(source.entityName || base.entityName || defaultSchema.entityName || "Customer").trim() || "Customer",
      entityNamePlural: String(source.entityNamePlural || base.entityNamePlural || defaultSchema.entityNamePlural || "Customers").trim() || "Customers",
      labels: {
        code: String(labels.code || "Customer Code").trim(),
        nameAr: String(labels.nameAr || "Customer Name (Arabic)").trim(),
        name: String(labels.name || "Customer Name").trim(),
        website: String(labels.website || "Web Site").trim(),
        sector: String(labels.sector || "Sector").trim(),
        areaCode: String(labels.areaCode || "Area Code").trim(),
        vt: String(labels.vt || "V/T").trim(),
        vendor: String(labels.vendor || "Vendor #").trim(),
        remark: String(labels.remark || "Remarks").trim()
      },
      columns: {
        code: columns.code !== false,
        nameAr: columns.nameAr !== false,
        name: columns.name !== false,
        website: columns.website !== false,
        sector: columns.sector !== false,
        areaCode: columns.areaCode !== false,
        vt: columns.vt !== false,
        vendor: columns.vendor !== false,
        remark: columns.remark !== false
      },
      required: {
        code: required.code !== false,
        name: required.name !== false,
        nameAr: required.nameAr === true,
        website: required.website === true,
        sector: required.sector === true,
        areaCode: required.areaCode === true,
        vt: required.vt === true,
        vendor: required.vendor === true,
        remark: required.remark === true
      }
    };
  },

  getCustomerSettings(workflowId = null) {
    const settings = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {});
    const activeId = this.normalizeWorkflowId(workflowId || this.getActiveWorkflowId());
    const profiles = Array.isArray(settings.workflowProfiles) ? settings.workflowProfiles : [];
    const profile = profiles.find(p => this.normalizeWorkflowId(p.id) === activeId) || {};
    return this.normalizeCustomerSettings(profile.customerSettings || settings.customerSettings || APP_CONFIG.defaults.customerSettings, APP_CONFIG.defaults.customerSettings);
  },

  normalize(customer) {
    const cleanText = value => Utils.fixArabicMojibake(String(value || "").trim());
    return {
      code: cleanText(customer?.code),
      name: cleanText(customer?.name),
      nameAr: cleanText(customer?.nameAr),
      pgType: cleanText(customer?.pgType || "G") || "G",
      website: cleanText(customer?.website),
      sector: cleanText(customer?.sector),
      areaCode: cleanText(customer?.areaCode),
      vt: cleanText(customer?.vt),
      vendor: cleanText(customer?.vendor),
      remark: cleanText(customer?.remark),
      workflowId: this.normalizeWorkflowId(customer?.workflowId || this.getActiveWorkflowId()),
      workflowIds: this.getTargetWorkflowIds(customer),
      scopeAll: customer?.scopeAll === true || customer?.dataScope === "all"
    };
  },

  getAll(options = {}) {
    const { allWorkflows = false } = options || {};
    if (allWorkflows) {
      const profiles = this.getWorkflowProfiles();
      const merged = [];
      const scopedIds = new Set();
      let hasScopedData = false;
      profiles.forEach(profile => {
        const rows = LocalStorageAdapter.load(this.getStorageKey(profile.id), null);
        if (Array.isArray(rows)) {
          hasScopedData = true;
          scopedIds.add(profile.id);
          rows.forEach(row => merged.push(this.normalize({ ...row, workflowId: row.workflowId || profile.id })));
        }
      });
      if (hasScopedData) {
        const legacy = LocalStorageAdapter.load(APP_CONFIG.localKeys.customers, []);
        (Array.isArray(legacy) ? legacy : []).forEach(row => {
          const normalized = this.normalize({ ...row, workflowId: row.workflowId || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase" });
          if (!scopedIds.has(normalized.workflowId)) merged.push(normalized);
        });
        return merged;
      }
    }

    const activeId = this.getActiveWorkflowId();
    const scoped = LocalStorageAdapter.load(this.getStorageKey(activeId), null);
    if (Array.isArray(scoped)) return scoped.map(c => this.normalize({ ...c, workflowId: c.workflowId || activeId }));

    const legacy = LocalStorageAdapter.load(APP_CONFIG.localKeys.customers, []);
    const normalized = (Array.isArray(legacy) ? legacy : []).map(c => this.normalize({ ...c, workflowId: c.workflowId || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase" }));
    const activeRows = normalized.filter(c => this.normalizeWorkflowId(c.workflowId) === activeId);
    if (activeRows.length) this.saveAll(activeRows, { workflowId: activeId });
    return activeRows;
  },

  saveAll(data, options = {}) {
    const activeId = this.normalizeWorkflowId(options.workflowId || this.getActiveWorkflowId());
    const rows = (Array.isArray(data) ? data : []).map(c => this.normalize({ ...c, workflowId: c.workflowId || activeId }));

    if (options.allWorkflows) {
      this.getWorkflowProfiles().forEach(profile => {
        const bucket = rows.filter(c => this.normalizeWorkflowId(c.workflowId) === profile.id);
        LocalStorageAdapter.save(this.getStorageKey(profile.id), bucket);
      });
      LocalStorageAdapter.save(APP_CONFIG.localKeys.customers, rows);
      return;
    }

    const codes = new Set(rows.map(c => c.code).filter(Boolean));
    const allRows = this.getAll({ allWorkflows: true }).filter(c => {
      if (codes.has(c.code)) return false;
      return !this.getTargetWorkflowIds(c, c.workflowId).includes(activeId);
    });
    const byBucket = {};
    this.getWorkflowProfiles().forEach(profile => { byBucket[profile.id] = []; });
    allRows.forEach(row => {
      const owner = this.normalizeWorkflowId(row.workflowId);
      if (!byBucket[owner]) byBucket[owner] = [];
      byBucket[owner].push(row);
    });
    rows.forEach(row => {
      const targets = this.getTargetWorkflowIds(row, activeId);
      targets.forEach(targetId => {
        if (!byBucket[targetId]) byBucket[targetId] = [];
        byBucket[targetId].push({ ...row, workflowId: targetId, workflowIds: targets, scopeAll: row.scopeAll === true });
      });
    });
    Object.entries(byBucket).forEach(([workflowId, bucket]) => {
      LocalStorageAdapter.save(this.getStorageKey(workflowId), bucket);
    });
    const all = Object.values(byBucket).flat();
    LocalStorageAdapter.save(APP_CONFIG.localKeys.customers, all);
  },

  searchByCode(text) {
    const q = String(text || "").toLowerCase().trim();
    return this.getAll().filter(c => c.code.toLowerCase().includes(q));
  },

  searchByName(text) {
    const q = String(text || "").toLowerCase().trim();
    return this.getAll().filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.nameAr.toLowerCase().includes(q)
    );
  },

  getByCode(code) {
    return this.getAll().find(c => c.code === code) || null;
  },

  add(customer) {
    const all = this.getAll();
    const normalized = this.normalize(customer);
    if (!normalized.code || !normalized.name) throw new Error("Customer code and customer name are required.");
    if (all.some(c => c.code === normalized.code)) throw new Error("Customer code already exists.");
    all.push(normalized);
    this.saveAll(all);
    return normalized;
  },

  update(oldCode, updated) {
    const all = this.getAll();
    const index = all.findIndex(c => c.code === oldCode);
    if (index < 0) throw new Error("Customer not found.");
    const merged = this.normalize({ ...all[index], ...updated });
    if (!merged.code || !merged.name) throw new Error("Customer code and customer name are required.");
    const duplicate = all.find(c => c.code === merged.code && c.code !== oldCode);
    if (duplicate) throw new Error("Customer code already exists.");
    all[index] = merged;
    this.saveAll(all);
    return merged;
  },

  remove(code) {
    const all = this.getAll();
    const next = all.filter(c => c.code !== code);
    if (next.length === all.length) throw new Error("Customer not found.");
    this.saveAll(next);
  }
};

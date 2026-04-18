window.ContactManager = {
  getWorkflowProfiles() {
    const settings = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {});
    const configured = Array.isArray(settings.workflowProfiles) ? settings.workflowProfiles : [];
    const defaults = Array.isArray(APP_CONFIG.defaults.workflowProfiles) ? APP_CONFIG.defaults.workflowProfiles : [];
    return (configured.length ? configured : defaults)
      .map(profile => ({ id: String(profile?.id || "").trim(), name: String(profile?.name || profile?.id || "").trim() }))
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
    return `${APP_CONFIG.localKeys.contacts}.${this.normalizeWorkflowId(workflowId || this.getActiveWorkflowId())}`;
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

  normalizeCodeKey(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const upper = raw.toUpperCase();
    const digitOnly = upper.replace(/\D/g, "");
    if (digitOnly) return `N:${String(Number(digitOnly))}`;
    return `S:${upper.replace(/\s+/g, "")}`;
  },

  normalizeContact(contact = {}) {
    const cleanText = value => Utils.fixArabicMojibake(String(value || "").trim());
    return {
      id: cleanText(contact.id),
      customerCode: cleanText(contact.customerCode || contact.customerCod || contact.code),
      name: cleanText(contact.name || contact.contactName),
      phone: cleanText(contact.phone || contact.contactNumber || contact["contact#"]),
      email: cleanText(contact.email),
      workflowId: this.normalizeWorkflowId(contact.workflowId || this.getActiveWorkflowId()),
      workflowIds: this.getTargetWorkflowIds(contact),
      scopeAll: contact?.scopeAll === true || contact?.dataScope === "all"
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
          rows.forEach(row => merged.push(this.normalizeContact({ ...row, workflowId: row.workflowId || profile.id })));
        }
      });
      if (hasScopedData) {
        const legacy = LocalStorageAdapter.load(APP_CONFIG.localKeys.contacts, []);
        (Array.isArray(legacy) ? legacy : []).forEach(row => {
          const normalized = this.normalizeContact({ ...row, workflowId: row.workflowId || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase" });
          if (!scopedIds.has(normalized.workflowId)) merged.push(normalized);
        });
        return merged;
      }
    }

    const activeId = this.getActiveWorkflowId();
    const scoped = LocalStorageAdapter.load(this.getStorageKey(activeId), null);
    if (Array.isArray(scoped)) return scoped.map(c => this.normalizeContact({ ...c, workflowId: c.workflowId || activeId }));

    const legacy = LocalStorageAdapter.load(APP_CONFIG.localKeys.contacts, []);
    const normalized = (Array.isArray(legacy) ? legacy : []).map(c => this.normalizeContact({ ...c, workflowId: c.workflowId || APP_CONFIG.defaults.activeWorkflowId || "direct_purchase" }));
    const activeRows = normalized.filter(c => this.normalizeWorkflowId(c.workflowId) === activeId);
    if (activeRows.length) this.saveAll(activeRows, { workflowId: activeId });
    return activeRows;
  },

  saveAll(data, options = {}) {
    const activeId = this.normalizeWorkflowId(options.workflowId || this.getActiveWorkflowId());
    const rows = (Array.isArray(data) ? data : []).map(c => this.normalizeContact({ ...c, workflowId: c.workflowId || activeId }));

    if (options.allWorkflows) {
      this.getWorkflowProfiles().forEach(profile => {
        const bucket = rows.filter(c => this.normalizeWorkflowId(c.workflowId) === profile.id);
        LocalStorageAdapter.save(this.getStorageKey(profile.id), bucket);
      });
      LocalStorageAdapter.save(APP_CONFIG.localKeys.contacts, rows);
      return;
    }

    const rowKeys = new Set(rows.map(c => c.id || `${this.normalizeCodeKey(c.customerCode)}|${String(c.name || "").trim().toLowerCase()}`).filter(Boolean));
    const keyFor = c => c.id || `${this.normalizeCodeKey(c.customerCode)}|${String(c.name || "").trim().toLowerCase()}`;
    const allRows = this.getAll({ allWorkflows: true }).filter(c => {
      if (rowKeys.has(keyFor(c))) return false;
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
    LocalStorageAdapter.save(APP_CONFIG.localKeys.contacts, all);
  },

  searchByCustomer(customerCode, query) {
    const currentCustomerCode = this.normalizeCodeKey(customerCode);
    if (!currentCustomerCode) return [];
    const q = String(query || "").toLowerCase().trim();
    return this.getAll().map(c => this.normalizeContact(c)).filter(c =>
      this.normalizeCodeKey(c.customerCode) === currentCustomerCode &&
      (
        String(c.name || "").toLowerCase().includes(q) ||
        String(c.phone || "").toLowerCase().includes(q) ||
        String(c.email || "").toLowerCase().includes(q)
      )
    );
  },

  add(contact) {
    const all = this.getAll();
    const normalized = this.normalizeContact(contact);
    const newContact = { ...normalized, id: normalized.id || Utils.uid("ct") };
    all.push(newContact);
    this.saveAll(all);
    return newContact;
  },

  update(contactId, updates) {
    const all = this.getAll();
    const index = all.findIndex(c => c.id === contactId);
    if (index < 0) throw new Error("Contact not found.");
    all[index] = { ...all[index], ...updates };
    this.saveAll(all);
    return all[index];
  },

  countByCustomerCode(customerCode) {
    return this.getAll().filter(c => c.customerCode === customerCode).length;
  },

  reassignCustomerCode(oldCode, newCode) {
    if (!oldCode || !newCode || oldCode === newCode) return 0;
    const all = this.getAll();
    let changed = 0;
    all.forEach(contact => {
      if (contact.customerCode === oldCode) {
        contact.customerCode = newCode;
        changed += 1;
      }
    });
    if (changed) this.saveAll(all);
    return changed;
  },

  removeByCustomerCode(customerCode) {
    const all = this.getAll();
    const next = all.filter(c => c.customerCode !== customerCode);
    const removed = all.length - next.length;
    if (removed) this.saveAll(next);
    return removed;
  }
};

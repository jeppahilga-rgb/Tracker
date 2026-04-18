window.AuditTrail = {
  getAll() {
    return LocalStorageAdapter.load(APP_CONFIG.localKeys.audit, []);
  },

  saveAll(entries) {
    LocalStorageAdapter.save(APP_CONFIG.localKeys.audit, entries);
  },

  add(entry) {
    const all = this.getAll();
    all.push({
      id: Utils.uid("audit"),
      time: new Date().toISOString(),
      ...entry
    });
    this.saveAll(all);
    return all;
  },

  forQuotation(reference) {
    return this.getAll().filter(x => x.reference === reference);
  }
};
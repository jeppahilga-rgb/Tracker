window.QuotationWorkflow = {
  getSettings() {
    return LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {
      origins: APP_CONFIG.defaults.origins,
      statuses: APP_CONFIG.defaults.statuses,
      statusGroups: APP_CONFIG.defaults.statusGroups,
      originSalesMap: APP_CONFIG.defaults.originSalesMap
    });
  },

  getSalesByOrigin(origin, customerCode = "", originSalesMap = null) {
    const settings = this.getSettings();
    const map = originSalesMap && typeof originSalesMap === "object"
      ? originSalesMap
      : (settings.originSalesMap || {});
    const options = map[origin] || [];

    return options.map(name => {
      if (name === "Customer Code Based") return customerCode || "Select Customer First";
      return name;
    });
  }
};

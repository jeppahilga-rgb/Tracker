window.SearchFilter = {
  apply(quotations, filters) {
    return quotations.filter(q => {
      const search = (filters.search || "").toLowerCase().trim();
      const status = filters.status || "";
      const origin = filters.origin || "";
      const customer = filters.customer || "";

      const matchesSearch =
        !search ||
        (q.reference || "").toLowerCase().includes(search) ||
        (q.customerName || "").toLowerCase().includes(search) ||
        (q.customerCode || "").toLowerCase().includes(search) ||
        (q.contactName || "").toLowerCase().includes(search) ||
        (q.itemText || "").toLowerCase().includes(search);

      const matchesStatus = !status || q.status === status;
      const matchesOrigin = !origin || q.origin === origin;
      const matchesCustomer = !customer || (q.customerName || "").toLowerCase().includes(customer.toLowerCase());

      return matchesSearch && matchesStatus && matchesOrigin && matchesCustomer;
    });
  }
};
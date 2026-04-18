window.QuotationForm = {
  editingId: null,

  addItemRow(description = "", qty = "") {
    const wrap = document.getElementById("itemRows");
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <input type="text" class="item-desc" placeholder="Item description" value="${Utils.escapeHtml(description)}" />
      <input type="number" class="item-qty" placeholder="Qty" value="${Utils.escapeHtml(qty)}" />
      <button type="button" class="btn btn-danger btn-remove-item">Remove</button>
    `;
    wrap.appendChild(row);
    row.querySelector(".btn-remove-item").addEventListener("click", () => row.remove());
  },

  clearForm() {
    this.editingId = null;
    document.getElementById("quotationForm").reset();
    document.getElementById("targetDate").value = Utils.tomorrowISO();
    document.getElementById("dueDate").value = Utils.tomorrowISO();
    document.getElementById("itemRows").innerHTML = "";
    this.addItemRow();
    App.populateOrigins();
    App.populateStatuses();
    const workflowId = App.getActiveWorkflowId();
    const workflowEl = document.getElementById("quotationWorkflow");
    if (workflowEl) workflowEl.value = workflowId;
    this.syncSequenceForWorkflow(workflowId);
    App.populateSales();
    document.getElementById("saveLabel").textContent = "Save Quotation";
  },

  syncSequenceForWorkflow(workflowId) {
    if (this.editingId) return;
    const id = App.normalizeWorkflowId(workflowId || App.getActiveWorkflowId());
    const quotations = App.getQuotationsByWorkflow(id);
    const refCfg = App.getWorkflowReferenceConfig(id);
    document.getElementById("sn").value = Utils.nextSN(quotations);
    document.getElementById("reference").value = Utils.generateReference(quotations, refCfg);
  },

  loadForEdit(quotation) {
    if (!ApprovalWorkflow.canEdit(AppState.session, quotation)) {
      Toast.show("You cannot edit this quotation at its current stage.", "warning");
      return;
    }

    const workflowId = App.normalizeWorkflowId(quotation.workflowId || App.getActiveWorkflowId());
    if (workflowId !== App.getActiveWorkflowId()) {
      App.setActiveWorkflow(workflowId);
    }
    const workflowEl = document.getElementById("quotationWorkflow");
    if (workflowEl) workflowEl.value = workflowId;
    this.editingId = quotation.id;
    document.getElementById("sn").value = quotation.sn;
    document.getElementById("reference").value = quotation.reference;
    document.getElementById("targetDate").value = quotation.targetDate;
    document.getElementById("dueDate").value = quotation.dueDate;
    document.getElementById("customerCode").value = quotation.customerCode;
    document.getElementById("customerName").value = quotation.customerName;
    document.getElementById("pgType").value = quotation.pgType;
    document.getElementById("origin").value = quotation.origin;
    App.populateSales();
    document.getElementById("salesPerson").value = quotation.salesPerson;
    document.getElementById("rfq").value = quotation.rfq;
    document.getElementById("bid").value = quotation.bid;
    document.getElementById("quoteTime").value = quotation.quoteTime;
    document.getElementById("status").value = quotation.status;
    document.getElementById("contactName").value = quotation.contactName;
    document.getElementById("phone").value = quotation.phone;
    document.getElementById("email").value = quotation.email;
    document.getElementById("totalItems").value = quotation.totalItems;
    document.getElementById("totalValue").value = quotation.totalValue;
    document.getElementById("remarks").value = quotation.remarks;

    document.getElementById("itemRows").innerHTML = "";
    (quotation.items || []).forEach(item => this.addItemRow(item.description, item.qty));
    if (!quotation.items || !quotation.items.length) this.addItemRow();

    document.getElementById("saveLabel").textContent = "Update Quotation";
    App.openQuotationModal(false);
  },

  collectFormData() {
    const items = [...document.querySelectorAll(".item-row")].map(row => ({
      description: row.querySelector(".item-desc").value.trim(),
      qty: Number(row.querySelector(".item-qty").value || 0)
    }));

    return {
      id: this.editingId || Utils.uid("qtn"),
      workflowId: App.normalizeWorkflowId(document.getElementById("quotationWorkflow")?.value || App.getActiveWorkflowId()),
      sn: Number(document.getElementById("sn").value),
      reference: document.getElementById("reference").value.trim(),
      targetDate: document.getElementById("targetDate").value,
      dueDate: document.getElementById("dueDate").value,
      customerCode: document.getElementById("customerCode").value.trim(),
      customerName: document.getElementById("customerName").value.trim(),
      pgType: document.getElementById("pgType").value.trim(),
      origin: document.getElementById("origin").value,
      salesPerson: document.getElementById("salesPerson").value,
      rfq: document.getElementById("rfq").value.trim(),
      bid: document.getElementById("bid").value.trim(),
      quoteTime: document.getElementById("quoteTime").value,
      status: document.getElementById("status").value,
      contactName: document.getElementById("contactName").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      email: document.getElementById("email").value.trim(),
      totalItems: Number(document.getElementById("totalItems").value || 0),
      totalValue: Number(document.getElementById("totalValue").value || 0),
      remarks: document.getElementById("remarks").value.trim(),
      items,
      itemText: items.filter(i => i.description).map(i => `${i.description} QTY: ${i.qty}`).join("\n"),
      updatedAt: new Date().toISOString()
    };
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get("reference");
  const settings = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {});
  const profiles = Array.isArray(settings.workflowProfiles) && settings.workflowProfiles.length
    ? settings.workflowProfiles
    : (APP_CONFIG.defaults.workflowProfiles || []);
  const ids = profiles.map(p => String(p?.id || "").trim()).filter(Boolean);
  const bucketRows = [];
  let hasBuckets = false;
  ids.forEach(id => {
    const rows = LocalStorageAdapter.load(`${APP_CONFIG.localKeys.quotations}.${id}`, null);
    if (!Array.isArray(rows)) return;
    hasBuckets = true;
    rows.forEach(row => bucketRows.push({ ...row, workflowId: String(row?.workflowId || id).trim() || id }));
  });
  const quotations = hasBuckets
    ? bucketRows
    : (LocalStorageAdapter.load(APP_CONFIG.localKeys.quotations, []) || []);
  const q = quotations.find(x => x.reference === reference);

  const wrap = document.getElementById("printContent");
  if (!q) {
    wrap.innerHTML = "<p>Quotation not found.</p>";
    return;
  }

  const wfProfiles = Array.isArray(settings.workflowProfiles) ? settings.workflowProfiles : (APP_CONFIG.defaults.workflowProfiles || []);
  const wf = wfProfiles.find(p => String(p?.id || "").trim() === String(q?.workflowId || "").trim());
  const tagLabel = String(wf?.tagLabel || settings.tagLabel || APP_CONFIG.defaults.tagLabel || "Origin");
  const subTagLabel = String(wf?.subTagLabel || settings.subTagLabel || APP_CONFIG.defaults.subTagLabel || "Sub Tag");

  wrap.innerHTML = `
    <div class="print-block"><strong>Reference:</strong> ${Utils.escapeHtml(q.reference)}</div>
    <div class="print-block"><strong>Customer:</strong> ${Utils.escapeHtml(q.customerName)} (${Utils.escapeHtml(q.customerCode)})</div>
    <div class="print-block"><strong>PG:</strong> ${Utils.escapeHtml(q.pgType)}</div>
    <div class="print-block"><strong>${Utils.escapeHtml(tagLabel)}:</strong> ${Utils.escapeHtml(q.origin)}</div>
    <div class="print-block"><strong>${Utils.escapeHtml(subTagLabel)}:</strong> ${Utils.escapeHtml(q.salesPerson)}</div>
    <div class="print-block"><strong>RFQ:</strong> ${Utils.escapeHtml(q.rfq)}</div>
    <div class="print-block"><strong>Bid:</strong> ${Utils.escapeHtml(q.bid)}</div>
    <div class="print-block"><strong>Status:</strong> ${Utils.escapeHtml(q.status)}</div>
    <div class="print-block"><strong>Due Date:</strong> ${Utils.escapeHtml(q.dueDate)}</div>
    <div class="print-block"><strong>Contact:</strong> ${Utils.escapeHtml(q.contactName)}</div>
    <div class="print-block"><strong>Phone:</strong> ${Utils.escapeHtml(q.phone)}</div>
    <div class="print-block"><strong>Email:</strong> ${Utils.escapeHtml(q.email)}</div>
    <div class="print-block"><strong>Total Items:</strong> ${Utils.escapeHtml(q.totalItems)}</div>
    <div class="print-block"><strong>Total Value:</strong> ${Utils.escapeHtml(q.totalValue)}</div>
    <div class="print-block"><strong>Remarks:</strong><br>${Utils.escapeHtml(q.remarks).replace(/\n/g, "<br>")}</div>
    <div class="print-block"><strong>Items:</strong><br>${Utils.escapeHtml(q.itemText).replace(/\n/g, "<br>")}</div>
  `;
});

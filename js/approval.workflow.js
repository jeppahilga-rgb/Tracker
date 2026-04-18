window.ApprovalWorkflow = {
  getApprovals() {
    return LocalStorageAdapter.load(APP_CONFIG.localKeys.approvals, []);
  },

  saveApprovals(data) {
    LocalStorageAdapter.save(APP_CONFIG.localKeys.approvals, data);
  },

  canReview(session, quotation) {
    return session?.role === "reviewer" && quotation.status === "UNDER REVIEW";
  },

  canApprove(session, quotation) {
    return session?.role === "approver" && quotation.status === "FOR APPROVAL";
  },

  canEdit(session, quotation) {
    if (!session || !quotation) return false;
    if (session.role === "admin") return true;
    if (session.role === "auditor") return false;
    if (session.role === "reviewer" && quotation.status === "UNDER REVIEW") return false;
    if (session.role === "approver" && quotation.status === "FOR APPROVAL") return false;
    return true;
  },

  record(reference, action, by, role, remarks) {
    const all = this.getApprovals();
    all.push({
      id: Utils.uid("apr"),
      reference,
      action,
      by,
      role,
      remarks,
      time: new Date().toISOString()
    });
    this.saveApprovals(all);
    return all;
  },

  forReference(reference) {
    return this.getApprovals().filter(x => x.reference === reference);
  }
};
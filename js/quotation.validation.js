window.QuotationValidation = {
  validate(formData) {
    const errors = [];

    if (!formData.customerCode) errors.push("Customer Code is required.");
    if (!formData.customerName) errors.push("Customer Name is required.");
    if (!formData.bid) errors.push("Bid is required.");

    const hasItem = Array.isArray(formData.items) && formData.items.some(i => i.description.trim() !== "");
    if (!hasItem) errors.push("At least one item description is required.");

    const originNeedsRFQ = ["NUPCO", "Etimad", "E-Purchasing"];
    if (originNeedsRFQ.includes(formData.origin) && !formData.rfq) {
      errors.push(`RFQ is required for tag ${formData.origin}.`);
    }

    if (formData.email && !formData.email.includes("@")) {
      errors.push("Invalid email format.");
    }

    if (formData.phone && !/^[+0-9,\-\s:]+$/.test(formData.phone)) {
      errors.push("Invalid phone format.");
    }

    return errors;
  }
};

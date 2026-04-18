document.addEventListener("DOMContentLoaded", () => {
  const sessionRaw = localStorage.getItem("qt.session");
  if (!sessionRaw) {
    window.location.href = "index.html";
    return;
  }

  const session = JSON.parse(sessionRaw);
  if (session.role !== "admin") {
    window.location.href = "app.html";
    return;
  }
  document.getElementById("settingsSessionBadge").textContent = `${session.name} - ${session.role}`;

  const settings = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {
    workflowProfiles: APP_CONFIG.defaults.workflowProfiles,
    activeWorkflowId: APP_CONFIG.defaults.activeWorkflowId,
    tagLabel: APP_CONFIG.defaults.tagLabel,
    subTagLabel: APP_CONFIG.defaults.subTagLabel,
    customerSettings: APP_CONFIG.defaults.customerSettings,
    origins: APP_CONFIG.defaults.origins,
    statuses: APP_CONFIG.defaults.statuses,
    kanbanColumnMode: APP_CONFIG.defaults.kanbanColumnMode,
    statusGroups: APP_CONFIG.defaults.statusGroups,
    referenceFormula: APP_CONFIG.defaults.referenceFormula,
    referenceStartSequence: APP_CONFIG.defaults.referenceStartSequence,
    referenceSequencePad: APP_CONFIG.defaults.referenceSequencePad,
    formLayout: APP_CONFIG.defaults.formLayout,
    customerFormLayout: APP_CONFIG.defaults.customerFormLayout,
    formLayoutCanvas: APP_CONFIG.defaults.formLayoutCanvas,
    originSalesMap: APP_CONFIG.defaults.originSalesMap,
    ui: APP_CONFIG.defaults.ui,
    dashboardWidgets: APP_CONFIG.defaults.dashboardWidgets,
    dashboardWidgetTypes: APP_CONFIG.defaults.dashboardWidgetTypes,
    dashboardMaxWidgets: APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20,
    dashboardColumns: APP_CONFIG.defaults.dashboardColumns ?? 3,
    dashboardWidgetOrder: APP_CONFIG.defaults.dashboardWidgetOrder || []
  });

  const githubConfig = LocalStorageAdapter.load("qt.githubConfig", {
    storageMode: "local",
    repoOwner: "jep100820",
    repoName: "KanbanFlow-Project",
    branch: "main",
    token: "",
    apiEndpoint: ""
  });

  document.getElementById("storageMode").value = githubConfig.storageMode || "local";
  document.getElementById("githubRepoOwner").value = githubConfig.repoOwner || "";
  document.getElementById("githubRepoName").value = githubConfig.repoName || "";
  document.getElementById("githubBranch").value = githubConfig.branch || "main";
  document.getElementById("githubToken").value = githubConfig.token || "";
  document.getElementById("apiEndpoint").value = githubConfig.apiEndpoint || "";

  function backupSettingsToCloud(settingsPayload) {
    if (!(GitHubStorageAdapter.isEnabled() || GitHubStorageAdapter.isApiMode())) return;
    const changedAt = LocalStorageAdapter.getLastChangedAt(new Date().toISOString());
    GitHubStorageAdapter.syncSettings(settingsPayload)
      .then(() => GitHubStorageAdapter.syncMeta({
        schemaVersion: APP_CONFIG.schemaVersion,
        lastChangeAt: changedAt,
        backedUpAt: new Date().toISOString(),
        source: "browser-local"
      }))
      .catch(error => {
        console.error(error);
        Toast.show("Settings saved locally, but cloud backup failed.", "warning", 4500);
      });
  }

  const tagGroupRowsEl = document.getElementById("tagGroupRows");
  const statusGroupRowsEl = document.getElementById("statusGroupRows");
  const formLayoutRowsEl = document.getElementById("formLayoutRows");
  const formLayoutCanvasEl = document.getElementById("formLayoutCanvas");
  const formLayoutModalEl = document.getElementById("formLayoutModal");
  const layoutNoSelectionEl = document.getElementById("layoutNoSelection");
  const layoutFieldPropsEl = document.getElementById("layoutFieldProps");
  const layoutPropKeyEl = document.getElementById("layoutPropKey");
  const layoutPropLabelEl = document.getElementById("layoutPropLabel");
  const layoutPropTypeEl = document.getElementById("layoutPropType");
  const layoutPropVisibleEl = document.getElementById("layoutPropVisible");
  const layoutPropBorderEl = document.getElementById("layoutPropBorder");
  const layoutPropLockedEl = document.getElementById("layoutPropLocked");
  const layoutPropXEl = document.getElementById("layoutPropX");
  const layoutPropYEl = document.getElementById("layoutPropY");
  const layoutPropWEl = document.getElementById("layoutPropW");
  const layoutPropHEl = document.getElementById("layoutPropH");
  const formPreviewModalEl = document.getElementById("formPreviewModal");
  const formPreviewCanvasEl = document.getElementById("formPreviewCanvas");
  const workflowProfileSelectEl = document.getElementById("workflowProfileSelect");
  const workflowProfileInfoEl = document.getElementById("workflowProfileInfo");
  const dashboardWidgetRowsEl = document.getElementById("dashboardWidgetRows");
  const dashboardWidgetCountInfoEl = document.getElementById("dashboardWidgetCountInfo");
  const dashboardMaxWidgetsInputEl = document.getElementById("dashboardMaxWidgetsInput");
  const dashboardColumnsInputEl = document.getElementById("dashboardColumnsInput");
  const layoutTargetSelectEl = document.getElementById("layoutTargetSelect");
  const customerEntityNameEl = document.getElementById("customerEntityNameInput");
  const customerEntityPluralEl = document.getElementById("customerEntityPluralInput");
  const customerLabelInputs = {
    code: document.getElementById("customerLabelCodeInput"),
    nameAr: document.getElementById("customerLabelArabicInput"),
    name: document.getElementById("customerLabelNameInput"),
    website: document.getElementById("customerLabelWebsiteInput"),
    sector: document.getElementById("customerLabelSectorInput"),
    areaCode: document.getElementById("customerLabelAreaCodeInput"),
    vt: document.getElementById("customerLabelVtInput"),
    vendor: document.getElementById("customerLabelVendorInput"),
    remark: document.getElementById("customerLabelRemarkInput")
  };
  const customerColumnChecks = {
    code: document.getElementById("customerColumnCode"),
    nameAr: document.getElementById("customerColumnNameAr"),
    name: document.getElementById("customerColumnName"),
    website: document.getElementById("customerColumnWebsite"),
    sector: document.getElementById("customerColumnSector"),
    areaCode: document.getElementById("customerColumnAreaCode"),
    vt: document.getElementById("customerColumnVt"),
    vendor: document.getElementById("customerColumnVendor"),
    remark: document.getElementById("customerColumnRemark")
  };
  const settingsNavButtons = [...document.querySelectorAll(".settings-nav-btn")];
  const settingsSections = [...document.querySelectorAll(".settings-page-section")];
  const EDITOR_GRID_COLS = 24;
  const EDITOR_HALF_SPAN = 12;
  const EDITOR_FULL_SPAN = 24;
  const EDITOR_MAX_ROW_SPAN = 6;
  const EDITOR_MIN_CANVAS_WIDTH = 520;
  const EDITOR_MIN_CANVAS_HEIGHT = 300;
  const EDITOR_CANVAS_STEP = 10;
  const EDITOR_ROW_HEIGHT = 42;
  const EDITOR_COL_GAP = Number(LayoutEngine.FORM_COL_GAP) || 9;
  const EDITOR_MIN_COL_WIDTH = Number(LayoutEngine.MIN_FORM_COL_SIZE) || 24;
  function normalizeCanvasWidth(requestedWidth) {
    return LayoutEngine.normalizeCanvasWidth(requestedWidth, {
      gridCols: EDITOR_GRID_COLS,
      gap: EDITOR_COL_GAP,
      minColSize: EDITOR_MIN_COL_WIDTH,
      minCanvasWidth: EDITOR_MIN_CANVAS_WIDTH
    });
  }

  let currentLayoutTarget = "quotation";
  let draggingFormRow = null;
  let resizingFormRow = null;
  let formRowResizeStartX = 0;
  let selectedFormRow = null;
  const selectedFormRows = new Set();
  const canvasState = {
    activeRow: null,
    mode: "",
    startX: 0,
    startY: 0,
    origin: null,
    snapshot: null,
    guides: { v: [], h: [] },
    distance: { x: 0, y: 0, clientX: 0, clientY: 0, show: false }
  };
  const canvasSizeState = {
    width: normalizeCanvasWidth(Number(settings.formLayoutCanvas?.width) || Number(APP_CONFIG.defaults.formLayoutCanvas?.width) || 1000),
    height: Math.max(EDITOR_MIN_CANVAS_HEIGHT, Number(settings.formLayoutCanvas?.height) || Number(APP_CONFIG.defaults.formLayoutCanvas?.height) || 560),
    colSize: Math.max(
      EDITOR_MIN_COL_WIDTH,
      Number(settings.formLayoutCanvas?.colSize)
      || LayoutEngine.getCanvasMetrics(
        Number(settings.formLayoutCanvas?.width) || Number(APP_CONFIG.defaults.formLayoutCanvas?.width) || 1000,
        {
          gridCols: EDITOR_GRID_COLS,
          gap: EDITOR_COL_GAP,
          minColSize: EDITOR_MIN_COL_WIDTH,
          minCanvasWidth: EDITOR_MIN_CANVAS_WIDTH
        }
      ).colSize
    ),
    resizing: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0
  };
  const FORM_FIELD_LABELS = {
    quotation: {
      sn: "SN",
      reference: "Reference",
      targetDate: "Target Date",
      dueDate: "Due Date",
      customerCode: "Customer Code",
      customerName: "Customer Name",
      pgType: "PG",
      origin: "Tag",
      salesPerson: "Sub Tag",
      rfq: "RFQ",
      bid: "Bid",
      quoteTime: "Time",
      status: "Status",
      contactName: "Contact Name",
      phone: "Phone",
      email: "Email",
      contactSaveAction: "Contact Save Button",
      totalItems: "Total Items",
      totalValue: "Total Value",
      itemLines: "Item Lines",
      remarks: "Remarks",
      actions: "Form Actions"
    },
    customer: {
      custCode: "Customer Code",
      custName: "Customer Name",
      custNameAr: "Customer Name (Arabic)",
      custPgType: "PG Type",
      custWebsite: "Website",
      custSector: "Sector",
      custAreaCode: "Area Code",
      custVT: "V/T",
      custVendor: "Vendor",
      custRemark: "Remark",
      custActions: "Form Actions"
    }
  };
  const PREVIEW_TYPES = [
    { value: "auto", label: "Auto" },
    { value: "input", label: "Text Input" },
    { value: "select", label: "Dropdown" },
    { value: "textarea", label: "Textarea" },
    { value: "button", label: "Button" },
    { value: "display", label: "Display Only" }
  ];
  function getSelectedTagLabels() {
    const current = getSelectedWorkflow();
    const activeGroup = getActiveTagGroup(current || {});
    const tag = String(activeGroup?.name || current?.tagLabel || APP_CONFIG.defaults.tagLabel || "Origin").trim() || "Origin";
    const subTag = String(current?.subTagLabel || APP_CONFIG.defaults.subTagLabel || "Sub Tag").trim() || "Sub Tag";
    return { tag, subTag };
  }

  function getDashboardWidgetCatalog() {
    const labels = getSelectedTagLabels();
    return [
      { key: "status_distribution", title: "Status Distribution", category: "Distribution", chartTypes: ["bar", "pie", "donut", "line"] },
      { key: "origin_distribution", title: `${labels.tag} Distribution`, category: "Distribution", chartTypes: ["bar", "pie", "donut"] },
      { key: "sales_distribution", title: `${labels.subTag} Distribution`, category: "Distribution", chartTypes: ["bar", "pie", "donut"] },
      { key: "pg_distribution", title: "PG Distribution", category: "Distribution", chartTypes: ["bar", "pie", "donut"] },
      { key: "aging_overview", title: "Aging Overview", category: "KPI", chartTypes: ["cards", "bar", "pie", "donut"] },
      { key: "completion_ratio", title: "Completion Ratio", category: "KPI", chartTypes: ["cards", "bar", "pie", "donut"] },
      { key: "active_vs_completed", title: "Active vs Completed", category: "Comparison", chartTypes: ["bar", "pie", "donut"] },
      { key: "top_customers_by_count", title: "Top Customers by Count", category: "Ranking", chartTypes: ["bar", "pie", "donut", "line"] },
      { key: "top_customers_by_value", title: "Top Customers by Value", category: "Ranking", chartTypes: ["bar", "pie", "donut", "line"] },
      { key: "top_origins_by_value", title: `Top ${labels.tag}s by Value`, category: "Ranking", chartTypes: ["bar", "pie", "donut"] },
      { key: "top_sales_by_value", title: `Top ${labels.subTag}s by Value`, category: "Ranking", chartTypes: ["bar", "pie", "donut"] },
      { key: "avg_value_by_status", title: "Avg Value by Status", category: "Comparison", chartTypes: ["bar", "pie", "donut", "line"] },
      { key: "quotes_by_weekday", title: "Quotes by Weekday", category: "Trend", chartTypes: ["line", "bar"] },
      { key: "quotes_by_month_line", title: "Quotes by Month (Trend)", category: "Trend", chartTypes: ["line", "bar"] },
      { key: "weekly_activity_line", title: "Weekly Activity (Trend)", category: "Trend", chartTypes: ["line", "bar"] },
      { key: "status_count_value_combo", title: "Status Count + Value (Comparison)", category: "Comparison", chartTypes: ["combo", "bar", "line"] },
      { key: "recent_7day_created", title: "Recent 7 Days", category: "KPI", chartTypes: ["cards", "bar"] },
      { key: "zero_value_quotes", title: "Zero Value Quotes", category: "KPI", chartTypes: ["cards"] },
      { key: "high_value_quotes", title: "High Value Quotes", category: "KPI", chartTypes: ["cards"] },
      { key: "no_contact_quotes", title: "No Contact Quotes", category: "KPI", chartTypes: ["cards"] },
      { key: "approval_pipeline", title: "Approval Pipeline", category: "Comparison", chartTypes: ["bar", "pie", "donut", "line"] },
      { key: "due_soon_vs_later", title: "Due Soon vs Later", category: "Comparison", chartTypes: ["bar", "pie", "donut"] }
    ];
  }

  function normalizeDashboardWidgetTypes(inputMap) {
    const base = APP_CONFIG.defaults.dashboardWidgetTypes || {};
    const merged = { ...base, ...(inputMap && typeof inputMap === "object" ? inputMap : {}) };
    const catalog = getDashboardWidgetCatalog();
    const out = {};
    catalog.forEach(widget => {
      const allowed = Array.isArray(widget.chartTypes) && widget.chartTypes.length ? widget.chartTypes : ["bar"];
      const selected = String(merged[widget.key] || "").trim().toLowerCase();
      out[widget.key] = allowed.includes(selected) ? selected : allowed[0];
    });
    return out;
  }

  function applySelectedTagLabelsToEditor() {
    const labels = getSelectedTagLabels();
    FORM_FIELD_LABELS.quotation.origin = labels.tag;
    FORM_FIELD_LABELS.quotation.salesPerson = labels.subTag;
  }

  function defaultPreviewTypeForKey(key) {
    if (key === "actions" || key === "contactSaveAction" || key === "custActions") return "button";
    if (key === "remarks" || key === "itemLines" || key === "custRemark") return "textarea";
    if (key === "origin" || key === "status" || key === "salesPerson" || key === "custPgType") return "select";
    return "input";
  }

  function getLayoutDefaultsByTarget(target) {
    return target === "customer"
      ? (APP_CONFIG.defaults.customerFormLayout || [])
      : (APP_CONFIG.defaults.formLayout || []);
  }

  function getLayoutSettingKeyByTarget(target) {
    return target === "customer" ? "customerFormLayout" : "formLayout";
  }

  function getProfileLayout(profile, target) {
    const key = getLayoutSettingKeyByTarget(target);
    return Array.isArray(profile?.[key]) && profile[key].length
      ? profile[key]
      : (Array.isArray(settings?.[key]) && settings[key].length ? settings[key] : getLayoutDefaultsByTarget(target));
  }

  function getProfileCanvas(profile) {
    const canvas = profile?.formLayoutCanvas && typeof profile.formLayoutCanvas === "object"
      ? profile.formLayoutCanvas
      : (settings.formLayoutCanvas || APP_CONFIG.defaults.formLayoutCanvas || {});
    return {
      width: normalizeCanvasWidth(Number(canvas.width) || Number(APP_CONFIG.defaults.formLayoutCanvas?.width) || 1000),
      height: Math.max(EDITOR_MIN_CANVAS_HEIGHT, Number(canvas.height) || Number(APP_CONFIG.defaults.formLayoutCanvas?.height) || 560),
      colSize: Math.max(EDITOR_MIN_COL_WIDTH, Number(canvas.colSize) || canvasSizeState.colSize || EDITOR_MIN_COL_WIDTH)
    };
  }

  function getActiveFieldLabels() {
    return FORM_FIELD_LABELS[currentLayoutTarget] || FORM_FIELD_LABELS.quotation;
  }

  function cloneStatusGroups(groups) {
    const source = Array.isArray(groups) && groups.length
      ? groups
      : (APP_CONFIG.defaults.statusGroups || []);
    return source.map(group => ({
      name: String(group?.name || "").trim() || "WIP",
      substatuses: Array.isArray(group?.substatuses) && group.substatuses.length
        ? group.substatuses.map(s => String(s || "").trim()).filter(Boolean)
        : [String(group?.name || "WIP").trim()],
      isCompletion: Boolean(group?.isCompletion),
      showOnBoard: typeof group?.showOnBoard === "boolean" ? group.showOnBoard : true,
      columnView: ["default", "main", "sub"].includes(group?.columnView) ? group.columnView : "default",
      color: isHexColor(group?.color) ? String(group.color).trim() : "#2563eb",
      substatusColors: group?.substatusColors && typeof group.substatusColors === "object" ? { ...group.substatusColors } : {}
    }));
  }

  function normalizeCustomerSettings(input, fallback = {}) {
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
  }

  function normalizeOrigins(origins) {
    return [...new Set((Array.isArray(origins) ? origins : []).map(x => String(x || "").trim()).filter(Boolean))];
  }

  function slugifyTagGroupId(name) {
    const raw = String(name || "").toLowerCase().trim();
    const slug = raw.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return slug || `tag_group_${Date.now()}`;
  }

  function normalizeTagGroups(profile, fallbackTagLabel, fallbackMap, fallbackOrigins) {
    const input = Array.isArray(profile?.tagGroups) && profile.tagGroups.length
      ? profile.tagGroups
      : [{
          id: "origin",
          name: String(fallbackTagLabel || "Origin").trim() || "Origin",
          tags: normalizeOrigins(fallbackOrigins).map(tag => ({
            name: tag,
            subtags: Array.isArray(fallbackMap?.[tag]) ? fallbackMap[tag] : []
          }))
        }];

    const used = new Set();
    const out = input.map(group => {
      const rawName = String(group?.name || "").trim() || "Tag Group";
      let id = String(group?.id || "").trim() || slugifyTagGroupId(rawName);
      if (used.has(id)) id = `${id}_${used.size + 1}`;
      used.add(id);
      const tagsInput = Array.isArray(group?.tags) ? group.tags : [];
      const tags = tagsInput
        .map(t => ({
          name: String(t?.name || "").trim(),
          subtags: [...new Set((Array.isArray(t?.subtags) ? t.subtags : []).map(s => String(s || "").trim()).filter(Boolean))]
        }))
        .filter(t => t.name);
      return { id, name: rawName, tags };
    }).filter(g => g.name);

    return out.length ? out : [{ id: "origin", name: "Origin", tags: [] }];
  }

  function getActiveTagGroup(profile) {
    const groups = Array.isArray(profile?.tagGroups) ? profile.tagGroups : [];
    const activeId = String(profile?.activeTagGroupId || "").trim();
    return groups.find(g => g.id === activeId) || groups[0] || { id: "", name: "Origin", tags: [] };
  }

  function syncLegacyFromTagGroups(profile) {
    const active = getActiveTagGroup(profile);
    const tags = Array.isArray(active?.tags) ? active.tags : [];
    const map = {};
    tags.forEach(tag => {
      map[tag.name] = Array.isArray(tag.subtags) ? tag.subtags : [];
    });
    profile.activeTagGroupId = active?.id || profile.activeTagGroupId || "";
    profile.tagLabel = String(active?.name || profile.tagLabel || "Origin").trim() || "Origin";
    profile.origins = tags.map(t => t.name);
    profile.originSalesMap = map;
    return profile;
  }

  function slugifyWorkflowId(name) {
    const raw = String(name || "").toLowerCase().trim();
    const slug = raw.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return slug || `workflow_${Date.now()}`;
  }

  function makeUniqueWorkflowId(baseId, profiles, excludeId = "") {
    const used = new Set((profiles || []).map(p => String(p.id || "").trim()).filter(Boolean));
    if (excludeId) used.delete(String(excludeId || "").trim());
    let next = String(baseId || "").trim() || `workflow_${Date.now()}`;
    let i = 2;
    while (used.has(next)) {
      next = `${baseId}_${i}`;
      i += 1;
    }
    return next;
  }

  function normalizeWorkflowProfiles(inputProfiles) {
    const defaults = APP_CONFIG.defaults.workflowProfiles || [];
    const source = Array.isArray(inputProfiles) && inputProfiles.length ? inputProfiles : defaults;
    const out = [];
    source.forEach(profile => {
      const name = String(profile?.name || "").trim() || "New Tracker";
      const baseId = String(profile?.id || "").trim() || slugifyWorkflowId(name);
      const id = makeUniqueWorkflowId(baseId, out);
      const fallbackOrigins = normalizeOrigins(settings.origins || APP_CONFIG.defaults.origins || []);
      const origins = normalizeOrigins(profile?.origins || fallbackOrigins);
      const statusGroups = cloneStatusGroups(profile?.statusGroups || settings.statusGroups || APP_CONFIG.defaults.statusGroups);
      const referenceFormula = String(profile?.referenceFormula || settings.referenceFormula || APP_CONFIG.defaults.referenceFormula || "YYMMDD{SEQ}");
      const referenceStartSequence = Math.max(0, Number(profile?.referenceStartSequence ?? settings.referenceStartSequence ?? APP_CONFIG.defaults.referenceStartSequence ?? 6));
      const referenceSequencePad = Math.max(1, Number(profile?.referenceSequencePad ?? settings.referenceSequencePad ?? APP_CONFIG.defaults.referenceSequencePad ?? 2));
      const tagLabel = String(profile?.tagLabel || settings.tagLabel || APP_CONFIG.defaults.tagLabel || "Origin").trim() || "Origin";
      const subTagLabel = String(profile?.subTagLabel || settings.subTagLabel || APP_CONFIG.defaults.subTagLabel || "Sub Tag").trim() || "Sub Tag";
      const fallbackMap = settings.originSalesMap || APP_CONFIG.defaults.originSalesMap || {};
      const originSalesMap = profile?.originSalesMap && typeof profile.originSalesMap === "object"
        ? { ...profile.originSalesMap }
        : { ...fallbackMap };
      const customerSettings = normalizeCustomerSettings(
        profile?.customerSettings || settings.customerSettings || APP_CONFIG.defaults.customerSettings,
        APP_CONFIG.defaults.customerSettings
      );
      const tagGroups = normalizeTagGroups(profile, tagLabel, originSalesMap, origins);
      const activeTagGroupId = tagGroups.some(g => g.id === String(profile?.activeTagGroupId || "").trim())
        ? String(profile.activeTagGroupId).trim()
        : tagGroups[0].id;
      const normalizedProfile = {
        id,
        name,
        tagLabel,
        subTagLabel,
        origins,
        statusGroups,
        referenceFormula,
        referenceStartSequence,
        referenceSequencePad,
        originSalesMap,
        tagGroups,
        activeTagGroupId,
        customerSettings,
        formLayout: Array.isArray(profile?.formLayout) && profile.formLayout.length
          ? profile.formLayout.map(row => ({ ...row }))
          : (Array.isArray(settings.formLayout) ? settings.formLayout.map(row => ({ ...row })) : (APP_CONFIG.defaults.formLayout || [])),
        customerFormLayout: Array.isArray(profile?.customerFormLayout) && profile.customerFormLayout.length
          ? profile.customerFormLayout.map(row => ({ ...row }))
          : (Array.isArray(settings.customerFormLayout) ? settings.customerFormLayout.map(row => ({ ...row })) : (APP_CONFIG.defaults.customerFormLayout || [])),
        formLayoutCanvas: profile?.formLayoutCanvas && typeof profile.formLayoutCanvas === "object"
          ? { ...profile.formLayoutCanvas }
          : { ...(settings.formLayoutCanvas || APP_CONFIG.defaults.formLayoutCanvas || {}) },
        dashboardWidgets: Array.isArray(profile?.dashboardWidgets)
          ? [...profile.dashboardWidgets]
          : [...(settings.dashboardWidgets || APP_CONFIG.defaults.dashboardWidgets || [])],
        dashboardWidgetTypes: profile?.dashboardWidgetTypes && typeof profile.dashboardWidgetTypes === "object"
          ? { ...profile.dashboardWidgetTypes }
          : { ...(settings.dashboardWidgetTypes || APP_CONFIG.defaults.dashboardWidgetTypes || {}) },
        dashboardWidgetOrder: Array.isArray(profile?.dashboardWidgetOrder)
          ? [...profile.dashboardWidgetOrder]
          : [...(settings.dashboardWidgetOrder || APP_CONFIG.defaults.dashboardWidgetOrder || [])],
        dashboardMaxWidgets: Math.max(1, Math.min(50, Number(profile?.dashboardMaxWidgets ?? settings.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20) || 20)),
        dashboardColumns: [2, 3, 4].includes(Number(profile?.dashboardColumns ?? settings.dashboardColumns))
          ? Number(profile?.dashboardColumns ?? settings.dashboardColumns)
          : Number(APP_CONFIG.defaults.dashboardColumns || 3),
        pages: {
          customers: profile?.pages?.customers !== false,
          archived: profile?.pages?.archived !== false
        }
      };
      out.push(syncLegacyFromTagGroups(normalizedProfile));
    });
    if (!out.length) {
      const fallbackProfile = {
        id: "direct_purchase",
        name: "Direct Purchase Quotation",
        tagLabel: String(settings.tagLabel || APP_CONFIG.defaults.tagLabel || "Origin"),
        subTagLabel: String(settings.subTagLabel || APP_CONFIG.defaults.subTagLabel || "Sub Tag"),
        origins: normalizeOrigins(settings.origins || APP_CONFIG.defaults.origins || []),
        statusGroups: cloneStatusGroups(settings.statusGroups || APP_CONFIG.defaults.statusGroups),
        referenceFormula: String(settings.referenceFormula || APP_CONFIG.defaults.referenceFormula || "YYMMDD{SEQ}"),
        referenceStartSequence: Math.max(0, Number(settings.referenceStartSequence ?? APP_CONFIG.defaults.referenceStartSequence ?? 6)),
        referenceSequencePad: Math.max(1, Number(settings.referenceSequencePad ?? APP_CONFIG.defaults.referenceSequencePad ?? 2)),
        originSalesMap: { ...(settings.originSalesMap || APP_CONFIG.defaults.originSalesMap || {}) },
        customerSettings: normalizeCustomerSettings(settings.customerSettings || APP_CONFIG.defaults.customerSettings, APP_CONFIG.defaults.customerSettings),
        formLayout: Array.isArray(settings.formLayout) ? settings.formLayout.map(row => ({ ...row })) : (APP_CONFIG.defaults.formLayout || []),
        customerFormLayout: Array.isArray(settings.customerFormLayout) ? settings.customerFormLayout.map(row => ({ ...row })) : (APP_CONFIG.defaults.customerFormLayout || []),
        formLayoutCanvas: { ...(settings.formLayoutCanvas || APP_CONFIG.defaults.formLayoutCanvas || {}) },
        dashboardWidgets: Array.isArray(settings.dashboardWidgets) ? [...settings.dashboardWidgets] : [...(APP_CONFIG.defaults.dashboardWidgets || [])],
        dashboardWidgetTypes: { ...(settings.dashboardWidgetTypes || APP_CONFIG.defaults.dashboardWidgetTypes || {}) },
        dashboardWidgetOrder: Array.isArray(settings.dashboardWidgetOrder) ? [...settings.dashboardWidgetOrder] : [...(APP_CONFIG.defaults.dashboardWidgetOrder || [])],
        dashboardMaxWidgets: Math.max(1, Math.min(50, Number(settings.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20) || 20)),
        dashboardColumns: [2, 3, 4].includes(Number(settings.dashboardColumns)) ? Number(settings.dashboardColumns) : Number(APP_CONFIG.defaults.dashboardColumns || 3),
        pages: {
          customers: settings.pages?.customers !== false,
          archived: settings.pages?.archived !== false
        },
        tagGroups: [],
        activeTagGroupId: ""
      };
      fallbackProfile.tagGroups = normalizeTagGroups(fallbackProfile, fallbackProfile.tagLabel, fallbackProfile.originSalesMap, fallbackProfile.origins);
      fallbackProfile.activeTagGroupId = fallbackProfile.tagGroups[0].id;
      out.push(syncLegacyFromTagGroups(fallbackProfile));
    }
    return out;
  }

  let workflowProfiles = normalizeWorkflowProfiles(settings.workflowProfiles);
  let activeWorkflowId = workflowProfiles.some(p => p.id === settings.activeWorkflowId)
    ? settings.activeWorkflowId
    : workflowProfiles[0].id;
  let selectedWorkflowId = activeWorkflowId;

  function activateSettingsSection(sectionId) {
    const requested = String(sectionId || "").trim().toLowerCase();
    const key = requested === "tracker-setup" ? "tracker" : requested;
    const normalized = settingsSections.some(s => s.dataset.section === key)
      ? key
      : (settingsSections[0]?.dataset.section || "storage");
    settingsSections.forEach(section => {
      section.classList.toggle("is-active", section.dataset.section === normalized);
    });
    settingsNavButtons.forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.target === normalized);
    });
    localStorage.setItem("qt.settingsActiveSection", normalized);
    initSectionAccordions(normalized);
  }

  function initSectionAccordions(sectionId) {
    const section = settingsSections.find(s => s.dataset.section === sectionId);
    if (!section) return;
    const accordions = [...section.querySelectorAll(".settings-section-accordion")];
    if (!accordions.length) return;

    accordions.forEach((accordion, index) => {
      if (accordion.dataset.accInit === "1") return;
      accordion.dataset.accInit = "1";
      accordion.addEventListener("toggle", () => {
        if (!accordion.open) return;
        accordions.forEach(other => {
          if (other !== accordion) other.open = false;
        });
      });
      if (index > 0) accordion.open = false;
    });

    const openOne = accordions.find(a => a.open) || accordions[0];
    accordions.forEach(a => { a.open = a === openOne; });
  }

  function getSelectedWorkflow() {
    return workflowProfiles.find(p => p.id === selectedWorkflowId) || workflowProfiles[0];
  }

  function renderSettingsWorkflowTabs() {
    const wrap = document.getElementById("settingsWorkflowTabs");
    if (!wrap) return;
    wrap.innerHTML = workflowProfiles.map(profile => `
      <button
        type="button"
        class="tracker-tab ${profile.id === selectedWorkflowId ? "is-active" : ""}"
        data-workflow-id="${Utils.escapeHtml(profile.id)}"
        title="${profile.id === activeWorkflowId ? "Active tracker" : "Edit tracker"}"
      >${Utils.escapeHtml(profile.name)}</button>
    `).join("");
    wrap.querySelectorAll(".tracker-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        saveCurrentProfileEditorsToState();
        selectedWorkflowId = btn.dataset.workflowId;
        loadSelectedWorkflowIntoEditors();
        settings.dashboardWidgetOrder = collectDashboardWidgetOrder();
        renderDashboardWidgets(collectDashboardWidgets(), collectDashboardWidgetTypes());
      });
    });
  }

  function renderWorkflowProfileUI() {
    if (!workflowProfileSelectEl) return;
    workflowProfileSelectEl.innerHTML = workflowProfiles
      .map(profile => `<option value="${Utils.escapeHtml(profile.id)}">${Utils.escapeHtml(profile.name)}</option>`)
      .join("");
    if (!workflowProfiles.some(p => p.id === selectedWorkflowId)) {
      selectedWorkflowId = workflowProfiles[0]?.id || "";
    }
    workflowProfileSelectEl.value = selectedWorkflowId;
    const active = workflowProfiles.find(p => p.id === activeWorkflowId) || workflowProfiles[0];
    if (workflowProfileInfoEl) {
      workflowProfileInfoEl.textContent = `Active tracker: ${active?.name || "-"}`;
    }
    renderSettingsWorkflowTabs();
  }

  function saveCurrentProfileEditorsToState() {
    const current = getSelectedWorkflow();
    if (!current) return;
    current.subTagLabel = String(current?.subTagLabel || APP_CONFIG.defaults.subTagLabel || "Sub Tag").trim() || "Sub Tag";
    const tagGroupState = collectTagGroups();
    current.tagGroups = tagGroupState.groups;
    current.activeTagGroupId = tagGroupState.activeTagGroupId;
    current.statusGroups = collectStatusGroups();
    current.customerSettings = readCustomerSettingsFromUI(current.customerSettings);
    current.referenceFormula = document.getElementById("referenceFormulaInput").value.trim() || APP_CONFIG.defaults.referenceFormula;
    current.referenceStartSequence = Number(document.getElementById("referenceStartInput").value || APP_CONFIG.defaults.referenceStartSequence);
    current.referenceSequencePad = Number(document.getElementById("referencePadInput").value || APP_CONFIG.defaults.referenceSequencePad);
    current.pages = {
      customers: document.getElementById("trackerShowCustomers")?.checked !== false,
      archived: document.getElementById("trackerShowArchived")?.checked !== false
    };
    const layoutKey = getLayoutSettingKeyByTarget(currentLayoutTarget);
    current[layoutKey] = collectFormLayout();
    current.formLayoutCanvas = {
      width: canvasSizeState.width,
      height: canvasSizeState.height,
      colSize: canvasSizeState.colSize
    };
    current.dashboardWidgets = collectDashboardWidgets();
    current.dashboardWidgetTypes = collectDashboardWidgetTypes();
    current.dashboardWidgetOrder = collectDashboardWidgetOrder();
    current.dashboardMaxWidgets = getDashboardMaxWidgets();
    current.dashboardColumns = [2, 3, 4].includes(Number(dashboardColumnsInputEl?.value))
      ? Number(dashboardColumnsInputEl.value)
      : Number(current.dashboardColumns || APP_CONFIG.defaults.dashboardColumns || 3);
    syncLegacyFromTagGroups(current);
  }

  function loadSelectedWorkflowIntoEditors() {
    const current = getSelectedWorkflow();
    if (!current) return;
    if (!Array.isArray(current.tagGroups) || !current.tagGroups.length) {
      current.tagGroups = normalizeTagGroups(current, current.tagLabel, current.originSalesMap, current.origins);
    }
    current.activeTagGroupId = current.tagGroups.some(g => g.id === current.activeTagGroupId)
      ? current.activeTagGroupId
      : current.tagGroups[0].id;
    syncLegacyFromTagGroups(current);
    applySelectedTagLabelsToEditor();
    renderTagGroups(current.tagGroups || [], current.activeTagGroupId);
    renderStatusGroups(current.statusGroups || []);
    applyCustomerSettingsToUI(current.customerSettings || settings.customerSettings || APP_CONFIG.defaults.customerSettings);
    document.getElementById("referenceFormulaInput").value = current.referenceFormula || APP_CONFIG.defaults.referenceFormula;
    document.getElementById("referenceStartInput").value = Number.isFinite(Number(current.referenceStartSequence))
      ? Number(current.referenceStartSequence)
      : APP_CONFIG.defaults.referenceStartSequence;
    document.getElementById("referencePadInput").value = Number.isFinite(Number(current.referenceSequencePad))
      ? Number(current.referenceSequencePad)
      : APP_CONFIG.defaults.referenceSequencePad;
    const pageConfig = current.pages && typeof current.pages === "object" ? current.pages : {};
    const showCustomersEl = document.getElementById("trackerShowCustomers");
    const showArchivedEl = document.getElementById("trackerShowArchived");
    if (showCustomersEl) showCustomersEl.checked = pageConfig.customers !== false;
    if (showArchivedEl) showArchivedEl.checked = pageConfig.archived !== false;
    settings.dashboardWidgets = Array.isArray(current.dashboardWidgets) ? current.dashboardWidgets : APP_CONFIG.defaults.dashboardWidgets;
    settings.dashboardWidgetTypes = current.dashboardWidgetTypes && typeof current.dashboardWidgetTypes === "object" ? current.dashboardWidgetTypes : APP_CONFIG.defaults.dashboardWidgetTypes;
    settings.dashboardWidgetOrder = Array.isArray(current.dashboardWidgetOrder) ? current.dashboardWidgetOrder : APP_CONFIG.defaults.dashboardWidgetOrder || [];
    settings.dashboardMaxWidgets = Math.max(1, Math.min(50, Number(current.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20) || 20));
    settings.dashboardColumns = [2, 3, 4].includes(Number(current.dashboardColumns)) ? Number(current.dashboardColumns) : Number(APP_CONFIG.defaults.dashboardColumns || 3);
    if (dashboardMaxWidgetsInputEl) dashboardMaxWidgetsInputEl.value = String(settings.dashboardMaxWidgets);
    if (dashboardColumnsInputEl) dashboardColumnsInputEl.value = String(settings.dashboardColumns);
    renderDashboardWidgets(settings.dashboardWidgets || [], settings.dashboardWidgetTypes || {});
    const profileCanvas = getProfileCanvas(current);
    canvasSizeState.width = profileCanvas.width;
    canvasSizeState.height = profileCanvas.height;
    canvasSizeState.colSize = profileCanvas.colSize;
    renderFormLayout(getProfileLayout(current, currentLayoutTarget));
    renderWorkflowProfileUI();
  }

  function readCustomerSettingsFromUI(fallback = {}) {
    const labels = {
      code: customerLabelInputs.code?.value.trim() || fallback?.labels?.code || APP_CONFIG.defaults.customerSettings?.labels?.code || "Customer Code",
      nameAr: customerLabelInputs.nameAr?.value.trim() || fallback?.labels?.nameAr || APP_CONFIG.defaults.customerSettings?.labels?.nameAr || "Customer Name (Arabic)",
      name: customerLabelInputs.name?.value.trim() || fallback?.labels?.name || APP_CONFIG.defaults.customerSettings?.labels?.name || "Customer Name",
      website: customerLabelInputs.website?.value.trim() || fallback?.labels?.website || APP_CONFIG.defaults.customerSettings?.labels?.website || "Web Site",
      sector: customerLabelInputs.sector?.value.trim() || fallback?.labels?.sector || APP_CONFIG.defaults.customerSettings?.labels?.sector || "Sector",
      areaCode: customerLabelInputs.areaCode?.value.trim() || fallback?.labels?.areaCode || APP_CONFIG.defaults.customerSettings?.labels?.areaCode || "Area Code",
      vt: customerLabelInputs.vt?.value.trim() || fallback?.labels?.vt || APP_CONFIG.defaults.customerSettings?.labels?.vt || "V/T",
      vendor: customerLabelInputs.vendor?.value.trim() || fallback?.labels?.vendor || APP_CONFIG.defaults.customerSettings?.labels?.vendor || "Vendor #",
      remark: customerLabelInputs.remark?.value.trim() || fallback?.labels?.remark || APP_CONFIG.defaults.customerSettings?.labels?.remark || "Remarks"
    };
    const columns = {
      code: customerColumnChecks.code?.checked !== false,
      nameAr: customerColumnChecks.nameAr?.checked !== false,
      name: customerColumnChecks.name?.checked !== false,
      website: customerColumnChecks.website?.checked !== false,
      sector: customerColumnChecks.sector?.checked !== false,
      areaCode: customerColumnChecks.areaCode?.checked !== false,
      vt: customerColumnChecks.vt?.checked !== false,
      vendor: customerColumnChecks.vendor?.checked !== false,
      remark: customerColumnChecks.remark?.checked !== false
    };
    return normalizeCustomerSettings({
      entityName: customerEntityNameEl?.value.trim() || fallback?.entityName || APP_CONFIG.defaults.customerSettings?.entityName || "Customer",
      entityNamePlural: customerEntityPluralEl?.value.trim() || fallback?.entityNamePlural || APP_CONFIG.defaults.customerSettings?.entityNamePlural || "Customers",
      labels,
      columns,
      required: fallback?.required || APP_CONFIG.defaults.customerSettings?.required || { code: true, name: true }
    }, fallback);
  }

  function applyCustomerSettingsToUI(customerSettings) {
    const schema = normalizeCustomerSettings(customerSettings, APP_CONFIG.defaults.customerSettings);
    if (customerEntityNameEl) customerEntityNameEl.value = schema.entityName || "Customer";
    if (customerEntityPluralEl) customerEntityPluralEl.value = schema.entityNamePlural || "Customers";
    Object.entries(customerLabelInputs).forEach(([key, el]) => {
      if (el) el.value = schema.labels?.[key] || "";
    });
    Object.entries(customerColumnChecks).forEach(([key, el]) => {
      if (el) el.checked = schema.columns?.[key] !== false;
    });
  }

  function isHexColor(value) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || "").trim());
  }

  function readRowSubstatusColors(row) {
    try {
      const parsed = JSON.parse(row.dataset.substatusColors || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function getRowStatuses(row) {
    return [...row.querySelectorAll(".substatus-name")]
      .map(input => input.value.trim())
      .filter(Boolean);
  }

  function buildSubstatusPreview(list) {
    const statuses = Array.isArray(list) ? list.filter(Boolean) : [];
    if (!statuses.length) return "No sub-statuses";
    const shown = statuses.slice(0, 3).join(", ");
    const remaining = statuses.length - 3;
    return remaining > 0 ? `${shown} +${remaining} more` : shown;
  }

  function syncRowSubstatusColors(row) {
    const inheritedColor = row.querySelector(".status-group-color").value || "#2563eb";
    const mapping = {};
    row.querySelectorAll(".substatus-item").forEach(item => {
      const name = item.querySelector(".substatus-name").value.trim();
      if (!name) return;
      const rawColor = item.querySelector(".substatus-color").value;
      mapping[name] = isHexColor(rawColor) ? rawColor : inheritedColor;
    });
    row.dataset.substatusColors = JSON.stringify(mapping);
    return mapping;
  }

  function refreshSubstatusMoveButtons(row) {
    const items = [...row.querySelectorAll(".substatus-item")];
    items.forEach((item, index) => {
      const up = item.querySelector(".substatus-move-up");
      const down = item.querySelector(".substatus-move-down");
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === items.length - 1;
    });
  }

  function refreshStatusGroupMoveButtons() {
    const rows = [...statusGroupRowsEl.querySelectorAll(".settings-accordion-row")];
    rows.forEach((row, index) => {
      const up = row.querySelector(".status-group-move-up");
      const down = row.querySelector(".status-group-move-down");
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === rows.length - 1;
    });
  }

  function moveSubstatusItem(row, item, direction) {
    const target = direction < 0 ? item.previousElementSibling : item.nextElementSibling;
    if (!target) return;
    if (direction < 0) {
      item.parentElement.insertBefore(item, target);
    } else {
      item.parentElement.insertBefore(target, item);
    }
    syncRowSubstatusColors(row);
    refreshSubstatusMoveButtons(row);
  }

  function addSubstatusItem(row, name = "", color = "") {
    const boxes = row.querySelector(".status-substatus-boxes");
    const inheritedColor = row.querySelector(".status-group-color").value || "#2563eb";
    const safeColor = isHexColor(color) ? color : inheritedColor;
    const item = document.createElement("div");
    item.className = "substatus-item";
    item.innerHTML = `
      <input type="text" class="substatus-name" placeholder="Sub-status name" value="${Utils.escapeHtml(name)}" />
      <input type="color" class="substatus-color" value="${Utils.escapeHtml(safeColor)}" title="Sub-status color" />
      <button type="button" class="btn btn-secondary btn-sm substatus-move-up" title="Move up">Up</button>
      <button type="button" class="btn btn-secondary btn-sm substatus-move-down" title="Move down">Down</button>
      <button type="button" class="btn btn-danger btn-sm substatus-remove">x</button>
    `;
    boxes.appendChild(item);

    item.querySelector(".substatus-name").addEventListener("input", () => syncRowSubstatusColors(row));
    item.querySelector(".substatus-color").addEventListener("input", () => syncRowSubstatusColors(row));
    item.querySelector(".substatus-move-up").addEventListener("click", () => moveSubstatusItem(row, item, -1));
    item.querySelector(".substatus-move-down").addEventListener("click", () => moveSubstatusItem(row, item, 1));
    item.querySelector(".substatus-remove").addEventListener("click", () => {
      item.remove();
      syncRowSubstatusColors(row);
      refreshSubstatusMoveButtons(row);
    });
    refreshSubstatusMoveButtons(row);
  }

  function addStatusGroupRow(name = "", substatuses = [], isCompletion = false, showOnBoard = true, columnView = "default", color = "#2563eb", substatusColors = {}) {
    const safeView = ["default", "main", "sub"].includes(columnView) ? columnView : "default";
    const safeColor = isHexColor(color) ? color : "#2563eb";
    const row = document.createElement("div");
    row.className = "settings-map-row settings-accordion-row";
    row.dataset.substatusColors = JSON.stringify(substatusColors || {});
    row.innerHTML = `
      <details class="status-accordion" open>
        <summary class="status-accordion-head">
          <span class="status-accordion-title">${Utils.escapeHtml(name || "New Status")}</span>
          <span class="status-accordion-meta">${(substatuses || []).length || 0} sub-statuses</span>
        </summary>
        <div class="status-accordion-body">
          <div class="status-group-top">
            <input type="text" class="status-group-name" placeholder="Main column (e.g. WIP)" value="${Utils.escapeHtml(name)}" />
            <select class="status-group-view">
              <option value="default" ${safeView === "default" ? "selected" : ""}>Follow board switch</option>
              <option value="main" ${safeView === "main" ? "selected" : ""}>Show main status</option>
              <option value="sub" ${safeView === "sub" ? "selected" : ""}>Show sub-statuses</option>
            </select>
            <input type="color" class="status-group-color" value="${Utils.escapeHtml(safeColor)}" title="Column color" />
            <label class="checkbox-inline"><input type="checkbox" class="status-group-show" ${showOnBoard ? "checked" : ""} /> Show Column</label>
            <label class="checkbox-inline"><input type="checkbox" class="status-group-completion" ${isCompletion ? "checked" : ""} /> End Group</label>
            <button type="button" class="btn btn-secondary btn-sm status-group-move-up" title="Move status group up">Up</button>
            <button type="button" class="btn btn-secondary btn-sm status-group-move-down" title="Move status group down">Down</button>
            <button type="button" class="btn btn-danger btn-sm status-group-remove">Remove</button>
          </div>
          <div class="status-substatus-wrap">
            <div class="status-substatus-boxes"></div>
            <button type="button" class="btn btn-secondary btn-sm substatus-add">+ Add Substatus</button>
          </div>
        </div>
      </details>
    `;
    statusGroupRowsEl.appendChild(row);

    const nameInput = row.querySelector(".status-group-name");
    const titleEl = row.querySelector(".status-accordion-title");
    const metaEl = row.querySelector(".status-accordion-meta");

    function refreshAccordionHead() {
      const statuses = getRowStatuses(row);
      titleEl.textContent = nameInput.value.trim() || "New Status";
      metaEl.textContent = buildSubstatusPreview(statuses);
    }

    nameInput.addEventListener("input", refreshAccordionHead);
    row.addEventListener("input", e => {
      if (e.target.classList.contains("substatus-name")) refreshAccordionHead();
    });

    row.querySelector(".status-group-remove").addEventListener("click", () => {
      row.remove();
      refreshStatusGroupMoveButtons();
    });
    row.querySelector(".status-group-move-up").addEventListener("click", () => {
      const previous = row.previousElementSibling;
      if (!previous) return;
      statusGroupRowsEl.insertBefore(row, previous);
      refreshStatusGroupMoveButtons();
    });
    row.querySelector(".status-group-move-down").addEventListener("click", () => {
      const next = row.nextElementSibling;
      if (!next) return;
      statusGroupRowsEl.insertBefore(next, row);
      refreshStatusGroupMoveButtons();
    });
    row.querySelector(".substatus-add").addEventListener("click", () => {
      addSubstatusItem(row, "", row.querySelector(".status-group-color").value || safeColor);
      syncRowSubstatusColors(row);
      refreshAccordionHead();
      refreshSubstatusMoveButtons(row);
    });

    const initialStatuses = Array.isArray(substatuses) && substatuses.length ? substatuses : [""];
    const storedColors = readRowSubstatusColors(row);
    initialStatuses.forEach(status => {
      const pickedColor = storedColors[status] || safeColor;
      addSubstatusItem(row, status, pickedColor);
    });
    syncRowSubstatusColors(row);
    refreshSubstatusMoveButtons(row);
    refreshAccordionHead();

    row.querySelector(".status-group-color").addEventListener("input", () => {
      const inherited = row.querySelector(".status-group-color").value || "#2563eb";
      row.querySelectorAll(".substatus-item").forEach(item => {
        const statusName = item.querySelector(".substatus-name").value.trim();
        const currentColor = item.querySelector(".substatus-color").value;
        const map = readRowSubstatusColors(row);
        const expected = map[statusName];
        if (!isHexColor(currentColor) || (!expected && currentColor)) {
          item.querySelector(".substatus-color").value = inherited;
        }
      });
      syncRowSubstatusColors(row);
    });
    refreshStatusGroupMoveButtons();
  }

  function renderStatusGroups(groups) {
    statusGroupRowsEl.innerHTML = "";
    const list = Array.isArray(groups) && groups.length ? groups : (APP_CONFIG.defaults.statusGroups || []);
    list.forEach(group => addStatusGroupRow(
      group.name,
      group.substatuses,
      Boolean(group.isCompletion),
      typeof group.showOnBoard === "boolean" ? group.showOnBoard : true,
      group.columnView || "default",
      group.color || "#2563eb",
      group.substatusColors || {}
    ));
    if (!statusGroupRowsEl.children.length) addStatusGroupRow();
  }

  function collectStatusGroups() {
    const rows = [...statusGroupRowsEl.querySelectorAll(".settings-accordion-row")];
    const groups = [];
    rows.forEach(row => {
      const name = row.querySelector(".status-group-name").value.trim();
      const substatuses = getRowStatuses(row);
      const isCompletion = row.querySelector(".status-group-completion").checked;
      const showOnBoard = row.querySelector(".status-group-show").checked;
      const columnViewRaw = row.querySelector(".status-group-view").value;
      const columnView = ["default", "main", "sub"].includes(columnViewRaw) ? columnViewRaw : "default";
      const colorValue = row.querySelector(".status-group-color").value;
      const color = isHexColor(colorValue) ? colorValue : "#2563eb";
      if (!name) return;
      groups.push({
        name,
        substatuses: substatuses.length ? substatuses : [name],
        isCompletion,
        showOnBoard,
        columnView,
        color,
        substatusColors: syncRowSubstatusColors(row)
      });
    });
    return groups;
  }

  function addTagItemToGroup(groupRow, tag = { name: "", subtags: [] }) {
    const labels = getSelectedTagLabels();
    const tagListEl = groupRow.querySelector(".tg-tags-list");
    const item = document.createElement("div");
    item.className = "settings-map-row tg-tag-card";
    item.innerHTML = `
      <div class="tg-tag-head">
        <input type="text" class="tg-tag-name" placeholder="${Utils.escapeHtml(`${labels.tag} value`)}" value="${Utils.escapeHtml(tag?.name || "")}" />
        <button type="button" class="btn btn-danger btn-sm tg-tag-remove">Remove</button>
      </div>
      <div class="settings-box-list-wrap tg-subtag-wrap">
        <div class="settings-box-list tg-subtags-list"></div>
        <button type="button" class="btn btn-secondary btn-sm tg-subtag-add">+ Add ${Utils.escapeHtml(labels.subTag)}</button>
      </div>
    `;
    tagListEl.appendChild(item);
    const subtagsList = item.querySelector(".tg-subtags-list");

    const addSubtag = value => {
      const box = document.createElement("div");
      box.className = "settings-box-item";
      box.innerHTML = `
        <input type="text" class="settings-box-input" placeholder="${Utils.escapeHtml(`${labels.subTag} name`)}" value="${Utils.escapeHtml(value || "")}" />
        <button type="button" class="btn btn-danger btn-sm settings-box-remove">x</button>
      `;
      subtagsList.appendChild(box);
      box.querySelector(".settings-box-remove").addEventListener("click", () => box.remove());
    };

    item.querySelector(".tg-subtag-add").addEventListener("click", () => addSubtag(""));
    (Array.isArray(tag?.subtags) && tag.subtags.length ? tag.subtags : [""]).forEach(addSubtag);
    item.querySelector(".tg-tag-remove").addEventListener("click", () => item.remove());
  }

  function addTagGroupRow(group = { id: "", name: "Origin", tags: [] }, isActive = false) {
    const row = document.createElement("div");
    row.className = "settings-map-row settings-accordion-row";
    const groupId = String(group?.id || "").trim() || slugifyTagGroupId(group?.name || "Tag Group");
    row.dataset.groupId = groupId;
    row.innerHTML = `
      <details class="status-accordion" open>
        <summary class="status-accordion-head">
          <span class="status-accordion-title tg-head-title">${Utils.escapeHtml(group?.name || "Tag Group")}</span>
          <span class="status-accordion-meta tg-head-meta">${Array.isArray(group?.tags) ? group.tags.length : 0} tags</span>
          <button type="button" class="btn btn-danger btn-sm tg-remove-head">Remove</button>
        </summary>
        <div class="status-accordion-body">
          <div class="origin-accordion-top">
            <input type="text" class="tg-name" placeholder="Tag Group Name (e.g. Origin, Inventory)" value="${Utils.escapeHtml(group?.name || "")}" />
            <label class="checkbox-inline"><input type="radio" name="activeTagGroup" class="tg-active" ${isActive ? "checked" : ""} /> Active on Form</label>
          </div>
          <div class="tg-tags-list"></div>
          <button type="button" class="btn btn-secondary btn-sm tg-tag-add">+ Add Tag</button>
        </div>
      </details>
    `;
    tagGroupRowsEl.appendChild(row);

    const refreshHead = () => {
      const title = row.querySelector(".tg-head-title");
      const meta = row.querySelector(".tg-head-meta");
      const name = row.querySelector(".tg-name").value.trim();
      const preview = [...row.querySelectorAll(".settings-map-row.tg-tag-card")]
        .map(tagRow => {
          const tagName = String(tagRow.querySelector(".tg-tag-name")?.value || "").trim();
          if (!tagName) return "";
          const subtags = [...tagRow.querySelectorAll(".tg-subtags-list .settings-box-input")]
            .map(input => String(input.value || "").trim())
            .filter(Boolean);
          if (!subtags.length) return tagName;
          const shown = subtags.slice(0, 2).join(", ");
          const more = subtags.length > 2 ? ` +${subtags.length - 2}` : "";
          return `${tagName}: ${shown}${more}`;
        })
        .filter(Boolean)
        .join(" | ");
      title.textContent = name || "Tag Group";
      meta.textContent = preview || `${row.querySelectorAll(".tg-tag-name").length} tags`;
    };

    row.querySelector(".tg-name").addEventListener("input", refreshHead);
    row.querySelector(".tg-tag-add").addEventListener("click", () => {
      addTagItemToGroup(row, { name: "", subtags: [] });
      refreshHead();
    });
    row.querySelector(".tg-remove-head").addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      row.remove();
    });
    row.addEventListener("input", e => {
      if (e.target.classList.contains("tg-tag-name")) refreshHead();
    });
    (Array.isArray(group?.tags) ? group.tags : []).forEach(tag => addTagItemToGroup(row, tag));
    if (!row.querySelectorAll(".tg-tag-name").length) addTagItemToGroup(row, { name: "", subtags: [] });
    refreshHead();
  }

  function renderTagGroups(groups, activeId) {
    tagGroupRowsEl.innerHTML = "";
    const list = Array.isArray(groups) && groups.length ? groups : [{ id: "origin", name: "Origin", tags: [] }];
    list.forEach((group, index) => addTagGroupRow(group, String(group.id || "") === String(activeId || "") || (!activeId && index === 0)));
  }

  function collectTagGroups() {
    const rows = [...tagGroupRowsEl.querySelectorAll(".settings-accordion-row")];
    const groups = rows.map((row, index) => {
      const name = String(row.querySelector(".tg-name")?.value || "").trim() || `Tag Group ${index + 1}`;
      const id = String(row.dataset.groupId || "").trim() || slugifyTagGroupId(name);
      const tags = [...row.querySelectorAll(".settings-map-row.tg-tag-card")]
        .map(tagRow => {
          const tagName = String(tagRow.querySelector(".tg-tag-name")?.value || "").trim();
          const subtags = [...tagRow.querySelectorAll(".tg-subtags-list .settings-box-input")]
            .map(input => String(input.value || "").trim())
            .filter(Boolean);
          if (!tagName) return null;
          return { name: tagName, subtags };
        })
        .filter(Boolean);
      return { id, name, tags };
    }).filter(group => group.name);
    const activeRadio = tagGroupRowsEl.querySelector(".tg-active:checked");
    const activeRow = activeRadio ? activeRadio.closest(".settings-accordion-row") : rows[0];
    const activeTagGroupId = String(activeRow?.dataset?.groupId || groups[0]?.id || "").trim();
    return { groups, activeTagGroupId };
  }

  function updateDashboardWidgetCount() {
    if (!dashboardWidgetCountInfoEl) return;
    const selected = collectDashboardWidgets();
    const limit = getDashboardMaxWidgets();
    dashboardWidgetCountInfoEl.textContent = `${selected.length} selected of ${limit}.`;
  }

  function getDashboardMaxWidgets() {
    const fallback = Number(settings.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20);
    const inputValue = Number(dashboardMaxWidgetsInputEl?.value);
    const value = Number.isFinite(inputValue) ? inputValue : fallback;
    return Math.max(1, Math.min(50, Number(value) || 20));
  }

  function normalizeDashboardWidgetOrder(orderInput) {
    const catalogKeys = getDashboardWidgetCatalog().map(w => w.key);
    const set = new Set(catalogKeys);
    const base = Array.isArray(orderInput) ? orderInput.map(x => String(x || "").trim()).filter(x => set.has(x)) : [];
    const out = [...new Set(base)];
    catalogKeys.forEach(key => {
      if (!out.includes(key)) out.push(key);
    });
    return out;
  }

  function renderDashboardWidgets(selectedKeys, typeMapInput = settings.dashboardWidgetTypes || {}) {
    if (!dashboardWidgetRowsEl) return;
    const selectedSet = new Set(Array.isArray(selectedKeys) ? selectedKeys : []);
    const widgetCatalog = getDashboardWidgetCatalog();
    const typeMap = normalizeDashboardWidgetTypes(typeMapInput);
    const order = normalizeDashboardWidgetOrder(settings.dashboardWidgetOrder || []);
    const orderIndex = new Map(order.map((k, i) => [k, i + 1]));
    const chartTypeLabel = {
      cards: "Cards",
      bar: "Bar",
      pie: "Pie",
      donut: "Donut",
      line: "Line",
      combo: "Combo"
    };
    const categoryOrder = ["Trend", "Comparison", "Distribution", "Ranking", "KPI"];
    const grouped = {};
    widgetCatalog.forEach(widget => {
      const category = String(widget.category || "Other");
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(widget);
    });
    const sortedCategories = [...new Set([...categoryOrder, ...Object.keys(grouped)])].filter(cat => (grouped[cat] || []).length);

    dashboardWidgetRowsEl.innerHTML = sortedCategories.map(category => `
      <details class="dashboard-purpose-accordion" ${category === "Trend" ? "open" : ""}>
        <summary>
          <span>${Utils.escapeHtml(category)}</span>
          <small>${(grouped[category] || []).length} visuals</small>
        </summary>
        <div class="dashboard-widget-group-grid">
          ${(grouped[category] || []).sort((a, b) => (orderIndex.get(a.key) || 9999) - (orderIndex.get(b.key) || 9999)).map(widget => `
            <label class="dashboard-widget-option">
              <div class="dashboard-widget-option-head">
                <input type="checkbox" class="dashboard-widget-check" value="${Utils.escapeHtml(widget.key)}" ${selectedSet.has(widget.key) ? "checked" : ""} />
                <span>${Utils.escapeHtml(widget.title)}</span>
              </div>
              <div class="dashboard-widget-option-body">
                <label class="dashboard-widget-type-label">
                  Sequence
                  <input type="number" min="1" class="dashboard-widget-seq" data-widget-key="${Utils.escapeHtml(widget.key)}" value="${orderIndex.get(widget.key) || 1}" />
                </label>
                <label class="dashboard-widget-type-label">
                  Chart Type
                  <select class="dashboard-widget-type" data-widget-key="${Utils.escapeHtml(widget.key)}" ${selectedSet.has(widget.key) ? "" : "disabled"}>
                    ${(widget.chartTypes || ["bar"]).map(type => `
                      <option value="${Utils.escapeHtml(type)}" ${String(typeMap[widget.key] || "") === type ? "selected" : ""}>
                        ${Utils.escapeHtml(chartTypeLabel[type] || type)}
                      </option>
                    `).join("")}
                  </select>
                </label>
              </div>
            </label>
          `).join("")}
        </div>
      </details>
    `).join("");
    dashboardWidgetRowsEl.querySelectorAll(".dashboard-purpose-accordion").forEach(acc => {
      acc.addEventListener("toggle", () => {
        if (!acc.open) return;
        dashboardWidgetRowsEl.querySelectorAll(".dashboard-purpose-accordion").forEach(other => {
          if (other !== acc) other.open = false;
        });
      });
    });
    dashboardWidgetRowsEl.querySelectorAll(".dashboard-widget-check").forEach(chk => {
      chk.addEventListener("change", () => {
        const limit = getDashboardMaxWidgets();
        const selected = collectDashboardWidgets();
        if (selected.length > limit) {
          chk.checked = false;
          Toast.show(`Maximum ${limit} dashboard visuals.`, "warning", 2500);
        }
        const widgetBox = chk.closest(".dashboard-widget-option");
        const typeSelect = widgetBox?.querySelector(".dashboard-widget-type");
        if (typeSelect) typeSelect.disabled = !chk.checked;
        updateDashboardWidgetCount();
      });
    });
    dashboardWidgetRowsEl.querySelectorAll(".dashboard-widget-type").forEach(sel => {
      sel.addEventListener("change", () => updateDashboardWidgetCount());
    });
    dashboardWidgetRowsEl.querySelectorAll(".dashboard-widget-seq").forEach(inp => {
      inp.addEventListener("change", () => {
        const val = Math.max(1, Number(inp.value || 1));
        inp.value = String(val);
      });
    });
    updateDashboardWidgetCount();
  }

  function collectDashboardWidgets() {
    return [...(dashboardWidgetRowsEl?.querySelectorAll(".dashboard-widget-check:checked") || [])]
      .map(el => el.value)
      .filter(Boolean);
  }

  function collectDashboardWidgetTypes() {
    const map = normalizeDashboardWidgetTypes(settings.dashboardWidgetTypes || {});
    [...(dashboardWidgetRowsEl?.querySelectorAll(".dashboard-widget-type") || [])].forEach(sel => {
      const key = String(sel.dataset.widgetKey || "").trim();
      const value = String(sel.value || "").trim().toLowerCase();
      if (!key) return;
      map[key] = value;
    });
    return map;
  }

  function collectDashboardWidgetOrder() {
    const catalog = getDashboardWidgetCatalog();
    const catalogSet = new Set(catalog.map(w => w.key));
    const rows = [...(dashboardWidgetRowsEl?.querySelectorAll(".dashboard-widget-seq") || [])]
      .map(inp => ({
        key: String(inp.dataset.widgetKey || "").trim(),
        seq: Math.max(1, Number(inp.value || 1))
      }))
      .filter(x => catalogSet.has(x.key))
      .sort((a, b) => a.seq - b.seq)
      .map(x => x.key);
    return normalizeDashboardWidgetOrder(rows);
  }

  function normalizeFormLayout(layoutInput) {
    return LayoutEngine.normalize(currentLayoutTarget, layoutInput);
  }

  function ensureLayoutCoordinates(layout) {
    const prepared = Array.isArray(layout) ? layout.map(item => ({ ...item })) : [];
    let row = 1;
    let nextCol = 1;
    prepared.forEach(item => {
      const defaultSpan = item.width === "full" ? EDITOR_FULL_SPAN : EDITOR_HALF_SPAN;
      const colSpan = Math.min(EDITOR_GRID_COLS, Math.max(1, Number(item.colSpan) || defaultSpan));
      const rowSpan = Math.min(EDITOR_MAX_ROW_SPAN, Math.max(1, Number(item.rowSpan) || 1));
      let col = Math.min(EDITOR_GRID_COLS, Math.max(1, Number(item.col) || 0));
      let r = Math.max(1, Number(item.row) || 0);

      if (!Number(item.col) || !Number(item.row)) {
        if (item.width === "full") {
          col = 1;
          r = row;
          row += rowSpan;
          nextCol = 1;
        } else if (nextCol === 1) {
          col = 1;
          r = row;
          nextCol = EDITOR_HALF_SPAN + 1;
        } else {
          col = EDITOR_HALF_SPAN + 1;
          r = row;
          row += rowSpan;
          nextCol = 1;
        }
      }

      if (col + colSpan - 1 > EDITOR_GRID_COLS) col = Math.max(1, (EDITOR_GRID_COLS + 1) - colSpan);
      item.col = col;
      item.row = r;
      item.colSpan = colSpan;
      item.rowSpan = rowSpan;
      item.width = colSpan >= EDITOR_FULL_SPAN ? "full" : "half";
    });
    return prepared;
  }

  function moveFormLayoutRow(row, direction) {
    const rows = [...formLayoutRowsEl.querySelectorAll(".form-layout-row")];
    const index = rows.indexOf(row);
    if (index < 0) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    const target = rows[targetIndex];
    if (direction === "up") formLayoutRowsEl.insertBefore(row, target);
    else formLayoutRowsEl.insertBefore(target, row);
    refreshFormLayoutOrder();
  }

  function bindFormLayoutDrag(row) {
    row.draggable = true;
    row.addEventListener("dragstart", () => {
      if (resizingFormRow) return;
      draggingFormRow = row;
      row.classList.add("is-dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("is-dragging");
      draggingFormRow = null;
      [...formLayoutRowsEl.querySelectorAll(".form-layout-row")].forEach(r => r.classList.remove("drag-over"));
      refreshFormLayoutOrder();
    });
    row.addEventListener("dragover", e => {
      e.preventDefault();
      if (!draggingFormRow || draggingFormRow === row) return;
      row.classList.add("drag-over");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
    row.addEventListener("drop", e => {
      e.preventDefault();
      row.classList.remove("drag-over");
      if (!draggingFormRow || draggingFormRow === row) return;
      const rows = [...formLayoutRowsEl.querySelectorAll(".form-layout-row")];
      const fromIndex = rows.indexOf(draggingFormRow);
      const toIndex = rows.indexOf(row);
      if (fromIndex < 0 || toIndex < 0) return;
      if (fromIndex < toIndex) formLayoutRowsEl.insertBefore(draggingFormRow, row.nextSibling);
      else formLayoutRowsEl.insertBefore(draggingFormRow, row);
      refreshFormLayoutOrder();
    });
  }

  document.addEventListener("mousemove", e => {
    if (!resizingFormRow) return;
    const delta = e.clientX - formRowResizeStartX;
    if (Math.abs(delta) < 14) return;
    setFormLayoutRowWidth(resizingFormRow, delta > 0 ? "full" : "half");
  });

  document.addEventListener("mousemove", e => {
    if (!canvasState.activeRow || !canvasState.origin) return;
    const { trackWidth, rowHeight } = getCanvasMetrics();
    const dx = e.clientX - canvasState.startX;
    const dy = e.clientY - canvasState.startY;
    const dc = Math.round(dx / trackWidth);
    const dr = Math.round(dy / rowHeight);
    const origin = canvasState.origin;
    if (canvasState.mode === "move") {
      const maxStartCol = Math.max(1, (EDITOR_GRID_COLS + 1) - origin.colSpan);
      const nextCol = Math.min(maxStartCol, Math.max(1, origin.col + dc));
      const nextRow = Math.max(1, origin.row + dr);
      setRowLayout(canvasState.activeRow, { col: nextCol, row: nextRow }, { suppressRender: true, suppressCollision: true });
      canvasState.distance = { x: dx, y: dy, clientX: e.clientX, clientY: e.clientY, show: true };
      updateCanvasGuides(canvasState.activeRow);
      renderFormLayoutCanvas();
      return;
    }
    if (canvasState.mode === "resize") {
      const nextColSpan = Math.min(EDITOR_GRID_COLS - origin.col + 1, Math.max(1, origin.colSpan + dc));
      const nextRowSpan = Math.min(EDITOR_MAX_ROW_SPAN, Math.max(1, origin.rowSpan + dr));
      setRowLayout(canvasState.activeRow, { colSpan: nextColSpan, rowSpan: nextRowSpan }, { suppressRender: true });
      canvasState.distance = { x: dx, y: dy, clientX: e.clientX, clientY: e.clientY, show: true };
      resolveLayoutCollisions(canvasState.activeRow);
      updateCanvasGuides(canvasState.activeRow);
      renderFormLayoutCanvas();
    }
  });

  document.addEventListener("mousemove", e => {
    if (!canvasSizeState.resizing) return;
    const dx = e.clientX - canvasSizeState.startX;
    const dy = e.clientY - canvasSizeState.startY;
    const nextWidth = canvasSizeState.startWidth + dx;
    const nextHeight = canvasSizeState.startHeight + dy;
    setCanvasSize(nextWidth, nextHeight);
  });

  document.addEventListener("mouseup", () => {
    if (!resizingFormRow) return;
    resizingFormRow.classList.remove("is-resizing");
    resizingFormRow = null;
  });

  document.addEventListener("mouseup", e => {
    if (canvasState.activeRow && formLayoutCanvasEl) {
      const rect = formLayoutCanvasEl.getBoundingClientRect();
      const insideCanvas = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!insideCanvas && canvasState.snapshot) {
        applyLayoutSnapshot(canvasState.snapshot);
      } else if (insideCanvas && canvasState.mode === "move") {
        const targetRow = findNearestFreeRowFor(canvasState.activeRow);
        setRowLayout(canvasState.activeRow, { row: targetRow }, { suppressRender: true, suppressCollision: true });
      }
    }
    canvasState.activeRow = null;
    canvasState.mode = "";
    canvasState.origin = null;
    canvasState.snapshot = null;
    canvasState.distance = { x: 0, y: 0, clientX: 0, clientY: 0, show: false };
    clearCanvasGuides();
    renderFormLayoutCanvas();
  });

  document.addEventListener("mouseup", () => {
    canvasSizeState.resizing = false;
  });

  function refreshFormLayoutOrder() {
    [...formLayoutRowsEl.querySelectorAll(".form-layout-row")].forEach((row, index) => {
      const badge = row.querySelector(".form-order");
      if (badge) badge.textContent = String(index + 1);
    });
    renderFormLayoutCanvas();
  }

  function isRowLocked(row) {
    return row?.dataset?.locked === "true";
  }

  function updateRowSelectionClasses() {
    [...formLayoutRowsEl.querySelectorAll(".form-layout-row")].forEach(item => {
      item.classList.toggle("is-selected", item === selectedFormRow);
      item.classList.toggle("is-multi-selected", selectedFormRows.has(item.dataset.key));
    });
  }

  function selectFormLayoutRow(row, options = {}) {
    const additive = Boolean(options.additive);
    if (!row) {
      selectedFormRow = null;
      selectedFormRows.clear();
      updateRowSelectionClasses();
      syncSelectedFieldPanel();
      renderFormLayoutCanvas();
      return;
    }
    if (additive) {
      const key = row.dataset.key;
      if (selectedFormRows.has(key)) selectedFormRows.delete(key);
      else selectedFormRows.add(key);
      selectedFormRow = row;
    } else {
      selectedFormRow = row;
      selectedFormRows.clear();
      selectedFormRows.add(row.dataset.key);
    }
    if (!canvasState.activeRow) clearCanvasGuides();
    updateRowSelectionClasses();
    syncSelectedFieldPanel();
    renderFormLayoutCanvas();
  }

  function getSelectedRowsForAlign() {
    const map = new Map([...formLayoutRowsEl.querySelectorAll(".form-layout-row")].map(r => [r.dataset.key, r]));
    const keys = selectedFormRows.size ? [...selectedFormRows] : (selectedFormRow ? [selectedFormRow.dataset.key] : []);
    return keys.map(key => map.get(key)).filter(row => row && !isRowLocked(row));
  }

  function alignSelectedRows(mode) {
    const rows = getSelectedRowsForAlign();
    if (rows.length < 2) {
      Toast.show("Select at least 2 unlocked fields (Ctrl+click).", "info", 2200);
      return;
    }
    const layouts = rows.map(rowEl => ({ rowEl, ...getRowLayoutData(rowEl) }));
    const left = Math.min(...layouts.map(x => x.col));
    const right = Math.max(...layouts.map(x => x.col + x.colSpan - 1));
    const top = Math.min(...layouts.map(x => x.row));
    const bottom = Math.max(...layouts.map(x => x.row + x.rowSpan - 1));
    const center = Math.round((left + right) / 2);
    const middle = Math.round((top + bottom) / 2);

    layouts.forEach(item => {
      if (mode === "left") item.col = left;
      if (mode === "right") item.col = Math.max(1, right - item.colSpan + 1);
      if (mode === "center") item.col = Math.max(1, center - Math.floor(item.colSpan / 2));
      if (mode === "top") item.row = top;
      if (mode === "bottom") item.row = Math.max(1, bottom - item.rowSpan + 1);
      if (mode === "middle") item.row = Math.max(1, middle - Math.floor(item.rowSpan / 2));
      if (item.col + item.colSpan - 1 > EDITOR_GRID_COLS) item.col = Math.max(1, (EDITOR_GRID_COLS + 1) - item.colSpan);
      setRowLayout(item.rowEl, { col: item.col, row: item.row }, { suppressRender: true, suppressCollision: true, force: true });
    });
    renderFormLayoutCanvas();
  }

  function syncSelectedFieldPanel() {
    if (!layoutFieldPropsEl || !layoutNoSelectionEl) return;
    const row = selectedFormRow;
    if (!row) {
      layoutNoSelectionEl.classList.remove("hidden");
      layoutFieldPropsEl.classList.add("hidden");
      return;
    }
    layoutNoSelectionEl.classList.add("hidden");
    layoutFieldPropsEl.classList.remove("hidden");
    if (layoutPropKeyEl) layoutPropKeyEl.value = row.dataset.key || "";
    if (layoutPropLabelEl) layoutPropLabelEl.value = String(row.querySelector(".layout-label")?.value || "");
    if (layoutPropTypeEl) layoutPropTypeEl.value = row.dataset.previewType || "auto";
    if (layoutPropVisibleEl) layoutPropVisibleEl.checked = !row.classList.contains("is-hidden-field");
    if (layoutPropBorderEl) layoutPropBorderEl.checked = row.dataset.fieldBorder !== "false";
    if (layoutPropLockedEl) layoutPropLockedEl.checked = row.dataset.locked === "true";
    if (layoutPropXEl) {
      layoutPropXEl.max = String(EDITOR_GRID_COLS);
      layoutPropXEl.value = String(Number(row.dataset.col) || 1);
    }
    if (layoutPropYEl) layoutPropYEl.value = String(Number(row.dataset.row) || 1);
    if (layoutPropWEl) {
      layoutPropWEl.max = String(EDITOR_GRID_COLS);
      layoutPropWEl.value = String(Number(row.dataset.colSpan) || EDITOR_HALF_SPAN);
    }
    if (layoutPropHEl) {
      layoutPropHEl.max = String(EDITOR_MAX_ROW_SPAN);
      layoutPropHEl.value = String(Number(row.dataset.rowSpan) || 1);
    }
  }

  function bindFieldPropsPanel() {
    if (!layoutFieldPropsEl) return;
    const applyXYWH = () => {
      if (!selectedFormRow) return;
      setRowLayout(selectedFormRow, {
        col: Math.min(EDITOR_GRID_COLS, Math.max(1, Number(layoutPropXEl?.value) || 1)),
        row: Math.max(1, Number(layoutPropYEl?.value) || 1),
        colSpan: Math.min(EDITOR_GRID_COLS, Math.max(1, Number(layoutPropWEl?.value) || EDITOR_HALF_SPAN)),
        rowSpan: Math.min(EDITOR_MAX_ROW_SPAN, Math.max(1, Number(layoutPropHEl?.value) || 1))
      });
      syncSelectedFieldPanel();
    };
    layoutPropLabelEl?.addEventListener("input", () => {
      if (!selectedFormRow) return;
      const input = selectedFormRow.querySelector(".layout-label");
      if (input) input.value = layoutPropLabelEl.value;
      const baseLabel = getActiveFieldLabels()[selectedFormRow.dataset.key] || selectedFormRow.dataset.key;
      const next = layoutPropLabelEl.value.trim() || baseLabel;
      selectedFormRow.dataset.label = next;
      selectedFormRow.querySelector(".form-layout-title").textContent = next;
      selectedFormRow.querySelector(".layout-preview-label").textContent = next;
      renderFormLayoutCanvas();
    });
    layoutPropTypeEl?.addEventListener("change", () => {
      if (!selectedFormRow) return;
      const select = selectedFormRow.querySelector(".layout-preview-type");
      if (select) select.value = layoutPropTypeEl.value;
      selectedFormRow.dataset.previewType = layoutPropTypeEl.value || "auto";
      renderFormLayoutCanvas();
    });
    layoutPropVisibleEl?.addEventListener("change", () => {
      if (!selectedFormRow) return;
      const chk = selectedFormRow.querySelector(".layout-visible");
      if (chk) chk.checked = layoutPropVisibleEl.checked;
      setFormLayoutRowVisible(selectedFormRow, layoutPropVisibleEl.checked);
    });
    layoutPropBorderEl?.addEventListener("change", () => {
      if (!selectedFormRow) return;
      selectedFormRow.dataset.fieldBorder = layoutPropBorderEl.checked ? "true" : "false";
      renderFormLayoutCanvas();
    });
    layoutPropLockedEl?.addEventListener("change", () => {
      if (!selectedFormRow) return;
      selectedFormRow.dataset.locked = layoutPropLockedEl.checked ? "true" : "false";
      renderFormLayoutCanvas();
    });
    [layoutPropXEl, layoutPropYEl, layoutPropWEl, layoutPropHEl].forEach(el => {
      el?.addEventListener("input", applyXYWH);
    });
  }

  function setFormLayoutRowWidth(row, width, updateSpan = true, resolveCollision = true) {
    const normalized = width === "full" ? "full" : "half";
    row.dataset.width = normalized;
    row.classList.toggle("width-full", normalized === "full");
    row.querySelectorAll(".layout-width-btn").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.width === normalized);
    });
    const widthLabel = row.querySelector(".layout-width-label");
    if (widthLabel) widthLabel.textContent = normalized === "full" ? "Width: Full" : "Width: Half";
    const spanInput = row.querySelector(".layout-colspan");
    if (spanInput && updateSpan && !spanInput.dataset.manual) {
      spanInput.value = normalized === "full" ? String(EDITOR_FULL_SPAN) : String(EDITOR_HALF_SPAN);
      row.dataset.colSpan = spanInput.value;
    }
    if (resolveCollision) resolveLayoutCollisions(row);
    renderFormLayoutCanvas();
  }

  function setFormLayoutRowVisible(row, visible) {
    row.classList.toggle("is-hidden-field", !visible);
    renderFormLayoutCanvas();
  }

  function getCanvasMetrics() {
    const metrics = LayoutEngine.getCanvasMetrics(canvasSizeState.width, {
      gridCols: EDITOR_GRID_COLS,
      gap: EDITOR_COL_GAP,
      minColSize: EDITOR_MIN_COL_WIDTH,
      minCanvasWidth: EDITOR_MIN_CANVAS_WIDTH,
      fixedColSize: canvasSizeState.colSize
    });
    const rowHeight = EDITOR_ROW_HEIGHT;
    return {
      width: metrics.width,
      colWidth: metrics.colSize,
      colGap: metrics.colGap,
      trackWidth: metrics.trackSize,
      rowHeight
    };
  }

  function setCanvasSize(width, height) {
    canvasSizeState.width = normalizeCanvasWidth(Math.round((Number(width) || 1000) / EDITOR_CANVAS_STEP) * EDITOR_CANVAS_STEP);
    canvasSizeState.height = Math.max(EDITOR_MIN_CANVAS_HEIGHT, Math.round((Number(height) || 560) / EDITOR_CANVAS_STEP) * EDITOR_CANVAS_STEP);
    document.getElementById("formCanvasWidthInput").value = String(canvasSizeState.width);
    document.getElementById("formCanvasHeightInput").value = String(canvasSizeState.height);
    renderFormLayoutCanvas();
  }

  function getRowRect(row, metrics) {
    const col = Number(row.dataset.col) || 1;
    const y = Number(row.dataset.row) || 1;
    const colSpan = Number(row.dataset.colSpan) || EDITOR_HALF_SPAN;
    const rowSpan = Number(row.dataset.rowSpan) || 1;
    const left = (col - 1) * metrics.trackWidth;
    const top = (y - 1) * metrics.rowHeight;
    const width = (colSpan * metrics.colWidth) + ((colSpan - 1) * metrics.colGap);
    const height = Math.max(36, rowSpan * metrics.rowHeight);
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      centerX: left + (width / 2),
      centerY: top + (height / 2)
    };
  }

  function clearCanvasGuides() {
    canvasState.guides = { v: [], h: [] };
  }

  function updateCanvasGuides(activeRow) {
    if (!activeRow) {
      clearCanvasGuides();
      return;
    }
    const metrics = getCanvasMetrics();
    const rows = [...formLayoutRowsEl.querySelectorAll(".form-layout-row")].filter(row => row !== activeRow);
    const active = getRowRect(activeRow, metrics);
    const threshold = Math.max(4, metrics.colWidth * 0.16);
    const vertical = [];
    const horizontal = [];

    rows.forEach(row => {
      const rect = getRowRect(row, metrics);
      const ax = [active.left, active.centerX, active.right];
      const bx = [rect.left, rect.centerX, rect.right];
      ax.forEach(a => {
        bx.forEach(b => {
          if (Math.abs(a - b) <= threshold) vertical.push(b);
        });
      });
      const ay = [active.top, active.centerY, active.bottom];
      const by = [rect.top, rect.centerY, rect.bottom];
      ay.forEach(a => {
        by.forEach(b => {
          if (Math.abs(a - b) <= threshold) horizontal.push(b);
        });
      });
    });

    const dedupe = arr => [...new Set(arr.map(v => Math.round(v)))];
    canvasState.guides = { v: dedupe(vertical), h: dedupe(horizontal) };
  }

  function setRowLayout(row, next, options = {}) {
    if (!row) return;
    if (isRowLocked(row) && !options.force) return;
    const colInput = row.querySelector(".layout-col");
    const rowInput = row.querySelector(".layout-row");
    const colSpanInput = row.querySelector(".layout-colspan");
    const rowSpanInput = row.querySelector(".layout-rowspan");
    if (colInput && next.col !== undefined) colInput.value = String(next.col);
    if (rowInput && next.row !== undefined) rowInput.value = String(next.row);
    if (colSpanInput && next.colSpan !== undefined) colSpanInput.value = String(next.colSpan);
    if (rowSpanInput && next.rowSpan !== undefined) rowSpanInput.value = String(next.rowSpan);
    row._suspendRender = Boolean(options.suppressRender);
    row._suspendCollision = Boolean(options.suppressCollision);
    if (typeof row._syncLayoutInputs === "function") row._syncLayoutInputs();
    row._suspendRender = false;
    row._suspendCollision = false;
  }

  function getRowLayoutData(row) {
    return {
      col: Number(row.dataset.col) || 1,
      row: Number(row.dataset.row) || 1,
      colSpan: Number(row.dataset.colSpan) || EDITOR_HALF_SPAN,
      rowSpan: Number(row.dataset.rowSpan) || 1
    };
  }

  function captureLayoutSnapshot() {
    return [...formLayoutRowsEl.querySelectorAll(".form-layout-row")].map(row => ({
      key: row.dataset.key,
      col: Number(row.dataset.col) || 1,
      row: Number(row.dataset.row) || 1,
      colSpan: Number(row.dataset.colSpan) || EDITOR_HALF_SPAN,
      rowSpan: Number(row.dataset.rowSpan) || 1
    }));
  }

  function applyLayoutSnapshot(snapshot) {
    if (!Array.isArray(snapshot) || !snapshot.length) return;
    snapshot.forEach(item => {
      const row = formLayoutRowsEl.querySelector(`.form-layout-row[data-key="${item.key}"]`);
      if (!row) return;
      setRowLayout(row, {
        col: item.col,
        row: item.row,
        colSpan: item.colSpan,
        rowSpan: item.rowSpan
      }, { suppressRender: true, suppressCollision: true });
    });
    renderFormLayoutCanvas();
  }

  function overlaps(a, b) {
    const aRight = a.col + a.colSpan - 1;
    const bRight = b.col + b.colSpan - 1;
    const aBottom = a.row + a.rowSpan - 1;
    const bBottom = b.row + b.rowSpan - 1;
    if (aRight < b.col || bRight < a.col) return false;
    if (aBottom < b.row || bBottom < a.row) return false;
    return true;
  }

  function findNearestFreeRowFor(row) {
    if (!row) return 1;
    const current = getRowLayoutData(row);
    const others = [...formLayoutRowsEl.querySelectorAll(".form-layout-row")]
      .filter(r => r !== row)
      .map(getRowLayoutData);
    let nextRow = current.row;
    let guard = 0;
    while (guard < 1000) {
      const probe = { ...current, row: nextRow };
      const hasCollision = others.some(other => overlaps(probe, other));
      if (!hasCollision) return nextRow;
      nextRow += 1;
      guard += 1;
    }
    return current.row;
  }

  function resolveLayoutCollisions(activeRow) {
    if (!activeRow) return;
    const rows = [...formLayoutRowsEl.querySelectorAll(".form-layout-row")];
    const activeData = getRowLayoutData(activeRow);
    const placed = [{ ...activeData }];
    const others = rows
      .filter(row => row !== activeRow)
      .sort((a, b) => (Number(a.dataset.row) || 1) - (Number(b.dataset.row) || 1));

    others.forEach(row => {
      const data = getRowLayoutData(row);
      if (isRowLocked(row)) {
        placed.push({ ...data });
        return;
      }
      let guard = 0;
      while (placed.some(existing => overlaps(data, existing)) && guard < 1000) {
        data.row += 1;
        guard += 1;
      }
      placed.push({ ...data });
      const moved =
        data.col !== (Number(row.dataset.col) || 1) ||
        data.row !== (Number(row.dataset.row) || 1) ||
        data.colSpan !== (Number(row.dataset.colSpan) || EDITOR_HALF_SPAN) ||
        data.rowSpan !== (Number(row.dataset.rowSpan) || 1);
      if (moved) setRowLayout(row, data, { suppressRender: true, suppressCollision: true });
    });
  }

  function buildCanvasSample(key, label, previewType) {
    const effectiveType = previewType && previewType !== "auto" ? previewType : defaultPreviewTypeForKey(key);
    const sampleTextByKey = {
      sn: "001",
      reference: "26041406",
      targetDate: "2026-04-20",
      dueDate: "2026-04-24",
      customerCode: "1263",
      customerName: "Quality Medical Sciences Co. Ltd.",
      pgType: "P",
      origin: "NUPCO",
      salesPerson: "Adnan",
      rfq: "RFQ-2026-1007",
      bid: "BID-1024",
      quoteTime: "10:12 AM",
      status: "UNDER REVIEW",
      contactName: "Islam Sleem",
      phone: "+966544800246",
      email: "sample@company.com",
      totalItems: "12",
      totalValue: "154,300.00",
      itemLines: "Various items and specs...",
      remarks: "Awaiting customer confirmation.",
      custCode: "798",
      custName: "International Quality Labs (MEDICAL)",
      custNameAr: "مختبرات الجودة الدولية",
      custPgType: "L",
      custWebsite: "www.i-qlab.com",
      custSector: "Medical",
      custAreaCode: "1",
      custVT: "T",
      custVendor: "22633",
      custRemark: "Primary key account"
    };
    const sampleValue = sampleTextByKey[key] || label || "Sample";
    if (effectiveType === "button" || key === "actions") {
      const buttonLabel = key === "contactSaveAction" ? "Add Contact" : (label || "Button");
      return `
        <div class="flc-sample-actions">
          ${key === "actions"
            ? `<span class="flc-btn flc-btn-success">Save Quotation</span><span class="flc-btn flc-btn-warning">Clear</span><span class="flc-btn flc-btn-secondary">Print</span>`
            : `<span class="flc-btn ${key === "contactSaveAction" ? "flc-btn-success" : "flc-btn-primary"}">${Utils.escapeHtml(buttonLabel)}</span>`
          }
        </div>
      `;
    }
    if (effectiveType === "display") {
      return `<div class="flc-sample-display">${Utils.escapeHtml(sampleValue)}</div>`;
    }
    if (effectiveType === "textarea") {
      return `<div class="flc-sample-textarea">${Utils.escapeHtml(sampleValue)}</div>`;
    }
    if (effectiveType === "select") {
      return `<div class="flc-sample-select">${Utils.escapeHtml(sampleValue)}</div>`;
    }
    return `<div class="flc-sample-input">${Utils.escapeHtml(sampleValue)}</div>`;
  }

  function buildFormPreviewField(item, labels) {
    const key = item.key;
    const label = item.label || labels[key] || key;
    const previewType = PREVIEW_TYPES.some(t => t.value === item.previewType) ? item.previewType : "auto";
    const type = previewType === "auto" ? defaultPreviewTypeForKey(key) : previewType;
    const wrapper = document.createElement("div");
    wrapper.className = "form-preview-field";
    if (item.fieldBorder === false) wrapper.classList.add("field-border-off");
    wrapper.style.gridColumn = `${item.col || 1} / span ${item.colSpan || EDITOR_HALF_SPAN}`;
    wrapper.style.gridRow = `${item.row || 1} / span ${item.rowSpan || 1}`;

    const labelEl = document.createElement("label");
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);

    if (type === "button" || key === "actions") {
      const row = document.createElement("div");
      row.className = "preview-btn-row";
      if (key === "actions") {
        row.innerHTML = `<button type="button" class="btn btn-success">Save Quotation</button><button type="button" class="btn btn-warning">Clear</button><button type="button" class="btn btn-secondary">Print</button>`;
      } else {
        const buttonLabel = key === "contactSaveAction" ? "Add Contact" : label;
        row.innerHTML = `<button type="button" class="btn ${key === "contactSaveAction" ? "btn-success" : "btn-primary"}">${Utils.escapeHtml(buttonLabel)}</button>`;
      }
      wrapper.appendChild(row);
      return wrapper;
    }

    if (type === "textarea") {
      const el = document.createElement("textarea");
      el.placeholder = `Sample ${label}`;
      el.value = "";
      wrapper.appendChild(el);
      return wrapper;
    }

    if (type === "select") {
      const el = document.createElement("select");
      el.innerHTML = `<option>Select ${Utils.escapeHtml(label)}</option>`;
      wrapper.appendChild(el);
      return wrapper;
    }

    const input = document.createElement("input");
    input.type = "text";
    if (key.includes("email")) input.type = "email";
    else if (key.includes("date")) input.type = "date";
    else if (key.includes("time")) input.type = "time";
    else if (key.includes("total") || key.includes("code") || key === "sn") input.type = "number";
    input.placeholder = `Sample ${label}`;
    wrapper.appendChild(input);
    return wrapper;
  }

  function openFormPreviewModal() {
    if (!formPreviewModalEl || !formPreviewCanvasEl) return;
    const layout = LayoutEngine.ensureCoordinates(collectFormLayout()).filter(item => item.visible !== false);
    const labels = getActiveFieldLabels();
    const metrics = getCanvasMetrics();
    const maxRow = Math.max(10, ...layout.map(item => (Number(item.row) || 1) + (Number(item.rowSpan) || 1)));
    const neededHeight = Math.max(canvasSizeState.height, maxRow * EDITOR_ROW_HEIGHT);
    formPreviewCanvasEl.style.gridTemplateColumns = `repeat(${EDITOR_GRID_COLS}, ${metrics.colWidth}px)`;
    formPreviewCanvasEl.style.gridAutoRows = `minmax(${EDITOR_ROW_HEIGHT}px, auto)`;
    formPreviewCanvasEl.style.gap = `${metrics.colGap}px`;
    formPreviewCanvasEl.style.width = `${metrics.width}px`;
    formPreviewCanvasEl.style.minHeight = `${neededHeight}px`;
    formPreviewCanvasEl.innerHTML = "";
    layout.forEach(item => formPreviewCanvasEl.appendChild(buildFormPreviewField(item, labels)));
    formPreviewModalEl.classList.remove("hidden");
  }

  function beginCanvasResize(clientX, clientY) {
    canvasSizeState.resizing = true;
    canvasSizeState.startX = clientX;
    canvasSizeState.startY = clientY;
    canvasSizeState.startWidth = canvasSizeState.width;
    canvasSizeState.startHeight = canvasSizeState.height;
  }

  function openLiveModalPreview() {
    saveLayoutEditorToStorage(true);
    const target = currentLayoutTarget === "customer" ? "customer" : "quotation";
    localStorage.setItem("qt.liveFormPreview", target);
    const page = target === "customer" ? "customers.html" : "app.html";
    window.open(`${page}?livePreview=1`, "_blank", "noopener,noreferrer");
  }

  function renderFormLayoutCanvas() {
    if (!formLayoutCanvasEl) return;
    const metrics = getCanvasMetrics();
    const rows = [...formLayoutRowsEl.querySelectorAll(".form-layout-row")];
    const maxRow = Math.max(10, ...rows.map(row => (Number(row.dataset.row) || 1) + (Number(row.dataset.rowSpan) || 1)));
    const neededHeight = Math.max(canvasSizeState.height, maxRow * metrics.rowHeight);
    formLayoutCanvasEl.style.setProperty("--flc-cols", String(EDITOR_GRID_COLS));
    formLayoutCanvasEl.style.setProperty("--flc-row-height", `${metrics.rowHeight}px`);
    formLayoutCanvasEl.style.setProperty("--flc-max-rows", String(Math.ceil(neededHeight / metrics.rowHeight)));
    formLayoutCanvasEl.style.width = `${metrics.width}px`;
    formLayoutCanvasEl.style.height = `${neededHeight}px`;
    formLayoutCanvasEl.style.backgroundSize = `${metrics.trackWidth}px ${metrics.rowHeight}px`;
    formLayoutCanvasEl.innerHTML = "";

    rows.forEach(row => {
      const col = Number(row.dataset.col) || 1;
      const y = Number(row.dataset.row) || 1;
      const colSpan = Number(row.dataset.colSpan) || EDITOR_HALF_SPAN;
      const rowSpan = Number(row.dataset.rowSpan) || 1;
      const key = row.dataset.key;
      const label = row.dataset.label || getActiveFieldLabels()[key] || key;
      const previewType = row.dataset.previewType || "auto";
      const hasBorder = row.dataset.fieldBorder !== "false";
      const locked = isRowLocked(row);
      const block = document.createElement("div");
      const isCompact = rowSpan <= 1 || colSpan <= 4;
      block.className = `flc-item ${isCompact ? "compact" : ""} ${row.classList.contains("is-hidden-field") ? "is-hidden" : ""} ${selectedFormRow === row ? "is-selected" : ""} ${selectedFormRows.has(row.dataset.key) && selectedFormRow !== row ? "is-multi-selected" : ""} ${hasBorder ? "" : "border-off"} ${locked ? "is-locked" : ""}`;
      block.dataset.key = key;
      block.style.left = `${(col - 1) * metrics.trackWidth}px`;
      block.style.top = `${(y - 1) * metrics.rowHeight}px`;
      block.style.width = `${(colSpan * metrics.colWidth) + ((colSpan - 1) * metrics.colGap)}px`;
      block.style.height = `${Math.max(36, rowSpan * metrics.rowHeight)}px`;
      block.innerHTML = `
        <div class="flc-title">${Utils.escapeHtml(label)}</div>
        <div class="flc-sample">${buildCanvasSample(key, label, previewType)}</div>
        ${locked ? `<div class="flc-lock" title="Locked">🔒</div>` : ""}
        <div class="flc-resize" title="Resize"></div>
      `;

      block.addEventListener("mousedown", e => {
        e.preventDefault();
        const additive = e.ctrlKey || e.metaKey || e.shiftKey;
        selectFormLayoutRow(row, { additive });
        if (additive) return;
        if (locked) return;
        canvasState.activeRow = row;
        canvasState.mode = e.target.closest(".flc-resize") ? "resize" : "move";
        canvasState.startX = e.clientX;
        canvasState.startY = e.clientY;
        canvasState.origin = { col, row: y, colSpan, rowSpan };
        canvasState.snapshot = captureLayoutSnapshot();
        updateCanvasGuides(row);
        renderFormLayoutCanvas();
      });
      formLayoutCanvasEl.appendChild(block);
    });

    (canvasState.guides?.v || []).forEach(x => {
      const line = document.createElement("div");
      line.className = "flc-guide flc-guide-v";
      line.style.left = `${x}px`;
      formLayoutCanvasEl.appendChild(line);
    });
    (canvasState.guides?.h || []).forEach(y => {
      const line = document.createElement("div");
      line.className = "flc-guide flc-guide-h";
      line.style.top = `${y}px`;
      formLayoutCanvasEl.appendChild(line);
    });

    if (canvasState.distance?.show) {
      const dist = document.createElement("div");
      dist.className = "flc-distance";
      dist.textContent = `x ${Math.round(canvasState.distance.x)}px, y ${Math.round(canvasState.distance.y)}px`;
      const rect = formLayoutCanvasEl.getBoundingClientRect();
      const left = Math.max(6, Math.min(metrics.width - 130, canvasState.distance.clientX - rect.left + 12));
      const top = Math.max(6, Math.min(neededHeight - 28, canvasState.distance.clientY - rect.top + 12));
      dist.style.left = `${left}px`;
      dist.style.top = `${top}px`;
      formLayoutCanvasEl.appendChild(dist);
    }

    const resizeHandle = document.createElement("div");
    resizeHandle.id = "formCanvasResizeHandle";
    resizeHandle.className = "form-canvas-resize-handle";
    resizeHandle.title = "Drag to resize canvas";
    resizeHandle.addEventListener("mousedown", e => {
      e.preventDefault();
      beginCanvasResize(e.clientX, e.clientY);
    });
    formLayoutCanvasEl.appendChild(resizeHandle);
  }

  function bindFormLayoutResize(row) {
    const handle = row.querySelector(".resize-handle");
    if (!handle) return;
    handle.addEventListener("mousedown", e => {
      e.preventDefault();
      e.stopPropagation();
      resizingFormRow = row;
      formRowResizeStartX = e.clientX;
      row.classList.add("is-resizing");
      selectFormLayoutRow(row);
    });
  }

  function addFormLayoutRow(item) {
    const key = String(item?.key || "").trim();
    if (!key) return;
    const baseLabel = getActiveFieldLabels()[key] || key;
    const customLabel = String(item?.label || "").trim();
    const labelText = customLabel || baseLabel;
    const previewType = PREVIEW_TYPES.some(t => t.value === item?.previewType) ? item.previewType : "auto";
    const fieldBorder = item?.fieldBorder !== false;
    const locked = item?.locked === true;
    const row = document.createElement("div");
    row.className = "settings-map-row form-layout-row";
    row.dataset.key = key;
    row.dataset.label = labelText;
    row.dataset.previewType = previewType;
    row.dataset.fieldBorder = fieldBorder ? "true" : "false";
    row.dataset.locked = locked ? "true" : "false";
    row.innerHTML = `
      <div class="form-layout-meta">
        <span class="drag-handle" title="Drag to reorder">::</span>
        <span class="form-order"></span>
        <strong class="form-layout-title">${Utils.escapeHtml(labelText)}</strong>
      </div>
      <div class="form-layout-preview">
        <label class="layout-preview-label">${Utils.escapeHtml(labelText)}</label>
        <div class="preview-input"></div>
        <div class="resize-handle" title="Drag right for full width, left for half width"></div>
      </div>
      <div class="form-layout-controls">
        <label class="checkbox-inline"><input type="checkbox" class="layout-visible" ${item.visible !== false ? "checked" : ""} /> Show</label>
        <label>Label <input type="text" class="layout-label" value="${Utils.escapeHtml(customLabel)}" placeholder="${Utils.escapeHtml(baseLabel)}" /></label>
        <label>Type
          <select class="layout-preview-type">
            ${PREVIEW_TYPES.map(t => `<option value="${t.value}" ${previewType === t.value ? "selected" : ""}>${t.label}</option>`).join("")}
          </select>
        </label>
        <span class="layout-width-label"></span>
        <div class="layout-width-group">
          <button type="button" class="btn btn-secondary btn-sm layout-width-btn" data-width="half">1/2</button>
          <button type="button" class="btn btn-secondary btn-sm layout-width-btn" data-width="full">1/1</button>
        </div>
        <div class="layout-xywh">
          <label>X <input type="number" class="layout-col" min="1" max="${EDITOR_GRID_COLS}" value="${Number(item.col) || 1}" /></label>
          <label>Y <input type="number" class="layout-row" min="1" value="${Number(item.row) || 1}" /></label>
          <label>W <input type="number" class="layout-colspan" min="1" max="${EDITOR_GRID_COLS}" value="${Number(item.colSpan) || (item.width === "full" ? EDITOR_FULL_SPAN : EDITOR_HALF_SPAN)}" /></label>
          <label>H <input type="number" class="layout-rowspan" min="1" max="${EDITOR_MAX_ROW_SPAN}" value="${Number(item.rowSpan) || 1}" /></label>
        </div>
      </div>
    `;
    formLayoutRowsEl.appendChild(row);
    bindFormLayoutDrag(row);
    bindFormLayoutResize(row);
    const colInput = row.querySelector(".layout-col");
    const rowInput = row.querySelector(".layout-row");
    const colSpanInput = row.querySelector(".layout-colspan");
    const rowSpanInput = row.querySelector(".layout-rowspan");
    setFormLayoutRowWidth(row, item.width, false, false);
    setFormLayoutRowVisible(row, item.visible !== false);
    row.addEventListener("click", e => {
      selectFormLayoutRow(row, { additive: e.ctrlKey || e.metaKey || e.shiftKey });
    });
    const visibleInput = row.querySelector(".layout-visible");
    const labelInput = row.querySelector(".layout-label");
    const previewTypeInput = row.querySelector(".layout-preview-type");
    visibleInput.addEventListener("change", () => {
      setFormLayoutRowVisible(row, visibleInput.checked);
      if (selectedFormRow === row) syncSelectedFieldPanel();
    });
    labelInput.addEventListener("input", () => {
      const next = labelInput.value.trim() || baseLabel;
      row.dataset.label = next;
      row.querySelector(".form-layout-title").textContent = next;
      row.querySelector(".layout-preview-label").textContent = next;
      if (selectedFormRow === row) syncSelectedFieldPanel();
      renderFormLayoutCanvas();
    });
    previewTypeInput.addEventListener("change", () => {
      row.dataset.previewType = previewTypeInput.value || "auto";
      if (selectedFormRow === row) syncSelectedFieldPanel();
      renderFormLayoutCanvas();
    });
    row.querySelectorAll(".layout-width-btn").forEach(btn => {
      btn.addEventListener("click", () => setFormLayoutRowWidth(row, btn.dataset.width, true));
    });
    const syncLayoutInputs = () => {
      let col = Math.min(EDITOR_GRID_COLS, Math.max(1, Number(colInput.value) || 1));
      const y = Math.max(1, Number(rowInput.value) || 1);
      const w = Math.min(EDITOR_GRID_COLS, Math.max(1, Number(colSpanInput.value) || EDITOR_HALF_SPAN));
      const h = Math.min(EDITOR_MAX_ROW_SPAN, Math.max(1, Number(rowSpanInput.value) || 1));
      if (w >= EDITOR_GRID_COLS) col = 1;
      colInput.value = String(col);
      rowInput.value = String(y);
      colSpanInput.value = String(w);
      rowSpanInput.value = String(h);
      row.dataset.col = String(col);
      row.dataset.row = String(y);
      row.dataset.colSpan = String(w);
      row.dataset.rowSpan = String(h);
      row.dataset.width = w >= EDITOR_FULL_SPAN ? "full" : "half";
      row.classList.toggle("width-full", row.dataset.width === "full");
      row.querySelectorAll(".layout-width-btn").forEach(btn => btn.classList.toggle("is-active", btn.dataset.width === row.dataset.width));
      const widthLabel = row.querySelector(".layout-width-label");
      if (widthLabel) widthLabel.textContent = row.dataset.width === "full" ? "Width: Full" : "Width: Half";
      if (!row._suspendCollision) resolveLayoutCollisions(row);
      if (selectedFormRow === row) syncSelectedFieldPanel();
      if (!row._suspendRender) renderFormLayoutCanvas();
    };
    [colInput, rowInput, colSpanInput, rowSpanInput].forEach(input => input.addEventListener("input", syncLayoutInputs));
    colSpanInput.addEventListener("input", () => { colSpanInput.dataset.manual = "1"; });
    row._syncLayoutInputs = syncLayoutInputs;
    row._suspendCollision = true;
    row._suspendRender = true;
    syncLayoutInputs();
    row._suspendCollision = false;
    row._suspendRender = false;
  }

  function saveLayoutEditorToStorage(silent = false) {
    const latest = LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {
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
      formLayout: APP_CONFIG.defaults.formLayout,
      customerFormLayout: APP_CONFIG.defaults.customerFormLayout,
      formLayoutCanvas: APP_CONFIG.defaults.formLayoutCanvas,
      originSalesMap: APP_CONFIG.defaults.originSalesMap,
      dashboardWidgets: APP_CONFIG.defaults.dashboardWidgets,
      dashboardWidgetTypes: APP_CONFIG.defaults.dashboardWidgetTypes,
      dashboardMaxWidgets: APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20,
      dashboardColumns: APP_CONFIG.defaults.dashboardColumns ?? 3,
      dashboardWidgetOrder: APP_CONFIG.defaults.dashboardWidgetOrder || []
    });
    const layoutKey = getLayoutSettingKeyByTarget(currentLayoutTarget);
    const nextLayout = collectFormLayout();
    const nextCanvas = {
      width: canvasSizeState.width,
      height: canvasSizeState.height,
      colSize: canvasSizeState.colSize
    };
    const selected = getSelectedWorkflow();
    if (selected) {
      selected[layoutKey] = nextLayout;
      selected.formLayoutCanvas = nextCanvas;
    }
    latest.workflowProfiles = workflowProfiles;
    const activeProfile = workflowProfiles.find(p => p.id === activeWorkflowId) || workflowProfiles[0] || selected;
    latest[layoutKey] = activeProfile?.[layoutKey] || nextLayout;
    latest.formLayoutCanvas = activeProfile?.formLayoutCanvas || nextCanvas;
    LocalStorageAdapter.save(APP_CONFIG.localKeys.settings, latest);
    if (!silent) backupSettingsToCloud(latest);
    settings.workflowProfiles = latest.workflowProfiles;
    settings[layoutKey] = latest[layoutKey];
    settings.formLayoutCanvas = latest.formLayoutCanvas;
    if (!silent) {
      Toast.show(`${currentLayoutTarget === "customer" ? "Customer" : "Quotation"} form layout saved.`, "success");
    }
  }

  function saveCurrentEditorStateSilently() {
    try {
      saveLayoutEditorToStorage(true);
    } catch (error) {
      console.error("Failed to auto-save form layout.", error);
    }
  }

  function renderFormLayout(layoutInput) {
    selectedFormRow = null;
    formLayoutRowsEl.innerHTML = "";
    const normalized = normalizeFormLayout(layoutInput);
    normalized.forEach(item => addFormLayoutRow(item));
    refreshFormLayoutOrder();
    syncSelectedFieldPanel();
  }

  function collectFormLayout() {
    const collected = [...formLayoutRowsEl.querySelectorAll(".form-layout-row")].map((row, index) => ({
      key: row.dataset.key,
      visible: row.querySelector(".layout-visible").checked,
      width: row.dataset.width === "full" ? "full" : "half",
      fieldBorder: row.dataset.fieldBorder !== "false",
      locked: row.dataset.locked === "true",
      label: String(row.querySelector(".layout-label")?.value || "").trim(),
      previewType: PREVIEW_TYPES.some(t => t.value === row.dataset.previewType) ? row.dataset.previewType : "auto",
      col: Number(row.dataset.col) || 1,
      row: Number(row.dataset.row) || (index + 1),
      colSpan: Number(row.dataset.colSpan) || (row.dataset.width === "full" ? EDITOR_FULL_SPAN : EDITOR_HALF_SPAN),
      rowSpan: Number(row.dataset.rowSpan) || 1,
      gridCols: EDITOR_GRID_COLS,
      order: index + 1
    }));
    return LayoutEngine.ensureCoordinates(collected);
  }

  currentLayoutTarget = layoutTargetSelectEl?.value === "customer" ? "customer" : "quotation";
  renderWorkflowProfileUI();
  loadSelectedWorkflowIntoEditors();
  document.getElementById("kanbanColumnModeInput").value =
    (settings.kanbanColumnMode === "sub" ? "sub" : "main");
  renderFormLayout(getProfileLayout(getSelectedWorkflow(), currentLayoutTarget));
  bindFieldPropsPanel();
  formLayoutCanvasEl?.addEventListener("mousedown", e => {
    if (!e.target || e.target !== formLayoutCanvasEl) return;
    const rect = formLayoutCanvasEl.getBoundingClientRect();
    const fromRight = rect.right - e.clientX;
    const fromBottom = rect.bottom - e.clientY;
    if (fromRight <= 24 && fromBottom <= 24) {
      e.preventDefault();
      beginCanvasResize(e.clientX, e.clientY);
      return;
    }
    selectFormLayoutRow(null);
  });

  document.getElementById("btnAddTagGroupRow").addEventListener("click", () => {
    addTagGroupRow({ id: "", name: "New Tag Group", tags: [] }, !tagGroupRowsEl.querySelector(".tg-active:checked"));
  });
  document.getElementById("btnAddStatusGroupRow").addEventListener("click", () => addStatusGroupRow());
  workflowProfileSelectEl?.addEventListener("change", e => {
    saveCurrentProfileEditorsToState();
    selectedWorkflowId = e.target.value;
    loadSelectedWorkflowIntoEditors();
    settings.dashboardWidgetOrder = collectDashboardWidgetOrder();
    renderDashboardWidgets(collectDashboardWidgets(), collectDashboardWidgetTypes());
  });
  document.getElementById("btnAddWorkflowProfile")?.addEventListener("click", () => {
    saveCurrentProfileEditorsToState();
    const name = window.prompt("New tracker/workflow name:", "New Tracker");
    if (!name || !String(name).trim()) return;
    const cleanName = String(name).trim();
    const id = makeUniqueWorkflowId(slugifyWorkflowId(cleanName), workflowProfiles);
    const base = getSelectedWorkflow();
    workflowProfiles.push({
      id,
      name: cleanName,
      tagLabel: String(base?.tagLabel || APP_CONFIG.defaults.tagLabel || "Origin"),
      subTagLabel: String(base?.subTagLabel || APP_CONFIG.defaults.subTagLabel || "Sub Tag"),
      origins: normalizeOrigins(base?.origins || APP_CONFIG.defaults.origins || []),
      statusGroups: cloneStatusGroups(base?.statusGroups || APP_CONFIG.defaults.statusGroups || []),
      referenceFormula: String(base?.referenceFormula || APP_CONFIG.defaults.referenceFormula || "YYMMDD{SEQ}"),
      referenceStartSequence: Math.max(0, Number(base?.referenceStartSequence ?? APP_CONFIG.defaults.referenceStartSequence ?? 6)),
      referenceSequencePad: Math.max(1, Number(base?.referenceSequencePad ?? APP_CONFIG.defaults.referenceSequencePad ?? 2)),
      originSalesMap: { ...(base?.originSalesMap || APP_CONFIG.defaults.originSalesMap || {}) },
      customerSettings: normalizeCustomerSettings(base?.customerSettings || APP_CONFIG.defaults.customerSettings, APP_CONFIG.defaults.customerSettings),
      tagGroups: normalizeTagGroups(base || {}, base?.tagLabel || "Origin", base?.originSalesMap || {}, base?.origins || []),
      activeTagGroupId: String(base?.activeTagGroupId || ""),
      formLayout: Array.isArray(base?.formLayout) ? base.formLayout.map(x => ({ ...x })) : (APP_CONFIG.defaults.formLayout || []),
      customerFormLayout: Array.isArray(base?.customerFormLayout) ? base.customerFormLayout.map(x => ({ ...x })) : (APP_CONFIG.defaults.customerFormLayout || []),
      formLayoutCanvas: { ...(base?.formLayoutCanvas || APP_CONFIG.defaults.formLayoutCanvas || {}) },
      dashboardWidgets: Array.isArray(base?.dashboardWidgets) ? [...base.dashboardWidgets] : [...(APP_CONFIG.defaults.dashboardWidgets || [])],
      dashboardWidgetTypes: { ...(base?.dashboardWidgetTypes || APP_CONFIG.defaults.dashboardWidgetTypes || {}) },
      dashboardWidgetOrder: Array.isArray(base?.dashboardWidgetOrder) ? [...base.dashboardWidgetOrder] : [...(APP_CONFIG.defaults.dashboardWidgetOrder || [])],
      dashboardMaxWidgets: Math.max(1, Math.min(50, Number(base?.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20) || 20)),
      dashboardColumns: [2, 3, 4].includes(Number(base?.dashboardColumns)) ? Number(base.dashboardColumns) : Number(APP_CONFIG.defaults.dashboardColumns || 3),
      pages: {
        customers: base?.pages?.customers !== false,
        archived: base?.pages?.archived !== false
      }
    });
    syncLegacyFromTagGroups(workflowProfiles[workflowProfiles.length - 1]);
    selectedWorkflowId = id;
    loadSelectedWorkflowIntoEditors();
    Toast.show(`Tracker '${cleanName}' added.`, "success");
  });
  document.getElementById("btnRenameWorkflowProfile")?.addEventListener("click", () => {
    const current = getSelectedWorkflow();
    if (!current) return;
    const nextName = window.prompt("Rename tracker/workflow:", current.name || "");
    if (!nextName || !String(nextName).trim()) return;
    current.name = String(nextName).trim();
    renderWorkflowProfileUI();
    Toast.show("Tracker renamed.", "success");
  });
  document.getElementById("btnDeleteWorkflowProfile")?.addEventListener("click", () => {
    if (workflowProfiles.length <= 1) {
      Toast.show("At least one tracker/workflow is required.", "warning");
      return;
    }
    const current = getSelectedWorkflow();
    if (!current) return;
    const ok = window.confirm(`Delete workflow '${current.name}'?`);
    if (!ok) return;
    workflowProfiles = workflowProfiles.filter(p => p.id !== current.id);
    if (!workflowProfiles.some(p => p.id === activeWorkflowId)) {
      activeWorkflowId = workflowProfiles[0].id;
    }
    selectedWorkflowId = workflowProfiles[0].id;
    loadSelectedWorkflowIntoEditors();
    Toast.show("Tracker deleted.", "info");
  });
  document.getElementById("btnSetActiveWorkflowProfile")?.addEventListener("click", () => {
    saveCurrentProfileEditorsToState();
    const current = getSelectedWorkflow();
    if (!current) return;
    activeWorkflowId = current.id;
    renderWorkflowProfileUI();
    Toast.show(`Active tracker set to '${current.name}'.`, "success");
  });
  document.getElementById("btnDashboardVisualsDefault")?.addEventListener("click", () => {
    settings.dashboardWidgetOrder = collectDashboardWidgetOrder();
    renderDashboardWidgets(APP_CONFIG.defaults.dashboardWidgets || [], APP_CONFIG.defaults.dashboardWidgetTypes || {});
  });
  document.getElementById("btnDashboardVisualsAll")?.addEventListener("click", () => {
    settings.dashboardWidgetOrder = collectDashboardWidgetOrder();
    const limit = getDashboardMaxWidgets();
    renderDashboardWidgets(getDashboardWidgetCatalog().slice(0, limit).map(x => x.key), collectDashboardWidgetTypes());
  });
  document.getElementById("btnDashboardVisualsClear")?.addEventListener("click", () => {
    settings.dashboardWidgetOrder = collectDashboardWidgetOrder();
    renderDashboardWidgets([], collectDashboardWidgetTypes());
  });
  document.getElementById("btnDashboardVisualTypesDefault")?.addEventListener("click", () => {
    settings.dashboardWidgetOrder = collectDashboardWidgetOrder();
    renderDashboardWidgets(collectDashboardWidgets(), APP_CONFIG.defaults.dashboardWidgetTypes || {});
  });
  document.getElementById("btnDashboardAutoSequence")?.addEventListener("click", () => {
    settings.dashboardWidgetOrder = getDashboardWidgetCatalog().map(w => w.key);
    renderDashboardWidgets(collectDashboardWidgets(), collectDashboardWidgetTypes());
    Toast.show("Dashboard sequence reset.", "success", 2000);
  });
  dashboardMaxWidgetsInputEl?.addEventListener("change", () => {
    const v = getDashboardMaxWidgets();
    dashboardMaxWidgetsInputEl.value = String(v);
    const selected = collectDashboardWidgets();
    if (selected.length > v) {
      settings.dashboardWidgetOrder = collectDashboardWidgetOrder();
      renderDashboardWidgets(selected.slice(0, v), collectDashboardWidgetTypes());
      Toast.show(`Trimmed selected visuals to ${v}.`, "info", 2400);
      return;
    }
    updateDashboardWidgetCount();
  });
  dashboardColumnsInputEl?.addEventListener("change", () => {
    const v = Number(dashboardColumnsInputEl.value);
    dashboardColumnsInputEl.value = String([2, 3, 4].includes(v) ? v : 3);
  });
  document.getElementById("btnResetFormLayout").addEventListener("click", () => {
    const defaults = getLayoutDefaultsByTarget(currentLayoutTarget) || [];
    renderFormLayout(defaults);
    Toast.show(`${currentLayoutTarget === "customer" ? "Customer" : "Quotation"} form layout reset to default.`, "info");
  });
  document.getElementById("btnAlignLeft")?.addEventListener("click", () => alignSelectedRows("left"));
  document.getElementById("btnAlignCenter")?.addEventListener("click", () => alignSelectedRows("center"));
  document.getElementById("btnAlignRight")?.addEventListener("click", () => alignSelectedRows("right"));
  document.getElementById("btnAlignTop")?.addEventListener("click", () => alignSelectedRows("top"));
  document.getElementById("btnAlignMiddle")?.addEventListener("click", () => alignSelectedRows("middle"));
  document.getElementById("btnAlignBottom")?.addEventListener("click", () => alignSelectedRows("bottom"));
  layoutTargetSelectEl?.addEventListener("change", () => {
    saveLayoutEditorToStorage(true);
    currentLayoutTarget = layoutTargetSelectEl.value === "customer" ? "customer" : "quotation";
    renderFormLayout(getProfileLayout(getSelectedWorkflow(), currentLayoutTarget));
  });
  document.getElementById("btnOpenLayoutEditor").addEventListener("click", () => {
    currentLayoutTarget = layoutTargetSelectEl?.value === "customer" ? "customer" : "quotation";
    const current = getSelectedWorkflow();
    renderFormLayout(getProfileLayout(current, currentLayoutTarget));
    const canvas = getProfileCanvas(current);
    setCanvasSize(
      Number(canvas.width) || canvasSizeState.width,
      Number(canvas.height) || canvasSizeState.height
    );
    canvasSizeState.colSize = Math.max(EDITOR_MIN_COL_WIDTH, Number(canvas.colSize) || canvasSizeState.colSize);
    formLayoutModalEl.classList.remove("hidden");
  });
  document.getElementById("btnSaveLayoutEditor").addEventListener("click", () => {
    saveLayoutEditorToStorage();
  });
  document.getElementById("btnPreviewLayout")?.addEventListener("click", () => {
    openLiveModalPreview();
  });
  document.getElementById("btnCloseLayoutEditor").addEventListener("click", () => {
    saveLayoutEditorToStorage(true);
    formLayoutModalEl.classList.add("hidden");
  });
  formLayoutModalEl.addEventListener("click", e => {
    if (e.target.id === "formLayoutModal") {
      saveLayoutEditorToStorage(true);
      formLayoutModalEl.classList.add("hidden");
    }
  });
  document.getElementById("btnCloseFormPreview")?.addEventListener("click", () => {
    formPreviewModalEl?.classList.add("hidden");
  });
  formPreviewModalEl?.addEventListener("click", e => {
    if (e.target.id === "formPreviewModal") formPreviewModalEl.classList.add("hidden");
  });
  document.getElementById("btnApplyCanvasSize").addEventListener("click", () => {
    const w = Number(document.getElementById("formCanvasWidthInput").value || canvasSizeState.width);
    const h = Number(document.getElementById("formCanvasHeightInput").value || canvasSizeState.height);
    setCanvasSize(w, h);
  });
  settingsNavButtons.forEach(btn => {
    btn.addEventListener("click", () => activateSettingsSection(btn.dataset.target));
  });
  activateSettingsSection(localStorage.getItem("qt.settingsActiveSection") || "tracker");

  document.getElementById("btnBackToApp").addEventListener("click", () => {
    saveCurrentEditorStateSilently();
    window.location.href = "app.html";
  });

  document.getElementById("btnSaveSettings").addEventListener("click", () => {
    saveCurrentEditorStateSilently();
    saveCurrentProfileEditorsToState();
    const normalizedProfiles = [];
    workflowProfiles.forEach(profile => {
      const name = String(profile?.name || "").trim();
      const baseId = String(profile?.id || "").trim() || slugifyWorkflowId(name || "workflow");
      const id = makeUniqueWorkflowId(baseId, normalizedProfiles, "");
      const origins = normalizeOrigins(profile?.origins);
      const statusGroups = cloneStatusGroups(profile?.statusGroups);
      const tagLabel = String(profile?.tagLabel || APP_CONFIG.defaults.tagLabel || "Origin").trim() || "Origin";
      const subTagLabel = String(profile?.subTagLabel || APP_CONFIG.defaults.subTagLabel || "Sub Tag").trim() || "Sub Tag";
      const referenceFormula = String(profile?.referenceFormula || APP_CONFIG.defaults.referenceFormula || "YYMMDD{SEQ}");
      const referenceStartSequence = Math.max(0, Number(profile?.referenceStartSequence ?? APP_CONFIG.defaults.referenceStartSequence ?? 6));
      const referenceSequencePad = Math.max(1, Number(profile?.referenceSequencePad ?? APP_CONFIG.defaults.referenceSequencePad ?? 2));
      const tagGroups = normalizeTagGroups(profile, tagLabel, profile?.originSalesMap || {}, profile?.origins || []);
      const activeTagGroupId = tagGroups.some(g => g.id === String(profile?.activeTagGroupId || "").trim())
        ? String(profile.activeTagGroupId).trim()
        : tagGroups[0].id;
      const customerSettings = normalizeCustomerSettings(
        profile?.customerSettings || settings.customerSettings || APP_CONFIG.defaults.customerSettings,
        APP_CONFIG.defaults.customerSettings
      );
      const normalizedProfile = {
        id,
        name: name || id,
        tagLabel,
        subTagLabel,
        origins,
        statusGroups,
        referenceFormula,
        referenceStartSequence,
        referenceSequencePad,
        originSalesMap: profile?.originSalesMap && typeof profile.originSalesMap === "object" ? { ...profile.originSalesMap } : {},
        customerSettings,
        tagGroups,
        activeTagGroupId,
        formLayout: Array.isArray(profile?.formLayout) && profile.formLayout.length
          ? profile.formLayout
          : (Array.isArray(settings.formLayout) ? settings.formLayout : APP_CONFIG.defaults.formLayout),
        customerFormLayout: Array.isArray(profile?.customerFormLayout) && profile.customerFormLayout.length
          ? profile.customerFormLayout
          : (Array.isArray(settings.customerFormLayout) ? settings.customerFormLayout : APP_CONFIG.defaults.customerFormLayout),
        formLayoutCanvas: profile?.formLayoutCanvas && typeof profile.formLayoutCanvas === "object"
          ? { ...profile.formLayoutCanvas }
          : { ...(settings.formLayoutCanvas || APP_CONFIG.defaults.formLayoutCanvas || {}) },
        dashboardWidgets: Array.isArray(profile?.dashboardWidgets) && profile.dashboardWidgets.length
          ? profile.dashboardWidgets
          : (Array.isArray(settings.dashboardWidgets) ? settings.dashboardWidgets : APP_CONFIG.defaults.dashboardWidgets),
        dashboardWidgetTypes: profile?.dashboardWidgetTypes && typeof profile.dashboardWidgetTypes === "object"
          ? { ...profile.dashboardWidgetTypes }
          : { ...(settings.dashboardWidgetTypes || APP_CONFIG.defaults.dashboardWidgetTypes || {}) },
        dashboardWidgetOrder: Array.isArray(profile?.dashboardWidgetOrder) && profile.dashboardWidgetOrder.length
          ? profile.dashboardWidgetOrder
          : (Array.isArray(settings.dashboardWidgetOrder) ? settings.dashboardWidgetOrder : APP_CONFIG.defaults.dashboardWidgetOrder || []),
        dashboardMaxWidgets: Math.max(1, Math.min(50, Number(profile?.dashboardMaxWidgets ?? settings.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20) || 20)),
        dashboardColumns: [2, 3, 4].includes(Number(profile?.dashboardColumns ?? settings.dashboardColumns))
          ? Number(profile?.dashboardColumns ?? settings.dashboardColumns)
          : Number(APP_CONFIG.defaults.dashboardColumns || 3),
        pages: {
          customers: profile?.pages?.customers !== false,
          archived: profile?.pages?.archived !== false
        }
      };
      normalizedProfiles.push(syncLegacyFromTagGroups(normalizedProfile));
    });
    if (!normalizedProfiles.length) {
      Toast.show("Add at least one tracker/workflow.", "warning");
      return;
    }
    const activeProfile = normalizedProfiles.find(p => p.id === activeWorkflowId) || normalizedProfiles[0];
    if (!activeProfile.statusGroups.length) {
      Toast.show("Active tracker needs at least one status column.", "warning");
      return;
    }
    if (activeProfile.statusGroups.some(g => !Array.isArray(g.substatuses) || !g.substatuses.length)) {
      Toast.show("Each status column must have at least one sub-status.", "warning");
      return;
    }

    const kanbanColumnMode = document.getElementById("kanbanColumnModeInput").value === "sub" ? "sub" : "main";
    const statusGroups = activeProfile.statusGroups;
    const referenceFormula = String(activeProfile.referenceFormula || APP_CONFIG.defaults.referenceFormula || "YYMMDD{SEQ}");
    const referenceStartSequence = Math.max(0, Number(activeProfile.referenceStartSequence ?? APP_CONFIG.defaults.referenceStartSequence ?? 6));
    const referenceSequencePad = Math.max(1, Number(activeProfile.referenceSequencePad ?? APP_CONFIG.defaults.referenceSequencePad ?? 2));
    const quotationFormLayout = Array.isArray(activeProfile.formLayout) ? activeProfile.formLayout : (APP_CONFIG.defaults.formLayout || []);
    const customerFormLayout = Array.isArray(activeProfile.customerFormLayout) ? activeProfile.customerFormLayout : (APP_CONFIG.defaults.customerFormLayout || []);
    const dashboardWidgets = Array.isArray(activeProfile.dashboardWidgets) ? activeProfile.dashboardWidgets : (APP_CONFIG.defaults.dashboardWidgets || []);
    const dashboardWidgetTypes = activeProfile.dashboardWidgetTypes && typeof activeProfile.dashboardWidgetTypes === "object"
      ? activeProfile.dashboardWidgetTypes
      : (APP_CONFIG.defaults.dashboardWidgetTypes || {});
    const dashboardWidgetOrder = Array.isArray(activeProfile.dashboardWidgetOrder) ? activeProfile.dashboardWidgetOrder : (APP_CONFIG.defaults.dashboardWidgetOrder || []);
    const dashboardMaxWidgets = Math.max(1, Math.min(50, Number(activeProfile.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20) || 20));
    const dashboardColumns = [2, 3, 4].includes(Number(activeProfile.dashboardColumns))
      ? Number(activeProfile.dashboardColumns)
      : Number(APP_CONFIG.defaults.dashboardColumns || 3);
    const widgetLimit = dashboardMaxWidgets;
    if (!dashboardWidgets.length) {
      Toast.show("Select at least one dashboard visual.", "warning");
      return;
    }
    if (dashboardWidgets.length > widgetLimit) {
      Toast.show(`Maximum ${widgetLimit} dashboard visuals.`, "warning");
      return;
    }
    const origins = normalizeOrigins(activeProfile.origins || []);
    const allowedOrigins = new Set(origins);
    const originSalesMapRaw = activeProfile.originSalesMap && typeof activeProfile.originSalesMap === "object"
      ? { ...activeProfile.originSalesMap }
      : {};
    const originSalesMap = Object.fromEntries(
      Object.entries(originSalesMapRaw).filter(([origin]) => allowedOrigins.has(origin))
    );

    if (!referenceFormula.includes("{SEQ}")) {
      Toast.show("Reference formula must include {SEQ}.", "warning");
      return;
    }

    if (!Number.isFinite(referenceStartSequence) || referenceStartSequence < 0) {
      Toast.show("Sequence Start must be 0 or greater.", "warning");
      return;
    }

    if (!Number.isFinite(referenceSequencePad) || referenceSequencePad < 1) {
      Toast.show("Sequence Pad must be at least 1.", "warning");
      return;
    }

    const statuses = [...new Set(statusGroups.flatMap(g => g.substatuses))];

    const newSettings = {
      workflowProfiles: normalizedProfiles,
      activeWorkflowId: activeProfile.id,
      tagLabel: activeProfile.tagLabel || "Origin",
      subTagLabel: activeProfile.subTagLabel || "Sub Tag",
      customerSettings: activeProfile.customerSettings || APP_CONFIG.defaults.customerSettings,
      origins,
      statuses,
      kanbanColumnMode,
      statusGroups,
      referenceFormula,
      referenceStartSequence,
      referenceSequencePad,
      formLayout: quotationFormLayout,
      customerFormLayout,
      dashboardWidgets,
      dashboardWidgetTypes,
      dashboardWidgetOrder,
      dashboardMaxWidgets,
      dashboardColumns,
      formLayoutCanvas: activeProfile.formLayoutCanvas || {
        width: canvasSizeState.width,
        height: canvasSizeState.height,
        colSize: canvasSizeState.colSize
      },
      originSalesMap,
      ui: settings.ui && typeof settings.ui === "object" ? settings.ui : { ...APP_CONFIG.defaults.ui }
    };

    const newGitHubConfig = {
      storageMode: document.getElementById("storageMode").value,
      repoOwner: document.getElementById("githubRepoOwner").value.trim(),
      repoName: document.getElementById("githubRepoName").value.trim(),
      branch: document.getElementById("githubBranch").value.trim() || "main",
      token: document.getElementById("githubToken").value.trim(),
      apiEndpoint: document.getElementById("apiEndpoint").value.trim()
    };

    LocalStorageAdapter.save(APP_CONFIG.localKeys.settings, newSettings);
    LocalStorageAdapter.save("qt.githubConfig", newGitHubConfig);
    localStorage.setItem("qt.activeWorkflowId", newSettings.activeWorkflowId);
    backupSettingsToCloud(newSettings);
    settings.workflowProfiles = newSettings.workflowProfiles;
    settings.activeWorkflowId = newSettings.activeWorkflowId;
    settings.customerSettings = newSettings.customerSettings;
    settings.formLayout = newSettings.formLayout;
    settings.customerFormLayout = newSettings.customerFormLayout;
    settings.formLayoutCanvas = newSettings.formLayoutCanvas;
    settings.dashboardWidgets = newSettings.dashboardWidgets;
    settings.dashboardWidgetTypes = newSettings.dashboardWidgetTypes;
    settings.dashboardWidgetOrder = newSettings.dashboardWidgetOrder;
    settings.dashboardMaxWidgets = newSettings.dashboardMaxWidgets;
    settings.dashboardColumns = newSettings.dashboardColumns;
    workflowProfiles = newSettings.workflowProfiles;
    activeWorkflowId = newSettings.activeWorkflowId;
    selectedWorkflowId = newSettings.activeWorkflowId;
    renderWorkflowProfileUI();
    Toast.show("Settings saved.", "success");
  });

  window.addEventListener("beforeunload", () => {
    saveCurrentEditorStateSilently();
  });

  document.getElementById("btnTestGitHub").addEventListener("click", async () => {
    try {
      const cfg = {
        storageMode: document.getElementById("storageMode").value,
        repoOwner: document.getElementById("githubRepoOwner").value.trim(),
        repoName: document.getElementById("githubRepoName").value.trim(),
        branch: document.getElementById("githubBranch").value.trim() || "main",
        token: document.getElementById("githubToken").value.trim(),
        apiEndpoint: document.getElementById("apiEndpoint").value.trim()
      };

      await GitHubStorageAdapter.testConnection(cfg);
      Toast.show("Connection successful.", "success");
    } catch (error) {
      Toast.show("Connection failed: " + error.message, "error", 4500);
    }
  });

  // Sub tag label now follows tracker profile defaults without separate standalone input.
});

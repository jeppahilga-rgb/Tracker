window.Dashboard = {
  chartPalette: ["#2563eb", "#0f766e", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#16a34a", "#475569"],

  getWidgetCatalog() {
    const labels = (window.App && typeof App.getTagLabels === "function")
      ? App.getTagLabels()
      : { tag: "Origin", subTag: "Sub Tag" };
    return [
      { key: "status_distribution", title: "Status Distribution", chartTypes: ["bar", "pie", "donut", "line"] },
      { key: "origin_distribution", title: `${labels.tag} Distribution`, chartTypes: ["bar", "pie", "donut"] },
      { key: "sales_distribution", title: `${labels.subTag} Distribution`, chartTypes: ["bar", "pie", "donut"] },
      { key: "pg_distribution", title: "PG Distribution", chartTypes: ["bar", "pie", "donut"] },
      { key: "aging_overview", title: "Aging Overview", chartTypes: ["cards", "bar", "pie", "donut"] },
      { key: "completion_ratio", title: "Completion Ratio", chartTypes: ["cards", "bar", "pie", "donut"] },
      { key: "active_vs_completed", title: "Active vs Completed", chartTypes: ["bar", "pie", "donut"] },
      { key: "top_customers_by_count", title: "Top Customers by Count", chartTypes: ["bar", "pie", "donut", "line"] },
      { key: "top_customers_by_value", title: "Top Customers by Value", chartTypes: ["bar", "pie", "donut", "line"] },
      { key: "top_origins_by_value", title: `Top ${labels.tag}s by Value`, chartTypes: ["bar", "pie", "donut"] },
      { key: "top_sales_by_value", title: `Top ${labels.subTag}s by Value`, chartTypes: ["bar", "pie", "donut"] },
      { key: "avg_value_by_status", title: "Avg Value by Status", chartTypes: ["bar", "pie", "donut", "line"] },
      { key: "quotes_by_weekday", title: "Quotes by Weekday", chartTypes: ["line", "bar"] },
      { key: "quotes_by_month_line", title: "Quotes by Month (Trend)", chartTypes: ["line", "bar"] },
      { key: "weekly_activity_line", title: "Weekly Activity (Trend)", chartTypes: ["line", "bar"] },
      { key: "status_count_value_combo", title: "Status Count + Value (Comparison)", chartTypes: ["combo", "bar", "line"] },
      { key: "recent_7day_created", title: "Recent 7 Days", chartTypes: ["cards", "bar"] },
      { key: "zero_value_quotes", title: "Zero Value Quotes", chartTypes: ["cards"] },
      { key: "high_value_quotes", title: "High Value Quotes", chartTypes: ["cards"] },
      { key: "no_contact_quotes", title: "No Contact Quotes", chartTypes: ["cards"] },
      { key: "approval_pipeline", title: "Approval Pipeline", chartTypes: ["bar", "pie", "donut", "line"] },
      { key: "due_soon_vs_later", title: "Due Soon vs Later", chartTypes: ["bar", "pie", "donut"] }
    ];
  },

  normalizeWidgetTypes(typeMapInput) {
    const base = APP_CONFIG.defaults.dashboardWidgetTypes || {};
    const merged = { ...base, ...(typeMapInput && typeof typeMapInput === "object" ? typeMapInput : {}) };
    const catalog = this.getWidgetCatalog();
    const out = {};
    catalog.forEach(widget => {
      const allowed = Array.isArray(widget.chartTypes) && widget.chartTypes.length ? widget.chartTypes : ["bar"];
      const selected = String(merged[widget.key] || "").trim().toLowerCase();
      out[widget.key] = allowed.includes(selected) ? selected : allowed[0];
    });
    return out;
  },

  renderLineChart(data, color = "#2563eb") {
    const rows = (Array.isArray(data) ? data : []).slice(0, 8);
    if (!rows.length) return `<div class="info-box">No data.</div>`;
    const width = 420;
    const height = 120;
    const padX = 14;
    const padY = 10;
    const max = Math.max(...rows.map(r => Number(r.value || 0)), 1);
    const stepX = rows.length > 1 ? ((width - (padX * 2)) / (rows.length - 1)) : 0;
    const points = rows.map((r, i) => {
      const x = padX + (i * stepX);
      const y = height - padY - ((Number(r.value || 0) / max) * (height - (padY * 2)));
      return { x, y };
    });
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    const area = `${path} L${(padX + ((rows.length - 1) * stepX)).toFixed(2)},${(height - padY).toFixed(2)} L${padX},${(height - padY).toFixed(2)} Z`;
    return `
      <div class="dashboard-line-wrap">
        <svg class="dashboard-line-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
          <path class="dashboard-line-area" d="${area}"></path>
          <path class="dashboard-line-path" d="${path}" style="stroke:${color};"></path>
        </svg>
      </div>
      <div class="dashboard-line-labels">${rows.map(r => `<span>${Utils.escapeHtml(String(r.label || ""))}</span>`).join("")}</div>
    `;
  },

  renderPieChart(data, donut = false) {
    const rows = (Array.isArray(data) ? data : []).slice(0, 8).filter(r => Number(r.value || 0) > 0);
    if (!rows.length) return `<div class="info-box">No data.</div>`;
    const total = rows.reduce((s, r) => s + Number(r.value || 0), 0);
    const cx = 62;
    const cy = 62;
    const radius = 50;
    const inner = donut ? 28 : 0;
    let start = -Math.PI / 2;
    const slices = rows.map((row, idx) => {
      const value = Number(row.value || 0);
      const ratio = total > 0 ? (value / total) : 0;
      const angle = ratio * Math.PI * 2;
      const end = start + angle;
      const color = this.chartPalette[idx % this.chartPalette.length];
      const large = angle > Math.PI ? 1 : 0;
      const x1 = cx + Math.cos(start) * radius;
      const y1 = cy + Math.sin(start) * radius;
      const x2 = cx + Math.cos(end) * radius;
      const y2 = cy + Math.sin(end) * radius;
      let d = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
      if (donut) {
        const ix2 = cx + Math.cos(end) * inner;
        const iy2 = cy + Math.sin(end) * inner;
        const ix1 = cx + Math.cos(start) * inner;
        const iy1 = cy + Math.sin(start) * inner;
        d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${inner} ${inner} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`;
      }
      start = end;
      return { d, color, label: String(row.label || "N/A"), value, ratio };
    });

    return `
      <div class="dashboard-pie-wrap">
        <svg class="dashboard-pie-svg" viewBox="0 0 124 124" preserveAspectRatio="xMidYMid meet">
          ${slices.map(s => `<path d="${s.d}" fill="${s.color}"></path>`).join("")}
        </svg>
        <div class="dashboard-pie-legend">
          ${slices.map(s => `
            <div class="dashboard-pie-legend-item">
              <span class="dashboard-pie-dot" style="background:${s.color};"></span>
              <span class="dashboard-pie-label">${Utils.escapeHtml(s.label)}</span>
              <span class="dashboard-pie-value">${Utils.escapeHtml(`${Math.round(s.ratio * 100)}%`)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  },

  renderComboChart(countRows, valueRows) {
    const labels = (countRows || []).map(r => String(r.label || "")).slice(0, 6);
    if (!labels.length) return `<div class="info-box">No data.</div>`;
    const width = 420;
    const height = 130;
    const padX = 14;
    const padY = 12;
    const barMax = Math.max(...(countRows || []).map(r => Number(r.value || 0)), 1);
    const lineMax = Math.max(...(valueRows || []).map(r => Number(r.value || 0)), 1);
    const innerWidth = width - (padX * 2);
    const slot = innerWidth / labels.length;
    const bars = labels.map((label, i) => {
      const value = Number((countRows || [])[i]?.value || 0);
      const h = (value / barMax) * (height - (padY * 2));
      const x = padX + (i * slot) + (slot * 0.2);
      const y = height - padY - h;
      const w = slot * 0.6;
      return `<rect class="dashboard-combo-bar" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="4"></rect>`;
    }).join("");
    const points = labels.map((label, i) => {
      const value = Number((valueRows || [])[i]?.value || 0);
      const x = padX + (i * slot) + (slot * 0.5);
      const y = height - padY - ((value / lineMax) * (height - (padY * 2)));
      return { x, y };
    });
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    const dots = points.map(p => `<circle class="dashboard-combo-dot" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="2.6"></circle>`).join("");
    return `
      <div class="dashboard-line-wrap">
        <svg class="dashboard-line-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
          ${bars}
          <path class="dashboard-combo-line" d="${line}"></path>
          ${dots}
        </svg>
      </div>
      <div class="dashboard-line-labels">${labels.map(l => `<span>${Utils.escapeHtml(l)}</span>`).join("")}</div>
    `;
  },

  renderBarRows(data, maxRows = 6) {
    const rows = (Array.isArray(data) ? data : []).slice(0, maxRows);
    if (!rows.length) return `<div class="info-box">No data.</div>`;
    const max = Math.max(...rows.map(x => Number(x.value || 0)), 1);
    return rows.map(row => {
      const val = Number(row.value || 0);
      const width = Math.max(8, Math.round((val / max) * 100));
      return `
        <div class="chart-row">
          <div class="chart-label">${Utils.escapeHtml(row.label || "")}</div>
          <div class="chart-bar-wrap"><div class="chart-bar" style="width:${width}%;"></div></div>
          <div class="chart-value">${Utils.escapeHtml(val.toLocaleString())}</div>
        </div>
      `;
    }).join("");
  },

  renderRowsByType(rows, type, options = {}) {
    const maxRows = Number(options.maxRows || 8);
    if (type === "pie") return this.renderPieChart(rows.slice(0, maxRows), false);
    if (type === "donut") return this.renderPieChart(rows.slice(0, maxRows), true);
    if (type === "line") return this.renderLineChart(rows.slice(0, maxRows), options.lineColor || "#2563eb");
    return this.renderBarRows(rows, maxRows);
  },

  countBy(quotations, getter) {
    const map = {};
    (quotations || []).forEach(q => {
      const key = String(getter(q) || "").trim() || "N/A";
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  },

  sumBy(quotations, keyGetter, valueGetter) {
    const map = {};
    (quotations || []).forEach(q => {
      const key = String(keyGetter(q) || "").trim() || "N/A";
      const value = Number(valueGetter(q) || 0);
      map[key] = (map[key] || 0) + (Number.isFinite(value) ? value : 0);
    });
    return map;
  },

  toSortedRows(map) {
    return Object.entries(map || {}).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  },

  renderWidget(widgetKey, title, quotations, completionStatuses, widgetType = "") {
    const completed = (quotations || []).filter(q => completionStatuses.has(q.status));
    const active = (quotations || []).filter(q => !completionStatuses.has(q.status));
    const values = (quotations || []).map(q => Number(q.totalValue || 0)).filter(v => Number.isFinite(v));
    const totalValue = values.reduce((s, v) => s + v, 0);
    const avgValue = values.length ? (totalValue / values.length) : 0;
    const now = new Date();
    const recentThreshold = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    const aging = { overdue: 0, today: 0, next3: 0, later: 0 };
    (quotations || []).forEach(q => {
      const d = Utils.getDueMeta(q.dueDate, q.quoteTime);
      if (!d || d.bucket === "invalid") return;
      if (d.bucket === "overdue") aging.overdue++;
      else if (d.bucket === "today") aging.today++;
      else if (d.bucket === "next3") aging.next3++;
      else aging.later++;
    });

    const byStatus = this.toSortedRows(this.countBy(quotations, q => q.status));
    const byOrigin = this.toSortedRows(this.countBy(quotations, q => q.origin));
    const bySales = this.toSortedRows(this.countBy(quotations, q => q.salesPerson));
    const byPG = this.toSortedRows(this.countBy(quotations, q => q.pgType));
    const topCustomersByCount = this.toSortedRows(this.countBy(quotations, q => q.customerName || q.customerCode));
    const topCustomersByValue = this.toSortedRows(this.sumBy(quotations, q => q.customerName || q.customerCode, q => q.totalValue));
    const topOriginsByValue = this.toSortedRows(this.sumBy(quotations, q => q.origin, q => q.totalValue));
    const topSalesByValue = this.toSortedRows(this.sumBy(quotations, q => q.salesPerson, q => q.totalValue));
    const avgByStatus = this.toSortedRows((() => {
      const sums = this.sumBy(quotations, q => q.status, q => q.totalValue);
      const counts = this.countBy(quotations, q => q.status);
      const out = {};
      Object.keys(sums).forEach(k => {
        out[k] = counts[k] ? Math.round((sums[k] / counts[k]) * 100) / 100 : 0;
      });
      return out;
    })());

    const byWeekday = this.toSortedRows(this.countBy(quotations, q => {
      const dt = new Date((q.createdAt || q.targetDate || "") + (q.createdAt ? "" : "T00:00:00"));
      if (Number.isNaN(dt.getTime())) return "Unknown";
      return dt.toLocaleDateString(undefined, { weekday: "short" });
    }));
    const orderedMonth = this.toSortedRows(this.countBy(quotations, q => {
      const dt = new Date((q.targetDate || q.createdAt || "") + (q.createdAt ? "" : "T00:00:00"));
      if (Number.isNaN(dt.getTime())) return "";
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    }))
      .filter(r => r.label)
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-8)
      .map(r => {
        const [y, m] = r.label.split("-");
        const dt = new Date(Number(y), Number(m) - 1, 1);
        return { label: dt.toLocaleDateString(undefined, { month: "short" }), value: r.value };
      });
    const recent7 = (quotations || []).filter(q => {
      const dt = new Date(q.createdAt || "");
      return !Number.isNaN(dt.getTime()) && dt >= recentThreshold;
    }).length;
    const zeroValue = (quotations || []).filter(q => Number(q.totalValue || 0) <= 0).length;
    const highValue = (quotations || []).filter(q => Number(q.totalValue || 0) >= 100000).length;
    const noContact = (quotations || []).filter(q => !String(q.contactName || "").trim() && !String(q.email || "").trim() && !String(q.phone || "").trim()).length;
    const dueSoon = aging.today + aging.next3;
    const approvalPipelineRows = ["UNDER REVIEW", "FOR APPROVAL", "STD"].map(label => ({
      label,
      value: (quotations || []).filter(q => String(q.status || "").trim().toUpperCase() === label).length
    }));
    const agingRows = [
      { label: "Overdue", value: aging.overdue },
      { label: "Due Today", value: aging.today },
      { label: "Next 3 Days", value: aging.next3 },
      { label: "Later", value: aging.later }
    ];
    const completionRows = [
      { label: "Completed", value: completed.length },
      { label: "Active", value: active.length }
    ];
    const recentRows = [
      { label: "Created (7d)", value: recent7 },
      { label: "Total Quotes", value: quotations.length },
      { label: "No Contact", value: noContact },
      { label: "High Value", value: highValue }
    ];

    const card = (bodyHtml) => `
      <div class="dashboard-widget-card">
        <h4 class="dashboard-widget-title">${Utils.escapeHtml(title)}</h4>
        ${bodyHtml}
      </div>
    `;

    switch (widgetKey) {
      case "status_distribution": return card(this.renderRowsByType(byStatus, widgetType, { maxRows: 8 }));
      case "origin_distribution": return card(this.renderRowsByType(byOrigin, widgetType, { maxRows: 8 }));
      case "sales_distribution": return card(this.renderRowsByType(bySales, widgetType, { maxRows: 8 }));
      case "pg_distribution": return card(this.renderRowsByType(byPG, widgetType, { maxRows: 4 }));
      case "aging_overview":
        if (widgetType === "cards") {
          return card(`
            <div class="dashboard-mini-metrics">
              <div class="dashboard-mini-metric"><strong>${aging.overdue}</strong><span>Overdue</span></div>
              <div class="dashboard-mini-metric"><strong>${aging.today}</strong><span>Due Today</span></div>
              <div class="dashboard-mini-metric"><strong>${aging.next3}</strong><span>Next 3 Days</span></div>
              <div class="dashboard-mini-metric"><strong>${aging.later}</strong><span>Later</span></div>
            </div>
          `);
        }
        return card(this.renderRowsByType(agingRows, widgetType, { maxRows: 4 }));
      case "completion_ratio":
        if (widgetType === "cards") {
          return card(`
            <div class="dashboard-mini-metrics">
              <div class="dashboard-mini-metric"><strong>${completed.length}</strong><span>Completed</span></div>
              <div class="dashboard-mini-metric"><strong>${active.length}</strong><span>Active</span></div>
              <div class="dashboard-mini-metric"><strong>${quotations.length ? Math.round((completed.length / quotations.length) * 100) : 0}%</strong><span>Completion</span></div>
              <div class="dashboard-mini-metric"><strong>${quotations.length}</strong><span>Total</span></div>
            </div>
          `);
        }
        return card(this.renderRowsByType(completionRows, widgetType, { maxRows: 2 }));
      case "active_vs_completed": return card(this.renderRowsByType(completionRows, widgetType, { maxRows: 2 }));
      case "top_customers_by_count": return card(this.renderRowsByType(topCustomersByCount, widgetType, { maxRows: 8 }));
      case "top_customers_by_value": return card(this.renderRowsByType(topCustomersByValue, widgetType, { maxRows: 8 }));
      case "top_origins_by_value": return card(this.renderRowsByType(topOriginsByValue, widgetType, { maxRows: 8 }));
      case "top_sales_by_value": return card(this.renderRowsByType(topSalesByValue, widgetType, { maxRows: 8 }));
      case "avg_value_by_status": return card(this.renderRowsByType(avgByStatus, widgetType, { maxRows: 8 }));
      case "quotes_by_weekday": return card(this.renderRowsByType(byWeekday, widgetType, { maxRows: 7, lineColor: "#1d4ed8" }));
      case "quotes_by_month_line": return card(this.renderRowsByType(orderedMonth, widgetType, { maxRows: 8, lineColor: "#0f766e" }));
      case "weekly_activity_line": return card(this.renderRowsByType(byWeekday.slice().reverse(), widgetType, { maxRows: 7, lineColor: "#1d4ed8" }));
      case "status_count_value_combo": {
        const countRows = byStatus.slice(0, 6);
        const valueMap = this.sumBy(quotations, q => q.status, q => q.totalValue);
        const valueRows = countRows.map(r => ({ label: r.label, value: Number(valueMap[r.label] || 0) }));
        if (widgetType === "combo") return card(this.renderComboChart(countRows, valueRows));
        return card(this.renderRowsByType(countRows, widgetType, { maxRows: 6 }));
      }
      case "recent_7day_created":
        if (widgetType === "cards") {
          return card(`
            <div class="dashboard-mini-metrics">
              <div class="dashboard-mini-metric"><strong>${recent7}</strong><span>Created (7d)</span></div>
              <div class="dashboard-mini-metric"><strong>${quotations.length}</strong><span>Total</span></div>
              <div class="dashboard-mini-metric"><strong>${totalValue.toLocaleString()}</strong><span>Total Value</span></div>
              <div class="dashboard-mini-metric"><strong>${avgValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><span>Average Value</span></div>
            </div>
          `);
        }
        return card(this.renderRowsByType(recentRows, widgetType, { maxRows: 4 }));
      case "zero_value_quotes": return card(`<div class="dashboard-mini-metric"><strong>${zeroValue}</strong><span>Zero Value Quotations</span></div>`);
      case "high_value_quotes": return card(`<div class="dashboard-mini-metric"><strong>${highValue}</strong><span>Value >= 100,000</span></div>`);
      case "no_contact_quotes": return card(`<div class="dashboard-mini-metric"><strong>${noContact}</strong><span>No Contact Details</span></div>`);
      case "approval_pipeline": return card(this.renderRowsByType(approvalPipelineRows, widgetType, { maxRows: 3 }));
      case "due_soon_vs_later": return card(this.renderRowsByType([
        { label: "Due Soon (Today + 3d)", value: dueSoon },
        { label: "Later", value: aging.later }
      ], widgetType, { maxRows: 2 }));
      default:
        return card(`<div class="info-box">Widget not available.</div>`);
    }
  },

  render() {
    const stats = document.getElementById("dashboardStats");
    const visuals = document.getElementById("dashboardVisuals");
    const table = document.getElementById("dashboardTable");
    const labels = (window.App && typeof App.getTagLabels === "function")
      ? App.getTagLabels()
      : { tag: "Origin", subTag: "Sub Tag" };
    const quotations = App.getFilteredQuotations();
    const statusGroups = App.getStatusGroups();
    const completionStatuses = new Set(App.getCompletionStatuses());

    const total = quotations.length;
    const groupStats = statusGroups.map(group => ({
      name: group.name,
      count: quotations.filter(q => group.substatuses.includes(q.status)).length
    }));

    stats.innerHTML = `
      <div class="stat-card"><div class="stat-value">${total}</div><div>Total Quotations</div></div>
      ${groupStats.map(stat => `<div class="stat-card"><div class="stat-value">${stat.count}</div><div>${Utils.escapeHtml(stat.name)}</div></div>`).join("")}
    `;

    const selectedWidgetsRaw = Array.isArray(AppState.settings?.dashboardWidgets)
      ? AppState.settings.dashboardWidgets
      : (APP_CONFIG.defaults.dashboardWidgets || []);
    const widgetOrderRaw = Array.isArray(AppState.settings?.dashboardWidgetOrder)
      ? AppState.settings.dashboardWidgetOrder
      : (APP_CONFIG.defaults.dashboardWidgetOrder || []);
    const widgetTypeMap = this.normalizeWidgetTypes(
      AppState.settings?.dashboardWidgetTypes || APP_CONFIG.defaults.dashboardWidgetTypes || {}
    );
    const widgetLimit = Math.max(1, Math.min(50, Number(AppState.settings?.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardMaxWidgets ?? APP_CONFIG.defaults.dashboardWidgetLimit ?? 20) || 20));
    const widgetColumns = [2, 3, 4].includes(Number(AppState.settings?.dashboardColumns))
      ? Number(AppState.settings.dashboardColumns)
      : Number(APP_CONFIG.defaults.dashboardColumns || 3);
    const widgetCatalog = this.getWidgetCatalog();
    const catalogSet = new Set(widgetCatalog.map(w => w.key));
    const orderIndex = new Map(widgetOrderRaw.map((k, i) => [String(k || "").trim(), i]));
    const selectedWidgets = [...new Set(selectedWidgetsRaw.filter(key => catalogSet.has(key)))]
      .sort((a, b) => (orderIndex.has(a) ? orderIndex.get(a) : 9999) - (orderIndex.has(b) ? orderIndex.get(b) : 9999))
      .slice(0, widgetLimit);
    visuals.style.gridTemplateColumns = `repeat(${widgetColumns}, minmax(0, 1fr))`;
    visuals.innerHTML = selectedWidgets.length
      ? selectedWidgets.map(key => {
          const meta = widgetCatalog.find(w => w.key === key);
          const widgetType = widgetTypeMap[key] || (meta?.chartTypes?.[0] || "bar");
          return this.renderWidget(key, meta?.title || key, quotations, completionStatuses, widgetType);
        }).join("")
      : `<div class="info-box">No dashboard visuals selected. Configure in Settings.</div>`;

    if (!AppState.dashboard) {
      AppState.dashboard = { completedPage: 1, pageSize: 12 };
    }
    const pageSize = Math.max(5, Number(AppState.dashboard.pageSize || 12));
    const completedRows = quotations.filter(q => completionStatuses.has(q.status));
    const totalRows = completedRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const current = Math.min(Math.max(1, Number(AppState.dashboard.completedPage || 1)), totalPages);
    AppState.dashboard.completedPage = current;
    const start = (current - 1) * pageSize;
    const pagedRows = completedRows.slice(start, start + pageSize);

    table.innerHTML = `
      <div class="panel soft-panel" style="margin-top: 0.7rem;">
        <h3 style="margin-top:0;">Completed Quotations (Audit)</h3>
        ${pagedRows.length ? `
          <table class="basic-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>${Utils.escapeHtml(labels.tag)}</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Total Value</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${pagedRows.map(q => `
                <tr>
                  <td>${Utils.escapeHtml(q.reference || "")}</td>
                  <td>${Utils.escapeHtml(q.customerName || "")}</td>
                  <td>${Utils.escapeHtml(q.origin || "")}</td>
                  <td>${Utils.escapeHtml(q.status || "")}</td>
                  <td>${Utils.escapeHtml(q.dueDate || "")}</td>
                  <td>${Utils.escapeHtml(q.totalValue || 0)}</td>
                  <td>
                    <button class="btn btn-warning btn-sm" data-audit="${Utils.escapeHtml(q.reference)}">Audit</button>
                    <button class="btn btn-secondary btn-sm" data-print="${Utils.escapeHtml(q.reference)}">Print</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : `<div class="info-box">No completed quotations.</div>`}
      </div>
      <div class="list-pagination">
        <button class="btn btn-secondary btn-sm" data-completed-prev ${current <= 1 ? "disabled" : ""}>Prev</button>
        <span>Page ${current} of ${totalPages} (${totalRows} items)</span>
        <button class="btn btn-secondary btn-sm" data-completed-next ${current >= totalPages ? "disabled" : ""}>Next</button>
      </div>
    `;

    table.querySelectorAll("[data-print]").forEach(btn => {
      btn.addEventListener("click", () => {
        window.open(`print.html?reference=${encodeURIComponent(btn.dataset.print)}`, "_blank");
      });
    });
    table.querySelectorAll("[data-audit]").forEach(btn => {
      btn.addEventListener("click", () => App.showAudit(btn.dataset.audit));
    });
    table.querySelector("[data-completed-prev]")?.addEventListener("click", () => {
      AppState.dashboard.completedPage = Math.max(1, current - 1);
      this.render();
    });
    table.querySelector("[data-completed-next]")?.addEventListener("click", () => {
      AppState.dashboard.completedPage = Math.min(totalPages, current + 1);
      this.render();
    });
  }
};

window.LayoutEngine = {
  GRID_COLS: 24,
  HALF_SPAN: 12,
  FULL_SPAN: 24,
  MAX_ROW_SPAN: 6,
  FORM_COL_GAP: 9,
  MIN_FORM_COL_SIZE: 24,
  MIN_CANVAS_WIDTH: 520,

  getLayoutKey(target) {
    return target === "customer" ? "customerFormLayout" : "formLayout";
  },

  getDefaults(target) {
    if (target === "customer") return APP_CONFIG.defaults.customerFormLayout || [];
    return APP_CONFIG.defaults.formLayout || [];
  },

  getCanvasMetrics(canvasWidth, options = {}) {
    const gridCols = Number(options.gridCols) || Number(this.GRID_COLS) || 24;
    const colGap = Math.max(0, Number(options.gap) || Number(this.FORM_COL_GAP) || 9);
    const minColSize = Math.max(1, Number(options.minColSize) || Number(this.MIN_FORM_COL_SIZE) || 24);
    const minCanvasWidth = Math.max(1, Number(options.minCanvasWidth) || Number(this.MIN_CANVAS_WIDTH) || 520);
    const requestedWidth = Math.max(minCanvasWidth, Number(canvasWidth) || 1000);
    const fixedColSize = Number(options.fixedColSize);
    const colSize = Number.isFinite(fixedColSize) && fixedColSize > 0
      ? Math.max(minColSize, Math.floor(fixedColSize))
      : Math.max(minColSize, Math.floor((requestedWidth - (colGap * (gridCols - 1))) / gridCols));
    const contentWidth = (colSize * gridCols) + (colGap * (gridCols - 1));
    const width = Math.max(requestedWidth, contentWidth);
    return {
      width,
      contentWidth,
      colSize,
      colGap,
      trackSize: colSize + colGap,
      gridCols
    };
  },

  normalizeCanvasWidth(canvasWidth, options = {}) {
    return this.getCanvasMetrics(canvasWidth, options).width;
  },

  normalize(target, layoutInput) {
    const gridCols = Number(this.GRID_COLS) || 24;
    const defaultsRaw = this.getDefaults(target).map(item => ({ ...item }));
    const defaultsNeedScale =
      defaultsRaw.some(item => Number(item?.colSpan) > 0) &&
      defaultsRaw.every(item => (Number(item?.col) || 0) <= 12 && (Number(item?.colSpan) || 0) <= 12);
    const defaults = defaultsRaw.map(item => {
      const col = Number(item?.col) || 0;
      const colSpan = Number(item?.colSpan) || 0;
      return {
        ...item,
        col: defaultsNeedScale && col > 0 ? Math.min(gridCols, (col * 2) - 1) : col,
        colSpan: defaultsNeedScale && colSpan > 0 ? Math.min(gridCols, colSpan * 2) : colSpan,
        gridCols
      };
    });
    const incomingList = Array.isArray(layoutInput) ? layoutInput : [];
    const hasGridMeta = incomingList.some(item => Number(item?.gridCols) === gridCols);
    const incomingLooksTwelveBased =
      incomingList.length > 0 &&
      incomingList.some(item => Number(item?.colSpan) > 0) &&
      incomingList.every(item => {
        const col = Number(item?.col) || 0;
        const span = Number(item?.colSpan) || 0;
        return col <= 12 && span <= 12;
      }) &&
      incomingList.some(item => {
        const col = Number(item?.col) || 0;
        const span = Number(item?.colSpan) || 0;
        return span <= 6 || (col >= 7 && col <= 12);
      });
    const legacyNeedsScale = (!hasGridMeta || incomingLooksTwelveBased) && incomingList.some(item => {
      const col = Number(item?.col) || 0;
      const span = Number(item?.colSpan) || 0;
      return (col > 0 && col <= 12) || (span > 0 && span <= 12);
    });
    const incoming = {};
    incomingList.forEach(item => {
      const key = String(item?.key || "").trim();
      if (!key) return;
      const rawCol = Number(item?.col) || 0;
      const rawColSpan = Number(item?.colSpan) || 0;
      const scaledCol = legacyNeedsScale && rawCol > 0 ? Math.min(gridCols, (rawCol * 2) - 1) : rawCol;
      const scaledColSpan = legacyNeedsScale && rawColSpan > 0 ? Math.min(gridCols, rawColSpan * 2) : rawColSpan;
      incoming[key] = {
        key,
        visible: item?.visible !== false,
        width: item?.width === "full" ? "full" : "half",
        fieldBorder: item?.fieldBorder !== false,
        locked: item?.locked === true,
        order: Number(item?.order) || 0,
        col: scaledCol,
        row: Number(item?.row) || 0,
        colSpan: scaledColSpan,
        rowSpan: Number(item?.rowSpan) || 0,
        label: String(item?.label || "").trim(),
        previewType: String(item?.previewType || "").trim(),
        gridCols
      };
    });
    const merged = defaults.map((base, index) => ({
      ...base,
      ...(incoming[base.key] || {}),
      order: Number(incoming[base.key]?.order || base.order || (index + 1))
    }));
    return this.ensureCoordinates(merged.sort((a, b) => a.order - b.order));
  },

  ensureCoordinates(layout) {
    const prepared = Array.isArray(layout) ? layout.map(item => ({ ...item })) : [];
    const gridCols = Number(this.GRID_COLS) || 24;
    const halfSpan = Number(this.HALF_SPAN) || 12;
    const fullSpan = Number(this.FULL_SPAN) || gridCols;
    const maxRowSpan = Number(this.MAX_ROW_SPAN) || 6;
    let row = 1;
    let nextCol = 1;
    prepared.forEach(item => {
      const defaultSpan = item.width === "full" ? fullSpan : halfSpan;
      const colSpan = Math.min(gridCols, Math.max(1, Number(item.colSpan) || defaultSpan));
      const rowSpan = Math.min(maxRowSpan, Math.max(1, Number(item.rowSpan) || 1));
      let col = Math.min(gridCols, Math.max(1, Number(item.col) || 0));
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
          nextCol = halfSpan + 1;
        } else {
          col = halfSpan + 1;
          r = row;
          row += rowSpan;
          nextCol = 1;
        }
      }
      if (col + colSpan - 1 > gridCols) col = Math.max(1, (gridCols + 1) - colSpan);
      item.col = col;
      item.row = r;
      item.colSpan = colSpan;
      item.rowSpan = rowSpan;
      item.width = colSpan >= fullSpan ? "full" : "half";
      item.gridCols = gridCols;
    });
    return prepared.map((item, index) => ({ ...item, order: index + 1 }));
  },

  applyToContainer(containerEl, layout) {
    if (!containerEl) return;
    const gridCols = Number(this.GRID_COLS) || 24;
    const fullSpan = Number(this.FULL_SPAN) || gridCols;
    const halfSpan = Number(this.HALF_SPAN) || 12;
    const maxRowSpan = Number(this.MAX_ROW_SPAN) || 6;
    containerEl.classList.add("is-precision-layout");
    const byKey = {};
    [...containerEl.querySelectorAll("[data-form-field]")].forEach(el => {
      byKey[el.dataset.formField] = el;
    });
    (Array.isArray(layout) ? layout : []).forEach(item => {
      const el = byKey[item.key];
      if (!el) return;
      const visible = item.visible !== false;
      const fieldBorder = item.fieldBorder !== false;
      const locked = item.locked === true;
      const col = Math.min(gridCols, Math.max(1, Number(item.col) || 1));
      const row = Math.max(1, Number(item.row) || 1);
      const colSpan = Math.min(gridCols, Math.max(1, Number(item.colSpan) || (item.width === "full" ? fullSpan : halfSpan)));
      const rowSpan = Math.min(maxRowSpan, Math.max(1, Number(item.rowSpan) || 1));
      el.classList.toggle("hidden", !visible);
      el.classList.toggle("field-border-off", !fieldBorder);
      el.classList.toggle("field-locked", locked);
      el.style.gridColumn = `${col} / span ${colSpan}`;
      el.style.gridRow = `${row} / span ${rowSpan}`;
      const labelEl = el.querySelector("label");
      if (labelEl) {
        if (!labelEl.dataset.defaultText) labelEl.dataset.defaultText = labelEl.textContent || "";
        labelEl.textContent = String(item.label || "").trim() || labelEl.dataset.defaultText;
      }
      containerEl.appendChild(el);
    });
    containerEl.style.setProperty("--form-cols", String(gridCols));
    containerEl.style.setProperty("--form-gap", `${Number(this.FORM_COL_GAP) || 9}px`);
  }
};

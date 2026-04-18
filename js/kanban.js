window.Kanban = {
  dragState: { id: "", justDroppedAt: 0 },

  getActionButtons(q) {
    const canReview = ApprovalWorkflow.canReview(AppState.session, q);
    const canApprove = ApprovalWorkflow.canApprove(AppState.session, q);
    const canArchive = App.canArchive();
    const canDelete = App.canDelete();
    return `
      <button class="btn btn-secondary btn-sm" data-edit="${Utils.escapeHtml(q.id)}">Edit</button>
      <button class="btn btn-secondary btn-sm" data-print="${Utils.escapeHtml(q.reference)}">Print</button>
      ${canReview ? `<button class="btn btn-success btn-sm" data-review-approve="${Utils.escapeHtml(q.id)}">Review OK</button><button class="btn btn-warning btn-sm" data-review-return="${Utils.escapeHtml(q.id)}">Return</button>` : ""}
      ${canApprove ? `<button class="btn btn-success btn-sm" data-final-approve="${Utils.escapeHtml(q.id)}">Approve</button><button class="btn btn-warning btn-sm" data-final-return="${Utils.escapeHtml(q.id)}">Back</button>` : ""}
      ${canArchive ? `<button class="btn btn-secondary btn-sm" data-archive="${Utils.escapeHtml(q.id)}">Archive</button>` : ""}
      ${canDelete ? `<button class="btn btn-danger btn-sm" data-delete="${Utils.escapeHtml(q.id)}">Delete</button>` : ""}
    `;
  },

  bindActionEvents(board) {
    board.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", () => {
        const q = AppState.quotations.find(x => x.id === btn.dataset.edit);
        if (q) QuotationForm.loadForEdit(q);
      });
    });

    board.querySelectorAll("[data-print]").forEach(btn => {
      btn.addEventListener("click", () => {
        window.open(`print.html?reference=${encodeURIComponent(btn.dataset.print)}`, "_blank");
      });
    });

    board.querySelectorAll("[data-review-approve]").forEach(btn => {
      btn.addEventListener("click", () => App.openApprovalModal(btn.dataset.reviewApprove, "reviewApprove"));
    });
    board.querySelectorAll("[data-review-return]").forEach(btn => {
      btn.addEventListener("click", () => App.openApprovalModal(btn.dataset.reviewReturn, "reviewReturn"));
    });
    board.querySelectorAll("[data-final-approve]").forEach(btn => {
      btn.addEventListener("click", () => App.openApprovalModal(btn.dataset.finalApprove, "finalApprove"));
    });
    board.querySelectorAll("[data-final-return]").forEach(btn => {
      btn.addEventListener("click", () => App.openApprovalModal(btn.dataset.finalReturn, "finalReturn"));
    });

    board.querySelectorAll("[data-archive]").forEach(btn => {
      btn.addEventListener("click", async () => await App.archiveQuotation(btn.dataset.archive));
    });

    board.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", async () => await App.deleteQuotation(btn.dataset.delete));
    });
  },

  render() {
    const board = document.getElementById("kanbanBoard");
    const labels = App.getTagLabels();
    const finishZone = document.getElementById("kanbanFinishZone");
    const workspace = document.querySelector(".kanban-workspace");
    board.innerHTML = "";
    board.classList.remove("list-view");
    finishZone.classList.remove("drag-over");

    const mode = App.getKanbanViewMode();
    const boardLayout = App.getBoardLayoutMode();
    const groupDefs = App.getStatusGroups();
    const completionStatuses = App.getCompletionStatuses();
    const showCompleted = App.showCompletedInKanban();
    const statusGroups = groupDefs
      .filter(group => group.showOnBoard !== false)
      .flatMap(group => {
        const effectiveMode = group.columnView === "default" ? mode : group.columnView;

        if (effectiveMode === "main") {
          if (!showCompleted && group.isCompletion) return [];
          return [{
            name: group.name,
            parentName: "",
            color: group.color,
            key: `main:${group.name}`,
            substatuses: group.substatuses,
            dropStatus: App.getDefaultStatusForGroup(group.name)
          }];
        }

        return group.substatuses
          .filter(status => showCompleted || !completionStatuses.includes(status))
          .map(status => ({
            name: status,
            parentName: group.name,
            color: group.substatusColors?.[status] || group.color,
            key: `sub:${status}`,
            substatuses: [status],
            dropStatus: status
          }));
      });
    const itemsFiltered = App.getFilteredQuotations();

    if (boardLayout === "list") {
      workspace?.classList.add("list-mode");
      finishZone.classList.add("hidden");
      board.classList.add("list-view");
      const visibleStatuses = new Set(statusGroups.flatMap(group => group.substatuses));
      const listItems = itemsFiltered.filter(q => {
        if (!visibleStatuses.has(q.status)) return false;
        if (showCompleted) return true;
        return !completionStatuses.includes(q.status);
      });
      const pageSize = App.getListPageSize();
      const totalItems = listItems.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const currentPage = Math.min(App.getListPage(), totalPages);
      App.setListPage(currentPage);
      const startIndex = (currentPage - 1) * pageSize;
      const pagedItems = listItems.slice(startIndex, startIndex + pageSize);
      const selectedIds = new Set(App.getSelectedListIds());
      const visibleIds = pagedItems.map(q => q.id);
      const allVisibleChecked = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
      const hasSelection = selectedIds.size > 0;
      const statusOptions = App.getAllStatuses()
        .map(s => `<option value="${Utils.escapeHtml(s)}">${Utils.escapeHtml(s)}</option>`)
        .join("");

      board.innerHTML = `
        <div class="list-pagination" style="justify-content: space-between; margin-top: 0; margin-bottom: 0.55rem;">
          <span>${selectedIds.size} selected</span>
          <div style="display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap;">
            <select id="bulkStatusSelect" ${hasSelection ? "" : "disabled"}>${statusOptions}</select>
            <button class="btn btn-secondary btn-sm" id="btnBulkSetStatus" ${hasSelection ? "" : "disabled"}>Set Status</button>
            ${App.canArchive() ? `<button class="btn btn-secondary btn-sm" id="btnBulkArchive" ${hasSelection ? "" : "disabled"}>Archive Selected</button>` : ""}
            ${App.canDelete() ? `<button class="btn btn-danger btn-sm" id="btnBulkDelete" ${hasSelection ? "" : "disabled"}>Delete Selected</button>` : ""}
            <button class="btn btn-secondary btn-sm" id="btnBulkClear" ${hasSelection ? "" : "disabled"}>Clear</button>
          </div>
        </div>
        <table class="kanban-list-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="chkListAll" ${allVisibleChecked ? "checked" : ""} /></th>
              <th>Reference</th>
              <th>Customer</th>
              <th>Status</th>
              <th>${Utils.escapeHtml(labels.tag)}</th>
              <th>Due Date</th>
              <th>${Utils.escapeHtml(labels.subTag)}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pagedItems.length ? pagedItems.map(q => `
              <tr class="kanban-list-row" data-row-id="${Utils.escapeHtml(q.id)}">
                <td><input type="checkbox" class="row-select" data-row-id="${Utils.escapeHtml(q.id)}" ${selectedIds.has(q.id) ? "checked" : ""} /></td>
                <td><strong>${Utils.escapeHtml(q.reference || "")}</strong></td>
                <td>${Utils.escapeHtml(q.customerName || "")}</td>
                <td><span class="status-chip">${Utils.escapeHtml(q.status || "")}</span></td>
                <td>${Utils.escapeHtml(q.origin || "")}</td>
                <td>${Utils.escapeHtml(q.dueDate || "")}</td>
                <td>${Utils.escapeHtml(q.salesPerson || "")}</td>
                <td><div class="card-actions">${this.getActionButtons(q)}</div></td>
              </tr>
            `).join("") : `<tr><td colspan="8" class="kanban-empty">No records for current filters.</td></tr>`}
          </tbody>
        </table>
        <div class="list-pagination">
          <button class="btn btn-secondary btn-sm" id="btnListPrev" ${currentPage <= 1 ? "disabled" : ""}>Prev</button>
          <span>Page ${currentPage} of ${totalPages} (${totalItems} items)</span>
          <button class="btn btn-secondary btn-sm" id="btnListNext" ${currentPage >= totalPages ? "disabled" : ""}>Next</button>
        </div>
      `;

      board.querySelectorAll(".kanban-list-row").forEach(row => {
        row.addEventListener("click", e => {
          if (e.target.closest("button") || e.target.closest("input[type='checkbox']")) return;
          const q = AppState.quotations.find(x => x.id === row.dataset.rowId);
          if (q) QuotationForm.loadForEdit(q);
        });
      });
      document.getElementById("chkListAll")?.addEventListener("change", e => {
        const selected = new Set(App.getSelectedListIds());
        if (e.target.checked) visibleIds.forEach(id => selected.add(id));
        else visibleIds.forEach(id => selected.delete(id));
        App.setSelectedListIds([...selected]);
        this.render();
      });
      board.querySelectorAll(".row-select").forEach(chk => {
        chk.addEventListener("change", () => {
          const selected = new Set(App.getSelectedListIds());
          const id = chk.dataset.rowId;
          if (chk.checked) selected.add(id); else selected.delete(id);
          App.setSelectedListIds([...selected]);
          this.render();
        });
      });
      document.getElementById("btnBulkClear")?.addEventListener("click", () => {
        App.clearSelectedListIds();
        this.render();
      });
      document.getElementById("btnBulkSetStatus")?.addEventListener("click", async () => {
        const nextStatus = document.getElementById("bulkStatusSelect")?.value;
        await App.bulkUpdateStatus(App.getSelectedListIds(), nextStatus);
      });
      document.getElementById("btnBulkArchive")?.addEventListener("click", async () => {
        if (!window.confirm("Archive selected quotations?")) return;
        await App.bulkArchive(App.getSelectedListIds());
      });
      document.getElementById("btnBulkDelete")?.addEventListener("click", async () => {
        if (!window.confirm("Delete selected quotations permanently?")) return;
        await App.bulkDelete(App.getSelectedListIds());
      });

      const prevBtn = document.getElementById("btnListPrev");
      const nextBtn = document.getElementById("btnListNext");
      if (prevBtn) {
        prevBtn.addEventListener("click", () => {
          App.setListPage(currentPage - 1);
          this.render();
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          App.setListPage(currentPage + 1);
          this.render();
        });
      }

      this.bindActionEvents(board);
      return;
    }

    workspace?.classList.remove("list-mode");
    finishZone.classList.remove("hidden");
    board.style.setProperty("--kanban-col-count", String(Math.max(statusGroups.length, 1)));

    statusGroups.forEach(group => {
      const items = itemsFiltered.filter(q => {
        if (!group.substatuses.includes(q.status)) return false;
        if (showCompleted) return true;
        return !completionStatuses.includes(q.status);
      });
      const col = document.createElement("div");
      col.className = "kanban-column";
      col.dataset.group = group.key;
      col.dataset.dropStatus = group.dropStatus;
      col.style.setProperty("--kanban-col-color", group.color || "#2563eb");
      const parentLabel = group.parentName
        ? `<div class="kanban-parent">${Utils.escapeHtml(group.parentName)}</div>`
        : "";
      col.innerHTML = `
        <div class="kanban-col-head">
          <div class="kanban-title">${Utils.escapeHtml(group.name)}</div>
          ${parentLabel}
          <div class="kanban-col-metrics">${items.length} items</div>
        </div>
        <div class="kanban-dropzone"></div>
      `;
      const zone = col.querySelector(".kanban-dropzone");

      items.forEach(q => {
        const card = document.createElement("div");
        card.className = "kanban-card";
        card.draggable = App.canManuallyMoveStatus();
        if (card.draggable) card.classList.add("is-draggable");
        card.dataset.id = q.id;

        const dueMeta = Utils.getDueMeta(q.dueDate, q.quoteTime);
        const aging = dueMeta.label || "";

        card.innerHTML = `
          <div class="kanban-card-line main">${Utils.escapeHtml(q.reference)} | ${Utils.escapeHtml(q.customerName)}</div>
          <div class="kanban-card-line sub">${Utils.escapeHtml(q.status)} | ${Utils.escapeHtml(q.origin)} | ${Utils.escapeHtml(q.salesPerson)}</div>
          <div class="kanban-card-line">${Utils.escapeHtml(q.dueDate)} | ${Utils.escapeHtml(aging)}</div>
          <div class="card-actions">
            ${this.getActionButtons(q)}
          </div>
        `;
        zone.appendChild(card);
      });
      if (!items.length) {
        zone.innerHTML = `<div class="kanban-empty">No items in this column</div>`;
      }

      board.appendChild(col);
    });

    board.querySelectorAll(".kanban-card").forEach(card => {
      card.addEventListener("dragstart", e => {
        const id = String(card.dataset.id || "");
        this.dragState.id = id;
        document.body.classList.add("is-dragging-card");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
          e.dataTransfer.setData("application/x-kanban-id", id);
        }
      });
      card.addEventListener("dragend", () => {
        document.body.classList.remove("is-dragging-card");
        this.dragState.id = "";
      });
      card.addEventListener("click", e => {
        if (Date.now() - Number(this.dragState.justDroppedAt || 0) < 220) return;
        if (e.target.closest("button")) return;
        const q = AppState.quotations.find(x => x.id === card.dataset.id);
        if (q) QuotationForm.loadForEdit(q);
      });
    });

    board.querySelectorAll(".kanban-dropzone").forEach(zone => {
      zone.addEventListener("dragover", e => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      });
      zone.addEventListener("drop", async e => {
        e.preventDefault();
        e.stopPropagation();
        const id = e.dataTransfer.getData("application/x-kanban-id") || e.dataTransfer.getData("text/plain");
        if (!id) return;
        const newStatus = zone.closest(".kanban-column").dataset.dropStatus;
        this.dragState.justDroppedAt = Date.now();
        await App.updateQuotationStatus(id, newStatus);
      });
    });

    finishZone.ondragover = e => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      finishZone.classList.add("drag-over");
    };
    finishZone.ondragleave = () => finishZone.classList.remove("drag-over");
    finishZone.ondrop = e => {
      e.preventDefault();
      e.stopPropagation();
      finishZone.classList.remove("drag-over");
      const id = e.dataTransfer.getData("application/x-kanban-id") || e.dataTransfer.getData("text/plain");
      if (!id) return;
      this.dragState.justDroppedAt = Date.now();
      App.openCompleteModal(id);
    };

    this.bindActionEvents(board);
  }
};

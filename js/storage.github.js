window.GitHubStorageAdapter = {
  retry: {
    maxAttempts: 4,
    baseDelayMs: 600
  },

  getConfig() {
    return LocalStorageAdapter.load("qt.githubConfig", {
      storageMode: "local",
      repoOwner: "",
      repoName: "",
      branch: "main",
      token: "",
      apiEndpoint: ""
    });
  },

  isEnabled() {
    const cfg = this.getConfig();
    return cfg.storageMode === "github" && !!cfg.repoOwner && !!cfg.repoName && !!cfg.branch && !!cfg.token;
  },

  isApiMode() {
    const cfg = this.getConfig();
    return cfg.storageMode === "api" && !!cfg.apiEndpoint;
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  safeStringify(value) {
    try {
      if (window.Utils && typeof Utils.stableStringify === "function") return Utils.stableStringify(value);
      return JSON.stringify(value);
    } catch {
      return JSON.stringify(value);
    }
  },

  parseGitHubError(status, bodyText = "") {
    const text = String(bodyText || "").slice(0, 240);
    if (status === 401) return "Unauthorized token. Check GitHub token.";
    if (status === 403) {
      if (/rate limit/i.test(text)) return "GitHub API rate limit reached. Retrying shortly.";
      if (/resource not accessible/i.test(text)) return "Token lacks repo write permission.";
      return "GitHub access forbidden. Check token scopes and repo access.";
    }
    if (status === 404) return "Repo, file path, or branch not found.";
    if (status === 409) return "Sync conflict detected. Retrying with latest cloud version.";
    if (status === 422 && /invalid.*sha|sha/i.test(text)) return "Cloud file changed during sync. Retrying.";
    if (status === 422 && /ref/i.test(text)) return "Branch is missing. Create/push branch first.";
    return `GitHub request failed (${status}).`;
  },

  isRetryableStatus(status, bodyText = "") {
    if ([408, 409, 429, 500, 502, 503, 504].includes(status)) return true;
    return status === 422 && /sha|conflict|update/i.test(String(bodyText || ""));
  },

  async requestGitHub(url, options = {}, attempts = this.retry.maxAttempts) {
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await fetch(url, options);
        if (res.ok) return res;
        const text = await res.text();
        const message = this.parseGitHubError(res.status, text);
        const error = new Error(message);
        error.status = res.status;
        error.body = text;
        if (!this.isRetryableStatus(res.status, text) || attempt >= attempts) throw error;
        await this.sleep(this.retry.baseDelayMs * Math.pow(2, attempt - 1));
        lastError = error;
      } catch (error) {
        const networkRetryable = !("status" in error);
        if (!networkRetryable || attempt >= attempts) throw error;
        lastError = error;
        await this.sleep(this.retry.baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
    throw lastError || new Error("GitHub request failed.");
  },

  async ensureBranchAccessible(cfg) {
    const branchUrl = `https://api.github.com/repos/${cfg.repoOwner}/${cfg.repoName}/branches/${encodeURIComponent(cfg.branch)}`;
    const res = await this.requestGitHub(branchUrl, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/vnd.github+json"
      }
    }, 2);
    return !!res;
  },

  async testConnection(cfgOverride = null) {
    const cfg = cfgOverride || this.getConfig();

    if (cfg.storageMode === "api") {
      const res = await fetch(cfg.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ping: true })
      });
      if (!res.ok) throw new Error("API endpoint failed.");
      return true;
    }

    if (!cfg.repoOwner || !cfg.repoName || !cfg.branch || !cfg.token) {
      throw new Error("GitHub config incomplete.");
    }

    const res = await this.requestGitHub(`https://api.github.com/repos/${cfg.repoOwner}/${cfg.repoName}`, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/vnd.github+json"
      }
    });

    if (!res.ok) throw new Error(`Repo access failed (${res.status})`);
    await this.ensureBranchAccessible(cfg);
    return true;
  },

  async fetchFile(path) {
    const cfg = this.getConfig();
    const url = `https://api.github.com/repos/${cfg.repoOwner}/${cfg.repoName}/contents/${path}?ref=${cfg.branch}`;

    const res = await this.requestGitHub(url, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/vnd.github+json"
      }
    });

    return await res.json();
  },

  decodeBase64Json(content) {
    if (!content) return null;
    const normalized = String(content).replace(/\n/g, "");
    try {
      const decoded = decodeURIComponent(escape(atob(normalized)));
      return JSON.parse(decoded);
    } catch {
      return JSON.parse(atob(normalized));
    }
  },

  async fetchJson(path, fallback = []) {
    if (this.isApiMode()) return fallback;
    try {
      const file = await this.fetchFile(path);
      return this.decodeBase64Json(file.content);
    } catch (error) {
      if (error?.status === 404) return fallback;
      throw error;
    }
  },

  buildWorkflowDataPath(workflowId, type = "quotations") {
    const id = String(workflowId || "").trim() || "default";
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileMap = {
      archived: "archived-quotations.json",
      contacts: "contacts.json",
      customers: "customers.json",
      quotations: "quotations.json"
    };
    const file = fileMap[type] || "quotations.json";
    return `data/workflows/${safe}/${file}`;
  },

  splitByWorkflow(rows, workflowIds = [], fallbackWorkflowId = "direct_purchase") {
    const ids = Array.isArray(workflowIds) ? workflowIds.filter(Boolean) : [];
    const requestedFallback = String(fallbackWorkflowId || "direct_purchase").trim() || "direct_purchase";
    const fallback = ids.includes(requestedFallback)
      ? requestedFallback
      : (ids.includes("direct_purchase") ? "direct_purchase" : (ids[0] || requestedFallback));
    const buckets = {};
    ids.forEach(id => { buckets[id] = []; });
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const explicitTargets = row?.scopeAll === true || row?.dataScope === "all"
        ? ids
        : (Array.isArray(row?.workflowIds) ? row.workflowIds.map(id => String(id || "").trim()).filter(id => ids.includes(id)) : []);
      const targets = explicitTargets.length
        ? explicitTargets
        : [ids.includes(String(row?.workflowId || "").trim()) ? String(row.workflowId).trim() : fallback];
      targets.forEach(id => {
        if (!buckets[id]) buckets[id] = [];
        buckets[id].push({ ...row, workflowId: id, workflowIds: targets, scopeAll: row?.scopeAll === true || row?.dataScope === "all" });
      });
    });
    Object.keys(buckets).forEach(id => {
      const seen = new Set();
      buckets[id] = buckets[id].filter(row => {
        const key = String(row?.id || row?.code || row?.reference || `${row?.customerCode || ""}|${row?.name || row?.contactName || ""}`).trim();
        const dedupeKey = key || JSON.stringify(row);
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      });
    });
    return buckets;
  },

  async loadAllData(fallbacks = {}) {
    const settings = await this.fetchJson("data/settings.json", fallbacks.settings ?? {});
    const workflowProfiles = Array.isArray(settings?.workflowProfiles) ? settings.workflowProfiles : [];
    const workflowIds = workflowProfiles.map(p => String(p?.id || "").trim()).filter(Boolean);
    const fallbackWorkflowId = "direct_purchase";
    const workflowQuotations = [];
    const workflowArchived = [];
    const workflowContacts = [];
    const workflowCustomers = [];
    const quotationBucketIds = new Set();
    const archivedBucketIds = new Set();
    const contactBucketIds = new Set();
    const customerBucketIds = new Set();
    let hasWorkflowFiles = false;
    let hasWorkflowContacts = false;
    let hasWorkflowCustomers = false;

    for (const id of workflowIds) {
      const qPath = this.buildWorkflowDataPath(id, "quotations");
      const aPath = this.buildWorkflowDataPath(id, "archived");
      const cPath = this.buildWorkflowDataPath(id, "contacts");
      const cuPath = this.buildWorkflowDataPath(id, "customers");
      const qRows = await this.fetchJson(qPath, null);
      const aRows = await this.fetchJson(aPath, null);
      const cRows = await this.fetchJson(cPath, null);
      const cuRows = await this.fetchJson(cuPath, null);
      if (Array.isArray(qRows)) {
        hasWorkflowFiles = true;
        quotationBucketIds.add(id);
        qRows.forEach(row => workflowQuotations.push({ ...row, workflowId: String(row?.workflowId || id).trim() || id }));
      }
      if (Array.isArray(aRows)) {
        hasWorkflowFiles = true;
        archivedBucketIds.add(id);
        aRows.forEach(row => workflowArchived.push({ ...row, workflowId: String(row?.workflowId || id).trim() || id }));
      }
      if (Array.isArray(cRows)) {
        hasWorkflowContacts = true;
        contactBucketIds.add(id);
        cRows.forEach(row => workflowContacts.push({ ...row, workflowId: String(row?.workflowId || id).trim() || id }));
      }
      if (Array.isArray(cuRows)) {
        hasWorkflowCustomers = true;
        customerBucketIds.add(id);
        cuRows.forEach(row => workflowCustomers.push({ ...row, workflowId: String(row?.workflowId || id).trim() || id }));
      }
    }

    const legacyQuotations = await this.fetchJson("data/quotations.json", fallbacks.quotations ?? []);
    const legacyArchived = await this.fetchJson("data/archived-quotations.json", fallbacks.archived ?? []);
    const legacyContacts = await this.fetchJson("data/contacts.json", fallbacks.contacts ?? []);
    const legacyCustomers = await this.fetchJson("data/customers.json", fallbacks.customers ?? []);
    const mergeLegacyForMissingBuckets = (workflowRows, legacyRows, bucketIds) => {
      const merged = [...workflowRows];
      (Array.isArray(legacyRows) ? legacyRows : []).forEach(row => {
        const id = String(row?.workflowId || fallbackWorkflowId).trim() || fallbackWorkflowId;
        if (!bucketIds.has(id)) merged.push({ ...row, workflowId: id });
      });
      return merged;
    };
    const quotations = hasWorkflowFiles
      ? mergeLegacyForMissingBuckets(workflowQuotations, legacyQuotations, quotationBucketIds)
      : (Array.isArray(legacyQuotations) ? legacyQuotations.map(row => ({ ...row, workflowId: String(row?.workflowId || fallbackWorkflowId).trim() || fallbackWorkflowId })) : []);
    const archived = hasWorkflowFiles
      ? mergeLegacyForMissingBuckets(workflowArchived, legacyArchived, archivedBucketIds)
      : (Array.isArray(legacyArchived) ? legacyArchived.map(row => ({ ...row, workflowId: String(row?.workflowId || fallbackWorkflowId).trim() || fallbackWorkflowId })) : []);
    const contacts = hasWorkflowContacts
      ? mergeLegacyForMissingBuckets(workflowContacts, legacyContacts, contactBucketIds)
      : (Array.isArray(legacyContacts) ? legacyContacts.map(row => ({ ...row, workflowId: String(row?.workflowId || fallbackWorkflowId).trim() || fallbackWorkflowId })) : []);
    const customers = hasWorkflowCustomers
      ? mergeLegacyForMissingBuckets(workflowCustomers, legacyCustomers, customerBucketIds)
      : (Array.isArray(legacyCustomers) ? legacyCustomers.map(row => ({ ...row, workflowId: String(row?.workflowId || fallbackWorkflowId).trim() || fallbackWorkflowId })) : []);

    return {
      quotations,
      archived,
      contacts,
      customers,
      settings,
      audit: await this.fetchJson("data/audit-log.json", fallbacks.audit ?? []),
      approvals: await this.fetchJson("data/approvals.json", fallbacks.approvals ?? []),
      meta: await this.fetchJson("data/sync-meta.json", fallbacks.meta ?? {})
    };
  },

  async writeJson(path, contentObject, message) {
    const cfg = this.getConfig();

    if (this.isApiMode()) {
      let lastError = null;
      for (let attempt = 1; attempt <= this.retry.maxAttempts; attempt++) {
        try {
          const res = await fetch(cfg.apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path, content: contentObject, message })
          });
          if (!res.ok) throw new Error(`API write failed for ${path} (${res.status})`);
          return await res.json();
        } catch (error) {
          lastError = error;
          if (attempt >= this.retry.maxAttempts) break;
          await this.sleep(this.retry.baseDelayMs * Math.pow(2, attempt - 1));
        }
      }
      throw lastError || new Error(`API write failed for ${path}`);
    }

    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(contentObject, null, 2))));
    let current = null;
    for (let attempt = 1; attempt <= this.retry.maxAttempts; attempt++) {
      try {
        try {
          current = await this.fetchFile(path);
        } catch (error) {
          if (error?.status !== 404) throw error;
          current = null;
        }
        if (current?.content) {
          const remoteJson = this.decodeBase64Json(current.content);
          if (this.safeStringify(remoteJson) === this.safeStringify(contentObject)) {
            return { skipped: true, reason: "no-change" };
          }
        }
        const res = await this.requestGitHub(`https://api.github.com/repos/${cfg.repoOwner}/${cfg.repoName}/contents/${path}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${cfg.token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message,
            content: encoded,
            ...(current?.sha ? { sha: current.sha } : {}),
            branch: cfg.branch
          })
        });
        return await res.json();
      } catch (error) {
        const conflict = error?.status === 409 || (error?.status === 422 && /sha|conflict|update/i.test(String(error?.body || error?.message || "")));
        if (!conflict || attempt >= this.retry.maxAttempts) throw error;
        await this.sleep(this.retry.baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
    throw new Error(`Write failed for ${path}`);
  },

  async syncQuotations(data, workflowProfiles = [], activeWorkflowId = "direct_purchase") {
    const ids = (Array.isArray(workflowProfiles) ? workflowProfiles : [])
      .map(p => String(p?.id || "").trim())
      .filter(Boolean);
    const buckets = this.splitByWorkflow(data, ids, activeWorkflowId);
    for (const [id, rows] of Object.entries(buckets)) {
      await this.writeJson(this.buildWorkflowDataPath(id, "quotations"), rows, `Update quotations for workflow ${id}`);
    }
    return await this.writeJson("data/quotations.json", data, "Update quotations data (legacy mirror)");
  },
  async syncArchived(data, workflowProfiles = [], activeWorkflowId = "direct_purchase") {
    const ids = (Array.isArray(workflowProfiles) ? workflowProfiles : [])
      .map(p => String(p?.id || "").trim())
      .filter(Boolean);
    const buckets = this.splitByWorkflow(data, ids, activeWorkflowId);
    for (const [id, rows] of Object.entries(buckets)) {
      await this.writeJson(this.buildWorkflowDataPath(id, "archived"), rows, `Update archived quotations for workflow ${id}`);
    }
    return await this.writeJson("data/archived-quotations.json", data, "Update archived quotations data (legacy mirror)");
  },
  async syncContacts(data, workflowProfiles = [], activeWorkflowId = "direct_purchase") {
    const ids = (Array.isArray(workflowProfiles) ? workflowProfiles : [])
      .map(p => String(p?.id || "").trim())
      .filter(Boolean);
    const buckets = this.splitByWorkflow(data, ids, activeWorkflowId);
    for (const [id, rows] of Object.entries(buckets)) {
      await this.writeJson(this.buildWorkflowDataPath(id, "contacts"), rows, `Update contacts for workflow ${id}`);
    }
    return await this.writeJson("data/contacts.json", data, "Update contacts data (legacy mirror)");
  },
  async syncCustomers(data, workflowProfiles = [], activeWorkflowId = "direct_purchase") {
    const ids = (Array.isArray(workflowProfiles) ? workflowProfiles : [])
      .map(p => String(p?.id || "").trim())
      .filter(Boolean);
    const buckets = this.splitByWorkflow(data, ids, activeWorkflowId);
    for (const [id, rows] of Object.entries(buckets)) {
      await this.writeJson(this.buildWorkflowDataPath(id, "customers"), rows, `Update customers for workflow ${id}`);
    }
    return await this.writeJson("data/customers.json", data, "Update customers data (legacy mirror)");
  },
  async syncSettings(data) { return await this.writeJson("data/settings.json", data, "Update settings data"); },
  async syncAudit(data) { return await this.writeJson("data/audit-log.json", data, "Update audit log"); },
  async syncApprovals(data) { return await this.writeJson("data/approvals.json", data, "Update approvals log"); },
  async syncMeta(data) { return await this.writeJson("data/sync-meta.json", data, "Update sync metadata"); }
};

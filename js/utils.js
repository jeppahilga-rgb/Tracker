window.Utils = {
  todayISO() {
    return new Date().toISOString().slice(0, 10);
  },

  tomorrowISO() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  },

  generateReference(quotations, options = {}) {
    const list = Array.isArray(quotations) ? quotations : [];
    const settings = (typeof AppState !== "undefined" && AppState?.settings)
      ? AppState.settings
      : (typeof LocalStorageAdapter !== "undefined"
        ? LocalStorageAdapter.load(APP_CONFIG.localKeys.settings, {})
        : {});

    const defaults = APP_CONFIG.defaults || {};
    const formula = String(options.formula || settings.referenceFormula || defaults.referenceFormula || "YYMMDD{SEQ}");
    const startSequence = Math.max(0, Number(options.startSequence ?? settings.referenceStartSequence ?? defaults.referenceStartSequence ?? 6));
    const sequencePad = Math.max(1, Number(options.sequencePad ?? settings.referenceSequencePad ?? defaults.referenceSequencePad ?? 2));

    const now = new Date();
    const yyyy = String(now.getFullYear());
    const yy = yyyy.slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    const template = formula
      .replace(/YYYY/g, yyyy)
      .replace(/YY/g, yy)
      .replace(/MM/g, mm)
      .replace(/DD/g, dd);

    const seqToken = "{SEQ}";
    const tokenIndex = template.indexOf(seqToken);
    const prefix = tokenIndex >= 0 ? template.slice(0, tokenIndex) : template;
    const suffix = tokenIndex >= 0 ? template.slice(tokenIndex + seqToken.length) : "";
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(`^${escapedPrefix}(\\d+)${escapedSuffix}$`);
    let max = startSequence - 1;

    list.forEach(q => {
      const ref = String(q?.reference || "");
      const match = ref.match(matcher);
      if (!match) return;
      const seq = Number(match[1]);
      if (Number.isFinite(seq)) max = Math.max(max, seq);
    });

    let next = max + 1;
    let candidate = `${prefix}${String(next).padStart(sequencePad, "0")}${suffix}`;
    const used = new Set(list.map(q => String(q?.reference || "")));
    while (used.has(candidate)) {
      next += 1;
      candidate = `${prefix}${String(next).padStart(sequencePad, "0")}${suffix}`;
    }

    return candidate;
  },

  nextSN(quotations) {
    if (!Array.isArray(quotations) || quotations.length === 0) return 1;
    const max = Math.max(...quotations.map(q => Number(q.sn || 0)));
    return max + 1;
  },

  uid(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  },

  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  csvEscape(v) {
    return `"${String(v ?? "").replace(/"/g, '""')}"`;
  },

  fixArabicMojibake(value) {
    const text = String(value ?? "");
    if (!/[ÃÂØÙ]/.test(text)) return text;
    try {
      const cp1252 = {
        0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
        0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
        0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
        0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
        0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
        0x017E: 0x9E, 0x0178: 0x9F
      };
      const bytes = new Uint8Array([...text].map(ch => {
        const code = ch.charCodeAt(0);
        return code <= 0xff ? code : (cp1252[code] ?? 0x3f);
      }));
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const decodedArabic = (decoded.match(/[\u0600-\u06FF]/g) || []).length;
      const originalArabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
      const originalMojibake = (text.match(/[ÃÂØÙ]/g) || []).length;
      if (decodedArabic > originalArabic && originalMojibake > 1) return decoded;
    } catch (_error) {}
    return text;
  },

  async readCsvText(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return new TextDecoder("utf-8").decode(bytes);
    }
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return new TextDecoder("utf-16le").decode(bytes);
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      try {
        return new TextDecoder("utf-16be").decode(bytes);
      } catch (_error) {
        const swapped = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length - 1; i += 2) {
          swapped[i] = bytes[i + 1];
          swapped[i + 1] = bytes[i];
        }
        return new TextDecoder("utf-16le").decode(swapped);
      }
    }

    const encodings = ["utf-8", "windows-1256", "windows-1252", "utf-16le", "utf-16be"];
    const candidates = encodings
      .map(enc => {
        try {
          const text = new TextDecoder(enc).decode(bytes);
          return { enc, text: this.fixArabicMojibake(text) };
        } catch (_error) {
          return null;
        }
      })
      .filter(Boolean);

    const score = text => {
      const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
      const badChars = (text.match(/\uFFFD/g) || []).length;
      const nullChars = (text.match(/\u0000/g) || []).length;
      const mojibakeChars = (text.match(/[ÃÂØÙ]/g) || []).length;
      const separators = (text.match(/[,\t;]/g) || []).length;
      return arabicChars * 20 + separators - badChars * 30 - nullChars * 25 - mojibakeChars * 4;
    };

    const best = candidates.sort((a, b) => score(b.text) - score(a.text))[0];
    return best?.text || new TextDecoder("utf-8").decode(bytes);
  },

  parseCSV(text) {
    const source = this.fixArabicMojibake(String(text || ""));
    const firstLine = source.split(/\r?\n/).find(line => line.trim()) || "";
    const delimiters = [",", "\t", ";"];
    const delimiter = delimiters
      .map(char => ({ char, count: (firstLine.match(new RegExp(char === "\t" ? "\\t" : `\\${char}`, "g")) || []).length }))
      .sort((a, b) => b.count - a.count)[0]?.char || ",";
    const rows = [];
    let current = "";
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      const next = source[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        row.push(this.fixArabicMojibake(current));
        current = "";
      } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && next === "\n") i++;
        row.push(this.fixArabicMojibake(current));
        if (row.some(v => String(v || "").trim() !== "")) rows.push(row);
        row = [];
        current = "";
      } else {
        current += ch;
      }
    }

    if (current.length || row.length) {
      row.push(this.fixArabicMojibake(current));
      if (row.some(v => String(v || "").trim() !== "")) rows.push(row);
    }

    if (!rows.length) return [];
    const headers = rows[0].map(h => this.fixArabicMojibake(h).trim());
    return rows.slice(1).map(cols => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = this.fixArabicMojibake(cols[i] ?? ""); });
      return obj;
    });
  },

  daysDiff(dateStr) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    return Math.floor((d - today) / (1000 * 60 * 60 * 24));
  },

  getDueMeta(dateStr, timeStr = "") {
    const date = String(dateStr || "").trim();
    if (!date) return { bucket: "invalid", label: "", daysRemaining: null };
    const time = String(timeStr || "").trim();
    const due = new Date(`${date}T${/^\d{2}:\d{2}$/.test(time) ? `${time}:00` : "23:59:59"}`);
    if (Number.isNaN(due.getTime())) return { bucket: "invalid", label: "", daysRemaining: null };

    const now = new Date();
    const msDiff = due.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
    if (Math.abs(daysRemaining) > 3650) {
      return { bucket: "invalid", label: "Check due date", daysRemaining: null };
    }
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    const nowDay = new Date(now);
    nowDay.setHours(0, 0, 0, 0);
    const dayOnlyDiff = Math.round((dueDay - nowDay) / (1000 * 60 * 60 * 24));

    if (msDiff < 0) {
      const overdueMinutes = Math.floor(Math.abs(msDiff) / (1000 * 60));
      if (overdueMinutes < 60) return { bucket: "overdue", label: `Overdue by ${overdueMinutes}m`, daysRemaining };
      if (overdueMinutes < 24 * 60) return { bucket: "overdue", label: `Overdue by ${Math.floor(overdueMinutes / 60)}h`, daysRemaining };
      return { bucket: "overdue", label: `Overdue by ${Math.ceil(overdueMinutes / (24 * 60))}d`, daysRemaining };
    }

    if (dayOnlyDiff === 0) {
      const remainingMinutes = Math.max(0, Math.floor(msDiff / (1000 * 60)));
      if (remainingMinutes < 60) return { bucket: "today", label: `Due in ${remainingMinutes}m`, daysRemaining };
      return { bucket: "today", label: `Due in ${Math.floor(remainingMinutes / 60)}h`, daysRemaining };
    }
    if (dayOnlyDiff <= 3) return { bucket: "next3", label: `Due in ${dayOnlyDiff}d`, daysRemaining };
    return { bucket: "later", label: `Due in ${dayOnlyDiff}d`, daysRemaining };
  },

  debounce(fn, wait = 180) {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  },

  stableStringify(value) {
    const seen = new WeakSet();
    const sortObject = (obj) => {
      if (obj === null || typeof obj !== "object") return obj;
      if (seen.has(obj)) return null;
      seen.add(obj);
      if (Array.isArray(obj)) return obj.map(sortObject);
      return Object.keys(obj).sort().reduce((acc, key) => {
        acc[key] = sortObject(obj[key]);
        return acc;
      }, {});
    };
    return JSON.stringify(sortObject(value));
  },

  simpleHash(input) {
    const str = String(input || "");
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  },

  normalizeDateInput(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const excelSerial = Number(raw);
    if (Number.isFinite(excelSerial) && excelSerial > 1000 && excelSerial < 100000) {
      const base = new Date(Date.UTC(1899, 11, 30));
      base.setUTCDate(base.getUTCDate() + Math.floor(excelSerial));
      const y = base.getUTCFullYear();
      const m = String(base.getUTCMonth() + 1).padStart(2, "0");
      const d = String(base.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    let m = raw.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
    if (m) {
      const y = Number(m[1]);
      const mm = Number(m[2]);
      const dd = Number(m[3]);
      if (y >= 1900 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        return `${String(y).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      }
    }

    m = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      let dd = a;
      let mm = b;
      if (a <= 12 && b > 12) { mm = a; dd = b; }
      else if (a <= 12 && b <= 12) { dd = a; mm = b; }
      if (y >= 1900 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        return `${String(y).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      }
    }

    m = raw.match(/^(\d{1,2})[\- ]([A-Za-z]{3,9})(?:[\- ,]+(\d{2,4}))?$/);
    if (m) {
      const dd = Number(m[1]);
      const monthName = String(m[2]).toLowerCase();
      let y = Number(m[3] || new Date().getFullYear());
      if (y < 100) y += 2000;
      const months = {
        jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
        may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
        oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
      };
      const mm = months[monthName];
      if (mm && dd >= 1 && dd <= 31 && y >= 1900) {
        return `${String(y).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      }
    }

    return "";
  },

  normalizeTimeInput(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (/^\d{2}:\d{2}$/.test(raw)) return raw;
    if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);

    const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap][Mm])$/);
    if (m) {
      let h = Number(m[1]);
      const mm = Number(m[2]);
      const ap = m[4].toUpperCase();
      if (h === 12) h = ap === "AM" ? 0 : 12;
      else if (ap === "PM") h += 12;
      if (h >= 0 && h <= 23 && mm >= 0 && mm <= 59) {
        return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      }
    }
    return "";
  }
};

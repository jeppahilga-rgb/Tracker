const fs = require("fs");
const path = require("path");

const csvPath = process.argv[2] || "C:/Users/Admin/Downloads/customers-2026-04-18.csv";
const arabicSourcePath = process.argv[3] || "";
const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");

function parseCSV(source) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some(value => String(value).trim() !== "")) rows.push(row);
      row = [];
      current = "";
    } else {
      current += ch;
    }
  }

  if (current.length || row.length) {
    row.push(current);
    if (row.some(value => String(value).trim() !== "")) rows.push(row);
  }
  return rows;
}

function normalizeHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, "");
}

const rows = parseCSV(text);
const headers = rows.shift().map(header => header.trim());
const indexByHeader = Object.fromEntries(headers.map((header, index) => [normalizeHeader(header), index]));

function pick(row, ...keys) {
  for (const key of keys) {
    const index = indexByHeader[normalizeHeader(key)];
    if (index !== undefined && String(row[index] ?? "").trim() !== "") return String(row[index]).trim();
  }
  return "";
}

function readArabicNamesByCode(sourcePath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) return new Map();
  const sourceRows = parseCSV(fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, ""));
  const sourceHeaders = sourceRows.shift().map(header => header.trim());
  const sourceIndex = Object.fromEntries(sourceHeaders.map((header, index) => [normalizeHeader(header), index]));
  const sourcePick = (row, ...keys) => {
    for (const key of keys) {
      const index = sourceIndex[normalizeHeader(key)];
      if (index !== undefined && String(row[index] ?? "").trim() !== "") return String(row[index]).trim();
    }
    return "";
  };
  const names = new Map();
  for (const row of sourceRows) {
    const code = sourcePick(row, "Customer Code", "Customer code", "code").replace(/\.0+$/, "");
    const nameAr = sourcePick(row, "Customer Name (Arabic)", "Arabic Name", "Name Arabic", "اسم العميل", "اســم العميـــــل");
    if (code && /[\u0600-\u06FF]/.test(nameAr)) names.set(code, nameAr);
  }
  return names;
}

const arabicNamesByCode = readArabicNamesByCode(arabicSourcePath);
const customers = [];
const seenCodes = new Set();

for (const row of rows) {
  const code = pick(row, "Customer Code", "Customer code", "code").replace(/\.0+$/, "");
  if (!code || seenCodes.has(code)) continue;
  seenCodes.add(code);
  const workflowId = pick(row, "Trackers", "Workflow") || "direct_purchase";
  customers.push({
    code,
    name: pick(row, "Customer Name", "CUSTOMER NAME", "name"),
    nameAr: pick(row, "Customer Name (Arabic)", "Arabic Name", "Name Arabic", "اسم العميل", "اســم العميـــــل") || arabicNamesByCode.get(code) || "",
    pgType: pick(row, "P/G", "PG", "PG Type") || "G",
    website: pick(row, "Web Site", "Website"),
    sector: pick(row, "Sector"),
    areaCode: pick(row, "Area Code"),
    vt: pick(row, "V/T", "VT"),
    vendor: pick(row, "Vendor #", "Vendor"),
    remark: pick(row, "Remarks", "Remark"),
    workflowId,
    workflowIds: [workflowId],
    scopeAll: false
  });
}

const directPurchaseCustomers = customers.map(customer => ({
  ...customer,
  workflowId: "direct_purchase",
  workflowIds: ["direct_purchase"]
}));

fs.mkdirSync(path.join("data", "workflows", "direct_purchase"), { recursive: true });
fs.writeFileSync(path.join("data", "customers.json"), `${JSON.stringify(customers, null, 2)}\n`, "utf8");
fs.writeFileSync(
  path.join("data", "workflows", "direct_purchase", "customers.json"),
  `${JSON.stringify(directPurchaseCustomers, null, 2)}\n`,
  "utf8"
);

const now = new Date().toISOString();
fs.writeFileSync(
  path.join("data", "sync-meta.json"),
  `${JSON.stringify({
    schemaVersion: 2,
    lastChangeAt: now,
    backedUpAt: now,
    source: "local-csv-import",
    note: "Updated customer backup JSON from customers-2026-04-18.csv; source CSV has empty Arabic column."
  }, null, 2)}\n`,
  "utf8"
);

console.log(JSON.stringify({
  csvRows: rows.length,
  customers: customers.length,
  arabicSourceRows: arabicNamesByCode.size,
  arabicNameRows: customers.filter(customer => /[\u0600-\u06FF]/.test(customer.nameAr)).length,
  files: [
    "data/customers.json",
    "data/workflows/direct_purchase/customers.json",
    "data/sync-meta.json"
  ]
}, null, 2));

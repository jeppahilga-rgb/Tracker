window.APP_CONFIG = {
  schemaVersion: 2,
  storageMode: "local",
  localKeys: {
    quotations: "qt.quotations",
    archived: "qt.archivedQuotations",
    customers: "qt.customers",
    contacts: "qt.contacts",
    settings: "qt.settings",
    approvals: "qt.approvals",
    audit: "qt.auditLog"
  },
  defaults: {
    workflowProfiles: [
      {
        id: "direct_purchase",
        name: "Direct Purchase Quotation",
        tagLabel: "Origin",
        subTagLabel: "Sub Tag",
        customerSettings: {
          entityName: "Customer",
          entityNamePlural: "Customers",
          labels: {
            code: "Customer Code",
            nameAr: "Customer Name (Arabic)",
            name: "Customer Name",
            website: "Web Site",
            sector: "Sector",
            areaCode: "Area Code",
            vt: "V/T",
            vendor: "Vendor #",
            remark: "Remarks"
          },
          columns: {
            code: true,
            nameAr: true,
            name: true,
            website: true,
            sector: true,
            areaCode: true,
            vt: true,
            vendor: true,
            remark: true
          },
          required: {
            code: true,
            name: true
          }
        },
        origins: ["NUPCO", "Etimad", "E-Purchasing", "Sales", "Engineering"],
        referenceFormula: "YYMMDD{SEQ}",
        referenceStartSequence: 6,
        referenceSequencePad: 2,
        originSalesMap: {
          "NUPCO": ["Adnan", "Sales 2", "Sales 3"],
          "Etimad": ["Adnan", "Sales 2"],
          "E-Purchasing": ["Customer Code Based"],
          "Sales": ["Sales Team A", "Sales Team B"],
          "Engineering": ["Engineer 1", "Engineer 2"]
        },
        statusGroups: [
          {
            name: "WIP",
            substatuses: ["NOT STARTED", "UNDER REVIEW", "FOR APPROVAL", "STD"],
            isCompletion: false,
            showOnBoard: true,
            columnView: "default",
            color: "#2563eb",
            substatusColors: {
              "NOT STARTED": "#2563eb",
              "UNDER REVIEW": "#d97706",
              "FOR APPROVAL": "#0f766e",
              "STD": "#16a34a"
            }
          },
          {
            name: "NO BID",
            substatuses: ["CLOSED", "CANCELLED", "DROPPED"],
            isCompletion: true,
            showOnBoard: true,
            columnView: "default",
            color: "#dc2626",
            substatusColors: {
              "CLOSED": "#475569",
              "CANCELLED": "#dc2626",
              "DROPPED": "#7c3aed"
            }
          },
          {
            name: "SUBMITTED",
            substatuses: ["SUBMITTED"],
            isCompletion: true,
            showOnBoard: true,
            columnView: "default",
            color: "#16a34a",
            substatusColors: {
              "SUBMITTED": "#16a34a"
            }
          }
        ]
      },
      {
        id: "gov_tender",
        name: "Purchased Tender (Government)",
        tagLabel: "Origin",
        subTagLabel: "Sub Tag",
        customerSettings: {
          entityName: "Customer",
          entityNamePlural: "Customers",
          labels: {
            code: "Customer Code",
            nameAr: "Customer Name (Arabic)",
            name: "Customer Name",
            website: "Web Site",
            sector: "Sector",
            areaCode: "Area Code",
            vt: "V/T",
            vendor: "Vendor #",
            remark: "Remarks"
          },
          columns: {
            code: true,
            nameAr: true,
            name: true,
            website: true,
            sector: true,
            areaCode: true,
            vt: true,
            vendor: true,
            remark: true
          },
          required: {
            code: true,
            name: true
          }
        },
        origins: ["Etimad", "NUPCO", "Sales"],
        referenceFormula: "YYMMDD{SEQ}",
        referenceStartSequence: 6,
        referenceSequencePad: 2,
        originSalesMap: {
          "Etimad": ["Adnan", "Sales 2"],
          "NUPCO": ["Adnan", "Sales 2", "Sales 3"],
          "Sales": ["Sales Team A", "Sales Team B"]
        },
        statusGroups: [
          { name: "WIP", substatuses: ["NOT STARTED", "UNDER REVIEW", "FOR APPROVAL"], isCompletion: false, showOnBoard: true, columnView: "default", color: "#1d4ed8", substatusColors: { "NOT STARTED": "#1d4ed8", "UNDER REVIEW": "#d97706", "FOR APPROVAL": "#0f766e" } },
          { name: "SUBMITTED", substatuses: ["SUBMITTED"], isCompletion: true, showOnBoard: true, columnView: "default", color: "#16a34a", substatusColors: { "SUBMITTED": "#16a34a" } },
          { name: "NO BID", substatuses: ["CLOSED", "CANCELLED"], isCompletion: true, showOnBoard: true, columnView: "default", color: "#dc2626", substatusColors: { "CLOSED": "#475569", "CANCELLED": "#dc2626" } }
        ]
      },
      {
        id: "private_tender",
        name: "Private Tender",
        tagLabel: "Origin",
        subTagLabel: "Sub Tag",
        customerSettings: {
          entityName: "Customer",
          entityNamePlural: "Customers",
          labels: {
            code: "Customer Code",
            nameAr: "Customer Name (Arabic)",
            name: "Customer Name",
            website: "Web Site",
            sector: "Sector",
            areaCode: "Area Code",
            vt: "V/T",
            vendor: "Vendor #",
            remark: "Remarks"
          },
          columns: {
            code: true,
            nameAr: true,
            name: true,
            website: true,
            sector: true,
            areaCode: true,
            vt: true,
            vendor: true,
            remark: true
          },
          required: {
            code: true,
            name: true
          }
        },
        origins: ["Sales", "Engineering", "NUPCO"],
        referenceFormula: "YYMMDD{SEQ}",
        referenceStartSequence: 6,
        referenceSequencePad: 2,
        originSalesMap: {
          "Sales": ["Sales Team A", "Sales Team B"],
          "Engineering": ["Engineer 1", "Engineer 2"],
          "NUPCO": ["Adnan", "Sales 2", "Sales 3"]
        },
        statusGroups: [
          { name: "WIP", substatuses: ["NOT STARTED", "UNDER REVIEW", "FOR APPROVAL"], isCompletion: false, showOnBoard: true, columnView: "default", color: "#2563eb", substatusColors: { "NOT STARTED": "#2563eb", "UNDER REVIEW": "#d97706", "FOR APPROVAL": "#0f766e" } },
          { name: "SUBMITTED", substatuses: ["SUBMITTED"], isCompletion: true, showOnBoard: true, columnView: "default", color: "#16a34a", substatusColors: { "SUBMITTED": "#16a34a" } },
          { name: "NO BID", substatuses: ["CLOSED", "CANCELLED", "DROPPED"], isCompletion: true, showOnBoard: true, columnView: "default", color: "#dc2626", substatusColors: { "CLOSED": "#475569", "CANCELLED": "#dc2626", "DROPPED": "#7c3aed" } }
        ]
      },
      {
        id: "other_projects",
        name: "Other Projects",
        tagLabel: "Origin",
        subTagLabel: "Sub Tag",
        customerSettings: {
          entityName: "Customer",
          entityNamePlural: "Customers",
          labels: {
            code: "Customer Code",
            nameAr: "Customer Name (Arabic)",
            name: "Customer Name",
            website: "Web Site",
            sector: "Sector",
            areaCode: "Area Code",
            vt: "V/T",
            vendor: "Vendor #",
            remark: "Remarks"
          },
          columns: {
            code: true,
            nameAr: true,
            name: true,
            website: true,
            sector: true,
            areaCode: true,
            vt: true,
            vendor: true,
            remark: true
          },
          required: {
            code: true,
            name: true
          }
        },
        origins: ["Sales", "Engineering", "E-Purchasing"],
        referenceFormula: "YYMMDD{SEQ}",
        referenceStartSequence: 6,
        referenceSequencePad: 2,
        originSalesMap: {
          "Sales": ["Sales Team A", "Sales Team B"],
          "Engineering": ["Engineer 1", "Engineer 2"],
          "E-Purchasing": ["Customer Code Based"]
        },
        statusGroups: [
          { name: "WIP", substatuses: ["NOT STARTED", "UNDER REVIEW"], isCompletion: false, showOnBoard: true, columnView: "default", color: "#2563eb", substatusColors: { "NOT STARTED": "#2563eb", "UNDER REVIEW": "#d97706" } },
          { name: "SUBMITTED", substatuses: ["SUBMITTED"], isCompletion: true, showOnBoard: true, columnView: "default", color: "#16a34a", substatusColors: { "SUBMITTED": "#16a34a" } },
          { name: "NO BID", substatuses: ["CLOSED", "CANCELLED", "DROPPED"], isCompletion: true, showOnBoard: true, columnView: "default", color: "#dc2626", substatusColors: { "CLOSED": "#475569", "CANCELLED": "#dc2626", "DROPPED": "#7c3aed" } }
        ]
      }
    ],
    activeWorkflowId: "direct_purchase",
    tagLabel: "Origin",
    subTagLabel: "Sub Tag",
    origins: ["NUPCO", "Etimad", "E-Purchasing", "Sales", "Engineering"],
    statuses: ["WIP", "UNDER REVIEW", "FOR APPROVAL", "STD", "CLOSED", "DROPPED", "CANCELLED"],
    kanbanColumnMode: "main",
    customerSettings: {
      entityName: "Customer",
      entityNamePlural: "Customers",
      labels: {
        code: "Customer Code",
        nameAr: "Customer Name (Arabic)",
        name: "Customer Name",
        website: "Web Site",
        sector: "Sector",
        areaCode: "Area Code",
        vt: "V/T",
        vendor: "Vendor #",
        remark: "Remarks"
      },
      columns: {
        code: true,
        nameAr: true,
        name: true,
        website: true,
        sector: true,
        areaCode: true,
        vt: true,
        vendor: true,
        remark: true
      },
      required: {
        code: true,
        name: true
      }
    },
    statusGroups: [
      {
        name: "WIP",
        substatuses: ["NOT STARTED", "UNDER REVIEW", "FOR APPROVAL", "STD"],
        isCompletion: false,
        showOnBoard: true,
        columnView: "default",
        color: "#2563eb",
        substatusColors: {
          "NOT STARTED": "#2563eb",
          "UNDER REVIEW": "#d97706",
          "FOR APPROVAL": "#0f766e",
          "STD": "#16a34a"
        }
      },
      {
        name: "NO BID",
        substatuses: ["CLOSED", "CANCELLED", "DROPPED"],
        isCompletion: true,
        showOnBoard: true,
        columnView: "default",
        color: "#dc2626",
        substatusColors: {
          "CLOSED": "#475569",
          "CANCELLED": "#dc2626",
          "DROPPED": "#7c3aed"
        }
      },
      {
        name: "SUBMITTED",
        substatuses: ["SUBMITTED"],
        isCompletion: true,
        showOnBoard: true,
        columnView: "default",
        color: "#16a34a",
        substatusColors: {
          "SUBMITTED": "#16a34a"
        }
      }
    ],
    referenceFormula: "YYMMDD{SEQ}",
    referenceStartSequence: 6,
    referenceSequencePad: 2,
    formLayout: [
      { key: "sn", visible: true, width: "half", order: 1 },
      { key: "reference", visible: true, width: "half", order: 2 },
      { key: "targetDate", visible: true, width: "half", order: 3 },
      { key: "dueDate", visible: true, width: "half", order: 4 },
      { key: "customerCode", visible: true, width: "half", order: 5 },
      { key: "customerName", visible: true, width: "half", order: 6 },
      { key: "workflow", visible: true, width: "half", order: 7 },
      { key: "pgType", visible: true, width: "half", order: 8 },
      { key: "origin", visible: true, width: "half", order: 9 },
      { key: "salesPerson", visible: true, width: "half", order: 9 },
      { key: "rfq", visible: true, width: "half", order: 10 },
      { key: "bid", visible: true, width: "half", order: 11 },
      { key: "quoteTime", visible: true, width: "half", order: 12 },
      { key: "status", visible: true, width: "half", order: 13 },
      { key: "contactName", visible: true, width: "half", order: 14 },
      { key: "phone", visible: true, width: "half", order: 15 },
      { key: "email", visible: true, width: "half", order: 16 },
      { key: "contactSaveAction", visible: true, width: "half", order: 17 },
      { key: "totalItems", visible: true, width: "half", order: 18 },
      { key: "totalValue", visible: true, width: "half", order: 19 },
      { key: "itemLines", visible: true, width: "full", order: 20 },
      { key: "remarks", visible: true, width: "full", order: 21 },
      { key: "actions", visible: true, width: "full", order: 22 }
    ],
    customerFormLayout: [
      { key: "custCode", visible: true, width: "half", order: 1 },
      { key: "custName", visible: true, width: "half", order: 2 },
      { key: "custNameAr", visible: true, width: "half", order: 3 },
      { key: "custPgType", visible: true, width: "half", order: 4 },
      { key: "custWebsite", visible: true, width: "half", order: 5 },
      { key: "custSector", visible: true, width: "half", order: 6 },
      { key: "custAreaCode", visible: true, width: "half", order: 7 },
      { key: "custVT", visible: true, width: "half", order: 8 },
      { key: "custVendor", visible: true, width: "half", order: 9 },
      { key: "custRemark", visible: true, width: "full", order: 10 },
      { key: "custActions", visible: true, width: "full", order: 11 }
    ],
    formLayoutCanvas: {
      width: 1200,
      height: 720
    },
    dashboardWidgetLimit: 20,
    dashboardMaxWidgets: 20,
    dashboardColumns: 3,
    dashboardWidgetOrder: [],
    dashboardWidgets: [
      "status_distribution",
      "quotes_by_month_line",
      "status_count_value_combo",
      "origin_distribution",
      "sales_distribution",
      "pg_distribution",
      "aging_overview",
      "completion_ratio",
      "active_vs_completed",
      "top_customers_by_count",
      "top_customers_by_value",
      "weekly_activity_line"
    ],
    dashboardWidgetTypes: {
      status_distribution: "bar",
      origin_distribution: "pie",
      sales_distribution: "pie",
      pg_distribution: "donut",
      aging_overview: "cards",
      completion_ratio: "cards",
      active_vs_completed: "donut",
      top_customers_by_count: "bar",
      top_customers_by_value: "bar",
      top_origins_by_value: "bar",
      top_sales_by_value: "bar",
      avg_value_by_status: "bar",
      quotes_by_weekday: "line",
      quotes_by_month_line: "line",
      weekly_activity_line: "line",
      status_count_value_combo: "combo",
      recent_7day_created: "cards",
      zero_value_quotes: "cards",
      high_value_quotes: "cards",
      no_contact_quotes: "cards",
      approval_pipeline: "bar",
      due_soon_vs_later: "donut"
    },
    originSalesMap: {
      "NUPCO": ["Adnan", "Sales 2", "Sales 3"],
      "Etimad": ["Adnan", "Sales 2"],
      "E-Purchasing": ["Customer Code Based"],
      "Sales": ["Sales Team A", "Sales Team B"],
      "Engineering": ["Engineer 1", "Engineer 2"]
    },
    ui: {
      kanbanDensity: "compact"
    },
    rolePermissions: {
      admin: { pages: ["board", "dashboard", "customers", "archived", "settings"], actions: ["import", "export", "edit", "delete", "archive"] },
      sales: { pages: ["board", "dashboard", "customers", "archived"], actions: ["import", "export", "edit"] },
      user: { pages: ["board", "dashboard", "customers", "archived"], actions: ["import", "export", "edit"] }
    }
  }
};

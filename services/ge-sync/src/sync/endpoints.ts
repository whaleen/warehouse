/**
 * GE DMS API Endpoints
 * Documented from research/ge-dms/docs/GE-DMS-ENDPOINTS.md
 */

export const GE_DMS_BASE = 'https://dms-erp-aws-prd.geappliances.com';

export const ENDPOINTS = {
  // ASIS Load List (FOR SALE loads)
  // POST with body: request=ASIS&dmsLoc={invOrg}
  ASIS_LOAD_LIST: `${GE_DMS_BASE}/dms/newasis/downloadExcelSpreadsheet`,

  // ASIS Report History (all loads with lifecycle)
  // POST with body: dmsLoc={invOrg}
  ASIS_REPORT_HISTORY: `${GE_DMS_BASE}/dms/newasis/downloadReportHistoryExcelSpreadsheet`,

  // ASIS Inventory (current inventory snapshot)
  // GET request
  ASIS_INVENTORY: `${GE_DMS_BASE}/dms/asis/downloadExcelSpreadsheet`,

  // Per-load item details
  // POST with body: hCsvView=CSV
  // Query params: invOrg={invOrg}&createDate={timestamp}
  ASIS_LOAD_DETAIL: `${GE_DMS_BASE}/dms/newasis/downloadCsvSpreadsheet`,

  // ERP inventory on-hand (master inventory export)
  // POST with body: dmsLoc={invOrg}&subInvLoc=ASIS&invorg={invOrg}&erpDataList=[]
  ERP_INVENTORY_SPREADSHEET: `${GE_DMS_BASE}/dms/erpCheckInventory/erpInventorySpreadsheet`,

  // Inbound history list (submitted shipments)
  INBOUND_HISTORY: `${GE_DMS_BASE}/dms/inbound/inboundhistory`,

  // Inbound summary list (pending shipments)
  INBOUND_SUMMARY: `${GE_DMS_BASE}/dms/inbound/summary`,

  // Inbound summary page (sets session state)
  INBOUND_BASE: `${GE_DMS_BASE}/dms/inbound`,

  // Inbound receiving report PDF
  INBOUND_EXPORT_PDF: `${GE_DMS_BASE}/dms/inbound/exportpdf`,

  // Backhaul list export
  BACKHAUL_EXPORT: `${GE_DMS_BASE}/dms/backhaul/downloadBackhaulSpreadsheet`,

  // Backhaul ISO pick list export
  BACKHAUL_PICK_LIST: `${GE_DMS_BASE}/dms/backhaul/downloadIsoSpreadsheet`,
} as const;

export const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Different endpoints require different Referer headers
export const REFERERS = {
  ASIS_INVENTORY: `${GE_DMS_BASE}/dms/asis`,
  ASIS_INVENTORY_ALT: `${GE_DMS_BASE}/dms`,
  ASIS_LOAD_LIST: `${GE_DMS_BASE}/dms/newasis`,
  ASIS_REPORT_HISTORY: `${GE_DMS_BASE}/dms/newasis`,
  ASIS_LOAD_DETAIL: `${GE_DMS_BASE}/dms/newasis`,
  ERP_INVENTORY: `${GE_DMS_BASE}/dms/erpCheckInventory`,
  INBOUND: `${GE_DMS_BASE}/dms/inbound`,
  BACKHAUL: `${GE_DMS_BASE}/dms/backhaul`,
};

/**
 * Parse load number into invOrg and createDate components
 * e.g., "9SU20260114134738" -> { invOrg: "9SU", createDate: "20260114134738" }
 */
export function parseLoadNumber(loadNumber: string): { invOrg: string; createDate: string } {
  return {
    invOrg: loadNumber.slice(0, 3),
    createDate: loadNumber.slice(3),
  };
}

/**
 * Build URL for per-load detail fetch
 */
export function buildLoadDetailUrl(loadNumber: string): string {
  const { invOrg, createDate } = parseLoadNumber(loadNumber);
  return `${ENDPOINTS.ASIS_LOAD_DETAIL}?invOrg=${invOrg}&createDate=${createDate}`;
}

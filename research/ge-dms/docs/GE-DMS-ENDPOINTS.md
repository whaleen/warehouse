# GE DMS Export Endpoints Discovery

## Summary
Discovered 19 export-related options across 8 pages in the GE DMS system.

---

## 1. ASIS (Load Management)

### ASIS Main Page
**URL:** `https://dms-erp-aws-prd.geappliances.com/dms/newasis`

**Known Export Endpoint (from bash scripts):**
```
POST /dms/newasis/downloadCsvSpreadsheet?invOrg={XXX}&createDate={YYYY}
Headers:
  - Referer: https://dms-erp-aws-prd.geappliances.com/dms/newasis
  - Cookie: {session cookies}
POST Data:
  - hCsvView=CSV
```

### ASIS Report History
**URL:** `https://dms-erp-aws-prd.geappliances.com/dms/newasis/getreporthistory`

**Actions:**
- Shows history of load reports
- Likely uses same download endpoint as above

---

## 2. Downloads
**URL:** `https://dms-erp-aws-prd.geappliances.com/dms/downloads`

**Status:** Page loaded but no specific export buttons detected yet.
**Needs:** Manual exploration to find download options

---

## 3. Order Download
**URL:** `https://dms-erp-aws-prd.geappliances.com/dms/orderdata`

**Status:** Page loaded but no specific export buttons detected yet.
**Needs:** Manual exploration - likely has form to specify date range/filters

---

## 4. Warehouse Exception Report
**URL:** `https://dms-erp-aws-prd.geappliances.com/dms/truckstatus/warehouse_exception_report`

**Status:** Page loaded but no specific export buttons detected yet.
**Needs:** Manual exploration

---

## 5. Anti-Tip Audit Report
**URL:** `https://dms-erp-aws-prd.geappliances.com/dms/antitippaudit/antitip_audit_report`

**Status:** Page loaded but no specific export buttons detected yet.
**Needs:** Manual exploration

---

## 6. National Builder Open Orders by Customer
**URL:** `https://dms-erp-aws-prd.geappliances.com/dms/openorderreport`

**Status:** Page loaded but no specific export buttons detected yet.
**Needs:** Manual exploration

---

## 7. Reporting (Summary Reports)
**URL:** `https://dms-erp-aws-prd.geappliances.com/dms/reportsummary`

**Export Action:**
- Link: "EXPORT TO SPREADSHEET"
- JavaScript: `exportExcelReport('summaryReportFrm')`
- Likely submits a form and triggers download

**Needs:** Inspect network traffic when clicking export to find actual endpoint

---

## 8. Check In - Audit
**URL:** `https://dms-erp-aws-prd.geappliances.com/dms/checkinaudit/checkin_audit_report`

**Status:** Page loaded but no specific export buttons detected yet.
**Needs:** Manual exploration

---

## 9. Inventory Report (External System)
**URL:** `https://prd.digideck.appliancedms.com/inventory/report?invOrg=9SU`

**Export Actions:**
- Link 1: "HERE" → `javascript:downloadExecutiveSummary()`
- Link 2: "HERE" → `javascript:downloadExcel()`

**Needs:** Inspect network traffic to find actual download endpoints
**Note:** This is on a different domain (digideck.appliancedms.com)

---

## 10. Other Resources
**URL:** `https://dms-erp-aws-prd.geappliances.com/dms/resources/download/GEAD_eTicket_AgentTraining.v2.pdf`
**Type:** Direct PDF download
**Usage:** Training materials (not data export)

---

## Next Steps

### High Priority (Known Working):
1. **ASIS Load Data Export** - Already working via bash scripts
   - Endpoint: `POST /dms/newasis/downloadCsvSpreadsheet`
   - Parameters: `invOrg`, `createDate`

### Medium Priority (Need Manual Testing):
2. **Reporting Summary Export** - Has visible export button
3. **Inventory Report** - Has download links
4. **Order Download** - Likely important for order data
5. **Downloads** - May have multiple download options

### Lower Priority:
6. Warehouse Exception Report
7. Anti-Tip Audit Report
8. National Builder Open Orders
9. Check In - Audit

---

## Authentication

All endpoints require:
- SSO Login via `https://sso.geappliances.com/login` (OAuth2)
- Session cookies maintained after login
- Cookies stored in Supabase settings table for reuse

---

## Service Architecture

### Proposed Endpoints:
```
POST /login
- Uses Playwright to authenticate
- Extracts and stores cookies
- Returns success/failure

POST /fetch/asis-loads
- Fetches ASIS load data
- Parameters: invOrg, createDate
- Returns CSV data or writes to DB

POST /fetch/asis-history
- Fetches ASIS report history
- Returns list of available reports

POST /fetch/orders
- Fetches order download data
- TBD: Parameters after manual exploration

POST /fetch/inventory
- Fetches inventory report
- TBD: Format and parameters

... (more endpoints as we discover them)
```

---

## Manual Exploration TODO

Still need to manually visit and click through:
1. Downloads page - see what's available
2. Order Download - find the form and export mechanism
3. Reporting - trigger export and capture network request
4. Inventory Report - trigger downloads and capture URLs
5. Each audit/report page to understand their export options

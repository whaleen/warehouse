# GE DMS Exports

## Critical Export Pages
These are the GE DMS pages that the sync relies on or that provide core operational data.

1. **ASIS** (`/dms/newasis`)
   - Exports: Model Details Spreadsheet + ASIS Load Spreadsheet
   - Doc: [/docs?doc=docs%2Fge-dms%2Fpages%2Fdms-erp-aws-prd-geappliances-com-dms-newasis.md](/docs?doc=docs%2Fge-dms%2Fpages%2Fdms-erp-aws-prd-geappliances-com-dms-newasis.md)
2. **Order Download** (`/dms/orderdata`)
   - Export formats: CSV, Excel, Enhanced (V1/V2)
   - Doc: [/docs?doc=docs%2Fge-dms%2Fpages%2Fdms-erp-aws-prd-geappliances-com-dms-orderdata.md](/docs?doc=docs%2Fge-dms%2Fpages%2Fdms-erp-aws-prd-geappliances-com-dms-orderdata.md)
3. **Downloads** (`/dms/checkin/downloadsindex`)
   - Reports: CHECK‑IN, CHECK‑IN WITH LINES, PARKING LOT, INBOUND, CANCELLATIONS
   - Doc: [/docs?doc=docs%2Fge-dms%2Fpages%2Fdms-erp-aws-prd-geappliances-com-dms-checkin-downloadsindex.md](/docs?doc=docs%2Fge-dms%2Fpages%2Fdms-erp-aws-prd-geappliances-com-dms-checkin-downloadsindex.md)
4. **Reporting** (`/dms/reportsummary`)
   - Reports: Tactical Dashboard, Badge Expirations, eTicket, ERP Inbound, ERP Open Orders/Returns, IVR Usage, Precall Activity, Prop. Damage Claim
   - Doc: [/docs?doc=docs%2Fge-dms%2Fpages%2Fdms-erp-aws-prd-geappliances-com-dms-reportsummary.md](/docs?doc=docs%2Fge-dms%2Fpages%2Fdms-erp-aws-prd-geappliances-com-dms-reportsummary.md)
5. **ERP On Hand Qty** (`/dms/erpCheckInventory`)
   - Sub‑inventory level inventory query
   - Doc: [/docs?doc=docs%2Fge-dms%2Fpages%2Fdms-erp-aws-prd-geappliances-com-dms-erpcheckinventory.md](/docs?doc=docs%2Fge-dms%2Fpages%2Fdms-erp-aws-prd-geappliances-com-dms-erpcheckinventory.md)

## Usage Notes
- Exports are the only reliable source for bulk data.
- If an export is missing or fails, the Warehouse app will be stale.

## Source of Truth
- `docs/ge-sync/GE_DMS_PAGES.md`

## Audience Notes

### For Developers
- This lists all export pages that feed syncs.
- Use it to decide which export to integrate next.

### For Operators
- Use exports when you need bulk data.
- If a report is missing, the Warehouse app will be stale.

### For Agent
- Use this to choose the correct export source.
- Cite the linked page doc when answering export questions.

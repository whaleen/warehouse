# GE DMS Pages Catalog

Complete reference of all documented pages in the GE Dealer Management System.

**Last Updated**: 2026-02-08
**Catalog Status**: See `/docs?doc=docs%2Fge-dms%2Farchive-index.md` for the captured page list and 404s.

---

## Quick Navigation

- [Daily Operations Column](#daily-operations-column) (14 pages)
- [Reports, Tracking & Help Column](#reports-tracking--help-column) (10 pages)
- [Inventory Column](#inventory-column) (6 pages)
- [Data Export Summary](#data-export-summary)

---

## Daily Operations Column

### 1. Cancellations
**URL**: `/dms/cancel`
**Purpose**: Workflow for managing order cancellations
**Type**: Workflow interface
**Export**: None
**Notes**: Pure workflow tool, no data export

### 2. Check In
**URL**: `/dms/checkin`
**Purpose**: Workflow for checking in delivered orders
**Type**: Workflow interface
**Export**: None
**Notes**: Core delivery completion workflow

### 3. Check In POD(s)
**URL**: `/dms/checkin/podViewerLanding`
**Purpose**: Retrieve POD (Proof of Delivery) PDFs
**Type**: Document retrieval
**Export**: PDF download (individual PODs)
**Filters**: CSO, Delivery ID, Tracking #, Customer PO, Date range
**Notes**: Downloads POD PDFs for specific deliveries

### 4. Communication Portal
**URL**: `https://prd.digideck.appliancedms.com/` (external domain)
**Purpose**: External communication/collaboration system
**Type**: External application
**Export**: Unknown (external system)
**Notes**: Opens in separate GE application domain

### 5. Downloads ⭐
**URL**: `/dms/checkin/downloadsindex`
**Purpose**: Central hub for downloading operational reports
**Type**: Report download interface with exports
**Export**: Excel/CSV for 5 report types:
1. CHECK-IN
2. CHECK-IN WITH ASSOCIATED LINES
3. PARKING LOT
4. INBOUND
5. CANCELLATIONS

**Filters**: Date range, Inventory Org
**Notes**: Major data export page - 5 different operational reports

### 6. Inbound
**URL**: `/dms/inbound`
**Purpose**: Workflow for processing inbound shipments from ADC
**Type**: Workflow interface
**Export**: None (data available via Downloads page)
**Notes**: Workflow for receiving trucks from GE

### 7. Manifesting
**URL**: `/dms/manifest`
**Purpose**: Menu hub for manifesting workflows
**Type**: Menu/Navigation page
**Subsections**:
- Create Manifests
- Manifest Inquiry
- Manifest History
- Load Plan Inquiry

**Export**: None
**Notes**: Navigation hub with 4 workflow subsections

### 8. Meet Truck & Multi-Family SDS Orders
**URL**: `/dms/meettruck/meetTruckHelp`
**Purpose**: Menu hub for meet truck order management
**Type**: Menu/Navigation page
**Subsections**:
- WORKING - MT Orders in Process
- PENDING - MT Contact Customer
- SHIPPED - MT Delivery Complete
- ALL
- PENDING - Multi-Family SDS Orders

**Export**: None
**Notes**: Navigation hub for meet truck workflows

### 9. Order Download ⭐⭐
**URL**: `/dms/orderdata`
**Purpose**: Comprehensive order data export with extensive filtering
**Type**: Data export interface
**Export**: CSV Spreadsheet, Excel Spreadsheet, Enhanced formats
**Filters**:
- Show: ALL, NEXT DAY/HOT SHOT, REVERSE, RETURN, MEET TRUCK, WORK ORDERS, WILL CALL
- Status: ALL, SHIPPED, SHIPPED/PENDING, PICKED, PICKED/SHIPPED, CANCELLED, PENDING
- INV ORG Location: 9SU
- Orders for Date + days range
- Order Data Enhanced: V1 or V2
- Search: CSO, TRACKING #, INBOUND SHIPMENT #

**Notes**: CRITICAL - Complete order export with all statuses and tracking

### 10. Parking Lot
**URL**: `/dms/parkinglot`
**Purpose**: Track orders picked and awaiting delivery
**Type**: Workflow + data view
**Export**: None (data available via Downloads "PARKING LOT" report)
**Table Columns**: Select, Delivery Date, Arrival Date, Status, CSO, Delivery ID, Customer, Zip, Group, Type, Action
**Action Buttons**: Check In:NO EXCEPTION, Print Pick List, Print POD, Print Labels, Print BOL
**Notes**: Holding area for picked orders

### 11. Return Request Or Cancel
**URL**: `/dms/rrc`
**Purpose**: Menu hub for return and cancellation requests
**Type**: Menu/Navigation page
**Subsections**:
- REQUEST RETURN INPUT
- REQUEST RETURN VIEW
- CANCEL RETURN INPUT
- CANCEL RETURN VIEW
- DSSO

**Export**: None
**Notes**: Workflow interface for processing returns

### 12. Returns Receiving
**URL**: `/dms/checkin/rar` (opens in new tab)
**Purpose**: Process receiving of returned items
**Type**: Workflow interface (part of Check In system)
**Export**: Unknown (couldn't fully document - opens in new tab)
**Notes**: RAR = Return Authorization Receiving

### 13. Warehouse Exception Report
**URL**: `/dms/truckstatus/warehouse_exception_report`
**Purpose**: Generate exception reports by truck and date
**Type**: Report generation form
**Filters**: INV ORG (9SU), TRUCK NUMBER (dropdown), DELIVERY DATE
**Export**: Report format unknown (generated after form submission)
**Notes**: Exception tracking tool

### 14. PAT
**URL**: `https://pat.geappliances.com/` (external domain)
**Purpose**: Unknown - separate GE system
**Type**: External application
**Export**: Unknown
**Notes**: External link, different domain than main DMS

---

## Reports, Tracking & Help Column

### 15. Anti-Tip Audit Report ⭐
**URL**: `/dms/antitippaudit/antitip_audit_report`
**Purpose**: Audit anti-tip device installation compliance
**Type**: Report with data table and export
**Export**: Link to export report (format unknown, likely Excel/CSV)
**Filters**: DATE, TRUCK (dropdown), INV ORG (9SU), text search
**Metrics**: AT Installed %, AT Photos % (YES, NO - Removed, NO - Sealed)
**Table Columns** (12): CSO/ORDER, TRACKING #, DELIVERY ID, TRUCK, DRIVER NAME, Product Type, Model, Serial, AT Flag, AT Installed?, AT Photos, POD
**Notes**: Safety/regulatory compliance tracking

### 16. Location Contact Information
**URL**: `/dms/locmaintenance/editLocMaintenance`
**Purpose**: Administrative configuration for warehouse location
**Type**: Configuration/Settings form
**Export**: None (administrative page)
**Details Managed**:
- Location info (address, phone, email, hours)
- Warehouse capacity details
- 15 contact role types
- Regional manager info
- Vendor shipping schedules (BSH, ELECTROLUX, GEA, LG, MAYTAG, SAMSUNG, SHARP)

**Notes**: Configuration page, not data export

### 17. Online POD Search
**URL**: `/dms/pod/search`
**Purpose**: Search and retrieve POD photos/documents
**Type**: Search interface
**Export**: None (displays individual POD images)
**Search Criteria**: CSO, Tracking #, Customer Po, Phone, Inv Org, Start Date, Days to search, Account #, Driver ID
**Notes**: Lookup tool for viewing POD documents

### 18. National Builder Open Orders by Customer ⭐
**URL**: `/dms/openorderreport`
**Purpose**: Report of open orders for national home builders
**Type**: Report with export
**Export**: Export To Excel
**Filters**: Inv Org (9SU), Customer Name (top 50 builders: LENNAR, KB HOME, RICHMOND AMERICAN, etc.)
**Table Columns** (18): Original Delivery Date, Ship Method, DMS Loc, Age, Delivery ID, CSO, Arrival Date, Requested Delivery Date, Address, Delivery Type, Order Status, Schedule Code, Assignment Type, Inv Org, Sold To, Customer Account, RM Code, RM Last Name
**Notes**: Specialized builder customer report

### 19. Orders in Process (OIP)
**URL**: `/dms/oip/orderinprocess`
**Purpose**: Dashboard of orders in process by delivery date
**Type**: Interactive dashboard
**Export**: None (drill-down via hyperlinks)
**View Options**: STATUS, TYPE, MEET TRUCK
**Data Grid**: Calendar view with 4 delivery types (Home, Retail, Builder/Contract, All) showing Tracking #s, Qty, Pts, Svcs
**Notes**: Real-time monitoring dashboard, not bulk export

### 20. Reporting (Summary Reports) ⭐
**URL**: `/dms/reportsummary`
**Purpose**: Multi-report hub with 8 report types
**Type**: Report selection interface with export
**Export**: EXPORT TO SPREADSHEET
**Available Reports**:
1. Tactical Dashboard
2. Badge Expirations
3. eTicket Report
4. ERP Inbound Report
5. ERP Open Orders/Returns
6. IVR Usage Report
7. Precall Activity Report
8. Prop. Damage Claim

**Filters**: Territory, Region Manager, INV ORG, Input Start Date, Days before start, text search
**Notes**: Central reporting hub - 8 report types, single export interface

### 21. Track & Trace
**URL**: `/dms/tracktrace`
**Purpose**: Search and track orders by multiple criteria
**Type**: Order search/lookup interface
**Export**: None (displays search results)
**Search Criteria** (14 fields): CSO, Delivery ID, Tracking #, Customer Po, Phone, Zip Code, Delivery Date, Inv Org, Start Date, Days to search, Order Type, EBS Account#, Not Delivered/Cancelled checkbox, Address search
**Notes**: Flexible order lookup tool

### 22. Truck Status - Delivery
**URL**: `/dms/truckstatus`
**Purpose**: Real-time delivery truck location tracking
**Type**: Real-time monitoring dashboard
**Export**: None (live tracking)
**Table Columns** (10): TRUCK, PRIMARY DRIVER, DRIVER ID, PHONE #1, CURRENT STOP, IVR RESPONSE FOR CURRENT STOP, TIME FRAME, IVR DATE/TIME STAMP, LINKS, Warehouse Exception Report
**Notes**: Live IVR tracking system

### 23. Truck Status - Staging
**URL**: `https://prd.digideck.appliancedms.com/scanbyeachstaging/scan?invOrg=9SU` (external)
**Purpose**: Monitor truck staging scan status
**Type**: Real-time monitoring dashboard (external app)
**Export**: None
**Status Categories**: Scanned No Issues, Scanned With Issues, Scan Pending
**Notes**: External application for staging verification

### 24. Check In - Audit
**URL**: `/dms/checkinaudit/checkin_audit_report`
**Purpose**: Quality audit of check-in and driver performance
**Type**: Audit/Quality Control interface
**Export**: None (audit workflow)
**View Tabs**: Delivery Agent, HQ View, Reporting
**Table Columns** (11): CSO, Check In Date, Delivery Date, Deliver ID, Truck, Driver, Check In changes, PODs (count), Photos (count), Agent Findings (dropdown), Agent Note
**Agent Findings Options**: PASS, plus 10 failure categories (missing photos, incorrect documentation, etc.)
**Notes**: Quality control tool for delivery compliance

---

## Inventory Column

### 25. ASIS ⭐⭐⭐
**URL**: `/dms/newasis`
**Purpose**: Main ASIS inventory management - core system for damaged/open-box appliances
**Type**: Primary data management with DUAL exports
**Export**:
- Model Details SpreadSheet ⭐
- ASIS Load SpreadSheet ⭐

**Navigation Tabs**: VIEW SCANNED LOAD STATUS, REPORT HISTORY
**Filters**: Inventory Loc (9SU), text search
**Table Columns** (6): Load Number (clickable), Units (typically 60-61), Notes (load identifier), Scanned Date/Time, Status (FOR SALE), Delete Load
**Action Buttons**: Create ASIS Load
**Notes**: CRITICAL PAGE - Core ASIS system managing ~60-appliance loads for resale

### 26. Backhaul ⭐
**URL**: `/dms/backhaul`
**Purpose**: Manage backhaul shipments to ADC
**Type**: Inventory management with export
**Export**: Spreadsheet
**Filters**: INV ORG (9SU), text search, Reporting Period (Yearly: 2026-2022), Not Complete checkbox
**Table Columns** (12): Inv Org, ISO, Start Date, End Date, Backhaul Status, Cancel, Total Units, Total Points, Type, Sub Inventory, ADC, BOL, SCAC
**Action Buttons**: Create Manual Backhaul
**Notes**: Tracks returns to ADC

### 27. Cycle Count / Physical Inventory
**URL**: `/dms/cyclecount/invorgs`
**Purpose**: Inventory cycle count management
**Type**: Selection/landing page
**Export**: None visible
**Filters**: INV ORG (9SU)
**Notes**: Shows cycle count requests (e.g., "26 Q1 CTRL MANDATORY" for ASIS, FG, SCRAP)

### 28. ERP On Hand Qty ⭐
**URL**: `/dms/erpCheckInventory`
**Purpose**: Query on-hand inventory by sub-inventory
**Type**: Inventory query with export
**Export**: Spreadsheet
**Filters**: INV ORG (9SU), SUBINVENTORY (ASIS, FG, NONRES, RCV, RFSCRAP, SCRAP, STA, SURDEF, UFG), text search
**Table Columns** (5): Model #, Serial #, Inv Qty, Availability Status, Availability Message
**Notes**: Must select sub-inventory to view data

### 29. Inventory Report
**URL**: Unknown (dashboard view)
**Purpose**: Executive summary of inventory across all sub-inventories
**Type**: Dashboard/report view
**Export**: Unknown
**Filters**: RM (ALL, BK), INV ORG (ALL)
**Categories**: FG, ASIS, RF SCRAP, SCRAP, PBH, RCV, NON RES, STA, OTHER
**Metrics**: GE CRATED, GE ASIS, GE SCRAP, NON-GEA, PRE-DELIVERY, percentages, warehouse capacity
**Notes**: Executive dashboard

### 30. Scrap
**URL**: Unknown
**Purpose**: Manage scrap disposal and approval workflow
**Type**: Workflow interface
**Export**: None visible
**Filters**: INV ORG (9SU), text search, STATUS (OPEN CASE, COMPLETE), date range
**Tabs**: Input Request/SDS Approval, SDS Approved, History
**Table Columns** (8): INV ORG, STATUS, SDS APPROVE DATE, COMPLETE DATE, TOTAL QTY, PROCESSED QTY, PENDING QTY, OPEN CASE QTY
**Notes**: Scrap disposal approval tracking

---

## Data Export Summary

### Critical Export Pages (Priority 1)

1. **ASIS** (`/dms/newasis`) ⭐⭐⭐
   - TWO exports: Model Details + ASIS Load
   - Core business data: ~60-appliance loads
   - Status: FOR SALE
   - **Use Case**: Complete ASIS inventory management

2. **Order Download** (`/dms/orderdata`) ⭐⭐
   - Formats: CSV, Excel, Enhanced (V1/V2)
   - Comprehensive filtering (status, type, date)
   - **Use Case**: Complete order history and tracking

3. **Downloads** (`/dms/checkin/downloadsindex`) ⭐
   - 5 report types: CHECK-IN, CHECK-IN WITH LINES, PARKING LOT, INBOUND, CANCELLATIONS
   - Formats: Excel/CSV
   - **Use Case**: Operational data by workflow stage

### Major Export Pages (Priority 2)

4. **Reporting** (`/dms/reportsummary`) ⭐
   - 8 report types (Tactical, Badge, eTicket, ERP Inbound, etc.)
   - Single spreadsheet export
   - **Use Case**: Multi-purpose reporting hub

5. **National Builder Open Orders** (`/dms/openorderreport`) ⭐
   - Excel export
   - Top 50 builder customers
   - **Use Case**: Builder customer order tracking

6. **Anti-Tip Audit Report** (`/dms/antitippaudit/antitip_audit_report`) ⭐
   - Export link available
   - Safety compliance data
   - **Use Case**: Regulatory compliance tracking

7. **Backhaul** (`/dms/backhaul`) ⭐
   - Spreadsheet export
   - Returns to ADC tracking
   - **Use Case**: Reverse logistics data

8. **ERP On Hand Qty** (`/dms/erpCheckInventory`) ⭐
   - Spreadsheet export
   - Sub-inventory breakdowns
   - **Use Case**: Real-time inventory queries

### Workflow-Only Pages (No Export)

- Cancellations, Check In, Inbound, Manifesting, Meet Truck, Return Request, Warehouse Exception Report
- Orders in Process (OIP), Track & Trace, Truck Status pages
- Check In - Audit, Online POD Search, Location Contact Info

**Total**: 22 workflow pages, 8 export pages

---

## Page Type Distribution

- **Workflow Interfaces**: 16 pages
- **Data Export Pages**: 8 pages
- **Menu/Navigation Hubs**: 3 pages (Manifesting, Meet Truck, Return Request)
- **Search/Lookup Tools**: 3 pages (Track & Trace, POD Search, Check In - Audit)
- **External Applications**: 3 pages (Communication Portal, PAT, Truck Status - Staging)
- **Configuration Pages**: 1 page (Location Contact Info)

---

## Known External Domains

1. **prd.digideck.appliancedms.com**
   - Communication Portal
   - Truck Status - Staging

2. **pat.geappliances.com**
   - PAT (unknown purpose)

3. **dms-erp-aws-prd.geappliances.com**
   - Main GE DMS application

---

## Field Mapping Reference

For detailed field mappings of known exports, see:
- `GE_ENDPOINT_FIELDS.md` - ASIS endpoint field documentation
- `GE_DMS_SYSTEM_OVERVIEW.md` - Business process flows and terminology

## Audience Notes

### For Developers
- Use this as the master page catalog; validate pages via the archive index.

### For Operators
- Use the Docs UI GE DMS section; this file is a technical catalog.

### For Agent
- Use the archive index for verified page status and details.

---

## Documentation Notes

1. **Before exploring**: Check the archive index to see if the page was captured.
2. **When documenting new pages**: Follow this format (URL, Purpose, Type, Export, Filters, Notes).
3. **Export identification**: Look for buttons: "Spreadsheet", "Excel", "CSV", "Export", "Download".
4. **External links**: Note if page opens in a new tab or different domain.
5. **Workflow vs Data**: Distinguish between workflow interfaces (no export) and data pages (exportable).

---

## Last Exploration Session

**Date**: 2026-02-08
**Notes**:
- Archive captures are stored under `.ge-dms-archive/` and surfaced in the Docs UI.
- Some pages return 404 or external domains; see the archive index for status.

# GE DMS System Overview & Glossary

**Purpose:** Complete understanding of GE DMS business processes, terminology, and workflows to inform our unified database and replacement UI.

**Generated:** 2026-01-30
**Source:** GE DMS FAQ (https://dms-erp-aws-prd.geappliances.com/dms/faqadmin/faqsearch)

---

## Executive Summary

GE DMS (Dealer Management System) is a web-based platform for GE appliance delivery agents to manage the complete lifecycle of customer orders from receiving inventory through delivery and returns. The system is complex, poorly designed, and requires multiple disconnected workflows across ~10 different modules.

**Our Goal:** Build unified database + new UI to eliminate the need to ever log into GE DMS again.

---

## Glossary of Terms

### Order & Delivery Terms

| Term | Full Name | Definition |
|------|-----------|------------|
| **MS#** | Master Schedule Number | Primary order identifier (e.g., "9SU20260129142324") |
| **CSO** | Customer Service Order | Customer order number in GE's system |
| **POD** | Proof of Delivery | Signed delivery receipt document |
| **RA** | Return Authorization | Return order number for product returns |
| **ASN** | Advanced Shipping Notice | Electronic notice of incoming shipment |
| **NCR** | No Charge Replacement | Free replacement for damaged product |
| **RDD** | Requested Delivery Date | Customer's desired delivery date |
| **SDS** | Special Delivery Service | Builder/contractor deliveries (not retail) |

### Inventory & Product Terms

| Term | Full Name | Definition |
|------|-----------|------------|
| **ASIS** | As-Is Inventory | Damaged/open-box items sold at discount |
| **FG** | Finished Goods | New, ready-to-sell inventory |
| **STA** | Staged Inventory | Items staged for upcoming deliveries |
| **SFLS** | Ship From Local Stock | Items shipped from agent's warehouse |
| **PBH** | Product Bill-back Header | Return shipment to GE/vendor |
| **INS** | Inventory Adjustment | Correction to inventory quantities |

### System & Process Terms

| Term | Full Name | Definition |
|------|-----------|------------|
| **ADC** | Appliance Distribution Center | GE's regional warehouse |
| **EBS** | Enterprise Business System | GE's backend ERP system |
| **IVR** | Interactive Voice Response | Phone system for driver status updates |
| **RRC** | Return Request Credit | Tool for processing customer returns |
| **DSSO** | Delivery Solutions Support Operations | GE support team |
| **PSE** | Product Service Exchange | Warranty exchange (not a sale) |
| **PRO#** | Progressive Number | Tracking number from freight carrier |

### Service & Installation Terms

| Term | Full Name | Definition |
|------|-----------|------------|
| **M901** | Service Code M901 | Haul-away service code |
| **M904** | Service Code M904 | Installation service code |
| **Anti-Tip** | Anti-Tip Device | Safety device required for ranges/ovens |
| **Work Order** | Service Work Order | Additional service after delivery |

### Status Terms

| Term | Meaning | Context |
|------|---------|---------|
| **Pending** | Awaiting action | Order released but not shipped |
| **Picked** | In warehouse | Order pulled from inventory, ready to ship |
| **Shipped** | En route | Order left ADC, heading to agent |
| **Delivered** | Complete | Order delivered to customer |
| **Awaiting Receipt** | Not yet received | Order not yet arrived at agent warehouse |

---

## Business Process Flows

### Daily Operation Timeline

```
6:00 AM  - Check Inbound Summary (trucks arriving today)
7:00 AM  - Drivers call IVR to log in
8:00 AM  - Manifesting updates from overnight processing
9:00 AM  - Hourly updates start (Manifesting ↔ Check-in sync)
10:00 AM - Process inbound trucks as they arrive
12:00 PM - Monitor truck status, handle exceptions
3:00 PM  - Check-in deliveries as drivers complete routes
5:00 PM  - Submit check-ins, process returns
6:00 PM  - Final check-in submissions, parking lot will calls
```

### 1. Receiving Inventory (INBOUND)

**When:** Trucks arrive from ADC or vendors
**Goal:** Receive inventory, report exceptions (damage/shortage)

**Process:**
1. **Before Truck Arrives:** ASN loads into Inbound Summary (after ATB3 transaction in EBS)
2. **Truck Arrives:** Unload and inspect products
3. **Report Exceptions:**
   - **Damage:** Report in Inbound → Automatically generates NCR replacement
   - **Shortage:** Report in Inbound → Automatically generates replacement
   - **Serial Mix:** Wrong serial on product vs. carton → Report at Inbound or Check-in
4. **Submit Inbound:** Moves inventory from "Awaiting Receipt" → "Picked" status
5. **Deadline:** Must report exceptions before RDD (Requested Delivery Date)

**Key Fields Captured:**
- Model numbers
- Serial numbers
- Damage type/location
- Shortage quantities
- ASN numbers
- Tracking numbers

**What Goes Wrong:**
- Missing ASNs (vendor didn't send) → Contact DSSO to request resubmission
- Pre-Picked status stuck → Submit Line Status Workflow case
- Missed exceptions → Must call Yellow Card for replacement, cancel shorted line

---

### 2. Assigning Orders (MANIFESTING)

**When:** Daily, before drivers leave
**Goal:** Assign orders to trucks/drivers with optimized routes

**Process:**
1. **Orders Load:** Overnight batch imports orders ready for delivery
2. **Assign Trucks:** Drag orders to driver trucks, set stop sequence
3. **Print Manifests:** Generate driver route sheets + signature manifests
4. **IVR Sync:** Manifesting data syncs to IVR for driver phone system

**Key Fields:**
- Delivery address
- Phone numbers (up to 4 per customer)
- Requested delivery date
- Stop number/sequence
- Truck assignment
- Driver assignment (must have 1 primary driver per truck)

**Important Rules:**
- Changes in Manifesting take **1 hour** to sync to Check-in
- Rescheduled orders stay on original date in Check-in until night before new date
- Must use "Refresh" in IVR after making changes

---

### 3. Driver Workflow (DRIVER APP + IVR)

**When:** During delivery route
**Goal:** Real-time status updates, customer communication

**Process:**
1. **Log In:** Driver calls IVR with badge ID
2. **Pre-Call:** System auto-calls customer 30 min before arrival
3. **Arrive:** Driver clicks "Arrive" → IVR pings timestamp
4. **Deliver:** Complete delivery, get signature on iPhone
5. **Haul-Away:** Record old appliance serial via Driver App
6. **Depart:** Driver clicks "Depart" → IVR pings timestamp
7. **Next Stop:** Repeat

**Key Data Captured:**
- Arrival time (IVR ping)
- Departure time (IVR ping)
- Customer signature (Driver App)
- Haul-away serial numbers
- Exceptions (refused, damaged, etc.)
- Driver notes

**Important:**
- Driver CANNOT skip signature (except on attempts)
- Haul-aways must balance: 1 HA record per M901 service
- Coverage issues? Reset network settings or check data plan

---

### 4. Completing Deliveries (CHECK-IN)

**When:** After driver returns, same day as delivery
**Goal:** Finalize delivery, process exceptions, generate payment

**Process:**
1. **Open Truck:** Select truck/driver, click "Add Missing" to load stops
2. **For Each Stop:**
   - Mark products delivered/refused
   - Record haul-away serials (from Driver App)
   - Add exceptions (damage, missing parts, etc.)
   - Get services marked "Performed"
3. **Mark Complete:** Check "MS Complete" then "Delivery Complete"
4. **Save & Submit:** Finalizes delivery, triggers POD generation, payment

**Critical Rules:**
- **Must mark "Delivery Complete"** or order stays open
- **Haul-aways must match M901 codes** or Check-in fails
- **Cannot add services after Check-in complete** → Use Work Order
- **Returns:** Status goes from "Pending" → "Shipped" (means credit processed)

**Common Errors:**
- "No driver assigned" → Need exactly 1 primary driver on truck
- "HA tab incomplete" → Missing haul-away records or not balanced
- "Line status must be updated" → Service not in "Awaiting Receipt" or Product not "Picked"

---

### 5. Will Call & Common Carrier (PARKING LOT)

**When:** Customer pickup or freight carrier delivery
**Goal:** Handle non-standard deliveries

**Process:**
1. **Will Call:** Customer picks up at warehouse
   - Order appears in Parking Lot
   - Complete check-in via Parking Lot module
   - Print POD for customer signature
2. **Common Carrier:** Third-party freight (FedEx, Averitt)
   - Returns only (no outbound common carrier in ERP)
   - Find RA in Parking Lot
   - Print POD in EBS

**Important:**
- Can move Will Call → Manifesting if agent will deliver
- Cannot move Common Carrier to Manifesting
- SDS orders (Home Delivery schedule code) cannot move to Parking Lot

---

### 6. Returns Processing (RRC Tool)

**When:** Customer wants to return product
**Goal:** Issue credit, retrieve product, ship back to GE

**Process:**
1. **Request RA:** Submit via RRC tool or auto-generated from Check-in refusal
2. **Receive Return:** Driver picks up old appliance, enters serial
3. **Check-in Return:** Same as regular Check-in, mark return complete
4. **Status Updates:**
   - Pending = Return open, needs pickup
   - Shipped = Return complete, credit processed

**Serial Number Rules:**
- Report actual serial driver brings back (even if different from label)
- Serial must show "STA" status and issued out of stores to be eligible
- Wrong serial = Return won't process → Fix in Returns Receiving form

---

### 7. Scrapping Units (ESCRAP)

**When:** Damaged units beyond repair
**Goal:** Get approval to remove from inventory

**Process:**
1. **Create Scrap Request:** Enter MS#, model, serial, reason
2. **Save to Queue:** Can batch multiple scrap requests
3. **Print Forms:** Generate PDF with all queued units
4. **Get RM Approval:** Regional Manager signs form
5. **Click "RM Approved":** Sends to DSSO for processing
6. **DSSO Approves:** Inventory updated, unit removed

**Rules:**
- Can only print form once after RM approval
- Warehouse App can only validate 10 units at a time
- Use "OTHER" category if no valid MS# (e.g., PI overages)

---

### 8. Work Orders

**When:** Additional service needed after delivery complete
**Goal:** Bill for extra work on completed orders

**Process:**
1. **Create Work Order MS#:** Generate via Work Order tool
2. **Complete Service:** Perform additional work
3. **Check-in Work Order:** Use Parking Lot check-in
4. **Bill in AEB:** Use original MS# with Work Order MS# in notes

**Limitations:**
- Only for completed deliveries (not during Check-in)
- Cannot use for "check an install" (no services)
- Cannot use for Meet Truck orders
- Must bill within 60 days of ship date

---

## System Modules Overview

### Modules by Function

| Module | Primary Use | Data Generated | Related Modules |
|--------|-------------|----------------|-----------------|
| **Inbound** | Receive trucks | ASNs, damages, shortages, serials | Check-in, Inventory |
| **Manifesting** | Assign routes | Truck assignments, stop sequences | IVR, Check-in |
| **Check-in** | Complete deliveries | PODs, exceptions, haul-aways | Manifesting, Returns |
| **Parking Lot** | Will Call, Common Carrier | Will Call PODs, Common Carrier RAs | Check-in |
| **Truck Status** | Monitor drivers | Real-time locations, stop progress | IVR, Manifesting |
| **IVR** | Driver phone system | Arrival/departure times, pre-calls | Manifesting, Check-in |
| **Driver App** | iPhone delivery app | Signatures, haul-aways, photos | IVR, Check-in |
| **Warehouse App** | iPhone scanning | PI counts, haul-away validation | Check-in, Scrap |
| **eScrap** | Dispose units | Scrap approvals, RM signatures | Inventory |
| **RRC Tool** | Process returns | Return credits, RA numbers | Check-in, Parking Lot |
| **Meet Truck** | Direct deliveries | Order visibility, status tracking | Check-in (ERP only) |
| **Work Order** | Post-delivery service | Work Order MS#, service billing | Check-in |

---

## Data Relationships

### How Inventory Moves Through System

```
┌─────────────┐
│   INBOUND   │ Receive from ADC/Vendor
└──────┬──────┘
       │ Creates Inventory Records
       ▼
┌─────────────┐
│  FG / ASIS  │ Available inventory
│  / STA      │
└──────┬──────┘
       │ Assigned to Orders
       ▼
┌─────────────┐
│ MANIFESTING │ Order → Truck → Driver
└──────┬──────┘
       │ Syncs to IVR
       ▼
┌─────────────┐
│ DRIVER APP  │ Route execution
└──────┬──────┘
       │ Sends delivery data
       ▼
┌─────────────┐
│  CHECK-IN   │ Finalize delivery
└──────┬──────┘
       │ Generates POD, Payment
       ▼
┌─────────────┐
│  DELIVERED  │ Order complete
└─────────────┘
```

### Exception Flows

**Damage at Inbound:**
```
Inbound (report damage) → Auto-generates NCR → NCR ships from ADC →
Manifest NCR → Deliver NCR → Check-in NCR
```

**Shortage at Inbound:**
```
Inbound (report shortage) → Auto-generates replacement → Replacement ships →
Manifest replacement → Deliver → Check-in
```

**Customer Refusal:**
```
Driver arrives → Customer refuses → Record in Driver App →
Check-in (mark refused) → Auto-generates RA → Return processed
```

**Haul-Away Flow:**
```
Driver removes old unit → Scans serial in Driver App →
Serial sent to Warehouse App → Warehouse receives HA →
Check-in validates HA matches M901 → HA processed
```

---

## Critical Timing & Sync Rules

### System Update Frequencies

| Update Type | Frequency | Impact |
|-------------|-----------|--------|
| Manifesting → Check-in | **1 hour** | Rescheduled orders take 1 hour to appear |
| EBS → GE Delivers | **1 hour** | Line status changes take 1 hour to reflect |
| Inbound ASN load | **After ATB3** | Real-time when GE processes shipment |
| IVR → Truck Status | **Real-time** | If driver in coverage; delayed if out of coverage |
| Check-in → Payment | **Batch process** | POD generation runs overnight |
| Data to Manifest | **Overnight** | New orders appear next morning |

### Important Deadlines

- **Inbound exceptions:** Must report before RDD (Requested Delivery Date)
- **Work Order billing:** Must bill within 60 days of ship date
- **Rescheduled orders:** Stay on original date until night before new date
- **ASN resolution:** DSSO typically responds same-day to missing ASNs
- **Line Status Workflow:** Generally same-day turnaround

---

## Pain Points & Workarounds

### Known System Issues

1. **Rescheduled orders disappear from Truck Status**
   - Bug: If MS# rescheduled, driver vanishes from Truck Status until next IVR call
   - Data: Not lost, just display issue
   - Workaround: Driver calls IVR again

2. **Check-in won't allow service addition after completion**
   - Limitation: Cannot add/remove services post-check-in
   - Workaround: Use Work Order module for additional services

3. **Haul-away tab errors**
   - Cause: HA records don't match M901 service codes
   - Fix: Manually add/delete HA records to balance counts

4. **iPhone signature issues**
   - Cause: Cold hands don't register on touchscreen
   - Fix: Use stylus

5. **IVR "out of coverage" on login**
   - Cause: Phone in hibernation, needs internet reconnect
   - Fix: Turn airplane mode on/off, check email, or restart phone

6. **PSE orders can't complete in Check-in**
   - By design: PSE haul-aways handled during exception billing, not Check-in
   - Workaround: Skip HA in Check-in for PSE orders

---

## What We Need to Capture

### Essential Data Fields

**From Inbound:**
- ASN numbers
- Model numbers
- Serial numbers
- Damage types/locations
- Shortage quantities
- Receive dates/times

**From Manifesting:**
- Truck assignments
- Driver assignments
- Stop sequences
- Delivery addresses
- Phone numbers (up to 4)
- Requested delivery dates

**From Check-in:**
- Delivery completion timestamps
- Products delivered/refused
- Haul-away serials
- Exception codes
- Service completion status
- POD signatures (from Driver App)

**From IVR/Driver App:**
- Arrival times
- Departure times
- Pre-call results
- Customer signatures
- Driver notes

**From Returns:**
- RA numbers
- Return reasons
- Return serials
- Credit status

**From Scrap:**
- Scrap approval dates
- Scrap reasons
- RM signatures

---

## Next Steps: System Exploration

Now that we understand the business processes, we'll systematically explore each GE DMS page to document:

1. **What export buttons exist**
2. **What fields are available**
3. **What filters/parameters are required**
4. **How data maps to our unified database**

**Exploration Order:**
1. Daily Operations (Cancellations, Check In, Inbound, etc.)
2. Reports, Tracking & Help (Reports, Track & Trace, etc.)
3. Inventory (ASIS, FG, STA, ERP On Hand Qty, etc.)

**Goal:** Complete field mapping to finalize database schema and eliminate need for GE DMS login.

---

## References

- **FAQ Source:** https://dms-erp-aws-prd.geappliances.com/dms/faqadmin/faqsearch
- **Current Sync Coverage:** ASIS (loads), FG (inventory), STA (inventory)
- **Missing Coverage:** Check-in data, Manifesting data, Returns, Scrap, Work Orders

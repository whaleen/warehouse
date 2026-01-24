# GE DMS Research & Sync Pipeline

This directory contains all research, crawl scripts, and sync utilities for integrating with GE DMS (Document Management System).

## Directory Structure

```
research/ge-dms/
├── README.md               # This file
├── cookies.txt             # GE DMS session cookies (DO NOT COMMIT)
├── scripts/                # Automation scripts
│   ├── browse-ge-dms.ts    # Playwright browser for manual exploration
│   ├── crawl-*.ts          # Endpoint discovery crawlers
│   ├── deep-crawl.ts       # Comprehensive site crawler
│   ├── explore-ge-dms.ts   # Interactive exploration script
│   ├── extract-links.ts    # Link extraction utility
│   ├── fetch_all_asis_load_data.sh
│   ├── fetch_all_asis_load_report_history_data.sh
│   └── csv-to-json.sh      # CSV to JSON conversion
├── docs/                   # Documentation
│   ├── GE-DMS-ENDPOINTS.md # Discovered API endpoints
│   ├── DEEP-CRAWL-REPORT.md
│   ├── asis.md
│   ├── ge-dms-docs/
│   └── ge-dms-filtered-docs/
└── output/                 # Generated artifacts (gitignored)
    ├── screenshots/
    ├── captures/
    ├── crawl-output.txt
    ├── deep-crawl-report.json
    └── ge-dms-pages.json
```

## Quick Start

### 1. Authentication

GE DMS uses SSO. To get cookies:

1. Login to GE DMS in your browser
2. Export cookies to `research/ge-dms/cookies.txt` using a browser extension
3. Required cookies: `mod_auth_openidc_session`, `JSESSIONID`, `AWSALB`, `AWSALBCORS`

### 2. Fetch ASIS Data

From the **project root**:

```bash
# Step 1: Download top-level XLS files manually from GE DMS
# - ASIS Load List → public/ASIS/ASISLoadData.xls
# - ASIS Report History → public/ASIS/ASISReportHistoryData.xls
# - ASIS Inventory → public/ASIS/ASIS.xls

# Step 2: Convert XLS to CSV (requires gnumeric)
ssconvert public/ASIS/ASISLoadData.xls public/ASIS/ASISLoadData.csv
ssconvert public/ASIS/ASISReportHistoryData.xls public/ASIS/ASISReportHistoryData.csv
ssconvert public/ASIS/ASIS.xls public/ASIS/ASIS.csv

# Step 3: Fetch per-load CSVs
./research/ge-dms/scripts/fetch_all_asis_load_data.sh
./research/ge-dms/scripts/fetch_all_asis_load_report_history_data.sh

# Step 4: Convert all CSVs to JSON
./research/ge-dms/scripts/csv-to-json.sh
```

### 3. Run Crawlers (for endpoint discovery)

```bash
# Interactive browser session
npx ts-node research/ge-dms/scripts/browse-ge-dms.ts

# Deep crawl for endpoint discovery
npx ts-node research/ge-dms/scripts/deep-crawl.ts
```

## GE DMS Endpoints

See `docs/GE-DMS-ENDPOINTS.md` for full documentation. Key endpoints:

| Data | Endpoint | Method |
|------|----------|--------|
| ASIS Load List | `/dms/newasis/downloadExcelSpreadsheet` | POST |
| Report History | `/dms/newasis/downloadReportHistoryExcelSpreadsheet` | POST |
| ASIS Inventory | `/dms/asis/downloadExcelSpreadsheet` | GET |
| Per-Load Items | `/dms/newasis/downloadCsvSpreadsheet?invOrg={}&createDate={}` | POST |

## Data Flow

```
GE DMS
   │
   ├── Manual download (XLS) ──────────────────┐
   │                                           │
   └── Automated fetch (cookies) ──────────────┼──→ public/ASIS/
                                               │       ├── *.xls (source)
                                               │       ├── *.csv (converted)
                                               │       ├── *.json (for app)
                                               │       ├── ASISLoadData/
                                               │       └── ASISReportHistoryData/
                                               │
                                               └──→ App syncs via geSync.ts
                                                       └── Logs to ge_changes table
```

## Related App Code

- `src/lib/geSync.ts` - Sync logic that reads from `public/ASIS/*.json`
- `src/lib/asisImport.ts` - File import utilities
- `migrations/20260124_add_ge_changes.sql` - Change tracking table

## Notes

- `cookies.txt` expires frequently - refresh after auth errors
- Output from crawlers is gitignored (screenshots, HTML captures)
- CSV is authoritative; JSON is derived and regenerable
- The pipeline intentionally preserves duplicates for analysis

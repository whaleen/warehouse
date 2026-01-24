#!/usr/bin/env bash
# Fetch per-load CSV files from GE DMS for ASISReportHistoryData (all loads)
# Run from: project root
# Usage: ./research/ge-dms/scripts/fetch_all_asis_load_report_history_data.sh

set -euo pipefail

# Paths relative to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../../.."
COOKIES="$SCRIPT_DIR/../cookies.txt"

cd "$PROJECT_ROOT"

BASE="https://dms-erp-aws-prd.geappliances.com"
IN="public/ASIS/ASISReportHistoryData.csv"
OUT="public/ASIS/ASISReportHistoryData"
mkdir -p "$OUT"

if [[ ! -f "$COOKIES" ]]; then
  echo "Error: cookies.txt not found at $COOKIES"
  echo "Please login to GE DMS and export cookies."
  exit 1
fi

tail -n +2 "$IN" | cut -d',' -f2 | tr -d '\r"' | while read LOADID; do
  INVORG="${LOADID:0:3}"; CREATED="${LOADID:3}"
  echo "→ reporthistory $LOADID"
  curl -sSL -b "$COOKIES" \
    -H "Referer: $BASE/dms/newasis" \
    -H "User-Agent: Mozilla/5.0" \
    --data 'hCsvView=CSV' \
    "$BASE/dms/newasis/downloadCsvSpreadsheet?invOrg=$INVORG&createDate=$CREATED" \
    -o "$OUT/$LOADID.csv"
done

echo "Done fetching ASISReportHistoryData per-load CSVs."

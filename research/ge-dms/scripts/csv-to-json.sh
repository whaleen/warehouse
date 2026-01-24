#!/usr/bin/env bash
# Convert all ASIS CSV files to JSON for app consumption
# Run from: project root
# Usage: ./research/ge-dms/scripts/csv-to-json.sh

set -euo pipefail

# Paths relative to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../../.."

cd "$PROJECT_ROOT"

ASIS="public/ASIS"

# top-level tables
npx csvtojson "$ASIS/ASISLoadData.csv" > "$ASIS/ASISLoadData.json"
npx csvtojson "$ASIS/ASISReportHistoryData.csv" > "$ASIS/ASISReportHistoryData.json"
npx csvtojson "$ASIS/ASIS.csv" > "$ASIS/ASIS.json"

# per-load expansions
for f in "$ASIS/ASISLoadData/"*.csv; do
  [[ -f "$f" ]] && npx csvtojson "$f" > "${f%.csv}.json"
done

for f in "$ASIS/ASISReportHistoryData/"*.csv; do
  [[ -f "$f" ]] && npx csvtojson "$f" > "${f%.csv}.json"
done

echo "JSON generation complete."

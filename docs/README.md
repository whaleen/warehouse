# Documentation Index

This directory contains human-readable documentation organized by category.

## Architecture

Technical architecture and system design documentation.

- **[auth.md](./architecture/auth.md)** - GE authentication implementation details
- **[product-lifecycle.md](./architecture/product-lifecycle.md)** - Product data flow through the system
- **[production-endpoints.md](./architecture/production-endpoints.md)** - API endpoints reference

## Database

Database schema and data reference documentation.

- **[DATA_DICTIONARY.md](./database/DATA_DICTIONARY.md)** - Complete database schema reference

## Features

Feature-specific implementation documentation.

- **[ge-scraper.md](./features/ge-scraper.md)** - Product catalog scraper documentation
- **[map.md](./features/map.md)** - Warehouse map feature documentation
- **[scanning-sessions.md](./features/scanning-sessions.md)** - Scanner workflow documentation

## Sync Service

GE sync service implementation notes.

- **[ge-sync-fg-sta.md](./sync-service/ge-sync-fg-sta.md)** - FG/STA sync implementation notes

---

For service-specific documentation, see:
- **GE Sync Service**: `docs/ge-sync/` - GE DMS exploration and sync implementation

## Audience Notes

### For Developers
- Use this index to navigate architectural and implementation docs.
- For validated product workflows, see `docs/INDEX.md`.

### For Operators
- This index is technical; use the Docs UI for operational guidance.

### For Agent
- Treat these as implementation references; prefer user-facing docs for workflow answers.

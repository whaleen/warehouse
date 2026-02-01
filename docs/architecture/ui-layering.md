# UI View Inventory and Layering

## View Inventory (Structured)

### Primary Pages (Nav Destinations)
- Dashboard — `/` or `/app` — `src/components/Dashboard/DashboardView.tsx`
- Inventory — `/inventory` — `src/components/Inventory/InventoryView.tsx`
- Parts — `/parts` — `src/components/Parts/PartsView.tsx`
- Products — `/products` — `src/components/Products/ProductEnrichment.tsx`
- Loads — `/loads` — `src/components/Inventory/LoadManagementView.tsx`
- Activity — `/activity` — `src/components/Activity/ActivityLogView.tsx`
- Sessions (list/create) — `/scanning-sessions` — `src/components/Session/CreateSessionView.tsx`
- Map — `/map` — `src/components/Map/MapView.tsx`
- Settings (sections)
  - `/settings/locations` — `src/components/Settings/SettingsView.tsx`
  - `/settings/location` — `src/components/Settings/SettingsView.tsx`
  - `/settings/company` — `src/components/Settings/SettingsView.tsx`
  - `/settings/users` — `src/components/Settings/SettingsView.tsx`
  - `/settings/profile` — `src/components/Settings/SettingsView.tsx`
  - `/settings/displays` — `src/components/Settings/SettingsView.tsx`
  - `/settings/gesync` — `src/components/Settings/GESyncView.tsx`

### Secondary Detail Pages
- Scanning session — `/scanning-sessions/:sessionId` — `src/components/Session/ScanningSessionView.tsx`

### Public/Auth Pages (App)
- Login — `/login` — `src/components/Auth/LoginView.tsx`
- Signup — `/signup` — `src/components/Auth/SignupView.tsx`
- Reset password — `/reset-password` — `src/components/Auth/ResetPasswordView.tsx`
- Update password — `/update-password` — `src/components/Auth/UpdatePasswordView.tsx`
- Pending access — (post-auth) — `src/components/Auth/PendingAccess.tsx`

### Overlays / Tools
- Floor display — `/display` or `/display/:displayId` — `src/components/FloorDisplay/FloorDisplayView.tsx`
- Map renderer (embedded) — `src/components/Map/WarehouseMapNew.tsx`
- Barcode scanner overlay — `src/components/Scanner/BarcodeScanner.tsx`
- Mobile overlay wrapper — `src/components/Layout/MobileOverlay.tsx`

### Modals / Dialogs
- Inventory item detail — `src/components/Inventory/InventoryItemDetailDialog.tsx`
- Parts tracking dialog — `src/components/Inventory/PartsTrackingDialog.tsx`
- Item selection dialog — `src/components/Scanner/ItemSelectionDialog.tsx`
- Confirm dialog — `src/components/ui/confirm-dialog.tsx`

## Proposed Layering Order

1) **Root Shell**
   - App shell, navigation, global providers.

2) **Primary Page Layer**
   - Main nav pages (Dashboard, Inventory, Loads, Activity, Sessions, Settings, Map).

3) **Secondary Detail Layer**
   - Full-page detail screens that should replace primary content, but keep shell.
   - Example: Scanning session detail.

4) **Global Tool Overlays**
   - Context-preserving overlays invoked from anywhere.
   - Map (if treated as overlay), Scanning (barcode overlay), Mobile overlay shell.

5) **Modal / Dialog Layer**
   - Localized edits, confirmations, and small details.

6) **System / Blocking Layer**
   - Global toasts, pending access, auth interstitials, loading locks.

## Implementation Notes

- Layer tokens live in `src/lib/uiLayers.ts`.
- Tool overlays use `uiLayers.toolOverlay` for a consistent z-index.
- Modals remain on their default dialog layer.

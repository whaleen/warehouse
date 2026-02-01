# TypeScript Production Build Errors

**Date:** 2026-02-01
**Status:** ❌ BLOCKING PRODUCTION DEPLOYMENT
**Command:** `pnpm run build:prod`

## Critical Impact

Production builds fail with 49 TypeScript errors. This blocks Vercel deployments.

**Why dev works but prod fails:**
- Dev server (`pnpm dev`) is more lenient with type checking
- Production build (`pnpm run build:prod`) enforces strict TypeScript compilation
- Vercel uses `build:prod` command, so deployments will fail

---

## Error Categories

### 1. Type Import Errors (2 errors)

**Issue:** Need to use `type` keyword for type-only imports when `verbatimModuleSyntax` is enabled.

**Files:**
- `src/components/assistant-ui/attachment.tsx:3`
- `src/components/assistant-ui/tooltip-icon-button.tsx:3`

**Fix:**
```typescript
// Before
import { PropsWithChildren, useEffect, useState, type FC } from "react";
import { ComponentPropsWithRef, forwardRef } from "react";

// After
import { type PropsWithChildren, useEffect, useState, type FC } from "react";
import { type ComponentPropsWithRef, forwardRef } from "react";
```

---

### 2. Null Handling Errors (35+ errors)

**Issue:** `locationId` and `companyId` from context can be `string | null`, but functions expect `string`.

**Pattern:** This error repeats across many files in hooks and components.

**Affected Files:**
- `src/components/Inventory/LoadDetailPanel.tsx` (8 errors - lines 241, 242, 445, 446, 585, 586, 619, 620)
- `src/hooks/queries/useActivity.ts:13`
- `src/hooks/queries/useLoads.ts` (10 errors - lines 20, 21, 31, 42, 65, 86, 87, 108, 109, 118)
- `src/hooks/queries/useParts.ts` (22 errors - lines 21, 30, 55, 56, 59, 73, 78, 79, 92, 93, 96, 112, 117, 118, 139, 140, 153, 154, 173, 174, 183, 192)

**Example Error:**
```
src/hooks/queries/useLoads.ts:20:32 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
  Type 'null' is not assignable to type 'string'.

20       ? queryKeys.loads.byType(locationId, inventoryType)
                                  ~~~~~~~~~~
```

**Root Cause:**
The app context provides `locationId` and `companyId` as nullable, but query keys and activity log functions expect non-null strings.

**Fix Options:**

**Option A: Guard at hook level** (safest)
```typescript
// In each hook
const { locationId } = useLocation();
if (!locationId) {
  throw new Error('Location ID required');
}
// Now locationId is guaranteed to be string
```

**Option B: Update query key functions to accept null**
```typescript
// In src/lib/queryKeys.ts
loads: {
  all: (locationId: string | null) => ['loads', locationId] as const,
  // ...
}
```

**Option C: Type assertion** (quick but risky)
```typescript
queryKeys.loads.all(locationId!)
```

**Recommended:** Option A - Add guards at the top of hooks/components that require locationId.

---

### 3. Duplicate Key Error (1 error)

**File:** `src/hooks/queries/useDashboard.ts:43`

**Error:**
```
src/hooks/queries/useDashboard.ts:43:5 - error TS1117: An object literal cannot have multiple properties with the same name.

43     enabled: !!locationId,
       ~~~~~~~
```

**Fix:** Remove the duplicate `enabled` key (one of them is redundant).

---

### 4. Agent Client Errors (5 errors)

**File:** `src/lib/agent/client.ts`

**Errors:**

1. **Line 154:** Unknown property `tool_call_id`
```typescript
// Error
tool_call_id: toolCall.id,

// This property doesn't exist in the type definition
```

2. **Line 225:** Cannot find name `processResponse`
```typescript
content = await processResponse(content, enableSQL);
// Function doesn't exist or isn't imported
```

3. **Line 287:** Type mismatch - array assigned to string
```typescript
content: [{
  type: string;
  tool_use_id: any;
  content: string;
}[]]
// Expected: string
// Got: array
```

**Context:** These are in the agent/client integration code. May be from incomplete refactoring or missing imports.

---

### 5. Type Comparison Errors (2 errors)

**Files:**
- `src/components/Map/WarehouseMapNew.tsx:54`
- `src/lib/agent/ai-sdk-runtime.ts:85`

**Error 1:**
```typescript
// src/components/Map/WarehouseMapNew.tsx:54
const allSessions = sessionSummariesQuery.data?.filter(s => s.status === 'active' || s.status === 'open') ?? [];

// Error: types '"closed" | "draft"' and '"open"' have no overlap
// The status type doesn't include 'active' or 'open'
```

**Error 2:**
```typescript
// src/lib/agent/ai-sdk-runtime.ts:85
} else if (provider === 'google' || provider === 'gemini') {

// Error: types '"groq" | "gemini"' and '"google"' have no overlap
// The provider type doesn't include 'google'
```

**Fix:** Update type definitions to include the actual values being used, or remove invalid comparisons.

---

## Full Error Log

<details>
<summary>Click to expand complete error output</summary>

```
src/components/assistant-ui/attachment.tsx:3:10 - error TS1484: 'PropsWithChildren' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.

src/components/assistant-ui/tooltip-icon-button.tsx:3:10 - error TS1484: 'ComponentPropsWithRef' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.

src/components/Inventory/LoadDetailPanel.tsx:241:13 - error TS2322: Type 'string | null' is not assignable to type 'string'.
src/components/Inventory/LoadDetailPanel.tsx:242:13 - error TS2322: Type 'string | null' is not assignable to type 'string'.
src/components/Inventory/LoadDetailPanel.tsx:445:11 - error TS2322: Type 'string | null' is not assignable to type 'string'.
src/components/Inventory/LoadDetailPanel.tsx:446:11 - error TS2322: Type 'string | null' is not assignable to type 'string'.
src/components/Inventory/LoadDetailPanel.tsx:585:11 - error TS2322: Type 'string | null' is not assignable to type 'string'.
src/components/Inventory/LoadDetailPanel.tsx:586:11 - error TS2322: Type 'string | null' is not assignable to type 'string'.
src/components/Inventory/LoadDetailPanel.tsx:619:11 - error TS2322: Type 'string | null' is not assignable to type 'string'.
src/components/Inventory/LoadDetailPanel.tsx:620:11 - error TS2322: Type 'string | null' is not assignable to type 'string'.

src/components/Map/WarehouseMapNew.tsx:54:88 - error TS2367: This comparison appears to be unintentional because the types '"closed" | "draft"' and '"open"' have no overlap.

src/hooks/queries/useActivity.ts:13:38 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.

src/hooks/queries/useDashboard.ts:43:5 - error TS1117: An object literal cannot have multiple properties with the same name.

src/hooks/queries/useLoads.ts:20:32 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useLoads.ts:21:29 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useLoads.ts:31:38 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useLoads.ts:42:37 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useLoads.ts:65:69 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useLoads.ts:86:69 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useLoads.ts:87:73 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useLoads.ts:108:69 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useLoads.ts:109:73 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useLoads.ts:118:41 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.

src/hooks/queries/useParts.ts:21:39 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:30:38 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:55:75 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:56:99 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:59:33 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:73:58 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:78:73 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:79:72 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:92:74 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:93:88 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:96:32 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:112:57 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:117:73 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:118:72 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:139:73 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:140:72 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:153:73 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:154:72 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:173:73 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:174:72 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:183:39 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/hooks/queries/useParts.ts:192:41 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.

src/lib/agent/ai-sdk-runtime.ts:85:16 - error TS2367: This comparison appears to be unintentional because the types '"groq" | "gemini"' and '"google"' have no overlap.

src/lib/agent/client.ts:154:9 - error TS2353: Object literal may only specify known properties, and 'tool_call_id' does not exist in type '{ role: string; content: string; }'.

src/lib/agent/client.ts:225:21 - error TS2304: Cannot find name 'processResponse'.

src/lib/agent/client.ts:287:7 - error TS2322: Type '{ type: string; tool_use_id: any; content: string; }[]' is not assignable to type 'string'.

Found 49 errors.
```

</details>

---

## Marketing Site Errors (1 error)

**File:** `marketing-site/src/components/Marketing/FeaturesPage.tsx:30`

**Error:**
```
Type '{ onRequestAccess: () => void; }' is not assignable to type 'IntrinsicAttributes'.
Property 'onRequestAccess' does not exist on type 'IntrinsicAttributes'.

30       <PageHeader onRequestAccess={() => setShowEarlyAccess(true)} />
                     ~~~~~~~~~~~~~~~
```

**Issue:** `PageHeader` component type definition doesn't include `onRequestAccess` prop.

**Fix:** Add prop to PageHeader component type definition:
```typescript
// In PageHeader component
interface PageHeaderProps {
  onRequestAccess: () => void;
}

export function PageHeader({ onRequestAccess }: PageHeaderProps) {
  // ...
}
```

---

## Action Items

### Priority 1: Quick Fixes (< 5 minutes)
- [ ] Fix type imports (2 files)
- [ ] Remove duplicate key in useDashboard.ts
- [ ] Fix agent client errors (check imports, remove invalid code)

### Priority 2: Null Handling (30-60 minutes)
- [ ] Add guards in hooks for `locationId` (recommended approach)
- [ ] Or update query key functions to accept null
- [ ] Update activity log type to accept nullable IDs

### Priority 3: Type Definitions (15 minutes)
- [ ] Update session status type to include 'active' and 'open'
- [ ] Update provider type to include 'google'

---

## Workaround for Testing

To continue build testing without fixing errors, you can:

1. **Temporarily disable type checking in production build:**
```json
// package.json
"build:prod": "vite build"  // Skip tsc -b
```

2. **Or use lenient TypeScript config for build:**
```json
// tsconfig.json
"skipLibCheck": true,
"noEmitOnError": false
```

**⚠️ DO NOT deploy to production with type errors** - fix them first.

---

## Next Steps

1. Complete build testing for other services (marketing site, ge-sync)
2. Create separate task to fix all TypeScript errors
3. Re-run production build to verify fixes
4. Deploy to Vercel once build passes

---

## Related Files

- Build command: `package.json` line 9 (`build:prod`)
- TypeScript config: `tsconfig.json`
- Vercel config: `vercel.json` (uses `build:prod`)

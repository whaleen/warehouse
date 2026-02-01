# Database Schema Analysis & Overhaul Plan

## 1. Objective

The goal of this analysis is to perform a deep dive into the current Supabase database schema to assess its fitness for the application's evolved needs. We will identify areas for improvement, propose a more efficient table structure, and ensure the database is optimized to meet the demands of the user interface and core business logic.

## 2. Current Schema Overview

The database is a comprehensive system for multi-tenant warehouse management. The schema can be broadly categorized into several domains:

*   **Core Inventory:** `products` (the master catalog), `inventory_items` (serialized units), `inventory_counts` (non-serialized stock), and `tracked_parts`.
*   **Location & Mapping:** `locations`, `beacons`, `product_location_history`, and `scanning_sessions`. This forms a sophisticated system for tracking items within a physical space.
*   **Logistics:** `deliveries`, `trucks`, and `customers`.
*   **Data Integrity & Sync:** `ge_changes`, `inventory_conflicts`, `load_conflicts`, and `load_metadata`. These tables are critical for handling data synchronization with an external system (presumably GE).
*   **User & Tenant Management:** `users`, `profiles`, `companies`, `locations`.

The `inventory_items` table is central to the entire schema and appears to be the primary source of complexity, containing many columns for status, external system state (GE fields), and relationships.

## 3. UI Data Requirements

An analysis of the `src/components` directory suggests the following data dependencies for key UI features:

*   **Dashboard:** Requires aggregated data from multiple tables (e.g., total inventory value, number of pending deliveries, recent activity).
*   **Inventory & Parts:** Needs to perform complex filtering, sorting, and searching on `inventory_items` and `products`. It likely joins these tables to display comprehensive information. The UI must distinguish between serialized items (`inventory_items`) and bulk parts (`inventory_counts` + `tracked_parts`).
*   **Map:** This is a read-heavy feature that needs to efficiently query `product_location_history` to render the real-time or historical position of thousands of items.
*   **Scanner & Session:** These components perform write-heavy operations, creating and updating `scanning_sessions` and `product_location_history` in near real-time.
*   **Products:** A browse/search interface for the `products` table.
*   **Floor Display:** Reads from `floor_displays`, which contains a `state_json` blob, suggesting it might be a bottleneck or a candidate for normalization if its query requirements have become more complex.

## 4. Key Investigation Areas

This section contains the core questions and hypotheses for the audit.

### 4.1. The `inventory_items` Table
This table has grown to serve many purposes. We need to investigate if it should be broken down.

*   **Question:** Is the single `inventory_items` table too monolithic? It contains fields for deliveries, GE sync status, location, scanning, and product details.
*   **Hypothesis:** We could improve performance and clarity by splitting `inventory_items` into more specialized tables. For example:
    *   `serialized_stock` (core inventory data: serial, product_fk, location_id)
    *   `item_ge_sync_state` (all `ge_*` fields, linking back to `serialized_stock`)
    *   `item_delivery_assignment` (linking stock to deliveries)
*   **Analysis:** Analyze the query patterns for `inventory_items`. How many queries only need a subset of the columns? Are there frequent updates to only specific columns (like `ge_*` fields)?

### 4.2. Products vs. Parts
The distinction between general products and tracked parts seems to be handled through `products.is_part` and the `tracked_parts` table.

*   **Question:** Is the current model for differentiating parts from products clear and efficient? The logic seems spread across multiple tables and boolean flags.
*   **Hypothesis:** A cleaner approach might use table inheritance or a more explicit, single-source-of-truth structure. For example, having `parts` and `appliances` tables that extend a base `products` table.
*   **Analysis:** Review `partsManager.ts` and `usePartsListView.ts` to understand how the app currently queries for and distinguishes these two concepts.

### 4.3. JSONB Usage
Several tables (`floor_displays`, `products`, `scanning_sessions`) use `jsonb` columns. While flexible, this can be a sign that the schema has not kept pace with feature development.

*   **Question:** Are the `state_json` in `floor_displays` and `specs` in `products` being queried against? If so, should those fields be normalized into proper columns or tables?
*   **Hypothesis:** The `items` array in `scanning_sessions` should be a separate `scanned_items` table, with foreign keys back to the session and the inventory item. This would make querying individual scanned items far more efficient.
*   **Analysis:** Search the codebase for queries that access the contents of these `jsonb` columns in `WHERE` clauses or joins.

### 4.4. Data for the Map
The `Map` feature is critical and performance-sensitive.

*   **Question:** How efficient is it to get the "current" location of all items? The `product_location_history` table is an append-only log.
*   **Hypothesis:** We may need a separate table, `current_product_locations`, that is updated via a trigger on `product_location_history`. This would make reads for the map instantaneous, at the cost of slightly slower writes. This is a common pattern for "latest-distinct-on" queries.
*   **Analysis:** Review `mapManager.ts` to see how it currently queries for location data. Is it already using a view or function, or is it performing a complex query every time?

## 5. Proposed Action Plan

1.  **Validate UI Requirements:** For each "Key Investigation Area" above, confirm the exact data requirements by reviewing the relevant UI components and TanStack Query hooks (`src/hooks/queries`).
2.  **Analyze Query Performance:** Use the Supabase query performance tools to identify the slowest and most frequent queries currently running in production. Cross-reference these with the investigation areas.
3.  **Propose New Schema:** Based on the findings, draft a new `schema.sql` V2. This schema should exist in parallel for review.
4.  **Develop Migration Plan:** Write the SQL scripts necessary to migrate the data from the old schema to the new one without data loss.
5.  **Update Application Code:** Identify all the "manager" files (`src/lib/*Manager.ts`) and hooks that will need to be updated to work with the new schema. Create a branch to implement these changes.

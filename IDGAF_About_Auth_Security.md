---

# IDGAF About Security – Auth Implementation

> ⚠️ **Warning:** This authentication implementation is **insecure by design**. Do **not** use in production. This is purely for prototyping/testing.

---

## Overview

This app implements a **minimal username/password authentication system** using Supabase as a database.

* No Supabase Auth, OAuth, or external providers.
* Passwords are stored in **plaintext**.
* Row Level Security (RLS) is intentionally wide open.
* The goal is to **get something working fast**.

---

## Users Table

The `users` table contains the following fields:

| Field      | Type | Notes               |
| ---------- | ---- | ------------------- |
| `id`       | text | Unique user ID      |
| `username` | text | Login username      |
| `password` | text | Stored in plaintext |
| `image`    | text | Public avatar URL   |

Example SQL seed:

```sql
INSERT INTO "public"."users" ("id", "username", "password", "image") VALUES
('1', 'josh', '1234', 'https://example.com/avatar1.png'),
('2', 'jose', '1234', 'https://example.com/avatar2.png');
```

---

## Row Level Security (RLS)

For prototyping, RLS is **wide open**:

```sql
-- Allow anyone to select users
create policy "allow anon select users"
on public.users
for select
using (true);

-- Allow anyone to update their user record (prototype only)
create policy "allow anon update users"
on public.users
for update
using (true)
with check (true);
```

> Note: `INSERT`/`DELETE` not restricted either.

---

## AuthContext

A React Context (`AuthContext`) manages authentication state:

### State

* `user: User | null` → currently logged-in user
* `loading: boolean` → true while checking localStorage
* `login(username, password)` → logs in the user
* `logout()` → logs out the user
* `updateUser(updates)` → updates the user row in Supabase

### Login flow

1. Query Supabase `users` table by username.
2. Compare plaintext password.
3. If correct:

   * Save full user object to state
   * Save full user object to `localStorage`
4. If incorrect → return false.

Example:

```ts
const login = async (username: string, password: string) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, username, password, image")
    .eq("username", username)
    .single();

  if (error || !data) return false;
  if (data.password !== password) return false;

  setUser(data);
  localStorage.setItem("user", JSON.stringify(data));
  return true;
};
```

---

## Settings Page Integration

* Users can **edit username and password** directly.
* Users can **upload an avatar image** to Supabase Storage.
* Updates are pushed immediately to Supabase via `updateUser()` and reflected in state.

---

## AppHeader

* Shows avatar and username from `AuthContext.user`.
* If no image exists, shows default icon.
* Menu contains:

  * Theme toggle
  * Settings link
  * Logout button

---

## Notes

* **Passwords are plaintext**.
* **No authentication tokens**.
* **RLS policies allow any client to read/write users**.
* Suitable for prototypes, demos, and internal testing only.
* When moving to production, replace with:

  * Supabase Auth / OAuth / hashed passwords
  * Proper RLS policies
  * Validation and encryption

---

## TL;DR

> We wanted **working auth fast**, not security.
> Users are stored in plaintext. RLS is open. All updates go straight to the database. Login is done entirely client-side with state + localStorage.

**Perfectly fine for “IDGAF” mode.**

---

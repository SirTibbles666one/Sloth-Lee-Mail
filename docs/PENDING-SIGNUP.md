# Signup without codes: request, then approve

Registration stops asking for a code. A new account is created in a **pending**
state, cannot log in, and appears in the admin panel for approval.

## Why a sidecar, not a field

`users.bin` is bincode and positional: adding a field to `struct User` makes
every existing record unreadable. Pending state lives in
`data/pending_users.json`, keyed by lowercase username:

    { "alice": { "requested_at": 1761..., "ip": "1.2.3.4" } }

Deleting the entry *is* the activation — there is no second flag to keep in sync.

## Server

1. `src/core/pending_users.rs` — `add`, `contains`, `list`, `remove`, `load`,
   `save`. Same guard style as `signup_ip`.
2. `user.rs` register — replace the invite-code gate with `pending_users::add`,
   and return `202 {"pending": true}` with **no session token**.
3. `auth.rs` `login` — after the password check and **before** any token is
   issued: if `pending_users::contains(username)` return
   `403 account_pending` / "Your account is waiting for approval".
   Order matters: a token issued before this check is an approved account.
4. `admin.rs` — `GET /api/admin/pending`, `POST /api/admin/pending/approve`
   (`{username}`), both Admin-only. Approve removes the sidecar entry and logs
   it: `[Admin] Approved account '<username>'`.

## Client

- Signup: on `202`, show "Your account is waiting for approval — you can sign in
  once it's accepted." Do not redirect to login.
- Login: on `403 account_pending`, show that sentence instead of "wrong password".
  Never let a pending user think their password is wrong.
- Admin panel: a **Pending accounts** list, one Approve button per row, with the
  request time and address so abuse is visible.

## Proof bar

Sign up with no code → login refused as pending (not as bad password) → approve
in the panel → login succeeds. Anything short of that four-step sequence does not
prove it, because two of the three failure modes look identical from outside.

## Keep the anti-abuse work

Proof of work still prices each signup, and the per-address limit still applies
when enabled. Removing the code must not remove the cost of registering.

# Frontend Auth Integration Guide

How to implement sign-up, sign-in (login) and sign-out (logout) against this API.

## Base

- Base path: `/api/auth`
- All request bodies, query strings, and response bodies use **camelCase** (converted to/from the DB's snake_case by server middleware — send/receive camelCase only, never snake_case).
- Content-Type: `application/json`

## Token model

- **Access token**: short-lived JWT (`JWT_ACCESS_EXPIRES_IN`, default 15m). Send it on every protected request as `Authorization: Bearer <accessToken>`.
- **Refresh token**: longer-lived JWT (`JWT_REFRESH_EXPIRES_IN`, default 7d). Used only to mint a new token pair via `/refresh-token`. It is **rotated** on every refresh — the old refresh token is invalidated the moment a new one is issued, so a refresh token can only be used once.
- The server does not set cookies. Both tokens are returned in the JSON body; the frontend is responsible for storing them.

### Storage recommendation

- Keep `accessToken` in memory (JS variable / state store), not localStorage, to limit XSS exposure.
- `refreshToken` has to live somewhere that survives a page reload (localStorage, or a secure cookie set by your own frontend server) since it's returned in the body, not as an httpOnly cookie. If you control a backend-for-frontend layer, prefer moving it into an httpOnly cookie there.

## Endpoints

### Sign up — `POST /api/auth/sign-up`

Request body:
```json
{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "password": "secret123",
  "phone": "0900000000"
}
```
`phone` is optional.

Response `201`:
```json
{
  "user": {
    "id": 1,
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "phone": "0900000000",
    "avatarUrl": null,
    "role": "user",
    "status": "active",
    "createdAt": "2026-07-13T00:00:00.000Z",
    "updatedAt": "2026-07-13T00:00:00.000Z"
  },
  "accessToken": "...",
  "refreshToken": "..."
}
```

Error `409`: email already registered — `{ "message": "Email already in use" }`.

### Sign in (login) — `POST /api/auth/sign-in`

Request body:
```json
{ "email": "jane@example.com", "password": "secret123" }
```

Response `200`: same shape as sign-up (`user`, `accessToken`, `refreshToken`).

Error `401`: wrong email or password — `{ "message": "Invalid email or password" }`.

### Refresh token — `POST /api/auth/refresh-token`

Call this when a protected request comes back `401` because the access token expired.

Request body:
```json
{ "refreshToken": "..." }
```

Response `200`:
```json
{ "accessToken": "...", "refreshToken": "..." }
```
Store both — the refresh token has changed and the old one is now dead.

Error `401`: refresh token invalid, expired, or already used — `{ "message": "Invalid or expired refresh token" }`. Treat this as a hard logout (see below).

### Sign out (logout) — `POST /api/auth/sign-out`

Request body:
```json
{ "refreshToken": "..." }
```

Response: `204 No Content`. Revokes the refresh token server-side. Always clear local `accessToken`/`refreshToken` state regardless of the response.

## Calling protected routes

Any route under `requireAuth` (e.g. `/api/devices`) needs the access token:
```
Authorization: Bearer <accessToken>
```
Missing/invalid/expired token → `401 { "message": "..." }`.

## Suggested client flow

```js
let accessToken = null; // in-memory
let refreshToken = localStorage.getItem('refreshToken'); // survives reload

async function login(email, password) {
  const res = await fetch('/api/auth/sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).message);

  const data = await res.json();
  accessToken = data.accessToken;
  refreshToken = data.refreshToken;
  localStorage.setItem('refreshToken', refreshToken);
  return data.user;
}

async function logout() {
  if (refreshToken) {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {}); // best-effort; clear local state regardless
  }
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('refreshToken');
}

async function apiFetch(url, options = {}) {
  const doFetch = (token) =>
    fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await doFetch(accessToken);

  if (res.status === 401 && refreshToken) {
    const refreshRes = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!refreshRes.ok) {
      await logout(); // refresh token dead -> force re-login
      throw new Error('Session expired, please sign in again');
    }

    const tokens = await refreshRes.json();
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    localStorage.setItem('refreshToken', refreshToken);

    res = await doFetch(accessToken); // retry original request once
  }

  return res;
}
```

## Sign-up flow note

`sign-up` already returns a token pair, so a new account is logged in immediately — no separate login call needed after registration.

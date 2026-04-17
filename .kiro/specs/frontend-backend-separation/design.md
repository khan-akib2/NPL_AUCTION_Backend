# Design Document: Frontend-Backend Separation

## Overview

This design covers the mechanical steps to split the current monolithic repo into two self-contained apps:

- `frontend/` — pure Next.js app, deployable to Vercel
- `backend/` — standalone Express + Socket.IO server, deployable to Railway/Render/Fly.io

The backend already exists and is nearly complete. The bulk of the work is moving the frontend source tree, deleting the duplicate Next.js API routes and lib files, and updating the handful of files that hardcode relative API paths.

A root `package.json` provides `concurrently`-based scripts for local development.

---

## Architecture

```
repo root/
├── frontend/          ← Next.js app (Vercel)
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── next.config.mjs
│   ├── postcss.config.mjs
│   ├── jsconfig.json
│   ├── eslint.config.mjs
│   ├── .env.local          (gitignored)
│   └── .env.example
├── backend/           ← Express + Socket.IO (Railway/Render)
│   ├── server.js
│   ├── routes/
│   ├── models/
│   ├── lib/
│   ├── uploads/            (gitignored, .gitkeep present)
│   ├── package.json
│   ├── .env                (gitignored)
│   └── .env.example
├── package.json       ← monorepo root (concurrently scripts only)
└── .gitignore
```

Communication flow:

```
Browser
  │
  ├─ HTTP fetch ──────────────────► backend:4000  /api/*
  │                                    │
  └─ Socket.IO (ws/polling) ──────────►│  path: /api/socket
                                       │
                                    MongoDB Atlas
```

The frontend has zero server-side logic after separation. All business logic, DB access, and real-time broadcasting live exclusively in the backend.

---

## Components and Interfaces

### Backend (unchanged structure, minor additions)

| File | Change |
|---|---|
| `backend/server.js` | Add `express.static` for `uploads/`, add missing `seed` route, add startup env validation |
| `backend/routes/upload.js` | Change uploads dir from `backend/public/uploads` → `backend/uploads` |
| `backend/routes/seed.js` | Create (currently missing, referenced in server.js) |
| `backend/package.json` | Add `multer` to dependencies |

### Frontend (moved + modified)

| File | Change |
|---|---|
| `src/` → `frontend/src/` | Move entire source tree |
| `public/` → `frontend/public/` | Move public assets |
| `*.config.*`, `jsconfig.json` → `frontend/` | Move Next.js config files |
| `frontend/src/hooks/useApi.js` | Prepend `NEXT_PUBLIC_BACKEND_URL` to all paths |
| `frontend/src/context/SocketContext.jsx` | Connect to `NEXT_PUBLIC_BACKEND_URL` with path `/api/socket` |
| `frontend/src/app/login/page.jsx` | Use backend URL for auth fetch |
| `frontend/src/app/admin/players/page.jsx` | PhotoUpload uses backend URL |
| `frontend/src/app/audience/page.jsx` | Use backend URL for fetch and socket |

### Files to Delete

| Path | Reason |
|---|---|
| `server.js` (root) | Replaced by `backend/server.js` |
| `server/` (root folder) | Dead leftover, no source files |
| `src/app/api/` (entire tree) | Replaced by `backend/routes/` |
| `src/lib/models/` | Duplicate of `backend/models/` |
| `src/lib/mongodb.js` | Duplicate of `backend/lib/mongodb.js` |
| `src/lib/auth.js` | Duplicate of `backend/lib/auth.js` |
| `src/lib/socket-server.js` | Socket.IO now lives only in backend |
| `.env.local` (root) | Values distributed to `backend/.env` and `frontend/.env.local` |

---

## Data Models

No schema changes. All Mongoose models remain in `backend/models/` unchanged. The frontend never imports models directly — it only consumes JSON from the backend API.

Environment variable distribution:

| Variable | Backend `.env` | Frontend `.env.local` |
|---|---|---|
| `MONGODB_URI` | ✓ | — |
| `JWT_SECRET` | ✓ | — |
| `SEED_SECRET` | ✓ | — |
| `PORT` | ✓ (default 4000) | — |
| `FRONTEND_URL` | ✓ (for CORS) | — |
| `BACKEND_URL` | ✓ (for upload URL construction) | — |
| `NEXT_PUBLIC_BACKEND_URL` | — | ✓ |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: useApi always constructs full URLs with auth header

*For any* API path string and any valid JWT token, calling `useApi.request(path)` should call `fetch` with a URL that starts with `NEXT_PUBLIC_BACKEND_URL`, contains the path without double slashes, and includes an `Authorization: Bearer <token>` header.

**Validates: Requirements 3.4, 4.4, 4.5**

### Property 2: File upload lands in backend/uploads

*For any* valid image file (varying name, extension, and size within the 5 MB limit), a `POST /api/upload` request should result in the file being stored in the `backend/uploads/` directory with a generated filename, and the response URL should start with `BACKEND_URL` and contain `/uploads/`.

**Validates: Requirements 8.2, 8.3**

---

## Error Handling

### Backend startup validation

`backend/server.js` must validate required env vars before starting. If any are missing, log a descriptive error and exit:

```js
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
```

`SEED_SECRET` and `FRONTEND_URL` are optional — warn but don't exit if absent.

### Socket.IO connection failures

`SocketContext.jsx` already has `reconnectionAttempts: 5` and a `connect_error` handler. After separation the only change is the host URL — the degraded-mode behavior is preserved.

### CORS

`backend/server.js` already has a dynamic CORS origin check. `FRONTEND_URL` env var is used to allow the production Vercel domain. The regex `/.vercel.app$/` covers preview deployments.

### Upload errors

Multer's `fileFilter` rejects non-image types. The 5 MB `limits.fileSize` is already set. The route returns `400` if no file is provided.

---

## Testing Strategy

This feature is primarily structural (file moves, config changes, deletion of duplicates). The two correctness properties above are the only areas with meaningful logic variation.

**Property-based tests** (use [fast-check](https://github.com/dubzzz/fast-check) for JavaScript):

- **Property 1** — `useApi` URL construction: generate arbitrary path strings (with/without leading slash, with query params, empty segments) and arbitrary token strings. Mock `fetch` and assert the called URL and headers. Minimum 100 iterations.
  - Tag: `Feature: frontend-backend-separation, Property 1: useApi constructs full URLs with auth header`

- **Property 2** — Upload file storage: generate arbitrary filenames and image buffers (within size limit). Mock multer's disk storage and assert destination path and URL format. Minimum 100 iterations.
  - Tag: `Feature: frontend-backend-separation, Property 2: file upload lands in backend/uploads`

**Example-based unit tests:**

- `GET /health` returns `{ status: 'ok' }` with 200
- `SocketContext` calls `io()` with the correct host and `path: '/api/socket'`
- Upload response URL format: `${BACKEND_URL}/uploads/<filename>`
- `useApi` with no token omits the `Authorization` header

**Smoke checks** (run once after migration, not in CI):

- Required files exist in `frontend/` and `backend/`
- `src/app/api/` is absent from `frontend/`
- `src/lib/models/`, `src/lib/mongodb.js`, `src/lib/auth.js` are absent from `frontend/`
- `frontend/package.json` has no `express`, `cors`, `multer` deps
- `backend/package.json` has no `next` dep
- `.env.example` files exist in both `frontend/` and `backend/`

**Integration tests** (require running services):

- `npm install` in `frontend/` and `backend/` succeeds in isolation
- Backend starts on `PORT=4001` (alternate port to avoid conflicts)
- Socket event round-trip: emit `auction:bid_update` from server, verify client receives it

---

## Key File Contents

### `frontend/src/hooks/useApi.js`

```js
'use client';
import { useAuth } from '@/context/AuthContext';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export function useApi() {
  const { token, logout } = useAuth();

  const request = async (path, options = {}) => {
    // Avoid double slashes: strip leading slash from path since BACKEND_URL has no trailing slash
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${BACKEND_URL}${normalizedPath}`;

    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (res.status === 401) { logout(); return null; }
    return res.json();
  };

  return { request };
}
```

### `frontend/src/context/SocketContext.jsx`

```jsx
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = io(BACKEND_URL, {
      path: '/api/socket',
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    s.on('connect_error', (err) => {
      console.warn('Socket connection failed:', err.message);
    });

    setSocket(s);
    return () => s.disconnect();
  }, []);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
```

### `frontend/src/app/login/page.jsx` — diff

```diff
- const res = await fetch('/api/auth/login', {
+ const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
+ const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
```

### `frontend/src/app/admin/players/page.jsx` — PhotoUpload diff

```diff
- const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
+ const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
+ const res = await fetch(`${BACKEND_URL}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
```

### `frontend/src/app/audience/page.jsx` — diff

```diff
+ const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

- const fetchTeams = () =>
-   fetch('/api/teams-public').then(r => r.json()).then(d => setTeams(d.teams || []));
+ const fetchTeams = () =>
+   fetch(`${BACKEND_URL}/api/teams-public`).then(r => r.json()).then(d => setTeams(d.teams || []));

  // In the initial useEffect:
- fetch('/api/auction/active-public').then(r => r.json()),
+ fetch(`${BACKEND_URL}/api/auction/active-public`).then(r => r.json()),

  // In the polling interval:
- fetch('/api/auction/active-public').then(r => r.json()),
+ fetch(`${BACKEND_URL}/api/auction/active-public`).then(r => r.json()),

  // Socket connection:
- const s = io({ path: '/api/socket', transports: ['polling'] });
+ const s = io(BACKEND_URL, { path: '/api/socket', transports: ['polling'] });
```

### `backend/server.js` — additions

```diff
+ const path = require('path');

  // After app.use(express.json(...)):
+ // Serve uploaded player photos
+ app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Add seed route (currently missing):
+ app.use('/api/seed', require('./routes/seed'));

  // Startup env validation (before mongoose.connect):
+ const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
+ const missing = REQUIRED_ENV.filter(k => !process.env[k]);
+ if (missing.length) {
+   console.error(`Missing required environment variables: ${missing.join(', ')}`);
+   process.exit(1);
+ }
```

### `backend/routes/upload.js` — diff

```diff
- const uploadsDir = path.join(__dirname, '../public/uploads');
+ const uploadsDir = path.join(__dirname, '../uploads');
```

### Root `package.json`

```json
{
  "name": "nit-auction-monorepo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently -n frontend,backend -c cyan,yellow \"npm run dev --prefix frontend\" \"npm run dev --prefix backend\"",
    "install:all": "npm install --prefix frontend && npm install --prefix backend"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

### `frontend/package.json`

```json
{
  "name": "nit-auction-frontend",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "jsonwebtoken": "^9.0.3",
    "next": "16.2.3",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "babel-plugin-react-compiler": "1.0.0",
    "eslint": "^9",
    "eslint-config-next": "16.2.3",
    "tailwindcss": "^4"
  }
}
```

### `backend/package.json` — updated

```json
{
  "name": "nit-auction-backend",
  "version": "1.0.0",
  "private": true,
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^9.4.1",
    "multer": "^1.4.5-lts.1",
    "socket.io": "^4.8.3"
  },
  "devDependencies": {
    "nodemon": "^3.1.4"
  }
}
```

### `backend/.env.example`

```
PORT=4000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/nit_auction
JWT_SECRET=change_me
SEED_SECRET=change_me
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000
```

### `frontend/.env.example`

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

### `frontend/.env.local`

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

---

## Deployment Notes

### Vercel (Frontend)

1. Set root directory to `frontend/` in Vercel project settings.
2. Add environment variable: `NEXT_PUBLIC_BACKEND_URL=https://<your-backend-domain>`.
3. Build command: `npm run build`. Output: `.next`.
4. No custom server — pure Next.js serverless.

### Railway / Render / Fly.io (Backend)

1. Set root directory to `backend/`.
2. Start command: `npm start`.
3. Set environment variables: `MONGODB_URI`, `JWT_SECRET`, `SEED_SECRET`, `FRONTEND_URL` (Vercel domain), `BACKEND_URL` (this service's public URL), `PORT` (platform sets this automatically on Railway/Render).
4. The `uploads/` directory is ephemeral on most platforms — for production, replace multer disk storage with S3/Cloudflare R2 (out of scope for this separation task).

### CORS

`backend/server.js` already allows `FRONTEND_URL` env var and the `*.vercel.app` regex. Set `FRONTEND_URL` to the exact Vercel production URL to lock it down.

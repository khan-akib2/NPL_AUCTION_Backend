# Requirements Document

## Introduction

The project currently has a Next.js frontend and an Express backend that are entangled at the root level. Both share a single `package.json`, the root `server.js` bootstraps Next.js with an embedded Socket.IO server, and there are duplicate model and lib files split between `src/lib/` (ESM, used by Next.js API routes) and `backend/` (CJS, used by Express). The `backend/` folder already contains a nearly complete, standalone Express server but is not yet the authoritative backend.

This feature cleanly separates the project into two self-contained applications:

- `frontend/` — the Next.js app with its own `package.json`, config files, and source tree
- `backend/` — the Express + Socket.IO server (already partially isolated) with its own `package.json` and source tree

After separation, the frontend communicates with the backend exclusively through HTTP API calls and a Socket.IO connection. The Next.js API routes (`src/app/api/`) are removed in favour of the Express routes already in `backend/routes/`. A root-level `package.json` provides convenience scripts to run both apps together during development.

---

## Glossary

- **Frontend**: The Next.js application responsible for rendering the UI and making HTTP/WebSocket requests to the Backend.
- **Backend**: The Express + Socket.IO server responsible for all business logic, database access, and real-time event broadcasting.
- **Root**: The repository root directory (parent of `frontend/` and `backend/`).
- **Next.js API Routes**: The route handlers under `src/app/api/` that currently duplicate Backend logic.
- **Shared Models**: Mongoose model files that currently exist in both `src/lib/models/` and `backend/models/`.
- **Shared Lib**: Utility files (`auth.js`, `mongodb.js`) that currently exist in both `src/lib/` and `backend/lib/`.
- **Socket_Server**: The Socket.IO server instance running inside the Backend.
- **Socket_Client**: The Socket.IO client running inside the Frontend (`src/context/SocketContext.jsx`).
- **Monorepo_Root**: The root `package.json` that orchestrates both apps.
- **BACKEND_URL**: An environment variable consumed by the Frontend to locate the Backend's base URL.

---

## Requirements

### Requirement 1: Backend is a Self-Contained Application

**User Story:** As a developer, I want the Express backend to be fully self-contained in the `backend/` directory, so that it can be developed, tested, and deployed independently of the frontend.

#### Acceptance Criteria

1. THE Backend SHALL contain all source files it needs to run (`server.js`, `routes/`, `models/`, `lib/`) within the `backend/` directory.
2. THE `backend/package.json` SHALL declare all runtime dependencies required by the Backend (express, mongoose, socket.io, cors, bcryptjs, jsonwebtoken, dotenv, multer).
3. THE `backend/package.json` SHALL declare `nodemon` as a dev dependency and expose `"dev": "nodemon server.js"` and `"start": "node server.js"` scripts.
4. WHEN `npm install` is run inside `backend/`, THE Backend SHALL install all its dependencies without referencing the root `node_modules`.
5. WHEN `npm start` is run inside `backend/`, THE Backend SHALL start the Express + Socket.IO server on the port defined by the `PORT` environment variable, defaulting to `4000`.
6. THE Backend SHALL NOT contain any Next.js source files, configuration, or dependencies.
7. THE Backend SHALL expose a `GET /health` endpoint that returns `{ "status": "ok" }` with HTTP 200.

---

### Requirement 2: Frontend is a Self-Contained Application

**User Story:** As a developer, I want the Next.js frontend to be fully self-contained in the `frontend/` directory, so that it can be developed, tested, and deployed independently of the backend.

#### Acceptance Criteria

1. THE Frontend SHALL contain all Next.js source files (`src/`, `public/`, `next.config.mjs`, `postcss.config.mjs`, `jsconfig.json`, `eslint.config.mjs`) within the `frontend/` directory.
2. THE `frontend/package.json` SHALL declare all runtime dependencies required by the Frontend (next, react, react-dom, socket.io-client, jsonwebtoken, bcryptjs).
3. THE `frontend/package.json` SHALL expose `"dev": "next dev"` and `"build": "next build"` and `"start": "next start"` scripts.
4. WHEN `npm install` is run inside `frontend/`, THE Frontend SHALL install all its dependencies without referencing the root `node_modules`.
5. WHEN `npm run dev` is run inside `frontend/`, THE Frontend SHALL start the Next.js development server on port `3000`.
6. THE Frontend SHALL NOT contain any Express server files, route handlers, or server-only backend dependencies (express, cors, multer).

---

### Requirement 3: Next.js API Routes are Removed

**User Story:** As a developer, I want the duplicate Next.js API routes removed, so that all API logic lives exclusively in the Express backend and there is a single source of truth.

#### Acceptance Criteria

1. THE Frontend SHALL NOT contain any files under `src/app/api/` after the separation is complete.
2. THE Frontend SHALL NOT contain `src/lib/models/` or `src/lib/mongodb.js` or `src/lib/socket-server.js` after the separation is complete.
3. THE Frontend SHALL NOT contain `src/lib/auth.js` after the separation is complete.
4. WHEN the Frontend makes an authenticated request, THE Frontend SHALL send the JWT in the `Authorization: Bearer <token>` header to the Backend's HTTP API.

---

### Requirement 4: Frontend Communicates with Backend via BACKEND_URL

**User Story:** As a developer, I want the frontend to use a configurable base URL for all API calls, so that the same frontend build can point to different backend environments (local, staging, production).

#### Acceptance Criteria

1. THE Frontend SHALL read the backend base URL from the `NEXT_PUBLIC_BACKEND_URL` environment variable.
2. WHEN `NEXT_PUBLIC_BACKEND_URL` is not set, THE Frontend SHALL default to `http://localhost:4000`.
3. THE `frontend/.env.local` SHALL set `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000` for local development.
4. THE `useApi` hook SHALL prefix all API request paths with the value of `NEXT_PUBLIC_BACKEND_URL`.
5. WHEN a page component calls `useApi`, THE Frontend SHALL construct the full URL as `${NEXT_PUBLIC_BACKEND_URL}/api/<path>` without double slashes.

---

### Requirement 5: Socket.IO Client Connects to Backend

**User Story:** As a developer, I want the Socket.IO client in the frontend to connect to the standalone backend server, so that real-time auction events continue to work after separation.

#### Acceptance Criteria

1. THE Socket_Client SHALL connect to the URL provided by `NEXT_PUBLIC_BACKEND_URL` rather than a relative path.
2. THE Socket_Client SHALL use the path `/api/socket` when connecting to the Socket_Server.
3. WHEN the Socket_Server emits an `auction:bid_update` event, THE Socket_Client SHALL receive the event within the same session.
4. WHEN the Socket_Server emits an `auction:sold` event, THE Socket_Client SHALL receive the event within the same session.
5. WHEN the Socket_Server emits an `auction:unsold` event, THE Socket_Client SHALL receive the event within the same session.
6. WHEN the Socket_Server emits an `auction:start` event, THE Socket_Client SHALL receive the event within the same session.
7. IF the Socket_Client cannot connect to the Socket_Server, THEN THE Socket_Client SHALL log a warning and continue operating in a degraded (polling-only) mode without crashing the UI.

---

### Requirement 6: Duplicate Files are Consolidated

**User Story:** As a developer, I want all duplicate model and lib files removed, so that there is exactly one copy of each file and no risk of the two copies diverging.

#### Acceptance Criteria

1. THE Backend SHALL be the sole owner of all Mongoose model definitions (`AuctionLog`, `AuctionSession`, `Player`, `Team`, `User`).
2. THE Backend SHALL be the sole owner of `mongodb.js` (database connection utility).
3. THE Backend SHALL be the sole owner of `auth.js` (JWT sign/verify and Express middleware).
4. THE Frontend SHALL NOT import from `@/lib/models/`, `@/lib/mongodb`, or `@/lib/auth` after the separation is complete.
5. WHEN a model schema is updated in `backend/models/`, THE change SHALL be reflected in all Backend routes without requiring a corresponding change in any Frontend file.

---

### Requirement 7: Root Monorepo Convenience Scripts

**User Story:** As a developer, I want a single command at the root to start both the frontend and backend in development mode, so that local development remains ergonomic.

#### Acceptance Criteria

1. THE Monorepo_Root `package.json` SHALL expose a `"dev"` script that starts both the Frontend dev server and the Backend dev server concurrently.
2. THE Monorepo_Root `package.json` SHALL expose an `"install:all"` script that runs `npm install` in both `frontend/` and `backend/`.
3. WHEN `npm run dev` is run at the Root, THE Frontend SHALL be accessible on port `3000` and THE Backend SHALL be accessible on port `4000`.
4. THE Monorepo_Root `package.json` SHALL use `concurrently` as a dev dependency to run both processes.
5. THE Monorepo_Root SHALL NOT contain application source code — only orchestration scripts and documentation.

---

### Requirement 8: Backend Serves Uploaded Files

**User Story:** As a developer, I want the backend to serve uploaded player images, so that the frontend can display them after the `public/uploads/` directory moves to the backend.

#### Acceptance Criteria

1. THE Backend SHALL serve static files from its `uploads/` directory at the URL path `/uploads/`.
2. WHEN a file is uploaded via `POST /api/upload`, THE Backend SHALL store the file in the `backend/uploads/` directory.
3. WHEN the Frontend renders a player image, THE Frontend SHALL construct the image URL as `${NEXT_PUBLIC_BACKEND_URL}/uploads/<filename>`.
4. THE `backend/uploads/` directory SHALL be included in `.gitignore` except for a `.gitkeep` placeholder file.

---

### Requirement 9: Environment Configuration is Separated

**User Story:** As a developer, I want each app to have its own environment file, so that secrets and config values are scoped to the app that needs them.

#### Acceptance Criteria

1. THE `backend/` directory SHALL contain a `.env.example` file listing all required environment variables: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `SEED_SECRET`, `FRONTEND_URL`.
2. THE `frontend/` directory SHALL contain a `.env.example` file listing all required environment variables: `NEXT_PUBLIC_BACKEND_URL`.
3. THE root `.env.local` SHALL be removed or emptied after its values are distributed to `backend/.env` and `frontend/.env.local`.
4. THE `backend/.env` and `frontend/.env.local` files SHALL be listed in the root `.gitignore`.
5. IF a required environment variable is missing at Backend startup, THEN THE Backend SHALL log a descriptive error message and exit with a non-zero code.

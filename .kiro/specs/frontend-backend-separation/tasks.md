# Implementation Plan: Frontend-Backend Separation

## Overview

Split the current monolithic repo into two self-contained apps: `frontend/` (Next.js) and `backend/` (Express + Socket.IO). The backend already exists — the bulk of the work is moving the frontend source tree, deleting duplicate files, updating API call sites, and wiring up the monorepo root scripts.

## Tasks

- [x] 1. Harden the backend
  - [x] 1.1 Update `backend/package.json` with all required dependencies and scripts
    - Replace current content with the package.json from the design (adds `multer`, `nodemon` dev dep, correct scripts)
    - _Requirements: 1.2, 1.3_

  - [x] 1.2 Update `backend/server.js` with env validation, static uploads, and seed route
    - Add `require('path')` import
    - Add `REQUIRED_ENV` validation block before `mongoose.connect` — exit with non-zero code if `MONGODB_URI` or `JWT_SECRET` missing; warn (don't exit) for `SEED_SECRET` and `FRONTEND_URL`
    - Add `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))` after `express.json`
    - Add `app.use('/api/seed', require('./routes/seed'))` route registration
    - Add `GET /health` endpoint returning `{ status: 'ok' }` with HTTP 200
    - _Requirements: 1.1, 1.5, 1.7, 9.5_

  - [x] 1.3 Fix upload destination in `backend/routes/upload.js`
    - Change `uploadsDir` from `path.join(__dirname, '../public/uploads')` to `path.join(__dirname, '../uploads')`
    - _Requirements: 8.2_

  - [x] 1.4 Create `backend/routes/seed.js` if it does not already exist
    - Scaffold a minimal seed route that the server can `require` without crashing (copy logic from `src/app/api/seed/route.js` if present, otherwise create a stub)
    - _Requirements: 1.1_

  - [x] 1.5 Create `backend/uploads/` directory with `.gitkeep`
    - Create `backend/uploads/.gitkeep`
    - Add `backend/uploads/*` and `!backend/uploads/.gitkeep` to `.gitignore`
    - _Requirements: 8.4_

  - [x] 1.6 Create `backend/.env.example`
    - Content: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `SEED_SECRET`, `FRONTEND_URL`, `BACKEND_URL` as shown in design
    - _Requirements: 9.1_

- [-] 2. Scaffold the frontend directory
  - [x] 2.1 Create `frontend/package.json`
    - Use the exact content from the design document
    - _Requirements: 2.2, 2.3_

  - [x] 2.2 Move Next.js config and root config files into `frontend/`
    - Move `next.config.mjs`, `postcss.config.mjs`, `jsconfig.json`, `eslint.config.mjs` → `frontend/`
    - _Requirements: 2.1_

  - [x] 2.3 Move `src/` → `frontend/src/` and `public/` → `frontend/public/`
    - Move the entire `src/` tree into `frontend/src/`
    - Move the entire `public/` tree into `frontend/public/`
    - _Requirements: 2.1_

  - [x] 2.4 Create `frontend/.env.local` and `frontend/.env.example`
    - `frontend/.env.local`: `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`
    - `frontend/.env.example`: same key, no value
    - _Requirements: 4.3, 9.2_

- [x] 3. Delete duplicate and obsolete files from the frontend
  - [x] 3.1 Delete `frontend/src/app/api/` (entire tree)
    - Remove all Next.js API route files — backend routes are the sole source of truth
    - _Requirements: 3.1_

  - [x] 3.2 Delete frontend-side lib duplicates
    - Delete `frontend/src/lib/models/` (entire directory)
    - Delete `frontend/src/lib/mongodb.js`
    - Delete `frontend/src/lib/auth.js`
    - Delete `frontend/src/lib/socket-server.js`
    - _Requirements: 3.2, 3.3, 6.4_

- [-] 4. Update frontend API call sites to use `NEXT_PUBLIC_BACKEND_URL`
  - [x] 4.1 Rewrite `frontend/src/hooks/useApi.js`
    - Replace with the implementation from the design: read `NEXT_PUBLIC_BACKEND_URL`, normalize path (strip leading slash), construct full URL, attach `Authorization: Bearer <token>` header when token present
    - _Requirements: 3.4, 4.1, 4.2, 4.4, 4.5_

  - [ ]* 4.2 Write property test for `useApi` URL construction (Property 1)
    - Use `fast-check` to generate arbitrary path strings (with/without leading slash, with query params, empty segments) and arbitrary token strings
    - Mock `fetch` and assert: called URL starts with `NEXT_PUBLIC_BACKEND_URL`, no double slashes, `Authorization: Bearer <token>` header present when token provided, header absent when no token
    - Minimum 100 iterations
    - **Property 1: useApi always constructs full URLs with auth header**
    - **Validates: Requirements 3.4, 4.4, 4.5**

  - [x] 4.3 Update `frontend/src/context/SocketContext.jsx`
    - Replace with the implementation from the design: connect to `NEXT_PUBLIC_BACKEND_URL` with `path: '/api/socket'`, preserve `reconnectionAttempts: 5` and `connect_error` warning log
    - _Requirements: 5.1, 5.2, 5.7_

  - [x] 4.4 Update `frontend/src/app/login/page.jsx`
    - Replace hardcoded `/api/auth/login` fetch with `${BACKEND_URL}/api/auth/login` as shown in design diff
    - _Requirements: 3.4, 4.1_

  - [x] 4.5 Update `frontend/src/app/admin/players/page.jsx` (PhotoUpload)
    - Replace hardcoded `/api/upload` fetch with `${BACKEND_URL}/api/upload` as shown in design diff
    - Update any player image `src` attributes to construct URL as `${NEXT_PUBLIC_BACKEND_URL}/uploads/<filename>`
    - _Requirements: 3.4, 8.3_

  - [x] 4.6 Update `frontend/src/app/audience/page.jsx`
    - Apply all diffs from the design: `fetchTeams`, initial `useEffect` fetch, polling interval fetch, and socket `io()` call all use `BACKEND_URL`
    - _Requirements: 3.4, 4.1, 5.1, 5.2_

- [x] 5. Checkpoint — verify backend and frontend are internally consistent
  - Ensure `backend/` has no Next.js imports or `next` dependency
  - Ensure `frontend/src/` has no imports from `@/lib/models`, `@/lib/mongodb`, or `@/lib/auth`
  - Ensure `frontend/src/app/api/` directory is absent
  - Ask the user if any questions arise before continuing.

- [x] 6. Wire up the monorepo root
  - [x] 6.1 Replace root `package.json` with monorepo orchestration scripts
    - Use the exact content from the design: `dev` script using `concurrently`, `install:all` script, `concurrently` as dev dependency
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 6.2 Delete obsolete root-level files
    - Delete root `server.js`
    - Delete `server/` directory (dead leftover)
    - _Requirements: 7.5_

  - [x] 6.3 Update root `.gitignore`
    - Add `frontend/.env.local`, `backend/.env`, `backend/uploads/*`, `!backend/uploads/.gitkeep`
    - Remove or empty root `.env.local` entry if it was the only env file referenced
    - _Requirements: 8.4, 9.3, 9.4_

- [ ] 7. Write example-based unit tests for backend additions
  - [ ]* 7.1 Write unit test for `GET /health`
    - Assert response status 200 and body `{ status: 'ok' }`
    - _Requirements: 1.7_

  - [ ]* 7.2 Write unit test for upload response URL format
    - Assert response URL is `${BACKEND_URL}/uploads/<filename>`
    - _Requirements: 8.2, 8.3_

  - [ ]* 7.3 Write property test for file upload storage path (Property 2)
    - Use `fast-check` to generate arbitrary filenames and image buffers within the 5 MB limit
    - Mock multer disk storage and assert: file lands in `backend/uploads/`, response URL starts with `BACKEND_URL` and contains `/uploads/`
    - Minimum 100 iterations
    - **Property 2: File upload lands in backend/uploads**
    - **Validates: Requirements 8.2, 8.3**

  - [ ]* 7.4 Write unit test for `SocketContext` initialization
    - Assert `io()` is called with `NEXT_PUBLIC_BACKEND_URL` as host and `{ path: '/api/socket' }` in options
    - _Requirements: 5.1, 5.2_

- [x] 8. Final checkpoint — full integration smoke check
  - Verify `frontend/package.json` has no `express`, `cors`, or `multer` dependencies
  - Verify `backend/package.json` has no `next` dependency
  - Verify `.env.example` files exist in both `frontend/` and `backend/`
  - Verify `backend/uploads/.gitkeep` exists
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster migration
- Each task references specific requirements for traceability
- The backend already has most routes — no new Express route logic is needed beyond the seed stub and health endpoint
- Property tests validate the two areas with meaningful logic variation (URL construction and upload path)
- The `public/uploads/` images in the current repo should be copied to `backend/uploads/` manually if needed for local dev continuity

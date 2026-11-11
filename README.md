# Podrida

A browser card game. One repo, three npm workspaces:

| Folder      | What it is                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------- |
| `backend/`  | Express 5 + MongoDB API: accounts, auth, sessions, admin tools (and, soon, the game server) |
| `frontend/` | Vite + React + TypeScript app                                                               |
| `shared/`   | `@podrida/shared`: the contract both sides agree on (endpoint paths, error codes, types)    |

The backend started from the [User-template](https://github.com/Adise0/User-template). Its own
docs (every endpoint, environment variables, security notes) are in [backend/README.md](backend/README.md).

## Getting started

You need Node.js 24 or newer, a MongoDB database and an SMTP account.

```sh
npm install                          # Once, at the repo root: installs all three workspaces
cp backend/.env.example backend/.env   # Then fill it in
npm run dev:backend                  # In one terminal
npm run dev:frontend                 # In another
```

The API runs on http://localhost:4000 and the frontend on http://localhost:3000. Port 3000 is what
the backend expects as `FRONTEND_URL` by default. If the API isn't on port 4000, set `VITE_API_URL`
in `frontend/.env` (see `frontend/.env.example`). Stop each one with Ctrl+C in its terminal.

## Scripts (run from the root)

| Script                 | What it does                                                  |
| ---------------------- | ------------------------------------------------------------- |
| `npm run build`        | Builds all three, in order                                    |
| `npm run build:shared` | Builds only `shared` (the others need it built)               |
| `npm run typecheck`    | Typechecks every workspace                                    |
| `npm run lint`         | Lints every workspace                                         |
| `npm test`             | Runs the backend tests (in-memory MongoDB, nothing to set up) |
| `npm run format`       | Formats everything with Prettier (`format:check` only checks) |

Run a script in one workspace with `npm run <script> -w @podrida/backend` (or `frontend`, `shared`).

## Running and deploying each side

| Script                   | What it does                                                    |
| ------------------------ | --------------------------------------------------------------- |
| `npm run dev:backend`    | Builds `shared`, then runs only the API                         |
| `npm run dev:frontend`   | Builds `shared`, then runs only the frontend                    |
| `npm run dev:shared`     | Rebuilds `shared` on every change (optional, a third terminal)  |
| `npm run build:backend`  | Builds `shared`, then compiles the backend                      |
| `npm run build:frontend` | Builds `shared`, then bundles the frontend into `frontend/dist` |
| `npm run start:backend`  | Starts the compiled API (run `build:backend` first)             |

There is no single deploy command: the two sides deploy to different places. Whatever the host,
install at the **repo root** (`npm ci`), because both sides need `shared/`.

- **Backend** (any Node host): build with `npm run build:backend`, start with
  `npm run start:backend`, and set the environment variables from `backend/.env.example`. Or use the
  `Dockerfile` at the root, built from the root: `docker build -t podrida-backend .`
- **Frontend** (static host such as Vercel, Netlify or Cloudflare Pages): build with
  `npm run build:frontend`, publish `frontend/dist`, and set `VITE_API_URL` to the production API URL.
  Add the frontend's URL to the backend's `FRONTEND_URL` (or `CORS_ORIGINS`).

## Sharing code between backend and frontend

Put anything both sides must agree on in `shared/src` and export it from `shared/src/index.ts`:

```ts
// Backend or frontend
import { endpoints, ErrorCode, type ResponseError } from "@podrida/shared";
```

`shared` is compiled to `dist/` (CommonJS for the backend, ESM for the frontend), so after changing
it either keep `npm run dev:shared` running (it rebuilds on every change) or run `npm run build:shared`.
Keep it free of Node-only and browser-only code.

For example, the API's error codes live there: the frontend switches on `ErrorCode`, never on
messages, and the backend can't rename a code without the frontend noticing at compile time.

## CI

GitHub Actions run on pushes to `main` and on pull requests, only when something relevant changed:

- `.github/workflows/backend.yml`: for `backend/**` and `shared/**`. Typechecks, lints, checks formatting and runs the tests.
- `.github/workflows/frontend.yml`: for `frontend/**` and `shared/**`. Lints and builds.

A change to `shared/` runs both, since both depend on it.

# @podrida/shared

The contract between the backend and the frontend. Anything both sides must agree on lives here
and nowhere else: endpoint paths, error codes, request and response types.

Keep it dependency-free and free of anything Node-only or browser-only, because both sides import it.

It is built with tsup into `dist/` (CommonJS for the backend, ESM for the frontend). From the
repo root, `npm run dev` rebuilds it on every change; `npm run build:shared` builds it once.

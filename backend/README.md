# Podrida backend

A REST API for user accounts, built with Express 5, TypeScript and MongoDB (Mongoose). It covers
registration with email activation, password, one-time password and Google/Apple sign-in,
two-factor authentication, sessions, password resets, email changes, account deletion, profile
editing and admin tools.

Every endpoint, with example requests, is in the Postman collection in [postman/](postman/).

## Getting started

You need Node.js 24 or newer, a MongoDB database and an SMTP account.

This is a workspace of the Podrida monorepo: run `npm install` once at the repo root, not here.

```sh
cp .env.example .env   # Then fill it in
npm run dev            # From here: just the API. From the root: npm run dev:backend
```

The API runs on `http://localhost:4000` by default. To check it's up, open `/health`.

## Scripts

| Script                   | What it does                                     |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | Runs the API and restarts it on changes          |
| `npm run build`          | Compiles TypeScript into `build/`                |
| `npm start`              | Builds, then runs `build/index.js`               |
| `npm test`               | Runs the test suite                              |
| `npm run testCovNoWatch` | Runs the tests once with a coverage report       |
| `npm run testCov`        | Runs the tests in watch mode with coverage       |
| `npm run lint`           | Runs ESLint (`lint:fix` fixes what it can)       |
| `npm run format:check`   | Checks formatting with Prettier (`format` fixes) |

Before committing, run `npx tsc --noEmit`, `npm run lint`, `npm run format:check` and `npm test`.

## Tests

`npm test` needs nothing set up: the tests run the real API against an in-memory MongoDB
(mongodb-memory-server), with no `.env`. Nothing leaves your machine either: emails go to a fake
mailbox ([fakeNodemailer.ts](tests/helpers/fakeNodemailer.ts)) and Google and Apple are played by a
fake provider ([fakeOAuthProvider.ts](tests/helpers/fakeOAuthProvider.ts)).

The first run downloads a MongoDB binary, which can take a few minutes. Test files run one after the
other, and each one gets its own database.

## Environment variables

The server checks these at startup and refuses to start if one is missing or invalid.

| Variable         | Required | Description                                                                                                 |
| ---------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `CONN_STRING`    | Yes      | MongoDB connection string                                                                                   |
| `TOKEN_SECRET`   | Yes      | Secret that signs every token, at least 32 characters                                                       |
| `SMTP_HOST`      | Yes      | SMTP server, eg. `smtp.example.com`                                                                         |
| `EMAIL`          | Yes      | SMTP username                                                                                               |
| `EMAIL_PASSWORD` | Yes      | SMTP password                                                                                               |
| `FRONTEND_URL`   | Yes      | The frontend: base of the email links and of OAuth redirects, and the default CORS origin                   |
| `BACKEND_URL`    | Yes      | This API's public URL: base of Apple's sign-in callback                                                     |
| `SMTP_PORT`      | No       | `465` (TLS, the default) or `587` (STARTTLS, required)                                                      |
| `EMAIL_ALIAS`    | No       | The "from" address, defaults to `EMAIL`                                                                     |
| `CORS_ORIGINS`   | No       | Comma-separated browser origins allowed to call the API, defaults to `FRONTEND_URL`                         |
| `PORT`           | No       | Defaults to `4000`                                                                                          |
| `NODE_ENV`       | No       | `production` turns off pretty logs                                                                          |
| `LOG_LEVEL`      | No       | Defaults to `info`. `debug` also logs expected errors and users                                             |
| `DNS_SERVERS`    | No       | Comma-separated DNS servers for the database lookup, defaults to the system's                               |
| `METRICS_TOKEN`  | No       | Turns on `GET /metrics`, at least 32 characters. See [Metrics](#metrics)                                    |
| `GOOGLE_*`       | No       | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, both or neither. See [OAuth](#sign-in-with-google-and-apple) |
| `APPLE_*`        | No       | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY`, all four or none                |

`.env.example` has an example and a short explanation for each one. `TOKEN_SECRET` also encrypts the
stored 2FA secrets, so read [SECURITY_SETTINGS.md](SECURITY_SETTINGS.md) before ever changing it.

Everything else, such as session lengths, cooldowns, rate limits, the deletion grace period and the
2FA switch, is in [src/data/serverConfig/server-config.ts](src/data/serverConfig/server-config.ts),
each setting with a comment.

## How it works

### Accounts

Registering creates a pending account and emails an activation link. Pending accounts can't log in,
and MongoDB deletes them automatically after 24 hours.

If someone registers again with the same email, the pending account is replaced, so losing the
confirmation page is never a dead end. A different email can only take a pending username once that
signup's activation link has expired.

Emails and usernames are unique regardless of casing. `credentials` holds the lowercased keys that
logins and uniqueness use, and `information` holds the public profile, with the username as typed.

### Logging in and recovering access

| Flow             | Endpoints                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| Password         | `POST /auth/login` with `{ email, password }`. `email` can also be the username                                  |
| One-time code    | `POST /auth/requestOtp`, then `POST /auth/login` with `{ email, password: <code>, withOtp: true }`               |
| Password reset   | `POST /auth/requestPasswordReset`, then `POST /auth/resetPassword` with the link's token                         |
| Change password  | `POST /auth/changePassword` (fresh login)                                                                        |
| Change email     | `POST /auth/requestEmailChange` (fresh login), then `POST /auth/confirmEmailChange` with the new address's token |
| Check a username | `POST /auth/checkKeys`, so a signup form can say whether an email or username is free                            |

A wrong password and an unknown account get the same `INVALID_CREDENTIALS` answer, in the same time.
The OTP and reset emails carry a "wasn't you?" link that cancels them. A one-time code allows 5
guesses and expires after 10 minutes. Resetting the password signs out every session. Every
sensitive change sends the owner an email.

### Rate limits

| Limit                                            | Default           |
| ------------------------------------------------ | ----------------- |
| Logins (password, OTP, OAuth, 2FA codes), per IP | 10 per 15 minutes |
| Failed password logins, per account (any IP)     | 20 per 15 minutes |
| Requests that send an email, per IP              | 5 per 15 minutes  |
| `checkKeys`, per IP                              | 10 per 15 minutes |
| Emails of each kind to one account               | 1 per minute      |

Going over answers `429` with `TOO_MANY_REQUESTS` and `details.retryAfterSeconds`. The limits are
counted in memory, per process. See [SECURITY_SETTINGS.md](SECURITY_SETTINGS.md) if the API runs
behind a proxy or on more than one instance.

### Sessions

Logging in returns a JWT, sent as `Authorization: Bearer <token>`. It lasts 2 hours, and the
frontend should refresh it after 1 hour with `GET /auth/refreshToken`.

| To end              | Use                            |
| ------------------- | ------------------------------ |
| The current session | `POST /auth/logout`            |
| Every session       | `POST /auth/signOutEverywhere` |

By default sessions can be refreshed forever. Set `userSessionMaxAgeInHours` to add a hard limit,
counted from the last real login.

Changing a password, changing the email and deleting the account need a login from the last 5
minutes. Otherwise the API answers `REAUTH_REQUIRED`, and the frontend should send the user through
the login again.

### Deleting an account

`DELETE /auth/deleteAccount` doesn't delete straight away. The account is signed out everywhere and
gets a `scheduledDeletionAt` date, 14 days out by default, and the owner is emailed that date.
Logging in before then cancels the deletion. Once the date passes, MongoDB removes the account (TTL
index). Meanwhile its email and username stay taken.

Set `accountDeletionGraceInDays` to `null` to delete immediately. An admin deleting a user
(`DELETE /admin/users/:userId`) always deletes immediately.

### Sign in with Google and Apple

Each provider switches on when its variables are set (see `.env.example`), and
`GET /auth/oauth/providers` tells the frontend which ones are on. The frontend drives the flow, so
it works with the token kept in the frontend like every other login:

1. Generate a random `state` and `nonce`, plus a PKCE verifier and its SHA-256 challenge for
   providers with `supportsPkce`. Keep them in `sessionStorage`.
2. `GET /auth/oauth/:provider/authorizationUrl?state=&nonce=&codeChallenge=` and redirect the user
   to the `url` it answers.
3. The provider sends the user back to `FRONTEND_URL/auth/oauth/:provider/callback?code=&state=`.
   Apple can only POST a form, so its return URL is `BACKEND_URL/auth/oauth/apple/callback`, which
   redirects to that same frontend page. Check `state` matches the one you kept.
4. `POST /auth/oauth/:provider/login` with `{ code, nonce, codeVerifier }`. Apple also sends the
   name (only on the first sign-in) in a `user` query parameter: forward it as `firstName` and
   `lastName`.

The login answers one of three things:

| Answer                                  | Means                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `{ token }`                             | A session, the provider account is linked to a user                       |
| `{ twoFactorRequired, twoFactorToken }` | That user has 2FA on, see below                                           |
| `{ signupRequired, signupToken, ... }`  | First sign-in: ask for a username, then `POST /auth/oauth/completeSignup` |

A first sign-in whose email already belongs to an account is refused with `OAUTH_EMAIL_IN_USE`
rather than linked, or whoever controls that email at the provider would get the account. The
owner logs in as usual and links the provider from their settings
(`POST /auth/oauth/:provider/link`, fresh login required). Accounts created this way have no
password; the email still works for OTP login and for setting one through a password reset.

To add a provider (GitHub, Microsoft...), write a file like
[google.ts](src/server/utils/oauth/providers/google.ts) implementing `OAuthProvider`, and add it to
[providers/index.ts](src/server/utils/oauth/providers/index.ts). Any OpenID Connect provider can
reuse the helpers in [openIdConnect.ts](src/server/utils/oauth/openIdConnect.ts).

### Two-factor authentication

Authenticator app codes (TOTP), opt-in per user:

1. `POST /auth/twoFactor/setup` (fresh login) answers a `secret` and an `otpauthUrl`. Show the URL
   as a QR code.
2. `POST /auth/twoFactor/enable` with a code from the app turns it on, and answers 10 backup
   codes. They're only shown this once.

From then on every login (password, OTP or OAuth) answers `{ twoFactorRequired, twoFactorToken }`
instead of a session, and `POST /auth/twoFactor/verify` with that token and a code (or a backup
code) answers the session. Each code works once, and 5 wrong ones end the attempt.

Users turn it off with `POST /auth/twoFactor/disable` (fresh login and a code). An admin can reset
it for someone who lost both the app and the backup codes
(`POST /admin/users/:userId/resetTwoFactor`). Set `twoFactorAuthEnabled` to `false` in
server-config.ts to remove the feature: the endpoints answer `404` and logins never ask for a code.

`GET /users/myUser` includes `hasPassword`, `linkedProviders` and `twoFactorEnabled` for a settings
page.

### Avatars

Avatars are cropped in the browser. The API stores two pictures, both sent as PNG, JPEG or WebP
data URLs: `image`, the square avatar everyone sees (the frontend shows it in a circle), and
`source`, the downscaled original it was cut from. It also stores `crop` (`{ x, y, zoom }`), so the
avatar can be re-framed later. `avatarLimits` in `@podrida/shared` sets the sizes. The API checks
that each file really is the format it claims to be. It doesn't decode them.

| Endpoint                        | Does                                                        |
| ------------------------------- | ----------------------------------------------------------- |
| `PUT /users/myUser/avatar`      | Sets it: `{ image, source, crop }`, answers `{ avatarUrl }` |
| `GET /users/myUser/avatar`      | The `source` and `crop`, to re-frame it                     |
| `DELETE /users/myUser/avatar`   | Removes it                                                  |
| `GET /users/avatars/:userId?v=` | The image itself. Public, so an `<img>` can load it         |

`POST /auth/register` and `POST /auth/oauth/completeSignup` take the same object as an optional
`avatar`. `GET /users/myUser` answers an `avatarUrl` path that changes with each new avatar, so
it's cached for good. A first OAuth sign-in answers the provider's `pictureUrl` (Google only), which
the frontend can offer as the avatar. The files are stored on the user document but no query loads
them unless it asks (`select: false`). They're deleted along with the account, pending accounts
included.

### Rooms, games and the realtime connection

The lobby and the games run over one WebSocket per tab, at `/ws` on the API's port. The whole
protocol (every request, reply and event, with their payloads) is typed in
[realtime.ts](../shared/src/realtime.ts) in `@podrida/shared`. In short:

- The client sends requests `{ id, type, payload }`, and the server answers each one with a reply
  `{ kind: "reply", id, ok, payload | error }`. Errors are the same `ResponseError`s as REST, with
  the same codes.
- The server pushes events `{ kind: "event", event, payload }` on its own: lobby changes, room
  changes, game changes.
- The first request is `session:auth` with the session token. Browsers can't set headers on a
  WebSocket, and a token in the URL would end up in logs. The connection closes (`4001`) when that
  token expires, so send `session:auth` again with every refreshed token. Revoking sessions (sign
  out everywhere, a password change, disabling the account...) closes the affected connections
  right away, through [sessionEvents.ts](src/server/utils/auth/sessionEvents.ts).
- The origin is checked against `CORS_ORIGINS` / `FRONTEND_URL`, since CORS doesn't cover
  WebSockets. Each connection is rate limited, a user can have 5 open at once, and the server pings
  every 30 seconds to drop dead ones. The limits are in server-config.ts.

**Rooms** are the lobby's tables: anyone can create one, join it while it isn't full, and leave.
They live only in memory ([roomManager.ts](src/realtime/rooms/roomManager.ts)). They change
constantly and nothing about them is worth keeping until they start. A user sits at one room or one
game at a time. When the host leaves, the longest-seated member becomes host, and an empty room
closes. A member whose connections all drop keeps their seat for `roomReconnectGraceInSeconds`, so a
page reload doesn't kick anyone.

**Games** start when the host sends `rooms:start` with at least `roomLimits.minPlayers` seated. The
game is stored in the `games` collection right away ([Games.ts](src/database/models/Games.ts):
room name, host, players, status), and it's played as a live object in memory
([gameManager.ts](src/realtime/games/gameManager.ts)).

**The rules** are in [podrida.ts](../shared/src/podrida.ts) in `@podrida/shared`: the round
schedule, which cards may be played, who takes a trick, and the scoring. They're pure functions, so
the server enforces them and the frontend uses the very same ones to darken the cards that can't be
played and write the hints. [PodridaMatch.ts](src/realtime/games/PodridaMatch.ts) runs one game on
top of them: it deals, takes the bids (`games:bid`) and the cards (`games:play`), and refuses
anything out of turn, out of phase or against the rules (`NOT_YOUR_TURN`, `WRONG_PHASE`,
`INVALID_BID`, `CARD_NOT_PLAYABLE` with the rule in `details.rule`).

The game manager sets the pace. The timed phases (the deal, a finished trick on the table, the
round summary) last `gameTimings` in server-config.ts, so every player sees the same thing at the
same time. Each player gets their own `game:updated`, with their own hand and only the size of the
others' hands. Every scored round is stored on the record (`rounds`, and each player's `total`),
so a game cut short keeps its rounds. A player counts as connected to the game while one of their
tabs has the game page open (`games:attach`, until `games:detach` or the tab closes). On their
turn, the game waits for them.

Players can't leave a game. It ends on its own after the last round (`FINISHED`), or early:

| Status        | When                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| `ENDED_EARLY` | The host sent `games:end`, or an admin ended it. `endedBy` records who      |
| `ABANDONED`   | No player was connected for `gameAbandonAfterSeconds`                       |
| `INTERRUPTED` | It was still running when the server started again: its live state was lost |

The host can kick players (`games:kick`), but not themselves. A kicked player's seat stays, and
plays itself: it bids 0 and plays its lowest playable card. The record keeps `kickedAt` and
`kickedBy`, and they're free to join another room.

Players look back on their own finished games over REST: `GET /games/finished` (paginated, with
each player's final points and the winners) and `GET /games/finished/:gameId` (every round's bids
and scores). Anyone who didn't play a game gets a 404 for it.

Admins see every game under `/admin/games` (filter by `status` or `playerId`). On a game being
played they can force-end it (`POST /admin/games/:gameId/end`) and kick anyone, the host included
(`POST /admin/games/:gameId/players/:userId/kick`). Kicking the host passes the seat to the next
player still in the game. Kicking the last one ends it. Both actions go to the admin audit log.

To add a request (eg. a game move), declare it in `SocketRequests` in realtime.ts, then register it
in [realtimeRouter.ts](src/realtime/realtimeRouter.ts) with a Joi schema for its payload, the way
REST routes have body validators. Handlers throw `ControlledError`s and return the reply's payload.

All of this is per server process. Running several instances needs the rooms, games and connection
registry in a shared store (eg. Redis), with sticky sessions or pub/sub between instances.

### Email links

Each email link is a signed token for one purpose, and it only works on the matching endpoint. The
database stores a SHA-256 hash of it, so a database leak doesn't expose working links. Only the most
recent link of each kind works.

Endpoints that email an account found by email or username always answer `202` straight away, so
the response doesn't reveal whether the account exists.

Every email is sent with a plain-text version next to the HTML, made from it automatically, so
links still work in text-only clients and spam filters score it better.

Failed emails are retried up to 3 times. Retries are kept in memory on purpose, because a stored
queue would keep working codes and links in the database. If the server restarts mid-retry, the
email is lost and the user has to ask for it again.

### Roles

Every user has a `role`: `USER` (the default), `ADMIN` or `SUPERUSER`. To limit a route, put
`roleValidator` after `tokenValidator`:

```ts
router.all(path, method(Methods.GET), tokenValidator, roleValidator(UserRole.admin), controller);
```

No endpoint can grant `SUPERUSER`, so it has to be set directly in the database:

```js
db.users.updateOne({ "credentials.email": "you@example.com" }, { $set: { role: "SUPERUSER" } });
```

### Admin endpoints

Everything under `/admin` needs an `ADMIN` or `SUPERUSER`: list and search users (paginated), get,
edit, disable, enable, sign out, force a password reset, reset 2FA and delete. Changing a user's role
is for superusers only.

Nobody can act on themselves, admins can only act on regular users, superusers can act on users and
admins, and a superuser can't be touched through the API at all. Deleting a user and changing a role
need a fresh login. Every action leaves a line in the [audit log](#admin-audit-log), and the ones
that change the user's access (disable, enable, force a password reset, reset 2FA, delete) also email
them.

## Errors

Every error has the same shape. Switch on `code`, because `message` is only a human-readable
fallback.

```json
{
  "error": true,
  "status": 400,
  "code": "VALIDATION_FAILED",
  "message": "Invalid data: Password must have at least 8 characters",
  "fields": { "password": "TOO_SHORT" }
}
```

`fields` and `details` are only there when they apply. The codes are in
[src/types/errorTypes/ErrorCode.ts](src/types/errorTypes/ErrorCode.ts), which has no dependencies so
it can be copied into the frontend. Once a code is in use, never rename or reuse it.

## Project structure

```text
src/
  data/
    errorObjects/   Error builders
    joiObjects/     Request validation schemas
    serverConfig/   Endpoints, settings and environment validation
  database/         Connection and models
  realtime/         The WebSocket server, its router and handlers, the rooms and the live games
  server/
    controllers/    The final step of each route
    middlewares/    Auth, OAuth, validation, rate limits, metrics and error handling
    routers/        Route definitions
    utils/          Email, logging, metrics, OAuth providers, 2FA and auth helpers
  types/            Shared TypeScript types
tests/              The test suite and its fakes (see Tests)
postman/            Postman collection, with its own README
```

Validators that only check `req.body` live together in
[bodyValidators.ts](src/server/middlewares/requestPayloadValidators/bodyValidators.ts). One that
reads from anywhere else, or leaves data anywhere else, gets its own file.

## Logging

Logs are structured JSON from [pino](https://getpino.io), and pretty-printed in development.

Every request gets an id, returned in the `X-Request-Id` header and included in its logs. Request
headers aren't logged, and tokens in URLs are masked.

## Metrics

Set `METRICS_TOKEN` to turn on `GET /metrics`, in Prometheus format. The scraper sends the token as
`Authorization: Bearer <METRICS_TOKEN>`. Without the variable the endpoint doesn't exist.

| Metric                              | What it says                                                    |
| ----------------------------------- | --------------------------------------------------------------- |
| `http_request_duration_seconds`     | Requests and their latency, by method, route and status code    |
| `emails_sent_total`                 | Emails sent and failed, the only place background failures show |
| `realtime_request_duration_seconds` | Realtime requests and their latency, by type and result         |
| `realtime_live`                     | Open connections, lobby rooms and live games, by `kind`         |
| `process_*`, `nodejs_*`             | CPU, memory, event loop lag, garbage collection                 |

The route label is the pattern (`/admin/users/:userId`), never the real URL. Requests refused before
reaching a route (unknown paths, a missing token on a router-wide guard) are counted as `unmatched`.

## Admin audit log

Every admin action writes one log line with `audit: true`, the admin, the target user, the action
and the request id. Search the logs for `audit` to follow them. If you need them in the database,
for a page admins can search or for retention rules, write them from
[logAdminAction.ts](src/server/utils/logAdminAction.ts): every admin action already goes through it.

## Starting a project from this template

- Rename it: `name` and `description` in `package.json`, the title of this README, and `appName` in
  server-config.ts, which every email and authenticator app shows.
- Rebrand the emails: the layout and colors of all of them are in
  [baseEmail.ts](src/server/utils/email/emailBuilders/baseEmail.ts), and each email's wording is in
  its own file next to it. Keep the styles inline, it's what email clients render reliably.
- Go through [server-config.ts](src/data/serverConfig/server-config.ts) and set what your product
  wants: session length, deletion grace period, 2FA on or off.
- Add your own user fields to the model ([Users.ts](src/database/models/Users.ts)) and its types in
  [src/types/userTypes/](src/types/userTypes/).

## Deploying

Before going live, go through the checklist at the top of
[SECURITY_SETTINGS.md](SECURITY_SETTINGS.md). Set `NODE_ENV=production` for plain JSON logs.

Stop the server with `SIGTERM` or `SIGINT` so running requests can finish. Open WebSockets are
closed with `1001`, which tells the clients to reconnect. A proxy in front of the API has to pass
WebSocket upgrades through on `/ws`. `GET /health` answers
`503` if the database connection is lost.

## Upgrading a database from an older version of this template

Only for a database created by an earlier version of this template, never for a new project. Run
this once, before starting the new version:

```js
db.users.dropIndex("information.email_1");
db.users.dropIndex("information.username_1");
db.users.updateMany({}, [
  { $set: { "credentials.username": { $toLower: "$credentials.username" } } },
]);
db.users.updateMany({ verificationToken: { $exists: false } }, [
  { $set: { activatedAt: { $toDate: "$_id" } } },
]);
```

The `$toLower` step fails if two users differ only by casing, so resolve those first. Without the
last step, active users are treated as pending and can't log in.

Email links sent before the upgrade stop working, and everyone has to log in again.

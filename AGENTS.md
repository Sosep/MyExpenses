# AGENTS.md

Read this before changing code. Detailed sources:

- `webui/API.md` — API contract.
- `webui/DESIGN.md` — visual system, components and screen patterns.
- `webui/webapp/README.md` — SPA dev/build and the mock server.
- `product-model/` — product and domain reference. `docs/` is the public website.

## Current state

- `/api/v1`: read endpoints and simple create/update/delete.
- API routes covered on the JVM by `ApiRoutesTest` with a fake `WebApiDataSource`
  and Ktor `testApplication`.
- SPA: dashboard, transactions, detail and the simple transaction editor.
- Transfers and split transactions: read-only; their write endpoints and editors
  are the next slice.

## Build and verify

The host has no JDK or Android SDK. Run Android tasks in Docker:

- Compile the web UI feature: `docker compose run --rm android-build :webui:compileDebugKotlin`
- Kotlin lint: `docker compose run --rm android-build :webui:ktlintCheck`
- Unit tests: `docker compose run --rm android-build :webui:testDebugUnitTest`
  (app tests follow the `extern` flavor, e.g. `:myExpenses:testExternDebugUnitTest`).
  API routes run on the JVM through `WebApiDataSource` + `testApplication`; the
  Android implementation and the provider stay device-level.
- Signed universal APK: `BUILD_VARIANT=release docker compose run --rm android-build`
  Output: `myExpenses/build/outputs/apk_from_bundle/externRelease/*universal-signed.apk`

A debug base APK does not contain the dynamic feature. Test the web UI with the
release universal APK, or install the feature split.

The SPA build lives in `webui/src/main/assets/webapp/` and is committed. After a
UI change run `cd webui/webapp && npm run build`; never hand-edit the generated
assets.

## Boundaries

- `:webui` depends on `:myExpenses`. The app knows the feature only through
  `IWebInputService`, `WebUiBinder` and reflection; keep that direction.
- Data access lives in `myExpenses/.../db2` and `provider`. Keep `:webui` an HTTP
  adapter; domain rules belong in the app.
- Ktor owns lifecycle, auth, TLS and the notification. The SPA is a client of
  `/api/v1`.

## Web UI rules

- `DESIGN.md` is normative. Colors come only from
  `webui/webapp/src/styles/tokens.css`; a new token or component pattern updates
  the guide and the tokens together.
- The API contract is `API.md`. Money is minor units plus currency and
  `fractionDigits`; dates are ISO `YYYY-MM-DD` in the phone's time zone. Totals
  come from the server, never from summing a page.
- Serve `/app` from `AssetManager`; `staticResources` reads the classpath, not
  Android assets.
- `/api/v1` stays behind auth; `/app` is the public shell. The SPA uses Basic
  until the cookie session lands.
- Simple writes are live. Send money as minor units, parse decimal input as a
  string, preserve `crStatus` and `uuid` on update, and reject non-simple edits
  with `409`. After a mutation bump `dataVersion` and refetch accounts; never
  sum transactions in the client.
- Add write UI only after the API endpoint and contract exist.

## Style and gotchas

- Kotlin uses ktlint and detekt with per-module baselines. Editing a Kotlin file
  shifts baseline line numbers; refresh with
  `docker compose run --rm android-build :webui:ktlintGenerateBaseline` after the
  check.
- The git hooks need Java on the host. If it is missing, run the same check in
  Docker and commit with `--no-verify` only after it passes.
- Conventional Commits (`feat(webui): ...`). Commit the webapp assets; leave
  `node_modules` and other build outputs out.
- `.secrets/` holds the release keystore. Never print, copy or commit it.

## Testing the web server

`webui/webapp/dev/mock-server.mjs` (`npm run mock`) serves the built SPA and an
in-memory v1 API with 60 transactions, including `POST/PUT/DELETE`. QA switches:
`?login=1`, `?view=transactions`, `?panel=split`, `?new=1`, `?edit=simple`,
`?new=1&save=1`, `?theme=dark`, `?metrics=1`. It tests the SPA and the contract, not the Kotlin
queries; the real API needs the phone or the JVM harness below.

## Documentation is part of done

A change is not done until, in the same commit:

- `webui/API.md` matches the endpoints, DTOs and rules.
- `webui/DESIGN.md` and `webui/webapp/src/styles/tokens.css` match new components,
  patterns and tokens.
- `webui/webapp/README.md` matches build steps and QA switches.
- This file's **Current state** and **Open work** reflect the new slice.
- If routing or validation changed, extend `ApiRoutesTest`; the test command is
  in Build and verify.

Update the docs while the change is fresh; do not defer them to a later commit.

## Open work

- Transfer and split write endpoints and editors (the split editor and part
  panel are already designed in `DESIGN.md`); use `ApiRoutesTest` for the new
  routes and the sum/peer rules.
- Then budgets, reports, files, Lingui `.po`, cookie session and bundled Geist.

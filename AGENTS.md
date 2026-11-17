# AGENTS.md

Read this before changing code. Detailed sources:

- `webui/API.md` — API contract.
- `webui/DESIGN.md` — visual system, components and screen patterns.
- `webui/webapp/README.md` — SPA dev/build and the mock server.
- `product-model/` — product and domain reference. `docs/` is the public website.

## Build and verify

The host has no JDK or Android SDK. Run Android tasks in Docker:

- Compile the web UI feature: `docker compose run --rm android-build :webui:compileDebugKotlin`
- Kotlin lint: `docker compose run --rm android-build :webui:ktlintCheck`
- Unit tests: `docker compose run --rm android-build :webui:testDebugUnitTest`
  (app tests follow the `extern` flavor, e.g. `:myExpenses:testExternDebugUnitTest`)
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
- The current slice is read-only: dashboard, transactions and detail. Add write
  UI only after the API endpoints and contract exist.

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
in-memory v1 API with 60 transactions. QA switches: `?login=1`,
`?view=transactions`, `?panel=split`, `?theme=dark`, `?metrics=1`. It tests the
SPA and the contract, not the Kotlin queries; the real API needs the phone or
the JVM harness below.

## Open work

- Write slice: simple create/update/delete first, then transfers and splits;
  then SPA editing.
- JVM API harness: extract `WebApiDataSource` and cover routing, errors and JSON
  with Ktor `testApplication`; optionally Robolectric against
  `TransactionProvider`.
- Then budgets, reports, files, Lingui `.po`, cookie session and bundled Geist.

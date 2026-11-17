# AGENTS.md

Read this before changing code. Detailed sources:

- `webui/API.md` — API contract.
- `webui/DESIGN.md` — visual system, components and screen patterns.
- `webui/webapp/README.md` — SPA dev/build and the mock server.
- `product-model/` — product and domain reference. `docs/` is the public website.

## Current state

- `/api/v1`: read endpoints plus create/update/delete for simple transactions,
  transfers and splits.
- API routes covered on the JVM by 32 `ApiRoutesTest` tests plus 4
  `SessionStoreTest` tests, with a fake `WebApiDataSource` and Ktor
  `testApplication`.
- SPA: dashboard, transactions, detail, reports, files, budgets, and the simple,
  transfer and split editors. The split editor uses signed amounts, a parts list
  and a part panel. It is installable as a PWA; on narrow screens the side rail
  becomes a fixed bottom navigation with icon and label.
- Budgets: list plus current-period progress, create/update/delete and
  per-category allocations for the current period. The summary only aggregates
  budgets that share currency and period. Account and period type are fixed on
  edit; amount edits the default allocation. A period can override the total
  (`categoryId: 0`, `oneTime: true`), and duplication plus monthly/yearly
  rollover are available.
- Files: `GET /api/v1/files` lists app-directory backups and `GET /api/v1/files/{name}`
  streams one with `Content-Disposition`; the SPA downloads via fetch + blob with
  the session cookie.
- Auth: `POST/DELETE /api/v1/session` issue and clear an HttpOnly
  `myexpenses_session` cookie (`SameSite=Strict`, sliding 7 days). `/app` is the
  public shell; `/api/v1` and downloads require the cookie when a password is
  set. Basic and the legacy HTML form are gone; `/` redirects to `/app/`.
- PWA: `manifest.webmanifest`, PNG icons and `sw.js` cache the `/app` shell; the
  API is network-only, so the app still needs the phone for data. The SPA shows
  offline and update banners.
- i18n: Lingui `t`/`Trans` with `src/locales/{en,es}/messages.po`; the top bar
  has an English/Spanish switch. Dates and money follow the active locale.
- Server data uses TanStack Query; writes invalidate the cache instead of bumping
  a version counter. Geist Sans is bundled through `@fontsource/geist-sans`.
- Tailwind v4 processes the styles: `app.css` is imported into the `components`
  layer and new UI uses utilities with the DESIGN tokens.
- Transactions list supports `categoryId`, `payeeId`, `tagId` and `methodId`
  filters (AND); the SPA exposes them with `SearchSelect`, keeps them in the URL
  and as removable chips, hides the month KPIs while filtering and collapses
  them behind `Filters (n)` on phones.
- Budgets have month navigation; monthly budgets load that month's progress,
  allocations and period total. Each budget has a 12-month history panel and
  per-category spent/allocated bars.
- Reports: `/reports/summary`, `/reports/breakdown` (category, payee, tag or
  method) and `/reports/transactions` for drill-down. Period presets, `All
  accounts` converted to the home currency and server-computed shares. Category breakdown
  uses split parts; the rest count whole transactions.

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
- Split amounts are signed and must sum to the parent; the account is fixed when
  editing a split. Transfer amounts are a positive magnitude; the server builds
  both sides.
- Data-list dropdowns use `SearchSelect` (type to filter) instead of native
  `<select>`; short enums and the topbar language picker may stay native.
- All visible copy goes through Lingui `t`/`<Trans>`; after adding text run
  `cd webui/webapp && npm run i18n:extract` and fill the Spanish `msgstr`.
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

Use the mock for **every SPA change**. It is the default visual and contract
test; the real phone API is only needed for Kotlin/provider behaviour.

```bash
cd webui/webapp
npm run build          # regenerates webui/src/main/assets/webapp
npm run mock           # http://localhost:4173/app/
```

- Test at **desktop 1440×900** and **mobile 390×844** (DevTools device toolbar
  or the browser tool viewport). At ≤760 px the rail becomes a fixed bottom
  navigation.
- Check: no console errors, no horizontal overflow, navigation reachable,
  page bottom not hidden by the bottom bar, editor/panels usable, both themes
  and both locales.
- Use `?metrics=1` to expose `scrollHeight`/`clientHeight` and row counts.
- The mock state is in memory; restarting it resets the fixtures.

QA switches: `?login=1` (clears the mock cookie), `?locale=es`,
`?view=transactions`, `?view=transactions&filter=groceries`, `?view=reports`, `?view=reports&reportBy=Payee&reportType=Both`,
`?view=reports&reportDrill=1`, `?view=budgets`, `?view=budgets&budgetMonth=-1`, `?view=budgets&new=1`,
`?view=budgets&edit=1`, `?view=budgets&edit=1&periodOverride=1`, `?view=budgets&history=1`, `?view=files`,
`?panel=split`, `?panel=transfer`, `?new=1`, `?new=1&kind=transfer`,
`?new=1&kind=split`, `?new=1&combo=1`, `?edit=simple`, `?edit=split`,
`?edit=transfer`, `?new=1&save=1`, `?theme=dark`, `?metrics=1`.

The mock writes simple transactions, budgets (allocations, rollover, period
override, duplicate), reports and file downloads. Transfers and splits can be
opened and edited visually, but saving them needs the real phone API. It tests
the SPA and the HTTP contract, not the Kotlin queries. The full guide lives in
`webui/webapp/README.md` (section **Probar sin el móvil**).

For hot reload, run the mock and `VITE_API_TARGET=http://localhost:4173 npm run dev`;
QA query switches do not apply in that mode because Vite serves the index.

## Documentation is part of done

A change is not done until, in the same commit:

- `webui/API.md` matches the endpoints, DTOs and rules.
- `webui/DESIGN.md` and `webui/webapp/src/styles/tokens.css` match new components,
  patterns and tokens.
- `webui/webapp/README.md` matches build steps and QA switches.
- If you add a QA switch or a mock capability, document it in both places.
- This file's **Current state** and **Open work** reflect the new slice.
- If routing or validation changed, extend `ApiRoutesTest`; the test command is
  in Build and verify.

Update the docs while the change is fresh; do not defer them to a later commit.

## Open work

- Device QA remains for the new slices (cookie, PWA, allocations/rollover,
  reports drill-down and all-account aggregation). The mock can be checked at
  390×844 to catch responsive regressions.
- Files are device-level: the route lives in `WebInputService` (`AppDirHelper`),
  so `ApiRoutesTest` does not cover it; verify on the phone.

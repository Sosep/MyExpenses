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
- Budget detail: `Detalle` (a side panel) shows progress, the period amount with
  its origin (this period / carried over / default), the 12-month history and
  the **budget's own** spending by category from
  `GET /budgets/{id}/breakdown` (filter + descendants, parents rolled up, split
  parts; zero rows hidden). `Historial` no longer exists as a separate button.
- Budget filters: `criteria` (categories, payees, methods, tags, states) is read
  and written in the app preference `budgetFilter_<id>`, so a budget created or
  edited from the web is scoped exactly like one from the phone. A filter the web
  cannot express is flagged (`criteriaUnsupported`) and never rewritten.
- Budget periods: `second` is 0-based only for `MONTH` (January = 0); `WEEK` and
  `DAY` are 1-based, out-of-range values are a `400`, and `history` ends at the
  current month. Budget sums aggregate **split parts** whatever the global
  "split as total" preference says, because the category lives on the part.
- Accounts: read plus `GET /account-types` and `POST/PUT/DELETE /accounts`. The
  type travels as an id (`type`) and as a name (`typeName`); deleting an account
  removes its transactions like the app does, with `409` when it has a sealed
  debt.
- Navigation: the view lives in the URL (`?view=`), so back/forward walk the app
  and deep links open a filtered list; the transaction detail is a history entry
  that back closes. Other panels still open from state.
- Search: `q` folds case and diacritics on both sides (`Cafetería` = `cafeteria`).
- Files: `GET /api/v1/files` lists app-directory backups and `GET /api/v1/files/{name}`
  streams one with `Content-Disposition`; the SPA downloads via fetch + blob with
  the session cookie.
- Auth: `POST/DELETE /api/v1/session` issue and clear an HttpOnly
  `myexpenses_session` cookie (`SameSite=Strict`, sliding 7 days). `/app` is the
  public shell; `/api/v1` and downloads require the cookie when a password is
  set. Basic and the legacy HTML form are gone; `/` redirects to `/app/`.
  Wrong passwords are throttled (5 per client in 60 s → `429` with
  `Retry-After`), responses are gzipped, `nosniff`/`Referrer-Policy`/CSP are
  sent, and amounts are capped at 10^12 minor units.
- PWA: `manifest.webmanifest`, PNG icons and `sw.js` cache the `/app` shell; the
  API is network-only, so the app still needs the phone for data. The SPA shows
  offline and update banners.
- i18n: Lingui `t`/`Trans` with `src/locales/{en,es}/messages.po`; the top bar
  has an English/Spanish switch. Dates and money follow the active locale.
- Server data uses TanStack Query; writes invalidate the cache instead of bumping
  a version counter. Geist Sans is bundled through `@fontsource/geist-sans`.
- Tailwind v4 processes all component styles: `app.css` lives in the `components`
  layer and its semantic classes are authored with `@apply` over the DESIGN
  tokens. Only resets, keyframes and a few exact keywords remain plain CSS.
- Transactions list supports repeated `categoryId`, `payeeId`, `tagId` and
  `methodId` (OR within a dimension, AND across), a text search (`q` over
  comment, payee and reference), `amountMin`/`amountMax` (absolute minor units),
  repeated `status` and a `transfer` switch; the SPA exposes them with
  `MultiPicker`/`SearchSelect`, keeps them in the URL and as removable chips, and
  collapses them behind `Filters (n)` on phones.
  The list is not tied to a month: the grouping (`NONE/DAY/WEEK/MONTH/YEAR`) is a
  visual choice kept in the URL and `localStorage`, each period header carries
  its income, expenses and transfers from `/reports/grouped` (`firstDate`
  anchors rows to periods), and the range is just another filter (`Historial`
  by default, plus `Este mes`, `Últimos 3 meses`, `Este año` and a custom one).
- Budgets have month navigation; monthly budgets load that month's progress,
  allocations and period total. Each budget has a 12-month history panel and
  per-category spent/allocated bars.
- Reports: `/reports/summary`, `/reports/breakdown` (category, payee, tag or
  method) and `/reports/transactions` for drill-down. Period presets, `All
  accounts` converted to the home currency and server-computed shares. Category breakdown
  uses split parts; the rest count whole transactions. Month indexes are 0-based
  (`second`: November = 10) from the provider to the API; the SPA keeps `YYYY-MM`
  and converts at the call boundary.

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
`?view=budgets&edit=1`, `?view=budgets&edit=1&periodOverride=1`, `?view=budgets&detail=1`, `?view=files`,
`?panel=split`, `?panel=transfer`, `?new=1`, `?new=1&kind=transfer`,
`?new=1&kind=split`, `?new=1&combo=1`, `?edit=simple`, `?edit=split`,
`?edit=transfer`, `?new=1&save=1`, `?theme=dark`, `?metrics=1`.

The mock writes simple transactions, budgets (allocations, rollover, period
override, duplicate), reports and file downloads. Transfers and splits can be
opened and edited visually, but saving them needs the real phone API. It tests
the SPA and the HTTP contract, not the Kotlin queries. The full guide lives in
`webui/webapp/README.md` (section **Probar sin el móvil**).

`MOCK_QA_SEED=1 npm run mock` serves six months of generated transactions
(categories, payees, methods, tags, states, transfers and splits with their own
parts) for volume QA; it is deterministic.

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
- A panel in a URL entry is generic (`useHistoryPanel`): the transaction
  detail, the transaction editor and the report drill-down use it. The budget
  detail/editor still open from state, so back leaves the screen instead of
  closing them.
- Budget detail and its filter need device checks that the mock cannot fake:
  January and a 12-month history (the two contract fixes), a split inside a
  budget counted once, and a budget created from the web with two categories and
  a state showing that same filter and spend in the Android app.
- Files are device-level: the route lives in `WebInputService` (`AppDirHelper`),
  so `ApiRoutesTest` does not cover it; verify on the phone.

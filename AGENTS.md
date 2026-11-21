# AGENTS.md

Read this before changing code. Detailed sources:

- `webui/API.md` — API contract.
- `webui/DESIGN.md` — visual system, components and screen patterns.
- `webui/webapp/README.md` — SPA dev/build and the mock server.
- `product-model/` — product and domain reference. `docs/` is the public website.

## Current state

- `/api/v1`: read endpoints plus create/update/delete for simple transactions,
  transfers and splits.
- API routes covered on the JVM by 115 tests — 89 `ApiRoutesTest`, 10
  `BalanceMathTest`, 7 `CategoryBranchTest`, 5 `LoginThrottleTest` and 4
  `SessionStoreTest` — with a fake `WebApiDataSource` and Ktor `testApplication`.
  The pure balance folding and reconciliation live in `BalanceMathTest`.
- SPA: dashboard, transactions, detail, the **Informes** section (six tabs),
  files, budgets, and the simple, transfer and split editors. The split editor uses signed amounts, a parts list
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
- Portfolios: `POST/PUT /portfolios` mirror `PortfolioSetupDialog`, with the
  licence limit on the server (`409 portfolio_limit_reached`); `GET
  /portfolios/{id}/assets` returns cash, assets and the valuation at the latest
  stored price, and `GET /portfolios/{id}/trades[/{tid}]` maps
  `Repository.loadTrades`. `GET /accounts` adds `portfolioRole`,
  `dynamicExchangeRates` and the container's `valuationMinor`; the SPA hides the
  sub-accounts (cash/assets) from the picker. The `+` editor is dual (Account |
  Portfolio), and the rail hides Budgets on a portfolio. The portfolio overview
  is the valuation hero plus cash/assets; Transacciones lists operations and
  opens their detail in a side panel. Trade writing goes through
  `POST/PUT /portfolios/{id}/trades` and the domain extracted from the
  ViewModel into `db2/RepositoryTrades.kt`, which the Android trade screens
  use too; the web editor mirrors `TradeIntent` and the mock applies the
  operation deltas in memory and creates the cash sub-account on the first
  operation, like the app. Editing an operation keeps its family (buy/sell,
  deposit/withdraw, transfer) and its funding source, like the Android editor;
  bank funding is limited to accounts in the portfolio currency, the portfolio
  needs a fiat currency and an operation a registered non-fiat asset
  (`422 unknown_asset`). The mock honours `?portfolioLimit=1` with
  `409 portfolio_limit_reached`.
- App data: `?view=datos` mirrors Android's Settings > Data with tabs for
  categories (tree, delete with remap), payment methods, tags, currencies
  (fiat and custom assets) and the manual price history. The writes go through
  `POST/PUT/DELETE /categories`, `/methods`, `/tags`, `/currencies` and
  `/prices` with the repository rules: `409 category_in_use` without
  `remapTo` (templates and budget allocations count too), same-type remap,
  `409 currency_still_used`, one manual price per commodity and date. The
  remap delegates to the app's `mergeCategories` (transactions, split parts,
  templates, change log, budget allocations) and updates the saved
  account/budget filters. Destructive deletes ask for confirmation. The rail's
  settings button opens it. A category's type is the app's mask (1 expense,
  2 income, 3 neutral) and a child inherits its parent's.
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
  and deep links open a filtered list. Every side panel is a history entry
  (`useHistoryPanel`): transaction detail and editor, report drill-down, the
  budget panel, the trade detail and editor, and the app-data editors. Back
  closes them; when two stack (detail + editor) only the top one closes. The
  account travels as
  `?accountId=` when a screen sends the user somewhere (the budget drill-down
  opens the budget's own account); without it the remembered account wins, and
  the topbar rewrites it with `replaceState` so the two never disagree.
- Search: `q` folds case and diacritics on both sides (`Cafetería` = `cafeteria`).
- Privacy: two topbar switches mask money as `€ ••••` (no digits in the DOM) —
  `totals` for net worth, KPIs, report and budget aggregates, the portfolio
  price and the manual price history, and the chart tooltip; `transactions` for
  row amounts, the detail panel and its parts, period sums, the amount filter
  chip, report drill-down and budget cards. Only the two booleans are synced
  through `/ui-preferences`; amounts never leave the local render. Open editors
  stay readable. Amounts render through `Money`/`useMoney` in
  `webui/webapp/src/privacy.tsx`; `formatMoney` and `maskedMoney` are in
  `format.ts`.
- Serialized selections: `theme`, `locale`, `accountId`, `grouping`, the two
  privacy switches and the screen choices (report month/range/breakdown/type/all
  accounts, budget month, transaction type) live in `localStorage` **and** on the
  phone behind `GET/PUT /api/v1/ui-preferences`, because every server start can
  expose another URL and localStorage is tied to the origin. `localStorage` is
  the first-paint cache and the offline fallback; at startup the server wins per
  key and a key the server never stored keeps the local one. The first contact
  with an empty server uploads the local choices once. The keys and validators
  are in `webui/webapp/src/uiPreferences.ts`; every write calls `scheduleUpload`
  (1 s debounce, flush with `keepalive` on `pagehide`). Mock QA switches only
  write when their parameter is present.
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
  collapses them behind `Filters (n)` on phones. `categoryId` means the category
  and every category below it, like the Android `CategoryCriterion`; a split
  counts when one of its parts falls in the branch. The list expands the tree on
  the server, so the SPA sends one id and the `total` already includes the
  subtree.
  The list is not tied to a month: the grouping (`NONE/DAY/WEEK/MONTH/YEAR`) is a
  visual choice kept in the URL and `localStorage`. Each period header carries
  its income, expenses and transfers from `/reports/grouped` **with the same
  type and filters as the list**, so a header never totals hidden rows
  (`firstDate` anchors rows to periods), and the range is just another filter
  (`Historial` by default, plus `Este mes`, `Últimos 3 meses`, `Este año` and a
  custom one).
- On phones the Datos tables hide the currency symbol and digits so the row
  actions stay inside the card; the bottom rail keeps all six sections,
  including Datos.
- Budgets have month navigation; monthly budgets load that month's progress,
  allocations and period total. Each budget has a 12-month history panel and
  per-category spent/allocated bars. A budget's saved category filter is the
  app's own `CategoryCriterion`, so its spend already covers the whole branch;
  the detail panel sends a single `categoryId` when it opens the matching
  transactions, and on the budget's account (`accountId` in the link), not the
  one the topbar happens to show.
- Reports: the `reports` view is the **Informes** section, with six tabs
  (Resumen, Gastos, Ingresos, Cuentas, Inversiones, Presupuestos), the tab,
  period, comparison, balance range/mode and the chart's account ids in the URL
  and in `ui-preferences`. The rail label is still Reports; no new rail item.
  `/reports/summary` adds `returnsMinor` (positive amounts on expense
  categories: spent = `|expenses| − returns`, income = `income − returns`,
  balance unchanged). `/reports/breakdown` accepts repeated `categoryId` with
  branch expansion and recomputes `totalMinor`/`share` on the filtered set;
  `grouped` accepts `accountId=all`; `/reports/transactions` accepts it too and
  keeps each row's currency.
  `/reports/balance-series` returns a dense per-account series (opening plus
  every parent movement before `from`, transfers signed per account, splits by
  parent, VOID/archived excluded) and totals **per currency** with
  `mixedCurrencies`; it never converts. Granularity auto = day ≤70 days, week
  ≤~30 months, month after; an explicit choice over ~400 points falls back.
  `/reports/investments` values each product at the last manual price, uses the
  weighted average BUY/SELL cost and hides the result when `costKnown` is
  false. The pure folding lives in `BalanceMath.kt` (`BalanceMathTest`); the
  last point reconciles with `currentBalanceMinor`.
  Category breakdown uses split parts; the rest count whole transactions. Month
  indexes are 0-based (`second`: November = 10) from the provider to the API;
  the SPA keeps `YYYY-MM` and converts at the call boundary.
- Reports UI: `ReportsSection` + `components/reports/*`, `LineChart` (own SVG,
  no chart dependency, hover/touch tooltip, toggleable legend, textual table,
  `prefers-reduced-motion`) and the extended `Chart` bars (day/week/month/year
  labels and a ghost previous-period bar). Filters are per view; the period and
  comparison are shared by Resumen/Gastos/Ingresos and never forced on
  Cuentas/Inversiones/Presupuestos.

## Build and verify

The host has no JDK or Android SDK. Run Android tasks in Docker:

- The container user comes from `HOST_UID`/`HOST_GID` in the repo-root `.env`
  (gitignored; `.env.example` is the committed template). They must match the
  user that owns the checkout, or gradle fails with git "dubious ownership"
  (`build.gradle:76`) and `/gradle-cache` permission errors. Compose passes
  them into the container as environment; `docker/docker-user.sh`, sourced by
  both entrypoints, starts as root, aligns `/home/builder` and the
  `myexpenses_gradle-cache` volume with that uid and drops privileges via
  `setpriv`, so no rebuild is needed when the ids change.
- Compile the web UI feature: `docker compose run --rm android-build :webui:compileDebugKotlin`
- Kotlin lint: `docker compose run --rm android-build :webui:ktlintCheck`
- Unit tests: `docker compose run --rm android-build :webui:testDebugUnitTest`
  (app tests follow the `extern` flavor, e.g. `:myExpenses:testExternDebugUnitTest`).
  API routes run on the JVM through `WebApiDataSource` + `testApplication`; the
  Android implementation and the provider stay device-level.
- Signed universal APK: `BUILD_VARIANT=release docker compose run --rm android-build`
  Output: `myExpenses/build/outputs/apk_from_bundle/externRelease/*universal-signed.apk`
- Every version bump (`versionCode`/`versionName` in the root `build.gradle`) is
  accompanied in the same commit by
  `metadata/en-US/changelogs/<versionCode>.txt` and
  `metadata/es-ES/changelogs/<versionCode>.txt` (see 892.txt for the format; correct
  Spanish in es-ES, English in en-US) **and** by the in-app what's-new entry in
  `myExpenses/src/main/res/values/version_info.xml`: a new
  `<item><versionCode>;<versionName></item>` at the top of the `versions` array
  plus a `whats_new_<versionName without dots>` string-array (e.g.
  `whats_new_416` for 4.1.6). The what's-new dialog reads those resources; a
  missing array logs "missing change log entry" and the dialog shows no text.

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
`?view=transactions`, `?view=transactions&filter=groceries`,
`?view=transactions&categoryId=1` (Food and its subcategories),
`?view=reports` (Resumen), `?view=reports&tab=expenses|income|accounts|investments|budgets`,
`&period=week|month|quarter|year|lastYear|custom`, `&compare=previous`,
`&balanceRange=y1&balanceMode=perAccount`, `&mixedCurrency=1`, `&noHistory=1`,
`&costUnknown=1`, `&emptyInvestments=1`, `&overBudget=1`,
`?view=budgets`, `?view=budgets&budgetMonth=-1`, `?view=budgets&new=1`,
`?view=budgets&edit=1`, `?view=budgets&edit=1&periodOverride=1`, `?view=budgets&detail=<id>`
(`3` = *Fuel*, *Joint*, con la app en otra cuenta), `?view=files`,
`?hidden=1|totals|transactions`, `?prefs=seed` (fixed server preferences),
`?panel=split`, `?panel=transfer`, `?new=1`, `?new=1&kind=transfer`,
`?new=1&kind=split`, `?new=1&combo=1`, `?edit=simple`, `?edit=split`,
`?edit=transfer`, `?new=1&save=1`, `?theme=dark`, `?metrics=1`.

The mock writes simple transactions, budgets (allocations, rollover, period
override, duplicate), reports, web UI preferences and file downloads. Transfers
and splits can be opened and edited visually, but saving them needs the real
phone API. It tests the SPA and the HTTP contract, not the Kotlin queries. The
full guide lives in `webui/webapp/README.md` (section **Probar sin el móvil**).
To reproduce the original bug, configure one origin of the same mock
(`http://localhost:4173/app/`), reload another (`http://127.0.0.1:4173/app/`)
and check that theme, language, grouping, account, the Informes tab/period/
comparison/balance controls and both privacy switches arrive.

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
- Informes: reconcile `balance-series` with `currentBalanceMinor` on a phone
  with real transfers (both legs), a split, a VOID and an opening balance; an
  operation dated in the past must only move the points after its date. Check
  `grouped?accountId=all` against the Android report, the weighted cost of a
  portfolio with a transfer-in (`costKnown:false`) and a big history for
  performance. The tab/period/compare/balance preferences must travel between
  origins and survive the server ignoring the retired `reportMonth`/`reportRange`
  keys.
- Portfolios need device QA the mock cannot fake: create one from the web and
  confirm the phone shows it exactly like one created in Android (type, currency,
  fixed/dynamic rate, colour); confirm the valuation matches `BalanceType.VALUATION`
  (cash plus assets at the latest stored price) and that the second portfolio
  answers `409` without the Professional licence. A trade of each kind created
  from the web must appear in the phone exactly like one created there
  (quantity, price, fee, funding, transfer between two portfolios) — the
  `RepositoryTrades` extraction must not change the Android save flow; bank
  funding from another currency must be rejected. The data screen also needs
  device QA: a remapped category must move templates, budget allocations and
  the saved account/budget filters like the Android merge, and an edited price
  from the web must show in the app at once.
- Budget detail and its filter need device checks that the mock cannot fake:
  January and a 12-month history (the two contract fixes), a split inside a
  budget counted once, and a budget created from the web with two categories and
  a state showing that same filter and spend in the Android app.
- Category branch: the SQL lives in the provider, so the phone must confirm that
  a parent category and a split give the same count and total as the Android
  app, and that a budget filtered by a parent opens its movements with one
  `categoryId`.
- Files are device-level: the route lives in `WebInputService` (`AppDirHelper`),
  so `ApiRoutesTest` does not cover it; verify on the phone.
- Web UI preferences are device-level too: the real path is DataStore
  (`RepositoryWebUi.kt`), while `ApiRoutesTest` uses the fake. On the phone,
  change something in one origin of the same server and reload another; the
  Android app and the web do not share `theme`/`locale` (different settings), and
  the last write per field is expected to win between concurrent tabs.

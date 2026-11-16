# Spec: Split transactions in period totals — V1

Status: approved (2026-11-16)
Scope: MyExpenses (Android), provider aggregation queries, preference, tests

## Objective

When the transaction list is grouped by month (or day/week/year), the group header shows the sum of
income, expenses and transfers for that period. Today these sums are computed from the individual
rows that make up a split transaction (its "parts"). If a split mixes directions
(e.g. `-40` expense + `+10` income, total `-30`), the header shows expenses `-40` and income `+10`
instead of the total `-30`.

Goal: a split transaction counts **once, with its total**, classified by the sign of the total
(negative → expenses, positive → income). This applies to **all calculations** where transactions
are aggregated into income / expenses / transfers, and to **all groupings**.

A settings switch restores the previous behaviour (each part counted separately), so users can
choose the strategy.

## Tech stack

Kotlin, Android, SQLite query builder (`SupportSQLiteDatabase`), Robolectric unit tests, AssertJ.

## Commands

Requires Java 21 and `ANDROID_HOME`.

```
Build debug:        ./gradlew :myExpenses:assembleExternDebug
Targeted tests:     ./gradlew :myExpenses:testExternDebugUnitTest --tests "org.totschnig.myexpenses.repository.GroupQueryTest"
Full unit tests:    ./gradlew :myExpenses:testExternDebugUnitTest
Formatting:         ./gradlew ktlintCheck
Static analysis:    ./gradlew detekt
```

## Project structure (relevant parts)

```
myExpenses/src/main/java/org/totschnig/myexpenses/provider/   -> SQL builders and ContentProvider
  SplitStrategy.kt                                            -> PARTS / TOTAL row selection
  DbConstants.kt                                              -> group, sum, account and archive CTEs
  BaseTransactionProvider.kt                                  -> query entry points and preference
  DatabaseConstants.kt                                        -> WHERE_NOT_SPLIT / WHERE_NOT_SPLIT_PART
myExpenses/src/main/java/org/totschnig/myexpenses/preference/  -> PrefKey
myExpenses/src/main/res/xml/preferences_ui.xml                 -> settings switch
myExpenses/src/test/java/org/totschnig/myexpenses/repository/  -> Robolectric DB/repository tests
```

## Current vs. new behaviour

`buildTransactionGroupCte` builds `cte_search` and aggregates it with `cat_id IS NOT SPLIT_CATID`,
i.e. the split parent is dropped and the parts are summed. `transactionSumQuery`, the account CTEs
and `archiveSumCTE` use the same parts-based row selection.

New behaviour (`SplitStrategy.TOTAL`, default):

- one row per split transaction: the parent row with its total; parts are ignored;
- expenses / income are derived from the sign of the total;
- transfer parts of a split no longer contribute to the transfer sum (the total is classified as a
  whole);
- non-split transactions are unchanged;
- delta and interim balance are unchanged (the parts already add up to the total);
- `KEY_MAPPED_CATEGORIES` stays true when the split has categorized parts;
- applies to month, week, day, year and none groupings;
- applies to the period groups (list headers, History chart, budgets, PDF, account widget), the
  account aggregate query (`buildAccountQuery`), the sums query (`transactionSumQuery`) and the
  archive detail sums (`archiveSumCTE`).

Previous behaviour (`SplitStrategy.PARTS`) is preserved behind the preference
`PrefKey.SPLIT_TRANSACTIONS_AS_TOTAL` (default `true`). The preference is read by the provider; a
single query can override it with `TransactionProvider.QUERY_PARAMETER_SPLIT_STRATEGY`.

Category-attributed queries (the category tree in the Distribution/budget detail) always aggregate
the parts, because the parent carries no category. The Distribution screen forces `PARTS` for its
own income/expense totals so its total matches the category rows.

## Code style

Follow the surrounding Kotlin/provider code: string templates for SQL, constants from
`DatabaseConstants`/`constants.kt`, no wildcard imports, 4-space indentation, ktlint clean.

```kotlin
append(" WHERE ${splitStrategy.rowClause} AND $WHERE_NOT_ARCHIVED AND $selection")
```

## Testing strategy

Robolectric unit tests in `repository/GroupQueryTest.kt` using `BaseTestWithRepository`,
`repository.createSplitTransaction(...)` and the shared cursor assertions (`useAndAssert`, `hasLong`,
`hasInt`).

Covered cases:

1. `-40` expense + `+10` income, total `-30`, TOTAL → expenses `-30`, income `0`.
2. Same split, PARTS → expenses `-40`, income `10`.
3. `-10` expense + `+40` income, total `+30`, TOTAL → income `30`, expenses `0`.
4. `-60` expense + `-40` transfer, total `-100`, TOTAL → expenses `-100`, transfers `0`.
5. `KEY_MAPPED_CATEGORIES` is `1` for a split with categorized parts in TOTAL mode.
6. Sums URI follows the preference and honours the per-query `PARTS` override.
7. Account aggregates (`ACCOUNTS_FULL_URI`) follow the preference, including the current balance.
8. Existing `GroupQueryTest`/`AccountSumTest` expectations still pass (no split transactions involved).

## Boundaries

- Always: run the targeted tests and `ktlintCheck`/`detekt`; keep query URIs and column names
  stable; keep the previous strategy available through the switch.
- Ask first: database schema changes or migrations; changing export formats.
- Never: rewrite stored split amounts/dates; remove category attribution of split parts.

## Success criteria

- With the switch on (default), a month containing only a split of `-30` (`-40` expense + `+10`
  income) shows expenses `-30`, income `0`, delta `-30`, for every grouping.
- The same rule is visible in account aggregates, sums and archive detail sums.
- With the switch off, the previous parts-based numbers are shown unchanged.
- `GroupQueryTest` covers cases 1–6 and passes.
- `ktlintCheck` and `detekt` pass.

## Out of scope (deferred)

- Row-level exports (CSV/JSON/PDF) keep exporting parts.
- Category attribution always needs parts; a mixed split remains visible per category in the
  Distribution screen while its total follows the switch.
- Data repair for legacy splits whose parent amount no longer equals the sum of parts.

## Resolved questions

1. Symptom confirmed: `-40` expense + `+10` income is currently split into both buckets instead of
   the total `-30`.
2. Whole total by sign; split transfer parts do not count as transfers in `TOTAL` mode.
3. Applies to split transactions for now (not to other aggregate cases).
4. Applies to all groupings.
5. The settings switch chooses between the new and the previous strategy; new is the default.

package org.totschnig.webui.api

import android.content.ContentResolver
import android.net.Uri
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.abs
import kotlin.math.roundToLong
import org.totschnig.myexpenses.db2.Repository
import org.totschnig.myexpenses.db2.entities.Transaction
import org.totschnig.myexpenses.db2.getCurrencyUnitForAccount
import org.totschnig.myexpenses.db2.loadTrades
import org.totschnig.myexpenses.model.AccountType
import org.totschnig.myexpenses.model.CrStatus
import org.totschnig.myexpenses.model.CurrencyContext
import org.totschnig.myexpenses.model.CurrencyUnit
import org.totschnig.myexpenses.model.Grouping
import org.totschnig.myexpenses.provider.BaseTransactionProvider
import org.totschnig.myexpenses.provider.CTE_SEARCH
import org.totschnig.myexpenses.provider.DataBaseAccount
import org.totschnig.myexpenses.provider.DatabaseConstants.WHERE_NOT_SPLIT_PART
import org.totschnig.myexpenses.provider.KEY_ACCOUNTID
import org.totschnig.myexpenses.provider.KEY_ACCOUNT_TYPE_LABEL
import org.totschnig.myexpenses.provider.KEY_ACCOUNT_TYPE_LIST
import org.totschnig.myexpenses.provider.KEY_AMOUNT
import org.totschnig.myexpenses.provider.KEY_BUDGET
import org.totschnig.myexpenses.provider.KEY_BUDGETID
import org.totschnig.myexpenses.provider.KEY_BUDGET_ROLLOVER_NEXT
import org.totschnig.myexpenses.provider.KEY_BUDGET_ROLLOVER_PREVIOUS
import org.totschnig.myexpenses.provider.KEY_CATID
import org.totschnig.myexpenses.provider.KEY_COLOR
import org.totschnig.myexpenses.provider.KEY_COMMENT
import org.totschnig.myexpenses.provider.KEY_COMMODITY
import org.totschnig.myexpenses.provider.KEY_CR_STATUS
import org.totschnig.myexpenses.provider.KEY_CURRENCY
import org.totschnig.myexpenses.provider.KEY_CURRENT_BALANCE
import org.totschnig.myexpenses.provider.KEY_DATE
import org.totschnig.myexpenses.provider.KEY_DISPLAY_AMOUNT
import org.totschnig.myexpenses.provider.KEY_DYNAMIC
import org.totschnig.myexpenses.provider.KEY_EXCLUDE_FROM_TOTALS
import org.totschnig.myexpenses.provider.KEY_FIRST_DATE
import org.totschnig.myexpenses.provider.KEY_IS_NUMBERED
import org.totschnig.myexpenses.provider.KEY_IS_PORTFOLIO
import org.totschnig.myexpenses.provider.KEY_LABEL
import org.totschnig.myexpenses.provider.KEY_LEVEL
import org.totschnig.myexpenses.provider.KEY_METHODID
import org.totschnig.myexpenses.provider.KEY_METHOD_LABEL
import org.totschnig.myexpenses.provider.KEY_OPENING_BALANCE
import org.totschnig.myexpenses.provider.KEY_PARENTID
import org.totschnig.myexpenses.provider.KEY_PATH
import org.totschnig.myexpenses.provider.KEY_PAYEEID
import org.totschnig.myexpenses.provider.KEY_PAYEE_NAME
import org.totschnig.myexpenses.provider.KEY_REFERENCE_NUMBER
import org.totschnig.myexpenses.provider.KEY_ROWID
import org.totschnig.myexpenses.provider.KEY_SEALED
import org.totschnig.myexpenses.provider.KEY_SECOND_GROUP
import org.totschnig.myexpenses.provider.KEY_STATUS
import org.totschnig.myexpenses.provider.KEY_SUM
import org.totschnig.myexpenses.provider.KEY_SUM_EXPENSES
import org.totschnig.myexpenses.provider.KEY_SUM_INCOME
import org.totschnig.myexpenses.provider.KEY_SUM_TRANSFERS
import org.totschnig.myexpenses.provider.KEY_TAGID
import org.totschnig.myexpenses.provider.KEY_TOTAL
import org.totschnig.myexpenses.provider.KEY_TRANSACTIONID
import org.totschnig.myexpenses.provider.KEY_TRANSFER_ACCOUNT
import org.totschnig.myexpenses.provider.KEY_TYPE
import org.totschnig.myexpenses.provider.KEY_TYPE_SORT_KEY
import org.totschnig.myexpenses.provider.KEY_VALUE
import org.totschnig.myexpenses.provider.KEY_YEAR
import org.totschnig.myexpenses.provider.PORTFOLIO_ASSET
import org.totschnig.myexpenses.provider.PORTFOLIO_CASH
import org.totschnig.myexpenses.provider.PORTFOLIO_CONTAINER
import org.totschnig.myexpenses.provider.PORTFOLIO_NONE
import org.totschnig.myexpenses.provider.SPLIT_CATID
import org.totschnig.myexpenses.provider.STATUS_ARCHIVED
import org.totschnig.myexpenses.provider.SplitStrategy
import org.totschnig.myexpenses.provider.TABLE_TRANSACTIONS
import org.totschnig.myexpenses.provider.TABLE_TRANSACTIONS_TAGS
import org.totschnig.myexpenses.provider.TransactionProvider
import org.totschnig.myexpenses.provider.TransactionProvider.QUERY_PARAMETER_GROUP_BY
import org.totschnig.myexpenses.provider.VIEW_EXTENDED
import org.totschnig.myexpenses.provider.filter.Criterion
import org.totschnig.myexpenses.provider.getBoolean
import org.totschnig.myexpenses.provider.getDouble
import org.totschnig.myexpenses.provider.getInt
import org.totschnig.myexpenses.provider.getIntIfExists
import org.totschnig.myexpenses.provider.getLong
import org.totschnig.myexpenses.provider.getLongIfExists
import org.totschnig.myexpenses.provider.getLongIfExistsOr0
import org.totschnig.myexpenses.provider.getLongOrNull
import org.totschnig.myexpenses.provider.getString
import org.totschnig.myexpenses.provider.getStringOrNull
import org.totschnig.myexpenses.provider.useAndMapToList
import org.totschnig.myexpenses.provider.withLimit
import org.totschnig.myexpenses.viewmodel.data.Trade
import org.totschnig.myexpenses.viewmodel.data.TradeType

/**
 * One account row of the full-projection query, plus the raw fields the
 * portfolio valuation needs.
 */
internal data class AccountRow(
    val dto: AccountDto,
    val currency: String,
    val currentBalanceMinor: Long,
    val parentId: Long?,
    /** Raw `is_portfolio` value: PORTFOLIO_NONE / CONTAINER / ASSET / CASH. */
    val portfolioRole: Int,
    val dynamicExchangeRates: Boolean
)

internal fun Repository.queryAccounts(
    currencyContext: CurrencyContext,
    id: Long? = null
): List<AccountDto> {
    val uri = TransactionProvider.ACCOUNTS_URI.buildUpon()
        .appendQueryParameter(
            TransactionProvider.QUERY_PARAMETER_FULL_PROJECTION_WITH_SUMS,
            "now"
        )
        .build()
    val fractionDigits = mutableMapOf<String, Int>()
    // The list hides sealed accounts; a single account is read as it is, so the
    // write endpoints can answer 409 for a sealed debt instead of a 404.
    val selection = if (id == null) "$KEY_SEALED = 0" else "$KEY_ROWID = ?"
    val args = if (id == null) null else arrayOf(id.toString())
    val rows = queryAccountRows(uri, selection, args, currencyContext, fractionDigits)
    // A single container still needs its children to compute the valuation;
    // the children are not part of the response, only the input of the sum.
    val valuationRows = if (id == null) {
        rows
    } else {
        queryAccountRows(uri, "$KEY_SEALED = 0", null, currencyContext, fractionDigits)
    }
    val prices = queryLatestPrices()
    return rows.map { row ->
        val valuation = if (row.portfolioRole == PORTFOLIO_CONTAINER) {
            containerValuation(row, valuationRows, prices)
        } else {
            null
        }
        row.dto.copy(valuationMinor = valuation)
    }
}

private fun Repository.queryAccountRows(
    uri: Uri,
    selection: String?,
    args: Array<String>?,
    currencyContext: CurrencyContext,
    fractionDigits: MutableMap<String, Int>
): List<AccountRow> = contentResolver.query(uri, null, selection, args, null)
    ?.useAndMapToList { cursor ->
        val currency = cursor.getString(KEY_CURRENCY)
        val rawType = cursor.getStringOrNull(KEY_ACCOUNT_TYPE_LABEL).orEmpty()
        val portfolioRole = cursor.getIntIfExists(KEY_IS_PORTFOLIO) ?: PORTFOLIO_NONE
        AccountRow(
            dto = AccountDto(
                id = cursor.getLong(KEY_ROWID),
                label = cursor.getString(KEY_LABEL),
                type = cursor.getStringOrNull(KEY_TYPE).orEmpty(),
                // Reserved names travel with their underscores stripped, so the
                // SPA can say CASH instead of _CASH_; custom names stay as-is.
                typeName = rawType.removeSurrounding("_"),
                openingBalanceMinor = cursor.getLongIfExistsOr0(KEY_OPENING_BALANCE),
                currency = currency,
                fractionDigits = fractionDigits.getOrPut(currency) {
                    runCatching { currencyContext[currency].fractionDigits }.getOrDefault(2)
                },
                currentBalanceMinor = cursor.getLongIfExistsOr0(KEY_CURRENT_BALANCE),
                totalMinor = cursor.getLongIfExistsOr0(KEY_TOTAL),
                incomeMinor = cursor.getLongIfExistsOr0(KEY_SUM_INCOME),
                expensesMinor = cursor.getLongIfExistsOr0(KEY_SUM_EXPENSES),
                excludeFromTotals = cursor.getBoolean(KEY_EXCLUDE_FROM_TOTALS),
                sealed = cursor.getBoolean(KEY_SEALED),
                color = cursor.getIntIfExists(KEY_COLOR) ?: 0,
                parentId = cursor.getLongOrNull(KEY_PARENTID),
                portfolioRole = when (portfolioRole) {
                    PORTFOLIO_CONTAINER -> "CONTAINER"
                    PORTFOLIO_ASSET -> "ASSET"
                    PORTFOLIO_CASH -> "CASH"
                    else -> "NONE"
                },
                dynamicExchangeRates = cursor.getBoolean(KEY_DYNAMIC)
            ),
            currency = currency,
            currentBalanceMinor = cursor.getLongIfExistsOr0(KEY_CURRENT_BALANCE),
            parentId = cursor.getLongOrNull(KEY_PARENTID),
            portfolioRole = portfolioRole,
            dynamicExchangeRates = cursor.getBoolean(KEY_DYNAMIC)
        )
    } ?: emptyList()

/**
 * Latest stored price per (commodity, base currency) pair, the same mapping
 * the app feeds into `FullAccount.enrich`: the raw table value relates minor
 * units of the two currencies.
 */
internal fun Repository.queryLatestPrices(): Map<Pair<String, String>, Double> =
    contentResolver.query(
        TransactionProvider.LATEST_PRICES_URI,
        arrayOf(KEY_COMMODITY, KEY_CURRENCY, KEY_VALUE),
        null,
        null,
        null
    )?.useAndMapToList { cursor ->
        Triple(
            cursor.getString(KEY_COMMODITY),
            cursor.getString(KEY_CURRENCY),
            cursor.getDouble(KEY_VALUE)
        )
    }?.associate { (commodity, base, value) -> (commodity to base) to value }
        ?: emptyMap()

/**
 * Valuation of a portfolio container: its own balance plus every child
 * converted at the latest price, exactly `FullAccount.effectiveBalance`.
 * A child in the portfolio's currency counts 1:1; an asset child uses the
 * latest stored price and falls back to 1.0 when none is stored, the same
 * fallback the app applies to asset sub-accounts.
 */
internal fun containerValuation(
    container: AccountRow,
    rows: List<AccountRow>,
    prices: Map<Pair<String, String>, Double>
): Long {
    val children = rows.filter { it.parentId == container.dto.id }
    val childrenValuation = children.sumOf { child ->
        (
            child.currentBalanceMinor *
                conversionRate(
                    child.currency,
                    child.dynamicExchangeRates,
                    container.currency,
                    prices
                )
            ).roundToLong()
    }
    return container.currentBalanceMinor + childrenValuation
}

internal fun conversionRate(
    childCurrency: String,
    childDynamic: Boolean,
    parentCurrency: String,
    prices: Map<Pair<String, String>, Double>
): Double = when {
    childCurrency == parentCurrency -> 1.0

    // Asset sub-accounts are always dynamic; without a stored price the app
    // falls back to an exchange rate of 1.0 (`FullAccount.enrich`).
    childDynamic -> prices[childCurrency to parentCurrency] ?: 1.0

    else -> 1.0
}

internal fun Repository.queryAccountTypes(): List<AccountTypeDto> =
    contentResolver.query(
        TransactionProvider.ACCOUNT_TYPES_URI,
        null,
        null,
        null,
        "$KEY_TYPE_SORT_KEY DESC"
    )?.useAndMapToList { cursor ->
        val type = AccountType.fromCursor(cursor)
        AccountTypeDto(
            id = type.id,
            name = type.nameForSyncLegacy,
            isAsset = type.isAsset,
            supportsReconciliation = type.supportsReconciliation
        )
    } ?: emptyList()

internal fun Repository.queryCategories(): List<CategoryDto> {
    val uri = TransactionProvider.CATEGORIES_URI.buildUpon()
        .appendQueryParameter(TransactionProvider.QUERY_PARAMETER_HIERARCHICAL, "1")
        .build()
    return contentResolver.query(
        uri,
        arrayOf(KEY_ROWID, KEY_PARENTID, KEY_LABEL, KEY_LEVEL, KEY_COLOR, KEY_TYPE),
        null,
        null,
        null
    )?.useAndMapToList { cursor ->
        CategoryDto(
            id = cursor.getLong(KEY_ROWID),
            parentId = cursor.getLongOrNull(KEY_PARENTID),
            label = cursor.getString(KEY_LABEL),
            level = cursor.getIntIfExists(KEY_LEVEL) ?: 0,
            color = cursor.getIntIfExists(KEY_COLOR),
            type = cursor.getIntIfExists(KEY_TYPE)
        )
    } ?: emptyList()
}

internal fun Repository.queryPayees(): List<PayeeDto> =
    contentResolver.query(
        TransactionProvider.PAYEES_URI,
        arrayOf(KEY_ROWID, KEY_PAYEE_NAME),
        "$KEY_PARENTID IS NULL",
        null,
        null
    )?.useAndMapToList { cursor ->
        PayeeDto(
            id = cursor.getLong(KEY_ROWID),
            name = cursor.getString(KEY_PAYEE_NAME)
        )
    } ?: emptyList()

internal fun Repository.queryTags(): List<TagDto> =
    contentResolver.query(
        TransactionProvider.TAGS_URI,
        arrayOf(KEY_ROWID, KEY_LABEL, KEY_COLOR),
        null,
        null,
        null
    )?.useAndMapToList { cursor ->
        TagDto(
            id = cursor.getLong(KEY_ROWID),
            label = cursor.getString(KEY_LABEL),
            color = cursor.getIntIfExists(KEY_COLOR)
        )
    } ?: emptyList()

internal fun Repository.queryMethods(): List<MethodDto> =
    contentResolver.query(
        TransactionProvider.METHODS_URI,
        arrayOf(KEY_ROWID, KEY_LABEL, KEY_IS_NUMBERED, KEY_TYPE, KEY_ACCOUNT_TYPE_LIST),
        null,
        null,
        null
    )?.useAndMapToList { cursor ->
        MethodDto(
            id = cursor.getLong(KEY_ROWID),
            label = cursor.getString(KEY_LABEL),
            isNumbered = cursor.getBoolean(KEY_IS_NUMBERED),
            type = cursor.getInt(KEY_TYPE),
            accountTypes = cursor.getStringOrNull(KEY_ACCOUNT_TYPE_LIST)
                ?.split(',')
                ?.filter { it.isNotBlank() }
                ?: emptyList()
        )
    } ?: emptyList()

internal fun Repository.queryBudgetAllocations(
    budgetId: Long,
    year: Int?,
    second: Int?,
    from: LocalDate,
    to: LocalDate,
    criteria: Criterion? = null
): List<BudgetAllocationDto> {
    val builder = TransactionProvider.CATEGORIES_URI.buildUpon()
        .appendQueryParameter(TransactionProvider.QUERY_PARAMETER_HIERARCHICAL, "1")
        .appendQueryParameter(KEY_TYPE, "false")
        .appendQueryParameter(KEY_BUDGETID, budgetId.toString())
    if (year != null && second != null) {
        builder.appendQueryParameter(KEY_YEAR, year.toString())
        builder.appendQueryParameter(KEY_SECOND_GROUP, second.toString())
    }
    val uri = builder.build()
    val projection = arrayOf(
        KEY_ROWID,
        KEY_LABEL,
        KEY_PARENTID,
        KEY_LEVEL,
        KEY_SUM,
        KEY_BUDGET,
        KEY_BUDGET_ROLLOVER_PREVIOUS,
        KEY_BUDGET_ROLLOVER_NEXT
    )
    val (dateClause, dateArgs) = dateSelection(from, to)
    // The budget criteria are applied to the transaction CTE, exactly as
    // `sumLoaderForBudget` does, so the per-category spend belongs to the
    // budget and not to the whole account. `getSelectionArgs(true)` mirrors the
    // duplicated placeholders of `getSelectionForParts`.
    val clauses = listOfNotNull(dateClause, criteria?.getSelectionForParts())
    val args = listOfNotNull(
        dateArgs?.toList(),
        criteria?.getSelectionArgs(true)?.toList()
    ).flatten().toTypedArray()
    return contentResolver.query(uri, projection, clauses.joinToString(" AND "), args, null)
        ?.useAndMapToList { cursor ->
            BudgetAllocationDto(
                categoryId = cursor.getLong(KEY_ROWID),
                label = cursor.getString(KEY_LABEL),
                parentId = cursor.getLongOrNull(KEY_PARENTID),
                level = cursor.getInt(KEY_LEVEL),
                spentMinor = abs(cursor.getLongIfExistsOr0(KEY_SUM)),
                allocatedMinor = cursor.getLongIfExistsOr0(KEY_BUDGET),
                rolloverPreviousMinor = cursor.getLongIfExistsOr0(KEY_BUDGET_ROLLOVER_PREVIOUS),
                rolloverNextMinor = cursor.getLongIfExistsOr0(KEY_BUDGET_ROLLOVER_NEXT)
            )
        }
        ?.filter { it.categoryId > 0 }
        ?: emptyList()
}

internal fun Repository.queryReportTransactions(
    accountId: Long?,
    by: String,
    groupId: Long,
    type: String,
    from: LocalDate,
    to: LocalDate,
    limit: Int,
    offset: Int
): Pair<List<Transaction>, Long> {
    val wholeTransactions = by != "category"
    val (baseSelection, baseArgs) =
        reportSelection(accountId, from, to, type, wholeTransactions)
    val selection: String
    val args: Array<String>
    when (by) {
        "category" -> {
            selection = "$baseSelection AND $KEY_CATID = ?"
            args = (baseArgs ?: emptyArray()) + groupId.toString()
        }

        "payee" -> {
            // coalesce() drops the column affinity, so "0" would be compared as text
            // and the "no payee" group would come back empty.
            selection = "$baseSelection AND coalesce($KEY_PAYEEID, 0) = CAST(? AS INTEGER)"
            args = (baseArgs ?: emptyArray()) + groupId.toString()
        }

        "method" -> {
            selection = "$baseSelection AND coalesce($KEY_METHODID, 0) = CAST(? AS INTEGER)"
            args = (baseArgs ?: emptyArray()) + groupId.toString()
        }

        else -> {
            selection = "$baseSelection AND EXISTS (" +
                "SELECT 1 FROM $TABLE_TRANSACTIONS_TAGS tag_link " +
                "WHERE tag_link.$KEY_TRANSACTIONID = $VIEW_EXTENDED.$KEY_ROWID " +
                "AND tag_link.$KEY_TAGID = ?)"
            args = (baseArgs ?: emptyArray()) + groupId.toString()
        }
    }
    val total = contentResolver.query(
        TransactionProvider.EXTENDED_URI,
        arrayOf("count(*)"),
        selection,
        args,
        null
    )?.use { if (it.moveToFirst()) it.getLong(0) else 0L } ?: 0L
    val items = contentResolver.query(
        TransactionProvider.EXTENDED_URI.buildUpon()
            .appendQueryParameter(ContentResolver.QUERY_ARG_LIMIT, limit.toString())
            .appendQueryParameter(ContentResolver.QUERY_ARG_OFFSET, offset.toString())
            .build(),
        Transaction.projection,
        selection,
        args,
        null
    )?.useAndMapToList { Transaction.fromCursor(it) } ?: emptyList()
    return items to total
}

internal fun Repository.queryReportSummary(
    accountId: Long?,
    from: LocalDate,
    to: LocalDate,
    unit: CurrencyUnit,
    allAccounts: Boolean
): ReportSummaryDto {
    val amountColumn = if (allAccounts) KEY_DISPLAY_AMOUNT else KEY_AMOUNT
    // display_amount is only defined inside the cte the provider builds for list
    // queries, and only it carries the home-currency equivalent.
    val (uri, alias) = if (allAccounts) {
        DataBaseAccount.uriBuilderForTransactionList(shortenComment = false, extended = true)
            .build() to CTE_SEARCH
    } else {
        TransactionProvider.EXTENDED_URI to VIEW_EXTENDED
    }
    val (selection, args) =
        reportSelection(accountId, from, to, "both", wholeTransactions = true, alias = alias)
    val projection = arrayOf(
        "sum(CASE WHEN $KEY_AMOUNT > 0 THEN $amountColumn ELSE 0 END) AS income",
        "sum(CASE WHEN $KEY_AMOUNT < 0 THEN $amountColumn ELSE 0 END) AS expenses",
        "count(*) AS transactions"
    )
    val (income, expenses, count) = contentResolver.query(
        uri,
        projection,
        selection,
        args,
        null
    )?.use { cursor ->
        if (!cursor.moveToFirst()) {
            Triple(0L, 0L, 0L)
        } else {
            Triple(cursor.getLong(0), cursor.getLong(1), cursor.getLong(2))
        }
    } ?: Triple(0L, 0L, 0L)
    // A positive amount booked on an expense category is a refund: it nets the
    // expense KPI, never the income one. Split parts count through their own
    // category, so the parent with the technical split category is skipped.
    val expenseCategories = expenseCategoryIds(queryCategories())
    val returns = if (expenseCategories.isEmpty()) {
        0L
    } else {
        val (returnsSelection, returnsArgs) = reportSelection(
            accountId,
            from,
            to,
            "both",
            wholeTransactions = false,
            alias = alias
        )
        val placeholders = expenseCategories.joinToString(",")
        val selection = "$returnsSelection AND $KEY_AMOUNT > 0 " +
            "AND $KEY_CATID IN ($placeholders) " +
            "AND ($KEY_PARENTID IS NOT NULL OR $KEY_CATID IS NOT $SPLIT_CATID)"
        contentResolver.query(
            uri,
            arrayOf("sum($amountColumn)"),
            selection,
            returnsArgs,
            null
        )?.use { cursor -> if (cursor.moveToFirst()) cursor.getLong(0) else 0L } ?: 0L
    }
    return ReportSummaryDto(
        accountId = accountId ?: 0,
        from = from.toString(),
        to = to.toString(),
        currency = unit.code,
        fractionDigits = unit.fractionDigits,
        incomeMinor = income,
        expensesMinor = expenses,
        netMinor = income + expenses,
        count = count,
        returnsMinor = returns
    )
}

/** The app's category mask: 1 expense, 2 income, 3 neutral; a child inherits. */
internal fun expenseCategoryIds(categories: List<CategoryDto>): Set<Long> {
    val byId = categories.associateBy { it.id }
    val resolved = mutableMapOf<Long, Int?>()
    fun typeOf(id: Long, seen: MutableSet<Long> = mutableSetOf()): Int? {
        if (resolved.containsKey(id)) return resolved[id]
        val category = byId[id] ?: return null
        if (!seen.add(id)) return category.type
        val type = category.type ?: category.parentId?.let { typeOf(it, seen) }
        resolved[id] = type
        return type
    }
    return categories.filter { typeOf(it.id) == 1 }.map { it.id }.toSet()
}

/**
 * Historical balance of the selected accounts.
 *
 * One aggregated query returns the signed movement per account and day plus one
 * query returns the movements before `from`; the dense folding is pure Kotlin.
 * Splits count as their parent for the balance (the parts would double-count),
 * transfers keep their signed amount per account and cancelled or archived rows
 * are excluded, exactly like the provider's current balance.
 */
internal fun Repository.queryBalanceSeries(
    accounts: List<AccountDto>,
    from: LocalDate,
    to: LocalDate,
    requestedGranularity: String
): BalanceSeriesDto {
    val ids = accounts.map { it.id }
    val (granularity, fallback) = resolveBalanceGranularity(requestedGranularity, from, to)
    val zone = ZoneId.systemDefault()
    val fromEpoch = from.atStartOfDay(zone).toEpochSecond()
    val toEpoch = to.plusDays(1).atStartOfDay(zone).toEpochSecond()
    val base = "$KEY_ACCOUNTID IN (${ids.joinToString(",")}) AND $KEY_PARENTID IS NULL " +
        "AND $KEY_CR_STATUS != '${CrStatus.VOID.name}' AND $KEY_STATUS != $STATUS_ARCHIVED"

    val prior = mutableMapOf<Long, Long>()
    contentResolver.query(
        TransactionProvider.EXTENDED_URI,
        arrayOf(KEY_ACCOUNTID, "sum($KEY_AMOUNT)"),
        "$base AND $KEY_DATE < ?",
        arrayOf(fromEpoch.toString()),
        "$KEY_ACCOUNTID"
    )?.use { cursor ->
        while (cursor.moveToNext()) {
            prior[cursor.getLong(0)] = cursor.getLong(1)
        }
    }

    val firstDates = mutableMapOf<Long, String>()
    contentResolver.query(
        TransactionProvider.EXTENDED_URI,
        arrayOf(KEY_ACCOUNTID, "min($KEY_DATE)"),
        base,
        null,
        "$KEY_ACCOUNTID"
    )?.use { cursor ->
        while (cursor.moveToNext()) {
            firstDates[cursor.getLong(0)] =
                Instant.ofEpochSecond(cursor.getLong(1)).atZone(zone).toLocalDate().toString()
        }
    }

    val daysByAccount = mutableMapOf<Long, MutableList<BalanceDay>>()
    val incomeByAccount = mutableMapOf<Long, Long>()
    val expenseByAccount = mutableMapOf<Long, Long>()
    contentResolver.query(
        TransactionProvider.EXTENDED_URI,
        arrayOf(
            KEY_ACCOUNTID,
            "strftime('%Y-%m-%d', $KEY_DATE, 'unixepoch', 'localtime') AS day",
            "sum($KEY_AMOUNT)",
            "sum(CASE WHEN $KEY_TRANSFER_ACCOUNT IS NULL AND $KEY_AMOUNT > 0 " +
                "THEN $KEY_AMOUNT ELSE 0 END)",
            "sum(CASE WHEN $KEY_TRANSFER_ACCOUNT IS NULL AND $KEY_AMOUNT < 0 " +
                "THEN $KEY_AMOUNT ELSE 0 END)"
        ),
        "$base AND $KEY_DATE >= ? AND $KEY_DATE < ?",
        arrayOf(fromEpoch.toString(), toEpoch.toString()),
        "$KEY_ACCOUNTID, day"
    )?.use { cursor ->
        while (cursor.moveToNext()) {
            val accountId = cursor.getLong(0)
            val date = LocalDate.parse(cursor.getString(1))
            val amount = cursor.getLong(2)
            val income = cursor.getLong(3)
            val expense = cursor.getLong(4)
            daysByAccount.getOrPut(accountId) { mutableListOf() }
                .add(BalanceDay(date, amount, income, expense))
            incomeByAccount[accountId] = (incomeByAccount[accountId] ?: 0L) + income
            expenseByAccount[accountId] = (expenseByAccount[accountId] ?: 0L) + expense
        }
    }

    val series = accounts.map { account ->
        val start = account.openingBalanceMinor + (prior[account.id] ?: 0L)
        BalanceAccountSeriesDto(
            id = account.id,
            label = account.label,
            color = account.color,
            currency = account.currency,
            fractionDigits = account.fractionDigits,
            startBalanceMinor = start,
            firstTransactionDate = firstDates[account.id],
            periodIncomeMinor = incomeByAccount[account.id] ?: 0L,
            periodExpensesMinor = expenseByAccount[account.id] ?: 0L,
            series = foldBalanceSeries(
                start,
                daysByAccount[account.id] ?: emptyList(),
                from,
                to,
                granularity
            )
        )
    }

    val totals = accounts
        .map { it.currency }
        .distinct()
        .map { currency ->
            val ofCurrency = series.filter { it.currency == currency }
            val first = accounts.first { it.currency == currency }
            CurrencyBalanceTotalDto(
                currency = currency,
                fractionDigits = first.fractionDigits,
                startBalanceMinor = ofCurrency.sumOf { it.startBalanceMinor },
                periodIncomeMinor = ofCurrency.sumOf { it.periodIncomeMinor },
                periodExpensesMinor = ofCurrency.sumOf { it.periodExpensesMinor },
                series = totalBalanceSeries(ofCurrency.map { it.series })
            )
        }

    return BalanceSeriesDto(
        from = from.toString(),
        to = to.toString(),
        granularity = granularity.name,
        granularityFallback = fallback,
        mixedCurrencies = totals.size > 1,
        currencies = accounts.map { it.currency }.distinct().map { currency ->
            CurrencyRefDto(currency, accounts.first { it.currency == currency }.fractionDigits)
        },
        accounts = series,
        totals = totals
    )
}

private data class PricePoint(val value: Double, val date: String)

private fun Repository.latestPricesWithDate(): Map<Pair<String, String>, PricePoint> =
    contentResolver.query(
        TransactionProvider.LATEST_PRICES_URI,
        arrayOf(KEY_COMMODITY, KEY_CURRENCY, KEY_DATE, KEY_VALUE),
        null,
        null,
        null
    )?.useAndMapToList { cursor ->
        Triple(
            cursor.getString(KEY_COMMODITY) to cursor.getString(KEY_CURRENCY),
            cursor.getDouble(KEY_VALUE),
            cursor.getString(KEY_DATE)
        )
    }?.associate { (pair, value, date) -> pair to PricePoint(value, date) } ?: emptyMap()

private data class CostBasis(val quantityMinor: Long, val costMinor: Long?, val known: Boolean)

/**
 * Weighted average cost over BUY/SELL, the criterion the app's trade editor
 * presents. Units arriving through a transfer have no purchase price, so the
 * basis is marked unknown instead of inventing one.
 */
private fun costBasis(trades: List<Trade>): CostBasis {
    var quantity = 0L
    var cost = 0L
    var known = true
    trades.sortedBy { it.date }.forEach { trade ->
        val moved = trade.quantity.amountMinor
        when (val type = trade.type) {
            is TradeType.AssetTrade -> {
                if (type.isIncoming) {
                    if (moved > 0) {
                        cost += trade.principal.amountMinor +
                            (trade.fee?.amountMinor ?: 0L)
                        quantity += moved
                    }
                } else if (quantity > 0) {
                    val sold = moved.coerceAtMost(quantity)
                    val average = cost.toDouble() / quantity
                    cost -= (average * sold).roundToLong().coerceAtMost(cost)
                    quantity -= sold
                }
            }

            is TradeType.Transfer -> {
                if (type.isIncoming) {
                    if (moved > 0) {
                        quantity += moved
                        known = false
                    }
                } else if (quantity > 0) {
                    val out = moved.coerceAtMost(quantity)
                    if (out == quantity) {
                        cost = 0
                    } else {
                        val average = cost.toDouble() / quantity
                        cost -= (average * out).roundToLong().coerceAtMost(cost)
                    }
                    quantity -= out
                }
            }

            else -> Unit
        }
    }
    if (quantity <= 0) return CostBasis(0L, 0L, known)
    return CostBasis(quantity, if (known) cost else null, known)
}

/**
 * Aggregate dashboard of every portfolio, valued at the last manual price.
 * Nothing here is a live quote: `lastValuationDate` is always the date the user
 * entered the price.
 */
internal fun Repository.queryInvestments(currencyContext: CurrencyContext): InvestmentsDto {
    val rows = queryAccounts(currencyContext)
    val prices = latestPricesWithDate()
    val home = currencyContext.homeCurrencyString
    val portfolios = rows.filter { it.portfolioRole == "CONTAINER" }.map { container ->
        val children = rows.filter { it.parentId == container.id }
        val cash = children.firstOrNull { it.portfolioRole == "CASH" }
        val assetRows = children.filter { it.portfolioRole == "ASSET" }
        val tradeIds = contentResolver.query(
            TransactionProvider.TRANSACTIONS_URI.buildUpon()
                .appendQueryParameter(KEY_ACCOUNTID, container.id.toString())
                .appendQueryParameter(TransactionProvider.QUERY_PARAMETER_SEARCH, "1")
                .build(),
            arrayOf(KEY_ROWID),
            WHERE_NOT_SPLIT_PART,
            null,
            null
        )?.useAndMapToList { it.getLong(KEY_ROWID) } ?: emptyList()
        val tradesBySymbol = loadTrades(tradeIds).groupBy { it.assetSymbol }
        val assets = assetRows.map { child ->
            val price = prices[child.currency to container.currency]
            val rate = conversionRate(
                child.currency,
                child.dynamicExchangeRates,
                container.currency,
                prices.mapValues { it.value.value }
            )
            val valuation = (child.currentBalanceMinor * rate).roundToLong()
            val basis = costBasis(tradesBySymbol[child.currency].orEmpty())
            InvestmentAssetDto(
                symbol = child.currency,
                label = child.label,
                fractionDigits = child.fractionDigits,
                quantityMinor = child.currentBalanceMinor,
                priceMinor = price?.value,
                lastPriceDate = price?.date,
                valuationMinor = valuation,
                costKnown = basis.known,
                costMinor = basis.costMinor,
                resultMinor = basis.costMinor?.let { valuation - it }
            )
        }
        val knownCost = assets.all { it.costKnown }
        val cost = if (knownCost) assets.sumOf { it.costMinor ?: 0L } else null
        val valuation = container.valuationMinor ?: container.currentBalanceMinor
        InvestmentPortfolioDto(
            id = container.id,
            label = container.label,
            currency = container.currency,
            fractionDigits = container.fractionDigits,
            cashMinor = cash?.currentBalanceMinor ?: 0,
            valuationMinor = valuation,
            costKnown = knownCost,
            costMinor = cost,
            resultMinor = cost?.let { valuation - it },
            lastValuationDate = assets.mapNotNull { it.lastPriceDate }.maxOrNull(),
            assets = assets
        )
    }
    val totals = portfolios.map { it.currency }.distinct().map { currency ->
        val matching = portfolios.filter { it.currency == currency }
        val known = matching.all { it.costKnown }
        val cost = if (known) matching.sumOf { it.costMinor ?: 0L } else null
        val valuation = matching.sumOf { it.valuationMinor }
        CurrencyInvestmentTotalDto(
            currency = currency,
            fractionDigits = matching.first().fractionDigits,
            valuationMinor = valuation,
            costKnown = known,
            costMinor = cost,
            resultMinor = cost?.let { valuation - it }
        )
    }
    return InvestmentsDto(homeCurrency = home, portfolios = portfolios, totals = totals)
}

internal fun Repository.queryBreakdown(
    accountId: Long?,
    by: String,
    type: String,
    from: LocalDate,
    to: LocalDate,
    unit: CurrencyUnit,
    allAccounts: Boolean,
    categoryIds: List<Long> = emptyList()
): BreakdownDto {
    val amountColumn = if (allAccounts) KEY_DISPLAY_AMOUNT else KEY_AMOUNT
    val (baseUri, alias) = if (allAccounts) {
        DataBaseAccount.uriBuilderForTransactionList(shortenComment = false, extended = true)
            .build() to CTE_SEARCH
    } else {
        TransactionProvider.EXTENDED_URI to VIEW_EXTENDED
    }
    val items = when (by) {
        "category", "payee", "method" -> queryGroupedBreakdown(
            accountId,
            by,
            type,
            from,
            to,
            amountColumn,
            baseUri,
            alias,
            if (by == "category") categoryIds else emptyList()
        )

        "tag" -> queryTagBreakdown(
            accountId,
            type,
            from,
            to,
            amountColumn,
            baseUri,
            alias
        )

        else -> throw IllegalArgumentException("Unknown breakdown $by")
    }
    // Methods group by id and carry the technical name in the view; the
    // localized label comes from the methods table.
    val labelled = if (by == "method") {
        val labels = queryMethods().associate { it.id to it.label }
        items.map { it.copy(label = labels[it.id] ?: it.label) }
    } else {
        items
    }
    val total = labelled.sumOf { it.amountMinor }
    val withShare = labelled.map {
        it.copy(share = if (total > 0) it.amountMinor * 100.0 / total else 0.0)
    }.sortedWith(compareByDescending<BreakdownItemDto> { it.amountMinor }.thenBy { it.label })
    return BreakdownDto(
        accountId = accountId ?: 0,
        from = from.toString(),
        to = to.toString(),
        by = by,
        type = type,
        currency = unit.code,
        fractionDigits = unit.fractionDigits,
        totalMinor = total,
        items = withShare
    )
}

private fun Repository.queryGroupedBreakdown(
    accountId: Long?,
    by: String,
    type: String,
    from: LocalDate,
    to: LocalDate,
    amountColumn: String,
    baseUri: Uri,
    alias: String,
    categoryIds: List<Long>
): List<BreakdownItemDto> {
    val wholeTransactions = by != "category"
    val (baseSelection, args) =
        reportSelection(accountId, from, to, type, wholeTransactions, alias)
    // A split parent holds the total while its parts hold the categories, so the
    // parent must stay out. Uncategorized rows (catid null or 0) must stay in:
    // dropping them made the category report total disagree with the summary.
    val selection = if (by == "category") {
        val branch = if (categoryIds.isEmpty()) {
            ""
        } else {
            " AND $KEY_CATID IN (${categoryIds.joinToString(",")})"
        }
        "$baseSelection AND $KEY_CATID IS NOT $SPLIT_CATID$branch"
    } else {
        baseSelection
    }
    val projection: Array<String>
    val groupBy: String
    when (by) {
        "category" -> {
            projection = arrayOf(
                "$KEY_CATID AS group_id",
                "CASE WHEN $KEY_CATID IS NULL OR $KEY_CATID <= 0 THEN 'No category' " +
                    "ELSE coalesce($KEY_PATH, 'Category ' || $KEY_CATID) END AS group_label",
                "sum($amountColumn) AS amount_minor",
                "count(*) AS transaction_count"
            )
            groupBy = "$KEY_CATID, $KEY_PATH"
        }

        "payee" -> {
            projection = arrayOf(
                "coalesce($KEY_PAYEEID, 0) AS group_id",
                "coalesce($KEY_PAYEE_NAME, 'No payee') AS group_label",
                "sum($amountColumn) AS amount_minor",
                "count(*) AS transaction_count"
            )
            groupBy = "coalesce($KEY_PAYEEID, 0), coalesce($KEY_PAYEE_NAME, 'No payee')"
        }

        else -> {
            projection = arrayOf(
                "coalesce($KEY_METHODID, 0) AS group_id",
                "coalesce($KEY_METHOD_LABEL, 'No method') AS group_label",
                "sum($amountColumn) AS amount_minor",
                "count(*) AS transaction_count"
            )
            groupBy = "coalesce($KEY_METHODID, 0), coalesce($KEY_METHOD_LABEL, 'No method')"
        }
    }
    val uri = baseUri.buildUpon()
        .appendQueryParameter(QUERY_PARAMETER_GROUP_BY, groupBy)
        .build()
    return contentResolver.query(uri, projection, selection, args, null)
        ?.useAndMapToList { cursor ->
            BreakdownItemDto(
                id = cursor.getLong(0),
                label = cursor.getString(1) ?: "",
                amountMinor = abs(cursor.getLong(2)),
                count = cursor.getLong(3),
                share = 0.0
            )
        } ?: emptyList()
}

private fun Repository.queryTagBreakdown(
    accountId: Long?,
    type: String,
    from: LocalDate,
    to: LocalDate,
    amountColumn: String,
    baseUri: Uri,
    alias: String
): List<BreakdownItemDto> = queryTags().mapNotNull { tag ->
    val (baseSelection, baseArgs) =
        reportSelection(accountId, from, to, type, wholeTransactions = true, alias = alias)
    val selection = "$baseSelection AND EXISTS (" +
        "SELECT 1 FROM $TABLE_TRANSACTIONS_TAGS tag_link " +
        "WHERE tag_link.$KEY_TRANSACTIONID = $alias.$KEY_ROWID " +
        "AND tag_link.$KEY_TAGID = ?)"
    val args = (baseArgs ?: emptyArray()) + tag.id.toString()
    contentResolver.query(
        baseUri,
        arrayOf("sum($amountColumn) AS amount_minor", "count(*) AS transaction_count"),
        selection,
        args,
        null
    )?.use { cursor ->
        if (!cursor.moveToFirst()) return@use null
        val amount = abs(cursor.getLong(0))
        val count = cursor.getLong(1)
        if (count == 0L) {
            null
        } else {
            BreakdownItemDto(
                id = tag.id,
                label = tag.label,
                amountMinor = amount,
                count = count,
                share = 0.0
            )
        }
    }
}

private fun reportSelection(
    accountId: Long?,
    from: LocalDate,
    to: LocalDate,
    type: String,
    wholeTransactions: Boolean,
    alias: String = VIEW_EXTENDED
): Pair<String, Array<String>?> {
    val clauses = mutableListOf<String>()
    val args = mutableListOf<String>()
    // With no account the provider adds its own "exclude accounts that are not in
    // totals" selector, so we must not reference a column of another table here.
    accountId?.let {
        clauses.add("$alias.$KEY_ACCOUNTID = ?")
        args.add(it.toString())
    }
    clauses.add("$alias.$KEY_CR_STATUS != ?")
    args.add(CrStatus.VOID.name)
    clauses.add("$alias.$KEY_TRANSFER_ACCOUNT IS NULL")
    appendDateRange(clauses, args, from, to, alias)
    when (type) {
        "income" -> clauses.add("$KEY_AMOUNT > 0")
        "expense" -> clauses.add("$KEY_AMOUNT < 0")
    }
    if (wholeTransactions) clauses.add("$KEY_PARENTID IS NULL")
    return clauses.joinToString(" AND ") to args.takeIf { it.isNotEmpty() }?.toTypedArray()
}

/**
 * Period groups. A null [accountId] asks the provider for the home-currency
 * total of every account included in totals, which is the only correct way to
 * aggregate accounts in different currencies.
 */
internal fun Repository.queryTransactionGroups(
    accountId: Long?,
    grouping: Grouping,
    from: LocalDate,
    to: LocalDate,
    type: String?,
    filters: TransactionQueryFilters
): List<GroupDto> {
    val unfiltered = filters.isEmpty && (type == null || type == "both")
    val uri = BaseTransactionProvider.groupingUriBuilder(grouping)
        .apply {
            accountId?.takeIf { it > 0 }?.let {
                appendQueryParameter(KEY_ACCOUNTID, it.toString())
            }
        }
        .appendQueryParameter(KEY_FIRST_DATE, "1")
        .apply {
            // The list shows a split as its parent whole. Under a filter the sums
            // must do the same even if the phone preference says "parts".
            if (!unfiltered) {
                appendQueryParameter(
                    TransactionProvider.QUERY_PARAMETER_SPLIT_STRATEGY,
                    SplitStrategy.TOTAL.name
                )
            }
        }
        .build()
    // The period sums must cover the same rows as the filtered transaction list.
    // A filter also selects the provider's "count archived splits individually"
    // branch, so the unfiltered query keeps its previous selection.
    val (selection, selectionArgs) = if (unfiltered) {
        dateSelection(from, to)
    } else {
        transactionSelection(from, to, type, filters)
    }
    val zone = ZoneId.systemDefault()
    return contentResolver.query(uri, null, selection, selectionArgs, null)
        ?.useAndMapToList { cursor ->
            GroupDto(
                year = cursor.getInt(KEY_YEAR),
                second = cursor.getInt(KEY_SECOND_GROUP),
                incomeMinor = cursor.getLongIfExistsOr0(KEY_SUM_INCOME),
                expensesMinor = cursor.getLongIfExistsOr0(KEY_SUM_EXPENSES),
                transfersMinor = cursor.getLongIfExistsOr0(KEY_SUM_TRANSFERS),
                firstDate = cursor.getLongIfExists(KEY_FIRST_DATE)
                    ?.let { Instant.ofEpochSecond(it).atZone(zone).toLocalDate().toString() }
            )
        } ?: emptyList()
}

internal fun Repository.queryTransactionsPage(
    accountId: Long,
    from: LocalDate?,
    to: LocalDate?,
    type: String?,
    filters: TransactionQueryFilters,
    limit: Int,
    offset: Int
): Pair<List<Transaction>, Long> {
    val baseUri = DataBaseAccount.uriBuilderForTransactionList(
        accountId = accountId,
        extended = true
    ).build()
    val (selection, selectionArgs) = transactionSelection(from, to, type, filters)
    val total = contentResolver.query(
        baseUri,
        arrayOf("count(*)"),
        selection,
        selectionArgs,
        null
    )?.use { cursor -> if (cursor.moveToFirst()) cursor.getLong(0) else 0L } ?: 0L
    val items = contentResolver.query(
        baseUri.withLimit(limit, offset),
        Transaction.projection,
        selection,
        selectionArgs,
        null
    )?.useAndMapToList { Transaction.fromCursor(it) } ?: emptyList()
    return items to total
}

/**
 * The chosen categories plus every category below them, at any depth.
 *
 * `categoryId` means the branch, like the Android `CategoryCriterion`, whose
 * recursive CTE walks down `parent_id`. Expanding here keeps the SQL a flat
 * `IN` and lets the walk be tested on the JVM. A child does not bring its
 * parent, and an id the tree does not know is kept as it came, so a stale link
 * still filters instead of silently matching everything.
 */
internal fun categoryBranchIds(
    selected: List<Long>,
    parentById: Map<Long, Long?>
): List<Long> {
    if (selected.isEmpty()) return emptyList()
    val children = mutableMapOf<Long, MutableList<Long>>()
    parentById.forEach { (id, parent) ->
        if (parent != null) children.getOrPut(parent) { mutableListOf() }.add(id)
    }
    val branch = linkedSetOf<Long>()
    val pending = ArrayDeque(selected)
    while (pending.isNotEmpty()) {
        val id = pending.removeFirst()
        if (!branch.add(id)) continue
        children[id]?.forEach { pending.addLast(it) }
    }
    return branch.toList()
}

private fun transactionSelection(
    from: LocalDate?,
    to: LocalDate?,
    type: String?,
    filters: TransactionQueryFilters
): Pair<String, Array<String>?> {
    val clauses = mutableListOf("$KEY_PARENTID IS NULL")
    val args = mutableListOf<String>()
    appendDateRange(clauses, args, from, to)
    when (type) {
        "income" -> clauses.add("$KEY_AMOUNT > 0")
        "expense" -> clauses.add("$KEY_AMOUNT < 0")
    }
    if (filters.categoryIds.isNotEmpty()) {
        val placeholders = filters.categoryIds.joinToString(",") { "?" }
        // A split counts when any of its parts carries the category.
        clauses.add(
            "($KEY_CATID IN ($placeholders) OR ($KEY_CATID = $SPLIT_CATID AND EXISTS (" +
                "SELECT 1 FROM $TABLE_TRANSACTIONS child " +
                "WHERE child.$KEY_PARENTID = $CTE_SEARCH.$KEY_ROWID " +
                "AND child.$KEY_CATID IN ($placeholders))))"
        )
        filters.categoryIds.forEach { args.add(it.toString()) }
        filters.categoryIds.forEach { args.add(it.toString()) }
    }
    if (filters.payeeIds.isNotEmpty()) {
        clauses.add("$KEY_PAYEEID IN (${filters.payeeIds.joinToString(",") { "?" }})")
        filters.payeeIds.forEach { args.add(it.toString()) }
    }
    if (filters.methodIds.isNotEmpty()) {
        clauses.add("$KEY_METHODID IN (${filters.methodIds.joinToString(",") { "?" }})")
        filters.methodIds.forEach { args.add(it.toString()) }
    }
    if (filters.tagIds.isNotEmpty()) {
        // Any of the chosen tags, like the app's tag criterion.
        clauses.add(
            "EXISTS (SELECT 1 FROM $TABLE_TRANSACTIONS_TAGS tag_filter " +
                "WHERE tag_filter.$KEY_TRANSACTIONID = $CTE_SEARCH.$KEY_ROWID " +
                "AND tag_filter.$KEY_TAGID IN (${filters.tagIds.joinToString(",") { "?" }}))"
        )
        filters.tagIds.forEach { args.add(it.toString()) }
    }
    filters.text?.trim()?.takeIf { it.isNotEmpty() }?.let { text ->
        // Accent-insensitive: both sides are folded (lowercase and diacritics
        // stripped) because SQLite's NOCASE only folds ASCII and Latin-1 text is
        // what people type. The needle travels as a bound argument.
        val needle = "%${unaccented(text)}%"
        clauses.add(
            "(${unaccentedColumn(KEY_COMMENT)} LIKE ? OR " +
                "${unaccentedColumn(KEY_PAYEE_NAME)} LIKE ? OR " +
                "${unaccentedColumn(KEY_REFERENCE_NUMBER)} LIKE ?)"
        )
        repeat(3) { args.add(needle) }
    }
    // The left side is an expression, so it has no column affinity: a text-bound
    // parameter would compare by storage class (every integer is greater than
    // any text), making >= always false and <= always true. Cast the value.
    filters.amountMin?.let {
        clauses.add("abs($KEY_AMOUNT) >= CAST(? AS INTEGER)")
        args.add(it.toString())
    }
    filters.amountMax?.let {
        clauses.add("abs($KEY_AMOUNT) <= CAST(? AS INTEGER)")
        args.add(it.toString())
    }
    if (filters.uncategorized) {
        clauses.add("$KEY_CATID IS NULL")
    }
    if (filters.statuses.isNotEmpty()) {
        clauses.add("$KEY_CR_STATUS IN (${filters.statuses.joinToString(",") { "?" }})")
        filters.statuses.forEach { args.add(it) }
    }
    when (filters.transfer) {
        true -> clauses.add("$KEY_TRANSFER_ACCOUNT IS NOT NULL")
        false -> clauses.add("$KEY_TRANSFER_ACCOUNT IS NULL")
        null -> Unit
    }
    return clauses.joinToString(" AND ") to args.takeIf { it.isNotEmpty() }?.toTypedArray()
}

private const val ACCENTED = "áéíóúüñçÁÉÍÓÚÜÑÇàèìòùÀÈÌÒÙäöÄÖ"
private const val PLAIN = "aeiouuncaelouAEIOUUNCAEIOUaoAO"

/** Lowercased and without diacritics, character by character (same length). */
private fun unaccented(value: String): String =
    value.lowercase().map { char ->
        val index = ACCENTED.indexOf(char)
        if (index >= 0) PLAIN[index] else char
    }.joinToString("")

/** A text column folded the same way, so LIKE can compare both sides. */
private fun unaccentedColumn(column: String): String {
    var expression = "lower(coalesce($column, ''))"
    ACCENTED.forEachIndexed { index, char ->
        expression = "replace($expression, '$char', '${PLAIN[index]}')"
    }
    return expression
}

private fun dateSelection(from: LocalDate, to: LocalDate): Pair<String, Array<String>?> {
    val clauses = mutableListOf<String>()
    val args = mutableListOf<String>()
    appendDateRange(clauses, args, from, to)
    return clauses.joinToString(" AND ") to args.takeIf { it.isNotEmpty() }?.toTypedArray()
}

private fun appendDateRange(
    clauses: MutableList<String>,
    args: MutableList<String>,
    from: LocalDate?,
    to: LocalDate?,
    alias: String? = null
) {
    val zone = ZoneId.systemDefault()
    val column = alias?.let { "$it.$KEY_DATE" } ?: KEY_DATE
    from?.let {
        clauses.add("$column >= ?")
        args.add(it.atStartOfDay(zone).toEpochSecond().toString())
    }
    to?.let {
        clauses.add("$column < ?")
        args.add(it.plusDays(1).atStartOfDay(zone).toEpochSecond().toString())
    }
}

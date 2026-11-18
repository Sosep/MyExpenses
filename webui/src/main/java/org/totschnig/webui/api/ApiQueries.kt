package org.totschnig.webui.api

import android.content.ContentResolver
import android.net.Uri
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.abs
import org.totschnig.myexpenses.db2.Repository
import org.totschnig.myexpenses.db2.entities.Transaction
import org.totschnig.myexpenses.db2.getCurrencyUnitForAccount
import org.totschnig.myexpenses.model.CrStatus
import org.totschnig.myexpenses.model.CurrencyContext
import org.totschnig.myexpenses.model.CurrencyUnit
import org.totschnig.myexpenses.model.Grouping
import org.totschnig.myexpenses.provider.BaseTransactionProvider
import org.totschnig.myexpenses.provider.CTE_SEARCH
import org.totschnig.myexpenses.provider.DataBaseAccount
import org.totschnig.myexpenses.provider.KEY_ACCOUNTID
import org.totschnig.myexpenses.provider.KEY_ACCOUNT_TYPE_LIST
import org.totschnig.myexpenses.provider.KEY_AMOUNT
import org.totschnig.myexpenses.provider.KEY_BUDGET
import org.totschnig.myexpenses.provider.KEY_BUDGETID
import org.totschnig.myexpenses.provider.KEY_BUDGET_ROLLOVER_NEXT
import org.totschnig.myexpenses.provider.KEY_BUDGET_ROLLOVER_PREVIOUS
import org.totschnig.myexpenses.provider.KEY_CATID
import org.totschnig.myexpenses.provider.KEY_COLOR
import org.totschnig.myexpenses.provider.KEY_COMMENT
import org.totschnig.myexpenses.provider.KEY_CR_STATUS
import org.totschnig.myexpenses.provider.KEY_CURRENCY
import org.totschnig.myexpenses.provider.KEY_CURRENT_BALANCE
import org.totschnig.myexpenses.provider.KEY_DATE
import org.totschnig.myexpenses.provider.KEY_DISPLAY_AMOUNT
import org.totschnig.myexpenses.provider.KEY_EXCLUDE_FROM_TOTALS
import org.totschnig.myexpenses.provider.KEY_FIRST_DATE
import org.totschnig.myexpenses.provider.KEY_IS_NUMBERED
import org.totschnig.myexpenses.provider.KEY_LABEL
import org.totschnig.myexpenses.provider.KEY_LEVEL
import org.totschnig.myexpenses.provider.KEY_METHODID
import org.totschnig.myexpenses.provider.KEY_METHOD_LABEL
import org.totschnig.myexpenses.provider.KEY_PARENTID
import org.totschnig.myexpenses.provider.KEY_PATH
import org.totschnig.myexpenses.provider.KEY_PAYEEID
import org.totschnig.myexpenses.provider.KEY_PAYEE_NAME
import org.totschnig.myexpenses.provider.KEY_REFERENCE_NUMBER
import org.totschnig.myexpenses.provider.KEY_ROWID
import org.totschnig.myexpenses.provider.KEY_SEALED
import org.totschnig.myexpenses.provider.KEY_SECOND_GROUP
import org.totschnig.myexpenses.provider.KEY_SUM
import org.totschnig.myexpenses.provider.KEY_SUM_EXPENSES
import org.totschnig.myexpenses.provider.KEY_SUM_INCOME
import org.totschnig.myexpenses.provider.KEY_SUM_TRANSFERS
import org.totschnig.myexpenses.provider.KEY_TAGID
import org.totschnig.myexpenses.provider.KEY_TOTAL
import org.totschnig.myexpenses.provider.KEY_TRANSACTIONID
import org.totschnig.myexpenses.provider.KEY_TRANSFER_ACCOUNT
import org.totschnig.myexpenses.provider.KEY_TYPE
import org.totschnig.myexpenses.provider.KEY_YEAR
import org.totschnig.myexpenses.provider.SPLIT_CATID
import org.totschnig.myexpenses.provider.TABLE_TRANSACTIONS
import org.totschnig.myexpenses.provider.TABLE_TRANSACTIONS_TAGS
import org.totschnig.myexpenses.provider.TransactionProvider
import org.totschnig.myexpenses.provider.TransactionProvider.QUERY_PARAMETER_GROUP_BY
import org.totschnig.myexpenses.provider.VIEW_EXTENDED
import org.totschnig.myexpenses.provider.filter.Criterion
import org.totschnig.myexpenses.provider.getBoolean
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

internal fun Repository.queryAccounts(currencyContext: CurrencyContext): List<AccountDto> {
    val uri = TransactionProvider.ACCOUNTS_URI.buildUpon()
        .appendQueryParameter(
            TransactionProvider.QUERY_PARAMETER_FULL_PROJECTION_WITH_SUMS,
            "now"
        )
        .build()
    val fractionDigits = mutableMapOf<String, Int>()
    return contentResolver.query(uri, null, "$KEY_SEALED = 0", null, null)
        ?.useAndMapToList { cursor ->
            val currency = cursor.getString(KEY_CURRENCY)
            AccountDto(
                id = cursor.getLong(KEY_ROWID),
                label = cursor.getString(KEY_LABEL),
                type = cursor.getStringOrNull(KEY_TYPE).orEmpty(),
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
                parentId = cursor.getLongOrNull(KEY_PARENTID)
            )
        } ?: emptyList()
}

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
    accountId: Long,
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
    return ReportSummaryDto(
        accountId = accountId ?: 0,
        from = from.toString(),
        to = to.toString(),
        currency = unit.code,
        fractionDigits = unit.fractionDigits,
        incomeMinor = income,
        expensesMinor = expenses,
        netMinor = income + expenses,
        count = count
    )
}

internal fun Repository.queryBreakdown(
    accountId: Long?,
    by: String,
    type: String,
    from: LocalDate,
    to: LocalDate,
    unit: CurrencyUnit,
    allAccounts: Boolean
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
            alias
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
    alias: String
): List<BreakdownItemDto> {
    val wholeTransactions = by != "category"
    val (baseSelection, args) =
        reportSelection(accountId, from, to, type, wholeTransactions, alias)
    // A split parent holds the total while its parts hold the categories, so the
    // parent must stay out. Uncategorized rows (catid null or 0) must stay in:
    // dropping them made the category report total disagree with the summary.
    val selection = if (by == "category") {
        "$baseSelection AND $KEY_CATID IS NOT $SPLIT_CATID"
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

internal fun Repository.queryTransactionGroups(
    accountId: Long,
    grouping: Grouping,
    from: LocalDate,
    to: LocalDate
): List<GroupDto> {
    val uri = BaseTransactionProvider.groupingUriBuilder(grouping)
        .appendQueryParameter(KEY_ACCOUNTID, accountId.toString())
        .appendQueryParameter(KEY_FIRST_DATE, "1")
        .build()
    val (selection, selectionArgs) = dateSelection(from, to)
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
        val needle = "%$text%"
        clauses.add(
            "(coalesce($KEY_COMMENT, '') LIKE ? COLLATE NOCASE OR " +
                "coalesce($KEY_PAYEE_NAME, '') LIKE ? COLLATE NOCASE OR " +
                "coalesce($KEY_REFERENCE_NUMBER, '') LIKE ? COLLATE NOCASE)"
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

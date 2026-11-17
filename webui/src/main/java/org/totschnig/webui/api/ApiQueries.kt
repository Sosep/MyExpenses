package org.totschnig.webui.api

import android.content.ContentResolver
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.abs
import org.totschnig.myexpenses.db2.Repository
import org.totschnig.myexpenses.db2.entities.Transaction
import org.totschnig.myexpenses.db2.getCurrencyUnitForAccount
import org.totschnig.myexpenses.model.CrStatus
import org.totschnig.myexpenses.model.CurrencyContext
import org.totschnig.myexpenses.model.Grouping
import org.totschnig.myexpenses.provider.BaseTransactionProvider
import org.totschnig.myexpenses.provider.DataBaseAccount
import org.totschnig.myexpenses.provider.KEY_ACCOUNTID
import org.totschnig.myexpenses.provider.KEY_ACCOUNT_TYPE_LIST
import org.totschnig.myexpenses.provider.KEY_AMOUNT
import org.totschnig.myexpenses.provider.KEY_BUDGET
import org.totschnig.myexpenses.provider.KEY_BUDGETID
import org.totschnig.myexpenses.provider.KEY_CATID
import org.totschnig.myexpenses.provider.KEY_COLOR
import org.totschnig.myexpenses.provider.KEY_CR_STATUS
import org.totschnig.myexpenses.provider.KEY_CURRENCY
import org.totschnig.myexpenses.provider.KEY_CURRENT_BALANCE
import org.totschnig.myexpenses.provider.KEY_DATE
import org.totschnig.myexpenses.provider.KEY_EXCLUDE_FROM_TOTALS
import org.totschnig.myexpenses.provider.KEY_IS_NUMBERED
import org.totschnig.myexpenses.provider.KEY_LABEL
import org.totschnig.myexpenses.provider.KEY_LEVEL
import org.totschnig.myexpenses.provider.KEY_METHODID
import org.totschnig.myexpenses.provider.KEY_METHOD_LABEL
import org.totschnig.myexpenses.provider.KEY_PARENTID
import org.totschnig.myexpenses.provider.KEY_PATH
import org.totschnig.myexpenses.provider.KEY_PAYEEID
import org.totschnig.myexpenses.provider.KEY_PAYEE_NAME
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
import org.totschnig.myexpenses.provider.TABLE_TRANSACTIONS_TAGS
import org.totschnig.myexpenses.provider.TransactionProvider
import org.totschnig.myexpenses.provider.TransactionProvider.QUERY_PARAMETER_GROUP_BY
import org.totschnig.myexpenses.provider.VIEW_EXTENDED
import org.totschnig.myexpenses.provider.getBoolean
import org.totschnig.myexpenses.provider.getInt
import org.totschnig.myexpenses.provider.getIntIfExists
import org.totschnig.myexpenses.provider.getLong
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
    to: LocalDate
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
        KEY_BUDGET
    )
    val (selection, args) = dateSelection(from, to)
    return contentResolver.query(uri, projection, selection, args, null)
        ?.useAndMapToList { cursor ->
            BudgetAllocationDto(
                categoryId = cursor.getLong(KEY_ROWID),
                label = cursor.getString(KEY_LABEL),
                parentId = cursor.getLongOrNull(KEY_PARENTID),
                level = cursor.getInt(KEY_LEVEL),
                spentMinor = abs(cursor.getLongIfExistsOr0(KEY_SUM)),
                allocatedMinor = cursor.getLongIfExistsOr0(KEY_BUDGET)
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
            selection = "$baseSelection AND coalesce($KEY_PAYEEID, 0) = ?"
            args = (baseArgs ?: emptyArray()) + groupId.toString()
        }

        "method" -> {
            selection = "$baseSelection AND coalesce($KEY_METHODID, 0) = ?"
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
    accountId: Long,
    from: LocalDate,
    to: LocalDate
): ReportSummaryDto {
    val unit = getCurrencyUnitForAccount(accountId)
        ?: throw IllegalArgumentException("Account $accountId not found")
    val (selection, args) = reportSelection(accountId, from, to, "both", wholeTransactions = true)
    val projection = arrayOf(
        "sum(CASE WHEN $KEY_AMOUNT > 0 THEN $KEY_AMOUNT ELSE 0 END) AS income",
        "sum(CASE WHEN $KEY_AMOUNT < 0 THEN $KEY_AMOUNT ELSE 0 END) AS expenses",
        "count(*) AS transactions"
    )
    val (income, expenses, count) = contentResolver.query(
        TransactionProvider.EXTENDED_URI,
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
        accountId = accountId,
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
    accountId: Long,
    by: String,
    type: String,
    from: LocalDate,
    to: LocalDate
): BreakdownDto {
    val items = when (by) {
        "category" -> queryGroupedBreakdown(accountId, by, type, from, to)
        "payee", "method" -> queryGroupedBreakdown(accountId, by, type, from, to)
        "tag" -> queryTagBreakdown(accountId, type, from, to)
        else -> throw IllegalArgumentException("Unknown breakdown $by")
    }
    val total = items.sumOf { it.amountMinor }
    val withShare = items.map {
        it.copy(share = if (total > 0) it.amountMinor * 100.0 / total else 0.0)
    }.sortedWith(compareByDescending<BreakdownItemDto> { it.amountMinor }.thenBy { it.label })
    return BreakdownDto(
        accountId = accountId,
        from = from.toString(),
        to = to.toString(),
        by = by,
        type = type,
        totalMinor = total,
        items = withShare
    )
}

private fun Repository.queryGroupedBreakdown(
    accountId: Long,
    by: String,
    type: String,
    from: LocalDate,
    to: LocalDate
): List<BreakdownItemDto> {
    val wholeTransactions = by != "category"
    val (baseSelection, args) =
        reportSelection(accountId, from, to, type, wholeTransactions)
    val selection = if (by == "category") "$baseSelection AND $KEY_CATID > 0" else baseSelection
    val projection: Array<String>
    val groupBy: String
    when (by) {
        "category" -> {
            projection = arrayOf(
                "$KEY_CATID AS group_id",
                "coalesce($KEY_PATH, 'Category ' || $KEY_CATID) AS group_label",
                "sum($KEY_AMOUNT) AS amount_minor",
                "count(*) AS transaction_count"
            )
            groupBy = "$KEY_CATID, $KEY_PATH"
        }

        "payee" -> {
            projection = arrayOf(
                "coalesce($KEY_PAYEEID, 0) AS group_id",
                "coalesce($KEY_PAYEE_NAME, 'No payee') AS group_label",
                "sum($KEY_AMOUNT) AS amount_minor",
                "count(*) AS transaction_count"
            )
            groupBy = "coalesce($KEY_PAYEEID, 0), coalesce($KEY_PAYEE_NAME, 'No payee')"
        }

        else -> {
            projection = arrayOf(
                "coalesce($KEY_METHODID, 0) AS group_id",
                "coalesce($KEY_METHOD_LABEL, 'No method') AS group_label",
                "sum($KEY_AMOUNT) AS amount_minor",
                "count(*) AS transaction_count"
            )
            groupBy = "coalesce($KEY_METHODID, 0), coalesce($KEY_METHOD_LABEL, 'No method')"
        }
    }
    val uri = TransactionProvider.EXTENDED_URI.buildUpon()
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
    accountId: Long,
    type: String,
    from: LocalDate,
    to: LocalDate
): List<BreakdownItemDto> = queryTags().mapNotNull { tag ->
    val (baseSelection, baseArgs) =
        reportSelection(accountId, from, to, type, wholeTransactions = true)
    val selection = "$baseSelection AND EXISTS (" +
        "SELECT 1 FROM $TABLE_TRANSACTIONS_TAGS tag_link " +
        "WHERE tag_link.$KEY_TRANSACTIONID = $VIEW_EXTENDED.$KEY_ROWID " +
        "AND tag_link.$KEY_TAGID = ?)"
    val args = (baseArgs ?: emptyArray()) + tag.id.toString()
    contentResolver.query(
        TransactionProvider.EXTENDED_URI,
        arrayOf("sum($KEY_AMOUNT) AS amount_minor", "count(*) AS transaction_count"),
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
    accountId: Long,
    from: LocalDate,
    to: LocalDate,
    type: String,
    wholeTransactions: Boolean
): Pair<String, Array<String>?> {
    val clauses = mutableListOf(
        "$KEY_ACCOUNTID = ?",
        "$KEY_CR_STATUS != ?",
        "$KEY_TRANSFER_ACCOUNT IS NULL"
    )
    val args = mutableListOf(accountId.toString(), CrStatus.VOID.name)
    appendDateRange(clauses, args, from, to)
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
        .build()
    val (selection, selectionArgs) = dateSelection(from, to)
    return contentResolver.query(uri, null, selection, selectionArgs, null)
        ?.useAndMapToList { cursor ->
            GroupDto(
                year = cursor.getInt(KEY_YEAR),
                second = cursor.getInt(KEY_SECOND_GROUP),
                incomeMinor = cursor.getLongIfExistsOr0(KEY_SUM_INCOME),
                expensesMinor = cursor.getLongIfExistsOr0(KEY_SUM_EXPENSES),
                transfersMinor = cursor.getLongIfExistsOr0(KEY_SUM_TRANSFERS)
            )
        } ?: emptyList()
}

internal fun Repository.queryTransactionsPage(
    accountId: Long,
    from: LocalDate?,
    to: LocalDate?,
    type: String?,
    limit: Int,
    offset: Int
): Pair<List<Transaction>, Long> {
    val baseUri = DataBaseAccount.uriBuilderForTransactionList(
        accountId = accountId,
        extended = true
    ).build()
    val (selection, selectionArgs) = transactionSelection(from, to, type)
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
    type: String?
): Pair<String, Array<String>?> {
    val clauses = mutableListOf("$KEY_PARENTID IS NULL")
    val args = mutableListOf<String>()
    appendDateRange(clauses, args, from, to)
    when (type) {
        "income" -> clauses.add("$KEY_AMOUNT > 0")
        "expense" -> clauses.add("$KEY_AMOUNT < 0")
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
    to: LocalDate?
) {
    val zone = ZoneId.systemDefault()
    from?.let {
        clauses.add("$KEY_DATE >= ?")
        args.add(it.atStartOfDay(zone).toEpochSecond().toString())
    }
    to?.let {
        clauses.add("$KEY_DATE < ?")
        args.add(it.plusDays(1).atStartOfDay(zone).toEpochSecond().toString())
    }
}

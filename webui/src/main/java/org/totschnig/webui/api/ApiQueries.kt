package org.totschnig.webui.api

import java.time.LocalDate
import java.time.ZoneId
import org.totschnig.myexpenses.db2.Repository
import org.totschnig.myexpenses.db2.entities.Transaction
import org.totschnig.myexpenses.model.CurrencyContext
import org.totschnig.myexpenses.model.Grouping
import org.totschnig.myexpenses.provider.BaseTransactionProvider
import org.totschnig.myexpenses.provider.DataBaseAccount
import org.totschnig.myexpenses.provider.KEY_ACCOUNTID
import org.totschnig.myexpenses.provider.KEY_ACCOUNT_TYPE_LIST
import org.totschnig.myexpenses.provider.KEY_AMOUNT
import org.totschnig.myexpenses.provider.KEY_COLOR
import org.totschnig.myexpenses.provider.KEY_CURRENCY
import org.totschnig.myexpenses.provider.KEY_CURRENT_BALANCE
import org.totschnig.myexpenses.provider.KEY_DATE
import org.totschnig.myexpenses.provider.KEY_EXCLUDE_FROM_TOTALS
import org.totschnig.myexpenses.provider.KEY_IS_NUMBERED
import org.totschnig.myexpenses.provider.KEY_LABEL
import org.totschnig.myexpenses.provider.KEY_LEVEL
import org.totschnig.myexpenses.provider.KEY_PARENTID
import org.totschnig.myexpenses.provider.KEY_PAYEE_NAME
import org.totschnig.myexpenses.provider.KEY_ROWID
import org.totschnig.myexpenses.provider.KEY_SEALED
import org.totschnig.myexpenses.provider.KEY_SECOND_GROUP
import org.totschnig.myexpenses.provider.KEY_SUM_EXPENSES
import org.totschnig.myexpenses.provider.KEY_SUM_INCOME
import org.totschnig.myexpenses.provider.KEY_SUM_TRANSFERS
import org.totschnig.myexpenses.provider.KEY_TOTAL
import org.totschnig.myexpenses.provider.KEY_TYPE
import org.totschnig.myexpenses.provider.KEY_YEAR
import org.totschnig.myexpenses.provider.TransactionProvider
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

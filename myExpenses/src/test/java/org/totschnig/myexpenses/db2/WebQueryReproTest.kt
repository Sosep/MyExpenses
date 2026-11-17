package org.totschnig.myexpenses.db2

import android.database.Cursor
import com.google.common.truth.Truth.assertThat
import org.junit.Ignore
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.totschnig.myexpenses.BaseTestWithRepository
import org.totschnig.myexpenses.db2.entities.Transaction
import org.totschnig.myexpenses.model.CrStatus
import org.totschnig.myexpenses.model.generateUuid
import org.totschnig.myexpenses.provider.DataBaseAccount
import org.totschnig.myexpenses.provider.KEY_ACCOUNTID
import org.totschnig.myexpenses.provider.KEY_AMOUNT
import org.totschnig.myexpenses.provider.KEY_CATID
import org.totschnig.myexpenses.provider.KEY_CR_STATUS
import org.totschnig.myexpenses.provider.KEY_DATE
import org.totschnig.myexpenses.provider.KEY_DISPLAY_AMOUNT
import org.totschnig.myexpenses.provider.KEY_PARENTID
import org.totschnig.myexpenses.provider.KEY_ROWID
import org.totschnig.myexpenses.provider.KEY_TRANSFER_ACCOUNT
import org.totschnig.myexpenses.provider.SPLIT_CATID
import org.totschnig.myexpenses.provider.TABLE_TRANSACTIONS
import org.totschnig.myexpenses.provider.TransactionProvider
import org.totschnig.myexpenses.provider.VIEW_EXTENDED
import org.totschnig.myexpenses.util.toEpoch
import java.time.LocalDateTime

/**
 * Reproduces, on the JVM, the queries the web layer issues in
 * `ApiQueries.transactionSelection` and `reportSelection`, so a failing one shows
 * the SQLite message instead of the generic 500 the device returns.
 *
 * Today all four cases fail; they document the three causes of the device 500s:
 *  - the builder always sets `search=1`, so the provider wraps the query in
 *    `cte_search` and a selection qualified with `transactions_extended` no
 *    longer resolves (category and tag filters);
 *  - the exchange-rate join adds `account_exchangerates.account_id`, so
 *    `account_id = ?` is ambiguous (drill-down);
 *  - `display_amount` only exists inside `cte_search`, so using it against
 *    `EXTENDED_URI` fails (all-accounts summary and breakdown).
 *
 * Un-ignore each case as its fix lands.
 */
@RunWith(RobolectricTestRunner::class)
class WebQueryReproTest : BaseTestWithRepository() {

    private fun seed(): Pair<Long, Long> {
        val accountId = insertAccount("Repro")
        val categoryId = writeCategory("Repro category")
        repository.createTransaction(
            Transaction(
                id = 0,
                comment = "repro",
                date = LocalDateTime.now().toEpoch(),
                valueDate = LocalDateTime.now().toEpoch(),
                amount = -1000,
                categoryId = categoryId,
                accountId = accountId,
                payeeId = null,
                crStatus = CrStatus.UNRECONCILED,
                uuid = generateUuid()
            )
        )
        return accountId to categoryId
    }

    private fun query(
        accountId: Long,
        projection: Array<String>,
        selection: String,
        args: Array<String>
    ): Cursor? = contentResolver.query(
        DataBaseAccount.uriBuilderForTransactionList(accountId, extended = true).build(),
        projection,
        selection,
        args,
        null
    )

    @Ignore("known 500, see the class comment")
    @Test
    fun categoryFilter() {
        val (accountId, categoryId) = seed()
        val selection = "($KEY_CATID = ? OR ($KEY_CATID = $SPLIT_CATID AND EXISTS (" +
            "SELECT 1 FROM $TABLE_TRANSACTIONS child " +
            "WHERE child.$KEY_PARENTID = $VIEW_EXTENDED.$KEY_ROWID " +
            "AND child.$KEY_CATID = ?)))"
        val args = arrayOf(categoryId.toString(), categoryId.toString())

        val total = contentResolver.query(
            DataBaseAccount.uriBuilderForTransactionList(accountId, extended = true).build(),
            arrayOf("count(*)"),
            selection,
            args,
            null
        )?.use { if (it.moveToFirst()) it.getLong(0) else 0L }
        assertThat(total).isEqualTo(1L)

        query(accountId, Transaction.projection, selection, args)?.use {
            assertThat(it.count).isEqualTo(1)
        }
    }

    @Ignore("known 500, see the class comment")
    @Test
    fun tagFilter() {
        val (accountId, _) = seed()
        val selection = "EXISTS (SELECT 1 FROM ${TABLE_TRANSACTIONS}_tags tag_filter " +
            "WHERE tag_filter.transaction_id = $VIEW_EXTENDED.$KEY_ROWID AND tag_filter.tag_id = ?)"
        query(accountId, Transaction.projection, selection, arrayOf("1"))?.close()
    }

    @Ignore("known 500, see the class comment")
    @Test
    fun reportSelectionWithoutJoin() {
        val (accountId, _) = seed()
        val today = LocalDateTime.now()
        val selection = "$KEY_ACCOUNTID = ? AND $KEY_CR_STATUS != ? AND " +
            "$KEY_TRANSFER_ACCOUNT IS NULL AND $KEY_DATE >= ? AND $KEY_DATE <= ?"
        val args = arrayOf(
            accountId.toString(),
            CrStatus.VOID.name,
            today.minusDays(1).toEpoch().toString(),
            today.plusDays(1).toEpoch().toString()
        )
        contentResolver.query(
            TransactionProvider.EXTENDED_URI,
            Transaction.projection,
            selection,
            args,
            null
        )?.use { assertThat(it.count).isEqualTo(1) }
    }

    @Ignore("known 500, see the class comment")
    @Test
    fun summaryAllAccounts() {
        seed()
        val projection = arrayOf(
            "sum(CASE WHEN $KEY_AMOUNT > 0 THEN $KEY_DISPLAY_AMOUNT ELSE 0 END) AS income",
            "sum(CASE WHEN $KEY_AMOUNT < 0 THEN $KEY_DISPLAY_AMOUNT ELSE 0 END) AS expenses",
            "count(*) AS transactions"
        )
        val selection = "exclude_from_totals = 0 AND $KEY_CR_STATUS != ? AND " +
            "$KEY_TRANSFER_ACCOUNT IS NULL"
        contentResolver.query(
            TransactionProvider.EXTENDED_URI,
            projection,
            selection,
            arrayOf(CrStatus.VOID.name),
            null
        )?.use { assertThat(it.count).isEqualTo(1) }
    }
}

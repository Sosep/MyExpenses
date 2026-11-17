package org.totschnig.myexpenses.db2

import android.database.Cursor
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.totschnig.myexpenses.BaseTestWithRepository
import org.totschnig.myexpenses.db2.entities.Transaction
import org.totschnig.myexpenses.model.CrStatus
import org.totschnig.myexpenses.model.generateUuid
import org.totschnig.myexpenses.provider.CTE_SEARCH
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
 * The provider builds two different shapes:
 *  - list queries set `search=1` and are wrapped in `cte_search`, so a selection
 *    must qualify with that alias;
 *  - aggregates query `transactions_extended` directly, where `display_amount`
 *    does not exist — all-accounts aggregates therefore go through the cte,
 *    which is the only place the home-currency amount is computed.
 *  - the exchange-rate join adds `account_exchangerates.account_id`, so
 *    `account_id` must always be qualified.
 *
 * Keep these cases in sync with `ApiQueries`.
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

    private fun listUri(accountId: Long) =
        DataBaseAccount.uriBuilderForTransactionList(accountId, extended = true).build()

    private fun allAccountsUri() =
        DataBaseAccount.uriBuilderForTransactionList(shortenComment = false, extended = true).build()

    private fun query(
        accountId: Long,
        projection: Array<String>,
        selection: String,
        args: Array<String>
    ): Cursor? = contentResolver.query(
        listUri(accountId),
        projection,
        selection,
        args,
        null
    )

    @Test
    fun categoryFilter() {
        val (accountId, categoryId) = seed()
        val selection = "($KEY_CATID = ? OR ($KEY_CATID = $SPLIT_CATID AND EXISTS (" +
            "SELECT 1 FROM $TABLE_TRANSACTIONS child " +
            "WHERE child.$KEY_PARENTID = $CTE_SEARCH.$KEY_ROWID " +
            "AND child.$KEY_CATID = ?)))"
        val args = arrayOf(categoryId.toString(), categoryId.toString())

        val total = contentResolver.query(
            listUri(accountId),
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

    @Test
    fun tagFilter() {
        val (accountId, _) = seed()
        val selection = "EXISTS (SELECT 1 FROM ${TABLE_TRANSACTIONS}_tags tag_filter " +
            "WHERE tag_filter.transaction_id = $CTE_SEARCH.$KEY_ROWID AND tag_filter.tag_id = ?)"
        query(accountId, Transaction.projection, selection, arrayOf("1"))?.close()
    }

    @Test
    fun reportSelectionWithoutJoin() {
        val (accountId, _) = seed()
        val today = LocalDateTime.now()
        val selection = "$VIEW_EXTENDED.$KEY_ACCOUNTID = ? AND $VIEW_EXTENDED.$KEY_CR_STATUS != ? AND " +
            "$VIEW_EXTENDED.$KEY_TRANSFER_ACCOUNT IS NULL AND $VIEW_EXTENDED.$KEY_DATE >= ? AND " +
            "$VIEW_EXTENDED.$KEY_DATE <= ?"
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

    @Test
    fun breakdownAllAccounts() {
        seed()
        val uri = allAccountsUri().buildUpon()
            .appendQueryParameter(
                TransactionProvider.QUERY_PARAMETER_GROUP_BY,
                "coalesce($KEY_CATID, 0)"
            )
            .build()
        val projection = arrayOf(
            "coalesce($KEY_CATID, 0) AS group_id",
            "sum($KEY_DISPLAY_AMOUNT) AS amount_minor",
            "count(*) AS transaction_count"
        )
        val selection =
            "$CTE_SEARCH.$KEY_CR_STATUS != ? AND $CTE_SEARCH.$KEY_TRANSFER_ACCOUNT IS NULL"
        contentResolver.query(uri, projection, selection, arrayOf(CrStatus.VOID.name), null)
            ?.use {
                assertThat(it.moveToFirst()).isTrue()
                assertThat(it.getLong(2)).isEqualTo(1L)
            }
    }

    @Test
    fun summaryAllAccounts() {
        seed()
        val projection = arrayOf(
            "sum(CASE WHEN $KEY_AMOUNT > 0 THEN $KEY_DISPLAY_AMOUNT ELSE 0 END) AS income",
            "sum(CASE WHEN $KEY_AMOUNT < 0 THEN $KEY_DISPLAY_AMOUNT ELSE 0 END) AS expenses",
            "count(*) AS transactions"
        )
        val selection = "$CTE_SEARCH.$KEY_CR_STATUS != ? AND $CTE_SEARCH.$KEY_TRANSFER_ACCOUNT IS NULL"
        contentResolver.query(
            allAccountsUri(),
            projection,
            selection,
            arrayOf(CrStatus.VOID.name),
            null
        )?.use {
            assertThat(it.moveToFirst()).isTrue()
            assertThat(it.getLong(2)).isEqualTo(1L)
        }
    }
}

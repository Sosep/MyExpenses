package org.totschnig.myexpenses.provider

import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.totschnig.myexpenses.BaseTestWithRepository
import org.totschnig.myexpenses.db2.FLAG_EXPENSE
import org.totschnig.myexpenses.db2.FLAG_INCOME
import org.totschnig.myexpenses.db2.createSplitTransaction
import org.totschnig.myexpenses.db2.entities.Transaction
import org.totschnig.myexpenses.db2.insertTransaction
import org.totschnig.myexpenses.db2.insertTransfer
import org.totschnig.myexpenses.db2.saveCategory
import org.totschnig.myexpenses.model.generateUuid
import org.totschnig.myexpenses.model2.Category
import org.totschnig.myexpenses.preference.PrefKey
import org.totschnig.myexpenses.util.toEpoch
import org.totschnig.shared_test.CursorSubject.Companion.useAndAssert
import java.time.LocalDateTime

@RunWith(RobolectricTestRunner::class)
class AccountSumTest: BaseTestWithRepository() {
    val openingBalance: Long = 100L
    val expense1: Long = 11L
    val expense2: Long = 22L
    val income1: Long = 33L
    val income2: Long = 44L
    val transferP: Long = 55L
    val transferN: Long = 66L

    @Test
    fun testDatabaseCalculatedSums() {
        val testAccountId1 = insertAccount("Test account 1", openingBalance = openingBalance)
        val testAccountId2 = insertAccount("Test account 2", openingBalance = openingBalance)
        repository.insertTransaction(testAccountId1, -expense1)
        repository.insertTransaction(testAccountId1, -expense2)
        repository.insertTransaction(testAccountId1, income1)
        repository.insertTransaction(testAccountId1, income2)
        repository.insertTransfer(testAccountId1, testAccountId2, transferP)
        repository.insertTransfer(testAccountId2, testAccountId1, transferN)

        contentResolver.query(
            TransactionProvider.ACCOUNTS_FULL_URI,
            null,
            null,
            null,
            null
        ).useAndAssert {
            hasCount(2)
        }

        contentResolver.query(
            TransactionProvider.ACCOUNTS_FULL_URI,
            null,
            "$KEY_ROWID= ?",
            arrayOf(testAccountId1.toString()),
            null
        ).useAndAssert {
            hasCount(1)
            movesToFirst()
            hasLong(KEY_SUM_INCOME, income1 + income2)
            hasLong(KEY_SUM_EXPENSES, -expense1 - expense2)
            hasLong(KEY_SUM_TRANSFERS, transferP - transferN)
            hasLong(KEY_CURRENT_BALANCE, openingBalance + income1 + income2 - expense1 - expense2 + transferP - transferN)
        }

        contentResolver.query(
            TransactionProvider.ACCOUNTS_FULL_URI,
            null,  // get all the columns
            "$KEY_ROWID= ?",
            arrayOf(testAccountId2.toString()),
            null // use default the sort order
        ).useAndAssert {
            hasCount(1)
            movesToFirst()
            hasLong(KEY_SUM_INCOME, 0L)
            hasLong(KEY_SUM_EXPENSES, 0L)
            hasLong(KEY_SUM_TRANSFERS, transferN - transferP)
            hasLong(KEY_CURRENT_BALANCE, openingBalance + transferN - transferP)
        }
    }

    @Test
    fun testSplitTotalsInAccountSums() {
        val accountId = insertAccount("Split account")
        val expenseCategory = repository.saveCategory(
            Category(label = "Expense", type = FLAG_EXPENSE)
        )!!
        val incomeCategory = repository.saveCategory(
            Category(label = "Income", type = FLAG_INCOME)
        )!!
        val date = LocalDateTime.of(2024, 1, 15, 12, 0)
        repository.createSplitTransaction(
            Transaction(
                accountId = accountId,
                amount = -30,
                date = date.toEpoch(),
                categoryId = SPLIT_CATID,
                uuid = generateUuid()
            ),
            listOf(
                Transaction(
                    accountId = accountId,
                    amount = -40,
                    date = date.toEpoch(),
                    categoryId = expenseCategory,
                    uuid = generateUuid()
                ),
                Transaction(
                    accountId = accountId,
                    amount = 10,
                    date = date.toEpoch(),
                    categoryId = incomeCategory,
                    uuid = generateUuid()
                )
            )
        )

        fun assertSums(expectedExpenses: Long, expectedIncome: Long) {
            contentResolver.query(
                TransactionProvider.ACCOUNTS_FULL_URI,
                null,
                "$KEY_ROWID = ?",
                arrayOf(accountId.toString()),
                null
            ).useAndAssert {
                hasCount(1)
                movesToFirst()
                hasLong(KEY_SUM_EXPENSES, expectedExpenses)
                hasLong(KEY_SUM_INCOME, expectedIncome)
                hasLong(KEY_CURRENT_BALANCE, expectedExpenses + expectedIncome)
            }
        }

        assertSums(-30, 0)
        prefHandler.putBoolean(PrefKey.SPLIT_TRANSACTIONS_AS_TOTAL, false)
        assertSums(-40, 10)
    }
}
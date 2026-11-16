package org.totschnig.myexpenses.repository

import java.time.LocalDateTime
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.totschnig.myexpenses.BaseTestWithRepository
import org.totschnig.myexpenses.db2.FLAG_EXPENSE
import org.totschnig.myexpenses.db2.FLAG_INCOME
import org.totschnig.myexpenses.db2.FLAG_NEUTRAL
import org.totschnig.myexpenses.db2.createSplitTransaction
import org.totschnig.myexpenses.db2.entities.Transaction
import org.totschnig.myexpenses.db2.insertTransaction
import org.totschnig.myexpenses.db2.saveCategory
import org.totschnig.myexpenses.model.CrStatus
import org.totschnig.myexpenses.model.Grouping
import org.totschnig.myexpenses.model.generateUuid
import org.totschnig.myexpenses.model2.Category
import org.totschnig.myexpenses.preference.PrefKey
import org.totschnig.myexpenses.provider.BaseTransactionProvider
import org.totschnig.myexpenses.provider.KEY_ACCOUNTID
import org.totschnig.myexpenses.provider.KEY_MAPPED_CATEGORIES
import org.totschnig.myexpenses.provider.KEY_SECOND_GROUP
import org.totschnig.myexpenses.provider.KEY_SUM_EXPENSES
import org.totschnig.myexpenses.provider.KEY_SUM_INCOME
import org.totschnig.myexpenses.provider.KEY_SUM_TRANSFERS
import org.totschnig.myexpenses.provider.KEY_YEAR
import org.totschnig.myexpenses.provider.SPLIT_CATID
import org.totschnig.myexpenses.provider.SplitStrategy
import org.totschnig.myexpenses.provider.TransactionInfo
import org.totschnig.myexpenses.provider.TransactionProvider
import org.totschnig.myexpenses.provider.filter.AmountCriterion
import org.totschnig.myexpenses.provider.filter.CategoryCriterion
import org.totschnig.myexpenses.provider.filter.Operation
import org.totschnig.myexpenses.util.toEpoch
import org.totschnig.shared_test.CursorSubject.Companion.useAndAssert

@RunWith(RobolectricTestRunner::class)
class GroupQueryTest : BaseTestWithRepository() {

    private var testAccountId: Long = 0
    private var neutralCategoryId: Long = 0
    private var expenseCategoryId: Long = 0
    private var incomeCategoryId: Long = 0
    private var transferCategoryId: Long = 0

    private fun insertCategory(label: String, typeFlags: Byte) = repository.saveCategory(
        Category(label = label, type = typeFlags)
    )!!

    @Before
    fun setup() {
        testAccountId = insertAccount("Test account")
        neutralCategoryId = insertCategory("Neutral", FLAG_NEUTRAL)
        expenseCategoryId = insertCategory("Expense", FLAG_EXPENSE)
        incomeCategoryId = insertCategory("Income", FLAG_INCOME)
        transferCategoryId = prefHandler.defaultTransferCategory!!
    }

    private fun insertTransactions() {
        repository.insertTransaction(testAccountId, 100, categoryId = neutralCategoryId)
        repository.insertTransaction(testAccountId, -200, categoryId = expenseCategoryId)
        repository.insertTransaction(testAccountId, 400, categoryId = incomeCategoryId)
        repository.insertTransaction(testAccountId, 800, categoryId = transferCategoryId)
    }

    private val splitDate = LocalDateTime.of(2024, 1, 15, 12, 0)

    private fun insertSplit(total: Long, parts: List<Pair<Long, Long?>>) =
        repository.createSplitTransaction(
            Transaction(
                accountId = testAccountId,
                amount = total,
                date = splitDate.toEpoch(),
                categoryId = SPLIT_CATID,
                uuid = generateUuid()
            ),
            parts.map { (amount, categoryId) ->
                Transaction(
                    accountId = testAccountId,
                    amount = amount,
                    date = splitDate.toEpoch(),
                    categoryId = categoryId,
                    uuid = generateUuid()
                )
            }
        )

    private fun sumQuery(splitStrategy: SplitStrategy? = null) =
        TransactionProvider.TRANSACTIONS_SUM_URI.buildUpon()
            .appendQueryParameter(KEY_ACCOUNTID, testAccountId.toString())
            .apply {
                splitStrategy?.let {
                    appendQueryParameter(
                        TransactionProvider.QUERY_PARAMETER_SPLIT_STRATEGY,
                        it.name
                    )
                }
            }
            .build()

    private fun queryGroups(accountId: Long? = null) = contentResolver.query(
        BaseTransactionProvider.groupingUriBuilder(Grouping.MONTH)
            .apply {
                accountId?.let { appendQueryParameter(KEY_ACCOUNTID, it.toString()) }
            }
            .build(),
        null,
        null,
        null,
        null
    )

    @Test
    fun splitIsCountedWithTotal() {
        prefHandler.putBoolean(PrefKey.SPLIT_TRANSACTIONS_AS_TOTAL, true)
        insertSplit(-30, listOf(-40L to expenseCategoryId, 10L to incomeCategoryId))

        queryGroups().useAndAssert {
            hasCount(1)
            movesToFirst()
            hasLong(2, -30)
            hasLong(3, 0)
            hasLong(4, 0)
            hasInt(5, 1)
        }
    }

    @Test
    fun splitIsCountedWithPartsWhenPreferenceIsOff() {
        prefHandler.putBoolean(PrefKey.SPLIT_TRANSACTIONS_AS_TOTAL, false)
        insertSplit(-30, listOf(-40L to expenseCategoryId, 10L to incomeCategoryId))

        queryGroups().useAndAssert {
            hasCount(1)
            movesToFirst()
            hasLong(2, -40)
            hasLong(3, 10)
            hasLong(4, 0)
            hasInt(5, 2)
        }
    }

    @Test
    fun positiveSplitIsCountedAsIncome() {
        prefHandler.putBoolean(PrefKey.SPLIT_TRANSACTIONS_AS_TOTAL, true)
        insertSplit(30, listOf(-10L to expenseCategoryId, 40L to incomeCategoryId))

        queryGroups().useAndAssert {
            hasCount(1)
            movesToFirst()
            hasLong(2, 0)
            hasLong(3, 30)
            hasLong(4, 0)
        }
    }

    @Test
    fun splitWithTransferPartIsCountedWithTotal() {
        prefHandler.putBoolean(PrefKey.SPLIT_TRANSACTIONS_AS_TOTAL, true)
        val otherAccountId = insertAccount("Other account")
        val transferUuid = generateUuid()
        repository.createSplitTransaction(
            Transaction(
                accountId = testAccountId,
                amount = -100,
                date = splitDate.toEpoch(),
                categoryId = SPLIT_CATID,
                uuid = generateUuid()
            ),
            listOf(
                Transaction(
                    accountId = testAccountId,
                    amount = -60,
                    date = splitDate.toEpoch(),
                    categoryId = expenseCategoryId,
                    uuid = generateUuid()
                ) to null,
                Transaction(
                    accountId = testAccountId,
                    amount = -40,
                    date = splitDate.toEpoch(),
                    categoryId = transferCategoryId,
                    transferAccountId = otherAccountId,
                    uuid = transferUuid
                ) to Transaction(
                    accountId = otherAccountId,
                    amount = 40,
                    date = splitDate.toEpoch(),
                    transferAccountId = testAccountId,
                    uuid = transferUuid
                )
            )
        )

        queryGroups(testAccountId).useAndAssert {
            hasCount(1)
            movesToFirst()
            hasLong(2, -100)
            hasLong(3, 0)
            hasLong(4, 0)
        }
    }

    @Test
    fun sumQueryFollowsPreferenceAndCanOverrideIt() {
        prefHandler.putBoolean(PrefKey.SPLIT_TRANSACTIONS_AS_TOTAL, true)
        insertSplit(-30, listOf(-40L to expenseCategoryId, 10L to incomeCategoryId))

        contentResolver.query(
            sumQuery(),
            arrayOf(KEY_SUM_EXPENSES, KEY_SUM_INCOME),
            null,
            null,
            null
        ).useAndAssert {
            movesToFirst()
            hasLong(0, -30)
            hasLong(1, 0)
        }

        contentResolver.query(
            sumQuery(SplitStrategy.PARTS),
            arrayOf(KEY_SUM_EXPENSES, KEY_SUM_INCOME),
            null,
            null,
            null
        ).useAndAssert {
            movesToFirst()
            hasLong(0, -40)
            hasLong(1, 10)
        }
    }

    @Test
    fun groupQueryFilterWithCategoryFilter() {
        insertTransactions()
        val filter = CategoryCriterion("Neutral", neutralCategoryId)
        contentResolver.query(
            BaseTransactionProvider.groupingUriBuilder(Grouping.NONE).build(),
            null,
            filter.getSelectionForParts(),
            filter.getSelectionArgs(true),
            null
        ).useAndAssert {
            hasCount(1)
            hasColumns(
                KEY_YEAR,
                KEY_SECOND_GROUP,
                KEY_SUM_EXPENSES,
                KEY_SUM_INCOME,
                KEY_SUM_TRANSFERS,
                KEY_MAPPED_CATEGORIES
            )
            movesToFirst()
            hasInt(0, 1)
            hasInt(1, 1)
            hasLong(2, 0)
            hasLong(3, 100)
            hasLong(4, 0)
            hasInt(5, 1)
        }
    }

    @Test
    fun groupQueryFilterWithAmountFilter() {
        insertTransactions()
        val filter = AmountCriterion.create(
            Operation.EQ,
            "EUR",
            true,
            400L,
            null
        )
        contentResolver.query(
            BaseTransactionProvider.groupingUriBuilder(Grouping.NONE).build(),
            null,
            filter.getSelectionForParts(),
            filter.getSelectionArgs(true),
            null
        ).useAndAssert {
            hasCount(1)
            hasColumns(
                KEY_YEAR,
                KEY_SECOND_GROUP,
                KEY_SUM_EXPENSES,
                KEY_SUM_INCOME,
                KEY_SUM_TRANSFERS,
                KEY_MAPPED_CATEGORIES
            )
            movesToFirst()
            hasInt(0, 1)
            hasInt(1, 1)
            hasLong(2, 0)
            hasLong(3, 400)
            hasLong(4, 0)
            hasInt(5, 1)
        }
    }

    @Test
    fun groupQueryWithoutFilter() {
        insertTransactions()
        contentResolver.query(
            BaseTransactionProvider.groupingUriBuilder(Grouping.NONE).build(),
            null,
            null,
            null,
            null
        ).useAndAssert {
            hasCount(1)
            hasColumns(
                KEY_YEAR,
                KEY_SECOND_GROUP,
                KEY_SUM_EXPENSES,
                KEY_SUM_INCOME,
                KEY_SUM_TRANSFERS,
                KEY_MAPPED_CATEGORIES
            )
            movesToFirst()
            hasInt(0, 1)
            hasInt(1, 1)
            hasLong(2, -200)
            hasLong(3, 500)
            hasLong(4, 800)
            hasInt(5, 3)
        }
    }

    @Test
    fun groupQueryWithVoid() {
        contentResolver.insert(
            TransactionProvider.TRANSACTIONS_URI,
            TransactionInfo(
                accountId = testAccountId,
                amount = 12345,
                date = LocalDateTime.of(2024, 1, 1, 12, 0),
                crStatus = CrStatus.VOID
            ).contentValues
        )

        contentResolver.query(
            BaseTransactionProvider.groupingUriBuilder(Grouping.DAY).build(),
            null,
            null,
            null,
            null
        ).useAndAssert {
            hasCount(1)
            hasColumns(
                KEY_YEAR,
                KEY_SECOND_GROUP,
                KEY_SUM_EXPENSES,
                KEY_SUM_INCOME,
                KEY_SUM_TRANSFERS,
                KEY_MAPPED_CATEGORIES
            )
            movesToFirst()
            hasInt(0, 2024)
            hasInt(1, 1)
            hasLong(2, 0)
            hasLong(3, 0)
            hasLong(4, 0)
            hasInt(5, 0)
        }
    }
}

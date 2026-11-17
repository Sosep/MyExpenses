package org.totschnig.webui.api

import java.time.LocalDate

/**
 * Everything the HTTP layer needs from the app. The Android implementation
 * lives in [AndroidWebApiDataSource]; tests provide a fake so the routes can run
 * on the JVM without a device or a ContentProvider.
 */
interface WebApiDataSource {
    fun meta(): MetaDto
    fun accounts(): List<AccountDto>
    fun categories(): List<CategoryDto>
    fun payees(): List<PayeeDto>
    fun tags(): List<TagDto>
    fun methods(): List<MethodDto>
    fun transactionPage(
        accountId: Long,
        from: LocalDate?,
        to: LocalDate?,
        type: String?,
        limit: Int,
        offset: Int
    ): PageDto<TransactionDto>
    fun transaction(id: Long): TransactionDto?
    fun groups(
        accountId: Long,
        grouping: String,
        from: LocalDate,
        to: LocalDate
    ): List<GroupDto>
    fun budgets(): List<BudgetDto>
    suspend fun budgetProgress(id: Long, year: Int?, second: Int?): BudgetProgressDto?
    fun createTransaction(body: TransactionWriteDto): TransactionDto
    fun updateTransaction(id: Long, body: TransactionWriteDto): TransactionDto
    fun createTransfer(body: TransferWriteDto): TransactionDto
    fun updateTransfer(id: Long, body: TransferWriteDto): TransactionDto
    fun createSplit(body: SplitWriteDto): TransactionDto
    fun updateSplit(id: Long, body: SplitWriteDto): TransactionDto
    fun deleteTransaction(id: Long): Boolean
}

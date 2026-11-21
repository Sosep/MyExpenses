package org.totschnig.webui.api

import java.time.LocalDate

/**
 * Everything the HTTP layer needs from the app. The Android implementation
 * lives in [AndroidWebApiDataSource]; tests provide a fake so the routes can run
 * on the JVM without a device or a ContentProvider.
 */
interface WebApiDataSource {
    fun meta(): MetaDto
    suspend fun uiPreferences(): UiPreferencesDto
    suspend fun updateUiPreferences(body: UiPreferencesDto): UiPreferencesDto
    fun accounts(): List<AccountDto>
    suspend fun account(id: Long): AccountDto?
    fun accountTypes(): List<AccountTypeDto>
    suspend fun createAccount(body: AccountWriteDto): AccountDto
    suspend fun updateAccount(id: Long, body: AccountWriteDto): AccountDto
    suspend fun deleteAccount(id: Long): Boolean
    fun categories(): List<CategoryDto>
    fun payees(): List<PayeeDto>
    fun tags(): List<TagDto>
    fun methods(): List<MethodDto>
    fun transactionPage(
        accountId: Long,
        from: LocalDate?,
        to: LocalDate?,
        type: String?,
        filters: TransactionQueryFilters = TransactionQueryFilters(),
        limit: Int = 50,
        offset: Int = 0
    ): PageDto<TransactionDto>
    fun transaction(id: Long): TransactionDto?
    fun groups(
        accountId: Long,
        grouping: String,
        from: LocalDate,
        to: LocalDate,
        type: String? = null,
        filters: TransactionQueryFilters = TransactionQueryFilters()
    ): List<GroupDto>
    fun summary(accountId: Long, from: LocalDate, to: LocalDate): ReportSummaryDto
    fun breakdown(
        accountId: Long,
        by: String,
        type: String,
        from: LocalDate,
        to: LocalDate
    ): BreakdownDto
    fun reportTransactions(
        accountId: Long,
        by: String,
        groupId: Long,
        type: String,
        from: LocalDate,
        to: LocalDate,
        limit: Int,
        offset: Int
    ): PageDto<TransactionDto>
    suspend fun budgets(): List<BudgetDto>
    suspend fun budgetProgress(id: Long, year: Int?, second: Int?): BudgetProgressDto?
    suspend fun budgetAllocations(id: Long, year: Int?, second: Int?): List<BudgetAllocationDto>
    suspend fun budgetBreakdown(id: Long, year: Int?, second: Int?): BudgetBreakdownDto?
    suspend fun budgetHistory(id: Long, months: Int): List<BudgetHistoryPointDto>
    suspend fun updateBudgetAllocations(
        id: Long,
        body: BudgetAllocationsWriteDto
    ): List<BudgetAllocationDto>
    suspend fun createBudget(body: BudgetWriteDto): BudgetDto
    suspend fun updateBudget(id: Long, body: BudgetWriteDto): BudgetDto
    suspend fun duplicateBudget(id: Long): BudgetDto
    suspend fun deleteBudget(id: Long): Boolean
    fun createTransaction(body: TransactionWriteDto): TransactionDto
    fun updateTransaction(id: Long, body: TransactionWriteDto): TransactionDto
    fun createTransfer(body: TransferWriteDto): TransactionDto
    fun updateTransfer(id: Long, body: TransferWriteDto): TransactionDto
    fun createSplit(body: SplitWriteDto): TransactionDto
    fun updateSplit(id: Long, body: SplitWriteDto): TransactionDto
    fun deleteTransaction(id: Long): Boolean
    suspend fun createPortfolio(body: PortfolioWriteDto): AccountDto
    suspend fun updatePortfolio(id: Long, body: PortfolioWriteDto): AccountDto
    suspend fun portfolioAssets(id: Long): PortfolioAssetsDto
    fun tradePage(portfolioId: Long, limit: Int, offset: Int): PageDto<TradeDto>
    fun trade(portfolioId: Long, transactionId: Long): TradeDto?
    suspend fun createTrade(portfolioId: Long, body: TradeWriteDto): TradeDto
    suspend fun updateTrade(
        portfolioId: Long,
        transactionId: Long,
        body: TradeWriteDto
    ): TradeDto

    suspend fun createCategory(body: CategoryWriteDto): CategoryDto
    suspend fun updateCategory(id: Long, body: CategoryWriteDto): CategoryDto

    /** `remapTo` moves the branch's movements before deleting. */
    suspend fun deleteCategory(id: Long, remapTo: Long?): Boolean
    suspend fun createMethod(body: MethodWriteDto): MethodDto
    suspend fun updateMethod(id: Long, body: MethodWriteDto): MethodDto
    suspend fun deleteMethod(id: Long): Boolean
    suspend fun createTag(body: TagWriteDto): TagDto
    suspend fun updateTag(id: Long, body: TagWriteDto): TagDto
    suspend fun deleteTag(id: Long): Boolean
    suspend fun currencies(): List<CurrencyDto>
    suspend fun createCurrency(body: CurrencyWriteDto): CurrencyDto
    suspend fun updateCurrency(code: String, body: CurrencyWriteDto): CurrencyDto
    suspend fun deleteCurrency(code: String): Boolean
    suspend fun prices(commodity: String): List<PriceDto>
    suspend fun savePrice(body: PriceWriteDto): PriceDto
    suspend fun deletePrice(commodity: String, date: String): Boolean
}

/** Criteria of the transaction list, all optional and combined with AND. */
data class TransactionQueryFilters(
    val categoryIds: List<Long> = emptyList(),
    val payeeIds: List<Long> = emptyList(),
    val tagIds: List<Long> = emptyList(),
    val methodIds: List<Long> = emptyList(),
    val text: String? = null,
    val amountMin: Long? = null,
    val amountMax: Long? = null,
    val statuses: List<String> = emptyList(),
    /** Only movements without a category. */
    val uncategorized: Boolean = false,
    /** null: any; false: only non-transfers; true: only transfers. */
    val transfer: Boolean? = null
) {
    val isEmpty: Boolean
        get() = categoryIds.isEmpty() && payeeIds.isEmpty() && tagIds.isEmpty() &&
            methodIds.isEmpty() && text.isNullOrBlank() && amountMin == null &&
            amountMax == null && statuses.isEmpty() && !uncategorized && transfer == null
}

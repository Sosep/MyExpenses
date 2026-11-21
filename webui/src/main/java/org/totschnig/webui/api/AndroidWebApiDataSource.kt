package org.totschnig.webui.api

import android.content.ContentUris
import android.content.ContentValues
import android.net.Uri
import io.ktor.http.HttpStatusCode
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeParseException
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong
import kotlinx.coroutines.flow.StateFlow
import org.totschnig.myexpenses.db2.Repository
import org.totschnig.myexpenses.db2.RepositoryTransaction
import org.totschnig.myexpenses.db2.budgetAllocation
import org.totschnig.myexpenses.db2.budgetCriteria
import org.totschnig.myexpenses.db2.categoryUsage
import org.totschnig.myexpenses.db2.createAccount
import org.totschnig.myexpenses.db2.createPaymentMethod
import org.totschnig.myexpenses.db2.createTransaction
import org.totschnig.myexpenses.db2.deleteAccount
import org.totschnig.myexpenses.db2.deleteBudget
import org.totschnig.myexpenses.db2.deleteCategory
import org.totschnig.myexpenses.db2.deleteCurrency
import org.totschnig.myexpenses.db2.deleteMethod
import org.totschnig.myexpenses.db2.deletePrice
import org.totschnig.myexpenses.db2.entities.Transaction
import org.totschnig.myexpenses.db2.getCategoryPath
import org.totschnig.myexpenses.db2.getCurrencyUnitForAccount
import org.totschnig.myexpenses.db2.insertCurrency
import org.totschnig.myexpenses.db2.isCurrencyUsed
import org.totschnig.myexpenses.db2.loadAccount
import org.totschnig.myexpenses.db2.loadAccountType
import org.totschnig.myexpenses.db2.loadBudget
import org.totschnig.myexpenses.db2.loadBudgetProgress
import org.totschnig.myexpenses.db2.loadTrade
import org.totschnig.myexpenses.db2.loadTrades
import org.totschnig.myexpenses.db2.loadTransaction
import org.totschnig.myexpenses.db2.mergeCategoriesAndUpdateFilters
import org.totschnig.myexpenses.db2.saveBudget
import org.totschnig.myexpenses.db2.saveBudgetCriteria
import org.totschnig.myexpenses.db2.saveCategory
import org.totschnig.myexpenses.db2.savePrice
import org.totschnig.myexpenses.db2.saveTrade
import org.totschnig.myexpenses.db2.storeExchangeRate
import org.totschnig.myexpenses.db2.updateAccount
import org.totschnig.myexpenses.db2.updateCurrency
import org.totschnig.myexpenses.db2.updatePaymentMethod
import org.totschnig.myexpenses.db2.updateTransaction
import org.totschnig.myexpenses.model.ContribFeature
import org.totschnig.myexpenses.model.CrStatus
import org.totschnig.myexpenses.model.CurrencyContext
import org.totschnig.myexpenses.model.Grouping
import org.totschnig.myexpenses.model.Money
import org.totschnig.myexpenses.model.generateUuid
import org.totschnig.myexpenses.model.sort.SortDirection
import org.totschnig.myexpenses.model2.Account as AccountModel
import org.totschnig.myexpenses.preference.PrefHandler
import org.totschnig.myexpenses.preference.PrefKey
import org.totschnig.myexpenses.provider.BaseTransactionProvider.Companion.budgetAllocationUri
import org.totschnig.myexpenses.provider.DataBaseAccount
import org.totschnig.myexpenses.provider.DatabaseConstants.WHERE_NOT_SPLIT_PART
import org.totschnig.myexpenses.provider.KEY_ACCOUNTID
import org.totschnig.myexpenses.provider.KEY_BUDGET
import org.totschnig.myexpenses.provider.KEY_BUDGETID
import org.totschnig.myexpenses.provider.KEY_BUDGET_ROLLOVER_NEXT
import org.totschnig.myexpenses.provider.KEY_BUDGET_ROLLOVER_PREVIOUS
import org.totschnig.myexpenses.provider.KEY_CATID
import org.totschnig.myexpenses.provider.KEY_CODE
import org.totschnig.myexpenses.provider.KEY_COLOR
import org.totschnig.myexpenses.provider.KEY_COMMODITY
import org.totschnig.myexpenses.provider.KEY_COMMODITY_TYPE
import org.totschnig.myexpenses.provider.KEY_CURRENCY
import org.totschnig.myexpenses.provider.KEY_DATE
import org.totschnig.myexpenses.provider.KEY_DYNAMIC
import org.totschnig.myexpenses.provider.KEY_EXCLUDE_FROM_TOTALS
import org.totschnig.myexpenses.provider.KEY_FRACTION_DIGITS
import org.totschnig.myexpenses.provider.KEY_LABEL
import org.totschnig.myexpenses.provider.KEY_ONE_TIME
import org.totschnig.myexpenses.provider.KEY_OPENING_BALANCE
import org.totschnig.myexpenses.provider.KEY_PARENTID
import org.totschnig.myexpenses.provider.KEY_ROWID
import org.totschnig.myexpenses.provider.KEY_SECOND_GROUP
import org.totschnig.myexpenses.provider.KEY_SOURCE
import org.totschnig.myexpenses.provider.KEY_SYMBOL
import org.totschnig.myexpenses.provider.KEY_TITLE
import org.totschnig.myexpenses.provider.KEY_TYPE
import org.totschnig.myexpenses.provider.KEY_VALUE
import org.totschnig.myexpenses.provider.KEY_YEAR
import org.totschnig.myexpenses.provider.PORTFOLIO_CONTAINER
import org.totschnig.myexpenses.provider.SPLIT_CATID
import org.totschnig.myexpenses.provider.TransactionProvider
import org.totschnig.myexpenses.provider.TransactionProvider.BUDGETS_URI
import org.totschnig.myexpenses.provider.TransactionProvider.BUDGET_ALLOCATIONS_URI
import org.totschnig.myexpenses.provider.TransactionProvider.CATEGORIES_URI
import org.totschnig.myexpenses.provider.TransactionProvider.METHODS_URI
import org.totschnig.myexpenses.provider.TransactionProvider.PAYEES_URI
import org.totschnig.myexpenses.provider.TransactionProvider.TAGS_URI
import org.totschnig.myexpenses.provider.TransactionProvider.TRANSACTIONS_URI
import org.totschnig.myexpenses.provider.filter.AndCriterion
import org.totschnig.myexpenses.provider.filter.CategoryCriterion
import org.totschnig.myexpenses.provider.filter.CrStatusCriterion
import org.totschnig.myexpenses.provider.filter.Criterion
import org.totschnig.myexpenses.provider.filter.MethodCriterion
import org.totschnig.myexpenses.provider.filter.PayeeCriterion
import org.totschnig.myexpenses.provider.filter.TagCriterion
import org.totschnig.myexpenses.provider.getDouble
import org.totschnig.myexpenses.provider.getIntIfExists
import org.totschnig.myexpenses.provider.getString
import org.totschnig.myexpenses.provider.getStringOrNull
import org.totschnig.myexpenses.provider.useAndMapToList
import org.totschnig.myexpenses.provider.withLimit
import org.totschnig.myexpenses.retrofit.ExchangeRateSource
import org.totschnig.myexpenses.util.calculateRawExchangeRate
import org.totschnig.myexpenses.util.calculateRealExchangeRate
import org.totschnig.myexpenses.util.epoch2ZonedDateTime
import org.totschnig.myexpenses.util.licence.LicenceHandler
import org.totschnig.myexpenses.util.toEpoch
import org.totschnig.myexpenses.viewmodel.data.Budget
import org.totschnig.myexpenses.viewmodel.data.CostLeg
import org.totschnig.myexpenses.viewmodel.data.FullAccount
import org.totschnig.myexpenses.viewmodel.data.FundingSource
import org.totschnig.myexpenses.viewmodel.data.Trade
import org.totschnig.myexpenses.viewmodel.data.TradeIntent
import org.totschnig.myexpenses.viewmodel.data.TradeType

class AndroidWebApiDataSource(
    private val repository: Repository,
    private val prefHandler: PrefHandler,
    private val currencyContext: CurrencyContext,
    private val payeeMap: StateFlow<Map<Long, String>>,
    private val tagMap: StateFlow<Map<Long, String>>,
    private val licenceHandler: LicenceHandler,
    private val appVersion: String
) : WebApiDataSource {
    override fun meta() = MetaDto(
        appVersion = appVersion,
        serverTime = LocalDateTime.now().withNano(0).toString(),
        timeZone = ZoneId.systemDefault().id,
        locale = Locale.getDefault().toLanguageTag(),
        homeCurrency = currencyContext.homeCurrencyString,
        preferences = PreferencesDto(
            timeEnabled = prefHandler.getBoolean(PrefKey.TRANSACTION_WITH_TIME, false),
            valueDateEnabled = prefHandler.getBoolean(PrefKey.TRANSACTION_WITH_VALUE_DATE, false)
        )
    )

    override fun accounts() = repository.queryAccounts(currencyContext)

    override suspend fun account(id: Long) =
        repository.queryAccounts(currencyContext, id).firstOrNull()

    override fun accountTypes() = repository.queryAccountTypes()

    override suspend fun createAccount(body: AccountWriteDto): AccountDto {
        val account = budgetAccountValues(body)
        val created = repository.createAccount(account)
        return account(created.id) ?: throw ApiException(
            HttpStatusCode.InternalServerError,
            "save_failed",
            "Could not create the account"
        )
    }

    override suspend fun updateAccount(id: Long, body: AccountWriteDto): AccountDto {
        val existing = account(id) ?: throw ApiException(
            HttpStatusCode.NotFound,
            "account_not_found",
            "Account not found"
        )
        val values = ContentValues()
        body.label?.trim()?.takeIf { it.isNotBlank() }?.let { values.put(KEY_LABEL, it) }
        body.openingBalanceMinor?.let { values.put(KEY_OPENING_BALANCE, it) }
        body.excludeFromTotals?.let { values.put(KEY_EXCLUDE_FROM_TOTALS, it) }
        body.color?.let { values.put(KEY_COLOR, it) }
        rejectAccountHierarchy(body)
        val hasTransactions = accountHasTransactions(id)
        if (body.type != null && body.type != existing.type) {
            if (hasTransactions) {
                throw ApiException(
                    HttpStatusCode.UnprocessableEntity,
                    "unsupported_account_change",
                    "The type of an account with transactions cannot change"
                )
            }
            values.put(KEY_TYPE, parseAccountTypeId(body.type))
        }
        if (body.currency != null && body.currency != existing.currency) {
            if (hasTransactions) {
                throw ApiException(
                    HttpStatusCode.UnprocessableEntity,
                    "unsupported_account_change",
                    "The currency of an account with transactions cannot change"
                )
            }
            requireCurrency(body.currency)
            values.put(KEY_CURRENCY, body.currency)
        }
        if (values.size() > 0) {
            repository.updateAccount(id) { putAll(values) }
        }
        return account(id)!!
    }

    override suspend fun deleteAccount(id: Long): Boolean {
        val existing = account(id) ?: return false
        if (existing.sealed) {
            throw ApiException(
                HttpStatusCode.Conflict,
                "account_sealed",
                "Accounts with a sealed debt cannot be deleted"
            )
        }
        repository.deleteAccount(id)
        return true
    }

    private fun budgetAccountValues(body: AccountWriteDto): AccountModel {
        rejectAccountHierarchy(body)
        val label = body.label?.trim().orEmpty()
        if (label.isBlank()) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Missing label",
                mapOf("label" to "Required")
            )
        }
        val currency = requireCurrency(body.currency)
        val type = repository.loadAccountType(parseAccountTypeId(body.type))
        return AccountModel(
            label = label,
            currency = currency,
            type = type,
            openingBalance = body.openingBalanceMinor ?: 0,
            excludeFromTotals = body.excludeFromTotals ?: false,
            color = body.color ?: AccountModel.DEFAULT_COLOR
        )
    }

    private fun parseAccountTypeId(raw: String?): Long {
        val id = raw?.toLongOrNull()?.takeIf { it > 0 } ?: throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "Missing type",
            mapOf("type" to "Required")
        )
        return try {
            repository.loadAccountType(id).id
        } catch (_: Exception) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Unknown account type",
                mapOf("type" to "Unknown")
            )
        }
    }

    private fun requireCurrency(currency: String?): String {
        val code = currency?.takeIf { it.isNotBlank() } ?: throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "Missing currency",
            mapOf("currency" to "Required")
        )
        return try {
            currencyContext[code].code
        } catch (_: Exception) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Unknown currency",
                mapOf("currency" to "Unknown")
            )
        }
    }

    /** Sub-accounts exist in the app; the web editor does not offer them yet. */
    private fun rejectAccountHierarchy(body: AccountWriteDto) {
        if (body.parentId != null) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "unsupported_account_hierarchy",
                "Sub-accounts are not supported from the web yet",
                mapOf("parentId" to "Not supported")
            )
        }
    }

    private fun accountHasTransactions(accountId: Long): Boolean =
        repository.contentResolver.query(
            TRANSACTIONS_URI,
            arrayOf("count(*)"),
            "$KEY_ACCOUNTID = ? AND $KEY_PARENTID IS NULL",
            arrayOf(accountId.toString()),
            null
        )?.use { if (it.moveToFirst()) it.getLong(0) > 0 else false } ?: false

    override fun categories() = repository.queryCategories()

    override fun payees() = repository.queryPayees()

    override fun tags() = repository.queryTags()

    override fun methods() = repository.queryMethods()

    override suspend fun budgets(): List<BudgetDto> =
        repository.contentResolver.query(
            BUDGETS_URI,
            null,
            null,
            null,
            KEY_TITLE
        )?.use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    add(repository.budgetCreatorFunction(cursor).toDtoWithCriteria(repository))
                }
            }
        }.orEmpty()

    override suspend fun budgetProgress(
        id: Long,
        year: Int?,
        second: Int?
    ): BudgetProgressDto? {
        val budget = repository.loadBudget(id) ?: return null
        val period = if (year != null && second != null) year to second else null
        val progress = repository.loadBudgetProgress(id, period) ?: return null
        val periodYear = progress.groupInfo.year
        val periodSecond = progress.groupInfo.second
        return BudgetProgressDto(
            budgetId = budget.id,
            accountId = budget.accountId,
            title = progress.title,
            currency = progress.currency,
            fractionDigits = currencyContext[progress.currency].fractionDigits,
            grouping = budget.grouping.name,
            periodYear = progress.groupInfo.year,
            periodSecond = progress.groupInfo.second,
            periodStart = progress.groupInfo.duration.start.toString(),
            periodEnd = progress.groupInfo.duration.end.toString(),
            periodDescription = progress.groupInfo.description,
            allocatedMinor = progress.allocated,
            spentMinor = progress.spent,
            remainingMinor = progress.remainingBudget,
            totalDays = progress.totalDays,
            currentDay = progress.currentDay,
            periodAllocationMinor = if (periodYear != null && periodSecond != null) {
                repository.budgetAllocation(budget.id, 0L, periodYear to periodSecond)
            } else {
                null
            }
        )
    }

    override fun transactionPage(
        accountId: Long,
        from: LocalDate?,
        to: LocalDate?,
        type: String?,
        filters: TransactionQueryFilters,
        limit: Int,
        offset: Int
    ): PageDto<TransactionDto> {
        val currency = repository.getCurrencyUnitForAccount(accountId)
            ?: throw ApiException(
                HttpStatusCode.NotFound,
                "account_not_found",
                "Account not found"
            )
        val (items, total) = repository.queryTransactionsPage(
            accountId = accountId,
            from = from,
            to = to,
            type = type,
            // A category filter means its whole branch, as in the Android
            // `CategoryCriterion`; the tree is only read when a category is set.
            filters = if (filters.categoryIds.isEmpty()) {
                filters
            } else {
                filters.copy(
                    categoryIds = categoryBranchIds(
                        filters.categoryIds,
                        repository.queryCategories().associate { it.id to it.parentId }
                    )
                )
            },
            limit = limit,
            offset = offset
        )
        val withTime = prefHandler.getBoolean(PrefKey.TRANSACTION_WITH_TIME, false)
        val methodLabels = repository.queryMethods().associate { it.id to it.label }
        return PageDto(
            items = items.map {
                it.toApiDto(
                    currencyUnit = currency,
                    payeeMap = payeeMap.value,
                    tagMap = tagMap.value,
                    withTime = withTime,
                    methodMap = methodLabels
                )
            },
            total = total,
            limit = limit,
            offset = offset
        )
    }

    override fun transaction(id: Long): TransactionDto? = try {
        loadTransactionDto(id)
    } catch (_: ApiException) {
        null
    }

    override fun groups(
        accountId: Long,
        grouping: String,
        from: LocalDate,
        to: LocalDate,
        type: String?,
        filters: TransactionQueryFilters
    ): List<GroupDto> {
        repository.getCurrencyUnitForAccount(accountId)
            ?: throw ApiException(
                HttpStatusCode.NotFound,
                "account_not_found",
                "Account not found"
            )
        return repository.queryTransactionGroups(
            accountId = accountId,
            grouping = Grouping.valueOf(grouping),
            from = from,
            to = to,
            type = type,
            // Same branch expansion as the transaction list, so the period sums
            // cover exactly the rows the filter shows.
            filters = if (filters.categoryIds.isEmpty()) {
                filters
            } else {
                filters.copy(
                    categoryIds = categoryBranchIds(
                        filters.categoryIds,
                        repository.queryCategories().associate { it.id to it.parentId }
                    )
                )
            }
        )
    }

    override fun summary(
        accountId: Long,
        from: LocalDate,
        to: LocalDate
    ): ReportSummaryDto {
        val allAccounts = accountId == 0L
        val unit = if (allAccounts) {
            currencyContext.homeCurrencyUnit
        } else {
            repository.getCurrencyUnitForAccount(accountId)
                ?: throw ApiException(
                    HttpStatusCode.NotFound,
                    "account_not_found",
                    "Account not found"
                )
        }
        return repository.queryReportSummary(
            accountId = accountId.takeIf { !allAccounts },
            from = from,
            to = to,
            unit = unit,
            allAccounts = allAccounts
        )
    }

    override fun breakdown(
        accountId: Long,
        by: String,
        type: String,
        from: LocalDate,
        to: LocalDate
    ): BreakdownDto {
        val allAccounts = accountId == 0L
        val unit = if (allAccounts) {
            currencyContext.homeCurrencyUnit
        } else {
            repository.getCurrencyUnitForAccount(accountId)
                ?: throw ApiException(
                    HttpStatusCode.NotFound,
                    "account_not_found",
                    "Account not found"
                )
        }
        return repository.queryBreakdown(
            accountId = accountId.takeIf { !allAccounts },
            by = by,
            type = type,
            from = from,
            to = to,
            unit = unit,
            allAccounts = allAccounts
        )
    }

    override fun reportTransactions(
        accountId: Long,
        by: String,
        groupId: Long,
        type: String,
        from: LocalDate,
        to: LocalDate,
        limit: Int,
        offset: Int
    ): PageDto<TransactionDto> {
        if (accountId == 0L) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "unsupported_all_accounts",
                "Drill-down needs a single account"
            )
        }
        val currency = repository.getCurrencyUnitForAccount(accountId)
            ?: throw ApiException(
                HttpStatusCode.NotFound,
                "account_not_found",
                "Account not found"
            )
        val (items, total) = repository.queryReportTransactions(
            accountId,
            by,
            groupId,
            type,
            from,
            to,
            limit,
            offset
        )
        val withTime = prefHandler.getBoolean(PrefKey.TRANSACTION_WITH_TIME, false)
        val methodLabels = repository.queryMethods().associate { it.id to it.label }
        return PageDto(
            items = items.map {
                it.toApiDto(
                    currencyUnit = currency,
                    payeeMap = payeeMap.value,
                    tagMap = tagMap.value,
                    withTime = withTime,
                    methodMap = methodLabels
                )
            },
            total = total,
            limit = limit,
            offset = offset
        )
    }

    override fun createTransaction(body: TransactionWriteDto): TransactionDto =
        createSimple(body)

    override fun updateTransaction(id: Long, body: TransactionWriteDto): TransactionDto =
        updateSimple(id, body)

    override fun deleteTransaction(id: Long): Boolean =
        repository.deleteTransaction(id)

    override fun createTransfer(body: TransferWriteDto): TransactionDto {
        val from = body.fromAccountId.requirePositive("fromAccountId")
        val to = body.toAccountId.requirePositive("toAccountId")
        requireDifferentAccounts(from, to)
        val amount = abs(body.amountMinor.requireNonZero("amountMinor"))
        val date = body.date.requireDate("date")
        val time = body.time
            ?.takeIf { it.isNotBlank() }
            ?.let { parseTime(it, "time") }
        val valueDate = body.valueDate
            ?.takeIf { it.isNotBlank() }
            ?.let { parseDate(it, "valueDate") }
            ?: date
        validateAccount(from)
        validateAccount(to)
        val payeeId = body.payeeId.normalizeId()
        validateOptional("payeeId", "payee", payeeId, PAYEES_URI)
        val methodId = body.methodId.normalizeId()
        validateOptional("methodId", "method", methodId, METHODS_URI)
        val tagIds = body.tagIds.orEmpty().filter { it > 0 }.distinct()
        validateTags(tagIds)
        val dateEpoch = dateTimeEpoch(date, time, null)
        val valueDateEpoch = valueDate.toEpoch()
        val uuid = generateUuid()
        val categoryId = prefHandler.defaultTransferCategory
        val source = Transaction(
            id = 0,
            comment = body.comment.orEmpty(),
            date = dateEpoch,
            valueDate = valueDateEpoch,
            amount = -amount,
            categoryId = categoryId,
            accountId = from,
            transferAccountId = to,
            payeeId = payeeId,
            methodId = methodId,
            crStatus = CrStatus.UNRECONCILED,
            referenceNumber = body.referenceNumber?.takeIf { it.isNotBlank() },
            uuid = uuid,
            tagList = tagIds
        )
        val destination = source.copy(
            accountId = to,
            transferAccountId = from,
            amount = amount
        )
        val created = repository.createTransaction(
            RepositoryTransaction(source, transferPeer = destination)
        )
        return loadTransactionDto(created.data.id)
    }

    override fun updateTransfer(id: Long, body: TransferWriteDto): TransactionDto {
        val existing = loadExistingTransfer(id)
        val source = if (existing.data.amount < 0) existing.data else existing.transferPeer!!
        val destination = if (source.id ==
            existing.data.id
        ) {
            existing.transferPeer!!
        } else {
            existing.data
        }
        val from = body.fromAccountId.requirePositive("fromAccountId")
        val to = body.toAccountId.requirePositive("toAccountId")
        requireDifferentAccounts(from, to)
        val amount = abs(body.amountMinor.requireNonZero("amountMinor"))
        val date = body.date.requireDate("date")
        val time = body.time
            ?.takeIf { it.isNotBlank() }
            ?.let { parseTime(it, "time") }
        validateAccount(from)
        validateAccount(to)
        val payeeId = body.payeeId.normalizeId()
        validateOptional("payeeId", "payee", payeeId, PAYEES_URI)
        val methodId = body.methodId.normalizeId()
        validateOptional("methodId", "method", methodId, METHODS_URI)
        val requestedTags = body.tagIds
            ?.filter { it > 0 }
            ?.distinct()
        if (requestedTags != null) validateTags(requestedTags)
        val dateEpoch = dateTimeEpoch(date, time, source.date)
        val valueDateEpoch = body.valueDate
            ?.takeIf { it.isNotBlank() }
            ?.let { parseDate(it, "valueDate").toEpoch() }
            ?: source.valueDate
        val categoryId = prefHandler.defaultTransferCategory
        val updatedSource = source.copy(
            accountId = from,
            transferAccountId = to,
            amount = -amount,
            categoryId = categoryId,
            date = dateEpoch,
            valueDate = valueDateEpoch,
            payeeId = payeeId,
            methodId = methodId,
            comment = body.comment.orEmpty(),
            referenceNumber = body.referenceNumber?.takeIf { it.isNotBlank() },
            tagList = requestedTags ?: source.tagList
        )
        val updatedDestination = destination.copy(
            accountId = to,
            transferAccountId = from,
            amount = amount,
            categoryId = categoryId,
            date = dateEpoch,
            valueDate = valueDateEpoch,
            payeeId = payeeId,
            methodId = methodId,
            comment = body.comment.orEmpty(),
            referenceNumber = body.referenceNumber?.takeIf { it.isNotBlank() },
            tagList = requestedTags ?: destination.tagList
        )
        repository.updateTransaction(
            RepositoryTransaction(updatedSource, transferPeer = updatedDestination)
        )
        return loadTransactionDto(updatedSource.id)
    }

    override fun createSplit(body: SplitWriteDto): TransactionDto {
        val accountId = body.accountId.requirePositive("accountId")
        val amount = body.amountMinor.requireNonZero("amountMinor")
        val date = body.date.requireDate("date")
        val time = body.time
            ?.takeIf { it.isNotBlank() }
            ?.let { parseTime(it, "time") }
        val valueDate = body.valueDate
            ?.takeIf { it.isNotBlank() }
            ?.let { parseDate(it, "valueDate") }
            ?: date
        validateAccount(accountId)
        val parentPayeeId = body.payeeId.normalizeId()
        validateOptional("payeeId", "payee", parentPayeeId, PAYEES_URI)
        val parentMethodId = body.methodId.normalizeId()
        validateOptional("methodId", "method", parentMethodId, METHODS_URI)
        val parentTags = body.tagIds.orEmpty().filter { it > 0 }.distinct()
        validateTags(parentTags)
        val parts = body.parts.orEmpty()
        if (parts.isEmpty()) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "A split needs at least one part",
                mapOf("parts" to "Required")
            )
        }
        val dateEpoch = dateTimeEpoch(date, time, null)
        val valueDateEpoch = valueDate.toEpoch()
        val uuid = generateUuid()
        var sum = 0L
        val partTransactions = parts.mapIndexed { index, part ->
            val partAmount = part.amountMinor.requireNonZero("parts[$index].amountMinor")
            sum += partAmount
            val categoryId = part.categoryId.normalizeId()
            validateOptional("parts[$index].categoryId", "category", categoryId, CATEGORIES_URI)
            val payeeId = part.payeeId.normalizeId()
            validateOptional("parts[$index].payeeId", "payee", payeeId, PAYEES_URI)
            val methodId = part.methodId.normalizeId()
            validateOptional("parts[$index].methodId", "method", methodId, METHODS_URI)
            val partTags = part.tagIds.orEmpty().filter { it > 0 }.distinct()
            validateTags(partTags)
            Transaction(
                id = 0,
                comment = part.comment.orEmpty(),
                date = dateEpoch,
                valueDate = valueDateEpoch,
                amount = partAmount,
                categoryId = categoryId,
                accountId = accountId,
                payeeId = payeeId,
                methodId = methodId,
                crStatus = CrStatus.UNRECONCILED,
                referenceNumber = part.referenceNumber?.takeIf { it.isNotBlank() },
                // Each part needs its own uuid: (account_id, uuid, status) is unique.
                uuid = generateUuid(),
                tagList = partTags
            )
        }
        if (sum != amount) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Sum of parts must equal the parent amount",
                mapOf("parts" to "Sum must equal amountMinor")
            )
        }
        val parent = Transaction(
            id = 0,
            comment = body.comment.orEmpty(),
            date = dateEpoch,
            valueDate = valueDateEpoch,
            amount = amount,
            categoryId = SPLIT_CATID,
            accountId = accountId,
            payeeId = parentPayeeId,
            methodId = parentMethodId,
            crStatus = CrStatus.UNRECONCILED,
            referenceNumber = body.referenceNumber?.takeIf { it.isNotBlank() },
            uuid = uuid,
            tagList = parentTags
        )
        val created = repository.createTransaction(
            RepositoryTransaction(
                parent,
                splitParts = partTransactions.map { RepositoryTransaction(it) }
            )
        )
        return loadTransactionDto(created.data.id)
    }

    override fun updateSplit(id: Long, body: SplitWriteDto): TransactionDto {
        val existing = loadExistingSplit(id)
        val accountId = body.accountId.requirePositive("accountId")
        if (accountId != existing.data.accountId) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "unsupported_move",
                "Moving a split to another account is not supported",
                mapOf("accountId" to "Must match the current account")
            )
        }
        val amount = body.amountMinor.requireNonZero("amountMinor")
        val date = body.date.requireDate("date")
        val time = body.time
            ?.takeIf { it.isNotBlank() }
            ?.let { parseTime(it, "time") }
        val dateEpoch = dateTimeEpoch(date, time, existing.data.date)
        val valueDateEpoch = body.valueDate
            ?.takeIf { it.isNotBlank() }
            ?.let { parseDate(it, "valueDate").toEpoch() }
            ?: existing.data.valueDate
        val parentPayeeId = body.payeeId.normalizeId()
        validateOptional("payeeId", "payee", parentPayeeId, PAYEES_URI)
        val parentMethodId = body.methodId.normalizeId()
        validateOptional("methodId", "method", parentMethodId, METHODS_URI)
        val parentTags = body.tagIds
            ?.filter { it > 0 }
            ?.distinct()
            ?: existing.data.tagList
        validateTags(parentTags)
        val existingParts = existing.splitParts.orEmpty().associateBy { it.id }
        val parts = body.parts.orEmpty()
        if (parts.isEmpty()) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "A split needs at least one part",
                mapOf("parts" to "Required")
            )
        }
        var sum = 0L
        val partTransactions = parts.mapIndexed { index, part ->
            val partId = part.id?.takeIf { it > 0 } ?: 0L
            if (partId != 0L && existingParts[partId] == null) {
                throw ApiException(
                    HttpStatusCode.UnprocessableEntity,
                    "invalid_part",
                    "Part $partId does not belong to this split",
                    mapOf("parts" to "Unknown part id")
                )
            }
            val partAmount = part.amountMinor.requireNonZero("parts[$index].amountMinor")
            sum += partAmount
            val categoryId = part.categoryId.normalizeId()
            validateOptional("parts[$index].categoryId", "category", categoryId, CATEGORIES_URI)
            val payeeId = part.payeeId.normalizeId()
            validateOptional("parts[$index].payeeId", "payee", payeeId, PAYEES_URI)
            val methodId = part.methodId.normalizeId()
            validateOptional("parts[$index].methodId", "method", methodId, METHODS_URI)
            val partTags = part.tagIds
                ?.filter { it > 0 }
                ?.distinct()
                ?: existingParts[partId]?.data?.tagList.orEmpty()
            validateTags(partTags)
            Transaction(
                id = partId,
                comment = part.comment.orEmpty(),
                date = dateEpoch,
                valueDate = valueDateEpoch,
                amount = partAmount,
                categoryId = categoryId,
                accountId = accountId,
                payeeId = payeeId,
                methodId = methodId,
                crStatus = existing.data.crStatus,
                referenceNumber = part.referenceNumber?.takeIf { it.isNotBlank() },
                // Keep the part's own uuid; a new part gets a fresh one. Sharing the
                // parent's uuid violates the unique index on (account_id, uuid, status).
                uuid = existingParts[partId]?.data?.uuid ?: generateUuid(),
                parentId = existing.data.id,
                tagList = partTags
            )
        }
        if (sum != amount) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Sum of parts must equal the parent amount",
                mapOf("parts" to "Sum must equal amountMinor")
            )
        }
        val parent = existing.data.copy(
            amount = amount,
            date = dateEpoch,
            valueDate = valueDateEpoch,
            categoryId = SPLIT_CATID,
            payeeId = parentPayeeId,
            methodId = parentMethodId,
            comment = body.comment.orEmpty(),
            referenceNumber = body.referenceNumber?.takeIf { it.isNotBlank() },
            tagList = parentTags
        )
        repository.updateTransaction(
            RepositoryTransaction(
                parent,
                splitParts = partTransactions.map { RepositoryTransaction(it) }
            )
        )
        return loadTransactionDto(parent.id)
    }

    private fun requireReportAccount(accountId: Long) {
        if (repository.getCurrencyUnitForAccount(accountId) == null) {
            throw ApiException(
                HttpStatusCode.NotFound,
                "account_not_found",
                "Account not found"
            )
        }
    }

    private fun loadExistingTransfer(id: Long): RepositoryTransaction {
        val existing = try {
            repository.loadTransaction(id, withTransfer = true, withTags = true)
        } catch (_: IllegalArgumentException) {
            throw ApiException(
                HttpStatusCode.NotFound,
                "transaction_not_found",
                "Transaction not found"
            )
        }
        if (existing.transferPeer == null) {
            throw ApiException(
                HttpStatusCode.Conflict,
                "unsupported_kind",
                "Not a transfer"
            )
        }
        return existing
    }

    private fun loadExistingSplit(id: Long): RepositoryTransaction {
        val existing = try {
            repository.loadTransaction(id, withTransfer = true, withTags = true)
        } catch (_: IllegalArgumentException) {
            throw ApiException(
                HttpStatusCode.NotFound,
                "transaction_not_found",
                "Transaction not found"
            )
        }
        if (!existing.data.isSplit) {
            throw ApiException(
                HttpStatusCode.Conflict,
                "unsupported_kind",
                "Not a split transaction"
            )
        }
        return existing
    }

    private fun dateTimeEpoch(date: LocalDate, time: LocalTime?, existing: Long?): Long =
        if (time != null) {
            LocalDateTime.of(date, time).toEpoch()
        } else {
            existing?.let {
                LocalDateTime.of(date, epoch2ZonedDateTime(it).toLocalTime()).toEpoch()
            } ?: date.toEpoch()
        }

    private fun requireDifferentAccounts(from: Long, to: Long) {
        if (from == to) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "invalid_transfer",
                "The two accounts must differ",
                mapOf("toAccountId" to "Must differ from fromAccountId")
            )
        }
    }

    private fun createSimple(body: TransactionWriteDto): TransactionDto {
        val accountId = body.accountId.requirePositive("accountId")
        val amountMinor = body.amountMinor.requireNonZero("amountMinor")
        val date = body.date.requireDate("date")
        val time = body.time
            ?.takeIf { it.isNotBlank() }
            ?.let { parseTime(it, "time") }
        val valueDate = body.valueDate
            ?.takeIf { it.isNotBlank() }
            ?.let { parseDate(it, "valueDate") }
            ?: date
        validateAccount(accountId)
        val categoryId = body.categoryId.normalizeId()
        validateOptional("categoryId", "category", categoryId, CATEGORIES_URI)
        val payeeId = body.payeeId.normalizeId()
        validateOptional("payeeId", "payee", payeeId, PAYEES_URI)
        val methodId = body.methodId.normalizeId()
        validateOptional("methodId", "method", methodId, METHODS_URI)
        val tagIds = body.tagIds.orEmpty().filter { it > 0 }.distinct()
        validateTags(tagIds)
        val dateEpoch = if (time != null) {
            LocalDateTime.of(date, time).toEpoch()
        } else {
            date.toEpoch()
        }
        val transaction = Transaction(
            id = 0,
            comment = body.comment.orEmpty(),
            date = dateEpoch,
            valueDate = valueDate.toEpoch(),
            amount = amountMinor,
            categoryId = categoryId,
            accountId = accountId,
            payeeId = payeeId,
            methodId = methodId,
            crStatus = CrStatus.UNRECONCILED,
            referenceNumber = body.referenceNumber?.takeIf { it.isNotBlank() },
            uuid = generateUuid(),
            tagList = tagIds
        )
        val created = repository.createTransaction(transaction)
        return loadTransactionDto(created.data.id)
    }

    private fun updateSimple(id: Long, body: TransactionWriteDto): TransactionDto {
        val existing = loadExisting(id)
        if (existing.data.isSplit || existing.data.isTransfer) {
            throw ApiException(
                HttpStatusCode.Conflict,
                "unsupported_kind",
                "Transfers and split transactions need their own endpoint"
            )
        }
        val accountId = body.accountId.requirePositive("accountId")
        val amountMinor = body.amountMinor.requireNonZero("amountMinor")
        val date = body.date.requireDate("date")
        val time = body.time
            ?.takeIf { it.isNotBlank() }
            ?.let { parseTime(it, "time") }
        validateAccount(accountId)
        val categoryId = body.categoryId.normalizeId()
        validateOptional("categoryId", "category", categoryId, CATEGORIES_URI)
        val payeeId = body.payeeId.normalizeId()
        validateOptional("payeeId", "payee", payeeId, PAYEES_URI)
        val methodId = body.methodId.normalizeId()
        validateOptional("methodId", "method", methodId, METHODS_URI)
        val tagIds = body.tagIds
            ?.filter { it > 0 }
            ?.distinct()
            ?: existing.data.tagList
        validateTags(tagIds)
        val dateEpoch = if (time != null) {
            LocalDateTime.of(date, time).toEpoch()
        } else {
            val existingTime = epoch2ZonedDateTime(existing.data.date).toLocalTime()
            LocalDateTime.of(date, existingTime).toEpoch()
        }
        val valueDateEpoch = body.valueDate
            ?.takeIf { it.isNotBlank() }
            ?.let { parseDate(it, "valueDate").toEpoch() }
            ?: existing.data.valueDate
        val updated = existing.data.copy(
            accountId = accountId,
            amount = amountMinor,
            date = dateEpoch,
            valueDate = valueDateEpoch,
            categoryId = categoryId,
            payeeId = payeeId,
            methodId = methodId,
            referenceNumber = body.referenceNumber?.takeIf { it.isNotBlank() },
            comment = body.comment.orEmpty(),
            tagList = tagIds
        )
        repository.updateTransaction(updated)
        return loadTransactionDto(id)
    }

    private fun loadExisting(id: Long) = try {
        repository.loadTransaction(id, withTransfer = false, withTags = false)
    } catch (_: IllegalArgumentException) {
        throw ApiException(
            HttpStatusCode.NotFound,
            "transaction_not_found",
            "Transaction not found"
        )
    }

    override suspend fun createBudget(body: BudgetWriteDto): BudgetDto {
        val accountId = body.accountId.requirePositive("accountId")
        validateAccount(accountId)
        val title = body.title?.trim().orEmpty()
        if (title.isBlank()) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Missing title",
                mapOf("title" to "Required")
            )
        }
        val grouping = parseBudgetGrouping(body.grouping)
        val (start, end) = budgetDuration(grouping, body.start, body.end)
        val amount = body.amountMinor ?: throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "Missing amountMinor",
            mapOf("amountMinor" to "Required")
        )
        if (amount < 0) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Invalid amountMinor",
                mapOf("amountMinor" to "Must not be negative")
            )
        }
        if (amount > MAX_AMOUNT_MINOR) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Invalid amountMinor",
                mapOf("amountMinor" to "Out of range")
            )
        }
        val currency = repository.getCurrencyUnitForAccount(accountId)!!.code
        val budget = Budget(
            id = 0,
            accountId = accountId,
            title = title,
            // budgets.description is NOT NULL in the schema: an absent or blank description
            // is stored as "", never null, or the insert fails.
            description = body.description?.trim().orEmpty(),
            currency = currency,
            grouping = grouping,
            color = -1,
            start = start,
            end = end,
            accountName = null,
            default = body.isDefault == true
        )
        val id = repository.saveBudget(budget, amount)
        if (id <= 0) {
            throw ApiException(
                HttpStatusCode.InternalServerError,
                "save_failed",
                "Could not create the budget"
            )
        }
        body.criteria?.let { criteria ->
            validateBudgetCriteria(criteria)
            try {
                repository.saveBudgetCriteria(id, criteria.toCriterion())
            } catch (cause: Exception) {
                // The budget is already stored; without its filter it would
                // silently cover the whole account, so undo the insert.
                repository.deleteBudget(id)
                throw ApiException(
                    HttpStatusCode.InternalServerError,
                    "save_failed",
                    "Could not save the budget filter"
                )
            }
        }
        return repository.loadBudget(id)!!.toDtoWithCriteria(repository)
    }

    override suspend fun updateBudget(id: Long, body: BudgetWriteDto): BudgetDto {
        val existing = repository.loadBudget(id) ?: throw ApiException(
            HttpStatusCode.NotFound,
            "budget_not_found",
            "Budget not found"
        )
        val accountId = body.accountId.requirePositive("accountId")
        if (accountId != existing.accountId) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "unsupported_move",
                "Moving a budget to another account is not supported",
                mapOf("accountId" to "Must match the current account")
            )
        }
        val grouping = parseBudgetGrouping(body.grouping)
        if (grouping != existing.grouping) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "unsupported_grouping_change",
                "Changing the period type is not supported",
                mapOf("grouping" to "Must match the current period type")
            )
        }
        val title = body.title?.trim().orEmpty()
        if (title.isBlank()) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Missing title",
                mapOf("title" to "Required")
            )
        }
        val (start, end) = budgetDuration(grouping, body.start, body.end, existing)
        val updated = existing.copy(
            title = title,
            // Omitting the description keeps the stored one; sending it empty clears it.
            description = body.description?.trim() ?: existing.description,
            start = start,
            end = end,
            default = body.isDefault ?: existing.default
        )
        if (repository.saveBudget(updated, null) <= 0) {
            throw ApiException(
                HttpStatusCode.InternalServerError,
                "save_failed",
                "Could not update the budget"
            )
        }
        body.amountMinor?.let { amount ->
            if (amount < 0) {
                throw ApiException(
                    HttpStatusCode.UnprocessableEntity,
                    "validation_failed",
                    "Invalid amountMinor",
                    mapOf("amountMinor" to "Must not be negative")
                )
            }
            updateDefaultAllocation(id, amount)
        }
        body.criteria?.let { criteria ->
            validateBudgetCriteria(criteria)
            repository.saveBudgetCriteria(id, criteria.toCriterion())
        }
        return repository.loadBudget(id)!!.toDtoWithCriteria(repository)
    }

    override suspend fun budgetAllocations(
        id: Long,
        year: Int?,
        second: Int?
    ): List<BudgetAllocationDto> {
        val progress = repository.loadBudgetProgress(
            id,
            if (year != null && second != null) year to second else null
        ) ?: throw ApiException(
            HttpStatusCode.NotFound,
            "budget_not_found",
            "Budget not found"
        )
        return repository.queryBudgetAllocations(
            budgetId = id,
            year = progress.groupInfo.year,
            second = progress.groupInfo.second,
            from = progress.groupInfo.duration.start,
            to = progress.groupInfo.duration.end
        )
    }

    override suspend fun budgetBreakdown(
        id: Long,
        year: Int?,
        second: Int?
    ): BudgetBreakdownDto? {
        val budget = repository.loadBudget(id) ?: return null
        val progress = repository.loadBudgetProgress(
            id,
            if (year != null && second != null) year to second else null
        ) ?: return null
        val period = progress.groupInfo
        val duration = period.duration
        val criteria = repository.budgetCriteria(id)
        val rows = repository.queryBudgetAllocations(
            budgetId = id,
            year = period.year,
            second = period.second,
            from = duration.start,
            to = duration.end,
            criteria = criteria
        )
        val parentById = rows.associate { it.categoryId to it.parentId }
        val roots = criteria?.categoryRoots()
        // Only the categories the budget covers and their descendants: a parent
        // that is not in the filter is not part of this budget, even when one of
        // its children is.
        val included = if (roots == null) {
            rows
        } else {
            rows.filter { row ->
                row.categoryId in roots ||
                    ancestorsOf(parentById, row.categoryId).any { it in roots }
            }
        }
        // A parent's figure is its own spend plus the spend of the included
        // children; the total counts leaves only, so nothing is summed twice.
        val totals = included.associate { it.categoryId to it.spentMinor }.toMutableMap()
        included.forEach { row ->
            ancestorsOf(parentById, row.categoryId).forEach { ancestor ->
                totals[ancestor]?.let { totals[ancestor] = it + row.spentMinor }
            }
        }
        val leavesSpent = included
            .filter { row -> included.none { it.parentId == row.categoryId } }
            .sumOf { it.spentMinor }
        val categories = included.map { row ->
            BudgetBreakdownCategoryDto(
                categoryId = row.categoryId,
                label = row.label,
                level = row.level,
                parentId = row.parentId,
                allocatedMinor = row.allocatedMinor,
                spentMinor = totals.getValue(row.categoryId),
                rolloverPreviousMinor = row.rolloverPreviousMinor,
                rolloverNextMinor = row.rolloverNextMinor
            )
        }.toMutableList()
        // Spend that no category can carry (transactions without a category)
        // gets its own bucket so the rows always add up to the total.
        val unaccounted = progress.spent - leavesSpent
        if (unaccounted > 0) {
            categories += BudgetBreakdownCategoryDto(
                categoryId = 0,
                label = null,
                level = 1,
                parentId = null,
                allocatedMinor = 0,
                spentMinor = unaccounted,
                rolloverPreviousMinor = 0,
                rolloverNextMinor = 0
            )
        }
        return BudgetBreakdownDto(
            budgetId = budget.id,
            accountId = budget.accountId,
            title = progress.title,
            currency = progress.currency,
            fractionDigits = currencyContext[progress.currency].fractionDigits,
            grouping = budget.grouping.name,
            periodYear = period.year,
            periodSecond = period.second,
            periodDescription = period.description,
            periodStart = duration.start.toString(),
            periodEnd = duration.end.toString(),
            totalAllocatedMinor = progress.allocated,
            totalSpentMinor = maxOf(progress.spent, leavesSpent),
            categories = categories
        )
    }

    override suspend fun budgetHistory(id: Long, months: Int): List<BudgetHistoryPointDto> {
        val budget = repository.loadBudget(id) ?: throw ApiException(
            HttpStatusCode.NotFound,
            "budget_not_found",
            "Budget not found"
        )
        if (budget.grouping != Grouping.MONTH) {
            val progress = repository.loadBudgetProgress(id, null) ?: return emptyList()
            return listOf(
                BudgetHistoryPointDto(
                    periodYear = progress.groupInfo.year,
                    periodSecond = progress.groupInfo.second,
                    periodDescription = progress.groupInfo.description,
                    allocatedMinor = progress.allocated,
                    spentMinor = progress.spent,
                    remainingMinor = progress.remainingBudget
                )
            )
        }
        val now = LocalDate.now()
        val count = months.coerceIn(1, 24)
        return (count - 1 downTo 0).mapNotNull { offset ->
            val date = now.minusMonths(offset.toLong())
            // The provider numbers months 0-11 (November = 10). Passing
            // monthValue as-is shifted the series one month and blew up on
            // December, which became the invalid index 12.
            repository.loadBudgetProgress(id, date.year to (date.monthValue - 1))?.let { progress ->
                BudgetHistoryPointDto(
                    periodYear = progress.groupInfo.year,
                    periodSecond = progress.groupInfo.second,
                    periodDescription = progress.groupInfo.description,
                    allocatedMinor = progress.allocated,
                    spentMinor = progress.spent,
                    remainingMinor = progress.remainingBudget
                )
            }
        }
    }

    override suspend fun updateBudgetAllocations(
        id: Long,
        body: BudgetAllocationsWriteDto
    ): List<BudgetAllocationDto> {
        val budget = repository.loadBudget(id) ?: throw ApiException(
            HttpStatusCode.NotFound,
            "budget_not_found",
            "Budget not found"
        )
        if (budget.grouping == Grouping.NONE) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "unsupported_grouping",
                "One-time budgets do not have per-period allocations",
                mapOf("grouping" to "Not supported for NONE")
            )
        }
        val year = body.year ?: throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "Missing year",
            mapOf("year" to "Required")
        )
        val second = body.second ?: throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "Missing second",
            mapOf("second" to "Required")
        )
        body.allocations.orEmpty().forEach { allocation ->
            val categoryId = allocation.categoryId ?: throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Missing categoryId",
                mapOf("categoryId" to "Required")
            )
            if (categoryId < 0) {
                throw ApiException(
                    HttpStatusCode.UnprocessableEntity,
                    "validation_failed",
                    "Invalid categoryId",
                    mapOf("categoryId" to "Must not be negative")
                )
            }
            if (categoryId > 0) {
                validateOptional("categoryId", "category", categoryId, CATEGORIES_URI)
            }
            val amount = allocation.amountMinor
            if (amount == null) {
                clearBudgetAllocation(id, categoryId, year, second)
            } else {
                if (amount < 0) {
                    throw ApiException(
                        HttpStatusCode.UnprocessableEntity,
                        "validation_failed",
                        "Invalid amountMinor",
                        mapOf("amountMinor" to "Must not be negative")
                    )
                }
                repository.contentResolver.update(
                    budgetAllocationUri(id, categoryId),
                    ContentValues().apply {
                        put(KEY_YEAR, year)
                        put(KEY_SECOND_GROUP, second)
                        put(KEY_BUDGET, amount)
                        put(KEY_ONE_TIME, allocation.oneTime ?: false)
                    },
                    null,
                    null
                )
            }
        }
        body.rollover?.let { rollover ->
            if (budget.grouping != Grouping.MONTH && budget.grouping != Grouping.YEAR) {
                throw ApiException(
                    HttpStatusCode.UnprocessableEntity,
                    "unsupported_grouping",
                    "Rollover is only supported for monthly and yearly budgets",
                    mapOf("grouping" to "Not supported")
                )
            }
            val (nextYear, nextSecond) = nextBudgetPeriod(budget.grouping, year, second)
            rollover.forEach { entry ->
                val categoryId = entry.categoryId ?: throw ApiException(
                    HttpStatusCode.UnprocessableEntity,
                    "validation_failed",
                    "Missing categoryId",
                    mapOf("categoryId" to "Required")
                )
                if (categoryId < 0) {
                    throw ApiException(
                        HttpStatusCode.UnprocessableEntity,
                        "validation_failed",
                        "Invalid categoryId",
                        mapOf("categoryId" to "Must not be negative")
                    )
                }
                if (categoryId > 0) {
                    validateOptional("categoryId", "category", categoryId, CATEGORIES_URI)
                }
                val amount = entry.amountMinor ?: throw ApiException(
                    HttpStatusCode.UnprocessableEntity,
                    "validation_failed",
                    "Missing amountMinor",
                    mapOf("amountMinor" to "Required")
                )
                if (amount < 0) {
                    throw ApiException(
                        HttpStatusCode.UnprocessableEntity,
                        "validation_failed",
                        "Invalid amountMinor",
                        mapOf("amountMinor" to "Must not be negative")
                    )
                }
                writeBudgetRollover(id, categoryId, year, second, KEY_BUDGET_ROLLOVER_NEXT, amount)
                writeBudgetRollover(
                    id,
                    categoryId,
                    nextYear,
                    nextSecond,
                    KEY_BUDGET_ROLLOVER_PREVIOUS,
                    amount
                )
            }
        }
        return budgetAllocations(id, year, second)
    }

    private fun clearBudgetAllocation(
        budgetId: Long,
        categoryId: Long,
        year: Int,
        second: Int
    ) {
        repository.contentResolver.delete(
            BUDGET_ALLOCATIONS_URI,
            "$KEY_BUDGETID = ? AND $KEY_CATID = ? AND $KEY_YEAR = ? AND $KEY_SECOND_GROUP = ?",
            arrayOf(budgetId.toString(), categoryId.toString(), year.toString(), second.toString())
        )
    }

    private fun writeBudgetRollover(
        budgetId: Long,
        categoryId: Long,
        year: Int,
        second: Int,
        column: String,
        amount: Long
    ) {
        repository.contentResolver.update(
            budgetAllocationUri(budgetId, categoryId),
            ContentValues().apply {
                put(KEY_YEAR, year)
                put(KEY_SECOND_GROUP, second)
                put(column, amount)
            },
            null,
            null
        )
    }

    private fun nextBudgetPeriod(grouping: Grouping, year: Int, second: Int): Pair<Int, Int> =
        when (grouping) {
            Grouping.MONTH -> if (second >= 12) year + 1 to 1 else year to second + 1
            Grouping.YEAR -> year + 1 to 1
            else -> throw IllegalArgumentException("Unsupported grouping $grouping")
        }

    override suspend fun duplicateBudget(id: Long): BudgetDto {
        val existing = repository.loadBudget(id) ?: throw ApiException(
            HttpStatusCode.NotFound,
            "budget_not_found",
            "Budget not found"
        )
        val copy = existing.copy(
            id = 0,
            title = "${existing.title} (copy)",
            default = false,
            uuid = null,
            accountName = null
        )
        val newId = repository.saveBudget(
            copy,
            repository.budgetAllocation(id, null, null)
        )
        if (newId <= 0) {
            throw ApiException(
                HttpStatusCode.InternalServerError,
                "save_failed",
                "Could not duplicate the budget"
            )
        }
        repository.budgetCriteria(id)?.let { criteria ->
            repository.saveBudgetCriteria(newId, criteria)
        }
        return repository.loadBudget(newId)!!.toDtoWithCriteria(repository)
    }

    override suspend fun deleteBudget(id: Long): Boolean {
        val deleted = repository.deleteBudget(id) == 1
        if (deleted) repository.saveBudgetCriteria(id, null)
        return deleted
    }

    private fun updateDefaultAllocation(budgetId: Long, amount: Long) {
        val values = ContentValues().apply { put(KEY_BUDGET, amount) }
        val selection = "$KEY_BUDGETID = ? AND $KEY_CATID = 0 AND " +
            "$KEY_YEAR IS NULL AND $KEY_SECOND_GROUP IS NULL"
        val updated = repository.contentResolver.update(
            BUDGET_ALLOCATIONS_URI,
            values,
            selection,
            arrayOf(budgetId.toString())
        )
        if (updated == 0) {
            repository.contentResolver.insert(
                BUDGET_ALLOCATIONS_URI,
                ContentValues().apply {
                    put(KEY_BUDGETID, budgetId)
                    put(KEY_CATID, 0)
                    put(KEY_BUDGET, amount)
                }
            )
        }
    }

    /**
     * Reads the filter the app keeps in its preferences and returns it next to
     * the budget. A filter the web cannot express is flagged, never rewritten.
     */
    private suspend fun Budget.toDtoWithCriteria(repository: Repository): BudgetDto {
        val criterion = repository.budgetCriteria(id)
        val supported = criterion?.toBudgetCriteria()
        return toDto(
            criteria = supported,
            criteriaUnsupported = criterion != null && supported == null
        )
    }

    private fun validateBudgetCriteria(criteria: BudgetCriteriaDto) {
        val fields = mutableMapOf<String, String>()
        if (criteria.categoryIds.isNotEmpty() &&
            !repository.queryCategories().map { it.id }.containsAll(criteria.categoryIds)
        ) {
            fields["categoryIds"] = "Unknown category"
        }
        if (criteria.payeeIds.isNotEmpty() &&
            !repository.queryPayees().map { it.id }.containsAll(criteria.payeeIds)
        ) {
            fields["payeeIds"] = "Unknown payee"
        }
        if (criteria.methodIds.isNotEmpty() &&
            !repository.queryMethods().map { it.id }.containsAll(criteria.methodIds)
        ) {
            fields["methodIds"] = "Unknown method"
        }
        if (criteria.tagIds.isNotEmpty() &&
            !repository.queryTags().map { it.id }.containsAll(criteria.tagIds)
        ) {
            fields["tagIds"] = "Unknown tag"
        }
        val unknownStatuses = criteria.statuses.filterNot { status ->
            CrStatus.entries.any { it.name == status }
        }
        if (unknownStatuses.isNotEmpty()) {
            fields["statuses"] = "Unknown status: ${unknownStatuses.joinToString()}"
        }
        if (fields.isNotEmpty()) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Invalid budget filter",
                fields
            )
        }
    }

    private fun Budget.toDto(
        criteria: BudgetCriteriaDto? = null,
        criteriaUnsupported: Boolean = false
    ) = BudgetDto(
        id = id,
        accountId = accountId,
        title = title,
        description = description,
        currency = currency,
        fractionDigits = currencyContext[currency].fractionDigits,
        grouping = grouping.name,
        color = color,
        start = start?.toString(),
        end = end?.toString(),
        accountName = accountName,
        isDefault = default,
        uuid = uuid,
        allocationMinor = repository.budgetAllocation(id, null, null),
        criteria = criteria,
        criteriaUnsupported = criteriaUnsupported
    )

    private fun loadTransactionDto(id: Long): TransactionDto {
        val transaction = try {
            repository.loadTransaction(id, withTransfer = true, withTags = true)
        } catch (_: IllegalArgumentException) {
            throw ApiException(
                HttpStatusCode.NotFound,
                "transaction_not_found",
                "Transaction not found"
            )
        }
        val currency = repository.getCurrencyUnitForAccount(transaction.data.accountId)
            ?: throw ApiException(
                HttpStatusCode.NotFound,
                "account_not_found",
                "Account not found"
            )
        return transaction.data.toApiDto(
            currencyUnit = currency,
            payeeMap = payeeMap.value,
            tagMap = tagMap.value,
            withTime = prefHandler.getBoolean(PrefKey.TRANSACTION_WITH_TIME, false),
            splitParts = transaction.splitParts,
            methodMap = repository.queryMethods().associate { it.id to it.label }
        )
    }

    // ---- Portfolios -------------------------------------------------------

    override suspend fun createPortfolio(body: PortfolioWriteDto): AccountDto {
        val label = requirePortfolioLabel(body.label)
        val currency = requireCurrency(body.currency)
        val type = repository.loadAccountType(parseAccountTypeId(body.type))
        val dynamic = body.dynamicExchangeRates ?: false
        val homeCurrency = currencyContext.homeCurrencyUnit
        val isFx = currency != homeCurrency.code
        val exchangeRate = portfolioExchangeRate(body.exchangeRate, currency, dynamic, isFx)
        requirePortfolioLicence()
        val account = AccountModel(
            label = label,
            currency = currency,
            type = type,
            color = body.color ?: AccountModel.DEFAULT_COLOR,
            portfolioRole = PORTFOLIO_CONTAINER,
            dynamicExchangeRates = dynamic,
            exchangeRate = exchangeRate
        )
        val created = repository.createAccount(account)
        if (isFx) {
            // Same flow as the app's `createPortfolio`: the fixed rate is stored
            // on the account so the provider can convert it.
            repository.storeExchangeRate(created.id, exchangeRate, currency, homeCurrency.code)
        }
        return account(created.id) ?: throw ApiException(
            HttpStatusCode.InternalServerError,
            "save_failed",
            "Could not create the portfolio"
        )
    }

    override suspend fun updatePortfolio(id: Long, body: PortfolioWriteDto): AccountDto {
        val existing = account(id) ?: throw ApiException(
            HttpStatusCode.NotFound,
            "portfolio_not_found",
            "Portfolio not found"
        )
        if (existing.portfolioRole != "CONTAINER") {
            throw ApiException(
                HttpStatusCode.NotFound,
                "portfolio_not_found",
                "Portfolio not found"
            )
        }
        val label = requirePortfolioLabel(body.label)
        val currency = requireCurrency(body.currency)
        val dynamic = body.dynamicExchangeRates ?: false
        val values = ContentValues().apply {
            put(KEY_LABEL, label)
            put(KEY_CURRENCY, currency)
            put(KEY_COLOR, body.color ?: existing.color)
            put(KEY_DYNAMIC, dynamic)
            put(KEY_TYPE, parseAccountTypeId(body.type))
        }
        val homeCurrency = currencyContext.homeCurrencyUnit
        val isFx = currency != homeCurrency.code
        if (currency != existing.currency && accountHasTransactions(id)) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "unsupported_account_change",
                "The currency of a portfolio with transactions cannot change"
            )
        }
        val exchangeRate = portfolioExchangeRate(body.exchangeRate, currency, dynamic, isFx)
        repository.updateAccount(id) { putAll(values) }
        if (isFx && !dynamic) {
            repository.storeExchangeRate(id, exchangeRate, currency, homeCurrency.code)
        }
        return account(id)!!
    }

    override suspend fun portfolioAssets(id: Long): PortfolioAssetsDto {
        val rows = repository.queryAccounts(currencyContext)
        val container = rows.firstOrNull { it.id == id } ?: throw ApiException(
            HttpStatusCode.NotFound,
            "portfolio_not_found",
            "Portfolio not found"
        )
        if (container.portfolioRole != "CONTAINER") {
            throw ApiException(
                HttpStatusCode.NotFound,
                "portfolio_not_found",
                "Portfolio not found"
            )
        }
        val prices = repository.queryLatestPrices()
        val children = rows.filter { it.parentId == id }
        val cash = children.firstOrNull { it.portfolioRole == "CASH" }
        val assets = children.filter { it.portfolioRole == "ASSET" }.map { child ->
            val rate = conversionRate(
                child.currency,
                child.dynamicExchangeRates,
                container.currency,
                prices
            )
            AssetDto(
                id = child.id,
                label = child.label,
                symbol = child.currency,
                fractionDigits = child.fractionDigits,
                quantityMinor = child.currentBalanceMinor,
                priceMinor = prices[child.currency to container.currency],
                valuationMinor = (child.currentBalanceMinor * rate).roundToLong()
            )
        }
        return PortfolioAssetsDto(
            portfolioId = id,
            label = container.label,
            currency = container.currency,
            fractionDigits = container.fractionDigits,
            cashAccountId = cash?.id,
            cashMinor = cash?.currentBalanceMinor ?: 0,
            valuationMinor = container.valuationMinor ?: container.currentBalanceMinor,
            assets = assets
        )
    }

    override fun tradePage(portfolioId: Long, limit: Int, offset: Int): PageDto<TradeDto> {
        requirePortfolioContainer(portfolioId)
        val uri = TRANSACTIONS_URI.buildUpon()
            .appendQueryParameter(KEY_ACCOUNTID, portfolioId.toString())
            .appendQueryParameter(TransactionProvider.QUERY_PARAMETER_SEARCH, "1")
            .build()
        // Same query shape as the app's `TradePagingSource`: the trade parents
        // of the portfolio account, newest first, then the domain loader.
        val total = repository.contentResolver.query(
            uri,
            arrayOf("count(*)"),
            WHERE_NOT_SPLIT_PART,
            null,
            null
        )?.use { if (it.moveToFirst()) it.getLong(0) else 0L } ?: 0L
        val ids = repository.contentResolver.query(
            uri.withLimit(limit, offset),
            arrayOf(KEY_ROWID),
            WHERE_NOT_SPLIT_PART,
            null,
            DataBaseAccount.sortOrder(KEY_DATE, SortDirection.DESC)
        )?.use { cursor ->
            buildList {
                while (cursor.moveToNext()) add(cursor.getLong(0))
            }
        } ?: emptyList()
        val withTime = prefHandler.getBoolean(PrefKey.TRANSACTION_WITH_TIME, false)
        return PageDto(
            items = repository.loadTrades(ids).map { it.toTradeDto(withTime) },
            total = total,
            limit = limit,
            offset = offset
        )
    }

    override fun trade(portfolioId: Long, transactionId: Long): TradeDto? {
        requirePortfolioContainer(portfolioId)
        val withTime = prefHandler.getBoolean(PrefKey.TRANSACTION_WITH_TIME, false)
        return repository.loadTrade(transactionId)
            ?.takeIf { it.portfolioId == portfolioId }
            ?.let { it.toTradeDto(withTime) }
    }

    override suspend fun createTrade(portfolioId: Long, body: TradeWriteDto): TradeDto {
        val account = requirePortfolioAccount(portfolioId)
        val intent = body.toTradeIntent(account, tradeId = null)
        val id = repository.saveTrade(account, intent)
        return repository.loadTrade(id)?.toTradeDto(
            prefHandler.getBoolean(PrefKey.TRANSACTION_WITH_TIME, false)
        ) ?: throw ApiException(
            HttpStatusCode.InternalServerError,
            "save_failed",
            "Could not load the saved operation"
        )
    }

    override suspend fun updateTrade(
        portfolioId: Long,
        transactionId: Long,
        body: TradeWriteDto
    ): TradeDto {
        val account = requirePortfolioAccount(portfolioId)
        val existing = repository.loadTrade(transactionId)
            ?.takeIf { it.portfolioId == portfolioId }
            ?: throw ApiException(
                HttpStatusCode.NotFound,
                "trade_not_found",
                "Trade not found"
            )
        val intent = body.toTradeIntent(account, tradeId = transactionId)
        // The app's editor only offers the same kind when editing (buy/sell,
        // deposit/withdraw, transfer); crossing it would leave the other leg
        // of a transfer behind or reuse an unrelated split.
        if (tradeKind(existing.type) != tradeKind(intent.type)) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "unsupported_trade_change",
                "Changing the kind of an operation is not supported",
                mapOf("type" to "Must keep the current kind")
            )
        }
        repository.saveTrade(account, intent)
        return repository.loadTrade(transactionId)?.toTradeDto(
            prefHandler.getBoolean(PrefKey.TRANSACTION_WITH_TIME, false)
        ) ?: throw ApiException(
            HttpStatusCode.InternalServerError,
            "save_failed",
            "Could not load the saved operation"
        )
    }

    private fun requirePortfolioAccount(portfolioId: Long): FullAccount {
        val account = try {
            repository.loadAccount(portfolioId)
        } catch (_: IllegalArgumentException) {
            null
        }
        if (account == null || account.portfolioRole != PORTFOLIO_CONTAINER) {
            throw ApiException(
                HttpStatusCode.NotFound,
                "portfolio_not_found",
                "Portfolio not found"
            )
        }
        val type = account.type ?: throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "portfolio_not_found",
            "Portfolio not found"
        )
        return FullAccount(
            id = account.id,
            label = account.label,
            currencyUnit = currencyContext[account.currency],
            color = account.color,
            type = type,
            portfolioRole = account.portfolioRole,
            parentId = account.parentId
        )
    }

    private fun TradeWriteDto.toTradeIntent(
        account: FullAccount,
        tradeId: Long?
    ): TradeIntent {
        val tradeType = parseTradeType(type)
        val date = this.date.requireDate("date")
        val time = this.time?.takeIf { it.isNotBlank() }?.let { parseTime(it, "time") }
        val dateTime = time?.let { LocalDateTime.of(date, it) } ?: date.atStartOfDay()
        val portfolioCurrency = account.currencyUnit
        val isCashMovement = tradeType is TradeType.CashMovement
        val isTransfer = tradeType is TradeType.Transfer
        val assetCode = when {
            isCashMovement -> account.currency

            else -> assetSymbol?.trim()?.uppercase(Locale.ROOT)?.takeIf { it.isNotBlank() }
                ?: throw ApiException(
                    HttpStatusCode.UnprocessableEntity,
                    "validation_failed",
                    "Missing assetSymbol",
                    mapOf("assetSymbol" to "Required")
                )
        }
        val assetUnit = currencyContext[assetCode]
        val quantityMajor = quantity.requireDecimal("quantity")
        if (quantityMajor <= BigDecimal.ZERO) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Quantity must be positive",
                mapOf("quantity" to "Must be positive")
            )
        }
        val priceMajor = if (isCashMovement) {
            BigDecimal.ONE
        } else {
            val value = price.requireDecimal("price")
            if (value <= BigDecimal.ZERO) {
                throw ApiException(
                    HttpStatusCode.UnprocessableEntity,
                    "validation_failed",
                    "Price must be positive",
                    mapOf("price" to "Must be positive")
                )
            }
            value
        }
        val quantityMoney = Money.buildWithMajor(assetUnit, quantityMajor).getOrNull()
            ?: throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Invalid quantity",
                mapOf("quantity" to "Out of range")
            )
        if (abs(quantityMoney.amountMinor) > MAX_AMOUNT_MINOR) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Invalid quantity",
                mapOf("quantity" to "Out of range")
            )
        }
        val principal = principalMinor?.let { minor ->
            if (minor <= 0L) {
                throw ApiException(
                    HttpStatusCode.UnprocessableEntity,
                    "validation_failed",
                    "Principal must be positive",
                    mapOf("principalMinor" to "Must be positive")
                )
            }
            Money(portfolioCurrency, minor)
        } ?: run {
            val major = quantityMajor.multiply(priceMajor)
            Money.buildWithMajor(portfolioCurrency, major).getOrNull()
                ?: throw ApiException(
                    HttpStatusCode.UnprocessableEntity,
                    "validation_failed",
                    "Invalid principal",
                    mapOf("principalMinor" to "Out of range")
                )
        }
        if (principal.amountMinor > MAX_AMOUNT_MINOR) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Invalid principal",
                mapOf("principalMinor" to "Out of range")
            )
        }
        val feeMinor = this.feeMinor ?: 0L
        if (feeMinor < 0L || feeMinor > MAX_AMOUNT_MINOR) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Invalid fee",
                mapOf("feeMinor" to "Out of range")
            )
        }
        val funding = when {
            isTransfer -> FundingSource.EXTERNAL

            isCashMovement -> {
                val source = (fundingSource ?: "ACCOUNT").uppercase(Locale.ROOT)
                if (source == "PORTFOLIO") {
                    throw ApiException(
                        HttpStatusCode.UnprocessableEntity,
                        "validation_failed",
                        "Deposits and withdrawals cannot be funded by the portfolio cash",
                        mapOf("fundingSource" to "Must be ACCOUNT or EXTERNAL")
                    )
                }
                parseFundingSource(source)
            }

            else -> parseFundingSource(fundingSource ?: "PORTFOLIO")
        }
        val peerAccountId = when {
            isTransfer -> {
                val peer = this.peerAccountId.requirePositive("peerAccountId")
                if (peer == account.id) {
                    throw ApiException(
                        HttpStatusCode.UnprocessableEntity,
                        "validation_failed",
                        "The target portfolio must differ from the source",
                        mapOf("peerAccountId" to "Must differ from the portfolio")
                    )
                }
                val target = try {
                    repository.loadAccount(peer)
                } catch (_: IllegalArgumentException) {
                    null
                }
                if (target == null || target.portfolioRole != PORTFOLIO_CONTAINER) {
                    throw ApiException(
                        HttpStatusCode.UnprocessableEntity,
                        "invalid_peerAccountId",
                        "The target portfolio does not exist",
                        mapOf("peerAccountId" to "Does not exist")
                    )
                }
                peer
            }

            funding == FundingSource.ACCOUNT -> {
                val fundingAccountId = this.peerAccountId.requirePositive("peerAccountId")
                validateAccount(fundingAccountId)
                val fundingCurrency = repository.getCurrencyUnitForAccount(fundingAccountId)
                if (fundingCurrency?.code != portfolioCurrency.code) {
                    throw ApiException(
                        HttpStatusCode.UnprocessableEntity,
                        "validation_failed",
                        "The funding account must use the portfolio currency",
                        mapOf("peerAccountId" to "Must use ${portfolioCurrency.code}")
                    )
                }
                fundingAccountId
            }

            else -> null
        }
        val additionalCosts = if (feeMinor > 0L) {
            val category = feeCategoryId?.takeIf { it > 0 }?.let { categoryId ->
                validateOptional("feeCategoryId", "category", categoryId, CATEGORIES_URI)
                org.totschnig.myexpenses.viewmodel.data.CategoryRef(
                    categoryId,
                    repository.getCategoryPath(categoryId).orEmpty()
                )
            }
            listOf(CostLeg(Money(portfolioCurrency, feeMinor), category))
        } else {
            emptyList()
        }
        return TradeIntent(
            targetAsset = assetUnit,
            type = tradeType,
            date = dateTime,
            quantity = quantityMoney,
            price = priceMajor,
            principal = principal,
            fundingSource = if (isTransfer) FundingSource.EXTERNAL else funding,
            peerAccountId = peerAccountId,
            additionalCosts = additionalCosts,
            comment = comment.orEmpty(),
            tradeId = tradeId
        )
    }

    private fun parseTradeType(raw: String?): TradeType = when (
        raw?.trim()?.uppercase(Locale.ROOT)
    ) {
        "BUY" -> TradeType.AssetTrade.BUY

        "SELL" -> TradeType.AssetTrade.SELL

        "DEPOSIT" -> TradeType.CashMovement.DEPOSIT

        "WITHDRAW" -> TradeType.CashMovement.WITHDRAW

        "TRANSFER_IN" -> TradeType.Transfer(true)

        "TRANSFER_OUT" -> TradeType.Transfer(false)

        else -> throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "type must be BUY, SELL, DEPOSIT, WITHDRAW, TRANSFER_IN or TRANSFER_OUT",
            mapOf("type" to "Invalid value")
        )
    }

    private fun tradeKind(type: TradeType): String = when (type) {
        is TradeType.AssetTrade -> "ASSET"
        is TradeType.CashMovement -> "CASH"
        is TradeType.Transfer -> "TRANSFER"
    }

    private fun parseFundingSource(raw: String): FundingSource = when (raw) {
        "PORTFOLIO" -> FundingSource.PORTFOLIO

        "ACCOUNT" -> FundingSource.ACCOUNT

        "EXTERNAL" -> FundingSource.EXTERNAL

        else -> throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "fundingSource must be PORTFOLIO, ACCOUNT or EXTERNAL",
            mapOf("fundingSource" to "Invalid value")
        )
    }

    // ---- App data (settings > data) ---------------------------------------

    override suspend fun createCategory(body: CategoryWriteDto): CategoryDto {
        val label = requireLabel(body.label, "label")
        val parentId = body.parentId?.takeIf { it > 0 }
        val parentType = parentId?.let { parent ->
            repository.queryCategories().firstOrNull { it.id == parent }?.type
                ?: throw ApiException(
                    HttpStatusCode.UnprocessableEntity,
                    "invalid_parentId",
                    "The parent category does not exist",
                    mapOf("parentId" to "Does not exist")
                )
        }
        val type = parentType ?: body.type?.takeIf { it in setOf(1, 2) } ?: 1
        val created = repository.saveCategory(
            org.totschnig.myexpenses.model2.Category(
                parentId = parentId,
                label = label,
                color = body.color,
                type = type.toByte()
            )
        ) ?: throw ApiException(
            HttpStatusCode.InternalServerError,
            "save_failed",
            "Could not create the category"
        )
        return repository.queryCategories().firstOrNull { it.id == created }
            ?: throw ApiException(
                HttpStatusCode.InternalServerError,
                "save_failed",
                "Could not load the saved category"
            )
    }

    override suspend fun updateCategory(id: Long, body: CategoryWriteDto): CategoryDto {
        val existing = repository.queryCategories().firstOrNull { it.id == id }
            ?: throw ApiException(
                HttpStatusCode.NotFound,
                "category_not_found",
                "Category not found"
            )
        val label = requireLabel(body.label, "label")
        if (body.parentId != null && body.parentId != existing.parentId) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "unsupported_move",
                "Moving a category is not supported from the web"
            )
        }
        repository.saveCategory(
            org.totschnig.myexpenses.model2.Category(
                id = id,
                parentId = existing.parentId,
                label = label,
                color = body.color ?: existing.color,
                type = (body.type ?: existing.type ?: 1).toByte()
            )
        )
        return repository.queryCategories().firstOrNull { it.id == id }
            ?: throw ApiException(
                HttpStatusCode.InternalServerError,
                "save_failed",
                "Could not load the saved category"
            )
    }

    override suspend fun deleteCategory(id: Long, remapTo: Long?): Boolean {
        val categories = repository.queryCategories()
        val category = categories.firstOrNull { it.id == id } ?: return false
        val branch = categoryBranchIds(listOf(id), categories.associate { it.id to it.parentId })
        // The provider expands the tree from the selected root, like the app.
        val usage = repository.categoryUsage(listOf(id))
        if (!usage.isUsed && remapTo == null) {
            return repository.deleteCategory(id)
        }
        val target = remapTo ?: throw ApiException(
            HttpStatusCode.Conflict,
            "category_in_use",
            "The category is in use; choose a category to move its data to"
        )
        if (target in branch) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "invalid_remapTo",
                "Data cannot be moved into the category being deleted",
                mapOf("remapTo" to "Must be outside the deleted branch")
            )
        }
        val targetCategory = categories.firstOrNull { it.id == target }
            ?: throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "invalid_remapTo",
                "The target category does not exist",
                mapOf("remapTo" to "Does not exist")
            )
        // The provider's merge requires one type across the branch; the app
        // never moves expense movements into an income category.
        if (targetCategory.type != category.type ||
            categories.any { it.id in branch && it.type != category.type }
        ) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "invalid_remapTo",
                "Source and target categories must have the same type",
                mapOf("remapTo" to "Must have the same type")
            )
        }
        repository.mergeCategoriesAndUpdateFilters(branch, target)
        return true
    }

    override suspend fun createMethod(body: MethodWriteDto): MethodDto {
        val label = requireLabel(body.label, "label")
        val created = repository.createPaymentMethod(
            null,
            org.totschnig.myexpenses.model2.PaymentMethod(
                label = label,
                type = body.type ?: 0,
                isNumbered = body.isNumbered ?: false,
                accountTypes = parseAccountTypes(body.accountTypes)
            )
        )
        return repository.queryMethods().firstOrNull { it.id == created.id }
            ?: throw ApiException(
                HttpStatusCode.InternalServerError,
                "save_failed",
                "Could not load the saved method"
            )
    }

    override suspend fun updateMethod(id: Long, body: MethodWriteDto): MethodDto {
        val existing = repository.queryMethods().firstOrNull { it.id == id }
            ?: throw ApiException(
                HttpStatusCode.NotFound,
                "method_not_found",
                "Method not found"
            )
        val label = requireLabel(body.label, "label")
        repository.updatePaymentMethod(
            repository.context,
            org.totschnig.myexpenses.model2.PaymentMethod(
                id = id,
                label = label,
                type = body.type ?: existing.type,
                isNumbered = body.isNumbered ?: existing.isNumbered,
                // An explicit empty list clears the restriction; an absent
                // field keeps the stored one.
                accountTypes = body.accountTypes?.let { parseAccountTypes(it) }
                    ?: existing.accountTypes.mapNotNull { it.toLongOrNull() }
            )
        )
        return repository.queryMethods().firstOrNull { it.id == id }
            ?: throw ApiException(
                HttpStatusCode.InternalServerError,
                "save_failed",
                "Could not load the saved method"
            )
    }

    override suspend fun deleteMethod(id: Long): Boolean {
        if (repository.queryMethods().none { it.id == id }) return false
        repository.deleteMethod(id)
        return true
    }

    override suspend fun createTag(body: TagWriteDto): TagDto {
        val label = requireLabel(body.label, "label")
        val uri = repository.contentResolver.insert(
            TAGS_URI,
            ContentValues().apply { put(KEY_LABEL, label) }
        ) ?: throw ApiException(
            HttpStatusCode.InternalServerError,
            "save_failed",
            "Could not create the tag"
        )
        val id = android.content.ContentUris.parseId(uri)
        return repository.queryTags().firstOrNull { it.id == id }
            ?: throw ApiException(
                HttpStatusCode.InternalServerError,
                "save_failed",
                "Could not load the saved tag"
            )
    }

    override suspend fun updateTag(id: Long, body: TagWriteDto): TagDto {
        if (repository.queryTags().none { it.id == id }) {
            throw ApiException(
                HttpStatusCode.NotFound,
                "tag_not_found",
                "Tag not found"
            )
        }
        val label = requireLabel(body.label, "label")
        repository.contentResolver.update(
            android.content.ContentUris.withAppendedId(TAGS_URI, id),
            ContentValues().apply { put(KEY_LABEL, label) },
            null,
            null
        )
        return repository.queryTags().firstOrNull { it.id == id }
            ?: throw ApiException(
                HttpStatusCode.InternalServerError,
                "save_failed",
                "Could not load the saved tag"
            )
    }

    override suspend fun deleteTag(id: Long): Boolean {
        if (repository.queryTags().none { it.id == id }) return false
        repository.contentResolver.delete(
            android.content.ContentUris.withAppendedId(TAGS_URI, id),
            null,
            null
        )
        return true
    }

    override suspend fun currencies(): List<CurrencyDto> {
        val prices = repository.queryLatestPrices()
        return repository.contentResolver.query(
            TransactionProvider.CURRENCIES_URI,
            arrayOf(
                KEY_CODE,
                KEY_LABEL,
                KEY_SYMBOL,
                KEY_FRACTION_DIGITS,
                KEY_COMMODITY_TYPE
            ),
            null,
            null,
            KEY_CODE
        )?.useAndMapToList { cursor ->
            val code = cursor.getString(KEY_CODE)
            CurrencyDto(
                code = code,
                label = cursor.getStringOrNull(KEY_LABEL),
                symbol = cursor.getStringOrNull(KEY_SYMBOL) ?: code,
                fractionDigits = cursor.getIntIfExists(KEY_FRACTION_DIGITS) ?: 2,
                commodityType = cursor.getStringOrNull(KEY_COMMODITY_TYPE) ?: "FIAT",
                priceMinor = prices[code to currencyContext.homeCurrencyString]
            )
        } ?: emptyList()
    }

    override suspend fun createCurrency(body: CurrencyWriteDto): CurrencyDto {
        val code = body.code?.trim()?.uppercase(Locale.ROOT)?.takeIf { it.isNotBlank() }
            ?: throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Missing code",
                mapOf("code" to "Required")
            )
        if (currencies().any { it.code == code }) {
            throw ApiException(
                HttpStatusCode.Conflict,
                "currency_already_defined",
                "The currency is already defined"
            )
        }
        repository.insertCurrency(
            code = code,
            symbol = body.symbol?.trim()?.takeIf { it.isNotBlank() } ?: code,
            label = body.label?.trim()?.takeIf { it.isNotBlank() },
            fractionDigits = requireFractionDigits(body.fractionDigits),
            type = parseCommodityType(body.commodityType)
        ) ?: throw ApiException(
            HttpStatusCode.InternalServerError,
            "save_failed",
            "Could not create the currency"
        )
        currencyContext.invalidate(code)
        val created = currencies().firstOrNull { it.code == code }
        if (created == null) {
            throw ApiException(
                HttpStatusCode.InternalServerError,
                "save_failed",
                "Could not load the saved currency"
            )
        }
        return created
    }

    override suspend fun updateCurrency(code: String, body: CurrencyWriteDto): CurrencyDto {
        val existing = currencies().firstOrNull { it.code == code }
            ?: throw ApiException(
                HttpStatusCode.NotFound,
                "currency_not_found",
                "Currency not found"
            )
        val id = repository.contentResolver.query(
            TransactionProvider.CURRENCIES_URI,
            arrayOf(KEY_ROWID),
            "$KEY_CODE = ?",
            arrayOf(code),
            null
        )?.use { if (it.moveToFirst()) it.getLong(0) else 0L } ?: 0L
        if (id == 0L) {
            throw ApiException(
                HttpStatusCode.NotFound,
                "currency_not_found",
                "Currency not found"
            )
        }
        repository.updateCurrency(
            id = id,
            code = code,
            symbol = body.symbol?.trim()?.takeIf { it.isNotBlank() } ?: existing.symbol,
            label = body.label?.trim() ?: existing.label,
            fractionDigits = body.fractionDigits ?: existing.fractionDigits,
            oldCode = code,
            commodityType = body.commodityType?.let { parseCommodityType(it) },
            oldFractionDigits = existing.fractionDigits
        )
        currencyContext.invalidate(code)
        return currencies().firstOrNull { it.code == code }
            ?: throw ApiException(
                HttpStatusCode.InternalServerError,
                "save_failed",
                "Could not load the saved currency"
            )
    }

    override suspend fun deleteCurrency(code: String): Boolean {
        if (currencies().none { it.code == code }) return false
        if (repository.isCurrencyUsed(code)) {
            throw ApiException(
                HttpStatusCode.Conflict,
                "currency_still_used",
                "The currency is still used by an account or a transaction"
            )
        }
        repository.deleteCurrency(code)
        return true
    }

    override suspend fun prices(commodity: String): List<PriceDto> {
        val base = currencyContext.homeCurrencyUnit
        val commodityUnit = try {
            currencyContext[commodity]
        } catch (_: Exception) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Unknown commodity",
                mapOf("commodity" to "Does not exist")
            )
        }
        return repository.contentResolver.query(
            TransactionProvider.PRICES_URI.buildUpon()
                .appendQueryParameter(KEY_COMMODITY, commodity)
                .appendQueryParameter(KEY_CURRENCY, base.code)
                .build(),
            arrayOf(KEY_DATE, KEY_SOURCE, KEY_VALUE),
            null,
            null,
            "$KEY_DATE DESC"
        )?.useAndMapToList { cursor ->
            PriceDto(
                commodity = commodity,
                currency = base.code,
                date = cursor.getString(KEY_DATE),
                value = calculateRealExchangeRate(
                    cursor.getDouble(KEY_VALUE),
                    commodityUnit,
                    base
                ).toDouble(),
                // The table stores the app's lowercase source names; the API
                // exposes the uppercase token the client reasons about.
                source = cursor.getStringOrNull(KEY_SOURCE)?.uppercase(Locale.ROOT)
                    ?: "USER"
            )
        } ?: emptyList()
    }

    override suspend fun savePrice(body: PriceWriteDto): PriceDto {
        val commodity = body.commodity?.trim()?.uppercase(Locale.ROOT)
            ?.takeIf { it.isNotBlank() } ?: throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "Missing commodity",
            mapOf("commodity" to "Required")
        )
        val date = body.date.requireDate("date")
        val value = body.value ?: throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "Missing value",
            mapOf("value" to "Required")
        )
        if (value <= 0.0) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "The price must be above zero",
                mapOf("value" to "Must be positive")
            )
        }
        val commodityUnit = try {
            currencyContext[commodity]
        } catch (_: Exception) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Unknown commodity",
                mapOf("commodity" to "Does not exist")
            )
        }
        val base = currencyContext.homeCurrencyUnit
        // A manual price is unique per commodity and date: replace the entry.
        repository.deletePrice(date, ExchangeRateSource.User, base.code, commodity)
        repository.savePrice(
            base,
            commodityUnit,
            date,
            ExchangeRateSource.User,
            BigDecimal.valueOf(value)
        )
        return PriceDto(
            commodity = commodity,
            currency = base.code,
            date = date.toString(),
            value = value,
            source = "USER"
        )
    }

    override suspend fun deletePrice(commodity: String, date: String): Boolean {
        val parsed = date.requireDate("date")
        val base = currencyContext.homeCurrencyUnit
        val deleted = repository.deletePrice(
            parsed,
            ExchangeRateSource.User,
            base.code,
            commodity.uppercase(Locale.ROOT)
        )
        return deleted > 0
    }

    private fun requireLabel(value: String?, field: String): String {
        val label = value?.trim().orEmpty()
        if (label.isBlank()) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Missing $field",
                mapOf(field to "Required")
            )
        }
        return label
    }

    private fun requireFractionDigits(value: Int?): Int {
        if (value == null || value < 0 || value > 8) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "fractionDigits must be between 0 and 8",
                mapOf("fractionDigits" to "Out of range")
            )
        }
        return value
    }

    private fun parseCommodityType(
        raw: String?
    ): org.totschnig.myexpenses.model.CommodityType = try {
        org.totschnig.myexpenses.model.CommodityType.valueOf(
            (raw ?: "FIAT").trim().uppercase(Locale.ROOT)
        )
    } catch (_: IllegalArgumentException) {
        throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "commodityType must be FIAT, SECURITY, CRYPTO or COMMODITY",
            mapOf("commodityType" to "Invalid value")
        )
    }

    private fun parseAccountTypes(values: List<String>?): List<Long> =
        values.orEmpty().mapNotNull { it.trim().toLongOrNull()?.takeIf { id -> id > 0 } }

    private fun requirePortfolioContainer(portfolioId: Long) {
        val container = try {
            repository.loadAccount(portfolioId)
        } catch (_: IllegalArgumentException) {
            null
        }
        if (container == null || container.portfolioRole != PORTFOLIO_CONTAINER) {
            throw ApiException(
                HttpStatusCode.NotFound,
                "portfolio_not_found",
                "Portfolio not found"
            )
        }
    }

    private fun requirePortfolioLicence() {
        val existing = repository.queryAccounts(currencyContext).count {
            it.portfolioRole == "CONTAINER"
        }
        if (existing > 0 && !licenceHandler.hasAccessTo(ContribFeature.PORTFOLIO)) {
            throw ApiException(
                HttpStatusCode.Conflict,
                "portfolio_limit_reached",
                "A licence is needed for more than one portfolio"
            )
        }
    }

    private fun requirePortfolioLabel(label: String?): String {
        val value = label?.trim().orEmpty()
        if (value.isBlank()) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Missing label",
                mapOf("label" to "Required")
            )
        }
        return value
    }

    /**
     * The rate travels as a real (major to major) rate and is stored raw, like
     * the app's `PortfolioSetupDialog` does before calling `createPortfolio`.
     */
    private fun portfolioExchangeRate(
        exchangeRate: Double?,
        currency: String,
        dynamic: Boolean,
        isFx: Boolean
    ): Double {
        if (!isFx || dynamic) return 1.0
        if (exchangeRate == null || exchangeRate <= 0.0) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "missing_exchangeRate",
                "A fixed exchange rate above zero is required for a foreign currency",
                mapOf("exchangeRate" to "Required")
            )
        }
        return calculateRawExchangeRate(
            BigDecimal.valueOf(exchangeRate),
            currencyContext[currency],
            currencyContext.homeCurrencyUnit
        )
    }

    private fun Trade.toTradeDto(withTime: Boolean) = TradeDto(
        id = id,
        type = when (val tradeType = type) {
            TradeType.AssetTrade.BUY -> "BUY"
            TradeType.AssetTrade.SELL -> "SELL"
            TradeType.CashMovement.DEPOSIT -> "DEPOSIT"
            TradeType.CashMovement.WITHDRAW -> "WITHDRAW"
            is TradeType.Transfer -> if (tradeType.isIncoming) "TRANSFER_IN" else "TRANSFER_OUT"
        },
        accountId = portfolioId,
        currency = currency,
        date = date.toLocalDate().toString(),
        time = if (withTime) date.toLocalTime().toString() else null,
        comment = comment.orEmpty(),
        assetSymbol = assetSymbol,
        fractionDigits = runCatching {
            currencyContext[assetSymbol].fractionDigits
        }.getOrDefault(2),
        quantityMinor = quantity.amountMinor,
        price = if (quantity.amountMinor == 0L) null else price.toPlainString(),
        principalMinor = principal.amountMinor,
        feeMinor = fee?.takeIf { it.amountMinor != 0L }?.amountMinor,
        peerAccountId = peerAccount?.first,
        peerAccountLabel = peerAccount?.second
    )

    private fun validateAccount(accountId: Long) {
        if (repository.getCurrencyUnitForAccount(accountId) == null) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "invalid_accountId",
                "The selected account does not exist",
                mapOf("accountId" to "Does not exist")
            )
        }
    }

    private fun validateOptional(field: String, label: String, id: Long?, uri: Uri) {
        if (id == null) return
        val exists = repository.contentResolver.query(
            ContentUris.withAppendedId(uri, id),
            arrayOf(KEY_ROWID),
            null,
            null,
            null
        )?.use { it.moveToFirst() } ?: false
        if (!exists) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "invalid_$field",
                "The selected $label does not exist",
                mapOf(field to "Does not exist")
            )
        }
    }

    private fun validateTags(ids: List<Long>) {
        ids.forEach { validateOptional("tagIds", "tag", it, TAGS_URI) }
    }
}

private fun Long?.normalizeId() = this?.takeIf { it > 0 }

private fun parseBudgetGrouping(raw: String?): Grouping {
    val value = (raw ?: "MONTH").uppercase(Locale.ROOT)
    return try {
        Grouping.valueOf(value)
    } catch (_: IllegalArgumentException) {
        throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "invalid_grouping",
            "grouping must be DAY, WEEK, MONTH, YEAR or NONE",
            mapOf("grouping" to "Invalid value")
        )
    }
}

private fun budgetDuration(
    grouping: Grouping,
    startRaw: String?,
    endRaw: String?,
    existing: Budget? = null
): Pair<LocalDate?, LocalDate?> {
    if (grouping != Grouping.NONE) {
        if (!startRaw.isNullOrBlank() || !endRaw.isNullOrBlank()) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "start and end are only allowed for one-time budgets",
                mapOf("start" to "Not allowed", "end" to "Not allowed")
            )
        }
        return null to null
    }
    val start = startRaw?.takeIf { it.isNotBlank() }?.let { parseDate(it, "start") }
        ?: existing?.start
        ?: throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "Missing start",
            mapOf("start" to "Required for one-time budgets")
        )
    val end = endRaw?.takeIf { it.isNotBlank() }?.let { parseDate(it, "end") }
        ?: existing?.end
        ?: throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "Missing end",
            mapOf("end" to "Required for one-time budgets")
        )
    if (end.isBefore(start)) {
        throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "end must be on or after start",
            mapOf("end" to "Must be on or after start")
        )
    }
    return start to end
}

private fun String?.requireDecimal(field: String): BigDecimal {
    val value = this?.trim()?.replace(',', '.')?.takeIf { it.isNotBlank() } ?: throw ApiException(
        HttpStatusCode.UnprocessableEntity,
        "validation_failed",
        "Missing $field",
        mapOf(field to "Required")
    )
    return try {
        BigDecimal(value)
    } catch (_: NumberFormatException) {
        throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "Invalid $field",
            mapOf(field to "Expected a decimal number")
        )
    }
}

private fun Long?.requirePositive(field: String): Long {
    val value = this ?: throw ApiException(
        HttpStatusCode.UnprocessableEntity,
        "validation_failed",
        "Missing $field",
        mapOf(field to "Required")
    )
    if (value <= 0) {
        throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "Invalid $field",
            mapOf(field to "Must be positive")
        )
    }
    return value
}

private fun Long?.requireNonZero(field: String): Long {
    val value = this ?: throw ApiException(
        HttpStatusCode.UnprocessableEntity,
        "validation_failed",
        "Missing $field",
        mapOf(field to "Required")
    )
    if (value == 0L) {
        throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "Invalid $field",
            mapOf(field to "Must not be zero")
        )
    }
    if (value > MAX_AMOUNT_MINOR || value < -MAX_AMOUNT_MINOR) {
        throw ApiException(
            HttpStatusCode.UnprocessableEntity,
            "validation_failed",
            "Invalid $field",
            mapOf(field to "Out of range")
        )
    }
    return value
}

/** Largest amount accepted in minor units (10^12, i.e. 10 000 000 000.00). */
private const val MAX_AMOUNT_MINOR = 1_000_000_000_000L

private fun String?.requireDate(field: String): LocalDate {
    val value = this?.takeIf { it.isNotBlank() } ?: throw ApiException(
        HttpStatusCode.UnprocessableEntity,
        "validation_failed",
        "Missing $field",
        mapOf(field to "Required")
    )
    return parseDate(value, field)
}

private fun parseDate(value: String, field: String): LocalDate = try {
    LocalDate.parse(value)
} catch (_: DateTimeParseException) {
    throw ApiException(
        HttpStatusCode.BadRequest,
        "invalid_$field",
        "$field must be YYYY-MM-DD",
        mapOf(field to "Expected YYYY-MM-DD")
    )
}

private fun parseTime(value: String, field: String): LocalTime = try {
    LocalTime.parse(value)
} catch (_: DateTimeParseException) {
    throw ApiException(
        HttpStatusCode.BadRequest,
        "invalid_$field",
        "$field must be HH:mm",
        mapOf(field to "Expected HH:mm")
    )
}

/**
 * Walks a category's ancestors from its parent upwards. Cycles cannot happen in
 * the category tree, and the web API never writes categories.
 */
private fun ancestorsOf(parentById: Map<Long, Long?>, categoryId: Long): List<Long> {
    val ancestors = mutableListOf<Long>()
    var parent = parentById[categoryId]
    while (parent != null) {
        ancestors += parent
        parent = parentById[parent]
    }
    return ancestors
}

/**
 * The categories a budget is defined over. The Android editor stores one
 * [CategoryCriterion] inside a conjunction; anything else (no filter, or a
 * composite the web does not build) is treated as "every category".
 */
private fun Criterion.categoryRoots(): List<Long>? = when (this) {
    is CategoryCriterion -> values
    is AndCriterion -> criteria.filterIsInstance<CategoryCriterion>().firstOrNull()?.values
    else -> null
}

/**
 * Builds the criterion the app understands from the DTO. An empty filter is
 * `null`, which removes the preference: a budget without a filter covers the
 * whole account, exactly like before.
 */
private fun BudgetCriteriaDto.toCriterion(): Criterion? {
    val parts = buildList {
        if (categoryIds.isNotEmpty()) add(CategoryCriterion("", categoryIds))
        if (payeeIds.isNotEmpty()) add(PayeeCriterion("", payeeIds))
        if (methodIds.isNotEmpty()) add(MethodCriterion("", methodIds))
        if (tagIds.isNotEmpty()) add(TagCriterion("", tagIds))
        if (statuses.isNotEmpty()) {
            add(CrStatusCriterion(statuses.map { CrStatus.valueOf(it) }))
        }
    }
    return when (parts.size) {
        0 -> null
        1 -> parts.first()
        else -> AndCriterion(parts.toSet())
    }
}

/**
 * Reads a stored criterion back into the DTO. Returns null when the criterion
 * cannot be represented (composite, a dimension the web does not offer, or a
 * "no value" criterion): the caller flags it and refuses to save over it.
 */
private fun Criterion.toBudgetCriteria(): BudgetCriteriaDto? {
    val parts = if (this is AndCriterion) criteria else setOf(this)
    var categories: List<Long>? = null
    var payees: List<Long>? = null
    var methods: List<Long>? = null
    var tags: List<Long>? = null
    var statuses: List<String>? = null
    for (part in parts) {
        when (part) {
            is CategoryCriterion -> {
                if (categories != null || part.values.isEmpty()) return null
                categories = part.values
            }

            is PayeeCriterion -> {
                if (payees != null || part.values.isEmpty()) return null
                payees = part.values
            }

            is MethodCriterion -> {
                if (methods != null || part.values.isEmpty()) return null
                methods = part.values
            }

            is TagCriterion -> {
                if (tags != null || part.values.isEmpty()) return null
                tags = part.values
            }

            is CrStatusCriterion -> {
                if (statuses != null || part.values.isEmpty()) return null
                statuses = part.values.map { it.name }
            }

            else -> return null
        }
    }
    return BudgetCriteriaDto(
        categoryIds = categories.orEmpty(),
        payeeIds = payees.orEmpty(),
        methodIds = methods.orEmpty(),
        tagIds = tags.orEmpty(),
        statuses = statuses.orEmpty()
    )
}

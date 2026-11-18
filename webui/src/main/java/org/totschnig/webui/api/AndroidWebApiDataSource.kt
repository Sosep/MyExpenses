package org.totschnig.webui.api

import android.content.ContentUris
import android.content.ContentValues
import android.net.Uri
import io.ktor.http.HttpStatusCode
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeParseException
import java.util.Locale
import kotlin.math.abs
import kotlinx.coroutines.flow.StateFlow
import org.totschnig.myexpenses.db2.Repository
import org.totschnig.myexpenses.db2.RepositoryTransaction
import org.totschnig.myexpenses.db2.budgetAllocation
import org.totschnig.myexpenses.db2.budgetCriteria
import org.totschnig.myexpenses.db2.createAccount
import org.totschnig.myexpenses.db2.createTransaction
import org.totschnig.myexpenses.db2.deleteAccount
import org.totschnig.myexpenses.db2.deleteBudget
import org.totschnig.myexpenses.db2.entities.Transaction
import org.totschnig.myexpenses.db2.getCurrencyUnitForAccount
import org.totschnig.myexpenses.db2.loadAccountType
import org.totschnig.myexpenses.db2.loadBudget
import org.totschnig.myexpenses.db2.loadBudgetProgress
import org.totschnig.myexpenses.db2.loadTransaction
import org.totschnig.myexpenses.db2.saveBudget
import org.totschnig.myexpenses.db2.saveBudgetCriteria
import org.totschnig.myexpenses.db2.updateAccount
import org.totschnig.myexpenses.db2.updateTransaction
import org.totschnig.myexpenses.model.CrStatus
import org.totschnig.myexpenses.model.CurrencyContext
import org.totschnig.myexpenses.model.Grouping
import org.totschnig.myexpenses.model.generateUuid
import org.totschnig.myexpenses.model2.Account as AccountModel
import org.totschnig.myexpenses.preference.PrefHandler
import org.totschnig.myexpenses.preference.PrefKey
import org.totschnig.myexpenses.provider.BaseTransactionProvider.Companion.budgetAllocationUri
import org.totschnig.myexpenses.provider.KEY_ACCOUNTID
import org.totschnig.myexpenses.provider.KEY_BUDGET
import org.totschnig.myexpenses.provider.KEY_BUDGETID
import org.totschnig.myexpenses.provider.KEY_BUDGET_ROLLOVER_NEXT
import org.totschnig.myexpenses.provider.KEY_BUDGET_ROLLOVER_PREVIOUS
import org.totschnig.myexpenses.provider.KEY_CATID
import org.totschnig.myexpenses.provider.KEY_COLOR
import org.totschnig.myexpenses.provider.KEY_CURRENCY
import org.totschnig.myexpenses.provider.KEY_EXCLUDE_FROM_TOTALS
import org.totschnig.myexpenses.provider.KEY_LABEL
import org.totschnig.myexpenses.provider.KEY_ONE_TIME
import org.totschnig.myexpenses.provider.KEY_OPENING_BALANCE
import org.totschnig.myexpenses.provider.KEY_PARENTID
import org.totschnig.myexpenses.provider.KEY_ROWID
import org.totschnig.myexpenses.provider.KEY_SECOND_GROUP
import org.totschnig.myexpenses.provider.KEY_TITLE
import org.totschnig.myexpenses.provider.KEY_TYPE
import org.totschnig.myexpenses.provider.KEY_YEAR
import org.totschnig.myexpenses.provider.SPLIT_CATID
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
import org.totschnig.myexpenses.util.epoch2ZonedDateTime
import org.totschnig.myexpenses.util.toEpoch
import org.totschnig.myexpenses.viewmodel.data.Budget

class AndroidWebApiDataSource(
    private val repository: Repository,
    private val prefHandler: PrefHandler,
    private val currencyContext: CurrencyContext,
    private val payeeMap: StateFlow<Map<Long, String>>,
    private val tagMap: StateFlow<Map<Long, String>>,
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

    override suspend fun account(id: Long) = accounts().firstOrNull { it.id == id }

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
            filters = filters,
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
        to: LocalDate
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
            to = to
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

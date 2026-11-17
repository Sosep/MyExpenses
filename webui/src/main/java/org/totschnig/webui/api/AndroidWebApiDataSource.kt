package org.totschnig.webui.api

import android.content.ContentUris
import android.net.Uri
import io.ktor.http.HttpStatusCode
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeParseException
import java.util.Locale
import kotlinx.coroutines.flow.StateFlow
import org.totschnig.myexpenses.db2.Repository
import org.totschnig.myexpenses.db2.createTransaction
import org.totschnig.myexpenses.db2.entities.Transaction
import org.totschnig.myexpenses.db2.getCurrencyUnitForAccount
import org.totschnig.myexpenses.db2.loadTransaction
import org.totschnig.myexpenses.db2.updateTransaction
import org.totschnig.myexpenses.model.CrStatus
import org.totschnig.myexpenses.model.CurrencyContext
import org.totschnig.myexpenses.model.Grouping
import org.totschnig.myexpenses.model.generateUuid
import org.totschnig.myexpenses.preference.PrefHandler
import org.totschnig.myexpenses.preference.PrefKey
import org.totschnig.myexpenses.provider.KEY_ROWID
import org.totschnig.myexpenses.provider.TransactionProvider.CATEGORIES_URI
import org.totschnig.myexpenses.provider.TransactionProvider.METHODS_URI
import org.totschnig.myexpenses.provider.TransactionProvider.PAYEES_URI
import org.totschnig.myexpenses.provider.TransactionProvider.TAGS_URI
import org.totschnig.myexpenses.util.epoch2ZonedDateTime
import org.totschnig.myexpenses.util.toEpoch

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

    override fun categories() = repository.queryCategories()

    override fun payees() = repository.queryPayees()

    override fun tags() = repository.queryTags()

    override fun methods() = repository.queryMethods()

    override fun transactionPage(
        accountId: Long,
        from: LocalDate?,
        to: LocalDate?,
        type: String?,
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
            limit = limit,
            offset = offset
        )
        val withTime = prefHandler.getBoolean(PrefKey.TRANSACTION_WITH_TIME, false)
        return PageDto(
            items = items.map {
                it.toApiDto(currency, payeeMap.value, tagMap.value, withTime)
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

    override fun createTransaction(body: TransactionWriteDto): TransactionDto =
        createSimple(body)

    override fun updateTransaction(id: Long, body: TransactionWriteDto): TransactionDto =
        updateSimple(id, body)

    override fun deleteTransaction(id: Long): Boolean =
        repository.deleteTransaction(id)

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
            splitParts = transaction.splitParts
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
    return value
}

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

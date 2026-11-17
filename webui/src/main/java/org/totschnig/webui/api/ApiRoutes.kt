package org.totschnig.webui.api

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeParseException
import java.util.Locale
import kotlinx.coroutines.flow.StateFlow
import org.totschnig.myexpenses.db2.Repository
import org.totschnig.myexpenses.db2.getCurrencyUnitForAccount
import org.totschnig.myexpenses.db2.loadTransaction
import org.totschnig.myexpenses.model.CurrencyContext
import org.totschnig.myexpenses.model.Grouping
import org.totschnig.myexpenses.preference.PrefHandler
import org.totschnig.myexpenses.preference.PrefKey

class ApiRoutes(
    private val repository: Repository,
    private val prefHandler: PrefHandler,
    private val currencyContext: CurrencyContext,
    private val payeeMap: StateFlow<Map<Long, String>>,
    private val tagMap: StateFlow<Map<Long, String>>,
    private val appVersion: String
) {
    fun register(parent: Route) {
        parent.route("/api/v1") {
            get("/meta") {
                call.respond(metaDto())
            }
            get("/accounts") {
                call.respond(repository.queryAccounts(currencyContext))
            }
            get("/categories") {
                call.respond(repository.queryCategories())
            }
            get("/payees") {
                call.respond(repository.queryPayees())
            }
            get("/tags") {
                call.respond(repository.queryTags())
            }
            get("/methods") {
                call.respond(repository.queryMethods())
            }
            get("/transactions") {
                val accountId = call.requireLong("accountId")
                val limit = call.intParam("limit", 50).coerceIn(1, 500)
                val offset = call.intParam("offset", 0).coerceAtLeast(0)
                val type = call.parameters["type"]
                    ?.takeIf { it.isNotBlank() && it != "both" }
                if (type != null && type !in setOf("income", "expense")) {
                    throw ApiException(
                        HttpStatusCode.BadRequest,
                        "invalid_type",
                        "type must be income, expense or both"
                    )
                }
                val from = call.dateParam("from")
                val to = call.dateParam("to")
                validateRange(from, to)
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
                call.respond(
                    PageDto(
                        items = items.map {
                            it.toApiDto(currency, payeeMap.value, tagMap.value, withTime)
                        },
                        total = total,
                        limit = limit,
                        offset = offset
                    )
                )
            }
            get("/transactions/{id}") {
                val id = call.parameters["id"]?.toLongOrNull()
                    ?: throw ApiException(
                        HttpStatusCode.BadRequest,
                        "invalid_id",
                        "id must be a number"
                    )
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
                call.respond(
                    transaction.data.toApiDto(
                        currencyUnit = currency,
                        payeeMap = payeeMap.value,
                        tagMap = tagMap.value,
                        withTime = prefHandler.getBoolean(PrefKey.TRANSACTION_WITH_TIME, false),
                        splitParts = transaction.splitParts
                    )
                )
            }
            get("/reports/grouped") {
                val accountId = call.requireLong("accountId")
                val grouping = try {
                    Grouping.valueOf(
                        (call.parameters["grouping"] ?: "MONTH")
                            .uppercase(Locale.ROOT)
                    )
                } catch (_: IllegalArgumentException) {
                    throw ApiException(
                        HttpStatusCode.BadRequest,
                        "invalid_grouping",
                        "grouping must be DAY, WEEK, MONTH, YEAR or NONE"
                    )
                }
                val now = LocalDate.now()
                val from = call.dateParam("from") ?: now.withDayOfMonth(1).minusMonths(11)
                val to = call.dateParam("to") ?: now
                validateRange(from, to)
                repository.getCurrencyUnitForAccount(accountId)
                    ?: throw ApiException(
                        HttpStatusCode.NotFound,
                        "account_not_found",
                        "Account not found"
                    )
                call.respond(
                    repository.queryTransactionGroups(accountId, grouping, from, to)
                )
            }
        }
    }

    private fun metaDto() = MetaDto(
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
}

private fun validateRange(from: LocalDate?, to: LocalDate?) {
    if (from != null && to != null && from.isAfter(to)) {
        throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_range",
            "from must be before or equal to to"
        )
    }
}

private fun ApplicationCall.requireLong(name: String): Long {
    val raw = parameters[name]
        ?: throw ApiException(
            HttpStatusCode.BadRequest,
            "missing_$name",
            "Query parameter '$name' is required"
        )
    return raw.toLongOrNull()
        ?: throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_$name",
            "Query parameter '$name' must be a number"
        )
}

private fun ApplicationCall.intParam(name: String, default: Int): Int {
    val raw = parameters[name] ?: return default
    return raw.toIntOrNull()
        ?: throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_$name",
            "Query parameter '$name' must be an integer"
        )
}

private fun ApplicationCall.dateParam(name: String): LocalDate? {
    val raw = parameters[name] ?: return null
    return try {
        LocalDate.parse(raw)
    } catch (_: DateTimeParseException) {
        throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_$name",
            "Query parameter '$name' must be YYYY-MM-DD"
        )
    }
}

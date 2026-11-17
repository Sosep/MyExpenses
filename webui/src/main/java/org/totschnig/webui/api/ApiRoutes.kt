package org.totschnig.webui.api

import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.util.Locale

class ApiRoutes(
    private val dataSource: WebApiDataSource
) {
    fun register(parent: Route) {
        parent.route("/api/v1") {
            get("/meta") {
                call.respond(dataSource.meta())
            }
            get("/accounts") {
                call.respond(dataSource.accounts())
            }
            get("/categories") {
                call.respond(dataSource.categories())
            }
            get("/payees") {
                call.respond(dataSource.payees())
            }
            get("/tags") {
                call.respond(dataSource.tags())
            }
            get("/methods") {
                call.respond(dataSource.methods())
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
                call.respond(
                    dataSource.transactionPage(
                        accountId = accountId,
                        from = from,
                        to = to,
                        type = type,
                        limit = limit,
                        offset = offset
                    )
                )
            }
            get("/transactions/{id}") {
                val id = call.requirePathId()
                val transaction = dataSource.transaction(id)
                    ?: throw ApiException(
                        HttpStatusCode.NotFound,
                        "transaction_not_found",
                        "Transaction not found"
                    )
                call.respond(transaction)
            }
            post("/transactions") {
                val created = dataSource.createTransaction(call.receive<TransactionWriteDto>())
                call.response.headers.append(
                    HttpHeaders.Location,
                    "/api/v1/transactions/${created.id}"
                )
                call.respond(HttpStatusCode.Created, created)
            }
            put("/transactions/{id}") {
                val id = call.requirePathId()
                val body = call.receive<TransactionWriteDto>()
                call.respond(dataSource.updateTransaction(id, body))
            }
            delete("/transactions/{id}") {
                val id = call.requirePathId()
                if (!dataSource.deleteTransaction(id)) {
                    throw ApiException(
                        HttpStatusCode.NotFound,
                        "transaction_not_found",
                        "Transaction not found"
                    )
                }
                call.respond(HttpStatusCode.NoContent)
            }
            post("/transfers") {
                val created = dataSource.createTransfer(call.receive<TransferWriteDto>())
                call.response.headers.append(
                    HttpHeaders.Location,
                    "/api/v1/transactions/${created.id}"
                )
                call.respond(HttpStatusCode.Created, created)
            }
            put("/transfers/{id}") {
                val id = call.requirePathId()
                call.respond(
                    dataSource.updateTransfer(id, call.receive<TransferWriteDto>())
                )
            }
            post("/split-transactions") {
                val created = dataSource.createSplit(call.receive<SplitWriteDto>())
                call.response.headers.append(
                    HttpHeaders.Location,
                    "/api/v1/transactions/${created.id}"
                )
                call.respond(HttpStatusCode.Created, created)
            }
            put("/split-transactions/{id}") {
                val id = call.requirePathId()
                call.respond(
                    dataSource.updateSplit(id, call.receive<SplitWriteDto>())
                )
            }
            get("/budgets") {
                call.respond(dataSource.budgets())
            }
            get("/budgets/{id}") {
                val id = call.requirePathId()
                val yearRaw = call.parameters["year"]
                val secondRaw = call.parameters["second"]
                if ((yearRaw == null) != (secondRaw == null)) {
                    throw ApiException(
                        HttpStatusCode.BadRequest,
                        "invalid_period",
                        "year and second must be sent together"
                    )
                }
                val year = call.intParamOrNull("year")
                val second = call.intParamOrNull("second")
                if ((year != null && year < 1) || (second != null && second < 1)) {
                    throw ApiException(
                        HttpStatusCode.BadRequest,
                        "invalid_period",
                        "year and second must be positive"
                    )
                }
                val progress = dataSource.budgetProgress(id, year, second)
                    ?: throw ApiException(
                        HttpStatusCode.NotFound,
                        "budget_not_found",
                        "Budget not found"
                    )
                call.respond(progress)
            }
            get("/reports/grouped") {
                val accountId = call.requireLong("accountId")
                val grouping = (call.parameters["grouping"] ?: "MONTH")
                    .uppercase(Locale.ROOT)
                if (grouping !in setOf("DAY", "WEEK", "MONTH", "YEAR", "NONE")) {
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
                call.respond(dataSource.groups(accountId, grouping, from, to))
            }
        }
    }
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

private fun ApplicationCall.requirePathId(): Long =
    parameters["id"]?.toLongOrNull()
        ?: throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_id",
            "id must be a number"
        )

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

private fun ApplicationCall.intParamOrNull(name: String): Int? {
    val raw = parameters[name] ?: return null
    return raw.toIntOrNull()
        ?: throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_$name",
            "Query parameter '$name' must be an integer"
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

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
import kotlin.math.abs

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
            get("/account-types") {
                call.respond(dataSource.accountTypes())
            }
            post("/accounts") {
                val created = dataSource.createAccount(call.receive<AccountWriteDto>())
                call.response.headers.append(
                    HttpHeaders.Location,
                    "/api/v1/accounts/${created.id}"
                )
                call.respond(HttpStatusCode.Created, created)
            }
            put("/accounts/{id}") {
                val id = call.requirePathId()
                call.respond(dataSource.updateAccount(id, call.receive<AccountWriteDto>()))
            }
            delete("/accounts/{id}") {
                val id = call.requirePathId()
                if (!dataSource.deleteAccount(id)) {
                    throw ApiException(
                        HttpStatusCode.NotFound,
                        "account_not_found",
                        "Account not found"
                    )
                }
                call.respond(HttpStatusCode.NoContent)
            }
            get("/accounts/{id}") {
                val id = call.requirePathId()
                val account = dataSource.account(id)
                    ?: throw ApiException(
                        HttpStatusCode.NotFound,
                        "account_not_found",
                        "Account not found"
                    )
                call.respond(account)
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
            post("/categories") {
                val created = dataSource.createCategory(call.receive<CategoryWriteDto>())
                call.response.headers.append(
                    HttpHeaders.Location,
                    "/api/v1/categories/${created.id}"
                )
                call.respond(HttpStatusCode.Created, created)
            }
            put("/categories/{id}") {
                val id = call.requirePathId()
                call.respond(dataSource.updateCategory(id, call.receive<CategoryWriteDto>()))
            }
            delete("/categories/{id}") {
                val id = call.requirePathId()
                val remapTo = call.parameters["remapTo"]?.let {
                    it.toLongOrNull()?.takeIf { value -> value > 0 } ?: throw ApiException(
                        HttpStatusCode.BadRequest,
                        "invalid_remapTo",
                        "remapTo must be a positive category id"
                    )
                }
                if (!dataSource.deleteCategory(id, remapTo)) {
                    throw ApiException(
                        HttpStatusCode.NotFound,
                        "category_not_found",
                        "Category not found"
                    )
                }
                call.respond(HttpStatusCode.NoContent)
            }
            post("/methods") {
                val created = dataSource.createMethod(call.receive<MethodWriteDto>())
                call.response.headers.append(
                    HttpHeaders.Location,
                    "/api/v1/methods/${created.id}"
                )
                call.respond(HttpStatusCode.Created, created)
            }
            put("/methods/{id}") {
                val id = call.requirePathId()
                call.respond(dataSource.updateMethod(id, call.receive<MethodWriteDto>()))
            }
            delete("/methods/{id}") {
                val id = call.requirePathId()
                if (!dataSource.deleteMethod(id)) {
                    throw ApiException(
                        HttpStatusCode.NotFound,
                        "method_not_found",
                        "Method not found"
                    )
                }
                call.respond(HttpStatusCode.NoContent)
            }
            post("/tags") {
                val created = dataSource.createTag(call.receive<TagWriteDto>())
                call.response.headers.append(
                    HttpHeaders.Location,
                    "/api/v1/tags/${created.id}"
                )
                call.respond(HttpStatusCode.Created, created)
            }
            put("/tags/{id}") {
                val id = call.requirePathId()
                call.respond(dataSource.updateTag(id, call.receive<TagWriteDto>()))
            }
            delete("/tags/{id}") {
                val id = call.requirePathId()
                if (!dataSource.deleteTag(id)) {
                    throw ApiException(
                        HttpStatusCode.NotFound,
                        "tag_not_found",
                        "Tag not found"
                    )
                }
                call.respond(HttpStatusCode.NoContent)
            }
            get("/currencies") {
                call.respond(dataSource.currencies())
            }
            post("/currencies") {
                val created = dataSource.createCurrency(call.receive<CurrencyWriteDto>())
                call.response.headers.append(
                    HttpHeaders.Location,
                    "/api/v1/currencies/${created.code}"
                )
                call.respond(HttpStatusCode.Created, created)
            }
            put("/currencies/{code}") {
                val code = call.parameters["code"] ?: throw ApiException(
                    HttpStatusCode.BadRequest,
                    "invalid_code",
                    "code is required"
                )
                call.respond(
                    dataSource.updateCurrency(code, call.receive<CurrencyWriteDto>())
                )
            }
            delete("/currencies/{code}") {
                val code = call.parameters["code"] ?: throw ApiException(
                    HttpStatusCode.BadRequest,
                    "invalid_code",
                    "code is required"
                )
                if (!dataSource.deleteCurrency(code)) {
                    throw ApiException(
                        HttpStatusCode.NotFound,
                        "currency_not_found",
                        "Currency not found"
                    )
                }
                call.respond(HttpStatusCode.NoContent)
            }
            get("/prices") {
                val commodity = call.parameters["commodity"]?.takeIf { it.isNotBlank() }
                    ?: throw ApiException(
                        HttpStatusCode.BadRequest,
                        "missing_commodity",
                        "Query parameter 'commodity' is required"
                    )
                call.respond(dataSource.prices(commodity.uppercase(Locale.ROOT)))
            }
            post("/prices") {
                call.respond(
                    HttpStatusCode.Created,
                    dataSource.savePrice(call.receive<PriceWriteDto>())
                )
            }
            put("/prices/{commodity}/{date}") {
                val commodity = call.parameters["commodity"] ?: throw ApiException(
                    HttpStatusCode.BadRequest,
                    "invalid_commodity",
                    "commodity is required"
                )
                val date = call.parameters["date"] ?: throw ApiException(
                    HttpStatusCode.BadRequest,
                    "invalid_date",
                    "date is required"
                )
                val body = call.receive<PriceWriteDto>()
                call.respond(
                    dataSource.savePrice(body.copy(commodity = commodity, date = date))
                )
            }
            delete("/prices/{commodity}/{date}") {
                val commodity = call.parameters["commodity"] ?: throw ApiException(
                    HttpStatusCode.BadRequest,
                    "invalid_commodity",
                    "commodity is required"
                )
                val date = call.parameters["date"] ?: throw ApiException(
                    HttpStatusCode.BadRequest,
                    "invalid_date",
                    "date is required"
                )
                if (!dataSource.deletePrice(commodity, date)) {
                    throw ApiException(
                        HttpStatusCode.NotFound,
                        "price_not_found",
                        "Price not found"
                    )
                }
                call.respond(HttpStatusCode.NoContent)
            }
            post("/portfolios") {
                val created = dataSource.createPortfolio(call.receive<PortfolioWriteDto>())
                call.response.headers.append(
                    HttpHeaders.Location,
                    "/api/v1/accounts/${created.id}"
                )
                call.respond(HttpStatusCode.Created, created)
            }
            put("/portfolios/{id}") {
                val id = call.requirePathId()
                call.respond(dataSource.updatePortfolio(id, call.receive<PortfolioWriteDto>()))
            }
            get("/portfolios/{id}/assets") {
                val id = call.requirePathId()
                call.respond(dataSource.portfolioAssets(id))
            }
            get("/portfolios/{id}/trades") {
                val id = call.requirePathId()
                val limit = call.intParamOrNull("limit")?.also {
                    if (it !in 1..500) {
                        throw ApiException(
                            HttpStatusCode.BadRequest,
                            "invalid_limit",
                            "Query parameter 'limit' must be between 1 and 500"
                        )
                    }
                } ?: 50
                val offset = call.intParamOrNull("offset")?.also {
                    if (it < 0) {
                        throw ApiException(
                            HttpStatusCode.BadRequest,
                            "invalid_offset",
                            "Query parameter 'offset' must be zero or positive"
                        )
                    }
                } ?: 0
                call.respond(dataSource.tradePage(id, limit, offset))
            }
            get("/portfolios/{id}/trades/{transactionId}") {
                val id = call.requirePathId()
                val transactionId = call.requirePathId("transactionId")
                val trade = dataSource.trade(id, transactionId)
                    ?: throw ApiException(
                        HttpStatusCode.NotFound,
                        "trade_not_found",
                        "Trade not found"
                    )
                call.respond(trade)
            }
            post("/portfolios/{id}/trades") {
                val id = call.requirePathId()
                val created = dataSource.createTrade(id, call.receive<TradeWriteDto>())
                call.response.headers.append(
                    HttpHeaders.Location,
                    "/api/v1/portfolios/$id/trades/${created.id}"
                )
                call.respond(HttpStatusCode.Created, created)
            }
            put("/portfolios/{id}/trades/{transactionId}") {
                val id = call.requirePathId()
                val transactionId = call.requirePathId("transactionId")
                call.respond(
                    dataSource.updateTrade(id, transactionId, call.receive<TradeWriteDto>())
                )
            }
            get("/transactions") {
                val accountId = call.requireLong("accountId")
                val limit = call.intParamOrNull("limit")?.also {
                    if (it !in 1..500) {
                        throw ApiException(
                            HttpStatusCode.BadRequest,
                            "invalid_limit",
                            "Query parameter 'limit' must be between 1 and 500"
                        )
                    }
                } ?: 50
                val offset = call.intParamOrNull("offset")?.also {
                    if (it < 0) {
                        throw ApiException(
                            HttpStatusCode.BadRequest,
                            "invalid_offset",
                            "Query parameter 'offset' must be zero or positive"
                        )
                    }
                } ?: 0
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
                        filters = call.transactionFilters(),
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
            post("/budgets") {
                val created = dataSource.createBudget(call.receive<BudgetWriteDto>())
                call.response.headers.append(
                    HttpHeaders.Location,
                    "/api/v1/budgets/${created.id}"
                )
                call.respond(HttpStatusCode.Created, created)
            }
            put("/budgets/{id}") {
                val id = call.requirePathId()
                call.respond(dataSource.updateBudget(id, call.receive<BudgetWriteDto>()))
            }
            post("/budgets/{id}/duplicate") {
                val id = call.requirePathId()
                val created = dataSource.duplicateBudget(id)
                call.response.headers.append(
                    HttpHeaders.Location,
                    "/api/v1/budgets/${created.id}"
                )
                call.respond(HttpStatusCode.Created, created)
            }
            delete("/budgets/{id}") {
                val id = call.requirePathId()
                if (!dataSource.deleteBudget(id)) {
                    throw ApiException(
                        HttpStatusCode.NotFound,
                        "budget_not_found",
                        "Budget not found"
                    )
                }
                call.respond(HttpStatusCode.NoContent)
            }
            get("/budgets/{id}/history") {
                val id = call.requirePathId()
                val months = call.intParam("months", 12).coerceIn(1, 24)
                call.respond(dataSource.budgetHistory(id, months))
            }
            get("/budgets/{id}/allocations") {
                val id = call.requirePathId()
                val period = call.budgetPeriod(dataSource, id)
                call.respond(dataSource.budgetAllocations(id, period?.first, period?.second))
            }
            get("/budgets/{id}/breakdown") {
                val id = call.requirePathId()
                val period = call.budgetPeriod(dataSource, id)
                val breakdown = dataSource.budgetBreakdown(id, period?.first, period?.second)
                    ?: throw ApiException(
                        HttpStatusCode.NotFound,
                        "budget_not_found",
                        "Budget not found"
                    )
                call.respond(breakdown)
            }
            put("/budgets/{id}/allocations") {
                val id = call.requirePathId()
                call.respond(
                    dataSource.updateBudgetAllocations(
                        id,
                        call.receive<BudgetAllocationsWriteDto>()
                    )
                )
            }
            get("/budgets/{id}") {
                val id = call.requirePathId()
                val period = call.budgetPeriod(dataSource, id)
                val progress = dataSource.budgetProgress(id, period?.first, period?.second)
                    ?: throw ApiException(
                        HttpStatusCode.NotFound,
                        "budget_not_found",
                        "Budget not found"
                    )
                call.respond(progress)
            }
            get("/reports/summary") {
                val accountId = call.reportAccountId()
                val now = LocalDate.now()
                val from = call.dateParam("from") ?: now.withDayOfMonth(1).minusMonths(11)
                val to = call.dateParam("to") ?: now
                validateRange(from, to)
                call.respond(dataSource.summary(accountId, from, to))
            }
            get("/reports/transactions") {
                val accountId = call.reportAccountId()
                val by = (call.parameters["by"] ?: "category").lowercase(Locale.ROOT)
                if (by !in setOf("category", "payee", "tag", "method")) {
                    throw ApiException(
                        HttpStatusCode.BadRequest,
                        "invalid_by",
                        "by must be category, payee, tag or method"
                    )
                }
                val groupId = call.requireLong("id")
                val type = (call.parameters["type"] ?: "expense").lowercase(Locale.ROOT)
                if (type !in setOf("income", "expense", "both")) {
                    throw ApiException(
                        HttpStatusCode.BadRequest,
                        "invalid_type",
                        "type must be income, expense or both"
                    )
                }
                val now = LocalDate.now()
                val from = call.dateParam("from") ?: now.withDayOfMonth(1).minusMonths(11)
                val to = call.dateParam("to") ?: now
                validateRange(from, to)
                val limit = call.intParam("limit", 100).coerceIn(1, 500)
                val offset = call.intParam("offset", 0).coerceAtLeast(0)
                call.respond(
                    dataSource.reportTransactions(
                        accountId,
                        by,
                        groupId,
                        type,
                        from,
                        to,
                        limit,
                        offset
                    )
                )
            }
            get("/reports/breakdown") {
                val accountId = call.reportAccountId()
                val by = (call.parameters["by"] ?: "category").lowercase(Locale.ROOT)
                if (by !in setOf("category", "payee", "tag", "method")) {
                    throw ApiException(
                        HttpStatusCode.BadRequest,
                        "invalid_by",
                        "by must be category, payee, tag or method"
                    )
                }
                val type = (call.parameters["type"] ?: "expense").lowercase(Locale.ROOT)
                if (type !in setOf("income", "expense", "both")) {
                    throw ApiException(
                        HttpStatusCode.BadRequest,
                        "invalid_type",
                        "type must be income, expense or both"
                    )
                }
                val now = LocalDate.now()
                val from = call.dateParam("from") ?: now.withDayOfMonth(1).minusMonths(11)
                val to = call.dateParam("to") ?: now
                validateRange(from, to)
                call.respond(dataSource.breakdown(accountId, by, type, from, to))
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
                val type = (call.parameters["type"] ?: "both").lowercase(Locale.ROOT)
                if (type !in setOf("income", "expense", "both")) {
                    throw ApiException(
                        HttpStatusCode.BadRequest,
                        "invalid_type",
                        "type must be income, expense or both"
                    )
                }
                val now = LocalDate.now()
                val from = call.dateParam("from") ?: now.withDayOfMonth(1).minusMonths(11)
                val to = call.dateParam("to") ?: now
                validateRange(from, to)
                call.respond(
                    dataSource.groups(
                        accountId,
                        grouping,
                        from,
                        to,
                        type,
                        call.transactionFilters()
                    )
                )
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

private fun ApplicationCall.reportAccountId(): Long {
    val raw = parameters["accountId"]
        ?: throw ApiException(
            HttpStatusCode.BadRequest,
            "missing_accountId",
            "Query parameter 'accountId' is required"
        )
    if (raw == "all") return 0L
    return raw.toLongOrNull()
        ?: throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_accountId",
            "Query parameter 'accountId' must be a number or 'all'"
        )
}

private fun ApplicationCall.requirePathId(name: String = "id"): Long =
    parameters[name]?.toLongOrNull()
        ?: throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_$name",
            "$name must be a number"
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

/** Repeated parameters are accepted (`?tagId=1&tagId=2`), so ids may come as a set. */
private fun ApplicationCall.idsParam(name: String): List<Long> =
    parameters.getAll(name)
        ?.flatMap { it.split(',') }
        ?.map { it.trim() }
        ?.filter { it.isNotEmpty() }
        ?.map {
            val value = it.toLongOrNull()
            if (value == null || value <= 0) {
                throw ApiException(
                    HttpStatusCode.BadRequest,
                    "invalid_$name",
                    "Query parameter '$name' must be a list of positive numbers"
                )
            }
            value
        }
        ?.distinct()
        ?: emptyList()

private fun ApplicationCall.transactionFilters(): TransactionQueryFilters {
    val statuses = parameters.getAll("status")
        ?.flatMap { it.split(',') }
        ?.map { it.trim().uppercase(Locale.ROOT) }
        ?.filter { it.isNotEmpty() }
        ?.distinct()
        ?: emptyList()
    val allowedStatuses = setOf("UNRECONCILED", "CLEARED", "RECONCILED", "VOID")
    statuses.firstOrNull { it !in allowedStatuses }?.let {
        throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_status",
            "status must be UNRECONCILED, CLEARED, RECONCILED or VOID"
        )
    }
    val text = parameters["q"]?.trim()?.takeIf { it.isNotEmpty() }
    if (text != null && text.length > 200) {
        throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_q",
            "Query parameter 'q' is too long"
        )
    }
    val amountMin = longParamOrNull("amountMin", positive = false)
    val amountMax = longParamOrNull("amountMax", positive = false)
    if (amountMin != null && amountMax != null && amountMin > amountMax) {
        throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_range",
            "amountMin must be less than or equal to amountMax"
        )
    }
    val uncategorized = parameters["uncategorized"]?.let {
        when (it.lowercase(Locale.ROOT)) {
            "true", "1" -> true

            "false", "0" -> false

            else -> throw ApiException(
                HttpStatusCode.BadRequest,
                "invalid_uncategorized",
                "Query parameter 'uncategorized' must be true or false"
            )
        }
    } ?: false
    if (uncategorized && idsParam("categoryId").isNotEmpty()) {
        throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_filter",
            "uncategorized cannot be combined with categoryId"
        )
    }
    val transfer = parameters["transfer"]?.let {
        when (it.lowercase(Locale.ROOT)) {
            "true", "1" -> true

            "false", "0" -> false

            else -> throw ApiException(
                HttpStatusCode.BadRequest,
                "invalid_transfer",
                "Query parameter 'transfer' must be true or false"
            )
        }
    }
    return TransactionQueryFilters(
        categoryIds = idsParam("categoryId"),
        payeeIds = idsParam("payeeId"),
        tagIds = idsParam("tagId"),
        methodIds = idsParam("methodId"),
        text = text,
        amountMin = amountMin?.let { abs(it) },
        amountMax = amountMax?.let { abs(it) },
        statuses = statuses,
        uncategorized = uncategorized,
        transfer = transfer
    )
}

private fun ApplicationCall.longParamOrNull(name: String, positive: Boolean = true): Long? {
    val raw = parameters[name] ?: return null
    val value = raw.toLongOrNull()
        ?: throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_$name",
            "Query parameter '$name' must be a number"
        )
    if (positive && value <= 0) {
        throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_$name",
            "Query parameter '$name' must be positive"
        )
    }
    return value
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

/**
 * Reads `year`/`second` for a budget and validates that the second is a real
 * index for its grouping. `MONTH` is 0-based (January = 0); `WEEK` and `DAY`
 * follow the app's `Grouping.minValue` and are 1-based. Without this check an
 * out-of-range index reached the provider and ended as a 500.
 *
 * The grouping comes from the budget list, so the route answers 400 before the
 * datasource tries to build the period. An unknown budget skips the check and
 * falls through to the usual 404.
 */
private suspend fun ApplicationCall.budgetPeriod(
    dataSource: WebApiDataSource,
    budgetId: Long
): Pair<Int, Int>? {
    val yearRaw = parameters["year"]
    val secondRaw = parameters["second"]
    if ((yearRaw == null) != (secondRaw == null)) {
        throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_period",
            "year and second must be sent together"
        )
    }
    val year = intParamOrNull("year") ?: return null
    val second = intParamOrNull("second") ?: return null
    if (year < 1) {
        throw ApiException(
            HttpStatusCode.BadRequest,
            "invalid_period",
            "year must be positive"
        )
    }
    val grouping = dataSource.budgets().firstOrNull { it.id == budgetId }?.grouping
    if (grouping != null) {
        val range = when (grouping) {
            "MONTH" -> 0..11
            "WEEK" -> 1..53
            "DAY" -> 1..366
            "YEAR" -> 0..11
            else -> null
        }
        if (range == null || second !in range) {
            throw ApiException(
                HttpStatusCode.BadRequest,
                "invalid_period",
                "second is out of range for a $grouping budget"
            )
        }
    }
    return year to second
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

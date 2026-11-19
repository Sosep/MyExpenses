package org.totschnig.webui.api

import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.gson.gson
import io.ktor.server.application.install
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.response.respond
import io.ktor.server.routing.routing
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ApiRoutesTest {
    @Test
    fun `accounts are returned as json`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/accounts")
        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("Everyday"))
    }

    @Test
    fun `transactions are paginated`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get(
            "/api/v1/transactions?accountId=1&from=2026-11-01&to=2026-11-30&limit=10&offset=0"
        )
        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("\"total\":1"))
        assertTrue(response.bodyAsText().contains("\"limit\":10"))
    }

    @Test
    fun `missing account id is a 400`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/transactions")
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("missing_accountId"))
    }

    @Test
    fun `invalid date is a 400`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/transactions?accountId=1&from=17-11-2026")
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("invalid_from"))
    }

    @Test
    fun `unknown transaction is a 404`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/transactions/99")
        assertEquals(HttpStatusCode.NotFound, response.status)
        assertTrue(response.bodyAsText().contains("transaction_not_found"))
    }

    @Test
    fun `create returns 201 and location`() = testApplication {
        val fake = FakeDataSource()
        installRoutes(fake)
        val response = client.post("/api/v1/transactions") {
            contentType(ContentType.Application.Json)
            setBody("""{"accountId":1,"amountMinor":-1234,"date":"2026-11-17"}""")
        }
        assertEquals(HttpStatusCode.Created, response.status)
        assertEquals("/api/v1/transactions/1", response.headers[HttpHeaders.Location])
        assertEquals(-1234L, fake.created?.amountMinor ?: 0L)
    }

    @Test
    fun `update of a non-simple transaction is a 409`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.put("/api/v1/transactions/2") {
            contentType(ContentType.Application.Json)
            setBody("""{"accountId":1,"amountMinor":-1234,"date":"2026-11-17"}""")
        }
        assertEquals(HttpStatusCode.Conflict, response.status)
        assertTrue(response.bodyAsText().contains("unsupported_kind"))
    }

    @Test
    fun `delete returns 204 and unknown id returns 404`() = testApplication {
        installRoutes(FakeDataSource())
        val deleted = client.delete("/api/v1/transactions/1")
        assertEquals(HttpStatusCode.NoContent, deleted.status)
        val missing = client.delete("/api/v1/transactions/9")
        assertEquals(HttpStatusCode.NotFound, missing.status)
    }

    @Test
    fun `grouped periods carry their first date`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get(
            "/api/v1/reports/grouped?accountId=1&grouping=MONTH" +
                "&from=2026-11-01&to=2026-11-30"
        )
        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("\"firstDate\":\"2026-11-03\""))
    }

    @Test
    fun `grouped months keep the api month index`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get(
            "/api/v1/reports/grouped?accountId=1&grouping=MONTH" +
                "&from=2026-11-01&to=2026-11-30"
        )
        assertEquals(HttpStatusCode.OK, response.status)
        // November is 10: the route must not shift the index the provider sends.
        assertTrue(response.bodyAsText().contains("\"second\":10"))
    }

    @Test
    fun `invalid grouping is a 400`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/reports/grouped?accountId=1&grouping=BAD")
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("invalid_grouping"))
    }

    @Test
    fun `grouped periods apply the transaction filters`() = testApplication {
        val fake = FakeDataSource()
        installRoutes(fake)
        val response = client.get(
            "/api/v1/reports/grouped?accountId=1&grouping=MONTH&type=expense" +
                "&categoryId=2&payeeId=3&q=cafe&status=CLEARED&transfer=false"
        )
        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("expense", fake.lastGroupType)
        val filters = fake.lastGroupFilters
        assertEquals(listOf(2L), filters.categoryIds)
        assertEquals(listOf(3L), filters.payeeIds)
        assertEquals("cafe", filters.text)
        assertEquals(listOf("CLEARED"), filters.statuses)
        assertEquals(false, filters.transfer)
    }

    @Test
    fun `malformed body is a 400`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.post("/api/v1/transactions") {
            contentType(ContentType.Application.Json)
            setBody("not json")
        }
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("invalid_body"))
    }

    @Test
    fun `create transfer returns 201 and location`() = testApplication {
        val fake = FakeDataSource()
        installRoutes(fake)
        val response = client.post("/api/v1/transfers") {
            contentType(ContentType.Application.Json)
            setBody(
                """{"fromAccountId":1,"toAccountId":2,"amountMinor":5000,"date":"2026-11-17"}"""
            )
        }
        assertEquals(HttpStatusCode.Created, response.status)
        assertEquals("/api/v1/transactions/2", response.headers[HttpHeaders.Location])
        assertEquals(2L, fake.createdTransfer?.toAccountId)
    }

    @Test
    fun `transfer to the same account is a 422`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.post("/api/v1/transfers") {
            contentType(ContentType.Application.Json)
            setBody(
                """{"fromAccountId":1,"toAccountId":1,"amountMinor":5000,"date":"2026-11-17"}"""
            )
        }
        assertEquals(HttpStatusCode.UnprocessableEntity, response.status)
        assertTrue(response.bodyAsText().contains("invalid_transfer"))
    }

    @Test
    fun `create split returns 201`() = testApplication {
        val fake = FakeDataSource()
        installRoutes(fake)
        val response = client.post("/api/v1/split-transactions") {
            contentType(ContentType.Application.Json)
            setBody(
                """{"accountId":1,"amountMinor":-10000,"date":"2026-11-17","parts":[{"amountMinor":-10000,"categoryId":2}]}"""
            )
        }
        assertEquals(HttpStatusCode.Created, response.status)
        assertEquals(1, fake.createdSplit?.parts?.size ?: 0)
    }

    @Test
    fun `split with wrong sum is a 422`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.post("/api/v1/split-transactions") {
            contentType(ContentType.Application.Json)
            setBody(
                """{"accountId":1,"amountMinor":-10000,"date":"2026-11-17","parts":[{"amountMinor":-9000,"categoryId":2}]}"""
            )
        }
        assertEquals(HttpStatusCode.UnprocessableEntity, response.status)
        assertTrue(response.bodyAsText().contains("validation_failed"))
    }

    @Test
    fun `update transfer of another kind is a 409`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.put("/api/v1/transfers/2") {
            contentType(ContentType.Application.Json)
            setBody(
                """{"fromAccountId":1,"toAccountId":2,"amountMinor":5000,"date":"2026-11-17"}"""
            )
        }
        assertEquals(HttpStatusCode.Conflict, response.status)
    }

    @Test
    fun `account by id returns the same shape`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/accounts/1")
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertTrue(body.contains("\"typeName\":\"BANK\""))
        assertTrue(body.contains("\"openingBalanceMinor\":0"))
    }

    @Test
    fun `unknown account is a 404`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/accounts/99")
        assertEquals(HttpStatusCode.NotFound, response.status)
        assertTrue(response.bodyAsText().contains("account_not_found"))
    }

    @Test
    fun `account types are listed`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/account-types")
        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("\"name\":\"BANK\""))
    }

    @Test
    fun `create account returns 201 and location`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.post("/api/v1/accounts") {
            contentType(ContentType.Application.Json)
            setBody("""{"label":"Test","type":"2","currency":"EUR","openingBalanceMinor":0}""")
        }
        assertEquals(HttpStatusCode.Created, response.status)
        assertEquals("/api/v1/accounts/1", response.headers[HttpHeaders.Location])
        assertTrue(response.bodyAsText().contains("\"label\":\"Test\""))
    }

    @Test
    fun `delete account returns 204 and unknown id 404`() = testApplication {
        installRoutes(FakeDataSource())
        assertEquals(HttpStatusCode.NoContent, client.delete("/api/v1/accounts/1").status)
        assertEquals(HttpStatusCode.NotFound, client.delete("/api/v1/accounts/99").status)
    }

    @Test
    fun `paging outside the contract is a 400`() = testApplication {
        installRoutes(FakeDataSource())
        for (query in listOf("limit=0", "limit=501", "offset=-1")) {
            val response = client.get("/api/v1/transactions?accountId=1&$query")
            assertEquals(query, HttpStatusCode.BadRequest, response.status)
        }
    }

    @Test
    fun `budgets are returned as json`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/budgets")
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertTrue(body.contains("Groceries"))
        assertTrue(body.contains("MONTH"))
    }

    @Test
    fun `budgets expose their filter`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/budgets")
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertTrue(body.contains("\"categoryIds\":[2,5]"))
        assertTrue(body.contains("\"statuses\":[\"CLEARED\"]"))
    }

    @Test
    fun `budget progress returns period totals`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/budgets/1?year=2026&second=10")
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertTrue(body.contains("\"allocatedMinor\":40000"))
        assertTrue(body.contains("\"spentMinor\":31200"))
        assertTrue(body.contains("\"remainingMinor\":8800"))
        assertTrue(body.contains("November 2026"))
    }

    @Test
    fun `budget progress accepts January as index zero`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/budgets/1?year=2026&second=0")
        assertEquals(HttpStatusCode.OK, response.status)
    }

    @Test
    fun `budget progress with an out of range month is a 400`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/budgets/1?year=2026&second=12")
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("invalid_period"))
    }

    @Test
    fun `budget progress with a negative month is a 400`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/budgets/1?year=2026&second=-1")
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("invalid_period"))
    }

    @Test
    fun `half a budget period is a 400`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/budgets/1?year=2026")
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("invalid_period"))
    }

    @Test
    fun `budget breakdown returns the budget categories`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/budgets/1/breakdown?year=2026&second=10")
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertTrue(body.contains("\"totalSpentMinor\":15123"))
        assertTrue(body.contains("\"totalAllocatedMinor\":36000"))
        assertTrue(body.contains("Supermercado"))
        assertTrue(body.contains("\"categoryId\":33"))
        assertTrue(body.contains("\"parentId\":25"))
    }

    @Test
    fun `budget breakdown of an unknown id is a 404`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/budgets/99/breakdown?year=2026&second=10")
        assertEquals(HttpStatusCode.NotFound, response.status)
        assertTrue(response.bodyAsText().contains("budget_not_found"))
    }

    @Test
    fun `unknown budget is a 404`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/budgets/99")
        assertEquals(HttpStatusCode.NotFound, response.status)
        assertTrue(response.bodyAsText().contains("budget_not_found"))
    }

    @Test
    fun `create budget returns 201 and location`() = testApplication {
        val fake = FakeDataSource()
        installRoutes(fake)
        val response = client.post("/api/v1/budgets") {
            contentType(ContentType.Application.Json)
            setBody(
                """{"accountId":1,"title":"Groceries","grouping":"MONTH","amountMinor":40000}"""
            )
        }
        assertEquals(HttpStatusCode.Created, response.status)
        assertEquals("/api/v1/budgets/1", response.headers[HttpHeaders.Location])
        assertEquals("Groceries", fake.savedBudget?.title)
        assertEquals(40000L, fake.savedBudget?.amountMinor)
    }

    @Test
    fun `budget with invalid grouping is a 422`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.post("/api/v1/budgets") {
            contentType(ContentType.Application.Json)
            setBody(
                """{"accountId":1,"title":"Groceries","grouping":"FORTNIGHT","amountMinor":40000}"""
            )
        }
        assertEquals(HttpStatusCode.UnprocessableEntity, response.status)
        assertTrue(response.bodyAsText().contains("invalid_grouping"))
    }

    @Test
    fun `one-time budget without dates is a 422`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.post("/api/v1/budgets") {
            contentType(ContentType.Application.Json)
            setBody(
                """{"accountId":1,"title":"Trip","grouping":"NONE","amountMinor":90000}"""
            )
        }
        assertEquals(HttpStatusCode.UnprocessableEntity, response.status)
        assertTrue(response.bodyAsText().contains("validation_failed"))
    }

    @Test
    fun `update budget returns 200`() = testApplication {
        val fake = FakeDataSource()
        installRoutes(fake)
        val response = client.put("/api/v1/budgets/1") {
            contentType(ContentType.Application.Json)
            setBody(
                """{"accountId":1,"title":"Food","grouping":"MONTH","amountMinor":45000}"""
            )
        }
        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("Food", fake.savedBudget?.title)
    }

    @Test
    fun `delete budget returns 204 and unknown id returns 404`() = testApplication {
        installRoutes(FakeDataSource())
        val deleted = client.delete("/api/v1/budgets/1")
        assertEquals(HttpStatusCode.NoContent, deleted.status)
        val missing = client.delete("/api/v1/budgets/9")
        assertEquals(HttpStatusCode.NotFound, missing.status)
        assertTrue(missing.bodyAsText().contains("budget_not_found"))
    }

    @Test
    fun `report summary returns totals`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get(
            "/api/v1/reports/summary?accountId=1&from=2026-11-01&to=2026-11-30"
        )
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertTrue(body.contains("\"incomeMinor\":300000"))
        assertTrue(body.contains("\"netMinor\":120000"))
        assertTrue(body.contains("\"count\":12"))
    }

    @Test
    fun `breakdown returns items with share`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get(
            "/api/v1/reports/breakdown?accountId=1&by=category&type=expense" +
                "&from=2026-11-01&to=2026-11-30"
        )
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertTrue(body.contains("Groceries"))
        assertTrue(body.contains("\"share\":66.67"))
        assertTrue(body.contains("\"totalMinor\":180000"))
    }

    @Test
    fun `breakdown with invalid by is a 400`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get(
            "/api/v1/reports/breakdown?accountId=1&by=account&from=2026-11-01&to=2026-11-30"
        )
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("invalid_by"))
    }

    @Test
    fun `breakdown with invalid type is a 400`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get(
            "/api/v1/reports/breakdown?accountId=1&type=all&from=2026-11-01&to=2026-11-30"
        )
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("invalid_type"))
    }

    @Test
    fun `budget allocations are returned`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/budgets/1/allocations?year=2026&second=10")
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertTrue(body.contains("Groceries"))
        assertTrue(body.contains("\"allocatedMinor\":30000"))
        assertTrue(body.contains("\"spentMinor\":20000"))
    }

    @Test
    fun `budget allocations can be updated`() = testApplication {
        val fake = FakeDataSource()
        installRoutes(fake)
        val response = client.put("/api/v1/budgets/1/allocations") {
            contentType(ContentType.Application.Json)
            setBody(
                """{"year":2026,"second":10,"allocations":[{"categoryId":2,"amountMinor":35000},{"categoryId":0,"amountMinor":45000,"oneTime":true}],"rollover":[{"categoryId":2,"amountMinor":5000}]}"""
            )
        }
        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(35000L, fake.savedAllocations?.allocations?.first()?.amountMinor)
        assertEquals(5000L, fake.savedAllocations?.rollover?.first()?.amountMinor)
        assertEquals(45000L, fake.savedAllocations?.allocations?.last()?.amountMinor)
        assertEquals(true, fake.savedAllocations?.allocations?.last()?.oneTime)
    }

    @Test
    fun `report drill-down returns transactions`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get(
            "/api/v1/reports/transactions?accountId=1&by=category&id=2" +
                "&type=expense&from=2026-11-01&to=2026-11-30"
        )
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertTrue(body.contains("\"total\":1"))
        assertTrue(body.contains("\"kind\":\"SIMPLE\""))
    }

    @Test
    fun `duplicate budget returns 201`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.post("/api/v1/budgets/1/duplicate")
        assertEquals(HttpStatusCode.Created, response.status)
        assertEquals("/api/v1/budgets/2", response.headers[HttpHeaders.Location])
        assertTrue(response.bodyAsText().contains("(copy)"))
    }

    @Test
    fun `transaction filters are passed to the data source`() = testApplication {
        val fake = FakeDataSource()
        installRoutes(fake)
        val response = client.get(
            "/api/v1/transactions?accountId=1&categoryId=2&payeeId=3&tagId=1&methodId=4"
        )
        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(2L, fake.lastFilters["categoryId"])
        assertEquals(3L, fake.lastFilters["payeeId"])
        assertEquals(1L, fake.lastFilters["tagId"])
        assertEquals(4L, fake.lastFilters["methodId"])
    }

    @Test
    fun `repeated ids, text, amounts, status and transfer reach the data source`() =
        testApplication {
            val fake = FakeDataSource()
            installRoutes(fake)
            val response = client.get(
                "/api/v1/transactions?accountId=1&categoryId=2&categoryId=5" +
                    "&tagId=1&q=cafe&amountMin=100&amountMax=5000" +
                    "&status=CLEARED&status=RECONCILED&transfer=false"
            )
            assertEquals(HttpStatusCode.OK, response.status)
            val filters = fake.lastQueryFilters
            assertEquals(listOf(2L, 5L), filters.categoryIds)
            assertEquals(listOf(1L), filters.tagIds)
            assertEquals("cafe", filters.text)
            assertEquals(100L, filters.amountMin)
            assertEquals(5000L, filters.amountMax)
            assertEquals(listOf("CLEARED", "RECONCILED"), filters.statuses)
            assertEquals(false, filters.transfer)
        }

    @Test
    fun `an unknown status is a 400`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/transactions?accountId=1&status=NOPE")
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("invalid_status"))
    }

    @Test
    fun `an inverted amount range is a 400`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/transactions?accountId=1&amountMin=500&amountMax=100")
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("invalid_range"))
    }

    @Test
    fun `breakdown accepts all accounts`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get(
            "/api/v1/reports/breakdown?accountId=all&by=category&type=expense" +
                "&from=2026-11-01&to=2026-11-30"
        )
        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("\"accountId\":0"))
    }

    @Test
    fun `budget history is returned`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/budgets/1/history?months=3")
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertTrue(body.contains("November 2026"))
        assertTrue(body.contains("\"allocatedMinor\":40000"))
    }
}

private fun ApplicationTestBuilder.installRoutes(dataSource: WebApiDataSource) {
    application {
        install(ContentNegotiation) {
            gson()
        }
        install(StatusPages) {
            exception<BadRequestException> { call, _ ->
                call.respond(
                    HttpStatusCode.BadRequest,
                    ApiError("invalid_body", "Malformed request body")
                )
            }
            exception<ApiException> { call, cause ->
                call.respond(
                    cause.status,
                    ApiError(cause.code, cause.message, cause.fields)
                )
            }
        }
        routing {
            ApiRoutes(dataSource).register(this)
        }
    }
}

private class FakeDataSource : WebApiDataSource {
    var created: TransactionWriteDto? = null
    var createdTransfer: TransferWriteDto? = null
    var createdSplit: SplitWriteDto? = null
    var savedBudget: BudgetWriteDto? = null
    var savedAllocations: BudgetAllocationsWriteDto? = null
    var lastFilters: Map<String, Long?> = emptyMap()
    var lastQueryFilters: TransactionQueryFilters = TransactionQueryFilters()
    var lastGroupType: String? = null
    var lastGroupFilters: TransactionQueryFilters = TransactionQueryFilters()
    private val sample = sampleTransaction()

    override fun meta() = MetaDto(
        appVersion = "test",
        serverTime = "2026-11-17T10:00:00",
        timeZone = "Europe/Madrid",
        locale = "en-GB",
        homeCurrency = "EUR",
        preferences = PreferencesDto(timeEnabled = false, valueDateEnabled = false)
    )

    override suspend fun account(id: Long) = accounts().firstOrNull { it.id == id }

    override fun accountTypes() = listOf(
        AccountTypeDto(id = 1, name = "CASH", isAsset = true, supportsReconciliation = false),
        AccountTypeDto(id = 2, name = "BANK", isAsset = true, supportsReconciliation = true)
    )

    override suspend fun createAccount(body: AccountWriteDto) = sampleAccount(body.label ?: "New")

    override suspend fun updateAccount(id: Long, body: AccountWriteDto) =
        sampleAccount(body.label ?: "Everyday")

    override suspend fun deleteAccount(id: Long) = id == 1L

    override fun accounts() = listOf(
        AccountDto(
            id = 1,
            label = "Everyday",
            type = "2",
            typeName = "BANK",
            currency = "EUR",
            fractionDigits = 2,
            openingBalanceMinor = 0,
            currentBalanceMinor = 10000,
            totalMinor = 10000,
            incomeMinor = 5000,
            expensesMinor = -1000,
            excludeFromTotals = false,
            sealed = false,
            color = 0,
            parentId = null
        )
    )

    override fun categories() = emptyList<CategoryDto>()

    override fun payees() = emptyList<PayeeDto>()

    override fun tags() = emptyList<TagDto>()

    override fun methods() = emptyList<MethodDto>()

    override fun transactionPage(
        accountId: Long,
        from: LocalDate?,
        to: LocalDate?,
        type: String?,
        filters: TransactionQueryFilters,
        limit: Int,
        offset: Int
    ): PageDto<TransactionDto> {
        lastFilters = mapOf(
            "categoryId" to filters.categoryIds.firstOrNull(),
            "payeeId" to filters.payeeIds.firstOrNull(),
            "tagId" to filters.tagIds.firstOrNull(),
            "methodId" to filters.methodIds.firstOrNull()
        )
        lastQueryFilters = filters
        return PageDto(
            items = listOf(sample),
            total = 1,
            limit = limit,
            offset = offset
        )
    }

    override fun transaction(id: Long) = sample.takeIf { id == 1L }

    override fun groups(
        accountId: Long,
        grouping: String,
        from: LocalDate,
        to: LocalDate,
        type: String?,
        filters: TransactionQueryFilters
    ) = listOf(GroupDto(2026, 10, 1000, -500, 0, firstDate = "2026-11-03")).also {
        lastGroupType = type
        lastGroupFilters = filters
    }

    override suspend fun budgetAllocations(id: Long, year: Int?, second: Int?) =
        if (id == 1L) {
            listOf(
                BudgetAllocationDto(
                    categoryId = 2,
                    label = "Groceries",
                    level = 1,
                    parentId = 1,
                    allocatedMinor = 30000,
                    spentMinor = 20000
                )
            )
        } else {
            emptyList()
        }

    override suspend fun budgetHistory(id: Long, months: Int): List<BudgetHistoryPointDto> =
        if (id == 1L) {
            listOf(
                BudgetHistoryPointDto(
                    periodYear = 2026,
                    periodSecond = 11,
                    periodDescription = "November 2026",
                    allocatedMinor = 40000,
                    spentMinor = 31200,
                    remainingMinor = 8800
                )
            )
        } else {
            emptyList()
        }

    override suspend fun updateBudgetAllocations(
        id: Long,
        body: BudgetAllocationsWriteDto
    ): List<BudgetAllocationDto> {
        if (id != 1L) {
            throw ApiException(
                HttpStatusCode.NotFound,
                "budget_not_found",
                "Budget not found"
            )
        }
        savedAllocations = body
        return budgetAllocations(id, body.year, body.second)
    }

    override suspend fun createBudget(body: BudgetWriteDto): BudgetDto {
        if (body.grouping !in setOf("DAY", "WEEK", "MONTH", "YEAR", "NONE")) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "invalid_grouping",
                "Invalid grouping"
            )
        }
        if (body.grouping == "NONE" && (body.start == null || body.end == null)) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Missing start or end"
            )
        }
        savedBudget = body
        return sampleBudget().copy(criteria = body.criteria)
    }

    override suspend fun duplicateBudget(id: Long): BudgetDto {
        if (id != 1L) {
            throw ApiException(
                HttpStatusCode.NotFound,
                "budget_not_found",
                "Budget not found"
            )
        }
        return sampleBudget().copy(id = 2, title = "Groceries (copy)")
    }

    override suspend fun updateBudget(id: Long, body: BudgetWriteDto): BudgetDto {
        if (id != 1L) {
            throw ApiException(
                HttpStatusCode.NotFound,
                "budget_not_found",
                "Budget not found"
            )
        }
        savedBudget = body
        return sampleBudget().copy(criteria = body.criteria)
    }

    override suspend fun deleteBudget(id: Long) = id == 1L

    override fun summary(accountId: Long, from: LocalDate, to: LocalDate) =
        ReportSummaryDto(
            accountId = accountId,
            from = from.toString(),
            to = to.toString(),
            currency = "EUR",
            fractionDigits = 2,
            incomeMinor = 300000,
            expensesMinor = -180000,
            netMinor = 120000,
            count = 12
        )

    override fun breakdown(
        accountId: Long,
        by: String,
        type: String,
        from: LocalDate,
        to: LocalDate
    ) = BreakdownDto(
        accountId = accountId,
        from = from.toString(),
        to = to.toString(),
        by = by,
        type = type,
        currency = "EUR",
        fractionDigits = 2,
        totalMinor = 180000,
        items = listOf(
            BreakdownItemDto(1, "Food > Groceries", 120000, 8, 66.67),
            BreakdownItemDto(2, "Transport", 60000, 4, 33.33)
        )
    )

    override fun reportTransactions(
        accountId: Long,
        by: String,
        groupId: Long,
        type: String,
        from: LocalDate,
        to: LocalDate,
        limit: Int,
        offset: Int
    ) = PageDto(items = listOf(sample), total = 1, limit = limit, offset = offset)

    override suspend fun budgets() = listOf(sampleBudget())

    override suspend fun budgetProgress(id: Long, year: Int?, second: Int?) =
        if (id == 1L) sampleBudgetProgress() else null

    override suspend fun budgetBreakdown(id: Long, year: Int?, second: Int?) =
        if (id == 1L) sampleBudgetBreakdown() else null

    override fun createTransaction(body: TransactionWriteDto): TransactionDto {
        created = body
        return sample
    }

    override fun updateTransaction(id: Long, body: TransactionWriteDto): TransactionDto {
        if (id == 2L) {
            throw ApiException(
                HttpStatusCode.Conflict,
                "unsupported_kind",
                "Transfers and split transactions need their own endpoint"
            )
        }
        return sample
    }

    override fun createTransfer(body: TransferWriteDto): TransactionDto {
        if (body.fromAccountId == body.toAccountId) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "invalid_transfer",
                "The two accounts must differ"
            )
        }
        createdTransfer = body
        return sampleTransfer()
    }

    override fun updateTransfer(id: Long, body: TransferWriteDto): TransactionDto {
        if (id == 2L) {
            throw ApiException(
                HttpStatusCode.Conflict,
                "unsupported_kind",
                "Not a transfer"
            )
        }
        createdTransfer = body
        return sampleTransfer()
    }

    override fun createSplit(body: SplitWriteDto): TransactionDto {
        val sum = body.parts?.sumOf { it.amountMinor ?: 0L } ?: 0L
        if (body.parts.isNullOrEmpty() || (body.amountMinor ?: 0L) != sum) {
            throw ApiException(
                HttpStatusCode.UnprocessableEntity,
                "validation_failed",
                "Sum of parts must equal the parent amount",
                mapOf("parts" to "Sum must equal amountMinor")
            )
        }
        createdSplit = body
        return sampleSplit()
    }

    override fun updateSplit(id: Long, body: SplitWriteDto): TransactionDto {
        if (id == 2L) {
            throw ApiException(
                HttpStatusCode.Conflict,
                "unsupported_kind",
                "Not a split transaction"
            )
        }
        return sampleSplit()
    }

    override fun deleteTransaction(id: Long) = id == 1L
}

private fun sampleTransaction() = TransactionDto(
    id = 1,
    kind = "SIMPLE",
    accountId = 1,
    amountMinor = -1234,
    currency = "EUR",
    fractionDigits = 2,
    date = "2026-11-17",
    time = null,
    valueDate = "2026-11-17",
    payee = EntityRef(1, "Mercadona"),
    category = CategoryRef(2, "Groceries", "Food > Groceries"),
    tags = emptyList(),
    comment = "",
    method = null,
    referenceNumber = null,
    crStatus = "UNRECONCILED",
    transferPeerId = null,
    splitParts = null
)

private fun sampleTransfer() = TransactionDto(
    id = 2,
    kind = "TRANSFER",
    accountId = 1,
    amountMinor = -5000,
    currency = "EUR",
    fractionDigits = 2,
    date = "2026-11-17",
    time = null,
    valueDate = "2026-11-17",
    payee = null,
    category = null,
    tags = emptyList(),
    comment = "Transfer",
    method = null,
    referenceNumber = null,
    crStatus = "UNRECONCILED",
    transferPeerId = 3,
    transferAccountId = 2,
    splitParts = null
)

private fun sampleSplit() = TransactionDto(
    id = 3,
    kind = "SPLIT",
    accountId = 1,
    amountMinor = -10000,
    currency = "EUR",
    fractionDigits = 2,
    date = "2026-11-17",
    time = null,
    valueDate = "2026-11-17",
    payee = EntityRef(1, "Mercadona"),
    category = null,
    tags = emptyList(),
    comment = "",
    method = null,
    referenceNumber = null,
    crStatus = "UNRECONCILED",
    transferPeerId = null,
    transferAccountId = null,
    splitParts = listOf(
        SplitPartDto(
            id = 31,
            amountMinor = -10000,
            payee = null,
            category = CategoryRef(2, "Groceries", "Food > Groceries"),
            tags = emptyList(),
            comment = "",
            method = null,
            referenceNumber = null,
            transferPeerId = null,
            transferAccountId = null
        )
    )
)

private fun sampleAccount(label: String = "Everyday") = AccountDto(
    id = 1,
    label = label,
    type = "2",
    typeName = "BANK",
    currency = "EUR",
    fractionDigits = 2,
    openingBalanceMinor = 0,
    currentBalanceMinor = 10000,
    totalMinor = 10000,
    incomeMinor = 5000,
    expensesMinor = -1000,
    excludeFromTotals = false,
    sealed = false,
    color = 0,
    parentId = null
)

private fun sampleBudget() = BudgetDto(
    id = 1,
    accountId = 1,
    title = "Groceries",
    description = null,
    currency = "EUR",
    fractionDigits = 2,
    grouping = "MONTH",
    color = 0,
    start = null,
    end = null,
    accountName = "Everyday",
    isDefault = false,
    uuid = "budget-uuid",
    allocationMinor = 40000,
    criteria = BudgetCriteriaDto(categoryIds = listOf(2, 5), statuses = listOf("CLEARED"))
)

private fun sampleBudgetProgress() = BudgetProgressDto(
    budgetId = 1,
    accountId = 1,
    title = "Groceries",
    currency = "EUR",
    fractionDigits = 2,
    grouping = "MONTH",
    periodYear = 2026,
    periodSecond = 10,
    periodStart = "2026-11-01",
    periodEnd = "2026-11-30",
    periodDescription = "November 2026",
    allocatedMinor = 40000,
    spentMinor = 31200,
    remainingMinor = 8800,
    totalDays = 30,
    currentDay = 17
)

private fun sampleBudgetBreakdown() = BudgetBreakdownDto(
    budgetId = 1,
    accountId = 1,
    title = "Groceries",
    currency = "EUR",
    fractionDigits = 2,
    grouping = "MONTH",
    periodYear = 2026,
    periodSecond = 10,
    periodDescription = "November 2026",
    periodStart = "2026-11-01",
    periodEnd = "2026-11-30",
    totalAllocatedMinor = 36000,
    totalSpentMinor = 15123,
    categories = listOf(
        BudgetBreakdownCategoryDto(
            categoryId = 33,
            label = "Supermercado",
            level = 2,
            parentId = 25,
            allocatedMinor = 0,
            spentMinor = 13224,
            rolloverPreviousMinor = 0,
            rolloverNextMinor = 0
        ),
        BudgetBreakdownCategoryDto(
            categoryId = 169,
            label = "Utiles",
            level = 1,
            parentId = null,
            allocatedMinor = 0,
            spentMinor = 1899,
            rolloverPreviousMinor = 0,
            rolloverNextMinor = 0
        )
    )
)

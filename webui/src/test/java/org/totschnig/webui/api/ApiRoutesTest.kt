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
    fun `invalid grouping is a 400`() = testApplication {
        installRoutes(FakeDataSource())
        val response = client.get("/api/v1/reports/grouped?accountId=1&grouping=BAD")
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("invalid_grouping"))
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
    private val sample = sampleTransaction()

    override fun meta() = MetaDto(
        appVersion = "test",
        serverTime = "2026-11-17T10:00:00",
        timeZone = "Europe/Madrid",
        locale = "en-GB",
        homeCurrency = "EUR",
        preferences = PreferencesDto(timeEnabled = false, valueDateEnabled = false)
    )

    override fun accounts() = listOf(
        AccountDto(
            id = 1,
            label = "Everyday",
            type = "BANK",
            currency = "EUR",
            fractionDigits = 2,
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
        limit: Int,
        offset: Int
    ) = PageDto(
        items = listOf(sample),
        total = 1,
        limit = limit,
        offset = offset
    )

    override fun transaction(id: Long) = sample.takeIf { id == 1L }

    override fun groups(
        accountId: Long,
        grouping: String,
        from: LocalDate,
        to: LocalDate
    ) = listOf(GroupDto(2026, 11, 1000, -500, 0))

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

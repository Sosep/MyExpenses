package org.totschnig.webui.api

import io.ktor.http.HttpStatusCode

class ApiException(
    val status: HttpStatusCode,
    val code: String,
    override val message: String,
    val fields: Map<String, String>? = null
) : RuntimeException(message)

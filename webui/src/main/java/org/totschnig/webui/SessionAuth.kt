package org.totschnig.webui

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.auth.AuthenticationConfig
import io.ktor.server.auth.AuthenticationContext
import io.ktor.server.auth.AuthenticationFailedCause
import io.ktor.server.auth.AuthenticationProvider
import io.ktor.server.auth.UserIdPrincipal
import io.ktor.server.response.respond
import org.totschnig.webui.api.ApiError

/**
 * Ktor authentication provider that accepts the session cookie issued by
 * `POST /api/v1/session`. Requests without a valid cookie get a JSON 401, so
 * the browser does not open the native Basic dialog.
 */
class SessionAuthenticationProvider(
    private val config: Config
) : AuthenticationProvider(config) {
    class Config(val store: SessionStore) :
        AuthenticationProvider.Config(NAME) {
        companion object {
            const val NAME = "auth-session"
        }
    }

    override suspend fun onAuthenticate(context: AuthenticationContext) {
        val token = context.call.request.cookies[SessionStore.COOKIE_NAME]
        if (token != null && config.store.isValid(token)) {
            context.principal(UserIdPrincipal("web"))
        } else {
            context.challenge(Config.NAME, AuthenticationFailedCause.NoCredentials) {
                    challenge,
                    call
                ->
                call.respond(
                    HttpStatusCode.Unauthorized,
                    ApiError("unauthorized", "Sign in required")
                )
                challenge.complete()
            }
        }
    }
}

fun AuthenticationConfig.session(store: SessionStore) {
    register(SessionAuthenticationProvider(SessionAuthenticationProvider.Config(store)))
}

fun ApplicationCall.clearSessionCookie(secure: Boolean) {
    val cookie = io.ktor.http.Cookie(
        name = SessionStore.COOKIE_NAME,
        value = "",
        maxAge = 0,
        path = "/",
        secure = secure,
        httpOnly = true,
        extensions = mapOf("SameSite" to "Strict")
    )
    response.cookies.append(cookie)
}

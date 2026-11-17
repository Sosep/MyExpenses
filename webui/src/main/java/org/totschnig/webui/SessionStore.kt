package org.totschnig.webui

import java.security.SecureRandom
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap

/**
 * In-memory session tokens for the web UI. The server lives in the phone's
 * process, so sessions do not need to survive a restart; the SPA signs in again.
 */
class SessionStore(
    private val ttl: Duration = Duration.ofDays(7),
    private val clock: Clock = Clock.systemUTC(),
    private val random: SecureRandom = SecureRandom()
) {
    private val sessions = ConcurrentHashMap<String, Instant>()

    fun create(): String {
        val bytes = ByteArray(32)
        random.nextBytes(bytes)
        val token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        sessions[token] = clock.instant().plus(ttl)
        return token
    }

    fun isValid(token: String): Boolean {
        val expiry = sessions[token] ?: return false
        if (clock.instant().isAfter(expiry)) {
            sessions.remove(token)
            return false
        }
        // Sliding expiration: an active client keeps its session.
        sessions[token] = clock.instant().plus(ttl)
        return true
    }

    fun remove(token: String) {
        sessions.remove(token)
    }

    fun size(): Int = sessions.size

    companion object {
        const val COOKIE_NAME = "myexpenses_session"
        val TTL: Duration = Duration.ofDays(7)
    }
}

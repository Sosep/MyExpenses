package org.totschnig.webui

/**
 * Sliding window of failed sign-in attempts per client, so a wrong password
 * cannot be guessed in a loop over the local network. Only failures are
 * tracked; a successful sign-in clears the client's window.
 */
class LoginThrottle(
    private val maxFailures: Int = 5,
    private val windowSeconds: Long = 60,
    private val now: () -> Long = { System.currentTimeMillis() / 1000 }
) {
    private val failures = HashMap<String, MutableList<Long>>()

    /** Seconds to wait before the next attempt, or null when the client may try. */
    @Synchronized
    fun retryAfterSeconds(key: String): Long? {
        val current = now()
        val recent = failures[key] ?: return null
        recent.removeAll { it <= current - windowSeconds }
        if (recent.size < maxFailures) return null
        return (recent.first() + windowSeconds - current).coerceAtLeast(1)
    }

    @Synchronized
    fun recordFailure(key: String) {
        val attempts = failures.getOrPut(key) { mutableListOf() }
        attempts.add(now())
        // Keep the map bounded for clients that keep failing.
        if (attempts.size > maxFailures * 4) attempts.removeAt(0)
    }

    @Synchronized
    fun clear(key: String) {
        failures.remove(key)
    }
}

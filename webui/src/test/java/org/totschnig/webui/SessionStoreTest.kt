package org.totschnig.webui

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionStoreTest {
    @Test
    fun `created token is valid until it is removed`() {
        val store = SessionStore(clock = MutableClock(Instant.parse("2026-11-17T10:00:00Z")))
        val token = store.create()
        assertTrue(store.isValid(token))
        assertEquals(1, store.size())
        store.remove(token)
        assertFalse(store.isValid(token))
        assertEquals(0, store.size())
    }

    @Test
    fun `token expires after the ttl`() {
        val clock = MutableClock(Instant.parse("2026-11-17T10:00:00Z"))
        val store = SessionStore(ttl = Duration.ofDays(7), clock = clock)
        val token = store.create()
        clock.advance(Duration.ofDays(8))
        assertFalse(store.isValid(token))
        assertEquals(0, store.size())
    }

    @Test
    fun `activity extends the session`() {
        val clock = MutableClock(Instant.parse("2026-11-17T10:00:00Z"))
        val store = SessionStore(ttl = Duration.ofDays(7), clock = clock)
        val token = store.create()
        clock.advance(Duration.ofDays(6))
        assertTrue(store.isValid(token))
        clock.advance(Duration.ofDays(6))
        assertTrue(store.isValid(token))
    }

    @Test
    fun `unknown token is rejected`() {
        val store = SessionStore(clock = MutableClock(Instant.parse("2026-11-17T10:00:00Z")))
        assertFalse(store.isValid("not-a-token"))
    }

    private class MutableClock(private var current: Instant) : Clock() {
        fun advance(duration: Duration) {
            current = current.plus(duration)
        }

        override fun getZone(): ZoneId = ZoneOffset.UTC

        override fun withZone(zone: ZoneId): Clock = this

        override fun instant(): Instant = current
    }
}

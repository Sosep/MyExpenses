package org.totschnig.webui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class LoginThrottleTest {
    private var now = 1_000L
    private val throttle = LoginThrottle(maxFailures = 3, windowSeconds = 60) { now }

    @Test
    fun `allows attempts below the limit`() {
        repeat(2) {
            assertNull(throttle.retryAfterSeconds("phone"))
            throttle.recordFailure("phone")
        }
        assertNull(throttle.retryAfterSeconds("phone"))
    }

    @Test
    fun `blocks once the limit is reached and says for how long`() {
        repeat(3) { throttle.recordFailure("phone") }

        val wait = throttle.retryAfterSeconds("phone")
        assertNotNull(wait)
        assertEquals(60L, wait)
    }

    @Test
    fun `frees the client when the window passes`() {
        repeat(3) { throttle.recordFailure("phone") }
        now += 61

        assertNull(throttle.retryAfterSeconds("phone"))
    }

    @Test
    fun `counts each client apart`() {
        repeat(3) { throttle.recordFailure("phone") }

        assertNotNull(throttle.retryAfterSeconds("phone"))
        assertNull(throttle.retryAfterSeconds("laptop"))
    }

    @Test
    fun `a successful sign-in clears the window`() {
        repeat(3) { throttle.recordFailure("phone") }
        throttle.clear("phone")

        assertNull(throttle.retryAfterSeconds("phone"))
    }
}

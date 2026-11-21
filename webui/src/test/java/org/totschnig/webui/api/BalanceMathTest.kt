package org.totschnig.webui.api

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BalanceMathTest {
    @Test
    fun `days without movements carry the last balance`() {
        val from = LocalDate.parse("2026-11-01")
        val to = LocalDate.parse("2026-11-05")
        val series = foldBalanceSeries(
            100000,
            listOf(BalanceDay(LocalDate.parse("2026-11-02"), -25000)),
            from,
            to,
            BalanceGranularity.DAY
        )
        assertEquals(5, series.size)
        assertEquals(
            listOf(100000L, 75000L, 75000L, 75000L, 75000L),
            series.map { it.balanceMinor }
        )
        assertEquals("2026-11-05", series.last().date)
    }

    @Test
    fun `the last point reconciles with opening plus every movement`() {
        val from = LocalDate.parse("2026-05-01")
        val to = LocalDate.parse("2026-11-21")
        val days = listOf(
            BalanceDay(LocalDate.parse("2026-05-03"), 50000),
            BalanceDay(LocalDate.parse("2026-08-11"), -20000),
            BalanceDay(LocalDate.parse("2026-11-20"), -5000)
        )
        val series = foldBalanceSeries(1234500, days, from, to, BalanceGranularity.MONTH)
        assertEquals(1234500 + 50000 - 20000 - 5000, series.last().balanceMinor)
        assertEquals("2026-11-21", series.last().date)
    }

    @Test
    fun `monthly points land on the end of the month and the range end`() {
        val from = LocalDate.parse("2026-05-17")
        val to = LocalDate.parse("2026-07-10")
        val points = bucketDates(from, to, BalanceGranularity.MONTH)
        assertEquals(
            listOf("2026-05-31", "2026-06-30", "2026-07-10"),
            points.map { it.toString() }
        )
    }

    @Test
    fun `weeks end on Sunday and the range end closes the series`() {
        val from = LocalDate.parse("2026-11-02") // Monday
        val to = LocalDate.parse("2026-11-18")
        val points = bucketDates(from, to, BalanceGranularity.WEEK).map { it.toString() }
        assertEquals("2026-11-08", points.first())
        assertEquals("2026-11-18", points.last())
    }

    @Test
    fun `auto picks day, week and month by range length`() {
        assertEquals(
            BalanceGranularity.DAY,
            autoBalanceGranularity(
                LocalDate.parse("2026-11-01"),
                LocalDate.parse("2027-01-09")
            )
        )
        assertEquals(
            BalanceGranularity.WEEK,
            autoBalanceGranularity(
                LocalDate.parse("2026-01-01"),
                LocalDate.parse("2026-12-31")
            )
        )
        assertEquals(
            BalanceGranularity.MONTH,
            autoBalanceGranularity(
                LocalDate.parse("2020-01-01"),
                LocalDate.parse("2026-12-31")
            )
        )
    }

    @Test
    fun `a dense explicit granularity falls back to auto`() {
        val from = LocalDate.parse("2020-01-01")
        val to = LocalDate.parse("2026-12-31")
        val (granularity, fallback) = resolveBalanceGranularity("DAY", from, to)
        assertEquals(BalanceGranularity.MONTH, granularity)
        assertTrue(fallback)
    }

    @Test
    fun `a workable explicit granularity is kept`() {
        val from = LocalDate.parse("2026-11-01")
        val to = LocalDate.parse("2026-11-30")
        val (granularity, fallback) = resolveBalanceGranularity("WEEK", from, to)
        assertEquals(BalanceGranularity.WEEK, granularity)
        assertFalse(fallback)
    }

    @Test
    fun `a transfer changes each account and cancels in the total`() {
        val from = LocalDate.parse("2026-11-01")
        val to = LocalDate.parse("2026-11-02")
        val outgoing = foldBalanceSeries(
            100000,
            listOf(BalanceDay(LocalDate.parse("2026-11-02"), -25000)),
            from,
            to,
            BalanceGranularity.DAY
        )
        val incoming = foldBalanceSeries(
            50000,
            listOf(BalanceDay(LocalDate.parse("2026-11-02"), 25000)),
            from,
            to,
            BalanceGranularity.DAY
        )
        assertEquals(75000, outgoing.last().balanceMinor)
        assertEquals(75000, incoming.last().balanceMinor)
        val total = totalBalanceSeries(listOf(outgoing, incoming))
        assertEquals(150000, total.first().balanceMinor)
        assertEquals(150000, total.last().balanceMinor)
    }

    @Test
    fun `a child inherits its parent expense type`() {
        val categories = listOf(
            CategoryDto(1, null, "Food", 0, null, 1),
            CategoryDto(2, 1, "Groceries", 1, null, null),
            CategoryDto(3, null, "Salary", 0, null, 2),
            CategoryDto(4, 3, "Bonus", 1, null, null)
        )
        assertEquals(setOf(1L, 2L), expenseCategoryIds(categories))
    }

    @Test
    fun `totals add the series of the same currency`() {
        val total = totalBalanceSeries(
            listOf(
                listOf(BalancePointDto("2026-11-01", 100), BalancePointDto("2026-11-02", 150)),
                listOf(BalancePointDto("2026-11-01", 50), BalancePointDto("2026-11-02", 25))
            )
        )
        assertEquals(listOf(150L, 175L), total.map { it.balanceMinor })
    }
}

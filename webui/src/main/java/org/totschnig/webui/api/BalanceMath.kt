package org.totschnig.webui.api

import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.ChronoUnit

/**
 * Pure folding of the daily movements into a dense balance series. Kept out of
 * the datasource so the tricky parts - bucketing, carrying the last balance
 * over days without movements and reconciling the last point - run on the JVM
 * against a fixture instead of only on a device.
 */
enum class BalanceGranularity {
    DAY,
    WEEK,
    MONTH;

    companion object {
        fun parse(value: String): BalanceGranularity? = when (value.uppercase()) {
            "DAY" -> DAY
            "WEEK" -> WEEK
            "MONTH" -> MONTH
            else -> null
        }
    }
}

/** One day with its signed movement and the non-transfer inflow/outflow. */
data class BalanceDay(
    val date: LocalDate,
    val amountMinor: Long,
    val incomeMinor: Long = 0,
    val expenseMinor: Long = 0
)

/** About 13 months of days or 5 years of weeks; never a response with thousands. */
private const val MAX_POINTS = 400

fun autoBalanceGranularity(from: LocalDate, to: LocalDate): BalanceGranularity {
    val days = ChronoUnit.DAYS.between(from, to) + 1
    return when {
        days <= 70 -> BalanceGranularity.DAY
        days <= 30 * 31L -> BalanceGranularity.WEEK
        else -> BalanceGranularity.MONTH
    }
}

/**
 * The granularity actually used, plus whether an explicit choice had to fall
 * back because it would have returned too many points.
 */
fun resolveBalanceGranularity(
    requested: String,
    from: LocalDate,
    to: LocalDate
): Pair<BalanceGranularity, Boolean> {
    val auto = autoBalanceGranularity(from, to)
    if (requested.equals("AUTO", ignoreCase = true)) return auto to false
    val explicit = BalanceGranularity.parse(requested) ?: return auto to true
    return if (bucketDates(from, to, explicit).size > MAX_POINTS) {
        auto to true
    } else {
        explicit to false
    }
}

/**
 * Dates at which the series carries a point. Weeks end on Sunday (the app's
 * Monday-first weeks), months on their last day. Every date is clipped to the
 * requested range, so the last point is always `to`.
 */
fun bucketDates(from: LocalDate, to: LocalDate, granularity: BalanceGranularity): List<LocalDate> {
    if (to.isBefore(from)) return emptyList()
    if (from == to) return listOf(to)
    val points = mutableListOf<LocalDate>()
    when (granularity) {
        BalanceGranularity.DAY -> {
            var date = from
            while (!date.isAfter(to)) {
                points.add(date)
                date = date.plusDays(1)
            }
        }

        BalanceGranularity.WEEK -> {
            var date = from.plusDays(((7 - from.dayOfWeek.value) % 7).toLong())
            while (date.isBefore(to)) {
                points.add(date)
                date = date.plusWeeks(1)
            }
            points.add(to)
        }

        BalanceGranularity.MONTH -> {
            var month = YearMonth.from(from)
            while (true) {
                val end = month.atEndOfMonth()
                if (end.isAfter(to)) break
                points.add(end)
                month = month.plusMonths(1)
            }
            if (points.isEmpty() || points.last() != to) points.add(to)
        }
    }
    return points
}

/**
 * Folds daily movements into a dense series starting from [startBalanceMinor].
 * Days without movements carry the previous balance: they never become zero.
 */
fun foldBalanceSeries(
    startBalanceMinor: Long,
    days: List<BalanceDay>,
    from: LocalDate,
    to: LocalDate,
    granularity: BalanceGranularity
): List<BalancePointDto> {
    val byDate = mutableMapOf<LocalDate, Long>()
    days.forEach { day ->
        if (!day.date.isBefore(from) && !day.date.isAfter(to)) {
            byDate[day.date] = (byDate[day.date] ?: 0L) + day.amountMinor
        }
    }
    var balance = startBalanceMinor
    var cursor = from
    val result = mutableListOf<BalancePointDto>()
    for (point in bucketDates(from, to, granularity)) {
        while (!cursor.isAfter(point)) {
            balance += byDate[cursor] ?: 0L
            cursor = cursor.plusDays(1)
        }
        result.add(BalancePointDto(point.toString(), balance))
    }
    return result
}

/** Sums per-account series of the same currency into one total series. */
fun totalBalanceSeries(
    seriesByAccount: List<List<BalancePointDto>>
): List<BalancePointDto> {
    if (seriesByAccount.isEmpty()) return emptyList()
    val totals = linkedMapOf<String, Long>()
    seriesByAccount.forEach { series ->
        series.forEach { point ->
            totals[point.date] = (totals[point.date] ?: 0L) + point.balanceMinor
        }
    }
    return totals.map { (date, balance) -> BalancePointDto(date, balance) }
}

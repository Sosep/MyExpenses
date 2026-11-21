package org.totschnig.webui.api

private val MONTH_PATTERN = Regex("^\\d{4}-(0[1-9]|1[0-2])$")

private val THEMES = setOf("light", "dark")
private val LOCALES = setOf("en", "es")
private val GROUPINGS = setOf("NONE", "DAY", "WEEK", "MONTH", "YEAR")
private val REPORT_RANGES = setOf("month", "last3", "year")
private val REPORT_BREAKDOWNS = setOf("category", "payee", "tag", "method")
private val REPORT_TYPES = setOf("expense", "income", "both")
private val TRANSACTION_TYPES = setOf("all", "expense", "income")

/**
 * Validates the fields present in a partial update. Only the values the client
 * sent are checked: a missing field keeps the stored one, so an absent enum is
 * never an error.
 */
fun UiPreferencesDto.validationFields(): Map<String, String> {
    val fields = mutableMapOf<String, String>()

    fun requireOneOf(name: String, value: String?, allowed: Set<String>) {
        if (value != null && value !in allowed) {
            fields[name] = "Must be one of: ${allowed.joinToString()}"
        }
    }

    requireOneOf("theme", theme, THEMES)
    requireOneOf("locale", locale, LOCALES)
    requireOneOf("grouping", grouping, GROUPINGS)
    requireOneOf("reportRange", reportRange, REPORT_RANGES)
    requireOneOf("reportBreakdown", reportBreakdown, REPORT_BREAKDOWNS)
    requireOneOf("reportType", reportType, REPORT_TYPES)
    requireOneOf("transactionType", transactionType, TRANSACTION_TYPES)

    if (accountId != null && accountId <= 0) {
        fields["accountId"] = "Must be a positive number"
    }
    if (reportMonth != null && !MONTH_PATTERN.matches(reportMonth)) {
        fields["reportMonth"] = "Must be YYYY-MM"
    }
    if (budgetMonth != null && !MONTH_PATTERN.matches(budgetMonth)) {
        fields["budgetMonth"] = "Must be YYYY-MM"
    }
    return fields
}

/** Read-modify-write by field: an absent value is kept, a present one replaces it. */
fun UiPreferencesDto.mergedWith(body: UiPreferencesDto) = copy(
    theme = body.theme ?: theme,
    locale = body.locale ?: locale,
    accountId = body.accountId ?: accountId,
    grouping = body.grouping ?: grouping,
    hideTotals = body.hideTotals ?: hideTotals,
    hideTransactions = body.hideTransactions ?: hideTransactions,
    reportMonth = body.reportMonth ?: reportMonth,
    reportRange = body.reportRange ?: reportRange,
    reportBreakdown = body.reportBreakdown ?: reportBreakdown,
    reportType = body.reportType ?: reportType,
    reportAllAccounts = body.reportAllAccounts ?: reportAllAccounts,
    budgetMonth = body.budgetMonth ?: budgetMonth,
    transactionType = body.transactionType ?: transactionType
)

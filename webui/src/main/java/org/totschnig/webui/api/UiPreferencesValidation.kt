package org.totschnig.webui.api

private val MONTH_PATTERN = Regex("^\\d{4}-(0[1-9]|1[0-2])$")

private val THEMES = setOf("light", "dark")
private val LOCALES = setOf("en", "es")
private val GROUPINGS = setOf("NONE", "DAY", "WEEK", "MONTH", "YEAR")
private val REPORT_RANGES = setOf("month", "last3", "year")
private val REPORT_BREAKDOWNS = setOf("category", "payee", "tag", "method")
private val REPORT_TYPES = setOf("expense", "income", "both")
private val TRANSACTION_TYPES = setOf("all", "expense", "income")
private val REPORT_TABS =
    setOf("summary", "expenses", "income", "accounts", "investments", "budgets")
private val REPORT_PERIODS = setOf("week", "month", "quarter", "year", "lastYear", "custom")
private val REPORT_COMPARES = setOf("none", "previous")
private val REPORT_BALANCE_RANGES = setOf("m1", "m3", "m6", "y1", "y2", "y5", "all", "custom")

private val DATE_PATTERN = Regex("^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$")

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
    requireOneOf("reportTab", reportTab, REPORT_TABS)
    requireOneOf("reportPeriod", reportPeriod, REPORT_PERIODS)
    requireOneOf("reportCompare", reportCompare, REPORT_COMPARES)
    requireOneOf("reportBalanceRange", reportBalanceRange, REPORT_BALANCE_RANGES)

    if (accountId != null && accountId <= 0) {
        fields["accountId"] = "Must be a positive number"
    }
    if (reportMonth != null && !MONTH_PATTERN.matches(reportMonth)) {
        fields["reportMonth"] = "Must be YYYY-MM"
    }
    if (budgetMonth != null && !MONTH_PATTERN.matches(budgetMonth)) {
        fields["budgetMonth"] = "Must be YYYY-MM"
    }
    for ((name, value) in listOf(
        "reportCustomFrom" to reportCustomFrom,
        "reportCustomTo" to reportCustomTo,
        "reportBalanceFrom" to reportBalanceFrom,
        "reportBalanceTo" to reportBalanceTo
    )) {
        if (value != null && !DATE_PATTERN.matches(value)) {
            fields[name] = "Must be YYYY-MM-DD"
        }
    }
    if (reportAccountIds != null && reportAccountIds.any { it <= 0 }) {
        fields["reportAccountIds"] = "Must be a list of positive numbers"
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
    reportTab = body.reportTab ?: reportTab,
    reportPeriod = body.reportPeriod ?: reportPeriod,
    reportCustomFrom = body.reportCustomFrom ?: reportCustomFrom,
    reportCustomTo = body.reportCustomTo ?: reportCustomTo,
    reportCompare = body.reportCompare ?: reportCompare,
    reportBalanceRange = body.reportBalanceRange ?: reportBalanceRange,
    reportBalanceFrom = body.reportBalanceFrom ?: reportBalanceFrom,
    reportBalanceTo = body.reportBalanceTo ?: reportBalanceTo,
    reportAccountIds = body.reportAccountIds ?: reportAccountIds,
    budgetMonth = body.budgetMonth ?: budgetMonth,
    transactionType = body.transactionType ?: transactionType
)

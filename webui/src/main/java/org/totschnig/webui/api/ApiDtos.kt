package org.totschnig.webui.api

import androidx.annotation.Keep

@Keep
data class ApiError(
    val error: String,
    val message: String,
    val fields: Map<String, String>? = null
)

@Keep
data class MetaDto(
    val appVersion: String,
    val serverTime: String,
    val timeZone: String,
    val locale: String,
    val homeCurrency: String,
    val preferences: PreferencesDto
)

@Keep
data class PreferencesDto(
    val timeEnabled: Boolean,
    val valueDateEnabled: Boolean
)

/** Portfolio role of an account, mirroring the app's `is_portfolio` column. */
@Keep
data class AccountDto(
    val id: Long,
    val label: String,
    /** Id of the account type, used to match `methods[].accountTypes`. */
    val type: String,
    /** The account type name the app uses: CASH, BANK, CCARD, ASSET, LIABILITY. */
    val typeName: String,
    val currency: String,
    val fractionDigits: Int,
    val openingBalanceMinor: Long,
    val currentBalanceMinor: Long,
    val totalMinor: Long,
    val incomeMinor: Long,
    val expensesMinor: Long,
    val excludeFromTotals: Boolean,
    val sealed: Boolean,
    val color: Int,
    val parentId: Long?,
    /** NONE, or one of CONTAINER (a portfolio), CASH, ASSET (its sub-accounts). */
    val portfolioRole: String = "NONE",
    val dynamicExchangeRates: Boolean = false,
    /**
     * Containers only: current balance plus the valuation of every child at the
     * latest stored price, in the portfolio's currency minor units (the app's
     * `BalanceType.VALUATION`). Null for every other account.
     */
    val valuationMinor: Long? = null
)

@Keep
data class PortfolioWriteDto(
    val label: String? = null,
    /** Id of the account type, from `GET /account-types`. */
    val type: String? = null,
    /** The portfolio's fiat currency; asset sub-accounts use the asset symbol. */
    val currency: String? = null,
    val color: Int? = null,
    val dynamicExchangeRates: Boolean? = null,
    /**
     * Price of one major unit of the currency in home currency major units.
     * Required when [dynamicExchangeRates] is false and the currency differs
     * from the home one.
     */
    val exchangeRate: Double? = null
)

@Keep
data class AssetDto(
    val id: Long,
    val label: String,
    /** Asset symbol; the "currency" code of the asset sub-account. */
    val symbol: String,
    val fractionDigits: Int,
    /** Quantity in asset minor units: the sub-account balance. */
    val quantityMinor: Long,
    /**
     * Latest price in raw form: portfolio minor units per asset minor unit.
     * Null when no price is stored; the valuation then falls back to an
     * exchange rate of 1.0, like the app's `FullAccount.enrich`.
     */
    val priceMinor: Double?,
    val valuationMinor: Long
)

@Keep
data class PortfolioAssetsDto(
    val portfolioId: Long,
    val label: String,
    val currency: String,
    val fractionDigits: Int,
    val cashAccountId: Long?,
    /** Balance of the cash sub-account, in portfolio minor units. */
    val cashMinor: Long,
    /** Container balance + cash + every asset valuation. */
    val valuationMinor: Long,
    val assets: List<AssetDto>
)

@Keep
data class TradeDto(
    val id: Long,
    /** BUY, SELL, DEPOSIT, WITHDRAW, TRANSFER_IN or TRANSFER_OUT. */
    val type: String,
    val accountId: Long,
    val currency: String,
    val date: String,
    val time: String?,
    val comment: String,
    /** Asset symbol; the portfolio's currency for deposits and withdrawals. */
    val assetSymbol: String,
    /** Fraction digits of the asset currency. */
    val fractionDigits: Int,
    val quantityMinor: Long,
    /**
     * Price of one major asset unit in major portfolio units as a decimal
     * string, or null when the quantity is zero.
     */
    val price: String?,
    val principalMinor: Long,
    /** Sum of the additional cost parts, null when the trade has none. */
    val feeMinor: Long?,
    val peerAccountId: Long?,
    val peerAccountLabel: String?
)

/** Account type as the app knows it. `name` is CASH, BANK, ... without underscores. */
@Keep
data class AccountTypeDto(
    val id: Long,
    val name: String,
    val isAsset: Boolean,
    val supportsReconciliation: Boolean
)

@Keep
data class AccountWriteDto(
    val label: String? = null,
    /** Id of the account type, from `GET /account-types`. */
    val type: String? = null,
    val currency: String? = null,
    val openingBalanceMinor: Long? = null,
    val excludeFromTotals: Boolean? = null,
    val color: Int? = null,
    val parentId: Long? = null
)

@Keep
data class EntityRef(
    val id: Long,
    val label: String
)

@Keep
data class CategoryRef(
    val id: Long,
    val label: String,
    val path: String?
)

@Keep
data class CategoryDto(
    val id: Long,
    val parentId: Long?,
    val label: String,
    val level: Int,
    val color: Int?,
    val type: Int?
)

@Keep
data class PayeeDto(
    val id: Long,
    val name: String
)

@Keep
data class TagDto(
    val id: Long,
    val label: String,
    val color: Int?
)

@Keep
data class MethodDto(
    val id: Long,
    val label: String,
    val isNumbered: Boolean,
    val type: Int,
    val accountTypes: List<String>
)

@Keep
data class TransactionDto(
    val id: Long,
    val kind: String,
    val accountId: Long,
    val amountMinor: Long,
    val currency: String,
    val fractionDigits: Int,
    val date: String,
    val time: String?,
    val valueDate: String,
    val payee: EntityRef?,
    val category: CategoryRef?,
    val tags: List<EntityRef>,
    val comment: String,
    val method: EntityRef?,
    val referenceNumber: String?,
    val crStatus: String,
    val transferPeerId: Long?,
    val transferAccountId: Long? = null,
    val splitParts: List<SplitPartDto>? = null
)

@Keep
data class SplitPartDto(
    val id: Long,
    val amountMinor: Long,
    val payee: EntityRef?,
    val category: CategoryRef?,
    val tags: List<EntityRef>,
    val comment: String,
    val method: EntityRef?,
    val referenceNumber: String?,
    val transferPeerId: Long?,
    val transferAccountId: Long? = null
)

@Keep
data class TransactionWriteDto(
    val accountId: Long? = null,
    val amountMinor: Long? = null,
    val date: String? = null,
    val time: String? = null,
    val valueDate: String? = null,
    val payeeId: Long? = null,
    val categoryId: Long? = null,
    val tagIds: List<Long>? = null,
    val comment: String? = null,
    val methodId: Long? = null,
    val referenceNumber: String? = null
)

@Keep
data class TransferWriteDto(
    val fromAccountId: Long? = null,
    val toAccountId: Long? = null,
    val amountMinor: Long? = null,
    val date: String? = null,
    val time: String? = null,
    val valueDate: String? = null,
    val payeeId: Long? = null,
    val comment: String? = null,
    val methodId: Long? = null,
    val referenceNumber: String? = null,
    val tagIds: List<Long>? = null
)

@Keep
data class SplitWriteDto(
    val accountId: Long? = null,
    val amountMinor: Long? = null,
    val date: String? = null,
    val time: String? = null,
    val valueDate: String? = null,
    val payeeId: Long? = null,
    val comment: String? = null,
    val methodId: Long? = null,
    val referenceNumber: String? = null,
    val tagIds: List<Long>? = null,
    val parts: List<SplitPartWriteDto>? = null
)

@Keep
data class SplitPartWriteDto(
    val id: Long? = null,
    val amountMinor: Long? = null,
    val categoryId: Long? = null,
    val payeeId: Long? = null,
    val tagIds: List<Long>? = null,
    val comment: String? = null,
    val methodId: Long? = null,
    val referenceNumber: String? = null
)

@Keep
data class PageDto<T>(
    val items: List<T>,
    val total: Long,
    val limit: Int,
    val offset: Int
)

@Keep
data class GroupDto(
    val year: Int,
    val second: Int,
    val incomeMinor: Long,
    val expensesMinor: Long,
    val transfersMinor: Long,
    /**
     * Date of the first transaction of the period. Groups are ordered, so a client
     * can assign each row to the last group whose [firstDate] is not after it,
     * without recomputing month or week starts.
     */
    val firstDate: String? = null
)

@Keep
data class FileDto(
    val name: String,
    val size: Long,
    val modified: Long,
    val link: String
)

@Keep
data class BudgetDto(
    val id: Long,
    val accountId: Long,
    val title: String,
    val description: String?,
    val currency: String,
    val fractionDigits: Int,
    val grouping: String,
    val color: Int,
    val start: String?,
    val end: String?,
    val accountName: String?,
    val isDefault: Boolean,
    val uuid: String?,
    val allocationMinor: Long?,
    val criteria: BudgetCriteriaDto? = null,
    /**
     * True when the filter stored by the app cannot be expressed with
     * [BudgetCriteriaDto] (composite criteria, or a dimension the web does not
     * offer). Clients must not save over it.
     */
    val criteriaUnsupported: Boolean = false
)

/** Categories, payees, methods, tags and states a budget is limited to. */
@Keep
data class BudgetCriteriaDto(
    val categoryIds: List<Long> = emptyList(),
    val payeeIds: List<Long> = emptyList(),
    val methodIds: List<Long> = emptyList(),
    val tagIds: List<Long> = emptyList(),
    val statuses: List<String> = emptyList()
)

@Keep
data class BudgetProgressDto(
    val budgetId: Long,
    val accountId: Long,
    val title: String,
    val currency: String,
    val fractionDigits: Int,
    val grouping: String,
    val periodYear: Int?,
    val periodSecond: Int?,
    val periodStart: String,
    val periodEnd: String,
    val periodDescription: String,
    val allocatedMinor: Long,
    val spentMinor: Long,
    val remainingMinor: Long,
    val totalDays: Long,
    val currentDay: Long,
    val periodAllocationMinor: Long? = null
)

@Keep
data class BudgetBreakdownDto(
    val budgetId: Long,
    val accountId: Long,
    val title: String,
    val currency: String,
    val fractionDigits: Int,
    val grouping: String,
    val periodYear: Int?,
    val periodSecond: Int?,
    val periodDescription: String,
    val periodStart: String,
    val periodEnd: String,
    val totalAllocatedMinor: Long,
    val totalSpentMinor: Long,
    val categories: List<BudgetBreakdownCategoryDto>
)

@Keep
data class BudgetBreakdownCategoryDto(
    val categoryId: Long,
    val label: String?,
    val level: Int,
    val parentId: Long?,
    val allocatedMinor: Long,
    val spentMinor: Long,
    val rolloverPreviousMinor: Long,
    val rolloverNextMinor: Long
)

@Keep
data class BudgetWriteDto(
    val accountId: Long? = null,
    val title: String? = null,
    val description: String? = null,
    val grouping: String? = null,
    val start: String? = null,
    val end: String? = null,
    val isDefault: Boolean? = null,
    val amountMinor: Long? = null,
    /**
     * Omitted: the stored filter is kept. An empty object clears it.
     */
    val criteria: BudgetCriteriaDto? = null
)

@Keep
data class ReportSummaryDto(
    val accountId: Long,
    val from: String,
    val to: String,
    val currency: String,
    val fractionDigits: Int,
    val incomeMinor: Long,
    val expensesMinor: Long,
    val netMinor: Long,
    val count: Long
)

@Keep
data class BreakdownItemDto(
    val id: Long,
    val label: String,
    val amountMinor: Long,
    val count: Long,
    val share: Double
)

@Keep
data class BreakdownDto(
    val accountId: Long,
    val from: String,
    val to: String,
    val by: String,
    val type: String,
    val currency: String,
    val fractionDigits: Int,
    val totalMinor: Long,
    val items: List<BreakdownItemDto>
)

@Keep
data class SessionLoginDto(
    val password: String? = null
)

@Keep
data class BudgetAllocationDto(
    val categoryId: Long,
    val label: String,
    val level: Int,
    val parentId: Long?,
    val allocatedMinor: Long,
    val spentMinor: Long,
    val rolloverPreviousMinor: Long = 0,
    val rolloverNextMinor: Long = 0
)

@Keep
data class BudgetAllocationWriteDto(
    val categoryId: Long? = null,
    val amountMinor: Long? = null,
    val oneTime: Boolean? = null
)

@Keep
data class BudgetAllocationsWriteDto(
    val year: Int? = null,
    val second: Int? = null,
    val allocations: List<BudgetAllocationWriteDto>? = null,
    val rollover: List<BudgetAllocationWriteDto>? = null
)

@Keep
data class BudgetHistoryPointDto(
    val periodYear: Int?,
    val periodSecond: Int?,
    val periodDescription: String,
    val allocatedMinor: Long,
    val spentMinor: Long,
    val remainingMinor: Long
)

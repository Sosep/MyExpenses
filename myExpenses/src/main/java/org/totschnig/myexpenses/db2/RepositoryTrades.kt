package org.totschnig.myexpenses.db2

import android.content.ContentValues
import java.math.BigDecimal
import org.totschnig.myexpenses.R
import org.totschnig.myexpenses.db2.entities.Transaction
import org.totschnig.myexpenses.model.AccountType
import org.totschnig.myexpenses.model.CurrencyUnit
import org.totschnig.myexpenses.model.Money
import org.totschnig.myexpenses.model.generateUuid
import org.totschnig.myexpenses.model2.Account as AccountModel
import org.totschnig.myexpenses.preference.PrefKey
import org.totschnig.myexpenses.provider.KEY_UUID
import org.totschnig.myexpenses.provider.PORTFOLIO_ASSET
import org.totschnig.myexpenses.provider.PORTFOLIO_CASH
import org.totschnig.myexpenses.provider.SPLIT_CATID
import org.totschnig.myexpenses.provider.TransactionProvider
import org.totschnig.myexpenses.provider.TransactionProvider.TRANSACTIONS_URI
import org.totschnig.myexpenses.provider.TransactionProvider.URI_SEGMENT_LINK_TRANSFER
import org.totschnig.myexpenses.retrofit.ExchangeRateSource
import org.totschnig.myexpenses.util.toEpoch
import org.totschnig.myexpenses.viewmodel.data.FullAccount
import org.totschnig.myexpenses.viewmodel.data.FundingSource
import org.totschnig.myexpenses.viewmodel.data.TradeIntent
import org.totschnig.myexpenses.viewmodel.data.TradeType
import org.totschnig.myexpenses.viewmodel.data.TransactionEditData
import org.totschnig.myexpenses.viewmodel.data.TransferEditData
import org.totschnig.myexpenses.viewmodel.data.mapper.TransactionMapper.mapTransaction

/**
 * Persistence of portfolio operations. This is the domain the Android trade
 * screens use too: the web API only maps a [TradeIntent] onto it, so a trade
 * created from the browser is stored exactly like one created in the app.
 *
 * A trade is a split of the portfolio container whose parts are transfers
 * towards the asset (or cash) sub-account and towards the funding source; a
 * transfer between portfolios writes both containers' splits with a linked
 * hub-to-hub leg.
 */
fun Repository.saveTrades(
    currentAccount: FullAccount,
    intents: List<TradeIntent>,
    onProgress: (Int) -> Unit = {}
): List<Long> {
    bulkStart()
    try {
        val knownSubaccounts = loadSubAccounts(currentAccount.id).map {
            FullAccount(
                id = it.id,
                label = it.label,
                currencyUnit = currencyContext[it.currency],
                type = it.type!!,
                portfolioRole = it.portfolioRole,
                parentId = it.parentId
            )
        }.toMutableList()
        return intents.mapIndexed { index, intent ->
            val id = saveTradeInternal(currentAccount, intent, knownSubaccounts)
            onProgress(index + 1)
            id
        }
    } finally {
        bulkEnd()
    }
}

fun Repository.saveTrade(currentAccount: FullAccount, intent: TradeIntent): Long =
    saveTrades(currentAccount, listOf(intent)).first()

private fun Repository.saveTradeInternal(
    currentAccount: FullAccount,
    intent: TradeIntent,
    knownSubaccounts: MutableList<FullAccount>
): Long {
    if (intent.type is TradeType.Transfer) {
        return saveAssetTransfer(currentAccount, intent, knownSubaccounts)
    }
    val isAssetTrade = intent.type is TradeType.AssetTrade
    val portfolioCurrency = currentAccount.currencyUnit
    val transferCategory = prefHandler.defaultTransferCategory

    val targetAccountId = if (isAssetTrade) {
        findOrCreateAssetAccount(
            currentAccount.id,
            intent.targetAsset,
            knownSubaccounts
        )
    } else {
        findOrCreateCashAccount(
            currentAccount.id,
            currentAccount.currency,
            currentAccount.color,
            knownSubaccounts
        )
    }

    val principalAmount = intent.principal
    val totalImpact = if (intent.type.isIncoming) {
        principalAmount + intent.fee
    } else {
        principalAmount - intent.fee
    }

    val parts = mutableListOf<TransactionEditData>()

    // Part A: Target Leg (Portfolio <-> Asset/Cash sub-account)
    val targetLegHubAmount = if (intent.type.isIncoming) {
        -principalAmount
    } else {
        principalAmount
    }
    val targetLegSubAmount = if (intent.type.isIncoming) {
        intent.quantity
    } else {
        -intent.quantity
    }

    parts.add(
        TransactionEditData(
            accountId = currentAccount.id,
            amount = targetLegHubAmount,
            transferEditData = TransferEditData(
                transferAccountId = targetAccountId,
                transferAmount = targetLegSubAmount
            ),
            isSplitPart = true,
            uuid = generateUuid(),
            categoryId = transferCategory
        )
    )

    // Part B: Funding/Source Leg (Portfolio <-> Cash Sub-account or External Account)
    val fundingLegHubAmount = if (intent.type.isIncoming) {
        totalImpact
    } else {
        -totalImpact
    }

    val fundingTransferAccountId =
        if (intent.linkedTransactionId != null) {
            null
        } else {
            when (intent.fundingSource) {
                FundingSource.ACCOUNT ->
                    intent.peerAccountId

                FundingSource.PORTFOLIO ->
                    findOrCreateCashAccount(
                        currentAccount.id,
                        currentAccount.currency,
                        currentAccount.color,
                        knownSubaccounts
                    )

                FundingSource.EXTERNAL -> null
            }
        }

    val fundingLegUuid = generateUuid()
    parts.add(
        TransactionEditData(
            accountId = currentAccount.id,
            amount = fundingLegHubAmount,
            transferEditData = fundingTransferAccountId?.let {
                TransferEditData(
                    transferAccountId = it
                )
            },
            isSplitPart = true,
            uuid = fundingLegUuid,
            categoryId = if (intent.linkedTransactionId != null) null else transferCategory
        )
    )

    // Part C: Additional Costs / Fees / Taxes (Expenses)
    val validCosts = intent.additionalCosts.filter { it.amount.amountMinor != 0L }
    for ((amount, category) in validCosts) {
        parts.add(
            TransactionEditData(
                accountId = currentAccount.id,
                amount = -amount,
                isSplitPart = true,
                uuid = generateUuid(),
                categoryId = category?.id
            )
        )
    }

    val categoryIdsToSave = validCosts.mapNotNull { it.category?.id }
    prefHandler.putString(PrefKey.LAST_TRADE_FEE_CATEGORIES, categoryIdsToSave.joinToString(","))

    // Parent transaction amount is the sum of all parts in Portfolio currency
    val totalPortfolioAmount = parts
        .fold(Money(portfolioCurrency, 0L)) { acc, part -> acc + part.amount }

    val parent = TransactionEditData(
        id = intent.tradeId ?: 0L,
        accountId = currentAccount.id,
        amount = totalPortfolioAmount,
        date = intent.date,
        comment = intent.comment,
        uuid = generateUuid(),
        categoryId = SPLIT_CATID,
        splitParts = parts
    )

    val parentId = if (intent.tradeId != null) {
        updateTransaction(mapTransaction(parent))
        intent.tradeId
    } else {
        createTransaction(mapTransaction(parent)).data.id
    }

    if (intent.linkedTransactionId != null) {
        val existingUuid = getUuidForTransaction(intent.linkedTransactionId)
        if (existingUuid != null) {
            contentResolver.update(
                TRANSACTIONS_URI.buildUpon()
                    .appendPath(URI_SEGMENT_LINK_TRANSFER)
                    .appendPath(fundingLegUuid)
                    .build(),
                ContentValues(1).apply {
                    put(KEY_UUID, existingUuid)
                },
                null,
                null
            )
        }
    }

    // Also update the Price History table for valuation
    if (intent.price > BigDecimal.ZERO) {
        savePrice(
            portfolioCurrency,
            intent.targetAsset,
            intent.date.toLocalDate(),
            ExchangeRateSource.User,
            intent.price
        )
    }
    return parentId
}

private fun Repository.findOrCreateAssetAccount(
    portfolioId: Long,
    asset: CurrencyUnit,
    knownSubaccounts: MutableList<FullAccount>
): Long = knownSubaccounts.find { it.currency == asset.code && it.parentId == portfolioId }?.id
    ?: run {
        val account = AccountModel(
            label = asset.description,
            currency = asset.code,
            parentId = portfolioId,
            type = findAccountType(AccountType.INVESTMENT.name)!!,
            portfolioRole = PORTFOLIO_ASSET,
            dynamicExchangeRates = true
        )
        val newAccount = createAccount(account)
        val fullAccount = FullAccount(
            id = newAccount.id,
            label = newAccount.label,
            currencyUnit = currencyContext[newAccount.currency],
            type = AccountType.INVESTMENT,
            portfolioRole = PORTFOLIO_ASSET,
            parentId = portfolioId
        )
        knownSubaccounts.add(fullAccount)
        newAccount.id
    }

private fun Repository.findOrCreateCashAccount(
    portfolioId: Long,
    portfolioCurrency: String,
    portfolioColor: Int,
    knownSubaccounts: MutableList<FullAccount>
): Long = knownSubaccounts.find { it.type.isCashAccount && it.parentId == portfolioId }?.id
    ?: run {
        val cashAccount = AccountModel(
            label = context.getString(R.string.account_type_cash),
            currency = portfolioCurrency,
            parentId = portfolioId,
            type = findAccountType(AccountType.CASH.name)!!,
            color = portfolioColor,
            portfolioRole = PORTFOLIO_CASH
        )
        val newAccount = createAccount(cashAccount)
        val fullAccount = FullAccount(
            id = newAccount.id,
            label = newAccount.label,
            currencyUnit = currencyContext[newAccount.currency],
            type = AccountType.CASH,
            portfolioRole = PORTFOLIO_CASH,
            parentId = portfolioId
        )
        knownSubaccounts.add(fullAccount)
        newAccount.id
    }

private fun Repository.saveAssetTransfer(
    currentPortfolio: FullAccount,
    intent: TradeIntent,
    knownSubaccounts: MutableList<FullAccount>
): Long {
    val otherPortfolioId = intent.peerAccountId ?: return 0L
    val otherPortfolio = loadAccount(otherPortfolioId) ?: return 0L

    val isIncoming = intent.type.isIncoming
    val (sourcePortfolio, targetPortfolio) = if (isIncoming) {
        otherPortfolio to currentPortfolio
    } else {
        currentPortfolio to otherPortfolio
    }

    val sourceCurrency = currencyContext[sourcePortfolio.currency]
    val targetCurrency = currencyContext[targetPortfolio.currency]
    val valuation = intent.principal
    val quantity = intent.quantity
    val transferCategory = prefHandler.defaultTransferCategory
    val dateEpoch = intent.date.toEpoch()

    val peerKnownSubAccounts = loadSubAccounts(otherPortfolioId).map {
        FullAccount(
            id = it.id,
            label = it.label,
            currencyUnit = currencyContext[it.currency],
            type = it.type!!,
            portfolioRole = it.portfolioRole,
            parentId = it.parentId
        )
    }
    val sourceKnownSubaccounts = if (isIncoming) {
        peerKnownSubAccounts.toMutableList()
    } else {
        knownSubaccounts
    }

    val targetKnownSubaccounts = if (isIncoming) {
        knownSubaccounts
    } else {
        peerKnownSubAccounts.toMutableList()
    }

    val sourceAssetAccountId = findOrCreateAssetAccount(
        sourcePortfolio.id,
        intent.targetAsset,
        sourceKnownSubaccounts
    )

    val targetAssetAccountId = findOrCreateAssetAccount(
        targetPortfolio.id,
        intent.targetAsset,
        targetKnownSubaccounts
    )

    val oldParent = intent.tradeId?.let { loadTransaction(it) }
    val oldSiblingParent = intent.tradeId?.let { findSiblingParentId(it) }?.let {
        loadTransaction(it)
    }

    val oldRepoTrans1 = intent.tradeId?.let { if (isIncoming) oldSiblingParent else oldParent }
    val oldRepoTrans2 = intent.tradeId?.let { if (isIncoming) oldParent else oldSiblingParent }

    val hubToHubUuid =
        oldRepoTrans1?.splitParts?.find {
            it.data.transferAccountId == targetPortfolio.id
        }?.data?.uuid
            ?: generateUuid()

    // --- Source Portfolio Split ---
    val sourceParts = mutableListOf<Pair<Transaction, Transaction?>>()
    val oldParts1 = oldRepoTrans1?.splitParts ?: emptyList()

    // Leg A1: Internal Spoke (Asset -> Hub)
    val oldA1 = oldParts1.find { it.data.transferAccountId == sourceAssetAccountId }
    val legA1Source = Transaction(
        id = oldA1?.id ?: 0L,
        accountId = sourcePortfolio.id,
        amount = Money.convertBigDecimal(valuation.amountMajor, sourceCurrency.fractionDigits),
        transferAccountId = sourceAssetAccountId,
        uuid = oldA1?.data?.uuid ?: generateUuid(),
        categoryId = transferCategory,
        date = dateEpoch,
        valueDate = dateEpoch,
        transferPeerId = oldA1?.transferPeer?.id
    )
    val legA1Peer = Transaction(
        id = oldA1?.transferPeer?.id ?: 0L,
        accountId = sourceAssetAccountId,
        amount = Money.convertBigDecimal(
            quantity.amountMajor.negate(),
            intent.targetAsset.fractionDigits
        ),
        transferAccountId = sourcePortfolio.id,
        categoryId = transferCategory,
        date = dateEpoch,
        valueDate = dateEpoch,
        uuid = legA1Source.uuid,
        currency = intent.targetAsset.code,
        transferPeerId = legA1Source.id
    )
    sourceParts.add(legA1Source to legA1Peer)

    // Leg A2: External Link (Source Hub -> Target Hub)
    val oldA2 = oldParts1.find { it.data.transferAccountId == targetPortfolio.id }
    sourceParts.add(
        Transaction(
            id = oldA2?.id ?: 0L,
            accountId = sourcePortfolio.id,
            amount = Money.convertBigDecimal(
                valuation.amountMajor.negate(),
                sourceCurrency.fractionDigits
            ),
            transferAccountId = targetPortfolio.id,
            uuid = hubToHubUuid,
            categoryId = transferCategory,
            date = dateEpoch,
            valueDate = dateEpoch,
            transferPeerId = oldA2?.transferPeer?.id
        ) to null
    )

    val parentA = Transaction(
        id = oldRepoTrans1?.id ?: 0L,
        accountId = sourcePortfolio.id,
        amount = 0L,
        date = dateEpoch,
        valueDate = dateEpoch,
        comment = intent.comment,
        uuid = oldRepoTrans1?.data?.uuid ?: generateUuid(),
        categoryId = SPLIT_CATID,
        currency = sourceCurrency.code
    )

    // --- Target Portfolio Split ---
    val targetParts = mutableListOf<Pair<Transaction, Transaction?>>()
    val oldParts2 = oldRepoTrans2?.splitParts ?: emptyList()

    // Leg B1: External Link (Source Hub -> Target Hub)
    val oldB1 = oldParts2.find { it.data.transferAccountId == sourcePortfolio.id }
    targetParts.add(
        Transaction(
            id = oldB1?.id ?: 0L,
            accountId = targetPortfolio.id,
            amount = Money.convertBigDecimal(
                valuation.amountMajor,
                targetCurrency.fractionDigits
            ),
            transferAccountId = sourcePortfolio.id,
            uuid = hubToHubUuid,
            categoryId = transferCategory,
            date = dateEpoch,
            valueDate = dateEpoch,
            transferPeerId = oldB1?.transferPeer?.id
        ) to null
    )

    // Leg B2: Internal Spoke (Hub -> Asset)
    val oldB2 = oldParts2.find { it.data.transferAccountId == targetAssetAccountId }
    val legB2Source = Transaction(
        id = oldB2?.id ?: 0L,
        accountId = targetPortfolio.id,
        amount = Money.convertBigDecimal(
            valuation.amountMajor.negate(),
            targetCurrency.fractionDigits
        ),
        transferAccountId = targetAssetAccountId,
        uuid = oldB2?.data?.uuid ?: generateUuid(),
        categoryId = transferCategory,
        date = dateEpoch,
        valueDate = dateEpoch,
        transferPeerId = oldB2?.transferPeer?.id
    )
    val legB2Peer = Transaction(
        id = oldB2?.transferPeer?.id ?: 0L,
        accountId = targetAssetAccountId,
        amount = Money.convertBigDecimal(
            quantity.amountMajor,
            intent.targetAsset.fractionDigits
        ),
        transferAccountId = targetPortfolio.id,
        categoryId = transferCategory,
        date = dateEpoch,
        valueDate = dateEpoch,
        uuid = legB2Source.uuid,
        currency = intent.targetAsset.code,
        transferPeerId = legB2Source.id
    )
    targetParts.add(legB2Source to legB2Peer)

    val parentB = Transaction(
        id = oldRepoTrans2?.id ?: 0L,
        accountId = targetPortfolio.id,
        amount = 0L,
        date = dateEpoch,
        valueDate = dateEpoch,
        comment = intent.comment,
        uuid = oldRepoTrans2?.data?.uuid ?: generateUuid(),
        categoryId = SPLIT_CATID,
        currency = targetCurrency.code
    )

    val parentId = if (intent.tradeId != null) {
        updateDualSplitTransaction(
            RepositoryTransaction(
                parentA,
                splitParts = sourceParts.map { RepositoryTransaction(it.first, it.second) }
            ),
            RepositoryTransaction(
                parentB,
                splitParts = targetParts.map { RepositoryTransaction(it.first, it.second) }
            )
        )
        intent.tradeId
    } else {
        val (createdA, createdB) = createDualSplitTransaction(
            parentA,
            sourceParts,
            parentB,
            targetParts
        )
        // The parent of the current portfolio: the target split when the trade
        // is incoming, the source split when it goes out.
        if (isIncoming) createdB.data.id else createdA.data.id
    }
    if (intent.price > BigDecimal.ZERO) {
        savePrice(
            currentPortfolio.currencyUnit,
            intent.targetAsset,
            intent.date.toLocalDate(),
            ExchangeRateSource.User,
            intent.price
        )
    }
    return parentId
}

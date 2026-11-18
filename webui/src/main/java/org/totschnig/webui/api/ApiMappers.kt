package org.totschnig.webui.api

import org.totschnig.myexpenses.db2.RepositoryTransaction
import org.totschnig.myexpenses.db2.entities.Transaction
import org.totschnig.myexpenses.model.CurrencyUnit
import org.totschnig.myexpenses.util.epoch2LocalDate
import org.totschnig.myexpenses.util.epoch2ZonedDateTime

internal fun Transaction.toApiDto(
    currencyUnit: CurrencyUnit,
    payeeMap: Map<Long, String>,
    tagMap: Map<Long, String>,
    withTime: Boolean,
    splitParts: List<RepositoryTransaction>? = null,
    methodMap: Map<Long, String> = emptyMap()
) = TransactionDto(
    id = id,
    kind = when {
        isSplit -> "SPLIT"
        isTransfer -> "TRANSFER"
        else -> "SIMPLE"
    },
    accountId = accountId,
    amountMinor = amount,
    currency = currencyUnit.code,
    fractionDigits = currencyUnit.fractionDigits,
    date = epoch2ZonedDateTime(date).toLocalDate().toString(),
    time = if (withTime) epoch2ZonedDateTime(date).toLocalTime().toString() else null,
    valueDate = epoch2LocalDate(valueDate).toString(),
    payee = payeeId?.takeIf { it > 0 }?.let { EntityRef(it, payeeMap[it] ?: payeeName.orEmpty()) },
    category = categoryRef(),
    tags = tagList.map { EntityRef(it, tagMap[it] ?: "") },
    comment = comment.orEmpty(),
    // The view stores the technical name for predefined methods (CREDITCARD);
    // the localized label lives in the methods table.
    method = methodId?.takeIf { it > 0 }?.let {
        EntityRef(it, methodMap[it] ?: methodLabel.orEmpty())
    },
    referenceNumber = referenceNumber,
    crStatus = crStatus.name,
    transferPeerId = transferPeerId,
    transferAccountId = transferAccountId,
    splitParts = splitParts?.map { it.data.toSplitPartDto(payeeMap, tagMap, methodMap) }
)

internal fun Transaction.toSplitPartDto(
    payeeMap: Map<Long, String>,
    tagMap: Map<Long, String>,
    methodMap: Map<Long, String> = emptyMap()
) = SplitPartDto(
    id = id,
    amountMinor = amount,
    payee = payeeId?.takeIf { it > 0 }?.let { EntityRef(it, payeeMap[it] ?: payeeName.orEmpty()) },
    category = categoryRef(),
    tags = tagList.map { EntityRef(it, tagMap[it] ?: "") },
    comment = comment.orEmpty(),
    method = methodId?.takeIf { it > 0 }?.let {
        EntityRef(it, methodMap[it] ?: methodLabel.orEmpty())
    },
    referenceNumber = referenceNumber,
    transferPeerId = transferPeerId,
    transferAccountId = transferAccountId
)

private fun Transaction.categoryRef(): CategoryRef? {
    val id = categoryId?.takeIf { it > 0 } ?: return null
    if (isTransfer) return null
    return CategoryRef(
        id = id,
        label = categoryPath?.substringAfterLast('>')?.trim().orEmpty(),
        path = categoryPath
    )
}

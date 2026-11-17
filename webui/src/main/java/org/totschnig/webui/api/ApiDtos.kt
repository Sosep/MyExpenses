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

@Keep
data class AccountDto(
    val id: Long,
    val label: String,
    val type: String,
    val currency: String,
    val fractionDigits: Int,
    val currentBalanceMinor: Long,
    val totalMinor: Long,
    val incomeMinor: Long,
    val expensesMinor: Long,
    val excludeFromTotals: Boolean,
    val sealed: Boolean,
    val color: Int,
    val parentId: Long?
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
    val transfersMinor: Long
)

@Keep
data class FileDto(
    val name: String,
    val size: Long,
    val modified: Long,
    val link: String
)

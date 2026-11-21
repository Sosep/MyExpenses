package org.totschnig.myexpenses.db2

import android.content.ContentUris
import android.database.Cursor
import android.content.ContentValues
import android.database.sqlite.SQLiteConstraintException
import android.os.Bundle
import androidx.annotation.VisibleForTesting
import androidx.core.database.getIntOrNull
import androidx.core.database.getLongOrNull
import org.totschnig.myexpenses.model2.Category
import org.totschnig.myexpenses.model2.CategoryExport
import org.totschnig.myexpenses.model2.CategoryInfo
import org.totschnig.myexpenses.model2.CategoryPath
import java.util.Locale
import org.totschnig.myexpenses.provider.BaseTransactionProvider
import org.totschnig.myexpenses.provider.BaseTransactionProvider.Companion.ACCOUNTS_MINIMAL_URI_WITH_AGGREGATES
import org.totschnig.myexpenses.provider.KEY_COLOR
import org.totschnig.myexpenses.provider.KEY_COUNT
import org.totschnig.myexpenses.provider.KEY_ICON
import org.totschnig.myexpenses.provider.KEY_LABEL
import org.totschnig.myexpenses.provider.KEY_MAPPED_BUDGETS
import org.totschnig.myexpenses.provider.KEY_MAPPED_TEMPLATES
import org.totschnig.myexpenses.provider.KEY_MAPPED_TRANSACTIONS
import org.totschnig.myexpenses.provider.KEY_PARENTID
import org.totschnig.myexpenses.provider.KEY_ROWID
import org.totschnig.myexpenses.provider.KEY_TYPE
import org.totschnig.myexpenses.provider.KEY_UUID
import org.totschnig.myexpenses.provider.SPLIT_CATID
import org.totschnig.myexpenses.provider.TABLE_BUDGETS
import org.totschnig.myexpenses.provider.TransactionProvider
import org.totschnig.myexpenses.provider.TransactionProvider.BUDGETS_URI
import org.totschnig.myexpenses.provider.TransactionProvider.DUAL_URI
import org.totschnig.myexpenses.provider.TransactionProvider.KEY_CATEGORY
import org.totschnig.myexpenses.provider.TransactionProvider.KEY_CATEGORY_EXPORT
import org.totschnig.myexpenses.provider.TransactionProvider.KEY_CATEGORY_INFO
import org.totschnig.myexpenses.provider.TransactionProvider.KEY_MERGE_SOURCE
import org.totschnig.myexpenses.provider.TransactionProvider.KEY_MERGE_TARGET
import org.totschnig.myexpenses.provider.TransactionProvider.KEY_RESULT
import org.totschnig.myexpenses.provider.TransactionProvider.METHOD_ENSURE_CATEGORY
import org.totschnig.myexpenses.provider.TransactionProvider.METHOD_ENSURE_CATEGORY_TREE
import org.totschnig.myexpenses.provider.TransactionProvider.METHOD_MERGE_CATEGORIES
import org.totschnig.myexpenses.provider.TransactionProvider.METHOD_SAVE_CATEGORY
import org.totschnig.myexpenses.provider.TransactionProvider.QUERY_PARAMETER_MAPPED_OBJECTS
import org.totschnig.myexpenses.provider.asSequence
import org.totschnig.myexpenses.provider.filter.AndCriterion
import org.totschnig.myexpenses.provider.filter.CategoryCriterion
import org.totschnig.myexpenses.provider.filter.Criterion
import org.totschnig.myexpenses.provider.filter.FilterPersistence
import org.totschnig.myexpenses.provider.filter.NotCriterion
import org.totschnig.myexpenses.provider.filter.OrCriterion
import org.totschnig.myexpenses.provider.getLong
import org.totschnig.myexpenses.provider.getString
import org.totschnig.myexpenses.util.replace
import kotlin.experimental.or

const val FLAG_TRANSFER: Byte = 0
const val FLAG_EXPENSE: Byte = 1
const val FLAG_INCOME: Byte = 2
val FLAG_NEUTRAL = FLAG_EXPENSE or FLAG_INCOME

const val DEFAULT_CATEGORY_PATH_SEPARATOR = " > "

val Boolean.asCategoryType: Byte
    get() = if (this) FLAG_INCOME else FLAG_EXPENSE

fun Repository.saveCategory(category: Category): Long? {
    val result = contentResolver.call(DUAL_URI, METHOD_SAVE_CATEGORY, null, Bundle().apply {
        putParcelable(KEY_CATEGORY, category)
    })!!
    return if (result.containsKey(KEY_ROWID)) result.getLong(KEY_ROWID) else null
}

fun Repository.moveCategory(source: Long, target: Long?) = try {
    contentResolver.update(
        TransactionProvider.CATEGORIES_URI.buildUpon().appendPath(source.toString())
            .build(),
        ContentValues().apply {
            put(KEY_PARENTID, target)
        },
        null,
        null
    ) > 0
} catch (_: SQLiteConstraintException) {
    false
}

fun Repository.mergeCategories(source: List<Long>, target: Long) {
    contentResolver.call(DUAL_URI, METHOD_MERGE_CATEGORIES, null, Bundle().apply {
        putLongArray(KEY_MERGE_SOURCE, source.toLongArray())
        putLong(KEY_MERGE_TARGET, target)
    })
}

fun Repository.deleteCategory(id: Long) = contentResolver.delete(
    ContentUris.withAppendedId(TransactionProvider.CATEGORIES_URI, id),
    null,
    null
) > 0

fun Repository.updateCategoryColor(id: Long, color: Int?) = contentResolver.update(
    ContentUris.withAppendedId(TransactionProvider.CATEGORIES_URI, id),
    ContentValues().apply {
        put(KEY_COLOR, color)
    }, null, null
) == 1

/**
 * Looks for a cat with a label under a given parent
 *
 * @return id or -1 if not found
 */
fun Repository.findCategory(label: String, parentId: Long? = null): Long {
    val stripped = label.trim()
    val (parentSelection, parentSelectionArgs) = if (parentId == null) {
        "$KEY_PARENTID is null" to emptyArray()
    } else {
        "$KEY_PARENTID = ?" to arrayOf(parentId.toString())
    }
    return contentResolver.query(
        TransactionProvider.CATEGORIES_URI,
        arrayOf(KEY_ROWID),
        "$KEY_LABEL = ? AND $parentSelection",
        arrayOf(stripped) + parentSelectionArgs,
        null
    )?.use {
        if (it.count == 0) -1 else {
            it.moveToFirst()
            it.getLong(0)
        }
    } ?: -1
}

fun Repository.ensureCategoryTree(categoryExport: CategoryExport): Int {
    return contentResolver.call(DUAL_URI, METHOD_ENSURE_CATEGORY_TREE, null, Bundle().apply {
        putParcelable(KEY_CATEGORY_EXPORT, categoryExport)
    })!!.getInt(KEY_COUNT)
}

fun Repository.ensureCategory(categoryInfo: CategoryInfo, parentId: Long?) =
    contentResolver.call(DUAL_URI, METHOD_ENSURE_CATEGORY, null, Bundle().apply {
        putParcelable(KEY_CATEGORY_INFO, categoryInfo)
        parentId?.let { putLong(KEY_PARENTID, it) }
    })!!.getSerializable(KEY_RESULT) as Pair<Long, Boolean>

fun Repository.getCategoryPath(id: Long) = contentResolver.query(
    ContentUris.withAppendedId(BaseTransactionProvider.CATEGORY_TREE_URI, id),
    null, null, null, null
)?.use { cursor ->
    cursor
        .takeIf { it.count > 0 }
        ?.asSequence
        ?.map { it.getString(KEY_LABEL) }
        ?.toList()
        ?.asReversed()
        ?.joinToString(DEFAULT_CATEGORY_PATH_SEPARATOR)
}

fun Repository.getCategoryInfoList(id: Long): CategoryPath? = contentResolver.query(
    ContentUris.withAppendedId(BaseTransactionProvider.CATEGORY_TREE_URI, id),
    null, null, null, null
)?.use { cursor -> CategoryInfo.fromCursor(cursor) }

fun Repository.ensureCategoryPath(categoryPath: CategoryPath) =
    categoryPath.fold(null) { parentId: Long?, categoryInfo: CategoryInfo ->
        ensureCategory(categoryInfo, parentId).first
}

@VisibleForTesting
fun Repository.loadCategory(id: Long): Category? = contentResolver.query(
    TransactionProvider.CATEGORIES_URI,
    arrayOf(
        KEY_PARENTID,
        KEY_LABEL,
        KEY_COLOR,
        KEY_ICON,
        KEY_UUID,
        KEY_TYPE
    ),
    "$KEY_ROWID = ?",
    arrayOf(id.toString()),
    null
)?.use {
    if (it.moveToFirst())
        Category(
            id = id,
            parentId = it.getLongOrNull(0),
            label = it.getString(1),
            color = it.getIntOrNull(2),
            icon = it.getString(3),
            uuid = it.getString(4),
            type = it.getInt(5).toByte()
        ) else null
}

@VisibleForTesting
fun Repository.deleteAllCategories() {
    contentResolver.delete(
        TransactionProvider.CATEGORIES_URI,
        "$KEY_ROWID != $SPLIT_CATID",
        null
    )
}

/** Rows that reference a category branch, mirroring the app's mapped query. */
data class CategoryUsage(
    val transactions: Long = 0,
    val templates: Long = 0,
    val budgets: Long = 0
) {
    val isUsed: Boolean
        get() = transactions > 0 || templates > 0 || budgets > 0
}

fun Repository.categoryUsage(categoryIds: List<Long>): CategoryUsage {
    val ids = categoryIds.distinct()
    if (ids.isEmpty()) return CategoryUsage()
    val uri = TransactionProvider.CATEGORIES_URI.buildUpon()
        .appendQueryParameter(QUERY_PARAMETER_MAPPED_OBJECTS, "2")
        .build()
    return contentResolver.query(
        uri,
        arrayOf(KEY_MAPPED_TRANSACTIONS, KEY_MAPPED_TEMPLATES, KEY_MAPPED_BUDGETS),
        "$KEY_ROWID IN (${ids.joinToString(",") { "?" }})",
        ids.map { it.toString() }.toTypedArray(),
        null
    )?.use { cursor ->
        if (cursor.moveToFirst()) {
            CategoryUsage(
                transactions = cursor.getLong(0),
                templates = cursor.getLong(1),
                budgets = cursor.getLong(2)
            )
        } else {
            CategoryUsage()
        }
    } ?: CategoryUsage()
}

/**
 * Moves the branch to the target like the app's ManageCategories merge: the
 * provider rewrites transactions (including split parts), templates, the sync
 * change log and budget allocations, and the account/budget filters kept in
 * preferences follow the same ids.
 */
suspend fun Repository.mergeCategoriesAndUpdateFilters(source: List<Long>, target: Long) {
    mergeCategories(source, target)
    updateCategoryFilters(source.toSet(), target)
    updateCategoryBudgets(source.toSet(), target)
}

private suspend fun Repository.updateCategoryFilters(old: Set<Long>, new: Long) {
    contentResolver.query(
        ACCOUNTS_MINIMAL_URI_WITH_AGGREGATES,
        null,
        null,
        null,
        null
    )?.use { cursor ->
        // Keep in sync with MyExpensesViewModel.prefNameForCriteria.
        updateFilterHelper(old, new, cursor) { accountId -> "filter_$accountId" }
    }
}

private suspend fun Repository.updateCategoryBudgets(old: Set<Long>, new: Long) {
    contentResolver.query(
        BUDGETS_URI,
        arrayOf("$TABLE_BUDGETS.$KEY_ROWID"),
        null,
        null,
        null
    )?.use { cursor ->
        // Keep in sync with BudgetViewModel.prefNameForCriteria.
        updateFilterHelper(old, new, cursor) { budgetId ->
            "budgetFilter_%d".format(Locale.ROOT, budgetId)
        }
    }
}

private suspend fun Repository.updateFilterHelper(
    old: Set<Long>,
    new: Long,
    cursor: Cursor,
    prefName: (Long) -> String
) {
    cursor.moveToFirst()
    while (!cursor.isAfterLast) {
        val id = cursor.getLong(KEY_ROWID)
        val persistence = FilterPersistence(dataStore, prefName(id))
        persistence.getValue()?.let { criterion ->
            val updated = updateCriterion(criterion, old, new)
            if (updated != criterion) persistence.persist(updated)
        }
        cursor.moveToNext()
    }
}

private fun Repository.updateCriterion(
    criterion: Criterion,
    old: Set<Long>,
    new: Long
): Criterion = when (criterion) {
    is CategoryCriterion -> {
        val oldSet = criterion.values.toSet()
        val newSet: Set<Long> = oldSet.replace(old, new)
        if (oldSet != newSet) {
            val labels = mutableListOf<String>()
            contentResolver.query(
                TransactionProvider.CATEGORIES_URI,
                arrayOf(KEY_LABEL),
                "$KEY_ROWID IN (${newSet.joinToString()})",
                null,
                null
            )?.use {
                it.moveToFirst()
                while (!it.isAfterLast) {
                    labels.add(it.getString(0))
                    it.moveToNext()
                }
            }
            CategoryCriterion(labels.joinToString(","), *newSet.toLongArray())
        } else {
            criterion
        }
    }

    is NotCriterion -> NotCriterion(updateCriterion(criterion.criterion, old, new))

    is AndCriterion -> AndCriterion(criterion.criteria.map {
        updateCriterion(it, old, new)
    }.toSet())

    is OrCriterion -> OrCriterion(criterion.criteria.map {
        updateCriterion(it, old, new)
    }.toSet())

    else -> criterion
}

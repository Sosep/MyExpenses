package org.totschnig.myexpenses.provider

import org.totschnig.myexpenses.provider.DatabaseConstants.WHERE_NOT_SPLIT
import org.totschnig.myexpenses.provider.DatabaseConstants.WHERE_NOT_SPLIT_PART

/**
 * Determines how split transactions are represented when transactions are aggregated into
 * income / expenses / transfers.
 *
 * A split transaction is stored as a parent row (pseudo category [SPLIT_CATID], amount is the total)
 * plus one row per part (parent_id set, amount and category of the part).
 */
enum class SplitStrategy {
    /** Legacy behaviour: aggregate the parts, the parent row is ignored. */
    PARTS,

    /** Aggregate the parent row once with its total. */
    TOTAL;

    /**
     * Restricts the rows that take part in an income / expenses / transfers aggregation.
     */
    val rowClause: String
        get() = when (this) {
            PARTS -> WHERE_NOT_SPLIT
            TOTAL -> WHERE_NOT_SPLIT_PART
        }
}

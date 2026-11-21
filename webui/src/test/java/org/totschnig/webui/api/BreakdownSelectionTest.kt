package org.totschnig.webui.api

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.totschnig.myexpenses.provider.KEY_AMOUNT
import org.totschnig.myexpenses.provider.KEY_CATID
import org.totschnig.myexpenses.provider.KEY_PARENTID
import org.totschnig.myexpenses.provider.SPLIT_CATID

class BreakdownSelectionTest {
    @Test
    fun `an expense breakdown keeps refunds on expense categories`() {
        val clause = breakdownAmountClause("expense", setOf(5, 1)) ?: error("missing clause")
        assertTrue(clause.contains("$KEY_AMOUNT < 0"))
        assertTrue(clause.contains("$KEY_AMOUNT > 0"))
        assertTrue(clause.contains("$KEY_CATID IN (1,5)"))
    }

    @Test
    fun `an income breakdown excludes refunds on expense categories`() {
        val clause = breakdownAmountClause("income", setOf(2)) ?: error("missing clause")
        assertTrue(clause.contains("$KEY_AMOUNT > 0"))
        assertTrue(clause.contains("$KEY_CATID IS NULL"))
        assertTrue(clause.contains("$KEY_CATID NOT IN (2)"))
        assertFalse(clause.contains("$KEY_AMOUNT < 0"))
    }

    @Test
    fun `without expense categories the sign filter is unchanged`() {
        assertTrue(breakdownAmountClause("expense", emptySet())!!.contains("$KEY_AMOUNT < 0"))
        assertTrue(breakdownAmountClause("income", emptySet())!!.contains("$KEY_AMOUNT > 0"))
    }

    @Test
    fun `the summary counts parts and skips the split parent`() {
        val clause = partsOnlyClause("extended")
        assertTrue(clause.contains("extended.$KEY_PARENTID IS NOT NULL"))
        assertTrue(clause.contains("extended.$KEY_CATID IS NOT $SPLIT_CATID"))
    }
}

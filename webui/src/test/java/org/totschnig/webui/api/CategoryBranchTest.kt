package org.totschnig.webui.api

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The web filter means the branch, like the Android `CategoryCriterion`. The
 * walk is pure, so it is tested here instead of through the provider.
 */
class CategoryBranchTest {

    private val parentById = mapOf(
        1L to null,
        2L to 1L,
        3L to 2L,
        4L to 1L,
        5L to null,
        6L to 5L
    )

    @Test
    fun `a root brings its whole subtree`() {
        assertEquals(
            listOf(1L, 2L, 4L, 3L),
            categoryBranchIds(listOf(1L), parentById)
        )
    }

    @Test
    fun `a child does not bring its parent nor its siblings`() {
        assertEquals(
            listOf(2L, 3L),
            categoryBranchIds(listOf(2L), parentById)
        )
    }

    @Test
    fun `a leaf is only itself`() {
        assertEquals(listOf(3L), categoryBranchIds(listOf(3L), parentById))
    }

    @Test
    fun `two branches are united without duplicates`() {
        assertEquals(
            listOf(1L, 5L, 2L, 4L, 6L, 3L),
            categoryBranchIds(listOf(1L, 5L, 2L), parentById)
        )
    }

    @Test
    fun `an unknown id is kept`() {
        assertEquals(listOf(99L), categoryBranchIds(listOf(99L), parentById))
    }

    @Test
    fun `an empty selection asks for no category`() {
        assertEquals(emptyList<Long>(), categoryBranchIds(emptyList(), parentById))
        assertEquals(emptyList<Long>(), categoryBranchIds(emptyList(), emptyMap()))
    }

    @Test
    fun `an empty tree keeps the selection`() {
        assertEquals(listOf(7L, 8L), categoryBranchIds(listOf(7L, 8L), emptyMap()))
    }
}

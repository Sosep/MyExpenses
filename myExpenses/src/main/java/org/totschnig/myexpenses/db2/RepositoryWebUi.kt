package org.totschnig.myexpenses.db2

import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.first

private val WEB_UI_PREFERENCES = stringPreferencesKey("webuiPreferences")

/**
 * The web UI preferences are stored as one JSON document in DataStore, like the
 * filter of a budget. The HTTP adapter serializes the DTO; the persistence rule
 * lives here so the app stays the owner of its data.
 */
suspend fun Repository.webUiPreferences(): String? =
    dataStore.data.first()[WEB_UI_PREFERENCES]

/** `null` removes the document, which leaves every field unset. */
suspend fun Repository.saveWebUiPreferences(json: String?) {
    dataStore.edit { preferences ->
        if (json == null) {
            preferences.remove(WEB_UI_PREFERENCES)
        } else {
            preferences[WEB_UI_PREFERENCES] = json
        }
    }
}

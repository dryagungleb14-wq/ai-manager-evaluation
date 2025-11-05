# Revert PR #84

This commit reverts PR #84 "fix: повторное сидирование продвинутых чек-листов для multi-user"

PR #84 introduced a bug that caused issues with advanced checklists initialization for multi-user scenarios.
This revert restores the code to the state before PR #84 was merged.

## Changes
- Reverted all changes from PR #84
- Restored previous Storage class implementation
- Removed the ensureAdvancedChecklistsInitialized() call from Storage.init()

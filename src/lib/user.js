/**
 * Utility to manage unique anonymous user IDs
 */

export const getOrCreateUserId = () => {
    const STORAGE_KEY = 'kogi-quest-user-id';
    let userId = localStorage.getItem(STORAGE_KEY);

    if (!userId) {
        // Try to use crypto.randomUUID() first, fallback to a manual generator
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            userId = crypto.randomUUID();
        } else {
            userId = 'user_' + Math.random().toString(36).substring(2, 15) +
                Date.now().toString(36);
        }
        localStorage.setItem(STORAGE_KEY, userId);
    }

    return userId;
};

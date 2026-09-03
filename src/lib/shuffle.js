/**
 * Fisher-Yates on a copy. `Array.prototype.sort` with a random comparator is
 * biased and this never mutates the array passed in.
 */
export function shuffled(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

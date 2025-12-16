import { KOGI_DATA } from './src/lib/kogi_data.js';
import { KOGI_POLITICS_DATA } from './src/lib/kogi_politics_data.js';
import { KOGI_PLACES_DATA } from './src/lib/kogi_places_data.js';
import { KOGI_TRIBES_DATA } from './src/lib/kogi_tribes_data.js';

const FULL_DATA = [...KOGI_DATA, ...KOGI_POLITICS_DATA, ...KOGI_PLACES_DATA, ...KOGI_TRIBES_DATA];

const counts = {};

FULL_DATA.forEach(q => {
    const cat = q.category;
    counts[cat] = (counts[cat] || 0) + 1;
});

console.log("--- Question Counts by Category ---");
console.log(JSON.stringify(counts, null, 2));

const generalCount = FULL_DATA.filter(q => q.category === 'History' || q.category === 'Geography' || q.category === 'Tourism').length;
const igalaCount = FULL_DATA.filter(q => q.category === 'Igala').length;
const ebiraCount = FULL_DATA.filter(q => q.category === 'Ebira').length;
const okunCount = FULL_DATA.filter(q => q.category === 'Okun').length;
const politicsCount = FULL_DATA.filter(q => q.category === 'Politics').length;
const placesCount = FULL_DATA.filter(q => q.category === 'Places' || q.category === 'People').length;
const tribesCount = FULL_DATA.filter(q => q.category === 'Tribes').length;

console.log("\n--- Level Potential Counts ---");
console.log(`L1 General: ${generalCount}`);
console.log(`L2 Igala:   ${igalaCount}`);
console.log(`L3 Ebira:   ${ebiraCount}`);
console.log(`L4 Okun:    ${okunCount}`);
console.log(`L5 Politics:${politicsCount}`);
console.log(`L6 Places:  ${placesCount}`);
console.log(`L7 Tribes:  ${tribesCount}`);

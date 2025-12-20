import { KOGI_DATA } from './kogi_data.js'; // General History & Geography
import { KOGI_POLITICS_DATA } from './kogi_politics_data.js'; // Politics
import { KOGI_PLACES_DATA } from './kogi_places_data.js'; // People & places
import { KOGI_TRIBES_DATA } from './kogi_tribes_data.js'; // Minority Tribes (Ogori, Nupe, etc)
import { KOGI_EXPANSION_DATA } from './kogi_expansion_data.js'; // Expansion Pack
import { kogiIndustriesQuestions } from './kogi_industries_data.js'; // Industries (Level 8)
import { kogiCultureGeneralQuestions } from './kogi_culture_general_data.js'; // Culture (Level 9)
import { kogiNotablePeopleQuestions } from './kogi_notable_people_data.js'; // Notable People (Level 10)

// Combine all data for easier access if needed
const allQuestions = [
    ...KOGI_DATA,
    ...KOGI_POLITICS_DATA,
    ...KOGI_PLACES_DATA,
    ...KOGI_TRIBES_DATA,
    ...KOGI_EXPANSION_DATA,
    ...kogiIndustriesQuestions,
    ...kogiCultureGeneralQuestions,
    ...kogiNotablePeopleQuestions
];

// Helper to get questions by category/tags
function getQuestionsForLevel(level, count) {
    let filtered = [];
    if (level === 1) {
        // General History, Geography, Education, Economy (from expansion)
        filtered = [
            ...KOGI_DATA.filter(q => !q.category || q.category === 'General' || q.category === 'History' || q.category === 'Geography'),
            ...KOGI_EXPANSION_DATA.filter(q => q.category === 'Education' || q.category === 'Economy' || q.category === 'General')
        ];
    } else if (level === 2) {
        // Igala specific
        filtered = [
            ...KOGI_DATA.filter(q => q.category === 'Igala'),
            ...KOGI_EXPANSION_DATA.filter(q => q.category === 'Igala')
        ];
    } else if (level === 3) {
        // Ebira specific
        filtered = [
            ...KOGI_DATA.filter(q => q.category === 'Ebira'),
            ...KOGI_EXPANSION_DATA.filter(q => q.category === 'Ebira')
        ];
    } else if (level === 4) {
        // Okun specific
        filtered = [
            ...KOGI_DATA.filter(q => q.category === 'Okun'),
            ...KOGI_EXPANSION_DATA.filter(q => q.category === 'Okun')
        ];
    } else if (level === 5) {
        // Politics
        filtered = [
            ...KOGI_POLITICS_DATA,
            ...KOGI_EXPANSION_DATA.filter(q => q.category === 'Politics')
        ];
    } else if (level === 6) {
        // Places & People
        filtered = [
            ...KOGI_PLACES_DATA,
            ...KOGI_EXPANSION_DATA.filter(q => q.category === 'Places' || q.category === 'People')
        ];
    } else if (level === 7) {
        // Minority Tribes
        filtered = [
            ...KOGI_TRIBES_DATA,
            ...KOGI_EXPANSION_DATA.filter(q => q.category === 'Minority')
        ];
    } else if (level === 8) {
        // Industries
        filtered = kogiIndustriesQuestions;
    } else if (level === 9) {
        // Culture
        filtered = kogiCultureGeneralQuestions;
    } else if (level === 10) {
        // Notable People
        filtered = kogiNotablePeopleQuestions;
    }

    // Shuffle and slice
    const shuffled = filtered.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

export const GAME_LEVELS = [
    {
        id: 1,
        title: "The Confluence Origins",
        questions: getQuestionsForLevel(1, 50),
        color: "from-green-400 to-blue-500"
    },
    {
        id: 2,
        title: "Igala Kingdom Chronicles",
        questions: getQuestionsForLevel(2, 50),
        color: "from-yellow-400 to-red-500"
    },
    {
        id: 3,
        title: "Ebira Heritage",
        questions: getQuestionsForLevel(3, 50),
        color: "from-purple-400 to-pink-500"
    },
    {
        id: 4,
        title: "Okun Traditions",
        questions: getQuestionsForLevel(4, 50),
        color: "from-blue-400 to-indigo-500"
    },
    {
        id: 5,
        title: "Political History",
        questions: getQuestionsForLevel(5, 50),
        color: "from-red-400 to-orange-500"
    },
    {
        id: 6,
        title: "People & Places",
        questions: getQuestionsForLevel(6, 50),
        color: "from-teal-400 to-emerald-500"
    },
    {
        id: 7,
        title: "Tribes of the Confluence",
        questions: getQuestionsForLevel(7, 50),
        color: "from-orange-400 to-yellow-500"
    },
    {
        id: 8,
        title: "Industries & Resources",
        questions: getQuestionsForLevel(8, 50),
        color: "from-gray-400 to-slate-500"
    },
    {
        id: 9,
        title: "Cultural Mosaic",
        questions: getQuestionsForLevel(9, 50),
        color: "from-pink-400 to-rose-500"
    },
    {
        id: 10,
        title: "Legends & Icons",
        questions: getQuestionsForLevel(10, 50),
        color: "from-indigo-400 to-violet-500"
    }
];

export const THEME_COLORS = {
    primary: "cyan",
    secondary: "purple",
    accent: "yellow"
};

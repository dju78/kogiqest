import { KOGI_DATA } from './kogi_data.js'; // General History & Geography
import { KOGI_POLITICS_DATA } from './kogi_politics_data.js'; // Politics
import { KOGI_PLACES_DATA } from './kogi_places_data.js'; // People & places
import { KOGI_TRIBES_DATA } from './kogi_tribes_data.js'; // Minority Tribes (Ogori, Nupe, etc)
import { KOGI_EXPANSION_DATA } from './kogi_expansion_data.js'; // Expansion Pack
import { kogiIndustriesQuestions } from './kogi_industries_data.js'; // Industries (Level 8)
import { kogiCultureGeneralQuestions } from './kogi_culture_general_data.js'; // Culture (Level 9)
import { kogiNotablePeopleQuestions } from './kogi_notable_people_data.js'; // Notable People (Level 10)
import { taketeIdeQuestions } from './takete_ide_data.js'; // Takete-Ide, Amuro (Level 11)

// Combine all data for easier access if needed
const allQuestions = [
    ...KOGI_DATA,
    ...KOGI_POLITICS_DATA,
    ...KOGI_PLACES_DATA,
    ...KOGI_TRIBES_DATA,
    ...KOGI_EXPANSION_DATA,
    ...kogiIndustriesQuestions,
    ...kogiCultureGeneralQuestions,
    ...kogiNotablePeopleQuestions,
    ...taketeIdeQuestions
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
    } else if (level === 11) {
        // Takete-Ide, Amuro District
        filtered = taketeIdeQuestions;
    }

    // Drop any duplicates that appear in more than one source file
    const seen = new Set();
    const unique = filtered.filter(q => {
        const key = q?.question;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Fisher-Yates on a copy: `Array.prototype.sort` with a random comparator is
    // biased, and sorting `filtered` in place would mutate the imported data modules.
    const shuffled = [...unique];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
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
    },
    {
        id: 11,
        title: "Takete-Ide of Amuro",
        questions: getQuestionsForLevel(11, 100),
        color: "from-emerald-400 to-cyan-500"
    }
];

/** Points awarded for each correct answer. */
export const POINTS_PER_QUESTION = 100;

/** Highest level a player can reach, and the largest value ever submitted. */
export const MAX_LEVEL = GAME_LEVELS.length;

/**
 * The highest score a perfect run can produce.
 *
 * The database mirrors these two values in
 * supabase/migrations/0001_kogi_quest_namespaced_schema.sql —
 * `kogi_quest_leaderboard_score_check`, `kogi_quest_leaderboard_level_check`
 * and the validation inside `kogi_quest_submit_score()`. If questions or
 * levels are added, re-run that migration so the constraints keep matching;
 * it is idempotent and updates them in place.
 */
export const MAX_POSSIBLE_SCORE =
    GAME_LEVELS.reduce((total, level) => total + level.questions.length, 0) * POINTS_PER_QUESTION;

/**
 * Global id -> question lookup, spanning every title. Question ids are
 * unique across the whole game (e.g. "trb1", "in7", "tki42"), which is what
 * lets progress.js track "has this exact question ever been answered
 * correctly" as one flat set instead of per-title bookkeeping.
 */
export const QUESTION_BY_ID = new Map();
for (const title of GAME_LEVELS) {
    for (const question of title.questions) {
        QUESTION_BY_ID.set(question.id, question);
    }
}

/**
 * Maps the database's internal 1-11 `level` identifier to the title a player
 * actually sees. The numeric column is a compatibility artifact of the
 * Supabase schema (see supabase/migrations/0001_kogi_quest_namespaced_schema.sql)
 * and must never be shown to a user on its own — always resolve it through
 * this function first.
 */
export function titleForLevel(level) {
    return GAME_LEVELS[level - 1]?.title ?? GAME_LEVELS[0].title;
}

export const THEME_COLORS = {
    primary: "cyan",
    secondary: "purple",
    accent: "yellow"
};

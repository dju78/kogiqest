import { GAME_LEVELS } from './constants.js';

console.log("Auditing Game Levels...");

GAME_LEVELS.forEach(level => {
    console.log(`Level ${level.id}: ${level.title}`);
    console.log(` - Questions: ${level.questions ? level.questions.length : 'UNDEFINED'}`);

    if (level.questions && level.questions.length > 0) {
        console.log(` - Sample Q: ${level.questions[0].question}`);
    } else {
        console.error(`!! LEVEL ${level.id} IS EMPTY !!`);
    }
});

console.log("Audit Complete.");

import fs from 'fs';
import path from 'path';

const LIB_DIR = './src/lib';
const FILES = [
    'kogi_data.js',
    'kogi_politics_data.js',
    'kogi_places_data.js',
    'kogi_tribes_data.js',
    'kogi_expansion_data.js',
    'kogi_industries_data.js',
    'kogi_culture_general_data.js',
    'kogi_notable_people_data.js'
];

function auditFile(fileName) {
    const filePath = path.join(LIB_DIR, fileName);
    const content = fs.readFileSync(filePath, 'utf8');

    // Improved regex to capture options and answer precisely
    const questionRegex = /\{\s*id:\s*"([^"]*)",[\s\S]*?options:\s*\[([\s\S]*?)\][\s\S]*?answer:\s*(\d+)[\s\S]*?\}/g;

    let match;
    let errors = 0;
    while ((match = questionRegex.exec(content)) !== null) {
        const id = match[1];
        const optionsStr = match[2];
        const answer = parseInt(match[3]);

        // Count options manually by splitting on quotes (more robust than comma splitting for our data)
        const optionItemRegex = /(["'])(.*?[^\\])\1/g;
        let optionsCount = 0;
        while (optionItemRegex.exec(optionsStr) !== null) {
            optionsCount++;
        }

        if (answer < 0 || answer >= optionsCount) {
            console.error(`ERROR in ${fileName} [ID: ${id}]: Answer index ${answer} is out of bounds (Options: ${optionsCount})`);
            errors++;
        }
    }

    if (errors === 0) {
        console.log(`✓ ${fileName}: All answers are within bounds.`);
    } else {
        console.log(`✗ ${fileName}: ${errors} error(s) found.`);
    }
}

console.log('Starting Data Audit...');
FILES.forEach(auditFile);
console.log('Audit Complete.');

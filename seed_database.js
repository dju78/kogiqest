import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const supabaseUrl = 'https://xnsvxgqvamjaqrexiash.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhuc3Z4Z3F2YW1qYXFyZXhpYXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODIzMTAsImV4cCI6MjA4NjU1ODMxMH0.8WCoJLCUu4LObxPkE8QzdbVcyhzmGz-4r4AsQjs8p3U';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedDatabase() {
  try {
    console.log('Reading seed file...');
    const seedFile = fs.readFileSync(path.join(__dirname, '..', 'supabase_seed.sql'), 'utf8');

    // Extract INSERT statements
    const lines = seedFile.split('\n');
    const insertLines = lines.filter(line => line.trim().startsWith('INSERT INTO public.questions'));

    console.log(`Found ${insertLines.length} questions to insert`);

    // Parse INSERT statements into objects
    const questions = [];
    for (const line of insertLines) {
      const parsed = parseInsertStatement(line);
      if (parsed) {
        questions.push(parsed);
      }
    }

    console.log(`Parsed ${questions.length} questions`);

    // Insert in batches of 100
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} questions)...`);

      const { data, error } = await supabase
        .from('questions')
        .insert(batch);

      if (error) {
        console.error(`Error in batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }

      totalInserted += batch.length;
      console.log(`Successfully inserted ${totalInserted}/${questions.length} questions`);
    }

    // Verify
    const { count, error: countError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting questions:', countError);
    } else {
      console.log(`\n✅ Success! Total questions in database: ${count}`);
    }

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

function parseInsertStatement(stmt) {
  try {
    // Match the VALUES clause
    const match = stmt.match(/VALUES\s*\('(.+?)'\s*,\s*ARRAY\[(.+?)\]\s*,\s*(\d+)\s*,\s*'(.+?)'\)/);
    if (!match) return null;

    const [, question, optionsStr, answer, category] = match;

    // Parse options array
    const options = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < optionsStr.length; i++) {
      const char = optionsStr[i];

      if (char === "'" && (i === 0 || optionsStr[i - 1] !== "'")) {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        options.push(current.trim().replace(/^'|'$/g, '').replace(/''/g, "'"));
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      options.push(current.trim().replace(/^'|'$/g, '').replace(/''/g, "'"));
    }

    return {
      question: question.replace(/''/g, "'"),
      options,
      answer: parseInt(answer),
      category: category.replace(/''/g, "'")
    };
  } catch (error) {
    console.error('Error parsing statement:', stmt.substring(0, 100));
    return null;
  }
}

seedDatabase();

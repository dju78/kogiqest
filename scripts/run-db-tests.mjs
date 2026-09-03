#!/usr/bin/env node
/**
 * Runs the KogiQuest SQL migration and its RLS suite against a LOCAL,
 * throwaway Postgres. Never point this at a hosted project: it creates and
 * drops a database and writes fixture rows.
 *
 *   npm run test:db
 *   KQ_TEST_PG="postgres://postgres@localhost:5432" npm run test:db
 *
 * Requires `psql` on PATH (PostgreSQL 14+).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const conn = process.env.KQ_TEST_PG || 'postgres://postgres@localhost:55432';
const dbName = process.env.KQ_TEST_DB || 'kq_test';

// --- Safety rail -----------------------------------------------------------
// This script drops and recreates a database. Refuse anything that looks like
// a managed or remote host.
const BANNED = [/supabase\.(co|com|in)/i, /\.rds\.amazonaws\.com/i, /neon\.tech/i, /render\.com/i];
if (BANNED.some((re) => re.test(conn))) {
    console.error(`\nRefusing to run destructive tests against a hosted database:\n  ${conn}\n`);
    console.error('Point KQ_TEST_PG at a local throwaway Postgres instead.');
    process.exit(1);
}
if (!/localhost|127\.0\.0\.1|\[::1\]/.test(conn)) {
    console.error(`\nRefusing to run: KQ_TEST_PG must be a localhost connection.\n  got: ${conn}\n`);
    process.exit(1);
}

const files = [
    ['harness', join(root, 'supabase', 'tests', '00_harness.sql')],
    ['migration', join(root, 'supabase', 'migrations', '0001_kogi_quest_namespaced_schema.sql')],
    ['migration (re-run, idempotency)', join(root, 'supabase', 'migrations', '0001_kogi_quest_namespaced_schema.sql')],
    ['rls tests', join(root, 'supabase', 'tests', '01_rls_tests.sql')]
];

for (const [, file] of files) {
    if (!existsSync(file)) {
        console.error(`Missing SQL file: ${file}`);
        process.exit(1);
    }
}

const psql = (args, opts = {}) =>
    execFileSync('psql', args, { encoding: 'utf8', stdio: 'pipe', ...opts });

try {
    psql(['--version']);
} catch {
    console.error('\n`psql` was not found on PATH. Install the PostgreSQL client tools to run database tests.\n');
    process.exit(1);
}

console.log(`\nKogiQuest database tests\n  server:   ${conn}\n  database: ${dbName}\n`);

try {
    psql(['-q', '-v', 'ON_ERROR_STOP=1', '-d', `${conn}/postgres`, '-c',
        `drop database if exists ${dbName};`]);
    psql(['-q', '-v', 'ON_ERROR_STOP=1', '-d', `${conn}/postgres`, '-c',
        `create database ${dbName};`]);
} catch (err) {
    console.error('Could not create the test database. Is a local Postgres running?');
    console.error(String(err.stderr || err.message).trim());
    process.exit(1);
}

let failed = false;
for (const [label, file] of files) {
    process.stdout.write(`  ${label.padEnd(34)}`);
    // spawnSync (not execFileSync) so stderr is captured on success too:
    // psql emits RAISE NOTICE — and therefore every PASS line — on stderr.
    const res = spawnSync('psql',
        ['-q', '-v', 'ON_ERROR_STOP=1', '-d', `${conn}/${dbName}`, '-f', file],
        { encoding: 'utf8' });
    const combined = `${res.stdout || ''}\n${res.stderr || ''}`;

    if (res.status !== 0) {
        failed = true;
        console.log('FAILED');
        console.error('\n' + combined.trim() + '\n');
        break;
    }
    const passes = (combined.match(/PASS {2}/g) || []).length;
    console.log(passes > 0 ? `ok (${passes} assertions)` : 'ok');
}

if (!failed) {
    try {
        psql(['-q', '-d', `${conn}/postgres`, '-c', `drop database if exists ${dbName};`]);
    } catch { /* leaving the database behind is not a test failure */ }
    console.log('\nAll database assertions passed.\n');
}

process.exit(failed ? 1 : 0);

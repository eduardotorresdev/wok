import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../env';
import * as schema from './schema';

const BOOTSTRAP = `
CREATE TABLE IF NOT EXISTS resume (
	user_id TEXT PRIMARY KEY, latex TEXT NOT NULL, pages INTEGER, compiled_hash TEXT,
	updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS preferences (
	user_id TEXT PRIMARY KEY, terms TEXT NOT NULL, locations TEXT NOT NULL,
	remote INTEGER NOT NULL, area TEXT NOT NULL, seniority TEXT NOT NULL,
	updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS area_strategy (
	area TEXT PRIMARY KEY, content TEXT NOT NULL, sources TEXT NOT NULL,
	updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS job (
	id TEXT PRIMARY KEY, user_id TEXT NOT NULL, source TEXT NOT NULL, external_id TEXT NOT NULL,
	title TEXT NOT NULL, company TEXT NOT NULL, location TEXT, url TEXT NOT NULL, apply_url TEXT,
	salary TEXT, posted_at TEXT, summary TEXT, description TEXT, match_score INTEGER,
	match_reasons TEXT, created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS job_user_source_ext ON job (user_id, source, external_id);
CREATE TABLE IF NOT EXISTS swipe (
	user_id TEXT NOT NULL, job_id TEXT NOT NULL, direction TEXT NOT NULL,
	created_at INTEGER NOT NULL, PRIMARY KEY (user_id, job_id));
CREATE TABLE IF NOT EXISTS application (
	id TEXT PRIMARY KEY, user_id TEXT NOT NULL, job_id TEXT NOT NULL, status TEXT NOT NULL,
	tailored_latex TEXT, tailored_pdf_path TEXT, last_message TEXT,
	created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS application_user_job ON application (user_id, job_id);
CREATE TABLE IF NOT EXISTS application_step (
	id INTEGER PRIMARY KEY AUTOINCREMENT, application_id TEXT NOT NULL, kind TEXT NOT NULL,
	message TEXT NOT NULL, data TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS application_step_app ON application_step (application_id, id);
CREATE TABLE IF NOT EXISTS search_run (
	id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL, message TEXT,
	found INTEGER NOT NULL DEFAULT 0, started_at INTEGER NOT NULL, finished_at INTEGER);
CREATE TABLE IF NOT EXISTS profile (
	user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS confirmed_answer (
	id TEXT PRIMARY KEY, user_id TEXT NOT NULL, question_key TEXT NOT NULL, question TEXT NOT NULL,
	answer TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS confirmed_answer_user_key ON confirmed_answer (user_id, question_key);
`;

// Columns added after a table first shipped. CREATE TABLE IF NOT EXISTS never
// alters an existing table, so each one is added here when missing.
const ADDED_COLUMNS: [table: string, column: string, type: string][] = [
	['application', 'needs_kind', 'TEXT'],
	['application', 'pending_question', 'TEXT']
];

function addMissingColumns(database: Database.Database) {
	for (const [table, column, type] of ADDED_COLUMNS) {
		const columns = database.pragma(`table_info(${table})`) as { name: string }[];
		if (!columns.some((c) => c.name === column)) {
			database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
		}
	}
}

let sqliteInstance: Database.Database | undefined;
let dbInstance: BetterSQLite3Database<typeof schema> | undefined;

/** Raw better-sqlite3 handle (shared with Better Auth). Opened on first use. */
export function sqlite(): Database.Database {
	if (!sqliteInstance) {
		fs.mkdirSync(config.dataDir, { recursive: true });
		sqliteInstance = new Database(path.join(config.dataDir, 'wok.db'));
		sqliteInstance.pragma('journal_mode = WAL');
		sqliteInstance.pragma('busy_timeout = 5000');
		sqliteInstance.exec(BOOTSTRAP);
		addMissingColumns(sqliteInstance);
	}
	return sqliteInstance;
}

export function db() {
	if (!dbInstance) dbInstance = drizzle(sqlite(), { schema });
	return dbInstance;
}

export { schema };

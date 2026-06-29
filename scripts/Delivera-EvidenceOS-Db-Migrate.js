#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { join } from 'path';
import postgres from 'postgres';
import { PROJECT_ROOT } from '../lib/Delivera-Config-Env-Services-Core-SSOT.js';

const DATABASE_URL = process.env.DATABASE_URL || '';

async function main() {
  if (!DATABASE_URL) {
    console.log('[evidence-os:migrate] DATABASE_URL is not set; file-backed dev store remains active.');
    return;
  }
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    const migration = await readFile(join(PROJECT_ROOT, 'db', 'migrations', '0001_evidence_os_foundation.sql'), 'utf8');
    await sql.unsafe(migration);
    console.log('[evidence-os:migrate] Applied 0001_evidence_os_foundation.sql');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error('[evidence-os:migrate] Failed:', error.message);
  process.exit(1);
});


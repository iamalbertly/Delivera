
import { mkdir, appendFile, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './Delivera-Server-Logging-Utility.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Notes file is adjacent to this lib logic or we should use absolute path from root?
// In server.js it was `path.join(__dirname, 'data', ...)` and server.js is in root.
// lib is in /lib. So we need `../data`.
const CURRENT_SPRINT_NOTES_FILE = path.join(__dirname, '..', 'data', 'current-sprint-notes.json');

function normalizeList(input) {
    if (Array.isArray(input)) {
        return input.map(item => String(item || '').trim()).filter(Boolean);
    }
    if (typeof input === 'string') {
        return input
            .split(/\r?\n/)
            .map(item => item.trim())
            .filter(Boolean);
    }
    return [];
}

export function normalizeNotesPayload(payload) {
    return {
        dependencies: normalizeList(payload?.dependencies),
        learnings: normalizeList(payload?.learnings),
    };
}

async function readCurrentSprintNotesFile() {
    try {
        const raw = await readFile(CURRENT_SPRINT_NOTES_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { updatedAt: null, items: {} };
        if (!parsed.items || typeof parsed.items !== 'object') parsed.items = {};
        return parsed;
    } catch (error) {
        if (error?.code === 'ENOENT') return { updatedAt: null, items: {} };
        throw error;
    }
}

export async function upsertCurrentSprintNotes(boardId, sprintId, payload) {
    const boardKey = String(boardId || '');
    const sprintKey = String(sprintId || '');
    if (!boardKey || !sprintKey) {
        throw new Error('boardId and sprintId are required');
    }

    const notes = await readCurrentSprintNotesFile();
    if (!notes.items[boardKey]) notes.items[boardKey] = {};

    const entry = {
        dependencies: normalizeList(payload?.dependencies),
        learnings: normalizeList(payload?.learnings),
        updatedAt: new Date().toISOString(),
    };

    notes.items[boardKey][sprintKey] = entry;
    notes.updatedAt = entry.updatedAt;

    await mkdir(path.dirname(CURRENT_SPRINT_NOTES_FILE), { recursive: true });

    // Optimistic concurrency: merge with latest version on disk to avoid clobbering concurrent updates.
    try {
        const latest = await readCurrentSprintNotesFile();
        if (latest.updatedAt && latest.updatedAt !== notes.updatedAt) {
            const merged = {
                updatedAt: notes.updatedAt,
                items: {
                    ...(latest.items || {}),
                    ...(notes.items || {}),
                },
            };
            await writeFile(CURRENT_SPRINT_NOTES_FILE, JSON.stringify(merged, null, 2), 'utf8');
            return entry;
        }
    } catch (mergeError) {
        logger.warn('Current-sprint notes optimistic merge failed, falling back to direct write', {
            error: mergeError.message,
        });
    }

    await writeFile(CURRENT_SPRINT_NOTES_FILE, JSON.stringify(notes, null, 2), 'utf8');

    return entry;
}

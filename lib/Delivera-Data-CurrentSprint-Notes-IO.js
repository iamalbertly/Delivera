/**
 * Current-sprint notes: read/write and get for a board+sprint.
 * SSOT for current-sprint-notes.json I/O. Used by lib/currentSprint.js.
 */

import path from 'path';
import { readFile } from 'fs/promises';

const CURRENT_SPRINT_NOTES_PATH = path.join(process.cwd(), 'data', 'current-sprint-notes.json');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

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

/**
 * @returns {Promise<{ updatedAt: string | null, items: Object }>}
 */
export async function readCurrentSprintNotes() {
  try {
    const raw = await readFile(CURRENT_SPRINT_NOTES_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !isPlainObject(parsed)) return { updatedAt: null, items: {} };
    if (!isPlainObject(parsed.items)) parsed.items = {};
    return parsed;
  } catch (error) {
    if (error?.code === 'ENOENT') return { updatedAt: null, items: {} };
    throw error;
  }
}

/**
 * @param {Object} notesData - From readCurrentSprintNotes()
 * @param {string|number} boardId
 * @param {string|number} sprintId
 * @returns {{ dependencies: string[], learnings: string[], updatedAt: string | null }}
 */
export function getCurrentSprintNotes(notesData, boardId, sprintId) {
  const boardKey = String(boardId || '');
  const sprintKey = String(sprintId || '');
  if (!boardKey || !sprintKey || !notesData?.items?.[boardKey]?.[sprintKey]) {
    return { dependencies: [], learnings: [], updatedAt: null };
  }
  const entry = notesData.items[boardKey][sprintKey] || {};
  return {
    dependencies: normalizeList(entry.dependencies),
    learnings: normalizeList(entry.learnings),
    updatedAt: entry.updatedAt || null,
  };
}

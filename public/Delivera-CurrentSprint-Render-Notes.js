import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDate } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';

export function renderNotes(data) {
  const notes = data.notes || { dependencies: [], learnings: [], updatedAt: null };
  const depsText = (notes.dependencies || []).join('\n');
  const learningsText = (notes.learnings || []).join('\n');
  const depsCount = (notes.dependencies || []).length;
  const learningsCount = (notes.learnings || []).length;
  const hasDependencies = (notes.dependencies || []).length > 0;
  const hasLearnings = (notes.learnings || []).length > 0;

  let html = '<div class="transparency-card" id="notes-card">';
  html += '<h2>Dependencies & learnings</h2>';
  html += '<div class="notes-grid">';
  html += '<div>' +
    '<label>Dependencies' + (depsCount ? ` (${depsCount})` : '') + '</label>' +
    '<textarea id="notes-dependencies" rows="6" placeholder="List dependencies...">' + escapeHtml(depsText) + '</textarea>' +
    '</div>';
  html += '<div>' +
    '<label>Learnings' + (learningsCount ? ` (${learningsCount})` : '') + '</label>' +
    '<textarea id="notes-learnings" rows="6" placeholder="List learnings...">' + escapeHtml(learningsText) + '</textarea>' +
    '</div>';
  html += '</div>';
  html += '<div class="notes-actions">' +
    '<button id="notes-save" class="btn btn-primary btn-compact" type="button">Save notes</button>' +
    '<div id="notes-status" class="notes-status"></div>' +
    '</div>';
  if (notes.updatedAt) {
    html += '<p class="notes-updated">Last updated: ' + escapeHtml(formatDate(notes.updatedAt)) + '</p>';
  }
  if (!hasDependencies && !hasLearnings) {
    html += '<p class="notes-empty">No notes yet. Capture blockers and learnings here.</p>';
  }
  html += '</div>';
  return html;
}

export function renderAssumptions(data) {
  const assumptions = data.assumptions || [];
  if (!assumptions.length) return '';
  let html = '<div class="transparency-card" id="assumptions-card">';
  html += '<h2>Assumptions</h2>';
  html += '<ul class="assumptions-list">';
  for (const item of assumptions) {
    html += '<li>' + escapeHtml(item) + '</li>';
  }
  html += '</ul>';
  html += '</div>';
  return html;
}

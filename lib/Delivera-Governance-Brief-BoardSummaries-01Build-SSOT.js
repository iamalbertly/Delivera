/**
 * SSOT: Brief meta boardSummaries from governance board payloads (investment drawer).
 */
export function buildBriefBoardSummaries(boardPayloads = []) {
  const summaries = {};
  for (const entry of boardPayloads) {
    const boardId = entry?.board?.id;
    if (!boardId) continue;
    const payload = entry.payload || entry.sprintPayload || entry.currentSprint || {};
    const stories = Array.isArray(payload.stories) ? payload.stories : [];
    let registeredWorkHours = 0;
    for (const story of stories) {
      registeredWorkHours += Number(story.loggedHours) || 0;
    }
    summaries[boardId] = {
      registeredWorkHours: Math.round(registeredWorkHours * 10) / 10,
      sprintCount: payload.sprint ? 1 : 0,
    };
  }
  return summaries;
}

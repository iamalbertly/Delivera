// paperclip-queue-next-safe.js
// Safe "next issue" selector for Paperclip queues:
// - picks the oldest `todo` issue first
// - patches any extra issues back to `todo`
// - avoids the common `powershell -Command` + `$_` interpolation hazard
import fs from "node:fs";

function pickArg(name, argv, fallback = undefined) {
  const idx = argv.indexOf(name);
  if (idx === -1) return fallback;
  return argv[idx + 1] ?? fallback;
}

const argv = process.argv.slice(2);
const companyId = pickArg("--companyId", argv);
const assigneeAgentId = pickArg("--assigneeAgentId", argv);
const artifactPath = pickArg("--artifactPath", argv);
const dryRun = (pickArg("--dryRun", argv, "false") || "false").toLowerCase() === "true";

if (!companyId || !assigneeAgentId) {
  console.error(JSON.stringify({ error: "Missing required args: --companyId and --assigneeAgentId" }));
  process.exit(2);
}

const BASE = "http://127.0.0.1:3100";
const nowIso = new Date().toISOString();

const byCreatedAtAsc = (a, b) => {
  const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
  return ta - tb;
};

const main = async () => {
  const issuesUrl = `${BASE}/api/companies/${companyId}/issues`;
  const resp = await fetch(issuesUrl, { method: "GET" });
  if (!resp.ok) throw new Error(`Failed GET ${issuesUrl}: ${resp.status}`);
  const issues = await resp.json();

  const filtered = issues.filter(
    (i) => i?.assigneeAgentId === assigneeAgentId && ["in_progress", "todo"].includes(i?.status)
  );

  const todo = filtered.filter((i) => i.status === "todo").sort(byCreatedAtAsc);
  const inProgress = filtered.filter((i) => i.status === "in_progress").sort(byCreatedAtAsc);

  const chosen = todo[0] ?? inProgress[0] ?? null;
  const extras = chosen ? filtered.filter((i) => i.id !== chosen.id).sort(byCreatedAtAsc) : [];

  const patchedExtras = [];
  for (const ex of extras) {
    const fromStatus = ex.status;
    const toStatus = "todo";
    if (fromStatus === toStatus) continue;

    const patchUrl = `${BASE}/api/issues/${ex.id}`;
    if (!dryRun) {
      const patchResp = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: toStatus }),
      });
      if (!patchResp.ok) throw new Error(`Failed PATCH ${patchUrl}: ${patchResp.status}`);
    }

    patchedExtras.push({ id: ex.id, identifier: ex.identifier, fromStatus, toStatus, patched: !dryRun });
  }

  const artifact = {
    meta: { generatedAt: nowIso, dryRun, companyId, assigneeAgentId },
    selection: chosen
      ? {
          id: chosen.id,
          identifier: chosen.identifier,
          title: chosen.title,
          status: chosen.status,
          createdAt: chosen.createdAt,
        }
      : null,
    extras: extras.map((e) => ({ id: e.id, identifier: e.identifier, status: e.status, createdAt: e.createdAt })),
    patchedExtras,
    counts: { filtered: filtered.length, todo: todo.length, inProgress: inProgress.length, extras: extras.length },
  };

  if (artifactPath) {
    const dir = artifactPath.includes("\\") ? artifactPath.slice(0, artifactPath.lastIndexOf("\\")) : ".";
    if (dir && dir !== "." && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), "utf8");
  }

  process.stdout.write(JSON.stringify(artifact));
};

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e?.message ?? e), stack: String(e?.stack ?? "") }));
  process.exit(1);
});


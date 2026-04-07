import { log } from "./logger";

export async function dispatchRestoreWorkflow(fileId: string): Promise<void> {
  const token = process.env.GITHUB_PAT?.trim();
  const owner = process.env.GITHUB_OWNER?.trim();
  const repo = process.env.GITHUB_REPO?.trim();
  const workflow =
    process.env.GITHUB_RESTORE_WORKFLOW_FILE?.trim() ||
    "database-restore.yml";
  const ref = process.env.GITHUB_REF?.trim() || "main";

  if (!token || !owner || !repo) {
    throw new Error(
      "GitHub restore is not configured (GITHUB_PAT, GITHUB_OWNER, GITHUB_REPO)",
    );
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      ref,
      inputs: { restore_file_id: fileId },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    log.error("github_dispatch_failed", { status: res.status, body: text });
    throw new Error(`GitHub API error ${res.status}`);
  }

  log.info("github_dispatch_ok", { workflow, ref, fileId });
}

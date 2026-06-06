// Writes a generated static site to disk and deploys it.
// Real path: Vercel CLI -> public URL. Enabled by VERCEL_TOKEN, or DARWIN_VERCEL=1
// to use an already-logged-in `vercel` CLI session. DARWIN_VERCEL=0 forces offline.
// Offline path: write files under .darwin/sites/<slug> and return a file URL the
// structural Lighthouse fallback can read directly. Same return shape either way.

import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

export interface DeployResult {
  url: string;
  dir: string;
  real: boolean;
}

const ROOT = path.join(process.cwd(), ".darwin", "sites");

export async function deploySite(
  slug: string,
  files: Record<string, string>
): Promise<DeployResult> {
  const dir = path.join(ROOT, slug);
  await fs.mkdir(dir, { recursive: true });
  await Promise.all(
    Object.entries(files).map(([name, content]) =>
      fs.writeFile(path.join(dir, name), content, "utf8")
    )
  );

  const vercelOn =
    process.env.DARWIN_VERCEL !== "0" &&
    (!!process.env.VERCEL_TOKEN || process.env.DARWIN_VERCEL === "1");
  if (vercelOn) {
    try {
      const tokenArgs = process.env.VERCEL_TOKEN
        ? ["--token", process.env.VERCEL_TOKEN]
        : [];
      const { stdout, stderr } = await exec(
        "vercel",
        ["deploy", "--prod", "--yes", ...tokenArgs, dir],
        // SIGKILL so a hung CLI can't linger and finish a "ghost" deploy later;
        // 60s keeps worst-case on-stage dead air bounded (deploys run in ~10s).
        { timeout: 60_000, killSignal: "SIGKILL" }
      );
      // The hash deployment URL (stdout) sits behind deployment protection (401);
      // the public URL is the "Aliased:" line on stderr. Fall back hash -> alias.
      const aliased = (stderr.match(/Aliased:\s+(https?:\/\/\S+)/) || [])[1];
      const url = aliased || (stdout.match(/https?:\/\/\S+/) || [])[0];
      if (url) return { url: url.trim(), dir, real: true };
    } catch (e) {
      // fall through to offline URL, but say why so demos are debuggable
      console.error("[deploy] vercel failed, falling back to file://:", (e as Error).message);
    }
  }

  // Offline: a file:// URL the structural scorer can read.
  return { url: "file://" + dir, dir, real: false };
}

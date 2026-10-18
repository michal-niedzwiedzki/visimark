/** Repo-relative POSIX paths, without `node:path` (the core runs in the browser too). */

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

/** `rel` resolved against directory `dir`, or null when it escapes the repo root. */
export function joinRelative(dir: string, rel: string): string | null {
  if (rel.startsWith("/")) return null;
  const out: string[] = [];
  for (const part of [...dir.split("/"), ...rel.split("/")]) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return null;
      out.pop();
    } else out.push(part);
  }
  return out.join("/");
}

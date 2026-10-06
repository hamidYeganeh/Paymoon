import { readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url));
for (const kind of ["apps", "packages"])
  for (const entry of await readdir(path.join(root, kind), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    for (const artifact of [".next", "dist", "out", "coverage"])
      await rm(path.join(root, kind, entry.name, artifact), {
        recursive: true,
        force: true,
      });
  }
if (process.argv.includes("--cache"))
  await rm(path.join(root, ".turbo"), { recursive: true, force: true });

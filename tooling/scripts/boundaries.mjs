import { readdirSync, readFileSync } from "node:fs";
const packages = new Map();
for (const kind of ["apps", "packages"])
  for (const dir of readdirSync(kind)) {
    try {
      const p = JSON.parse(readFileSync(`${kind}/${dir}/package.json`, "utf8"));
      if (packages.has(p.name)) throw new Error(`Duplicate ${p.name}`);
      packages.set(p.name, { kind, p });
    } catch (e) {
      if (!["ENOENT", "ENOTDIR"].includes(e.code)) throw e;
    }
  }
const graph = new Map();
for (const [name, { p }] of packages) {
  const deps = { ...p.dependencies, ...p.devDependencies };
  const edges = [];
  for (const [dep, version] of Object.entries(deps)) {
    if (!packages.has(dep)) continue;
    if (packages.get(dep).kind === "apps")
      throw new Error(`${name} depends on app ${dep}`);
    if (version !== "workspace:*")
      throw new Error(`Use workspace:* for ${dep}`);
    edges.push(dep);
  }
  graph.set(name, edges);
}
function visit(n, path = []) {
  if (path.includes(n))
    throw new Error(`Dependency cycle: ${[...path, n].join(" -> ")}`);
  for (const dep of graph.get(n) || []) visit(dep, [...path, n]);
}
for (const name of graph.keys()) visit(name);
console.log(`Boundaries valid for ${packages.size} workspaces`);

import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const artifacts = [];

async function inspect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = new Set(entries.map((entry) => entry.name));
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspect(filename);
    else if (/\.(?:js(?:\.map)?|d\.ts(?:\.map)?)$/.test(entry.name)) {
      const sourceName = entry.name.replace(/\.(?:js(?:\.map)?|d\.ts(?:\.map)?)$/, ".ts");
      if (names.has(sourceName)) artifacts.push(path.relative(sourceRoot, filename));
    }
  }
}

await inspect(sourceRoot);
if (artifacts.length) {
  console.error("Generated files in src can shadow TypeScript. Keep compiler output in dist:");
  for (const artifact of artifacts) console.error(`  ${artifact}`);
  process.exitCode = 1;
}

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "public", "data");
const files = fs.readdirSync(dataDir).filter(name => /^firms_ca_.*\.geojson$/.test(name));

for (const name of files) {
  const content = fs.readFileSync(path.join(dataDir, name), "utf8");
  const data = JSON.parse(content);
  if (data.source?.url || /\/api\/area\/csv\/[^/]+\//.test(content)) {
    throw new Error(`Credential-bearing FIRMS URL found in ${name}`);
  }
}

console.log(`Checked ${files.length} public FIRMS files for credential-bearing URLs.`);

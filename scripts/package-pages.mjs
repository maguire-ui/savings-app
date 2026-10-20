import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
const out = new URL("../docs/", import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(new URL("../dist/", import.meta.url), out, { recursive: true });
writeFileSync(new URL(".nojekyll", out), "");
console.log("GitHub Pages package ready in docs/.");

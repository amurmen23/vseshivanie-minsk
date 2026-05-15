import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const out  = path.join(root, "docs");

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const ent of entries) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });

// Root files
await fs.copyFile(path.join(root, "index.html"), path.join(out, "index.html"));
await fs.copyFile(path.join(root, "app.js"),     path.join(out, "app.js"));

// Assets from landing/
await copyDir(path.join(root, "landing", "images"), path.join(out, "landing", "images"));
await copyDir(path.join(root, "landing", "docs"),   path.join(out, "landing", "docs"));

// Copy PDFs to docs/ root so ./price_vesy.pdf links work
const docsDir = path.join(root, "landing", "docs");
const pdfFiles = (await fs.readdir(docsDir)).filter(f => f.endsWith(".pdf"));
for (const pdf of pdfFiles) {
  await fs.copyFile(path.join(docsDir, pdf), path.join(out, pdf));
}

console.log("Build: index.html + app.js + landing/images + landing/docs + PDFs → docs/");

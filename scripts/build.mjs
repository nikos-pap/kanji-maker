import { build } from "vite";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
// Vite only empties this dedicated output directory, never the source tree.
await build();
await mkdir(path.join(root, "docs/licenses"), { recursive: true });
await copyFile(
  path.join(root, "assets/fonts/OFL.txt"),
  path.join(root, "docs/licenses/OFL.txt"),
);
await copyFile(
  path.join(root, "assets/licenses/fontkit-LICENSE.txt"),
  path.join(root, "docs/licenses/fontkit-LICENSE.txt"),
);
await copyFile(
  path.join(root, "assets/licenses/unicode-LICENSE.txt"),
  path.join(root, "docs/licenses/unicode-LICENSE.txt"),
);
await writeFile(path.join(root, "docs/.nojekyll"), "");
console.log("Ready: publish the docs/ folder with GitHub Pages.");

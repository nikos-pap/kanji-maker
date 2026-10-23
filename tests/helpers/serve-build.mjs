// Serve only the built folder, mounted at a repository subpath like GitHub Pages.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../docs/", import.meta.url));
const mount = "/kanji-maker/";
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (!pathname.startsWith(mount)) throw Error("Not found");
      const relative = pathname.slice(mount.length) || "index.html";
      if (relative.includes("\\") || relative.split("/").includes(".."))
        throw Error("Not found");
      const filename = path.resolve(root, relative);
      if (path.relative(root, filename).startsWith(".."))
        throw Error("Not found");
      const bytes = await readFile(filename);
      res.writeHead(200, {
        "Content-Type":
          mime[path.extname(filename)] || "application/octet-stream",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(4174, "127.0.0.1");

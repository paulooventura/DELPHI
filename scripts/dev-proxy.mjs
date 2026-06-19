/**
 * MV-style local test entry: one port (8312) that proxies the full Next.js app
 * on 3000, including /_next/* assets and /api/* routes.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_PORT = Number(process.env.DELPHI_APP_PORT ?? 3000);
const PROXY_PORT = Number(process.env.DELPHI_PROXY_PORT ?? 8312);
const INDEX_PATH = path.join(ROOT, "index.html");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function appIsUp() {
  try {
    const res = await fetch(`http://127.0.0.1:${APP_PORT}/favicon.ico`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForApp(maxMs = 180_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await appIsUp()) return;
    await sleep(1500);
  }
  throw new Error(`Timed out waiting for Next.js on http://127.0.0.1:${APP_PORT}/`);
}

function startDevServer() {
  const child = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  child.on("exit", (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
  return child;
}

function serveIndex(res) {
  const html = fs.readFileSync(INDEX_PATH);
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": html.length,
    "Cache-Control": "no-store",
  });
  res.end(html);
}

function proxyRequest(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${APP_PORT}` };

  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port: APP_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end(
      `Delphi dev server is not reachable on port ${APP_PORT}.\n` +
        `Wait a few seconds and refresh, or run: npm run dev\n`,
    );
  });

  req.pipe(proxyReq);
}

function proxyUpgrade(req, socket, head) {
  const proxyReq = http.request({
    hostname: "127.0.0.1",
    port: APP_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${APP_PORT}` },
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n` +
        Object.entries(proxyRes.headers)
          .filter(([, v]) => v != null)
          .map(([k, v]) => `${k}: ${v}\r\n`)
          .join("") +
        "\r\n",
    );
    if (proxyHead?.length) proxySocket.write(proxyHead);
    if (head?.length) proxySocket.write(head);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on("error", () => socket.destroy());
  proxyReq.end();
}

async function main() {
  const noDev = process.argv.includes("--no-dev");
  const noOpen = process.argv.includes("--no-open");

  if (!(await appIsUp())) {
    if (noDev) throw new Error(`Nothing listening on port ${APP_PORT}. Start with: npm run dev`);
    console.log(`Starting Next.js on http://127.0.0.1:${APP_PORT}/ …`);
    startDevServer();
    await waitForApp();
  } else {
    console.log(`Next.js already running on http://127.0.0.1:${APP_PORT}/`);
  }

  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/index.html" || url === "/index.html?go=1" || url.startsWith("/index.html?")) {
      return serveIndex(res);
    }
    proxyRequest(req, res);
  });

  server.on("upgrade", proxyUpgrade);

  await new Promise((resolve, reject) => {
    server.listen(PROXY_PORT, "127.0.0.1", resolve);
    server.on("error", reject);
  });

  const entry = `http://127.0.0.1:${PROXY_PORT}/index.html?go=1`;
  console.log("");
  console.log(`Delphi test URL: ${entry}`);
  console.log(`Direct app:      http://127.0.0.1:${PROXY_PORT}/`);
  console.log(`(proxied to Next.js on port ${APP_PORT})`);

  if (!noOpen && process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", entry], { stdio: "ignore", detached: true }).unref();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

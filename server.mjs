import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;
const dbDir = path.join(projectRoot, "server");
const dbPath = path.join(dbDir, "donations-db.json");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const publicUrl = process.env.PUBLIC_URL || "";
const donationSecret =
  process.env.DONATION_WEBHOOK_SECRET ||
  "7bd4fcb64d3ce8f351b715a86629961d5f6d34052ff3f7cc5185692102fca76f";
const sseClients = new Set();

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"]
]);

await mkdir(dbDir, { recursive: true });

let donations = await loadDonations();

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(body);
}

function sendEvent(response, eventName, payload) {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function buildSnapshot() {
  const leaderboardMap = new Map();

  for (const donation of donations) {
    const key = donation.userId || donation.username;
    const existing =
      leaderboardMap.get(key) ??
      {
        userId: donation.userId,
        username: donation.username,
        displayName: donation.displayName || donation.username,
        totalAmount: 0,
        donationCount: 0,
        lastDonationAt: donation.createdAt
      };

    existing.totalAmount += donation.amount;
    existing.donationCount += 1;
    existing.lastDonationAt = donation.createdAt;

    leaderboardMap.set(key, existing);
  }

  const leaderboard = Array.from(leaderboardMap.values())
    .sort((left, right) => {
      if (right.totalAmount !== left.totalAmount) {
        return right.totalAmount - left.totalAmount;
      }

      return Date.parse(right.lastDonationAt) - Date.parse(left.lastDonationAt);
    });

  return {
    totalRaised: donations.reduce((sum, donation) => sum + donation.amount, 0),
    donationCount: donations.length,
    leaderboard,
    recent: donations.slice(0, 25)
  };
}

async function loadDonations() {
  try {
    const raw = await readFile(dbPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.donations) ? parsed.donations : [];
  } catch (error) {
    await writeFile(dbPath, JSON.stringify({ donations: [] }, null, 2));
    return [];
  }
}

async function persistDonations() {
  await writeFile(dbPath, `${JSON.stringify({ donations }, null, 2)}\n`, "utf8");
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;

    if (size > 1_000_000) {
      throw new Error("Payload too large.");
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function normalizeDonation(input) {
  const amount = Number(input.amount);
  const userId = input.userId ? Number(input.userId) : null;
  const username = String(input.username || input.displayName || "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be a positive number");
  }

  if (!username) {
    throw new Error("username is required");
  }

  return {
    id: randomUUID(),
    userId,
    username,
    displayName: String(input.displayName || username).trim(),
    amount,
    productId: input.productId ? Number(input.productId) : null,
    productName: String(input.productName || "").trim(),
    productType: String(input.productType || "gamepass").trim(),
    source: String(input.source || "roblox").trim(),
    createdAt:
      input.createdAt && !Number.isNaN(Date.parse(input.createdAt))
        ? new Date(input.createdAt).toISOString()
        : new Date().toISOString()
  };
}

function broadcast(eventName, payload) {
  for (const response of sseClients) {
    sendEvent(response, eventName, payload);
  }
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/donations") {
    sendJson(response, 200, buildSnapshot());
    return true;
  }

  if (request.method === "GET" && url.pathname === "/healthz") {
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/donations/stream") {
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive"
    });

    response.write("retry: 5000\n\n");
    sendEvent(response, "snapshot", buildSnapshot());
    sseClients.add(response);

    request.on("close", () => {
      sseClients.delete(response);
    });

    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/donations") {
    if (request.headers["x-donation-secret"] !== donationSecret) {
      sendJson(response, 401, { error: "Unauthorized" });
      return true;
    }

    try {
      const rawBody = await readRequestBody(request);
      const donation = normalizeDonation(JSON.parse(rawBody || "{}"));
      donations.unshift(donation);
      await persistDonations();

      const snapshot = buildSnapshot();
      broadcast("donation", { donation, snapshot });
      sendJson(response, 201, { ok: true, donation });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }

    return true;
  }

  return false;
}

async function serveStaticFile(response, filePath) {
  const fileInfo = await stat(filePath);

  if (!fileInfo.isFile()) {
    throw new Error("Not a file");
  }

  response.writeHead(200, {
    "content-type": mimeTypes.get(path.extname(filePath)) || "application/octet-stream"
  });

  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (await handleApi(request, response, url)) {
    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(path.join(projectRoot, requestedPath));

  if (!safePath.startsWith(projectRoot)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    await serveStaticFile(response, safePath);
  } catch (error) {
    sendJson(response, 404, { error: "Not found" });
  }
});

setInterval(() => {
  for (const response of sseClients) {
    response.write(": keepalive\n\n");
  }
}, 25_000);

server.listen(port, host, () => {
  console.log(`Voidforge Shrine is listening on ${host}:${port}`);

  if (publicUrl) {
    console.log(`Public URL: ${publicUrl.replace(/\/+$/, "")}`);
  }

  console.log("Donation webhook secret loaded.");
});

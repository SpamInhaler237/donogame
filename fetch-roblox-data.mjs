import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const USERNAME = "1_xLow";
const GAME_NAME = "40 percent method";
const SITE_TITLE = "Voidforge Shrine";
const FREE_CLICK_DAMAGE = 1;
const PLS_DONATE_URL = "https://www.roblox.com/games/8737602449/PLS-DONATE";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const assetsDir = path.join(projectRoot, "assets");
const robloxDir = path.join(projectRoot, "roblox");
const jsonOutputPath = path.join(assetsDir, "game-data.json");
const jsOutputPath = path.join(assetsDir, "data.js");
const luaOutputPath = path.join(robloxDir, "GamepassDamageMap.lua");

const numberFormatter = new Intl.NumberFormat("en-US");

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.json();
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseNumericValue(value) {
  const match = String(value ?? "").match(/[\d,]+/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[0].replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchUser(username) {
  const payload = {
    usernames: [username],
    excludeBannedUsers: false
  };

  const data = await fetchJson("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const user = data.data?.[0];

  if (!user) {
    throw new Error(`Could not find Roblox user "${username}".`);
  }

  return user;
}

async function fetchGameForUser(userId, gameName) {
  const data = await fetchJson(
    `https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&sortOrder=Asc&limit=50`
  );

  const normalizedTarget = normalizeText(gameName);
  const match =
    data.data?.find((game) => normalizeText(game.name) === normalizedTarget) ??
    data.data?.find((game) => normalizeText(game.name).includes(normalizedTarget));

  if (!match) {
    throw new Error(`Could not find a public game named "${gameName}" for user ${userId}.`);
  }

  return match;
}

async function fetchUniverseDetails(universeId) {
  const data = await fetchJson(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
  const game = data.data?.[0];

  if (!game) {
    throw new Error(`Could not load universe details for ${universeId}.`);
  }

  return game;
}

async function fetchGamePasses(universeId) {
  const data = await fetchJson(
    `https://apis.roproxy.com/game-passes/v1/universes/${universeId}/game-passes`
  );

  return data.gamePasses ?? [];
}

async function fetchProductInfo(passId) {
  return fetchJson(`https://apis.roproxy.com/game-passes/v1/game-passes/${passId}/product-info`);
}

async function fetchPassThumbnails(passIds) {
  if (!passIds.length) {
    return new Map();
  }

  const data = await fetchJson(
    `https://thumbnails.roblox.com/v1/assets?assetIds=${passIds.join(",")}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`
  );

  return new Map((data.data ?? []).map((item) => [item.targetId, item.imageUrl]));
}

async function fetchGameIcon(universeId) {
  const data = await fetchJson(
    `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`
  );

  return data.data?.[0]?.imageUrl ?? "";
}

function buildPasses(rawPasses, productInfoByPassId, thumbnailByPassId) {
  const duplicateCountByDamage = new Map();

  const passes = rawPasses
    .map((pass) => {
      const productInfo = productInfoByPassId.get(pass.id);
      const priceInRobux =
        productInfo?.PriceInRobux ??
        parseNumericValue(pass.displayName) ??
        parseNumericValue(pass.name);
      const damage = Number.isFinite(priceInRobux) ? priceInRobux : 0;
      const baseName = pass.displayName || pass.name || `${damage} damage pass`;

      return {
        id: pass.id,
        productId: pass.productId,
        name: baseName,
        slug: slugify(baseName) || `game-pass-${pass.id}`,
        priceInRobux: damage,
        damage,
        sales: productInfo?.Sales ?? 0,
        isForSale: Boolean(productInfo?.IsForSale ?? pass.isForSale),
        imageUrl: thumbnailByPassId.get(pass.id) ?? "",
        created: pass.created,
        updated: pass.updated
      };
    })
    .sort((left, right) => {
      if (left.priceInRobux !== right.priceInRobux) {
        return left.priceInRobux - right.priceInRobux;
      }

      return left.id - right.id;
    });

  for (const pass of passes) {
    duplicateCountByDamage.set(pass.damage, (duplicateCountByDamage.get(pass.damage) ?? 0) + 1);
  }

  const seenByDamage = new Map();

  return passes.map((pass) => {
    const duplicateTotal = duplicateCountByDamage.get(pass.damage) ?? 1;
    const duplicateIndex = (seenByDamage.get(pass.damage) ?? 0) + 1;
    seenByDamage.set(pass.damage, duplicateIndex);

    return {
      ...pass,
      duplicateIndex,
      duplicateTotal,
      url: `https://www.roblox.com/game-pass/${pass.id}`,
      label:
        duplicateTotal > 1
          ? `${numberFormatter.format(pass.damage)} damage pass ${duplicateIndex}/${duplicateTotal}`
          : `${numberFormatter.format(pass.damage)} damage pass`
    };
  });
}

async function main() {
  await mkdir(assetsDir, { recursive: true });
  await mkdir(robloxDir, { recursive: true });

  const user = await fetchUser(USERNAME);
  const game = await fetchGameForUser(user.id, GAME_NAME);
  const universeDetails = await fetchUniverseDetails(game.id);
  const rawPasses = await fetchGamePasses(game.id);

  const productInfoEntries = await Promise.all(
    rawPasses.map(async (pass) => {
      try {
        return [pass.id, await fetchProductInfo(pass.id)];
      } catch (error) {
        return [pass.id, null];
      }
    })
  );

  const productInfoByPassId = new Map(productInfoEntries);
  const thumbnailByPassId = await fetchPassThumbnails(rawPasses.map((pass) => pass.id));
  const passes = buildPasses(rawPasses, productInfoByPassId, thumbnailByPassId);
  const totalDamageIfAllPassesOwned = passes.reduce((sum, pass) => sum + pass.damage, 0);
  const highestDamagePass = passes[passes.length - 1] ?? null;
  const lowestDamagePass = passes[0] ?? null;
  const gameIconUrl = await fetchGameIcon(game.id);

  const output = {
    generatedAt: new Date().toISOString(),
    site: {
      title: SITE_TITLE,
      tagline: "Forge free damage with clicks, then gift @1_xLow for permanent boss power.",
      donationHubName: "PLS DONATE",
      donationHubUrl: PLS_DONATE_URL
    },
    formula: "Free mode: 1 click = 1 damage. Gift mode: 1 Robux = 1 permanent damage.",
    freeTrack: {
      baseDamage: 0,
      clickDamage: FREE_CLICK_DAMAGE,
      perks: [
        "Every click on the website adds 1 free preview damage to your run.",
        "Free players can keep building power without paying anything.",
        "Gifting @1_xLow in PLS DONATE adds matching permanent boss damage."
      ]
    },
    creator: {
      username: user.name,
      displayName: user.displayName,
      userId: user.id,
      profileUrl: `https://www.roblox.com/users/${user.id}/profile`
    },
    game: {
      universeId: game.id,
      placeId: universeDetails.rootPlaceId,
      name: universeDetails.name.trim(),
      description: universeDetails.description,
      visits: universeDetails.visits,
      playing: universeDetails.playing,
      iconUrl: gameIconUrl,
      trackedUrl: `https://www.roblox.com/games/${universeDetails.rootPlaceId}/${slugify(
        universeDetails.name
      )}`
    },
    summary: {
      totalPasses: passes.length,
      totalDamageIfAllPassesOwned,
      highestDamage: highestDamagePass?.damage ?? 0,
      lowestDamage: lowestDamagePass?.damage ?? 0
    },
    passes
  };

  await writeFile(jsonOutputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  await writeFile(
    jsOutputPath,
    `window.RPG_DATA = ${JSON.stringify(output, null, 2)};\n`,
    "utf8"
  );
  await writeFile(
    luaOutputPath,
    `${[
      "-- Generated by scripts/fetch-roblox-data.mjs",
      "local GamepassDamageMap = {",
      ...passes.map((pass) => `  [${pass.id}] = ${pass.damage},`),
      "}",
      "",
      "return GamepassDamageMap",
      ""
    ].join("\n")}`,
    "utf8"
  );

  console.log(
    `Saved ${passes.length} gamepasses for ${output.game.name} to ${path.relative(projectRoot, jsOutputPath)}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// One-time move of a local Oread into a hosted account:
//
//   node scripts/importLocalData.js --email you@example.com [--data path/to/data]
//
// Needs DATABASE_URL and OREAD_SECRET_KEY (the same values the hosted server uses, read from
// backend/.env when it exists). The account must already exist and have signed in once, so its
// encryption is set up; the script asks for the account's password to unlock it, because
// everything it writes is sealed with the account's own key. The local JSON files are only
// read, never changed, and running it twice is safe: stories and chats are replaced by id.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { loadConfig } from "../src/config.js";
import { loadEnvironmentFile } from "../src/loadEnvironmentFile.js";
import { loadLore } from "../src/lore/loadLore.js";
import { createPrismaClient } from "../src/storage/prisma/prismaClient.js";
import { createSecretCipher } from "../src/security/secretCipher.js";
import { createDatabaseStorage } from "../src/tenancy/databaseStorage.js";
import { unwrapWithPassword } from "../src/security/userVault.js";
import { prepareLocalImport, importLocalData } from "../src/importer/importLocalData.js";

const DOCUMENT_NAMES = ["stories", "chats", "personality", "memoryIndex", "settings"];

function readArguments() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, data: { type: "string" } },
  });
  if (!values.email) {
    throw new Error("Pass the account's email: --email you@example.com");
  }
  return values;
}

async function readDocument(dataDirectory, name) {
  try {
    return JSON.parse(await readFile(path.join(dataDirectory, `${name}.json`), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function readDocuments(dataDirectory) {
  const documents = {};
  for (const name of DOCUMENT_NAMES) {
    documents[name] = await readDocument(dataDirectory, name);
  }
  return documents;
}

function requireHostedSettings(config) {
  if (!config.databaseUrl || !config.secretKey) {
    throw new Error("Set DATABASE_URL and OREAD_SECRET_KEY to the hosted server's values.");
  }
}

async function findUserId(prisma, email) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    throw new Error(`No account uses ${email}. Sign up in the app first, then run this again.`);
  }
  return user.id;
}

// Reads a line from the terminal without echoing it.
function askHidden(question) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  terminal._writeToOutput = (text) => {
    if (text.includes(question)) {
      process.stdout.write(text);
    }
  };
  return new Promise((resolve) => {
    terminal.question(question, (answer) => {
      terminal.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function unlockDataKey(prisma, userId) {
  const vault = await prisma.userVault.findUnique({ where: { userId } });
  if (!vault) {
    throw new Error("Sign in to the app once first, so the account's encryption is set up.");
  }
  const password = await askHidden("Account password: ");
  const dataKey = await unwrapWithPassword({ userId, wrap: vault.passwordWrap, password });
  if (!dataKey) {
    throw new Error("That password doesn't open the account's data.");
  }
  return dataKey;
}

async function main() {
  const { email, data } = readArguments();
  loadEnvironmentFile();
  const config = loadConfig();
  requireHostedSettings(config);
  const lore = loadLore(config.lorePath);
  const prisma = createPrismaClient(config.databaseUrl);
  try {
    const userId = await findUserId(prisma, email);
    const dataKey = await unlockDataKey(prisma, userId);
    const documents = await readDocuments(data ?? config.dataDir);
    const prepared = prepareLocalImport({ lore, documents, now: Date.now, newId: randomUUID });
    const storage = createDatabaseStorage({
      prisma,
      userId,
      dataKey,
      lore,
      cipher: createSecretCipher(config.secretKey),
      claimsInProcess: new Set(),
      now: Date.now,
      newId: randomUUID,
    });
    const counts = await importLocalData({ storage, prepared });
    console.log(`Imported into ${email}:`, counts);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

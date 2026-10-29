// Puts hosted mode together: the database, encrypted keys, accounts and email, and services
// built per signed-in user. Provider keys come only from each user's own settings (never from
// the server's environment), and provider base URLs are checked so no one can aim the server at
// internal addresses.
import { randomUUID } from "node:crypto";
import { createServices } from "../services/createServices.js";
import { createSecretCipher } from "../security/secretCipher.js";
import { createOutboundUrlGuard } from "../security/outboundUrlGuard.js";
import { createAuth } from "../auth/createAuth.js";
import { createDatabaseStorage } from "./databaseStorage.js";
import { createHostedTenancy } from "./hostedTenancy.js";

// No environment-variable fallback for provider keys in hosted mode.
const NO_SERVER_PROVIDER_KEYS = Object.freeze({});

// `serviceOptions` are the parts every user shares: providers, story templates, story config,
// emotion classifier and embedder.
export function createHostedSetup({
  config,
  lore,
  prisma,
  mailer,
  serviceOptions = {},
  outboundUrlGuard = createOutboundUrlGuard(),
  now = Date.now,
  newId = randomUUID,
}) {
  const cipher = createSecretCipher(config.secretKey);
  // Chats with a reply being written by this process, as "userId:chatId".
  const claimsInProcess = new Set();

  function storageForUser(userId) {
    return createDatabaseStorage({ prisma, userId, lore, cipher, claimsInProcess, now, newId });
  }

  function servicesForUser(userId) {
    return createServices({
      ...serviceOptions,
      lore,
      storage: storageForUser(userId),
      env: NO_SERVER_PROVIDER_KEYS,
      checkProviderConfig: outboundUrlGuard.checkProviderConfig,
      now,
      newId,
    });
  }

  async function ensureUserSetup(userId) {
    await storageForUser(userId).migration.ensureMigrated();
  }

  const auth = createAuth({ prisma, config, mailer, onUserCreated: ensureUserSetup });
  const tenancy = createHostedTenancy({ auth, servicesForUser });
  return { tenancy, auth, storageForUser, servicesForUser, ensureUserSetup };
}

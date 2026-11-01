// Puts hosted mode together: the database, accounts and email, each user's encrypted data and
// the vault that unlocks it, and services built per signed-in, unlocked user. Provider keys
// come only from each user's own settings (never from the server's environment), and provider
// base URLs are checked so no one can aim the server at internal addresses.
import { randomUUID } from "node:crypto";
import { fromNodeHeaders } from "better-auth/node";
import { badRequest } from "../http/errors.js";
import { createVaultService } from "../services/vaultService.js";
import { createVaultRoutes } from "../routes/vault.js";
import { createPrismaVaultStore } from "../storage/prisma/prismaVaultStore.js";
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

  // `dataKey` is the user's unlocked data key (security/userVault.js).
  function storageForUser(userId, dataKey) {
    return createDatabaseStorage({
      prisma,
      userId,
      dataKey,
      lore,
      cipher,
      claimsInProcess,
      now,
      newId,
    });
  }

  function servicesForUser(userId, dataKey) {
    return createServices({
      ...serviceOptions,
      lore,
      storage: storageForUser(userId, dataKey),
      env: NO_SERVER_PROVIDER_KEYS,
      checkProviderConfig: outboundUrlGuard.checkProviderConfig,
      now,
      newId,
    });
  }

  // My story isn't made at sign-up any more: it has to be sealed with the user's key, which
  // exists only once they unlock. The first unlocked request makes it (storage's migration).
  const vault = createVaultService({
    vaultStore: createPrismaVaultStore({ prisma, legacyCipher: cipher }),
  });
  const auth = createAuth({ prisma, config, mailer, vault });

  async function verifyPassword(request, password) {
    try {
      await auth.api.verifyPassword({
        body: { password },
        headers: fromNodeHeaders(request.headers),
      });
    } catch {
      throw badRequest("That password isn't right.", { field: "password" });
    }
  }

  const tenancy = createHostedTenancy({
    auth,
    servicesForUser,
    vault,
    vaultRoutes: createVaultRoutes({ vault, verifyPassword }),
    isSecure: Boolean(config.useSecureCookies),
  });
  return { tenancy, auth, vault, storageForUser, servicesForUser };
}

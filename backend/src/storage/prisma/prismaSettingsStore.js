// One user's settings in the database. Ordinary settings are one JSON row, sealed with the user's
// data key; each provider key is its own row, encrypted with the same key and bound to the user,
// provider and field it belongs to. Keys saved before data keys existed were encrypted with the
// server's key (`legacyCipher`); they still read, and are re-encrypted the next time settings
// are written. Same shape as the document settings store: read() → settings, write(settings).
import { SECRET_FIELDS } from "../../services/settingsDefaults.js";

export const SETTINGS_PLACE = "settings";

function secretContext(userId, provider, field) {
  return `${userId}:${provider}:${field}`;
}

// Splits settings into the plain part and a list of { provider, field, value } secrets.
function separateSecrets(settings) {
  const plainSettings = structuredClone(settings);
  const secrets = [];
  for (const [provider, fields] of Object.entries(SECRET_FIELDS)) {
    for (const field of fields) {
      const value = plainSettings[provider]?.[field];
      if (plainSettings[provider]) {
        delete plainSettings[provider][field];
      }
      secrets.push({ provider, field, value: value ?? "" });
    }
  }
  return { plainSettings, secrets };
}

// Tries the user's data key first, then the server key the value may still be under.
function decryptSecret({ secretRow, context, cipher, legacyCipher }) {
  try {
    return cipher.decrypt(secretRow, context);
  } catch (error) {
    if (!legacyCipher) {
      throw error;
    }
    return legacyCipher.decrypt(secretRow, context);
  }
}

// `sealer` seals with the user's data key (its `cipher` encrypts the provider keys).
export function createPrismaSettingsStore({ prisma, userId, sealer, legacyCipher }) {
  const cipher = sealer.cipher;

  async function read() {
    const row = await prisma.userSettings.findUnique({ where: { userId } });
    const secretRows = await prisma.providerSecret.findMany({ where: { userId } });
    if (!row && secretRows.length === 0) {
      return null;
    }
    const settings = structuredClone(sealer.open(row?.data ?? {}, SETTINGS_PLACE));
    for (const secretRow of secretRows) {
      const context = secretContext(userId, secretRow.provider, secretRow.field);
      settings[secretRow.provider] ??= {};
      settings[secretRow.provider][secretRow.field] = decryptSecret({
        secretRow,
        context,
        cipher,
        legacyCipher,
      });
    }
    return settings;
  }

  function secretWrite(transaction, { provider, field, value }) {
    const where = { userId_provider_field: { userId, provider, field } };
    if (!value) {
      return transaction.providerSecret.deleteMany({ where: { userId, provider, field } });
    }
    const sealed = cipher.encrypt(value, secretContext(userId, provider, field));
    return transaction.providerSecret.upsert({
      where,
      create: { userId, provider, field, ...sealed },
      update: sealed,
    });
  }

  async function write(settings) {
    const { plainSettings, secrets } = separateSecrets(settings);
    const sealedSettings = sealer.seal(plainSettings, SETTINGS_PLACE);
    await prisma.$transaction(async (transaction) => {
      await transaction.userSettings.upsert({
        where: { userId },
        create: { userId, data: sealedSettings },
        update: { data: sealedSettings },
      });
      for (const secret of secrets) {
        await secretWrite(transaction, secret);
      }
    });
  }

  return { read, write };
}

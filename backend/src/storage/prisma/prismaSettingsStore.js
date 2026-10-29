// One user's settings in the database. Ordinary settings are one JSON row; each provider key is
// its own row, encrypted (security/secretCipher.js) and bound to the user, provider and field it
// belongs to. Same shape as the document settings store: read() → settings, write(settings).
import { SECRET_FIELDS } from "../../services/settingsDefaults.js";

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

export function createPrismaSettingsStore({ prisma, userId, cipher }) {
  async function read() {
    const row = await prisma.userSettings.findUnique({ where: { userId } });
    const secretRows = await prisma.providerSecret.findMany({ where: { userId } });
    if (!row && secretRows.length === 0) {
      return null;
    }
    const settings = structuredClone(row?.data ?? {});
    for (const secretRow of secretRows) {
      const context = secretContext(userId, secretRow.provider, secretRow.field);
      settings[secretRow.provider] ??= {};
      settings[secretRow.provider][secretRow.field] = cipher.decrypt(secretRow, context);
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
    await prisma.$transaction(async (transaction) => {
      await transaction.userSettings.upsert({
        where: { userId },
        create: { userId, data: plainSettings },
        update: { data: plainSettings },
      });
      for (const secret of secrets) {
        await secretWrite(transaction, secret);
      }
    });
  }

  return { read, write };
}

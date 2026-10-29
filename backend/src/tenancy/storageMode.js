// Chooses how Oread runs:
// - local: one person, data in JSON files under backend/data, no login (the default).
// - hosted: many accounts, data in Postgres through Prisma, sign-in with Better Auth. Chosen
//   when DATABASE_URL is set and OREAD_MULTI_TENANT=true; every hosted setting must then be set.
export const LOCAL_MODE = "local";
export const HOSTED_MODE = "hosted";

const HOSTED_REQUIREMENTS = [
  ["secretKey", "OREAD_SECRET_KEY"],
  ["authSecret", "BETTER_AUTH_SECRET"],
  ["resendApiKey", "RESEND_API_KEY"],
  ["mailFrom", "OREAD_MAIL_FROM"],
  ["hasPublicUrlSetting", "OREAD_PUBLIC_URL"],
];

export function missingHostedSettings(config) {
  const missing = HOSTED_REQUIREMENTS.filter(([field]) => !config[field]);
  return missing.map(([, variableName]) => variableName);
}

// Sign-in and email links need a full address. Without this check a value like
// "oread.onrender.com" only fails later, deep inside Better Auth.
function checkPublicUrl(publicUrl) {
  let url;
  try {
    url = new URL(publicUrl);
  } catch {
    url = null;
  }
  const hasWebProtocol = url?.protocol === "https:" || url?.protocol === "http:";
  if (!hasWebProtocol) {
    throw new Error(
      "OREAD_PUBLIC_URL must be a full address starting with https://, such as " +
        `https://oread.onrender.com (it is "${publicUrl}").`,
    );
  }
}

export function storageModeFor(config) {
  if (!config.databaseUrl || !config.isMultiTenant) {
    return LOCAL_MODE;
  }
  const missing = missingHostedSettings(config);
  if (missing.length) {
    throw new Error(`Hosted mode needs these environment variables: ${missing.join(", ")}.`);
  }
  checkPublicUrl(config.publicUrl);
  return HOSTED_MODE;
}

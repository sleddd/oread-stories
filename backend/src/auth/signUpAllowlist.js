// Who may create an account on a hosted Oread. The list comes from OREAD_SIGNUP_ALLOWLIST:
// comma-separated email addresses, and "@domain" entries that let in a whole domain
// ("ana@example.com, @minnowpress.com"). Matching ignores capitals and spaces. An empty list lets
// nobody sign up: Oread is invite-only unless you say who's invited. People who already have an
// account can always sign in.

const DOMAIN_MARKER = "@";

function normalize(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase();
}

function domainOf(email) {
  const atIndex = email.lastIndexOf(DOMAIN_MARKER);
  if (atIndex <= 0) {
    return "";
  }
  return email.slice(atIndex);
}

// "ana@example.com, @minnowpress.com" → { emails: Set, domains: Set }
export function parseSignUpAllowlist(commaSeparatedEntries) {
  const entries = String(commaSeparatedEntries ?? "").split(",");
  const emails = new Set();
  const domains = new Set();
  for (const entry of entries) {
    const normalized = normalize(entry);
    if (!normalized) {
      continue;
    }
    if (normalized.startsWith(DOMAIN_MARKER)) {
      domains.add(normalized);
    } else {
      emails.add(normalized);
    }
  }
  return { emails, domains };
}

export function isAllowedToSignUp(allowlist, email) {
  const normalizedEmail = normalize(email);
  if (!normalizedEmail) {
    return false;
  }
  if (allowlist.emails.has(normalizedEmail)) {
    return true;
  }
  const domain = domainOf(normalizedEmail);
  return domain !== "" && allowlist.domains.has(domain);
}

// The cookie that holds a session's unlock key (security/userVault.js). HTTP-only, so page
// scripts can't read it; it outlives the session on purpose, since the session's copy of the
// data key is deleted with the session and the cookie then opens nothing.
export const UNLOCK_COOKIE_NAME = "oread_unlock";
const UNLOCK_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// The attributes as Better Auth's setCookie takes them, for unlocking during sign-in.
export function unlockCookieAttributes({ isSecure }) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: UNLOCK_COOKIE_MAX_AGE_SECONDS,
  };
}

// A Set-Cookie header value, for unlocking through Oread's own routes.
export function serializeUnlockCookie(cookieValue, { isSecure }) {
  const parts = [
    `${UNLOCK_COOKIE_NAME}=${cookieValue}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${UNLOCK_COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (isSecure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function readUnlockCookie(cookieHeader) {
  const pairs = String(cookieHeader ?? "").split(";");
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }
    const name = pair.slice(0, separatorIndex).trim();
    if (name === UNLOCK_COOKIE_NAME) {
      return pair.slice(separatorIndex + 1).trim();
    }
  }
  return null;
}

// The account emails Oread sends: confirming an address and resetting a password. Each returns
// { to, subject, text, html } for a mailer. Links are written out in full in the text version,
// since some mail apps show only that.
const APP_NAME = "Oread";

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function greetingFor(name) {
  if (name) {
    return `Hi ${name},`;
  }
  return "Hi,";
}

function emailWithLink({ to, name, subject, intro, linkLabel, url, outro }) {
  const greeting = greetingFor(name);
  const text = [greeting, "", intro, "", url, "", outro, "", `— ${APP_NAME}`].join("\n");
  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(intro)}</p>`,
    `<p><a href="${escapeHtml(url)}">${escapeHtml(linkLabel)}</a></p>`,
    `<p>${escapeHtml(outro)}</p>`,
    `<p>— ${APP_NAME}</p>`,
  ].join("\n");
  return { to, subject, text, html };
}

export function verificationEmail({ user, url }) {
  return emailWithLink({
    to: user.email,
    name: user.name,
    subject: `Confirm your email for ${APP_NAME}`,
    intro: `Confirm this address to finish setting up your ${APP_NAME} account.`,
    linkLabel: "Confirm my email",
    url,
    outro: "If you didn't sign up, you can ignore this email.",
  });
}

export function passwordResetEmail({ user, url }) {
  return emailWithLink({
    to: user.email,
    name: user.name,
    subject: `Reset your ${APP_NAME} password`,
    intro:
      "Someone asked to reset the password for this account. Use this link to choose a new one.",
    linkLabel: "Choose a new password",
    url,
    outro: "If it wasn't you, ignore this email and your password stays the same.",
  });
}

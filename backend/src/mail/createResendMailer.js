// Sends email through Resend. A mailer is { send({ to, subject, text, html }) }; tests use a
// fake one that only records what would have been sent.
import { Resend } from "resend";

export function createResendMailer({ apiKey, from }) {
  const resend = new Resend(apiKey);

  async function send({ to, subject, text, html }) {
    const { error } = await resend.emails.send({ from, to, subject, text, html });
    if (error) {
      throw new Error(`Resend couldn't send "${subject}" to ${to}: ${error.message}`);
    }
  }

  return { send };
}

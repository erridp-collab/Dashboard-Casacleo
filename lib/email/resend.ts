import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY non configurata in .env.local");
  return new Resend(key);
}

function getFromEmail() {
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (from) {
    return from;
  }

  if (process.env.NODE_ENV !== "production") {
    return "onboarding@resend.dev";
  }

  throw new Error(
    "RESEND_FROM_EMAIL non configurata in produzione. " +
    "Configurare un mittente verificato su Resend.",
  );
}

export type CleaningReminderParams = {
  to: string;
  hostName: string;
  date: string;
  cleaningActionsHtml: string;
};

export async function sendCleaningReminder(params: CleaningReminderParams): Promise<string> {
  const { to, hostName, date, cleaningActionsHtml } = params;

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Riepilogo Pulizie: ${date}</title>
</head>
<body style="margin:0;padding:0;background:#fefce8;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:560px;width:100%;border:1px solid #fde047;">
          <tr>
            <td style="background:#701a2f;padding:28px 32px;">
              <p style="margin:0;color:#fefce8;font-size:20px;font-weight:700;">Alva Host Manager</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18181b;">Riepilogo Pulizie</p>
              <p style="margin:0 0 28px;font-size:15px;color:#71717a;line-height:1.5;">
                Ciao <strong>${hostName}</strong>, ecco le pulizie programmate per il giorno <strong>${date}</strong>:
              </p>

              <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:16px;margin-bottom:28px;">
                ${cleaningActionsHtml}
              </div>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://host.alva.land"}/actions" style="display:inline-block;background:#701a2f;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;">
                      Apri il Gestionale
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Questa email è stata inviata automaticamente dal tuo gestionale Alva Host.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const response = await getResend().emails.send({
    from: getFromEmail(),
    to,
    subject: `Riepilogo Pulizie - ${date}`,
    html,
  });

  if (response.error || !response.data?.id) {
    const reason = response.error?.message ?? "Invio email fallito senza dettagli.";
    throw new Error(`[sendCleaningReminder] ${reason}`);
  }

  return response.data.id;
}

export type SignupRequestNotificationParams = {
  email: string;
  fullName: string | null;
  organizationName: string;
};

export async function sendSignupRequestNotification(params: SignupRequestNotificationParams): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return;

  const { email, fullName, organizationName } = params;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://host.alva.land";

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nuova richiesta accesso</title>
</head>
<body style="margin:0;padding:0;background:#f4ede6;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4ede6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:560px;width:100%;border:1px solid #e7dfd2;">
          <tr>
            <td style="background:#5c1526;padding:28px 32px;">
              <p style="margin:0;color:#f5c842;font-size:20px;font-weight:700;">Alva Host Manager</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#18181b;">Nuova richiesta accesso</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdfaf7;border:1px solid #e7dfd2;border-radius:10px;padding:0;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e7dfd2;">
                    <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#7a6a58;">Email</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#18181b;">${email}</p>
                  </td>
                </tr>
                ${fullName ? `<tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e7dfd2;">
                    <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#7a6a58;">Nome</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#18181b;">${fullName}</p>
                  </td>
                </tr>` : ""}
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#7a6a58;">Organizzazione</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#18181b;">${organizationName}</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${siteUrl}/platform/requests" style="display:inline-block;background:#b52858;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;">
                      Gestisci richiesta →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e7dfd2;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Notifica automatica — Alva Host Manager
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const response = await getResend().emails.send({
    from: getFromEmail(),
    to: adminEmail,
    subject: `Nuova richiesta accesso — ${organizationName}`,
    html,
  });

  if (response.error) {
    console.error("[sendSignupRequestNotification] failed:", response.error.name, response.error.message, JSON.stringify(response.error));
  }
}

export type WelcomeEmailParams = {
  email: string;
  fullName: string | null;
  organizationName: string;
  setPasswordUrl: string;
  siteUrl: string;
};

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
  const { email, fullName, organizationName, setPasswordUrl, siteUrl } = params;

  // ── TESTI PERSONALIZZABILI ──────────────────────────────────────────────────
  const SUBJECT = `Benvenuto su Alva Host Manager — ${organizationName}`;
  const HEADLINE = "Il tuo account è pronto";
  const INTRO = fullName
    ? `Ciao <strong>${fullName}</strong>, la tua richiesta di accesso è stata approvata.`
    : "La tua richiesta di accesso è stata approvata.";
  const BODY =
    "Clicca il pulsante qui sotto per impostare la tua password e iniziare a usare il gestionale. Il link è valido per 24 ore.";
  const CTA_LABEL = "Imposta la tua password →";
  const FOOTER = "Se non hai richiesto tu l'accesso, ignora questa email.";
  // ───────────────────────────────────────────────────────────────────────────

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#fefce8;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:560px;width:100%;border:1px solid #fde047;">
          <tr>
            <td style="background:#701a2f;padding:28px 32px;">
              <p style="margin:0;color:#fde047;font-size:20px;font-weight:700;">Alva Host Manager</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18181b;">${HEADLINE}</p>
              <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.6;">${INTRO}</p>
              <p style="margin:0 0 28px;font-size:15px;color:#3f3f46;line-height:1.6;">${BODY}</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${setPasswordUrl}" style="display:inline-block;background:#701a2f;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;">
                      ${CTA_LABEL}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
                Oppure copia questo link nel browser:<br />
                <a href="${setPasswordUrl}" style="color:#701a2f;word-break:break-all;">${setPasswordUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #fde047;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">${FOOTER}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const response = await getResend().emails.send({
    from: getFromEmail(),
    to: email,
    subject: SUBJECT,
    html,
  });

  if (response.error) {
    throw new Error(`[sendWelcomeEmail] ${response.error.message}`);
  }
}

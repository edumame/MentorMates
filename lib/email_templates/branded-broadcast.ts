// On-brand MentorMates email template.
//
// Reconstructed from the MentorMates brand spec (app/globals.css Figma tokens):
//   Font        Inter (system-ui fallback)
//   Brand blue  #4B89EF  (--primary = 217 84% 62%)
//   Body text   #18181B   Muted #7F7F7F
//   Surfaces    Pattens Blue #F7FAFE with #DBEAFE borders
//   Radius      16px container / 8px buttons
//   Promo code  white pill, 2px #4B89EF border, blue bold monospace
//   Footer      mentormate.png logo + eventHighlights/event1-6 photos
//
// Unlike the older templates in this folder (Arial / #2563eb), this one matches
// the current brand. Use getBrandedBroadcastEmail for any custom broadcast, or
// getHackathonAlumniReengagementEmail for the alumni re-engagement campaign.

export interface EmailTemplate {
  subject: string;
  html: string;
}

const BRAND = {
  blue: "#4B89EF",
  body: "#18181B",
  muted: "#7F7F7F",
  surface: "#F7FAFE",
  border: "#DBEAFE",
  white: "#FFFFFF",
  font: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  logo: "https://www.mentormates.ai/mentormate.png",
  eventPhotos: [1, 2, 3, 4, 5, 6].map(
    (n) => `https://www.mentormates.ai/eventHighlights/event${n}.png`
  ),
} as const;

export interface BrandedBroadcastOptions {
  /** First name used for a personalized greeting. Omitted → "Hi there,". */
  recipientName?: string;
  /** Optional call-to-action button. */
  cta?: { label: string; url: string };
  /** Optional promo code rendered as a highlighted pill. */
  promoCode?: string;
  /** Sign-off name. Defaults to "The MentorMates Team". */
  signOff?: string;
  /** Whether to render the event-highlights photo strip in the footer. */
  showEventPhotos?: boolean;
}

function greeting(name?: string): string {
  const who = name?.trim() ? escapeHtml(name.trim()) : "there";
  return `Hi ${who},`;
}

function ctaButton(cta?: { label: string; url: string }): string {
  if (!cta) return "";
  return `
        <div style="margin: 28px 0;">
          <a href="${cta.url}" style="display: inline-block; background-color: ${BRAND.blue}; color: ${BRAND.white}; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            ${escapeHtml(cta.label)}
          </a>
        </div>`;
}

function promoPill(code?: string): string {
  if (!code) return "";
  return `
        <div style="margin: 28px 0; text-align: center;">
          <span style="display: inline-block; background-color: ${BRAND.white}; border: 2px solid ${BRAND.blue}; border-radius: 8px; padding: 12px 20px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-weight: 700; font-size: 18px; color: ${BRAND.blue}; letter-spacing: 1px;">
            ${escapeHtml(code)}
          </span>
        </div>`;
}

function eventPhotoStrip(): string {
  const cells = BRAND.eventPhotos
    .map(
      (src) =>
        `<td style="padding: 3px; width: 33.33%;"><img src="${src}" alt="MentorMates hackathon" width="100%" style="display: block; width: 100%; border-radius: 8px;" /></td>`
    )
    .reduce<string[][]>((rows, cell, i) => {
      if (i % 3 === 0) rows.push([]);
      rows[rows.length - 1].push(cell);
      return rows;
    }, [])
    .map((row) => `<tr>${row.join("")}</tr>`)
    .join("");

  return `
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; border-collapse: collapse;">
            ${cells}
          </table>`;
}

/**
 * Wraps arbitrary body HTML in the on-brand MentorMates shell:
 * logo header, Pattens-Blue card, sign-off, and (optionally) the event photos.
 */
function renderShell(bodyHtml: string, options: BrandedBroadcastOptions): string {
  const signOff = escapeHtml(options.signOff ?? "The MentorMates Team");
  return `
    <div style="background-color: ${BRAND.surface}; padding: 32px 16px; font-family: ${BRAND.font};">
      <div style="max-width: 600px; margin: 0 auto; background-color: ${BRAND.white}; border: 1px solid ${BRAND.border}; border-radius: 16px; overflow: hidden;">

        <div style="padding: 28px 32px 0;">
          <img src="${BRAND.logo}" alt="MentorMates" height="36" style="display: block; height: 36px;" />
        </div>

        <div style="padding: 24px 32px 8px; font-size: 16px; line-height: 1.6; color: ${BRAND.body};">
          ${bodyHtml}
        </div>

        <div style="padding: 8px 32px 28px;">
          <p style="font-size: 16px; line-height: 1.6; color: ${BRAND.body}; margin: 0 0 4px;">Warmly,</p>
          <p style="font-size: 16px; line-height: 1.6; color: ${BRAND.body}; font-weight: 700; margin: 0;">${signOff}</p>
        </div>

        ${options.showEventPhotos === false ? "" : `
        <div style="background-color: ${BRAND.surface}; border-top: 1px solid ${BRAND.border}; padding: 24px 32px;">
          <p style="font-size: 13px; color: ${BRAND.muted}; margin: 0 0 4px; text-align: center;">Moments from past MentorMates hackathons</p>
          ${eventPhotoStrip()}
        </div>`}

      </div>

      <p style="max-width: 600px; margin: 16px auto 0; text-align: center; font-size: 12px; color: ${BRAND.muted};">
        MentorMates · <a href="https://www.mentormates.ai" style="color: ${BRAND.muted};">mentormates.ai</a>
      </p>
    </div>`;
}

/**
 * On-brand replacement for getOrganizerCustomEmailTemplate — a personalized,
 * branded broadcast email. `message` may contain newlines (converted to <br>).
 */
export function getBrandedBroadcastEmail(
  subject: string,
  message: string,
  options: BrandedBroadcastOptions = {}
): EmailTemplate {
  const body = `
          <p style="margin: 0 0 16px;">${greeting(options.recipientName)}</p>
          <div style="margin: 0 0 8px; white-space: pre-wrap;">${escapeHtml(message).replace(/\n/g, "<br>")}</div>
          ${promoPill(options.promoCode)}
          ${ctaButton(options.cta)}`;

  return { subject, html: renderShell(body, options) };
}

/**
 * The hackathon-alumni re-engagement campaign email (the "email all 57 last-year
 * MentorMates hackathon alumni" send), rebuilt on the branded shell. Pass a
 * recipient first name for personalization and, optionally, a CTA + promo code.
 */
export function getHackathonAlumniReengagementEmail(
  recipientName: string,
  options: {
    cta?: { label: string; url: string };
    promoCode?: string;
    subject?: string;
  } = {}
): EmailTemplate {
  const subject =
    options.subject ?? "You built something great last year — round two?";

  const body = `
          <p style="margin: 0 0 16px;">${greeting(recipientName)}</p>
          <p style="margin: 0 0 16px;">
            Last year you showed up to the MentorMates Hackathon and <strong>shipped a real project</strong> — that still means a lot to us. We're pulling the alumni back together for what's next, and we'd love for you to be in the room again.
          </p>
          <p style="margin: 0 0 16px;">
            Whether you want to build, mentor a newer team, or just reconnect with the people you hacked alongside, there's a place for you. It starts with saying you're in.
          </p>
          ${promoPill(options.promoCode)}
          ${ctaButton(
            options.cta ?? {
              label: "Count me in",
              url: "https://www.mentormates.ai",
            }
          )}
          <p style="margin: 16px 0 0; color: ${BRAND.muted}; font-size: 14px;">
            Reply to this email if you'd rather just catch up first — a real person reads these.
          </p>`;

  return {
    subject,
    html: renderShell(body, { recipientName, signOff: "The MentorMates Team" }),
  };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

import { jsPDF } from "jspdf";

export type EvidenceLetterRole = "judge" | "mentor";

export interface EvidenceLetterData {
  recipientSalutation: string;
  recipientName: string;
  roleNoun: EvidenceLetterRole;
  serviceVerb: string;
  eventName: string;
  eventDate: string;
  attendanceText: string;
  serviceCountText: string;
  selectivityLanguage: string;
  praiseParagraph: string;
  organizerName: string;
  organizerRole: string;
  organizerOrg: string;
  /**
   * Base64 PNG data URL for the MentorMates wordmark logo. When provided,
   * the letterhead and footer use the logo image; otherwise they fall back
   * to a text wordmark. Loaded per-environment by the call site
   * (browser fetch on the client, fs.readFile on the server).
   */
  logoDataUrl?: string;
}

const LOGO_ASPECT_RATIO = 3516 / 359;
const LETTERHEAD_LOGO_WIDTH = 150;
const FOOTER_LOGO_WIDTH = 70;

export function roundDownToNearest50(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n / 50) * 50;
}

export function buildLetterBody(data: EvidenceLetterData): string[] {
  const roleNoun = data.roleNoun;
  return [
    `${data.recipientSalutation},`,
    "",
    `I am writing to validate that ${data.recipientName} served as a ${roleNoun} at ${data.eventName}, held on ${data.eventDate}, an event with ${data.attendanceText}. In this capacity, ${data.recipientName} personally ${data.serviceVerb} ${data.serviceCountText}.`,
    "",
    `${data.recipientName} ${data.selectivityLanguage}. ${data.praiseParagraph}`,
    "",
    "Sincerely,",
    "",
    data.organizerName,
    [data.organizerRole, data.organizerOrg].filter(Boolean).join(", "),
  ];
}

function drawLetterhead(
  doc: jsPDF,
  pageWidth: number,
  marginX: number,
  logoDataUrl?: string
): void {
  if (logoDataUrl) {
    const w = LETTERHEAD_LOGO_WIDTH;
    const h = w / LOGO_ASPECT_RATIO;
    try {
      doc.addImage(logoDataUrl, "PNG", marginX, 45, w, h);
    } catch (err) {
      console.error("Failed to draw letterhead logo, falling back to text", err);
      drawLetterheadTextFallback(doc, marginX);
    }
  } else {
    drawLetterheadTextFallback(doc, marginX);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("mentormates.ai", marginX, 80);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(marginX, 95, pageWidth - marginX, 95);

  doc.setTextColor(0, 0, 0);
}

function drawLetterheadTextFallback(doc: jsPDF, marginX: number): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text("MentorMates", marginX, 65);
}

function drawFooterOnAllPages(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  marginX: number,
  logoDataUrl?: string
): void {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(marginX, pageHeight - 60, pageWidth - marginX, pageHeight - 60);

    if (logoDataUrl) {
      const w = FOOTER_LOGO_WIDTH;
      const h = w / LOGO_ASPECT_RATIO;
      try {
        doc.addImage(
          logoDataUrl,
          "PNG",
          (pageWidth - w) / 2,
          pageHeight - 50,
          w,
          h
        );
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(160, 160, 160);
        doc.text(
          "Powered by MentorMates  ·  mentormates.ai",
          pageWidth / 2,
          pageHeight - 30,
          { align: "center" }
        );
        doc.setTextColor(0, 0, 0);
        continue;
      } catch (err) {
        console.error("Failed to draw footer logo, falling back to text", err);
      }
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text(
      "Powered by MentorMates  ·  mentormates.ai",
      pageWidth / 2,
      pageHeight - 42,
      { align: "center" }
    );
    doc.setTextColor(0, 0, 0);
  }
}

export function generateEvidenceLetterPdf(data: EvidenceLetterData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 72;
  const contentWidth = pageWidth - marginX * 2;
  const bodyTopY = 150;
  const bodyBottomY = pageHeight - 80;
  const { logoDataUrl } = data;

  drawLetterhead(doc, pageWidth, marginX, logoDataUrl);

  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text("Letter of Validation", pageWidth / 2, 130, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text(
    new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    marginX,
    bodyTopY
  );

  doc.setFontSize(12);
  let cursorY = bodyTopY + 30;
  const lineHeight = 16;

  buildLetterBody(data).forEach((paragraph) => {
    if (paragraph === "") {
      cursorY += lineHeight;
      return;
    }
    const wrapped = doc.splitTextToSize(paragraph, contentWidth);
    wrapped.forEach((line: string) => {
      if (cursorY > bodyBottomY) {
        doc.addPage();
        drawLetterhead(doc, pageWidth, marginX, logoDataUrl);
        cursorY = bodyTopY;
      }
      doc.text(line, marginX, cursorY);
      cursorY += lineHeight;
    });
  });

  drawFooterOnAllPages(doc, pageWidth, pageHeight, marginX, logoDataUrl);

  return doc;
}

export function safeFileName(input: string): string {
  return input
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "letter";
}

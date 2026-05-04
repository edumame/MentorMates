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
}

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

function drawLetterhead(doc: jsPDF, pageWidth: number, marginX: number): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text("MentorMates", marginX, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("mentormates.ai", marginX, 75);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(marginX, 90, pageWidth - marginX, 90);

  doc.setTextColor(0, 0, 0);
}

function drawFooterOnAllPages(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  marginX: number
): void {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(marginX, pageHeight - 60, pageWidth - marginX, pageHeight - 60);

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

  drawLetterhead(doc, pageWidth, marginX);

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
        drawLetterhead(doc, pageWidth, marginX);
        cursorY = bodyTopY;
      }
      doc.text(line, marginX, cursorY);
      cursorY += lineHeight;
    });
  });

  drawFooterOnAllPages(doc, pageWidth, pageHeight, marginX);

  return doc;
}

export function safeFileName(input: string): string {
  return input
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "letter";
}

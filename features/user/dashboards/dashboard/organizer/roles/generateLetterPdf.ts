import { jsPDF } from "jspdf";

export interface EvidenceLetterData {
  recipientSalutation: string;
  judgeName: string;
  eventName: string;
  eventDate: string;
  attendanceText: string;
  projectsJudgedText: string;
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
  return [
    `${data.recipientSalutation},`,
    "",
    `I am writing to validate that ${data.judgeName} served as a judge at ${data.eventName}, held on ${data.eventDate}, an event with ${data.attendanceText}. In this capacity, ${data.judgeName} personally evaluated ${data.projectsJudgedText}.`,
    "",
    `${data.judgeName} ${data.selectivityLanguage}. ${data.praiseParagraph}`,
    "",
    "Sincerely,",
    "",
    data.organizerName,
    [data.organizerRole, data.organizerOrg].filter(Boolean).join(", "),
  ];
}

export function generateEvidenceLetterPdf(data: EvidenceLetterData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 72;
  const contentWidth = pageWidth - marginX * 2;

  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text("Letter of Validation", pageWidth / 2, 90, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text(new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }), marginX, 130);

  doc.setFontSize(12);
  let cursorY = 170;
  const lineHeight = 16;

  buildLetterBody(data).forEach((paragraph) => {
    if (paragraph === "") {
      cursorY += lineHeight;
      return;
    }
    const wrapped = doc.splitTextToSize(paragraph, contentWidth);
    wrapped.forEach((line: string) => {
      if (cursorY > 720) {
        doc.addPage();
        cursorY = 90;
      }
      doc.text(line, marginX, cursorY);
      cursorY += lineHeight;
    });
  });

  return doc;
}

export function safeFileName(input: string): string {
  return input
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "letter";
}

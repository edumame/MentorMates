// The package's own types only cover its entry point, which the route must avoid.
declare module "pdf-parse/lib/pdf-parse.js" {
  export default function pdfParse(data: Uint8Array): Promise<{ text: string }>;
}

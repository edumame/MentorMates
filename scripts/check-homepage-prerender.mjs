import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(".next/server/app/index.html", "utf8");
// Next serializes React content in scripts, even when it is absent from the DOM.
// Inspect only the rendered body so an auth/loading shell cannot pass this check.
const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
const body = withoutScripts.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1];
assert.ok(body, "The prerendered homepage must contain a body.");
const headings = Array.from(body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi));
assert.ok(
  headings.some(([, content]) => content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").includes("Your home for")),
  "The prerendered homepage body must contain the landing heading outside scripts.",
);
assert.match(body, /<footer\b[^>]*>/i, "The prerendered homepage body must contain a footer outside scripts.");
console.log("Homepage prerender includes the landing heading and footer.");

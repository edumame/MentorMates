/**
 * Test script: Generate a Supabase email confirmation link.
 *
 * Usage:
 *   1. Sign up a user normally via the UI
 *   2. Run: node scripts/test-confirm-email.mjs test@example.com
 *   3. Open the printed action_link in your browser — it hits /auth/callback and signs you in
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Load .env.local
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/test-confirm-email.mjs <email>");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const cleanBaseUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;

const { data, error } = await supabaseAdmin.auth.admin.generateLink({
  type: "signup",
  email,
  password: "unused-generate-link-only",
  options: {
    redirectTo: `${cleanBaseUrl}/auth/callback`,
  },
});

if (error) {
  console.error("Error:", error.message);
  process.exit(1);
}

console.log("\n--- Confirmation link generated ---\n");
console.log("Action link (open in browser):");
console.log(data.properties?.action_link);
console.log("\nHashed token (for verifyOtp):");
console.log(data.properties?.hashed_token);
console.log();



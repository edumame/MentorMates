import { createClient } from "@supabase/supabase-js";

type Command = "generate-link" | "confirm-user" | "create-confirmed-user" | "help";

function printUsage() {
  console.log(`
Dev-only Supabase auth helper

Usage:
  pnpm auth:dev -- generate-link --email you@example.com --password password123 [--redirect-to http://localhost:3000/]
  pnpm auth:dev -- confirm-user --email you@example.com
  pnpm auth:dev -- create-confirmed-user --email you@example.com --password password123

Commands:
  generate-link          Create a real signup confirmation link and print its token hash.
  confirm-user           Mark an existing auth user as email-confirmed.
  create-confirmed-user  Create a new confirmed auth user without email verification.
`.trim());
}

function getCommand(raw: string | undefined): Command {
  if (!raw || raw === "help" || raw === "--help" || raw === "-h") {
    return "help";
  }

  if (
    raw === "generate-link" ||
    raw === "confirm-user" ||
    raw === "create-confirmed-user"
  ) {
    return raw;
  }

  throw new Error(`Unknown command: ${raw}`);
}

function getFlag(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function getRequiredFlag(name: string) {
  const value = getFlag(name);
  if (!value) {
    throw new Error(`Missing required flag: ${name}`);
  }

  return value;
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run this via `pnpm auth:dev` so .env.local is loaded."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findUserIdByEmail(email: string) {
  const supabase = getServiceClient();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );

    if (match) {
      return match.id;
    }

    if (!data.nextPage) {
      return null;
    }

    page = data.nextPage;
  }
}

async function generateLink() {
  const email = getRequiredFlag("--email");
  const password = getRequiredFlag("--password");
  const redirectTo = getFlag("--redirect-to") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000/";
  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const supabase = getServiceClient();

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      redirectTo,
    },
  });

  if (error) {
    throw error;
  }

  const confirmRouteUrl =
    `${appBaseUrl}/auth/confirm` +
    `?token_hash=${encodeURIComponent(data.properties.hashed_token)}` +
    `&type=email` +
    `&redirect_to=${encodeURIComponent(data.properties.redirect_to)}`;

  console.log(`Generated signup link for ${email}`);
  console.log(`User ID: ${data.user.id}`);
  console.log(`Redirect To: ${data.properties.redirect_to}`);
  console.log(`Supabase Action Link: ${data.properties.action_link}`);
  console.log(`Token Hash: ${data.properties.hashed_token}`);
  console.log(`App Confirm Route: ${confirmRouteUrl}`);
}

async function confirmUser() {
  const email = getRequiredFlag("--email");
  const supabase = getServiceClient();
  const userId = await findUserIdByEmail(email);

  if (!userId) {
    throw new Error(`No auth user found for ${email}`);
  }

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  if (error) {
    throw error;
  }

  console.log(`Confirmed user ${email}`);
  console.log(`User ID: ${data.user?.id ?? userId}`);
}

async function createConfirmedUser() {
  const email = getRequiredFlag("--email");
  const password = getRequiredFlag("--password");
  const supabase = getServiceClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw error;
  }

  console.log(`Created confirmed user ${email}`);
  console.log(`User ID: ${data.user?.id ?? "unknown"}`);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("This script is dev-only. Do not run it in production.");
  }

  const command = getCommand(process.argv[2]);

  if (command === "help") {
    printUsage();
    return;
  }

  if (command === "generate-link") {
    await generateLink();
    return;
  }

  if (command === "confirm-user") {
    await confirmUser();
    return;
  }

  await createConfirmedUser();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

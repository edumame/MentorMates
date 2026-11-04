import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getGatewayConfig } from "@/lib/model-api/config";
import DeveloperConsole from "./developer-console";

export const dynamic = "force-dynamic";

export default async function DeveloperPage() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous)
    redirect("/login?returnUrl=%2Fdevelopers");
  const { minuteLimit, dayLimit } = getGatewayConfig();
  return <DeveloperConsole minuteLimit={minuteLimit} dayLimit={dayLimit} />;
}

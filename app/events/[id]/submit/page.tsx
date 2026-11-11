import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/app/utils/supabase/server";

export default async function EventSubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = `/projects/submit?eventId=${encodeURIComponent(id)}`;
  const supabase = await createSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  redirect(user && !error ? target : `/login?returnUrl=${encodeURIComponent(target)}`);
}

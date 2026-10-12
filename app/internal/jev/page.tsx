import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JevPlayground } from "@/components/internal/jev-playground";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { JEV_SERVICE, checkInvite, type InviteRow } from "@/lib/internal/jev";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Jev playground | MentorMates",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ invite?: string | string[] }> };

export default async function JevPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = Array.isArray(params.invite) ? params.invite[0] : params.invite;
  const code = raw?.trim();
  if (!code) notFound();

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("internal_invites")
    .select("id, code, service, label, revoked_at, expires_at, max_uses, uses")
    .eq("code", code)
    .maybeSingle();
  if (error) notFound();
  const invite = (data ?? null) as (InviteRow & { label: string | null }) | null;
  if (!checkInvite(invite, JEV_SERVICE).ok || !invite) notFound();

  return <JevPlayground invite={invite.code} label={invite.label} />;
}

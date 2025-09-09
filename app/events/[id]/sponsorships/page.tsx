import React from "react";
import { notFound } from "next/navigation";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, CheckCircle2, Sparkles } from "lucide-react";
import { EventDetails } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ success?: string; canceled?: string }>;
}

type SponsorshipTier = {
  id: "bronze" | "silver" | "gold";
  name: string;
  amount: number; // in USD dollars
  description: string[];
};

const TIERS: SponsorshipTier[] = [
  {
    id: "bronze",
    name: "Bronze",
    amount: 500,
    description: ["Logo on event site", "Mention in opening/closing"],
  },
  {
    id: "silver",
    name: "Silver",
    amount: 1000,
    description: [
      "Medium logo placement",
      "Social media shoutout",
      "Sponsor table space",
    ],
  },
  {
    id: "gold",
    name: "Gold",
    amount: 2000,
    description: [
      "Prominent logo placement",
      "Dedicated announcement",
      "Premium sponsor table",
      "Option to present a prize",
    ],
  },
];

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function getEvent(id: string) {
  const supabase = await createSupabaseClient();
  const isUUID = isValidUUID(id);

  let query = supabase
    .from("events")
    .select("event_id, event_name, slug, sponsorship_tiers")
    .limit(1);

  if (isUUID) {
    query = query.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    query = query.eq("slug", id);
  }

  const { data, error } = await query.single();
  if (error || !data) return null;
  return data as Pick<
    EventDetails,
    "event_id" | "event_name" | "slug" | "sponsorship_tiers"
  >;
}

function getCheckoutUrl(eventId: string, tier: SponsorshipTier) {
  const search = new URLSearchParams({ tier: tier.id }).toString();
  return `/api/events/${encodeURIComponent(eventId)}/sponsorships/checkout?${search}`;
}

function getTierStyles(id: SponsorshipTier["id"]) {
  switch (id) {
    case "bronze":
      return {
        card: "bg-amber-50/50 border-amber-200 hover:ring-amber-300",
        accentBlob: "from-amber-500/20 to-orange-400/10",
        iconWrap: "bg-amber-100 text-amber-700",
        price: "text-amber-700",
        button: "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-600",
        check: "text-amber-600",
        icon: <Medal className="h-6 w-6" />,
        highlight: null as React.ReactNode,
      };
    case "silver":
      return {
        card: "bg-zinc-50/50 border-zinc-200 hover:ring-zinc-300",
        accentBlob: "from-zinc-400/20 to-gray-200/10",
        iconWrap: "bg-zinc-100 text-zinc-700",
        price: "text-zinc-700",
        button: "bg-zinc-700 hover:bg-zinc-800 focus-visible:ring-zinc-700",
        check: "text-zinc-600",
        icon: <Award className="h-6 w-6" />,
        highlight: null as React.ReactNode,
      };
    case "gold":
    default:
      return {
        card: "bg-yellow-50/50 border-yellow-200 hover:ring-yellow-300",
        accentBlob: "from-yellow-400/30 to-amber-300/10",
        iconWrap: "bg-yellow-100 text-yellow-700",
        price: "text-yellow-700",
        button: "bg-yellow-500 hover:bg-yellow-600 focus-visible:ring-yellow-600",
        check: "text-yellow-600",
        icon: <Trophy className="h-6 w-6" />,
        highlight: (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-yellow-400/90 px-2.5 py-0.5 text-[10px] font-semibold text-yellow-900 shadow">
            <Sparkles className="h-3 w-3" /> Most Visibility
          </span>
        ) as React.ReactNode,
      };
  }
}

export default async function SponsorshipsPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await Promise.resolve(params);
  const sp = (await Promise.resolve(searchParams)) || {};
  const event = await getEvent(id);
  if (!event) {
    notFound();
  }

  // Build tiers from event.sponsorship_tiers if available; otherwise fallback to defaults
  const eventTiers = Array.isArray(event.sponsorship_tiers?.tiers)
    ? event
        .sponsorship_tiers!.tiers.slice()
        .sort((a, b) => (a.sort || 0) - (b.sort || 0))
        .map((t) => {
          const rawId = (t.id || t.label || "").toLowerCase();
          // Only allow valid tier IDs
          const validId = ["bronze", "silver", "gold"].includes(rawId) 
            ? rawId as SponsorshipTier["id"] 
            : "bronze"; // default to bronze if invalid
          
          const tier = {
            id: validId,
            name: t.label || t.id || "Tier",
            amount: typeof t.price === "number" ? Math.round(t.price / 100) : 0, // convert cents -> dollars for display
            description: t.benefits || [],
          };
          
          // Debug log to help identify issues
          console.log("Processing tier:", { rawId, validId, tier, originalTier: t });
          
          return tier;
        })
        .filter((tier) => {
          const isValid = tier.amount > 0;
          if (!isValid) {
            console.log("Filtering out tier with invalid amount:", tier);
          }
          return isValid;
        })
    : null;

  return (
    <div className="container mx-auto py-10">
      <div className="max-w-3xl mx-auto text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          <Sparkles className="h-3.5 w-3.5" /> Support the Community
        </div>
        <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">
          Sponsor {event.event_name}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Choose a tier that fits your goals. Your support helps us run an
          awesome event.
        </p>
        {sp.success === "true" && (
          <div className="mt-4 text-green-600">
            Thank you for your sponsorship! We will be in touch soon at the
            email associated with your account. If we don&apos;t reach out within 24
            hours, please email us at{" "}
            <a href="mailto:admin@mentormates.ai">admin@mentormates.ai</a>.
          </div>
        )}
        {sp.canceled === "true" && (
          <div className="mt-4 text-yellow-700">
            Checkout canceled. You can try again anytime.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {(eventTiers || TIERS).map((tier) => {
          const styles = getTierStyles(tier.id);
          return (
            <Card
              key={tier.id}
              className={`relative overflow-hidden flex flex-col border shadow-sm transition-all hover:shadow-md hover:ring-2 ${styles.card}`}
            >
              {/* Decorative gradient blob */}
              <div
                className={`pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br ${styles.accentBlob} blur-2xl opacity-30`}
              />
              {styles.highlight}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${styles.iconWrap}`}
                    >
                      {styles.icon}
                    </div>
                    <CardTitle className="text-xl font-bold">
                      {tier.name}
                    </CardTitle>
                  </div>
                  <div className={`text-2xl font-extrabold ${styles.price}`}>
                    {formatUsd(tier.amount)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {tier.description.map((d, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2
                        className={`mt-0.5 h-4 w-4 ${styles.check}`}
                      />
                      <span className="text-muted-foreground">{d}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-auto">
                <Button
                  asChild
                  className={`w-full text-white shadow ${styles.button}`}
                >
                  <a href={getCheckoutUrl(event.event_id, tier)}>
                    Sponsor {tier.name}
                  </a>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

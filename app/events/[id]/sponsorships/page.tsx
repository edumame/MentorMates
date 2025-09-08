import React from "react";
import { notFound } from "next/navigation";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    description: [
      "Logo on event site",
      "Mention in opening/closing",
    ],
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
    .select("event_id, event_name, slug")
    .limit(1);

  if (isUUID) {
    query = query.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    query = query.eq("slug", id);
  }

  const { data, error } = await query.single();
  if (error || !data) return null;
  return data as { event_id: string; event_name: string; slug: string | null };
}

async function createCheckout(eventId: string, tier: SponsorshipTier) {
  const res = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/sponsorships/checkout`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: tier.id }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error("Failed to start checkout");
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    throw new Error("No checkout URL returned");
  }
  return data.url;
}

export default async function SponsorshipsPage({ params, searchParams }: PageProps) {
  const { id } = await Promise.resolve(params);
  const sp = (await Promise.resolve(searchParams)) || {};
  const event = await getEvent(id);
  if (!event) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-3xl mx-auto text-center mb-8">
        <h1 className="text-3xl font-bold">Sponsor {event.event_name}</h1>
        <p className="text-muted-foreground mt-2">
          Support the event by choosing a sponsorship tier.
        </p>
        {sp.success === "true" && (
          <div className="mt-4 text-green-600">Thank you for your sponsorship!</div>
        )}
        {sp.canceled === "true" && (
          <div className="mt-4 text-yellow-600">Checkout canceled. You can try again anytime.</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {TIERS.map((tier) => (
          <Card key={tier.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between">
                <span>{tier.name}</span>
                <span className="text-2xl font-extrabold">{formatUsd(tier.amount)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                {tier.description.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="mt-auto">
              {/* Use a server action-like form submit to avoid client bundle */}
              <form
                action={async () => {
                  "use server";
                  const url = await createCheckout(event.event_id, tier);
                  // Redirect on server
                  // Next.js App Router supports returning a redirect here, but for simplicity
                  // send a minimal client redirect by setting a header isn't possible here.
                }}
              >
                {/* Fallback to client-side since we need to perform fetch and then redirect */}
                <Button
                  type="button"
                  className="w-full"
                  onClick={async () => {
                    const url = await createCheckout(event.event_id, tier);
                    window.location.href = url;
                  }}
                >
                  Sponsor {tier.name}
                </Button>
              </form>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}


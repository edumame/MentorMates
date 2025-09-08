"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseClient } from "@/app/utils/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, Trophy, Medal } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface SponsorshipTier {
  id: string;
  name: string;
  price: number;
  description: string;
  benefits: string[];
  icon: React.ReactNode;
  color: string;
  stripePriceId?: string;
}

const sponsorshipTiers: SponsorshipTier[] = [
  {
    id: "bronze",
    name: "Bronze Sponsor",
    price: 500,
    description: "Support our event and get your brand noticed",
    benefits: [
      "Logo on event website",
      "Logo on event materials",
      "Social media mentions",
      "1 complimentary ticket",
    ],
    icon: <Medal className="w-8 h-8" />,
    color: "bg-amber-600",
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_BRONZE_PRICE_ID,
  },
  {
    id: "silver",
    name: "Silver Sponsor",
    price: 1000,
    description: "Enhanced visibility and engagement opportunities",
    benefits: [
      "All Bronze benefits",
      "Logo on event banner",
      "Booth space at event",
      "Speaking opportunity (5 min)",
      "3 complimentary tickets",
      "Email list access (opt-in)",
    ],
    icon: <Trophy className="w-8 h-8" />,
    color: "bg-gray-400",
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_SILVER_PRICE_ID,
  },
  {
    id: "gold",
    name: "Gold Sponsor",
    price: 2000,
    description: "Premium partnership with maximum exposure",
    benefits: [
      "All Silver benefits",
      "Premium logo placement",
      "Keynote speaking slot (15 min)",
      "Branded workshop opportunity",
      "5 complimentary tickets",
      "Post-event report & analytics",
      "Exclusive networking session",
    ],
    icon: <Sparkles className="w-8 h-8" />,
    color: "bg-yellow-500",
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_GOLD_PRICE_ID,
  },
];

export default function EventSponsorshipsPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingTier, setProcessingTier] = useState<string | null>(null);

  useEffect(() => {
    fetchEventDetails();
  }, [params.id]);

  async function fetchEventDetails() {
    const supabase = createSupabaseClient();
    
    const { data: eventData, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      console.error("Error fetching event:", error);
      toast({
        title: "Error",
        description: "Failed to load event details",
        variant: "destructive",
      });
    } else {
      setEvent(eventData);
    }
    
    setLoading(false);
  }

  const handleSponsorshipPurchase = async (tier: SponsorshipTier) => {
    setProcessingTier(tier.id);
    
    try {
      const response = await fetch("/api/sponsorships/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: params.id,
          tierId: tier.id,
          tierName: tier.name,
          amount: tier.price,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      toast({
        title: "Error",
        description: "Failed to initiate checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingTier(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Event not found</h1>
          <Button onClick={() => router.push("/events")}>
            Back to Events
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Become a Sponsor
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            {event.name}
          </p>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Support our event and connect with talented participants. Choose a sponsorship tier that aligns with your goals.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {sponsorshipTiers.map((tier) => (
            <Card 
              key={tier.id} 
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                tier.id === "gold" ? "border-2 border-yellow-500" : ""
              }`}
            >
              {tier.id === "gold" && (
                <div className="absolute top-0 right-0 bg-yellow-500 text-white px-3 py-1 text-sm font-semibold">
                  BEST VALUE
                </div>
              )}
              
              <CardHeader>
                <div className={`w-16 h-16 rounded-full ${tier.color} flex items-center justify-center text-white mb-4`}>
                  {tier.icon}
                </div>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription className="text-lg">
                  {tier.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="mb-6">
                  <span className="text-4xl font-bold">${tier.price.toLocaleString()}</span>
                  <span className="text-muted-foreground ml-2">USD</span>
                </div>
                
                <div className="space-y-3">
                  <p className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                    What's Included:
                  </p>
                  {tier.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{benefit}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              
              <CardFooter>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => handleSponsorshipPurchase(tier)}
                  disabled={processingTier === tier.id}
                >
                  {processingTier === tier.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    `Become a ${tier.name.split(" ")[0]} Sponsor`
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="bg-muted rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Why Sponsor Our Event?</h2>
          <div className="grid md:grid-cols-3 gap-6 text-left max-w-5xl mx-auto">
            <div>
              <h3 className="font-semibold mb-2">Brand Visibility</h3>
              <p className="text-sm text-muted-foreground">
                Get your brand in front of talented developers, designers, and innovators.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Talent Pipeline</h3>
              <p className="text-sm text-muted-foreground">
                Connect with potential hires and build relationships with emerging talent.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Community Impact</h3>
              <p className="text-sm text-muted-foreground">
                Support innovation and education in the tech community.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Have questions or need a custom sponsorship package?
          </p>
          <Button variant="outline" onClick={() => window.location.href = `mailto:sponsors@mentormates.com?subject=Sponsorship Inquiry - ${event.name}`}>
            Contact Us
          </Button>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail, Calendar } from "lucide-react";

export default function SponsorshipSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [event, setEvent] = useState<{id: string; name: string; date?: string} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvent() {
      const supabase = createClient();
      
      const { data: eventData, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) {
        console.error("Error fetching event:", error);
      } else {
        setEvent(eventData);
      }
      
      setLoading(false);
    }
    
    fetchEvent();
  }, [params.id]);


  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-3xl">Thank You for Your Sponsorship!</CardTitle>
            <CardDescription className="text-lg mt-2">
              Your sponsorship has been successfully processed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {event && (
              <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border">
                <h3 className="font-semibold text-lg mb-2">Event Details</h3>
                <p className="text-muted-foreground">{event.name}</p>
                {event.date && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    {new Date(event.date).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">What&apos;s Next?</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-semibold">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Confirmation Email</p>
                    <p className="text-sm text-muted-foreground">
                      You&apos;ll receive a detailed confirmation email with your sponsorship details and benefits.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-semibold">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Event Coordinator Contact</p>
                    <p className="text-sm text-muted-foreground">
                      Our event team will reach out within 24-48 hours to discuss your sponsorship benefits and requirements.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-semibold">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Sponsorship Package</p>
                    <p className="text-sm text-muted-foreground">
                      We&apos;ll send you a sponsorship package with guidelines for logos, booth setup (if applicable), and other materials.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">Need Immediate Assistance?</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Contact us at{" "}
                    <a href="mailto:sponsors@mentormates.com" className="underline">
                      sponsors@mentormates.com
                    </a>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                onClick={() => router.push(`/events/${params.id}`)}
                className="flex-1"
              >
                View Event Details
              </Button>
              <Button 
                onClick={() => router.push("/events")}
                variant="outline"
                className="flex-1"
              >
                Browse Other Events
              </Button>
            </div>

            {sessionId && (
              <div className="text-center text-xs text-muted-foreground pt-4 border-t">
                Reference ID: {sessionId}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
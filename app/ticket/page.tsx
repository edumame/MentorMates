"use client";

import { generateQRCode } from "@/lib/utils/qrcode";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Ticket() {
  const [qrCodeSrc, setQRCodeSrc] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // PUB-007: the ticket is always the signed-in user's own, issued by the
  // server. A `usr` query parameter (still present in older emails) is ignored.
  const eventId = searchParams.get("evt");

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    const fetchQRCode = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/checkin/ticket?eventId=${encodeURIComponent(eventId)}`);
        const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
        if (!res.ok || !data.token) {
          throw new Error(data.error || "Could not load your ticket.");
        }
        const qrCode = await generateQRCode(data.token, 256);
        if (active) setQRCodeSrc(qrCode);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load your ticket.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchQRCode();
    return () => {
      active = false;
    };
  }, [eventId]);

  if (!eventId || error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-blue-50">
        <div className="bg-white p-8 rounded-lg shadow-lg" role="alert">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Ticket unavailable</h1>
          <p className="text-gray-700">{error || "No event provided."}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/events")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-blue-50 p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <Button
          variant="outline"
          className="mb-6"
          onClick={() => router.push("/events")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Your Event Ticket</h1>
        <p className="text-gray-600 mb-6">Present this QR code at check-in</p>
        
        <div className="bg-white p-4 rounded-lg inline-block mb-4">
          <Image 
            src={qrCodeSrc} 
            alt="QR Code" 
            width={200} 
            height={200} 
            className="mx-auto"
          />
        </div>
        
        <p className="text-sm text-gray-500">Keep this QR code handy for quick check-in</p>
      </div>
    </div>
  );
}

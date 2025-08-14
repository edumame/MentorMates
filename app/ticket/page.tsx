"use client";

import { generateQRCode } from "@/lib/utils/qrcode";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export async function getCheckinQRCode(eventId: string, userId: string) {
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  const checkInURL = `${origin}/checkin?evt=${eventId}&usr=${userId}`;
  const qrCode = await generateQRCode(checkInURL, 128);
  return qrCode;
}

export default function Ticket() {
  const [qrCodeSrc, setQRCodeSrc] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  const eventId = searchParams.get("evt");
  const userId = searchParams.get("usr");

  useEffect(() => {
    const fetchQRCode = async () => {
      if (!eventId || !userId) {
        return;
      }

      const qrCode = await getCheckinQRCode(eventId, userId);
      setQRCodeSrc(qrCode);
      setIsLoading(false);
    };
    fetchQRCode();
  }, [eventId, userId]);

  if (!eventId || !userId) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-blue-50">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700">No event ID or user ID provided.</p>
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

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckinStatus } from "./status";
import QRScanner from "@/components/utils/QRScanner";

export default function CheckinPage() {
  const eventId = useSearchParams().get("event");
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleTokenScanned = (token: string) => {
    setScannedToken(token);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setScannedToken(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="max-w-md w-full p-6 bg-blue-300 rounded-lg shadow-lg min-h-[450px]">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Event Check-in
        </h1>
        {eventId ? (
          <>
            <QRScanner mode="checkin" onTokenScanned={handleTokenScanned} />
            <CheckinStatus
              eventId={eventId}
              token={scannedToken}
              isOpen={isModalOpen}
              onClose={handleCloseModal}
            />
          </>
        ) : (
          <p role="alert" className="text-center text-gray-900">
            No event selected. Open this page as /checkin?event=&lt;event
            id&gt; to scan tickets for that event.
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Message, FlashOn } from "@mui/icons-material";
import Link from "next/link";

interface DiscordCTAProps {
  variant?: "default" | "compact" | "hero";
  className?: string;
}

export function DiscordCTA({
  variant = "default",
  className = "",
}: DiscordCTAProps) {
  const discordUrl = "https://discord.gg/6pbUzK44eW";

  const containerClasses = "w-full max-w-6xl mx-auto";

  if (variant === "compact") {
    return (
      <div
        className={`${containerClasses} bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Message className="w-5 h-5 text-blue-700" />
            <div>
              <p className="text-sm font-semibold text-blue-900">
                Join our Discord community
              </p>
              <p className="text-xs text-blue-800">
                Connect with mentors and peers
              </p>
            </div>
          </div>
          <Link href={discordUrl} target="_blank" rel="noopener noreferrer">
            <Button
              size="sm"
              className="bg-blue-700 text-white hover:bg-blue-800 focus-visible:ring-blue-700"
            >
              Join Discord
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div
        className={`${containerClasses} bg-blue-50 border border-blue-100 rounded-2xl p-8 shadow-xl ${className}`}
      >
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white rounded-full p-3 flex items-center justify-center ring-1 ring-blue-100">
              <Message className="w-8 h-8 text-blue-700" />
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-2 text-blue-900">
            Join Our Discord Community!
          </h3>
          <p className="text-lg mb-6 max-w-md mx-auto text-blue-800">
            Connect with mentors, peers, and stay updated on the latest events
            and opportunities.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link href={discordUrl} target="_blank" rel="noopener noreferrer">
              <Button size="lg">
                <Message className="w-5 h-5 mr-2" />
                Join Discord
              </Button>
            </Link>
            <div className="flex items-center space-x-4 text-sm text-blue-700">
              <div className="flex items-center">
                <FlashOn className="w-4 h-4 mr-1" />
                <span>24/7 support</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div
      className={`${containerClasses} bg-blue-50 border border-blue-100 rounded-xl p-6 shadow-lg ${className}`}
    >
      <div className="flex items-start space-x-4">
        <div className="bg-white rounded-full p-2 flex-shrink-0 flex items-center justify-center ring-1 ring-blue-100">
          <Message className="w-6 h-6 text-blue-700" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-2 text-blue-900">
            Join Our Discord Community!
          </h3>
          <p className="text-sm mb-4 text-blue-800">
            Connect with mentors, peers, and stay updated on the latest events,
            opportunities, and exclusive resources.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={discordUrl} target="_blank" rel="noopener noreferrer">
              <Button>
                <Message className="w-4 h-4 mr-2" />
                Join Discord
              </Button>
            </Link>
            <div className="flex items-center space-x-4 text-xs text-blue-700">
              <div className="flex items-center">
                <FlashOn className="w-3 h-3 mr-1" />
                <span>24/7 support</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

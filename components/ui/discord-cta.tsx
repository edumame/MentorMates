"use client";

import { Button } from "@/components/ui/button";
import { MessageCircle, Users, Zap } from "lucide-react";
import Link from "next/link";

interface DiscordCTAProps {
  variant?: "default" | "compact" | "hero";
  className?: string;
}

export function DiscordCTA({ variant = "default", className = "" }: DiscordCTAProps) {
  const discordUrl = "https://discord.gg/6pbUzK44eW";

  if (variant === "compact") {
    return (
      <div className={`bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-4 text-white ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageCircle className="w-5 h-5" />
            <div>
              <p className="text-sm font-medium">Join our Discord community!</p>
              <p className="text-xs opacity-90">Connect with mentors and peers</p>
            </div>
          </div>
          <Link href={discordUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="secondary" className="bg-white text-indigo-600 hover:bg-gray-100">
              Join Now
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div className={`bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-8 text-white shadow-xl ${className}`}>
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 rounded-full p-3">
              <MessageCircle className="w-8 h-8" />
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-2">Join Our Discord Community!</h3>
          <p className="text-lg opacity-90 mb-6 max-w-md mx-auto">
            Connect with mentors, peers, and stay updated on the latest events and opportunities.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link href={discordUrl} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="secondary" className="bg-white text-indigo-600 hover:bg-gray-100 font-semibold">
                <MessageCircle className="w-5 h-5 mr-2" />
                Join Discord
              </Button>
            </Link>
            <div className="flex items-center space-x-4 text-sm opacity-80">
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                <span>500+ members</span>
              </div>
              <div className="flex items-center">
                <Zap className="w-4 h-4 mr-1" />
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
    <div className={`bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg ${className}`}>
      <div className="flex items-start space-x-4">
        <div className="bg-white/20 rounded-full p-2 flex-shrink-0">
          <MessageCircle className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-2">Join Our Discord Community!</h3>
          <p className="text-sm opacity-90 mb-4">
            Connect with mentors, peers, and stay updated on the latest events, opportunities, and exclusive resources.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={discordUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" className="bg-white text-indigo-600 hover:bg-gray-100 font-medium">
                <MessageCircle className="w-4 h-4 mr-2" />
                Join Discord
              </Button>
            </Link>
            <div className="flex items-center space-x-4 text-xs opacity-80">
              <div className="flex items-center">
                <Users className="w-3 h-3 mr-1" />
                <span>500+ members</span>
              </div>
              <div className="flex items-center">
                <Zap className="w-3 h-3 mr-1" />
                <span>24/7 support</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
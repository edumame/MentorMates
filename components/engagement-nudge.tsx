"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Target, BookOpen, Lightbulb, TrendingUp } from "lucide-react";
import { createClient } from "@/app/utils/supabase/client";

const supabase = createClient();

interface EngagementNudgeProps {
  eventId: string;
  onGoalClick: () => void;
  onJournalClick: () => void;
}

const nudgeMessages = [
  {
    type: "goal",
    icon: Target,
    title: "Set Your First Goal! 🎯",
    message: "Goals help you stay focused and motivated. What would you like to achieve during this event?",
    action: "Set a Goal",
    gradient: "from-blue-500 to-indigo-600"
  },
  {
    type: "journal", 
    icon: BookOpen,
    title: "Start Journaling! ✨",
    message: "Capture your thoughts, learnings, and insights. Reflection is key to growth!",
    action: "Write Entry",
    gradient: "from-purple-500 to-pink-600"
  },
  {
    type: "both",
    icon: TrendingUp,
    title: "Boost Your Learning! 🚀",
    message: "Combine goal-setting with journaling to maximize your growth during this event.",
    action: "Get Started",
    gradient: "from-green-500 to-emerald-600"
  }
];

export function EngagementNudge({ eventId, onGoalClick, onJournalClick }: EngagementNudgeProps) {
  const [hasGoals, setHasGoals] = useState(false);
  const [hasJournalEntries, setHasJournalEntries] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkEngagement = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.email) {
        setIsLoading(false);
        return;
      }

      // Get user profile
      const { data: userProfile } = await supabase
        .from("user_profiles")
        .select("uid")
        .eq("email", session.session.user.email)
        .single();

      if (!userProfile) {
        setIsLoading(false);
        return;
      }

      // Check for goals
      const { data: goals } = await supabase
        .from("platform_engagement")
        .select("id")
        .eq("event_id", eventId)
        .eq("type", "goal")
        .eq("user_id", userProfile.uid)
        .limit(1);

      // Check for journal entries
      const { data: journal } = await supabase
        .from("platform_engagement")
        .select("id")
        .eq("event_id", eventId)
        .eq("type", "journal")
        .eq("user_id", userProfile.uid)
        .limit(1);

      setHasGoals((goals?.length || 0) > 0);
      setHasJournalEntries((journal?.length || 0) > 0);
      setIsLoading(false);

      // Check if user has dismissed the nudge today
      const dismissedToday = localStorage.getItem(`nudge-dismissed-${eventId}-${new Date().toDateString()}`);
      setIsDismissed(!!dismissedToday);
    };

    checkEngagement();
  }, [eventId]);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(`nudge-dismissed-${eventId}-${new Date().toDateString()}`, "true");
  };

  if (isLoading || isDismissed || (hasGoals && hasJournalEntries)) {
    return null;
  }

  let nudge;
  if (!hasGoals && !hasJournalEntries) {
    nudge = nudgeMessages[2]; // both
  } else if (!hasGoals) {
    nudge = nudgeMessages[0]; // goal
  } else {
    nudge = nudgeMessages[1]; // journal
  }

  const Icon = nudge.icon;

  const handleAction = () => {
    if (nudge.type === "goal" || (!hasGoals && nudge.type === "both")) {
      onGoalClick();
    } else {
      onJournalClick();
    }
  };

  return (
    <Card className={`bg-gradient-to-r ${nudge.gradient} border-0 shadow-xl text-white mb-8 overflow-hidden`}>
      <CardContent className="p-6 relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-full">
            <Icon className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">{nudge.title}</h3>
            <p className="text-white/90 leading-relaxed">{nudge.message}</p>
          </div>
          <Button
            onClick={handleAction}
            className="bg-white text-gray-800 hover:bg-gray-100 font-semibold rounded-full px-6 py-2 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            {nudge.action}
          </Button>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -right-4 -bottom-4 opacity-10">
          <Lightbulb className="h-24 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}
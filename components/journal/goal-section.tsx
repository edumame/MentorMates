"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { useParams } from "next/navigation";
import { 
  Pencil, 
  CheckCircle2, 
  Target, 
  TrendingUp, 
  Calendar,
  Trophy,
  Zap,
  Plus,
  Clock,
  Star,
  Loader2
} from "lucide-react";
import VoiceInput from "@/components/utils/VoiceInput";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";

// Initialize Supabase client once at module level
const supabase = createClient();

interface GoalSectionProps {
  eventId?: string; // Optional: will get from URL if not provided
}

interface Goal {
  id: string;
  user_id: string;
  event_id: string;
  type: "goal" | "journal";
  content: string;
  display_name: string;
  created_at: string;
  updated_at: string;
  status: "in_progress" | "completed";
}

const goalRecommendations = [
  "🤝 Connect with 3 peers or professionals in your field for knowledge sharing",
  "🚀 Complete an AI project using [specific technology] to improve your technical skills",
  "🔍 Conduct user research with 3 target users and document key insights",
  "📚 Learn a new programming language or framework during this event",
  "🎯 Build a minimum viable product (MVP) for your project idea",
  "🌐 Create a professional portfolio or update your LinkedIn profile",
];

const motivationalQuotes = [
  "Every expert was once a beginner. Keep going! 💪",
  "Your future self will thank you for the goals you set today! 🌟",
  "Small steps lead to big achievements! 🎯",
  "Progress, not perfection! 📈",
];

export default function GoalSection({
  eventId: propEventId,
}: GoalSectionProps) {
  const params = useParams();
  const eventId = propEventId || (params.id as string);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newGoal, setNewGoal] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const { toast } = useToast();

  // Calculate progress metrics
  const completedGoals = goals.filter(goal => goal.status === "completed");
  const progressPercentage = goals.length > 0 ? (completedGoals.length / goals.length) * 100 : 0;
  const streak = calculateStreak(goals);

  function calculateStreak(goals: Goal[]): number {
    // Simple streak calculation based on recent activity
    const recentGoals = goals.filter(goal => {
      const goalDate = new Date(goal.created_at);
      const daysDiff = (Date.now() - goalDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7; // Goals set in the last week
    });
    return recentGoals.length;
  }

  const fetchGoals = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.email) return;

    // Get uid from user_profiles using email from auth session
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("uid")
      .eq("email", session.session.user.email)
      .single();

    if (profileError || !userProfile) {
      toast({
        title: "Error finding user profile",
        description: "Please try again later",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from("platform_engagement")
      .select("*")
      .eq("event_id", eventId)
      .eq("type", "goal")
      .eq("user_id", userProfile.uid)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error fetching goals",
        description: "Please try again later",
        variant: "destructive",
      });
      return;
    }

    if (data) {
      setGoals(data);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (eventId) {
      fetchGoals();
    }
  }, [eventId, fetchGoals]);

  const incrementPulse = async (userEmail: string) => {
    const { data: profiles, error: fetchError } = await supabase
      .from("user_profiles")
      .select("pulse")
      .eq("email", userEmail)
      .single();

    if (fetchError) {
      console.error("Error fetching pulse:", fetchError);
      return;
    }

    const currentPulse = profiles?.pulse || 0;
    const newPulse = currentPulse + 1;

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ pulse: newPulse })
      .eq("email", userEmail);

    if (updateError) {
      console.error("Error updating pulse:", updateError);
      toast({
        title: "Error updating pulse",
        description: updateError.message || "Please try again later",
        variant: "destructive",
      });
    }
  };

  const handleSetGoal = () => {
    setIsDialogOpen(true);
  };

  const handleSubmitGoal = async () => {
    if (!newGoal.trim()) return;

    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.email) {
      toast({
        title: "Authentication error",
        description: "Please sign in to set goals",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Get uid from user_profiles using email from auth session
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("uid")
      .eq("email", session.session.user.email)
      .single();

    if (profileError || !userProfile) {
      toast({
        title: "Error finding user profile",
        description: "Please try again later",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("platform_engagement").insert([
      {
        event_id: eventId,
        user_id: userProfile.uid,
        type: "goal",
        content: newGoal.trim(),
        display_name: session.session.user.user_metadata.full_name,
        status: "in_progress",
      },
    ]);

    if (error) {
      toast({
        title: "Error setting goal",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    await incrementPulse(session.session.user.email);
    setIsSubmitting(false);
    
    // Show encouraging success message
    const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    toast({
      title: "🎯 Goal set successfully!",
      description: randomQuote,
    });
    
    setNewGoal("");
    setIsDialogOpen(false);
    fetchGoals();
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setEditedContent(goal.content);
  };

  const handleSaveEdit = async (goalId: string) => {
    if (!editedContent.trim()) return;

    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.email) {
      toast({
        title: "Authentication error",
        description: "Please sign in to edit goals",
        variant: "destructive",
      });
      return;
    }

    // Get uid from user_profiles using email from auth session
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("uid")
      .eq("email", session.session.user.email)
      .single();

    if (profileError || !userProfile) {
      toast({
        title: "Error finding user profile",
        description: "Please try again later",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("platform_engagement")
      .update({ content: editedContent.trim() })
      .eq("id", goalId)
      .eq("user_id", userProfile.uid);

    if (error) {
      toast({
        title: "Error updating goal",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Goal updated successfully",
      description: "Your changes have been saved",
    });

    setEditingGoalId(null);
    setEditedContent("");
    fetchGoals();
  };

  const handleToggleStatus = async (goal: Goal) => {
    const newStatus = goal.status === "completed" ? "in_progress" : "completed";
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.email) return;

    // Get uid from user_profiles using email from auth session
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("uid")
      .eq("email", session.session.user.email)
      .single();

    if (profileError || !userProfile) {
      toast({
        title: "Error finding user profile",
        description: "Please try again later",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("platform_engagement")
      .update({ status: newStatus })
      .eq("id", goal.id)
      .eq("user_id", userProfile.uid);

    if (error) {
      toast({
        title: "Error updating status",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
      return;
    }

    if (newStatus === "completed") {
      await incrementPulse(session.session.user.email);
      toast({
        title: "🎉 Goal completed!",
        description: "Amazing work! You're making great progress.",
      });
    }

    fetchGoals();
  };

  const handleSelectRecommendation = (recommendation: string) => {
    setNewGoal(recommendation);
  };

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning! Ready to tackle your goals? 🌅";
    if (hour < 17) return "Good afternoon! How are your goals coming along? ☀️";
    return "Good evening! Time to reflect on your progress! 🌙";
  };

  return (
    <>
      <Card className="w-full bg-gradient-to-br from-blue-50 to-indigo-100 border-0 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-gray-800">Your Goals</CardTitle>
                <p className="text-sm text-gray-600 mt-1">{getTimeBasedGreeting()}</p>
              </div>
            </div>
            <Button
              onClick={handleSetGoal}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full px-6 py-2 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Goal
            </Button>
          </div>
          
          {/* Progress Overview */}
          {goals.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold text-gray-700">Completed</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">{completedGoals.length}</div>
                <div className="text-sm text-gray-500">of {goals.length} goals</div>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span className="font-semibold text-gray-700">Progress</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">{Math.round(progressPercentage)}%</div>
                <Progress value={progressPercentage} className="mt-2 h-2" />
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  <span className="font-semibold text-gray-700">Weekly Streak</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">{streak}</div>
                <div className="text-sm text-gray-500">goals this week</div>
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="pt-0">
          {goals.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-white rounded-xl p-8 shadow-sm">
                <Target className="h-16 w-16 text-blue-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Start Your Journey!
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Setting goals helps you stay focused and motivated throughout the event. 
                  What would you like to achieve?
                </p>
                <Button
                  onClick={handleSetGoal}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Set Your First Goal 🎯
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => (
                <div
                  key={goal.id}
                  className={`bg-white rounded-xl p-6 shadow-sm border-l-4 transition-all hover:shadow-md ${
                    goal.status === "completed"
                      ? "border-l-green-500 bg-gradient-to-r from-green-50 to-white"
                      : "border-l-blue-500 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <button
                        onClick={() => handleToggleStatus(goal)}
                        className={`mt-1 transition-all duration-200 ${
                          goal.status === "completed"
                            ? "text-green-600 hover:text-green-700"
                            : "text-gray-400 hover:text-blue-600"
                        }`}
                      >
                        {goal.status === "completed" ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <div className="h-6 w-6 rounded-full border-2 border-current hover:bg-current hover:bg-opacity-10" />
                        )}
                      </button>
                      
                      <div className="flex-1">
                        {editingGoalId === goal.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editedContent}
                              onChange={(e) => setEditedContent(e.target.value)}
                              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(goal.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingGoalId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className={`text-lg leading-relaxed ${
                              goal.status === "completed" 
                                ? "text-gray-700 line-through decoration-2" 
                                : "text-gray-800"
                            }`}>
                              {goal.content}
                            </p>
                            <div className="flex items-center gap-4 mt-3">
                              <div className="flex items-center gap-1 text-sm text-gray-500">
                                <Calendar className="h-4 w-4" />
                                {new Date(goal.created_at).toLocaleDateString()}
                              </div>
                              <Badge 
                                variant={goal.status === "completed" ? "default" : "secondary"}
                                className={goal.status === "completed" ? "bg-green-100 text-green-800" : ""}
                              >
                                {goal.status === "completed" ? "✅ Completed" : "🔄 In Progress"}
                              </Badge>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {editingGoalId !== goal.id && (
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditGoal(goal)}
                          className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {goal.status === "completed" && (
                    <div className="mt-4 p-3 bg-green-100 rounded-lg">
                      <div className="flex items-center gap-2 text-green-800">
                        <Star className="h-4 w-4" />
                        <span className="text-sm font-medium">Congratulations! You've completed this goal! 🎉</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <Target className="h-7 w-7" />
                Set a New Goal
              </DialogTitle>
              <p className="text-blue-100 mt-2">
                What would you like to achieve during this event? Make it specific and actionable!
              </p>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <Label htmlFor="goal-input" className="text-lg font-semibold text-gray-700">
                Your Goal
              </Label>
              <div className="flex gap-3">
                <textarea
                  id="goal-input"
                  placeholder="e.g., Build a mobile app prototype using React Native by the end of the hackathon..."
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitGoal();
                    }
                  }}
                  className="flex-1 p-4 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-lg"
                  rows={4}
                />
                <VoiceInput setText={setNewGoal} />
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold text-gray-700">
                  💡 Need inspiration?
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllRecommendations(!showAllRecommendations)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  {showAllRecommendations ? "Show Less" : "Show More"}
                </Button>
              </div>
              
              <div className="grid gap-3">
                {(showAllRecommendations ? goalRecommendations : goalRecommendations.slice(0, 3)).map((rec, index) => (
                  <button
                    key={index}
                    className="p-4 text-left rounded-lg border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                    onClick={() => handleSelectRecommendation(rec)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 group-hover:text-blue-700 font-medium">
                        {rec}
                      </span>
                      <Plus className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter className="bg-gray-50 px-6 py-4">
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>Pro tip: Make your goals specific and time-bound!</span>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-full"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitGoal}
                  disabled={isSubmitting || !newGoal.trim()}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full px-8 py-2 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Setting Goal...
                    </>
                  ) : (
                    <>
                      <Target className="h-4 w-4 mr-2" />
                      Set Goal
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

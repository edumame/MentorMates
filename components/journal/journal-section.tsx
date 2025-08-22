"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { createClient } from "@/app/utils/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { useParams } from "next/navigation";
import { 
  Pencil, 
  Plus, 
  X, 
  Loader2, 
  BookOpen, 
  Calendar,
  Lock,
  Globe,
  Lightbulb,
  Zap,
  TrendingUp
} from "lucide-react";
import VoiceInput from "../utils/VoiceInput";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const supabase = createClient();

interface JournalEntry {
  id: string;
  user_id: string;
  event_id: string;
  type: "journal";
  content: string;
  display_name: string;
  created_at: string;
  is_private?: boolean;
  tags?: string[];
}

interface JournalSectionProps {
  eventId?: string;
}

const writingPrompts = [
  "💭 What's one thing you learned today that surprised you?",
  "🚀 What challenge are you most excited to tackle next?",
  "🤝 Describe a meaningful conversation you had today",
  "🎯 What progress did you make toward your goals today?",
  "💡 What's an idea that's been bouncing around in your head?",
  "🌟 What's something you're proud of from today?",
  "🔍 What problem are you trying to solve with your project?",
  "📚 What skills are you developing during this event?",
];

const encouragingMessages = [
  "Your thoughts matter! Keep writing! ✨",
  "Every entry is a step forward in your journey! 🌟",
  "Reflection leads to growth! 🌱",
  "You're building great habits! 💪",
];

export default function JournalSection({ eventId: propEventId }: JournalSectionProps) {
  const params = useParams();
  const eventId = propEventId || (params.id as string);
  
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [userProfile, setUserProfile] = useState<{ uid: string } | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [entry, setEntry] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  const { toast } = useToast();

  // Calculate journal metrics
  const entriesThisWeek = entries.filter(entry => {
    const entryDate = new Date(entry.created_at);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return entryDate >= weekAgo;
  }).length;

  const totalWordCount = entries.reduce((total, entry) => {
    return total + entry.content.split(/\s+/).length;
  }, 0);

  const fetchEntries = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.email) return;

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("uid")
      .eq("email", session.session.user.email)
      .single();

    if (profileError || !profile) {
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
      .eq("type", "journal")
      .eq("user_id", profile.uid)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error fetching journal entries",
        description: "Please try again later",
        variant: "destructive",
      });
      return;
    }
    if (data) {
      setEntries(data);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (eventId) {
      const initSession = async () => {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user?.email) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("uid")
            .eq("email", session.session.user.email)
            .single();
          if (profile) {
            setUserProfile(profile);
          }
        }
        fetchEntries();
      };
      initSession();
    }
  }, [eventId, fetchEntries]);

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

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSubmitEntry = async () => {
    if (!entry.trim()) return;
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id || !session.session.user.email) {
      toast({
        title: "Authentication error",
        description: "Please sign in to create journal entries",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

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
        type: "journal",
        content: entry.trim(),
        display_name: session.session.user.user_metadata.full_name,
        is_private: isPrivate,
        tags: tags.length > 0 ? tags : undefined,
      },
    ]);

    if (error) {
      toast({
        title: "Error saving journal entry",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    await incrementPulse(session.session.user.email);
    setIsSubmitting(false);
    
    // Show encouraging success message
    const randomMessage = encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)];
    toast({
      title: "📝 Entry saved!",
      description: randomMessage,
    });
    
    setEntry("");
    setIsPrivate(false);
    setTags([]);
    setIsCreating(false);
    setSelectedPrompt(null);
    fetchEntries();
  };

  const handleEditEntry = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setEditContent(entry.content);
    setIsPrivate(entry.is_private || false);
    setTags(entry.tags || []);
    setIsCreating(true);
  };

  const handleUpdateEntry = async () => {
    if (!editContent.trim() || !editingId) return;

    setIsSubmitting(true);

    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.email) {
      toast({
        title: "Authentication error",
        description: "Please sign in to update journal entries",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

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

    const { error } = await supabase
      .from("platform_engagement")
      .update({
        content: editContent.trim(),
        is_private: isPrivate,
        tags: tags.length > 0 ? tags : undefined,
      })
      .eq("id", editingId)
      .eq("user_id", userProfile.uid);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update journal entry",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Journal entry updated",
      });
      setEntries((prev) =>
        prev.map((ent) =>
          ent.id === editingId
            ? { ...ent, content: editContent.trim(), is_private: isPrivate, tags: tags.length > 0 ? tags : undefined }
            : ent
        )
      );
      setEditingId(null);
      setEditContent("");
      setIsPrivate(false);
      setTags([]);
      setIsCreating(false);
    }
    setIsSubmitting(false);
  };

  const toggleExpansion = (id: string) => {
    setExpandedEntryId(expandedEntryId === id ? null : id);
  };

  const handlePromptSelect = (prompt: string) => {
    setSelectedPrompt(prompt);
    setEntry(`${prompt}\n\n`);
    setIsCreating(true);
  };

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning! What's on your mind today? 🌅";
    if (hour < 17) return "Good afternoon! How's your day going? ☀️";
    return "Good evening! Time to reflect on your day! 🌙";
  };

  return (
    <Card className="w-full bg-gradient-to-br from-purple-50 to-pink-100 border-0 shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-gray-800">Your Journal</CardTitle>
              <p className="text-sm text-gray-600 mt-1">{getTimeBasedGreeting()}</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setIsCreating(true);
              setEditingId(null);
              setEntry("");
              setIsPrivate(false);
              setTags([]);
              setSelectedPrompt(null);
            }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full px-6 py-2 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
        </div>
        
        {/* Journal Stats */}
        {entries.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-purple-500" />
                <span className="font-semibold text-gray-700">Total Entries</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{entries.length}</div>
              <div className="text-sm text-gray-500">journal entries</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-orange-500" />
                <span className="font-semibold text-gray-700">This Week</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{entriesThisWeek}</div>
              <div className="text-sm text-gray-500">entries written</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-gray-700">Words Written</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{totalWordCount.toLocaleString()}</div>
              <div className="text-sm text-gray-500">total words</div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Writing Prompts Section - Show when no entries or when creating */}
        {(entries.length === 0 || isCreating) && !editingId && (
          <div className="mb-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-gray-800">
                  {entries.length === 0 ? "Get Started with a Writing Prompt" : "Need inspiration?"}
                </h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {writingPrompts.slice(0, entries.length === 0 ? 4 : 2).map((prompt, index) => (
                  <button
                    key={index}
                    className="p-4 text-left rounded-lg border-2 border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 group"
                    onClick={() => handlePromptSelect(prompt)}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-gray-700 group-hover:text-purple-700 font-medium text-sm leading-relaxed">
                        {prompt}
                      </span>
                      <Plus className="h-4 w-4 text-gray-400 group-hover:text-purple-600 mt-1 ml-2 flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Create / Edit Journal Entry Form */}
        {(isCreating || editingId) && (
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border-2 border-purple-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-600" />
                {editingId ? "Edit Entry" : "New Journal Entry"}
              </h3>
              <Button 
                variant="ghost" 
                onClick={() => {
                  setIsCreating(false);
                  setEditingId(null);
                  setEntry("");
                  setEditContent("");
                  setIsPrivate(false);
                  setTags([]);
                  setSelectedPrompt(null);
                }}
                className="text-gray-500 hover:text-gray-700 rounded-full p-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {selectedPrompt && !editingId && (
              <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 text-purple-700">
                  <Lightbulb className="h-4 w-4" />
                  <span className="text-sm font-medium">Writing Prompt:</span>
                </div>
                <p className="text-purple-800 mt-1 font-medium">{selectedPrompt}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <Textarea
                value={editingId ? editContent : entry}
                onChange={(e) =>
                  editingId ? setEditContent(e.target.value) : setEntry(e.target.value)
                }
                placeholder={selectedPrompt ? "Share your thoughts..." : "What's on your mind? Write about your experiences, learnings, challenges, or ideas..."}
                rows={6}
                className="w-full p-4 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-lg leading-relaxed"
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch 
                      id="private" 
                      checked={isPrivate} 
                      onCheckedChange={setIsPrivate}
                      className="data-[state=checked]:bg-purple-600"
                    />
                    <Label htmlFor="private" className="flex items-center gap-1 text-sm font-medium text-gray-700">
                      {isPrivate ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                      {isPrivate ? "Private" : "Shareable"}
                    </Label>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    {showAdvancedOptions ? "Hide Options" : "Add Tags"}
                  </Button>
                </div>
                
                <VoiceInput setText={editingId ? setEditContent : setEntry} />
              </div>
              
              {/* Advanced Options */}
              {showAdvancedOptions && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex gap-3">
                    <Input
                      placeholder="Add a tag (e.g., learning, challenge, idea)"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleAddTag} 
                      variant="outline"
                      className="px-4"
                    >
                      Add
                    </Button>
                  </div>
                  
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="px-3 py-1 bg-purple-100 text-purple-800 flex items-center gap-1"
                        >
                          {tag}
                          <button 
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-purple-900"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex justify-end">
                <Button
                  onClick={editingId ? handleUpdateEntry : handleSubmitEntry}
                  disabled={isSubmitting || (!(editingId ? editContent : entry).trim())}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full px-8 py-2 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      {editingId ? "Updating..." : "Saving..."}
                    </>
                  ) : (
                    <>
                      <BookOpen className="h-4 w-4 mr-2" />
                      {editingId ? "Update Entry" : "Save Entry"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {entries.length === 0 && !isCreating ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <BookOpen className="h-16 w-16 text-purple-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Start Your Journal Journey!
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Journaling helps you reflect on your experiences, track your learning, and capture important insights. 
                Your thoughts and ideas are valuable!
              </p>
              <Button
                onClick={() => setIsCreating(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Write Your First Entry ✨
              </Button>
            </div>
          </div>
        ) : !isCreating && !editingId ? (
          /* List of Previous Entries */
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-600" />
                Your Entries
              </h3>
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </Badge>
            </div>
            
            {entries.map((entry) => {
              const isExpanded = expandedEntryId === entry.id;
              const preview = entry.content.length > 150 ? entry.content.substring(0, 150) + "..." : entry.content;
              const wordCount = entry.content.split(/\s+/).length;
              
              return (
                <div
                  key={entry.id}
                  className={`bg-white rounded-xl p-6 shadow-sm border-l-4 transition-all hover:shadow-md cursor-pointer ${
                    entry.is_private 
                      ? "border-l-red-400 bg-gradient-to-r from-red-50 to-white" 
                      : "border-l-purple-400"
                  }`}
                  onClick={() => toggleExpansion(entry.id)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        {new Date(entry.created_at).toLocaleDateString()}
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`${
                          entry.is_private 
                            ? "bg-red-100 text-red-800" 
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {entry.is_private ? (
                          <>
                            <Lock className="h-3 w-3 mr-1" />
                            Private
                          </>
                        ) : (
                          <>
                            <Globe className="h-3 w-3 mr-1" />
                            Shareable
                          </>
                        )}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {wordCount} words
                      </Badge>
                    </div>
                    
                    {entry.user_id === userProfile?.uid && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditEntry(entry);
                        }}
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {isExpanded ? entry.content : preview}
                    </p>
                  </div>
                  
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {entry.tags.map((tag, index) => (
                        <Badge 
                          key={index} 
                          variant="outline" 
                          className="text-xs bg-gray-100 text-gray-700"
                        >
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {!isExpanded && entry.content.length > 150 && (
                    <div className="mt-3 text-center">
                      <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-700">
                        Click to read more...
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

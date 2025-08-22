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
import { Pencil, Plus, X, Loader2 } from "lucide-react";
import VoiceInput from "../utils/VoiceInput";
import { Badge } from "@/components/ui/badge";
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

const JOURNAL_PROMPTS = [
  "What did you learn today and how will you apply it tomorrow?",
  "What was your biggest blocker today and how did you navigate it?",
  "One win, one challenge, and one next step.",
  "Who helped you today and what did you learn from them?",
  "What surprised you today?"
];

function countWords(text: string) {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

function calculateStreak(entries: JournalEntry[]): number {
  if (entries.length === 0) return 0;
  const days = new Set(entries.map((e) => new Date(e.created_at).toDateString()));
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

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
  
  const { toast } = useToast();

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

  // Load draft from localStorage on mount when creating a new entry
  useEffect(() => {
    if (!isCreating || editingId) return;
    const key = `journal_draft_${eventId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { content: string; isPrivate: boolean; tags: string[] };
        setEntry(parsed.content || "");
        setIsPrivate(!!parsed.isPrivate);
        setTags(Array.isArray(parsed.tags) ? parsed.tags : []);
      }
    } catch {}
  }, [isCreating, editingId, eventId]);

  // Autosave draft to localStorage
  useEffect(() => {
    const key = `journal_draft_${eventId}`;
    const current = editingId ? editContent : entry;
    if ((isCreating || editingId) && current.trim().length > 0) {
      const payload = JSON.stringify({ content: current, isPrivate, tags });
      try { localStorage.setItem(key, payload); } catch {}
    }
  }, [entry, editContent, isPrivate, tags, isCreating, editingId, eventId]);

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
    toast({
      title: "Journal entry saved",
      description: "Your entry has been saved successfully",
    });
    setEntry("");
    setIsPrivate(false);
    setTags([]);
    setIsCreating(false);
    try { localStorage.removeItem(`journal_draft_${eventId}`); } catch {}
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

  const activeText = editingId ? editContent : entry;
  const wordCount = countWords(activeText);
  const promptOfTheDay = JOURNAL_PROMPTS[new Date().getDate() % JOURNAL_PROMPTS.length];
  const streak = calculateStreak(entries);

  return (
    <div className="bg-white rounded-xl shadow-md">
      <div className="mx-auto">
        {/* Blue Header */}
        <div className="bg-blue-900 text-white p-4 rounded-t-xl">
          <h2 className="text-2xl font-bold">Journal</h2>
          <p className="text-lg">Write down your thoughts, track your progress, and capture insights.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary" className="bg-white/20 text-white">Streak: {streak} day{streak === 1 ? "" : "s"}</Badge>
            <Badge variant="secondary" className="bg-white/20 text-white">Entries: {entries.length}</Badge>
          </div>
        </div>

        {/* Header with Plus Button for new entry */}
        <div className="flex justify-between items-center p-4 bg-blue-50">
          <h1 className="text-xl font-bold">Your Entries</h1>
          <Button variant="ghost" onClick={() => {
            setIsCreating(true);
            setEditingId(null);
            setEntry("");
            setIsPrivate(false);
            setTags([]);
          }}>
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        {/* Create / Edit Journal Entry Form */}
        {(isCreating || editingId) ? (
          <div className="bg-white p-4 rounded-b-xl shadow mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold">
                {editingId ? "Edit Journal Entry" : "New Journal Entry"}
              </h2>
              <Button variant="ghost" onClick={() => {
                setIsCreating(false);
                setEditingId(null);
                setEntry("");
                setEditContent("");
                setIsPrivate(false);
                setTags([]);
              }}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="mb-2 text-sm text-gray-600">
              <span className="font-medium">Prompt:</span> {promptOfTheDay}
            </div>
            <div className="flex gap-2 flex-wrap mb-2">
              {JOURNAL_PROMPTS.map((p, i) => (
                <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => {
                  const base = editingId ? editContent : entry;
                  const joiner = base.trim().length ? "\n\n" : "";
                  (editingId ? setEditContent : setEntry)(`${base}${joiner}${p}`);
                }}>Use</Badge>
              ))}
            </div>
            <Textarea
              value={editingId ? editContent : entry}
              onChange={(e) =>
                editingId ? setEditContent(e.target.value) : setEntry(e.target.value)
              }
              placeholder="Write your journal entry..."
              rows={5}
              className="w-full p-2 border rounded mb-1"
            />
            <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <Switch id="private" checked={isPrivate} onCheckedChange={setIsPrivate} />
                <Label htmlFor="private">Private</Label>
              </div>
              <div>{wordCount} word{wordCount === 1 ? "" : "s"}</div>
            </div>
            <div className="flex gap-3 mb-2">
              <Input
                placeholder="Add a tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1 p-2 border rounded"
              />
              <Button onClick={handleAddTag} className="px-4 py-2">
                Add Tag
              </Button>
              <VoiceInput setText={editingId ? setEditContent : setEntry} />
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, index) => (
                  <span key={index} className="px-3 py-1 bg-gray-200 rounded-full text-sm flex items-center gap-1">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button
                onClick={editingId ? handleUpdateEntry : handleSubmitEntry}
                disabled={isSubmitting || (!(editingId ? editContent : entry).trim())}
                className="bg-blue-800 text-white rounded-full mt-2 px-6 py-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : editingId ? "Update Entry" : "Save Entry"}
              </Button>
            </div>
          </div>
        ) : (
          /* List of Previous Entries (Sneak Peek) */
          <div className="space-y-4 p-4">
            {entries.length === 0 ? (
              <p className="text-gray-500">No journal entries yet. Tap the plus button to add one.</p>
            ) : (
              entries.map((entry) => {
                const isExpanded = expandedEntryId === entry.id;
                const preview =
                  entry.content.length > 100 ? entry.content.substring(0, 100) + "..." : entry.content;
                return (
                  <div
                    key={entry.id}
                    className={`p-4 rounded-lg shadow cursor-pointer ${entry.is_private ? "bg-red-50" : "bg-gray-50"}`}
                    onClick={() => toggleExpansion(entry.id)}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{entry.display_name}</span>
                        {entry.is_private && (
                          <span className="text-xs text-white bg-red-500 rounded-full px-2 py-0.5">
                            Private
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">
                      {isExpanded ? entry.content : preview}
                    </p>
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.tags.map((tag, index) => (
                          <span key={index} className="px-2 py-0.5 bg-gray-200 rounded-full text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {entry.user_id === userProfile?.uid && (
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditEntry(entry);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

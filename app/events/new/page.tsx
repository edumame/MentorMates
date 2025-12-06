"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { EventVisibility } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { MapPin, Image, Type, Mail, Globe, Sparkles } from "lucide-react";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";

export default function NewEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [ticketType, setTicketType] = useState<"free" | "paid">("free");
  const [visibility, setVisibility] = useState<EventVisibility>(EventVisibility.Draft);
  const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [form, setForm] = useState({
    event_name: "",
    event_date: "",
    location: "",
    slug: "",
    event_description: "",
    event_blurb: "",
    cover_image_url: "",
    organizer_emails: "",
  });

  const onChange = (key: keyof typeof form, value: string) => setForm((p) => ({ ...p, [key]: value }));

  useEffect(() => {
    const checkAccess = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.push("/login");
        return;
      }
      const userId = sessionData.session.user.id;
      const { data: adminData } = await supabase.rpc("is_admin_user", { user_id: userId });
      if (!adminData) {
        router.push("/events");
        return;
      }
      setIsAdmin(true);
      setLoading(false);
    };
    checkAccess();
  }, [router]);

  const handleCreate = async () => {
    if (!form.event_name || !form.event_date || !form.location) {
      toast({ title: "Missing fields", description: "Name, date, and location are required.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      // Get current user's email
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserEmail = sessionData?.session?.user?.email;

      // Parse organizer emails from form and add current user
      const organizerEmails = (form.organizer_emails || "").split(",").map((e) => e.trim()).filter(Boolean);

      // Add current user's email if not already in the list
      if (currentUserEmail && !organizerEmails.includes(currentUserEmail)) {
        organizerEmails.unshift(currentUserEmail); // Add at the beginning
      }

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: {
            event_name: form.event_name,
            event_date: form.event_date,
            location: form.location,
            visibility: visibility,
            slug: form.slug || undefined,
            event_description: form.event_description || undefined,
            event_blurb: form.event_blurb || undefined,
            cover_image_url: form.cover_image_url || undefined,
            paid: ticketType === "paid",
          },
          organizerEmails,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Create failed", description: data.error || "Error creating event.", variant: "destructive" });
        return;
      }
      toast({ title: "Event created", description: `${data.event.event_name} created successfully.` });
      router.push(`/events/${data.event.slug || data.event.event_id}/overview`);
    } catch {
      toast({ title: "Network error", description: "Unable to create event.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // Call AI endpoint to parse/generate event details from pasted text or a brief
  const handleAi = async (mode: "fill" | "generate") => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/events/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiInput, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "AI fill failed", description: data?.error || "Unable to parse with AI.", variant: "destructive" });
        return;
      }

      const fields = data?.fields || {};

      // Apply returned fields into the form in a controlled way
      setForm((prev) => ({
        ...prev,
        event_name: fields.event_name ?? prev.event_name,
        event_date: fields.event_date ?? prev.event_date,
        location: fields.location ?? prev.location,
        slug: fields.slug ?? prev.slug,
        event_description: fields.event_description ?? prev.event_description,
        event_blurb: fields.event_blurb ?? prev.event_blurb,
        cover_image_url: fields.cover_image_url ?? prev.cover_image_url,
      }));

      // Ticket type mapping
      if (typeof fields.paid === "boolean") {
        setTicketType(fields.paid ? "paid" : "free");
      }

      // Visibility mapping (safely map case-insensitively)
      if (typeof fields.visibility === "string") {
        const v = (fields.visibility as string).toLowerCase();
        if (v === "public") setVisibility(EventVisibility.Public);
        else if (v === "private") setVisibility(EventVisibility.Private);
        else if (v === "draft") setVisibility(EventVisibility.Draft);
        else if (v === "demo") setVisibility(EventVisibility.Demo);
        else if (v === "test") setVisibility(EventVisibility.Test);
        else if (v === "archived") setVisibility(EventVisibility.Archived);
      }

      toast({ title: "Fields updated", description: "AI filled the form from your input." });
    } catch {
      toast({ title: "Network error", description: "Unable to contact AI service.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center flex-grow">
          <p className="text-lg">Loading...</p>
        </div>
      </PageContainer>
    );
  }

  if (!isAdmin) return null;

  const formatDateForPreview = (dateStr: string) => {
    if (!dateStr) return { day: "09", month: "Feb", year: "2024", weekday: "Fri" };
    const date = new Date(dateStr);
    return {
      day: date.getDate().toString().padStart(2, "0"),
      month: date.toLocaleDateString("en-US", { month: "short" }),
      year: date.getFullYear().toString(),
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
    };
  };

  const previewDate = formatDateForPreview(form.event_date);

  return (
    <PageContainer>
      <PageContent className="px-0">
        <div
          className="min-h-full"
          style={{
            background: "linear-gradient(199.653deg, rgb(219, 234, 254) 13.188%, rgba(255, 255, 255, 0) 65.83%), linear-gradient(90deg, rgb(255, 255, 255) 0%, rgb(255, 255, 255) 100%)"
          }}
        >
          <div className="px-8 py-6 max-w-[1128px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="relative">
                <button
                  onClick={() => setShowVisibilityDropdown(!showVisibilityDropdown)}
                  className="flex items-center gap-2 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] px-3 py-2 h-[44px] w-[142px] hover:bg-gray-50 transition-colors"
                >
                  <Globe className="w-6 h-6" />
                  <span className="text-[16px] font-normal">{visibility}</span>
                  <svg className="w-6 h-6 ml-auto" viewBox="0 0 24 24" fill="none">
                    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {showVisibilityDropdown && (
                  <div className="absolute top-full mt-2 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] shadow-lg z-10 w-[142px] overflow-hidden">
                    {[EventVisibility.Public, EventVisibility.Private, EventVisibility.Unlisted, EventVisibility.Draft].map((vis) => (
                      <button
                        key={vis}
                        onClick={() => {
                          setVisibility(vis);
                          setShowVisibilityDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-[16px] font-normal"
                      >
                        {vis}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-1">
                <Button
                  variant="defaultGray"
                  onClick={() => router.back()}
                  className="text-[16px] font-medium"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating}
                  className="text-[16px] font-medium"
                >
                  {creating ? "Creating..." : "Create event"}
                </Button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex gap-6 items-start">
              {/* Form Section */}
              <div className="flex-1 max-w-[640px]">
                {/* AI Assist Panel */}
                <div className="mb-6 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-[#4b89ef]" />
                    <span className="text-[16px] font-semibold text-black">Generate or fill with AI</span>
                  </div>
                  <Textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Paste event details or a short brief here..."
                    className="min-h-[120px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3"
                  />
                  <div className="flex gap-2 mt-3">
                    <Button onClick={() => handleAi("fill")} disabled={aiLoading || !aiInput.trim()} className="text-[16px] font-medium">
                      {aiLoading ? "Working..." : "Fill with AI"}
                    </Button>
                    <Button variant="secondary" onClick={() => handleAi("generate")} disabled={aiLoading || !aiInput.trim()} className="text-[16px] font-medium">
                      {aiLoading ? "Working..." : "Generate with AI"}
                    </Button>
                  </div>
                </div>

                <input
                  type="text"
                  value={form.event_name}
                  onChange={(e) => onChange("event_name", e.target.value)}
                  placeholder="Event Title"
                  className="font-semibold text-[36px] leading-[1.3] tracking-[-2.16px] mb-6 w-full bg-transparent border-none outline-none focus:ring-0 p-0"
                  style={{
                    color: form.event_name ? "#000000" : "#d8d8d8",
                    fontFamily: "Geist, sans-serif"
                  }}
                />

                <div className="space-y-4">
                  {/* Date */}
                  <div className="space-y-2">
                    <label className="text-[16px] font-normal text-black">Date</label>
                    <DatePicker
                      value={form.event_date}
                      onChange={(value) => onChange("event_date", value)}
                      placeholder="mm/dd/yyyy"
                    />
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <label className="text-[16px] font-normal text-black">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                      <Input
                        value={form.location}
                        onChange={(e) => onChange("location", e.target.value)}
                        placeholder="Add offline location or virtual link"
                        className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
                      />
                    </div>
                  </div>

                  {/* Cover Image URL */}
                  <div className="space-y-2">
                    <label className="text-[16px] font-normal text-black">Cover image url</label>
                    <div className="relative">
                      <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                      <Input
                        value={form.cover_image_url}
                        onChange={(e) => onChange("cover_image_url", e.target.value)}
                        placeholder="https://..."
                        className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
                      />
                    </div>
                  </div>

                  {/* Blurb */}
                  <div className="space-y-2">
                    <label className="text-[16px] font-normal text-black">Blurb</label>
                    <div className="relative">
                      <Type className="absolute left-3 top-3 w-6 h-6 text-gray-600" />
                      <Input
                        value={form.event_blurb}
                        onChange={(e) => onChange("event_blurb", e.target.value)}
                        placeholder="Short description shown in the preview card"
                        className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-[16px] font-normal text-black">Description</label>
                    <Textarea
                      value={form.event_description}
                      onChange={(e) => onChange("event_description", e.target.value)}
                      placeholder="Long description or markdown"
                      className="min-h-[179px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3"
                    />
                  </div>

                  {/* Tickets */}
                  <div className="space-y-2">
                    <label className="text-[16px] font-normal text-black">Tickets</label>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setTicketType("free")}
                        className={`px-4 py-2 rounded-[12px] text-[16px] font-normal transition-colors ${
                          ticketType === "free"
                            ? "bg-[#4b89ef] text-white"
                            : "bg-transparent border border-[rgba(0,0,0,0.15)] text-black"
                        }`}
                      >
                        Free
                      </button>
                      <button
                        onClick={() => setTicketType("paid")}
                        className={`px-4 py-2 rounded-[12px] text-[16px] font-normal transition-colors ${
                          ticketType === "paid"
                            ? "bg-[#4b89ef] text-white"
                            : "bg-transparent border border-[rgba(0,0,0,0.15)] text-black"
                        }`}
                      >
                        Paid
                      </button>
                    </div>
                  </div>

                  {/* Add Organizer */}
                  <div className="space-y-2">
                    <label className="text-[16px] font-normal text-black">Add organizer</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                      <Input
                        value={form.organizer_emails}
                        onChange={(e) => onChange("organizer_emails", e.target.value)}
                        placeholder="Separate emails with ,"
                        className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Card */}
              <div className="flex-shrink-0">
                <div className="w-[335px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] overflow-hidden">
                  {/* Image */}
                  <div className="relative w-full aspect-[335/223]">
                    {form.cover_image_url ? (
                      <img
                        src={form.cover_image_url}
                        alt="Event cover"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-400 via-red-500 to-purple-600" />
                    )}

                    {/* Date Badge */}
                    <div className="absolute top-4 right-4 bg-white border border-[#aaaaaa] rounded-[6px] w-[112px] py-3 px-1 text-center">
                      <p className="text-[14px] font-normal text-black">{previewDate.weekday}</p>
                      <p className="text-[36px] font-semibold leading-[1.3] tracking-[-2.16px] text-black" style={{ fontFamily: "Geist, sans-serif" }}>
                        {previewDate.day}
                      </p>
                      <p className="text-[14px] font-normal text-black">
                        {previewDate.month} {previewDate.year}
                      </p>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="flex flex-wrap gap-1 mb-3">
                      <span className="px-[10px] py-1 border border-[rgba(0,0,0,0.15)] rounded-full text-[14px] font-semibold text-black">
                        Hackathon
                      </span>
                      <span className="px-[10px] py-1 border border-[rgba(0,0,0,0.15)] rounded-full text-[14px] font-semibold text-black">
                        {ticketType === "free" ? "Free" : "Paid"}
                      </span>
                    </div>

                    <h2
                      className="text-[28px] font-semibold leading-[1.4] tracking-[-1.68px] text-black mb-1"
                      style={{ fontFamily: "Geist, sans-serif" }}
                    >
                      {form.event_name || "Innovate Together"}
                    </h2>

                    <div className="flex items-center gap-1 mb-2">
                      <MapPin className="w-6 h-6" />
                      <span className="text-[14px] font-normal text-black">
                        {form.location || "Online"}
                      </span>
                    </div>

                    <p className="text-[16px] font-normal text-black leading-[1.5]">
                      {form.event_blurb || "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros."}
                    </p>
                  </div>
                </div>

                <p className="text-[16px] text-[#7f7f7f] text-center mt-3">
                  This is a preview of the event.
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageContent>
    </PageContainer>
  );
}

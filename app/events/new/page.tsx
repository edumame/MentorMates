"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { EventVisibility } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/lib/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import {
  MapPin,
  Image,
  Type,
  Mail,
  Globe,
  Sparkles,
  Calendar,
  FileText,
  Shield,
  FolderKanban,
  DollarSign,
  Bell,
  Users,
  Building2,
  Video,
  Upload,
} from "lucide-react";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";

export default function NewEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [ticketType, setTicketType] = useState<"free" | "paid">("free");
  const [visibility, setVisibility] = useState<EventVisibility>(
    EventVisibility.Draft
  );
  const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeSubTab, setActiveSubTab] = useState("basics");

  // Content edit/preview toggling state
  const [paywallMode, setPaywallMode] = useState<"edit" | "preview">("edit");

  const [form, setForm] = useState({
    event_name: "",
    event_date: "",
    location: "",
    slug: "",
    event_description: "",
    event_blurb: "",
    cover_image_url: "",
    organizer_emails: "",
    submission_time_start: "",
    submission_time_cutoff: "",
    participant_capacity: "",
    event_type: "",
    location_type: "virtual", // "in-person" or "virtual"
    paywall_content: "",
  });

  const onChange = (key: keyof typeof form, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));

  useEffect(() => {
    const checkAccess = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.push("/login");
        return;
      }
      const userId = sessionData.session.user.id;
      const { data: adminData } = await supabase.rpc("is_admin_user", {
        user_id: userId,
      });
      if (!adminData) {
        router.push("/events");
        return;
      }
      setIsAdmin(true);
      setLoading(false);
    };
    checkAccess();
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("mentorMates-event-prefill");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") return;

      setForm((prev) => ({
        ...prev,
        event_name: parsed.event_name ?? prev.event_name,
        event_date: parsed.event_date ?? prev.event_date,
        location: parsed.location ?? prev.location,
        slug: parsed.slug ?? prev.slug,
        event_description: parsed.event_description ?? prev.event_description,
        event_blurb: parsed.event_blurb ?? prev.event_blurb,
        cover_image_url: parsed.cover_image_url ?? prev.cover_image_url,
      }));

      if (typeof parsed.paid === "boolean") {
        setTicketType(parsed.paid ? "paid" : "free");
      }

      if (typeof parsed.visibility === "string") {
        const v = parsed.visibility.toLowerCase();
        if (v === "public") setVisibility(EventVisibility.Public);
        else if (v === "private") setVisibility(EventVisibility.Private);
        else if (v === "draft") setVisibility(EventVisibility.Draft);
      }

      toast({
        title: "Imported event details",
        description: "Review and customize before publishing.",
      });
    } catch (error) {
      console.error("Failed to load event prefill", error);
    } finally {
      window.localStorage.removeItem("mentorMates-event-prefill");
    }
  }, [toast]);

  const handleCreate = async () => {
    if (!form.event_name || !form.event_date || !form.location) {
      toast({
        title: "Missing fields",
        description: "Name, date, and location are required.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserEmail = sessionData?.session?.user?.email;

      const organizerEmails = (form.organizer_emails || "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      if (currentUserEmail && !organizerEmails.includes(currentUserEmail)) {
        organizerEmails.unshift(currentUserEmail);
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
            submission_time_start: form.submission_time_start || undefined,
            submission_time_cutoff: form.submission_time_cutoff || undefined,
            participant_capacity: form.participant_capacity
              ? parseInt(form.participant_capacity, 10)
              : undefined,
            event_type: form.event_type || undefined,
            paywall_content: form.paywall_content || undefined,
          },
          organizerEmails,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Create failed",
          description: data.error || "Error creating event.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Event created",
        description: `${data.event.event_name} created successfully.`,
      });
      router.push(`/events/${data.event.slug || data.event.event_id}/overview`);
    } catch {
      toast({
        title: "Network error",
        description: "Unable to create event.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

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
        toast({
          title: "AI fill failed",
          description: data?.error || "Unable to parse with AI.",
          variant: "destructive",
        });
        return;
      }

      const fields = data?.fields || {};

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

      if (typeof fields.paid === "boolean") {
        setTicketType(fields.paid ? "paid" : "free");
      }

      if (typeof fields.visibility === "string") {
        const v = (fields.visibility as string).toLowerCase();
        if (v === "public") setVisibility(EventVisibility.Public);
        else if (v === "private") setVisibility(EventVisibility.Private);
        else if (v === "draft") setVisibility(EventVisibility.Draft);
        else if (v === "demo") setVisibility(EventVisibility.Demo);
        else if (v === "test") setVisibility(EventVisibility.Test);
        else if (v === "archived") setVisibility(EventVisibility.Archived);
      }

      toast({
        title: "Fields updated",
        description: "AI filled the form from your input.",
      });
    } catch {
      toast({
        title: "Network error",
        description: "Unable to contact AI service.",
        variant: "destructive",
      });
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
    if (!dateStr)
      return {
        day: "09",
        month: "Feb",
        year: "2024",
        weekday: "Fri",
      };
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
    <PageContainer showBorder={false}>
      <PageContent>
        <div className="min-h-full">
          {/* Apply correct border and rounding for events/projects pages */}
          <div className="h-[calc(100vh-88px)] overflow-hidden flex flex-col lg:rounded-tl-2xl lg:border-t lg:border-l lg:border-[#D8D8D8] bg-white">
            <div className="px-6 sm:px-10 py-6 sm:py-8 flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div className="flex items-center justify-between mb-6 flex-shrink-0">
                <h1 className="text-2xl font-semibold text-gray-900">
                  Create event
                </h1>

                <div className="flex items-center gap-4">
                  <div className="relative">
                    <button
                      onClick={() =>
                        setShowVisibilityDropdown(!showVisibilityDropdown)
                      }
                      className="flex items-center gap-2 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] px-3 py-2 h-[44px] w-[142px] hover:bg-gray-50 transition-colors"
                    >
                      <Globe className="w-5 h-5" />
                      <span className="text-[16px] font-normal">
                        {visibility}
                      </span>
                      <svg
                        className="w-5 h-5 ml-auto"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M7 10l5 5 5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    {showVisibilityDropdown && (
                      <div className="absolute top-full mt-2 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] shadow-lg z-10 w-[142px] overflow-hidden">
                        {[
                          EventVisibility.Public,
                          EventVisibility.Private,
                          EventVisibility.Draft,
                        ].map((vis) => (
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

                  <div className="flex gap-2">
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
              </div>

              {/* Primary Tabs */}
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex-1 flex flex-col min-h-0"
              >
                <TabsList className="flex h-auto gap-6 items-center border-b border-[#d2d7e7] p-0 mb-6 justify-start flex-shrink-0 bg-transparent rounded-none">
                  <TabsTrigger
                    value="overview"
                    className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="registration"
                    className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0"
                  >
                    Registration
                  </TabsTrigger>
                  <TabsTrigger
                    value="project"
                    className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0"
                  >
                    Project
                  </TabsTrigger>
                  <TabsTrigger
                    value="access"
                    className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0"
                  >
                    Access
                  </TabsTrigger>
                  <TabsTrigger
                    value="tracks"
                    className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0"
                  >
                    Tracks
                  </TabsTrigger>
                  <TabsTrigger
                    value="pricing"
                    className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0"
                  >
                    Pricing
                  </TabsTrigger>
                  <TabsTrigger
                    value="notify"
                    className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0"
                  >
                    Notify
                  </TabsTrigger>
                </TabsList>

                {/* Content Area - Scrollable */}
                <div className="flex gap-6 items-start flex-1 min-h-0 overflow-auto no-scrollbar w-full">
                  {/* Form Section */}
                  <div className="flex-1 min-w-0 w-full left-0 flex flex-col items-start">
                    <TabsContent value="overview" className="mt-0">
                      <Tabs
                        value={activeSubTab}
                        onValueChange={setActiveSubTab}
                      >
                        <TabsList className="flex h-auto gap-2 overflow-x-auto bg-transparent p-0 mb-6 justify-start pb-1 items-center">
                          <TabsTrigger
                            value="basics"
                            className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)]"
                            style={{ fontFamily: "Inter, sans-serif" }}
                          >
                            Basics
                          </TabsTrigger>
                          <TabsTrigger
                            value="content"
                            className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)]"
                            style={{ fontFamily: "Inter, sans-serif" }}
                          >
                            Content
                          </TabsTrigger>
                          <TabsTrigger
                            value="schedule"
                            className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)]"
                            style={{ fontFamily: "Inter, sans-serif" }}
                          >
                            Schedule
                          </TabsTrigger>
                          <TabsTrigger
                            value="resources"
                            className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)]"
                            style={{ fontFamily: "Inter, sans-serif" }}
                          >
                            Resources
                          </TabsTrigger>
                          <TabsTrigger
                            value="rules"
                            className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)]"
                            style={{ fontFamily: "Inter, sans-serif" }}
                          >
                            Rules
                          </TabsTrigger>
                          <TabsTrigger
                            value="faqs"
                            className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)]"
                            style={{ fontFamily: "Inter, sans-serif" }}
                          >
                            FAQs
                          </TabsTrigger>
                          <TabsTrigger
                            value="gallery"
                            className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)]"
                            style={{ fontFamily: "Inter, sans-serif" }}
                          >
                            Gallery
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="basics" className="mt-0 space-y-4">
                          <input
                            type="text"
                            value={form.event_name}
                            onChange={(e) =>
                              onChange("event_name", e.target.value)
                            }
                            placeholder="Event Title"
                            className="font-semibold text-[36px] leading-[1.3] tracking-[-2.16px] mb-6 w-full bg-transparent border-none outline-none focus:ring-0 p-0"
                            style={{
                              color: form.event_name ? "#000000" : "#d8d8d8",
                              fontFamily: "Geist, sans-serif",
                            }}
                          />

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[16px] font-normal text-black">
                                Date
                              </label>
                              <DatePicker
                                value={form.event_date}
                                onChange={(value) =>
                                  onChange("event_date", value)
                                }
                                placeholder="mm/dd/yyyy"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[16px] font-normal text-black">
                                Project submission window (UTC)
                              </label>
                              <div className="flex items-center gap-2">
                                <DatePicker
                                  value={form.submission_time_start}
                                  onChange={(value) =>
                                    onChange("submission_time_start", value)
                                  }
                                  placeholder="mm/dd/yyyy"
                                />
                                <span className="text-gray-500">to</span>
                                <DatePicker
                                  value={form.submission_time_cutoff}
                                  onChange={(value) =>
                                    onChange("submission_time_cutoff", value)
                                  }
                                  placeholder="mm/dd/yyyy"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[16px] font-normal text-black">
                                Seat Cap
                              </label>
                              <div className="relative">
                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                <Input
                                  type="number"
                                  value={form.participant_capacity}
                                  onChange={(e) =>
                                    onChange(
                                      "participant_capacity",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Leave blank for unlimited participants"
                                  className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                />
                              </div>
                            </div>

                            <div className="space-y-2 w-full">
                              <label className="text-[16px] font-normal text-black">
                                Location
                              </label>
                              <div className="flex items-center gap-4 mb-2 w-full">
                                <button
                                  onClick={() =>
                                    setForm((p) => ({
                                      ...p,
                                      location_type: "in-person",
                                    }))
                                  }
                                  className={`flex items-center gap-2 px-4 py-2 rounded-[12px] text-[16px] font-normal transition-colors w-[180px] ${
                                    form.location_type === "in-person"
                                      ? "bg-[#4b89ef] text-white"
                                      : "bg-transparent border border-[rgba(0,0,0,0.15)] text-black"
                                  }`}
                                >
                                  <Building2 className="w-5 h-5" />
                                  In-person
                                </button>
                                <button
                                  onClick={() =>
                                    setForm((p) => ({
                                      ...p,
                                      location_type: "virtual",
                                    }))
                                  }
                                  className={`flex items-center gap-2 px-4 py-2 rounded-[12px] text-[16px] font-normal transition-colors w-[180px] ${
                                    form.location_type === "virtual"
                                      ? "bg-[#4b89ef] text-white"
                                      : "bg-transparent border border-[rgba(0,0,0,0.15)] text-black"
                                  }`}
                                >
                                  <Video className="w-5 h-5" />
                                  Virtual event
                                </button>
                              </div>
                              <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                <Input
                                  value={form.location}
                                  onChange={(e) =>
                                    onChange("location", e.target.value)
                                  }
                                  placeholder="Add offline location"
                                  className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[16px] font-normal text-black">
                                Cover image url
                              </label>
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                  <Input
                                    value={form.cover_image_url}
                                    onChange={(e) =>
                                      onChange(
                                        "cover_image_url",
                                        e.target.value
                                      )
                                    }
                                    placeholder="https://..."
                                    className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-[44px] px-4 border border-[rgba(0,0,0,0.15)] rounded-[12px]"
                                >
                                  <Upload className="w-4 h-4 mr-2" />
                                  Upload
                                </Button>
                              </div>
                              <p className="text-xs text-gray-500">
                                *Upload an image to showcase your project (Max
                                10MB).
                              </p>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[16px] font-normal text-black">
                                URL slug
                              </label>
                              <Input
                                value={form.slug}
                                onChange={(e) =>
                                  onChange("slug", e.target.value)
                                }
                                placeholder="url-friendly-event-name"
                                className="h-[44px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] font-mono focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                              />
                              <p className="text-xs text-gray-500">
                                URL-friendly identifier for your event
                                (lowercase, hyphens only)
                              </p>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[16px] font-normal text-black">
                                Event Type
                              </label>
                              <select
                                value={form.event_type}
                                onChange={(e) =>
                                  onChange("event_type", e.target.value)
                                }
                                className="h-[44px] w-full bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] px-3 focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                              >
                                <option value="">Select type</option>
                                <option value="Hackathon">Hackathon</option>
                                <option value="Workshop">Workshop</option>
                                <option value="Conference">Conference</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-[16px] font-normal text-black">
                                  This is a paid event
                                </label>
                                <Switch
                                  checked={ticketType === "paid"}
                                  onCheckedChange={(checked) =>
                                    setTicketType(checked ? "paid" : "free")
                                  }
                                />
                              </div>
                              <p className="text-xs text-gray-500">
                                *Toggle this on to set up pricing tiers for your
                                event. Participants will need to pay to join.
                              </p>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[16px] font-normal text-black">
                                Add organizer
                              </label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                <Input
                                  value={form.organizer_emails}
                                  onChange={(e) =>
                                    onChange("organizer_emails", e.target.value)
                                  }
                                  placeholder="Separate emails with ,"
                                  className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                />
                              </div>
                              <p className="text-xs text-gray-500">
                                *Invitee will receive an email notification with
                                access instructions.
                              </p>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="content" className="mt-0 space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h3 className="text-[16px] font-semibold text-black">
                                Exclusive Content for Participants
                              </h3>
                              <div className="inline-flex items-center border border-[rgba(0,0,0,0.15)] rounded-[12px] p-1 bg-white">
                                <button
                                  onClick={() => setPaywallMode("edit")}
                                  className={`px-4 py-2 rounded-[8px] text-sm font-normal transition-colors ${
                                    paywallMode === "edit"
                                      ? "bg-white border border-[rgba(0,0,0,0.15)] text-black shadow-sm"
                                      : "bg-transparent text-black hover:bg-gray-50"
                                  }`}
                                  data-testid="paywall-edit"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setPaywallMode("preview")}
                                  className={`px-4 py-2 rounded-[8px] text-sm font-normal transition-colors ${
                                    paywallMode === "preview"
                                      ? "bg-white border border-[rgba(0,0,0,0.15)] text-black shadow-sm"
                                      : "bg-transparent text-black hover:bg-gray-50"
                                  }`}
                                  data-testid="paywall-preview"
                                >
                                  Preview
                                </button>
                              </div>
                            </div>
                            {paywallMode === "edit" ? (
                              <>
                                <Textarea
                                  value={form.paywall_content}
                                  onChange={(e) =>
                                    onChange("paywall_content", e.target.value)
                                  }
                                  placeholder="Add content (markdown supported)"
                                  className="min-h-[300px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3"
                                />
                                <p className="text-xs text-gray-500 italic">
                                  *This content is visible only to participants
                                  who have joined the event.
                                </p>
                              </>
                            ) : (
                              <div className="min-h-[300px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] p-3 overflow-auto prose prose-sm max-w-full">
                                {form.paywall_content ? (
                                  <ReactMarkdown>
                                    {form.paywall_content}
                                  </ReactMarkdown>
                                ) : (
                                  <em>No exclusive content added yet.</em>
                                )}
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="schedule" className="mt-0">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[16px] font-normal text-black">
                                Project submission window (UTC)
                              </label>
                              <div className="flex items-center gap-2">
                                <DatePicker
                                  value={form.event_date}
                                  onChange={(value) =>
                                    onChange("event_date", value)
                                  }
                                  placeholder="mm/dd/yyyy"
                                />
                                <span className="text-gray-500">to</span>
                                <DatePicker
                                  value={form.event_date}
                                  onChange={(value) =>
                                    onChange("event_date", value)
                                  }
                                  placeholder="mm/dd/yyyy"
                                />
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="resources" className="mt-0">
                          <p className="text-gray-500">
                            Resources section - coming soon
                          </p>
                        </TabsContent>

                        <TabsContent value="rules" className="mt-0">
                          <p className="text-gray-500">
                            Rules section - coming soon
                          </p>
                        </TabsContent>

                        <TabsContent value="faqs" className="mt-0">
                          <p className="text-gray-500">
                            FAQs section - coming soon
                          </p>
                        </TabsContent>

                        <TabsContent value="gallery" className="mt-0">
                          <p className="text-gray-500">
                            Gallery section - coming soon
                          </p>
                        </TabsContent>
                      </Tabs>
                    </TabsContent>

                    <TabsContent value="registration" className="mt-0">
                      <p className="text-gray-500">
                        Registration settings - coming soon
                      </p>
                    </TabsContent>

                    <TabsContent value="project" className="mt-0">
                      <p className="text-gray-500">
                        Project settings - coming soon
                      </p>
                    </TabsContent>

                    <TabsContent value="access" className="mt-0">
                      <p className="text-gray-500">
                        Access settings - coming soon
                      </p>
                    </TabsContent>

                    <TabsContent value="tracks" className="mt-0">
                      <p className="text-gray-500">
                        Tracks settings - coming soon
                      </p>
                    </TabsContent>

                    <TabsContent value="pricing" className="mt-0">
                      <p className="text-gray-500">
                        Pricing settings - coming soon
                      </p>
                    </TabsContent>

                    <TabsContent value="notify" className="mt-0">
                      <p className="text-gray-500">
                        Notification settings - coming soon
                      </p>
                    </TabsContent>
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
                          <p className="text-[14px] font-normal text-black">
                            {previewDate.weekday}
                          </p>
                          <p
                            className="text-[36px] font-semibold leading-[1.3] tracking-[-2.16px] text-black"
                            style={{ fontFamily: "Geist, sans-serif" }}
                          >
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
                            {form.event_type || "Hackathon"}
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
                          {form.event_blurb ||
                            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros."}
                        </p>
                      </div>
                    </div>

                    <p className="text-[16px] text-[#7f7f7f] text-center mt-3">
                      This is a preview of the event.
                    </p>
                  </div>
                </div>
              </Tabs>
            </div>
          </div>
        </div>
      </PageContent>
    </PageContainer>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { EventVisibility, Rule } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/lib/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import {
  MapPin,
  Image as ImageIcon,
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
  ArrowUpRight,
  Clock,
  Search,
  Plus,
  Link2,
  Trash2,
  Pencil,
  Paperclip,
  Send,
  X,
  Check,
  User,
  Trophy,
  GripVertical,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
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
  const [descriptionMode, setDescriptionMode] = useState<"edit" | "preview">(
    "edit"
  );
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    dayTitle: "",
    eventName: "",
    time: "",
    guests: "",
    description: "",
  });
  const [schedules, setSchedules] = useState<
    Array<{
      id: string;
      dayTitle: string;
      eventName: string;
      time: string;
      guests: string;
      description: string;
    }>
  >([]);
  const [showResourcesForm, setShowResourcesForm] = useState(false);
  const [resourcesForm, setResourcesForm] = useState({
    resourceName: "",
    resourceLink: "",
  });
  const [resources, setResources] = useState<
    Array<{ id: string; name: string; link: string }>
  >([]);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null
  );
  const [editingResourceForm, setEditingResourceForm] = useState({
    resourceName: "",
    resourceLink: "",
  });
  const [rules, setRules] = useState<Rule[]>([]);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [showRulesForm, setShowRulesForm] = useState(false);
  const [rulesForm, setRulesForm] = useState({
    sectionTitle: "",
    rules: [""],
  });
  const [faqs, setFaqs] = useState<
    Array<{ id: string; question: string; answer: string }>
  >([]);
  const [showFaqsForm, setShowFaqsForm] = useState(false);
  const [faqsForm, setFaqsForm] = useState({
    question: "",
    answer: "",
  });
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editingFaqForm, setEditingFaqForm] = useState({
    question: "",
    answer: "",
  });
  const [galleryImages, setGalleryImages] = useState<
    Array<{ id: string; url: string }>
  >([]);
  const [messageType, setMessageType] = useState<"individual" | "group">(
    "individual"
  );
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [activePricingSubTab, setActivePricingSubTab] = useState("tiers");
  const [pricingTiers, setPricingTiers] = useState<
    Array<{
      id: string;
      name: string;
      price: number;
      description: string;
      available_until?: string;
      max_quantity?: number;
      stripe_price_id: string;
    }>
  >([]);
  const [showTierForm, setShowTierForm] = useState(false);
  const [tierForm, setTierForm] = useState({
    name: "",
    price: "",
    description: "",
    available_until: "",
    max_quantity: "",
    stripe_price_id: "",
  });
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<
    Array<{
      id: string;
      couponName: string;
      duration: string;
      percent_off?: number;
      amount_off?: number;
      currency?: string;
      max_uses?: number;
      valid_until?: string;
    }>
  >([]);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [couponForm, setCouponForm] = useState({
    couponName: "",
    duration: "once",
    percent_off: "",
    amount_off: "",
    currency: "USD",
    max_uses: "",
    valid_until: "",
  });
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [promoCodes, setPromoCodes] = useState<
    Array<{
      id: string;
      promoCode: string;
      couponId: string;
      couponName?: string;
    }>
  >([]);
  const [showPromoCodeForm, setShowPromoCodeForm] = useState(false);
  const [promoCodeForm, setPromoCodeForm] = useState({
    promoCode: "",
    couponId: "",
    overwrite: false,
  });
  const [activeTracksSubTab, setActiveTracksSubTab] = useState("tracks");
  const [tracks, setTracks] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
      criteria: Array<{
        id: string;
        name: string;
        description: string;
        questionType: string;
        minScore: number;
        maxScore: number;
        weight: number;
      }>;
    }>
  >([]);
  const [showTrackForm, setShowTrackForm] = useState(false);
  const [trackForm, setTrackForm] = useState({
    name: "",
    description: "",
    criterionName: "",
    criterionDescription: "",
    questionType: "",
    minScore: "1",
    maxScore: "1",
    weight: "1",
  });
  const [defaultMinScore, setDefaultMinScore] = useState("1");
  const [defaultMaxScore, setDefaultMaxScore] = useState("1");
  const [defaultWeight, setDefaultWeight] = useState("1");
  const [prizes, setPrizes] = useState<
    Array<{
      id: string;
      trackId: string;
      trackName: string;
      name: string;
      description: string;
      coverImageUrl: string;
    }>
  >([]);
  const [showPrizeForm, setShowPrizeForm] = useState(false);
  const [prizeForm, setPrizeForm] = useState({
    trackId: "",
    name: "",
    description: "",
    coverImageUrl: "",
  });

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

  // Generate slug from event name for preview
  const getPreviewSlug = () => {
    if (form.slug) return form.slug;
    if (form.event_name) {
      return form.event_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
    return null;
  };

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
            rules: rules.length > 0 ? rules : undefined,
            faqs:
              faqs.length > 0 ? faqs.map(({ id, ...faq }) => faq) : undefined,
            gallery_images:
              galleryImages.length > 0
                ? galleryImages.map(({ id, ...img }) => img)
                : undefined,
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
    <div className="w-full overflow-x-hidden">
      <div className="w-full flex flex-col lg:min-h-[calc(100vh-88px)] lg:h-[calc(100vh-88px)] lg:overflow-hidden lg:rounded-tl-2xl lg:border-t lg:border-l lg:border-[#D8D8D8] bg-white">
        <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 w-full flex flex-col pb-20 lg:pb-4 lg:flex-1 lg:min-h-0 overflow-x-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 flex-shrink-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              Create event
            </h1>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() =>
                    setShowVisibilityDropdown(!showVisibilityDropdown)
                  }
                  className="flex items-center gap-2 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] px-3 py-2 h-[44px] w-full sm:w-[142px] hover:bg-gray-50 transition-colors"
                >
                  <Globe className="w-5 h-5" />
                  <span className="text-[16px] font-normal">{visibility}</span>
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
                  <>
                    <div
                      className="fixed inset-0 z-[5]"
                      onClick={() => setShowVisibilityDropdown(false)}
                    />
                    <div className="absolute top-full mt-2 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] shadow-lg z-[10] w-[142px] overflow-hidden">
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
                  </>
                )}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="defaultGray"
                  onClick={() => router.back()}
                  className="text-[16px] font-medium flex-1 sm:flex-none"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating}
                  className="text-[16px] font-medium flex-1 sm:flex-none"
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
            className="flex flex-col lg:flex-1 lg:min-h-0"
          >
            <div
              className="w-full overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 mb-6 flex-shrink-0"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <TabsList className="flex h-auto gap-4 sm:gap-6 items-center border-b border-[#d2d7e7] p-0 justify-start bg-transparent rounded-none flex-nowrap min-w-max">
                <TabsTrigger
                  value="overview"
                  className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0 whitespace-nowrap flex-shrink-0"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="registration"
                  className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0 whitespace-nowrap flex-shrink-0"
                >
                  Registration
                </TabsTrigger>
                <TabsTrigger
                  value="project"
                  className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0 whitespace-nowrap flex-shrink-0"
                >
                  Project
                </TabsTrigger>
                <TabsTrigger
                  value="access"
                  className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0 whitespace-nowrap flex-shrink-0"
                >
                  Access
                </TabsTrigger>
                <TabsTrigger
                  value="tracks"
                  className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0 whitespace-nowrap flex-shrink-0"
                >
                  Tracks
                </TabsTrigger>
                <TabsTrigger
                  value="pricing"
                  className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0 whitespace-nowrap flex-shrink-0"
                >
                  Pricing
                </TabsTrigger>
                <TabsTrigger
                  value="notify"
                  className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0 whitespace-nowrap flex-shrink-0"
                >
                  Notify
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-12 items-start w-full lg:flex-1 lg:min-h-0 lg:overflow-auto no-scrollbar">
              {/* Form Section */}
              <div
                className={`w-full flex flex-col items-start order-last lg:order-first ${
                  activeTab === "pricing" ||
                  activeTab === "notify" ||
                  activeTab === "tracks"
                    ? "lg:flex-1 lg:min-w-0"
                    : "lg:flex-[2] lg:min-w-0 lg:max-w-[800px]"
                }`}
              >
                <TabsContent value="overview" className="mt-0">
                  <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                    <div
                      className="w-screen -mx-4 sm:-mx-6 lg:w-full lg:mx-0 overflow-x-auto overflow-y-visible px-4 sm:px-6 lg:px-0 mb-6"
                      style={{
                        WebkitOverflowScrolling: "touch",
                        scrollbarWidth: "thin",
                        msOverflowStyle: "-ms-autohiding-scrollbar",
                      }}
                    >
                      <TabsList className="inline-flex h-auto gap-2 bg-transparent p-0 justify-start pb-1 items-center flex-nowrap">
                        <TabsTrigger
                          value="basics"
                          className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] flex-shrink-0"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          Basics
                        </TabsTrigger>
                        <TabsTrigger
                          value="content"
                          className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] flex-shrink-0"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          Content
                        </TabsTrigger>
                        <TabsTrigger
                          value="schedule"
                          className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] flex-shrink-0"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          Schedule
                        </TabsTrigger>
                        <TabsTrigger
                          value="resources"
                          className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] flex-shrink-0"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          Resources
                        </TabsTrigger>
                        <TabsTrigger
                          value="rules"
                          className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] flex-shrink-0"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          Rules
                        </TabsTrigger>
                        <TabsTrigger
                          value="faqs"
                          className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] flex-shrink-0"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          FAQs
                        </TabsTrigger>
                        <TabsTrigger
                          value="gallery"
                          className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] flex-shrink-0"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          Gallery
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent
                      value="basics"
                      className="mt-0 space-y-4 overflow-x-hidden w-full min-w-0"
                    >
                      <input
                        type="text"
                        value={form.event_name}
                        onChange={(e) => onChange("event_name", e.target.value)}
                        placeholder="Event Title"
                        className="font-semibold text-[36px] leading-[1.3] tracking-[-2.16px] mb-6 w-full min-w-0 bg-transparent border-none outline-none focus:ring-0 p-0"
                        style={{
                          color: form.event_name ? "#000000" : "#d8d8d8",
                          fontFamily: "Geist, sans-serif",
                        }}
                      />

                      <div className="space-y-4 w-full min-w-0">
                        <div className="space-y-2 w-full min-w-0">
                          <label className="text-[16px] font-normal text-black">
                            Date
                          </label>
                          <DatePicker
                            value={form.event_date}
                            onChange={(value) => onChange("event_date", value)}
                            placeholder="mm/dd/yyyy"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[16px] font-normal text-black">
                            Project submission window (UTC)
                          </label>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <DatePicker
                              value={form.submission_time_start}
                              onChange={(value) =>
                                onChange("submission_time_start", value)
                              }
                              placeholder="mm/dd/yyyy"
                            />
                            <span className="text-gray-500 text-center sm:text-left">
                              to
                            </span>
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
                          <div className="relative w-full min-w-0">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                            <Input
                              type="number"
                              value={form.participant_capacity}
                              onChange={(e) =>
                                onChange("participant_capacity", e.target.value)
                              }
                              placeholder="Leave blank for unlimited participants"
                              className="w-full min-w-0 h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-2 w-full">
                          <label className="text-[16px] font-normal text-black">
                            Location
                          </label>
                          <div className="flex items-center gap-2 sm:gap-4 mb-2 w-full">
                            <button
                              onClick={() =>
                                setForm((p) => ({
                                  ...p,
                                  location_type: "in-person",
                                }))
                              }
                              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[12px] text-[16px] font-normal transition-colors flex-1 sm:w-[180px] ${
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
                              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[12px] text-[16px] font-normal transition-colors flex-1 sm:w-[180px] ${
                                form.location_type === "virtual"
                                  ? "bg-[#4b89ef] text-white"
                                  : "bg-transparent border border-[rgba(0,0,0,0.15)] text-black"
                              }`}
                            >
                              <Video className="w-5 h-5" />
                              Virtual event
                            </button>
                          </div>
                          <div className="relative w-full min-w-0">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                            <Input
                              value={form.location}
                              onChange={(e) =>
                                onChange("location", e.target.value)
                              }
                              placeholder="Add offline location"
                              className="w-full min-w-0 h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[16px] font-normal text-black">
                            Cover image url
                          </label>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <div className="relative flex-1 min-w-0">
                              <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                              <Input
                                value={form.cover_image_url}
                                onChange={(e) =>
                                  onChange("cover_image_url", e.target.value)
                                }
                                placeholder="https://..."
                                className="w-full min-w-0 h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = "image/*";
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement)
                                    .files?.[0];
                                  if (file) {
                                    onChange(
                                      "cover_image_url",
                                      URL.createObjectURL(file)
                                    );
                                  }
                                };
                                input.click();
                              }}
                              className="h-[44px] px-4 border border-[rgba(0,0,0,0.15)] rounded-[12px] w-full sm:w-auto"
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
                            Blurb
                          </label>
                          <div className="relative w-full min-w-0">
                            <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                            <Input
                              value={form.event_blurb}
                              onChange={(e) =>
                                onChange("event_blurb", e.target.value)
                              }
                              placeholder="Short description shown in the preview card"
                              className="w-full min-w-0 h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                            />
                          </div>
                          <p className="text-xs text-gray-500">
                            A short description that appears in the event
                            preview card.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[16px] font-normal text-black">
                              Description
                            </label>
                            <div className="inline-flex items-center border border-[rgba(0,0,0,0.15)] rounded-[12px] p-1 bg-white">
                              <button
                                onClick={() => setDescriptionMode("edit")}
                                className={`px-4 py-2 rounded-[8px] text-sm font-normal transition-colors ${
                                  descriptionMode === "edit"
                                    ? "bg-white border border-[rgba(0,0,0,0.15)] text-black shadow-sm"
                                    : "bg-transparent text-black hover:bg-gray-50"
                                }`}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDescriptionMode("preview")}
                                className={`px-4 py-2 rounded-[8px] text-sm font-normal transition-colors ${
                                  descriptionMode === "preview"
                                    ? "bg-white border border-[rgba(0,0,0,0.15)] text-black shadow-sm"
                                    : "bg-transparent text-black hover:bg-gray-50"
                                }`}
                              >
                                Preview
                              </button>
                            </div>
                          </div>
                          {descriptionMode === "edit" ? (
                            <>
                              <Textarea
                                value={form.event_description}
                                onChange={(e) =>
                                  onChange("event_description", e.target.value)
                                }
                                placeholder="Add long description (markdown supported)"
                                className="min-h-[300px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3 focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none resize-y"
                              />
                              <p className="text-xs text-gray-500 italic">
                                *Full event description. Markdown formatting is
                                supported.
                              </p>
                            </>
                          ) : (
                            <div className="min-h-[300px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] p-3 overflow-auto prose prose-sm max-w-full">
                              {form.event_description ? (
                                <ReactMarkdown>
                                  {form.event_description}
                                </ReactMarkdown>
                              ) : (
                                <em>No description added yet.</em>
                              )}
                            </div>
                          )}
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
                          <div className="relative w-full min-w-0">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                            <Input
                              value={form.organizer_emails}
                              onChange={(e) =>
                                onChange("organizer_emails", e.target.value)
                              }
                              placeholder="Separate emails with ,"
                              className="w-full min-w-0 h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                            />
                          </div>
                          <p className="text-xs text-gray-500">
                            *Invitee will receive an email notification with
                            access instructions.
                          </p>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="content"
                      className="mt-0 space-y-4 overflow-x-hidden"
                    >
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
                              *This content is visible only to participants who
                              have joined the event.
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

                    <TabsContent
                      value="schedule"
                      className="mt-0 overflow-x-hidden"
                    >
                      {schedules.length === 0 && !showScheduleForm ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-[12px] p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                          <div className="flex flex-col items-center gap-2">
                            <div className="relative">
                              <Image
                                src="/img/cancel_schedule_send.png"
                                alt="No schedule illustration"
                                width={40}
                                height={40}
                                className="object-contain"
                                priority
                              />
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-[18px] font-semibold text-black">
                                No schedule yet
                              </h3>
                              <p className="text-[14px] text-gray-500 max-w-md">
                                Add day and events to display the event schedule
                              </p>
                            </div>
                            <Button
                              type="button"
                              onClick={() => setShowScheduleForm(true)}
                              className="mt-2 bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                            >
                              Add schedule
                            </Button>
                          </div>
                        </div>
                      ) : schedules.length > 0 && !showScheduleForm ? (
                        <div className="space-y-4">
                          {schedules.map((schedule) => (
                            <div
                              key={schedule.id}
                              className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-4"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <h4 className="text-[18px] font-semibold text-black">
                                    {schedule.dayTitle}
                                  </h4>
                                  <div className="mt-2 space-y-1">
                                    <p className="text-[16px] font-medium text-black">
                                      {schedule.eventName}
                                    </p>
                                    {schedule.time && (
                                      <p className="text-[14px] text-gray-600">
                                        Time: {schedule.time}
                                      </p>
                                    )}
                                    {schedule.guests && (
                                      <p className="text-[14px] text-gray-600">
                                        Guests: {schedule.guests}
                                      </p>
                                    )}
                                    {schedule.description && (
                                      <div className="mt-2 text-[14px] text-gray-600 prose prose-sm max-w-full">
                                        <ReactMarkdown>
                                          {schedule.description}
                                        </ReactMarkdown>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSchedules(
                                      schedules.filter(
                                        (s) => s.id !== schedule.id
                                      )
                                    );
                                    toast({
                                      title: "Schedule deleted",
                                      description:
                                        "Schedule item removed successfully.",
                                    });
                                  }}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            onClick={() => setShowScheduleForm(true)}
                            className="w-full bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add schedule
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
                          <div className="space-y-2">
                            <label className="text-[16px] font-normal text-black">
                              Day Title
                            </label>
                            <div className="relative">
                              <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                              <Input
                                value={scheduleForm.dayTitle}
                                onChange={(e) =>
                                  setScheduleForm((prev) => ({
                                    ...prev,
                                    dayTitle: e.target.value,
                                  }))
                                }
                                placeholder="Short description shown in the preview card"
                                className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                              />
                            </div>
                          </div>

                          <div
                            className="rounded-[12px] border border-[rgba(0,0,0,0.15)] bg-[#F7FAFE] p-4 flex flex-col items-start gap-6"
                            style={{
                              boxShadow:
                                "0 0 0 1px rgba(0, 0, 0, 0.05) inset, 0 -2px 1px 0 rgba(0, 0, 0, 0.05) inset, 0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                            }}
                          >
                            <div className="space-y-2 w-full">
                              <label className="text-[16px] font-normal text-black">
                                Event Name
                              </label>
                              <div className="relative">
                                <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                <Input
                                  value={scheduleForm.eventName}
                                  onChange={(e) =>
                                    setScheduleForm((prev) => ({
                                      ...prev,
                                      eventName: e.target.value,
                                    }))
                                  }
                                  placeholder="Short description shown in the preview card"
                                  className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                />
                              </div>
                            </div>

                            <div className="space-y-2 w-full">
                              <label className="text-[16px] font-normal text-black">
                                Time
                              </label>
                              <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                <Input
                                  value={scheduleForm.time}
                                  onChange={(e) =>
                                    setScheduleForm((prev) => ({
                                      ...prev,
                                      time: e.target.value,
                                    }))
                                  }
                                  placeholder="11-22-33"
                                  className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                />
                              </div>
                            </div>

                            <div className="space-y-2 w-full">
                              <label className="text-[16px] font-normal text-black">
                                Add guests
                              </label>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                <Input
                                  value={scheduleForm.guests}
                                  onChange={(e) =>
                                    setScheduleForm((prev) => ({
                                      ...prev,
                                      guests: e.target.value,
                                    }))
                                  }
                                  placeholder="Search guests"
                                  className="h-[44px] pl-11 pr-32 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="text-[14px] text-[#4b89ef] hover:underline whitespace-nowrap"
                                  >
                                    Invite guest
                                  </button>
                                  <svg
                                    className="w-5 h-5 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2 w-full">
                              <label className="text-[16px] font-normal text-black">
                                Description
                              </label>
                              <Textarea
                                value={scheduleForm.description}
                                onChange={(e) =>
                                  setScheduleForm((prev) => ({
                                    ...prev,
                                    description: e.target.value,
                                  }))
                                }
                                placeholder="Add long description (markdown supported)"
                                className="min-h-[200px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3 focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none resize-y"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-4">
                            <Button
                              type="button"
                              className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                              onClick={() => {
                                if (
                                  !scheduleForm.dayTitle ||
                                  !scheduleForm.eventName
                                ) {
                                  toast({
                                    title: "Missing fields",
                                    description:
                                      "Please fill in day title and event name.",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                setSchedules([
                                  ...schedules,
                                  {
                                    id: Date.now().toString(),
                                    dayTitle: scheduleForm.dayTitle,
                                    eventName: scheduleForm.eventName,
                                    time: scheduleForm.time,
                                    guests: scheduleForm.guests,
                                    description: scheduleForm.description,
                                  },
                                ]);
                                toast({
                                  title: "Schedule created",
                                  description:
                                    "Schedule item added successfully.",
                                });
                                setScheduleForm({
                                  dayTitle: "",
                                  eventName: "",
                                  time: "",
                                  guests: "",
                                  description: "",
                                });
                                setShowScheduleForm(false);
                              }}
                            >
                              Create
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setShowScheduleForm(false);
                                setScheduleForm({
                                  dayTitle: "",
                                  eventName: "",
                                  time: "",
                                  guests: "",
                                  description: "",
                                });
                              }}
                              className="border border-[rgba(0,0,0,0.15)] bg-white"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="border border-[#4b89ef] text-[#4b89ef] bg-white hover:bg-[#4b89ef]/10"
                              onClick={() => {
                                toast({
                                  title: "Event added",
                                  description: "Event added to schedule.",
                                });
                                setScheduleForm({
                                  dayTitle: "",
                                  eventName: "",
                                  time: "",
                                  guests: "",
                                  description: "",
                                });
                              }}
                            >
                              Add event
                            </Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {showScheduleForm && (
                      <Button
                        type="button"
                        className="rounded-[12px] border-0 mt-4 text-black bg-gray-50 hover:bg-gray-100"
                        onClick={() => setShowScheduleForm(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add new day
                      </Button>
                    )}

                    <TabsContent
                      value="resources"
                      className="mt-0 overflow-x-hidden"
                    >
                      {resources.length === 0 && !showResourcesForm ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-[12px] p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                          <div className="flex flex-col items-center gap-2">
                            <div className="relative">
                              <Link2 className="w-16 h-16 text-gray-400" />
                              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs font-bold">
                                  ×
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-[18px] font-semibold text-black">
                                No resource yet
                              </h3>
                              <p className="text-[14px] text-gray-500 max-w-md">
                                Resources will be shown as individual links on
                                the event page.
                              </p>
                            </div>
                            <Button
                              type="button"
                              onClick={() => setShowResourcesForm(true)}
                              className="mt-2 bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                            >
                              Add resource
                            </Button>
                          </div>
                        </div>
                      ) : resources.length > 0 && !showResourcesForm ? (
                        <div className="space-y-4">
                          {resources.map((resource) => (
                            <div
                              key={resource.id}
                              className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4 relative"
                            >
                              {editingResourceId === resource.id ? (
                                <>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Resource name
                                    </label>
                                    <div className="relative">
                                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                      <Input
                                        value={editingResourceForm.resourceName}
                                        onChange={(e) =>
                                          setEditingResourceForm((prev) => ({
                                            ...prev,
                                            resourceName: e.target.value,
                                          }))
                                        }
                                        className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Resource link
                                    </label>
                                    <div className="relative">
                                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                      <Input
                                        value={editingResourceForm.resourceLink}
                                        onChange={(e) =>
                                          setEditingResourceForm((prev) => ({
                                            ...prev,
                                            resourceLink: e.target.value,
                                          }))
                                        }
                                        className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                      />
                                    </div>
                                    {editingResourceForm.resourceLink && (
                                      <div className="flex items-center gap-2 text-[14px] text-gray-600">
                                        <Paperclip className="w-4 h-4" />
                                        <span className="truncate">
                                          {editingResourceForm.resourceLink}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 pt-2">
                                    <Button
                                      type="button"
                                      className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                                      onClick={() => {
                                        if (
                                          !editingResourceForm.resourceName ||
                                          !editingResourceForm.resourceLink
                                        ) {
                                          toast({
                                            title: "Missing fields",
                                            description:
                                              "Please fill in both resource name and link.",
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        setResources(
                                          resources.map((r) =>
                                            r.id === resource.id
                                              ? {
                                                  ...r,
                                                  name: editingResourceForm.resourceName,
                                                  link: editingResourceForm.resourceLink,
                                                }
                                              : r
                                          )
                                        );
                                        setEditingResourceId(null);
                                        setEditingResourceForm({
                                          resourceName: "",
                                          resourceLink: "",
                                        });
                                        toast({
                                          title: "Resource updated",
                                          description:
                                            "Resource saved successfully.",
                                        });
                                      }}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      type="button"
                                      className="text-white rounded-[12px] hover:bg-red-600"
                                      style={{
                                        background:
                                          "var(--Component-colors-Utility-Error-utility-error-600, #D92D20)",
                                        boxShadow:
                                          "0 32px 24px 0 rgba(255, 255, 255, 0.05) inset, 0 2px 1px 0 rgba(255, 255, 255, 0.25) inset, 0 0 0 1px var(--Opacity-Neutral-Darkest-15, rgba(0, 0, 0, 0.15)) inset, 0 -2px 1px 0 rgba(0, 0, 0, 0.20) inset, 0 1px 2px 0 var(--Opacity-Neutral-Darkest-5, rgba(0, 0, 0, 0.05))",
                                      }}
                                      onClick={() => {
                                        setResources(
                                          resources.filter(
                                            (r) => r.id !== resource.id
                                          )
                                        );
                                        setEditingResourceId(null);
                                        setEditingResourceForm({
                                          resourceName: "",
                                          resourceLink: "",
                                        });
                                        toast({
                                          title: "Resource deleted",
                                          description:
                                            "Resource removed successfully.",
                                        });
                                      }}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="absolute top-4 right-4">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingResourceId(resource.id);
                                        setEditingResourceForm({
                                          resourceName: resource.name,
                                          resourceLink: resource.link,
                                        });
                                      }}
                                      className="p-2 hover:bg-gray-50 rounded-[8px] transition-colors"
                                    >
                                      <Pencil className="w-4 h-4 text-gray-600" />
                                    </button>
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Resource name
                                    </label>
                                    <div className="relative">
                                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                      <Input
                                        value={resource.name}
                                        readOnly
                                        className="h-[44px] pl-11 bg-gray-50 border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] text-gray-600 cursor-not-allowed"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Resource link
                                    </label>
                                    <div className="relative">
                                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                      <Input
                                        value={resource.link}
                                        readOnly
                                        className="h-[44px] pl-11 bg-gray-50 border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] text-gray-600 cursor-not-allowed"
                                      />
                                    </div>
                                    {resource.link && (
                                      <div className="flex items-center gap-2 text-[14px] text-gray-600">
                                        <Paperclip className="w-4 h-4" />
                                        <span className="truncate">
                                          {resource.link}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                          <Button
                            type="button"
                            onClick={() => setShowResourcesForm(true)}
                            className="w-full rounded-[12px] border-0 text-black bg-[rgba(0,0,0,0.05)] hover:bg-gray-50 shadow-[0_0_0_1px_rgba(0,0,0,0.05)_inset,0_-2px_1px_0_rgba(0,0,0,0.05)_inset,0_1px_2px_0_rgba(0,0,0,0.05)]"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add new resource
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
                          <div className="space-y-2">
                            <label className="text-[16px] font-normal text-black">
                              Resource name
                            </label>
                            <div className="relative">
                              <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                              <Input
                                value={resourcesForm.resourceName}
                                onChange={(e) =>
                                  setResourcesForm((prev) => ({
                                    ...prev,
                                    resourceName: e.target.value,
                                  }))
                                }
                                placeholder="Short description shown in the preview card"
                                className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[16px] font-normal text-black">
                              Resource link
                            </label>
                            <div className="relative">
                              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                              <Input
                                value={resourcesForm.resourceLink}
                                onChange={(e) =>
                                  setResourcesForm((prev) => ({
                                    ...prev,
                                    resourceLink: e.target.value,
                                  }))
                                }
                                placeholder="https://"
                                className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-4">
                            <Button
                              type="button"
                              className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                              onClick={() => {
                                if (
                                  !resourcesForm.resourceName ||
                                  !resourcesForm.resourceLink
                                ) {
                                  toast({
                                    title: "Missing fields",
                                    description:
                                      "Please fill in both resource name and link.",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                setResources([
                                  ...resources,
                                  {
                                    id: Date.now().toString(),
                                    name: resourcesForm.resourceName,
                                    link: resourcesForm.resourceLink,
                                  },
                                ]);
                                toast({
                                  title: "Resource created",
                                  description: "Resource added successfully.",
                                });
                                setResourcesForm({
                                  resourceName: "",
                                  resourceLink: "",
                                });
                                setShowResourcesForm(false);
                              }}
                            >
                              Create
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setShowResourcesForm(false);
                                setResourcesForm({
                                  resourceName: "",
                                  resourceLink: "",
                                });
                              }}
                              className="border border-[rgba(0,0,0,0.15)] bg-white"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {showResourcesForm && (
                      <Button
                        type="button"
                        className="rounded-[12px] border-0 mt-4 text-black bg-gray-50 hover:bg-gray-100"
                        style={{
                          background: "rgba(0, 0, 0, 0.05)",
                          boxShadow:
                            "0 0 0 1px rgba(0, 0, 0, 0.05) inset, 0 -2px 1px 0 rgba(0, 0, 0, 0.05) inset, 0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                        }}
                        onClick={() => {
                          setResourcesForm({
                            resourceName: "",
                            resourceLink: "",
                          });
                          toast({
                            title: "New resource",
                            description: "Ready to add a new resource.",
                          });
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add new resource
                      </Button>
                    )}

                    <TabsContent
                      value="rules"
                      className="mt-0 overflow-x-hidden"
                    >
                      {rules.length === 0 && !showRulesForm ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-[12px] p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                          <div className="flex flex-col items-center gap-2">
                            <div className="relative">
                              <FileText className="w-16 h-16 text-gray-400" />
                              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs font-bold">
                                  ×
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-[18px] font-semibold text-black">
                                No Rules yet
                              </h3>
                              <p className="text-[14px] text-gray-500 max-w-md">
                                Rules will be shown under the overview tab on
                                the event page.
                              </p>
                            </div>
                            <Button
                              type="button"
                              onClick={() => setShowRulesForm(true)}
                              className="mt-2 bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                            >
                              Add rules
                            </Button>
                          </div>
                        </div>
                      ) : rules.length > 0 && !showRulesForm ? (
                        <div className="space-y-4">
                          {rules.map((rule, ruleIndex) => (
                            <div
                              key={ruleIndex}
                              className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4 relative"
                            >
                              {editingRuleIndex === ruleIndex ? (
                                <>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Section Title
                                    </label>
                                    <div className="relative">
                                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                      <Input
                                        value={rulesForm.sectionTitle}
                                        onChange={(e) =>
                                          setRulesForm((prev) => ({
                                            ...prev,
                                            sectionTitle: e.target.value,
                                          }))
                                        }
                                        placeholder="Short description shown in the preview card"
                                        className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                      />
                                    </div>
                                  </div>

                                  {rulesForm.rules.map(
                                    (ruleItem, itemIndex) => (
                                      <div
                                        key={itemIndex}
                                        className="space-y-2"
                                      >
                                        <label className="text-[16px] font-normal text-black">
                                          Rule {itemIndex + 1}
                                        </label>
                                        <div className="flex items-center gap-2">
                                          <div className="relative flex-1">
                                            <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                            <Input
                                              value={ruleItem}
                                              onChange={(e) => {
                                                const newRules = [
                                                  ...rulesForm.rules,
                                                ];
                                                newRules[itemIndex] =
                                                  e.target.value;
                                                setRulesForm((prev) => ({
                                                  ...prev,
                                                  rules: newRules,
                                                }));
                                              }}
                                              placeholder="Short description shown in the preview card"
                                              className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                            />
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              const newRules =
                                                rulesForm.rules.filter(
                                                  (_, i) => i !== itemIndex
                                                );
                                              setRulesForm((prev) => ({
                                                ...prev,
                                                rules: newRules,
                                              }));
                                            }}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )
                                  )}

                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                      setRulesForm((prev) => ({
                                        ...prev,
                                        rules: [...prev.rules, ""],
                                      }));
                                    }}
                                    className="border border-[#4b89ef] text-[#4b89ef] bg-white hover:bg-[#4b89ef]/10"
                                  >
                                    Add rule
                                  </Button>

                                  <div className="flex items-center gap-2 pt-2">
                                    <Button
                                      type="button"
                                      className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                                      onClick={() => {
                                        if (!rulesForm.sectionTitle.trim()) {
                                          toast({
                                            title: "Missing field",
                                            description:
                                              "Please enter a section title.",
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        const updatedRules = [...rules];
                                        updatedRules[ruleIndex] = {
                                          title: rulesForm.sectionTitle,
                                          items: rulesForm.rules.filter(
                                            (r) => r.trim() !== ""
                                          ),
                                        };
                                        setRules(updatedRules);
                                        setEditingRuleIndex(null);
                                        setRulesForm({
                                          sectionTitle: "",
                                          rules: [""],
                                        });
                                        toast({
                                          title: "Rule updated",
                                          description:
                                            "Rule section saved successfully.",
                                        });
                                      }}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      type="button"
                                      className="text-white rounded-[12px] hover:bg-red-600"
                                      style={{
                                        background:
                                          "var(--Component-colors-Utility-Error-utility-error-600, #D92D20)",
                                        boxShadow:
                                          "0 32px 24px 0 rgba(255, 255, 255, 0.05) inset, 0 2px 1px 0 rgba(255, 255, 255, 0.25) inset, 0 0 0 1px var(--Opacity-Neutral-Darkest-15, rgba(0, 0, 0, 0.15)) inset, 0 -2px 1px 0 rgba(0, 0, 0, 0.20) inset, 0 1px 2px 0 var(--Opacity-Neutral-Darkest-5, rgba(0, 0, 0, 0.05))",
                                      }}
                                      onClick={() => {
                                        setRules(
                                          rules.filter(
                                            (_, i) => i !== ruleIndex
                                          )
                                        );
                                        setEditingRuleIndex(null);
                                        setRulesForm({
                                          sectionTitle: "",
                                          rules: [""],
                                        });
                                        toast({
                                          title: "Rule deleted",
                                          description:
                                            "Rule section removed successfully.",
                                        });
                                      }}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <div className="relative">
                                  <div className="absolute top-4 right-4">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingRuleIndex(ruleIndex);
                                        setRulesForm({
                                          sectionTitle: rule.title,
                                          rules:
                                            rule.items.length > 0
                                              ? rule.items
                                              : [""],
                                        });
                                      }}
                                      className="p-2 hover:bg-gray-50 rounded-[8px] transition-colors"
                                    >
                                      <Pencil className="w-4 h-4 text-gray-600" />
                                    </button>
                                  </div>
                                  <div className="space-y-4 pr-10">
                                    <div className="space-y-2">
                                      <label className="text-[16px] font-normal text-black">
                                        Section Title
                                      </label>
                                      <div className="relative">
                                        <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                        <Input
                                          value={rule.title}
                                          readOnly
                                          className="h-[44px] pl-11 bg-gray-50 border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] text-gray-600 cursor-not-allowed"
                                        />
                                      </div>
                                    </div>

                                    {rule.items.map((item, itemIndex) => (
                                      <div
                                        key={itemIndex}
                                        className="space-y-2"
                                      >
                                        <label className="text-[16px] font-normal text-black">
                                          Rule {itemIndex + 1}
                                        </label>
                                        <div className="relative">
                                          <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                          <Input
                                            value={item}
                                            readOnly
                                            className="h-[44px] pl-11 bg-gray-50 border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] text-gray-600 cursor-not-allowed"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          <Button
                            type="button"
                            onClick={() => setShowRulesForm(true)}
                            className="rounded-[12px] border-0 text-black bg-[rgba(0,0,0,0.05)] hover:bg-gray-50 shadow-[0_0_0_1px_rgba(0,0,0,0.05)_inset,0_-2px_1px_0_rgba(0,0,0,0.05)_inset,0_1px_2px_0_rgba(0,0,0,0.05)]"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add new section
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
                          <div className="space-y-2">
                            <label className="text-[16px] font-normal text-black">
                              Section Title
                            </label>
                            <div className="relative">
                              <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                              <Input
                                value={rulesForm.sectionTitle}
                                onChange={(e) =>
                                  setRulesForm((prev) => ({
                                    ...prev,
                                    sectionTitle: e.target.value,
                                  }))
                                }
                                placeholder="Short description shown in the preview card"
                                className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                              />
                            </div>
                          </div>

                          {rulesForm.rules.map((ruleItem, itemIndex) => (
                            <div key={itemIndex} className="space-y-2">
                              <label className="text-[16px] font-normal text-black">
                                Rule {itemIndex + 1}
                              </label>
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                  <Input
                                    value={ruleItem}
                                    onChange={(e) => {
                                      const newRules = [...rulesForm.rules];
                                      newRules[itemIndex] = e.target.value;
                                      setRulesForm((prev) => ({
                                        ...prev,
                                        rules: newRules,
                                      }));
                                    }}
                                    placeholder="Short description shown in the preview card"
                                    className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newRules = rulesForm.rules.filter(
                                      (_, i) => i !== itemIndex
                                    );
                                    setRulesForm((prev) => ({
                                      ...prev,
                                      rules: newRules,
                                    }));
                                  }}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setRulesForm((prev) => ({
                                ...prev,
                                rules: [...prev.rules, ""],
                              }));
                            }}
                            className="border border-[#4b89ef] text-[#4b89ef] bg-white hover:bg-[#4b89ef]/10"
                          >
                            Add rule
                          </Button>

                          <div className="flex items-center gap-2 pt-4">
                            <Button
                              type="button"
                              className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                              onClick={() => {
                                if (!rulesForm.sectionTitle.trim()) {
                                  toast({
                                    title: "Missing field",
                                    description:
                                      "Please enter a section title.",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                setRules([
                                  ...rules,
                                  {
                                    title: rulesForm.sectionTitle,
                                    items: rulesForm.rules.filter(
                                      (r) => r.trim() !== ""
                                    ),
                                  },
                                ]);
                                toast({
                                  title: "Rule created",
                                  description:
                                    "Rule section added successfully.",
                                });
                                setRulesForm({
                                  sectionTitle: "",
                                  rules: [""],
                                });
                                setShowRulesForm(false);
                              }}
                            >
                              Create
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setShowRulesForm(false);
                                setRulesForm({
                                  sectionTitle: "",
                                  rules: [""],
                                });
                              }}
                              className="border border-[rgba(0,0,0,0.15)] bg-white"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent
                      value="faqs"
                      className="mt-0 overflow-x-hidden"
                    >
                      {faqs.length === 0 && !showFaqsForm ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-[12px] p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                          <div className="flex flex-col items-center gap-2">
                            <div className="relative">
                              <FileText className="w-16 h-16 text-gray-400" />
                              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs font-bold">
                                  ×
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-[18px] font-semibold text-black">
                                No FAQ yet
                              </h3>
                              <p className="text-[14px] text-gray-500 max-w-md">
                                Add questions and answers to help participants
                                understand your event better.
                              </p>
                            </div>
                            <Button
                              type="button"
                              onClick={() => setShowFaqsForm(true)}
                              className="mt-2 bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                            >
                              Add question
                            </Button>
                          </div>
                        </div>
                      ) : faqs.length > 0 && !showFaqsForm ? (
                        <div className="space-y-4">
                          {faqs.map((faq) => (
                            <div
                              key={faq.id}
                              className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4 relative"
                            >
                              {editingFaqId === faq.id ? (
                                <>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Question
                                    </label>
                                    <div className="relative">
                                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                      <Input
                                        value={editingFaqForm.question}
                                        onChange={(e) =>
                                          setEditingFaqForm((prev) => ({
                                            ...prev,
                                            question: e.target.value,
                                          }))
                                        }
                                        className="w-full min-w-0 h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Answer
                                    </label>
                                    <Textarea
                                      value={editingFaqForm.answer}
                                      onChange={(e) =>
                                        setEditingFaqForm((prev) => ({
                                          ...prev,
                                          answer: e.target.value,
                                        }))
                                      }
                                      placeholder="Add answer (markdown supported)"
                                      className="min-h-[150px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3 focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none resize-y"
                                    />
                                  </div>

                                  <div className="flex items-center gap-2 pt-2">
                                    <Button
                                      type="button"
                                      className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                                      onClick={() => {
                                        if (
                                          !editingFaqForm.question.trim() ||
                                          !editingFaqForm.answer.trim()
                                        ) {
                                          toast({
                                            title: "Missing fields",
                                            description:
                                              "Please fill in both question and answer.",
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        setFaqs(
                                          faqs.map((f) =>
                                            f.id === faq.id
                                              ? {
                                                  ...f,
                                                  question:
                                                    editingFaqForm.question,
                                                  answer: editingFaqForm.answer,
                                                }
                                              : f
                                          )
                                        );
                                        setEditingFaqId(null);
                                        setEditingFaqForm({
                                          question: "",
                                          answer: "",
                                        });
                                        toast({
                                          title: "FAQ updated",
                                          description:
                                            "FAQ saved successfully.",
                                        });
                                      }}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      type="button"
                                      className="text-white rounded-[12px] hover:bg-red-600"
                                      style={{
                                        background:
                                          "var(--Component-colors-Utility-Error-utility-error-600, #D92D20)",
                                        boxShadow:
                                          "0 32px 24px 0 rgba(255, 255, 255, 0.05) inset, 0 2px 1px 0 rgba(255, 255, 255, 0.25) inset, 0 0 0 1px var(--Opacity-Neutral-Darkest-15, rgba(0, 0, 0, 0.15)) inset, 0 -2px 1px 0 rgba(0, 0, 0, 0.20) inset, 0 1px 2px 0 var(--Opacity-Neutral-Darkest-5, rgba(0, 0, 0, 0.05))",
                                      }}
                                      onClick={() => {
                                        setFaqs(
                                          faqs.filter((f) => f.id !== faq.id)
                                        );
                                        setEditingFaqId(null);
                                        setEditingFaqForm({
                                          question: "",
                                          answer: "",
                                        });
                                        toast({
                                          title: "FAQ deleted",
                                          description:
                                            "FAQ removed successfully.",
                                        });
                                      }}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="absolute top-4 right-4">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingFaqId(faq.id);
                                        setEditingFaqForm({
                                          question: faq.question,
                                          answer: faq.answer,
                                        });
                                      }}
                                      className="p-2 hover:bg-gray-50 rounded-[8px] transition-colors"
                                    >
                                      <Pencil className="w-4 h-4 text-gray-600" />
                                    </button>
                                  </div>

                                  <div className="space-y-2 pr-10">
                                    <label className="text-[16px] font-normal text-black">
                                      Question
                                    </label>
                                    <div className="relative">
                                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                                      <Input
                                        value={faq.question}
                                        readOnly
                                        className="w-full min-w-0 h-[44px] pl-11 bg-gray-50 border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] text-gray-600 cursor-not-allowed"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2 pr-10">
                                    <label className="text-[16px] font-normal text-black">
                                      Answer
                                    </label>
                                    <div className="min-h-[100px] bg-gray-50 border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] p-3 overflow-auto prose prose-sm max-w-full">
                                      {faq.answer ? (
                                        <ReactMarkdown>
                                          {faq.answer}
                                        </ReactMarkdown>
                                      ) : (
                                        <em className="text-gray-400">
                                          No answer provided.
                                        </em>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                          <Button
                            type="button"
                            onClick={() => setShowFaqsForm(true)}
                            className="rounded-[12px] border-0 text-black bg-[rgba(0,0,0,0.05)] hover:bg-gray-50 shadow-[0_0_0_1px_rgba(0,0,0,0.05)_inset,0_-2px_1px_0_rgba(0,0,0,0.05)_inset,0_1px_2px_0_rgba(0,0,0,0.05)]"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add new question
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
                          <div className="space-y-2">
                            <label className="text-[16px] font-normal text-black">
                              Question
                            </label>
                            <div className="relative">
                              <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                              <Input
                                value={faqsForm.question}
                                onChange={(e) =>
                                  setFaqsForm((prev) => ({
                                    ...prev,
                                    question: e.target.value,
                                  }))
                                }
                                placeholder="Short description shown in the preview card"
                                className="w-full min-w-0 h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[16px] font-normal text-black">
                              Answer
                            </label>
                            <Textarea
                              value={faqsForm.answer}
                              onChange={(e) =>
                                setFaqsForm((prev) => ({
                                  ...prev,
                                  answer: e.target.value,
                                }))
                              }
                              placeholder="Add answer (markdown supported)"
                              className="min-h-[200px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3 focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none resize-y"
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-4">
                            <Button
                              type="button"
                              className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                              onClick={() => {
                                if (
                                  !faqsForm.question.trim() ||
                                  !faqsForm.answer.trim()
                                ) {
                                  toast({
                                    title: "Missing fields",
                                    description:
                                      "Please fill in both question and answer.",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                setFaqs([
                                  ...faqs,
                                  {
                                    id: Date.now().toString(),
                                    question: faqsForm.question,
                                    answer: faqsForm.answer,
                                  },
                                ]);
                                toast({
                                  title: "FAQ created",
                                  description: "FAQ added successfully.",
                                });
                                setFaqsForm({
                                  question: "",
                                  answer: "",
                                });
                                setShowFaqsForm(false);
                              }}
                            >
                              Create
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setShowFaqsForm(false);
                                setFaqsForm({
                                  question: "",
                                  answer: "",
                                });
                              }}
                              className="border border-[rgba(0,0,0,0.15)] bg-white"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent
                      value="gallery"
                      className="mt-0 overflow-x-hidden"
                    >
                      {galleryImages.length === 0 ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-[12px] p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                          <div className="flex flex-col items-center gap-2">
                            <div className="relative">
                              <ImageIcon className="w-16 h-16 text-gray-400" />
                              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs font-bold">
                                  ×
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-[18px] font-semibold text-black">
                                No images yet
                              </h3>
                              <p className="text-[14px] text-gray-500 max-w-md">
                                Drop event images here or upload
                              </p>
                            </div>
                            <Button
                              type="button"
                              onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = "image/*";
                                input.multiple = true;
                                input.onchange = (e) => {
                                  const files = (e.target as HTMLInputElement)
                                    .files;
                                  if (files && files.length > 0) {
                                    const newImages = Array.from(files).map(
                                      (file) => ({
                                        id:
                                          Date.now().toString() + Math.random(),
                                        url: URL.createObjectURL(file),
                                      })
                                    );
                                    setGalleryImages([
                                      ...galleryImages,
                                      ...newImages,
                                    ]);
                                    toast({
                                      title: "Images uploaded",
                                      description: `${newImages.length} image(s) added to gallery.`,
                                    });
                                  }
                                };
                                input.click();
                              }}
                              className="mt-2 bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Upload Images
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {galleryImages.map((image) => (
                              <div
                                key={image.id}
                                className="relative aspect-square rounded-[12px] overflow-hidden border border-[rgba(0,0,0,0.15)] bg-gray-100 group"
                              >
                                <img
                                  src={image.url}
                                  alt="Gallery image"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGalleryImages(
                                      galleryImages.filter(
                                        (img) => img.id !== image.id
                                      )
                                    );
                                    toast({
                                      title: "Image deleted",
                                      description:
                                        "Image removed from gallery.",
                                    });
                                  }}
                                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <span className="text-white text-xs font-bold">
                                    ×
                                  </span>
                                </button>
                              </div>
                            ))}
                          </div>
                          <Button
                            type="button"
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = "image/*";
                              input.multiple = true;
                              input.onchange = (e) => {
                                const files = (e.target as HTMLInputElement)
                                  .files;
                                if (files && files.length > 0) {
                                  const newImages = Array.from(files).map(
                                    (file) => ({
                                      id: Date.now().toString() + Math.random(),
                                      url: URL.createObjectURL(file),
                                    })
                                  );
                                  setGalleryImages([
                                    ...galleryImages,
                                    ...newImages,
                                  ]);
                                  toast({
                                    title: "Images uploaded",
                                    description: `${newImages.length} image(s) added to gallery.`,
                                  });
                                }
                              };
                              input.click();
                            }}
                            className="rounded-[12px] border-0 text-black bg-[rgba(0,0,0,0.05)] hover:bg-gray-50 shadow-[0_0_0_1px_rgba(0,0,0,0.05)_inset,0_-2px_1px_0_rgba(0,0,0,0.05)_inset,0_1px_2px_0_rgba(0,0,0,0.05)]"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add more images
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                <TabsContent
                  value="registration"
                  className="mt-0 overflow-x-hidden"
                >
                  <p className="text-gray-500">
                    Registration settings - coming soon
                  </p>
                </TabsContent>

                <TabsContent value="project" className="mt-0 overflow-x-hidden">
                  <p className="text-gray-500">
                    Project settings - coming soon
                  </p>
                </TabsContent>

                <TabsContent value="access" className="mt-0 overflow-x-hidden">
                  <p className="text-gray-500">Access settings - coming soon</p>
                </TabsContent>

                <TabsContent
                  value="tracks"
                  className="mt-0 overflow-x-hidden w-full"
                >
                  <div className="w-full min-w-0 space-y-6">
                    <Tabs
                      value={activeTracksSubTab}
                      onValueChange={setActiveTracksSubTab}
                      className="w-full"
                    >
                      <div className="w-full overflow-x-auto mb-6">
                        <TabsList className="inline-flex h-auto gap-2 bg-transparent p-0 rounded-full">
                          <TabsTrigger
                            value="tracks"
                            className="px-4 py-2 rounded-full text-sm font-normal text-black border border-transparent data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:shadow-sm flex-shrink-0"
                          >
                            Tracks & Scoring
                          </TabsTrigger>
                          <TabsTrigger
                            value="prizes"
                            className="px-4 py-2 rounded-full text-sm font-normal text-black border border-transparent data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:shadow-sm flex-shrink-0"
                          >
                            Prizes
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      {/* Tracks & Scoring Tab */}
                      <TabsContent value="tracks" className="mt-0">
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-[18px] font-semibold text-black mb-2">
                              Tracks & Scoring
                            </h3>
                            <p className="text-[16px] text-gray-500">
                              Configure your event tracks below. For each track,
                              you can set up scoring criteria.
                            </p>
                          </div>

                          {/* Default Scoring Criteria */}
                          <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
                            <h4 className="text-[16px] font-semibold text-black">
                              Default Scoring Criteria
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <label className="text-[16px] font-normal text-black">
                                  Default Min Score
                                </label>
                                <Input
                                  type="number"
                                  value={defaultMinScore}
                                  onChange={(e) =>
                                    setDefaultMinScore(e.target.value)
                                  }
                                  className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[16px] font-normal text-black">
                                  Default Max Score
                                </label>
                                <Input
                                  type="number"
                                  value={defaultMaxScore}
                                  onChange={(e) =>
                                    setDefaultMaxScore(e.target.value)
                                  }
                                  className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[16px] font-normal text-black">
                                  Default Weight
                                </label>
                                <Input
                                  type="number"
                                  value={defaultWeight}
                                  onChange={(e) =>
                                    setDefaultWeight(e.target.value)
                                  }
                                  className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Tracks List or Empty State */}
                          {tracks.length === 0 && !showTrackForm ? (
                            <div className="bg-white border-2 border-dashed border-[rgba(0,0,0,0.15)] rounded-[12px] p-12 text-center">
                              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                <GripVertical className="w-8 h-8 text-gray-400" />
                              </div>
                              <h3 className="text-[18px] font-semibold text-black mb-2">
                                No track yet
                              </h3>
                              <p className="text-[16px] text-gray-500 mb-6">
                                Tracks will be used to group will be shown as
                                individual links on the event page
                              </p>
                              <Button
                                onClick={() => setShowTrackForm(true)}
                                className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                              >
                                Add track
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {tracks.map((track) => (
                                <div
                                  key={track.id}
                                  className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4"
                                >
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-[18px] font-semibold text-black">
                                      {track.name}
                                    </h4>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setTracks(
                                          tracks.filter(
                                            (t) => t.id !== track.id
                                          )
                                        );
                                      }}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Track Name
                                    </label>
                                    <div className="relative">
                                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                      <Input
                                        value={track.name}
                                        onChange={(e) => {
                                          setTracks(
                                            tracks.map((t) =>
                                              t.id === track.id
                                                ? { ...t, name: e.target.value }
                                                : t
                                            )
                                          );
                                        }}
                                        placeholder="Short description shown in the preview card"
                                        className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Description
                                    </label>
                                    <Textarea
                                      value={track.description}
                                      onChange={(e) => {
                                        setTracks(
                                          tracks.map((t) =>
                                            t.id === track.id
                                              ? {
                                                  ...t,
                                                  description: e.target.value,
                                                }
                                              : t
                                          )
                                        );
                                      }}
                                      placeholder="Add long description (markdown supported)"
                                      className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] min-h-[100px]"
                                    />
                                  </div>
                                  {track.criteria.map((criterion) => (
                                    <div
                                      key={criterion.id}
                                      className="bg-[#F7FAFE] border border-[rgba(0,0,0,0.15)] rounded-[12px] p-4 space-y-4"
                                    >
                                      <div className="flex items-center justify-between">
                                        <h5 className="text-[16px] font-semibold text-black">
                                          Criterion: {criterion.name}
                                        </h5>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setTracks(
                                              tracks.map((t) =>
                                                t.id === track.id
                                                  ? {
                                                      ...t,
                                                      criteria:
                                                        t.criteria.filter(
                                                          (c) =>
                                                            c.id !==
                                                            criterion.id
                                                        ),
                                                    }
                                                  : t
                                              )
                                            );
                                          }}
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                          <label className="text-[16px] font-normal text-black">
                                            Min Score
                                          </label>
                                          <Input
                                            type="number"
                                            value={criterion.minScore}
                                            onChange={(e) => {
                                              setTracks(
                                                tracks.map((t) =>
                                                  t.id === track.id
                                                    ? {
                                                        ...t,
                                                        criteria:
                                                          t.criteria.map((c) =>
                                                            c.id ===
                                                            criterion.id
                                                              ? {
                                                                  ...c,
                                                                  minScore:
                                                                    parseInt(
                                                                      e.target
                                                                        .value
                                                                    ),
                                                                }
                                                              : c
                                                          ),
                                                      }
                                                    : t
                                                )
                                              );
                                            }}
                                            className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <label className="text-[16px] font-normal text-black">
                                            Max Score
                                          </label>
                                          <Input
                                            type="number"
                                            value={criterion.maxScore}
                                            onChange={(e) => {
                                              setTracks(
                                                tracks.map((t) =>
                                                  t.id === track.id
                                                    ? {
                                                        ...t,
                                                        criteria:
                                                          t.criteria.map((c) =>
                                                            c.id ===
                                                            criterion.id
                                                              ? {
                                                                  ...c,
                                                                  maxScore:
                                                                    parseInt(
                                                                      e.target
                                                                        .value
                                                                    ),
                                                                }
                                                              : c
                                                          ),
                                                      }
                                                    : t
                                                )
                                              );
                                            }}
                                            className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <label className="text-[16px] font-normal text-black">
                                            Weight
                                          </label>
                                          <Input
                                            type="number"
                                            value={criterion.weight}
                                            onChange={(e) => {
                                              setTracks(
                                                tracks.map((t) =>
                                                  t.id === track.id
                                                    ? {
                                                        ...t,
                                                        criteria:
                                                          t.criteria.map((c) =>
                                                            c.id ===
                                                            criterion.id
                                                              ? {
                                                                  ...c,
                                                                  weight:
                                                                    parseInt(
                                                                      e.target
                                                                        .value
                                                                    ),
                                                                }
                                                              : c
                                                          ),
                                                      }
                                                    : t
                                                )
                                              );
                                            }}
                                            className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setTracks(
                                        tracks.map((t) =>
                                          t.id === track.id
                                            ? {
                                                ...t,
                                                criteria: [
                                                  ...t.criteria,
                                                  {
                                                    id: `criterion-${Date.now()}`,
                                                    name: "",
                                                    description: "",
                                                    questionType: "scale",
                                                    minScore:
                                                      parseInt(defaultMinScore),
                                                    maxScore:
                                                      parseInt(defaultMaxScore),
                                                    weight:
                                                      parseInt(defaultWeight),
                                                  },
                                                ],
                                              }
                                            : t
                                        )
                                      );
                                    }}
                                    className="w-full border border-[rgba(0,0,0,0.15)] bg-white"
                                  >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add criterion
                                  </Button>
                                </div>
                              ))}
                              {showTrackForm && (
                                <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
                                  <h4 className="text-[18px] font-semibold text-black">
                                    New Track
                                  </h4>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Track Name
                                    </label>
                                    <div className="relative">
                                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                      <Input
                                        value={trackForm.name}
                                        onChange={(e) =>
                                          setTrackForm({
                                            ...trackForm,
                                            name: e.target.value,
                                          })
                                        }
                                        placeholder="Short description shown in the preview card"
                                        className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Criterion Name
                                    </label>
                                    <div className="relative">
                                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                      <Input
                                        value={trackForm.criterionName}
                                        onChange={(e) =>
                                          setTrackForm({
                                            ...trackForm,
                                            criterionName: e.target.value,
                                          })
                                        }
                                        placeholder="Short description shown in the preview card"
                                        className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Description
                                    </label>
                                    <Textarea
                                      value={trackForm.description}
                                      onChange={(e) =>
                                        setTrackForm({
                                          ...trackForm,
                                          description: e.target.value,
                                        })
                                      }
                                      placeholder="Add long description (markdown supported)"
                                      className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] min-h-[100px]"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Question Type
                                    </label>
                                    <select
                                      value={trackForm.questionType}
                                      onChange={(e) =>
                                        setTrackForm({
                                          ...trackForm,
                                          questionType: e.target.value,
                                        })
                                      }
                                      className="w-full bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px] px-3"
                                    >
                                      <option value="scale">Scale</option>
                                      <option value="text">Text</option>
                                      <option value="multiple">
                                        Multiple Choice
                                      </option>
                                    </select>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                      <label className="text-[16px] font-normal text-black">
                                        Min Score
                                      </label>
                                      <Input
                                        type="number"
                                        value={trackForm.minScore}
                                        onChange={(e) =>
                                          setTrackForm({
                                            ...trackForm,
                                            minScore: e.target.value,
                                          })
                                        }
                                        className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[16px] font-normal text-black">
                                        Max Score
                                      </label>
                                      <Input
                                        type="number"
                                        value={trackForm.maxScore}
                                        onChange={(e) =>
                                          setTrackForm({
                                            ...trackForm,
                                            maxScore: e.target.value,
                                          })
                                        }
                                        className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[16px] font-normal text-black">
                                        Weight
                                      </label>
                                      <Input
                                        type="number"
                                        value={trackForm.weight}
                                        onChange={(e) =>
                                          setTrackForm({
                                            ...trackForm,
                                            weight: e.target.value,
                                          })
                                        }
                                        className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-3">
                                    <Button
                                      onClick={() => {
                                        if (!trackForm.name) {
                                          toast({
                                            title: "Missing fields",
                                            description:
                                              "Please fill in track name.",
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        const newTrack = {
                                          id: `track-${Date.now()}`,
                                          name: trackForm.name,
                                          description: trackForm.description,
                                          criteria: trackForm.criterionName
                                            ? [
                                                {
                                                  id: `criterion-${Date.now()}`,
                                                  name: trackForm.criterionName,
                                                  description:
                                                    trackForm.criterionDescription,
                                                  questionType:
                                                    trackForm.questionType ||
                                                    "scale",
                                                  minScore: parseInt(
                                                    trackForm.minScore
                                                  ),
                                                  maxScore: parseInt(
                                                    trackForm.maxScore
                                                  ),
                                                  weight: parseInt(
                                                    trackForm.weight
                                                  ),
                                                },
                                              ]
                                            : [],
                                        };
                                        setTracks([...tracks, newTrack]);
                                        setTrackForm({
                                          name: "",
                                          description: "",
                                          criterionName: "",
                                          criterionDescription: "",
                                          questionType: "",
                                          minScore: "1",
                                          maxScore: "1",
                                          weight: "1",
                                        });
                                        setShowTrackForm(false);
                                        toast({
                                          title: "Track added",
                                          description:
                                            "Track added successfully.",
                                        });
                                      }}
                                      className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                                    >
                                      Create
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setShowTrackForm(false);
                                        setTrackForm({
                                          name: "",
                                          description: "",
                                          criterionName: "",
                                          criterionDescription: "",
                                          questionType: "",
                                          minScore: "1",
                                          maxScore: "1",
                                          weight: "1",
                                        });
                                      }}
                                      className="border border-[rgba(0,0,0,0.15)] bg-white"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              )}
                              {!showTrackForm && (
                                <Button
                                  onClick={() => setShowTrackForm(true)}
                                  variant="outline"
                                  className="w-full border border-[rgba(0,0,0,0.15)] bg-white"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add new track
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      {/* Prizes Tab */}
                      <TabsContent value="prizes" className="mt-0">
                        <div className="space-y-4">
                          {prizes.length === 0 && !showPrizeForm ? (
                            <div className="bg-white border-2 border-dashed border-[rgba(0,0,0,0.15)] rounded-[12px] p-12 text-center">
                              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                <Trophy className="w-8 h-8 text-gray-400" />
                              </div>
                              <h3 className="text-[18px] font-semibold text-black mb-2">
                                No prize yet
                              </h3>
                              <p className="text-[16px] text-gray-500 mb-6">
                                Add prizes to tracks and assign winners for each
                                track
                              </p>
                              <Button
                                onClick={() => setShowPrizeForm(true)}
                                className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                              >
                                Add prize
                              </Button>
                            </div>
                          ) : (
                            <>
                              {prizes.map((prize) => (
                                <div
                                  key={prize.id}
                                  className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h3 className="text-[18px] font-semibold text-black">
                                        {prize.name}
                                      </h3>
                                      <p className="text-[14px] text-gray-500">
                                        Track: {prize.trackName}
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setPrizes(
                                          prizes.filter(
                                            (p) => p.id !== prize.id
                                          )
                                        );
                                      }}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Prize Name
                                    </label>
                                    <div className="relative">
                                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                      <Input
                                        value={prize.name}
                                        onChange={(e) => {
                                          setPrizes(
                                            prizes.map((p) =>
                                              p.id === prize.id
                                                ? {
                                                    ...p,
                                                    name: e.target.value,
                                                  }
                                                : p
                                            )
                                          );
                                        }}
                                        placeholder="e.g. iPad and Apple Pencil"
                                        className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Description
                                    </label>
                                    <Textarea
                                      value={prize.description}
                                      onChange={(e) => {
                                        setPrizes(
                                          prizes.map((p) =>
                                            p.id === prize.id
                                              ? {
                                                  ...p,
                                                  description: e.target.value,
                                                }
                                              : p
                                          )
                                        );
                                      }}
                                      placeholder="e.g. $7,000 iPad and Apple Pencil"
                                      className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] min-h-[100px]"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Cover image url
                                    </label>
                                    <div className="flex gap-2">
                                      <div className="relative flex-1">
                                        <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                          value={prize.coverImageUrl}
                                          onChange={(e) => {
                                            setPrizes(
                                              prizes.map((p) =>
                                                p.id === prize.id
                                                  ? {
                                                      ...p,
                                                      coverImageUrl:
                                                        e.target.value,
                                                    }
                                                  : p
                                              )
                                            );
                                          }}
                                          placeholder="https://..."
                                          className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                        />
                                      </div>
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          const input =
                                            document.createElement("input");
                                          input.type = "file";
                                          input.accept = "image/*";
                                          input.onchange = (e) => {
                                            const file = (
                                              e.target as HTMLInputElement
                                            ).files?.[0];
                                            if (file) {
                                              setPrizes(
                                                prizes.map((p) =>
                                                  p.id === prize.id
                                                    ? {
                                                        ...p,
                                                        coverImageUrl:
                                                          URL.createObjectURL(
                                                            file
                                                          ),
                                                      }
                                                    : p
                                                )
                                              );
                                            }
                                          };
                                          input.click();
                                        }}
                                        className="border border-[rgba(0,0,0,0.15)] bg-white"
                                      >
                                        <Upload className="w-4 h-4 mr-2" />
                                        Upload
                                      </Button>
                                    </div>
                                    <p className="text-[14px] text-gray-500">
                                      *Upload an image to showcase your project
                                      (Max 10MB).
                                    </p>
                                  </div>
                                </div>
                              ))}
                              {showPrizeForm && (
                                <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
                                  <h4 className="text-[18px] font-semibold text-black">
                                    New Prize
                                  </h4>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Select Track
                                    </label>
                                    <select
                                      value={prizeForm.trackId}
                                      onChange={(e) =>
                                        setPrizeForm({
                                          ...prizeForm,
                                          trackId: e.target.value,
                                        })
                                      }
                                      className="w-full bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px] px-3"
                                    >
                                      <option value="">Select a track</option>
                                      {tracks.map((track) => (
                                        <option key={track.id} value={track.id}>
                                          {track.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Prize Name
                                    </label>
                                    <div className="relative">
                                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                      <Input
                                        value={prizeForm.name}
                                        onChange={(e) =>
                                          setPrizeForm({
                                            ...prizeForm,
                                            name: e.target.value,
                                          })
                                        }
                                        placeholder="e.g. iPad and Apple Pencil"
                                        className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Description
                                    </label>
                                    <Textarea
                                      value={prizeForm.description}
                                      onChange={(e) =>
                                        setPrizeForm({
                                          ...prizeForm,
                                          description: e.target.value,
                                        })
                                      }
                                      placeholder="e.g. $7,000 iPad and Apple Pencil"
                                      className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] min-h-[100px]"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      Cover image url
                                    </label>
                                    <div className="flex gap-2">
                                      <div className="relative flex-1">
                                        <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                          value={prizeForm.coverImageUrl}
                                          onChange={(e) =>
                                            setPrizeForm({
                                              ...prizeForm,
                                              coverImageUrl: e.target.value,
                                            })
                                          }
                                          placeholder="https://..."
                                          className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                        />
                                      </div>
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          const input =
                                            document.createElement("input");
                                          input.type = "file";
                                          input.accept = "image/*";
                                          input.onchange = (e) => {
                                            const file = (
                                              e.target as HTMLInputElement
                                            ).files?.[0];
                                            if (file) {
                                              setPrizeForm({
                                                ...prizeForm,
                                                coverImageUrl:
                                                  URL.createObjectURL(file),
                                              });
                                            }
                                          };
                                          input.click();
                                        }}
                                        className="border border-[rgba(0,0,0,0.15)] bg-white"
                                      >
                                        <Upload className="w-4 h-4 mr-2" />
                                        Upload
                                      </Button>
                                    </div>
                                    <p className="text-[14px] text-gray-500">
                                      *Upload an image to showcase your project
                                      (Max 10MB).
                                    </p>
                                  </div>
                                  <div className="flex gap-3">
                                    <Button
                                      onClick={() => {
                                        if (!prizeForm.name) {
                                          toast({
                                            title: "Missing fields",
                                            description:
                                              "Please fill in prize name.",
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        if (!prizeForm.trackId) {
                                          toast({
                                            title: "Missing fields",
                                            description:
                                              "Please select a track.",
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        const selectedTrack = tracks.find(
                                          (t) => t.id === prizeForm.trackId
                                        );
                                        const newPrize = {
                                          id: `prize-${Date.now()}`,
                                          trackId: prizeForm.trackId,
                                          trackName: selectedTrack?.name || "",
                                          name: prizeForm.name,
                                          description: prizeForm.description,
                                          coverImageUrl:
                                            prizeForm.coverImageUrl,
                                        };
                                        setPrizes([...prizes, newPrize]);
                                        setPrizeForm({
                                          trackId: "",
                                          name: "",
                                          description: "",
                                          coverImageUrl: "",
                                        });
                                        setShowPrizeForm(false);
                                        toast({
                                          title: "Prize added",
                                          description:
                                            "Prize added successfully.",
                                        });
                                      }}
                                      className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                                    >
                                      Create
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setShowPrizeForm(false);
                                        setPrizeForm({
                                          trackId: "",
                                          name: "",
                                          description: "",
                                          coverImageUrl: "",
                                        });
                                      }}
                                      className="border border-[rgba(0,0,0,0.15)] bg-white"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              )}
                              {!showPrizeForm && (
                                <Button
                                  onClick={() => setShowPrizeForm(true)}
                                  variant="outline"
                                  className="w-full border border-[rgba(0,0,0,0.15)] bg-white"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add new prize
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>

                <TabsContent
                  value="pricing"
                  className="mt-0 overflow-x-hidden w-full"
                >
                  <div className="w-full min-w-0 space-y-6">
                    {/* Pricing Sub-tabs */}
                    {ticketType === "paid" ? (
                      <Tabs
                        value={activePricingSubTab}
                        onValueChange={setActivePricingSubTab}
                        className="w-full"
                      >
                        <div className="w-full overflow-x-auto mb-6">
                          <TabsList className="inline-flex h-auto gap-2 bg-transparent p-0 rounded-full">
                            <TabsTrigger
                              value="tiers"
                              className="px-4 py-2 rounded-full text-sm font-normal text-black border border-transparent data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:shadow-sm flex-shrink-0"
                            >
                              Pricing Tiers
                            </TabsTrigger>
                            <TabsTrigger
                              value="coupon"
                              className="px-4 py-2 rounded-full text-sm font-normal text-black border border-transparent data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:shadow-sm flex-shrink-0"
                            >
                              Coupon
                            </TabsTrigger>
                            <TabsTrigger
                              value="promo"
                              className="px-4 py-2 rounded-full text-sm font-normal text-black border border-transparent data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:shadow-sm flex-shrink-0"
                            >
                              Promo Code
                            </TabsTrigger>
                          </TabsList>
                        </div>

                        {/* Pricing Tiers Tab */}
                        <TabsContent value="tiers" className="mt-0">
                          <div className="space-y-4">
                            {pricingTiers.length === 0 && !showTierForm ? (
                              <div className="bg-white border-2 border-dashed border-[rgba(0,0,0,0.15)] rounded-[12px] p-12 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                  <DollarSign className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-[18px] font-semibold text-black mb-2">
                                  No tier created yet
                                </h3>
                                <p className="text-[16px] text-gray-500 mb-6">
                                  Add your first pricing tier to get started
                                </p>
                                <Button
                                  onClick={() => setShowTierForm(true)}
                                  className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                                >
                                  Add pricing tier
                                </Button>
                              </div>
                            ) : (
                              <>
                                {pricingTiers.map((tier, index) => (
                                  <div
                                    key={tier.id}
                                    className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4"
                                  >
                                    <div className="flex items-center justify-between">
                                      <h3 className="text-[18px] font-semibold text-black">
                                        Tier {index + 1}
                                      </h3>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setPricingTiers(
                                            pricingTiers.filter(
                                              (t) => t.id !== tier.id
                                            )
                                          );
                                        }}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Tier Name
                                        </label>
                                        <div className="relative">
                                          <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <Input
                                            value={tier.name}
                                            onChange={(e) => {
                                              setPricingTiers(
                                                pricingTiers.map((t) =>
                                                  t.id === tier.id
                                                    ? {
                                                        ...t,
                                                        name: e.target.value,
                                                      }
                                                    : t
                                                )
                                              );
                                            }}
                                            placeholder="Short description shown in the preview card."
                                            className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Price (USD)
                                        </label>
                                        <div className="relative">
                                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <Input
                                            type="number"
                                            step="0.01"
                                            value={tier.price / 100}
                                            onChange={(e) => {
                                              setPricingTiers(
                                                pricingTiers.map((t) =>
                                                  t.id === tier.id
                                                    ? {
                                                        ...t,
                                                        price: Math.round(
                                                          parseFloat(
                                                            e.target.value ||
                                                              "0"
                                                          ) * 100
                                                        ),
                                                      }
                                                    : t
                                                )
                                              );
                                            }}
                                            placeholder="e.g. 9"
                                            className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[16px] font-normal text-black">
                                        Description
                                      </label>
                                      <Textarea
                                        value={tier.description}
                                        onChange={(e) => {
                                          setPricingTiers(
                                            pricingTiers.map((t) =>
                                              t.id === tier.id
                                                ? {
                                                    ...t,
                                                    description: e.target.value,
                                                  }
                                                : t
                                            )
                                          );
                                        }}
                                        placeholder="Add long description (markdown supported)."
                                        className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] min-h-[100px]"
                                      />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Available Until
                                        </label>
                                        <div className="relative">
                                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <Input
                                            type="date"
                                            value={
                                              tier.available_until
                                                ? tier.available_until.split(
                                                    "T"
                                                  )[0]
                                                : ""
                                            }
                                            onChange={(e) => {
                                              setPricingTiers(
                                                pricingTiers.map((t) =>
                                                  t.id === tier.id
                                                    ? {
                                                        ...t,
                                                        available_until: e
                                                          .target.value
                                                          ? new Date(
                                                              e.target.value
                                                            ).toISOString()
                                                          : undefined,
                                                      }
                                                    : t
                                                )
                                              );
                                            }}
                                            placeholder="mm/dd/yyyy"
                                            className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Max Quantity
                                        </label>
                                        <div className="relative">
                                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <Input
                                            type="number"
                                            value={tier.max_quantity || ""}
                                            onChange={(e) => {
                                              setPricingTiers(
                                                pricingTiers.map((t) =>
                                                  t.id === tier.id
                                                    ? {
                                                        ...t,
                                                        max_quantity: e.target
                                                          .value
                                                          ? parseInt(
                                                              e.target.value,
                                                              10
                                                            )
                                                          : undefined,
                                                      }
                                                    : t
                                                )
                                              );
                                            }}
                                            placeholder="Leave blank for unlimited participants"
                                            className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[16px] font-normal text-black">
                                        Stripe Price ID
                                      </label>
                                      <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                          value={tier.stripe_price_id}
                                          onChange={(e) => {
                                            setPricingTiers(
                                              pricingTiers.map((t) =>
                                                t.id === tier.id
                                                  ? {
                                                      ...t,
                                                      stripe_price_id:
                                                        e.target.value,
                                                    }
                                                  : t
                                              )
                                            );
                                          }}
                                          placeholder="price_"
                                          className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                        />
                                      </div>
                                      <p className="text-[14px] text-gray-500">
                                        *Create a Stripe price in your Stripe
                                        dashboard and paste the ID here.
                                      </p>
                                    </div>
                                  </div>
                                ))}
                                {showTierForm && (
                                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
                                    <h3 className="text-[18px] font-semibold text-black">
                                      New Tier
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Tier Name
                                        </label>
                                        <div className="relative">
                                          <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <Input
                                            value={tierForm.name}
                                            onChange={(e) =>
                                              setTierForm({
                                                ...tierForm,
                                                name: e.target.value,
                                              })
                                            }
                                            placeholder="Short description shown in the preview card."
                                            className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Price (USD)
                                        </label>
                                        <div className="relative">
                                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <Input
                                            type="number"
                                            step="0.01"
                                            value={tierForm.price}
                                            onChange={(e) =>
                                              setTierForm({
                                                ...tierForm,
                                                price: e.target.value,
                                              })
                                            }
                                            placeholder="e.g. 9"
                                            className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[16px] font-normal text-black">
                                        Description
                                      </label>
                                      <Textarea
                                        value={tierForm.description}
                                        onChange={(e) =>
                                          setTierForm({
                                            ...tierForm,
                                            description: e.target.value,
                                          })
                                        }
                                        placeholder="Add long description (markdown supported)."
                                        className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] min-h-[100px]"
                                      />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Available Until
                                        </label>
                                        <div className="relative">
                                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <Input
                                            type="date"
                                            value={tierForm.available_until}
                                            onChange={(e) =>
                                              setTierForm({
                                                ...tierForm,
                                                available_until: e.target.value,
                                              })
                                            }
                                            placeholder="mm/dd/yyyy"
                                            className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Max Quantity
                                        </label>
                                        <div className="relative">
                                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <Input
                                            type="number"
                                            value={tierForm.max_quantity}
                                            onChange={(e) =>
                                              setTierForm({
                                                ...tierForm,
                                                max_quantity: e.target.value,
                                              })
                                            }
                                            placeholder="Leave blank for unlimited participants"
                                            className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[16px] font-normal text-black">
                                        Stripe Price ID
                                      </label>
                                      <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                          value={tierForm.stripe_price_id}
                                          onChange={(e) =>
                                            setTierForm({
                                              ...tierForm,
                                              stripe_price_id: e.target.value,
                                            })
                                          }
                                          placeholder="price_"
                                          className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                        />
                                      </div>
                                      <p className="text-[14px] text-gray-500">
                                        *Create a Stripe price in your Stripe
                                        dashboard and paste the ID here.
                                      </p>
                                    </div>
                                    <div className="flex gap-3">
                                      <Button
                                        onClick={() => {
                                          if (
                                            !tierForm.name ||
                                            !tierForm.price ||
                                            !tierForm.stripe_price_id
                                          ) {
                                            toast({
                                              title: "Missing fields",
                                              description:
                                                "Please fill in tier name, price, and Stripe Price ID.",
                                              variant: "destructive",
                                            });
                                            return;
                                          }
                                          const newTier = {
                                            id: `tier-${Date.now()}`,
                                            name: tierForm.name,
                                            price: Math.round(
                                              parseFloat(tierForm.price) * 100
                                            ),
                                            description: tierForm.description,
                                            available_until:
                                              tierForm.available_until
                                                ? new Date(
                                                    tierForm.available_until
                                                  ).toISOString()
                                                : undefined,
                                            max_quantity: tierForm.max_quantity
                                              ? parseInt(
                                                  tierForm.max_quantity,
                                                  10
                                                )
                                              : undefined,
                                            stripe_price_id:
                                              tierForm.stripe_price_id,
                                          };
                                          setPricingTiers([
                                            ...pricingTiers,
                                            newTier,
                                          ]);
                                          setTierForm({
                                            name: "",
                                            price: "",
                                            description: "",
                                            available_until: "",
                                            max_quantity: "",
                                            stripe_price_id: "",
                                          });
                                          setShowTierForm(false);
                                          toast({
                                            title: "Tier added",
                                            description:
                                              "Pricing tier added successfully.",
                                          });
                                        }}
                                        className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                                      >
                                        Create
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setShowTierForm(false);
                                          setTierForm({
                                            name: "",
                                            price: "",
                                            description: "",
                                            available_until: "",
                                            max_quantity: "",
                                            stripe_price_id: "",
                                          });
                                        }}
                                        className="border border-[rgba(0,0,0,0.15)] bg-white"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {!showTierForm && (
                                  <Button
                                    onClick={() => setShowTierForm(true)}
                                    variant="outline"
                                    className="w-full border border-[rgba(0,0,0,0.15)] bg-white"
                                  >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add new tier
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TabsContent>

                        {/* Coupon Tab */}
                        <TabsContent value="coupon" className="mt-0">
                          <div className="space-y-4">
                            {coupons.length === 0 && !showCouponForm ? (
                              <div className="bg-white border-2 border-dashed border-[rgba(0,0,0,0.15)] rounded-[12px] p-12 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                  <FileText className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-[18px] font-semibold text-black mb-2">
                                  No coupon created yet
                                </h3>
                                <p className="text-[16px] text-gray-500 mb-6">
                                  Add your first coupon and create a promo code
                                </p>
                                <Button
                                  onClick={() => setShowCouponForm(true)}
                                  className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                                >
                                  Add coupon
                                </Button>
                              </div>
                            ) : (
                              <>
                                {coupons.map((coupon) => (
                                  <div
                                    key={coupon.id}
                                    className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <h3 className="text-[18px] font-semibold text-black">
                                          {coupon.couponName}
                                        </h3>
                                        <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-sm rounded mt-2">
                                          Active
                                        </span>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setCoupons(
                                            coupons.filter(
                                              (c) => c.id !== coupon.id
                                            )
                                          );
                                        }}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-gray-500">
                                          Percentage Off (%):
                                        </span>{" "}
                                        <span className="font-medium">
                                          {coupon.percent_off
                                            ? `${coupon.percent_off}% off`
                                            : "N/A"}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">
                                          Max Uses:
                                        </span>{" "}
                                        <span className="font-medium">
                                          {coupon.max_uses || "Unlimited"}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">
                                          Valid Until:
                                        </span>{" "}
                                        <span className="font-medium">
                                          {coupon.valid_until
                                            ? new Date(
                                                coupon.valid_until
                                              ).toLocaleDateString()
                                            : "No expiration"}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">
                                          Duration:
                                        </span>{" "}
                                        <span className="font-medium">
                                          {coupon.duration === "once"
                                            ? "Once"
                                            : coupon.duration === "forever"
                                              ? "Forever"
                                              : "Repeating"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {showCouponForm && (
                                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
                                    <h3 className="text-[18px] font-semibold text-black">
                                      New Coupon
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Coupon Name
                                        </label>
                                        <div className="relative">
                                          <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <Input
                                            value={couponForm.couponName}
                                            onChange={(e) =>
                                              setCouponForm({
                                                ...couponForm,
                                                couponName: e.target.value,
                                              })
                                            }
                                            placeholder="e.g. Early Bird Special"
                                            className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Duration
                                        </label>
                                        <select
                                          value={couponForm.duration}
                                          onChange={(e) =>
                                            setCouponForm({
                                              ...couponForm,
                                              duration: e.target.value,
                                            })
                                          }
                                          className="w-full bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px] px-3"
                                        >
                                          <option value="once">
                                            One-time use
                                          </option>
                                          <option value="forever">
                                            Forever
                                          </option>
                                          <option value="repeating">
                                            Repeating
                                          </option>
                                        </select>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Percentage Off (%)
                                        </label>
                                        <div className="relative">
                                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <Input
                                            type="number"
                                            value={couponForm.percent_off}
                                            onChange={(e) =>
                                              setCouponForm({
                                                ...couponForm,
                                                percent_off: e.target.value,
                                              })
                                            }
                                            placeholder="e.g. 9"
                                            className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Fixed Amount Off
                                        </label>
                                        <div className="relative">
                                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <div className="flex gap-2">
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={couponForm.amount_off}
                                              onChange={(e) =>
                                                setCouponForm({
                                                  ...couponForm,
                                                  amount_off: e.target.value,
                                                })
                                              }
                                              placeholder="e.g. 10.00"
                                              className="flex-1 pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                            />
                                            <select
                                              value={couponForm.currency}
                                              onChange={(e) =>
                                                setCouponForm({
                                                  ...couponForm,
                                                  currency: e.target.value,
                                                })
                                              }
                                              className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px] px-3"
                                            >
                                              <option value="USD">USD</option>
                                            </select>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Max Uses
                                        </label>
                                        <div className="relative">
                                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <Input
                                            type="number"
                                            value={couponForm.max_uses}
                                            onChange={(e) =>
                                              setCouponForm({
                                                ...couponForm,
                                                max_uses: e.target.value,
                                              })
                                            }
                                            placeholder="Leave blank for unlimited use."
                                            className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Valid Until
                                        </label>
                                        <div className="relative">
                                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <Input
                                            type="date"
                                            value={couponForm.valid_until}
                                            onChange={(e) =>
                                              setCouponForm({
                                                ...couponForm,
                                                valid_until: e.target.value,
                                              })
                                            }
                                            placeholder="mm/dd/yyyy"
                                            className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex gap-3">
                                      <Button
                                        onClick={() => {
                                          if (!couponForm.couponName) {
                                            toast({
                                              title: "Missing fields",
                                              description:
                                                "Please fill in coupon name.",
                                              variant: "destructive",
                                            });
                                            return;
                                          }
                                          const newCoupon = {
                                            id: `coupon-${Date.now()}`,
                                            couponName: couponForm.couponName,
                                            duration: couponForm.duration,
                                            percent_off: couponForm.percent_off
                                              ? parseInt(
                                                  couponForm.percent_off,
                                                  10
                                                )
                                              : undefined,
                                            amount_off: couponForm.amount_off
                                              ? Math.round(
                                                  parseFloat(
                                                    couponForm.amount_off
                                                  ) * 100
                                                )
                                              : undefined,
                                            currency: couponForm.currency,
                                            max_uses: couponForm.max_uses
                                              ? parseInt(
                                                  couponForm.max_uses,
                                                  10
                                                )
                                              : undefined,
                                            valid_until: couponForm.valid_until
                                              ? new Date(
                                                  couponForm.valid_until
                                                ).toISOString()
                                              : undefined,
                                          };
                                          setCoupons([...coupons, newCoupon]);
                                          setCouponForm({
                                            couponName: "",
                                            duration: "once",
                                            percent_off: "",
                                            amount_off: "",
                                            currency: "USD",
                                            max_uses: "",
                                            valid_until: "",
                                          });
                                          setShowCouponForm(false);
                                          toast({
                                            title: "Coupon added",
                                            description:
                                              "Coupon added successfully.",
                                          });
                                        }}
                                        className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                                      >
                                        Create
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setShowCouponForm(false);
                                          setCouponForm({
                                            couponName: "",
                                            duration: "once",
                                            percent_off: "",
                                            amount_off: "",
                                            currency: "USD",
                                            max_uses: "",
                                            valid_until: "",
                                          });
                                        }}
                                        className="border border-[rgba(0,0,0,0.15)] bg-white"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {!showCouponForm && (
                                  <Button
                                    onClick={() => setShowCouponForm(true)}
                                    variant="outline"
                                    className="w-full border border-[rgba(0,0,0,0.15)] bg-white"
                                  >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add new coupon
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TabsContent>

                        {/* Promo Code Tab */}
                        <TabsContent value="promo" className="mt-0">
                          <div className="space-y-4">
                            {promoCodes.length === 0 && !showPromoCodeForm ? (
                              <div className="bg-white border-2 border-dashed border-[rgba(0,0,0,0.15)] rounded-[12px] p-12 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                  <FileText className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-[18px] font-semibold text-black mb-2">
                                  No code created yet
                                </h3>
                                <p className="text-[16px] text-gray-500 mb-6">
                                  Create a coupon code
                                </p>
                                <Button
                                  onClick={() => setShowPromoCodeForm(true)}
                                  className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                                >
                                  Add coupon code
                                </Button>
                              </div>
                            ) : (
                              <>
                                {promoCodes.map((promo) => (
                                  <div
                                    key={promo.id}
                                    className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <h3 className="text-[18px] font-semibold text-black">
                                          {promo.promoCode}
                                        </h3>
                                        {promo.couponName && (
                                          <p className="text-[14px] text-gray-500">
                                            Coupon: {promo.couponName}
                                          </p>
                                        )}
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setPromoCodes(
                                            promoCodes.filter(
                                              (p) => p.id !== promo.id
                                            )
                                          );
                                        }}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                {showPromoCodeForm && (
                                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
                                    <h3 className="text-[18px] font-semibold text-black">
                                      New Promo Code
                                    </h3>
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Select Coupon
                                        </label>
                                        <select
                                          value={promoCodeForm.couponId}
                                          onChange={(e) =>
                                            setPromoCodeForm({
                                              ...promoCodeForm,
                                              couponId: e.target.value,
                                            })
                                          }
                                          className="w-full bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px] px-3"
                                        >
                                          <option value="">
                                            Select a coupon
                                          </option>
                                          {coupons.map((coupon) => (
                                            <option
                                              key={coupon.id}
                                              value={coupon.id}
                                            >
                                              {coupon.couponName}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[16px] font-normal text-black">
                                          Promo Code
                                        </label>
                                        <div className="flex gap-2">
                                          <div className="relative flex-1">
                                            <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <Input
                                              value={promoCodeForm.promoCode}
                                              onChange={(e) =>
                                                setPromoCodeForm({
                                                  ...promoCodeForm,
                                                  promoCode:
                                                    e.target.value.toUpperCase(),
                                                })
                                              }
                                              placeholder="e.g. EARLYBIRD2024"
                                              className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                            />
                                          </div>
                                          <Button
                                            onClick={() => {
                                              const characters =
                                                "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                                              let result = "";
                                              for (let i = 0; i < 8; i++) {
                                                result += characters.charAt(
                                                  Math.floor(
                                                    Math.random() *
                                                      characters.length
                                                  )
                                                );
                                              }
                                              setPromoCodeForm({
                                                ...promoCodeForm,
                                                promoCode: result,
                                              });
                                            }}
                                            variant="outline"
                                            className="border border-[rgba(0,0,0,0.15)] bg-white"
                                          >
                                            Randomize
                                          </Button>
                                        </div>
                                        <p className="text-[14px] text-gray-500">
                                          *Use letters and numbers only. Code
                                          will be converted to uppercase.
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          id="overwrite"
                                          checked={promoCodeForm.overwrite}
                                          onChange={(e) =>
                                            setPromoCodeForm({
                                              ...promoCodeForm,
                                              overwrite: e.target.checked,
                                            })
                                          }
                                          className="w-4 h-4"
                                        />
                                        <label
                                          htmlFor="overwrite"
                                          className="text-[16px] font-normal text-black"
                                        >
                                          Overwrite existing promo code if it
                                          exists
                                        </label>
                                      </div>
                                    </div>
                                    <div className="flex gap-3">
                                      <Button
                                        onClick={() => {
                                          if (!promoCodeForm.promoCode) {
                                            toast({
                                              title: "Missing fields",
                                              description:
                                                "Please enter a promo code.",
                                              variant: "destructive",
                                            });
                                            return;
                                          }
                                          if (!promoCodeForm.couponId) {
                                            toast({
                                              title: "Missing fields",
                                              description:
                                                "Please select a coupon.",
                                              variant: "destructive",
                                            });
                                            return;
                                          }
                                          const selectedCoupon = coupons.find(
                                            (c) =>
                                              c.id === promoCodeForm.couponId
                                          );
                                          const newPromoCode = {
                                            id: `promo-${Date.now()}`,
                                            promoCode:
                                              promoCodeForm.promoCode.toUpperCase(),
                                            couponId: promoCodeForm.couponId,
                                            couponName:
                                              selectedCoupon?.couponName,
                                          };
                                          setPromoCodes([
                                            ...promoCodes,
                                            newPromoCode,
                                          ]);
                                          setPromoCodeForm({
                                            promoCode: "",
                                            couponId: "",
                                            overwrite: false,
                                          });
                                          setShowPromoCodeForm(false);
                                          toast({
                                            title: "Promo code added",
                                            description:
                                              "Promo code added successfully.",
                                          });
                                        }}
                                        className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                                      >
                                        Create
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setShowPromoCodeForm(false);
                                          setPromoCodeForm({
                                            promoCode: "",
                                            couponId: "",
                                            overwrite: false,
                                          });
                                        }}
                                        className="border border-[rgba(0,0,0,0.15)] bg-white"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {!showPromoCodeForm && (
                                  <Button
                                    onClick={() => setShowPromoCodeForm(true)}
                                    variant="outline"
                                    className="w-full border border-[rgba(0,0,0,0.15)] bg-white"
                                  >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add new code
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    ) : (
                      <div className="bg-white border-2 border-dashed border-[rgba(0,0,0,0.15)] rounded-[12px] p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                          <DollarSign className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-[18px] font-semibold text-black mb-2">
                          Paid event required
                        </h3>
                        <p className="text-[16px] text-gray-500">
                          Please enable "This is a paid event" in the Overview
                          tab to access pricing settings.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  value="notify"
                  className="mt-0 overflow-x-hidden w-full"
                >
                  <div className="w-full min-w-0 space-y-4">
                    {/* Message Type Selection */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => setMessageType("individual")}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[12px] text-[16px] font-normal transition-colors ${
                          messageType === "individual"
                            ? "bg-[#4b89ef] text-white"
                            : "bg-transparent border border-[rgba(0,0,0,0.15)] text-black"
                        }`}
                      >
                        <Mail className="w-5 h-5" />
                        Send individual message
                      </button>
                      <button
                        type="button"
                        onClick={() => setMessageType("group")}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[12px] text-[16px] font-normal transition-colors ${
                          messageType === "group"
                            ? "bg-[#4b89ef] text-white"
                            : "bg-transparent border border-[rgba(0,0,0,0.15)] text-black"
                        }`}
                      >
                        <Users className="w-5 h-5" />
                        Send group message
                      </button>
                    </div>

                    {/* Email Form */}
                    <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <h3 className="text-[16px] font-semibold text-black">
                          Send email to event participants
                        </h3>
                        <div className="flex items-center gap-3 sm:gap-4">
                          <button
                            type="button"
                            onClick={() => setShowTemplateModal(true)}
                            className="flex items-center gap-2 text-[14px] text-[#4b89ef] hover:underline"
                          >
                            <FileText className="w-4 h-4" />
                            Use template
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRecipientModal(true)}
                            className="flex items-center gap-2 text-[14px] text-[#4b89ef] hover:underline"
                          >
                            <Users className="w-4 h-4" />
                            Select recipient
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[16px] font-normal text-black">
                          Email subject
                        </label>
                        <div className="relative">
                          <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                          <Input
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            placeholder="Enter email subject"
                            className="w-full min-w-0 h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[16px] font-normal text-black">
                          Message
                        </label>
                        <Textarea
                          value={emailMessage}
                          onChange={(e) => setEmailMessage(e.target.value)}
                          placeholder="Enter your message"
                          className="min-h-[200px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3 focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none resize-y"
                        />
                      </div>

                      <Button
                        type="button"
                        className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                        onClick={() => {
                          if (!emailSubject.trim() || !emailMessage.trim()) {
                            toast({
                              title: "Missing fields",
                              description:
                                "Please fill in both subject and message.",
                              variant: "destructive",
                            });
                            return;
                          }
                          toast({
                            title: "Email sent",
                            description: `Email sent to ${
                              selectedRecipients.length || 0
                            } participant(s).`,
                          });
                        }}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send to {selectedRecipients.length || 0} participant
                        {selectedRecipients.length !== 1 ? "s" : ""}
                      </Button>
                    </div>

                    {/* Email Preview */}
                    <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6">
                      <h3 className="text-[16px] font-semibold text-black mb-3">
                        Email preview
                      </h3>
                      {emailSubject || emailMessage ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-500 mb-1">
                              Subject:
                            </p>
                            <p className="text-[16px] font-medium text-black">
                              {emailSubject || "No subject"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 mb-1">
                              Message:
                            </p>
                            <div className="prose prose-sm max-w-full">
                              <ReactMarkdown>{emailMessage}</ReactMarkdown>
                            </div>
                          </div>
                          <div className="pt-4 border-t border-[rgba(0,0,0,0.15)]">
                            <p className="text-[14px] text-gray-600">
                              Best Regards
                            </p>
                            <p className="text-[14px] text-gray-600">
                              The Event Organizers
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Mail className="w-12 h-12 text-gray-400 mb-3" />
                          <p className="text-[14px] text-gray-500">
                            No preview yet
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Recipient Selection Modal */}
                    {showRecipientModal && (
                      <>
                        <div
                          className="fixed inset-0 bg-black/50 z-[50]"
                          onClick={() => setShowRecipientModal(false)}
                        />
                        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
                          <div className="bg-white rounded-[12px] shadow-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between p-6 border-b border-[rgba(0,0,0,0.15)]">
                              <h2 className="text-[20px] font-semibold text-black">
                                Select recipient ({selectedRecipients.length}{" "}
                                selected)
                              </h2>
                              <button
                                type="button"
                                onClick={() => setShowRecipientModal(false)}
                                className="p-2 hover:bg-gray-50 rounded-[8px] transition-colors"
                              >
                                <X className="w-5 h-5 text-gray-600" />
                              </button>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1">
                              <div className="flex items-center gap-4 mb-4">
                                <select className="px-4 py-2 border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] bg-white">
                                  <option>All roles</option>
                                  <option>Organizer</option>
                                  <option>Participant</option>
                                  <option>Mentor</option>
                                  <option>Judge</option>
                                </select>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setSelectedRecipients([])}
                                  className="border border-[rgba(0,0,0,0.15)] bg-white"
                                >
                                  Clear all
                                </Button>
                                <div className="flex items-center gap-2 ml-auto">
                                  <input
                                    type="checkbox"
                                    id="select-all"
                                    className="w-4 h-4"
                                  />
                                  <label
                                    htmlFor="select-all"
                                    className="text-[14px] text-black"
                                  >
                                    Select all
                                  </label>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {/* Placeholder recipients - in real app, fetch from API */}
                                {[1, 2, 3, 4].map((i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-[8px]"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedRecipients.includes(
                                        `recipient-${i}`
                                      )}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedRecipients([
                                            ...selectedRecipients,
                                            `recipient-${i}`,
                                          ]);
                                        } else {
                                          setSelectedRecipients(
                                            selectedRecipients.filter(
                                              (r) => r !== `recipient-${i}`
                                            )
                                          );
                                        }
                                      }}
                                      className="w-4 h-4"
                                    />
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                      <User className="w-5 h-5 text-gray-600" />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-[16px] font-medium text-black">
                                        Participant {i}
                                      </p>
                                      <p className="text-[14px] text-gray-500">
                                        participant{i}@example.com
                                      </p>
                                    </div>
                                    <span className="text-[14px] text-gray-600">
                                      Participant
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="p-6 border-t border-[rgba(0,0,0,0.15)]">
                              <Button
                                type="button"
                                onClick={() => setShowRecipientModal(false)}
                                className="w-full bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                              >
                                Confirm
                              </Button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Template Selection Modal */}
                    {showTemplateModal && (
                      <>
                        <div
                          className="fixed inset-0 bg-black/50 z-[50]"
                          onClick={() => setShowTemplateModal(false)}
                        />
                        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
                          <div className="bg-white rounded-[12px] shadow-lg w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between p-6 border-b border-[rgba(0,0,0,0.15)]">
                              <div>
                                <h2 className="text-[20px] font-semibold text-black">
                                  Email template
                                </h2>
                                <p className="text-[14px] text-gray-500 mt-1">
                                  Choose from predefined templates to get
                                  started quickly. You can customize them as
                                  needed.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowTemplateModal(false)}
                                className="p-2 hover:bg-gray-50 rounded-[8px] transition-colors"
                              >
                                <X className="w-5 h-5 text-gray-600" />
                              </button>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                  {
                                    icon: Bell,
                                    title: "Welcome message",
                                    description:
                                      "Welcome new participants to event",
                                  },
                                  {
                                    icon: FileText,
                                    title: "Feedback available",
                                    description:
                                      "Notify about available project feedback",
                                  },
                                  {
                                    icon: Calendar,
                                    title: "Event reminder",
                                    description:
                                      "Remind participants about upcoming deadlines",
                                  },
                                  {
                                    icon: Clock,
                                    title: "Submission reminder",
                                    description:
                                      "Remind teams about submission deadline",
                                  },
                                  {
                                    icon: ArrowUpRight,
                                    title: "Schedule update",
                                    description:
                                      "Notify about schedule or event change",
                                  },
                                  {
                                    icon: Sparkles,
                                    title: "Result announcement",
                                    description:
                                      "Announce event results and winners",
                                  },
                                ].map((template, index) => {
                                  const IconComponent = template.icon;
                                  return (
                                    <button
                                      key={index}
                                      type="button"
                                      onClick={() => {
                                        setEmailSubject(template.title);
                                        setEmailMessage(
                                          `This is a ${template.title.toLowerCase()} template. Customize this message as needed.`
                                        );
                                        setShowTemplateModal(false);
                                        toast({
                                          title: "Template applied",
                                          description: `${template.title} template loaded.`,
                                        });
                                      }}
                                      className="text-left p-4 border border-[rgba(0,0,0,0.15)] rounded-[12px] hover:bg-gray-50 transition-colors"
                                    >
                                      <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-[8px] bg-[#4b89ef]/10 flex items-center justify-center flex-shrink-0">
                                          <IconComponent className="w-6 h-6 text-[#4b89ef]" />
                                        </div>
                                        <div className="flex-1">
                                          <h3 className="text-[16px] font-semibold text-black mb-1">
                                            {template.title}
                                          </h3>
                                          <p className="text-[14px] text-gray-500">
                                            {template.description}
                                          </p>
                                        </div>
                                        <ArrowUpRight className="w-5 h-5 text-gray-400" />
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              </div>

              {/* Preview Card - Only show on Overview tab */}
              {activeTab === "overview" && (
                <div className="flex-shrink-0 w-full lg:w-[335px] order-first lg:order-last overflow-x-hidden">
                  <div className="w-full lg:w-[335px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] overflow-hidden">
                    {/* Image */}
                    <div className="relative w-full aspect-[335/223] overflow-hidden">
                      {form.cover_image_url ? (
                        <img
                          src={form.cover_image_url}
                          alt="Event cover"
                          className="w-full h-full object-cover block"
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

                  <button
                    onClick={() => {
                      const previewSlug = getPreviewSlug();
                      if (previewSlug) {
                        window.open(`/events/${previewSlug}`, "_blank");
                      } else {
                        toast({
                          title: "Event name required",
                          description:
                            "Please enter an event name to preview the event page.",
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={!form.event_name}
                    className="flex items-center gap-2 text-[16px] text-[#7f7f7f] hover:text-[#4b89ef] transition-colors mt-3 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Preview event page
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

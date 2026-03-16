"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { EventVisibility, EventRole, Rule, ApprovalStatus } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { useToast } from "@/lib/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Download,
  Percent,
  Shuffle,
  UserPlus,
  ChevronDown,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeSubTab, setActiveSubTab] = useState("basics");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImageUploading, setCoverImageUploading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [createdEventSlug, setCreatedEventSlug] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Get user's timezone as default
  const getUserTimezone = (): string => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  };
  
  const [submissionTimezone, setSubmissionTimezone] = useState<string>(() => getUserTimezone());

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
  const [activeAccessSubTab, setActiveAccessSubTab] = useState("password");
  const [rolePasswords, setRolePasswords] = useState<Record<string, string>>(
    {}
  );
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>({
    [EventRole.Participant]: "Participant",
    [EventRole.Mentor]: "Mentor",
    [EventRole.Judge]: "Judge",
    [EventRole.Organizer]: "Organizer",
  });
  const [organizerEmails, setOrganizerEmails] = useState<string[]>([]);
  const [organizerEmailInput, setOrganizerEmailInput] = useState("");

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

  const buildEventSchedulePayload = () => {
    if (schedules.length === 0) return undefined;

    const groupedByDay = schedules.reduce<
      Record<
        string,
        Array<{
          name: string;
          time?: string;
          description?: string;
          guests?: string;
        }>
      >
    >((acc, schedule) => {
      const dayTitle = schedule.dayTitle.trim();
      if (!dayTitle) return acc;

      if (!acc[dayTitle]) {
        acc[dayTitle] = [];
      }

      acc[dayTitle].push({
        name: schedule.eventName,
        time: schedule.time || undefined,
        description: schedule.description || undefined,
        guests: schedule.guests || undefined,
      });

      return acc;
    }, {});

    const normalized = Object.entries(groupedByDay).map(([dayTitle, events]) => ({
      time: dayTitle,
      events: events.filter((event) => event.name.trim().length > 0),
    }));

    return normalized.length > 0 ? normalized : undefined;
  };

  const buildFaqMarkdown = () => {
    if (faqs.length === 0) return undefined;

    const sections = faqs
      .filter(
        (faq) => faq.question.trim().length > 0 || faq.answer.trim().length > 0
      )
      .map((faq) => `### ${faq.question.trim()}\n${faq.answer.trim()}`);

    return sections.length > 0 ? sections.join("\n\n") : undefined;
  };

  const buildEventResourcesPayload = () => {
    const normalizedResources = resources
      .map((resource) => ({
        name: resource.name.trim(),
        link: resource.link.trim(),
      }))
      .filter((resource) => resource.name.length > 0 && resource.link.length > 0);

    const draftName = resourcesForm.resourceName.trim();
    const draftLink = resourcesForm.resourceLink.trim();
    const hasDraftResource =
      showResourcesForm && draftName.length > 0 && draftLink.length > 0;

    if (hasDraftResource) {
      normalizedResources.push({
        name: draftName,
        link: draftLink,
      });
    }

    return normalizedResources.length > 0 ? normalizedResources : undefined;
  };

  const getOrganizerEmailsForSubmit = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserEmail = sessionData?.session?.user?.email?.trim().toLowerCase();

    const fromAccessTab = organizerEmails.map((email) => email.trim().toLowerCase());
    const fromLegacyField = (form.organizer_emails || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const deduped = Array.from(
      new Set([...fromAccessTab, ...fromLegacyField].filter(Boolean))
    );

    if (currentUserEmail && !deduped.includes(currentUserEmail)) {
      deduped.unshift(currentUserEmail);
    }

    return deduped;
  };

  const buildTracksPayload = () => {
    const normalizedTracks = tracks
      .map((track) => {
        const normalizedCriteria = track.criteria
          .map((criterion) => ({
            id: criterion.id,
            name: criterion.name.trim(),
            description: criterion.description.trim(),
            type:
              criterion.questionType === "multiplechoice"
                ? "multiplechoice"
                : "numeric",
            min: criterion.minScore,
            max: criterion.maxScore,
            weight: criterion.weight,
          }))
          .filter((criterion) => criterion.name.length > 0);

        return {
          client_id: track.id,
          name: track.name.trim(),
          description: track.description.trim() || null,
          scoring_criteria: {
            name: track.name.trim(),
            criteria: normalizedCriteria,
          },
        };
      })
      .filter((track) => track.name.length > 0);

    return normalizedTracks.length > 0 ? normalizedTracks : undefined;
  };

  const buildPrizesPayload = () => {
    const normalizedPrizes = prizes
      .map((prize) => ({
        track_client_id: prize.trackId,
        name: prize.name.trim(),
        description: prize.description.trim(),
        cover_image_url: prize.coverImageUrl.trim() || null,
      }))
      .filter((prize) => prize.name.length > 0 && prize.track_client_id.length > 0);

    return normalizedPrizes.length > 0 ? normalizedPrizes : undefined;
  };

  const validateCoverImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please upload an image file (PNG, JPG, GIF, etc.)");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Image size must be less than 5MB");
    }
  };

  const uploadCoverImageFile = async (file: File) => {
    validateCoverImageFile(file);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `event-covers/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("event-materials")
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(uploadError.message || "Failed to upload image file");
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("event-materials").getPublicUrl(filePath);

    return publicUrl;
  };

  const ensureCoverImageUrl = async () => {
    if (!coverImageFile) return form.cover_image_url || undefined;

    setCoverImageUploading(true);
    try {
      const publicUrl = await uploadCoverImageFile(coverImageFile);
      onChange("cover_image_url", publicUrl);
      setCoverImageFile(null);
      return publicUrl;
    } finally {
      setCoverImageUploading(false);
    }
  };

  const buildEventPayload = (
    visibilityOverride: EventVisibility,
    coverImageUrl?: string,
    approvalStatus?: ApprovalStatus
  ) => ({
    event_name: form.event_name,
    event_date: form.event_date,
    location: form.location,
    visibility: visibilityOverride,
    slug: form.slug || undefined,
    event_description: form.event_description || undefined,
    event_blurb: form.event_blurb || undefined,
    cover_image_url: coverImageUrl || undefined,
    paid: ticketType === "paid",
    submission_time_start: form.submission_time_start || undefined,
    submission_time_cutoff: form.submission_time_cutoff || undefined,
    participant_capacity: form.participant_capacity
      ? parseInt(form.participant_capacity, 10)
      : undefined,
    paywall_content: form.paywall_content || undefined,
    rules: rules.length > 0 ? rules : undefined,
    event_schedule: buildEventSchedulePayload(),
    event_resources: buildEventResourcesPayload(),
    faq: buildFaqMarkdown(),
    tracks: buildTracksPayload(),
    prizes: buildPrizesPayload(),
    ...(approvalStatus ? { approval_status: approvalStatus } : {}),
  });

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
      setIsAdmin(adminData || false);
      setLoading(false);
    };
    checkAccess();
  }, [router]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showCreateDropdown && !target.closest('.create-dropdown-container')) {
        setShowCreateDropdown(false);
      }
    };

    if (showCreateDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCreateDropdown]);

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
        submission_time_start: parsed.submission_time_start ?? prev.submission_time_start,
        submission_time_cutoff: parsed.submission_time_cutoff ?? prev.submission_time_cutoff,
      }));

      if (typeof parsed.paid === "boolean") {
        setTicketType(parsed.paid ? "paid" : "free");
      }

      if (typeof parsed.visibility === "string") {
        const v = parsed.visibility.toLowerCase();
        // Public visibility is not allowed - default to private instead
        if (v === "public") setVisibility(EventVisibility.Private);
        else if (v === "private") setVisibility(EventVisibility.Private);
        else if (v === "draft") setVisibility(EventVisibility.Draft);
      }

      // Import rules
      if (Array.isArray(parsed.rules) && parsed.rules.length > 0) {
        const importedRules: Rule[] = parsed.rules.map((rule: { title: string; items: string[] }) => ({
          title: rule.title || "",
          items: Array.isArray(rule.items) ? rule.items : [],
        }));
        setRules(importedRules);
      }

      // Import FAQs
      if (Array.isArray(parsed.faqs) && parsed.faqs.length > 0) {
        const importedFaqs = parsed.faqs.map((faq: { question: string; answer: string }, index: number) => ({
          id: `imported-faq-${index}-${Date.now()}`,
          question: faq.question || "",
          answer: faq.answer || "",
        }));
        setFaqs(importedFaqs);
      }

      // Import resources
      if (Array.isArray(parsed.event_resources) && parsed.event_resources.length > 0) {
        const importedResources = parsed.event_resources.map((resource: { name: string; link: string }, index: number) => ({
          id: `imported-resource-${index}-${Date.now()}`,
          name: resource.name || "",
          link: resource.link || "",
        }));
        setResources(importedResources);
      }

      // Import schedules
      if (Array.isArray(parsed.event_schedule) && parsed.event_schedule.length > 0) {
        const importedSchedules: Array<{
          id: string;
          dayTitle: string;
          eventName: string;
          time: string;
          guests: string;
          description: string;
        }> = [];
        parsed.event_schedule.forEach((day: { date: string; events: Array<{ name: string; time: string; description?: string }> }, dayIndex: number) => {
          if (Array.isArray(day.events)) {
            day.events.forEach((event, eventIndex: number) => {
              importedSchedules.push({
                id: `imported-schedule-${dayIndex}-${eventIndex}-${Date.now()}`,
                dayTitle: day.date || "",
                eventName: event.name || "",
                time: event.time || "",
                guests: "",
                description: event.description || "",
              });
            });
          }
        });
        setSchedules(importedSchedules);
      }

      // Import tracks
      if (Array.isArray(parsed.tracks) && parsed.tracks.length > 0) {
        const importedTracks = parsed.tracks.map((track: {
          name: string;
          description?: string;
          criteria?: Array<{
            name: string;
            description?: string;
            weight?: number;
            min?: number;
            max?: number;
          }>;
        }, index: number) => ({
          id: `imported-track-${index}-${Date.now()}`,
          name: track.name || "",
          description: track.description || "",
          criteria: Array.isArray(track.criteria)
            ? track.criteria.map((criterion, criterionIndex: number) => ({
                id: `imported-criterion-${index}-${criterionIndex}-${Date.now()}`,
                name: criterion.name || "",
                description: criterion.description || "",
                questionType: "numeric",
                minScore: criterion.min ?? 1,
                maxScore: criterion.max ?? 10,
                weight: criterion.weight ?? 1,
              }))
            : [],
        }));
        setTracks(importedTracks);
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
      const organizerEmails = await getOrganizerEmailsForSubmit();

      const coverImageUrl = await ensureCoverImageUrl();

      // Always save as draft by default
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: buildEventPayload(EventVisibility.Draft, coverImageUrl),
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
        title: "Event saved as draft",
        description: `${data.event.event_name} has been saved as a draft.`,
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

  const handlePublishAsPrivate = async () => {
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
      const organizerEmails = await getOrganizerEmailsForSubmit();

      const coverImageUrl = await ensureCoverImageUrl();

      // Create event as private
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: buildEventPayload(EventVisibility.Private, coverImageUrl),
          organizerEmails,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Publish failed",
          description: data.error || "Error publishing event.",
          variant: "destructive",
        });
        return;
      }
      
      // Store event ID and slug, then show approval modal
      setCreatedEventId(data.event.event_id);
      setCreatedEventSlug(data.event.slug || null);
      setShowApprovalModal(true);
    } catch {
      toast({
        title: "Network error",
        description: "Unable to publish event.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handlePublishAsPublic = async () => {
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
      const organizerEmails = await getOrganizerEmailsForSubmit();

      const coverImageUrl = await ensureCoverImageUrl();

      // Create event as private
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: buildEventPayload(
            EventVisibility.Public,
            coverImageUrl,
            ApprovalStatus.Approved
          ),
          organizerEmails,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Publish failed",
          description: data.error || "Error publishing event.",
          variant: "destructive",
        });
        return;
      }
      
      // Store event ID and slug, then navigate to event page
      setCreatedEventId(data.event.event_id);
      setCreatedEventSlug(data.event.slug || null);
      router.push(`/events/${data.event.slug || data.event.event_id}/overview`);
    } catch {
      toast({
        title: "Network error",
        description: "Unable to publish event.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };


  const handleSubmitForApproval = async () => {
    if (!createdEventId || isNavigating) return;
    
    setIsNavigating(true);
    setCreating(true);
    try {
      const res = await fetch("/api/events/request-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: createdEventId,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        setIsNavigating(false);
        toast({
          title: "Request failed",
          description: data.error || "Error submitting for approval.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Approval requested",
        description: "Your event has been submitted for approval to be featured on the home page.",
      });
      
      setShowApprovalModal(false);
      router.push(`/events/${createdEventSlug || createdEventId}/overview`);
    } catch {
      setIsNavigating(false);
      toast({
        title: "Network error",
        description: "Unable to submit for approval.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSkipApproval = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    setShowApprovalModal(false);
    if (createdEventId) {
      router.push(`/events/${createdEventSlug || createdEventId}/overview`);
    }
  };

  const handleModalClose = (open: boolean) => {
    if (!open && showApprovalModal && !isNavigating) {
      // Modal is being closed without clicking a button, navigate to event page
      handleSkipApproval();
    } else if (open !== showApprovalModal) {
      setShowApprovalModal(open);
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
        // Public visibility is not allowed - default to private instead
        if (v === "public") setVisibility(EventVisibility.Private);
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

  const handleCoverImageUpload = async (file: File) => {
    try {
      validateCoverImageFile(file);
    } catch (error) {
      toast({
        title: "Invalid image",
        description:
          error instanceof Error
            ? error.message
            : "Please upload a valid image file.",
        variant: "destructive",
      });
      return;
    }

    setCoverImageUploading(true);
    try {
      const publicUrl = await uploadCoverImageFile(file);
      onChange("cover_image_url", publicUrl);
      setCoverImageFile(null);

      toast({
        title: "Image uploaded",
        description: "Cover image uploaded successfully",
      });
    } catch {
      toast({
        title: "Upload error",
        description: "Failed to upload cover image",
        variant: "destructive",
      });
    } finally {
      setCoverImageUploading(false);
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
    <div className="flex-1 flex flex-col min-h-0 overflow-auto pt-0">
      <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 w-full flex flex-col pb-20 lg:pb-4 flex-1 min-h-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 flex-shrink-0">
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 font-geist tracking-[-0.06em]">
              Create event
            </h1>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              

              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="defaultGray"
                  onClick={() => router.back()}
                  className="text-[16px] font-medium flex-1 sm:flex-none rounded-[12px]"
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    handleCreate();
                  }}
                  disabled={creating}
                  className="text-[16px] font-medium flex-1 sm:flex-none border border-[rgba(0,0,0,0.15)] bg-white rounded-[12px]"
                >
                  {creating ? "Saving..." : "Save Draft"}
                </Button>
                
                {isAdmin ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        disabled={creating}
                        className="text-[16px] font-medium flex-1 sm:flex-none bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white rounded-[12px]"
                      >
                        {creating ? "Publishing..." : "Publish Event"}
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          handlePublishAsPrivate();
                        }}
                        disabled={creating}
                      >
                        Publish as Private Event
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          handlePublishAsPublic();
                          handleSkipApproval();
                        }}
                        disabled={creating}
                      >
                        Publish as Public Event
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      handlePublishAsPrivate();
                    }}
                    disabled={creating}
                    className="text-[16px] font-medium flex-1 sm:flex-none bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                  >
                    {creating ? "Publishing..." : "Publish as Private Event"}
                  </Button>
                )}
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
              </TabsList>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start w-full lg:flex-1 lg:min-h-0 lg:overflow-auto no-scrollbar">
              {/* Form Section */}
              <div className="w-full flex flex-col items-start order-last lg:order-first">
                <TabsContent value="overview" className="mt-0 w-full">
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

                    <div className="flex flex-col md:flex-row gap-6 lg:gap-8 items-start w-full">
                      <div className="w-full lg:flex-1 lg:min-w-0">
                        <TabsContent
                          value="basics"
                          className="mt-0 space-y-4 overflow-x-hidden w-full min-w-0 pl-2"
                        >
                          <input
                            type="text"
                            value={form.event_name}
                            onChange={(e) =>
                              onChange("event_name", e.target.value)
                            }
                            placeholder="Event Title"
                            className="font-semibold text-[36px] leading-[1.3] tracking-[-2.16px] mb-6 w-full min-w-0 bg-transparent border-none outline-none focus:ring-0 p-0"
                            style={{
                              color: form.event_name ? "#000000" : "#d8d8d8",
                              fontFamily: "Geist, sans-serif",
                            }}
                          />

                          <div className="space-y-4 w-full min-w-0 px-2">
                            <div className="space-y-2 w-full min-w-0">
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

                            {/* Project submission window */}
                            <div className="space-y-4">
                              <label className="text-[16px] font-normal text-black">
                                Project submission window
                              </label>
                              
                              {/* Timezone Selector - Moved to top for better UX */}
                              <div className="space-y-1">
                                <label className="text-sm text-gray-600">Display timezone</label>
                                <Select
                                  value={submissionTimezone}
                                  onValueChange={setSubmissionTimezone}
                                >
                                  <SelectTrigger className="h-[44px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px]">
                                    <SelectValue placeholder="Select timezone" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {/* Show user's timezone first if it's not in the standard list */}
                                    {(() => {
                                      const userTz = getUserTimezone();
                                      const standardTimezones = [
                                        "UTC",
                                        "America/New_York",
                                        "America/Chicago",
                                        "America/Denver",
                                        "America/Los_Angeles",
                                        "America/Phoenix",
                                        "America/Anchorage",
                                        "Pacific/Honolulu",
                                        "Europe/London",
                                        "Europe/Paris",
                                        "Asia/Tokyo",
                                        "Asia/Shanghai",
                                        "Asia/Dubai",
                                        "Australia/Sydney",
                                      ];
                                      
                                      if (!standardTimezones.includes(userTz)) {
                                        return (
                                          <SelectItem value={userTz}>
                                            {userTz.replace(/_/g, " ")} (Your timezone)
                                          </SelectItem>
                                        );
                                      }
                                      return null;
                                    })()}
                                    <SelectItem value="UTC">UTC</SelectItem>
                                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                                    <SelectItem value="America/Phoenix">Arizona Time (MST)</SelectItem>
                                    <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                                    <SelectItem value="Pacific/Honolulu">Hawaii Time (HST)</SelectItem>
                                    <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                                    <SelectItem value="Europe/Paris">Paris (CET/CEST)</SelectItem>
                                    <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                                    <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
                                    <SelectItem value="Asia/Dubai">Dubai (GST)</SelectItem>
                                    <SelectItem value="Australia/Sydney">Sydney (AEDT/AEST)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500">
                                  Auto-detected: {getUserTimezone().replace(/_/g, " ")} • Times stored in UTC
                                </p>
                              </div>

                              {/* Date/Time Pickers */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm text-gray-600">Start</label>
                                  <DateTimePicker
                                    value={form.submission_time_start}
                                    onChange={(value) =>
                                      onChange("submission_time_start", value)
                                    }
                                    placeholder="Select start date & time"
                                    timezone={submissionTimezone}
                                    showTimezone={false}
                                    onTimezoneChange={setSubmissionTimezone}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm text-gray-600">End</label>
                                  <DateTimePicker
                                    value={form.submission_time_cutoff}
                                    onChange={(value) =>
                                      onChange("submission_time_cutoff", value)
                                    }
                                    placeholder="Select end date & time"
                                    timezone={submissionTimezone}
                                    showTimezone={false}
                                    onTimezoneChange={setSubmissionTimezone}
                                  />
                                </div>
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
                                  min="0"
                                  value={form.participant_capacity}
                                  onChange={(e) =>
                                    onChange(
                                      "participant_capacity",
                                      e.target.value
                                    )
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
                                  placeholder="Add location"
                                  className="w-full min-w-0 h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                                />
                              </div>
                            </div>

                            {/* Cover Image */}
                            <div className="space-y-2">
                              <label className="text-[16px] font-normal text-black">
                                Cover image
                              </label>

                              {/* File Upload Section */}
                              {!coverImageFile && !form.cover_image_url && (
                                <div className="space-y-3">
                                  <label
                                    htmlFor="cover-image-upload"
                                    className="flex items-center justify-center gap-2 h-[100px] bg-white border-2 border-dashed border-[rgba(0,0,0,0.15)] rounded-[12px] cursor-pointer hover:border-[#4b89ef] hover:bg-blue-50/30 transition-colors"
                                  >
                                    <Upload className="w-6 h-6 text-gray-500" />
                                    <span className="text-[16px] text-gray-500">
                                      Click to upload an image
                                    </span>
                                    <input
                                      id="cover-image-upload"
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) setCoverImageFile(file);
                                      }}
                                      className="hidden"
                                    />
                                  </label>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-[rgba(0,0,0,0.15)]" />
                                    <span className="text-[14px] text-gray-500">
                                      or enter URL
                                    </span>
                                    <div className="flex-1 h-px bg-[rgba(0,0,0,0.15)]" />
                                  </div>
                                  <div className="relative">
                                    <Input
                                      value={form.cover_image_url}
                                      onChange={(e) =>
                                        onChange(
                                          "cover_image_url",
                                          e.target.value
                                        )
                                      }
                                      placeholder="https://..."
                                      className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* File Selected Preview */}
                              {coverImageFile && (
                                <div className="space-y-3">
                                  <div className="relative w-full h-[140px] rounded-[12px] overflow-hidden bg-gray-100">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={URL.createObjectURL(coverImageFile)}
                                      alt="Cover image preview"
                                      className="w-full h-full object-cover"
                                    />
                                    <button
                                      onClick={() => setCoverImageFile(null)}
                                      className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                                    >
                                      <X className="w-4 h-4 text-white" />
                                    </button>
                                  </div>
                                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-[12px]">
                                    <div>
                                      <p className="text-[14px] font-medium text-black truncate max-w-[300px]">
                                        {coverImageFile.name}
                                      </p>
                                      <p className="text-[12px] text-gray-500">
                                        {(
                                          coverImageFile.size /
                                          1024 /
                                          1024
                                        ).toFixed(2)}{" "}
                                        MB
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleCoverImageUpload(coverImageFile)
                                        }
                                        disabled={coverImageUploading}
                                      >
                                        {coverImageUploading
                                          ? "Uploading..."
                                          : "Upload"}
                                      </Button>
                                      <Button
                                        variant="defaultGray"
                                        size="sm"
                                        className="rounded-[12px] text-[16px]"
                                        onClick={() => setCoverImageFile(null)}
                                        disabled={coverImageUploading}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Uploaded/URL Image Preview */}
                              {form.cover_image_url && !coverImageFile && (
                                <div className="space-y-3">
                                  <div className="relative w-full h-[140px] rounded-[12px] overflow-hidden bg-gray-100">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={form.cover_image_url}
                                      alt="Cover image"
                                      className="w-full h-full object-cover"
                                    />
                                    <button
                                      onClick={() =>
                                        onChange("cover_image_url", "")
                                      }
                                      className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                                    >
                                      <X className="w-4 h-4 text-white" />
                                    </button>
                                  </div>
                                  <div className="relative">
                                    <Input
                                      value={form.cover_image_url}
                                      onChange={(e) =>
                                        onChange(
                                          "cover_image_url",
                                          e.target.value
                                        )
                                      }
                                      placeholder="https://..."
                                      className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
                                    />
                                  </div>
                                </div>
                              )}
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
                                    onClick={() =>
                                      setDescriptionMode("preview")
                                    }
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
                                      onChange(
                                        "event_description",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Add long description (markdown supported)"
                                    className="min-h-[300px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3 focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none resize-y"
                                  />
                                  <p className="text-xs text-gray-500 italic">
                                    *Full event description. Markdown formatting
                                    is supported.
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

                            {/* <div className="space-y-2">
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
                            </div> */}

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
                          className="mt-0 space-y-4 overflow-x-hidden px-2"
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

                        <TabsContent
                          value="schedule"
                          className="mt-0 overflow-x-hidden px-2"
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
                                  <p className="text-[14px] text-gray-500 max-w-full">
                                    Add day and events to display the event
                                    schedule
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
                                    <EventSearchInput
                                      value={scheduleForm.guests}
                                      onChange={(e) =>
                                        setScheduleForm((prev) => ({
                                          ...prev,
                                          guests: e.target.value,
                                        }))
                                      }
                                      placeholder="Search guests"
                                      inputClassName="h-[44px] rounded-[12px] pr-32 text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:border-[rgba(0,0,0,0.15)] focus:ring-2 focus:ring-blue-500 sm:text-[16px]"
                                      iconWrapperClassName="text-gray-600"
                                      rightAdornment={
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            className="whitespace-nowrap text-[14px] text-[#4b89ef] hover:underline"
                                          >
                                            Invite guest
                                          </button>
                                          <svg
                                            className="h-5 w-5 text-gray-400"
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
                                      }
                                    />
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

                        <TabsContent
                          value="resources"
                          className="mt-0 overflow-x-hidden px-2"
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
                                  <p className="text-[14px] text-gray-500 max-w-full">
                                    Resources will be shown as individual links
                                    on the event page.
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
                                            value={
                                              editingResourceForm.resourceName
                                            }
                                            onChange={(e) =>
                                              setEditingResourceForm(
                                                (prev) => ({
                                                  ...prev,
                                                  resourceName: e.target.value,
                                                })
                                              )
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
                                            value={
                                              editingResourceForm.resourceLink
                                            }
                                            onChange={(e) =>
                                              setEditingResourceForm(
                                                (prev) => ({
                                                  ...prev,
                                                  resourceLink: e.target.value,
                                                })
                                              )
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
                                      description:
                                        "Resource added successfully.",
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

                        <TabsContent
                          value="rules"
                          className="mt-0 overflow-x-hidden px-2"
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
                                  <p className="text-[14px] text-gray-500 max-w-full">
                                    Rules will be shown under the overview tab
                                    on the event page.
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
                                            if (
                                              !rulesForm.sectionTitle.trim()
                                            ) {
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
                          className="mt-0 overflow-x-hidden px-2"
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
                                  <p className="text-[14px] text-gray-500 max-w-full">
                                    Add questions and answers to help
                                    participants understand your event better.
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
                                                      answer:
                                                        editingFaqForm.answer,
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
                                              faqs.filter(
                                                (f) => f.id !== faq.id
                                              )
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
                          className="mt-0 overflow-x-hidden px-2"
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
                                  <p className="text-[14px] text-gray-500 max-w-full">
                                    Drop event images here or upload
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  onClick={() => {
                                    const input =
                                      document.createElement("input");
                                    input.type = "file";
                                    input.accept = "image/*";
                                    input.multiple = true;
                                    input.onchange = (e) => {
                                      const files = (
                                        e.target as HTMLInputElement
                                      ).files;
                                      if (files && files.length > 0) {
                                        const newImages = Array.from(files).map(
                                          (file) => ({
                                            id:
                                              Date.now().toString() +
                                              Math.random(),
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
                                          id:
                                            Date.now().toString() +
                                            Math.random(),
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
                      </div>

                      {/* Preview Card */}
                      <div className="flex-shrink-0 w-full md:w-[335px] md:max-w-[335px] overflow-x-hidden">
                        <div className="w-full bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] overflow-hidden">
                          {/* Image */}
                          <div className="relative w-full aspect-[335/223] overflow-hidden">
                            {form.cover_image_url ? (
                              <Image
                                src={form.cover_image_url}
                                alt="Event cover"
                                fill
                                className="object-cover"
                                unoptimized={form.cover_image_url.startsWith("http")}
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

                      </div>
                    </div>
                  </Tabs>
                </TabsContent>

                <TabsContent
                  value="access"
                  className="mt-0 overflow-x-hidden w-full"
                >
                  <div className="w-full min-w-0 space-y-6">
                    <Tabs
                      value={activeAccessSubTab}
                      onValueChange={setActiveAccessSubTab}
                      className="w-full"
                    >
                      <div className="w-full overflow-x-auto mb-6">
                        <TabsList className="inline-flex h-auto gap-2 bg-transparent p-0 rounded-full">
                          <TabsTrigger
                            value="password"
                            className="px-4 py-2 rounded-full text-sm font-normal text-black border border-transparent data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:shadow-sm flex-shrink-0"
                          >
                            Password
                          </TabsTrigger>
                          <TabsTrigger
                            value="role-labels"
                            className="px-4 py-2 rounded-full text-sm font-normal text-black border border-transparent data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:shadow-sm flex-shrink-0"
                          >
                            Role Labels
                          </TabsTrigger>
                          <TabsTrigger
                            value="invite-organizers"
                            className="px-4 py-2 rounded-full text-sm font-normal text-black border border-transparent data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:shadow-sm flex-shrink-0"
                          >
                            Invite Organizers
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      {/* Password Tab */}
                      <TabsContent value="password" className="mt-0">
                        <div className="space-y-6">
                      

                          {/* Role Passwords */}
                          <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
                            <h3 className="text-[18px] font-semibold text-black">
                              Role Passwords
                            </h3>
                            <div className="space-y-4">
                              {[
                                EventRole.Participant,
                                EventRole.Mentor,
                                EventRole.Judge,
                                EventRole.Organizer,
                              ].map((role) => {
                                const label = roleLabels[role] || role;
                                return (
                                  <div key={role} className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      {label} Password
                                    </label>
                                    <div className="flex gap-2">
                                      <div className="relative flex-1">
                                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                          type="password"
                                          value={rolePasswords[role] || ""}
                                          onChange={(e) =>
                                            setRolePasswords((prev) => ({
                                              ...prev,
                                              [role]: e.target.value,
                                            }))
                                          }
                                          placeholder={`Set ${label.toLowerCase()} password`}
                                          className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                        />
                                      </div>
                                      <Button
                                        onClick={() => {
                                          if (!rolePasswords[role]) {
                                            toast({
                                              title: "Password required",
                                              description:
                                                "Please enter a password.",
                                              variant: "destructive",
                                            });
                                            return;
                                          }
                                          toast({
                                            title: "Password saved",
                                            description: `${label} password saved successfully.`,
                                          });
                                          setRolePasswords((prev) => ({
                                            ...prev,
                                            [role]: "",
                                          }));
                                        }}
                                        disabled={!rolePasswords[role]}
                                        className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                                      >
                                        Save
                                      </Button>
                                    </div>
                                    <p className="text-[14px] text-gray-500">
                                      *This password will be used by{" "}
                                      {label.toLowerCase()}s to join the event.
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      {/* Role Labels Tab */}
                      <TabsContent value="role-labels" className="mt-0">
                        <div className="space-y-6">
                          <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
                            <h3 className="text-[18px] font-semibold text-black">
                              Customize Role Labels
                            </h3>
                            <p className="text-[16px] text-gray-500">
                              Customize how roles are labeled throughout the
                              platform. For example, you can change
                              &quot;Judge&quot; to &quot;Investor&quot; for a
                              demo day event.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[
                                EventRole.Participant,
                                EventRole.Mentor,
                                EventRole.Judge,
                                EventRole.Organizer,
                              ].map((role) => {
                                const defaultLabel =
                                  role === EventRole.Participant
                                    ? "Participant"
                                    : role === EventRole.Mentor
                                      ? "Mentor"
                                      : role === EventRole.Judge
                                        ? "Judge"
                                        : "Organizer";
                                return (
                                  <div key={role} className="space-y-2">
                                    <label className="text-[16px] font-normal text-black">
                                      {defaultLabel} Label
                                    </label>
                                    <div className="relative">
                                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                      <Input
                                        value={roleLabels[role] || defaultLabel}
                                        onChange={(e) =>
                                          setRoleLabels((prev) => ({
                                            ...prev,
                                            [role]: e.target.value,
                                          }))
                                        }
                                        placeholder={`Custom label for ${defaultLabel}`}
                                        className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                      />
                                    </div>
                                    <p className="text-[14px] text-gray-500">
                                      *Default: {defaultLabel}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex gap-3 justify-end pt-4">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setRoleLabels({
                                    [EventRole.Participant]: "Participant",
                                    [EventRole.Mentor]: "Mentor",
                                    [EventRole.Judge]: "Judge",
                                    [EventRole.Organizer]: "Organizer",
                                  });
                                  toast({
                                    title: "Reset to defaults",
                                    description:
                                      "Role labels reset to default values.",
                                  });
                                }}
                                className="border border-[rgba(0,0,0,0.15)] bg-white"
                              >
                                Reset to default
                              </Button>
                              <Button
                                onClick={() => {
                                  toast({
                                    title: "Labels saved",
                                    description:
                                      "Role labels saved successfully.",
                                  });
                                }}
                                className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                              >
                                Save labels
                              </Button>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      {/* Invite Organizers Tab */}
                      <TabsContent value="invite-organizers" className="mt-0">
                        <div className="space-y-4">
                          <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
                            <h3 className="text-[18px] font-semibold text-black">
                              Invite organizers
                            </h3>
                            <div className="space-y-2">
                              <label className="text-[16px] font-normal text-black">
                                Add organizer
                              </label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <Input
                                  type="email"
                                  value={organizerEmailInput}
                                  onChange={(e) =>
                                    setOrganizerEmailInput(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (
                                      e.key === "Enter" &&
                                      organizerEmailInput.trim()
                                    ) {
                                      const emails = organizerEmailInput
                                        .split(",")
                                        .map((e) => e.trim())
                                        .filter(Boolean);
                                      setOrganizerEmails([
                                        ...organizerEmails,
                                        ...emails,
                                      ]);
                                      setOrganizerEmailInput("");
                                    }
                                  }}
                                  placeholder="Separate emails with , and hit enter or click the send invite button"
                                  className="pl-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] h-[44px]"
                                />
                              </div>
                              <p className="text-[14px] text-gray-500">
                                *Invitee will receive an email notification with
                                access instructions.
                              </p>
                            </div>

                            {organizerEmails.length > 0 && (
                              <div className="space-y-2 pt-4 border-t border-[rgba(0,0,0,0.15)]">
                                {organizerEmails.map((email, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-[8px]"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                        <User className="w-5 h-5 text-gray-600" />
                                      </div>
                                      <div>
                                        <p className="text-[16px] font-medium text-black">
                                          {email}
                                        </p>
                                        <p className="text-[14px] text-gray-500">
                                          {email}
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setOrganizerEmails(
                                          organizerEmails.filter(
                                            (_, i) => i !== index
                                          )
                                        );
                                      }}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <Button
                              onClick={() => {
                                if (!organizerEmailInput.trim()) {
                                  toast({
                                    title: "Email required",
                                    description:
                                      "Please enter an email address.",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                const emails = organizerEmailInput
                                  .split(",")
                                  .map((e) => e.trim())
                                  .filter(Boolean);
                                setOrganizerEmails([
                                  ...organizerEmails,
                                  ...emails,
                                ]);
                                setOrganizerEmailInput("");
                                toast({
                                  title: "Invitation sent",
                                  description: `Invitation sent to ${emails.length} organizer(s).`,
                                });
                              }}
                              className="w-full bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Send invite
                            </Button>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
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
              </div>
            </div>
          </Tabs>
      </div>

      {/* Request Public Event Modal */}
      <AlertDialog open={showApprovalModal} onOpenChange={handleModalClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Public Event</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to request that this event be featured on the home page? 
              You can always request this later from the event settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipApproval}>
              Skip
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitForApproval}
              className="bg-[#4b89ef] hover:bg-[#4b89ef]/90"
            >
              Request Approval
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

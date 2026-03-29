"use client";

import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Project,
  EventRole,
  ProjectBoardContext,
  EventDetails,
  EventVisibility,
} from "@/lib/types";
import { EventCard } from "@/components/events/event-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Camera,
  GraduationCap,
  Phone,
} from "lucide-react";
import {
  FaLinkedin,
  FaGithub,
  FaXTwitter,
  FaFacebook,
  FaInstagram,
  FaYoutube,
} from "react-icons/fa6";
import Link from "next/link";
import ProjectBoard from "@/features/projects/components/displays/ProjectBoard/ProjectBoard";
import { motion } from "framer-motion";
import { useToast } from "@/lib/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { getRoleLabel } from "@/features/user/roles/roles";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { z } from "zod";
import { profileAvatarInitialsLora } from "@/lib/fonts/profile-avatar-initials";

// Interface for events with role information
interface EventWithRole extends EventDetails {
  user_event_roles: {
    role: EventRole;
  }[];
}

// Validation schemas (matching server-side validation)
const SocialLinksSchema = z
  .object({
    linkedin: z
      .string()
      .url("Invalid LinkedIn URL")
      .optional()
      .or(z.literal("")),
    github: z.string().url("Invalid GitHub URL").optional().or(z.literal("")),
    twitter: z.string().url("Invalid Twitter URL").optional().or(z.literal("")),
    facebook: z
      .string()
      .url("Invalid Facebook URL")
      .optional()
      .or(z.literal("")),
    instagram: z
      .string()
      .url("Invalid Instagram URL")
      .optional()
      .or(z.literal("")),
    youtube: z.string().url("Invalid YouTube URL").optional().or(z.literal("")),
    portfolio: z
      .string()
      .url("Invalid Portfolio URL")
      .optional()
      .or(z.literal("")),
  })
  .partial();

const ProfileUpdateSchema = z.object({
  display_name: z
    .string()
    .min(1, "Display name is required")
    .max(100, "Display name must be less than 100 characters")
    .optional(),
  bio: z
    .string()
    .max(500, "Bio must be less than 500 characters")
    .optional()
    .or(z.literal("")),
  // Stored in DB as `user_profiles.affiliation` (shown in UI as "School / Company")
  affiliation: z
    .string()
    .max(200, "Affiliation must be less than 200 characters")
    .optional()
    .or(z.literal("")),
  // Stored in DB as `user_phone_numbers.phone_number` (should not be shown publicly)
  phone_number: z
    .string()
    .max(50, "Phone number must be less than 50 characters")
    .optional()
    .or(z.literal("")),
  links: SocialLinksSchema.optional(),
});

// Interface for social media links
interface SocialLinks {
  linkedin?: string;
  github?: string;
  twitter?: string;
  portfolio?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
}

// Interface for projects with track information
interface ProjectWithTracks extends Project {
  project_tracks: {
    event_tracks: {
      track_id: string;
      name: string;
    }[];
  }[];
}

// Tab definitions for the profile page
/** Default profile header when user has not uploaded a cover (static asset). */
const PROFILE_DEFAULT_COVER_SRC = "/img/profile-default-cover.png";

const PROFILE_TABS = {
  PROJECTS: "projects",
  EVENTS: "events",
} as const;

type ProfileTab = (typeof PROFILE_TABS)[keyof typeof PROFILE_TABS];

function roleBadgeVariant(role: EventRole): EventRole {
  switch (role) {
    case EventRole.Admin:
      return EventRole.Admin;
    case EventRole.Organizer:
      return EventRole.Organizer;
    case EventRole.Judge:
      return EventRole.Judge;
    case EventRole.Mentor:
      return EventRole.Mentor;
    case EventRole.Participant:
      return EventRole.Participant;
    default:
      return EventRole.Participant;
  }
}

export default function ProfilePage() {
  const { userId } = useParams();
  const searchParams = useSearchParams();
  const editParam = searchParams.get("edit");

  // We only want to auto-open the edit modal ONCE, even if state changes later.
  const hasAutoOpenedEditModalRef = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{
    display_name: string | null;
    email: string | null;
    links: SocialLinks | null;
    bio?: string | null;
    avatar_url?: string | null;
    cover_image_url?: string | null;
    affiliation?: string | null;
    phone_number?: string | null;
  } | null>(null);
  const [events, setEvents] = useState<EventWithRole[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [newSocialLinks, setNewSocialLinks] = useState<SocialLinks>({});
  const [newBio, setNewBio] = useState("");
  const [newAffiliation, setNewAffiliation] = useState("");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ProfileTab>(PROFILE_TABS.PROJECTS);
  const [isProfileAdmin, setIsProfileAdmin] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  // Keep the profile's project list in sync after deletions from the gallery
  const handleProjectDeleted = (projectId: string) => {
    setProjects((prevProjects) =>
      prevProjects.filter((project) => project.id !== projectId)
    );
  };

  // Check if the current user is viewing their own profile
  const isOwnProfile = session?.user?.id === userId;

  // "Minimum required" fields to consider the profile complete.
  // These power the checklist UI inside the edit modal.
  const requiredChecklist = [
    {
      key: "affiliation",
      label: "School / Company",
      isComplete: newAffiliation.trim().length > 0,
    },
    {
      key: "phone_number",
      label: "Phone number (private)",
      isComplete: newPhoneNumber.trim().length > 0,
    },
    {
      key: "linkedin",
      label: "LinkedIn URL",
      isComplete: (newSocialLinks.linkedin ?? "").trim().length > 0,
    },
  ] as const;

  const missingRequiredCount = requiredChecklist.filter(
    (item) => !item.isComplete
  ).length;

  // If we navigate to `/profile/:id?edit=1`, auto-open the edit modal.
  // This is used by the navbar "Complete your profile" notification.
  useEffect(() => {
    const shouldAutoOpen = editParam === "1" || editParam === "true";

    if (
      !hasAutoOpenedEditModalRef.current &&
      shouldAutoOpen &&
      isOwnProfile &&
      !isLoading
    ) {
      setIsEditingLinks(true);
      hasAutoOpenedEditModalRef.current = true;
    }
  }, [editParam, isOwnProfile, isLoading]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        setSession(session);

        // Fetch user profile and projects
        const response = await fetch(`/api/users/${userId}/profile`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Profile fetch error:", errorData);
          throw new Error(
            errorData.details ||
              errorData.error ||
              "Failed to fetch profile data"
          );
        }
        const profileData = await response.json();

        // Set profile data
        setUserProfile(profileData.profile);
        setNewSocialLinks(profileData.profile.links || {});
        setNewAffiliation(profileData.profile.affiliation || "");
        setNewPhoneNumber(profileData.profile.phone_number || "");

        const projectsData: { projects: ProjectWithTracks[] } = {
          projects: profileData.projects,
        };

        // Combine and deduplicate projects
        const allProjects = [...(projectsData.projects || [])]
          .filter(
            (project, index, self) =>
              index === self.findIndex((p) => p.id === project.id)
          )
          .map((project) => ({
            id: project.id,
            project_name: project.project_name,
            project_description: project.project_description,
            lead_name: project.lead_name,
            lead_email: project.lead_email,
            teammates: project.teammates,
            project_url: project.project_url,
            cover_image_url: project.cover_image_url,
            event_id: project.event_id,
            created_at: project.created_at,
            prizes_won: project.prizes_won,
            track_ids:
              project.project_tracks
                ?.map((pt) => pt.event_tracks?.[0]?.track_id)
                .filter(Boolean) || [],
            tracks:
              project.project_tracks
                ?.map((pt) => ({
                  track_id: pt.event_tracks?.[0]?.track_id || "",
                  name: pt.event_tracks?.[0]?.name || "",
                  event_id: project.event_id,
                  description: "",
                  scoring_criteria: {
                    name: pt.event_tracks?.[0]?.name || "",
                    criteria: [],
                  },
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }))
                .filter(Boolean) || [],
            submitted: project.submitted,
          }));

        // Set events and projects from API response
        setEvents(profileData.events || []);
        setProjects(allProjects);

        // Check if the profile user is an admin (global)
        const { data: adminCheckData, error: adminCheckError } =
          await supabase.rpc("is_admin_user", { user_id: String(userId) });
        if (adminCheckError) {
          console.error("Error checking admin status:", adminCheckError);
        }
        setIsProfileAdmin(Boolean(adminCheckData));
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const handleUpdateDisplayName = async () => {
    if (!newDisplayName.trim()) return;

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ display_name: newDisplayName })
        .eq("uid", userId);

      if (error) throw error;

      toast({
        title: "Display name updated",
        description: "Your display name has been updated successfully",
      });
      setUserProfile((prev) =>
        prev ? { ...prev, display_name: newDisplayName } : null
      );
      setIsEditing(false);
    } catch (error) {
      toast({
        title: "Error updating display name",
        description: "Please try again later",
        variant: "destructive",
      });
      console.error("Error updating display name:", error);
    }
  };

  const handleUpdateProfile = async () => {
    // Clear previous validation errors
    setIsSaving(true);
    setValidationErrors({});

    // Prepare data for validation
    const updateData = {
      display_name: newDisplayName || undefined,
      bio: newBio || undefined,
      affiliation: newAffiliation || undefined,
      phone_number: newPhoneNumber || undefined,
      links: Object.fromEntries(
        Object.entries(newSocialLinks).filter(
          ([, value]) => value && value.trim() !== ""
        )
      ),
    };

    // Client-side validation
    const validationResult = ProfileUpdateSchema.safeParse(updateData);
    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      validationResult.error.errors.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      setValidationErrors(errors);

      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      });
      return;
    }

    try {
      // Use the PATCH API endpoint for profile updates
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          display_name: newDisplayName || undefined,
          links: newSocialLinks,
          bio: newBio || null,
          // Empty string should clear the DB field, so send null.
          affiliation: newAffiliation || null,
          // Empty string should clear the DB field, so send null.
          phone_number: newPhoneNumber || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle server-side validation errors
        if (errorData.details) {
          const errors: Record<string, string> = {};
          errorData.details.forEach(
            (err: { path: string[]; message: string }) => {
              const path = err.path.join(".");
              errors[path] = err.message;
            }
          );
          setValidationErrors(errors);
        }

        throw new Error(errorData.error || "Failed to update profile");
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              display_name: newDisplayName,
              links: newSocialLinks,
              bio: newBio,
              affiliation: newAffiliation || null,
              phone_number: newPhoneNumber || null,
            }
          : null
      );
      setIsEditingLinks(false);
      setValidationErrors({});
      setIsSaving(false);
    } catch (error) {
      toast({
        title: "Error updating profile",
        description:
          error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
      console.error("Error updating profile:", error);
      setIsSaving(false);
    }
  };

  // Handle avatar file selection
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 5MB",
          variant: "destructive",
        });
        return;
      }
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle avatar upload
  const handleAvatarUpload = async (file: File) => {
    if (!userId || !session?.user?.id) return;

    setIsUploadingAvatar(true);
    try {
      // Generate unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("profile-images")
        .getPublicUrl(filePath);

      const avatarUrl = urlData.publicUrl;

      // Update user profile with new avatar URL
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ avatar_url: avatarUrl })
        .eq("uid", userId);

      if (updateError) throw updateError;

      // Update local state
      setUserProfile((prev) =>
        prev ? { ...prev, avatar_url: avatarUrl } : null
      );

      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated",
      });

      setAvatarPreview(null);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle share profile
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied!",
        description: "Profile link has been copied to clipboard",
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy the URL manually",
        variant: "destructive",
      });
    }
  };

  // Get initials for avatar fallback
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if user has any social links
  const hasSocialLinks =
    userProfile?.links &&
    (userProfile.links.linkedin ||
      userProfile.links.github ||
      userProfile.links.twitter ||
      userProfile.links.facebook ||
      userProfile.links.instagram ||
      userProfile.links.youtube ||
      userProfile.links.portfolio);

  // Loading state - show skeleton UI while fetching profile
  if (isLoading) {
    return (
      <PageContainer
        showBorder={false}
        className="!min-h-0 h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-hidden"
      >
        <PageContent className="min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 w-full flex-1 flex-col animate-pulse">
            <div className="shrink-0">
              {/* Cover Image Skeleton */}
              <div className="relative h-[133px] md:h-[160px] w-full rounded-tl-2xl overflow-hidden bg-gray-200" />

              {/* Profile Header Skeleton */}
              <div
                className="relative px-6 md:px-8 pb-6"
                style={{
                  background:
                    "linear-gradient(180deg, #DBEAFE 13.19%, rgba(255, 255, 255, 0) 65.83%), #FFF",
                }}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
                  {/* Avatar Skeleton */}
                  <div className="-mt-16 shrink-0 md:-mt-20">
                    <div
                      className="flex h-32 w-32 shrink-0 flex-col items-center justify-center self-stretch rounded-full border border-[rgba(0,0,0,0.08)] bg-[#F5F5F5] py-[21px] shadow-[0_20px_24px_-4px_rgba(10,13,18,0.08),0_8px_8px_-4px_rgba(10,13,18,0.03),0_3px_3px_-1.5px_rgba(10,13,18,0.04)] ring-4 ring-white md:h-40 md:w-40"
                      aria-hidden
                    />
                  </div>

                  {/* Profile Info Skeleton */}
                  <div className="flex w-full min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex flex-col gap-2">
                      <div className="h-8 w-48 bg-gray-300 rounded-lg" />
                      <div className="h-5 w-64 bg-gray-200 rounded" />
                    </div>
                    <div className="flex gap-3">
                      <div className="h-10 w-20 bg-gray-200 rounded-xl" />
                      <div className="h-10 w-20 bg-gray-200 rounded-xl" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs Skeleton */}
              <div className="border-b border-gray-100 bg-white px-6">
                <div className="flex gap-6 py-3">
                  <div className="h-6 w-20 bg-gray-200 rounded" />
                  <div className="h-6 w-16 bg-gray-200 rounded" />
                </div>
              </div>
            </div>

            {/* Content Skeleton — only this region scrolls */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain border-0 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-gray-200 overflow-hidden"
                  >
                    <div className="h-48 bg-gray-200" />
                    <div className="p-4 space-y-3">
                      <div className="h-6 w-3/4 bg-gray-200 rounded" />
                      <div className="h-4 w-full bg-gray-100 rounded" />
                      <div className="h-4 w-2/3 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PageContent>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      showBorder={false}
      className="!min-h-0 h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-hidden"
    >
      <PageContent className="min-h-0 flex-1 overflow-hidden">
        <Toaster />

        {/* Main: fixed header (cover + profile + tabs), scroll only tab panel */}
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <div className="shrink-0">
            {/* Cover Image Section */}
            <div className="relative h-[133px] md:h-[160px] w-full rounded-tl-2xl overflow-hidden">
            {userProfile?.cover_image_url ? (
              <div
                className="w-full h-full"
                style={{
                  background: `url(${userProfile.cover_image_url}) center / cover no-repeat, linear-gradient(90deg, #559DFB 0%, #FD9FA4 100%)`,
                }}
              />
            ) : (
              <div
                className="w-full h-full bg-sky-100"
                style={{
                  backgroundImage: `url(${PROFILE_DEFAULT_COVER_SRC})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
              />
            )}
            </div>

            {/* Profile Header Section */}
            <div
            className="relative px-6 md:px-8 pb-6"
            style={{
              background:
                "linear-gradient(180deg, #DBEAFE 13.19%, rgba(255, 255, 255, 0) 65.83%), #FFF",
            }}
          >
            {/* Avatar and Info Row — md: bottom-align name/email with avatar circle */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
              {/* Avatar column (overlap cover + optional crop confirm) */}
              <div className="flex shrink-0 flex-col items-start gap-2 -mt-16 md:-mt-20">
                <div className="relative group">
                  <Avatar className="h-32 w-32 shrink-0 rounded-full border border-[rgba(0,0,0,0.08)] shadow-[0_20px_24px_-4px_rgba(10,13,18,0.08),0_8px_8px_-4px_rgba(10,13,18,0.03),0_3px_3px_-1.5px_rgba(10,13,18,0.04)] ring-4 ring-white md:h-40 md:w-40">
                    <AvatarImage
                      src={avatarPreview || userProfile?.avatar_url || undefined}
                      alt={userProfile?.display_name || "User"}
                    />
                    <AvatarFallback className="flex h-full w-full min-h-0 flex-[1_0_0] flex-col items-center justify-center self-stretch bg-[#F5F5F5] py-[14px] text-center text-[44px] font-semibold leading-[52px] tracking-[-0.88px] text-[#717680] md:py-[18px] md:text-[52px] md:leading-[60px] md:tracking-[-1.04px]">
                      <span
                        className={`inline-block w-[120px] max-w-full md:w-[140px] ${profileAvatarInitialsLora.className}`}
                      >
                        {getInitials(userProfile?.display_name)}
                      </span>
                    </AvatarFallback>
                  </Avatar>

                  {isOwnProfile && (
                    <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarSelect}
                        className="hidden"
                        disabled={isUploadingAvatar}
                      />
                      <Camera className="h-8 w-8 text-white" />
                    </label>
                  )}

                  {isUploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  )}
                </div>

                {avatarPreview && !isUploadingAvatar && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        const input = document.querySelector(
                          'input[type="file"]'
                        ) as HTMLInputElement;
                        const file = input?.files?.[0];
                        if (file) {
                          await handleAvatarUpload(file);
                        }
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAvatarPreview(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {/* Profile Info and Actions */}
              <div className="flex w-full min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-end md:justify-between">
                {/* Name, email, admin badge */}
                <div className="flex flex-col gap-1 md:min-h-0">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className="text-2xl font-semibold"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleUpdateDisplayName();
                          } else if (e.key === "Escape") {
                            setIsEditing(false);
                          }
                        }}
                        autoFocus
                      />
                      <Button size="sm" onClick={handleUpdateDisplayName}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <h1 className="font-geist text-2xl md:text-[28px] font-semibold tracking-tight text-black">
                        {userProfile?.display_name || "User Profile"}
                      </h1>
                      {/* Admin badge - only shown for admins */}
                      {isProfileAdmin && <Badge variant="admin">Admin</Badge>}
                    </div>
                  )}
                  <p className="text-base text-gray-600">
                    {userProfile?.bio || userProfile?.email || ""}
                  </p>
                  {/* Phone number (private: only visible to the profile owner) */}
                  {isOwnProfile && userProfile?.phone_number && (
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {userProfile.phone_number}
                    </p>
                  )}
                </div>

                {/* Social Links and Action Buttons */}
                <div className="flex flex-col gap-4 items-start md:items-end">
                  {/* Social Links Row */}
                  {hasSocialLinks && (
                    <div className="flex gap-3 items-center">
                      {userProfile?.links?.facebook && (
                        <a
                          href={userProfile.links.facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-black hover:text-gray-600 transition-colors"
                        >
                          <FaFacebook className="w-5 h-5 md:w-6 md:h-6" />
                        </a>
                      )}
                      {userProfile?.links?.instagram && (
                        <a
                          href={userProfile.links.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-black hover:text-gray-600 transition-colors"
                        >
                          <FaInstagram className="w-5 h-5 md:w-6 md:h-6" />
                        </a>
                      )}
                      {userProfile?.links?.twitter && (
                        <a
                          href={userProfile.links.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-black hover:text-gray-600 transition-colors"
                        >
                          <FaXTwitter className="w-5 h-5 md:w-6 md:h-6" />
                        </a>
                      )}
                      {userProfile?.links?.linkedin && (
                        <a
                          href={userProfile.links.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-black hover:text-gray-600 transition-colors"
                        >
                          <FaLinkedin className="w-5 h-5 md:w-6 md:h-6" />
                        </a>
                      )}
                      {userProfile?.links?.youtube && (
                        <a
                          href={userProfile.links.youtube}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-black hover:text-gray-600 transition-colors"
                        >
                          <FaYoutube className="w-5 h-5 md:w-6 md:h-6" />
                        </a>
                      )}
                      {userProfile?.links?.github && (
                        <a
                          href={userProfile.links.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-black hover:text-gray-600 transition-colors"
                        >
                          <FaGithub className="w-5 h-5 md:w-6 md:h-6" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Action Buttons Row */}
                  <div className="flex gap-2 items-center">
                    {isOwnProfile && (
                      <button
                        onClick={() => {
                          setIsEditingLinks(true);
                          setNewSocialLinks(userProfile?.links || {});
                          setNewBio(userProfile?.bio || "");
                          setNewAffiliation(userProfile?.affiliation || "");
                          setNewPhoneNumber(userProfile?.phone_number || "");
                          setNewDisplayName(userProfile?.display_name || "");
                          setValidationErrors({});
                        }}
                        className="flex items-center gap-1.5 px-5 py-2 text-base font-medium text-black hover:text-gray-600 transition-colors rounded-xl"
                      >
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Edit
                      </button>
                    )}
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-1.5 px-5 py-2 text-base font-medium text-black hover:text-gray-600 transition-colors rounded-xl"
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M4 12V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V12"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <polyline
                          points="16,6 12,2 8,6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <line
                          x1="12"
                          y1="2"
                          x2="12"
                          y2="15"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Share
                    </button>
                    {!isOwnProfile && (
                      <button className="px-5 py-2 bg-[#4b89ef] hover:bg-[#3d7ce0] text-white text-base font-medium rounded-xl transition-colors shadow-[inset_0_32px_24px_0_rgba(255,255,255,0.05),inset_0_2px_1px_0_rgba(255,255,255,0.25),inset_0_0_0_1px_rgba(0,0,0,0.15),inset_0_-2px_1px_0_rgba(0,0,0,0.2),0_1px_2px_0_rgba(0,0,0,0.05)]">
                        Follow
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* Tabs Section */}
            <div className="border-b border-gray-100 bg-white px-6">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab(PROFILE_TABS.PROJECTS)}
                className={`py-2 px-1 text-base font-medium transition-colors relative ${
                  activeTab === PROFILE_TABS.PROJECTS
                    ? "text-black"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Projects
                {activeTab === PROFILE_TABS.PROJECTS && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4b89ef]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab(PROFILE_TABS.EVENTS)}
                className={`py-2 px-1 text-base transition-colors relative ${
                  activeTab === PROFILE_TABS.EVENTS
                    ? "text-black font-medium"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Events
                {activeTab === PROFILE_TABS.EVENTS && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4b89ef]" />
                )}
              </button>
            </div>
            </div>
          </div>

          {/* Tab content — scrolls independently */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain border-0 p-6">
            {activeTab === PROFILE_TABS.PROJECTS && (
              <div>
                {isLoading ? (
                  <div className="flex justify-center items-center py-12 w-full">
                    <Loader2 className="h-10 w-10 animate-spin text-[#4b89ef]" />
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No projects found.</p>
                  </div>
                ) : (
                  <ProjectBoard
                    isLoading={isLoading}
                    projectList={projects}
                    session={session ?? undefined}
                    projectBoardContext={
                      isOwnProfile
                        ? ProjectBoardContext.MyProjects
                        : ProjectBoardContext.EventGallery
                    }
                    onProjectDeleted={handleProjectDeleted}
                  />
                )}
              </div>
            )}

            {activeTab === PROFILE_TABS.EVENTS && (
              <div>
                {isLoading ? (
                  <div className="flex justify-center items-center py-12 w-full">
                    <Loader2 className="h-10 w-10 animate-spin text-[#4b89ef]" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No events found.</p>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="grid w-full grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,280px),339px))] sm:justify-start sm:gap-x-4 sm:gap-y-5 auto-rows-fr"
                  >
                    {events.map((event) => {
                      const profileRole = event.user_event_roles?.[0]?.role;
                      return (
                        <div
                          key={event.event_id}
                          className="relative h-full w-full max-w-[339px] justify-self-center sm:max-w-none sm:justify-self-stretch"
                        >
                          <EventCard event={event} />
                          {profileRole ? (
                            <div className="absolute top-3 left-3 z-10">
                              <Badge
                                variant={roleBadgeVariant(
                                  profileRole as EventRole
                                )}
                                className="capitalize text-xs"
                              >
                                {getRoleLabel(
                                  profileRole as EventRole,
                                  event.role_labels
                                )}
                              </Badge>
                            </div>
                          ) : null}
                          {event.visibility === EventVisibility.Archived ? (
                            <div className="absolute top-3 right-3 z-10">
                              <Badge
                                variant="secondary"
                                className="bg-orange-100 text-orange-800 text-xs"
                              >
                                📁 Archived
                              </Badge>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Edit Profile Modal - Figma Design */}
        {isEditingLinks && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-[#e4e4e7] rounded-xl w-full max-w-[623px] max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between px-6 pt-6 pb-3">
                <h2 className="font-geist font-semibold text-[22px] text-[#18181b] tracking-[-0.06em]">
                  Edit profile
                </h2>
                <button
                  onClick={() => {
                    setIsEditingLinks(false);
                    setAvatarPreview(null);
                    setValidationErrors({});
                  }}
                  className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M18 6L6 18M6 6L18 18"
                      stroke="black"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-6 pb-6 space-y-6 max-h-[calc(90vh-180px)] overflow-y-auto">
                {/* Minimum required checklist (so users know what to fill out) */}
                <div className="rounded-xl border border-black/10 bg-[#E5F0FE] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[14px] font-medium text-zinc-900">
                      Minimum required to complete your profile
                    </p>
                    <span className="text-[12px] text-zinc-700 bg-white/70 border border-black/10 rounded-full px-2 py-0.5">
                      {missingRequiredCount === 0
                        ? "All set"
                        : `${missingRequiredCount} missing`}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {requiredChecklist.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center gap-2 text-[13px]"
                      >
                        {item.isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-zinc-400" />
                        )}
                        <span
                          className={
                            item.isComplete
                              ? "text-zinc-900"
                              : "text-zinc-700"
                          }
                        >
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[12px] text-zinc-600">
                    These are the fields we use for the profile completion
                    notification.
                  </p>
                </div>

                {/* Profile Image */}
                <div className="space-y-2">
                  <label className="text-base text-black">Profile image</label>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage
                        src={
                          avatarPreview || userProfile?.avatar_url || undefined
                        }
                        alt={userProfile?.display_name || "User"}
                      />
                      <AvatarFallback className="bg-gray-200 text-sm">
                        {getInitials(userProfile?.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 h-11 bg-white border border-black/15 rounded-xl flex items-center px-3 gap-3">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="18"
                          height="18"
                          rx="2"
                          stroke="black"
                          strokeWidth="2"
                        />
                        <circle cx="8.5" cy="8.5" r="1.5" fill="black" />
                        <path
                          d="M21 15L16 10L5 21"
                          stroke="black"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="flex-1 text-base text-black/60 truncate">
                        {avatarPreview ? "New image selected" : "https://..."}
                      </span>
                      <label className="bg-black/5 hover:bg-black/10 px-3 py-1 rounded-xl text-xs font-normal cursor-pointer transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarSelect}
                          className="hidden"
                          disabled={isUploadingAvatar}
                        />
                        {isUploadingAvatar ? "..." : "Upload"}
                      </label>
                    </div>
                  </div>
                  {avatarPreview && !isUploadingAvatar && (
                    <div className="flex gap-2 ml-[52px]">
                      <button
                        onClick={async () => {
                          const input = document.querySelector(
                            'input[type="file"]'
                          ) as HTMLInputElement;
                          const file = input?.files?.[0];
                          if (file) await handleAvatarUpload(file);
                        }}
                        className="text-sm text-[#4b89ef] hover:underline"
                      >
                        Save image
                      </button>
                      <button
                        onClick={() => setAvatarPreview(null)}
                        className="text-sm text-gray-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <label className="text-base text-black">Name</label>
                  <div
                    className={`h-11 bg-white border rounded-xl flex items-center px-3 gap-3 ${
                      validationErrors.display_name
                        ? "border-red-500"
                        : "border-black/15"
                    }`}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 7V4H20V7"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 20H15"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 4V20"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={newDisplayName}
                      onChange={(e) => {
                        setNewDisplayName(e.target.value);
                        // Clear error on change
                        if (validationErrors.display_name) {
                          setValidationErrors((prev) => {
                            const newErrors = { ...prev };
                            delete newErrors.display_name;
                            return newErrors;
                          });
                        }
                      }}
                      className="flex-1 text-base bg-transparent outline-none placeholder:text-black/60"
                    />
                  </div>
                  {validationErrors.display_name && (
                    <p className="text-sm text-red-500">
                      {validationErrors.display_name}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-base text-black">Description</label>
                  <div
                    className={`h-11 bg-white border rounded-xl flex items-center px-3 gap-3 ${
                      validationErrors.bio
                        ? "border-red-500"
                        : "border-black/15"
                    }`}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 7V4H20V7"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 20H15"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 4V20"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <input
                      type="text"
                      placeholder="Short description shown in your profile page"
                      value={newBio}
                      onChange={(e) => {
                        setNewBio(e.target.value);
                        // Clear error on change
                        if (validationErrors.bio) {
                          setValidationErrors((prev) => {
                            const newErrors = { ...prev };
                            delete newErrors.bio;
                            return newErrors;
                          });
                        }
                      }}
                      maxLength={500}
                      className="flex-1 text-base bg-transparent outline-none placeholder:text-black/60"
                    />
                  </div>
                  {validationErrors.bio && (
                    <p className="text-sm text-red-500">
                      {validationErrors.bio}
                    </p>
                  )}
                </div>

                {/* School / Company */}
                <div className="space-y-2">
                  <label className="text-base text-black">
                    School / Company{" "}
                    <span className="text-[12px] text-zinc-600">(required)</span>
                  </label>
                  <div
                    className={`h-11 bg-white border rounded-xl flex items-center px-3 gap-3 ${
                      validationErrors.affiliation
                        ? "border-red-500"
                        : "border-black/15"
                    }`}
                  >
                    <GraduationCap className="w-6 h-6 text-black" />
                    <input
                      type="text"
                      placeholder="School, university, or company"
                      value={newAffiliation}
                      onChange={(e) => {
                        setNewAffiliation(e.target.value);
                        // Clear error on change
                        if (validationErrors.affiliation) {
                          setValidationErrors((prev) => {
                            const newErrors = { ...prev };
                            delete newErrors.affiliation;
                            return newErrors;
                          });
                        }
                      }}
                      maxLength={200}
                      className="flex-1 text-base bg-transparent outline-none placeholder:text-black/60"
                    />
                  </div>
                  {validationErrors.affiliation && (
                    <p className="text-sm text-red-500">
                      {validationErrors.affiliation}
                    </p>
                  )}
                </div>

                {/* Phone (private) */}
                <div className="space-y-2">
                  <label className="text-base text-black">
                    Phone number (private){" "}
                    <span className="text-[12px] text-zinc-600">(required)</span>
                  </label>
                  <div
                    className={`h-11 bg-white border rounded-xl flex items-center px-3 gap-3 ${
                      validationErrors.phone_number
                        ? "border-red-500"
                        : "border-black/15"
                    }`}
                  >
                    <Phone className="w-6 h-6 text-black" />
                    <input
                      type="tel"
                      placeholder="+1 555 555 5555"
                      value={newPhoneNumber}
                      onChange={(e) => {
                        setNewPhoneNumber(e.target.value);
                        // Clear error on change
                        if (validationErrors.phone_number) {
                          setValidationErrors((prev) => {
                            const newErrors = { ...prev };
                            delete newErrors.phone_number;
                            return newErrors;
                          });
                        }
                      }}
                      maxLength={50}
                      className="flex-1 text-base bg-transparent outline-none placeholder:text-black/60"
                    />
                  </div>
                  {validationErrors.phone_number && (
                    <p className="text-sm text-red-500">
                      {validationErrors.phone_number}
                    </p>
                  )}
                </div>

                {/* Socials */}
                <div className="space-y-2">
                  <label className="text-base text-black">Socials</label>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[12px] text-zinc-600 mb-1">
                        LinkedIn{" "}
                        <span className="text-[12px] text-zinc-600">
                          (required)
                        </span>
                      </p>
                      <div
                        className={`h-11 bg-white border rounded-xl flex items-center px-3 gap-3 ${
                          validationErrors["links.linkedin"]
                            ? "border-red-500"
                            : "border-black/15"
                        }`}
                      >
                        <FaLinkedin className="w-6 h-6 text-black" />
                        <input
                          type="url"
                          placeholder="LinkedIn Profile URL"
                          value={newSocialLinks.linkedin || ""}
                          onChange={(e) => {
                            setNewSocialLinks((prev) => ({
                              ...prev,
                              linkedin: e.target.value || undefined,
                            }));
                            // Clear error on change
                            if (validationErrors["links.linkedin"]) {
                              setValidationErrors((prev) => {
                                const newErrors = { ...prev };
                                delete newErrors["links.linkedin"];
                                return newErrors;
                              });
                            }
                          }}
                          className="flex-1 text-base bg-transparent outline-none placeholder:text-black/60"
                        />
                      </div>
                      {validationErrors["links.linkedin"] && (
                        <p className="text-sm text-red-500 mt-1">
                          {validationErrors["links.linkedin"]}
                        </p>
                      )}
                    </div>
                    <div>
                      <div
                        className={`h-11 bg-white border rounded-xl flex items-center px-3 gap-3 ${
                          validationErrors["links.github"]
                            ? "border-red-500"
                            : "border-black/15"
                        }`}
                      >
                        <FaGithub className="w-6 h-6 text-black" />
                        <input
                          type="url"
                          placeholder="GitHub Profile URL"
                          value={newSocialLinks.github || ""}
                          onChange={(e) => {
                            setNewSocialLinks((prev) => ({
                              ...prev,
                              github: e.target.value || undefined,
                            }));
                            // Clear error on change
                            if (validationErrors["links.github"]) {
                              setValidationErrors((prev) => {
                                const newErrors = { ...prev };
                                delete newErrors["links.github"];
                                return newErrors;
                              });
                            }
                          }}
                          className="flex-1 text-base bg-transparent outline-none placeholder:text-black/60"
                        />
                      </div>
                      {validationErrors["links.github"] && (
                        <p className="text-sm text-red-500 mt-1">
                          {validationErrors["links.github"]}
                        </p>
                      )}
                    </div>
                    <div>
                      <div
                        className={`h-11 bg-white border rounded-xl flex items-center px-3 gap-3 ${
                          validationErrors["links.twitter"]
                            ? "border-red-500"
                            : "border-black/15"
                        }`}
                      >
                        <FaXTwitter className="w-6 h-6 text-black" />
                        <input
                          type="url"
                          placeholder="Twitter Profile URL"
                          value={newSocialLinks.twitter || ""}
                          onChange={(e) => {
                            setNewSocialLinks((prev) => ({
                              ...prev,
                              twitter: e.target.value || undefined,
                            }));
                            // Clear error on change
                            if (validationErrors["links.twitter"]) {
                              setValidationErrors((prev) => {
                                const newErrors = { ...prev };
                                delete newErrors["links.twitter"];
                                return newErrors;
                              });
                            }
                          }}
                          className="flex-1 text-base bg-transparent outline-none placeholder:text-black/60"
                        />
                      </div>
                      {validationErrors["links.twitter"] && (
                        <p className="text-sm text-red-500 mt-1">
                          {validationErrors["links.twitter"]}
                        </p>
                      )}
                    </div>
                    <div>
                      <div
                        className={`h-11 bg-white border rounded-xl flex items-center px-3 gap-3 ${
                          validationErrors["links.instagram"]
                            ? "border-red-500"
                            : "border-black/15"
                        }`}
                      >
                        <FaInstagram className="w-6 h-6 text-black" />
                        <input
                          type="url"
                          placeholder="Instagram Profile URL"
                          value={newSocialLinks.instagram || ""}
                          onChange={(e) => {
                            setNewSocialLinks((prev) => ({
                              ...prev,
                              instagram: e.target.value || undefined,
                            }));
                            // Clear error on change
                            if (validationErrors["links.instagram"]) {
                              setValidationErrors((prev) => {
                                const newErrors = { ...prev };
                                delete newErrors["links.instagram"];
                                return newErrors;
                              });
                            }
                          }}
                          className="flex-1 text-base bg-transparent outline-none placeholder:text-black/60"
                        />
                      </div>
                      {validationErrors["links.instagram"] && (
                        <p className="text-sm text-red-500 mt-1">
                          {validationErrors["links.instagram"]}
                        </p>
                      )}
                    </div>
                    <div>
                      <div
                        className={`h-11 bg-white border rounded-xl flex items-center px-3 gap-3 ${
                          validationErrors["links.portfolio"]
                            ? "border-red-500"
                            : "border-black/15"
                        }`}
                      >
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="black"
                            strokeWidth="2"
                          />
                          <path d="M2 12H22" stroke="black" strokeWidth="2" />
                          <path
                            d="M12 2C14.5 4.5 16 8 16 12C16 16 14.5 19.5 12 22C9.5 19.5 8 16 8 12C8 8 9.5 4.5 12 2Z"
                            stroke="black"
                            strokeWidth="2"
                          />
                        </svg>
                        <input
                          type="url"
                          placeholder="Portfolio Website URL"
                          value={newSocialLinks.portfolio || ""}
                          onChange={(e) => {
                            setNewSocialLinks((prev) => ({
                              ...prev,
                              portfolio: e.target.value || undefined,
                            }));
                            // Clear error on change
                            if (validationErrors["links.portfolio"]) {
                              setValidationErrors((prev) => {
                                const newErrors = { ...prev };
                                delete newErrors["links.portfolio"];
                                return newErrors;
                              });
                            }
                          }}
                          className="flex-1 text-base bg-transparent outline-none placeholder:text-black/60"
                        />
                      </div>
                      {validationErrors["links.portfolio"] && (
                        <p className="text-sm text-red-500 mt-1">
                          {validationErrors["links.portfolio"]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-6 pt-2">
                  <button
                    onClick={() => {
                      setIsEditingLinks(false);
                      setAvatarPreview(null);
                      setValidationErrors({});
                    }}
                    className="flex-1 h-10 bg-black/5 hover:bg-black/10 rounded-xl text-base font-medium text-black transition-colors"
                  >
                    Cancel
                  </button>
                  <Button
                    onClick={handleUpdateProfile}
                    className="flex-1 h-10 bg-[#4b89ef] hover:bg-[#3d7ce0] rounded-xl text-base font-medium text-white transition-colors"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContent>
    </PageContainer>
  );
}

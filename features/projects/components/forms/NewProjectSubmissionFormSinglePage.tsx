"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Share2, Sparkles, Lightbulb } from "lucide-react";
import { toast } from "@/lib/hooks/use-toast";

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  formSchema,
  type ProjectSubmissionFormData,
} from "./schema/ProjectSubmissionSchema";
import { useProjectSubmissionData } from "./hooks/useProjectSubmissionData";
import { TrackSelector } from "./components/TrackSelector";
import UserSearch from "@/components/utils/UserSearch";
import { useAdmin } from "@/lib/hooks/use-admin";

export function NewProjectSubmissionFormSinglePage({
  userEmail,
  leadName,
  eventId,
  onProjectSubmitted,
  onContextusLinked,
  contextusId: initialContextusId,
}: {
  userEmail?: string;
  leadName?: string;
  eventId?: string;
  onProjectSubmitted?: () => void;
  onContextusLinked?: (ctxId: string) => void;
  contextusId?: string | null;
}) {
  const router = useRouter();

  // Data dependencies
  const { allUsers, availableTracks, isLoading } = useProjectSubmissionData(eventId);

  // Local state
  const [projectId, setProjectId] = useState<string | null>(null);
  const [contextusId, setContextusId] = useState<string | null>(initialContextusId ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrefilling, setIsPrefilling] = useState(false);

  const isAdmin = useAdmin();


  // Form
  const form = useForm<ProjectSubmissionFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectName: "",
      leadName: leadName || "",
      leadEmail: userEmail || "",
      projectDescription: "",
      teammates: [],
      projectUrl: "",
      videoUrl: "",
      trackIds: [],
    },
  });

  // Keep props in sync and hydrate defaults from session for eventless flow
  useEffect(() => {
    if (leadName) form.setValue("leadName", leadName);
    if (userEmail) form.setValue("leadEmail", userEmail);
    if (initialContextusId) setContextusId(initialContextusId);
  }, [leadName, userEmail, initialContextusId, form]);

  useEffect(() => {
    const hydrateFromSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || "";
        const nameFromMeta = (session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name) as string | undefined;

        if (email && !form.getValues("leadEmail")) {
          form.setValue("leadEmail", email, { shouldDirty: true });
        }

        let displayName = nameFromMeta || "";
        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("display_name")
            .eq("uid", session.user.id)
            .maybeSingle();
          if (profile?.display_name) displayName = profile.display_name;
        }

        if (displayName && !form.getValues("leadName")) {
          form.setValue("leadName", displayName, { shouldDirty: true });
        }
      } catch {/* no-op */}
    };

    // Only hydrate when no explicit props were provided
    if (!leadName || !userEmail) {
      hydrateFromSession();
    }
  }, [leadName, userEmail, form]);

  // Create a draft as soon as user starts typing
  useEffect(() => {
    const hasChanges = Object.keys(form.formState.dirtyFields).length > 0;
    if (!hasChanges || projectId) return;

    const createDraft = async () => {
      try {
        const resp = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, leadName: form.getValues("leadName"), leadEmail: form.getValues("leadEmail") }),
        });
        if (resp.ok) {
          const json = await resp.json();
          setProjectId(json.id);
          if (json.contextus_project_id && onContextusLinked && isAdmin) {
            setContextusId(json.contextus_project_id as string);
            onContextusLinked?.(json.contextus_project_id as string);
          }
        }
      } catch (e) {
        console.error("Failed to create draft project", e);
      }
    };

    createDraft();
  }, [form.formState.dirtyFields, projectId, eventId, onContextusLinked, form]);

  // Autosave core fields when draft exists
  useEffect(() => {
    if (!projectId) return;

    const subscription = form.watch((value) => {
      if (!value) return;
      const handler = setTimeout(async () => {
        setIsSaving(true);
        try {
          const payload: Record<string, unknown> = {
            project_name: value.projectName,
            project_description: value.projectDescription,
            project_url: value.projectUrl,
            lead_name: value.leadName,
            lead_email: value.leadEmail,
            teammates: value.teammates,
          };
          const resp = await fetch(`/api/projects/${projectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (resp.ok) setLastSaved(new Date());
        } catch (e) {
          console.error("Autosave failed", e);
        } finally {
          setIsSaving(false);
        }
      }, 600);
      return () => clearTimeout(handler);
    });

    return () => subscription.unsubscribe();
  }, [projectId, form]);

  // Prefill via Contextus (prefer projectId if available; else eventId+leadEmail)
  const handlePrefill = async () => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only administrators can use the Contextus prefill feature.",
        variant: "destructive",
      });
      return;
    }
    
    setIsPrefilling(true);
    try {
      const resp = await fetch("/api/contextus/prefill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectId ? { projectId } : { eventId, leadEmail: form.getValues("leadEmail") }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Prefill failed: ${resp.status}`);
      }
      const json = await resp.json();
      const data = json?.data || {};

      if (data.projectName)
        form.setValue("projectName", data.projectName, { shouldDirty: true });
      if (data.projectDescription)
        form.setValue("projectDescription", data.projectDescription, {
          shouldDirty: true,
        });
      if (Array.isArray(data.teammates))
        form.setValue("teammates", data.teammates, { shouldDirty: true });
      if (data.projectUrl)
        form.setValue("projectUrl", data.projectUrl, { shouldDirty: true });
      if (data.videoUrl)
        form.setValue("videoUrl", data.videoUrl, { shouldDirty: true });

      toast({ title: "Form Prefilled", description: "Imported details from Contextus. Review and adjust as needed." });
    } catch (error) {
      toast({ title: "Prefill Error", description: error instanceof Error ? error.message : "Unable to prefill.", variant: "destructive" });
    } finally {
      setIsPrefilling(false);
    }
  };

  // Submit
  const onSubmit = async (values: ProjectSubmissionFormData) => {
    setIsSubmitting(true);

    // Only require tracks if available
    if (availableTracks.length > 0 && values.trackIds.length === 0) {
      toast({ title: "Missing Track Selection", description: "Please select at least one project track before sharing.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (values.projectName.trim().length < 2) {
      toast({ title: "Invalid Project Name", description: "Project name must be at least 2 characters long.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (values.projectDescription.trim().length < 10) {
      toast({ title: "Insufficient Project Description", description: "Please provide a more detailed project description (minimum 10 characters).", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    try {
      let coverImageUrl: string | undefined;
      let additionalMaterialsUrl: string | undefined;

      // Upload cover image if provided
      if (values.coverImage && values.coverImage.length > 0) {
        const file = values.coverImage[0];
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `project-covers/${fileName}`;
        const { error: uploadError } = await supabase.storage.from("project-materials").upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("project-materials").getPublicUrl(filePath);
        coverImageUrl = publicUrl;
      }

      // Upload additional materials if provided
      if (values.additionalMaterials && values.additionalMaterials.length > 0) {
        const file = values.additionalMaterials[0];
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `project-materials/${fileName}`;
        const { error: uploadError } = await supabase.storage.from("project-materials").upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("project-materials").getPublicUrl(filePath);
        additionalMaterialsUrl = publicUrl;
      }

      const response = await fetch("/api/projects/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName: values.projectName,
          leadName: values.leadName,
          leadEmail: values.leadEmail,
          projectDescription: values.projectDescription,
          teammates: values.teammates,
          projectUrl: values.projectUrl,
          coverImageUrl,
          additionalMaterialsUrl,
          eventId,
          trackIds: eventId ? values.trackIds : [],
          videoUrl: values.videoUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit project");
      }

      const data = await response.json();
      const warning = data.warning;
      if (warning) {
        toast({ title: "Warning", description: warning, variant: "destructive" });
      }

      toast({ title: "Project Successfully Shared!", description: "Your project is now available for others to view and provide feedback." });
      form.reset();
      onProjectSubmitted?.();
      router.push(`/projects/${data.data?.id || data.id}`);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "There was an error sharing your project.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showTracks = useMemo(() => availableTracks.length > 0, [availableTracks.length]);

  if (isLoading) {
    return <Loader2 className="animate-spin text-blue-400 h-10 w-10  mx-auto" />;
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-8 bg-white rounded-xl shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(eventId ? `/events/${eventId}/dashboard` : `/projects`)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {isAdmin && (
          <Button
            variant="secondary"
            className="flex items-center gap-2"
            onClick={handlePrefill}
            disabled={isPrefilling}
          >
            {isPrefilling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Prefilling...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Fill out this form for me
              </>
            )}
          </Button>
        )}
      </div>

      <div className="text-center mb-8">
        <h2 className="text-4xl font-extrabold text-gray-900">Create Your Project</h2>
        <p className="mt-3 text-lg text-gray-600">
          Start building your project with automatic saving as you go. Share when you&apos;re ready!
        </p>
      </div>

      {contextusId && (
        <div className="mt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Available Tools</h3>
            <p className="text-sm text-gray-500">Enhance your project development with these AI-powered tools</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Idea Generator (Contextus-linked) */}
            <div className="group relative overflow-hidden rounded-lg bg-white border border-gray-200/60 hover:border-amber-300/60 transition-all duration-300 hover:shadow-md hover:shadow-amber-50/50 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative p-4 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="relative p-2 rounded-lg bg-amber-50 border border-amber-100">
                      <Lightbulb className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-gray-900 group-hover:text-amber-900 transition-colors duration-300">
                        Idea Generator
                      </h4>
                      <p className="text-xs text-gray-500">Generate project ideas and inspiration</p>
                    </div>
                  </div>
                  <a
                    href={`https://idea-generation-prd.lovable.app/?contextus_id=${encodeURIComponent(contextusId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-2.5 h-8 rounded-md bg-gray-50 hover:bg-amber-50 border border-gray-200/50 hover:border-amber-200/50 transition-all duration-300 group-hover:shadow-sm text-xs font-medium text-gray-700"
                    aria-label="Open Idea Generator"
                  >
                    Open
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs text-gray-600">
                    <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Works in a new tab</span>
                  </div>
                  <button
                    onClick={() => {
                      const url = `https://idea-generation-prd.lovable.app/?contextus_id=${encodeURIComponent(contextusId)}`;
                      navigator.clipboard.writeText(url);
                      toast({
                        title: "Link copied!",
                        description: "Idea Generator link copied to clipboard",
                      });
                    }}
                    className="text-xs text-amber-700 hover:text-amber-800 font-medium hover:underline transition-colors duration-200"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>

            {/* Shanye Card */}
            <div className="group relative overflow-hidden rounded-lg bg-white border border-gray-200/60 hover:border-blue-300/60 transition-all duration-300 hover:shadow-md hover:shadow-blue-50/50 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/3 to-indigo-500/3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative p-4 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <img
                        alt="Shanye"
                        src="https://www.shanye.io/favicon.ico"
                        className="w-10 h-10 rounded-lg bg-gray-50 shadow-sm transition-all duration-300"
                      />
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border border-white flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-gray-900 group-hover:text-blue-900 transition-colors duration-300">
                        Shanye
                      </h4>
                      <p className="text-xs text-gray-500">AI-powered development</p>
                    </div>
                  </div>
                  <a
                    href={`https://www.shanye.io/?contextus_id=${encodeURIComponent(contextusId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-50 hover:bg-blue-50 border border-gray-200/50 hover:border-blue-200/50 transition-all duration-300 group-hover:shadow-sm"
                    aria-label="Open Shanye"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-600 group-hover:text-blue-600 transition-colors duration-300">
                      <path d="M13.5 6.75a.75.75 0 01.75-.75h5.25a.75.75 0 01.75.75V12a.75.75 0 01-1.5 0V8.56l-6.97 6.97a.75.75 0 01-1.06-1.06l6.97-6.97H14.25a.75.75 0 01-.75-.75z"></path>
                      <path d="M6 4.5A1.5 1.5 0 004.5 6v12A1.5 1.5 0 006 19.5h12a1.5 1.5 0 001.5-1.5v-3a.75.75 0 011.5 0v3A3 3 0 0118 21H6a3 3 0 01-3-3V6a3 3 0 013-3h3a.75.75 0 010 1.5H6z"></path>
                    </svg>
                  </a>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs text-gray-600">
                    <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span>Direct integration</span>
                  </div>
                  
                  <button
                    onClick={() => {
                      const url = `https://www.shanye.io/?contextus_id=${encodeURIComponent(contextusId)}`;
                      navigator.clipboard.writeText(url);
                      toast({
                        title: "Link copied!",
                        description: "Shanye project link copied to clipboard",
                      });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors duration-200"
                  >
                    Copy Link
                  </button>
                </div>
              </div>

              {/* Lovable Card */}
              <div className="group relative overflow-hidden rounded-lg bg-white border border-gray-200/60 hover:border-purple-300/60 transition-all duration-300 hover:shadow-md hover:shadow-purple-50/50 hover:-translate-y-0.5">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/3 to-pink-500/3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-4 pb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <img
                          alt="Lovable"
                          src="https://lovable.dev/favicon.ico"
                          className="w-10 h-10 rounded-lg bg-gray-50 shadow-sm transition-all duration-300"
                        />
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border border-white flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 group-hover:text-purple-900 transition-colors duration-300">
                          Lovable
                        </h4>
                        <p className="text-xs text-gray-500">AI development platform</p>
                      </div>
                    </div>
                    <a
                      href={`https://lovable.dev/?contextus_id=${encodeURIComponent(contextusId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-50 hover:bg-purple-50 border border-gray-200/50 hover:border-purple-200/50 transition-all duration-300 group-hover:shadow-sm"
                      aria-label="Open Lovable"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-600 group-hover:text-purple-600 transition-colors duration-300">
                        <path d="M13.5 6.75a.75.75 0 01.75-.75h5.25a.75.75 0 01.75.75V12a.75.75 0 01-1.5 0V8.56l-6.97 6.97a.75.75 0 01-1.06-1.06l6.97-6.97H14.25a.75.75 0 01-.75-.75z"></path>
                        <path d="M6 4.5A1.5 1.5 0 004.5 6v12A1.5 1.5 0 006 19.5h12a1.5 1.5 0 001.5-1.5v-3a.75.75 0 011.5 0v3A3 3 0 0118 21H6a3 3 0 01-3-3V6a3 3 0 013-3h3a.75.75 0 010 1.5H6z"></path>
                      </svg>
                    </a>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs text-gray-600">
                      <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>AI-powered tools</span>
                    </div>
                    
                    <button
                      onClick={() => {
                        const url = `https://lovable.dev/?contextus_id=${encodeURIComponent(contextusId)}`;
                        navigator.clipboard.writeText(url);
                        toast({
                          title: "Link copied!",
                          description: "Lovable project link copied to clipboard",
                        });
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors duration-200"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Autosave Status */}
      <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-blue-800">Your project is automatically saved as you type</span>
          </div>
          <div className="text-sm text-gray-600">
            {isSaving ? (
              <span className="flex items-center">
                <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : lastSaved ? (
              <span>Last saved {new Date(lastSaved).toLocaleTimeString()}</span>
            ) : (
              <span>Draft created</span>
            )}
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Project Information */}
          <div className="space-y-4">
            <FormField control={form.control} name="projectName" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Project Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter project name" {...field} className="text-base p-3" />
                </FormControl>
                <FormMessage className="text-sm" />
              </FormItem>
            )} />

            {showTracks && (
              <FormField control={form.control} name="trackIds" render={({ field }) => (
                <TrackSelector tracks={availableTracks} selectedTrackIds={field.value} onChange={field.onChange} />
              )} />
            )}

            <FormField control={form.control} name="projectDescription" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Project Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Briefly describe your project..." className="resize-none text-base p-3 min-h-[120px]" {...field} />
                </FormControl>
                <FormMessage className="text-sm" />
              </FormItem>
            )} />

            <FormField control={form.control} name="projectUrl" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">GitHub or Live Link (Optional)</FormLabel>
                <FormControl>
                  <Input type="url" placeholder="https://github.com/username/repository" {...field} className="text-base p-3" />
                </FormControl>
                <FormMessage className="text-sm" />
              </FormItem>
            )} />

            <FormField control={form.control} name="videoUrl" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Video (Optional)</FormLabel>
                <FormControl>
                  <Input type="url" placeholder="https://youtube.com/watch?v=..." {...field} className="text-base p-3" />
                </FormControl>
                <FormMessage className="text-sm" />
              </FormItem>
            )} />
          </div>

          {/* Documentation */}
          <div className="space-y-4 border-t pt-6">
            <FormField control={form.control} name="coverImage" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Cover Image</FormLabel>
                <FormControl>
                  <Input type="file" accept="image/*" onChange={(e) => field.onChange(e.target.files)} className="text-base p-3" />
                </FormControl>
                <FormDescription className="text-sm">Upload an image to showcase your project (Max 10MB).</FormDescription>
                <FormMessage className="text-sm" />
              </FormItem>
            )} />

            <FormField control={form.control} name="additionalMaterials" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Additional Materials</FormLabel>
                <FormControl>
                  <Input type="file" accept=".pdf,.doc,.docx,.txt,.zip" onChange={(e) => field.onChange(e.target.files)} className="text-base p-3" />
                </FormControl>
                <FormDescription className="text-sm">Upload any additional documentation (Max 10MB).</FormDescription>
                <FormMessage className="text-sm" />
              </FormItem>
            )} />
          </div>

          {/* Team & Contact */}
          <div className="space-y-4 border-t pt-6">
            <FormField control={form.control} name="leadName" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Your Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your name" {...field} className="text-base p-3" />
                </FormControl>
                <FormMessage className="text-sm" />
              </FormItem>
            )} />

            <FormField control={form.control} name="leadEmail" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Your Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Enter your email" {...field} className="text-base p-3" />
                </FormControl>
                <FormMessage className="text-sm" />
              </FormItem>
            )} />

            <FormField control={form.control} name="teammates" render={() => (
              <FormItem>
                <FormLabel className="text-base">Teammates (Optional)</FormLabel>
                <FormControl>
                  <UserSearch allTags={allUsers} onTagsChange={(tags) => form.setValue("teammates", tags)} />
                </FormControl>
                <FormDescription className="text-sm">Enter your teammates&apos; emails. Press Enter or comma to add each.</FormDescription>
                <FormMessage className="text-sm" />
              </FormItem>
            )} />
          </div>

          {/* Submit */}
          <div className="pt-6 border-t">
            <Button type="submit" disabled={isSubmitting} size="lg" className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 text-lg">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 className="mr-2 h-5 w-5" />
                  Share with Others
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
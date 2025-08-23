import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "@/lib/hooks/use-toast";

// Form field components
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

// Imported schema and types
import {
  formSchema,
  ProjectSubmissionFormData,
} from "./schema/ProjectSubmissionSchema";

// Imported hooks and components
import { useProjectSubmissionData } from "./hooks/useProjectSubmissionData";
import { TrackSelector } from "./components/TrackSelector";
import UserSearch from "@/components/utils/UserSearch";

export function ProjectSubmissionFormSinglePage({
  userEmail,
  leadName,
  eventId,
  onProjectSubmitted,
}: {
  userEmail?: string;
  leadName?: string;
  eventId: string;
  onProjectSubmitted?: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  // Custom hooks
  const { allUsers, availableTracks, isLoading } =
    useProjectSubmissionData(eventId);

  // Form setup
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

  // Handle teammates change
  const handleTeammatesChange = (tags: string[]) => {
    form.setValue("teammates", tags);
  };

  // Auto-fill form when props change
  useEffect(() => {
    if (leadName) form.setValue("leadName", leadName);
    if (userEmail) form.setValue("leadEmail", userEmail);
  }, [leadName, userEmail, form]);

  // Initialize or create draft project
  useEffect(() => {
    const ensureDraft = async () => {
      try {
        const { data: existing, error } = await supabase
          .from("projects")
          .select(
            `id, 
            project_name, 
            project_description, 
            project_url, 
            additional_materials_url, 
            cover_image_url, 
            teammates, 
            lead_name, 
            lead_email, submitted`
          )
          .eq("event_id", eventId)
          .eq("lead_email", userEmail || "")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && existing) {
          setProjectId(existing.id);
          form.reset({
            projectName: existing.project_name || "",
            projectDescription: existing.project_description || "",
            projectUrl: existing.project_url || "",
            teammates: (existing.teammates as string[]) || [],
            leadName: existing.lead_name || leadName || "",
            leadEmail: existing.lead_email || userEmail || "",
            additionalMaterials: undefined,
            coverImage: undefined,
            videoUrl: "",
            trackIds: [],
          });
        } else {
          const resp = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, leadName, leadEmail: userEmail }),
          });
          if (resp.ok) {
            const json = await resp.json();
            setProjectId(json.id);
          }
        }
      } catch (e) {
        console.error("Failed to initialize draft project", e);
      } finally {
        setIsInitializing(false);
      }
    };

    ensureDraft();
  }, [eventId, userEmail, leadName, form]);

  // Autosave core fields
  useEffect(() => {
    if (!projectId) return;
    const handler = setTimeout(async () => {
      setIsSaving(true);
      try {
        const payload: Record<string, unknown> = {
          project_name: form.getValues("projectName"),
          project_description: form.getValues("projectDescription"),
          project_url: form.getValues("projectUrl"),
          lead_name: form.getValues("leadName"),
          lead_email: form.getValues("leadEmail"),
          teammates: form.getValues("teammates"),
        };
        const resp = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          setLastSaved(new Date());
        }
      } catch (e) {
        console.error("Autosave failed", e);
      } finally {
        setIsSaving(false);
      }
    }, 800);

    return () => clearTimeout(handler);
  }, [
    projectId,
    form.watch("projectName"),
    form.watch("projectDescription"),
    form.watch("projectUrl"),
    form.watch("leadName"),
    form.watch("leadEmail"),
    form.watch("teammates"),
  ]);

  // Form submission
  const onSubmit = async (values: ProjectSubmissionFormData) => {
    setIsSubmitting(true);

    // Only require track selection if tracks are available
    if (availableTracks.length > 0 && values.trackIds.length === 0) {
      toast({
        title: "Missing Track Selection",
        description: "Please select at least one project track before sharing.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (values.projectName.trim().length < 2) {
      toast({
        title: "Invalid Project Name",
        description: "Project name must be at least 2 characters long.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (values.projectDescription.trim().length < 10) {
      toast({
        title: "Insufficient Project Description",
        description:
          "Please provide a more detailed project description (minimum 10 characters).",
        variant: "destructive",
      });
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
        const fileName = `${Math.random()
          .toString(36)
          .substring(2)}.${fileExt}`;
        const filePath = `project-covers/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("project-materials")
          .upload(filePath, file);
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = supabase.storage.from("project-materials").getPublicUrl(filePath);
        coverImageUrl = publicUrl;
      }

      // Upload additional materials if provided
      if (values.additionalMaterials && values.additionalMaterials.length > 0) {
        const file = values.additionalMaterials[0];
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random()
          .toString(36)
          .substring(2)}.${fileExt}`;
        const filePath = `project-materials/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("project-materials")
          .upload(filePath, file);
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = supabase.storage.from("project-materials").getPublicUrl(filePath);
        additionalMaterialsUrl = publicUrl;
      }

      // Submit project through API
      const response = await fetch("/api/projects/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
          trackIds: values.trackIds,
          videoUrl: values.videoUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit project");
      }

      const data = await response.json();
      const warning = data.warning;

      // Show warning if track assignments failed
      if (warning) {
        toast({
          title: "Warning",
          description: warning,
          variant: "destructive",
        });
      }

      toast({
        title: "Project Successfully Shared!",
        description:
          "Your project is now available for others to view and provide feedback.",
      });
      form.reset();
      onProjectSubmitted?.();
      router.push(`/projects/${data.data?.id || data.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "There was an error sharing your project. Please check all required fields.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isInitializing) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-8 bg-white rounded-xl shadow-xl">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-extrabold text-gray-900">
          Create Your Project
        </h2>
        <p className="mt-3 text-lg text-gray-600">
          Start building your project with automatic saving as you go. Share
          when you&apos;re ready!
        </p>
      </div>

      {/* Autosave Status */}
      <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm text-blue-800">
              Your project is automatically saved as you type
            </span>
          </div>
          <div className="text-sm text-gray-600">
            {isSaving ? (
              <span className="flex items-center">
                <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
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
          {/* Project Information Section */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Project Information
            </h3>

            <FormField
              control={form.control}
              name="projectName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Project Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter project name"
                      {...field}
                      className="text-base p-3"
                    />
                  </FormControl>
                  <FormMessage className="text-sm" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">
                    Project Description
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Briefly describe your project..."
                      className="resize-none text-base p-3 min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-sm">
                    Provide an overview of your project.
                  </FormDescription>
                  <FormMessage className="text-sm" />
                </FormItem>
              )}
            />

            {availableTracks.length > 0 && (
              <FormField
                control={form.control}
                name="trackIds"
                render={({ field }) => (
                  <TrackSelector
                    tracks={availableTracks}
                    selectedTrackIds={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            )}

            <FormField
              control={form.control}
              name="projectUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">
                    GitHub Repository or Live Website Link (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://github.com/username/repository"
                      {...field}
                      className="text-base p-3"
                    />
                  </FormControl>
                  <FormDescription className="text-sm">
                    Link to your project&apos;s repository.
                  </FormDescription>
                  <FormMessage className="text-sm" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="videoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">
                    Video Submission (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                      {...field}
                      className="text-base p-3"
                    />
                  </FormControl>
                  <FormDescription className="text-sm">
                    Link to a video demonstration or presentation of your
                    project.
                  </FormDescription>
                  <FormMessage className="text-sm" />
                </FormItem>
              )}
            />
          </div>

          {/* Documentation Section */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Documentation (Optional)
            </h3>

            <FormField
              control={form.control}
              name="coverImage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Cover Image</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => field.onChange(e.target.files)}
                      className="text-base p-3"
                    />
                  </FormControl>
                  <FormDescription className="text-sm">
                    Upload an image to showcase your project (Max 10MB).
                  </FormDescription>
                  <FormMessage className="text-sm" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additionalMaterials"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">
                    Additional Materials
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.zip"
                      onChange={(e) => field.onChange(e.target.files)}
                      className="text-base p-3"
                    />
                  </FormControl>
                  <FormDescription className="text-sm">
                    Upload any additional documentation (Max 10MB).
                  </FormDescription>
                  <FormMessage className="text-sm" />
                </FormItem>
              )}
            />
          </div>

          {/* Team & Contact Section */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Team & Contact
            </h3>

            <FormField
              control={form.control}
              name="leadName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Your Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your name"
                      {...field}
                      className="text-base p-3"
                    />
                  </FormControl>
                  <FormMessage className="text-sm" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="leadEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Your Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      {...field}
                      className="text-base p-3"
                    />
                  </FormControl>
                  <FormMessage className="text-sm" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="teammates"
              render={() => (
                <FormItem>
                  <FormLabel className="text-base">
                    Teammates (Optional)
                  </FormLabel>
                  <FormControl>
                    <UserSearch
                      allTags={allUsers}
                      onTagsChange={handleTeammatesChange}
                    />
                  </FormControl>
                  <FormDescription className="text-sm">
                    Enter your teammates&apos; names. Press Enter or comma to
                    add each name.
                  </FormDescription>
                  <FormMessage className="text-sm" />
                </FormItem>
              )}
            />
          </div>

          {/* Submit Button */}
          <div className="pt-6 border-t">
            <Button
              type="submit"
              disabled={isSubmitting}
              size="lg"
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 text-lg"
            >
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

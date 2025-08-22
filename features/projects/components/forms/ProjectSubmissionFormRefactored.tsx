import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { supabase } from "@/lib/supabase";
// Imported schema and types
import {
  formSchema,
  ProjectSubmissionFormData,
} from "./schema/ProjectSubmissionSchema";

// Imported hooks
import { useProjectSubmissionData } from "./hooks/useProjectSubmissionData";
import { useStepNavigation } from "./hooks/useStepNavigation";
import { useStepValidation } from "./hooks/useStepValidation";

// Imported components
import { ProjectSubmissionHeader } from "./components/ProjectSubmissionHeader";
import { ProjectInfoStep } from "./steps/ProjectInfoStep";
import { ProjectDocumentationStep } from "./steps/ProjectDocumentationStep";
import { TeamContactStep } from "./steps/TeamContactStep";
import { StepNavigation } from "./components/StepNavigation";
import { toast } from "@/lib/hooks/use-toast";

export function ProjectSubmissionFormComponent({
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
  const { currentStep, totalSteps, goToNext, goToPrevious } =
    useStepNavigation(3);

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

  const { validateStep, getStepValidationMessages } = useStepValidation(form, availableTracks.length);

  // Watch form fields that affect validation to trigger re-renders
  const projectNameValue = form.watch("projectName");
  const projectDescriptionValue = form.watch("projectDescription");
  const trackIdsValue = form.watch("trackIds");
  const leadNameValue = form.watch("leadName");
  const leadEmailValue = form.watch("leadEmail");
  const videoUrlValue = form.watch("videoUrl");

  // Determine if we can proceed to next step and get validation messages
  // Using useMemo with form values as dependencies to ensure re-calculation when form changes
  const getValidationState = useMemo(() => {
    const validationMessages = getStepValidationMessages(currentStep);
    const canGoNext = validationMessages.length === 0;
    return { canGoNext, validationMessages };
  }, [
    currentStep,
    getStepValidationMessages,
    projectNameValue,
    projectDescriptionValue,
    trackIdsValue,
    leadNameValue,
    leadEmailValue,
    videoUrlValue,
  ]);

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
            `id, project_name, project_description, project_url, additional_materials_url, cover_image_url, teammates, lead_name, lead_email`
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
  }, [projectId, form.watch("projectName"), form.watch("projectDescription"), form.watch("projectUrl"), form.watch("leadName"), form.watch("leadEmail"), form.watch("teammates")]);

  // Handle teammates change
  const handleTeammatesChange = (tags: string[]) => {
    form.setValue("teammates", tags);
  };

  // Navigation handlers
  const handleNext = () => {
    if (validateStep(currentStep)) {
      goToNext();
    }
  };

  const handlePrevious = () => {
    goToPrevious();
  };

  // Form submission - TODO: Extract to custom hook
  const onSubmit = async (values: ProjectSubmissionFormData) => {
    setIsSubmitting(true);
    // TODO: Move submission logic to useProjectSubmission hook
    // Only require track selection if tracks are available
    if (availableTracks.length > 0 && values.trackIds.length === 0) {
      toast({
        title: "Missing Track Selection",
        description:
          "Please select at least one project track before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (values.projectName.trim().length < 2) {
      toast({
        title: "Invalid Project Name",
        description: "Project name must be at least 2 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (values.projectDescription.trim().length < 10) {
      toast({
        title: "Insufficient Project Description",
        description:
          "Please provide a more detailed project description (minimum 10 characters).",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let additionalMaterialsUrl = null;
      let coverImageUrl = null;

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

      const { data, warning } = await response.json();

      // Show warning if track assignments failed
      if (warning) {
        toast({
          title: "Warning",
          description: warning,
          variant: "destructive",
        });
      }

      toast({
        title: "Project Successfully Submitted!",
        description: "Your project has been finalized and is now available in the gallery.",
      });
      form.reset();
      onProjectSubmitted?.();
      router.push(`/projects/${data.id}`);
    } catch (error) {
      console.error("Error submitting project:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "There was an error finalizing your project. Please check all required fields.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
    setIsSubmitting(false);
  };

  if (isLoading || isInitializing) {
    return <div>Loading...</div>;
  }

  const { canGoNext, validationMessages } = getValidationState;

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-8 bg-white rounded-xl shadow-xl">
      <ProjectSubmissionHeader
        currentStep={currentStep}
        totalSteps={totalSteps}
      />

      {/* Autosave Status */}
      <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-blue-800">
              Your project is automatically saved as you type
            </span>
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {currentStep === 1 && (
            <ProjectInfoStep form={form} availableTracks={availableTracks} />
          )}

          {currentStep === 2 && <ProjectDocumentationStep form={form} />}

          {currentStep === 3 && (
            <TeamContactStep
              form={form}
              allUsers={allUsers}
              leadName={leadName}
              userEmail={userEmail}
              onTeammatesChange={handleTeammatesChange}
            />
          )}

          <StepNavigation
            currentStep={currentStep}
            totalSteps={totalSteps}
            isSubmitting={isSubmitting}
            canGoNext={canGoNext}
            validationMessages={validationMessages}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSubmit={() => form.handleSubmit(onSubmit)()}
          />
        </form>
      </Form>
    </div>
  );
}
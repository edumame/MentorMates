"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Share2 } from "lucide-react";
import { toast } from "@/lib/hooks/use-toast";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formSchema, type ProjectSubmissionFormData } from "./schema/ProjectSubmissionSchema";
import { ProjectSubmissionFormComponent } from "./ProjectSubmissionFormRefactored";

export function NewProjectSubmissionFormSinglePage({
  userEmail,
  leadName,
  eventId,
  onProjectSubmitted,
  onContextusLinked, // not used in eventless wrapper, preserved for compatibility
  contextusId, // not used in eventless wrapper, preserved for compatibility
}: {
  userEmail?: string;
  leadName?: string;
  eventId?: string;
  onProjectSubmitted?: () => void;
  onContextusLinked?: (ctxId: string) => void;
  contextusId?: string | null;
}) {
  const router = useRouter();

  // If eventId is provided, reuse the existing multi-step submission form
  if (eventId) {
    return (
      <ProjectSubmissionFormComponent
        userEmail={userEmail}
        leadName={leadName}
        eventId={eventId}
        onProjectSubmitted={onProjectSubmitted}
      />
    );
  }

  // Eventless single-page submission form
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string>(userEmail || "");

  useEffect(() => {
    if (!userEmail) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSessionEmail(session?.user?.email || "");
      });
    }
  }, [userEmail]);

  const form = useForm<ProjectSubmissionFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectName: "",
      leadName: leadName || "",
      leadEmail: sessionEmail,
      projectDescription: "",
      teammates: [],
      projectUrl: "",
      videoUrl: "",
      trackIds: [],
    },
  });

  useEffect(() => {
    if (sessionEmail) {
      form.setValue("leadEmail", sessionEmail);
    }
  }, [sessionEmail, form]);

  const onSubmit = async (values: ProjectSubmissionFormData) => {
    setIsSubmitting(true);
    try {
      let coverImageUrl: string | undefined;
      let additionalMaterialsUrl: string | undefined;

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

      // Use the existing submit route; omit eventId and tracks in eventless flow
      const resp = await fetch("/api/projects/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: values.projectName,
          leadName: values.leadName,
          leadEmail: values.leadEmail,
          projectDescription: values.projectDescription,
          teammates: values.teammates,
          projectUrl: values.projectUrl,
          coverImageUrl,
          additionalMaterialsUrl,
          videoUrl: values.videoUrl,
          trackIds: [],
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit project");
      }

      const data = await resp.json();
      toast({ title: "Project Successfully Shared!", description: "Your project is now available for others to view and provide feedback." });
      onProjectSubmitted?.();
      router.push(`/projects/${data.data?.id || data.id}`);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Submission failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex justify-start items-center mb-6">
        <Button variant="ghost" onClick={() => router.push("/projects")} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Create Your Project</h3>
            <FormField name="projectName" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Project Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Awesome Project" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="projectDescription" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={6} placeholder="Describe your project" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="projectUrl" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Project URL (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="https://github.com/..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="leadName" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Your Name</FormLabel>
                <FormControl>
                  <Input placeholder="Jane Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="leadEmail" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Your Email</FormLabel>
                <FormControl>
                  <Input placeholder="jane@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="pt-4">
            <Button type="submit" className="bg-blue-900 text-white hover:bg-blue-800 w-full" disabled={isSubmitting}>
              {isSubmitting ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</>) : (<><Share2 className="mr-2 h-4 w-4" />Submit Project</>)}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
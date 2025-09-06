"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import type { CheckedState } from "@radix-ui/react-checkbox";

const Schema = z.object({
  familiarity: z.enum(["beginner", "intermediate", "advanced"], {
    required_error: "Please select your AI familiarity",
  }),
  mainGoals: z
    .array(
      z.enum([
        "build_project",
        "start_startup",
        "learn_skills",
        "prepare_jobs",
        "join_community",
        "exploring",
      ])
    )
    .min(1, "Select at least one goal"),
  role: z.enum(
    [
      "developer",
      "design",
      "product",
      "research",
      "marketing",
      "founder",
      "it_security",
      "other",
    ],
    { required_error: "Please choose a role" }
  ),
  industries: z
    .array(
      z.enum([
        "education",
        "health",
        "gaming",
        "manufacturing",
        "transport",
        "climate",
        "accessibility",
        "finance_business",
        "other",
      ])
    )
    .min(1, "Select at least one industry"),
  tools: z.array(
    z.enum([
      "gamma",
      "chatgpt",
      "canva_ai",
      "notion",
      "replit",
      "cursor",
      "data_analysis",
      "ar_vr",
      "hardware_iot",
    ])
  ),
});

type FormValues = z.infer<typeof Schema>;

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = useMemo(() => searchParams.get("returnUrl") || "/", [searchParams]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      familiarity: undefined as unknown as FormValues["familiarity"],
      mainGoals: [],
      role: undefined as unknown as FormValues["role"],
      industries: [],
      tools: [],
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      const payload = {
        version: 1,
        completedAt: new Date().toISOString(),
        answers: values,
      };

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to save");
      }

      router.push(returnUrl);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      form.setError("familiarity", { message: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goalOptions = [
    { value: "build_project", label: "Build a project" },
    { value: "start_startup", label: "Start or grow a startup" },
    { value: "learn_skills", label: "Learn new skills" },
    { value: "prepare_jobs", label: "Prepare for jobs/career" },
    { value: "join_community", label: "Join a community / meet people" },
    { value: "exploring", label: "Just exploring, not sure yet" },
  ] as const;

  const industryOptions = [
    { value: "education", label: "Education" },
    { value: "health", label: "Health" },
    { value: "gaming", label: "Gaming" },
    { value: "manufacturing", label: "Manufacturing" },
    { value: "transport", label: "Transport" },
    { value: "climate", label: "Climate / Sustainability" },
    { value: "accessibility", label: "Accessibility" },
    { value: "finance_business", label: "Finance / Business" },
    { value: "other", label: "Other" },
  ] as const;

  const toolsOptions = [
    { value: "gamma", label: "AI for slide generation (Gamma)" },
    { value: "chatgpt", label: "AI for writing & research (ChatGPT)" },
    { value: "canva_ai", label: "AI for design (Canva AI)" },
    { value: "notion", label: "AI for project tracking & organization (Notion)" },
    { value: "replit", label: "AI for website/app building (Replit)" },
    { value: "cursor", label: "AI coding assistants (Cursor)" },
    { value: "data_analysis", label: "AI for data analysis" },
    { value: "ar_vr", label: "AR / VR" },
    { value: "hardware_iot", label: "Hardware / IoT" },
  ] as const;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome! Tell us about you</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="familiarity"
                render={({ field }: { field: { value: FormValues["familiarity"]; onChange: (v: FormValues["familiarity"]) => void } }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>How familiar are you with AI?</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-1 gap-2">
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="beginner" id="fam-beginner" />
                          <label htmlFor="fam-beginner" className="text-sm">
                            Beginner — I’ve never built with AI, or I only know the basics
                          </label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="intermediate" id="fam-intermediate" />
                          <label htmlFor="fam-intermediate" className="text-sm">
                            Intermediate — I’ve created some projects using AI
                          </label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="advanced" id="fam-advanced" />
                          <label htmlFor="fam-advanced" className="text-sm">
                            Advanced — I’ve built with AI professionally or extensively
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mainGoals"
                render={() => (
                  <FormItem className="space-y-3">
                    <FormLabel>What is your main goal?</FormLabel>
                    <div className="grid grid-cols-1 gap-2">
                      {goalOptions.map((goal) => (
                        <FormField
                          key={goal.value}
                          control={form.control}
                          name="mainGoals"
                          render={({ field }: { field: { value: FormValues["mainGoals"]; onChange: (v: FormValues["mainGoals"]) => void } }) => {
                            const isChecked = (field.value || []).includes(goal.value as unknown as FormValues["mainGoals"][number]);
                            return (
                              <FormItem key={goal.value} className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked: CheckedState) => {
                                      const current = new Set(field.value || []);
                                      if (checked === true) current.add(goal.value);
                                      else current.delete(goal.value);
                                      field.onChange(Array.from(current));
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {goal.label}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }: { field: { value: FormValues["role"]; onChange: (v: FormValues["role"]) => void } }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Which role are you most interested in?</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-1 gap-2">
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="developer" id="role-dev" />
                          <label htmlFor="role-dev" className="text-sm">Developer / Engineer</label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="design" id="role-design" />
                          <label htmlFor="role-design" className="text-sm">UX / UI Design</label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="product" id="role-product" />
                          <label htmlFor="role-product" className="text-sm">Product / PM</label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="research" id="role-research" />
                          <label htmlFor="role-research" className="text-sm">Research / Data</label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="marketing" id="role-marketing" />
                          <label htmlFor="role-marketing" className="text-sm">Marketing / Growth</label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="founder" id="role-founder" />
                          <label htmlFor="role-founder" className="text-sm">Founder</label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="it_security" id="role-it" />
                          <label htmlFor="role-it" className="text-sm">IT &amp; Security</label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="other" id="role-other" />
                          <label htmlFor="role-other" className="text-sm">Other</label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="industries"
                render={() => (
                  <FormItem className="space-y-3">
                    <FormLabel>Which industries or problem areas excite you most?</FormLabel>
                    <div className="grid grid-cols-1 gap-2">
                      {industryOptions.map((i) => (
                        <FormField
                          key={i.value}
                          control={form.control}
                          name="industries"
                          render={({ field }: { field: { value: FormValues["industries"]; onChange: (v: FormValues["industries"]) => void } }) => {
                            const isChecked = (field.value || []).includes(i.value as unknown as FormValues["industries"][number]);
                            return (
                              <FormItem key={i.value} className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked: CheckedState) => {
                                      const current = new Set(field.value || []);
                                      if (checked === true) current.add(i.value);
                                      else current.delete(i.value);
                                      field.onChange(Array.from(current));
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {i.label}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tools"
                render={() => (
                  <FormItem className="space-y-3">
                    <FormLabel>What tools or technologies do you want to explore?</FormLabel>
                    <div className="grid grid-cols-1 gap-2">
                      {toolsOptions.map((t) => (
                        <FormField
                          key={t.value}
                          control={form.control}
                          name="tools"
                          render={({ field }: { field: { value: FormValues["tools"]; onChange: (v: FormValues["tools"]) => void } }) => {
                            const isChecked = (field.value || []).includes(t.value as unknown as FormValues["tools"][number]);
                            return (
                              <FormItem key={t.value} className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked: CheckedState) => {
                                      const current = new Set(field.value || []);
                                      if (checked === true) current.add(t.value);
                                      else current.delete(t.value);
                                      field.onChange(Array.from(current));
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {t.label}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Continue"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}


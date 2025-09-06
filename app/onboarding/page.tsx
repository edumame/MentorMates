"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  FAMILIARITY_OPTIONS,
  GOAL_OPTIONS,
  ROLE_OPTIONS,
  INDUSTRY_OPTIONS,
  AI_TECH_CATEGORIES,
  NON_AI_TECH_CATEGORIES,
  AI_TOOL_VALUES,
  NON_AI_TOOL_VALUES,
  FAMILIARITY_VALUES,
  GOAL_VALUES,
  ROLE_VALUES,
  INDUSTRY_VALUES,
} from "@/features/user/onboarding/questions-data";
import { useStepNavigation } from "@/features/projects/components/forms/hooks/useStepNavigation";
import { StepNavigation } from "@/features/projects/components/forms/components/StepNavigation";

const Schema = z.object({
  familiarity: z.enum(FAMILIARITY_VALUES, {
    required_error: "Please select your AI familiarity",
  }),
  mainGoals: z
    .array(z.enum(GOAL_VALUES))
    .min(1, "Select at least one goal"),
  role: z.enum(ROLE_VALUES, { required_error: "Please choose a role" }),
  industries: z
    .array(z.enum(INDUSTRY_VALUES))
    .min(1, "Select at least one industry"),
  aiTools: z.array(z.enum(AI_TOOL_VALUES)).default([]),
  nonAiTools: z.array(z.enum(NON_AI_TOOL_VALUES)).default([]),
});

type FormValues = z.input<typeof Schema>;

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = useMemo(() => searchParams.get("returnUrl") || "/", [searchParams]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalSteps = 5;
  const { currentStep, goToNext, goToPrevious } = useStepNavigation(totalSteps);

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      familiarity: undefined as unknown as FormValues["familiarity"],
      mainGoals: [],
      role: undefined as unknown as FormValues["role"],
      industries: [],
      aiTools: [],
      nonAiTools: [],
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

  const familiarityOptions = FAMILIARITY_OPTIONS;
  const goalOptions = GOAL_OPTIONS;
  const roleOptions = ROLE_OPTIONS;
  const industryOptions = INDUSTRY_OPTIONS;

  const stepValidationMessages = (step: number): string[] => {
    const values = form.getValues();
    const messages: string[] = [];
    if (step === 1) {
      if (!values.familiarity) messages.push("Please select your AI familiarity");
    }
    if (step === 2) {
      if (!values.mainGoals || values.mainGoals.length === 0) messages.push("Select at least one goal");
    }
    if (step === 3) {
      if (!values.role) messages.push("Please choose a role");
    }
    if (step === 4) {
      if (!values.industries || values.industries.length === 0) messages.push("Select at least one industry");
    }
    return messages;
  };

  const canProceedFromStep = (step: number): boolean => stepValidationMessages(step).length === 0;

  const handleNext = () => {
    if (canProceedFromStep(currentStep)) {
      goToNext();
    }
  };

  const handleFinalizeSubmit = () => {
    // Final submit from the last step
    form.handleSubmit(onSubmit)();
  };

  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  const StepHeader = () => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted-foreground">Step {currentStep} of {totalSteps}</div>
        <div className="text-sm font-medium">{progressPercent}%</div>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome! Tell us about you</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-8">
              <StepHeader />

              {currentStep === 1 && (
                <FormField
                  control={form.control}
                  name="familiarity"
                  render={({ field }: { field: { value: FormValues["familiarity"]; onChange: (v: FormValues["familiarity"]) => void } }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>How familiar are you with AI?</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-1 gap-2">
                          {familiarityOptions.map((opt) => (
                            <div key={opt.value} className="flex items-center space-x-3">
                              <RadioGroupItem value={opt.value} id={`fam-${opt.value}`} />
                              <label htmlFor={`fam-${opt.value}`} className="text-sm">{opt.label}</label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {currentStep === 2 && (
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
              )}

              {currentStep === 3 && (
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }: { field: { value: FormValues["role"]; onChange: (v: FormValues["role"]) => void } }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Which role are you most interested in?</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-1 gap-2">
                          {roleOptions.map((opt) => (
                            <div key={opt.value} className="flex items-center space-x-3">
                              <RadioGroupItem value={opt.value} id={`role-${opt.value}`} />
                              <label htmlFor={`role-${opt.value}`} className="text-sm">{opt.label}</label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {currentStep === 4 && (
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
              )}

              {currentStep === 5 && (
                <FormItem className="space-y-3">
                  <FormLabel>What tools or technologies do you want to explore?</FormLabel>
                  <div className="space-y-6">
                    <div>
                      <div className="mb-2 font-medium">AI-based technologies</div>
                      {AI_TECH_CATEGORIES.map((cat) => (
                        <div key={cat.id} className="mb-3">
                          <div className="text-sm text-muted-foreground mb-1">{cat.label}</div>
                          <div className="grid grid-cols-1 gap-2">
                            {cat.items.map((t) => (
                              <FormField
                                key={t.value}
                                control={form.control}
                                name="aiTools"
                                render={({ field }: { field: { value: FormValues["aiTools"]; onChange: (v: FormValues["aiTools"]) => void } }) => {
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  const isChecked = (field.value || []).includes(t.value as any);
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
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="mb-2 font-medium">Non-AI technologies</div>
                      {NON_AI_TECH_CATEGORIES.map((cat) => (
                        <div key={cat.id} className="mb-3">
                          <div className="text-sm text-muted-foreground mb-1">{cat.label}</div>
                          <div className="grid grid-cols-1 gap-2">
                            {cat.items.map((t) => (
                              <FormField
                                key={t.value}
                                control={form.control}
                                name="nonAiTools"
                                render={({ field }: { field: { value: FormValues["nonAiTools"]; onChange: (v: FormValues["nonAiTools"]) => void } }) => {
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  const isChecked = (field.value || []).includes(t.value as any);
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
                        </div>
                      ))}
                    </div>
                  </div>
                </FormItem>
              )}

              <StepNavigation
                currentStep={currentStep}
                totalSteps={totalSteps}
                isSubmitting={isSubmitting}
                canGoNext={canProceedFromStep(currentStep)}
                validationMessages={stepValidationMessages(currentStep)}
                onPrevious={goToPrevious}
                onNext={handleNext}
                onSubmit={handleFinalizeSubmit}
              />
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}


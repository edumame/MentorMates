"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
import {
  TestimonialPanelDesktop,
  TestimonialPanelMobile,
} from "@/components/ui/testimonial-carousel";
import {
  FAMILIARITY_OPTIONS,
  GOAL_OPTIONS,
  ROLE_OPTIONS,
  INDUSTRY_OPTIONS,
  AI_TECH_CATEGORIES,
  NON_AI_TECH_CATEGORIES,
} from "@/features/user/onboarding/questions-data";
import { useStepNavigation } from "@/features/projects/components/forms/hooks/useStepNavigation";

// No validation schema. FormValues defined inline.
type FormValues = {
  familiarity: string;
  mainGoals: string[];
  role: string;
  industries: string[];
  aiTools: string[];
  nonAiTools: string[];
};

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = useMemo(
    () => searchParams.get("returnUrl") || "/",
    [searchParams]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = 5;
  const { currentStep, goToNext, goToPrevious } = useStepNavigation(totalSteps);

  const form = useForm<FormValues>({
    defaultValues: {
      familiarity: "",
      mainGoals: [],
      role: "",
      industries: [],
      aiTools: [],
      nonAiTools: [],
    },
    mode: "onChange",
  });

  const familiarityOptions = FAMILIARITY_OPTIONS;
  const goalOptions = GOAL_OPTIONS;
  const roleOptions = ROLE_OPTIONS;
  const industryOptions = INDUSTRY_OPTIONS;

  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  async function handleSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
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
      form.setError("familiarity", {
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNext() {
    goToNext();
  }

  function handleSkip() {
    router.push(returnUrl);
  }

  function handleBack() {
    goToPrevious();
  }

  function handleComplete() {
    form.handleSubmit(handleSubmit)();
  }

  // Watch form values to determine if current step is valid
  const watchedValues = form.watch();
  
  function isCurrentStepValid(): boolean {
    switch (currentStep) {
      case 1:
        return !!watchedValues.familiarity;
      case 2:
        return Array.isArray(watchedValues.mainGoals) && watchedValues.mainGoals.length > 0;
      case 3:
        return !!watchedValues.role;
      case 4:
        return Array.isArray(watchedValues.industries) && watchedValues.industries.length > 0;
      case 5:
        // Step 5 is optional, so always allow proceeding
        return true;
      default:
        return false;
    }
  }

  function StepHeader() {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </div>
          <div className="text-sm font-medium">{progressPercent}%</div>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* LEFT: form column */}
      <main className="flex flex-col h-screen">
        <div className="flex-1 flex items-start lg:items-center justify-center px-6 pt-8 lg:pt-0 overflow-y-auto">
          <div className="w-full max-w-sm py-4">
            <StepHeader />
            <Form {...form}>
              <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
                {/* Step 1: Familiarity */}
                {currentStep === 1 && (
                  <FormField
                    control={form.control}
                    name="familiarity"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-lg font-semibold">
                          How familiar are you with AI?
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="space-y-3"
                          >
                            {familiarityOptions.map((opt) => (
                              <div
                                key={opt.value}
                                className="flex items-start space-x-3"
                              >
                                <RadioGroupItem
                                  value={opt.value}
                                  id={`fam-${opt.value}`}
                                  className="mt-1"
                                />
                                <label
                                  htmlFor={`fam-${opt.value}`}
                                  className="text-sm leading-relaxed cursor-pointer"
                                >
                                  {opt.label}
                                </label>
                              </div>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Step 2: Main Goals */}
                {currentStep === 2 && (
                  <FormField
                    control={form.control}
                    name="mainGoals"
                    render={() => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-lg font-semibold">
                          What is your main goal?
                        </FormLabel>
                        <div className="space-y-3">
                          {goalOptions.map((goal) => (
                            <FormField
                              key={goal.value}
                              control={form.control}
                              name="mainGoals"
                              render={({ field }) => {
                                const isChecked = Array.isArray(field.value)
                                  ? field.value.includes(goal.value)
                                  : false;
                                return (
                                  <FormItem
                                    key={goal.value}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={(checked: CheckedState) => {
                                          const current = new Set(field.value || []);
                                          if (checked === true) current.add(goal.value);
                                          else current.delete(goal.value);
                                          field.onChange(Array.from(current));
                                        }}
                                        className="mt-1"
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal leading-relaxed cursor-pointer">
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

                {/* Step 3: Role */}
                {currentStep === 3 && (
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-lg font-semibold">
                          Which role are you most interested in?
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="space-y-3"
                          >
                            {roleOptions.map((opt) => (
                              <div
                                key={opt.value}
                                className="flex items-start space-x-3"
                              >
                                <RadioGroupItem
                                  value={opt.value}
                                  id={`role-${opt.value}`}
                                  className="mt-1"
                                />
                                <label
                                  htmlFor={`role-${opt.value}`}
                                  className="text-sm leading-relaxed cursor-pointer"
                                >
                                  {opt.label}
                                </label>
                              </div>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Step 4: Industries */}
                {currentStep === 4 && (
                  <FormField
                    control={form.control}
                    name="industries"
                    render={() => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-lg font-semibold">
                          Which industries or problem areas excite you most?
                        </FormLabel>
                        <div className="space-y-3">
                          {industryOptions.map((i) => (
                            <FormField
                              key={i.value}
                              control={form.control}
                              name="industries"
                              render={({ field }) => {
                                const isChecked = Array.isArray(field.value)
                                  ? field.value.includes(i.value)
                                  : false;
                                return (
                                  <FormItem
                                    key={i.value}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={(checked: CheckedState) => {
                                          const current = new Set(field.value || []);
                                          if (checked === true) current.add(i.value);
                                          else current.delete(i.value);
                                          field.onChange(Array.from(current));
                                        }}
                                        className="mt-1"
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal leading-relaxed cursor-pointer">
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

                {/* Step 5: Tools */}
                {currentStep === 5 && (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-lg font-semibold">
                      What tools or technologies do you want to explore?
                    </FormLabel>
                    <div className="space-y-6 overflow-y-auto max-h-96">
                      <div>
                        <div className="mb-3 font-medium">
                          AI-based technologies
                        </div>
                        {AI_TECH_CATEGORIES.map((cat) => (
                          <div key={cat.id} className="mb-4">
                            <div className="text-sm text-muted-foreground mb-2">
                              {cat.label}
                            </div>
                            <div className="space-y-2">
                              {cat.items.map((t) => (
                                <FormField
                                  key={t.value}
                                  control={form.control}
                                  name="aiTools"
                                  render={({ field }) => {
                                    const selected = Array.isArray(field.value) ? field.value : [];
                                    const isChecked = selected.includes(t.value);
                                    return (
                                      <FormItem
                                        key={t.value}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={(checked: CheckedState) => {
                                              const current = new Set(field.value || []);
                                              if (checked === true) current.add(t.value);
                                              else current.delete(t.value);
                                              field.onChange(Array.from(current));
                                            }}
                                            className="mt-1"
                                          />
                                        </FormControl>
                                        <FormLabel className="text-sm font-normal cursor-pointer">
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
                        <div className="mb-3 font-medium">
                          Non-AI technologies
                        </div>
                        {NON_AI_TECH_CATEGORIES.map((cat) => (
                          <div key={cat.id} className="mb-4">
                            <div className="text-sm text-muted-foreground mb-2">
                              {cat.label}
                            </div>
                            <div className="space-y-2">
                              {cat.items.map((t) => (
                                <FormField
                                  key={t.value}
                                  control={form.control}
                                  name="nonAiTools"
                                  render={({ field }) => {
                                    const selected = Array.isArray(field.value) ? field.value : [];
                                    const isChecked = selected.includes(t.value);
                                    return (
                                      <FormItem
                                        key={t.value}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={(checked: CheckedState) => {
                                              const current = new Set(field.value || []);
                                              if (checked === true) current.add(t.value);
                                              else current.delete(t.value);
                                              field.onChange(Array.from(current));
                                            }}
                                            className="mt-1"
                                          />
                                        </FormControl>
                                        <FormLabel className="text-sm font-normal cursor-pointer">
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

                {/* Navigation */}
                <div className="flex gap-3 pt-4">
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      className="flex-1"
                    >
                      Previous
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkip}
                    className={currentStep === 1 ? "flex-1" : ""}
                  >
                    Skip
                  </Button>
                  <Button
                    type="button"
                    onClick={
                      currentStep === totalSteps ? handleComplete : handleNext
                    }
                    disabled={isSubmitting || (currentStep !== totalSteps && !isCurrentStepValid())}
                    className={`flex-1 ${
                      isCurrentStepValid() && currentStep !== totalSteps
                        ? "bg-[var(--brand-primary-hex)] hover:bg-[var(--brand-primary-strong-hex)] text-white"
                        : currentStep === totalSteps
                        ? "bg-[var(--brand-primary-hex)] hover:bg-[var(--brand-primary-strong-hex)] text-white"
                        : ""
                    }`}
                  >
                    {isSubmitting
                      ? "Saving..."
                      : currentStep === totalSteps
                      ? "Complete"
                      : "Next"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
        <TestimonialPanelMobile />
        <div className="px-6 pb-6 hidden lg:block">
          <div className="text-xs text-slate-500 text-center lg:text-left">
            © 2025 MentorMates
          </div>
        </div>
      </main>
      {/* RIGHT: desktop testimonial panel */}
      <TestimonialPanelDesktop />
    </div>
  );
}
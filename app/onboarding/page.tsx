"use client";

import { OPEN_SOURCE } from "@/lib/config/open-source";
import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Award,
  Calendar,
  GraduationCap,
  Rocket,
  Scale,
  Sprout,
  TrendingUp,
} from "lucide-react";

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
  PLATFORM_ROLE_OPTIONS,
  PLATFORM_ROLE_REDIRECTS,
  type PlatformRole,
} from "@/features/user/onboarding/questions-data";
import { ONBOARDING_SKIP_STATUS } from "@/features/user/onboarding/metadata";
import { useStepNavigation } from "@/features/projects/components/forms/hooks/useStepNavigation";
import { getSafeRedirectPath } from "@/features/user/authentication/redirect/redirect-url";
import { cn } from "@/lib/utils";

type FormValues = {
  familiarity: string;
  mainGoals: string[];
  role: string;
  industries: string[];
  aiTools: string[];
  nonAiTools: string[];
  platformRole: PlatformRole | "";
};

const PLATFORM_ROLE_ICONS = {
  participant: Rocket,
  mentor: GraduationCap,
  judge: Scale,
  organizer: Calendar,
} as const;

const FAMILIARITY_ICONS = {
  beginner: Sprout,
  intermediate: TrendingUp,
  advanced: Award,
} as const;

/** Heading/H5 — step questions (Geist 28px / 600; tighter leading when title wraps to two lines). */
const ONBOARDING_STEP_HEADING_CLASSNAME =
  "font-geist text-[28px] font-semibold leading-[1.2] tracking-[-1.68px] text-[color:var(--Color-Scheme-1-Text)]";

/** 32px — question title bottom → first option area (margin on heading; reliable vs Slot on FormControl). */
const ONBOARDING_TITLE_TO_OPTIONS_BOTTOM = "mb-[32px]";
/** Wrapper: space under title + 48px below helper copy before options (`padding` avoids margin collapse). */
const ONBOARDING_HELPER_BLOCK_CLASSNAME = "mt-2 pb-12";
const ONBOARDING_HELPER_TEXT_CLASSNAME = "text-sm text-muted-foreground";

/** Selected / default surfaces for onboarding choice rows (aligns with product blue #4B89EF). */
function onboardingOptionCardClassName(selected: boolean) {
  return cn(
    "rounded-xl border-2 px-4 py-3 transition-colors",
    selected
      ? "border-[#4B89EF] bg-[#EFF6FF]"
      : "border-black/[0.08] bg-white hover:border-black/[0.16] hover:bg-muted/15"
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = useMemo(
    () => getSafeRedirectPath(searchParams.get("returnUrl")) || "",
    [searchParams]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Tools step temporarily removed (was Q5); `aiTools` / `nonAiTools` stay [] in payload. */
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
      platformRole: "",
    },
    mode: "onChange",
  });

  const familiarityOptions = FAMILIARITY_OPTIONS;
  const goalOptions = GOAL_OPTIONS;
  const roleOptions = ROLE_OPTIONS;
  const industryOptions = INDUSTRY_OPTIONS;
  const platformRoleOptions = PLATFORM_ROLE_OPTIONS;

  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  async function handleSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      form.clearErrors("root");
      const payload = {
        version: 3,
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

      // Redirect based on platform role selection
      const platformRole = values.platformRole as PlatformRole;
      const roleBasedRedirect = PLATFORM_ROLE_REDIRECTS[platformRole] || "/";

      // If there's a specific returnUrl (e.g., joining an event), use that instead
      const finalRedirect = returnUrl || roleBasedRedirect;
      router.push(finalRedirect);
    } catch {
      form.setError("root", {
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSkip() {
    setIsSubmitting(true);
    try {
      form.clearErrors("root");
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: 4,
          status: ONBOARDING_SKIP_STATUS,
          skippedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to save");
      }

      router.push(returnUrl || "/");
    } catch {
      form.setError("root", {
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNext() {
    goToNext();
  }

  function handleBack() {
    goToPrevious();
  }

  function handleComplete() {
    form.handleSubmit(handleSubmit)();
  }

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
        return !!watchedValues.platformRole;
      default:
        return false;
    }
  }

  function getStepTitle(): string {
    switch (currentStep) {
      case 1:
        return "How familiar are you with AI?";
      case 2:
        return "What is your main goal?";
      case 3:
        return "Which role best describes you?";
      case 4:
        return "Which industries or problem areas excite you most?";
      case 5:
        return "How do you want to participate?";
      default:
        return "";
    }
  }

  function StepHeader() {
    return (
      <div className="mb-4 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </div>
          <div className="text-sm font-medium">{progressPercent}%</div>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full"
          style={{
            backgroundColor: "var(--Color-Neutral-Lightest, #F2F2F2)",
          }}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* LEFT: form column */}
      <main className="flex min-h-screen flex-1 flex-col bg-white lg:h-screen lg:max-h-screen">
        <header className="shrink-0 px-6 pt-5 pb-0 lg:px-10 lg:pt-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image
              src="/mentormate.png"
              alt="MentorMates"
              width={221}
              height={35}
              priority
              className="h-[35px] w-auto max-w-[221.14px] object-contain object-left"
            />
          </Link>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-0 pt-10 lg:px-10 lg:pt-12">
          <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
            <StepHeader />
            <Form {...form}>
              <form
                className="flex min-h-0 flex-1 flex-col gap-0"
                onSubmit={form.handleSubmit(handleSubmit)}
              >
                {/* Step 1: Familiarity */}
                {currentStep === 1 && (
                  <FormField
                    control={form.control}
                    name="familiarity"
                    render={({ field }) => (
                      <FormItem className="flex min-h-0 flex-1 flex-col gap-0 space-y-0">
                        <FormLabel
                          className={cn(
                            ONBOARDING_STEP_HEADING_CLASSNAME,
                            ONBOARDING_TITLE_TO_OPTIONS_BOTTOM,
                            "shrink-0"
                          )}
                        >
                          {getStepTitle()}
                        </FormLabel>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-2 [-webkit-overflow-scrolling:touch]">
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="gap-3"
                            >
                              {familiarityOptions.map((opt) => {
                                const FamiliarityIcon =
                                  FAMILIARITY_ICONS[
                                    opt.value as keyof typeof FAMILIARITY_ICONS
                                  ];
                                const isSelected = field.value === opt.value;
                                return (
                                  <label
                                    key={opt.value}
                                    className={cn(
                                      "flex cursor-pointer items-start gap-3",
                                      onboardingOptionCardClassName(isSelected)
                                    )}
                                  >
                                    <RadioGroupItem
                                      value={opt.value}
                                      id={`fam-${opt.value}`}
                                      className="mt-1 shrink-0"
                                    />
                                    {FamiliarityIcon && (
                                      <FamiliarityIcon
                                        aria-hidden
                                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                                      />
                                    )}
                                    <span className="flex-1 text-sm leading-relaxed">
                                      {opt.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </RadioGroup>
                          </FormControl>
                        </div>
                        <FormMessage className="mt-2 shrink-0" />
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
                      <FormItem className="flex min-h-0 flex-1 flex-col gap-0 space-y-0">
                        <div className="shrink-0">
                          <FormLabel className={ONBOARDING_STEP_HEADING_CLASSNAME}>
                            {getStepTitle()}
                          </FormLabel>
                          <div className={ONBOARDING_HELPER_BLOCK_CLASSNAME}>
                            <p className={ONBOARDING_HELPER_TEXT_CLASSNAME}>
                              Select all that apply
                            </p>
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-2 [-webkit-overflow-scrolling:touch]">
                          <div className="flex flex-col gap-3">
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
                                      className={cn(
                                        "flex flex-row items-start gap-3 space-y-0",
                                        onboardingOptionCardClassName(isChecked)
                                      )}
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
                                          className="mt-1 shrink-0"
                                        />
                                      </FormControl>
                                      <FormLabel className="flex-1 cursor-pointer text-sm font-normal leading-relaxed">
                                        {goal.label}
                                      </FormLabel>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        <FormMessage className="mt-2 shrink-0" />
                      </FormItem>
                    )}
                  />
                )}

                {/* Step 3: Professional Role */}
                {currentStep === 3 && (
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem className="flex min-h-0 flex-1 flex-col gap-0 space-y-0">
                        <FormLabel
                          className={cn(
                            ONBOARDING_STEP_HEADING_CLASSNAME,
                            ONBOARDING_TITLE_TO_OPTIONS_BOTTOM,
                            "shrink-0"
                          )}
                        >
                          {getStepTitle()}
                        </FormLabel>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-2 [-webkit-overflow-scrolling:touch]">
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="gap-3"
                            >
                              {roleOptions.map((opt) => (
                                <label
                                  key={opt.value}
                                  className={cn(
                                    "flex cursor-pointer items-start gap-3",
                                    onboardingOptionCardClassName(
                                      field.value === opt.value
                                    )
                                  )}
                                >
                                  <RadioGroupItem
                                    value={opt.value}
                                    id={`role-${opt.value}`}
                                    className="mt-1 shrink-0"
                                  />
                                  <span className="flex-1 text-sm leading-relaxed">
                                    {opt.label}
                                  </span>
                                </label>
                              ))}
                            </RadioGroup>
                          </FormControl>
                        </div>
                        <FormMessage className="mt-2 shrink-0" />
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
                      <FormItem className="flex min-h-0 flex-1 flex-col gap-0 space-y-0">
                        <div className="shrink-0">
                          <FormLabel className={ONBOARDING_STEP_HEADING_CLASSNAME}>
                            {getStepTitle()}
                          </FormLabel>
                          <div className={ONBOARDING_HELPER_BLOCK_CLASSNAME}>
                            <p className={ONBOARDING_HELPER_TEXT_CLASSNAME}>
                              Select all that apply
                            </p>
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-2 [-webkit-overflow-scrolling:touch]">
                          <div className="flex flex-col gap-3">
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
                                      className={cn(
                                        "flex flex-row items-start gap-3 space-y-0",
                                        onboardingOptionCardClassName(isChecked)
                                      )}
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
                                          className="mt-1 shrink-0"
                                        />
                                      </FormControl>
                                      <FormLabel className="flex-1 cursor-pointer text-sm font-normal leading-relaxed">
                                        {i.label}
                                      </FormLabel>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        <FormMessage className="mt-2 shrink-0" />
                      </FormItem>
                    )}
                  />
                )}

                {/* Step 5: Platform role (tools question temporarily removed) */}
                {currentStep === 5 && (
                  <FormField
                    control={form.control}
                    name="platformRole"
                    render={({ field }) => (
                      <FormItem className="flex min-h-0 flex-1 flex-col gap-0 space-y-0">
                        <div className="shrink-0">
                          <FormLabel className={ONBOARDING_STEP_HEADING_CLASSNAME}>
                            {getStepTitle()}
                          </FormLabel>
                          <div className={ONBOARDING_HELPER_BLOCK_CLASSNAME}>
                            <p className={ONBOARDING_HELPER_TEXT_CLASSNAME}>
                              This helps us personalize your experience
                            </p>
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-2 [-webkit-overflow-scrolling:touch]">
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="gap-3"
                            >
                              {platformRoleOptions.map((opt) => {
                                const IconComponent = PLATFORM_ROLE_ICONS[opt.value as keyof typeof PLATFORM_ROLE_ICONS];
                                return (
                                  <div
                                    key={opt.value}
                                    className={cn(
                                      "flex cursor-pointer items-start gap-3",
                                      onboardingOptionCardClassName(
                                        field.value === opt.value
                                      )
                                    )}
                                    onClick={() => field.onChange(opt.value)}
                                  >
                                    <RadioGroupItem
                                      value={opt.value}
                                      id={`platform-${opt.value}`}
                                      className="mt-1 shrink-0"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        {IconComponent && (
                                          <IconComponent className="h-4 w-4 text-primary" />
                                        )}
                                        <label
                                          htmlFor={`platform-${opt.value}`}
                                          className="cursor-pointer text-sm font-medium leading-relaxed"
                                        >
                                          {opt.label}
                                        </label>
                                      </div>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {opt.description}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </RadioGroup>
                          </FormControl>
                        </div>
                        <FormMessage className="mt-2 shrink-0" />
                      </FormItem>
                    )}
                  />
                )}

                {/* Navigation — fixed at bottom of column; options scroll above */}
                <div className="shrink-0 space-y-3 bg-white pt-4 pb-6">
                  <div className="flex gap-3">
                    {currentStep > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleBack}
                        className="flex-1"
                      >
                        Back
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={
                        currentStep === totalSteps ? handleComplete : handleNext
                      }
                      disabled={isSubmitting || !isCurrentStepValid()}
                      className={`flex-1 ${
                        isCurrentStepValid()
                          ? "bg-[#4B89EF] hover:bg-[#3F77D3] text-white"
                          : ""
                      }`}
                    >
                      {isSubmitting
                        ? "Saving..."
                        : currentStep === totalSteps
                        ? "Get Started"
                        : "Continue"}
                    </Button>
                  </div>
                  {form.formState.errors.root?.message && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.root.message}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void handleSkip()}
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    Skip for now
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
        <div className="lg:hidden">
          <TestimonialPanelMobile />
        </div>
        <div className="px-6 pb-6 hidden lg:block">
          <div className="text-xs text-slate-500 text-center lg:text-left">
            © {new Date().getFullYear()} {OPEN_SOURCE.COPYRIGHT_HOLDER}
          </div>
        </div>
      </main>
      {/* RIGHT: desktop testimonial panel */}
      <TestimonialPanelDesktop />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, 
  Target, 
  Briefcase, 
  Building2, 
  Wrench,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Rocket,
  Users,
  GraduationCap,
  TrendingUp,
  Search,
  Code2,
  Palette,
  Database,
  BarChart3,
  Shield,
  Globe,
  Heart,
  Gamepad2,
  Factory,
  Car,
  Leaf,
  Accessibility,
  DollarSign
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
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
import { Loader2 } from "lucide-react";

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

// Icon mappings for better visual appeal
const goalIcons: Record<string, React.ReactNode> = {
  build_project: <Rocket className="h-5 w-5" />,
  start_startup: <TrendingUp className="h-5 w-5" />,
  learn_skills: <GraduationCap className="h-5 w-5" />,
  prepare_jobs: <Briefcase className="h-5 w-5" />,
  join_community: <Users className="h-5 w-5" />,
  exploring: <Search className="h-5 w-5" />,
};

const roleIcons: Record<string, React.ReactNode> = {
  developer: <Code2 className="h-5 w-5" />,
  design: <Palette className="h-5 w-5" />,
  product: <Target className="h-5 w-5" />,
  research: <Database className="h-5 w-5" />,
  marketing: <BarChart3 className="h-5 w-5" />,
  founder: <Rocket className="h-5 w-5" />,
  it_security: <Shield className="h-5 w-5" />,
  other: <Globe className="h-5 w-5" />,
};

const industryIcons: Record<string, React.ReactNode> = {
  education: <GraduationCap className="h-5 w-5" />,
  health: <Heart className="h-5 w-5" />,
  gaming: <Gamepad2 className="h-5 w-5" />,
  manufacturing: <Factory className="h-5 w-5" />,
  transport: <Car className="h-5 w-5" />,
  climate: <Leaf className="h-5 w-5" />,
  accessibility: <Accessibility className="h-5 w-5" />,
  finance_business: <DollarSign className="h-5 w-5" />,
  other: <Globe className="h-5 w-5" />,
};

const familiarityIcons: Record<string, React.ReactNode> = {
  beginner: <Sparkles className="h-5 w-5" />,
  intermediate: <Brain className="h-5 w-5" />,
  advanced: <Rocket className="h-5 w-5" />,
};

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
      console.error(err);
      form.setError("familiarity", { message: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

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
    form.handleSubmit(onSubmit)();
  };

  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  const stepTitles = [
    "AI Experience",
    "Your Goals",
    "Your Role",
    "Industries",
    "Technologies"
  ];

  const stepDescriptions = [
    "Help us understand your current level with AI",
    "What would you like to achieve?",
    "Which role best describes you?",
    "What areas excite you most?",
    "Choose technologies to explore"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-4xl p-4 py-12">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Welcome to MentorMates! 👋
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Let's personalize your experience in just a few steps
          </p>
        </motion.div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Step {currentStep} of {totalSteps}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-500">
                • {stepTitles[currentStep - 1]}
              </span>
            </div>
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {progressPercent}%
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          
          {/* Step indicators */}
          <div className="flex justify-between mt-4">
            {stepTitles.map((title, index) => (
              <div
                key={index}
                className={cn(
                  "flex flex-col items-center",
                  index + 1 <= currentStep ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-600"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                    index + 1 < currentStep
                      ? "bg-blue-600 text-white"
                      : index + 1 === currentStep
                      ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  )}
                >
                  {index + 1 < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span className="text-xs mt-1 hidden sm:block">{title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Card */}
        <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">{stepTitles[currentStep - 1]}</CardTitle>
            <CardDescription className="text-base">
              {stepDescriptions[currentStep - 1]}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form className="space-y-8">
                <AnimatePresence mode="wait">
                  {currentStep === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <FormField
                        control={form.control}
                        name="familiarity"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-base font-semibold">
                              How familiar are you with AI?
                            </FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="grid gap-4"
                              >
                                {FAMILIARITY_OPTIONS.map((opt) => (
                                  <label
                                    key={opt.value}
                                    htmlFor={`fam-${opt.value}`}
                                    className={cn(
                                      "relative flex cursor-pointer rounded-lg border-2 p-4 hover:bg-accent/50 transition-all",
                                      field.value === opt.value
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                        : "border-gray-200 dark:border-gray-700"
                                    )}
                                  >
                                    <RadioGroupItem
                                      value={opt.value}
                                      id={`fam-${opt.value}`}
                                      className="sr-only"
                                    />
                                    <div className="flex items-start gap-3">
                                      <div className={cn(
                                        "mt-1 flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                                        field.value === opt.value
                                          ? "bg-blue-600 text-white"
                                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                                      )}>
                                        {familiarityIcons[opt.value]}
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-900 dark:text-gray-100">
                                          {opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                          {opt.label}
                                        </div>
                                      </div>
                                      {field.value === opt.value && (
                                        <Check className="h-5 w-5 text-blue-600" />
                                      )}
                                    </div>
                                  </label>
                                ))}
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                  )}

                  {currentStep === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <FormField
                        control={form.control}
                        name="mainGoals"
                        render={() => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-base font-semibold">
                              What are your main goals? (Select all that apply)
                            </FormLabel>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {GOAL_OPTIONS.map((goal) => (
                                <FormField
                                  key={goal.value}
                                  control={form.control}
                                  name="mainGoals"
                                  render={({ field }) => {
                                    const isChecked = (field.value || []).includes(goal.value);
                                    return (
                                      <FormItem key={goal.value}>
                                        <FormControl>
                                          <label
                                            className={cn(
                                              "flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all hover:bg-accent/50",
                                              isChecked
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                                : "border-gray-200 dark:border-gray-700"
                                            )}
                                          >
                                            <Checkbox
                                              checked={isChecked}
                                              onCheckedChange={(checked: CheckedState) => {
                                                const current = new Set(field.value || []);
                                                if (checked === true) current.add(goal.value);
                                                else current.delete(goal.value);
                                                field.onChange(Array.from(current));
                                              }}
                                              className="sr-only"
                                            />
                                            <div className={cn(
                                              "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                                              isChecked
                                                ? "bg-blue-600 text-white"
                                                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                                            )}>
                                              {goalIcons[goal.value] || <Target className="h-5 w-5" />}
                                            </div>
                                            <span className="flex-1 text-sm font-medium">
                                              {goal.label}
                                            </span>
                                            {isChecked && (
                                              <Check className="h-5 w-5 text-blue-600" />
                                            )}
                                          </label>
                                        </FormControl>
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
                    </motion.div>
                  )}

                  {currentStep === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-base font-semibold">
                              Which role best describes you?
                            </FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="grid grid-cols-1 md:grid-cols-2 gap-3"
                              >
                                {ROLE_OPTIONS.map((opt) => (
                                  <label
                                    key={opt.value}
                                    htmlFor={`role-${opt.value}`}
                                    className={cn(
                                      "relative flex cursor-pointer rounded-lg border-2 p-4 hover:bg-accent/50 transition-all",
                                      field.value === opt.value
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                        : "border-gray-200 dark:border-gray-700"
                                    )}
                                  >
                                    <RadioGroupItem
                                      value={opt.value}
                                      id={`role-${opt.value}`}
                                      className="sr-only"
                                    />
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                                        field.value === opt.value
                                          ? "bg-blue-600 text-white"
                                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                                      )}>
                                        {roleIcons[opt.value] || <Briefcase className="h-5 w-5" />}
                                      </div>
                                      <span className="flex-1 text-sm font-medium">
                                        {opt.label}
                                      </span>
                                      {field.value === opt.value && (
                                        <Check className="h-5 w-5 text-blue-600" />
                                      )}
                                    </div>
                                  </label>
                                ))}
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                  )}

                  {currentStep === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <FormField
                        control={form.control}
                        name="industries"
                        render={() => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-base font-semibold">
                              Which industries excite you? (Select all that apply)
                            </FormLabel>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {INDUSTRY_OPTIONS.map((industry) => (
                                <FormField
                                  key={industry.value}
                                  control={form.control}
                                  name="industries"
                                  render={({ field }) => {
                                    const isChecked = (field.value || []).includes(industry.value);
                                    return (
                                      <FormItem key={industry.value}>
                                        <FormControl>
                                          <label
                                            className={cn(
                                              "flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all hover:bg-accent/50",
                                              isChecked
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                                : "border-gray-200 dark:border-gray-700"
                                            )}
                                          >
                                            <Checkbox
                                              checked={isChecked}
                                              onCheckedChange={(checked: CheckedState) => {
                                                const current = new Set(field.value || []);
                                                if (checked === true) current.add(industry.value);
                                                else current.delete(industry.value);
                                                field.onChange(Array.from(current));
                                              }}
                                              className="sr-only"
                                            />
                                            <div className={cn(
                                              "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                                              isChecked
                                                ? "bg-blue-600 text-white"
                                                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                                            )}>
                                              {industryIcons[industry.value] || <Building2 className="h-5 w-5" />}
                                            </div>
                                            <span className="flex-1 text-sm font-medium">
                                              {industry.label}
                                            </span>
                                            {isChecked && (
                                              <Check className="h-5 w-5 text-blue-600" />
                                            )}
                                          </label>
                                        </FormControl>
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
                    </motion.div>
                  )}

                  {currentStep === 5 && (
                    <motion.div
                      key="step5"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <FormItem className="space-y-4">
                        <FormLabel className="text-base font-semibold">
                          What technologies would you like to explore?
                        </FormLabel>
                        
                        {/* AI Technologies */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-blue-600" />
                            AI-based Technologies
                          </h3>
                          {AI_TECH_CATEGORIES.map((cat) => (
                            <div key={cat.id} className="space-y-2">
                              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                {cat.label}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {cat.items.map((tech) => (
                                  <FormField
                                    key={tech.value}
                                    control={form.control}
                                    name="aiTools"
                                    render={({ field }) => {
                                      const isChecked = (field.value || []).includes(tech.value as any);
                                      return (
                                        <FormItem key={tech.value}>
                                          <FormControl>
                                            <label
                                              className={cn(
                                                "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all hover:bg-accent/50",
                                                isChecked
                                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                                  : "border-gray-200 dark:border-gray-700"
                                              )}
                                            >
                                              <Checkbox
                                                checked={isChecked}
                                                onCheckedChange={(checked: CheckedState) => {
                                                  const current = new Set(field.value || []);
                                                  if (checked === true) current.add(tech.value);
                                                  else current.delete(tech.value);
                                                  field.onChange(Array.from(current));
                                                }}
                                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                              />
                                              <span className="text-xs font-medium flex-1">
                                                {tech.label}
                                              </span>
                                            </label>
                                          </FormControl>
                                        </FormItem>
                                      );
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Non-AI Technologies */}
                        <div className="space-y-4 pt-4">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-blue-600" />
                            Traditional Technologies
                          </h3>
                          {NON_AI_TECH_CATEGORIES.map((cat) => (
                            <div key={cat.id} className="space-y-2">
                              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                {cat.label}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {cat.items.map((tech) => (
                                  <FormField
                                    key={tech.value}
                                    control={form.control}
                                    name="nonAiTools"
                                    render={({ field }) => {
                                      const isChecked = (field.value || []).includes(tech.value as any);
                                      return (
                                        <FormItem key={tech.value}>
                                          <FormControl>
                                            <label
                                              className={cn(
                                                "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all hover:bg-accent/50",
                                                isChecked
                                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                                  : "border-gray-200 dark:border-gray-700"
                                              )}
                                            >
                                              <Checkbox
                                                checked={isChecked}
                                                onCheckedChange={(checked: CheckedState) => {
                                                  const current = new Set(field.value || []);
                                                  if (checked === true) current.add(tech.value);
                                                  else current.delete(tech.value);
                                                  field.onChange(Array.from(current));
                                                }}
                                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                              />
                                              <span className="text-xs font-medium flex-1">
                                                {tech.label}
                                              </span>
                                            </label>
                                          </FormControl>
                                        </FormItem>
                                      );
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </FormItem>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex justify-between items-center pt-6 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={goToPrevious}
                    disabled={currentStep === 1}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  {currentStep < totalSteps ? (
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={!canProceedFromStep(currentStep)}
                      className="gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleFinalizeSubmit}
                      disabled={isSubmitting || !canProceedFromStep(currentStep)}
                      className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Completing...
                        </>
                      ) : (
                        <>
                          Complete Setup
                          <Check className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Skip option */}
        <div className="text-center mt-6">
          <Button
            variant="link"
            onClick={() => router.push(returnUrl)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Skip for now →
          </Button>
        </div>
      </div>
    </div>
  );
}
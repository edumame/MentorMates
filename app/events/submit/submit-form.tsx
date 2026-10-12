"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, CheckCircle2, Pencil } from "lucide-react";

const LOCATION_OPTIONS = [
  "SF & Bay Area",
  "NYC",
  "Los Angeles",
  "Hong Kong",
  "Southeast Asia",
  "Remote",
  "Other",
];

const BLURB_MAX = 1000;

type FormValues = {
  submitterName: string;
  email: string;
  affiliation: string;
  eventName: string;
  link: string;
  blurb: string;
  startDt: string;
  endDt: string;
  location: string;
  expectedAttendance: string;
  wantFeatured: boolean;
};

const EMPTY_VALUES: FormValues = {
  submitterName: "",
  email: "",
  affiliation: "",
  eventName: "",
  link: "",
  blurb: "",
  startDt: "",
  endDt: "",
  location: "",
  expectedAttendance: "",
  wantFeatured: false,
};

type Step = {
  title: string;
  subtitle: string;
  validate: (v: FormValues) => string | null;
};

const STEPS: Step[] = [
  {
    title: "About you",
    subtitle: "So we can reach out once your event is reviewed.",
    validate: (v) => {
      if (!v.submitterName.trim()) return "Please enter your name.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()))
        return "Please enter a valid email address.";
      return null;
    },
  },
  {
    title: "Your event",
    subtitle: "Tell us what you're hosting and where people can find it.",
    validate: (v) => {
      if (v.eventName.trim().length < 3)
        return "Event name must be at least 3 characters.";
      try {
        const url = new URL(v.link.trim());
        if (!/^https?:$/.test(url.protocol)) throw new Error();
      } catch {
        return "Please enter a valid link (starting with https://).";
      }
      return null;
    },
  },
  {
    title: "Logistics",
    subtitle: "When and where it's happening, and how big you expect it to be.",
    validate: (v) => {
      if (!v.startDt) return "Please pick a start date and time.";
      if (!v.endDt) return "Please pick an end date and time.";
      if (new Date(v.endDt).getTime() < new Date(v.startDt).getTime())
        return "End must be on or after start.";
      if (!v.location.trim()) return "Please enter a location.";
      if (v.expectedAttendance.trim()) {
        const n = Number(v.expectedAttendance);
        if (!Number.isInteger(n) || n <= 0)
          return "Expected attendance must be a positive whole number.";
      }
      return null;
    },
  },
];

const REVIEW_STEP = STEPS.length;
const TOTAL_SCREENS = STEPS.length + 1; // steps + review

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

export function SubmitEventForm() {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  const isSubmitting = state.status === "submitting";

  // Prefill name/email for signed-in users; the form stays open to everyone.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      setValues((prev) => ({
        ...prev,
        email: prev.email || user.email || "",
        submitterName:
          prev.submitterName ||
          (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined) ||
          "",
      }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setStepError(null);
  };

  const goNext = () => {
    if (step < STEPS.length) {
      const error = STEPS[step].validate(values);
      if (error) {
        setStepError(error);
        return;
      }
    }
    setDirection(1);
    setStepError(null);
    setStep((s) => Math.min(s + 1, REVIEW_STEP));
  };

  const goBack = () => {
    setDirection(-1);
    setStepError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const goToStep = (target: number) => {
    setDirection(target > step ? 1 : -1);
    setStepError(null);
    setStep(target);
  };

  async function handleSubmit() {
    setState({ status: "submitting" });
    try {
      const res = await fetch("/api/events/public-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitter_name: values.submitterName.trim(),
          email: values.email.trim(),
          affiliation: values.affiliation.trim() || undefined,
          event_name: values.eventName.trim(),
          event_blurb: values.blurb.trim() || undefined,
          start_datetime: new Date(values.startDt).toISOString(),
          end_datetime: new Date(values.endDt).toISOString(),
          location: values.location.trim(),
          link: values.link.trim(),
          expected_attendance: values.expectedAttendance.trim()
            ? Number(values.expectedAttendance)
            : null,
          want_featured: values.wantFeatured,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setState({
          status: "error",
          message: body.error ?? "Something went wrong. Please try again.",
        });
        return;
      }

      setState({ status: "success" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  const progress = useMemo(
    () => ((step + 1) / TOTAL_SCREENS) * 100,
    [step]
  );

  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h2 className="mt-4 font-geist text-[22px] font-semibold tracking-[-0.5%] text-black">
          Submission received
        </h2>
        <p className="mt-2 text-[14px] text-[rgba(0,0,0,0.65)]">
          Thanks, {values.submitterName.trim().split(" ")[0] || "there"}. An
          admin will review{" "}
          <span className="font-medium text-black">{values.eventName}</span> and
          reach out to{" "}
          <span className="font-medium text-black">{values.email}</span> once
          approved.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setValues(EMPTY_VALUES);
            setStep(0);
            setState({ status: "idle" });
          }}
        >
          Submit another event
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white shadow-sm overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 w-full bg-[rgba(0,0,0,0.06)]">
        <motion.div
          className="h-full bg-[#4B89EF]"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>

      <div className="p-6 sm:p-8">
        {/* Step header */}
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium uppercase tracking-wide text-[rgba(0,0,0,0.45)]">
            Step {Math.min(step + 1, TOTAL_SCREENS)} of {TOTAL_SCREENS}
          </p>
          {step > 0 && (
            <button
              type="button"
              onClick={goBack}
              disabled={isSubmitting}
              className="flex items-center gap-1 text-[13px] font-medium text-[rgba(0,0,0,0.55)] hover:text-black transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
        </div>

        {/* -mx/-mb offset the inner p-2 that keeps input focus rings inside the overflow clip */}
        <div className="relative mt-2 -mx-2 -mb-2 overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              className="p-2"
              initial={{ opacity: 0, x: direction * 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -32 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {step < STEPS.length ? (
                <>
                  <h2 className="font-geist text-[24px] font-semibold tracking-[-0.03em] text-black">
                    {STEPS[step].title}
                  </h2>
                  <p className="mt-1 text-[14px] text-[rgba(0,0,0,0.55)]">
                    {STEPS[step].subtitle}
                  </p>
                  <form
                    className="mt-6 space-y-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      goNext();
                    }}
                  >
                    {step === 0 && (
                      <AboutYouFields
                        values={values}
                        set={set}
                        disabled={isSubmitting}
                      />
                    )}
                    {step === 1 && (
                      <EventFields
                        values={values}
                        set={set}
                        disabled={isSubmitting}
                      />
                    )}
                    {step === 2 && (
                      <LogisticsFields
                        values={values}
                        set={set}
                        disabled={isSubmitting}
                      />
                    )}

                    {stepError && (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                        {stepError}
                      </div>
                    )}

                    <Button type="submit" className="w-full gap-2">
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                </>
              ) : (
                <ReviewScreen
                  values={values}
                  isSubmitting={isSubmitting}
                  errorMessage={
                    state.status === "error" ? state.message : null
                  }
                  onEdit={goToStep}
                  onSubmit={handleSubmit}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

type FieldGroupProps = {
  values: FormValues;
  set: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  disabled: boolean;
};

function AboutYouFields({ values, set, disabled }: FieldGroupProps) {
  return (
    <>
      <Field id="submitter-name" label="Your name" required>
        <Input
          id="submitter-name"
          type="text"
          placeholder="Ada Lovelace"
          required
          value={values.submitterName}
          onChange={(e) => set("submitterName", e.target.value)}
          disabled={disabled}
          autoFocus
        />
      </Field>

      <Field id="submitter-email" label="Email" required>
        <Input
          id="submitter-email"
          type="email"
          placeholder="you@example.com"
          required
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          disabled={disabled}
        />
      </Field>

      <Field
        id="affiliation"
        label="University / company affiliation"
        hint="Helps us review your event faster."
      >
        <Input
          id="affiliation"
          type="text"
          placeholder="e.g. Stanford University, Anthropic, independent"
          value={values.affiliation}
          onChange={(e) => set("affiliation", e.target.value)}
          disabled={disabled}
        />
      </Field>
    </>
  );
}

function EventFields({ values, set, disabled }: FieldGroupProps) {
  return (
    <>
      <Field id="event-name" label="Event name" required>
        <Input
          id="event-name"
          type="text"
          placeholder="The name of your event"
          required
          value={values.eventName}
          onChange={(e) => set("eventName", e.target.value)}
          disabled={disabled}
          autoFocus
        />
      </Field>

      <Field
        id="link"
        label="Event link"
        required
        hint="Where attendees register — Luma, Devpost, Partiful, your own site."
      >
        <Input
          id="link"
          type="url"
          placeholder="https://luma.com/your-event"
          required
          value={values.link}
          onChange={(e) => set("link", e.target.value)}
          disabled={disabled}
        />
      </Field>

      <Field
        id="blurb"
        label="Short description"
        hint={`${values.blurb.length}/${BLURB_MAX} characters`}
      >
        <Textarea
          id="blurb"
          placeholder="One or two sentences about what makes your event worth attending."
          value={values.blurb}
          maxLength={BLURB_MAX}
          onChange={(e) => set("blurb", e.target.value)}
          disabled={disabled}
          className="min-h-[96px] resize-none"
        />
      </Field>
    </>
  );
}

function LogisticsFields({ values, set, disabled }: FieldGroupProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="start-dt" label="Start (PT)" required>
          <Input
            id="start-dt"
            type="datetime-local"
            required
            value={values.startDt}
            onChange={(e) => set("startDt", e.target.value)}
            disabled={disabled}
          />
        </Field>

        <Field id="end-dt" label="End (PT)" required>
          <Input
            id="end-dt"
            type="datetime-local"
            required
            value={values.endDt}
            onChange={(e) => set("endDt", e.target.value)}
            disabled={disabled}
          />
        </Field>
      </div>

      <Field id="location" label="Location" required>
        <Input
          id="location"
          type="text"
          list="location-suggestions"
          placeholder="e.g. San Francisco, Hong Kong, Remote"
          required
          value={values.location}
          onChange={(e) => set("location", e.target.value)}
          disabled={disabled}
          autoComplete="off"
        />
        <datalist id="location-suggestions">
          {LOCATION_OPTIONS.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </Field>

      <Field
        id="expected-attendance"
        label="Expected attendance"
        hint="Your best estimate is fine."
      >
        <Input
          id="expected-attendance"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          placeholder="e.g. 150"
          value={values.expectedAttendance}
          onChange={(e) => set("expectedAttendance", e.target.value)}
          disabled={disabled}
        />
      </Field>

      <div className="flex items-start gap-3 pt-1">
        <Checkbox
          id="want-featured"
          checked={values.wantFeatured}
          onCheckedChange={(v) => set("wantFeatured", v === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="grid gap-1 leading-tight">
          <Label
            htmlFor="want-featured"
            className="text-[14px] font-medium text-black"
          >
            Get featured
          </Label>
          <p className="text-[13px] text-[rgba(0,0,0,0.55)]">
            Ask for featured placement on the events calendar. We&apos;ll reach
            out to your email.
          </p>
        </div>
      </div>
    </>
  );
}

function ReviewScreen({
  values,
  isSubmitting,
  errorMessage,
  onEdit,
  onSubmit,
}: {
  values: FormValues;
  isSubmitting: boolean;
  errorMessage: string | null;
  onEdit: (step: number) => void;
  onSubmit: () => void;
}) {
  const formatDt = (v: string) =>
    v
      ? new Date(v).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "—";

  const sections: { step: number; title: string; rows: [string, string][] }[] = [
    {
      step: 0,
      title: "About you",
      rows: [
        ["Name", values.submitterName],
        ["Email", values.email],
        ["Affiliation", values.affiliation || "—"],
      ],
    },
    {
      step: 1,
      title: "Your event",
      rows: [
        ["Event name", values.eventName],
        ["Link", values.link],
        ["Description", values.blurb || "—"],
      ],
    },
    {
      step: 2,
      title: "Logistics",
      rows: [
        ["Start", formatDt(values.startDt)],
        ["End", formatDt(values.endDt)],
        ["Location", values.location],
        ["Expected attendance", values.expectedAttendance || "—"],
        ["Featured request", values.wantFeatured ? "Yes" : "No"],
      ],
    },
  ];

  return (
    <>
      <h2 className="font-geist text-[24px] font-semibold tracking-[-0.03em] text-black">
        Review &amp; submit
      </h2>
      <p className="mt-1 text-[14px] text-[rgba(0,0,0,0.55)]">
        Double-check the details — an admin will review your submission and
        reach out by email.
      </p>

      <div className="mt-6 space-y-4">
        {sections.map((section) => (
          <div
            key={section.step}
            className="rounded-xl border border-[rgba(0,0,0,0.08)] p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[rgba(0,0,0,0.45)]">
                {section.title}
              </h3>
              <button
                type="button"
                onClick={() => onEdit(section.step)}
                disabled={isSubmitting}
                className="flex items-center gap-1 text-[13px] font-medium text-[#4B89EF] hover:text-[#3B79DF] transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            </div>
            <dl className="mt-3 space-y-2">
              {section.rows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-4"
                >
                  <dt className="shrink-0 text-[13px] text-[rgba(0,0,0,0.55)]">
                    {label}
                  </dt>
                  <dd className="min-w-0 break-words text-right text-[14px] font-medium text-black">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {errorMessage}
        </div>
      )}

      <Button
        onClick={onSubmit}
        disabled={isSubmitting}
        className="mt-6 w-full"
      >
        {isSubmitting ? "Submitting…" : "Submit event"}
      </Button>
    </>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-[13px] font-medium text-black">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-[12px] text-[rgba(0,0,0,0.45)]">{hint}</p>}
    </div>
  );
}

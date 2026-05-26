"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2 } from "lucide-react";

const LOCATION_OPTIONS = [
  "SF & Bay Area",
  "NYC",
  "Los Angeles",
  "Hong Kong",
  "Southeast Asia",
  "Remote",
  "Other",
];

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

export function SubmitEventForm() {
  const [email, setEmail] = useState("");
  const [eventName, setEventName] = useState("");
  const [startDt, setStartDt] = useState("");
  const [endDt, setEndDt] = useState("");
  const [location, setLocation] = useState("");
  const [link, setLink] = useState("");
  const [wantFeatured, setWantFeatured] = useState(false);
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  const isSubmitting = state.status === "submitting";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: "submitting" });

    try {
      const res = await fetch("/api/events/public-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          event_name: eventName,
          start_datetime: new Date(startDt).toISOString(),
          end_datetime: new Date(endDt).toISOString(),
          location,
          link,
          want_featured: wantFeatured,
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

  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h2 className="mt-4 font-geist text-[22px] font-semibold tracking-[-0.5%] text-black">
          Submission received
        </h2>
        <p className="mt-2 text-[14px] text-[rgba(0,0,0,0.65)]">
          Thanks. An admin will review your event and reach out to{" "}
          <span className="font-medium text-black">{email}</span> once approved.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setEmail("");
            setEventName("");
            setStartDt("");
            setEndDt("");
            setLocation("");
            setLink("");
            setWantFeatured(false);
            setState({ status: "idle" });
          }}
        >
          Submit another event
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field id="submitter-email" label="Email" required>
        <Input
          id="submitter-email"
          type="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
        />
      </Field>

      <Field id="event-name" label="Event Name" required>
        <Input
          id="event-name"
          type="text"
          placeholder="The name of your event"
          required
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          disabled={isSubmitting}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="start-dt" label="Start Date/Time (PT)" required>
          <Input
            id="start-dt"
            type="datetime-local"
            required
            value={startDt}
            onChange={(e) => setStartDt(e.target.value)}
            disabled={isSubmitting}
          />
        </Field>

        <Field id="end-dt" label="End Date/Time (PT)" required>
          <Input
            id="end-dt"
            type="datetime-local"
            required
            value={endDt}
            onChange={(e) => setEndDt(e.target.value)}
            disabled={isSubmitting}
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
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={isSubmitting}
          autoComplete="off"
        />
        <datalist id="location-suggestions">
          {LOCATION_OPTIONS.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </Field>

      <Field id="link" label="Link" required>
        <Input
          id="link"
          type="url"
          placeholder="https://luma.com/your-event"
          required
          value={link}
          onChange={(e) => setLink(e.target.value)}
          disabled={isSubmitting}
        />
      </Field>

      <div className="flex items-start gap-3 pt-1">
        <Checkbox
          id="want-featured"
          checked={wantFeatured}
          onCheckedChange={(v) => setWantFeatured(v === true)}
          disabled={isSubmitting}
          className="mt-0.5"
        />
        <div className="grid gap-1 leading-tight">
          <Label htmlFor="want-featured" className="text-[14px] font-medium text-black">
            Get Featured
          </Label>
          <p className="text-[13px] text-[rgba(0,0,0,0.55)]">
            Feature your event. We&apos;ll reach out to your submitted email.
          </p>
        </div>
      </div>

      {state.status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {state.message}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Submitting…" : "Submit"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-[13px] font-medium text-black">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
    </div>
  );
}

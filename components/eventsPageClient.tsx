"use client";

import { useState, useMemo } from "react";
import { EventsList } from "@/components/events/events-list";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EventItem, EventVisibility } from "@/lib/types";
import { UI_TEXT, DEFAULT_VALUES } from "@/lib/config/constants";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/lib/hooks/use-toast";

export function EventsPageClient({ eventsList, isAdmin }: { eventsList: EventItem[]; isAdmin?: boolean }) {
  const [searchTerm, setSearchTerm] = useState(DEFAULT_VALUES.SEARCH_TERM);
  const [hidePaid, setHidePaid] = useState(false);
  const { toast } = useToast();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    event_name: "",
    event_date: "",
    location: "",
    visibility: EventVisibility.Draft,
    slug: "",
    event_description: "",
    event_blurb: "",
    cover_image_url: "",
    organizer_emails: "",
  });

  const onChange = (key: keyof typeof form, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleCreate = async () => {
    // basic front-end validation
    if (!form.event_name || !form.event_date || !form.location) {
      toast({ title: "Missing fields", description: "Name, date, and location are required.", variant: "destructive" });
      return;
    }
    const organizerEmails = (form.organizer_emails || "").split(",").map((e) => e.trim()).filter(Boolean);
    setCreating(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: {
            event_name: form.event_name,
            event_date: form.event_date,
            location: form.location,
            visibility: form.visibility,
            slug: form.slug || undefined,
            event_description: form.event_description || undefined,
            event_blurb: form.event_blurb || undefined,
            cover_image_url: form.cover_image_url || undefined,
          },
          organizerEmails,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Create failed", description: data.error || "Error creating event.", variant: "destructive" });
        return;
      }
      toast({ title: "Event created", description: `${data.event.event_name} created successfully.` });
      // reset
      setForm({
        event_name: "",
        event_date: "",
        location: "",
        visibility: EventVisibility.Draft,
        slug: "",
        event_description: "",
        event_blurb: "",
        cover_image_url: "",
        organizer_emails: "",
      });
    } catch (_err) {
      toast({ title: "Network error", description: "Unable to create event.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const filteredEvents = useMemo(() => {
    return eventsList.filter((event) =>
      event.event_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [eventsList, searchTerm]);

  const visibleEvents = useMemo(() => {
    if (!hidePaid) return filteredEvents;
    return filteredEvents.filter((event) => event.paid !== true);
  }, [filteredEvents, hidePaid]);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-6 sm:py-8">
      <div className="relative w-full mb-6 sm:mb-8">
        <Input
          type="text"
          placeholder={UI_TEXT.SEARCH_PLACEHOLDER}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10"
        />
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <div className="flex justify-between items-center mb-6 gap-4 flex-col sm:flex-row">
        {isAdmin ? (
          <div className="w-full border rounded-md p-4 bg-card">
            <h3 className="text-lg font-semibold mb-3">Create Event</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Event Name</label>
                <Input value={form.event_name} onChange={(e) => onChange("event_name", e.target.value)} placeholder="My Hackathon" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Event Date</label>
                <Input type="datetime-local" value={form.event_date} onChange={(e) => onChange("event_date", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Location</label>
                <Input value={form.location} onChange={(e) => onChange("location", e.target.value)} placeholder="City, Venue or Remote" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Visibility</label>
                <Select value={form.visibility} onValueChange={(v) => onChange("visibility", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EventVisibility.Draft}>Draft</SelectItem>
                    <SelectItem value={EventVisibility.Private}>Private</SelectItem>
                    <SelectItem value={EventVisibility.Public}>Public</SelectItem>
                    <SelectItem value={EventVisibility.Demo}>Demo</SelectItem>
                    <SelectItem value={EventVisibility.Test}>Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium">Slug (optional)</label>
                <Input value={form.slug} onChange={(e) => onChange("slug", e.target.value)} placeholder="my-hackathon-2025" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium">Blurb (optional)</label>
                <Input value={form.event_blurb} onChange={(e) => onChange("event_blurb", e.target.value)} placeholder="Short description shown in cards" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium">Description (optional)</label>
                <Textarea rows={4} value={form.event_description} onChange={(e) => onChange("event_description", e.target.value)} placeholder="Long description or markdown" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium">Cover Image URL (optional)</label>
                <Input value={form.cover_image_url} onChange={(e) => onChange("cover_image_url", e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium">Organizer Emails (comma separated)</label>
                <Input value={form.organizer_emails} onChange={(e) => onChange("organizer_emails", e.target.value)} placeholder="alice@example.com, bob@example.com" />
              </div>
            </div>
            <div className="mt-3">
              <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating..." : "Create Event"}</Button>
            </div>
          </div>
        ) : null }
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Hide Paid</span>
          <Switch checked={hidePaid} onCheckedChange={setHidePaid} />
        </div>
      </div>

      {visibleEvents.length > 0 ? (
        <EventsList events={visibleEvents} />
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg
            className="h-16 w-16 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No events found
          </h3>
          <p className="text-gray-500 max-w-sm">
            {searchTerm
              ? `No events match your search "${searchTerm}". Try adjusting your search terms.`
              : UI_TEXT.NO_EVENTS_FOUND}
          </p>
        </div>
      )}
    </div>
  );
}

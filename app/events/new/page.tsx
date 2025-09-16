"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { EventVisibility } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/lib/hooks/use-toast";

export default function NewEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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

  useEffect(() => {
    const checkAccess = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.push("/login");
        return;
      }
      const userId = sessionData.session.user.id;
      const { data: adminData } = await supabase.rpc("is_admin_user", { user_id: userId });
      if (!adminData) {
        router.push("/events");
        return;
      }
      setIsAdmin(true);
      setLoading(false);
    };
    checkAccess();
  }, [router]);

  const handleCreate = async () => {
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
      router.push(`/events/${data.event.slug || data.event.event_id}/overview`);
    } catch (_err) {
      toast({ title: "Network error", description: "Unable to create event.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">Loading...</h1>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Create Event</h1>
      <div className="grid gap-4">
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
        <div className="space-y-1">
          <label className="text-sm font-medium">Slug (optional)</label>
          <Input value={form.slug} onChange={(e) => onChange("slug", e.target.value)} placeholder="my-hackathon-2025" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Blurb (optional)</label>
          <Input value={form.event_blurb} onChange={(e) => onChange("event_blurb", e.target.value)} placeholder="Short description shown in cards" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Description (optional)</label>
          <Textarea rows={5} value={form.event_description} onChange={(e) => onChange("event_description", e.target.value)} placeholder="Long description or markdown" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Cover Image URL (optional)</label>
          <Input value={form.cover_image_url} onChange={(e) => onChange("cover_image_url", e.target.value)} placeholder="https://..." />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Organizer Emails (comma separated)</label>
          <Input value={form.organizer_emails} onChange={(e) => onChange("organizer_emails", e.target.value)} placeholder="alice@example.com, bob@example.com" />
        </div>
        <div className="pt-2">
          <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating..." : "Create Event"}</Button>
        </div>
      </div>
    </div>
  );
}


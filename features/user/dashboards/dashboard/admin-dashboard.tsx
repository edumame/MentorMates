//TODO: fix this page based on the event schema and the roles information
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Project, EventItem, FeedbackItem, EventVisibility } from "@/lib/types";
import { z } from "zod";
import { useToast } from "@/lib/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AdminDashboardProps {
  event?: EventItem;
}

interface MentorType {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface ExtendedFeedback extends FeedbackItem {
  project_name: string;
  project_description: string;
}

export function AdminDashboard({ event }: AdminDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [mentors, setMentors] = useState<MentorType[]>([]);
  const [feedback, setFeedback] = useState<ExtendedFeedback[]>([]);
  const { toast } = useToast();

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
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

  const onCreateChange = (key: keyof typeof createForm, value: string) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  };

  const createEventSchema = z.object({
    event_name: z.string().min(3),
    event_date: z.string().refine((v) => !Number.isNaN(Date.parse(v))),
    location: z.string().min(1),
    visibility: z.nativeEnum(EventVisibility),
    slug: z.string().optional(),
    event_description: z.string().optional(),
    event_blurb: z.string().optional(),
    cover_image_url: z.string().url().optional().or(z.literal("")),
    organizer_emails: z.string().optional(),
  });

  const handleCreateEvent = async () => {
    const parsed = createEventSchema.safeParse(createForm);
    if (!parsed.success) {
      toast({ title: "Invalid form", description: "Please fix validation errors.", variant: "destructive" });
      return;
    }

    const organizerEmails = (createForm.organizer_emails || "")
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    setCreating(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: {
            event_name: createForm.event_name,
            event_date: createForm.event_date,
            location: createForm.location,
            visibility: createForm.visibility,
            slug: createForm.slug || undefined,
            event_description: createForm.event_description || undefined,
            event_blurb: createForm.event_blurb || undefined,
            cover_image_url: createForm.cover_image_url || undefined,
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
      // Reset form
      setCreateForm({
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
    } catch (e) {
      toast({ title: "Network error", description: "Unable to create event.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const fetchProjects = useCallback(async () => {
    const query = supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (event) {
      query.eq("event_id", event.event_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching projects:", error);
    } else {
      setProjects(data || []);
    }
  }, [event]);

  const fetchMentors = useCallback(async () => {
    const { data, error } = await supabase
      .from("mentors")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching mentors:", error);
    } else {
      setMentors(data || []);
    }
  }, []);

  const fetchFeedbackWithProjects = useCallback(async () => {
    const query = supabase
      .from("feedback")
      .select(
        `
        *,
        projects:project_id (
          project_name,
          project_description
        )
      `
      )
      .order("created_at", { ascending: false });

    if (event) {
      query.eq("projects.event_id", event.event_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching feedback:", error);
    } else {
      const formattedData =
        data?.map((item) => ({
          ...item,
          project_name: item.projects.project_name,
          project_description: item.projects.project_description,
        })) || [];
      setFeedback(formattedData);
    }
  }, [event]);

  useEffect(() => {
    fetchProjects();
    fetchMentors();
    fetchFeedbackWithProjects();
  }, [fetchProjects, fetchMentors, fetchFeedbackWithProjects]);

  return (
    <Tabs defaultValue="projects" className="space-y-4">
      <TabsList>
        <TabsTrigger value="projects">Projects</TabsTrigger>
        <TabsTrigger value="events">Events</TabsTrigger>
        <TabsTrigger value="mentors">Mentors</TabsTrigger>
        <TabsTrigger value="feedback">Feedback</TabsTrigger>
      </TabsList>

      <TabsContent value="projects">
        <h2 className="text-2xl font-bold mb-4">
          {event ? `Projects for ${event.event_name}` : "All Projects"}
        </h2>
        <Table>
          <TableCaption>
            A list of {event ? "event" : "all"} projects.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Lead Name</TableHead>
              <TableHead>Lead Email</TableHead>
              <TableHead>Project Description</TableHead>
              <TableHead>Submitted At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>{project.project_name}</TableCell>
                <TableCell>{project.lead_name}</TableCell>
                <TableCell>{project.lead_email}</TableCell>
                <TableCell>{project.project_description}</TableCell>
                <TableCell>
                  {new Date(project.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="events">
        <h2 className="text-2xl font-bold mb-4">Create Event</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Event Name</label>
            <Input value={createForm.event_name} onChange={(e) => onCreateChange("event_name", e.target.value)} placeholder="My Hackathon" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Event Date</label>
            <Input type="datetime-local" value={createForm.event_date} onChange={(e) => onCreateChange("event_date", e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Location</label>
            <Input value={createForm.location} onChange={(e) => onCreateChange("location", e.target.value)} placeholder="City, Venue or Remote" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Visibility</label>
            <Select value={createForm.visibility} onValueChange={(v) => onCreateChange("visibility", v)}>
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
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Slug (optional)</label>
            <Input value={createForm.slug} onChange={(e) => onCreateChange("slug", e.target.value)} placeholder="my-hackathon-2025" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Blurb (optional)</label>
            <Input value={createForm.event_blurb} onChange={(e) => onCreateChange("event_blurb", e.target.value)} placeholder="Short description shown in cards" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea value={createForm.event_description} onChange={(e) => onCreateChange("event_description", e.target.value)} rows={5} placeholder="Long description or markdown" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Cover Image URL (optional)</label>
            <Input value={createForm.cover_image_url} onChange={(e) => onCreateChange("cover_image_url", e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Organizer Emails (comma separated)</label>
            <Input value={createForm.organizer_emails} onChange={(e) => onCreateChange("organizer_emails", e.target.value)} placeholder="alice@example.com, bob@example.com" />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={handleCreateEvent} disabled={creating}>
            {creating ? "Creating..." : "Create Event"}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="mentors">
        <h2 className="text-2xl font-bold mb-4">All Mentors</h2>
        <Table>
          <TableCaption>A list of all registered mentors.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Registered At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mentors.map((mentor) => (
              <TableRow key={mentor.id}>
                <TableCell>{mentor.name}</TableCell>
                <TableCell>{mentor.email}</TableCell>
                <TableCell>
                  {new Date(mentor.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="feedback">
        <h2 className="text-2xl font-bold mb-4">
          {event ? `Feedback for ${event.event_name}` : "All Feedback"}
        </h2>
        <Table>
          <TableCaption>
            A list of {event ? "event" : "all"} feedback.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Project Description</TableHead>
              <TableHead>Mentor Name</TableHead>
              <TableHead>Feedback</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Submitted At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedback.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.project_name}</TableCell>
                <TableCell>{item.project_description}</TableCell>
                <TableCell>{item.mentor_name}</TableCell>
                <TableCell>{item.feedback_text}</TableCell>
                <TableCell>{item.rating}</TableCell>
                <TableCell>
                  {new Date(item.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
  );
}

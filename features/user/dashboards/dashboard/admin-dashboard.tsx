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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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

  // Event creation form state
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventBlurb, setEventBlurb] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [visibility, setVisibility] = useState<EventVisibility>(EventVisibility.Draft);
  const [slug, setSlug] = useState("");
  const [submissionStart, setSubmissionStart] = useState("");
  const [submissionCutoff, setSubmissionCutoff] = useState("");
  const [organizerEmails, setOrganizerEmails] = useState("");

  const handleCreateEvent = useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const parsedEmails = organizerEmails
        .split(/[\n,]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0);

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName,
          eventDate,
          location: location || undefined,
          eventDescription: eventDescription || undefined,
          eventBlurb: eventBlurb || undefined,
          coverImageUrl: coverImageUrl || undefined,
          visibility,
          slug: slug || undefined,
          submissionTimeStart: submissionStart || undefined,
          submissionTimeCutoff: submissionCutoff || undefined,
          organizerEmails: parsedEmails,
        }),
      });

      if (res.status === 201) {
        const json = await res.json();
        setCreateSuccess(`Event created (ID: ${json.eventId}).`);
        // Clear form
        setEventName("");
        setEventDate("");
        setLocation("");
        setEventDescription("");
        setEventBlurb("");
        setCoverImageUrl("");
        setVisibility(EventVisibility.Draft);
        setSlug("");
        setSubmissionStart("");
        setSubmissionCutoff("");
        setOrganizerEmails("");
      } else if (res.status === 207) {
        const json = await res.json();
        setCreateSuccess("Event created, but failed to assign some organizers.");
        setCreateError(json.error || null);
      } else {
        const json = await res.json();
        setCreateError(json?.error || "Failed to create event");
      }
    } catch (e: any) {
      setCreateError(e?.message || "Unexpected error");
    } finally {
      setCreating(false);
    }
  }, [organizerEmails, eventName, eventDate, location, eventDescription, eventBlurb, coverImageUrl, visibility, slug, submissionStart, submissionCutoff]);

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
        <TabsTrigger value="mentors">Mentors</TabsTrigger>
        <TabsTrigger value="feedback">Feedback</TabsTrigger>
        <TabsTrigger value="events">Events</TabsTrigger>
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

      <TabsContent value="events">
        <h2 className="text-2xl font-bold mb-4">Create New Event</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Event Name</label>
              <Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="TreeHacks 2026" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Event Date</label>
              <Input value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder="2026-02-27" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Stanford University" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Event Blurb</label>
              <Textarea value={eventBlurb} onChange={(e) => setEventBlurb(e.target.value)} placeholder="Short teaser for the event" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Event Description</label>
              <Textarea value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder="Longer markdown description" />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Cover Image URL</label>
              <Input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Visibility</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as EventVisibility)}
              >
                <option value={EventVisibility.Draft}>Draft</option>
                <option value={EventVisibility.Public}>Public</option>
                <option value={EventVisibility.Private}>Private</option>
                <option value={EventVisibility.Demo}>Demo</option>
                <option value={EventVisibility.Test}>Test</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug (optional)</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="treehacks-2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Submission Start (ISO)</label>
                <Input value={submissionStart} onChange={(e) => setSubmissionStart(e.target.value)} placeholder="2026-02-28T00:00:00Z" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Submission Cutoff (ISO)</label>
                <Input value={submissionCutoff} onChange={(e) => setSubmissionCutoff(e.target.value)} placeholder="2026-03-01T00:00:00Z" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Organizer Emails (comma or newline separated)</label>
              <Textarea value={organizerEmails} onChange={(e) => setOrganizerEmails(e.target.value)} placeholder="alice@example.com, bob@example.com" />
            </div>
            <div className="pt-2">
              <Button onClick={handleCreateEvent} disabled={creating || !eventName || !eventDate}>
                {creating ? "Creating..." : "Create Event"}
              </Button>
            </div>
            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}
            {createSuccess && (
              <p className="text-sm text-green-700">{createSuccess}</p>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
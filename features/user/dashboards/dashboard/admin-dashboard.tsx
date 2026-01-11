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
import { SortableTableHeader } from "@/components/ui/sortable-table-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Project, EventItem, FeedbackItem } from "@/lib/types";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { useTableSort } from "@/lib/hooks/use-table-sort";

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

type ProjectSortField = "project_name" | "lead_name" | "lead_email" | "created_at";
type MentorSortField = "name" | "email" | "created_at";
type FeedbackSortField = "project_name" | "mentor_name" | "rating" | "created_at";

export function AdminDashboard({ event }: AdminDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [mentors, setMentors] = useState<MentorType[]>([]);
  const [feedback, setFeedback] = useState<ExtendedFeedback[]>([]);

  // Sort functions for each table
  const projectSortFn = useCallback(
    (a: Project, b: Project, field: ProjectSortField) => {
      switch (field) {
        case "project_name":
          return (a.project_name || "").localeCompare(b.project_name || "");
        case "lead_name":
          return (a.lead_name || "").localeCompare(b.lead_name || "");
        case "lead_email":
          return (a.lead_email || "").localeCompare(b.lead_email || "");
        case "created_at":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    },
    []
  );

  const mentorSortFn = useCallback(
    (a: MentorType, b: MentorType, field: MentorSortField) => {
      switch (field) {
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "email":
          return (a.email || "").localeCompare(b.email || "");
        case "created_at":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    },
    []
  );

  const feedbackSortFn = useCallback(
    (a: ExtendedFeedback, b: ExtendedFeedback, field: FeedbackSortField) => {
      switch (field) {
        case "project_name":
          return (a.project_name || "").localeCompare(b.project_name || "");
        case "mentor_name":
          return (a.mentor_name || "").localeCompare(b.mentor_name || "");
        case "rating":
          return (a.rating || 0) - (b.rating || 0);
        case "created_at":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    },
    []
  );

  // Sorting hooks for each table
  const {
    sortedData: sortedProjects,
    handleSort: handleProjectSort,
    getSortDirection: getProjectSortDirection,
  } = useTableSort(projects, { defaultField: "created_at" as ProjectSortField, defaultDirection: "desc" }, projectSortFn);

  const {
    sortedData: sortedMentors,
    handleSort: handleMentorSort,
    getSortDirection: getMentorSortDirection,
  } = useTableSort(mentors, { defaultField: "created_at" as MentorSortField, defaultDirection: "desc" }, mentorSortFn);

  const {
    sortedData: sortedFeedback,
    handleSort: handleFeedbackSort,
    getSortDirection: getFeedbackSortDirection,
  } = useTableSort(feedback, { defaultField: "created_at" as FeedbackSortField, defaultDirection: "desc" }, feedbackSortFn);

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
    <PageContainer>
      <PageContent className="px-[32px] pt-[24px]">
        <div className="flex flex-col gap-[48px] max-w-[1064px] mx-auto">
    <Tabs defaultValue="projects" className="space-y-4">
      <TabsList>
        <TabsTrigger value="projects">Projects</TabsTrigger>
        <TabsTrigger value="mentors">Mentors</TabsTrigger>
        <TabsTrigger value="feedback">Feedback</TabsTrigger>
      </TabsList>

      <TabsContent value="projects">
        <h2 className="text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black mb-4">
          {event ? `Projects for ${event.event_name}` : "All Projects"}
        </h2>
        <Table>
          <TableCaption>
            A list of {event ? "event" : "all"} projects.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <SortableTableHeader<ProjectSortField>
                field="project_name"
                label="Project Name"
                sortDirection={getProjectSortDirection("project_name")}
                onSort={handleProjectSort}
              />
              <SortableTableHeader<ProjectSortField>
                field="lead_name"
                label="Lead Name"
                sortDirection={getProjectSortDirection("lead_name")}
                onSort={handleProjectSort}
              />
              <SortableTableHeader<ProjectSortField>
                field="lead_email"
                label="Lead Email"
                sortDirection={getProjectSortDirection("lead_email")}
                onSort={handleProjectSort}
              />
              <TableHead>Project Description</TableHead>
              <SortableTableHeader<ProjectSortField>
                field="created_at"
                label="Submitted At"
                sortDirection={getProjectSortDirection("created_at")}
                onSort={handleProjectSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProjects.map((project) => (
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
        <h2 className="text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black mb-4">All Mentors</h2>
        <Table>
          <TableCaption>A list of all registered mentors.</TableCaption>
          <TableHeader>
            <TableRow>
              <SortableTableHeader<MentorSortField>
                field="name"
                label="Name"
                sortDirection={getMentorSortDirection("name")}
                onSort={handleMentorSort}
              />
              <SortableTableHeader<MentorSortField>
                field="email"
                label="Email"
                sortDirection={getMentorSortDirection("email")}
                onSort={handleMentorSort}
              />
              <SortableTableHeader<MentorSortField>
                field="created_at"
                label="Registered At"
                sortDirection={getMentorSortDirection("created_at")}
                onSort={handleMentorSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMentors.map((mentor) => (
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
        <h2 className="text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black mb-4">
          {event ? `Feedback for ${event.event_name}` : "All Feedback"}
        </h2>
        <Table>
          <TableCaption>
            A list of {event ? "event" : "all"} feedback.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <SortableTableHeader<FeedbackSortField>
                field="project_name"
                label="Project Name"
                sortDirection={getFeedbackSortDirection("project_name")}
                onSort={handleFeedbackSort}
              />
              <TableHead>Project Description</TableHead>
              <SortableTableHeader<FeedbackSortField>
                field="mentor_name"
                label="Mentor Name"
                sortDirection={getFeedbackSortDirection("mentor_name")}
                onSort={handleFeedbackSort}
              />
              <TableHead>Feedback</TableHead>
              <SortableTableHeader<FeedbackSortField>
                field="rating"
                label="Rating"
                sortDirection={getFeedbackSortDirection("rating")}
                onSort={handleFeedbackSort}
              />
              <SortableTableHeader<FeedbackSortField>
                field="created_at"
                label="Submitted At"
                sortDirection={getFeedbackSortDirection("created_at")}
                onSort={handleFeedbackSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedFeedback.map((item) => (
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
        </div>
      </PageContent>
    </PageContainer>
  );
}

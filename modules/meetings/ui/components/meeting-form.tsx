import { MeetingGetOne } from "../../types";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { meetingsInsertSchema } from "@/modules/meetings/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { CommandSelect } from "@/components/command-select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

interface MeetingFormProps {
    onSuccess?: (id?: string) => void;
    onCancel?: () => void;
    initialValues?: MeetingGetOne;
}

interface EventOption {
    event_id: string;
    event_name: string;
}

interface ProjectOption {
    id: string;
    project_name: string | null;
}

export const MeetingForm = ({ onSuccess, onCancel, initialValues } : MeetingFormProps) => {
    const trpc = useTRPC();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { session } = useAuth();

    const [agentSearch, setAgentSearch] = useState("");
    const [eventSearch, setEventSearch] = useState("");
    const [projectSearch, setProjectSearch] = useState("");
    const [events, setEvents] = useState<EventOption[]>([]);
    const [projects, setProjects] = useState<ProjectOption[]>([]);

    const agents = useQuery(trpc.agents.getMany.queryOptions({ pageSize: 100, search: agentSearch }));

    // Fetch user events
    const fetchEvents = useCallback(async () => {
        if (!session?.user?.id) return;
        
        try {
            const { data: userRoles, error: rolesError } = await supabase
                .from("user_event_roles")
                .select("event_id, events:event_id (event_id, event_name)")
                .eq("user_id", session.user.id);

            if (rolesError) throw rolesError;

            const eventOptions: EventOption[] = [];
            for (const role of userRoles || []) {
                const eventsData = role.events as unknown;
                let event: { event_id: string; event_name: string } | null = null;
                
                if (Array.isArray(eventsData) && eventsData.length > 0) {
                    event = eventsData[0] as { event_id: string; event_name: string };
                } else if (eventsData && typeof eventsData === 'object' && 'event_id' in eventsData) {
                    event = eventsData as { event_id: string; event_name: string };
                }
                
                if (event) {
                    eventOptions.push({ event_id: event.event_id, event_name: event.event_name });
                }
            }

            eventOptions.sort((a, b) => a.event_name.localeCompare(b.event_name));
            setEvents(eventOptions);
        } catch (error) {
            console.error("Error fetching events:", error);
            toast.error("Failed to load events");
        }
    }, [session]);

    // Fetch projects for selected event or all user projects
    const fetchProjects = useCallback(async (eventId?: string) => {
        if (!session?.user?.email) return;

        try {
            let projectsQuery = supabase
                .from("projects")
                .select("id, project_name, event_id, lead_email, teammates")
                .eq("submitted", true);

            if (eventId) {
                projectsQuery = projectsQuery.eq("event_id", eventId);
            }

            const { data: projectsData, error: projectsError } = await projectsQuery;

            if (projectsError) throw projectsError;

            // Filter projects where user is lead or teammate
            const userProjects = (projectsData || []).filter((project) => {
                const isLead = project.lead_email === session.user.email;
                const isTeammate = project.teammates?.includes(session.user.email || "");
                return isLead || isTeammate;
            });

            const projectOptions: ProjectOption[] = userProjects.map((p) => ({
                id: p.id,
                project_name: p.project_name,
            }));

            setProjects(projectOptions);
        } catch (error) {
            console.error("Error fetching projects:", error);
            toast.error("Failed to load projects");
        }
    }, [session]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const form = useForm<z.infer<typeof meetingsInsertSchema>>({
        resolver: zodResolver(meetingsInsertSchema),
        defaultValues: {
            name: initialValues?.name ?? "",
            agentId: initialValues?.agent_id ?? "",
            eventId: initialValues?.event_id ?? undefined,
            projectId: initialValues?.project_id ?? "",
        },
    });

    const selectedEventId = form.watch("eventId");

    useEffect(() => {
        if (selectedEventId) {
            form.setValue("projectId", "");
            fetchProjects(selectedEventId);
        } else {
            fetchProjects();
        }
    }, [selectedEventId, fetchProjects, form]);

    const filteredEvents = useMemo(() => {
        const q = eventSearch.trim().toLowerCase();
        if (!q) return events;
        return events.filter((e) => e.event_name.toLowerCase().includes(q));
    }, [events, eventSearch]);

    const filteredProjects = useMemo(() => {
        const q = projectSearch.trim().toLowerCase();
        if (!q) return projects;
        return projects.filter((p) => (p.project_name || "").toLowerCase().includes(q));
    }, [projects, projectSearch]);

    const createMeeting = useMutation(trpc.meetings.create.mutationOptions({
        onSuccess: async (data) => {
            await queryClient.invalidateQueries(trpc.meetings.getMany.queryOptions({}));
            
            if (initialValues?.id) {
                await queryClient.invalidateQueries(trpc.meetings.getOne.queryOptions({ id: initialValues.id }))
            }
            onSuccess?.(data.id);
        },
        onError: (error) => {
            toast.error(error.message)

            if (error.data?.code === "FORBIDDEN") {
                router.push("/upgrade");
            }
        },
    }));

    const updateMeeting = useMutation(trpc.meetings.update.mutationOptions({
        onSuccess: async () => {
            await queryClient.invalidateQueries(trpc.meetings.getMany.queryOptions({}));

            if (initialValues?.id) {
                await queryClient.invalidateQueries(trpc.meetings.getOne.queryOptions({ id: initialValues.id }))
            }
            onSuccess?.();
        },
        onError: (error) => {
            toast.error(error.message)
        },
    }));

    const isEdit = !!initialValues?.id;
    const isPending = createMeeting.isPending || updateMeeting.isPending;

    const onSubmit = (values: z.infer<typeof meetingsInsertSchema>) => {
        if (isEdit) {
            updateMeeting.mutate({ ...values, id: initialValues.id });
        } else {
            createMeeting.mutate(values);
        }
    };

    return (
        <>
            <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                    <FormField
                        name="name"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="e.g. Financial Consultations" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {events.length > 1 && (
                        <FormField
                            name="eventId"
                            control={form.control}
                            render={({ field }) => (
                                <FormItem className="grid">
                                    <FormLabel>Event</FormLabel>
                                    <FormControl>
                                        <CommandSelect
                                            options={filteredEvents.map((event) => ({
                                                id: event.event_id,
                                                value: event.event_id,
                                                children: <span>{event.event_name}</span>
                                            }))}
                                            onSelect={field.onChange}
                                            onSearch={setEventSearch}
                                            value={field.value || ""}
                                            placeholder="Select an event"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                    <FormField
                        name="projectId"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem className="grid">
                                <FormLabel>Project</FormLabel>
                                <FormControl>
                                    <CommandSelect
                                        options={[
                                            ...filteredProjects.map((project) => ({
                                                id: project.id,
                                                value: project.id,
                                                children: <span>{project.project_name || "Untitled Project"}</span>
                                            })),
                                            {
                                                id: "create-new",
                                                value: "create-new",
                                                children: <span className="text-muted-foreground">+ Create new project</span>
                                            }
                                        ]}
                                        onSelect={(value) => {
                                            if (value === "create-new") {
                                                router.push("/projects/submit");
                                            } else {
                                                field.onChange(value);
                                            }
                                        }}
                                        onSearch={setProjectSearch}
                                        value={field.value}
                                        placeholder="Select a project"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        name="agentId"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem className="grid">
                                <FormLabel>Agent</FormLabel>
                                <FormControl>
                                    <CommandSelect
                                        options={(agents.data?.items ?? []).map((agent) => ({
                                            id: agent.id,
                                            value: agent.id,
                                            children: (
                                                <div className="flex items-center gap-x-2">
                                                    {/* <GeneratedAvatar className="border size-6" variant="botttsNeutral" seed={agent.name} /> */}
                                                    <span>{agent.name}</span>
                                                </div>
                                            )
                                        }))}
                                        onSelect={field.onChange}
                                        onSearch={setAgentSearch}
                                        value={field.value}
                                        placeholder="Select an agent"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="flex justify-between gap-x-2">
                        {onCancel && (
                            <Button variant="ghost" disabled={isPending} type="button" onClick={() => onCancel()}>Cancel</Button>
                        )}
                        <Button disabled={isPending} type="submit">{isEdit ? "Update" : "Create"}</Button>
                    </div>
                </form>
            </Form>
        </>
    );
};
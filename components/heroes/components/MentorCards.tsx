import { useState, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  CircleCheckIcon,
  ClockArrowUpIcon,
  LoaderIcon,
  MoreVerticalIcon,
  PencilIcon,
  TrashIcon,
  VideoIcon
} from "lucide-react";
import { UpdateMeetingDialog } from "@/modules/meetings/ui/components/update-meeting-dialog";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MeetingStatus } from "@/modules/meetings/types";

const statusIconMap = {
  upcoming: ClockArrowUpIcon,
  active: LoaderIcon,
  completed: CircleCheckIcon,
  processing: LoaderIcon,
}

const statusColorMap = {
  upcoming: "bg-yellow-500/20 text-yellow-800 border-yellow-800/5",
  active: "bg-blue-500/20 text-blue-800 border-blue-800/5",
  completed: "bg-emerald-500/20 text-emerald-800 border-emerald-800/5",
  processing: "bg-gray-300/20 text-gray-800 border-gray-800/5",
}

export function MentorCards() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: allData } = useSuspenseQuery(trpc.meetings.getMany.queryOptions({}));
  const { data, refetch } = useSuspenseQuery(
    trpc.meetings.getMany.queryOptions({
      eventId: selectedEventId ?? undefined,
      projectId: selectedProjectId ?? undefined,
    })
  );

  const [eventOptions, setEventOptions] = useState<{ id: string; name: string }[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchNames = async () => {
      try {
        const items = (allData?.items || []) as Array<{ event_id?: string | null; project_id?: string | null }>;
        const eventIds = Array.from(new Set(items.map((m) => m.event_id).filter(Boolean) as string[]));
        const projectIds = Array.from(new Set(items.map((m) => m.project_id).filter(Boolean) as string[]));

        if (eventIds.length > 0) {
          const { data: eventsRows } = await supabase
            .from("events")
            .select("event_id, event_name")
            .in("event_id", eventIds);

          const evs = (eventsRows || []).map((r: { event_id: string; event_name: string }) => ({ id: String(r.event_id), name: r.event_name }));
          evs.sort((a, b) => a.name.localeCompare(b.name));
          setEventOptions(evs);
        } else {
          setEventOptions([]);
        }

        if (projectIds.length > 0) {
          const { data: projectsRows } = await supabase
            .from("projects")
            .select("id, project_name")
            .in("id", projectIds);

          const prs = (projectsRows || []).map((r: { id: string; project_name?: string | null }) => ({ id: String(r.id), name: r.project_name || "Untitled" }));
          prs.sort((a, b) => a.name.localeCompare(b.name));
          setProjectOptions(prs);
        } else {
          setProjectOptions([]);
        }
      } catch {
        setEventOptions([]);
        setProjectOptions([]);
      }
    };

    fetchNames();
  }, [allData]);

  const [updateMeetingDialogOpen, setUpdateMeetingDialogOpen] = useState(false);
  const [initialValues, setInitialValues] = useState({});
  const [RemoveConfirmation, confirmRemove] = useConfirm(
    "Are you sure?",
    "The following action will remove this meeting."
  );

  const onEdit = (meeting: object) => {
    setUpdateMeetingDialogOpen(true);
    setInitialValues(meeting);
  };

  const removeMeeting = useMutation(trpc.meetings.remove.mutationOptions({
    onSuccess: async () => {
      await queryClient.invalidateQueries(trpc.meetings.getMany.queryOptions({}));
      refetch();
    },
  }));
  const handleRemoveMeeting = async (id: string) => {
    const ok = await confirmRemove();

    if (!ok) return;

    await removeMeeting.mutateAsync({ id });
  };

  const meetingStatus = (status?: MeetingStatus | null) => {
    const Icon = statusIconMap[status as keyof typeof statusIconMap];
    return (
      <Badge
        variant="outline"
        className={cn(
          "capitalize [&>svg]:size-4 text-muted-foreground gap-1",
          statusColorMap[status as keyof typeof statusColorMap]
        )}
      >
        <Icon className={cn(status === "processing" && "animate-spin")} />
        {status}
      </Badge>
    )
  }

  return (
    <>
      <UpdateMeetingDialog
        open={updateMeetingDialogOpen}
        onOpenChange={setUpdateMeetingDialogOpen}
        initialValues={initialValues}
      />
      <RemoveConfirmation />
      <div className="flex gap-3 items-center mb-4">
        <label className="text-sm text-gray-700">Filter:</label>
        <select
          value={selectedEventId ?? ""}
          onChange={(e) => setSelectedEventId(e.target.value || null)}
          className="border px-2 py-1 rounded"
        >
          <option value="">All events</option>
          {eventOptions.map((ev) => (<option key={ev.id} value={ev.id}>{ev.name}</option>))}
        </select>

        <select
          value={selectedProjectId ?? ""}
          onChange={(e) => setSelectedProjectId(e.target.value || null)}
          className="border px-2 py-1 rounded"
        >
          <option value="">All projects</option>
          {projectOptions.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      </div>
      <ul role="list" className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {data.items.map((meeting) => (
          <li
            key={meeting.id}
            className="col-span-1 flex flex-col divide-y divide-gray-200 rounded-xl bg-white text-center border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between p-2">
              <div className="flex items-center space-x-3">
                {meeting.event_id && (
                  <Link
                    href={`/events/${meeting.event_id}`}
                    className="text-xs font-medium text-gray-700 hover:text-gray-900"
                  >
                    View Event
                  </Link>
                )}
                {meeting.project_id && (
                  <Link
                    href={`/projects/${meeting.project_id}`}
                    className="text-xs font-medium text-gray-700 hover:text-gray-900"
                  >
                    View Project
                  </Link>
                )}
              </div>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost">
                      <MoreVerticalIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="gap-2" onClick={() => onEdit(meeting)}>
                    <PencilIcon className="size-4 text-black" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onClick={() => handleRemoveMeeting(meeting.id)}>
                    <TrashIcon className="size-4 text-black" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex flex-1 flex-col p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={meeting.agent?.name || ""}
                src={meeting.agent?.avatar_url || ""}
                className="mx-auto size-32 shrink-0 rounded-full bg-gray-300 outline outline-1 -outline-offset-1 outline-black/5"
              />
              <h3 className="mt-6 text-sm font-medium text-gray-900 capitalize">{meeting.agent?.name}</h3>
              <dl className="mt-1 flex grow flex-col justify-between">
                <dt className="sr-only">Title</dt>
                <dd className="text-sm text-gray-500 capitalize">{meeting.name}</dd>
                <dt className="sr-only">Role</dt>
                <dd className="mt-3">
                  {meetingStatus(meeting.status)}
                </dd>
              </dl>
            </div>
            <div>
              <div className="-mt-px flex divide-x divide-gray-200">
                {(meeting.status === "upcoming" || meeting.status === "active") && meeting.project_id && (
                  <div className="-ml-px flex w-0 flex-1">
                    <Link
                      href={`/call/${meeting.id}`}
                      className="relative inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-br-lg border border-transparent py-4 text-sm font-semibold text-gray-900"
                    >
                      <VideoIcon aria-hidden="true" className="size-5 text-gray-400" />
                      Start Call
                    </Link>
                  </div>
                )}
                {(meeting.status === "upcoming" || meeting.status === "active") && !meeting.project_id && (
                  <div className="-ml-px flex w-0 flex-1">
                    <div className="relative inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-br-lg border border-transparent py-4 text-sm font-semibold text-gray-900">
                      Please select a project to start the session
                    </div>
                  </div>
                )}
                {meeting.status === "processing" && (
                  <div className="-ml-px flex w-0 flex-1">
                    <div className="relative inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-br-lg border border-transparent py-4 text-sm font-semibold text-gray-900">
                      A summary will appear soon
                    </div>
                  </div>
                )}
                {meeting.status === "completed" && (
                  <div className="-ml-px flex w-0 flex-1">
                    <Link
                      href={`/learn/${meeting.id}`}
                      className="relative inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-br-lg border border-transparent py-4 text-sm font-semibold text-gray-900"
                    >
                      View feedback
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
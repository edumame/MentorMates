import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { Loader, Video, Clock, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/database.types";
import { Progress } from "@/components/ui/progress";

type MeetingRow = Database["public"]["Functions"]["project_meeting_timeline"]["Returns"][number];

// Intentionally used only by the authenticated project-detail route: this RPC
// exposes project-authorized metadata, not an anonymous public session listing.
export default function ProjectTimeline({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<MeetingRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.rpc("project_meeting_timeline", {
          p_project_id: projectId,
        });


        if (error) throw error;
        if (!mounted) return;
        setItems((data || []) as MeetingRow[]);
      } catch (e) {
        console.error("Failed to load project meetings", e);
        if (mounted) {
          setItems([]);
          setError("Unable to load sessions. Please try again later.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetch();

    return () => {
      mounted = false;
    };
  }, [projectId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : error ? (
          <div role="alert" className="text-sm text-red-600">{error}</div>
        ) : !items || items.length === 0 ? (
          <div className="text-sm text-gray-500">No sessions for this project yet.</div>
        ) : (
          <ol className="border-l border-gray-200">
            {items.map((m) => (
              <li key={m.id} className="mb-6 ml-6">
                <div className="flex items-center gap-3">
                  <span className="-ml-9 relative flex h-6 w-6 items-center justify-center rounded-full bg-white ring-4 ring-white ring-inset">
                    <Clock className="h-4 w-4 text-gray-500" />
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900">
                          {m.name || "Session"}
                        </h3>
                        <div className="text-xs text-gray-500">
                          {m.started_at
                            ? new Date(m.started_at).toLocaleString()
                            : "Scheduled"}
                          {m.ended_at ? ` — ${new Date(m.ended_at).toLocaleString()}` : ""}
                        </div>
                      </div>
                      {typeof m.score === "number" && (
                        <div className="flex flex-col items-center w-48">
                          <div className="flex items-center justify-between w-full">
                            <div className="text-xs text-gray-500">Score</div>
                            <div className="text-sm font-medium text-gray-900">{m.score}</div>
                          </div>
                          <div className="w-full mt-1">
                            <Progress value={Math.max(0, Math.min(100, m.score))} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {m.status || "unknown"}
                        </Badge>
                        {!m.can_view_details || m.status === "processing" ? (
                          <span className="text-sm text-gray-400 flex items-center gap-1" aria-disabled>
                            <Video className="h-4 w-4" />
                            View
                          </span>
                        ) : m.status === "completed" ? (
                          <Link href={`/learn/${m.id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            <MessageSquare className="h-4 w-4" />
                            View
                          </Link>
                        ) : (
                          <Link href={`/call/${m.id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            <Video className="h-4 w-4" />
                            View
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

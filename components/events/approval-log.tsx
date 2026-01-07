"use client";

import { useEffect, useState } from "react";
import { EventApprovalLog, ApprovalStatus } from "@/lib/types";
import { Loader2, CheckCircle, XCircle, Send, Clock, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ApprovalLogProps {
  eventId: string;
}

export function ApprovalLog({ eventId }: ApprovalLogProps) {
  const [logs, setLogs] = useState<EventApprovalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/events/${eventId}/logs`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch approval logs");
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error("Error fetching approval logs:", err);
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: ApprovalStatus) => {
    switch (status) {
      case ApprovalStatus.NotSubmitted:
        return <Clock className="w-4 h-4 text-gray-500" />;
      case ApprovalStatus.Submitted:
        return <Send className="w-4 h-4 text-blue-500" />;
      case ApprovalStatus.Approved:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case ApprovalStatus.Rejected:
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: ApprovalStatus) => {
    switch (status) {
      case ApprovalStatus.NotSubmitted:
        return "Not Submitted";
      case ApprovalStatus.Submitted:
        return "Submitted";
      case ApprovalStatus.Approved:
        return "Approved";
      case ApprovalStatus.Rejected:
        return "Rejected";
      default:
        return status;
    }
  };

  const getStatusColor = (status: ApprovalStatus) => {
    switch (status) {
      case ApprovalStatus.NotSubmitted:
        return "text-gray-700 bg-gray-100";
      case ApprovalStatus.Submitted:
        return "text-blue-700 bg-blue-100";
      case ApprovalStatus.Approved:
        return "text-green-700 bg-green-100";
      case ApprovalStatus.Rejected:
        return "text-red-700 bg-red-100";
      default:
        return "text-gray-700 bg-gray-100";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
        <History className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No approval history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-gray-600" />
        <h4 className="text-sm font-semibold text-gray-900">Approval History</h4>
        <span className="text-xs text-gray-500">({logs.length} {logs.length === 1 ? 'entry' : 'entries'})</span>
      </div>

      <div className="space-y-2">
        {logs.map((log, index) => (
          <div
            key={log.log_id}
            className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {log.previous_status && (
                    <>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(log.previous_status)}`}>
                        {getStatusIcon(log.previous_status)}
                        {getStatusLabel(log.previous_status)}
                      </span>
                      <span className="text-gray-400">→</span>
                    </>
                  )}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(log.new_status)}`}>
                    {getStatusIcon(log.new_status)}
                    {getStatusLabel(log.new_status)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="font-medium">{log.admin_name}</span>
                  {log.admin_email && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-500">{log.admin_email}</span>
                    </>
                  )}
                </div>

                {log.notes && (
                  <p className="mt-2 text-xs text-gray-600 italic">
                    &quot;{log.notes}&quot;
                  </p>
                )}
              </div>

              <div className="flex-shrink-0 text-right">
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(log.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

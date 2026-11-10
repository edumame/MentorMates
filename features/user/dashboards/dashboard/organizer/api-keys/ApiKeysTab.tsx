"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Key, Trash2, ExternalLink, Check } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

interface ApiKey {
  id: string;
  /** null = account-wide key (works for every event the user manages). */
  event_id?: string | null;
  key_prefix: string;
  label: string | null;
  scopes: string[] | null;
  last_used_at: string | null;
  created_at: string | null;
}

interface ApiKeysTabProps {
  eventId: string;
}

export function ApiKeysTab({ eventId }: ApiKeysTabProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { toast } = useToast();

  const showError = useCallback(
    (description: string) =>
      toast({ title: "Error", description, variant: "destructive" }),
    [toast]
  );

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/keys?event_id=${eventId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load API keys");
      setKeys(data.keys || []);
    } catch (error) {
      console.error("Error loading API keys:", error);
      showError(error instanceof Error ? error.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, [eventId, showError]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/agent/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          // ORG-023: keys created here only work for this event.
          scope_mode: "event",
          label: label || "default",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.api_key) {
        throw new Error(data.error || "Failed to create API key");
      }
      setNewKey(data.api_key);
      setLabel("");
      fetchKeys();
    } catch (error) {
      console.error("Error creating API key:", error);
      showError(error instanceof Error ? error.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (key: ApiKey) => {
    // ORG-023: account-wide keys may be used by other events' integrations.
    if (
      !key.event_id &&
      !window.confirm(
        "This key works for all events you manage. Revoking it stops every integration that uses it. Revoke anyway?"
      )
    ) {
      return;
    }
    const keyId = key.id;
    try {
      const res = await fetch("/api/agent/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to revoke API key");
      }
      toast({ title: "API key revoked", description: "The key can no longer be used." });
      fetchKeys();
    } catch (error) {
      console.error("Error revoking API key:", error);
      showError(error instanceof Error ? error.message : "Failed to revoke API key");
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* One-Click Install */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Claude Code Integration
          </CardTitle>
          <CardDescription>
            Connect this event to Claude Code, Codex, or any AI agent with one
            click.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <a
            href={`/events/${eventId}/skill-install`}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Set Up Agent Access
          </a>
          <p className="text-xs text-gray-500">
            Generates an API key and gives you a ready-to-use skill file with
            everything pre-configured.
          </p>
        </CardContent>
      </Card>

      {/* New Key Created Banner */}
      {newKey && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-green-800 mb-2">
              API key created! Copy it now — it won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border rounded px-3 py-2 text-sm font-mono break-all">
                {newKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(newKey)}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-green-700"
              onClick={() => setNewKey(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generate New Key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate New API Key</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor="key-label">Label (optional)</Label>
              <Input
                id="key-label"
                placeholder="e.g., My laptop, CI/CD"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <Button onClick={handleCreate} disabled={creating} className="shrink-0 w-full sm:w-auto">
              {creating ? "Generating..." : "Generate Key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active API Keys</CardTitle>
          <CardDescription>
            New keys created here only work for this event. Keys marked
            &ldquo;All your events&rdquo; were created before keys were
            event-scoped and work for every event you manage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-gray-500">
              No API keys yet. Generate one above to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between gap-3 border rounded-lg px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium flex flex-wrap items-center gap-2">
                      {key.label || "default"}
                      {!key.event_id ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800">
                          All your events
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {key.key_prefix}...
                    </p>
                    <p className="text-xs text-gray-400">
                      Created{" "}
                      {key.created_at
                        ? new Date(key.created_at).toLocaleDateString()
                        : "unknown"}
                      {key.last_used_at &&
                        ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-red-500 hover:text-red-700"
                    aria-label={`Revoke API key ${key.label || "default"}`}
                    onClick={() => handleRevoke(key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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

interface ApiKey {
  id: string;
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

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/keys?event_id=${eventId}`);
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {
      // Ignore fetch errors silently
    } finally {
      setLoading(false);
    }
  }, [eventId]);

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
          label: label || "default",
        }),
      });
      const data = await res.json();
      if (data.api_key) {
        setNewKey(data.api_key);
        setLabel("");
        fetchKeys();
      }
    } catch {
      // Ignore create errors silently
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await fetch("/api/agent/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId }),
      });
      fetchKeys();
    } catch {
      // Ignore revoke errors silently
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
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
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="key-label">Label (optional)</Label>
              <Input
                id="key-label"
                placeholder="e.g., My laptop, CI/CD"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Generating..." : "Generate Key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active API Keys</CardTitle>
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
                  className="flex items-center justify-between border rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {key.label || "default"}
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
                    className="text-red-500 hover:text-red-700"
                    onClick={() => handleRevoke(key.id)}
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

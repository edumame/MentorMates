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
      {/* Skill Install Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Claude Code Integration
          </CardTitle>
          <CardDescription>
            Generate an API key to manage this event from Claude Code, Codex, or
            any AI agent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 text-sm space-y-2">
            <p className="font-medium">Quick Start:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-600">
              <li>Generate an API key below</li>
              <li>
                Set it in your environment:{" "}
                <code className="bg-gray-200 px-1 rounded">
                  export MENTORMATES_API_KEY=&quot;mm_sk_...&quot;
                </code>
              </li>
              <li>
                Download the skill file and add to your project&apos;s{" "}
                <code className="bg-gray-200 px-1 rounded">.claude/</code>{" "}
                directory
              </li>
            </ol>
            <a
              href="/api/agent/skill"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline mt-2"
            >
              Download Skill File <ExternalLink className="h-3 w-3" />
            </a>
          </div>
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

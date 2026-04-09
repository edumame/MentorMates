"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, Bot, BookOpen, Check, Copy, Download, Globe2, KeyRound, LockKeyhole, MousePointer2, Sparkles, Terminal, Trash2, Wind } from "lucide-react";

export interface AgentKeyRecord {
  id: string;
  event_id: string | null;
  key_prefix: string;
  label: string | null;
  scopes: string[] | null;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string | null;
}

export interface KeyEventOption {
  id: string;
  name: string;
  eventDate: string | null;
}

interface GeneratedKeyState {
  apiKey: string;
  eventId: string | null;
  label: string | null;
  prefix: string;
  message: string;
}

interface KeysPageClientProps {
  initialKeys: AgentKeyRecord[];
  managedEventOptions: KeyEventOption[];
  participantEventOptions: KeyEventOption[];
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function eventLabel(event: KeyEventOption | undefined, eventId: string | null) {
  if (event) return event.name;
  if (!eventId) return "Reusable across events";
  return eventId;
}

export default function KeysPageClient({
  initialKeys,
  managedEventOptions,
  participantEventOptions,
}: KeysPageClientProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [label, setLabel] = useState("");
  const [accessMode, setAccessMode] = useState<"organizer" | "participant">(
    managedEventOptions.length > 0 ? "organizer" : "participant"
  );
  const [scopeMode, setScopeMode] = useState<"public" | "event">("public");
  const [eventId, setEventId] = useState(
    managedEventOptions[0]?.id ?? participantEventOptions[0]?.id ?? ""
  );
  const [generatedKey, setGeneratedKey] = useState<GeneratedKeyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [apiAudience, setApiAudience] = useState<"organizer" | "participant">("organizer");

  const eventMap = useMemo(
    () =>
      new Map(
        [...managedEventOptions, ...participantEventOptions].map((event) => [event.id, event])
      ),
    [managedEventOptions, participantEventOptions]
  );
  const publicKeys = keys.filter((key) => !key.event_id);
  const eventScopedKeys = keys.filter((key) => key.event_id);
  const currentEventOptions = accessMode === "organizer"
    ? managedEventOptions
    : participantEventOptions;

  useEffect(() => {
    if (scopeMode !== "event") {
      return;
    }

    if (currentEventOptions.some((event) => event.id === eventId)) {
      return;
    }

    setEventId(currentEventOptions[0]?.id ?? "");
  }, [accessMode, currentEventOptions, eventId, scopeMode]);

  useEffect(() => {
    if (apiAudience !== "organizer") return;
    if (accessMode !== "organizer") {
      setAccessMode("organizer");
    }
  }, [apiAudience, accessMode]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCreateKey = async () => {
    if (scopeMode === "event" && !eventId) {
      setError("Choose an event to authorize this key.");
      return;
    }

    if (accessMode === "organizer" && managedEventOptions.length === 0) {
      setError("You need organizer access to at least one event to create organizer keys.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/agent/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: scopeMode === "event" ? eventId : eventId || undefined,
          access_mode: accessMode,
          scope_mode: scopeMode,
          label: label.trim() || undefined,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Failed to create API key.");
        return;
      }

      const createdKey: AgentKeyRecord = {
        id: json.key.id,
        event_id: json.key.event_id ?? null,
        key_prefix: json.key.prefix,
        label: json.key.label ?? null,
        scopes: json.key.scopes ?? [],
        created_at: json.key.created_at ?? new Date().toISOString(),
        last_used_at: null,
        expires_at: null,
      };

      setKeys((current) => [createdKey, ...current]);
      setGeneratedKey({
        apiKey: json.api_key,
        eventId: createdKey.event_id,
        label: createdKey.label,
        prefix: createdKey.key_prefix,
        message: json.message,
      });
      setLabel("");
    } catch {
      setError("Failed to create API key.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    setRevokingKeyId(keyId);
    setError(null);

    try {
      const response = await fetch("/api/agent/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error || "Failed to revoke API key.");
        return;
      }

      setKeys((current) => current.filter((key) => key.id !== keyId));
      if (generatedKey?.prefix === keys.find((key) => key.id === keyId)?.key_prefix) {
        setGeneratedKey(null);
      }
    } catch {
      setError("Failed to revoke API key.");
    } finally {
      setRevokingKeyId(null);
    }
  };

  const renderKeyCard = (key: AgentKeyRecord) => {
    const event = key.event_id ? eventMap.get(key.event_id) : undefined;
    const keyType = key.event_id ? "Event-specific" : "Reusable";
    const accessType =
      (key.scopes || []).some((scope) => scope.startsWith("participant-")) &&
      !(key.scopes || []).some((scope) => !scope.startsWith("participant-"))
        ? "Participant"
        : "Organizer";

    return (
      <Card key={key.id} className="border border-slate-200">
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{key.label || "default"}</CardTitle>
                <Badge variant="secondary">{keyType}</Badge>
                <Badge variant="outline">{accessType}</Badge>
              </div>
              <CardDescription className="font-mono text-xs">
                {key.key_prefix}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={revokingKeyId === key.id}
              onClick={() => handleRevokeKey(key.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {revokingKeyId === key.id ? "Revoking..." : "Revoke"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            {key.event_id ? (
              <LockKeyhole className="h-4 w-4 text-slate-500" />
            ) : (
              <Globe2 className="h-4 w-4 text-slate-500" />
            )}
            <span>{eventLabel(event, key.event_id)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(key.scopes || []).map((scope) => (
              <Badge key={scope} variant="outline">
                {scope}
              </Badge>
            ))}
          </div>
          <div className="grid gap-1 text-xs text-slate-500">
            <p>Created: {formatDate(key.created_at)}</p>
            <p>Last used: {formatDate(key.last_used_at)}</p>
            {key.event_id ? (
              <p>This key only works for the selected event.</p>
            ) : (
              <p>Use this key with `?event_id=&lt;event_uuid&gt;` on agent event routes.</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-12">
      <Tabs
        value={apiAudience}
        onValueChange={(value) => setApiAudience(value as "organizer" | "participant")}
        className="space-y-6"
      >
        <div className="flex w-fit items-center bg-white border border-[rgba(0,0,0,0.15)] rounded-xl p-1 overflow-x-auto">
          <button
            onClick={() => setApiAudience("organizer")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all border border-transparent ${
              apiAudience === "organizer"
                ? "bg-[var(--Color-Pattens-Blue-Lightest,#FBFCFE)] border !border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] text-black font-semibold"
                : "text-black hover:text-black/80"
            }`}
          >
            For organizer
          </button>
          <button
            onClick={() => setApiAudience("participant")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all border border-transparent ${
              apiAudience === "participant"
                ? "bg-[var(--Color-Pattens-Blue-Lightest,#FBFCFE)] border !border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] text-black font-semibold"
                : "text-black hover:text-black/80"
            }`}
          >
            For participants
          </button>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {apiAudience === "organizer" ? "Developer API" : "HackerAgent"}
          </h1>
          <p className="max-w-3xl text-sm text-slate-600">
            {apiAudience === "organizer"
              ? "Manage your hackathon events from Claude Code, Codex, or any AI agent. Create an API key, download the skill file, and start managing events from your terminal."
              : "Your AI hackathon copilot. Syncs your project to MentorMates as you build."}
          </p>
        </div>

        <TabsContent value="organizer" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Quick Start
              </CardTitle>
              <CardDescription>
                Get up and running in 3 steps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                  <p className="font-medium text-slate-900">1. Create a key</p>
                  <p className="text-sm text-slate-600">
                    Generate an organizer API key below. Choose reusable (works across events)
                    or event-specific.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                  <p className="font-medium text-slate-900">2. Set env vars</p>
                  <div className="rounded bg-slate-900 px-3 py-2 font-mono text-xs text-green-400">
                    export MENTORMATES_API_KEY=&quot;mm_sk_...&quot;
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                  <p className="font-medium text-slate-900">3. Download skill</p>
                  <a
                    href="/api/agent/skill"
                    className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    mentormates.md
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                API Reference
              </CardTitle>
              <CardDescription>
                All endpoints use Bearer token auth and require{" "}
                <code className="rounded bg-slate-100 px-1 text-xs">?event_id=UUID</code>{" "}
                for reusable keys.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-slate-500">Method</th>
                      <th className="pb-2 pr-4 font-medium text-slate-500">Endpoint</th>
                      <th className="pb-2 font-medium text-slate-500">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 pr-4"><Badge variant="outline">GET</Badge></td>
                      <td className="py-2 pr-4 font-mono text-xs">/api/agent/events</td>
                      <td className="py-2 text-slate-600">List your editable events (no event_id) or get event details</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><Badge variant="outline">PATCH</Badge></td>
                      <td className="py-2 pr-4 font-mono text-xs">/api/agent/events</td>
                      <td className="py-2 text-slate-600">Update event name, description, date, capacity</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><Badge variant="outline">GET</Badge></td>
                      <td className="py-2 pr-4 font-mono text-xs">/api/agent/events/participants</td>
                      <td className="py-2 text-slate-600">List participants, mentors, judges (filterable by role)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><Badge variant="outline">PATCH</Badge></td>
                      <td className="py-2 pr-4 font-mono text-xs">/api/agent/events/participants</td>
                      <td className="py-2 text-slate-600">Change role or remove a participant</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><Badge variant="outline">GET</Badge></td>
                      <td className="py-2 pr-4 font-mono text-xs">/api/agent/events/approval-requests</td>
                      <td className="py-2 text-slate-600">List pending approval requests</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><Badge variant="outline">POST</Badge></td>
                      <td className="py-2 pr-4 font-mono text-xs">/api/agent/events/approval-requests</td>
                      <td className="py-2 text-slate-600">Approve or reject a request</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><Badge variant="outline">GET</Badge></td>
                      <td className="py-2 pr-4 font-mono text-xs">/api/agent/events/projects</td>
                      <td className="py-2 text-slate-600">List projects with scores</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><Badge variant="outline">GET</Badge></td>
                      <td className="py-2 pr-4 font-mono text-xs">/api/agent/events/judges</td>
                      <td className="py-2 text-slate-600">List judges and scoring progress</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><Badge variant="outline">POST</Badge></td>
                      <td className="py-2 pr-4 font-mono text-xs">/api/agent/events/judges</td>
                      <td className="py-2 text-slate-600">Send email to judges</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="participant" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Install
              </CardTitle>
              <CardDescription>
                Installation differs by platform. Pick your agent below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-5">
                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="mb-2 text-base font-medium text-slate-900">Claude Code (Plugin Marketplace)</h3>
                  <div className="rounded bg-slate-900 px-3 py-2 font-mono text-sm">
                    <p className="text-emerald-600">/plugin install hackeragent@mentormates-marketplace</p>
                </div>
                  <p className="mt-2 text-xs text-slate-500">Or register the marketplace first, then install:</p>
                  <div className="mt-1 space-y-0.5 rounded bg-slate-900 px-3 py-2 font-mono text-xs">
                    <p className="text-emerald-500">/plugin marketplace add edumame/mentormates-marketplace</p>
                    <p className="text-emerald-500">/plugin install hackeragent@mentormates-marketplace</p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="mb-2 text-base font-medium text-slate-900">Cursor Agent</h3>
                  <p className="mb-2 text-xs text-slate-500">In Cursor Agent chat:</p>
                  <div className="rounded bg-slate-900 px-3 py-2 font-mono text-sm">
                    <p className="text-emerald-600">/add-plugin hackeragent</p>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Or search for &quot;hackeragent&quot; in the plugin marketplace.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="mb-2 text-base font-medium text-slate-900">Codex</h3>
                  <p className="mb-2 text-xs text-slate-500">Tell Codex:</p>
                  <div className="rounded bg-slate-900 px-3 py-2 font-mono text-xs">
                    <p className="break-all text-emerald-600">
                      Fetch and follow instructions from https://hackeragent.vercel.app/api/install
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="mb-2 text-base font-medium text-slate-900">Gemini CLI / Windsurf / Any Agent</h3>
                  <p className="mb-2 text-xs text-slate-500">
                    Download the skill file and save it to your agent&apos;s skill directory:
                  </p>
                  <div className="space-y-0.5 rounded bg-slate-900 px-3 py-2 font-mono text-xs">
                    <p className="break-all text-emerald-600">
                      curl -o ~/.skills/mentormates/SKILL.md https://hackeragent.vercel.app/api/skill
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Or tell your agent: &quot;Fetch and follow instructions from https://hackeragent.vercel.app/api/install&quot;
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Setup your project</CardTitle>
              <CardDescription>
                Follows the HackerAgent setup flow and keeps participant onboarding simple.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                <p className="font-medium text-slate-900">Option A: Copy from MentorMates (recommended)</p>
                <p className="text-sm text-slate-600">
                  Create your project in MentorMates, then copy the generated setup command
                  with project and event IDs prefilled.
                </p>
                <div className="rounded bg-slate-900 px-3 py-2 font-mono text-xs text-green-400">
                  {"echo '{\"token\":\"abc123...\",\"mm_project_id\":\"proj-xyz\",\"mm_event_id\":\"evt-456\"}' > ~/.hackeragent/config.json"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                <p className="font-medium text-slate-900">Option B: Use your MentorMates API key</p>
                <p className="text-sm text-slate-600">
                  Set your participant API key and use agent commands to bootstrap automatically.
                </p>
                <div className="rounded bg-slate-900 px-3 py-2 font-mono text-xs text-green-400">
                  {"echo '{\"api_key\":\"mm_sk_...\"}' > ~/.hackeragent/config.json"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                <p className="font-medium text-slate-900">Option C: Interactive setup</p>
                <p className="text-sm text-slate-600">
                  Run <code className="rounded bg-slate-100 px-1 text-xs">/mentormates</code> in your
                  agent and follow prompts for event and project details.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What it does</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-900">01 · Loads hackathon context</p>
                <p className="text-sm text-slate-600">
                  Injects judging criteria, sponsor challenges, deadlines, and submission format.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-900">02 · Syncs as you build</p>
                <p className="text-sm text-slate-600">
                  Tracks description, tech stack, milestones, and links as you work in your agent.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-900">03 · Submit when ready</p>
                <p className="text-sm text-slate-600">
                  Use <code className="rounded bg-slate-100 px-1 text-xs">/submit</code> to auto-populate
                  your final project submission.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Works with any agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="flex items-center gap-2 text-2xl text-slate-900">
                    <Bot className="h-5 w-5 text-slate-700" />
                    Claude Code
                  </p>
                  <p className="text-sm text-slate-600">Skill + SessionStart hook</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="flex items-center gap-2 text-2xl text-slate-900">
                    <BookOpen className="h-5 w-5 text-slate-700" />
                    Codex
                  </p>
                  <p className="text-sm text-slate-600">Skill auto-detected</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="flex items-center gap-2 text-2xl text-slate-900">
                    <MousePointer2 className="h-5 w-5 text-slate-700" />
                    Cursor Agent
                  </p>
                  <p className="text-sm text-slate-600">Via .cursorrules or skill</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="flex items-center gap-2 text-2xl text-slate-900">
                    <Sparkles className="h-5 w-5 text-slate-700" />
                    Gemini CLI
                  </p>
                  <p className="text-sm text-slate-600">Via skill directory</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="flex items-center gap-2 text-2xl text-slate-900">
                    <Wind className="h-5 w-5 text-slate-700" />
                    Windsurf
                  </p>
                  <p className="text-sm text-slate-600">Via rules or skill</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="flex items-center gap-2 text-2xl text-slate-900">
                    <Terminal className="h-5 w-5 text-slate-700" />
                    Any CLI agent
                  </p>
                  <p className="text-sm text-slate-600">REST API + curl</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                HackerAgent uses a CLI-based REST API under the hood. Any agent with shell access can call the
                endpoints directly. The skill file handles the integration automatically.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                API Reference
              </CardTitle>
              <CardDescription>
                Participant project sync endpoints.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-slate-500">Method</th>
                      <th className="pb-2 pr-4 font-medium text-slate-500">Endpoint</th>
                      <th className="pb-2 font-medium text-slate-500">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 pr-4"><Badge variant="outline">POST</Badge></td>
                      <td className="py-2 pr-4 font-mono text-xs">/api/project/create</td>
                      <td className="py-2 text-slate-600">Create a project sync session and return a token.</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><Badge variant="outline">POST</Badge></td>
                      <td className="py-2 pr-4 font-mono text-xs">/api/project/update</td>
                      <td className="py-2 text-slate-600">Append project updates (description, tech stack, milestones, links).</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><Badge variant="outline">GET</Badge></td>
                      <td className="py-2 pr-4 font-mono text-xs">/api/project/status</td>
                      <td className="py-2 text-slate-600">Read aggregated participant project state.</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4"><Badge variant="outline">GET</Badge></td>
                      <td className="py-2 pr-4 font-mono text-xs">/api/context/[eventId]</td>
                      <td className="py-2 text-slate-600">Fetch event context used by the participant assistant.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Web Chat</CardTitle>
              <CardDescription>
                Don&apos;t use a coding agent? Use the web chat interface instead.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href="https://hackeragent.vercel.app/chat/demo"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
              >
                Open Chat
              </a>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {apiAudience === "organizer" ? (
        <>
          {/* Keys Management Section */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Manage Keys
            </h2>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Authorization still happens per event</AlertTitle>
            <AlertDescription>
              Reusable keys are not global admin keys. Every `/api/agent/events*`
              request still checks the current user behind the key against the
              `event_id` you pass.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Create an API key</CardTitle>
              <CardDescription>
                Choose how you want your key to work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <>
                <div className="rounded-lg border-2 border-blue-500 bg-blue-50 p-5">
                  <div className="mb-2">
                    <p className="font-semibold text-slate-900">Organizer access</p>
                  </div>
                  <p className="text-sm text-slate-600">
                    Manage events you organize, including participants, judges,
                    approval requests, and event-wide project views.
                  </p>
                </div>

              {managedEventOptions.length === 0 ? (
                <p className="text-sm text-amber-700">
                  You need organizer access to at least one event before you can
                  create organizer agent keys.
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                {/* Reusable key option */}
                <div
                  className={`cursor-pointer rounded-lg border-2 p-5 transition-colors ${
                    scopeMode === "public"
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() => setScopeMode("public")}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Globe2 className="h-5 w-5 text-blue-600" />
                    <p className="font-semibold text-slate-900">Key for all my organizer events</p>
                  </div>
                  <p className="text-sm text-slate-600">
                    <>
                      One key that works across all events you organize.
                      Pass{" "}
                      <code className="rounded bg-slate-100 px-1 text-xs">
                        ?event_id=UUID
                      </code>{" "}
                      on each API call to choose the event.
                    </>
                  </p>
                </div>

                {/* Event-specific key option */}
                <div
                  className={`cursor-pointer rounded-lg border-2 p-5 transition-colors ${
                    scopeMode === "event"
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() => setScopeMode("event")}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <LockKeyhole className="h-5 w-5 text-amber-600" />
                    <p className="font-semibold text-slate-900">Key for one organizer event</p>
                  </div>
                  <p className="text-sm text-slate-600">
                    Locked to a single event. No need to pass{" "}
                    <code className="rounded bg-slate-100 px-1 text-xs">
                      event_id
                    </code>{" "}
                    — the key already knows which event it targets.
                  </p>
                </div>
              </div>

              {/* Event selector — only shown for event-specific keys */}
              {scopeMode === "event" && (
                <div className="space-y-2">
                  <Label>Which event?</Label>
                  <Select
                    value={eventId}
                    onValueChange={setEventId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an event" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentEventOptions.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="key-label">Label (optional)</Label>
                    <Input
                      id="key-label"
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder="e.g. My laptop, CI/CD, Recruiting agent"
                    />
                  </div>
                  <Button
                    onClick={handleCreateKey}
                    disabled={isCreating}
                    className="min-w-36"
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    {isCreating ? "Creating..." : "Create Key"}
                  </Button>
                </div>
              </>
            </CardContent>
          </Card>

          {error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Request failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {generatedKey ? (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardHeader>
                <CardTitle className="text-emerald-900">New key created</CardTitle>
                <CardDescription className="text-emerald-800">
                  {generatedKey.message}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-3">
                  <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm">
                    {generatedKey.apiKey}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedKey.apiKey, "new-key")}
                  >
                    {copiedField === "new-key" ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {!generatedKey.eventId ? (
                  <p className="text-sm text-emerald-900">
                    This is a reusable key. Pair it with
                    `?event_id=&lt;event_uuid&gt;` on every agent event route.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Reusable keys</h2>
              <p className="text-sm text-slate-600">
                One key, many events. These keys require `event_id` on every
                `/api/agent/events*` request.
              </p>
            </div>
            {publicKeys.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {publicKeys.map(renderKeyCard)}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-sm text-slate-500">
                  No reusable keys yet.
                </CardContent>
              </Card>
            )}
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Event-specific keys</h2>
              <p className="text-sm text-slate-600">
                Scoped keys only work for one event. Keep them if you need hard event
                isolation, otherwise prefer reusable keys.
              </p>
            </div>
            {eventScopedKeys.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {eventScopedKeys.map(renderKeyCard)}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-sm text-slate-500">
                  No event-specific keys yet.
                </CardContent>
              </Card>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

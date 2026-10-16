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
import { AlertTriangle, Check, Copy, Download, Globe2, KeyRound, LockKeyhole, Terminal, Trash2 } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"participant" | "organizer">("participant");
  const [scopeMode, setScopeMode] = useState<"public" | "event">("public");
  const [eventId, setEventId] = useState(
    participantEventOptions[0]?.id ?? managedEventOptions[0]?.id ?? ""
  );
  const [generatedKey, setGeneratedKey] = useState<GeneratedKeyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [installAgent, setInstallAgent] = useState<
    "claude" | "copilot" | "cursor" | "codex" | "other"
  >("claude");

  const eventMap = useMemo(
    () =>
      new Map(
        [...managedEventOptions, ...participantEventOptions].map((event) => [event.id, event])
      ),
    [managedEventOptions, participantEventOptions]
  );

  const currentEventOptions = activeTab === "organizer"
    ? managedEventOptions
    : participantEventOptions;

  // Filter keys by current tab's access mode
  const tabKeys = keys.filter((key) => {
    const isParticipantKey =
      (key.scopes || []).some((s) => s.startsWith("participant-")) &&
      !(key.scopes || []).some((s) => !s.startsWith("participant-"));
    return activeTab === "participant" ? isParticipantKey : !isParticipantKey;
  });
  const publicKeys = tabKeys.filter((key) => !key.event_id);
  const eventScopedKeys = tabKeys.filter((key) => key.event_id);

  useEffect(() => {
    if (activeTab === "participant" && scopeMode === "event") {
      setScopeMode("public");
    }
  }, [activeTab, scopeMode]);

  useEffect(() => {
    if (scopeMode !== "event") return;
    if (currentEventOptions.some((e) => e.id === eventId)) return;
    setEventId(currentEventOptions[0]?.id ?? "");
  }, [activeTab, currentEventOptions, eventId, scopeMode]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 2000);
  };

  const buildCopyableMarkdown = () => {
    const envVar =
      activeTab === "organizer"
        ? "MENTORMATES_API_KEY"
        : "MENTORMATES_PARTICIPANT_API_KEY";
    const keyValue = generatedKey?.apiKey || "mm_sk_...";

    return [
      `export ${envVar}="${keyValue}"`,
      "",
      "Fetch and follow https://www.mentormates.ai/api/agent/skill",
      "",
    ].join("\n");
  };

  const handleCopyPage = async () => {
    await copyToClipboard(buildCopyableMarkdown(), "page");
  };

  const handleCreateKey = async () => {
    if (scopeMode === "event" && !eventId) {
      setError("Choose an event to authorize this key.");
      return;
    }

    if (activeTab === "organizer" && managedEventOptions.length === 0) {
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
          access_mode: activeTab,
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

    return (
      <Card key={key.id} className="border border-[rgba(0,0,0,0.15)]">
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{key.label || "default"}</CardTitle>
                <Badge variant="secondary" className="bg-white border border-[rgba(0,0,0,0.15)] text-black rounded-full text-xs">{keyType}</Badge>
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
        <CardContent className="space-y-3 text-sm text-[#575d65]">
          <div className="flex items-center gap-2">
            {key.event_id ? (
              <LockKeyhole className="h-4 w-4 text-[#575d65]" />
            ) : (
              <Globe2 className="h-4 w-4 text-[#575d65]" />
            )}
            <span>{eventLabel(event, key.event_id)}</span>
          </div>
          <div className="grid gap-1 text-xs text-[#7f7f7f]">
            <p>Created: {formatDate(key.created_at)}</p>
            <p>Last used: {formatDate(key.last_used_at)}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderQuickStart = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[rgba(0,0,0,0.15)] p-4 space-y-2">
        <p className="font-medium text-black">1. Create a key</p>
        <p className="text-sm text-[#575d65]">
          Generate an API key below.
        </p>
      </div>
      <div className="rounded-xl border border-[rgba(0,0,0,0.15)] p-4 space-y-2">
        <p className="font-medium text-black">2. Set env var</p>
        <p className="text-xs text-[#575d65]">
          Run this in <span className="font-medium">your own terminal</span>, not in an agent chat. Pasting the raw key into an agent puts it in conversation history.
        </p>
        <div className="rounded-lg bg-black px-3 py-2 font-mono text-xs text-green-400 whitespace-pre-wrap break-all">
          export {activeTab === "organizer" ? "MENTORMATES_API_KEY" : "MENTORMATES_PARTICIPANT_API_KEY"}=&quot;{generatedKey?.apiKey ?? "mm_sk_..."}&quot;
        </div>
        {generatedKey?.apiKey ? (
          <p className="text-[11px] text-[#9c6300]">
            Your newly generated key is filled in above. Copy this line, run it in your shell, then close this tab or clear the key from your clipboard.
          </p>
        ) : (
          <p className="text-[11px] text-[#575d65]">
            Generate a key below — it&apos;ll appear here once, then never again.
          </p>
        )}
      </div>
      <div className="rounded-xl border border-[rgba(0,0,0,0.15)] p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-black">3. Install skill</p>
          <select
            value={installAgent}
            onChange={(e) =>
              setInstallAgent(e.target.value as typeof installAgent)
            }
            className="rounded-md border border-[rgba(0,0,0,0.15)] bg-white px-2 py-1 text-xs text-[#575d65] focus:outline-none focus:ring-1 focus:ring-[#4B89EF]"
            aria-label="Choose your AI agent"
          >
            <option value="claude">Claude Code</option>
            <option value="copilot">GitHub Copilot CLI</option>
            <option value="cursor">Cursor</option>
            <option value="codex">Codex CLI</option>
            <option value="other">OpenCode / other</option>
          </select>
        </div>

        {installAgent === "claude" && (
          <div className="rounded-lg bg-black px-3 py-2 font-mono text-xs text-green-400 whitespace-pre-wrap break-all">
            /plugin marketplace add edumame/mentormates-marketplace
            {"\n"}/plugin install mentormates@mentormates-marketplace
          </div>
        )}

        {installAgent === "copilot" && (
          <div className="rounded-lg bg-black px-3 py-2 font-mono text-xs text-green-400 whitespace-pre-wrap break-all">
            copilot plugin marketplace add edumame/mentormates-marketplace
            {"\n"}copilot plugin install mentormates@mentormates-marketplace
          </div>
        )}

        {installAgent === "cursor" && (
          <p className="text-xs text-[#575d65]">
            In Agent chat say: <em>Install the mentormates plugin from edumame/mentormates-marketplace</em>
          </p>
        )}

        {installAgent === "codex" && (
          <div className="space-y-1">
            <p className="text-xs text-[#575d65]">Tell Codex:</p>
            <div className="rounded-lg bg-black px-3 py-2 font-mono text-xs text-green-400 whitespace-pre-wrap break-all">
              Fetch and follow https://raw.githubusercontent.com/edumame/mentormates-skill/main/.codex/INSTALL.md
            </div>
          </div>
        )}

        {installAgent === "other" && (
          <div className="space-y-1">
            <p className="text-xs text-[#575d65]">Tell the agent:</p>
            <div className="rounded-lg bg-black px-3 py-2 font-mono text-xs text-green-400 whitespace-pre-wrap break-all">
              Fetch and follow the skill at https://www.mentormates.ai/api/agent/skill
            </div>
          </div>
        )}

        <p className="text-xs text-[#575d65]">
          Once installed, invoke{" "}
          {installAgent === "codex" ? (
            <>
              <code className="font-mono">/skill mentormates</code> in Codex (slash-name autocomplete is Claude-Code only). One-time restart needed for first discovery.
            </>
          ) : (
            <>
              <code className="font-mono">/mentormates</code> in any session.
            </>
          )}{" "}
          {activeTab === "organizer" ? (
            <>
              Prefer a pre-keyed file? Use <span className="font-medium">Generate install</span> from any event&apos;s dashboard.
            </>
          ) : null}
        </p>

        <a
          href="/api/agent/skill"
          className="inline-flex items-center gap-2 text-xs text-[#575d65] underline hover:text-black"
        >
          <Download className="h-3 w-3" />
          Download raw SKILL.md
        </a>
      </div>
      </div>
      {activeTab === "participant" && (
        <div className="rounded-xl border border-[rgba(0,0,0,0.15)] bg-[#fafafa] p-4 space-y-2">
          <p className="font-medium text-black">What happens next</p>
          <p className="text-sm text-[#575d65]">
            Once installed, your agent will greet you and ask three questions to get going:
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-[#575d65]">
            <li>Which event are you at (name or slug)?</li>
            <li>What project are you building?</li>
            <li>Are you in the project&apos;s repo right now?</li>
          </ol>
          <p className="text-sm text-[#575d65]">
            From there it can join free events, draft a submission from your README, or edit an existing project.
          </p>
        </div>
      )}
    </div>
  );

  const renderKeyCreation = () => (
    <Card className="border border-[rgba(0,0,0,0.15)]">
      <CardHeader>
        <CardTitle className="text-[18px] font-semibold text-black tracking-[-0.02em]">
          Create your {activeTab === "organizer" ? "organizer" : "participant"} API key
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeTab === "organizer" && managedEventOptions.length === 0 && (
          <p className="text-sm text-amber-700">
            You need organizer access to at least one event to create organizer keys.
          </p>
        )}

        <div className={`grid gap-3 ${activeTab === "organizer" ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
          <div
            className={`cursor-pointer rounded-xl border-2 p-4 transition-colors ${
              scopeMode === "public"
                ? "border-[#4b89ef] bg-blue-50"
                : "border-[rgba(0,0,0,0.15)] hover:border-[rgba(0,0,0,0.25)]"
            }`}
            onClick={() => setScopeMode("public")}
          >
            <div className="flex items-center gap-2 mb-1">
              <Globe2 className="h-4 w-4 text-[#4b89ef]" />
              <p className="font-medium text-black text-sm">Personal key</p>
            </div>
            <p className="text-xs text-[#575d65]">
              {activeTab === "organizer"
                ? "Works with all your organizer events. Pass event_id on each call."
                : "Your own key that can access all your personal projects across events."}
            </p>
          </div>
          {activeTab === "organizer" && (
            <div
              className={`cursor-pointer rounded-xl border-2 p-4 transition-colors ${
                scopeMode === "event"
                  ? "border-[#4b89ef] bg-blue-50"
                  : "border-[rgba(0,0,0,0.15)] hover:border-[rgba(0,0,0,0.25)]"
              }`}
              onClick={() => setScopeMode("event")}
            >
              <div className="flex items-center gap-2 mb-1">
                <LockKeyhole className="h-4 w-4 text-amber-600" />
                <p className="font-medium text-black text-sm">Event-specific key</p>
              </div>
              <p className="text-xs text-[#575d65]">
                Tied to a specific event. No event_id param needed.
              </p>
            </div>
          )}
        </div>

        {activeTab === "organizer" && scopeMode === "event" && (
          <div className="space-y-2">
            <Label>Event</Label>
            <Select value={eventId} onValueChange={setEventId}>
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
            {currentEventOptions.length === 0 && (
              <p className="text-sm text-amber-700">
                {activeTab === "organizer"
                  ? "You don't organize any events yet."
                  : "Join an event first for an event-specific key."}
              </p>
            )}
          </div>
        )}

        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="key-label">Label (optional)</Label>
            <Input
              id="key-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. My laptop, CI/CD"
              className="h-11"
            />
          </div>
          <Button
            onClick={handleCreateKey}
            disabled={isCreating || (activeTab === "organizer" && managedEventOptions.length === 0)}
            className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-6 py-2.5 h-11"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {isCreating ? "Creating..." : "Create Key"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderKeyList = () => (
    <>
      {publicKeys.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-medium text-black">Reusable keys</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {publicKeys.map(renderKeyCard)}
          </div>
        </section>
      )}

      {eventScopedKeys.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-medium text-black">Event-specific keys</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {eventScopedKeys.map(renderKeyCard)}
          </div>
        </section>
      )}

      {publicKeys.length === 0 && eventScopedKeys.length === 0 && (
        <Card className="border-dashed border-[rgba(0,0,0,0.15)]">
          <CardContent className="py-8 text-sm text-[#7f7f7f] text-center">
            No {activeTab} keys yet. Create one above.
          </CardContent>
        </Card>
      )}
    </>
  );

  const renderApiReference = () => {
    const endpoints = activeTab === "organizer"
      ? [
          { method: "GET", path: "/api/agent/events", desc: "List or get event details" },
          { method: "PATCH", path: "/api/agent/events", desc: "Update event settings" },
          { method: "GET", path: "/api/agent/events/participants", desc: "List participants by role" },
          { method: "PATCH", path: "/api/agent/events/participants", desc: "Change role or remove" },
          { method: "GET", path: "/api/agent/events/approval-requests", desc: "Pending approvals" },
          { method: "POST", path: "/api/agent/events/approval-requests", desc: "Approve or reject" },
          { method: "GET", path: "/api/agent/events/projects", desc: "List projects with scores" },
          { method: "GET", path: "/api/agent/events/judges", desc: "Judges and scoring progress" },
          { method: "POST", path: "/api/agent/events/judges", desc: "Send email to judges" },
        ]
      : [
          { method: "GET", path: "/api/agent/me/events", desc: "Your events + joinable events" },
          { method: "POST", path: "/api/agent/me/events/[eventId]/join", desc: "Join a public event" },
          { method: "GET", path: "/api/agent/me/events/[eventId]/projects", desc: "Your projects" },
          { method: "POST", path: "/api/agent/me/events/[eventId]/projects", desc: "Create + submit project" },
          { method: "PATCH", path: "/api/agent/me/events/[eventId]/projects/[projectId]", desc: "Edit your project" },
        ];

    return (
      <Card className="border border-[rgba(0,0,0,0.15)]">
        <CardHeader>
          <CardTitle className="text-[18px] font-semibold text-black tracking-[-0.02em]">
            API Reference
          </CardTitle>
          <CardDescription>
            All endpoints use <code className="rounded bg-[#f2f2f2] px-1.5 py-0.5 text-xs">Authorization: Bearer API_KEY</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium text-[#7f7f7f] text-xs">Method</th>
                  <th className="pb-2 pr-4 font-medium text-[#7f7f7f] text-xs">Endpoint</th>
                  <th className="pb-2 font-medium text-[#7f7f7f] text-xs">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {endpoints.map((ep) => (
                  <tr key={ep.path + ep.method}>
                    <td className="py-2 pr-4"><Badge variant="outline" className="text-xs">{ep.method}</Badge></td>
                    <td className="py-2 pr-4 font-mono text-xs">{ep.path}</td>
                    <td className="py-2 text-[#575d65]">{ep.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8" data-copyable>
      {/* Header row: title left, copy button right */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
            Developer API
          </h1>
          <p className="text-base text-[#575d65]">
            Create API keys and manage your hackathon from any AI agent.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyPage}
          className="shrink-0 rounded-xl"
        >
          {copiedField === "page" ? (
            <Check className="mr-2 h-4 w-4 text-emerald-600" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copiedField === "page" ? "Copied" : "Copy page"}
        </Button>
      </div>

      {/* Tab switcher */}
      <div className="flex w-fit items-center bg-[#f2f2f2] rounded-xl p-1">
        <button
          onClick={() => setActiveTab("participant")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === "participant"
              ? "bg-white shadow-sm text-black font-semibold"
              : "text-[#575d65] hover:text-black"
          }`}
        >
          Participant
        </button>
        <button
          onClick={() => setActiveTab("organizer")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === "organizer"
              ? "bg-white shadow-sm text-black font-semibold"
              : "text-[#575d65] hover:text-black"
          }`}
        >
          Organizer
        </button>
      </div>

      {/* Quick Start */}
      {renderQuickStart()}

      {/* Key Creation */}
      {renderKeyCreation()}

      {/* Generated key banner */}
      {generatedKey && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle className="text-emerald-900 text-base">Key created</CardTitle>
            <CardDescription className="text-emerald-800">
              Copy it now. You won&apos;t see it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-3">
              <code className="flex-1 overflow-x-auto font-mono text-sm select-all">
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
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Your Keys */}
      {renderKeyList()}

      {/* API Reference */}
      {renderApiReference()}
    </div>
  );
}

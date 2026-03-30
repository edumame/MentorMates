"use client";

import { useMemo, useState } from "react";
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
import { AlertTriangle, Check, Copy, Globe2, KeyRound, LockKeyhole, Trash2 } from "lucide-react";

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
  eventOptions: KeyEventOption[];
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
  eventOptions,
}: KeysPageClientProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [label, setLabel] = useState("");
  const [eventId, setEventId] = useState(eventOptions[0]?.id ?? "");
  const [scopeMode, setScopeMode] = useState<"public" | "event">("public");
  const [generatedKey, setGeneratedKey] = useState<GeneratedKeyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  const eventMap = useMemo(
    () => new Map(eventOptions.map((event) => [event.id, event])),
    [eventOptions]
  );
  const publicKeys = keys.filter((key) => !key.event_id);
  const eventScopedKeys = keys.filter((key) => key.event_id);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCreateKey = async () => {
    if (!eventId) {
      setError("Choose an event to authorize this key.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/agent/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
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
      <Card key={key.id} className="border border-slate-200">
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{key.label || "default"}</CardTitle>
                <Badge variant="secondary">{keyType}</Badge>
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
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          API Keys
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Create and revoke agent API keys in one place. Reusable keys work across
          events and require an `event_id` query param. Event-specific keys stay
          locked to one event.
        </p>
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
            Choose an event you can manage to authorize the key. Then decide
            whether the key should stay reusable or be locked to that event.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1.1fr_1.2fr_0.9fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="key-label">Label</Label>
            <Input
              id="key-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Recruiting agent"
            />
          </div>
          <div className="space-y-2">
            <Label>Authorization Event</Label>
            <Select value={eventId} onValueChange={setEventId} disabled={eventOptions.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                {eventOptions.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Key Type</Label>
            <Select
              value={scopeMode}
              onValueChange={(value) => setScopeMode(value as "public" | "event")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Reusable</SelectItem>
                <SelectItem value="event">Event-specific</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleCreateKey}
            disabled={isCreating || eventOptions.length === 0}
            className="md:min-w-36"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {isCreating ? "Creating..." : "Create Key"}
          </Button>
        </CardContent>
        {eventOptions.length === 0 ? (
          <CardContent className="pt-0">
            <p className="text-sm text-amber-700">
              You need organizer access to at least one event before you can mint
              agent keys here.
            </p>
          </CardContent>
        ) : null}
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
    </div>
  );
}

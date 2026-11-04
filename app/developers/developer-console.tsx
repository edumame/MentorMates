"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  Terminal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ModelKey,
  KeyPage,
  ModelRequestRecord,
  RequestPage,
} from "@/lib/model-api/types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error?.message || "The request failed. Please try again.",
    );
  return body as T;
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function DeveloperConsole({
  minuteLimit,
  dayLimit,
}: {
  minuteLimit: number;
  dayLimit: number;
}) {
  const [keys, setKeys] = useState<ModelKey[]>([]);
  const [keyCursor, setKeyCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<RequestPage>({
    requests: [],
    next_cursor: null,
  });
  const [detail, setDetail] = useState<ModelRequestRecord | null>(null);
  const [label, setLabel] = useState("");
  const [expiryDays, setExpiryDays] = useState("90");
  const [secret, setSecret] = useState<{ value: string; keyId: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>("load");
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://YOUR_DOMAIN");

  async function run(name: string, action: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Something went wrong.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    const [keyPage, requestPage] = await Promise.all([
      api<KeyPage>("/api/model-api/keys"),
      api<RequestPage>("/api/model-api/requests"),
    ]);
    setKeys(keyPage.keys);
    setKeyCursor(keyPage.next_cursor);
    setHistory(requestPage);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    void run("load", refresh);
  }, []);

  const sample = `curl ${origin}/api/v1/systemone \\\n  -H "Authorization: Bearer $MENTORMATES_MODEL_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"jev-latest","state":"Please help me reset my password.","questions":{"needs_help":{"type":"noul","instructions":"Is the user asking for help?"}}}'`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
            <Terminal size={16} /> Developer console
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Model API
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Bring Jev into your applications with one API key. Manage access and
            inspect every inference request here.
          </p>
        </div>
        <Badge variant="secondary" className="mt-2">
          Jev · TypeSafe
        </Badge>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Available model", "jev-latest"],
          ["Per minute", `${minuteLimit.toLocaleString()} requests`],
          ["Per day · UTC", `${dayLimit.toLocaleString()} requests`],
        ].map(([name, value]) => (
          <div key={name} className="rounded-xl border bg-slate-50/60 p-5">
            <p className="text-sm text-slate-500">{name}</p>
            <p className="mt-2 font-mono text-lg font-medium text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <KeyRound size={20} /> API keys
          </CardTitle>
          <CardDescription>
            Keys belong to your account and share its request limits. Keep them
            in your application’s server environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {keyCursor && <Button variant="outline" disabled={!!busy} onClick={() => void run("more-keys", async () => {
            const page = await api<KeyPage>(`/api/model-api/keys?cursor=${encodeURIComponent(keyCursor)}`);
            setKeys((current) => [...current, ...page.keys]);
            setKeyCursor(page.next_cursor);
          })}>Load older keys</Button>}
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run("create", async () => {
                const expires_at =
                  expiryDays === "never"
                    ? null
                    : new Date(
                        Date.now() + Number(expiryDays) * 86_400_000,
                      ).toISOString();
                const result = await api<{ api_key: string; key: ModelKey }>(
                  "/api/model-api/keys",
                  {
                    method: "POST",
                    body: JSON.stringify({ label, expires_at }),
                  },
                );
                setKeys((current) => [result.key, ...current]);
                setSecret({ value: result.api_key, keyId: result.key.id });
                setCopied(false);
                setLabel("");
              });
            }}
          >
            <div className="min-w-48 flex-1 space-y-2">
              <Label htmlFor="key-label">Key name</Label>
              <Input
                id="key-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. My application"
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-expiry">Expires in</Label>
              <select
                id="key-expiry"
                className="block h-10 rounded-md border bg-white px-3 text-sm"
                value={expiryDays}
                onChange={(event) => setExpiryDays(event.target.value)}
              >
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
                <option value="never">Never</option>
              </select>
            </div>
            <Button
              type="submit"
              disabled={!!busy || !label.trim() || !!secret}
            >
              {busy === "create" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create key
            </Button>
          </form>

          {secret && (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-medium text-emerald-950">
                Copy your key now. It will only be shown once.
              </p>
              <code
                data-testid="new-api-key"
                className="block break-all rounded-md bg-white/80 p-3 text-sm"
              >
                {secret.value}
              </code>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    void run("copy", async () => {
                      await navigator.clipboard.writeText(secret.value);
                      setCopied(true);
                    })
                  }
                  disabled={!!busy}
                >
                  {copied ? (
                    <Check size={16} className="mr-2" />
                  ) : (
                    <Copy size={16} className="mr-2" />
                  )}
                  {copied ? "Copied" : "Copy key"}
                </Button>
                <Button variant="ghost" onClick={() => setSecret(null)}>
                  I saved my key
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Key</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium">Last used</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td className="px-4 py-3 font-medium">
                      {key.label}
                      {key.revoked_at && (
                        <span className="ml-2 text-xs text-slate-500">
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {key.key_prefix}…
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {key.expires_at ? date(key.expires_at) : "Never"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {date(key.last_used_at)}
                    </td>
                    <td className="px-4 py-3">
                      {!key.revoked_at && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!!busy}
                          aria-label={`Revoke ${key.label}`}
                          onClick={() =>
                            void run(key.id, async () => {
                              await api("/api/model-api/keys", {
                                method: "DELETE",
                                body: JSON.stringify({ key_id: key.id }),
                              });
                              setKeys((current) =>
                                current.map((item) =>
                                  item.id === key.id
                                    ? {
                                        ...item,
                                        revoked_at: new Date().toISOString(),
                                      }
                                    : item,
                                ),
                              );
                              if (secret?.keyId === key.id) setSecret(null);
                            })
                          }
                        >
                          <Trash2 size={14} className="mr-2" />
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      {busy === "load"
                        ? "Loading keys…"
                        : "Create your first key to start using Jev."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Make your first request</CardTitle>
          <CardDescription>
            Set MENTORMATES_MODEL_API_KEY to your key, then run this example.
            Jev returns typed answers and token usage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-5 text-xs leading-6 text-slate-100">
            <code>{sample}</code>
          </pre>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <a
              className="inline-flex items-center gap-1 text-blue-700 hover:underline"
              href="https://docs.typesafe.ai/api"
              target="_blank"
              rel="noreferrer"
            >
              Question and response formats
              <ArrowUpRight size={14} />
            </a>
            <Link className="text-slate-500 hover:underline" href="/keys">
              Event agent keys
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="text-xl">Request history</CardTitle>
            <CardDescription>
              Request and response content is saved to your account. Avoid
              submitting secrets in model input.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!!busy}
            onClick={() => void run("refresh", refresh)}
          >
            <RefreshCw size={14} className="mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {[
                    "Time",
                    "Model",
                    "Status",
                    "Tokens in / out",
                    "Duration",
                    "",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-4 py-3 font-medium"
                    >
                      {heading || <span className="sr-only">Details</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.requests.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {date(item.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.resolved_model || item.requested_model || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          item.state === "failed" ? "destructive" : "secondary"
                        }
                      >
                        {item.state === "pending"
                          ? "Awaiting completion"
                          : item.http_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.input_tokens ?? "—"} / {item.output_tokens ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.duration_ms === null
                        ? "—"
                        : `${item.duration_ms} ms`}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!!busy}
                        aria-label={`View request ${item.id}`}
                        onClick={() =>
                          void run("detail", async () => {
                            const result = await api<{
                              request: ModelRequestRecord;
                            }>(`/api/model-api/requests?id=${item.id}`);
                            setDetail(result.request);
                          })
                        }
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
                {history.requests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      {busy === "load"
                        ? "Loading requests…"
                        : "Your model requests will appear here."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {history.next_cursor && (
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                void run("more", async () => {
                  const next = await api<RequestPage>(
                    `/api/model-api/requests?cursor=${encodeURIComponent(history.next_cursor!)}`,
                  );
                  setHistory((current) => ({
                    requests: [...current.requests, ...next.requests],
                    next_cursor: next.next_cursor,
                  }));
                })
              }
            >
              Load older requests
            </Button>
          )}
          {detail && (
            <section
              aria-label="Request details"
              className="space-y-4 rounded-xl border bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">Request details</h3>
                  <p className="break-all font-mono text-xs text-slate-500">
                    {detail.id}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetail(null)}
                >
                  Close details
                </Button>
              </div>
              {detail.state === "pending" && (
                <p className="text-sm text-amber-800">
                  The request was recorded, but a completion has not been saved.
                  It may still be running or its completion record may be
                  unavailable.
                </p>
              )}
              {[
                ["Request", detail.request_body],
                ["Response", detail.response_body],
              ].map(([title, value]) => (
                <div key={String(title)}>
                  <h4 className="mb-2 text-sm font-medium">{String(title)}</h4>
                  <pre className="max-h-96 overflow-auto rounded-lg border bg-white p-4 text-xs">
                    <code>{JSON.stringify(value, null, 2)}</code>
                  </pre>
                </div>
              ))}
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

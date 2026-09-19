"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { askJev, buildQuestion, type JevKind, type JevResult } from "@/lib/internal/jev-client";

const KEY_STORAGE = "mm:jev:apiKey";

type Turn = { id: number; state: string; instructions: string; result: JevResult };

const examples: { label: string; state: string; kind: JevKind; instructions: string; criteria: string }[] = [
  { label: "Yes/no: is this a sales pitch?", state: "Hi, quick question about your hiring plans for Q4, we help teams like yours scale.", kind: "noul", instructions: "Is this message a sales pitch?", criteria: "" },
  { label: "Classify a support message", state: "I was charged twice this month.", kind: "choice", instructions: "What kind of request is this?", criteria: "billing, bug, feature request" },
  { label: "Score urgency", state: "Production is down for all customers.", kind: "score", instructions: "How urgent is this?", criteria: "not urgent, somewhat urgent, very urgent" },
];

const kindHelp: Record<JevKind, string> = {
  noul: "Jev returns a yes/no with a probability.",
  choice: "Comma-separated options. Jev picks one and gives a probability for each.",
  score: "Comma-separated ordered levels, lowest first. Jev returns a weighted score.",
};

export function JevPlayground({ invite, label }: { invite: string; label: string | null }) {
  const [apiKey, setApiKey] = useState("");
  const [state, setState] = useState("");
  const [instructions, setInstructions] = useState("");
  const [kind, setKind] = useState<JevKind>("noul");
  const [criteria, setCriteria] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const latest = turns[0];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY_STORAGE);
      if (saved) setApiKey(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const needsCriteria = kind !== "noul";
  const canAsk =
    apiKey.trim().length > 0 &&
    state.trim().length > 0 &&
    instructions.trim().length > 0 &&
    (!needsCriteria || criteria.trim().length > 0) &&
    !busy;

  async function submit() {
    if (!canAsk) return;
    setBusy(true);
    try {
      localStorage.setItem(KEY_STORAGE, apiKey.trim());
    } catch {
      /* ignore */
    }
    const question = buildQuestion({ kind, instructions, criteria });
    const result = await askJev(fetch, { invite, apiKey, state: state.trim(), question });
    setTurns((prev) => [{ id: Date.now(), state: state.trim(), instructions: instructions.trim(), result }, ...prev].slice(0, 20));
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <div className="text-xs font-medium uppercase tracking-wide text-blue-600">MentorMates internal</div>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Jev playground</h1>
      <p className="mt-2 text-sm text-gray-600">
        Invite for <span className="font-medium text-gray-900">{label || invite}</span>. Jev answers yes/no, multiple-choice, and scored questions about a piece of text. Five calls a minute. Your key stays in this browser.
      </p>

      <div className="mt-8 space-y-4">
        <div>
          <label htmlFor="jev-key" className="text-sm font-medium">MentorMates API key</label>
          <Input id="jev-key" type="password" autoComplete="off" placeholder="mm_sk_..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="mt-1" />
          <p className="mt-1 text-xs text-gray-500">Create one under Profile &gt; API Keys. Organizer or participant keys both work.</p>
        </div>

        <div>
          <label htmlFor="jev-state" className="text-sm font-medium">Text to evaluate</label>
          <Textarea id="jev-state" rows={4} placeholder="Paste the message, email, or description Jev should look at." value={state} onChange={(e) => setState(e.target.value)} className="mt-1" />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <div>
            <label htmlFor="jev-question" className="text-sm font-medium">Question</label>
            <Input id="jev-question" placeholder="What should Jev decide about it?" value={instructions} onChange={(e) => setInstructions(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label htmlFor="jev-kind" className="text-sm font-medium">Answer type</label>
            <select
              id="jev-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as JevKind)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="noul">Yes / no</option>
              <option value="choice">Pick one</option>
              <option value="score">Score</option>
            </select>
          </div>
        </div>

        {needsCriteria && (
          <div>
            <label htmlFor="jev-criteria" className="text-sm font-medium">{kind === "choice" ? "Options" : "Levels"}</label>
            <Input id="jev-criteria" placeholder={kind === "choice" ? "billing, bug, feature request" : "low, medium, high"} value={criteria} onChange={(e) => setCriteria(e.target.value)} className="mt-1" />
          </div>
        )}
        <p className="text-xs text-gray-500">{kindHelp[kind]}</p>

        <div className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => {
                setState(ex.state);
                setKind(ex.kind);
                setInstructions(ex.instructions);
                setCriteria(ex.criteria);
              }}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              {ex.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={!canAsk}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Ask Jev
          </Button>
          {latest?.result.remaining !== undefined && <span className="text-xs text-gray-500">{latest.result.remaining} calls left this minute</span>}
        </div>
      </div>

      {latest && !latest.result.ok && (
        <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {latest.result.error}
        </div>
      )}

      {turns.some((t) => t.result.ok) && (
        <div className="mt-8 space-y-4">
          {turns
            .filter((t) => t.result.ok)
            .map((t, i) => (
              <div key={t.id} className="rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-400">{t.instructions}</div>
                <div className="mt-1 text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">{t.state}</div>
                <div data-testid={i === 0 ? "jev-answer" : undefined} className="mt-2 text-lg font-medium">
                  {t.result.answer || "(no answer)"}
                </div>
                <div className="mt-2 text-xs text-gray-400">{t.result.latencyMs} ms</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

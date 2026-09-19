"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { askJev, type JevResult } from "@/lib/internal/jev-client";

const KEY_STORAGE = "mm:jev:apiKey";

type Turn = { id: number; question: string; result: JevResult };

const examples = [
  "Is this a sales pitch? \"Hi, quick question about your hiring plans for Q4, we help teams like yours scale.\" Answer true or false.",
  "Classify this support message as billing, bug, or feature request: \"I was charged twice this month.\"",
  "On a scale of 1 to 10, how urgent is this: \"Production is down for all customers.\"",
];

export function JevPlayground({ invite, label }: { invite: string; label: string | null }) {
  const [apiKey, setApiKey] = useState("");
  const [question, setQuestion] = useState("");
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

  const canAsk = apiKey.trim().length > 0 && question.trim().length > 0 && !busy;

  async function submit() {
    if (!canAsk) return;
    setBusy(true);
    try {
      localStorage.setItem(KEY_STORAGE, apiKey.trim());
    } catch {
      /* ignore */
    }
    const result = await askJev(fetch, { invite, apiKey, question: question.trim() });
    setTurns((prev) => [{ id: Date.now(), question: question.trim(), result }, ...prev].slice(0, 20));
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <div className="text-xs font-medium uppercase tracking-wide text-blue-600">MentorMates internal</div>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Jev playground</h1>
      <p className="mt-2 text-sm text-gray-600">
        Invite for <span className="font-medium text-gray-900">{label || invite}</span>. Jev answers true/false, multiple-choice, and numeric-score questions. Five calls a minute. Your key stays in this browser.
      </p>

      <div className="mt-8 space-y-4">
        <div>
          <label htmlFor="jev-key" className="text-sm font-medium">MentorMates API key</label>
          <Input
            id="jev-key"
            type="password"
            autoComplete="off"
            placeholder="mm_sk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-gray-500">Create one under Profile &gt; API Keys. Organizer or participant keys both work.</p>
        </div>
        <div>
          <label htmlFor="jev-question" className="text-sm font-medium">Question</label>
          <Textarea
            id="jev-question"
            rows={4}
            placeholder="Ask something with a yes/no, multiple-choice, or scored answer."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            className="mt-1"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuestion(ex)}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                {ex.slice(0, 48)}…
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={!canAsk}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Ask Jev
          </Button>
          {latest?.result.remaining !== undefined && (
            <span className="text-xs text-gray-500">{latest.result.remaining} calls left this minute</span>
          )}
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
                <div className="text-sm text-gray-500 whitespace-pre-wrap">{t.question}</div>
                <div data-testid={i === 0 ? "jev-answer" : undefined} className="mt-2 text-lg font-medium whitespace-pre-wrap">
                  {t.result.answer || "(empty answer)"}
                </div>
                <div className="mt-2 text-xs text-gray-400">{t.result.latencyMs} ms</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

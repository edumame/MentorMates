"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Copy, Download, Key, Terminal } from "lucide-react";

interface InstallData {
  api_key: string;
  event_name: string;
  skill_content: string;
  setup_commands: {
    env_export: string;
    skill_save: string;
  };
}

export default function SkillInstallPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InstallData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to generate");
        return;
      }
      setData(json);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const downloadSkill = () => {
    if (!data) return;
    const blob = new Blob([data.skill_content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mentormates.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const CopyButton = ({
    text,
    field,
  }: {
    text: string;
    field: string;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0"
      onClick={() => copyToClipboard(text, field)}
    >
      {copiedField === field ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
              <Terminal className="h-7 w-7 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">
              Connect to Claude Code
            </CardTitle>
            <CardDescription className="text-base">
              Manage this event from your terminal using Claude Code, Codex, or
              any AI agent. One click to set up.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                {error}
              </p>
            )}
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={loading}
              className="px-8"
            >
              <Key className="h-4 w-4 mr-2" />
              {loading ? "Generating..." : "Generate Install Link"}
            </Button>
            <p className="text-xs text-gray-500">
              This will create an API key scoped to this event.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-16 px-4 space-y-6">
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Check className="h-5 w-5" />
            Ready to install — {data.event_name}
          </CardTitle>
          <CardDescription className="text-green-700">
            Follow these 2 steps to connect your agent.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Step 1: Download skill */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Step 1: Download the skill file
          </CardTitle>
          <CardDescription>
            Save this to your project&apos;s{" "}
            <code className="bg-gray-100 px-1 rounded">.claude/commands/</code>{" "}
            directory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={downloadSkill} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download mentormates.md
          </Button>
          <div className="text-center text-xs text-gray-500">or copy the command:</div>
          <div className="flex items-center gap-2 bg-gray-900 text-green-400 rounded-lg px-4 py-3 font-mono text-sm">
            <code className="flex-1 break-all">
              mkdir -p .claude/commands && curl -sL &quot;{typeof window !== "undefined" ? window.location.origin : ""}/api/agent/install&quot; -X POST -H &quot;Content-Type: application/json&quot; -d &apos;{`{"event_id":"${eventId}"}`}&apos; | jq -r .skill_content &gt; .claude/commands/mentormates.md
            </code>
            <CopyButton
              text={`mkdir -p .claude/commands && curl -sL "${typeof window !== "undefined" ? window.location.origin : ""}/api/agent/install" -X POST -H "Content-Type: application/json" -d '{"event_id":"${eventId}"}' | jq -r .skill_content > .claude/commands/mentormates.md`}
              field="curl"
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Done — the key is baked in */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Step 2: Start using it
          </CardTitle>
          <CardDescription>
            The API key is already embedded in the skill file. Just run Claude
            Code in your project and use{" "}
            <code className="bg-gray-100 px-1 rounded">/mentormates</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-gray-900 text-green-400 rounded-lg px-4 py-3 font-mono text-sm space-y-1">
            <p className="text-gray-500"># In your project directory:</p>
            <p>claude</p>
            <p className="text-gray-500"># Then type:</p>
            <p>/mentormates</p>
            <p className="text-gray-500"># Or just ask:</p>
            <p>&quot;Show me my event overview&quot;</p>
          </div>
        </CardContent>
      </Card>

      {/* API Key reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">
            Your API Key (for reference)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-100 border rounded px-3 py-2 text-sm font-mono break-all">
              {data.api_key}
            </code>
            <CopyButton text={data.api_key} field="key" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            This key is embedded in the downloaded skill file. You can revoke it
            from Event Settings → API Keys.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

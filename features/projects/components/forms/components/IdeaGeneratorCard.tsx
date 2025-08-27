import { Lightbulb } from "lucide-react";
import { toast } from "@/lib/hooks/use-toast";

interface IdeaGeneratorCardProps {
  contextusId?: string | null;
}

export function IdeaGeneratorCard({ contextusId }: IdeaGeneratorCardProps) {
  if (!contextusId) return null;

  const url = `https://idea-generation-prd.lovable.app/?contextus_id=${encodeURIComponent(
    contextusId
  )}`;

  return (
    <div className="group relative overflow-hidden rounded-lg bg-white border border-gray-200/60 hover:border-amber-300/60 transition-all duration-300 hover:shadow-md hover:shadow-amber-50/50 hover:-translate-y-0.5">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative p-4 pb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="relative p-2 rounded-lg bg-amber-50 border border-amber-100">
              <Lightbulb className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-gray-900 group-hover:text-amber-900 transition-colors duration-300">
                Idea Generator
              </h4>
              <p className="text-xs text-gray-500">Generate project ideas and inspiration</p>
            </div>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center px-2.5 h-8 rounded-md bg-gray-50 hover:bg-amber-50 border border-gray-200/50 hover:border-amber-200/50 transition-all duration-300 group-hover:shadow-sm text-xs font-medium text-gray-700"
            aria-label="Open Idea Generator"
          >
            Open
          </a>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Works in a new tab</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(url);
              toast({
                title: "Link copied!",
                description: "Idea Generator link copied to clipboard",
              });
            }}
            className="text-xs text-amber-700 hover:text-amber-800 font-medium hover:underline transition-colors duration-200"
          >
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}


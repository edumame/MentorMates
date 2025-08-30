"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/hooks/use-toast";
import {
  SUBMISSION_TOOLS,
  type ToolDefinition,
  type ToolIconName,
  type ToolTheme,
} from "@/lib/config/tools";
import {
  Lightbulb,
  Globe,
  Sparkles,
  Presentation,
  Eye,
  FileText,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<ToolIconName, LucideIcon> = {
  Lightbulb,
  Globe,
  Sparkles,
  Presentation,
  Eye,
  FileText,
};

const themeClasses: Record<
  ToolTheme,
  {
    gradientFrom: string;
    gradientTo: string;
    borderHover: string;
    shadowHover: string;
    iconBg: string;
    iconBorder: string;
    iconColor: string;
    smallIconText: string;
    openHoverBg: string;
    openHoverBorder: string;
  }
> = {
  amber: {
    gradientFrom: "from-amber-500/5",
    gradientTo: "to-yellow-500/5",
    borderHover: "hover:border-amber-300/60",
    shadowHover: "hover:shadow-amber-50/50",
    iconBg: "bg-amber-50",
    iconBorder: "border-amber-100",
    iconColor: "text-amber-600",
    smallIconText: "text-amber-500",
    openHoverBg: "hover:bg-amber-50",
    openHoverBorder: "hover:border-amber-200/50",
  },
  blue: {
    gradientFrom: "from-blue-500/3",
    gradientTo: "to-indigo-500/3",
    borderHover: "hover:border-blue-300/60",
    shadowHover: "hover:shadow-blue-50/50",
    iconBg: "bg-blue-50",
    iconBorder: "border-blue-100",
    iconColor: "text-blue-600",
    smallIconText: "text-blue-500",
    openHoverBg: "hover:bg-blue-50",
    openHoverBorder: "hover:border-blue-200/50",
  },
  purple: {
    gradientFrom: "from-purple-500/3",
    gradientTo: "to-pink-500/3",
    borderHover: "hover:border-purple-300/60",
    shadowHover: "hover:shadow-purple-50/50",
    iconBg: "bg-purple-50",
    iconBorder: "border-purple-100",
    iconColor: "text-purple-600",
    smallIconText: "text-purple-500",
    openHoverBg: "hover:bg-purple-50",
    openHoverBorder: "hover:border-purple-200/50",
  },
  orange: {
    gradientFrom: "from-orange-500/3",
    gradientTo: "to-yellow-500/3",
    borderHover: "hover:border-orange-300/60",
    shadowHover: "hover:shadow-orange-50/50",
    iconBg: "bg-orange-50",
    iconBorder: "border-orange-100",
    iconColor: "text-orange-600",
    smallIconText: "text-orange-500",
    openHoverBg: "hover:bg-orange-50",
    openHoverBorder: "hover:border-orange-200/50",
  },
  emerald: {
    gradientFrom: "from-emerald-500/3",
    gradientTo: "to-teal-500/3",
    borderHover: "hover:border-emerald-300/60",
    shadowHover: "hover:shadow-emerald-50/50",
    iconBg: "bg-emerald-50",
    iconBorder: "border-emerald-100",
    iconColor: "text-emerald-600",
    smallIconText: "text-emerald-500",
    openHoverBg: "hover:bg-emerald-50",
    openHoverBorder: "hover:border-emerald-200/50",
  },
  cyan: {
    gradientFrom: "from-cyan-500/3",
    gradientTo: "to-sky-500/3",
    borderHover: "hover:border-cyan-300/60",
    shadowHover: "hover:shadow-cyan-50/50",
    iconBg: "bg-cyan-50",
    iconBorder: "border-cyan-100",
    iconColor: "text-cyan-600",
    smallIconText: "text-cyan-500",
    openHoverBg: "hover:bg-cyan-50",
    openHoverBorder: "hover:border-cyan-200/50",
  },
};

function buildUrl(urlTemplate: string, contextusId: string) {
  return urlTemplate.replace("{contextusId}", encodeURIComponent(contextusId));
}

export function AvailableTools({
  contextusId,
  tools = SUBMISSION_TOOLS,
}: {
  contextusId?: string | null;
  tools?: ToolDefinition[];
}) {
  const [connectedMap, setConnectedMap] = useState<Record<string, boolean>>({});

  // Load and persist connection status per contextusId
  useEffect(() => {
    if (!contextusId) return;
    try {
      const storageKey = `tools_connected_status:${contextusId}`;
      const raw = window.localStorage.getItem(storageKey);
      setConnectedMap(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setConnectedMap({});
    }
  }, [contextusId]);

  const markConnected = (toolId: string) => {
    if (!contextusId) return;
    setConnectedMap((prev) => {
      const next = { ...prev, [toolId]: true };
      try {
        const storageKey = `tools_connected_status:${contextusId}`;
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // no-op
      }
      return next;
    });
  };

  if (!contextusId) return null;

  return (
    <div className="mt-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Available Tools
        </h3>
        <p className="text-sm text-gray-500">
          Enhance your project development with these AI-powered tools
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
        {tools.map((tool) => {
          const url = buildUrl(tool.urlTemplate, contextusId);
          const Icon = iconMap[tool.icon];
          const theme = themeClasses[tool.theme];

          return (
            <div
              key={tool.id}
              className={
                `group relative overflow-hidden rounded-lg bg-white border border-gray-200/60 ` +
                `${theme.borderHover} transition-all duration-300 hover:shadow-md ${theme.shadowHover} hover:-translate-y-0.5`
              }
            >
              <div
                className={
                  `absolute inset-0 bg-gradient-to-r ${theme.gradientFrom} ${theme.gradientTo} opacity-0 group-hover:opacity-100 transition-opacity duration-300`
                }
              />
              <div className="relative p-4 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`relative p-2 rounded-lg ${theme.iconBg} border ${theme.iconBorder}`}>
                      <Icon className={`w-6 h-6 ${theme.iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-gray-900 group-hover:opacity-90 transition-colors duration-300">
                          {tool.name}
                        </h4>
                        {/* Connection status badge */}
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          connectedMap[tool.id] 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {connectedMap[tool.id] ? 'Connected' : 'Not connected'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{tool.description}</p>
                    </div>
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={
                      `flex items-center justify-center px-2.5 h-8 rounded-md bg-gray-50 border border-gray-200/50 transition-all duration-300 group-hover:shadow-sm text-xs font-medium text-gray-700 ` +
                      `${theme.openHoverBg} ${theme.openHoverBorder}`
                    }
                    aria-label={`Open ${tool.name}`}
                    onClick={() => markConnected(tool.id)}
                  >
                    Open
                  </a>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs text-gray-600">
                    <svg className={`w-3.5 h-3.5 ${theme.smallIconText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{tool.badgeText}</span>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(url);
                      toast({
                        title: "Link copied!",
                        description: `${tool.name} link copied to clipboard`,
                      });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors duration-200"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


"use client";

import * as React from "react";

interface Props {
  type: string;
}

export function AgentTypeLabel({ type }: Props) {
  const rawType = (type ?? "").toString().trim();
  const cleanType = rawType.toLowerCase();

  if (!cleanType) return null;

  // Label is just the capitalized type string
  const label = cleanType.charAt(0).toUpperCase() + cleanType.slice(1);

  if (!label) return null;

  const base = "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset whitespace-nowrap";

  const getTypeClass = (t: string) => {
    switch (t) {
      case "product":
        return "bg-blue-50 text-blue-700 ring-blue-600/20";
      case "tech":
        return "bg-green-50 text-green-700 ring-green-600/20";
      case "judge":
        return "bg-purple-50 text-purple-700 ring-purple-600/20";
      case "brainstorm":
        return "bg-sky-50 text-sky-700 ring-sky-600/20";
      default:
        return "bg-gray-50 text-gray-700 ring-gray-600/20";
    }
  };

  return <span className={`${base} ${getTypeClass(cleanType)}`}>{label}</span>;
}

export default AgentTypeLabel;

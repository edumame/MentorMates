"use client";

import { Globe, Lock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

interface ProjectPrivacySelectProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function ProjectPrivacySelect({
  value,
  onValueChange,
  disabled = false,
}: ProjectPrivacySelectProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-black">Project visibility</label>
      <Select
        value={value ? "private" : "public"}
        onValueChange={(nextValue) => onValueChange(nextValue === "private")}
        disabled={disabled}
      >
        <SelectTrigger className="h-11 min-w-[150px] rounded-xl border-[rgba(0,0,0,0.15)] bg-white px-3">
          <div className="flex items-center gap-2">
            {value ? (
              <Lock className="h-4 w-4 text-gray-600" />
            ) : (
              <Globe className="h-4 w-4 text-gray-600" />
            )}
            <span className="text-sm font-medium text-black">
              {value ? "Private" : "Public"}
            </span>
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="public">Public</SelectItem>
          <SelectItem value="private">Private</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

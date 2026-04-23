"use client";

import { Link2, Trash2, Plus } from "lucide-react";
import type { WizardEventData, WizardResource } from "@/lib/types/wizard";

interface ResourcesEditorProps {
  event: WizardEventData;
  update: (fields: Partial<WizardEventData>) => void;
}

export function ResourcesEditor({ event, update }: ResourcesEditorProps) {
  const addResource = () => {
    update({
      resources: [
        ...event.resources,
        { id: `res-${Date.now()}`, name: "", link: "" },
      ],
    });
  };

  const updateResource = (index: number, changes: Partial<WizardResource>) => {
    update({
      resources: event.resources.map((r, i) =>
        i === index ? { ...r, ...changes } : r
      ),
    });
  };

  const removeResource = (index: number) => {
    update({ resources: event.resources.filter((_, i) => i !== index) });
  };

  return (
    <>
      <div>
        <h2 className="text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
          Resources
        </h2>
        <p className="text-base text-gray-500 mt-1">
          Add links to guides, documentation, and other helpful resources.
        </p>
      </div>

      {event.resources.map((resource, index) => (
        <div
          key={resource.id}
          className="rounded-xl border border-gray-200 bg-white p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Resource {index + 1}
            </h3>
            <button
              onClick={() => removeResource(index)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={resource.name}
                onChange={(e) =>
                  updateResource(index, { name: e.target.value })
                }
                placeholder="e.g., Getting Started Guide"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Link</label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="url"
                  value={resource.link}
                  onChange={(e) =>
                    updateResource(index, { link: e.target.value })
                  }
                  placeholder="https://..."
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {event.resources.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <Link2 className="mx-auto size-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            No resources yet. Add links to help participants.
          </p>
        </div>
      )}

      <button
        onClick={addResource}
        className="flex items-center gap-1.5 rounded-xl bg-[#4B89EF] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3E7EEA]"
      >
        <Plus className="size-4" />
        Add Resource
      </button>
    </>
  );
}

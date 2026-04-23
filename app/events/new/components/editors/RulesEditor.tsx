"use client";

import { Shield, Trash2, Plus } from "lucide-react";
import type { WizardEventData, WizardRuleSection } from "@/lib/types/wizard";

interface RulesEditorProps {
  event: WizardEventData;
  update: (fields: Partial<WizardEventData>) => void;
}

export function RulesEditor({ event, update }: RulesEditorProps) {
  const addSection = () => {
    update({
      rules: [
        ...event.rules,
        { id: `rule-${Date.now()}`, title: "", items: [""] },
      ],
    });
  };

  const updateSection = (index: number, changes: Partial<WizardRuleSection>) => {
    update({
      rules: event.rules.map((r, i) =>
        i === index ? { ...r, ...changes } : r
      ),
    });
  };

  const removeSection = (index: number) => {
    update({ rules: event.rules.filter((_, i) => i !== index) });
  };

  const addItem = (sectionIndex: number) => {
    const rules = event.rules.map((r, i) =>
      i === sectionIndex ? { ...r, items: [...r.items, ""] } : r
    );
    update({ rules });
  };

  const updateItem = (sectionIndex: number, itemIndex: number, value: string) => {
    const rules = event.rules.map((r, si) =>
      si === sectionIndex
        ? { ...r, items: r.items.map((item, ii) => (ii === itemIndex ? value : item)) }
        : r
    );
    update({ rules });
  };

  const removeItem = (sectionIndex: number, itemIndex: number) => {
    const rules = event.rules.map((r, si) =>
      si === sectionIndex
        ? { ...r, items: r.items.filter((_, ii) => ii !== itemIndex) }
        : r
    );
    update({ rules });
  };

  return (
    <>
      <div>
        <h2 className="text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
          Rules
        </h2>
        <p className="text-base text-gray-500 mt-1">
          Add rules and guidelines organized by section.
        </p>
      </div>

      {event.rules.map((section, sectionIndex) => (
        <div
          key={section.id}
          className="rounded-xl border border-gray-200 bg-white p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <input
              type="text"
              value={section.title}
              onChange={(e) =>
                updateSection(sectionIndex, { title: e.target.value })
              }
              placeholder="Section title (e.g., Eligibility)"
              className="text-lg font-semibold text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-300 flex-1"
            />
            <button
              onClick={() => removeSection(sectionIndex)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 shrink-0"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <div className="space-y-2">
            {section.items.map((item, itemIndex) => (
              <div key={itemIndex} className="flex items-start gap-2">
                <span className="mt-3 text-sm text-gray-400">
                  {itemIndex + 1}.
                </span>
                <textarea
                  value={item}
                  onChange={(e) =>
                    updateItem(sectionIndex, itemIndex, e.target.value)
                  }
                  placeholder="Rule text..."
                  rows={2}
                  className="flex-1 resize-y rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
                />
                <button
                  onClick={() => removeItem(sectionIndex, itemIndex)}
                  className="mt-2 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 shrink-0"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}

            <button
              onClick={() => addItem(sectionIndex)}
              className="flex items-center gap-1.5 rounded-[12px] border border-[#4b89ef] bg-white px-4 py-2.5 text-sm font-medium text-[#4b89ef] transition-colors hover:bg-[#F7FAFE]"
            >
              <Plus className="size-4" />
              Add rule
            </button>
          </div>
        </div>
      ))}

      {event.rules.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <Shield className="mx-auto size-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            No rules yet. Add a section to get started.
          </p>
        </div>
      )}

      <button
        onClick={addSection}
        className="flex items-center gap-1.5 rounded-[12px] bg-[rgba(0,0,0,0.05)] px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-[rgba(0,0,0,0.08)]"
      >
        <Plus className="size-4" />
        Add rule section
      </button>
    </>
  );
}

"use client";

import { HelpCircle, Trash2, Plus } from "lucide-react";
import type { WizardEventData, WizardFAQItem } from "@/lib/types/wizard";

interface FAQEditorProps {
  event: WizardEventData;
  update: (fields: Partial<WizardEventData>) => void;
}

export function FAQEditor({ event, update }: FAQEditorProps) {
  const addFAQ = () => {
    update({
      faqs: [
        ...event.faqs,
        { id: `faq-${Date.now()}`, question: "", answer: "" },
      ],
    });
  };

  const updateFAQ = (index: number, changes: Partial<WizardFAQItem>) => {
    update({
      faqs: event.faqs.map((f, i) =>
        i === index ? { ...f, ...changes } : f
      ),
    });
  };

  const removeFAQ = (index: number) => {
    update({ faqs: event.faqs.filter((_, i) => i !== index) });
  };

  return (
    <>
      <div>
        <h2 className="text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
          Frequently Asked Questions
        </h2>
        <p className="text-base text-gray-500 mt-1">
          Add common questions and answers for participants.
        </p>
      </div>

      {event.faqs.map((faq, index) => (
        <div
          key={faq.id}
          className="rounded-xl border border-gray-200 bg-white p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              FAQ {index + 1}
            </h3>
            <button
              onClick={() => removeFAQ(index)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Question
              </label>
              <input
                type="text"
                value={faq.question}
                onChange={(e) =>
                  updateFAQ(index, { question: e.target.value })
                }
                placeholder="e.g., How do I register?"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Answer
              </label>
              <textarea
                value={faq.answer}
                onChange={(e) =>
                  updateFAQ(index, { answer: e.target.value })
                }
                placeholder="Provide a helpful answer..."
                rows={3}
                className="w-full resize-y rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
              />
            </div>
          </div>
        </div>
      ))}

      {event.faqs.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <HelpCircle className="mx-auto size-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            No FAQs yet. Add your first question to help participants.
          </p>
        </div>
      )}

      <button
        onClick={addFAQ}
        className="flex items-center gap-1.5 rounded-xl bg-[#4B89EF] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3E7EEA]"
      >
        <Plus className="size-4" />
        Add FAQ
      </button>
    </>
  );
}

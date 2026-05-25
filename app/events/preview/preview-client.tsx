"use client";

import { EventItem } from "@/lib/types";
import { EventRow, EVENT_ROW_VARIANTS } from "@/components/events/event-row-variants";
import Link from "next/link";

export function PreviewClient({ events }: { events: EventItem[] }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-10">
        <p className="text-[13px] font-medium text-[rgba(0,0,0,0.5)] uppercase tracking-wide mb-2">
          Internal preview · not linked from nav
        </p>
        <h1 className="font-geist text-[36px] font-semibold tracking-[-0.04em] text-black">
          Events card layout variants
        </h1>
        <p className="mt-3 text-[15px] text-[rgba(0,0,0,0.65)] max-w-2xl">
          Three row-card layouts using the same sample events. Pick one and we&apos;ll
          wire it to the live <code className="px-1 py-0.5 rounded bg-gray-100 text-[13px]">/events</code> page.
          You can also try variants on the live page with{" "}
          <code className="px-1 py-0.5 rounded bg-gray-100 text-[13px]">?variant=A</code>,{" "}
          <code className="px-1 py-0.5 rounded bg-gray-100 text-[13px]">?variant=B</code>, or{" "}
          <code className="px-1 py-0.5 rounded bg-gray-100 text-[13px]">?variant=C</code>.
        </p>
        <div className="mt-4 flex gap-3 flex-wrap">
          {EVENT_ROW_VARIANTS.map((v) => (
            <Link
              key={v.key}
              href={`/events?variant=${v.key}`}
              className="inline-flex items-center gap-1 text-[13px] font-medium px-3 py-1.5 rounded-full border border-[rgba(0,0,0,0.15)] bg-white hover:bg-gray-50 text-black"
            >
              Try {v.key} on /events →
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-14">
        {EVENT_ROW_VARIANTS.map((variant) => (
          <section key={variant.key}>
            <div className="mb-4">
              <h2 className="font-geist text-[22px] font-semibold tracking-[-0.5%] text-black">
                {variant.label}
              </h2>
              <p className="mt-1 text-[14px] text-[rgba(0,0,0,0.6)]">{variant.description}</p>
            </div>
            <div className="flex flex-col rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white px-4">
              {events.map((event) => (
                <EventRow
                  key={`${variant.key}-${event.event_id}`}
                  event={event}
                  variant={variant.key}
                  featured={!!event.featured && variant.key === "A"}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";

const LONG_TRACK_NAME =
  "Best Overall Track — Most Innovative Use of Generative AI for Social Impact and Community Good";

const LONG_PROJECT_NAME_NOWRAP =
  "SuperCalifragilisticExpialidociousBlockchainPoweredSupplyChainVerificationPlatform";

function BuggyTriggerRow({ badge }: { badge: string }) {
  // Reproduces the pre-fix markup: `flex w-full` competing with the
  // AccordionTrigger's own chevron icon for space.
  return (
    <div className="flex w-full items-center justify-between gap-2 pr-3 text-left">
      <span className="font-medium text-[rgba(0,0,0,0.8)]">{LONG_TRACK_NAME}</span>
      <span className="inline-flex h-6 items-center rounded-full bg-[#FFF5E5] px-2.5 text-xs font-semibold text-[#9A5C00]">
        {badge}
      </span>
    </div>
  );
}

function FixedTriggerRow({ badge }: { badge: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2 pr-3 text-left">
      <span className="min-w-0 flex-1 truncate font-medium text-[rgba(0,0,0,0.8)]">
        {LONG_TRACK_NAME}
      </span>
      <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-[#FFF5E5] px-2.5 text-xs font-semibold text-[#9A5C00]">
        {badge}
      </span>
    </div>
  );
}

export default function MobileCheckPage() {
  return (
    <div className="w-full bg-gray-100 px-4 pb-10 pt-6 md:px-8">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-10">
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase text-red-600">
            BEFORE (buggy: w-full trigger row)
          </h2>
          <div
            id="before-card"
            className="relative z-10 rounded-3xl border border-[#DDE4F0] bg-white p-4 shadow-xl md:p-6"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="mt-1 text-[30px] font-semibold leading-[1.1] tracking-[-0.06em] text-black">
                  {LONG_PROJECT_NAME_NOWRAP}
                </h3>
              </div>
            </div>

            <Accordion type="multiple" defaultValue={["t1", "t2"]} className="space-y-3">
              <AccordionItem
                value="t1"
                className="rounded-xl border border-[#D8E1F0] bg-white px-4 data-[state=open]:border-[#BFD2F4]"
              >
                <AccordionTrigger className="py-3 hover:no-underline">
                  <BuggyTriggerRow badge="Pending" />
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <div className="space-y-3 py-3">
                    <Slider value={[6]} min={0} max={10} step={1} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase text-green-700">
            AFTER (fixed: min-w-0 flex-1 + truncate + shrink-0)
          </h2>
          <div
            id="after-card"
            className="relative z-10 rounded-3xl border border-[#DDE4F0] bg-white p-4 shadow-xl md:p-6"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="mt-1 break-words text-[30px] font-semibold leading-[1.1] tracking-[-0.06em] text-black">
                  {LONG_PROJECT_NAME_NOWRAP}
                </h3>
              </div>
            </div>

            <Accordion type="multiple" defaultValue={["t1", "t2"]} className="space-y-3">
              <AccordionItem
                value="t1"
                className="rounded-xl border border-[#D8E1F0] bg-white px-4 data-[state=open]:border-[#BFD2F4]"
              >
                <AccordionTrigger className="py-3 hover:no-underline">
                  <FixedTriggerRow badge="Pending" />
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <div className="space-y-3 py-3">
                    <Slider value={[6]} min={0} max={10} step={1} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>
      </div>
    </div>
  );
}

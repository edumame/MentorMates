import { HOST_FEATURES_BADGE } from "../data";
import { SectionContainer } from "./SectionContainer";

export function FeaturesHeader() {
  return (
    <SectionContainer
      innerClassName="flex flex-col items-center gap-6 text-center"
    >
      <div className="flex items-center gap-2 rounded-[10px] border border-[#d5d7da] bg-white pl-1 pr-2 py-1 shadow-[0_1px_2px_0_rgba(10,13,18,0.05)]">
        <div className="flex items-center gap-1 rounded-[6px] border border-[#d5d7da] bg-white px-2 py-0.5 shadow-[0_1px_2px_0_rgba(10,13,18,0.05)]">
          <span className="relative h-2 w-2">
            <span className="absolute inset-[1px] rounded-full bg-[#12B76A]" />
          </span>
          <span className="font-medium text-host-sm text-[#414651]">
            {HOST_FEATURES_BADGE.label}
          </span>
        </div>
      </div>
      <h2 className="font-geist font-semibold text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-[52px] leading-tight tracking-[-0.06em] text-black">
        Features &amp; Benefits
      </h2>
    </SectionContainer>
  );
}

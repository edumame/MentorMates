import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HOST_SCALE_MENTORSHIP } from "../data";
import { SectionContainer } from "./SectionContainer";
import { HostImageCard } from "./HostImageCard";

export function ScaleMentorshipSection() {
  return (
    <SectionContainer>
      <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-8 sm:gap-12 lg:gap-20">
        <HostImageCard
          src={HOST_SCALE_MENTORSHIP.image.src}
          alt={HOST_SCALE_MENTORSHIP.image.alt}
          className="order-2 lg:order-1"
        />

        <div className="flex flex-col gap-8 order-1 lg:order-2">
          <div className="flex flex-col gap-6 text-black max-w-xl">
            <h2 className="font-geist font-semibold text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-[52px] leading-tight tracking-[-0.06em] text-black">
              {HOST_SCALE_MENTORSHIP.title}
            </h2>
            <p className="text-base sm:text-lg text-black">{HOST_SCALE_MENTORSHIP.body}</p>
          </div>
          <div>
            <Button variant="hostGhost" asChild>
              <Link href={HOST_SCALE_MENTORSHIP.buttonHref}>
                {HOST_SCALE_MENTORSHIP.buttonLabel}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}

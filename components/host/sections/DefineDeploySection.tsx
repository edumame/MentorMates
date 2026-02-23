import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HOST_DEFINE_DEPLOY } from "../data";
import { SectionContainer } from "./SectionContainer";
import { HostImageCard } from "./HostImageCard";
import { InboxCustomizeIcon, RobotIcon } from "./HostIcons";

export function DefineDeploySection() {
  return (
    <SectionContainer>
      <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-8 sm:gap-12 lg:gap-20">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-6 text-black max-w-xl">
            <h2 className="font-geist font-semibold text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-[52px] leading-tight tracking-[-0.06em] text-black">
              {HOST_DEFINE_DEPLOY.title}
            </h2>
            <p className="text-base sm:text-lg text-black">{HOST_DEFINE_DEPLOY.body}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 pt-2">
            {HOST_DEFINE_DEPLOY.items.map((item) => (
              <div key={item.title} className="flex flex-1 flex-col gap-4">
                {item.icon === "robot" ? (
                  <RobotIcon />
                ) : (
                  <InboxCustomizeIcon />
                )}
                <h3 className="font-geist text-lg sm:text-xl md:text-[22px] leading-snug tracking-[-0.06em] font-medium text-black">
                  {item.title}
                </h3>
                <p className="text-sm sm:text-base text-black">{item.body}</p>
              </div>
            ))}
          </div>

          <div>
            <Button variant="hostGhost" asChild>
              <Link href={HOST_DEFINE_DEPLOY.buttonHref}>
                {HOST_DEFINE_DEPLOY.buttonLabel}
              </Link>
            </Button>
          </div>
        </div>

        <HostImageCard
          src={HOST_DEFINE_DEPLOY.image.src}
          alt={HOST_DEFINE_DEPLOY.image.alt}
        />
      </div>
    </SectionContainer>
  );
}

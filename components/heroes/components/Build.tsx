"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Group, Build as BuildIcon, Mediation } from "@mui/icons-material";

type Feature = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  variant?: "default" | "highlight";
};

export function Build() {
  const features: Feature[] = [
    {
      icon: Group,
      title: "Reach Your Audience",
      description:
        "Connect with a diverse talent pool for recruitment, product feedback, and brand awareness, or empower your employees with internal events.",
    },
    {
      icon: BuildIcon,
      title: "Fuel Innovation",
      description:
        "Drive product adoption and generate new ideas by giving participants a hands-on opportunity to build and innovate.",
    },
    {
      icon: Mediation,
      title: "End-to-End Support",
      description:
        "Simplify hackathon management from start to finish, centralizing everything from event promotion to project submissions and judging.",
    },
  ];

  return (
    <section className="bg-[#eef4ff] py-20 px-4 sm:px-8 lg:px-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          {/* Left — gradient panel with phone mock */}
          <div className="relative">
            <div className="mx-auto">
              <Image
                src="/img/logistics.png"
                alt="Build"
                width={640}
                height={640}
              />
            </div>
          </div>

          {/* Right — content */}
          <div className="space-y-10">
            <h2 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl leading-tight font-geist tracking-[-0.06em]">
              Build your next innovation event with MentorMates
            </h2>

            <div className="space-y-7">
              {features.map((f, i) => {
                const IconComponent = f.icon;
                return (
                  <div key={i} className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="pt-1">
                      <IconComponent className="text-4xl text-gray-900" />
                    </div>

                    {/* Copy */}
                    <div>
                      <h3 className="mb-1.5 text-xl font-semibold text-gray-900 font-geist tracking-[-0.06em]">
                        {f.title}
                      </h3>
                      <p className="text-[15px] leading-7 text-gray-600">
                        {f.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <Button variant="default">Start building</Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

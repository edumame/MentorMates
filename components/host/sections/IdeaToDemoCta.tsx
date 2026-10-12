"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HOST_CTA } from "../data";
import { CheckCircleIcon } from "./HostIcons";

export function IdeaToDemoCta() {
  const [imgError, setImgError] = useState(false);

  return (
    <section className="relative bg-[#f9f9f9] pt-12 sm:pt-16 md:pt-24 pb-0 overflow-hidden min-h-[360px] sm:min-h-[420px] lg:min-h-[480px]">
      {/* 左侧文案：保持在版心内 */}
      <div className="relative z-10 mx-auto w-full max-w-host px-4 sm:px-6 md:px-8 pb-8 sm:pb-12 lg:pb-24">
        <div className="max-w-xl">
          <div className="flex flex-col gap-6 sm:gap-8 items-start">
            <h2 className="font-geist font-semibold text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-[52px] leading-tight tracking-[-0.06em] text-black">
              {HOST_CTA.title}
            </h2>
            <div className="flex flex-col gap-4 sm:gap-5 pl-2 sm:pl-4">
              {HOST_CTA.items.map((item) => (
                <div key={item} className="flex items-start gap-2 sm:gap-3">
                  <CheckCircleIcon />
                  <p className="text-sm sm:text-base md:text-lg text-[#535862]">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <Button variant="hostPrimary" asChild className="mt-6 sm:mt-8">
            <Link href={HOST_CTA.buttonHref}>{HOST_CTA.buttonLabel}</Link>
          </Button>
        </div>
      </div>

      {/* 图片：贴 section 右下角；随屏幕宽度缩放，填满框；仅左上、右上圆角 */}
      <div className="relative mt-8 sm:mt-12 lg:mt-0 lg:absolute lg:right-0 lg:bottom-0 w-full lg:w-[55vw] lg:max-w-[720px] h-[240px] sm:h-[280px] md:h-[320px] lg:h-[50vh] lg:max-h-[520px] rounded-tl-2xl sm:rounded-tl-[32px] rounded-tr-2xl sm:rounded-tr-[32px] rounded-bl-none rounded-br-none overflow-hidden bg-gray-100">
        {imgError ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
            {HOST_CTA.image.alt}
          </div>
        ) : (
          <Image
            src={HOST_CTA.image.src}
            alt={HOST_CTA.image.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover object-[50%_0%]"
            onError={() => setImgError(true)}
            unoptimized
          />
        )}
      </div>
    </section>
  );
}

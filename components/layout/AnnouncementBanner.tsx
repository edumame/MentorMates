import Link from "next/link";
import { StickyBanner } from "@/components/ui/sticky-banner";

export function AnnouncementBanner() {
    return (
        <StickyBanner className="fixed inset-x-0 top-0 z-[60] bg-gradient-to-r from-[#C375FE] to-[#5EC7FC]">
        <p className="mx-0 max-w-[90%] text-white drop-shadow-md text-sm sm:text-[15px]">
            We just launched the AI Vibe Guide —{" "}
            <Link href="/ai-vibe-guide" className="underline font-medium ml-1">
            Check it Out.
            </Link>
        </p>
        </StickyBanner>
    );
}

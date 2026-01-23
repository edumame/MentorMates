import Link from "next/link";
import Image from "next/image";
import { CallControls, SpeakerLayout } from "@stream-io/video-react-sdk";
import ScreenCapture from "./screen-capture";
import { CirclePause, CirclePlay } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    onLeave: () => void;
    onPause: () => void;
    onResume: () => void;
    meetingId: string;
    meetingName: string;
};

export const CallActive = ({ onLeave, onPause, onResume, meetingId, meetingName }: Props) => {
    return (
        <div className="flex flex-col justify-between p-4 h-full text-white">
            <div className="bg-[#101213] rounded-full p-4 flex items-center gap-4">
                <Link href="/" className="flex items-center justify-center p-1 bg-white/10 rounded-full w-fit">
                    <Image src="/favicon.ico" width={22} height={22} alt="logo" />
                </Link>
                <h4 className="text-base">{meetingName}</h4>
            </div>
            <SpeakerLayout />
            <ScreenCapture meetingId={meetingId} />
            <div className="bg-[#101213] rounded-full px-4">
                <CallControls onLeave={onLeave} />
            </div>

            <div className="bg-black rounded-full px-4">
                <Button variant="ghost" size="icon" asChild onClick={onPause}>
                    <CirclePause className="size-6 text-white" />
                </Button>
                <Button variant="ghost" size="icon" asChild onClick={onResume}>
                    <CirclePlay className="size-6 text-white" />
                </Button>
            </div>
        </div>
    );
};

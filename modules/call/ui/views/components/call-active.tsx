import Link from "next/link";
import Image from "next/image";
import { CallControls, SpeakerLayout } from "@stream-io/video-react-sdk";
import { LoaderIcon, Mic } from "lucide-react";

interface Props {
    onLeave: () => void;
    meetingName: string;
    isQAMode: boolean;
    isStartingQA: boolean;
    onStartQA: () => void;
};

export const CallActive = ({ onLeave, meetingName, isQAMode, isStartingQA, onStartQA }: Props) => {
    return (
        <div className="flex flex-col justify-between p-4 h-full text-white">
            <div className="bg-[#101213] rounded-full p-4 flex items-center gap-4">
                <Link href="/" className="flex items-center justify-center p-1 bg-white/10 rounded-full w-fit">
                    <Image src="/favicon.ico" width={22} height={22} alt="logo" />
                </Link>
                <h4 className="text-base">{meetingName}</h4>
                {/* Mode indicator */}
                <span className="ml-auto text-sm text-gray-400 flex items-center gap-2">
                    {isQAMode ? (
                        <>
                            <Mic className="size-4 text-green-500" />
                            Q&A Mode
                        </>
                    ) : (
                        "Presenting..."
                    )}
                </span>
            </div>
            <SpeakerLayout />

            {/* Start Q&A button - only shown during presentation mode */}
            {!isQAMode && (
                <div className="flex justify-center mb-4">
                    <button
                        onClick={onStartQA}
                        disabled={isStartingQA}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white px-6 py-3 rounded-full font-medium transition-colors flex items-center gap-2"
                    >
                        {isStartingQA ? (
                            <>
                                <LoaderIcon className="size-4 animate-spin" />
                                Starting Q&A...
                            </>
                        ) : (
                            "I'm done sharing. Start Q&A"
                        )}
                    </button>
                </div>
            )}

            <div className="bg-[#101213] rounded-full px-4">
                <CallControls onLeave={onLeave} />
            </div>
        </div>
    );
};

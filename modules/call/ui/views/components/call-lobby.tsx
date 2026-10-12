import Link from "next/link";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import { Button } from "@/components/ui/button";
import {
    DefaultVideoPlaceholder,
    StreamVideoParticipant,
    ToggleAudioPreviewButton,
    ToggleVideoPreviewButton,
    useCallStateHooks,
    VideoPreview,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";

interface Props {
    onJoin: () => void;
};

const DisabledVideoPreview = () => {
    const { session } = useAuth();
    const user = session?.user;

    const name =
        user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0];
    const image = user?.user_metadata?.avatar_url || undefined;

    const participant = name ? ({ name, image } as StreamVideoParticipant) : null;

    return <DefaultVideoPlaceholder participant={participant as StreamVideoParticipant} />;
};

const AllowBrowserPermissions = () => {
    return (
        <p className="text-sm">
            Please grant your browser a permission to access your camera and microphone.
        </p>
    )
}

export const CallLobby = ({ onJoin }: Props) => {
    const { useCameraState, useMicrophoneState } = useCallStateHooks();

    const { hasBrowserPermission: hasMicPermission } = useMicrophoneState();
    const { hasBrowserPermission: hasCameraPermission } = useCameraState();

    const hasBrowserMediaPermission = hasCameraPermission && hasMicPermission;

    return (
        <div className="flex flex-col items-center justify-center h-full bg-radial from-sidebar-accent to-sidebar">
            <div className="py-4 px-8 flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center justify-center gap-y-6 bg-background rounded-lg p-10 shadow-sm">
                    <div className="flex flex-col gap-y-2 text-center">
                        <h6 className="text-lg font-medium">Ready to join?</h6>
                        <p className="text-sm">Set up your call before joining</p>
                    </div>
                    <VideoPreview
                        DisabledVideoPreview={
                            hasBrowserMediaPermission ? DisabledVideoPreview : AllowBrowserPermissions
                        }
                    />
                    <div className="flex gap-2">
                        <ToggleAudioPreviewButton />
                        <ToggleVideoPreviewButton />
                    </div>
                    <div className="flex gap-x-2 justify-between w-full">
                        <Button asChild variant="ghost">
                            <Link href="/learn">
                                Cancel
                            </Link>
                        </Button>
                        <Button onClick={onJoin}>
                            Join Call
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
} 

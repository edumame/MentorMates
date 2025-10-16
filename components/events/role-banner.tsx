import { Headphones } from "lucide-react";

interface RoleBannerProps {
  role: string;
  eventType?: string;
  onCancel?: () => void;
}

export function RoleBanner({ role, eventType = "event", onCancel }: RoleBannerProps) {
  const getRoleText = () => {
    switch (role) {
      case "participant":
        return `You are participating in this ${eventType} as a participant`;
      case "mentor":
        return `You are participating in this ${eventType} as a mentor`;
      case "judge":
        return `You are participating in this ${eventType} as a judge`;
      case "organizer":
        return `You are organizing this ${eventType}`;
      case "admin":
        return `You are viewing this ${eventType} as an admin`;
      default:
        return `You are viewing this ${eventType}`;
    }
  };

  return (
    <div className="sticky top-0 z-20 bg-sky-50 border-b border-[#d8d8d8]">
      <div className="container mx-auto px-6 py-3.5 flex items-center justify-between max-w-[1280px]">
        <div className="flex items-center gap-2">
          <Headphones className="h-6 w-6 text-[#4c4c4c]" />
          <p className="text-[#4c4c4c] text-lg font-medium tracking-[-0.06em]">
            {getRoleText()}
          </p>
        </div>
        {onCancel && role === "participant" && (
          <button
            onClick={onCancel}
            className="text-[#d92d20] text-base font-medium underline hover:no-underline"
          >
            Cancel registration
          </button>
        )}
      </div>
    </div>
  );
}

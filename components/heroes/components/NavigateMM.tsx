import { data } from "@/lib/NavigateMMData";
import { X } from "lucide-react";
import { VideoEmbed } from "@/components/utils/VideoEmbed";

interface NavigateMMProps {
  onClose?: () => void;
}

export function NavigateMM({ onClose }: NavigateMMProps) {
  return (
    <div className="w-full rounded-[16px] p-4 border border-solid border-[rgba(0,0,0,0.15)] bg-white relative">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Navigate roles in MentorMates</h1>

        {/* Make the close icon a real, accessible button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 inline-flex items-center justify-center rounded-md p-2 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-black/20 disabled:opacity-50 disabled:pointer-events-none relative z-20"
          disabled={!onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-sm text-gray-900 pt-2">
        Quick guides for Participants, Mentors, Judges, and Organizers. Learn what each role can do and how to get started.
      </p>

      <div className="flex flex-row gap-2 mt-4">
        {data.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 flex-1 min-w-0">
            <VideoEmbed
              url={item.url}
              title={item.title}
              className="min-h-[120px]"
            />
            <p className="text-sm">{item.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

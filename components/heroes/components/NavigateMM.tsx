import { data } from "@/lib/NavigateMMData";
import { Close } from "@mui/icons-material";

export function NavigateMM() {
    return (
        <div className=" w-full rounded-[16px] p-4 border border-solid border-[rgba(0,0,0,0.15)] bg-white">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold">Navigate roles in MentorMates</h1>
                <Close className="h-4 w-4" />
            </div>
            <p className="text-sm text-gray-900 pt-2"> Quick guides for Participants, Mentors, Judges, and Organizers. Learn what each role can do and how to get started.</p>
            <div className="flex flex-row gap-2 mt-4">
                {data.map((item) => (
                    <div key={item.id} className="flex flex-col gap-2 flex-1 min-w-0">
                        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                            <iframe
                                onClick={() => window.open(item.source, "_blank", "noopener,noreferrer")}
                                src={item.source}
                                title={item.title}
                                className="w-full h-full min-h-[120px] rounded-lg"
                                allowFullScreen
                            />
                        </div>
                        <p className="text-sm">{item.title}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
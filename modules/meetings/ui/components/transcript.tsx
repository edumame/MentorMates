import { useState } from "react";
import { format } from "date-fns";
import Highlighter from "react-highlight-words";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage } from "@/components/ui/avatar";

interface Props {
    meetingId: string;
};

export const Transcript = ({ meetingId }: Props) => {
    const trpc = useTRPC();
    const { data } = useQuery(trpc.meetings.getTranscript.queryOptions({ id: meetingId }));

    const [searchQuery, setSearchQuery] = useState("");
    const filteredData = (data ?? []).filter((item) => 
        item.text.toString().toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="bg-white rounded-lg border px-4 py-5 flex flex-col gap-y-4 w-full">
            <p className="text-sm font-medium">Transcript</p>
            <div>
                <EventSearchInput
                    placeholder="Search Transcript"
                    wrapperClassName="w-[240px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    inputClassName="text-sm sm:text-sm"
                />
            </div>
            <ScrollArea>
                <div className="flex flex-col gap-y-4">
                    {filteredData.map((item) => {
                        return (
                            <div key={item.start_ts} className="flex flex-col gap-y-2 hover:bg-muted p-4 rounded-md border">
                                <div className="flex gap-x-2 items-center">
                                    <Avatar className="size-6">
                                        <AvatarImage
                                            src={item.user.image ?? 'k'}
                                            alt="User Avatar"
                                        />
                                    </Avatar>
                                    <p className="text-sm font-medium">{item.user.name}</p>
                                    <p className="text-sm text-blue-500 font-medium">
                                        {format(new Date(0, 0, 0, 0, 0, 0, item.start_ts), "mm:ss")}
                                    </p>
                                </div>
                                <Highlighter
                                    className="text-sm text-neutral-700"
                                    highlightClassName="bg-yellow-200"
                                    searchWords={[searchQuery]}
                                    autoEscape={true}
                                    textToHighlight={item.text}
                                />
                            </div>
                        )
                    })}
                </div>
            </ScrollArea>
        </div>
    )
};

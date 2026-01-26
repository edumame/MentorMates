import Markdown from "react-markdown";
import { 
    BookOpenTextIcon,
    SparklesIcon,
    FileTextIcon,
    FileVideoIcon,
    MessageSquare,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MeetingGetOne } from "../../types";
import { Transcript } from "./transcript";
import { ChatProvider } from "./chat-provider";

interface Props {
    data: MeetingGetOne;
};

export const CompletedState = ({ data }: Props) => {
    return (
        <div className="flex flex-col gap-y-4">
            <Tabs defaultValue="summary">
                <div className="bg-white rounded-lg border px-3">
                    <ScrollArea>
                        <TabsList className="p-0 bg-background justify-start rounded-none h-13">
                            <TabsTrigger
                                value="summary"
                                className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none
                                border-b-2 border-transparent data-[state=active]:border-b-primary
                                data-[state=active]:text-accent-foreground h-full hover:text-accent-foreground gap-2"
                            >
                                <BookOpenTextIcon />
                                Summary
                            </TabsTrigger>
                            <TabsTrigger
                                value="transcript"
                                className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none
                                border-b-2 border-transparent data-[state=active]:border-b-primary
                                data-[state=active]:text-accent-foreground h-full hover:text-accent-foreground gap-2"
                            >
                                <FileTextIcon />
                                Transcript
                            </TabsTrigger>
                            <TabsTrigger
                                value="recording"
                                className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none
                                border-b-2 border-transparent data-[state=active]:border-b-primary
                                data-[state=active]:text-accent-foreground h-full hover:text-accent-foreground gap-2"
                            >
                                <FileVideoIcon />
                                Recording
                            </TabsTrigger>
                            <TabsTrigger
                                value="chat"
                                className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none
                                border-b-2 border-transparent data-[state=active]:border-b-primary
                                data-[state=active]:text-accent-foreground h-full hover:text-accent-foreground"
                            >
                                <MessageSquare />
                                Chat
                            </TabsTrigger>
                        </TabsList>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
                <TabsContent value="chat">
                    <ChatProvider meetingId={data.id} meetingName={data.name} />
                </TabsContent>
                <TabsContent value="transcript">
                    <Transcript meetingId={data.id} />
                </TabsContent>
                <TabsContent value="recording">
                    <div className="bg-white rounded-lg border px-4 py-5">
                        <video src={data.recording_url!} className="w-full rounded-lg" controls />
                    </div>
                </TabsContent>
                <TabsContent value="summary">
                    <div className="bg-white rounded-lg border">
                        <div className="px-4 py-5 gap-y-5 flex flex-col col-span-5">
                            <h2 className="text-2xl font-medium capitalize">{data.name}</h2>
                            <div className="flex gap-x-2 items-center">
                                <SparklesIcon className="size-4" />
                                <p>Feedback summary</p>
                            </div>
                            <div>
                                <Markdown
                                    components={{
                                        h1: (props) => (
                                            <h1 className="text-2xl font-medium mb-6" {...props} />
                                        ),
                                        h2: (props) => (
                                            <h2 className="text-xl font-medium mb-6" {...props} />
                                        ),
                                        h3: (props) => (
                                            <h3 className="text-lg font-medium mb-6" {...props} />
                                        ),
                                        h4: (props) => (
                                            <h4 className="text-base font-medium mb-6" {...props} />
                                        ),
                                        p: (props) => (
                                            <p className="mb-6 leading-relaxed" {...props} />
                                        ),
                                        ul: (props) => (
                                            <ul className="list-disc list-inside mb-6" {...props} />
                                        ),
                                        ol: (props) => (
                                            <ol className="list-decimal list-inside mb-6" {...props} />
                                        ),
                                        li: (props) => (
                                            <li className="mb-1" {...props} />
                                        ),
                                        strong: (props) => (
                                            <strong className="font-semibold" {...props} />
                                        ),
                                        code: (props) => (
                                            <code className="bg-gray-100 px-1 py-0.5 rounded" {...props} />
                                        ),
                                        blockquote: (props) => (
                                            <code className="border-l-4 pl-4 italic my-4" {...props} />
                                        ),
                                    }}
                                >
                                    {data.summary}
                                </Markdown>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
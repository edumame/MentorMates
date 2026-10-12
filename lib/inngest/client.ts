import { Inngest } from "inngest";

export const inngest = new Inngest({
    id: "mentor-mates",
    event: process.env.INNGEST_EVENT_KEY,
});

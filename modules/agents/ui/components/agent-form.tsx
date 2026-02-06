import { AgentGetOne } from "@/modules/agents/types";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { agentsInsertSchema, agentsUpdateSchema } from "@/modules/agents/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface AgentFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
    initialValues?: AgentGetOne;
    eventId?: string;
}

const STANDARD_TYPES = ["brainstorm", "product", "tech", "judge"];
const BUILT_IN_VOICES = [
    { value: "alloy", label: "Alloy" },
    { value: "ash", label: "Ash" },
    { value: "ballad", label: "Ballad" },
    { value: "cedar", label: "Cedar" },
    { value: "coral", label: "Coral" },
    { value: "echo", label: "Echo" },
    { value: "marin", label: "Marin" },
    { value: "sage", label: "Sage" },
    { value: "shimmer", label: "Shimmer" },
    { value: "verse", label: "Verse" },
] as const;
const BUILT_IN_VOICE_VALUES = new Set(BUILT_IN_VOICES.map((voice) => voice.value));
const CUSTOM_VOICE_ID_REGEX = /^voice_[a-zA-Z0-9_-]+$/;

export const AgentForm = ({ onSuccess, onCancel, initialValues, eventId } : AgentFormProps) => {
    const trpc = useTRPC();
    const router = useRouter();
    const queryClient = useQueryClient();

    const createAgent = useMutation(trpc.agents.create.mutationOptions({
        onSuccess: async () => {
            await queryClient.invalidateQueries(trpc.agents.getMany.queryOptions({}));

            if (initialValues?.id) {
                await queryClient.invalidateQueries(trpc.agents.getOne.queryOptions({ id: initialValues.id }))
            }
            onSuccess?.();
        },
        onError: (error: unknown) => {
            const err = error as { message?: string; data?: { code?: string } } | null;
            toast.error(err?.message ?? "Failed to create agent")

            if (err?.data?.code === "FORBIDDEN") {
                router.push("/upgrade");
            }
        },
    }));

    const updateAgent = useMutation(trpc.agents.update.mutationOptions({
        onSuccess: async () => {
            await queryClient.invalidateQueries(trpc.agents.getMany.queryOptions({}));

            if (initialValues?.id) {
                await queryClient.invalidateQueries(trpc.agents.getOne.queryOptions({ id: initialValues.id }))
            }
            onSuccess?.();
        },
        onError: (error: unknown) => {
            const err = error as { message?: string } | null;
            toast.error(err?.message ?? "Failed to update agent")
        },
    }));

    type AgentFormValues = z.infer<typeof agentsInsertSchema> & {
        custom_type_tmp?: string;
        custom_voice_tmp?: string;
        feedback_prompt?: string;
        voice?: string | null;
    };

    const isEdit = !!initialValues?.id;
    const initialVoiceRaw = (initialValues as AgentGetOne | undefined)?.voice;
    const initialVoiceTrimmed = typeof initialVoiceRaw === "string" ? initialVoiceRaw.trim() : "";
    const initialVoiceNormalized = initialVoiceTrimmed.toLowerCase();
    const initialVoiceIsBuiltIn = BUILT_IN_VOICE_VALUES.has(initialVoiceNormalized as (typeof BUILT_IN_VOICES)[number]["value"]);

    const form = useForm<AgentFormValues & { id?: string }>({
        // zodResolver types can be incompatible across resolver versions; cast the schema to z.ZodTypeAny and the result to the correct Resolver type
        resolver: zodResolver(
            isEdit ? (agentsUpdateSchema as unknown as z.ZodTypeAny) : (agentsInsertSchema as unknown as z.ZodTypeAny)
        ) as unknown as Resolver<AgentFormValues & { id?: string }>,
        defaultValues: {
            id: initialValues?.id,
            name: initialValues?.name ?? "",
            instructions: initialValues?.instructions ?? "",
            feedback_prompt: (initialValues as AgentGetOne | undefined)?.feedback_prompt ?? "",
            // If initial type is one of the standard options, select it.
            // Otherwise select the special "custom" option and store the original value in `custom_type_tmp`.
            type: (initialValues?.type && STANDARD_TYPES.includes(String(initialValues.type).toLowerCase()))
                ? String(initialValues?.type).toLowerCase()
                : (initialValues?.type ? "custom" : "brainstorm"),
            custom_type_tmp: (initialValues?.type && !STANDARD_TYPES.includes(String(initialValues.type).toLowerCase())) ? String(initialValues.type) : "",
            avatar_url: (initialValues as AgentGetOne | undefined)?.avatar_url ?? "",
            voice: initialVoiceTrimmed
                ? (initialVoiceIsBuiltIn ? initialVoiceNormalized : "custom")
                : "alloy",
            custom_voice_tmp: initialVoiceTrimmed && !initialVoiceIsBuiltIn ? initialVoiceTrimmed : "",
        },
    });

    const isPending = createAgent.isPending || updateAgent.isPending;

    const onSubmit = async (values: AgentFormValues) => {
        // If custom selected, require the custom input and read it directly
        // from the form to avoid stale/controlled-value issues.
        if (values.type === "custom") {
            const custom = (form.getValues("custom_type_tmp") || "").toString().trim();
            if (custom.length === 0) {
                form.setError("custom_type_tmp", { type: "required", message: "Custom type is required" });
                return;
            }
            values.type = custom;
        }

        if (values.voice === "custom") {
            const customVoice = (form.getValues("custom_voice_tmp") || "").toString().trim();
            if (customVoice.length === 0) {
                form.setError("custom_voice_tmp", { type: "required", message: "Custom voice ID is required" });
                return;
            }
            if (!CUSTOM_VOICE_ID_REGEX.test(customVoice)) {
                form.setError("custom_voice_tmp", {
                    type: "validate",
                    message: "Custom voice ID must look like voice_xxx",
                });
                return;
            }
            values.voice = customVoice;
        } else if (typeof values.voice === "string") {
            values.voice = values.voice.trim().toLowerCase();
        }

        const payloadBase: Record<string, unknown> = { ...values };
        // Remove helper / UI-only fields
        delete payloadBase.custom_type_tmp;
        delete payloadBase.custom_voice_tmp;

        if (isEdit) {
            updateAgent.mutate({ ...payloadBase, id: initialValues.id });
        } else {
            try {
                const payload = eventId ? { ...payloadBase, event_id: eventId } : payloadBase;
                await createAgent.mutateAsync(payload as unknown as AgentFormValues & { event_id?: string });
            } catch {
                // createAgent handles toast/router on error
            }
        }
    };

    return (
        <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                    name="name"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="e.g. Santa Klaus" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    name="avatar_url"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Image URL (optional)</FormLabel>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={String(form.watch("avatar_url") || "")} />
                                </Avatar>
                                <FormControl>
                                    <Input {...field} placeholder="https://example.com/image.png" />
                                </FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    name="type"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Type</FormLabel>
                            <FormControl>
                                <Select
                                    value={field.value ?? "brainstorm"}
                                    onValueChange={(val) => {
                                        field.onChange(val);
                                        if (val !== "custom") form.setValue("custom_type_tmp", "");
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="brainstorm">Brainstorm</SelectItem>
                                        <SelectItem value="product">Product</SelectItem>
                                        <SelectItem value="tech">Tech</SelectItem>
                                        <SelectItem value="judge">Judge</SelectItem>
                                        <SelectItem value="custom">Custom</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {form.watch("type") === "custom" && (
                    <FormField
                        name="custom_type_tmp"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Custom type</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="Enter custom type" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                <FormField
                    name="voice"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Voice</FormLabel>
                            <FormControl>
                                <Select
                                    value={typeof field.value === "string" && field.value.length > 0 ? field.value : "alloy"}
                                    onValueChange={(val) => {
                                        field.onChange(val);
                                        if (val !== "custom") form.setValue("custom_voice_tmp", "");
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select voice" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BUILT_IN_VOICES.map((voice) => (
                                            <SelectItem key={voice.value} value={voice.value}>
                                                {voice.label}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="custom">Custom voice ID</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {form.watch("voice") === "custom" && (
                    <FormField
                        name="custom_voice_tmp"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Custom voice ID</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="voice_..." />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                <FormField
                    name="instructions"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Instructions</FormLabel>
                            <FormControl>
                                <Textarea
                                    {...field}
                                    placeholder="You are a helpful assistant with creative gift ideas."
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    name="feedback_prompt"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Feedback prompt (optional)</FormLabel>
                            <FormControl>
                                <Textarea
                                    {...field}
                                    placeholder="Optional system-level instructions for the agent feedback evaluation."
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex justify-between gap-x-2">
                    {onCancel && (
                        <Button variant="ghost" disabled={isPending} type="button" onClick={() => onCancel()}>Cancel</Button>
                    )}
                    <Button disabled={isPending} type="submit">{isEdit ? "Update" : "Create"}</Button>
                </div>
            </form>
        </Form>
    );
};

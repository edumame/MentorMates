import { AgentGetOne } from "@/modules/agents/types";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
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
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    BUILT_IN_VOICE_OPTIONS,
    BUILT_IN_VOICE_PROMPT_OPTIONS,
    BUILT_IN_VOICE_VALUE_SET,
    type BuiltInVoiceValue,
} from "@/modules/agents/constants/voices";

interface AgentFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
    initialValues?: AgentGetOne;
    eventId?: string;
}

const STANDARD_TYPES = ["brainstorm", "product", "tech", "judge"];
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
    const initialVoiceIsBuiltIn = BUILT_IN_VOICE_VALUE_SET.has(initialVoiceNormalized as BuiltInVoiceValue);

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
    const [aiInput, setAiInput] = useState("");
    const [aiLoading, setAiLoading] = useState(false);

    const handleAi = async (mode: "fill" | "generate") => {
        if (!aiInput.trim()) {
            toast.error("Describe the agent first so AI can generate details.");
            return;
        }

        setAiLoading(true);
        try {
            const response = await fetch("/api/agents/ai-parse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: aiInput.trim(), mode }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                toast.error(data?.error || "Unable to generate agent details with AI.");
                return;
            }

            const fields = (data?.fields || data?.normalized || {}) as Record<string, unknown>;
            const applyOpts = { shouldDirty: true, shouldValidate: true };
            let appliedCount = 0;

            if (typeof fields.name === "string" && fields.name.trim().length > 0) {
                form.setValue("name", fields.name.trim(), applyOpts);
                appliedCount += 1;
            }

            if (typeof fields.instructions === "string" && fields.instructions.trim().length > 0) {
                form.setValue("instructions", fields.instructions.trim(), applyOpts);
                appliedCount += 1;
            }

            if (typeof fields.feedback_prompt === "string" && fields.feedback_prompt.trim().length > 0) {
                form.setValue("feedback_prompt", fields.feedback_prompt.trim(), applyOpts);
                appliedCount += 1;
            }

            if (typeof fields.avatar_url === "string" && fields.avatar_url.trim().length > 0) {
                form.setValue("avatar_url", fields.avatar_url.trim(), applyOpts);
                appliedCount += 1;
            }

            if (typeof fields.type === "string" && fields.type.trim().length > 0) {
                const incomingTypeRaw = fields.type.trim();
                const incomingTypeLower = incomingTypeRaw.toLowerCase();

                if (STANDARD_TYPES.includes(incomingTypeLower)) {
                    form.setValue("type", incomingTypeLower, applyOpts);
                    form.setValue("custom_type_tmp", "", applyOpts);
                } else {
                    form.setValue("type", "custom", applyOpts);
                    form.setValue("custom_type_tmp", incomingTypeRaw, applyOpts);
                }
                appliedCount += 1;
            }

            if (typeof fields.voice === "string" && fields.voice.trim().length > 0) {
                const incomingVoiceRaw = fields.voice.trim();
                const incomingVoiceLower = incomingVoiceRaw.toLowerCase();
                let voiceApplied = false;

                if (BUILT_IN_VOICE_VALUE_SET.has(incomingVoiceLower as BuiltInVoiceValue)) {
                    form.setValue("voice", incomingVoiceLower, applyOpts);
                    form.setValue("custom_voice_tmp", "", applyOpts);
                    voiceApplied = true;
                } else if (CUSTOM_VOICE_ID_REGEX.test(incomingVoiceRaw)) {
                    form.setValue("voice", "custom", applyOpts);
                    form.setValue("custom_voice_tmp", incomingVoiceRaw, applyOpts);
                    voiceApplied = true;
                }

                if (voiceApplied) {
                    appliedCount += 1;
                }
            }

            if (mode === "generate") {
                if (!(typeof fields.type === "string" && fields.type.trim().length > 0)) {
                    form.setValue("type", "brainstorm", applyOpts);
                    form.setValue("custom_type_tmp", "", applyOpts);
                    appliedCount += 1;
                }

                if (!(typeof fields.voice === "string" && fields.voice.trim().length > 0)) {
                    form.setValue("voice", "alloy", applyOpts);
                    form.setValue("custom_voice_tmp", "", applyOpts);
                    appliedCount += 1;
                }
            }

            if (appliedCount === 0) {
                toast.error("AI did not return usable fields. Try a more specific prompt.");
                return;
            }

            toast.success("Agent details generated.");
        } catch {
            toast.error("Unable to contact AI service.");
        } finally {
            setAiLoading(false);
        }
    };

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
            <form
                className={cn("space-y-4", !isEdit && "h-full min-h-0")}
                onSubmit={form.handleSubmit(onSubmit)}
            >
                <div className={cn(!isEdit && "grid gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.6fr)]")}>
                    {!isEdit && (
                        <div className="rounded-lg border border-[rgba(0,0,0,0.15)] bg-muted/20 p-4 lg:sticky lg:top-0 lg:self-start">
                            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                                <Sparkles className="h-4 w-4 text-[#4b89ef]" />
                                <span>Generate agent details with AI</span>
                            </div>
                            <p className="mb-3 text-xs text-muted-foreground">
                                Describe the role, expertise, tone, and outcomes you want. Include type and voice preferences when possible.
                            </p>
                            <Textarea
                                value={aiInput}
                                onChange={(e) => setAiInput(e.target.value)}
                                placeholder={`Goal: Build a technical mentor for hackathon teams
Type: tech
Voice: sage
Instruction style examples:
- Ask up to 2 clarifying questions first
- Return: Summary, 3 options with tradeoffs, recommended next step
Feedback prompt example:
- Score feasibility, technical depth, and user impact (1-10), then give 3 actionable improvements`}
                                className="min-h-[180px] bg-background"
                            />
                            <div className="mt-3 space-y-2 rounded-md border bg-background p-3 text-xs">
                                <p className="font-medium text-foreground">Concrete prompt examples</p>
                                <p className="text-muted-foreground">
                                    Instructions example: &quot;Ask 1-2 clarifying questions, then give 3 ranked solutions with tradeoffs.&quot;
                                </p>
                                <p className="text-muted-foreground">
                                    Feedback prompt example: &quot;Evaluate novelty, feasibility, and user value (1-10 each) and return top 3 improvements.&quot;
                                </p>
                                <p className="text-muted-foreground">
                                    Type options: brainstorm, product, tech, judge. Voice options: {BUILT_IN_VOICE_PROMPT_OPTIONS}.
                                </p>
                            </div>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={aiLoading || isPending}
                                    onClick={() => void handleAi("fill")}
                                >
                                    {aiLoading ? "Working..." : "Fill from text"}
                                </Button>
                                <Button
                                    type="button"
                                    disabled={aiLoading || isPending}
                                    onClick={() => void handleAi("generate")}
                                >
                                    {aiLoading ? "Working..." : "Generate details"}
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="space-y-4 pb-1">
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
                                                {BUILT_IN_VOICE_OPTIONS.map((voice) => (
                                                    <SelectItem key={voice.value} value={voice.value}>
                                                        {voice.label} ({voice.description})
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
                    </div>
                </div>
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

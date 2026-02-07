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
type AIGenerationStep = "instruction" | "feedback_prompt" | "metadata";

const AI_GENERATION_STEPS: Array<{ step: AIGenerationStep; label: string }> = [
    { step: "instruction", label: "Generate instruction" },
    { step: "feedback_prompt", label: "Generate student-eval prompt" },
    { step: "metadata", label: "Generate remaining metadata" },
];

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
    const [aiActiveMode, setAiActiveMode] = useState<"fill" | "generate" | null>(null);
    const [aiProgressText, setAiProgressText] = useState("");
    const aiActiveStepNumber =
        aiLoading && aiActiveMode === "generate"
            ? Number(/Step (\d)\/3/.exec(aiProgressText)?.[1] ?? 0)
            : 0;

    const resolveSelectedType = () => {
        const typeValue = (form.getValues("type") || "").toString().trim();
        if (typeValue === "custom") {
            const customTypeValue = (form.getValues("custom_type_tmp") || "").toString().trim();
            return customTypeValue.length > 0 ? customTypeValue : undefined;
        }
        return typeValue.length > 0 ? typeValue : undefined;
    };

    const resolveSelectedVoice = () => {
        const voiceValue = (form.getValues("voice") || "").toString().trim();
        if (voiceValue === "custom") {
            const customVoiceValue = (form.getValues("custom_voice_tmp") || "").toString().trim();
            return customVoiceValue.length > 0 ? customVoiceValue : undefined;
        }
        return voiceValue.length > 0 ? voiceValue : undefined;
    };

    const buildAiContext = () => {
        const values = form.getValues();
        const context: Record<string, string> = {};
        const name = (values.name || "").toString().trim();
        const instructions = (values.instructions || "").toString().trim();
        const feedbackPrompt = (values.feedback_prompt || "").toString().trim();
        const avatarUrl = (values.avatar_url || "").toString().trim();
        const resolvedType = resolveSelectedType();
        const resolvedVoice = resolveSelectedVoice();

        if (name.length > 0) context.name = name;
        if (instructions.length > 0) context.instructions = instructions;
        if (feedbackPrompt.length > 0) context.feedback_prompt = feedbackPrompt;
        if (avatarUrl.length > 0) context.avatar_url = avatarUrl;
        if (resolvedType) context.type = resolvedType;
        if (resolvedVoice) context.voice = resolvedVoice;

        return context;
    };

    const applyAiFields = (fields: Record<string, unknown>) => {
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

        return appliedCount;
    };

    const requestAiFields = async (options: {
        mode: "fill" | "generate";
        step?: "all" | AIGenerationStep;
        context?: Record<string, string>;
    }) => {
        const response = await fetch("/api/agents/ai-parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: aiInput.trim(),
                mode: options.mode,
                step: options.step,
                context: options.context,
            }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const stagePrefix = typeof data?.stage === "string" ? `[${data.stage}] ` : "";
            throw new Error(stagePrefix + (data?.error || "Unable to generate agent details with AI."));
        }

        return (data?.fields || data?.normalized || {}) as Record<string, unknown>;
    };

    const handleAi = async (mode: "fill" | "generate") => {
        if (!aiInput.trim()) {
            toast.error("Describe the agent first so AI can generate details.");
            return;
        }

        setAiLoading(true);
        setAiActiveMode(mode);
        setAiProgressText(mode === "generate" ? "Step 1/3: Generate instruction" : "Filling fields from text");
        try {
            let appliedCount = 0;

            if (mode === "fill") {
                const fields = await requestAiFields({
                    mode: "fill",
                    step: "all",
                    context: buildAiContext(),
                });
                appliedCount += applyAiFields(fields);
            } else {
                for (let i = 0; i < AI_GENERATION_STEPS.length; i += 1) {
                    const currentStep = AI_GENERATION_STEPS[i];
                    setAiProgressText(`Step ${i + 1}/3: ${currentStep.label}`);

                    const fields = await requestAiFields({
                        mode: "generate",
                        step: currentStep.step,
                        context: buildAiContext(),
                    });
                    appliedCount += applyAiFields(fields);
                }

                const applyOpts = { shouldDirty: true, shouldValidate: true };
                if (!resolveSelectedType()) {
                    form.setValue("type", "brainstorm", applyOpts);
                    form.setValue("custom_type_tmp", "", applyOpts);
                    appliedCount += 1;
                }

                if (!resolveSelectedVoice()) {
                    form.setValue("voice", "alloy", applyOpts);
                    form.setValue("custom_voice_tmp", "", applyOpts);
                    appliedCount += 1;
                }
            }

            if (appliedCount === 0) {
                toast.error("AI did not return usable fields. Try a more specific prompt.");
                return;
            }

            toast.success(
                mode === "generate"
                    ? "Completed 3-step generation."
                    : "Agent details filled from text."
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to contact AI service.";
            toast.error(message);
        } finally {
            setAiLoading(false);
            setAiActiveMode(null);
            setAiProgressText("");
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
                        <div className="rounded-lg border border-[#4b89ef]/30 bg-[linear-gradient(180deg,rgba(75,137,239,0.08)_0%,rgba(75,137,239,0.02)_60%,rgba(255,255,255,0.9)_100%)] p-4 lg:sticky lg:top-0 lg:self-start">
                            <p className="mb-2 inline-flex rounded-full border border-[#4b89ef]/35 bg-white/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#2d65be]">
                                AI Generation Workspace
                            </p>
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                                <Sparkles className="h-4 w-4 text-[#4b89ef]" />
                                <span>Left panel generates, right panel is editable output</span>
                            </div>
                            <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
                                Paste a brief below, run generation, then review and edit the generated fields on the right before creating the agent.
                            </p>
                            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                Generation brief
                            </p>
                            <Textarea
                                value={aiInput}
                                onChange={(e) => setAiInput(e.target.value)}
                                placeholder={`You are a daycare parent in Baltimore. Students are showing you what they built for ages 2-4.
Respond like a real parent with a 3-year-old child and give specific, practical feedback.`}
                                className="min-h-[180px] bg-background"
                            />
                            <div className="mt-3 space-y-2 rounded-md border bg-background/90 p-3 text-xs">
                                <p className="font-medium text-foreground">3-step generation flow</p>
                                {AI_GENERATION_STEPS.map((item, index) => {
                                    const stepNumber = index + 1;
                                    const isComplete = aiActiveStepNumber > stepNumber;
                                    const isActive = aiActiveStepNumber === stepNumber;
                                    return (
                                        <div key={item.step} className="flex items-center gap-2 text-muted-foreground">
                                            <span
                                                className={cn(
                                                    "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                                                    isActive
                                                        ? "border-[#4b89ef] bg-[#4b89ef]/15 text-[#2d65be]"
                                                        : isComplete
                                                            ? "border-green-600 bg-green-50 text-green-700"
                                                            : "border-muted-foreground/30 text-muted-foreground"
                                                )}
                                            >
                                                {stepNumber}
                                            </span>
                                            <span className={cn(isActive && "font-medium text-foreground")}>{item.label}</span>
                                        </div>
                                    );
                                })}
                                <p className="text-muted-foreground">
                                    This writes into: Instructions, Feedback prompt, and Name/Type/Voice fields.
                                </p>
                                <p className="text-muted-foreground">
                                    Step 2 evaluates the student conversation behavior, not the agent quality.
                                </p>
                                <p className="text-muted-foreground">
                                    Type options: brainstorm, product, tech, judge. Voice options: {BUILT_IN_VOICE_PROMPT_OPTIONS}.
                                </p>
                                {aiLoading && aiProgressText ? (
                                    <p className="font-medium text-foreground">{aiProgressText}</p>
                                ) : null}
                            </div>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                                <Button
                                    type="button"
                                    disabled={aiLoading || isPending}
                                    onClick={() => void handleAi("generate")}
                                >
                                    {aiLoading && aiActiveMode === "generate"
                                        ? (aiProgressText || "Working...")
                                        : "Run 3-step generation"}
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="space-y-4 pb-1">
                        {!isEdit && (
                            <div className="rounded-md border border-dashed bg-muted/15 p-3 text-xs text-muted-foreground">
                                Generated output appears here. You can edit every field before saving.
                            </div>
                        )}
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

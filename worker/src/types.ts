/**
 * Valid audio formats
 */
export type AudioFormatType = "pcm16" | "g711_ulaw" | "g711_alaw";

/**
 * Audio transcription configuration
 */
export interface AudioTranscriptionType {
  model: "whisper-1";
}

/**
 * Server-side voice activity detection configuration
 */
export interface TurnDetectionServerVadType {
  type: "server_vad";
  threshold?: number;
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
}

/**
 * Tool definition for function calling
 */
export interface ToolDefinitionType {
  type?: "function";
  name: string;
  description: string;
  parameters: { [key: string]: unknown };
}

/**
 * Session resource configuration
 */
export interface SessionResourceType {
  model?: string;
  modalities?: string[];
  instructions?: string;
  voice?:
    | "alloy"
    | "ash"
    | "ballad"
    | "coral"
    | "echo"
    | "sage"
    | "shimmer"
    | "verse";
  input_audio_format?: AudioFormatType;
  output_audio_format?: AudioFormatType;
  input_audio_transcription?: AudioTranscriptionType | null;
  turn_detection?: TurnDetectionServerVadType | null;
  tools?: ToolDefinitionType[];
  tool_choice?:
    | "auto"
    | "none"
    | "required"
    | { type: "function"; name: string };
  temperature?: number;
  max_response_output_tokens?: number | "inf";
}

/**
 * Status of a conversation item
 */
export type ItemStatusType = "in_progress" | "completed" | "incomplete";

/**
 * Input text content
 */
export interface InputTextContentType {
  type: "input_text";
  text: string;
}

/**
 * Input audio content
 */
export interface InputAudioContentType {
  type: "input_audio";
  audio?: string; // base64-encoded audio data
  transcript?: string | null;
}

/**
 * Text content output
 */
export interface TextContentType {
  type: "text";
  text: string;
}

/**
 * Audio content output
 */
export interface AudioContentType {
  type: "audio";
  audio?: string; // base64-encoded audio data
  transcript?: string | null;
}

/**
 * System message item
 */
export interface SystemItemType {
  previous_item_id?: string | null;
  type: "message";
  status: ItemStatusType;
  role: "system";
  content: Array<InputTextContentType>;
}

/**
 * User message item
 */
export interface UserItemType {
  previous_item_id?: string | null;
  type: "message";
  status: ItemStatusType;
  role: "user";
  content: Array<InputTextContentType | InputAudioContentType>;
}

/**
 * Assistant message item
 */
export interface AssistantItemType {
  previous_item_id?: string | null;
  type: "message";
  status: ItemStatusType;
  role: "assistant";
  content: Array<TextContentType | AudioContentType>;
}

/**
 * Function call item
 */
export interface FunctionCallItemType {
  previous_item_id?: string | null;
  type: "function_call";
  status: ItemStatusType;
  call_id: string;
  name: string;
  arguments: string;
}

/**
 * Function call output item
 */
export interface FunctionCallOutputItemType {
  previous_item_id?: string | null;
  type: "function_call_output";
  call_id: string;
  output: string;
}

/**
 * Formatted tool type
 */
export interface FormattedToolType {
  type: "function";
  name: string;
  call_id: string;
  arguments: string;
}

/**
 * Formatted property with various content types
 */
export interface FormattedPropertyType {
  audio?: Int16Array;
  text?: string;
  transcript?: string;
  tool?: FormattedToolType;
  output?: string;
  file?: unknown;
}

/**
 * Formatted item with metadata
 */
export interface FormattedItemType {
  id: string;
  object: string;
  role?: "user" | "assistant" | "system";
  formatted: FormattedPropertyType;
}

/**
 * Base item types union
 */
export type BaseItemType =
  | SystemItemType
  | UserItemType
  | AssistantItemType
  | FunctionCallItemType
  | FunctionCallOutputItemType;

/**
 * Complete item type combining formatted and base item
 */
export type ItemType = FormattedItemType & BaseItemType;

/**
 * Incomplete response status details
 */
export interface IncompleteResponseStatusType {
  type: "incomplete";
  reason: "interruption" | "max_output_tokens" | "content_filter";
}

/**
 * Failed response status details
 */
export interface FailedResponseStatusType {
  type: "failed";
  error: { code: string; message: string } | null;
}

/**
 * Token usage statistics
 */
export interface UsageType {
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
}

/**
 * Response resource with status and output
 */
export interface ResponseResourceType {
  status:
    | "in_progress"
    | "completed"
    | "incomplete"
    | "cancelled"
    | "failed";
  status_details: IncompleteResponseStatusType | FailedResponseStatusType | null;
  output: ItemType[];
  usage: UsageType | null;
}

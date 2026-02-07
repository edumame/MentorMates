export const BUILT_IN_VOICE_OPTIONS = [
  { value: "alloy", label: "Alloy", description: "Plain female" },
  { value: "ash", label: "Ash", description: "Plain male" },
  { value: "ballad", label: "Ballad", description: "British female" },
  { value: "cedar", label: "Cedar", description: "Audiobook male" },
  { value: "coral", label: "Coral", description: "Energetic female" },
  { value: "echo", label: "Echo", description: "Plain male" },
  { value: "fable", label: "Fable", description: "Another plain male" },
  { value: "marin", label: "Marin", description: "Sunny female" },
  { value: "nova", label: "Nova", description: "Crisp female" },
  { value: "onyx", label: "Onyx", description: "Steady deep male" },
  { value: "sage", label: "Sage", description: "Gentle female" },
  { value: "shimmer", label: "Shimmer", description: "Soft female" },
  { value: "verse", label: "Verse", description: "Plain male" },
] as const;

export type BuiltInVoiceValue = (typeof BUILT_IN_VOICE_OPTIONS)[number]["value"];

export const BUILT_IN_VOICE_VALUE_SET = new Set(
  BUILT_IN_VOICE_OPTIONS.map((voice) => voice.value)
);

const BUILT_IN_VOICE_OPTION_BY_VALUE = new Map(
  BUILT_IN_VOICE_OPTIONS.map((voice) => [voice.value, voice] as const)
);

export function getBuiltInVoiceOption(value: string) {
  return BUILT_IN_VOICE_OPTION_BY_VALUE.get(value);
}

export function formatBuiltInVoiceLabel(value: string): string {
  const voice = getBuiltInVoiceOption(value);
  if (!voice) return value;
  return `${voice.label} (${voice.description})`;
}

export const BUILT_IN_VOICE_PROMPT_OPTIONS = BUILT_IN_VOICE_OPTIONS
  .map((voice) => `${voice.value} (${voice.description.toLowerCase()})`)
  .join(", ");

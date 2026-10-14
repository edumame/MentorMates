import { Lora } from "next/font/google";

/** Profile header avatar initials (display semibold / Lora). */
export const profileAvatarInitialsLora = Lora({
  subsets: ["latin"],
  weight: ["600"],
  display: "optional",
  variable: "--font-lora-display",
});

const SOCIAL_LINK_KEYS = [
  "linkedin", "github", "twitter", "facebook", "instagram", "youtube", "portfolio",
] as const;

export type PublicSocialLinks = Partial<Record<typeof SOCIAL_LINK_KEYS[number], string>>;

export interface PublicProfile {
  uid: string;
  display_name: string;
  bio: string | null;
  affiliation: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  links: PublicSocialLinks;
}

export interface OwnerProfile extends PublicProfile {
  email: string | null;
  phone_number: string | null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Account emails must never become public names or avatar initials. */
export function publicDisplayName(value: unknown, fallback = "User"): string {
  const name = typeof value === "string" ? value.trim() : "";
  return name && !name.includes("@") ? name : fallback;
}

function publicLinks(value: unknown): PublicSocialLinks {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const links = value as Record<string, unknown>;
  const result: PublicSocialLinks = {};
  for (const key of SOCIAL_LINK_KEYS) {
    const link = links[key];
    if (typeof link !== "string") continue;
    try {
      const url = new URL(link);
      if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) {
        result[key] = url.href;
      }
    } catch {
      // Invalid or non-web links are not part of the public social-link contract.
    }
  }
  return result;
}

/** Explicit output boundary, including nested JSON; never spread a database row. */
export function presentProfile(
  profile: Record<string, unknown>,
  isVerifiedOwner: boolean,
  phoneNumber: string | null = null,
): PublicProfile | OwnerProfile {
  const publicProfile: PublicProfile = {
    uid: typeof profile.uid === "string" ? profile.uid : "",
    display_name: publicDisplayName(profile.display_name),
    bio: nullableString(profile.bio),
    affiliation: nullableString(profile.affiliation),
    avatar_url: nullableString(profile.avatar_url),
    cover_image_url: nullableString(profile.cover_image_url),
    links: publicLinks(profile.links),
  };
  if (!isVerifiedOwner) return publicProfile;
  return { ...publicProfile, email: nullableString(profile.email), phone_number: phoneNumber };
}

/** Preserve the avatar stack/count without publishing email-valued membership. */
export function publicTeammateLabels(teammates: unknown): string[] {
  return Array.isArray(teammates) ? teammates.map((_, index) => `Team member ${index + 1}`) : [];
}

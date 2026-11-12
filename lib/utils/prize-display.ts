export interface PrizeDisplay {
  title: string;
  subtitle: string;
}

/**
 * Splits a prize into a bold title line and a detail line for display.
 * The amount is the headline and the description sits under it, each shown once.
 */
export function formatPrizeDisplay(
  prizeAmount: string | null | undefined,
  prizeDescription: string | null | undefined,
): PrizeDisplay {
  const amount = prizeAmount?.trim() || "";
  let description = prizeDescription?.trim() || "";

  if (!amount && !description) {
    return { title: "Prize details coming soon", subtitle: "" };
  }

  if (!amount) {
    return { title: description, subtitle: "" };
  }

  // Organizers sometimes repeat the amount at the start of the description
  // ("$500 - cash prize"); drop it so the amount isn't shown twice.
  if (description.toLowerCase().startsWith(amount.toLowerCase())) {
    description = description
      .slice(amount.length)
      .trim()
      .replace(/^[-–—:]\s*/, "");
  }

  return { title: amount, subtitle: description };
}

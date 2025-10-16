import clsx from "clsx";

type Props = {
  name: string;
  className?: string;
  title?: string;
  style?: React.CSSProperties;

  /** Optional Material Symbols axes */
  filled?: boolean;         // FILL: 0 | 1
  weight?: number;          // wght: 100–700
  grade?: number;           // GRAD: -50–200
  opsz?: number | "auto";   // optical size; usually leave "auto"
  size?: number | string;   // optional explicit fontSize (e.g., 128 or "8rem")
};

export function MaterialIcon({
  name,
  className = "",
  title,
  style,
  filled = false,
  weight = 400,
  grade = 0,
  opsz = "auto",
  size,
}: Props) {
  // Build font-variation settings; prefer letting the browser auto-manage opsz
  const fontVariationSettings =
    opsz === "auto"
      ? `"FILL" ${filled ? 1 : 0}, "wght" ${weight}, "GRAD" ${grade}`
      : `"FILL" ${filled ? 1 : 0}, "wght" ${weight}, "GRAD" ${grade}, "opsz" ${opsz}`;

  return (
    <span
      className={clsx(
        // No default text size here – let callers control size.
        "material-symbols-outlined align-middle leading-none",
        className
      )}
      title={title}
      aria-hidden={title ? undefined : true}
      style={{
        fontVariationSettings,
        // Inline fontSize beats any late-loading stylesheet if you pass `size`
        ...(size ? { fontSize: typeof size === "number" ? `${size}px` : size } : {}),
        ...style,
      }}
    >
      {name}
    </span>
  );
}

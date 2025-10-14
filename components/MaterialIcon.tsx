type Props = {
  name: string;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
};
export function MaterialIcon({ name, className = "", title, style }: Props) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      title={title}
      aria-hidden={title ? undefined : true}
      style={{
        fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24',
        ...style,
      }}
    >
      {name}
    </span>
  );
}

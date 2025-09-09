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
        style={style}
    >
        {name}
    </span>
    );
}
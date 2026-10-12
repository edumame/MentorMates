import Image from "next/image";

export function BlogThumbnail({
    thumbnail,
    title,
    priority = false,
}: {
    thumbnail: string;
    title: string;
    priority?: boolean;
}) {
    return (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
            {thumbnail ? (
                <Image
                    src={thumbnail}
                    alt={title}
                    fill
                    sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    priority={priority}
                />
            ) : (
                <div className="absolute inset-0 flex items-end bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-400 p-5 text-white">
                    <span className="max-w-[18rem] text-lg font-semibold leading-tight">{title}</span>
                </div>
            )}
        </div>
    );
}

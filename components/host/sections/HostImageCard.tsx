import Image from "next/image";
import { cn } from "@/lib/utils";

type HostImageCardProps = {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
};

export function HostImageCard({
  src,
  alt,
  className,
  priority,
  sizes = "(max-width: 1024px) 100vw, 600px",
}: HostImageCardProps) {
  return (
    <div
      className={cn(
        "relative aspect-[4/3] sm:aspect-[5/4] lg:aspect-[600/640] w-full overflow-hidden rounded-[12px]",
        className
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        className="object-cover"
        sizes={sizes}
      />
    </div>
  );
}

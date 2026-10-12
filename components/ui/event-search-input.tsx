import { Search } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type EventSearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  wrapperClassName?: string;
  inputClassName?: string;
  iconWrapperClassName?: string;
  rightAdornment?: ReactNode;
};

export function EventSearchInput({
  wrapperClassName,
  inputClassName,
  iconWrapperClassName,
  rightAdornment,
  type = "text",
  ...props
}: EventSearchInputProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <div
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-6 w-6 text-[rgba(0,0,0,0.6)]",
          iconWrapperClassName
        )}
      >
        <Search className="h-full w-full" strokeWidth={2} />
      </div>
      <input
        type={type}
        className={cn(
          "w-full h-10 rounded-xl border border-[rgba(0,0,0,0.15)] bg-white px-12 py-2 text-xs font-normal text-black placeholder:text-[rgba(0,0,0,0.6)] focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-base",
          rightAdornment ? "pr-16" : undefined,
          inputClassName
        )}
        {...props}
      />
      {rightAdornment ? (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {rightAdornment}
        </div>
      ) : null}
    </div>
  );
}

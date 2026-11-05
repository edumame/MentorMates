"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export type DatePickerProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * `new Date("YYYY-MM-DD")` is UTC midnight, which is the previous day west of
 * UTC. A date-only value names a calendar day, so read it as local time.
 */
function parseDateValue(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(value);
}

export function DatePicker({
  value,
  onChange,
  placeholder = "mm/dd/yyyy",
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    parseDateValue(value)
  );

  // The parent can replace the value after mount, for example on a data import.
  React.useEffect(() => {
    setSelectedDate(parseDateValue(value));
  }, [value]);

  const handleSelect = (date: Date) => {
    setSelectedDate(date);

    // Format as datetime-local string
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
    onChange?.(dateTimeString);
    setOpen(false);
  };

  const formatDisplayDate = (date: Date | undefined) => {
    if (!date) return "";

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();

    return `${month}/${day}/${year}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "relative",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600 pointer-events-none z-10" />
          <input
            type="text"
            value={formatDisplayDate(selectedDate)}
            placeholder={placeholder}
            readOnly
            className={cn(
              "h-[44px] pl-11 w-full bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              !selectedDate && "text-[rgba(0,0,0,0.6)]",
              className
            )}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-none shadow-none bg-transparent"
        align="start"
        sideOffset={8}
      >
        <Calendar selected={selectedDate} onSelect={handleSelect} />
      </PopoverContent>
    </Popover>
  );
}

"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export type DatePickerProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function DatePicker({ value, onChange, placeholder = "mm/dd/yyyy", className, disabled }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  );

  const handleSelect = (date: Date) => {
    setSelectedDate(date);

    // Format as datetime-local string
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
    onChange?.(dateTimeString);
    setOpen(false);
  };

  const formatDisplayDate = (date: Date | undefined) => {
    if (!date) return "";

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    return `${month}/${day}/${year}`;
  };

  return (
    <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <div className="relative">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600 pointer-events-none z-10" />
          <input
            type="text"
            value={formatDisplayDate(selectedDate)}
            placeholder={placeholder}
            readOnly
            disabled={disabled}
            className={cn(
              "h-[44px] pl-11 w-full bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              !selectedDate && "text-[rgba(0,0,0,0.6)]",
              disabled && "bg-gray-100 cursor-not-allowed opacity-60",
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

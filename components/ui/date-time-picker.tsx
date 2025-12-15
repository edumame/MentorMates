"use client";

import * as React from "react";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type DateTimePickerProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  timezone?: string;
  showTimezone?: boolean;
  onTimezoneChange?: (timezone: string) => void;
};

// Common timezones
const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona Time (MST)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT/AEST)" },
];

// Get user's timezone using Intl API
const getUserTimezone = (): string => {
  try {
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Check if the user's timezone is in our list, otherwise return UTC
    const isSupported = TIMEZONES.some(tz => tz.value === userTz);
    return isSupported ? userTz : "UTC";
  } catch {
    return "UTC";
  }
};

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date and time",
  className,
  disabled = false,
  timezone,
  showTimezone = true,
  onTimezoneChange,
}: DateTimePickerProps) {
  // Use user's timezone as default if not provided
  const defaultTimezone = React.useMemo(() => {
    return timezone || getUserTimezone();
  }, [timezone]);

  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [selectedTimezone, setSelectedTimezone] = React.useState(defaultTimezone);
  const [timeString, setTimeString] = React.useState(() => {
    if (!value) return "12:00";
    try {
      // Get time in the selected timezone
      const date = new Date(value);
      return formatInTimeZone(date, defaultTimezone, "HH:mm");
    } catch {
      return "12:00";
    }
  });

  // Sync with external timezone prop changes
  React.useEffect(() => {
    if (timezone && timezone !== selectedTimezone) {
      setSelectedTimezone(timezone);
    }
  }, [timezone]);

  // Update time string and date when value or timezone changes
  React.useEffect(() => {
    if (value) {
      const date = new Date(value);
      setSelectedDate(date);
      try {
        // Convert the UTC time to the selected timezone
        const formattedTime = formatInTimeZone(date, selectedTimezone, "HH:mm");
        setTimeString(formattedTime);
      } catch {
        const hours = String(date.getUTCHours()).padStart(2, "0");
        const minutes = String(date.getUTCMinutes()).padStart(2, "0");
        setTimeString(`${hours}:${minutes}`);
      }
    }
  }, [value, selectedTimezone]);

  // Handle timezone change
  const handleTimezoneChange = (newTimezone: string) => {
    setSelectedTimezone(newTimezone);
    onTimezoneChange?.(newTimezone);
    
    // Update the time string to reflect the new timezone
    if (selectedDate && value) {
      try {
        const date = new Date(value);
        const formattedTime = formatInTimeZone(date, newTimezone, "HH:mm");
        setTimeString(formattedTime);
      } catch (error) {
        console.error("Error converting timezone:", error);
      }
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    updateDateTime(date, timeString, selectedTimezone);
  };

  const handleTimeChange = (time: string) => {
    setTimeString(time);
    if (selectedDate) {
      updateDateTime(selectedDate, time, selectedTimezone);
    }
  };

  const updateDateTime = (date: Date, time: string, tz: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    
    try {
      // Create a date string in the selected timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hoursStr = String(hours || 0).padStart(2, "0");
      const minutesStr = String(minutes || 0).padStart(2, "0");
      
      // Parse as a date in the selected timezone
      const dateTimeStr = `${year}-${month}-${day} ${hoursStr}:${minutesStr}`;
      const zonedDate = fromZonedTime(dateTimeStr, tz);
      
      // Convert to ISO string (UTC)
      const isoString = zonedDate.toISOString();
      onChange?.(isoString);
    } catch (error) {
      console.error("Error updating date/time:", error);
      // Fallback to UTC
      const utcDate = new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        hours || 0,
        minutes || 0,
        0,
        0
      ));
      onChange?.(utcDate.toISOString());
    }
  };

  const formatDisplayDateTime = (date: Date | undefined, tz: string) => {
    if (!date) return "";

    try {
      // Format date and time in the selected timezone using date-fns-tz
      const dateStr = formatInTimeZone(date, tz, "MM/dd/yyyy");
      const timeStr = formatInTimeZone(date, tz, "HH:mm");
      const tzAbbr = formatInTimeZone(date, tz, "zzz");
      
      return showTimezone ? `${dateStr} ${timeStr} ${tzAbbr}` : `${dateStr} ${timeStr}`;
    } catch (error) {
      console.error("Error formatting date/time:", error);
      // Fallback to UTC if timezone is invalid
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      const year = date.getUTCFullYear();
      const hours = String(date.getUTCHours()).padStart(2, "0");
      const minutes = String(date.getUTCMinutes()).padStart(2, "0");
      
      return showTimezone 
        ? `${month}/${day}/${year} ${hours}:${minutes} UTC`
        : `${month}/${day}/${year} ${hours}:${minutes}`;
    }
  };

  return (
    <div className="space-y-2">
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
              value={formatDisplayDateTime(selectedDate, selectedTimezone)}
              placeholder={placeholder}
              readOnly
              disabled={disabled}
              className={cn(
                "h-[44px] pl-11 w-full bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed",
                !selectedDate && "text-[rgba(0,0,0,0.6)]",
                className
              )}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          sideOffset={8}
        >
          <div className="p-4 space-y-4">
            <Calendar 
              selected={selectedDate} 
              onSelect={handleDateSelect}
            />
            
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Time
              </label>
              <Input
                type="time"
                value={timeString}
                onChange={(e) => handleTimeChange(e.target.value)}
                disabled={disabled}
                className="h-[44px]"
              />
              <p className="text-xs text-gray-500">
                {selectedTimezone === "UTC" 
                  ? "Time in UTC" 
                  : `Time in ${selectedTimezone.replace(/_/g, " ")} (${
                      (() => {
                        try {
                          return formatInTimeZone(new Date(), selectedTimezone, "zzz");
                        } catch {
                          return selectedTimezone;
                        }
                      })()
                    })`
                }
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {showTimezone && (
        <Select
          value={selectedTimezone}
          onValueChange={handleTimezoneChange}
          disabled={disabled}
        >
          <SelectTrigger className="h-[44px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px]">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {/* Show user's timezone first if it's not in the standard list */}
            {(() => {
              const userTz = getUserTimezone();
              const isInList = TIMEZONES.some(tz => tz.value === userTz);
              
              if (!isInList) {
                return (
                  <SelectItem value={userTz}>
                    {userTz.replace(/_/g, " ")} (Your timezone)
                  </SelectItem>
                );
              }
              return null;
            })()}
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

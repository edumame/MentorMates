"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = {
  selected?: Date;
  onSelect?: (date: Date) => void;
  className?: string;
};

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function Calendar({ selected, onSelect, className }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(
    selected ? new Date(selected) : new Date()
  );

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();
  const days: (number | null)[] = [];

  // Previous month days
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    days.push(prevMonthDays - i);
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  // Next month days
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push(i);
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1));
  };

  const handleDateClick = (day: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;
    const newDate = new Date(year, month, day);
    if (selected) {
      newDate.setHours(selected.getHours());
      newDate.setMinutes(selected.getMinutes());
    }
    onSelect?.(newDate);
  };

  const isSelected = (day: number, isCurrentMonth: boolean) => {
    if (!selected || !isCurrentMonth) return false;
    return (
      selected.getDate() === day &&
      selected.getMonth() === month &&
      selected.getFullYear() === year
    );
  };

  const isToday = (day: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return false;
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  return (
    <div
      className={cn(
        "w-[544px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-4 shadow-lg",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-8">
          <span className="text-[16px] font-semibold">
            {MONTHS[month]} {year}
          </span>
          <span className="text-[16px] font-semibold">
            {MONTHS[month + 1] || MONTHS[0]} {month === 11 ? year + 1 : year}
          </span>
        </div>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Two months side by side */}
      <div className="flex gap-4">
        {/* First month */}
        <div className="flex-1">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((day) => (
              <div
                key={day}
                className="text-center text-[14px] font-normal text-gray-600 py-2"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.slice(0, 42).map((day, index) => {
              const isCurrentMonth = index >= firstDayWeekday && index < firstDayWeekday + daysInMonth;
              const actualDay = day || 0;
              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(actualDay, isCurrentMonth)}
                  disabled={!isCurrentMonth}
                  className={cn(
                    "w-full aspect-square flex items-center justify-center text-[14px] font-normal rounded-lg transition-colors",
                    isCurrentMonth
                      ? "text-black hover:bg-gray-100"
                      : "text-gray-400 cursor-default",
                    isSelected(actualDay, isCurrentMonth) &&
                      "bg-blue-500 text-white hover:bg-blue-600",
                    isToday(actualDay, isCurrentMonth) &&
                      !isSelected(actualDay, isCurrentMonth) &&
                      "border-2 border-blue-500"
                  )}
                >
                  {actualDay}
                </button>
              );
            })}
          </div>
        </div>

        {/* Second month */}
        <div className="flex-1">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((day) => (
              <div
                key={day}
                className="text-center text-[14px] font-normal text-gray-600 py-2"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {(() => {
              const nextMonth = month + 1;
              const nextYear = nextMonth > 11 ? year + 1 : year;
              const nextMonthIndex = nextMonth > 11 ? 0 : nextMonth;
              const firstDayNextMonth = new Date(nextYear, nextMonthIndex, 1);
              const lastDayNextMonth = new Date(nextYear, nextMonthIndex + 1, 0);
              const firstDayWeekdayNext = firstDayNextMonth.getDay();
              const daysInNextMonth = lastDayNextMonth.getDate();
              const prevMonthDaysNext = new Date(nextYear, nextMonthIndex, 0).getDate();
              const daysNext: (number | null)[] = [];

              for (let i = firstDayWeekdayNext - 1; i >= 0; i--) {
                daysNext.push(prevMonthDaysNext - i);
              }
              for (let i = 1; i <= daysInNextMonth; i++) {
                daysNext.push(i);
              }
              const remainingDaysNext = 42 - daysNext.length;
              for (let i = 1; i <= remainingDaysNext; i++) {
                daysNext.push(i);
              }

              return daysNext.slice(0, 42).map((day, index) => {
                const isCurrentMonth = index >= firstDayWeekdayNext && index < firstDayWeekdayNext + daysInNextMonth;
                const actualDay = day || 0;
                const isSelectedNext =
                  selected &&
                  isCurrentMonth &&
                  selected.getDate() === actualDay &&
                  selected.getMonth() === nextMonthIndex &&
                  selected.getFullYear() === nextYear;
                const isTodayNext =
                  isCurrentMonth &&
                  new Date().getDate() === actualDay &&
                  new Date().getMonth() === nextMonthIndex &&
                  new Date().getFullYear() === nextYear;

                return (
                  <button
                    key={index}
                    onClick={() => {
                      if (!isCurrentMonth) return;
                      const newDate = new Date(nextYear, nextMonthIndex, actualDay);
                      if (selected) {
                        newDate.setHours(selected.getHours());
                        newDate.setMinutes(selected.getMinutes());
                      }
                      onSelect?.(newDate);
                    }}
                    disabled={!isCurrentMonth}
                    className={cn(
                      "w-full aspect-square flex items-center justify-center text-[14px] font-normal rounded-lg transition-colors",
                      isCurrentMonth
                        ? "text-black hover:bg-gray-100"
                        : "text-gray-400 cursor-default",
                      isSelectedNext && "bg-blue-500 text-white hover:bg-blue-600",
                      isTodayNext && !isSelectedNext && "border-2 border-blue-500"
                    )}
                  >
                    {actualDay}
                  </button>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

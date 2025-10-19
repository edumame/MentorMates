"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ArrowDownUp,
  X,
  MessageSquare,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";

interface FeedbackItem {
  id: string;
  sender: {
    name: string;
    avatar: string;
    role?: string;
  };
  projectName: string;
  message: string;
  date: string;
  isRead: boolean;
}

export default function FeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(4);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/feedback?page=${currentPage}&limit=6`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch feedback");
        }
        const data = await response.json();
        setFeedbackList(data.feedback || []);
        setTotalPages(data.totalPages || 1);
      } catch (error) {
        console.error("Error fetching feedback:", error);
        setFeedbackList([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, [currentPage]);

  const unreadCount = feedbackList.filter((f) => !f.isRead).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await fetch("/api/feedback/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId: id }),
      });

      if (response.ok) {
        setFeedbackList((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, isRead: true } : item
          )
        );
      }
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch("/api/feedback/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });

      if (response.ok) {
        setFeedbackList((prev) =>
          prev.map((item) => ({ ...item, isRead: true }))
        );
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleViewFeedback = (item: FeedbackItem) => {
    setSelectedFeedback(item);
    setIsModalOpen(true);
    if (!item.isRead) {
      handleMarkAsRead(item.id);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center flex-grow">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageContent className="px-[32px] pt-[24px] pb-0">
        <div className="flex flex-col gap-[48px] max-w-[1064px] mx-auto">
          {/* Header */}
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-[8px]">
              <h1 className="text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
                Feedback
              </h1>
              {unreadCount > 0 && (
                <div className="bg-white border border-[rgba(0,0,0,0.15)] px-[8px] py-0 rounded-[50px] flex items-center">
                  <span className="text-sm text-black leading-[1.5]">
                    {unreadCount}
                  </span>
                </div>
              )}
            </div>
            <Button
              onClick={handleMarkAllAsRead}
              variant="outline"
              className="h-[44px] px-[16px] py-[10px] rounded-[12px] border border-[rgba(0,0,0,0.15)]"
              disabled={unreadCount === 0}
            >
              Mark all {unreadCount} as read
            </Button>
          </div>

          {/* Table */}
          <div className="flex flex-col gap-[24px]">
            {/* Border wrapper */}
            <div className="border border-[rgba(0,0,0,0.15)] rounded-[16px]">
              {/* Header Row */}
              <div className="flex">
                <div className="w-[264px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px]">
                  <p className="text-[16px] font-medium text-black tracking-[-0.04em]">
                    Send from
                  </p>
                </div>
                <div className="w-[196px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px]">
                  <p className="text-[16px] font-medium text-black tracking-[-0.04em]">
                    Project Name
                  </p>
                </div>
                <div className="w-[215px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px]">
                  <p className="text-[16px] font-medium text-black tracking-[-0.04em]">
                    Message
                  </p>
                </div>
                <div className="w-[182px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px] flex items-center">
                  <p className="text-[16px] font-medium text-black tracking-[-0.04em]">
                    Date
                  </p>
                  <ArrowDownUp className="h-[24px] w-[24px] ml-1" />
                </div>
                <div className="w-[208px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px]">
                  <p className="text-[16px] font-medium text-black tracking-[-0.04em]">
                    Action
                  </p>
                </div>
              </div>

              {/* Table Body */}
              <div className="flex bg-white overflow-x-auto">
                {/* Send from Column */}
                <div className="flex flex-col w-[264px]">
                  {feedbackList.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-[4px] px-[24px] py-[28px] ${
                        index !== feedbackList.length - 1
                          ? "border-b border-[rgba(0,0,0,0.15)]"
                          : ""
                      } ${item.sender.role ? "min-h-[108px]" : "h-[80px]"}`}
                    >
                      <Avatar className="h-[40px] w-[40px]">
                        <AvatarImage
                          src={item.sender.avatar}
                          alt={item.sender.name}
                        />
                        <AvatarFallback>
                          {item.sender.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-[16px] text-black truncate">
                        {item.sender.name}
                      </p>
                      {item.sender.role && (
                        <div className="border border-[rgba(0,0,0,0.15)] px-[8px] py-[4px] rounded-full">
                          <p className="text-sm font-medium text-black">
                            {item.sender.role}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Project Name Column */}
                <div className="flex flex-col w-[196px]">
                  {feedbackList.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center px-[24px] py-[28px] ${
                        index !== feedbackList.length - 1
                          ? "border-b border-[rgba(0,0,0,0.15)]"
                          : ""
                      } ${item.sender.role ? "min-h-[108px]" : "h-[80px]"}`}
                    >
                      <p className="text-[16px] text-black tracking-[-0.04em] truncate">
                        {item.projectName}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Message Column */}
                <div className="flex flex-col w-[215px]">
                  {feedbackList.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center px-[24px] py-[28px] ${
                        index !== feedbackList.length - 1
                          ? "border-b border-[rgba(0,0,0,0.15)]"
                          : ""
                      } ${item.sender.role ? "min-h-[108px]" : "h-[80px]"}`}
                    >
                      <p className="text-[16px] text-black tracking-[-0.04em] line-clamp-2">
                        {item.message}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Date Column */}
                <div className="flex flex-col w-[182px]">
                  {feedbackList.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center px-[24px] py-[28px] ${
                        index !== feedbackList.length - 1
                          ? "border-b border-[rgba(0,0,0,0.15)]"
                          : ""
                      } ${item.sender.role ? "min-h-[108px]" : "h-[80px]"}`}
                    >
                      <p className="text-[16px] text-black">{item.date}</p>
                    </div>
                  ))}
                </div>

                {/* Action Column */}
                <div className="flex flex-col w-[208px]">
                  {feedbackList.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-[12px] px-[24px] py-[28px] ${
                        index !== feedbackList.length - 1
                          ? "border-b border-[rgba(0,0,0,0.15)]"
                          : ""
                      } ${item.sender.role ? "min-h-[108px]" : "h-[80px]"}`}
                    >
                      <button
                        onClick={() => handleViewFeedback(item)}
                        className="text-[16px] font-medium text-[#4B89EF] tracking-[-0.04em]"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleMarkAsRead(item.id)}
                        className="text-[16px] font-medium text-[#4B89EF] tracking-[-0.04em]"
                        disabled={item.isRead}
                      >
                        Mark as read
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pagination */}
            <div className="bg-white flex items-center justify-between pt-[24px]">
              <Button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                variant="outline"
                className="flex items-center gap-[6px] px-[24px] py-[10px] rounded-[12px] bg-[rgba(0,0,0,0.05)]"
              >
                <ChevronLeft className="h-[24px] w-[24px]" />
                Prev
              </Button>

              <div className="flex gap-[2px]">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-[40px] h-[40px] flex items-center justify-center rounded-[6px] text-[16px] ${
                        currentPage === page
                          ? "border border-[rgba(0,0,0,0.15)]"
                          : ""
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>

              <Button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                variant="outline"
                className="flex items-center gap-[6px] px-[24px] py-[10px] rounded-[12px] bg-[rgba(0,0,0,0.05)]"
              >
                Next
                <ChevronRight className="h-[24px] w-[24px]" />
              </Button>
            </div>
          </div>
        </div>

        {/* Feedback Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl w-[95vw] sm:w-full mx-4 p-0 bg-white border border-gray-200 rounded-xl shadow-xl [&>button]:hidden sm:max-w-2xl">
            <DialogTitle className="sr-only">
              View feedback for {selectedFeedback?.projectName}
            </DialogTitle>

            {/* Close Button */}
            <DialogClose className="absolute right-3 top-3 sm:right-4 sm:top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>

            {/* Modal Content */}
            <div className="flex flex-col">
              {/* Header Section */}
              <div className="flex flex-col items-center px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 text-center">
                <div className="bg-blue-50 flex items-center justify-center p-2 rounded-xl mb-3">
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 px-2">
                  View feedback for{" "}
                  <span className="text-blue-500 break-words">
                    {selectedFeedback?.projectName}
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 px-2">
                  Improve your project with clear instruction
                </p>
              </div>

              {/* Content Section */}
              <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="bg-gradient-to-b from-blue-50 to-blue-25 rounded-lg p-4 sm:p-6 relative">
                  {/* Date */}
                  <div className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                    {selectedFeedback?.date}
                  </div>

                  {/* Feedback Quote */}
                  <blockquote className="text-base sm:text-lg text-gray-900 mb-3 sm:mb-4 font-serif leading-relaxed">
                    &ldquo;{selectedFeedback?.message}&rdquo;
                  </blockquote>

                  {/* Author Info */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                      <AvatarImage
                        src={selectedFeedback?.sender.avatar}
                        alt={selectedFeedback?.sender.name}
                      />
                      <AvatarFallback className="bg-gray-200 text-gray-700 text-xs sm:text-sm">
                        {selectedFeedback?.sender.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                      <span className="font-medium text-gray-900 text-sm sm:text-base truncate">
                        {selectedFeedback?.sender.name}
                      </span>
                      {selectedFeedback?.sender.role && (
                        <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-white/50 rounded-full border border-gray-200 flex-shrink-0">
                          {selectedFeedback.sender.role}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageContent>
    </PageContainer>
  );
}

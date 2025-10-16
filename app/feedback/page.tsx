"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowDownUp, X, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/feedback?page=${currentPage}&limit=6`);
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

  const unreadCount = feedbackList.filter(f => !f.isRead).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await fetch("/api/feedback/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId: id }),
      });

      if (response.ok) {
        setFeedbackList(prev =>
          prev.map(item => item.id === id ? { ...item, isRead: true } : item)
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
        setFeedbackList(prev => prev.map(item => ({ ...item, isRead: true })));
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:rounded-tl-2xl lg:border-t lg:border-l lg:border-[#D8D8D8] bg-white">
      <div className="flex-grow px-[32px] pt-[24px] pb-0">
        <div className="flex flex-col gap-[48px] max-w-[1064px] mx-auto">
          {/* Header */}
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-[8px]">
              <h1 className="text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
                Feedback
              </h1>
              {unreadCount > 0 && (
                <div className="bg-white border border-[rgba(0,0,0,0.15)] px-[8px] py-0 rounded-[50px] flex items-center">
                  <span className="text-sm text-black leading-[1.5]">{unreadCount}</span>
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
            {/* Border wrapper - stays in place */}
            <div className="border border-[rgba(0,0,0,0.15)] rounded-[16px]">
              {/* Sticky Header Row with border */}
              <div className="flex sticky top-[88px] z-10 bg-white rounded-t-[16px] border-t border-x border-[rgba(0,0,0,0.15)]">
                <div className="w-[264px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px]">
                  <p className="text-[16px] font-medium text-black tracking-[-0.04em]">Send from</p>
                </div>
                <div className="w-[196px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px]">
                  <p className="text-[16px] font-medium text-black tracking-[-0.04em]">Project Name</p>
                </div>
                <div className="w-[215px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px]">
                  <p className="text-[16px] font-medium text-black tracking-[-0.04em]">Message</p>
                </div>
                <div className="w-[182px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px] flex items-center">
                  <p className="text-[16px] font-medium text-black tracking-[-0.04em]">Date</p>
                  <ArrowDownUp className="h-[24px] w-[24px] ml-1" />
                </div>
                <div className="w-[208px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px]">
                  <p className="text-[16px] font-medium text-black tracking-[-0.04em]">Action</p>
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
                        index !== feedbackList.length - 1 ? 'border-b border-[rgba(0,0,0,0.15)]' : ''
                      } ${item.sender.role ? 'min-h-[108px]' : 'h-[80px]'}`}
                    >
                      <Avatar className="h-[40px] w-[40px]">
                        <AvatarImage src={item.sender.avatar} alt={item.sender.name} />
                        <AvatarFallback>{item.sender.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <p className="text-[16px] text-black truncate">{item.sender.name}</p>
                      {item.sender.role && (
                        <div className="border border-[rgba(0,0,0,0.15)] px-[8px] py-[4px] rounded-full">
                          <p className="text-sm font-medium text-black">{item.sender.role}</p>
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
                        index !== feedbackList.length - 1 ? 'border-b border-[rgba(0,0,0,0.15)]' : ''
                      } ${item.sender.role ? 'min-h-[108px]' : 'h-[80px]'}`}
                    >
                      <p className="text-[16px] text-black tracking-[-0.04em] truncate">{item.projectName}</p>
                    </div>
                  ))}
                </div>

                {/* Message Column */}
                <div className="flex flex-col w-[215px]">
                  {feedbackList.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center px-[24px] py-[28px] ${
                        index !== feedbackList.length - 1 ? 'border-b border-[rgba(0,0,0,0.15)]' : ''
                      } ${item.sender.role ? 'min-h-[108px]' : 'h-[80px]'}`}
                    >
                      <p className="text-[16px] text-black tracking-[-0.04em] line-clamp-2">{item.message}</p>
                    </div>
                  ))}
                </div>

                {/* Date Column */}
                <div className="flex flex-col w-[182px]">
                  {feedbackList.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center px-[24px] py-[28px] ${
                        index !== feedbackList.length - 1 ? 'border-b border-[rgba(0,0,0,0.15)]' : ''
                      } ${item.sender.role ? 'min-h-[108px]' : 'h-[80px]'}`}
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
                        index !== feedbackList.length - 1 ? 'border-b border-[rgba(0,0,0,0.15)]' : ''
                      } ${item.sender.role ? 'min-h-[108px]' : 'h-[80px]'}`}
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
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                variant="outline"
                className="flex items-center gap-[6px] px-[24px] py-[10px] rounded-[12px] bg-[rgba(0,0,0,0.05)]"
              >
                <ChevronLeft className="h-[24px] w-[24px]" />
                Prev
              </Button>

              <div className="flex gap-[2px]">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-[40px] h-[40px] flex items-center justify-center rounded-[6px] text-[16px] ${
                      currentPage === page
                        ? 'border border-[rgba(0,0,0,0.15)]'
                        : ''
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <Button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
      </div>

      {/* Feedback Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-none w-auto h-auto p-0 gap-0 bg-white border border-solid border-zinc-200 rounded-[12px] [&>button]:hidden overflow-clip flex items-center">
          <DialogTitle className="sr-only">
            View feedback for {selectedFeedback?.projectName}
          </DialogTitle>

          <div className="basis-0 flex grow items-start min-h-px min-w-px shrink-0">
            {/* Left side - Header */}
            <div className="basis-0 flex flex-col grow items-start justify-center min-h-px min-w-px self-stretch shrink-0">
              <div className="flex flex-col gap-[12px] items-center p-[24px] shrink-0 w-full">
                <div className="bg-[#e5f0fe] flex gap-[10px] items-center justify-center p-[6px] rounded-[13px] shrink-0">
                  <MessageSquare className="w-[24px] h-[24px] text-[#4b89ef] shrink-0" />
                </div>
                <div className="flex flex-col gap-[4px] items-start shrink-0 text-center w-full">
                  <p className="font-semibold leading-[1.4] shrink-0 text-[22px] text-zinc-900 tracking-[-1.32px] w-full">
                    <span>View feedback for </span>
                    <span className="text-[#4b89ef]">{selectedFeedback?.projectName}</span>
                  </p>
                  <p className="font-normal leading-[1.5] not-italic shrink-0 text-[14px] text-zinc-500 w-full">
                    Improve your project with clear instruction
                  </p>
                </div>
              </div>
            </div>

            {/* Right side - Content */}
            <div className="flex flex-col gap-[12px] h-[518px] items-start justify-center shrink-0 w-[500px]">
              <div className="basis-0 bg-gradient-to-b from-[#dbeafe] to-[#f9f9ff] flex flex-col grow items-start justify-center min-h-px min-w-px p-[24px] rounded-[6px] shrink-0 w-full relative">
                <div className="flex items-center justify-center pb-[8px] pt-[16px] px-0 shrink-0">
                  <p className="font-normal h-full leading-[1.5] not-italic overflow-ellipsis overflow-hidden shrink-0 text-[16px] text-black text-nowrap w-[134px]">
                    {selectedFeedback?.date}
                  </p>
                </div>
                <div className="flex flex-col gap-[12px] items-start shrink-0 w-full">
                  <div className="flex flex-col gap-[4px] items-start px-0 py-[12px] shrink-0 w-full">
                    <p className="leading-[normal] not-italic shrink-0 text-[24px] text-zinc-900 w-full" style={{ fontFamily: 'Poly, serif' }}>
                      &ldquo;{selectedFeedback?.message}&rdquo;
                    </p>
                  </div>
                  <div className="flex gap-[4px] items-center shrink-0">
                    <Avatar className="h-[40px] w-[40px] shrink-0">
                      <AvatarImage src={selectedFeedback?.sender.avatar} alt={selectedFeedback?.sender.name} />
                      <AvatarFallback>{selectedFeedback?.sender.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex gap-[4px] items-center shrink-0">
                      <p className="font-normal leading-[1.5] not-italic overflow-ellipsis overflow-hidden shrink-0 text-[16px] text-black text-nowrap whitespace-pre">
                        {selectedFeedback?.sender.name}
                      </p>
                      {selectedFeedback?.sender.role && (
                        <div className="bg-[rgba(255,255,255,0)] border border-[rgba(0,0,0,0.15)] border-solid flex items-start px-[8px] py-[4px] rounded-[100px] shrink-0">
                          <p className="font-medium leading-[1.5] not-italic shrink-0 text-[14px] text-black text-nowrap whitespace-pre">
                            {selectedFeedback.sender.role}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <DialogClose className="absolute left-[452px] overflow-clip h-[32px] w-[32px] top-[16.5px] opacity-70 hover:opacity-100 flex items-center justify-center">
                  <X className="h-[18px] w-[18px]" />
                </DialogClose>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ArrowDownUp,
  X,
  MessageSquare,
  Lightbulb,
  Sparkles,
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
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isGivingFeedback, setIsGivingFeedback] = useState(false);
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/feedback?page=${currentPage}&limit=6`);
        if (!response.ok) throw new Error("Failed to fetch feedback");
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
        setFeedbackList((prev) => prev.map((it) => (it.id === id ? { ...it, isRead: true } : it)));
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
        setFeedbackList((prev) => prev.map((it) => ({ ...it, isRead: true })));
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleViewFeedback = (item: FeedbackItem) => {
    setSelectedFeedback(item);
    setIsGivingFeedback(false);
    setIsModalOpen(true);
    if (!item.isRead) handleMarkAsRead(item.id);
  };

  const handleGiveFeedback = () => {
    setSelectedProject({ id: "dummy-project-2", name: "Relief Map" }); // demo project label to match screenshot
    setIsGivingFeedback(true);
    setSelectedFeedback(null);
    setFeedbackText("");
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex flex-grow items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageContent className="px-[32px] pt-[24px] pb-0">
        <div className="flex flex-col gap-[48px]mx-auto">
          {/* Header */}
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-[8px]">
              <h1 className="text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
                Feedback
              </h1>
              {unreadCount > 0 && (
                <div className="flex items-center rounded-[50px] border border-[rgba(0,0,0,0.15)] bg-white px-[8px] py-0">
                  <span className="text-sm leading-[1.5] text-black">{unreadCount}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleGiveFeedback}
                className="flex items-center gap-2 rounded-lg bg-blue-500 px-6 py-2 text-white hover:bg-blue-600"
              >
                <MessageSquare className="h-4 w-4" />
                Give Feedback
              </Button>
              <Button
                onClick={handleMarkAllAsRead}
                variant="outline"
                className="h-[44px] rounded-[12px] border border-[rgba(0,0,0,0.15)] px-[16px] py-[10px]"
                disabled={unreadCount === 0}
              >
                Mark all {unreadCount} as read
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="flex flex-col gap-[24px]">
            <div className="rounded-[16px] border border-[rgba(0,0,0,0.15)]">
              {/* Header Row */}
              <div className="flex">
                <div className="w-[264px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px]">
                  <p className="text-[16px] font-medium tracking-[-0.04em] text-black">Send from</p>
                </div>
                <div className="w-[196px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px]">
                  <p className="text-[16px] font-medium tracking-[-0.04em] text-black">Project Name</p>
                </div>
                <div className="w-[215px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px]">
                  <p className="text-[16px] font-medium tracking-[-0.04em] text-black">Message</p>
                </div>
                <div className="flex w-[182px] items-center border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px]">
                  <p className="text-[16px] font-medium tracking-[-0.04em] text-black">Date</p>
                  <ArrowDownUp className="ml-1 h-[24px] w-[24px]" />
                </div>
                <div className="w-[208px] border-b border-[rgba(0,0,0,0.15)] px-[24px] py-[16px]">
                  <p className="text-[16px] font-medium tracking-[-0.04em] text-black">Action</p>
                </div>
              </div>

              {/* Body */}
              <div className="flex overflow-x-auto bg-white">
                {/* From */}
                <div className="flex w-[264px] flex-col">
                  {feedbackList.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-[4px] px-[24px] py-[28px] ${
                        index !== feedbackList.length - 1 ? "border-b border-[rgba(0,0,0,0.15)]" : ""
                      } ${item.sender.role ? "min-h-[108px]" : "h-[80px]"}`}
                    >
                      <Avatar className="h-[40px] w-[40px]">
                        <AvatarImage src={item.sender.avatar} alt={item.sender.name} />
                        <AvatarFallback>{item.sender.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <p className="truncate text-[16px] text-black">{item.sender.name}</p>
                      {item.sender.role && (
                        <div className="rounded-full border border-[rgba(0,0,0,0.15)] px-[8px] py-[4px]">
                          <p className="text-sm font-medium text-black">{item.sender.role}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Project */}
                <div className="flex w-[196px] flex-col">
                  {feedbackList.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center px-[24px] py-[28px] ${
                        index !== feedbackList.length - 1 ? "border-b border-[rgba(0,0,0,0.15)]" : ""
                      } ${item.sender.role ? "min-h-[108px]" : "h-[80px]"}`}
                    >
                      <p className="truncate text-[16px] tracking-[-0.04em] text-black">{item.projectName}</p>
                    </div>
                  ))}
                </div>

                {/* Message */}
                <div className="flex w-[215px] flex-col">
                  {feedbackList.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center px-[24px] py-[28px] ${
                        index !== feedbackList.length - 1 ? "border-b border-[rgba(0,0,0,0.15)]" : ""
                      } ${item.sender.role ? "min-h-[108px]" : "h-[80px]"}`}
                    >
                      <p className="line-clamp-2 text-[16px] tracking-[-0.04em] text-black">{item.message}</p>
                    </div>
                  ))}
                </div>

                {/* Date */}
                <div className="flex w-[182px] flex-col">
                  {feedbackList.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center px-[24px] py-[28px] ${
                        index !== feedbackList.length - 1 ? "border-b border-[rgba(0,0,0,0.15)]" : ""
                      } ${item.sender.role ? "min-h-[108px]" : "h-[80px]"}`}
                    >
                      <p className="text-[16px] text-black">{item.date}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex w-[208px] flex-col">
                  {feedbackList.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-[12px] px-[24px] py-[28px] ${
                        index !== feedbackList.length - 1 ? "border-b border-[rgba(0,0,0,0.15)]" : ""
                      } ${item.sender.role ? "min-h-[108px]" : "h-[80px]"}`}
                    >
                      <button
                        onClick={() => handleViewFeedback(item)}
                        className="text-[16px] font-medium tracking-[-0.04em] text-[#4B89EF]"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleMarkAsRead(item.id)}
                        className="text-[16px] font-medium tracking-[-0.04em] text-[#4B89EF]"
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
            <div className="bg-white pt-[24px]">
              <div className="flex items-center justify-between">
                <Button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  className="flex items-center gap-[6px] rounded-[12px] bg-[rgba(0,0,0,0.05)] px-[24px] py-[10px]"
                >
                  <ChevronLeft className="h-[24px] w-[24px]" />
                  Prev
                </Button>

                <div className="flex gap-[2px]">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`flex h-[40px] w-[40px] items-center justify-center rounded-[6px] text-[16px] ${
                        currentPage === page ? "border border-[rgba(0,0,0,0.15)]" : ""
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  className="flex items-center gap-[6px] rounded-[12px] bg-[rgba(0,0,0,0.05)] px-[24px] py-[10px]"
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
          <DialogContent className="w-[95vw] max-w-6xl p-0 sm:w-full sm:max-w-6xl mx-4 bg-white border border-gray-200 rounded-xl shadow-xl">
            <DialogTitle className="sr-only">
              {isGivingFeedback
                ? `Share feedback for ${selectedProject?.name}`
                : `View feedback for ${selectedFeedback?.projectName}`}
            </DialogTitle>

            {/* We place our own close button inside the layouts below */}
            {isGivingFeedback ? (
              /* ---------- Redesigned two-panel layout ----------- */
              <div className="relative flex min-h-[620px] flex-col lg:flex-row">
                {/* Close button */}
                <DialogClose className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>

                {/* Left: input */}
                <div className="flex-1 bg-white px-6 py-6 lg:px-8 lg:py-8">
                  <div className="flex h-full flex-col">
                    <div className="mb-4">
                      <h2 className="text-[16px] font-semibold leading-[1.4] text-muted-foreground">
                        Share feedback for{" "}
                        <button
                          type="button"
                          className="inline-flex items-center text-[16px] font-semibold text-[#4B89EF] hover:underline"
                        >
                          {selectedProject?.name}
                        </button>
                      </h2>
                      <p className="mt-1 text-[12px] leading-[1.45] text-muted-foreground/80">
                        Help this project improve by sharing your thoughts, suggestions, and ideas.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="mb-3 inline-flex items-center gap-2 text-[14px] font-medium text-[#6E56CF] hover:opacity-90"
                    >
                      <Sparkles className="h-4 w-4" />
                      Enhance with AI
                    </button>

                    <div className="mb-4 flex-1">
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Long description or markdown"
                        className="min-h-[280px] w-full resize-none rounded-[10px] border border-[rgba(0,0,0,0.12)] p-4 text-[14px] leading-[1.5] text-foreground placeholder:text-muted-foreground/60 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#4B89EF]/60"
                      />
                    </div>

                    <div className="mt-auto">
                      <Button className="md:w-auto inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#4B89EF] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#3F77D3]">
                        <Sparkles className="h-4 w-4" />
                        Improve feedback with AI
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right: tips */}
                <div className="flex-1 border-l border-[rgba(0,0,0,0.10)] bg-gradient-to-b from-[#F4F7FF] to-white px-6 py-6 lg:px-8 lg:py-8">
                  <div className="flex h-full flex-col">
                    <div className="mb-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF2B8]">
                          <Lightbulb className="h-4 w-4 text-[#B98500]" />
                        </div>
                        <h3 className="text-[16px] font-semibold leading-[1.4] text-foreground">
                          Writing Tips
                        </h3>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {/* 01 */}
                      <div>
                        <div className="mb-1 flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E9F0FF]">
                            <span className="text-[12px] font-semibold text-[#4B89EF]">01</span>
                          </div>
                          <p className="text-[14px] font-medium text-foreground">
                            What should they do next to improve the project?
                          </p>
                        </div>
                        <p className="pl-11 text-[12px] leading-[1.55] text-muted-foreground">
                          Be specific with steps, owners, and success criteria.
                        </p>
                      </div>

                      <div className="border-t border-[rgba(0,0,0,0.08)]" />

                      {/* 02 */}
                      <div>
                        <div className="mb-1 flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E9F0FF]">
                            <span className="text-[12px] font-semibold text-[#4B89EF]">02</span>
                          </div>
                          <p className="text-[14px] font-medium text-foreground">
                            What could be better or work differently?
                          </p>
                        </div>
                        <p className="pl-11 text-[12px] leading-[1.55] text-muted-foreground">
                          Point out trade-offs and suggest alternatives.
                        </p>
                      </div>

                      <div className="border-t border-[rgba(0,0,0,0.08)]" />

                      {/* 03 */}
                      <div>
                        <div className="mb-1 flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E9F0FF]">
                            <span className="text-[12px] font-semibold text-[#4B89EF]">03</span>
                          </div>
                          <p className="text-[14px] font-medium text-foreground">
                            What works well, and are there similar projects to learn from?
                          </p>
                        </div>
                        <p className="pl-11 text-[12px] leading-[1.55] text-muted-foreground">
                          Call out strengths and link references for inspiration.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* -------- View feedback (unchanged) -------- */
              <div className="flex flex-col">
                <DialogClose className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>

                {/* Header */}
                <div className="flex flex-col items-center px-4 pt-4 pb-3 text-center sm:px-6 sm:pt-6 sm:pb-4">
                  <div className="mb-3 flex items-center justify-center rounded-xl bg-blue-50 p-2">
                    <MessageSquare className="h-5 w-5 text-blue-500 sm:h-6 sm:w-6" />
                  </div>
                  <h2 className="mb-1 px-2 text-lg font-semibold text-gray-900 sm:text-xl">
                    View feedback for{" "}
                    <span className="break-words text-blue-500">{selectedFeedback?.projectName}</span>
                  </h2>
                  <p className="px-2 text-xs text-gray-500 sm:text-sm">Improve your project with clear instruction</p>
                </div>

                {/* Content */}
                <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                  <div className="relative rounded-lg bg-gradient-to-b from-blue-50 to-blue-25 p-4 sm:p-6">
                    <div className="mb-3 text-xs text-gray-600 sm:mb-4 sm:text-sm">
                      {selectedFeedback?.date}
                    </div>
                    <blockquote className="mb-3 font-serif leading-relaxed text-gray-900 sm:mb-4 sm:text-lg">
                      &ldquo;{selectedFeedback?.message}&rdquo;
                    </blockquote>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0 sm:h-10 sm:w-10">
                        <AvatarImage
                          src={selectedFeedback?.sender.avatar}
                          alt={selectedFeedback?.sender.name}
                        />
                        <AvatarFallback className="bg-gray-200 text-xs text-gray-700 sm:text-sm">
                          {selectedFeedback?.sender.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                        <span className="truncate text-sm font-medium text-gray-900 sm:text-base">
                          {selectedFeedback?.sender.name}
                        </span>
                        {selectedFeedback?.sender.role && (
                          <span className="flex-shrink-0 rounded-full border border-gray-200 bg-white/50 px-2 py-1 text-xs font-medium text-gray-600">
                            {selectedFeedback.sender.role}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageContent>
    </PageContainer>
  );
}

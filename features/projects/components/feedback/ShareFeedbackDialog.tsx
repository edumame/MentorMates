"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lightbulb, ArrowRight, Copy, Download } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QRCodeSVG } from "qrcode.react";
import { useQRCodeActions } from "../management/project-dashboard/hooks/useQRCodeActions";
import { Input } from "@/components/ui/input";

interface ShareFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}


export function ShareFeedbackDialog({
  open,
  onOpenChange,
  projectId,
}: ShareFeedbackDialogProps) {
  const [feedback, setFeedback] = useState("");
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea (caps at 300px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 300);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [feedback]);

  const { handleCopyQR, handleDownloadQR } = useQRCodeActions(
    "",
    projectId,
    ""
  );



  const handleClose = () => {
    onOpenChange(false);
    // reset after close animation
    setTimeout(() => {
      setFeedback("");
    }, 220);
  };

  const feedbackUrl = `${typeof window !== "undefined" ? window.location.origin : ""
    }/projects/public/${projectId}`;


  return (
    <Dialog open={open} onOpenChange={handleClose} >
      <DialogContent className="max-w-fit p-0">
        <DialogHeader className="hidden">
          <DialogTitle>Share & Get Feedback</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,500px] gap-6 border border-zinc-200 rounded-md">
          {/* Left Column: Share Card */}
          <div>
            <CardHeader>
              <CardTitle className="text-[22px] font-semibold tracking-[-0.06em]">
                Share & Get Feedback
              </CardTitle>
              <p className="text-sm text-zinc-500">
                Share this project with others using the QR code or direct link.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Copy Link Section */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={feedbackUrl}
                    readOnly
                    className="flex-1 bg-white min-w-0"
                  />
                  <Button
                    variant="secondary"
                    className="bg-zinc-100 hover:bg-zinc-200"
                    onClick={() => {
                      navigator.clipboard.writeText(feedbackUrl);
                      toast({
                        title: "Copied!",
                        description: "Link copied to clipboard",
                      });
                    }}
                  >
                    Copy Link
                  </Button>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-zinc-200" />

              {/* QR Code Section */}
              <div className="space-y-4">
                <div className="w-[206px] h-[201px] bg-white">
                  <QRCodeSVG
                    id="project-qr-code"
                    value={feedbackUrl}
                    size={200}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <p className="text-sm text-black">
                  Scan this QR code to share and provide feedback
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="border-[1.5px] border-[rgba(0,0,0,0.05)]"
                    onClick={handleCopyQR}
                  >
                    <Copy className="h-5 w-5 mr-2" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    className="border-[1.5px] border-[rgba(0,0,0,0.05)]"
                    onClick={handleDownloadQR}
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>

          {/* Right Column: Sharing Tips */}
          <div className="p-6 space-y-6" style={{ background: 'linear-gradient(180deg, #DBEAFE 0%, #F9F9FF 100%)' }}>
            <div className="bg-white rounded-[13px] p-1.5 w-fit">
              <Lightbulb className="h-6 w-6" />
            </div>

            <div className="text-left">
              <p className="font-medium text-base text-black">Sharing Tips</p>
            </div>

            <div className="space-y-3">
              <div className="py-3 space-y-1">
                <p className="text-[24px] font-sans text-zinc-900">01</p>
                <p className="text-sm text-zinc-500 leading-[22px]">
                  Save the QR code image to share digitally
                </p>
              </div>

              <div className="border-t border-gray-200" />

              <div className="py-3 space-y-1">
                <p className="text-[24px] font-sans text-zinc-900">02</p>
                <p className="text-sm text-zinc-500 leading-[22px]">
                  Print it on business cards or project handouts
                </p>
              </div>

              <div className="border-t border-gray-200" />

              <div className="py-3 space-y-1">
                <p className="text-[24px] font-sans text-zinc-900">03</p>
                <p className="text-sm text-zinc-500 leading-[22px]">
                  Display it at your project booth or presentation
                </p>
              </div>

              <div className="border-t border-gray-200" />

              <div className="py-3 space-y-1">
                <p className="text-[24px] font-sans text-zinc-900">04</p>
                <p className="text-sm text-zinc-500 leading-[22px]">
                  Add it to your LinkedIn or GitHub profile
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

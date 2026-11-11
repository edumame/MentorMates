"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Copy, Download, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/lib/hooks/use-toast";

interface ShareQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The link the QR code encodes and the "Copy link" button copies. */
  url: string;
  title: string;
  description: string;
  /** File name for the downloaded PNG, e.g. "gallery-share-qr.png". */
  downloadFileName: string;
}

/** Share dialog with a copyable link and a QR code that can be copied as an image or downloaded. */
export function ShareQrDialog({
  open,
  onOpenChange,
  url,
  title,
  description,
  downloadFileName,
}: ShareQrDialogProps) {
  const { toast } = useToast();
  const qrWrapperRef = useRef<HTMLDivElement | null>(null);

  const copyLinkToClipboard = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      throw new Error("Clipboard access is not supported in this browser");
    }
    await navigator.clipboard.writeText(url);
  };

  const handleCopyLink = async () => {
    if (!url) return;
    try {
      await copyLinkToClipboard();
      toast({ title: "Link copied", description: "Link copied to clipboard" });
    } catch (error) {
      console.error("Error copying link:", error);
      toast({
        title: "Copy failed",
        description:
          error instanceof Error ? error.message : "Unable to copy link",
        variant: "destructive",
      });
    }
  };

  // Converts the rendered SVG into a canvas so we can copy/download the QR
  const getQrCanvas = async () => {
    const svg = qrWrapperRef.current?.querySelector(
      "svg"
    ) as SVGSVGElement | null;
    if (!svg) {
      throw new Error("QR code not ready yet");
    }

    const canvas = document.createElement("canvas");
    const size = svg.getBoundingClientRect().width || svg.clientWidth || 200;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context not available");
    }

    const svgString = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(svgUrl);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        reject(new Error("Failed to load QR image"));
      };
      img.src = svgUrl;
    });

    return canvas;
  };

  const handleCopyQr = async () => {
    try {
      if (typeof ClipboardItem === "undefined") {
        throw new Error("ClipboardItem not supported");
      }
      const canvas = await getQrCanvas();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to render QR image"))),
          "image/png"
        )
      );

      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);

      toast({
        title: "QR copied",
        description: "QR code image copied to clipboard",
      });
    } catch (error) {
      console.error("Error copying QR code:", error);
      // Some browsers can't put images on the clipboard; the link still works.
      if (url) {
        try {
          await copyLinkToClipboard();
          toast({
            title: "Link copied instead",
            description:
              "QR image copy is not supported here, so we copied the link.",
          });
          return;
        } catch (linkError) {
          console.error("Error copying fallback link:", linkError);
        }
      }

      toast({
        title: "Copy failed",
        description:
          error instanceof Error ? error.message : "Unable to copy QR code",
        variant: "destructive",
      });
    }
  };

  const handleDownloadQr = async () => {
    try {
      const canvas = await getQrCanvas();
      const link = document.createElement("a");
      link.download = downloadFileName;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast({
        title: "Download started",
        description: "QR code saved as PNG",
      });
    } catch (error) {
      console.error("Error downloading QR code:", error);
      toast({
        title: "Download failed",
        description:
          error instanceof Error ? error.message : "Unable to download QR code",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <QrCode className="h-5 w-5" aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Public link
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={url}
                readOnly
                aria-label="Share link"
                className="flex-1 bg-white"
              />
              <Button
                variant="secondary"
                className="bg-zinc-100 hover:bg-zinc-200"
                onClick={handleCopyLink}
              >
                <Copy className="h-4 w-4 mr-2" aria-hidden="true" />
                Copy link
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4" aria-hidden="true" />
              <p className="text-sm font-medium text-muted-foreground">
                QR code
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div
                ref={qrWrapperRef}
                className="p-4 border border-zinc-200 rounded-2xl bg-white flex items-center justify-center"
              >
                <QRCodeSVG value={url} size={200} level="H" includeMargin />
              </div>
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={handleCopyQr}>
                  <Copy className="h-4 w-4 mr-2" aria-hidden="true" />
                  Copy QR
                </Button>
                <Button variant="outline" onClick={handleDownloadQr}>
                  <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                  Download PNG
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode } from "lucide-react";
import { QRCodeSection } from "@/features/projects/components/management/project-dashboard/components/QRCodeSection";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "@/lib/hooks/use-toast";

interface ProjectQRCodeSectionProps {
  fullUrl: string;
  onCopyQR: () => void;
  onDownloadQR: () => void;
}

export function ProjectQRCodeSection({
  fullUrl,
  onCopyQR,
  onDownloadQR,
}: ProjectQRCodeSectionProps) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center   gap-2">
          <QrCode className="h-5 w-5" />
          Share This Project
        </CardTitle>
        <p className="text-sm text-gray-600">
          Share this project with others using the QR code or direct link.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="flex flex-col items-center md:w-64">
            <QRCodeSection
              fullUrl={fullUrl}
              onCopyQR={onCopyQR}
              onDownloadQR={onDownloadQR}
            />
          </div>

          <div className="flex-1 md:flex-2">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Direct Link:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fullUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(fullUrl);
                      toast({
                        title: "Copied!",
                        description: "Project URL copied to clipboard",
                      });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <h5 className="font-medium text-green-900 mb-2">
                  🚀 Share & Get Feedback:
                </h5>
                <div className="text-sm text-green-800 space-y-1">
                  <p>
                    • Use this QR code or link to share your project with
                    mentors, peers, or anyone who can provide valuable feedback
                  </p>
                  <p>
                    • Perfect for networking events, presentations, or social
                    media sharing
                  </p>
                  <p>
                    • Scan with any smartphone camera - no special app required
                  </p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">
                  💡 Sharing Tips:
                </h5>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Save the QR code image to share digitally</p>
                  <p>• Print it on business cards or project handouts</p>
                  <p>• Include it in your portfolio or resume</p>
                  <p>• Add it to your LinkedIn or GitHub profile</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

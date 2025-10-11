import { Mail } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Support</h1>
          <p className="text-lg text-muted-foreground">
            We&apos;re here to help! Reach out to us with any questions or concerns.
          </p>
        </div>

        {/* Contact Information Card */}
        <div className="bg-card border rounded-lg p-8 shadow-sm">
          <div className="flex flex-col items-center space-y-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">Contact Us</h2>
              <p className="text-muted-foreground">
                Send us an email and we&apos;ll get back to you as soon as possible.
              </p>
            </div>

            <a
              href="mailto:admin@mentormates.ai"
              className="inline-flex items-center gap-2 text-lg font-medium text-primary hover:underline"
            >
              <Mail className="w-5 h-5" />
              admin@mentormates.ai
            </a>
          </div>
        </div>

        {/* Additional Information */}
        <div className="bg-muted/50 rounded-lg p-6 space-y-4">
          <h3 className="text-xl font-semibold">What can we help you with?</h3>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Questions about events and registrations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Technical issues or bug reports</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Account and profile assistance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Partnership and collaboration inquiries</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>General feedback and suggestions</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
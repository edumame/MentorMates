"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, Calendar, Trophy, Bell } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  message: string;
  icon: React.ComponentType<any>;
  description: string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "welcome",
    name: "Welcome Message",
    category: "General",
    subject: "Welcome to [Event Name]!",
    message: `Dear participants,

Welcome to [Event Name]! We're excited to have you join us for this amazing event.

Here are some important details to get you started:
• Event dates: [Insert dates]
• Location: [Insert location/platform]
• Schedule: [Insert schedule link]

We look forward to seeing your innovative projects and creative solutions!

If you have any questions, please don't hesitate to reach out.`,
    icon: Users,
    description: "Welcome new participants to the event"
  },
  {
    id: "reminder",
    name: "Event Reminder",
    category: "Reminders",
    subject: "Reminder: [Event Name] starts soon!",
    message: `Hello everyone,

This is a friendly reminder that [Event Name] is starting soon!

Important reminders:
• Start date: [Insert date]
• Registration deadline: [Insert deadline]
• Required items: [Insert requirements]

Make sure you're prepared and ready to participate. We can't wait to see what you'll create!

Good luck!`,
    icon: Bell,
    description: "Remind participants about upcoming deadlines"
  },
  {
    id: "schedule_update",
    name: "Schedule Update",
    category: "Updates",
    subject: "Important: Schedule Update for [Event Name]",
    message: `Dear participants,

We have an important update regarding the schedule for [Event Name].

Changes:
• [Describe changes]
• New timing: [Insert new timing]
• Affected sessions: [List sessions]

Please make note of these changes and plan accordingly. We apologize for any inconvenience this may cause.

Updated schedule: [Insert link]

Thank you for your understanding!`,
    icon: Calendar,
    description: "Notify about schedule or event changes"
  },
  {
    id: "submission_reminder",
    name: "Submission Reminder",
    category: "Reminders",
    subject: "Final Call: Project Submissions Due Soon!",
    message: `Hello teams,

This is your final reminder that project submissions for [Event Name] are due soon!

Submission details:
• Deadline: [Insert deadline]
• Submission portal: [Insert link]
• Required materials: [List requirements]

Don't forget to:
✓ Test your project thoroughly
✓ Prepare your presentation materials
✓ Submit before the deadline

We're excited to see your amazing projects!

Best of luck with your final preparations!`,
    icon: FileText,
    description: "Remind teams about submission deadlines"
  },
  {
    id: "results",
    name: "Results Announcement",
    category: "Results",
    subject: "🏆 [Event Name] Results Are Here!",
    message: `Congratulations to all participants!

We're thrilled to announce the results of [Event Name]. The level of innovation and creativity we saw was absolutely incredible!

Winners:
🥇 First Place: [Team Name] - [Project Name]
🥈 Second Place: [Team Name] - [Project Name]
🥉 Third Place: [Team Name] - [Project Name]

Special mentions:
• [Award Category]: [Team Name]
• [Award Category]: [Team Name]

Full results and project showcase: [Insert link]

Thank you all for your participation and congratulations to all teams for their outstanding work!

We hope to see you in future events!`,
    icon: Trophy,
    description: "Announce event results and winners"
  },
  {
    id: "feedback_available",
    name: "Feedback Available",
    category: "General",
    subject: "Your Project Feedback is Ready!",
    message: `Hello participants,

Great news! Feedback from our mentors and judges is now available for your projects.

You can access your feedback through:
• Your dashboard: [Insert link]
• Email notifications (if enabled)

The feedback includes:
• Technical assessment
• Innovation scoring
• Improvement suggestions
• Next steps recommendations

We encourage you to review the feedback carefully as it contains valuable insights to help you improve your projects.

Keep building amazing things!`,
    icon: FileText,
    description: "Notify about available project feedback"
  }
];

interface EmailTemplatesProps {
  onSelectTemplate: (template: EmailTemplate) => void;
}

export function EmailTemplates({ onSelectTemplate }: EmailTemplatesProps) {
  const categories = [...new Set(EMAIL_TEMPLATES.map(t => t.category))];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Email Templates</h3>
        <p className="text-sm text-gray-600">
          Choose from predefined templates to get started quickly. You can customize them as needed.
        </p>
      </div>

      {categories.map(category => (
        <div key={category}>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            {category}
            <Badge variant="secondary" className="text-xs">
              {EMAIL_TEMPLATES.filter(t => t.category === category).length}
            </Badge>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EMAIL_TEMPLATES
              .filter(template => template.category === category)
              .map(template => {
                const IconComponent = template.icon;
                return (
                  <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <IconComponent className="h-4 w-4 text-blue-600" />
                        {template.name}
                      </CardTitle>
                      <p className="text-xs text-gray-600">{template.description}</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-medium text-gray-700">Subject:</p>
                          <p className="text-xs text-gray-600 truncate">{template.subject}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-700">Preview:</p>
                          <p className="text-xs text-gray-600 line-clamp-3">
                            {template.message.substring(0, 100)}...
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => onSelectTemplate(template)}
                        >
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
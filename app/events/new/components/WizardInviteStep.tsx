"use client";

import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Share2,
  Users,
  Scale,
  Clipboard,
  Check,
  Mail,
  X,
  Plus,
  UserPlus,
  Info,
} from "lucide-react";
import QRCode from "react-qr-code";
import type { WizardStepProps, WizardEventData } from "@/lib/types/wizard";
import { slugify } from "@/lib/types/wizard";

const TABS = [
  { id: "share", label: "Share", icon: Share2 },
  { id: "participants", label: "Participants", icon: Users },
  { id: "judges", label: "Judges", icon: Scale },
  { id: "organizers", label: "Organizers", icon: Users },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function WizardInviteStep({ event, setEvent }: WizardStepProps) {
  const [activeTab, setActiveTab] = useState<TabId>("share");
  const participantInviteEmails = event.participant_invite_emails ?? [];
  const judgeInviteEmails = event.judge_invite_emails ?? [];

  return (
    <div className="space-y-6">
      {/* Tab chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#4b89ef] text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "share" && <ShareTab event={event} />}
      {activeTab === "participants" && (
        <RoleTab
          role="Participants"
          description="Invite participants to register and submit projects for your event."
          placeholderEmail="participant@email.com"
          emails={participantInviteEmails}
          setEmails={(nextEmails) =>
            setEvent((prev) => ({
              ...prev,
              participant_invite_emails:
                typeof nextEmails === "function"
                  ? nextEmails(prev.participant_invite_emails ?? [])
                  : nextEmails,
            }))
          }
        />
      )}
      {activeTab === "judges" && (
        <RoleTab
          role="Judges"
          description="Invite judges who will review and score submitted projects."
          placeholderEmail="judge@email.com"
          emails={judgeInviteEmails}
          setEmails={(nextEmails) =>
            setEvent((prev) => ({
              ...prev,
              judge_invite_emails:
                typeof nextEmails === "function"
                  ? nextEmails(prev.judge_invite_emails ?? [])
                  : nextEmails,
            }))
          }
        />
      )}
      {activeTab === "organizers" && (
        <OrganizersTab event={event} setEvent={setEvent} />
      )}
    </div>
  );
}

// ── Share Tab ────────────────────────────────────────────────────────────

function ShareTab({ event }: { event: WizardEventData }) {
  const [baseUrl, setBaseUrl] = useState(process.env.NEXT_PUBLIC_BASE_URL || "");
  const eventName = event.event_name || "Your Event";
  const slug = event.slug || slugify(event.event_name || "your-event");

  useEffect(() => {
    if (!baseUrl && typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, [baseUrl]);

  const links = [
    {
      label: "Event Page",
      description: "Public event details page for anyone to view",
      url: `${baseUrl}/${slug}/overview`,
    },
    {
      label: "Participant Portal",
      description: "Registration and project submission page",
      url: `${baseUrl}/${slug}/submit`,
    },
    {
      label: "Judge Dashboard",
      description: "Judging interface for reviewing projects",
      url: `${baseUrl}/${slug}/judge`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-geist text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
          Share {eventName}
        </h2>
        <p className="text-base text-[#7f7f7f] mt-1">
          Share these links and QR codes to invite people to your event.
        </p>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3">
        <Info className="size-4 text-[#4B89EF] shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          These links will be active after you publish the event. Save as draft
          first, then share when ready.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {links.map((link) => (
          <ShareCard key={link.label} {...link} />
        ))}
      </div>
    </div>
  );
}

function ShareCard({
  label,
  description,
  url,
}: {
  label: string;
  description: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="rounded-xl border border-[rgba(0,0,0,0.15)] bg-white overflow-hidden">
      {/* QR Code */}
      <div className="bg-gray-50 p-6 flex items-center justify-center border-b border-gray-100">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <QRCode value={url} size={136} />
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-geist text-base font-semibold tracking-[-0.04em] text-black">
            {label}
          </h3>
          <p className="text-sm text-[#7f7f7f] mt-0.5">{description}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2">
            <p className="text-xs text-gray-500 truncate font-mono">{url}</p>
          </div>
          <button
            onClick={handleCopy}
            className={`shrink-0 rounded-lg p-2 transition-colors ${
              copied
                ? "bg-green-100 text-green-600"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Clipboard className="size-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Role Tab (Participants / Judges) ────────────────────────────────────

function RoleTab({
  role,
  description,
  placeholderEmail,
  emails,
  setEmails,
}: {
  role: string;
  description: string;
  placeholderEmail: string;
  emails: string[];
  setEmails: Dispatch<SetStateAction<string[]>>;
}) {
  const [input, setInput] = useState("");

  const addEmail = () => {
    const email = input.trim().toLowerCase();
    if (email && !emails.includes(email)) {
      setEmails((prev) => [...prev, email]);
      setInput("");
    }
  };

  const removeEmail = (email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-geist text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
          {role}
        </h2>
        <p className="text-base text-[#7f7f7f] mt-1">{description}</p>
      </div>

      {/* Email invite */}
      <div className="rounded-xl border border-[rgba(0,0,0,0.15)] bg-white p-6 space-y-4">
        <h3 className="font-geist text-sm font-semibold tracking-[-0.04em] text-gray-900">
          Invite by Email
        </h3>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addEmail();
                }
              }}
              placeholder={placeholderEmail}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none placeholder:text-gray-400 focus:border-[#4b89ef] focus:ring-1 focus:ring-[#4b89ef] transition-colors"
            />
          </div>
          <button
            onClick={addEmail}
            disabled={!input.trim()}
            className="h-10 rounded-xl bg-[#4b89ef] px-4 text-sm font-medium text-white hover:bg-[#3d75d9] disabled:opacity-40 transition-colors"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {emails.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {emails.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm text-blue-700"
              >
                {email}
                <button
                  onClick={() => removeEmail(email)}
                  className="text-blue-400 hover:text-blue-600"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            No {role.toLowerCase()} invited yet. Invitations will be sent when
            you publish the event.
          </p>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3">
        <UserPlus className="size-4 text-gray-500 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600">
          {role} can also join by visiting the event page link from the Share
          tab. Draft events do not send invite emails.
        </p>
      </div>
    </div>
  );
}

// ── Organizers Tab ──────────────────────────────────────────────────────

function OrganizersTab({ event, setEvent }: WizardStepProps) {
  const [input, setInput] = useState("");
  const organizerEmails = event.organizer_emails ?? [];

  const addOrganizer = () => {
    const email = input.trim().toLowerCase();
    if (email && !organizerEmails.includes(email)) {
      setEvent((prev) => ({
        ...prev,
        organizer_emails: [...(prev.organizer_emails ?? []), email],
      }));
      setInput("");
    }
  };

  const removeOrganizer = (email: string) => {
    setEvent((prev) => ({
      ...prev,
      organizer_emails: (prev.organizer_emails ?? []).filter((e) => e !== email),
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-geist text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
          Organizers
        </h2>
        <p className="text-base text-[#7f7f7f] mt-1">
          Add co-organizers who can manage the event, review submissions, and
          configure settings.
        </p>
      </div>

      {/* Add organizer */}
      <div className="rounded-xl border border-[rgba(0,0,0,0.15)] bg-white p-6 space-y-4">
        <h3 className="font-geist text-sm font-semibold tracking-[-0.04em] text-gray-900">
          Add Organizers
        </h3>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOrganizer();
                }
              }}
              placeholder="organizer@email.com"
              className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none placeholder:text-gray-400 focus:border-[#4b89ef] focus:ring-1 focus:ring-[#4b89ef] transition-colors"
            />
          </div>
          <button
            onClick={addOrganizer}
            disabled={!input.trim()}
            className="h-10 rounded-xl bg-[#4b89ef] px-4 text-sm font-medium text-white hover:bg-[#3d75d9] disabled:opacity-40 transition-colors"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {organizerEmails.length > 0 ? (
          <div className="space-y-2">
            {organizerEmails.map((email) => (
              <div
                key={email}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#4b89ef]/10 flex items-center justify-center">
                    <Users className="size-4 text-[#4b89ef]" />
                  </div>
                  <span className="text-sm text-gray-900">{email}</span>
                </div>
                <button
                  onClick={() => removeOrganizer(email)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            No additional organizers added. You will automatically be assigned as
            the primary organizer.
          </p>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3">
        <Info className="size-4 text-[#4B89EF] shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Organizers have full access to event settings, submissions, judging
          configuration, and participant management. Your account is
          automatically added as an organizer.
        </p>
      </div>
    </div>
  );
}

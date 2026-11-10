import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils/string";
import type { ProjectTeamDisplayMember } from "@/features/projects/utils/team-display";

// Shared by app/projects/[id] and app/projects/public/[id]. `showEmails` is the
// only intended difference: the private route may show member emails to
// people who can already see them; the public route never receives them.

const leadBadge = (
  <Badge
    variant="secondary"
    className="bg-transparent border border-black/15 text-black rounded-full text-sm px-2.5 py-0.5"
  >
    Lead
  </Badge>
);

function subtitleFor(member: ProjectTeamDisplayMember, showEmails: boolean) {
  return member.affiliation || (showEmails ? member.email : null);
}

function MemberAvatar({ member }: { member: ProjectTeamDisplayMember }) {
  return (
    <Avatar className="h-14 w-14 shrink-0">
      <AvatarImage src={member.avatarUrl ?? undefined} alt={member.displayName} />
      <AvatarFallback>{getInitials(member.displayName)}</AvatarFallback>
    </Avatar>
  );
}

/** "Meet the team" overview sidebar: the lead plus the first teammate. */
export function ProjectTeamSidebar({
  members,
  showEmails = false,
}: {
  members: ProjectTeamDisplayMember[];
  showEmails?: boolean;
}) {
  const lead = members.find((member) => member.role === "lead");
  const firstMember = members.find((member) => member.role === "member");
  const visible = [lead, firstMember].filter(
    (member): member is ProjectTeamDisplayMember => Boolean(member)
  );

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-black tracking-tight">Meet the team</h3>
      <div className="space-y-6">
        {visible.map((member) => {
          const subtitle =
            member.role === "lead"
              ? subtitleFor(member, showEmails)
              : member.affiliation;
          return (
            <div key={member.key} className="flex gap-4 items-center">
              <MemberAvatar member={member} />
              <div className="space-y-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-base text-black">
                    {member.displayName}
                  </p>
                  {member.role === "lead" ? leadBadge : null}
                </div>
                {subtitle ? <p className="text-base text-black">{subtitle}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Full roster for the Team tab. */
export function ProjectTeamMembersList({
  members,
  showEmails = false,
}: {
  members: ProjectTeamDisplayMember[];
  showEmails?: boolean;
}) {
  return (
    <div className="w-full overflow-visible">
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 overflow-visible">
        <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
        <div className="mt-5 space-y-4">
          {members.map((member) => {
            const subtitle = subtitleFor(member, showEmails);
            return (
              <div
                key={member.key}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <MemberAvatar member={member} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-semibold text-base text-black truncate">
                        {member.displayName}
                      </p>
                      {member.role === "lead" ? leadBadge : null}
                    </div>
                    {subtitle ? (
                      <p className="text-base text-black truncate">{subtitle}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Bot, ChevronsUpDown } from "lucide-react";
import { NotificationsNone } from "@mui/icons-material";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useNotificationData,
  NotificationPopoverContent,
} from "@/components/layout/NotificationPopoverContent";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/lib/hooks/use-admin";
import posthog from "posthog-js";
import type { UserProfile } from "@/lib/types";
import { profileNeedsCompletion } from "@/features/user/profile/profile-completion";

const HomeIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M9 22V12H15V22M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"
      stroke="#09090B"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const EventIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M16 2V6M8 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z"
      stroke="#09090B"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BookIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M6.74911 22.1496C5.95394 22.1496 5.27194 21.8879 4.70311 21.3646C4.13411 20.8414 3.84961 20.1909 3.84961 19.4131V5.36686C3.84961 4.7057 4.04986 4.11661 4.45036 3.59961C4.85086 3.08261 5.37311 2.75595 6.01711 2.61961L13.4421 1.07336C13.9724 0.95753 14.4469 1.07261 14.8654 1.41861C15.2839 1.76461 15.4931 2.20903 15.4931 2.75186V14.9019C15.4931 15.3029 15.3689 15.659 15.1204 15.9704C14.8717 16.2815 14.5485 16.4828 14.1509 16.5741L6.54286 18.2126C6.24786 18.2744 6.00219 18.4194 5.80586 18.6474C5.60936 18.8752 5.51111 19.1311 5.51111 19.4151C5.51111 19.7304 5.63494 19.9881 5.88261 20.1881C6.13028 20.3881 6.41919 20.4881 6.74936 20.4881H18.4931V4.67836C18.4931 4.4447 18.5735 4.24736 18.7344 4.08636C18.8954 3.9252 19.0925 3.84461 19.3259 3.84461C19.5592 3.84461 19.7556 3.9252 19.9151 4.08636C20.0748 4.24736 20.1546 4.4447 20.1546 4.67836V20.4464C20.1546 20.9189 19.9883 21.3209 19.6556 21.6524C19.3229 21.9839 18.9195 22.1496 18.4454 22.1496H6.74911ZM8.67236 16.1269L13.8316 15.0116V2.69186L8.67236 3.75711V16.1269ZM7.01111 16.4824V4.11211L6.51961 4.21211C6.23061 4.27878 5.99028 4.41503 5.79861 4.62086C5.60694 4.82686 5.51111 5.07553 5.51111 5.36686V16.9566C5.66444 16.8659 5.82761 16.7891 6.00061 16.7261C6.17344 16.6631 6.35353 16.6129 6.54086 16.5756L7.01111 16.4824Z"
      fill="black"
    />
  </svg>
);

const ProjectIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M11 3V11L14 8L17 11V3M5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3Z"
      stroke="#09090B"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FeedbackIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M18 9H20C20.5304 9 21.0391 9.21071 21.4142 9.58579C21.7893 9.96086 22 10.4696 22 11V22L18 18H12C11.4696 18 10.9609 17.7893 10.5858 17.4142C10.2107 17.0391 10 16.5304 10 16V15M14 9C14 9.53043 13.7893 10.0391 13.4142 10.4142C13.0391 10.7893 12.5304 11 12 11H6L2 15V4C2 2.9 2.9 2 4 2H12C12.5304 2 13.0391 2.21071 13.4142 2.58579C13.7893 2.96086 14 3.46957 14 4V9Z"
      stroke="#09090B"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AgentsIcon = <Bot size={24} color="#09090B" strokeWidth={1.67} />;

const SupportIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M9.08922 9.0001C9.32432 8.33177 9.78837 7.7682 10.3992 7.40923C11.01 7.05026 11.7281 6.91904 12.4264 7.03881C13.1247 7.15858 13.758 7.52162 14.2143 8.06363C14.6706 8.60563 14.9203 9.29162 14.9192 10.0001C14.9192 12.0001 11.9192 13.0001 11.9192 13.0001M11.9992 17.0001H12.0092M3.84922 8.6201C3.70326 7.96262 3.72567 7.27894 3.91437 6.63244C4.10308 5.98593 4.45196 5.39754 4.92868 4.92182C5.40541 4.4461 5.99453 4.09844 6.64142 3.91109C7.28832 3.72374 7.97205 3.70276 8.62922 3.8501C8.99093 3.2844 9.48922 2.81886 10.0782 2.49638C10.6671 2.17391 11.3278 2.00488 11.9992 2.00488C12.6707 2.00488 13.3313 2.17391 13.9203 2.49638C14.5092 2.81886 15.0075 3.2844 15.3692 3.8501C16.0274 3.70212 16.7123 3.72301 17.3602 3.91081C18.0081 4.09862 18.598 4.44724 19.0751 4.92425C19.5521 5.40126 19.9007 5.99117 20.0885 6.6391C20.2763 7.28703 20.2972 7.97193 20.1492 8.6301C20.7149 8.99181 21.1805 9.4901 21.5029 10.079C21.8254 10.668 21.9944 11.3286 21.9944 12.0001C21.9944 12.6715 21.8254 13.3322 21.5029 13.9211C21.1805 14.5101 20.7149 15.0084 20.1492 15.3701C20.2966 16.0273 20.2756 16.711 20.0882 17.3579C19.9009 18.0048 19.5532 18.5939 19.0775 19.0706C18.6018 19.5473 18.0134 19.8962 17.3669 20.0849C16.7204 20.2736 16.0367 20.2961 15.3792 20.1501C15.018 20.718 14.5193 21.1855 13.9293 21.5094C13.3394 21.8333 12.6772 22.0032 12.0042 22.0032C11.3312 22.0032 10.669 21.8333 10.0791 21.5094C9.48914 21.1855 8.99045 20.718 8.62922 20.1501C7.97205 20.2974 7.28832 20.2765 6.64142 20.0891C5.99453 19.9018 5.40541 19.5541 4.92868 19.0784C4.45196 18.6027 4.10308 18.0143 3.91437 17.3678C3.72567 16.7213 3.70326 16.0376 3.84922 15.3801C3.27917 15.0193 2.80963 14.5203 2.48426 13.9293C2.1589 13.3384 1.98828 12.6747 1.98828 12.0001C1.98828 11.3255 2.1589 10.6618 2.48426 10.0709C2.80963 9.47992 3.27917 8.98085 3.84922 8.6201Z"
      stroke="#09090B"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const data = [
  { name: "Home", href: "/", icon: HomeIcon },
  { name: "Events", href: "/events", icon: EventIcon },
  { name: "Learn", href: "/learn", icon: BookIcon },
  { name: "Projects", href: "/projects", icon: ProjectIcon },
  { name: "Feedback", href: "/feedback", icon: FeedbackIcon },
  { name: "API", href: "/keys", icon: AgentsIcon },
];

const bottomLinksBase = [
  {
    name: "Notification",
    href: null as string | null,
    icon: <NotificationsNone className="h-6 w-6" />,
  },
  { name: "Support", href: "/support", icon: SupportIcon },
];

interface ExtendedUserProfile extends UserProfile {
  onboarding_metadata: Record<string, unknown> | null;
  affiliation: string | null;
  phone_number?: string | null;
  links?: Record<string, string> | null;
}

interface SideNavProps {
  /** When true, show MentorMates logo at top of sidebar (e.g. event pages with no top header) */
  showLogoAtTop?: boolean;
}

export function SideNav({ showLogoAtTop }: SideNavProps = {}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<ExtendedUserProfile | null>(null);
  const pathname = usePathname();
  const { needsProfileCompletion } = useNotificationData();
  const isAdmin = useAdmin();
  const showProfileCompletionWarning = Boolean(
    session && profileNeedsCompletion(userProfile)
  );

  useEffect(() => {
    const client = createClient();
    client.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("uid", session?.user?.id)
        .single();
      setUserProfile(data);
    };
    if (session) fetchUserProfile();
  }, [session]);

  const handleSignOut = async () => {
    localStorage.removeItem("returnUrl");
    await supabase.auth.signOut();
    posthog.reset();
    router.push("/");
    window.location.reload();
  };

  // Helper to determine if path is active
  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    // For routes like /profile/123, we check if pathname startswith
    return pathname?.startsWith(href);
  };

  return (
    <div className="w-[270px] h-full flex flex-col justify-between">
      <div className="flex flex-col gap-2 p-4 mt-[6px]">
        {showLogoAtTop && (
          <Link href="/" className="flex items-center gap-2 p-2 mb-2 rounded-md hover:opacity-90">
            <Image
              src="/mentormate.png"
              alt="MentorMates"
              width={200}
              height={40}
              className="object-contain"
            />
          </Link>
        )}
        {data.map((item) => (
          <Link
            href={item.href}
            key={item.name}
            className={`
              flex items-center gap-2
              w-full p-2
              rounded-md
              transition
              ${isActive(item.href) ? "bg-blue-100/50" : ""}
              hover:bg-blue-100/50
            `}
          >
            {item.icon}
            {item.name}
          </Link>
        ))}
      </div>
      <div className="flex flex-col gap-2 mt-8 p-4 mt-auto">
        {bottomLinksBase.map((item) => {
          if (item.name === "Notification" && item.href === null) {
            return (
              <Popover key={item.name}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full p-2 rounded-md transition hover:bg-blue-100/50 text-left relative"
                  >
                    <span className="relative">
                      <NotificationsNone className="h-6 w-6" />
                      {needsProfileCompletion && (
                        <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full" />
                      )}
                    </span>
                    {item.name}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="start"
                  sideOffset={8}
                  className="w-[420px] p-0 bg-white border border-[rgba(0,0,0,0.15)] rounded-xl"
                >
                  <NotificationPopoverContent />
                </PopoverContent>
              </Popover>
            );
          }
          const href = item.href!;
          const active = isActive(href);
          return (
            <Link
              href={href}
              key={item.name}
              className={`
                flex items-center gap-2
                w-full p-2
                rounded-md
                transition
                ${active ? "bg-blue-100/50" : ""}
                hover:bg-blue-100/50
              `}
            >
              {item.icon}
              {item.name}
            </Link>
          );
        })}
        {/* Profile card 在 Support 下面，图一样式：32px 圆角、#E9EAEB 边框；有 session 才显示完整卡片 */}
        {session && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="relative w-full h-[64px] flex items-center gap-4 px-3 self-stretch rounded-xl border border-[#E9EAEB] bg-white text-left hover:bg-gray-50/80 transition-colors"
              >
                {showProfileCompletionWarning && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-xs font-semibold text-white">
                    !
                  </span>
                )}
                <Avatar
                className="h-[40px] w-[40px] shrink-0 border-[0.714px] border-[var(--Color-Neutral-Lighter,#D8D8D8)]"
              >
                  <AvatarImage src={session.user.user_metadata?.avatar_url} />
                  <AvatarFallback className="text-sm font-medium text-[#181d27]">
                    {session.user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 flex flex-col items-start gap-0 overflow-hidden">
                  <p className="text-sm font-semibold text-[#181d27] leading-5 truncate w-full">
                    {session.user.user_metadata?.full_name ||
                      session.user.user_metadata?.name ||
                      session.user.email?.split("@")[0]}
                  </p>
                  <p
                    className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-sans text-xs font-normal leading-[20px] text-[#535862]"
                    style={{ fontFamily: "var(--Font-family-font-family-body, Inter)", fontSize: "12px", lineHeight: "var(--Line-height-text-sm, 20px)" }}
                  >
                    {session.user.email}
                  </p>
                </div>
                <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-md p-1.5">
                  <ChevronsUpDown className="h-5 w-5 text-[#535862]" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              side="top"
              sideOffset={10}
              collisionPadding={16}
              className="min-w-[260px] max-w-[min(calc(100vw-2rem),320px)] rounded-xl border border-[#E9EAEB] bg-white p-0 shadow-lg"
            >
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xl font-bold leading-snug break-words">
                    {session.user.user_metadata?.full_name ||
                      session.user.user_metadata?.name ||
                      session.user.email?.split("@")[0]}
                  </p>
                  {isAdmin && (
                    <span className="text-sm rounded-full bg-blue-100 text-blue-700 px-3 py-0.5 shrink-0">
                      Admin
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-700 break-all">
                  {session.user.email}
                </p>
                {profileNeedsCompletion(userProfile) ? (
                  <Button
                    variant="defaultGray"
                    onClick={() =>
                      router.push(`/profile/${session?.user?.id}?edit=1`)
                    }
                    className="mt-4 w-full text-base"
                  >
                    Set up profile
                  </Button>
                ) : (
                  <Button
                    variant="defaultGray"
                    onClick={() => router.push(`/profile/${session?.user?.id}`)}
                    className="mt-4 w-full text-base"
                  >
                    View profile
                  </Button>
                )}
                <DropdownMenuSeparator className="my-4" />
                <div className="flex flex-col gap-0.5 pb-0.5">
                  <DropdownMenuItem onSelect={() => router.push("/help")}>
                    Support
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push("/blog")}>
                    Blog
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => void handleSignOut()}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Log out
                  </DropdownMenuItem>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!session && (
          <Link
            href="/login"
            className="w-full h-[64px] flex items-center gap-4 px-3 rounded-xl border border-[#E9EAEB] bg-white text-[#181d27] text-sm font-medium hover:bg-gray-50/80 transition-colors"
          >
            <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500">
              ?
            </span>
            <span>Log in</span>
          </Link>
        )}
      </div>
    </div>
  );
}

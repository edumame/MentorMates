"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEventRegistration } from "@/components/event-registration-provider";
import { EventRole } from "@/lib/types";
import { canAccessRole, toEventRole } from "@/features/user/roles/roles";

const navItems = [
  {
    name: "Overview",
    href: "/overview",
    public: true,
    minRole: EventRole.Participant, // All roles can access
  },
  {
    name: "Dashboard",
    href: "/dashboard",
    public: false,
    minRole: EventRole.Participant, // All roles can access
  },
  {
    name: "Participants",
    href: "/participants",
    public: false,
    minRole: EventRole.Participant, // All roles can access
  },
  {
    name: "Gallery",
    href: "/gallery",
    public: false,
    minRole: EventRole.Participant, // All roles can access
  },
  {
    name: "Feed",
    href: "/feed",
    public: false,
    minRole: EventRole.Participant, // All roles can access
  },
  // TODO: add admin data page?
];

export function HackathonNav({ id }: { id: string }) {
  const pathname = usePathname();
  const basePath = `/events/${id}`;
  const { isRegistered, userRole } = useEventRegistration();

  const visibleNavItems = navItems.filter((item) => {
    const hasAccess =
      item.public ||
      (isRegistered &&
        userRole &&
        canAccessRole(toEventRole(userRole), item.minRole));
    return hasAccess;
  });

  return (
    <nav className="w-full">
      <div className="overflow-x-auto py-4 sm:py-10">
        <ul className="flex space-x-3 sm:space-x-6 px-2 sm:px-4 border-gray-200/30">
          {visibleNavItems.map((item) => {
            const isActive = pathname === `${basePath}${item.href}`;
            return (
              <motion.li
                key={item.name}
                whileHover={{ scale: 1.05 }}
                className="flex-shrink-0"
              >
                <Link
                  href={`${basePath}${item.href}`}
                  className={cn(
                    "py-2 sm:py-3 text-sm sm:text-base font-medium transition-all duration-200",
                    isActive
                      ? "border-b-2 border-blue-500 text-white"
                      : "border-b-2 border-transparent text-gray-300 hover:text-white hover:border-gray-200"
                  )}
                >
                  {item.name}
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

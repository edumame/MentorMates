"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { NotificationsNone } from "@mui/icons-material";
import { SideNav } from "@/components/heroes/components/SideNav";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useNotificationData,
  NotificationPopoverContent,
} from "@/components/layout/NotificationPopoverContent";
import { AuthNavbarRight } from "@/components/layout/AuthNavbarRight";
import { cn } from "@/lib/utils";

interface MobileSidebarDrawerProps {
  showLogoInSidebar?: boolean;
}

export function MobileSidebarDrawer({ showLogoInSidebar }: MobileSidebarDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-[#09090B]"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" strokeWidth={1.67} />
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          "!left-0 !top-0 flex h-[100dvh] max-h-[100dvh] w-[min(100vw,280px)] max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 rounded-none border-0 border-r border-[var(--Color-Neutral-Lighter,#D8D8D8)] bg-[#fbfcfe] p-0 shadow-xl duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=open]:slide-in-from-left-5 data-[state=closed]:slide-out-to-left-5",
          "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
        )}
      >
        <DialogTitle className="sr-only">Main navigation</DialogTitle>
        <DialogDescription className="sr-only">
          App sections, notifications, and account menu
        </DialogDescription>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SideNav showLogoAtTop={showLogoInSidebar} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MobileHeaderActions() {
  const { needsProfileCompletion } = useNotificationData();

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-[#09090B]"
            aria-label="Notifications"
          >
            <span className="relative inline-flex">
              <NotificationsNone className="h-6 w-6" />
              {needsProfileCompletion ? (
                <span
                  className="absolute right-0 top-0 h-2 w-2 translate-x-px -translate-y-px rounded-full bg-red-500"
                  aria-hidden
                />
              ) : null}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={8}
          className="w-[min(calc(100vw-2rem),420px)] max-w-[calc(100vw-2rem)] border border-[rgba(0,0,0,0.15)] bg-white p-0 rounded-xl"
        >
          <NotificationPopoverContent />
        </PopoverContent>
      </Popover>
      <AuthNavbarRight className="flex shrink-0 items-center pl-0.5" />
    </div>
  );
}

interface MobileSidebarHeaderProps {
  showLogoInSidebar?: boolean;
}

/** Matches signed-in home / app shell: menu left, notifications + avatar right. */
export function MobileSidebarHeader({ showLogoInSidebar }: MobileSidebarHeaderProps) {
  return (
    <header
      className="relative z-30 flex h-[52px] min-h-[52px] shrink-0 items-center justify-between border-b border-[var(--Color-Neutral-Lighter,#D8D8D8)] bg-white px-3 py-2 lg:hidden"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <MobileSidebarDrawer showLogoInSidebar={showLogoInSidebar} />
      <MobileHeaderActions />
    </header>
  );
}

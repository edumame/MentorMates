"use client";

import { AuthRedirectProvider } from "@/features/user/authentication/auth/AuthRedirectProvider";
import { RedirectProvider } from "@/features/user/authentication/redirect/RedirectProvider";
import { Toaster } from "@/components/ui/toaster";
import { TRPCReactProvider } from "@/trpc/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <AuthRedirectProvider>
        <RedirectProvider>
          {children}
          <Toaster />
        </RedirectProvider>
      </AuthRedirectProvider>
    </TRPCReactProvider>
  );
}

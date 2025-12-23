"use client";

import { AuthRedirectProvider } from '@/features/user/authentication/auth/AuthRedirectProvider';
import { Toaster } from "@/components/ui/toaster";
import { TRPCReactProvider } from "@/trpc/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <AuthRedirectProvider>
        {children}
        <Toaster />
      </AuthRedirectProvider>
    </TRPCReactProvider>
  );
}
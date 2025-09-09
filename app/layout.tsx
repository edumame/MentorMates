import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/utils/Providers";
import { AuthProvider } from "@/features/user/authentication/auth/AuthProvider";
import { StagewiseToolbarWrapper } from "@/components/StagewiseToolbarWrapper";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";
import { LayoutConfigProvider } from "@/components/layout/LayoutConfigProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MentorMates",
  description: "Connecting mentors and students in hackathons",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <body className={inter.className}>
        <Providers>
          <LayoutConfigProvider>
            <ConditionalNavbar />
            <AuthProvider>
              <ConditionalLayout>
                {process.env.NODE_ENV === "development" && (
                  <StagewiseToolbarWrapper />
                )}
                {children}
              </ConditionalLayout>
            </AuthProvider>
          </LayoutConfigProvider>
        </Providers>
      </body>
    </html>
  );
}

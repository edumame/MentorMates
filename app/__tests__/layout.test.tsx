import * as React from "react";
import RootLayout from "@/app/layout";
import { ShipcueReportButton } from "@/components/layout/ShipcueReportButton";
import { FloatingSupportButton } from "@/components/layout/FloatingSupportButton";
import { AuthContextProvider } from "@/features/user/authentication/auth/AuthContext";

// jest.mock factories are hoisted, so each one builds its own passthrough.
jest.mock("next/font/google", () => ({ Inter: () => ({ className: "inter" }) }));
jest.mock("geist/font/sans", () => ({ GeistSans: { variable: "geist" } }));
jest.mock("@/components/utils/Providers", () => ({ Providers: ({ children }: { children?: React.ReactNode }) => children }));
jest.mock("@/features/user/authentication/auth/AuthProvider", () => ({ AuthProvider: ({ children }: { children?: React.ReactNode }) => children }));
jest.mock("@/features/user/authentication/auth/AuthContext", () => ({
  AuthContextProvider: function AuthContextProvider({ children }: { children?: React.ReactNode }) {
    return children;
  },
}));
jest.mock("@/components/layout/ConditionalNavbar", () => ({ ConditionalNavbar: () => null }));
jest.mock("@/components/layout/ConditionalLayout", () => ({ ConditionalLayout: ({ children }: { children?: React.ReactNode }) => children }));
jest.mock("@/components/layout/LayoutConfigProvider", () => ({ LayoutConfigProvider: ({ children }: { children?: React.ReactNode }) => children }));
jest.mock("@/components/layout/ConditionalAnnouncement", () => ({ ConditionalAnnouncement: () => null }));
jest.mock("@/components/layout/FloatingSupportButton", () => ({ FloatingSupportButton: () => null }));
jest.mock("@/components/layout/ShipcueReportButton", () => ({ ShipcueReportButton: () => null }));
jest.mock("@/app/JsonLd", () => ({ JsonLd: () => null }));
jest.mock("@/app/seo-metadata", () => ({ seoMetadata: {} }));

/** Each element in the tree with the path of component types above it. */
function walk(node: React.ReactNode, above: unknown[] = [], out: { type: unknown; above: unknown[] }[] = []) {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    out.push({ type: child.type, above });
    walk((child.props as { children?: React.ReactNode }).children, [...above, child.type], out);
  });
  return out;
}

describe("RootLayout", () => {
  const tree = walk(RootLayout({ children: <p>page</p> }));

  it("mounts shipcue's report button on every page, next to the support button", () => {
    const shipcue = tree.filter((n) => n.type === ShipcueReportButton);
    expect(shipcue).toHaveLength(1);
    expect(tree.some((n) => n.type === FloatingSupportButton)).toBe(true);
  });

  it("puts the report button inside the auth context it reads the session from", () => {
    const shipcue = tree.find((n) => n.type === ShipcueReportButton)!;
    expect(shipcue.above).toContain(AuthContextProvider);
  });
});

import { render, screen } from "@testing-library/react";
import { OPEN_SOURCE } from "@/lib/config/open-source";
import { LandingHero } from "@/components/heroes/LandingHero";

jest.mock("@/components/heroes/components/Work", () => ({ Work: () => null }));
jest.mock("@/components/heroes/components/Build", () => ({ Build: () => null }));
jest.mock("@/components/heroes/components/Featured", () => ({ Featured: () => null }));
jest.mock("@/components/heroes/components/Impact", () => ({ Impact: () => null }));
jest.mock("@/components/heroes/components/Customer", () => ({ Customer: () => null }));
jest.mock("@/components/heroes/components/LogoCarousel", () => ({ LogoCarousel: () => null }));
jest.mock("@/components/layout/CTAJoin", () => ({ CTAJoin: () => null }));

describe("homepage", () => {
  beforeAll(() => {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  });

  it("shows the open source section without a non-profit claim to signed-out visitors", () => {
    const { container } = render(<LandingHero />);
    expect(screen.getByRole("heading", { name: /open source, built with our community/i })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/non[\s-]?profit|registering as/i);
    expect(screen.getByRole("link", { name: OPEN_SOURCE.LICENSE_NAME })).toHaveAttribute("href", OPEN_SOURCE.LICENSE_PATH);
  });
});

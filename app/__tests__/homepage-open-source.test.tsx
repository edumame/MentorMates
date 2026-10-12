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

  it("shows the open source and non-profit section to signed-out visitors", () => {
    render(<LandingHero />);
    expect(screen.getByText(new RegExp(OPEN_SOURCE.NONPROFIT_STATUS))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: OPEN_SOURCE.LICENSE_NAME })).toHaveAttribute("href", OPEN_SOURCE.LICENSE_PATH);
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import { CoverImageWithFallback } from "../cover-image-with-fallback";

describe("CoverImageWithFallback", () => {
  it("uses placeholder when src is missing", () => {
    render(<CoverImageWithFallback src={null} alt="Cover" />);
    const img = screen.getByRole("img", { name: "Cover" }) as HTMLImageElement;
    expect(img.src).toContain("placeholder.png");
  });

  it("falls back to placeholder when the image errors", () => {
    render(
      <CoverImageWithFallback
        src="https://example.com/broken.png"
        alt="Cover"
      />
    );
    const img = screen.getByRole("img", { name: "Cover" }) as HTMLImageElement;
    expect(img.getAttribute("src")).toContain("broken.png");
    fireEvent.error(img);
    expect(img.getAttribute("src")).toContain("placeholder.png");
  });
});

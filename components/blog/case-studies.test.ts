import fs from "node:fs";
import path from "node:path";
import { blogContent } from "./Content";
import { caseStudies, caseStudyBySlug } from "./case-studies";

describe("blog case studies", () => {
    it("has a unique, routable entry for every case study", () => {
        const slugs = caseStudies.map((study) => study.slug);

        expect(new Set(slugs).size).toBe(slugs.length);
        expect(slugs).toEqual(["4", "5", "6", "7", "8", "9"]);
        for (const study of caseStudies) {
            expect(caseStudyBySlug.get(study.slug)).toBe(study);
            expect(blogContent).toContainEqual(expect.objectContaining({
                slug: study.slug,
                title: study.title,
                thumbnail: study.thumbnail,
            }));
        }
    });

    it("keeps every referenced local image in the public directory", () => {
        const imagePaths = caseStudies.flatMap((study) => [
            study.thumbnail,
            ...study.sections.map((section) => section.image?.src ?? ""),
        ]).filter(Boolean);

        for (const imagePath of imagePaths) {
            expect(fs.existsSync(path.join(process.cwd(), "public", imagePath.replace(/^\//, "")))).toBe(true);
        }
    });

    it("includes substantive content and accessible image descriptions", () => {
        for (const study of caseStudies) {
            expect(study.introduction.length).toBeGreaterThan(120);
            expect(study.sections.length).toBeGreaterThanOrEqual(3);
            expect(study.stats.length).toBeGreaterThanOrEqual(3);
            expect(study.heroAlt.length).toBeGreaterThan(10);
            for (const section of study.sections) {
                if (section.image) expect(section.image.alt.length).toBeGreaterThan(10);
            }
        }
    });
});

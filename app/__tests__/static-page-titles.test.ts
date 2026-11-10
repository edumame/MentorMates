/**
 * @jest-environment node
 */
// PUB-017: public pages need distinct titles instead of the site default.
import { seoMetadata } from "@/app/seo-metadata";
import { metadata as about } from "@/app/(static)/about/layout";
import { metadata as blog } from "@/app/(static)/blog/layout";
import { metadata as faq } from "@/app/(static)/faq/layout";
import { metadata as help } from "@/app/(static)/help/layout";
import { metadata as host } from "@/app/(static)/host/layout";
import { metadata as join } from "@/app/(static)/join/layout";
import { metadata as contributors } from "@/app/(static)/previous-contributors/layout";
import { metadata as privacy } from "@/app/(static)/privacy/layout";
import { metadata as research } from "@/app/(static)/research/layout";
import { metadata as support } from "@/app/(static)/support/layout";
import { metadata as terms } from "@/app/(static)/terms/layout";
import { metadata as login } from "@/app/login/layout";

it("gives every public page its own title", () => {
  const titles = [about, blog, faq, help, host, join, contributors, privacy, research, support, terms, login].map(
    (m) => String(m.title)
  );
  expect(new Set(titles).size).toBe(titles.length);
  for (const title of titles) {
    expect(title).not.toBe(String(seoMetadata.title));
    expect(title).toMatch(/\| MentorMates$/);
  }
});

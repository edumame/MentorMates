import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Server-side request config for next-intl.
 * Loads the appropriate messages file based on the request locale.
 *
 * Wire this up in next.config.mjs via createNextIntlPlugin('./i18n/request.ts').
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    requested && (routing.locales as readonly string[]).includes(requested)
      ? requested
      : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

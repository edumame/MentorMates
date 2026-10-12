import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import {
  RedirectProvider,
  useRedirect,
} from "./RedirectProvider";
import {
  LAST_VISITED_URL_STORAGE_KEY,
  RETURN_URL_STORAGE_KEY,
} from "./redirect-url";

let mockPathname = "/projects/alpha";
let mockSearchParams = new URLSearchParams("tab=demo");

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

type RedirectApi = ReturnType<typeof useRedirect>;

function CaptureRedirect({ onChange }: { onChange: (api: RedirectApi) => void }) {
  const redirect = useRedirect();

  useEffect(() => {
    onChange(redirect);
  }, [onChange, redirect]);

  return null;
}

function renderRedirectProvider(onChange: (api: RedirectApi) => void = jest.fn()) {
  return render(
    <RedirectProvider>
      <CaptureRedirect onChange={onChange} />
    </RedirectProvider>
  );
}

describe("RedirectProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPathname = "/projects/alpha";
    mockSearchParams = new URLSearchParams("tab=demo");
    window.history.replaceState({}, "", `${mockPathname}?${mockSearchParams}`);
  });

  it("tracks the last eligible visited route", async () => {
    renderRedirectProvider();

    await waitFor(() => {
      expect(localStorage.getItem(LAST_VISITED_URL_STORAGE_KEY)).toBe(
        "/projects/alpha?tab=demo"
      );
    });
  });

  it("skips blocked routes while tracking last visited URLs", () => {
    mockPathname = "/login";
    mockSearchParams = new URLSearchParams("returnUrl=/projects/alpha");
    window.history.replaceState({}, "", `${mockPathname}?${mockSearchParams}`);

    renderRedirectProvider();

    expect(localStorage.getItem(LAST_VISITED_URL_STORAGE_KEY)).toBeNull();
  });

  it("sets and consumes explicit return URLs", () => {
    let redirect: RedirectApi | null = null;
    renderRedirectProvider((next) => {
      redirect = next;
    });

    act(() => {
      expect(redirect?.setReturnUrl("/join-project?project=1&token=abc")).toBe(
        "/join-project?project=1&token=abc"
      );
    });

    expect(localStorage.getItem(RETURN_URL_STORAGE_KEY)).toBe(
      "/join-project?project=1&token=abc"
    );

    act(() => {
      expect(redirect?.consumeReturnUrl(null, "/")).toBe(
        "/join-project?project=1&token=abc"
      );
    });

    expect(localStorage.getItem(RETURN_URL_STORAGE_KEY)).toBeNull();
  });

  it("prefers a safe query return URL over stored values", () => {
    let redirect: RedirectApi | null = null;
    localStorage.setItem(RETURN_URL_STORAGE_KEY, "/claim-ticket?ticket=old");

    renderRedirectProvider((next) => {
      redirect = next;
    });

    act(() => {
      expect(redirect?.consumeReturnUrl("/projects/new", "/")).toBe(
        "/projects/new"
      );
    });
  });

  it("updates context state from browser storage events", async () => {
    let redirect: RedirectApi | null = null;
    renderRedirectProvider((next) => {
      redirect = next;
    });

    act(() => {
      localStorage.setItem(RETURN_URL_STORAGE_KEY, "/claim-ticket?ticket=1");
      window.dispatchEvent(new Event("storage"));
    });

    await waitFor(() => {
      expect(redirect?.returnUrl).toBe("/claim-ticket?ticket=1");
    });
  });

  it("falls back to last visited when an explicit target is unsafe", () => {
    let redirect: RedirectApi | null = null;
    mockPathname = "/login";
    mockSearchParams = new URLSearchParams();
    localStorage.setItem(LAST_VISITED_URL_STORAGE_KEY, "/events/hack-night");

    renderRedirectProvider((next) => {
      redirect = next;
    });

    act(() => {
      expect(redirect?.consumeReturnUrl("https://example.com/phish", "/")).toBe(
        "/events/hack-night"
      );
    });
  });
});

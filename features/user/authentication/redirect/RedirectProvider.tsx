"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  getSafeRedirectPath,
  LAST_VISITED_URL_STORAGE_KEY,
  RETURN_URL_STORAGE_KEY,
} from "./redirect-url";

const REDIRECT_STORAGE_EVENT = "mentor-mates:redirect-storage";

interface RedirectContextValue {
  returnUrl: string | null;
  lastVisitedUrl: string | null;
  setReturnUrl: (url: string | null | undefined) => string | null;
  setReturnUrlFromCurrentLocation: () => string | null;
  clearReturnUrl: () => void;
  consumeReturnUrl: (
    preferredUrl?: string | null,
    fallbackUrl?: string
  ) => string;
}

const RedirectContext = createContext<RedirectContextValue | null>(null);

function getClientOrigin() {
  return typeof window === "undefined" ? undefined : window.location.origin;
}

function readStoredPath(key: string) {
  if (typeof window === "undefined") return null;
  return getSafeRedirectPath(localStorage.getItem(key), getClientOrigin());
}

function writeStoredPath(key: string, value: string | null) {
  if (typeof window === "undefined") return;

  if (value) {
    localStorage.setItem(key, value);
  } else {
    localStorage.removeItem(key);
  }

  window.dispatchEvent(new Event(REDIRECT_STORAGE_EVENT));
}

function getCurrentLocationPath() {
  if (typeof window === "undefined") return null;

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function RedirectRouteTracker({
  onVisit,
}: {
  onVisit: (path: string) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    onVisit(`${pathname}${search ? `?${search}` : ""}`);
  }, [onVisit, pathname, search]);

  return null;
}

export function RedirectProvider({ children }: { children: React.ReactNode }) {
  const lastWrittenPathRef = useRef<string | null>(null);
  const [returnUrl, setReturnUrlState] = useState<string | null>(null);
  const [lastVisitedUrl, setLastVisitedUrl] = useState<string | null>(null);

  const refreshFromStorage = useCallback(() => {
    setReturnUrlState(readStoredPath(RETURN_URL_STORAGE_KEY));
    setLastVisitedUrl(readStoredPath(LAST_VISITED_URL_STORAGE_KEY));
  }, []);

  useEffect(() => {
    refreshFromStorage();

    window.addEventListener("storage", refreshFromStorage);
    window.addEventListener(REDIRECT_STORAGE_EVENT, refreshFromStorage);

    return () => {
      window.removeEventListener("storage", refreshFromStorage);
      window.removeEventListener(REDIRECT_STORAGE_EVENT, refreshFromStorage);
    };
  }, [refreshFromStorage]);

  const trackLastVisitedPath = useCallback((path: string) => {
    const safePath = getSafeRedirectPath(path, getClientOrigin());

    if (!safePath || lastWrittenPathRef.current === safePath) return;

    lastWrittenPathRef.current = safePath;
    setLastVisitedUrl(safePath);
    writeStoredPath(LAST_VISITED_URL_STORAGE_KEY, safePath);
  }, []);

  const setReturnUrl = useCallback((url: string | null | undefined) => {
    const safePath = getSafeRedirectPath(url, getClientOrigin());

    setReturnUrlState(safePath);
    writeStoredPath(RETURN_URL_STORAGE_KEY, safePath);

    return safePath;
  }, []);

  const setReturnUrlFromCurrentLocation = useCallback(() => {
    return setReturnUrl(getCurrentLocationPath());
  }, [setReturnUrl]);

  const clearReturnUrl = useCallback(() => {
    setReturnUrlState(null);
    writeStoredPath(RETURN_URL_STORAGE_KEY, null);
  }, []);

  const consumeReturnUrl = useCallback(
    (preferredUrl?: string | null, fallbackUrl = "/") => {
      const origin = getClientOrigin();
      const target =
        getSafeRedirectPath(preferredUrl, origin) ??
        readStoredPath(RETURN_URL_STORAGE_KEY) ??
        returnUrl ??
        readStoredPath(LAST_VISITED_URL_STORAGE_KEY) ??
        lastVisitedUrl ??
        getSafeRedirectPath(fallbackUrl, origin) ??
        "/";

      clearReturnUrl();

      return target;
    },
    [clearReturnUrl, lastVisitedUrl, returnUrl]
  );

  const value = useMemo(
    () => ({
      returnUrl,
      lastVisitedUrl,
      setReturnUrl,
      setReturnUrlFromCurrentLocation,
      clearReturnUrl,
      consumeReturnUrl,
    }),
    [
      clearReturnUrl,
      consumeReturnUrl,
      lastVisitedUrl,
      returnUrl,
      setReturnUrl,
      setReturnUrlFromCurrentLocation,
    ]
  );

  return (
    <RedirectContext.Provider value={value}>
      <Suspense fallback={null}>
        <RedirectRouteTracker onVisit={trackLastVisitedPath} />
      </Suspense>
      {children}
    </RedirectContext.Provider>
  );
}

export function useRedirect() {
  const context = useContext(RedirectContext);
  if (!context) {
    throw new Error("useRedirect must be used within RedirectProvider");
  }

  return context;
}

"use client";

import { useCallback, useSyncExternalStore } from "react";

/** A media query as state. `serverValue` is what the first (server and hydration) render assumes. */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

const HASH_EVENT = "report:hash";

function subscribeToHash(notify: () => void) {
  window.addEventListener("hashchange", notify);
  window.addEventListener(HASH_EVENT, notify);
  return () => {
    window.removeEventListener("hashchange", notify);
    window.removeEventListener(HASH_EVENT, notify);
  };
}

/** The current URL hash including the "#", or "" before hydration. */
export function useHash(): string {
  return useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => "",
  );
}

/** Updates the hash without adding a history entry and tells `useHash` about it. */
export function replaceHash(hash: string) {
  const url = hash
    ? `#${hash}`
    : `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(HASH_EVENT));
}

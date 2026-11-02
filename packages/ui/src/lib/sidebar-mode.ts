// ui-redesign C06: sidebar collapse mode persisted in localStorage.

export type SidebarMode = "auto" | "expanded" | "collapsed";

export const SIDEBAR_MODE_STORAGE_KEY = "openrig.sidebar.mode";

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Safari private mode throws on localStorage access.
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Safari private mode throws on localStorage access.
  }
}

export function readSidebarMode(): SidebarMode {
  const raw = typeof window === "undefined" ? null : safeGet(SIDEBAR_MODE_STORAGE_KEY);
  if (raw === "auto" || raw === "expanded" || raw === "collapsed") return raw;
  return "auto";
}

export function writeSidebarMode(mode: SidebarMode): void {
  if (typeof window === "undefined") return;
  safeSet(SIDEBAR_MODE_STORAGE_KEY, mode);
}

/** auto: collapsed when an Explorer column is visible on desktop, expanded otherwise. */
export function isSidebarCollapsed(mode: SidebarMode, explorerVisible: boolean): boolean {
  if (mode === "collapsed") return true;
  if (mode === "expanded") return false;
  return explorerVisible;
}

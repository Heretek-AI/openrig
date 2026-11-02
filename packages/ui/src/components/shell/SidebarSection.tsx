// ui-redesign C06: collapsible labeled sidebar section.

import { useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { cn } from "../../lib/utils.js";

export const SIDEBAR_FOLDED_STORAGE_KEY = "openrig.sidebar.folded";

function readFolded(): string[] {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_FOLDED_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeFolded(ids: string[]): void {
  try {
    window.localStorage.setItem(SIDEBAR_FOLDED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Safari private mode throws on localStorage access.
  }
}

export interface SidebarSectionProps {
  id: string;
  label: string | null;
  collapsed: boolean;
  children: React.ReactNode;
}

export function SidebarSection({ id, label, collapsed, children }: SidebarSectionProps) {
  const [folded, setFolded] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readFolded(),
  );
  const isFolded = folded.includes(id);
  // The `top` section has no label and is never foldable.
  const foldable = label !== null && id !== "top" && !collapsed;

  const setOpen = (open: boolean) => {
    setFolded((prev) => {
      const next = open ? prev.filter((v) => v !== id) : [...prev.filter((v) => v !== id), id];
      writeFolded(next);
      return next;
    });
  };

  if (!foldable) {
    return (
      <div role="group" aria-label={label ?? undefined}>
        {label && !collapsed ? (
          <h2 className="px-3 pt-4 pb-1 text-xs font-medium text-on-surface-variant">{label}</h2>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <Collapsible.Root open={!isFolded} onOpenChange={setOpen}>
      <div role="group" aria-label={label ?? undefined}>
        <Collapsible.Trigger
          aria-label={`${isFolded ? "Expand" : "Collapse"} ${label} section`}
          className={cn(
            "w-full px-3 pt-4 pb-1 text-left text-xs font-medium text-on-surface-variant",
            "hover:text-on-surface",
          )}
        >
          <span className="flex w-full items-center justify-between">
            {label}
            <span aria-hidden="true" className="text-[10px] leading-none">
              {isFolded ? "+" : "–"}
            </span>
          </span>
        </Collapsible.Trigger>
        <Collapsible.Content>{children}</Collapsible.Content>
      </div>
    </Collapsible.Root>
  );
}

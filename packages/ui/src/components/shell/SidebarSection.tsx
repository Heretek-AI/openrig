// ui-redesign C06: collapsible labeled sidebar section.

import { useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { cn } from "../../lib/utils.js";
import { readFoldedSections, writeFoldedSections } from "../../lib/sidebar-mode.js";

export interface SidebarSectionProps {
  id: string;
  label: string | null;
  collapsed: boolean;
  children: React.ReactNode;
}

export function SidebarSection({ id, label, collapsed, children }: SidebarSectionProps) {
  const [folded, setFolded] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readFoldedSections(),
  );
  const isFolded = folded.includes(id);
  // The `top` section has no label and is never foldable.
  const foldable = label !== null && id !== "top" && !collapsed;

  const setOpen = (open: boolean) => {
    setFolded((prev) => {
      const next = open ? prev.filter((v) => v !== id) : [...prev.filter((v) => v !== id), id];
      writeFoldedSections(next);
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

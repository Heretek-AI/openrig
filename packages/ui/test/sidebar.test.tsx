// ui-redesign C06: sidebar shell tests.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor, screen, fireEvent } from "@testing-library/react";
import { createMockEventSourceClass } from "./helpers/mock-event-source.js";
import { createAppTestRouter } from "./helpers/test-router.js";
import { AppShell } from "../src/components/AppShell.js";
import { SIDEBAR_MODE_STORAGE_KEY } from "../src/lib/sidebar-mode.js";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

let OriginalEventSource: typeof EventSource | undefined;

beforeEach(async () => {
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes("/api/rigs/summary")) return new Response(JSON.stringify([]));
    if (url.includes("/api/rigs/ps")) return new Response(JSON.stringify([]));
    if (url.includes("/api/inventory")) return new Response(JSON.stringify([]));
    return new Response("[]");
  });
  OriginalEventSource = globalThis.EventSource;
  globalThis.EventSource = createMockEventSourceClass() as unknown as typeof EventSource;
  const { queryClient } = await import("../src/lib/query-client.js");
  queryClient.clear();
});

afterEach(() => {
  if (OriginalEventSource) globalThis.EventSource = OriginalEventSource;
  window.localStorage.clear();
  cleanup();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1024,
    writable: true,
  });
  window.dispatchEvent(new Event("resize"));
});

async function renderAt(initialPath: string, opts: { innerWidth?: number } = {}) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: opts.innerWidth ?? 1440, writable: true });
  window.dispatchEvent(new Event("resize"));
  const result = render(
    createAppTestRouter({
      routes: [{ path: "$", component: () => null }],
      rootComponent: ({ children }) => <AppShell>{children}</AppShell>,
      initialPath,
    }),
  );
  await waitFor(() => {
    expect(result.container.querySelector("[data-testid='app-rail']")).toBeTruthy();
  }, { timeout: 5000 });
  return result;
}

const ALL_SIDEBAR_TESTIDS = [
  "rail-dashboard",
  "rail-for-you",
  "rail-topology",
  "rail-agents",
  "rail-fleet",
  "rail-project",
  "rail-workflows",
  "rail-files",
  "rail-specs",
  "rail-settings",
  "rail-advisor",
  "rail-operator",
];

describe("Sidebar shell (C06)", () => {
  it("renders all 12 sidebar nav testids at /", async () => {
    const { container } = await renderAt("/");
    for (const id of ALL_SIDEBAR_TESTIDS) {
      expect(container.querySelector(`[data-testid='${id}']`), id).toBeTruthy();
    }
  });

  it("shows visible labels Inbox, Rigs, Projects, Library", async () => {
    await renderAt("/");
    for (const label of ["Inbox", "Rigs", "Projects", "Library"]) {
      expect(screen.getByText(label, { selector: ":not(.sr-only)" })).toBeTruthy();
    }
  });

  it("auto-collapses at /topology with explorer (data-collapsed=true)", async () => {
    const { container } = await renderAt("/topology");
    const nav = container.querySelector("[data-testid='app-rail']") as HTMLElement;
    expect(nav.getAttribute("data-collapsed")).toBe("true");
  });

  it("is expanded at / with no explorer (data-collapsed=false)", async () => {
    const { container } = await renderAt("/");
    const nav = container.querySelector("[data-testid='app-rail']") as HTMLElement;
    expect(nav.getAttribute("data-collapsed")).toBe("false");
  });

  it("sidebar-toggle flips data-collapsed and persists openrig.sidebar.mode", async () => {
    const { container } = await renderAt("/");
    const nav = () => container.querySelector("[data-testid='app-rail']") as HTMLElement;
    expect(nav().getAttribute("data-collapsed")).toBe("false");
    fireEvent.click(screen.getByTestId("sidebar-toggle"));
    expect(nav().getAttribute("data-collapsed")).toBe("true");
    expect(window.localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY)).toBe("collapsed");
    fireEvent.click(screen.getByTestId("sidebar-toggle"));
    expect(nav().getAttribute("data-collapsed")).toBe("false");
    expect(window.localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY)).toBe("expanded");
  });

  it("rail-topology has aria-current=page at /topology/rig/x", async () => {
    const { container } = await renderAt("/topology/rig/rig_alpha");
    const link = container.querySelector("[data-testid='rail-topology']") as HTMLElement;
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("sidebar-search click dispatches openrig:open-palette", async () => {
    await renderAt("/");
    const spy = vi.fn();
    window.addEventListener("openrig:open-palette", spy);
    fireEvent.click(screen.getByTestId("sidebar-search"));
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener("openrig:open-palette", spy);
  });
});

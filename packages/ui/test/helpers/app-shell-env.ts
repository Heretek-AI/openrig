import { vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { createMockEventSourceClass } from "./mock-event-source.js";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

let OriginalEventSource: typeof EventSource | undefined;

/** Shared fetch/EventSource/query-client boilerplate for AppShell chrome tests. */
export function setupAppShellTestEnv() {
  beforeEach(async () => {
    mockFetch.mockReset();
    // Default rig/ps mocks return empty so chrome can render.
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/api/rigs/summary")) return new Response(JSON.stringify([]));
      if (url.includes("/api/rigs/ps")) return new Response(JSON.stringify([]));
      if (url.includes("/api/inventory")) return new Response(JSON.stringify([]));
      return new Response("[]");
    });
    OriginalEventSource = globalThis.EventSource;
    globalThis.EventSource = createMockEventSourceClass() as unknown as typeof EventSource;
    const { queryClient } = await import("../../src/lib/query-client.js");
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
}

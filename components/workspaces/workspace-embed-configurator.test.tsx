import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WorkspaceEmbedConfigurator } from "./workspace-embed-configurator";
import { getWorkspaceOrThrow, resetWorkspaceStore } from "@/lib/workspaces";

describe("WorkspaceEmbedConfigurator", () => {
  const host = "https://admin.ezchat.test/";

  beforeEach(() => {
    resetWorkspaceStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  it("generates embed snippets with workspace metadata and theme overrides", async () => {
    const workspace = getWorkspaceOrThrow("ws_northwind_support");
    const user = userEvent.setup();

    render(<WorkspaceEmbedConfigurator workspace={workspace} host={host} />);

    await user.type(screen.getByLabelText(/primary color/i), "#3355ff");
    await user.type(screen.getByLabelText(/background color/i), "#f9fafb");
    await user.type(screen.getByLabelText(/border radius/i), "16px");

    const scriptSnippet = screen.getByTestId("script-snippet");
    const iframeSnippet = screen.getByTestId("iframe-snippet");

    expect(scriptSnippet.textContent).toContain("src=\"https://admin.ezchat.test/embed.js\"");
    expect(scriptSnippet.textContent).toContain("data-workspace-id=\"ws_northwind_support\"");
    expect(scriptSnippet.textContent).toContain('"primaryColor":"#3355ff"');
    expect(scriptSnippet.textContent).toContain('"backgroundColor":"#f9fafb"');

    expect(iframeSnippet.textContent).toContain(
      "src=\"https://admin.ezchat.test/embed/ws_northwind_support?theme=",
    );
    expect(iframeSnippet.textContent).toContain("border-radius: 16px");
  });

  it("enforces the publish guard and copies snippets after publishing", async () => {
    const workspace = getWorkspaceOrThrow("ws_northwind_support");
    const user = userEvent.setup();

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<WorkspaceEmbedConfigurator workspace={workspace} host={host} />);

    const copyScriptButton = screen.getByRole("button", { name: /copy script snippet/i });
    const publishToggle = screen.getByRole("switch", { name: /workspace publish status/i });

    expect(copyScriptButton).toBeDisabled();

    await user.click(publishToggle);

    await waitFor(() => expect(copyScriptButton).toBeEnabled());

    await user.click(copyScriptButton);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("data-workspace-id=\"ws_northwind_support\"");
    await waitFor(() =>
      expect(screen.getByText(/script snippet copied to clipboard/i)).toBeVisible(),
    );
  });
});

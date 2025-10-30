"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WorkspaceRecord, WorkspaceThemeOverrides } from "@/lib/workspaces";
import { setWorkspacePublished } from "@/lib/workspaces";

type WorkspaceEmbedConfiguratorProps = {
  workspace: WorkspaceRecord;
  host: string;
};

type ToastTone = "success" | "error";

type ToastState = {
  id: number;
  message: string;
  tone: ToastTone;
};

type SnippetKind = "Script snippet" | "Iframe snippet";

const TOAST_DURATION_MS = 2600;

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, "");
}

function sanitizeTheme(overrides: WorkspaceThemeOverrides): WorkspaceThemeOverrides {
  const result: WorkspaceThemeOverrides = {};

  const primary = overrides.primaryColor?.trim();
  if (primary) {
    result.primaryColor = primary;
  }

  const background = overrides.backgroundColor?.trim();
  if (background) {
    result.backgroundColor = background;
  }

  const radius = overrides.borderRadius?.trim();
  if (radius) {
    result.borderRadius = radius;
  }

  return result;
}

type GeneratedSnippets = {
  script: string;
  iframe: string;
};

function generateSnippets(
  host: string,
  workspaceId: string,
  sanitizedThemeOverrides: WorkspaceThemeOverrides,
): GeneratedSnippets {
  const normalizedHost = normalizeHost(host);
  const hasThemeOverrides = Object.keys(sanitizedThemeOverrides).length > 0;
  const themeJson = hasThemeOverrides ? JSON.stringify(sanitizedThemeOverrides) : "";
  const themeQuery = hasThemeOverrides ? `?theme=${encodeURIComponent(themeJson)}` : "";

  const scriptSnippet = `<script\n  src="${normalizedHost}/embed.js"\n  data-workspace-id="${workspaceId}"${hasThemeOverrides ? `\n  data-theme='${themeJson}'` : ""}\n  async\n></script>`;

  const iframeSnippet = `<iframe\n  src="${normalizedHost}/embed/${workspaceId}${themeQuery}"\n  title="EzChat widget"\n  loading="lazy"\n  referrerpolicy="strict-origin"\n  style="width: 100%; max-width: 420px; height: 600px; border: 0; border-radius: ${
    sanitizedThemeOverrides.borderRadius ?? "12px"
  };"\n></iframe>`;

  return { script: scriptSnippet, iframe: iframeSnippet };
}

export function WorkspaceEmbedConfigurator({ workspace, host }: WorkspaceEmbedConfiguratorProps) {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceRecord>(workspace);
  const [themeOverrides, setThemeOverrides] = useState<WorkspaceThemeOverrides>(
    workspace.themeOverrides ?? {},
  );
  const [isSavingPublishState, setIsSavingPublishState] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    setWorkspaceState(workspace);
    setThemeOverrides(workspace.themeOverrides ?? {});
  }, [workspace]);

  const sanitizedTheme = useMemo(() => sanitizeTheme(themeOverrides), [themeOverrides]);

  const snippets = useMemo(
    () => generateSnippets(host, workspaceState.id, sanitizedTheme),
    [host, workspaceState.id, sanitizedTheme],
  );

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const showToast = useCallback((message: string, tone: ToastTone) => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const handlePublishToggle = useCallback(async () => {
    setIsSavingPublishState(true);

    try {
      const nextWorkspace = await setWorkspacePublished(
        workspaceState.id,
        !workspaceState.isPublished,
      );

      setWorkspaceState(nextWorkspace);

      showToast(
        nextWorkspace.isPublished
          ? "Workspace published. Snippets are now shareable."
          : "Workspace unpublished. Copying snippets is disabled.",
        "success",
      );
    } catch (error) {
      console.error(error);
      showToast("Unable to update publish status. Try again.", "error");
    } finally {
      setIsSavingPublishState(false);
    }
  }, [workspaceState.id, workspaceState.isPublished, showToast]);

  const handleThemeChange = useCallback(
    (field: keyof WorkspaceThemeOverrides) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const { value } = event.target;

        setThemeOverrides((previous) => {
          const next = { ...previous };

          if (!value.trim()) {
            delete next[field];
          } else {
            next[field] = value;
          }

          return next;
        });
      },
    [],
  );

  const handleCopy = useCallback(
    async (snippet: string, snippetKind: SnippetKind) => {
      if (!workspaceState.isPublished) {
        showToast("Publish the workspace before copying snippets.", "error");
        return;
      }

      const clipboard = navigator.clipboard;

      if (!clipboard?.writeText) {
        showToast("Clipboard API not available. Copy manually instead.", "error");
        return;
      }

      try {
        await clipboard.writeText(snippet);
        showToast(`${snippetKind} copied to clipboard.`, "success");
      } catch (error) {
        console.error(error);
        showToast("Failed to copy snippet. Copy manually instead.", "error");
      }
    },
    [showToast, workspaceState.isPublished],
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Workspace embed setup
            </p>
            <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
              {workspaceState.name}
            </h1>
          </div>
          <dl className="space-y-1 text-sm text-muted-foreground">
            <div>
              <dt className="font-medium text-foreground">Workspace ID</dt>
              <dd>{workspaceState.id}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Environment host</dt>
              <dd>{normalizeHost(host)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1 text-sm font-medium",
              workspaceState.isPublished
                ? "bg-emerald-100 text-emerald-900"
                : "bg-amber-100 text-amber-900",
            )}
          >
            <span className="relative flex h-2 w-2 items-center justify-center">
              <span
                className={cn(
                  "absolute inline-flex h-2 w-2 rounded-full",
                  workspaceState.isPublished ? "bg-emerald-500" : "bg-amber-500",
                )}
              />
            </span>
            {workspaceState.isPublished ? "Published" : "Draft"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={workspaceState.isPublished}
            aria-label="Toggle workspace publish status"
            onClick={handlePublishToggle}
            disabled={isSavingPublishState}
            className={cn(
              "inline-flex h-10 w-16 items-center rounded-full border border-muted bg-muted p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              workspaceState.isPublished ? "bg-emerald-500/20" : "bg-muted",
              isSavingPublishState ? "cursor-not-allowed opacity-60" : "hover:shadow-sm",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-8 w-8 transform rounded-full bg-background shadow transition-transform",
                workspaceState.isPublished ? "translate-x-6" : "translate-x-0",
              )}
            />
            <span className="sr-only">
              {workspaceState.isPublished ? "Workspace is published" : "Workspace is not published"}
            </span>
          </button>
          <p className="max-w-xs text-xs text-muted-foreground">
            Publishing enables snippet copying and exposes the chatbot widget in embeddable contexts.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Theme overrides (optional)</CardTitle>
          <CardDescription>
            Adjust widget accents before copying snippets. Leave fields blank to use workspace defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-foreground">Primary color</span>
            <input
              type="text"
              autoComplete="off"
              value={themeOverrides.primaryColor ?? ""}
              onChange={handleThemeChange("primaryColor")}
              placeholder="#2663eb"
              className="rounded-md border border-muted bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-foreground">Background color</span>
            <input
              type="text"
              autoComplete="off"
              value={themeOverrides.backgroundColor ?? ""}
              onChange={handleThemeChange("backgroundColor")}
              placeholder="#ffffff"
              className="rounded-md border border-muted bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-foreground">Border radius</span>
            <input
              type="text"
              autoComplete="off"
              value={themeOverrides.borderRadius ?? ""}
              onChange={handleThemeChange("borderRadius")}
              placeholder="12px"
              className="rounded-md border border-muted bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embed snippets</CardTitle>
          <CardDescription>
            Use the script loader for full widget experiences or the iframe snippet for sandboxed deployments.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4 flex flex-col gap-6">
          <SnippetPreview
            title="Script loader"
            snippet={snippets.script}
            disabled={!workspaceState.isPublished}
            onCopy={() => handleCopy(snippets.script, "Script snippet")}
            testId="script-snippet"
          />
          <SnippetPreview
            title="Iframe embed"
            snippet={snippets.iframe}
            disabled={!workspaceState.isPublished}
            onCopy={() => handleCopy(snippets.iframe, "Iframe snippet")}
            testId="iframe-snippet"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embedding checklist</CardTitle>
          <CardDescription>
            Quick reference for sharing the EzChat workspace in customer-facing surfaces.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4 space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Review workspace settings and publish when the configuration is production ready.</li>
            <li>Choose the embed strategy that fits the host surface. The script loader injects the widget globally, while the iframe restricts it to a bounded region.</li>
            <li>Paste the snippet into your site or app, preferably in a staging environment first.</li>
            <li>Verify the widget matches your brand. Adjust theme overrides and re-copy snippets if needed.</li>
          </ol>
          <p>
            Need more? Detailed embedding instructions are available in the project README under
            <span className="font-medium text-foreground"> "Embedding the EzChat widget".</span>
          </p>
        </CardContent>
      </Card>

      {toast ? <Toast tone={toast.tone} message={toast.message} /> : null}
    </div>
  );
}

type SnippetPreviewProps = {
  title: string;
  snippet: string;
  disabled: boolean;
  onCopy: () => void;
  testId: string;
};

function SnippetPreview({ title, snippet, disabled, onCopy, testId }: SnippetPreviewProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {title === "Script loader"
              ? "Loads the EzChat widget once on page load and hydrates it automatically."
              : "Embeds the widget inside a sandboxed frame for portal or dashboard contexts."}
          </p>
        </div>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition",
            disabled ? "cursor-not-allowed opacity-50" : "hover:bg-foreground/90",
          )}
          onClick={onCopy}
          disabled={disabled}
        >
          {title === "Script loader" ? "Copy script snippet" : "Copy iframe snippet"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-md border border-muted bg-muted/60 px-4 py-3 text-sm text-foreground">
        <code data-testid={testId}>{snippet}</code>
      </pre>
    </section>
  );
}

type ToastProps = {
  tone: ToastTone;
  message: string;
};

function Toast({ tone, message }: ToastProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live="assertive"
      className={cn(
        "fixed bottom-6 right-6 w-full max-w-sm rounded-md px-4 py-3 text-sm font-medium shadow-lg sm:w-auto",
        tone === "error"
          ? "bg-destructive text-destructive-foreground"
          : "bg-emerald-500 text-white",
      )}
    >
      {message}
    </div>
  );
}

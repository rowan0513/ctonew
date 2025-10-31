"use client";

import { useTransition, useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { WorkspaceInput, WorkspaceRecord } from "@/lib/workspaces/schema";
import { supportedLanguages, workspaceToneOfVoiceOptions } from "@/lib/workspaces/schema";

const MAX_LOGO_SIZE = 1024 * 1024 * 2; // 2MB

const DEFAULT_WEBHOOK_RETRY_POLICY = {
  maxAttempts: 3,
  baseDelaySeconds: 30,
} as const;

const RETRY_LIMITS = {
  maxAttempts: { min: 1, max: 5 },
  baseDelaySeconds: { min: 1, max: 300 },
} as const;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type WorkspaceFormValues = WorkspaceInput;

type FieldErrors = Record<string, string | undefined>;

type WorkspaceFormMode = "create" | "edit";

export interface WorkspaceFormProps {
  mode: WorkspaceFormMode;
  workspaceId?: string;
  initialValues: WorkspaceFormValues;
  onSuccess?(workspace: WorkspaceRecord): void;
}

const languageLabels: Record<(typeof supportedLanguages)[number], string> = {
  en: "English",
  nl: "Dutch",
};

function isValidDataUrl(value: string | null | undefined): value is string {
  return Boolean(value && value.startsWith("data:"));
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

function toFormValues(workspace: WorkspaceRecord): WorkspaceFormValues {
  return {
    name: workspace.name,
    description: workspace.description,
    logo: workspace.logo ?? null,
    toneOfVoice: workspace.toneOfVoice,
    languages: [...workspace.languages],
    welcomeMessage: workspace.welcomeMessage,
    branding: {
      ...workspace.branding,
    },
    confidenceThreshold: workspace.confidenceThreshold,
    webhook: {
      ...workspace.webhook,
    },
  };
}

function normalizeValues(values: WorkspaceFormValues): WorkspaceFormValues {
  const retryPolicy = values.webhook?.retryPolicy ?? DEFAULT_WEBHOOK_RETRY_POLICY;

  const normalizedRetryPolicy = {
    maxAttempts: clampNumber(
      Math.round(Number.isFinite(Number(retryPolicy.maxAttempts)) ? Number(retryPolicy.maxAttempts) : 0) ||
        DEFAULT_WEBHOOK_RETRY_POLICY.maxAttempts,
      RETRY_LIMITS.maxAttempts.min,
      RETRY_LIMITS.maxAttempts.max,
    ),
    baseDelaySeconds: clampNumber(
      Math.round(Number.isFinite(Number(retryPolicy.baseDelaySeconds)) ? Number(retryPolicy.baseDelaySeconds) : 0) ||
        DEFAULT_WEBHOOK_RETRY_POLICY.baseDelaySeconds,
      RETRY_LIMITS.baseDelaySeconds.min,
      RETRY_LIMITS.baseDelaySeconds.max,
    ),
  } satisfies WorkspaceFormValues["webhook"]["retryPolicy"];

  return {
    ...values,
    logo: values.logo ? values.logo : null,
    languages: [...new Set(values.languages)].sort(),
    branding: {
      ...values.branding,
    },
    webhook: {
      enabled: Boolean(values.webhook.enabled),
      url: values.webhook.url?.trim() ?? "",
      secret: values.webhook.secret?.trim() ?? "",
      retryPolicy: normalizedRetryPolicy,
    },
  };
}

export function WorkspaceForm({ mode, workspaceId, initialValues, onSuccess }: WorkspaceFormProps) {
  const [values, setValues] = useState<WorkspaceFormValues>(() => normalizeValues(initialValues));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const confidencePercentage = useMemo(() => Math.round(values.confidenceThreshold * 100), [values.confidenceThreshold]);

  function updateValue<Key extends keyof WorkspaceFormValues>(key: Key, value: WorkspaceFormValues[Key]) {
    setValues((previous) => normalizeValues({
      ...previous,
      [key]: value,
    }));
  }

  async function handleLogoFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      setFieldErrors((errors) => ({ ...errors, logo: "Logo must be smaller than 2MB" }));
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      updateValue("logo", dataUrl);
      setFieldErrors((errors) => ({ ...errors, logo: undefined }));
    } catch (error) {
      console.error("Failed to read logo file", error);
      setFieldErrors((errors) => ({ ...errors, logo: "We could not read that image. Try another file." }));
    }
  }

  function handleLogoUrl(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value.trim();
    updateValue("logo", value ? value : null);
  }

  function toggleLanguage(language: (typeof supportedLanguages)[number]) {
    setValues((previous) => {
      const set = new Set(previous.languages);
      if (set.has(language)) {
        set.delete(language);
      } else {
        set.add(language);
      }

      const next = {
        ...previous,
        languages: [...set].sort(),
      } satisfies WorkspaceFormValues;

      return normalizeValues(next);
    });
  }

  function handleConfidenceChange(event: React.ChangeEvent<HTMLInputElement>) {
    const percentage = Number.parseInt(event.target.value, 10);
    const normalized = Number.isNaN(percentage) ? 0.5 : Math.min(Math.max(percentage, 0), 100) / 100;
    updateValue("confidenceThreshold", Number(normalized.toFixed(2)));
  }

  function handleWebhookEnabledChange(event: React.ChangeEvent<HTMLInputElement>) {
    updateValue("webhook", {
      ...values.webhook,
      enabled: event.target.checked,
    });
  }

  function handleRetryMaxAttemptsChange(event: React.ChangeEvent<HTMLInputElement>) {
    const parsed = Number.parseInt(event.target.value, 10);
    const nextValue = Number.isNaN(parsed) ? values.webhook.retryPolicy.maxAttempts : parsed;

    updateValue("webhook", {
      ...values.webhook,
      retryPolicy: {
        ...values.webhook.retryPolicy,
        maxAttempts: clampNumber(nextValue, RETRY_LIMITS.maxAttempts.min, RETRY_LIMITS.maxAttempts.max),
      },
    });
  }

  function handleRetryBaseDelayChange(event: React.ChangeEvent<HTMLInputElement>) {
    const parsed = Number.parseInt(event.target.value, 10);
    const nextValue = Number.isNaN(parsed) ? values.webhook.retryPolicy.baseDelaySeconds : parsed;

    updateValue("webhook", {
      ...values.webhook,
      retryPolicy: {
        ...values.webhook.retryPolicy,
        baseDelaySeconds: clampNumber(
          nextValue,
          RETRY_LIMITS.baseDelaySeconds.min,
          RETRY_LIMITS.baseDelaySeconds.max,
        ),
      },
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    startTransition(() => {
      void submitForm();
    });
  }

  async function submitForm() {
    setFormError(null);
    setFieldErrors({});

    const payload = normalizeValues(values);

    const endpoint = mode === "edit" && workspaceId ? `/api/workspaces/${workspaceId}` : "/api/workspaces";
    const method = mode === "edit" ? "PUT" : "POST";

    let response: Response;

    try {
      response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to submit workspace form", error);
      setFormError("We could not reach the server. Check your connection and try again.");
      return;
    }

    if (!response.ok) {
      if (response.status === 422) {
        const data = (await response.json().catch(() => ({}))) as {
          details?: Record<string, string>;
          error?: string;
        };
        setFieldErrors(data.details ?? {});
        setFormError(data.error ?? "Some fields need your attention.");
        return;
      }

      if (response.status === 401) {
        setFormError("Your session has expired. Please sign in again.");
        return;
      }

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setFormError(data.error ?? "Unable to save workspace. Please try again later.");
      return;
    }

    const data = (await response.json()) as { workspace: WorkspaceRecord };
    setValues(normalizeValues(toFormValues(data.workspace)));
    setFieldErrors({});
    setFormError(null);
    onSuccess?.(data.workspace);
  }

  const logoPreview = values.logo;

  return (
    <form onSubmit={handleSubmit} className="space-y-10" data-testid="workspace-form">
      <section className="grid gap-6 rounded-lg border border-muted bg-card p-6 shadow-sm lg:grid-cols-2">
        <div className="space-y-4">
          <Label htmlFor="name">Workspace name</Label>
          <Input
            id="name"
            name="name"
            value={values.name}
            placeholder="EzChat Customer Success"
            onChange={(event) => updateValue("name", event.target.value)}
            required
          />
          {fieldErrors.name ? <p className="text-sm text-destructive">{fieldErrors.name}</p> : null}
        </div>
        <div className="space-y-4">
          <Label htmlFor="tone-of-voice">Tone of voice</Label>
          <select
            id="tone-of-voice"
            name="tone-of-voice"
            className="focus-visible:ring-ring block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            value={values.toneOfVoice}
            onChange={(event) => updateValue("toneOfVoice", event.target.value as WorkspaceFormValues["toneOfVoice"])}
          >
            {workspaceToneOfVoiceOptions.map((tone) => (
              <option key={tone} value={tone}>
                {tone.charAt(0).toUpperCase() + tone.slice(1)}
              </option>
            ))}
          </select>
          {fieldErrors.toneOfVoice ? <p className="text-sm text-destructive">{fieldErrors.toneOfVoice}</p> : null}
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={values.description}
            placeholder="Describe the purpose of this workspace and its audience."
            onChange={(event) => updateValue("description", event.target.value)}
            required
          />
          {fieldErrors.description ? <p className="text-sm text-destructive">{fieldErrors.description}</p> : null}
        </div>
      </section>

      <section className="grid gap-6 rounded-lg border border-muted bg-card p-6 shadow-sm lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <Label>Logo</Label>
          <div className="space-y-3 rounded-md border border-dashed border-muted px-4 py-5 text-sm">
            <p className="text-muted-foreground">Upload a square image or provide a URL.</p>
            <Input type="file" accept="image/*" onChange={handleLogoFile} data-testid="logo-upload" />
            <Input
              placeholder="https://cdn.ezchat.io/logo.png"
              value={values.logo ?? ""}
              onChange={handleLogoUrl}
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateValue("logo", null)}
                className="text-xs"
              >
                Remove logo
              </Button>
              <span className="text-xs text-muted-foreground">Max 2MB • PNG, JPG, SVG</span>
            </div>
            {fieldErrors.logo ? <p className="text-sm text-destructive">{fieldErrors.logo}</p> : null}
          </div>
        </div>
        <div className="space-y-4">
          {logoPreview && (isValidDataUrl(logoPreview) || isHttpUrl(logoPreview)) ? (
            <div className="flex h-full w-full items-center justify-center rounded-md border border-muted bg-muted/30 p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoPreview}
                alt="Workspace logo preview"
                className="max-h-28 w-auto max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-muted bg-muted/20 p-6 text-sm text-muted-foreground">
              Logo preview will appear here
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 rounded-lg border border-muted bg-card p-6 shadow-sm lg:grid-cols-2">
        <div className="space-y-4">
          <Label>Languages</Label>
          <div className="flex flex-wrap gap-2">
            {supportedLanguages.map((language) => {
              const isActive = values.languages.includes(language);
              return (
                <button
                  key={language}
                  type="button"
                  onClick={() => toggleLanguage(language)}
                  className={"rounded-full px-3 py-1 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"}
                  data-active={isActive}
                  data-language={language}
                >
                  <span
                    className={
                      isActive
                        ? "bg-primary-500 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }
                    className={`inline-flex rounded-full px-3 py-1 ${
                      isActive
                        ? "bg-primary-500 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {languageLabels[language]}
                  </span>
                </button>
              );
            })}
          </div>
          {fieldErrors.languages ? <p className="text-sm text-destructive">{fieldErrors.languages}</p> : null}
        </div>
        <div className="space-y-4">
          <Label htmlFor="welcome">Welcome message</Label>
          <Textarea
            id="welcome"
            name="welcomeMessage"
            value={values.welcomeMessage}
            maxLength={280}
            onChange={(event) => updateValue("welcomeMessage", event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{values.welcomeMessage.length}/280 characters</p>
          {fieldErrors.welcomeMessage ? <p className="text-sm text-destructive">{fieldErrors.welcomeMessage}</p> : null}
        </div>
      </section>

      <section className="grid gap-6 rounded-lg border border-muted bg-card p-6 shadow-sm lg:grid-cols-3">
        <div className="space-y-4">
          <Label htmlFor="primary-color">Primary color</Label>
          <Input
            type="color"
            id="primary-color"
            value={values.branding.primary}
            onChange={(event) => updateValue("branding", { ...values.branding, primary: event.target.value })}
          />
          {fieldErrors["branding.primary"] ? (
            <p className="text-sm text-destructive">{fieldErrors["branding.primary"]}</p>
          ) : null}
        </div>
        <div className="space-y-4">
          <Label htmlFor="accent-color">Accent color</Label>
          <Input
            type="color"
            id="accent-color"
            value={values.branding.accent}
            onChange={(event) => updateValue("branding", { ...values.branding, accent: event.target.value })}
          />
          {fieldErrors["branding.accent"] ? (
            <p className="text-sm text-destructive">{fieldErrors["branding.accent"]}</p>
          ) : null}
        </div>
        <div className="space-y-4">
          <Label htmlFor="background-color">Background color</Label>
          <Input
            type="color"
            id="background-color"
            value={values.branding.background}
            onChange={(event) => updateValue("branding", { ...values.branding, background: event.target.value })}
          />
          {fieldErrors["branding.background"] ? (
            <p className="text-sm text-destructive">{fieldErrors["branding.background"]}</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 rounded-lg border border-muted bg-card p-6 shadow-sm lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-4">
          <Label htmlFor="confidence">Confidence threshold</Label>
          <input
            id="confidence"
            name="confidence"
            type="range"
            min={0}
            max={100}
            value={confidencePercentage}
            onChange={handleConfidenceChange}
            className="w-full"
          />
          <p className="text-sm text-muted-foreground">AI responses must meet {confidencePercentage}% confidence</p>
          {fieldErrors.confidenceThreshold ? (
            <p className="text-sm text-destructive">{fieldErrors.confidenceThreshold}</p>
          ) : null}
        </div>
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="webhook-enabled">Webhook notifications</Label>
              <p className="text-xs text-muted-foreground">
                Deliver signed POST requests when responses need human handover or a fallback model is invoked.
              </p>
            </div>
            <label
              htmlFor="webhook-enabled"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <input
                id="webhook-enabled"
                name="webhook.enabled"
                type="checkbox"
                checked={values.webhook.enabled}
                onChange={handleWebhookEnabledChange}
                className="h-4 w-4 accent-primary-500"
              />
              <span>{values.webhook.enabled ? "Enabled" : "Disabled"}</span>
            </label>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                name="webhook.url"
                value={values.webhook.url}
                onChange={(event) => updateValue("webhook", { ...values.webhook, url: event.target.value })}
                placeholder="https://hooks.ezchat.io/workspaces/customer-success"
              />
              {fieldErrors["webhook.url"] ? (
                <p className="text-sm text-destructive">{fieldErrors["webhook.url"]}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Webhook secret</Label>
              <Input
                id="webhook-secret"
                name="webhook.secret"
                value={values.webhook.secret}
                onChange={(event) => updateValue("webhook", { ...values.webhook, secret: event.target.value })}
                placeholder="Set the shared secret used to verify signatures"
              />
              {fieldErrors["webhook.secret"] ? (
                <p className="text-sm text-destructive">{fieldErrors["webhook.secret"]}</p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="webhook-retry-attempts">Retry attempts</Label>
                <Input
                  id="webhook-retry-attempts"
                  name="webhook.retryPolicy.maxAttempts"
                  type="number"
                  inputMode="numeric"
                  min={RETRY_LIMITS.maxAttempts.min}
                  max={RETRY_LIMITS.maxAttempts.max}
                  value={values.webhook.retryPolicy.maxAttempts}
                  onChange={handleRetryMaxAttemptsChange}
                />
                {fieldErrors["webhook.retryPolicy.maxAttempts"] ? (
                  <p className="text-sm text-destructive">{fieldErrors["webhook.retryPolicy.maxAttempts"]}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook-retry-delay">Base delay (seconds)</Label>
                <Input
                  id="webhook-retry-delay"
                  name="webhook.retryPolicy.baseDelaySeconds"
                  type="number"
                  inputMode="numeric"
                  min={RETRY_LIMITS.baseDelaySeconds.min}
                  max={RETRY_LIMITS.baseDelaySeconds.max}
                  value={values.webhook.retryPolicy.baseDelaySeconds}
                  onChange={handleRetryBaseDelayChange}
                />
                {fieldErrors["webhook.retryPolicy.baseDelaySeconds"] ? (
                  <p className="text-sm text-destructive">
                    {fieldErrors["webhook.retryPolicy.baseDelaySeconds"]}
                  </p>
                ) : null}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Deliveries retry with exponential backoff and include an <code>X-Ezchat-Signature</code> header for
              verification.
            </p>
          </div>
        </div>
      </section>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Changes are saved to EzChat immediately and recorded in the workspace audit log.
        </p>
        <Button type="submit" disabled={isPending} data-testid="workspace-submit">
          {isPending ? (mode === "create" ? "Creating…" : "Saving…") : mode === "create" ? "Create workspace" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export function workspaceToFormValues(workspace: WorkspaceRecord): WorkspaceFormValues {
  return toFormValues(workspace);
}

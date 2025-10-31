import { randomUUID } from "node:crypto";

import { maskSensitiveData } from "@/lib/chat/pii";
import type { ChatHistoryMessage } from "@/lib/chat/types";
import type { Citation } from "@/lib/retrieval/types";
import type { WorkspaceLanguage, WorkspaceRecord } from "@/lib/workspaces/schema";

import {
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  createWebhookSignature,
} from "./signature";

const MAX_LOGS_PER_WORKSPACE = 50;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_SECONDS = 30;

export type WebhookEventType = "chat.handover" | "webhook.test";

export type WebhookPayload = {
  id: string;
  event: WebhookEventType;
  workspaceId: string;
  workspaceName: string;
  triggeredAt: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type WebhookJob = {
  id: string;
  workspaceId: string;
  url: string;
  secret: string;
  payload: WebhookPayload;
  attempts: number;
  maxAttempts: number;
  baseDelaySeconds: number;
  nextAttemptAt: number;
  test: boolean;
};

export type WebhookDeliveryLogStatus = "delivered" | "retrying" | "failed" | "skipped";

export type WebhookDeliveryLog = {
  id: string;
  jobId?: string;
  workspaceId: string;
  event: WebhookEventType;
  createdAt: string;
  status: WebhookDeliveryLogStatus;
  attempt: number;
  maxAttempts: number;
  responseStatus?: number;
  error?: string;
  nextRetryAt?: string;
  test?: boolean;
  payload: WebhookPayload;
};

type WebhookStore = {
  jobs: WebhookJob[];
  deadLetter: WebhookJob[];
  logs: WebhookDeliveryLog[];
};

const globalWebhookStore = globalThis as typeof globalThis & {
  __ezchatWebhookStore?: WebhookStore;
};

function getWebhookStore(): WebhookStore {
  if (!globalWebhookStore.__ezchatWebhookStore) {
    globalWebhookStore.__ezchatWebhookStore = {
      jobs: [],
      deadLetter: [],
      logs: [],
    } satisfies WebhookStore;
  }

  return globalWebhookStore.__ezchatWebhookStore;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function stripSecret(job: WebhookJob): Omit<WebhookJob, "secret"> {
  const { secret: _secret, ...rest } = job;
  return structuredClone(rest);
}

function recordLog(store: WebhookStore, entry: WebhookDeliveryLog) {
  store.logs.unshift(entry);

  const perWorkspace = store.logs.filter((log) => log.workspaceId === entry.workspaceId);

  if (perWorkspace.length > MAX_LOGS_PER_WORKSPACE) {
    let prune = perWorkspace.length - MAX_LOGS_PER_WORKSPACE;

    store.logs = store.logs.filter((log) => {
      if (log.workspaceId !== entry.workspaceId) {
        return true;
      }

      if (prune > 0) {
        prune -= 1;
        return false;
      }

      return true;
    });
  }
}

function resolveRetryPolicy(workspace: WorkspaceRecord) {
  const policy = workspace.webhook?.retryPolicy;
  const rawMaxAttempts = Number(policy?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const rawBaseDelay = Number(policy?.baseDelaySeconds ?? DEFAULT_BASE_DELAY_SECONDS);

  return {
    maxAttempts: clamp(Math.round(Number.isFinite(rawMaxAttempts) ? rawMaxAttempts : DEFAULT_MAX_ATTEMPTS), 1, 5),
    baseDelaySeconds: clamp(
      Math.round(Number.isFinite(rawBaseDelay) ? rawBaseDelay : DEFAULT_BASE_DELAY_SECONDS),
      1,
      300,
    ),
  } satisfies Pick<WebhookJob, "maxAttempts" | "baseDelaySeconds">;
}

function buildPayload(input: {
  workspace: WorkspaceRecord;
  event: WebhookEventType;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  triggeredAt?: string;
}): WebhookPayload {
  return {
    id: randomUUID(),
    event: input.event,
    workspaceId: input.workspace.id,
    workspaceName: input.workspace.name,
    triggeredAt: input.triggeredAt ?? new Date().toISOString(),
    data: structuredClone(input.data),
    ...(input.metadata ? { metadata: structuredClone(input.metadata) } : {}),
  } satisfies WebhookPayload;
}

async function enqueueDelivery(input: {
  workspace: WorkspaceRecord;
  payload: WebhookPayload;
  test?: boolean;
}): Promise<void> {
  const { workspace, payload, test = false } = input;
  const store = getWebhookStore();

  const url = workspace.webhook?.url?.trim() ?? "";
  const secret = workspace.webhook?.secret?.trim() ?? "";
  const enabled = Boolean(workspace.webhook?.enabled);
  const retryPolicy = resolveRetryPolicy(workspace);
  const timestamp = new Date().toISOString();

  if (!enabled) {
    recordLog(store, {
      id: randomUUID(),
      workspaceId: workspace.id,
      event: payload.event,
      createdAt: timestamp,
      status: "skipped",
      attempt: 0,
      maxAttempts: retryPolicy.maxAttempts,
      error: "Webhook disabled",
      test,
      payload,
    });
    return;
  }

  if (!url || !secret) {
    recordLog(store, {
      id: randomUUID(),
      workspaceId: workspace.id,
      event: payload.event,
      createdAt: timestamp,
      status: "skipped",
      attempt: 0,
      maxAttempts: retryPolicy.maxAttempts,
      error: "Webhook configuration incomplete",
      test,
      payload,
    });
    return;
  }

  const job: WebhookJob = {
    id: randomUUID(),
    workspaceId: workspace.id,
    url,
    secret,
    payload,
    attempts: 0,
    maxAttempts: retryPolicy.maxAttempts,
    baseDelaySeconds: retryPolicy.baseDelaySeconds,
    nextAttemptAt: Date.now(),
    test,
  };

  store.jobs.push(job);
  store.jobs.sort((a, b) => a.nextAttemptAt - b.nextAttemptAt);

  await processWebhookQueue();
}

async function attemptDelivery(job: WebhookJob, store: WebhookStore, attemptTime: number): Promise<void> {
  job.attempts += 1;
  const attemptIso = new Date().toISOString();
  const payloadJson = JSON.stringify(job.payload);
  const signature = createWebhookSignature(payloadJson, job.secret, attemptIso);

  let responseStatus: number | undefined;
  let errorMessage: string | undefined;

  try {
    const response = await fetch(job.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [WEBHOOK_SIGNATURE_HEADER]: signature,
        [WEBHOOK_TIMESTAMP_HEADER]: attemptIso,
        [WEBHOOK_EVENT_HEADER]: job.payload.event,
      },
      body: payloadJson,
    });

    responseStatus = response.status;

    if (response.ok) {
      recordLog(store, {
        id: randomUUID(),
        jobId: job.id,
        workspaceId: job.workspaceId,
        event: job.payload.event,
        createdAt: attemptIso,
        status: "delivered",
        attempt: job.attempts,
        maxAttempts: job.maxAttempts,
        responseStatus,
        test: job.test,
        payload: job.payload,
      });
      return;
    }

    errorMessage = `HTTP ${response.status}`;
  } catch (error) {
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = "Unknown error";
    }
  }

  if (!errorMessage) {
    errorMessage = "Unknown delivery failure";
  }

  if (job.attempts >= job.maxAttempts) {
    recordLog(store, {
      id: randomUUID(),
      jobId: job.id,
      workspaceId: job.workspaceId,
      event: job.payload.event,
      createdAt: attemptIso,
      status: "failed",
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
      responseStatus,
      error: errorMessage,
      test: job.test,
      payload: job.payload,
    });
    store.deadLetter.unshift(structuredClone(job));
    return;
  }

  const delaySeconds = job.baseDelaySeconds * Math.pow(2, job.attempts - 1);
  job.nextAttemptAt = attemptTime + delaySeconds * 1000;

  recordLog(store, {
    id: randomUUID(),
    jobId: job.id,
    workspaceId: job.workspaceId,
    event: job.payload.event,
    createdAt: attemptIso,
    status: "retrying",
    attempt: job.attempts,
    maxAttempts: job.maxAttempts,
    responseStatus,
    error: errorMessage,
    nextRetryAt: new Date(job.nextAttemptAt).toISOString(),
    test: job.test,
    payload: job.payload,
  });

  store.jobs.push(job);
  store.jobs.sort((a, b) => a.nextAttemptAt - b.nextAttemptAt);
}

export async function processWebhookQueue(now: number = Date.now()): Promise<void> {
  const store = getWebhookStore();

  const dueJobs = store.jobs
    .filter((job) => job.nextAttemptAt <= now)
    .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt);

  store.jobs = store.jobs.filter((job) => job.nextAttemptAt > now);

  for (const job of dueJobs) {
    await attemptDelivery(job, store, now);
  }
}

export async function enqueueChatWebhook(input: {
  workspace: WorkspaceRecord;
  question: string;
  answer: string;
  history: ChatHistoryMessage[];
  citations: Citation[];
  confidence: number;
  handover: boolean;
  fallbackUsed: boolean;
  language: WorkspaceLanguage;
  model?: string;
}): Promise<void> {
  const {
    workspace,
    question,
    answer,
    history,
    citations,
    confidence,
    handover,
    fallbackUsed,
    language,
    model,
  } = input;

  const payload = buildPayload({
    workspace,
    event: "chat.handover",
    data: {
      question,
      maskedQuestion: maskSensitiveData(question),
      answer,
      maskedAnswer: maskSensitiveData(answer),
      confidence: Number(confidence.toFixed(3)),
      handover,
      fallbackUsed,
      language,
      model,
      citations: structuredClone(citations),
      history: history.map((message) => ({
        role: message.role,
        content: message.content,
        maskedContent: maskSensitiveData(message.content),
      })),
      reasons: {
        lowConfidence: Boolean(handover),
        fallbackModel: Boolean(fallbackUsed),
      },
    },
  });

  await enqueueDelivery({ workspace, payload, test: false });
}

export async function enqueueTestWebhook(workspace: WorkspaceRecord): Promise<void> {
  const nowIso = new Date().toISOString();

  const payload = buildPayload({
    workspace,
    event: "webhook.test",
    data: {
      message: "This is a test webhook from EzChat Admin.",
      performedAt: nowIso,
    },
    metadata: {
      source: "admin-test",
    },
    triggeredAt: nowIso,
  });

  await enqueueDelivery({ workspace, payload, test: true });
}

export function getWebhookDeliveryLogs(workspaceId: string, limit = 25): WebhookDeliveryLog[] {
  const store = getWebhookStore();
  return store.logs
    .filter((log) => log.workspaceId === workspaceId)
    .slice(0, limit)
    .map((log) => structuredClone(log));
}

export function getWebhookQueueState(): {
  pending: Array<Omit<WebhookJob, "secret">>;
  deadLetter: Array<Omit<WebhookJob, "secret">>;
} {
  const store = getWebhookStore();

  return {
    pending: store.jobs.map(stripSecret),
    deadLetter: store.deadLetter.map(stripSecret),
  };
}

export function resetWebhookStore(): void {
  globalWebhookStore.__ezchatWebhookStore = {
    jobs: [],
    deadLetter: [],
    logs: [],
  } satisfies WebhookStore;
}

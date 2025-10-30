import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { getAnalyticsOverview, parseAnalyticsFilters } from "@/lib/analytics/service";
import type { AnalyticsEnvironment, TimeSeriesInterval } from "@/lib/analytics/types";
import { listWorkspaces } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

type SearchParams = {
  workspace?: string;
  range?: string;
  interval?: string;
  environment?: string | string[];
};

type RangeOption = "7d" | "30d" | "90d";

type EnvironmentOption = AnalyticsEnvironment;

const DEFAULT_RANGE: RangeOption = "30d";
const DEFAULT_INTERVAL: TimeSeriesInterval = "daily";
const DEFAULT_ENVIRONMENTS: EnvironmentOption[] = ["production", "preview", "test"];

function normalizeRange(range?: string): RangeOption {
  if (range === "7d" || range === "30d" || range === "90d") {
    return range;
  }

  return DEFAULT_RANGE;
}

function normalizeInterval(interval?: string): TimeSeriesInterval {
  if (interval === "daily" || interval === "weekly") {
    return interval;
  }

  return DEFAULT_INTERVAL;
}

function calculateDateRange(range: RangeOption): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();

  if (range === "7d") {
    start.setDate(end.getDate() - 6);
  } else if (range === "30d") {
    start.setDate(end.getDate() - 29);
  } else {
    start.setDate(end.getDate() - 89);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

function normalizeEnvironments(value?: string | string[]): EnvironmentOption[] {
  if (!value) {
    return DEFAULT_ENVIRONMENTS;
  }

  const values = Array.isArray(value) ? value : value.split(",");
  const filtered = values
    .map((item) => item.trim())
    .filter((item): item is EnvironmentOption =>
      item === "production" || item === "preview" || item === "test",
    );

  return filtered.length > 0 ? filtered : DEFAULT_ENVIRONMENTS;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const workspaces = await listWorkspaces();

  if (workspaces.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-semibold text-foreground">Analytics dashboard</h1>
        <p className="text-muted-foreground">
          No workspaces are available yet. Seed the database or connect your production
          workspace to view analytics.
        </p>
      </div>
    );
  }

  const range = normalizeRange(searchParams?.range);
  const intervalParam = searchParams?.interval;
  const interval = intervalParam
    ? normalizeInterval(intervalParam)
    : range === "90d"
      ? "weekly"
      : DEFAULT_INTERVAL;
  const environments = normalizeEnvironments(searchParams?.environment);

  const { startDate, endDate } = calculateDateRange(range);

  const workspaceToken = searchParams?.workspace;
  const selectedWorkspace = workspaceToken
    ? workspaces.find((workspace) => workspace.id === workspaceToken || workspace.slug === workspaceToken) ??
      workspaces[0]
    : workspaces[0];

  const filters = parseAnalyticsFilters({
    workspaceId: selectedWorkspace.id,
    startDate,
    endDate,
    interval,
    environments,
  });

  const { summary, timeSeries } = await getAnalyticsOverview(filters);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10">
      <AnalyticsDashboard
        initialFilters={{
          workspaceId: filters.workspaceId,
          range,
          interval: filters.interval,
          environments: filters.environments,
          startDate: filters.startDate.toISOString(),
          endDate: filters.endDate.toISOString(),
        }}
        summary={summary}
        timeSeries={timeSeries}
        timezone={selectedWorkspace.timezone}
        workspaces={workspaces}
      />
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Card,
  CardActions,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { SummaryMetrics, TimeSeriesPoint } from '@/lib/analytics/types';

const RANGE_OPTIONS = [
  { label: 'Last 7 days', value: '7d' as const },
  { label: 'Last 30 days', value: '30d' as const },
  { label: 'Last 90 days', value: '90d' as const },
];

const ENVIRONMENT_LABELS: Record<EnvironmentOption, string> = {
  production: 'Production',
  preview: 'Preview',
  test: 'Test',
};

type EnvironmentOption = 'production' | 'preview' | 'test';
type RangeOption = '7d' | '30d' | '90d';

type IntervalOption = 'daily' | 'weekly';

type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
};

type FilterState = {
  workspaceId: string;
  range: RangeOption;
  interval: IntervalOption;
  environments: EnvironmentOption[];
  startDate: string;
  endDate: string;
};

type AnalyticsDashboardProps = {
  summary: SummaryMetrics;
  timeSeries: TimeSeriesPoint[];
  initialFilters: FilterState;
  workspaces: WorkspaceOption[];
  timezone: string;
};

type ChartDatum = {
  bucket: string;
  label: string;
  production: number;
  preview: number;
  test: number;
  total: number;
};

type FetchResult = {
  summary: SummaryMetrics;
  timeSeries: TimeSeriesPoint[];
};

const DEFAULT_ENVIRONMENTS: EnvironmentOption[] = ['production', 'preview', 'test'];

function calculateDateRange(range: RangeOption): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();

  if (range === '7d') {
    start.setDate(end.getDate() - 6);
  } else if (range === '30d') {
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

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatConfidence(value: number | null): string {
  if (value === null) {
    return '—';
  }

  return `${Math.round(value * 100)}%`;
}

function ensureEnvironments(selected: EnvironmentOption[]): EnvironmentOption[] {
  if (selected.length === 0) {
    return DEFAULT_ENVIRONMENTS;
  }

  return selected;
}

export function AnalyticsDashboard({
  summary: initialSummary,
  timeSeries: initialTimeSeries,
  initialFilters,
  workspaces,
  timezone,
}: AnalyticsDashboardProps) {
  const [summary, setSummary] = useState<SummaryMetrics>(initialSummary);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>(initialTimeSeries);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialRender = useRef(true);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === filters.workspaceId) ?? workspaces[0],
    [filters.workspaceId, workspaces],
  );

  const chartData: ChartDatum[] = useMemo(
    () =>
      timeSeries.map((point) => ({
        bucket: point.bucket,
        label: point.label,
        production: point.productionMessages,
        preview: point.previewMessages,
        test: point.testMessages,
        total: point.totalMessages,
      })),
    [timeSeries],
  );

  const fetchAnalytics = useCallback(
    async (nextFilters: FilterState): Promise<FetchResult> => {
      const params = new URLSearchParams({
        workspaceId: nextFilters.workspaceId,
        startDate: nextFilters.startDate,
        endDate: nextFilters.endDate,
        interval: nextFilters.interval,
      });

      nextFilters.environments.forEach((environment) => params.append('environment', environment));

      const summaryResponse = fetch(`/api/analytics/summary?${params.toString()}`, {
        cache: 'no-store',
      });
      const timeSeriesResponse = fetch(`/api/analytics/timeseries?${params.toString()}`, {
        cache: 'no-store',
      });

      const [summaryResult, timeSeriesResult] = await Promise.all([summaryResponse, timeSeriesResponse]);

      if (!summaryResult.ok) {
        const message = await summaryResult.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(message.error ?? 'Unable to fetch summary');
      }

      if (!timeSeriesResult.ok) {
        const message = await timeSeriesResult.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(message.error ?? 'Unable to fetch time series');
      }

      const summaryData = await summaryResult.json();
      const timeSeriesData = await timeSeriesResult.json();

      return {
        summary: summaryData.summary as SummaryMetrics,
        timeSeries: timeSeriesData.timeSeries as TimeSeriesPoint[],
      };
    },
    [],
  );

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchAnalytics(filters);
        if (!cancelled) {
          setSummary(result.summary);
          setTimeSeries(result.timeSeries);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load analytics');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [fetchAnalytics, filters]);

  const updateFilters = useCallback(
    (updater: (current: FilterState) => FilterState) => {
      setFilters((current) => {
        const next = updater(current);
        return {
          ...next,
          environments: ensureEnvironments(next.environments),
        };
      });
    },
    [],
  );

  const handleWorkspaceChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const workspaceId = event.target.value;
      updateFilters((current) => ({ ...current, workspaceId }));
    },
    [updateFilters],
  );

  const handleRangeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const range = event.target.value as RangeOption;
      const { startDate, endDate } = calculateDateRange(range);

      updateFilters((current) => ({
        ...current,
        range,
        startDate,
        endDate,
      }));
    },
    [updateFilters],
  );

  const handleIntervalChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const interval = event.target.value as IntervalOption;
      updateFilters((current) => ({ ...current, interval }));
    },
    [updateFilters],
  );

  const handleEnvironmentToggle = useCallback(
    (environment: EnvironmentOption) => {
      updateFilters((current) => {
        const exists = current.environments.includes(environment);
        if (exists && current.environments.length === 1) {
          return current;
        }

        return {
          ...current,
          environments: exists
            ? current.environments.filter((value) => value !== environment)
            : [...current.environments, environment],
        };
      });
    },
    [updateFilters],
  );

  const handleExport = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        workspaceId: filters.workspaceId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        interval: filters.interval,
      });

      filters.environments.forEach((environment) => params.append('environment', environment));

      const response = await fetch(`/api/analytics/export?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to export analytics');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-${selectedWorkspace?.slug ?? 'workspace'}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export analytics');
    }
  }, [filters, selectedWorkspace]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-foreground">Analytics dashboard</h1>
        <p className="text-muted-foreground">
          Monitor chatbot health, confidence trends, and feedback signals across environments.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Select workspace, timeframe, and environments to refine the analytics view.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Workspace</span>
            <select
              aria-label="Workspace"
              className="rounded-md border border-muted bg-background px-3 py-2 text-sm"
              onChange={handleWorkspaceChange}
              value={filters.workspaceId}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Date range</span>
            <select
              aria-label="Date range"
              className="rounded-md border border-muted bg-background px-3 py-2 text-sm"
              onChange={handleRangeChange}
              value={filters.range}
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Interval</span>
            <select
              aria-label="Interval"
              className="rounded-md border border-muted bg-background px-3 py-2 text-sm"
              onChange={handleIntervalChange}
              value={filters.interval}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>

          <div className="flex flex-col gap-2 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Environments</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ENVIRONMENT_LABELS) as EnvironmentOption[]).map((environment) => {
                const checked = filters.environments.includes(environment);
                return (
                  <button
                    key={environment}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      checked
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted text-muted-foreground hover:border-primary hover:text-foreground'
                    }`}
                    onClick={() => handleEnvironmentToggle(environment)}
                  >
                    {ENVIRONMENT_LABELS[environment]}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
        <CardActions>
          <button
            className="rounded-full border border-muted px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
            onClick={handleExport}
            type="button"
          >
            Export CSV
          </button>
          {isLoading ? <span className="text-sm text-muted-foreground">Loading…</span> : null}
          {error ? (
            <span className="text-sm text-destructive" role="alert">
              {error}
            </span>
          ) : null}
        </CardActions>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-1" data-testid="total-chats-card">
          <CardHeader>
            <CardTitle>Total chats</CardTitle>
            <CardDescription>Unique conversations in the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground" data-testid="total-chats-value">
              {summary.totalChats}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1" data-testid="total-messages-card">
          <CardHeader>
            <CardTitle>Total messages</CardTitle>
            <CardDescription>Message volume processed by the assistant.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground" data-testid="total-messages-value">
              {summary.totalMessages}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1" data-testid="confidence-card">
          <CardHeader>
            <CardTitle>Average confidence</CardTitle>
            <CardDescription>Mean model confidence across responses.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground" data-testid="average-confidence-value">
              {formatConfidence(summary.averageConfidence)}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1" data-testid="feedback-card">
          <CardHeader>
            <CardTitle>Thumbs-up ratio</CardTitle>
            <CardDescription>Positive feedback vs. total feedback.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground" data-testid="thumbs-ratio-value">
              {formatPercent(summary.thumbsUpRatio)}
            </p>
            <p className="text-sm text-muted-foreground">
              {summary.thumbsUp} 👍 / {summary.thumbsDown} 👎
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1" data-testid="fallback-card">
          <CardHeader>
            <CardTitle>Fallback ratio</CardTitle>
            <CardDescription>Messages that required fallback handling.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground" data-testid="fallback-ratio-value">
              {formatPercent(summary.fallbackRatio)}
            </p>
            <p className="text-sm text-muted-foreground">{summary.fallbackCount} fallbacks</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message volume trend</CardTitle>
          <CardDescription>
            Volume of chatbot responses over time ({filters.interval}) in {timezone} timezone.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80 w-full">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No analytics events found for the selected filters.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                <defs>
                  <linearGradient id="colorProduction" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorPreview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorTest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--muted))',
                    borderRadius: '0.5rem',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="production"
                  name="Production"
                  stroke="hsl(var(--primary))"
                  fill="url(#colorProduction)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="preview"
                  name="Preview"
                  stroke="hsl(var(--secondary))"
                  fill="url(#colorPreview)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="test"
                  name="Test"
                  stroke="hsl(var(--destructive))"
                  fill="url(#colorTest)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment breakdown</CardTitle>
          <CardDescription>How message traffic differs by environment.</CardDescription>
        </CardHeader>
        <CardContent className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="environment-table">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Environment</th>
                <th className="py-2 pr-4 font-medium">Messages</th>
                <th className="py-2 pr-4 font-medium">Chats</th>
              </tr>
            </thead>
            <tbody>
              {(summary.environmentBreakdown.length > 0
                ? summary.environmentBreakdown
                : DEFAULT_ENVIRONMENTS.map((environment) => ({
                    environment,
                    messages: 0,
                    chats: 0,
                  })))
                .map((breakdown) => (
                  <tr key={breakdown.environment}>
                    <td className="py-2 pr-4 text-foreground">{ENVIRONMENT_LABELS[breakdown.environment]}</td>
                    <td className="py-2 pr-4 text-foreground">{breakdown.messages}</td>
                    <td className="py-2 pr-4 text-foreground">{breakdown.chats}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

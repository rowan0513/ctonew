import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import type { SummaryMetrics, TimeSeriesPoint } from "@/lib/analytics/types";

vi.mock("recharts", () => {
  const MockChart = ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-chart">{children}</div>
  );

  return {
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div data-testid="mock-responsive">{children}</div>
    ),
    AreaChart: MockChart,
    Area: () => <div data-testid="mock-area" />,
    CartesianGrid: () => <div data-testid="mock-grid" />,
    XAxis: () => <div data-testid="mock-xaxis" />,
    YAxis: () => <div data-testid="mock-yaxis" />,
    Tooltip: () => <div data-testid="mock-tooltip" />,
    Legend: () => <div data-testid="mock-legend" />,
  };
});

const summaryFixture: SummaryMetrics = {
  totalChats: 12,
  totalMessages: 54,
  thumbsUp: 18,
  thumbsDown: 6,
  thumbsUpRatio: 0.75,
  averageConfidence: 0.68,
  fallbackCount: 5,
  fallbackRatio: 5 / 54,
  environmentBreakdown: [
    { environment: "production", chats: 8, messages: 40 },
    { environment: "preview", chats: 3, messages: 10 },
    { environment: "test", chats: 1, messages: 4 },
  ],
};

const timeSeriesFixture: TimeSeriesPoint[] = [
  {
    bucket: "2024-04-01T00:00:00.000Z",
    label: "Apr 1",
    totalMessages: 20,
    productionMessages: 15,
    previewMessages: 3,
    testMessages: 2,
  },
  {
    bucket: "2024-04-02T00:00:00.000Z",
    label: "Apr 2",
    totalMessages: 34,
    productionMessages: 25,
    previewMessages: 7,
    testMessages: 2,
  },
];

describe("AnalyticsDashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderComponent = (overrides?: Partial<{ summary: SummaryMetrics; timeSeries: TimeSeriesPoint[] }>) => {
    render(
      <AnalyticsDashboard
        initialFilters={{
          workspaceId: "workspace-1",
          range: "30d",
          interval: "daily",
          environments: ["production", "preview", "test"],
          startDate: "2024-03-03T00:00:00.000Z",
          endDate: "2024-04-01T23:59:59.999Z",
        }}
        summary={overrides?.summary ?? summaryFixture}
        timeSeries={overrides?.timeSeries ?? timeSeriesFixture}
        timezone="America/New_York"
        workspaces={[
          { id: "workspace-1", name: "Demo Workspace", slug: "demo-workspace", timezone: "America/New_York" },
          { id: "workspace-2", name: "QA", slug: "qa", timezone: "UTC" },
        ]}
      />,
    );
  };

  it("renders summary metrics and environment breakdown", () => {
    renderComponent();

    expect(screen.getByTestId("total-chats-value")).toHaveTextContent("12");
    expect(screen.getByTestId("total-messages-value")).toHaveTextContent("54");
    expect(screen.getByTestId("average-confidence-value")).toHaveTextContent("68%");
    expect(screen.getByTestId("thumbs-ratio-value")).toHaveTextContent("75%");
    expect(screen.getByTestId("fallback-ratio-value")).toHaveTextContent(
      `${Math.round(summaryFixture.fallbackRatio * 100)}%`,
    );

    const table = screen.getByTestId("environment-table");
    expect(table).toHaveTextContent("Production");
    expect(table).toHaveTextContent("Preview");
    expect(table).toHaveTextContent("Test");
  });

  it("requests new analytics when the date range changes", async () => {
    const updatedSummary: SummaryMetrics = {
      ...summaryFixture,
      totalMessages: 100,
      totalChats: 20,
    };

    const updatedSeries: TimeSeriesPoint[] = [
      {
        bucket: "2024-04-05T00:00:00.000Z",
        label: "Apr 5",
        totalMessages: 100,
        productionMessages: 70,
        previewMessages: 20,
        testMessages: 10,
      },
    ];

    const fetchMock = vi.fn((url: RequestInfo) => {
      const href = typeof url === "string" ? url : url.url;
      if (href.includes("summary")) {
        return Promise.resolve({ ok: true, json: async () => ({ summary: updatedSummary }) });
      }

      return Promise.resolve({ ok: true, json: async () => ({ timeSeries: updatedSeries }) });
    });

    vi.stubGlobal("fetch", fetchMock);

    renderComponent();

    const rangeSelect = screen.getByLabelText("Date range");
    fireEvent.change(rangeSelect, { target: { value: "7d" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByTestId("total-messages-value")).toHaveTextContent("100");
    });

    const chart = screen.getByTestId("mock-responsive");
    expect(chart).toBeInTheDocument();
  });
});

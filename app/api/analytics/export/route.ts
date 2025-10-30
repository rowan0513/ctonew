import { NextResponse } from "next/server";

import { getAnalyticsOverview, parseAnalyticsFilters } from "@/lib/analytics/service";
import { getWorkspaceById } from "@/lib/workspaces";

function parseEnvironmentParams(searchParams: URLSearchParams): string[] | undefined {
  const envParams = searchParams.getAll("environment").filter(Boolean);
  if (envParams.length > 0) {
    return envParams;
  }

  const combined = searchParams.get("environments");
  if (combined) {
    return combined
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return undefined;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const workspaceId = searchParams.get("workspaceId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!workspaceId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "workspaceId, startDate, and endDate are required" },
        { status: 400 },
      );
    }

    const interval = searchParams.get("interval") ?? undefined;
    const environments = parseEnvironmentParams(searchParams);

    const filters = parseAnalyticsFilters({
      workspaceId,
      startDate,
      endDate,
      interval,
      environments,
    });

    const workspace = await getWorkspaceById(filters.workspaceId);

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { summary, timeSeries } = await getAnalyticsOverview(filters);

    const summaryLines = ["metric,value"];

    summaryLines.push(`total_chats,${summary.totalChats}`);
    summaryLines.push(`total_messages,${summary.totalMessages}`);
    summaryLines.push(`thumbs_up,${summary.thumbsUp}`);
    summaryLines.push(`thumbs_down,${summary.thumbsDown}`);
    summaryLines.push(`thumbs_up_ratio,${summary.thumbsUpRatio.toFixed(4)}`);
    summaryLines.push(
      `average_confidence,${summary.averageConfidence !== null ? summary.averageConfidence.toFixed(4) : ""}`,
    );
    summaryLines.push(`fallback_count,${summary.fallbackCount}`);
    summaryLines.push(`fallback_ratio,${summary.fallbackRatio.toFixed(4)}`);

    for (const breakdown of summary.environmentBreakdown) {
      summaryLines.push(
        `environment_${breakdown.environment}_messages,${breakdown.messages}`,
      );
      summaryLines.push(`environment_${breakdown.environment}_chats,${breakdown.chats}`);
    }

    const chartLines = [""];
    chartLines.push(
      [
        "date",
        "total_messages",
        "production_messages",
        "preview_messages",
        "test_messages",
      ].join(","),
    );

    for (const point of timeSeries) {
      chartLines.push(
        [
          point.bucket,
          point.totalMessages,
          point.productionMessages,
          point.previewMessages,
          point.testMessages,
        ].join(","),
      );
    }

    const csv = [...summaryLines, ...chartLines].join("\n");

    const fileName = `analytics_${workspace.slug}_${filters.interval}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to generate analytics export", error);

    if (error instanceof Error && error.message.startsWith("Invalid analytics filters")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to export analytics" }, { status: 500 });
  }
}

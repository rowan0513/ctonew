import { NextResponse } from "next/server";

import { parseAnalyticsFilters, getAnalyticsSummary } from "@/lib/analytics/service";

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

    const summary = await getAnalyticsSummary(filters);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Failed to fetch analytics summary", error);

    if (error instanceof Error && error.message.startsWith("Invalid analytics filters")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to fetch analytics summary" }, { status: 500 });
  }
}

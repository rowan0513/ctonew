import { NextResponse } from "next/server";

import { analyticsEventSchema } from "@/lib/analytics/schema";
import { insertAnalyticsEvent } from "@/lib/analytics/repository";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = analyticsEventSchema.safeParse(payload);

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const readable = Object.entries(errors)
        .map(([field, messages]) => `${field}: ${(messages ?? []).join(", ")}`)
        .join("; ");

      return NextResponse.json({ error: readable }, { status: 400 });
    }

    const event = await insertAnalyticsEvent(parsed.data);

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Failed to insert analytics event", error);
    return NextResponse.json({ error: "Failed to persist analytics event" }, { status: 500 });
  }
}

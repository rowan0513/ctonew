import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Card, CardActions, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

describe("Card", () => {
  it("renders compound card content", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Session overview</CardTitle>
          <CardDescription>Monitor the latest EzChat escalations.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Active escalations: 3</p>
        </CardContent>
        <CardActions>
          <button type="button">Resolve</button>
        </CardActions>
      </Card>,
    );

    expect(screen.getByText(/session overview/i)).toBeVisible();
    expect(screen.getByText(/latest ezchat escalations/i)).toBeVisible();
    expect(screen.getByText(/active escalations/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /resolve/i })).toBeEnabled();
  });
});

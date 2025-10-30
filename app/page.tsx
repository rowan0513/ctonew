import Link from "next/link";

import {
  Card,
  CardActions,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    name: "Conversations at a glance",
    description:
      "Monitor live chat streams, flag outliers, and drill into customer sentiment without losing context.",
  },
  {
    name: "Automations you can trust",
    description:
      "Safely roll out routing, escalation, and AI assistant updates with environment-locked change controls.",
  },
  {
    name: "Operations-ready analytics",
    description:
      "Measure agent performance, SLAs, and channel health with dashboards tailored for success teams.",
  },
];

const quickLinks = [
  {
    label: "Platform Status",
    href: "https://status.ezchat.io",
  },
  {
    label: "Product Updates",
    href: "https://updates.ezchat.io",
  },
  {
    label: "Developer Docs",
    href: "https://developers.ezchat.io",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-16 px-6 py-20 sm:px-10">
        <section className="grid gap-14 sm:grid-cols-[1.1fr_0.9fr] sm:gap-10">
          <div className="relative flex flex-col gap-8">
            <span className="w-fit rounded-full bg-accent px-4 py-1 text-sm font-medium text-accent-foreground shadow-sm">
              EzChat Admin Platform
            </span>
            <div className="space-y-6">
              <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
                Control center for human and AI powered conversations.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Bootstrapped with Next.js 14, Tailwind CSS, Vitest, and a typed environment
                layer—ready for the EzChat team to ship admin capabilities with confidence.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                className="bg-primary inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                href="https://developers.ezchat.io/getting-started"
                target="_blank"
                rel="noreferrer"
              >
                Explore the docs
              </Link>
              <Link
                className="hover:border-primary hover:text-primary inline-flex items-center justify-center rounded-full border border-muted px-6 py-3 text-sm font-semibold text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                href="mailto:team@ezchat.io"
              >
                Contact the team
              </Link>
            </div>
          </div>

          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle>Operational insights</CardTitle>
              <CardDescription>
                Stay ahead of surges, automate escalations, and align support operations with
                business goals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid w-full gap-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Active conversations</dt>
                  <dd className="text-3xl font-semibold text-foreground">128</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">AI resolution rate</dt>
                  <dd className="text-3xl font-semibold text-secondary">92%</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Average response time</dt>
                  <dd className="text-3xl font-semibold text-foreground">47s</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Escalation queue</dt>
                  <dd className="text-3xl font-semibold text-destructive">3</dd>
                </div>
              </dl>
            </CardContent>
            <CardActions>
              <Link
                className="inline-flex items-center rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                href="/dashboard"
              >
                Go to dashboard →
              </Link>
            </CardActions>
          </Card>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>What’s inside</CardTitle>
              <CardDescription>
                Built with a scalable architecture that marries operational rigor with a modern
                developer experience.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="rounded-lg border border-muted bg-background/60 p-4"
                >
                  <h3 className="text-lg font-semibold text-foreground">{feature.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick links</CardTitle>
              <CardDescription>
                Resources the EzChat admin and engineering teams use to keep everyone aligned.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {quickLinks.map((link) => (
                <Link
                  key={link.label}
                  className="hover:border-primary hover:text-primary flex items-center justify-between rounded-lg border border-muted px-4 py-3 text-sm font-medium text-foreground transition"
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.label}
                  <span aria-hidden className="text-lg">
                    →
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

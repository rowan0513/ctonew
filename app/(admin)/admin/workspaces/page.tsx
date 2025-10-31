import { WorkspacesList } from "@/components/workspaces/workspaces-list";
import { listWorkspaces } from "@/lib/workspaces/store";

export default async function WorkspacesPage() {
  const workspaces = listWorkspaces();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Workspaces</h1>
        <p className="text-sm text-muted-foreground">
          Provide personalised AI experiences across every workspace. Configure branding, languages, routing, and
          webhooks in one place.
        </p>
      </header>

      <WorkspacesList initialWorkspaces={workspaces} />
    </div>
  );
}

import { notFound } from "next/navigation";

import { WorkspaceEmbedConfigurator } from "@/components/workspaces/workspace-embed-configurator";
import { publicEnv } from "@/env.mjs";
import { findWorkspace } from "@/lib/workspaces";

type WorkspaceEmbedPageProps = {
  params: {
    workspaceId: string;
  };
};

export default function WorkspaceEmbedPage({ params }: WorkspaceEmbedPageProps) {
  const workspace = findWorkspace(params.workspaceId);

  if (!workspace) {
    notFound();
  }

  return (
    <div className="flex min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-12">
        <WorkspaceEmbedConfigurator
          workspace={workspace}
          host={publicEnv.NEXT_PUBLIC_APP_URL}
        />
      </main>
    </div>
  );
}

import { notFound } from "next/navigation";

import { WorkspaceDetail } from "@/components/workspaces/workspace-detail";
import { getWorkspaceAuditLog } from "@/lib/audit-log";
import { getWorkspaceById } from "@/lib/workspaces/store";

interface WorkspacePageProps {
  params: {
    workspaceId: string;
  };
}

export default function WorkspaceDetailPage({ params }: WorkspacePageProps) {
  const workspace = getWorkspaceById(params.workspaceId);

  if (!workspace) {
    notFound();
  }

  const auditLog = getWorkspaceAuditLog(params.workspaceId, 25);

  return <WorkspaceDetail initialWorkspace={workspace} initialAuditLog={auditLog} />;
}

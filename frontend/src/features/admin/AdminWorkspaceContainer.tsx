import React from "react";

import AdminWorkspaceView from "./AdminWorkspace";
import { useAdminDashboardViewModel } from "./useAdminDashboardViewModel";

export default function AdminWorkspaceContainer(): React.JSX.Element {
  const vm = useAdminDashboardViewModel();
  return <AdminWorkspaceView vm={vm} />;
}

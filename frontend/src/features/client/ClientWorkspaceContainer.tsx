import React from "react";

import ClientWorkspaceView from "./ClientWorkspace";
import { useClientDashboardViewModel } from "./useClientDashboardViewModel";

export default function ClientWorkspaceContainer(): React.JSX.Element {
  const vm = useClientDashboardViewModel();
  return <ClientWorkspaceView vm={vm} />;
}

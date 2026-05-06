import React from "react";

import PrestataireWorkspaceView from "./PrestataireWorkspace";
import { usePrestataireDashboardViewModel } from "./usePrestataireDashboardViewModel";

export default function PrestataireWorkspaceContainer(): React.JSX.Element {
  const vm = usePrestataireDashboardViewModel();
  return <PrestataireWorkspaceView vm={vm} />;
}

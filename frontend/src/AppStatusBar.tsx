import type { JSX } from "react";
import type { Role, ThemeMode } from "./types";

type AppStatusBarProps = {
  role: Role | undefined;
  themeMode: ThemeMode;
  onThemeViolet: () => void;
  onThemeRose: () => void;
};

const ACTIVE_ROLE_LABEL: Record<Role, string> = {
  client: "Client",
  prestataire: "Prestataire",
  admin: "Admin",
};

export default function AppStatusBar({ role, themeMode, onThemeViolet, onThemeRose }: AppStatusBarProps): JSX.Element {
  return (
    <div className="app-statusbar">
      {role && (
        <span className="statusbar-mode" title="Mode actif">
          <span className="statusbar-dot" aria-hidden="true" />
          {ACTIVE_ROLE_LABEL[role] ?? role}
        </span>
      )}
      <div className="statusbar-theme" role="group" aria-label="Thème">
        <span className="statusbar-theme__icon" aria-hidden="true">🎨</span>
        <button
          type="button"
          className={`statusbar-theme__pill${themeMode === "violet" ? " active" : ""}`}
          onClick={onThemeViolet}
          aria-pressed={themeMode === "violet"}
          title="Thème Violet"
        >
          Violet
        </button>
        <button
          type="button"
          className={`statusbar-theme__pill${themeMode === "rose" ? " active" : ""}`}
          onClick={onThemeRose}
          aria-pressed={themeMode === "rose"}
          title="Thème Rose"
        >
          Rose
        </button>
      </div>
    </div>
  );
}

import { SwitchableRole } from "./useRoleSwitching";

type Role = "client" | "prestataire" | "admin";

type RoleSwitchActionsProps = {
  activeRole?: Role;
  switchableRoles: SwitchableRole[];
  canSwitchRole: boolean;
  switchRolePending: boolean;
  addRolePending: boolean;
  dashboardPending: boolean;
  addRoleTarget: SwitchableRole;
  onSwitchRole: (role: SwitchableRole) => void;
  onAddRole: (role: SwitchableRole) => void;
};

export default function RoleSwitchActions({
  activeRole,
  switchableRoles,
  canSwitchRole,
  switchRolePending,
  addRolePending,
  dashboardPending,
  addRoleTarget,
  onSwitchRole,
  onAddRole,
}: RoleSwitchActionsProps): JSX.Element {
  if (canSwitchRole) {
    return (
      <div className="role-switch" role="group" aria-label="Basculer de rôle">
        {switchableRoles.map((item) => (
          <button
            key={item}
            type="button"
            className={`ghost role-switch__btn ${activeRole === item ? "role-switch__btn--active" : ""}`}
            onClick={() => onSwitchRole(item)}
            disabled={switchRolePending || dashboardPending || activeRole === item}
          >
            {item === "client" ? "Mode client" : "Mode prestataire"}
          </button>
        ))}
      </div>
    );
  }

  const label = addRoleTarget === "prestataire" ? "Devenir prestataire" : "Devenir client";
  const title =
    addRoleTarget === "prestataire"
      ? "Activer le mode prestataire pour proposer vos services"
      : "Activer le mode client pour passer des demandes";

  return (
    <button
      type="button"
      className="ghost"
      onClick={() => onAddRole(addRoleTarget)}
      disabled={addRolePending || dashboardPending}
      title={title}
    >
      {addRolePending ? "Activation..." : label}
    </button>
  );
}

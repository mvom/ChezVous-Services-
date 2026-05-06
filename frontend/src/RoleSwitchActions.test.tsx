import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import RoleSwitchActions from "./RoleSwitchActions";

describe("RoleSwitchActions", () => {
  it("renders switch buttons when user can switch", async () => {
    const onSwitchRole = vi.fn();

    render(
      <RoleSwitchActions
        activeRole="client"
        switchableRoles={["client", "prestataire"]}
        canSwitchRole={true}
        switchRolePending={false}
        addRolePending={false}
        dashboardPending={false}
        addRoleTarget="prestataire"
        onSwitchRole={onSwitchRole}
        onAddRole={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Mode client" })).toBeDisabled();
    const target = screen.getByRole("button", { name: "Mode prestataire" });
    expect(target).toBeEnabled();

    const user = userEvent.setup();
    await user.click(target);

    expect(onSwitchRole).toHaveBeenCalledWith("prestataire");
  });

  it("renders add-role button in mono-role mode and calls onAddRole", async () => {
    const onAddRole = vi.fn();

    render(
      <RoleSwitchActions
        activeRole="client"
        switchableRoles={["client"]}
        canSwitchRole={false}
        switchRolePending={false}
        addRolePending={false}
        dashboardPending={false}
        addRoleTarget="prestataire"
        onSwitchRole={vi.fn()}
        onAddRole={onAddRole}
      />
    );

    const btn = screen.getByRole("button", { name: "Devenir prestataire" });
    expect(btn).toBeEnabled();

    const user = userEvent.setup();
    await user.click(btn);

    expect(onAddRole).toHaveBeenCalledWith("prestataire");
  });

  it("shows loading label when add role is pending", () => {
    render(
      <RoleSwitchActions
        activeRole="prestataire"
        switchableRoles={["prestataire"]}
        canSwitchRole={false}
        switchRolePending={false}
        addRolePending={true}
        dashboardPending={false}
        addRoleTarget="client"
        onSwitchRole={vi.fn()}
        onAddRole={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Activation..." })).toBeDisabled();
  });
});

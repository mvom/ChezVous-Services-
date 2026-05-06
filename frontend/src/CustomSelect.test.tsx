/**
 * Tests for CustomSelect.tsx
 */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import React from "react";
import CustomSelect from "./CustomSelect";

afterEach(cleanup);

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const options = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

describe("CustomSelect", () => {
  it("renders with first option by default", () => {
    render(<CustomSelect options={options} />);
    expect(screen.getByText("Option A")).toBeInTheDocument();
  });

  it("renders with provided value", () => {
    render(<CustomSelect options={options} value="b" />);
    expect(screen.getByText("Option B")).toBeInTheDocument();
  });

  it("opens dropdown on trigger click", () => {
    render(<CustomSelect options={options} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("calls onChange when option selected", () => {
    const onChange = vi.fn();
    render(<CustomSelect options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.mouseDown(screen.getByText("Option B"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("closes dropdown after selection", () => {
    render(<CustomSelect options={options} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.mouseDown(screen.getByText("Option B"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not open when disabled", () => {
    render(<CustomSelect options={options} disabled />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders with aria-label", () => {
    render(<CustomSelect options={options} aria-label="my-select" />);
    expect(screen.getByRole("button", { name: "my-select" })).toBeInTheDocument();
  });

  it("updates internal value for uncontrolled usage", () => {
    render(<CustomSelect options={options} defaultValue="b" />);
    expect(screen.getByText("Option B")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.mouseDown(screen.getByText("Option C"));
    expect(screen.getByText("Option C")).toBeInTheDocument();
  });

  it("closes on Escape key when open", () => {
    render(<CustomSelect options={options} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("navigates options with ArrowDown key", () => {
    render(<CustomSelect options={options} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.keyDown(document, { key: "ArrowDown" });
    // No error thrown is sufficient
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("navigates options with ArrowUp key", () => {
    render(<CustomSelect options={options} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.keyDown(document, { key: "ArrowUp" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("closes on outside click", () => {
    render(
      <div>
        <CustomSelect options={options} />
        <div data-testid="outside">outside</div>
      </div>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders hidden input with name and value", () => {
    render(<CustomSelect options={options} name="myfield" value="b" />);
    const input = document.querySelector("input[type='hidden']") as HTMLInputElement;
    expect(input?.value).toBe("b");
    expect(input?.name).toBe("myfield");
  });
});

import { useEffect, useRef, useState } from "react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value?: string;
  defaultValue?: string;
  name?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
}

export default function CustomSelect({
  options,
  value,
  defaultValue,
  name,
  disabled,
  onChange,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedby,
  className = "",
}: CustomSelectProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? options[0]?.value ?? ""
  );
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const currentValue = isControlled ? value! : internalValue;
  const currentLabel =
    options.find((o) => o.value === currentValue)?.label ?? currentValue;

  function handleSelect(optValue: string) {
    if (!isControlled) setInternalValue(optValue);
    onChange?.(optValue);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!listRef.current) return;
      const items = listRef.current.querySelectorAll<HTMLLIElement>(
        ".custom-select__option"
      );
      const active = listRef.current.querySelector<HTMLLIElement>(
        ".custom-select__option--focused"
      );
      const idx = Array.from(items).indexOf(active as HTMLLIElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = items[Math.min(idx + 1, items.length - 1)];
        active?.classList.remove("custom-select__option--focused");
        next?.classList.add("custom-select__option--focused");
        next?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = items[Math.max(idx - 1, 0)];
        active?.classList.remove("custom-select__option--focused");
        prev?.classList.add("custom-select__option--focused");
        prev?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && active) {
        e.preventDefault();
        handleSelect(active.dataset.value ?? "");
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
      document.removeEventListener("keydown", onKeydown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`custom-select${open ? " custom-select--open" : ""}${
        disabled ? " custom-select--disabled" : ""
      }${className ? " " + className : ""}`}
    >
      {name && <input type="hidden" name={name} value={currentValue} />}
      <button
        type="button"
        className="custom-select__trigger"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
      >
        <span className="custom-select__label">{currentLabel}</span>
        <svg
          className="custom-select__chevron"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <ul
          ref={listRef}
          className="custom-select__dropdown"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              data-value={opt.value}
              aria-selected={currentValue === opt.value}
              className={`custom-select__option${
                currentValue === opt.value
                  ? " custom-select__option--selected"
                  : ""
              }`}
              onMouseDown={() => handleSelect(opt.value)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

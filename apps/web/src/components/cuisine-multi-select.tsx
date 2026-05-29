"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";

import {
  CATERING_CUISINE_OPTIONS,
  filterCateringCuisines,
  formatCuisinesText,
  parseCuisinesText,
} from "@/lib/catering-cuisines";

type CuisineMultiSelectProps = {
  onChange: (value: string) => void;
  value: string;
};

const triggerStyle: CSSProperties = {
  alignItems: "center",
  background: "rgba(23, 27, 42, 0.78)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 14,
  color: "#f8fafc",
  cursor: "pointer",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  minHeight: 44,
  padding: "10px 12px",
  width: "100%",
};

const chipStyle: CSSProperties = {
  alignItems: "center",
  background: "rgba(135, 221, 247, 0.18)",
  border: "1px solid rgba(135, 221, 247, 0.35)",
  borderRadius: 999,
  color: "#f8fafc",
  display: "inline-flex",
  fontSize: 13,
  fontWeight: 700,
  gap: 6,
  padding: "4px 10px",
};

const dropdownStyle: CSSProperties = {
  background: "rgba(37, 41, 58, 0.98)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 14,
  boxShadow: "0 20px 44px rgba(4, 8, 22, 0.45)",
  display: "grid",
  gap: 8,
  left: 0,
  marginTop: 6,
  maxHeight: 280,
  overflow: "hidden",
  padding: 10,
  position: "absolute",
  right: 0,
  top: "100%",
  zIndex: 30,
};

const optionRowStyle: CSSProperties = {
  alignItems: "center",
  borderRadius: 10,
  color: "#e2e8f0",
  cursor: "pointer",
  display: "flex",
  fontWeight: 600,
  gap: 10,
  padding: "8px 10px",
};

export function CuisineMultiSelect({ onChange, value }: CuisineMultiSelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selected = useMemo(() => parseCuisinesText(value), [value]);
  const selectedSet = useMemo(() => new Set(selected.map((item) => item.toLowerCase())), [selected]);
  const filteredOptions = useMemo(() => filterCateringCuisines(searchQuery), [searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    searchRef.current?.focus();

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function toggleOption(option: string) {
    const key = option.toLowerCase();
    const next = selectedSet.has(key)
      ? selected.filter((item) => item.toLowerCase() !== key)
      : [...selected, option];
    onChange(formatCuisinesText(next));
  }

  function removeSelection(option: string) {
    const key = option.toLowerCase();
    onChange(formatCuisinesText(selected.filter((item) => item.toLowerCase() !== key)));
  }

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      <div
        aria-controls={listboxId}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen((open) => !open);
          }
        }}
        role="combobox"
        style={{
          ...triggerStyle,
          border: isOpen ? "1px solid rgba(135, 221, 247, 0.45)" : triggerStyle.border,
        }}
        tabIndex={0}
      >
        {selected.length === 0 ? (
          <span style={{ color: "#8f96ac" }}>Search and select cuisines…</span>
        ) : (
          selected.map((cuisine) => (
            <span key={cuisine} style={chipStyle}>
              {cuisine}
              <button
                aria-label={`Remove ${cuisine}`}
                onClick={(event) => {
                  event.stopPropagation();
                  removeSelection(cuisine);
                }}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#c5cbe0",
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                  minHeight: 0,
                  padding: 0,
                }}
                type="button"
              >
                ×
              </button>
            </span>
          ))
        )}
        <span style={{ color: "#8f96ac", marginLeft: "auto" }}>{isOpen ? "▲" : "▼"}</span>
      </div>

      {isOpen ? (
        <div style={dropdownStyle}>
          <input
            aria-label="Search cuisines"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search cuisines…"
            ref={searchRef}
            style={{ margin: 0, width: "100%" }}
            type="search"
            value={searchQuery}
          />
          <div
            id={listboxId}
            role="listbox"
            style={{ display: "grid", gap: 2, maxHeight: 220, overflowY: "auto" }}
          >
            {filteredOptions.length === 0 ? (
              <p style={{ color: "#8f96ac", fontSize: 13, margin: "8px 10px" }}>
                No cuisines match your search.
              </p>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedSet.has(option.toLowerCase());
                return (
                  <label
                    key={option}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = "transparent";
                    }}
                    style={{
                      ...optionRowStyle,
                      background: isSelected ? "rgba(135, 221, 247, 0.12)" : "transparent",
                    }}
                  >
                    <input
                      checked={isSelected}
                      onChange={() => toggleOption(option)}
                      type="checkbox"
                    />
                    <span>{option}</span>
                  </label>
                );
              })
            )}
          </div>
          <p style={{ color: "#8f96ac", fontSize: 12, margin: 0 }}>
            {selected.length} selected · {CATERING_CUISINE_OPTIONS.length} options
          </p>
        </div>
      ) : null}
    </div>
  );
}

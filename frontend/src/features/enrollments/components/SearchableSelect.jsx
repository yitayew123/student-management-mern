import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * SearchableSelect — a text-input + filtered-dropdown combobox for
 * picking one item from a large list (students, courses, etc.).
 *
 * Implements the WAI-ARIA combobox pattern:
 *   - `role="combobox"` on the input
 *   - Focus STAYS on the input; options are navigated by arrow keys
 *   - `aria-activedescendant` points to the currently-highlighted
 *     option (this is how screen readers announce "Student A,
 *     selected, 1 of 40" as you arrow)
 *   - Options use `role="option"` on non-focusable `<div>`s (not
 *     `<button>` — buttons would break the Tab pattern)
 *
 * Props:
 *   id             → base id for the input + generated option ids
 *                    (falls back to `useId()` if omitted)
 *   label          → field label text
 *   options        → array of items (any shape; getters below
 *                    describe the shape)
 *   value          → currently-selected value (compare against
 *                    `getValue(item)`)
 *   onChange       → (newValue) => void; called on selection
 *   placeholder    → input placeholder
 *   disabled       → disables the input + hides the dropdown
 *   required       → sets `aria-required` on the input
 *   error          → string; shows error message and marks the input
 *                    `aria-invalid`
 *   getLabel       → (item) => string; what appears in the option
 *   getValue       → (item) => string|number; stable identity
 *   getSearchText  → (item) => string; text compared against the
 *                    typed query (may differ from getLabel to
 *                    include hidden searchable fields like student ID)
 *   renderOption   → (item) => ReactNode; custom option rendering
 *                    (fallback to getLabel if not provided)
 *
 * UX NOTES:
 *
 *   - The input CLEARS on focus. Clicking or tabbing into a
 *     field with a selected value empties it, ready for a new
 *     search. Some users find this surprising; if you prefer
 *     select-all-on-focus (typing replaces, but text stays
 *     visible), swap `setQuery("")` in `onFocus` for
 *     `event.target.select()`.
 *
 *   - The list is capped at 50 items when there's no search query.
 *     Typing filters, so users with >50 options search rather than
 *     scroll. If you need full list scrolling, remove the
 *     `.slice(0, 50)` calls below.
 *
 *   - Enter without an explicit active option selects only if
 *     exactly 1 match remains. This avoids accidentally selecting
 *     the wrong student when the query is ambiguous — the user
 *     must arrow down to highlight what they want, or narrow the
 *     query further.
 */
export default function SearchableSelect({
  id,
  label,
  options = [],
  value,
  onChange,
  placeholder = "Search...",
  disabled = false,
  required = false,
  error = "",
  getLabel = (item) => item.label,
  getValue = (item) => item.value,
  getSearchText = (item) => getLabel(item),
  renderOption,
}) {
  // `useId()` — stable, SSR-safe ids for the input + option elements.
  // `aria-activedescendant` requires stable IDs to work reliably.
  const generatedId = useId();
  const inputId = id || generatedId;
  const listId = `${inputId}-options`;
  const errorId = `${inputId}-error`;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // ✅ ADDED: active option index for keyboard navigation. -1 = none.
  // Only arrows/hover set this; typing resets to -1.
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find(
    (item) => String(getValue(item)) === String(value),
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options.slice(0, 50);
    return options
      .filter((item) =>
        String(getSearchText(item)).toLowerCase().includes(term),
      )
      .slice(0, 50);
  }, [options, query, getSearchText]);

  // ✅ ADDED: reset the active index whenever the query changes.
  // Otherwise a stale index could point to a filtered-out option
  // (e.g., user arrows to item 3, then types more to narrow the
  // list to 2 items — item 3 no longer exists).
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  // ✅ ADDED: click-outside handler. Replaces the previous
  // `onBlur(() => setTimeout(..., 150))` approach, which:
  //   - Raced with slow clicks on options (dropdown closed before
  //     the click could register)
  //   - Kept the dropdown visible for 150ms when tabbing away
  //   - Looked broken when clicking far away (delayed close)
  // `mousedown` (not `click`) fires before the browser moves focus,
  // so we catch outside clicks before the input loses focus.
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function choose(option) {
    onChange(getValue(option));
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    // Return focus to the input after selection so the user
    // can immediately re-open or Tab away — standard combobox
    // behavior (avoid leaving focus on a now-hidden option).
    inputRef.current?.focus();
  }

  function handleKeyDown(event) {
    // ArrowDown/ArrowUp on a closed input opens the dropdown.
    // This is the expected behavior for a combobox.
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(0);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      setActiveIndex(-1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current < filtered.length - 1 ? current + 1 : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current > 0 ? current - 1 : filtered.length - 1,
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(filtered.length - 1);
      return;
    }

    if (event.key === "Enter") {
      // Prefer the explicitly highlighted option (user pressed
      // ArrowDown at least once).
      if (activeIndex >= 0 && filtered[activeIndex]) {
        event.preventDefault();
        choose(filtered[activeIndex]);
        return;
      }
      // Fallback: exactly one match — select it. This preserves
      // the "type to narrow + Enter" flow without ever guessing
      // when the list is ambiguous.
      if (open && filtered.length === 1) {
        event.preventDefault();
        choose(filtered[0]);
      }
    }
  }

  // ✅ FIXED: was `value={open ? query : selected ? getLabel(selected) : query}`.
  // The old expression showed the raw `query` when the dropdown was
  // closed and nothing was selected — meaning after typing "abc"
  // and clicking away (without selecting), the input would keep
  // showing "abc" even though no value was chosen. That's confusing
  // because the input looks like it has a value.
  //
  // Now: closed + no selection → empty string. The user sees the
  // input as "not filled in," matching the actual state.
  const displayValue = open ? query : selected ? getLabel(selected) : "";

  // ID of the currently-active option, referenced by
  // `aria-activedescendant` on the input. Guarded so we don't
  // reference a nonexistent option (e.g., after filtered shrinks).
  const activeOptionId =
    activeIndex >= 0 && filtered[activeIndex]
      ? `${inputId}-option-${activeIndex}`
      : undefined;

  return (
    // `containerRef` on the wrapper — the click-outside listener
    // uses it to determine whether a click was inside (do nothing)
    // or outside (close the dropdown).
    <div className="enrollment-field" ref={containerRef}>
      <label htmlFor={inputId}>{label}</label>

      <input
        ref={inputRef}
        id={inputId}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        // ✅ CHANGED: `aria-controls` only when the dropdown is
        // actually rendered. Pointing to a nonexistent ID is
        // technically allowed but confusing for screen readers
        // that try to resolve it.
        aria-controls={open ? listId : undefined}
        // ✅ ADDED: this is the key piece. When the user arrows
        // through options, `activeOptionId` changes, and the SR
        // announces the highlighted option. Without this, arrow
        // keys would update a visual highlight but the SR would
        // stay silent.
        aria-activedescendant={activeOptionId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        // ✅ ADDED: `required` announced to screen readers — the
        // HTML `required` attribute doesn't apply to non-form
        // elements, and `role="combobox"` needs `aria-required`
        // to convey the same meaning.
        aria-required={required || undefined}
        value={displayValue}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          // Clear the parent's selection when the user types —
          // otherwise they'd see "Student A" highlighted in the
          // list while the input shows "Student B" text. The
          // selection is re-established when they choose an option.
          if (value) onChange("");
        }}
        onKeyDown={handleKeyDown}
      />

      {open && !disabled && (
        <div
          className="enrollment-select-options"
          id={listId}
          role="listbox"
          aria-label={`${label} options`}
        >
          {filtered.length === 0 ? (
            <p className="enrollment-select-empty">No matching results.</p>
          ) : (
            filtered.map((option, index) => {
              const optionValue = getValue(option);
              const isSelected = String(optionValue) === String(value);
              const isActive = index === activeIndex;

              return (
                // 🔴 CHANGED: was `<button role="option">`. Now
                // `<div role="option">` with `tabIndex={-1}`.
                //
                // Why:
                //   - `<button>` is Tab-focusable. In the combobox
                //     pattern, options should be navigable by
                //     ArrowDown/ArrowUp only, with focus staying
                //     on the input.
                //   - `role="option"` on a button creates a
                //     semantic mismatch — screen readers may
                //     announce "button, option" or behave
                //     unpredictably.
                //   - `tabIndex={-1}` makes the div programmatically
                //     focusable (needed for `aria-activedescendant`
                //     to be read by some SRs) but not reachable
                //     via Tab.
                <div
                  key={optionValue}
                  id={`${inputId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`enrollment-select-option${
                    isActive ? " is-active" : ""
                  }`}
                  tabIndex={-1}
                  // Prevents the div from stealing focus when
                  // clicked — input keeps focus, so the dropdown
                  // pattern stays consistent.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  // Sync mouse hover → activeIndex. Standard pattern
                  // in ARIA APG: reduces confusion when the user
                  // mixes mouse + keyboard navigation. Slight
                  // trade-off — arrowing while hovering keeps
                  // jumping to hovered items. Most users don't do
                  // both simultaneously, so this is net positive.
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {renderOption ? renderOption(option) : getLabel(option)}
                </div>
              );
            })
          )}
        </div>
      )}

      {error && (
        <p className="enrollment-field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

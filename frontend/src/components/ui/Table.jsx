import EmptyState from "./EmptyState";
import Spinner from "./Spinner";

/**
 * Table — data table with loading and empty states handled.
 *
 * Column shape:
 *   {
 *     key: string,                 // property name on row OR custom id
 *     header: ReactNode,           // column header text
 *     render?: (row, index) => ReactNode,  // optional custom cell
 *     className?: string,          // applied to both <th> and <td>
 *   }
 *
 * A11Y NOTES:
 *
 *   - Headers use `scope="col"` — required for SRs to associate
 *     cells with their column headers correctly.
 *
 *   - ⚠️ The table needs an accessible name — WCAG 1.3.1. Pass
 *     `label` (a short string like "Students") so screen readers
 *     announce "Students table, 12 rows, 4 columns" instead of
 *     the anonymous "table, 12 rows, 4 columns". When a visual
 *     heading exists above the table (`<h2>Students</h2>`),
 *     `label` should match it so the SR announcement aligns
 *     with what sighted users see.
 *
 *   - `aria-busy` on the wrapper tells SRs the table is being
 *     refreshed. Currently only fires during initial load (when
 *     the whole table is replaced by a Spinner) — but if you
 *     later refactor to keep headers visible during reloads,
 *     `aria-busy` continues to work.
 *
 * Props:
 *   columns          → column definitions (see above)
 *   data             → array of row objects
 *   getRowKey        → (row) => string|number. Falls back to
 *                      row._id, then row index.
 *   label            → string; accessible name for the table
 *                      (added — see A11Y NOTES)
 *   loading          → boolean; when true, replaces table with Spinner
 *   emptyTitle       → title shown in EmptyState when data is empty
 *   emptyDescription → description shown in EmptyState
 *   className        → extra classes on the wrapper
 *   ...props         → spread onto the wrapper (`data-testid`, `id`, etc.)
 */
export default function Table({
  columns,
  data,
  getRowKey,
  label,
  loading = false,
  emptyTitle = "No records found",
  emptyDescription = "Try changing your search or filters.",
  className = "",
  ...props
}) {
  // ⚠️ Loading replaces the entire table — including its <thead> —
  // with a centered Spinner. Simple, but causes layout shift when
  // data arrives (the header re-appears, pushing content down).
  //
  // Alternative pattern (documented, not implemented — would be a
  // behavioral change): keep the table mounted, show a spinner row
  // inside <tbody colSpan={columns.length}>. Keeps headers visible,
  // no layout shift, better UX for slow connections. Larger refactor
  // — flag for later if this becomes a UX complaint.
  if (loading) {
    // ✅ ADDED: `aria-busy="true"` on a lightweight wrapper. The
    // Spinner inside already has role="status", but aria-busy on
    // the region that will update makes the "these are being
    // refreshed" semantics explicit for SRs navigating by landmarks.
    return (
      <div className="table-wrapper" aria-busy="true">
        <Spinner label="Loading records..." />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        // ✅ ADDED: `role="status"` — polite announcement when an
        // empty state appears AFTER a search. For the initial page
        // load case, this is silent (nothing to announce — no
        // previous content). For search-with-no-results, SR users
        // hear "No records found" after the previous utterance
        // finishes. No downside to including it.
        role="status"
      />
    );
  }

  // ✅ ADDED: `className` + `{...props}` passthrough — matches
  // every other UI primitive. Enables `data-testid`, `id` (for
  // aria-describedby refs from pagination), layout overrides.
  return (
    <div className={`table-wrapper ${className}`.trim()} {...props}>
      <table className="data-table" aria-label={label}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                // ⚠️ Column keys are the caller's responsibility —
                // if two columns share a key, React silently uses
                // the first. Worth documenting but not worth a
                // runtime check here (would slow down every render).
                key={column.key}
                scope="col"
                className={column.className || ""}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row, index) => {
            // ✅ FIXED: guard the computed row key against null/
            // undefined. React's `key` prop must be a string or
            // number — passing `undefined` triggers the
            // "Each child in a list should have a unique key"
            // warning AND causes reconciliation bugs when the
            // list updates (React can't tell which row is which).
            //
            // Fallback chain: getRowKey → row._id → index.
            // `??` (not `||`) so `0` and `""` are treated as valid
            // keys (they're rare but legitimate identifiers).
            const computedKey = getRowKey ? getRowKey(row) : (row._id ?? index);
            const rowKey = computedKey != null ? computedKey : index;

            return (
              <tr key={rowKey}>
                {columns.map((column) => (
                  <td key={column.key} className={column.className || ""}>
                    {column.render
                      ? // ✅ ADDED: pass `index` as second arg for
                        // render callbacks that need row-aware
                        // context (numbered rows, alternating
                        // styles, etc.). Existing renders that
                        // only use `row` are unaffected — extra
                        // args are ignored by JS.
                        column.render(row, index)
                      : // `??` (not `||`) so 0, false, "" are rendered
                        // as-is. Only null/undefined fall back to "—".
                        // This is important — a `${row.score}` of 0
                        // shouldn't display as "—"!
                        (row[column.key] ?? "—")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

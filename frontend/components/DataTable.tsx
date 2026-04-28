"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronUp, ChevronDown, Filter, X, Check } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface ColumnDef<T> {
  key: keyof T & string;
  label: string;
  align?: "left" | "right" | "center";
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;    // default true
  filterable?: boolean;  // default true
  width?: string;
}

type SortDir = "asc" | "desc" | null;

interface FilterState {
  [col: string]: Set<string>;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  pageSize = 100,
  id,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  pageSize?: number;
  id?: string;
}) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<FilterState>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [page, setPage] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenFilter(null);
        setFilterSearch("");
      }
    }
    if (openFilter) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openFilter]);

  // Unique values per column for filters
  const uniqueValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    columns.forEach((col) => {
      if (col.filterable === false) return;
      const vals = new Set<string>();
      data.forEach((row) => {
        const v = row[col.key];
        if (v !== null && v !== undefined && v !== "") vals.add(String(v));
      });
      map[col.key] = Array.from(vals).sort((a, b) => a.localeCompare(b, "es"));
    });
    return map;
  }, [data, columns]);

  // Filtered data
  const filtered = useMemo(() => {
    return data.filter((row) => {
      for (const col of Object.keys(filters)) {
        const allowed = filters[col];
        if (allowed && allowed.size > 0) {
          const val = String(row[col] ?? "");
          if (!allowed.has(val)) return false;
        }
      }
      return true;
    });
  }, [data, filters]);

  // Sorted data
  const sorted = useMemo(() => {
    if (!sortCol || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      // Numeric sort
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      // String sort
      const sa = String(va ?? "");
      const sb = String(vb ?? "");
      return sortDir === "asc"
        ? sa.localeCompare(sb, "es")
        : sb.localeCompare(sa, "es");
    });
  }, [filtered, sortCol, sortDir]);

  // Paginated
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  // Reset page on filter/sort change
  useEffect(() => { setPage(0); }, [filters, sortCol, sortDir]);

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc");
      if (sortDir === "desc") setSortCol(null);
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function toggleFilterValue(col: string, val: string) {
    setFilters((prev) => {
      const current = new Set(prev[col] || []);
      if (current.has(val)) current.delete(val);
      else current.add(val);
      return { ...prev, [col]: current };
    });
  }

  function selectAll(col: string) {
    const searchLower = filterSearch.toLowerCase();
    const visible = (uniqueValues[col] || []).filter(v => v.toLowerCase().includes(searchLower));
    setFilters((prev) => ({ ...prev, [col]: new Set(visible) }));
  }

  function clearFilter(col: string) {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[col];
      return next;
    });
  }

  function clearAllFilters() {
    setFilters({});
    setSortCol(null);
    setSortDir(null);
  }

  const activeFilterCount = Object.values(filters).filter((s) => s.size > 0).length;

  return (
    <div id={id}>
      {/* Active filters bar */}
      {activeFilterCount > 0 && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 16px",
          background: "var(--color-primary-bg)", borderBottom: "1px solid var(--color-border)",
          alignItems: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Filtros activos:
          </span>
          {Object.entries(filters).map(([col, vals]) => {
            if (!vals || vals.size === 0) return null;
            const colDef = columns.find((c) => c.key === col);
            return (
              <span key={col} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "#fff", border: "1px solid var(--color-border)",
                borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600,
                color: "var(--color-secondary)",
              }}>
                {colDef?.label}: {vals.size} selec.
                <button onClick={() => clearFilter(col)} style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  color: "var(--color-danger)", display: "flex",
                }}>
                  <X size={12} />
                </button>
              </span>
            );
          })}
          <button onClick={clearAllFilters} style={{
            background: "none", border: "1px solid var(--color-border)", borderRadius: 6,
            padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
            color: "var(--color-text-muted)", marginLeft: "auto",
          }}>
            Limpiar todo
          </button>
        </div>
      )}

      <div className="table-wrapper" style={{ maxHeight: 520, overflow: "auto" }}>
        <table style={{ position: "relative" }}>
          <thead>
            <tr>
              {columns.map((col, colIdx) => {
                const isSorted = sortCol === col.key;
                const isFiltered = filters[col.key]?.size > 0;
                const isOpen = openFilter === col.key;
                const sortable = col.sortable !== false;
                const filterable = col.filterable !== false;

                return (
                  <th
                    key={`${col.key}-${colIdx}`}
                    style={{
                      textAlign: col.align || "left",
                      position: "sticky", top: 0, zIndex: isOpen ? 20 : 10,
                      background: "#f8f9fa",
                      width: col.width,
                      userSelect: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: col.align === "right" ? "flex-end" : "flex-start" }}>
                      {/* Sort button */}
                      {sortable ? (
                        <button
                          onClick={() => handleSort(col.key)}
                          style={{
                            background: "none", border: "none", cursor: "pointer", padding: 0,
                            display: "flex", alignItems: "center", gap: 2,
                            color: isSorted ? "var(--color-primary)" : "inherit",
                            fontWeight: 700, fontSize: 11, textTransform: "uppercase",
                            letterSpacing: "0.5px", fontFamily: "var(--font-main)",
                          }}
                        >
                          {col.label}
                          <span style={{ display: "flex", flexDirection: "column", lineHeight: 0 }}>
                            <ChevronUp size={10} style={{ opacity: isSorted && sortDir === "asc" ? 1 : 0.25, marginBottom: -2 }} />
                            <ChevronDown size={10} style={{ opacity: isSorted && sortDir === "desc" ? 1 : 0.25, marginTop: -2 }} />
                          </span>
                        </button>
                      ) : (
                        <span>{col.label}</span>
                      )}

                      {/* Filter button */}
                      {filterable && (
                        <div style={{ position: "relative" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenFilter(isOpen ? null : col.key);
                              setFilterSearch("");
                            }}
                            style={{
                              background: isFiltered ? "var(--color-primary)" : "none",
                              border: isFiltered ? "none" : "1px solid transparent",
                              borderRadius: 4, padding: 2, cursor: "pointer",
                              color: isFiltered ? "#fff" : "var(--color-text-muted)",
                              display: "flex", alignItems: "center",
                              transition: "all 0.15s",
                            }}
                            title={`Filtrar ${col.label}`}
                          >
                            <Filter size={11} />
                          </button>

                          {/* Dropdown */}
                          {isOpen && (
                            <div
                              ref={dropdownRef}
                              style={{
                                position: "absolute",
                                top: "calc(100% + 4px)",
                                left: col.align === "right" ? "auto" : 0,
                                right: col.align === "right" ? 0 : "auto",
                                width: 220, maxHeight: 320,
                                background: "#fff",
                                border: "1px solid var(--color-border)",
                                borderRadius: 8,
                                boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                                zIndex: 999,
                                display: "flex", flexDirection: "column",
                                animation: "fadeIn 0.15s ease-out",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Search */}
                              <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--color-border)" }}>
                                <input
                                  type="text"
                                  placeholder="Buscar..."
                                  value={filterSearch}
                                  onChange={(e) => setFilterSearch(e.target.value)}
                                  autoFocus
                                  style={{
                                    width: "100%", padding: "6px 8px", border: "1px solid var(--color-border)",
                                    borderRadius: 4, fontSize: 12, outline: "none",
                                    fontFamily: "var(--font-main)",
                                  }}
                                />
                              </div>

                              {/* Actions */}
                              <div style={{
                                display: "flex", gap: 6, padding: "6px 10px",
                                borderBottom: "1px solid var(--color-border)",
                              }}>
                                <button onClick={() => selectAll(col.key)} style={{
                                  flex: 1, background: "var(--color-primary-bg)", border: "none",
                                  borderRadius: 4, padding: "4px 0", fontSize: 10, fontWeight: 700,
                                  cursor: "pointer", color: "var(--color-primary)", fontFamily: "var(--font-main)",
                                }}>
                                  Sel. todo
                                </button>
                                <button onClick={() => clearFilter(col.key)} style={{
                                  flex: 1, background: "#f5f5f5", border: "none",
                                  borderRadius: 4, padding: "4px 0", fontSize: 10, fontWeight: 700,
                                  cursor: "pointer", color: "var(--color-text-muted)", fontFamily: "var(--font-main)",
                                }}>
                                  Limpiar
                                </button>
                              </div>

                              {/* Values list */}
                              <div style={{ overflowY: "auto", flex: 1, maxHeight: 220 }}>
                                {(uniqueValues[col.key] || [])
                                  .filter((v) => v.toLowerCase().includes(filterSearch.toLowerCase()))
                                  .map((val) => {
                                    const checked = filters[col.key]?.has(val) ?? false;
                                    return (
                                      <label
                                        key={val}
                                        style={{
                                          display: "flex", alignItems: "center", gap: 8,
                                          padding: "5px 10px", cursor: "pointer",
                                          fontSize: 12, color: "var(--color-text-primary)",
                                          background: checked ? "var(--color-primary-bg)" : "transparent",
                                          transition: "background 0.1s",
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = checked ? "var(--color-primary-bg)" : "transparent")}
                                      >
                                        <span style={{
                                          width: 16, height: 16, borderRadius: 3,
                                          border: checked ? "none" : "1.5px solid var(--color-border)",
                                          background: checked ? "var(--color-primary)" : "#fff",
                                          display: "flex", alignItems: "center", justifyContent: "center",
                                          flexShrink: 0, transition: "all 0.15s",
                                        }}>
                                          {checked && <Check size={10} color="#fff" strokeWidth={3} />}
                                        </span>
                                        <span style={{
                                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                        }}>
                                          {val || "—"}
                                        </span>
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleFilterValue(col.key, val)}
                                          style={{ display: "none" }}
                                        />
                                      </label>
                                    );
                                  })}
                              </div>

                              {/* Apply button */}
                              <div style={{ padding: "8px 10px", borderTop: "1px solid var(--color-border)" }}>
                                <button
                                  onClick={() => { setOpenFilter(null); setFilterSearch(""); }}
                                  style={{
                                    width: "100%", padding: "6px 0",
                                    background: "var(--color-primary)", color: "#fff",
                                    border: "none", borderRadius: 6,
                                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                                    fontFamily: "var(--font-main)",
                                  }}
                                >
                                  Aplicar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={i}>
                {columns.map((col, colIdx) => (
                  <td
                    key={`${col.key}-${colIdx}`}
                    style={{ textAlign: col.align || "left" }}
                    data-label={col.label}
                  >
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: "center", padding: 40, color: "var(--color-text-muted)" }}>
                  No hay datos que coincidan con los filtros seleccionados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination + stats */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 16px", borderTop: "1px solid var(--color-border)",
        fontSize: 12, color: "var(--color-text-muted)",
      }}>
        <span style={{ fontWeight: 600 }}>
          {sorted.length.toLocaleString("es-CO")} registros
          {activeFilterCount > 0 && ` (de ${data.length.toLocaleString("es-CO")} totales)`}
        </span>
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              style={{
                padding: "4px 12px", border: "1px solid var(--color-border)", borderRadius: 6,
                background: "transparent", cursor: page === 0 ? "not-allowed" : "pointer",
                fontSize: 12, fontWeight: 600, color: page === 0 ? "var(--color-border)" : "var(--color-text-secondary)",
                fontFamily: "var(--font-main)",
              }}
            >
              ← Anterior
            </button>
            <span style={{ fontWeight: 700 }}>{page + 1} / {totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: "4px 12px", border: "1px solid var(--color-border)", borderRadius: 6,
                background: "transparent", cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
                fontSize: 12, fontWeight: 600, color: page >= totalPages - 1 ? "var(--color-border)" : "var(--color-text-secondary)",
                fontFamily: "var(--font-main)",
              }}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

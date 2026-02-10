import { useState, useMemo } from "react";

const SAMPLE_DATA = [
  { table_schema: "stg", table_name: "hics_campaign_data", size_gb: 48675.27, est_monthly_cost: 973.51, indictment_status: "SUSPECT (Stale)", risk_score: 90, classification: "High / Operational", reasoning: "This table likely contains stale campaign data", action: "Do Not Delete", state_status: "WARNING" },
  { table_schema: "test", table_name: "didf_doc_features", size_gb: 8519.87, est_monthly_cost: 170.40, indictment_status: "SUSPECT (Never Used)", risk_score: 70, classification: "High / Compliance", reasoning: "The table name suggests test documentation", action: "Do Not Delete", state_status: "WARNING" },
  { table_schema: "prod", table_name: "temp_schema_backup", size_gb: 6683.45, est_monthly_cost: 133.67, indictment_status: "SUSPECT (Never Used)", risk_score: 15, classification: "Low / Operational", reasoning: "The 'temp_' prefix suggests temporary data", action: "Delete", state_status: "WARNING" },
  { table_schema: "stg", table_name: "obee_engage_metrics", size_gb: 4305.91, est_monthly_cost: 86.12, indictment_status: "SUSPECT (Never Used)", risk_score: 55, classification: "Medium / Operational", reasoning: "This table likely contains engagement metrics", action: "Archive", state_status: "WARNING" },
  { table_schema: "prod", table_name: "hikc_kpio_config", size_gb: 2633.60, est_monthly_cost: 52.67, indictment_status: "SUSPECT (Never Used)", risk_score: 85, classification: "High / Operational", reasoning: "The table name suggests configuration data", action: "Do Not Delete", state_status: "WARNING" },
  { table_schema: "test", table_name: "dido_document_store", size_gb: 1406.12, est_monthly_cost: 28.12, indictment_status: "SUSPECT (Never Used)", risk_score: 85, classification: "High / Compliance", reasoning: "The table name suggests document storage", action: "Do Not Delete", state_status: "WARNING" },
  { table_schema: "test", table_name: "diim_images", size_gb: 329.96, est_monthly_cost: 6.60, indictment_status: "SUSPECT (Never Used)", risk_score: 75, classification: "High / PII & Retention", reasoning: "The 'images' keyword suggests media content", action: "Do Not Delete", state_status: "WARNING" },
  { table_schema: "stg", table_name: "hisa_salesforce_sync", size_gb: 269.40, est_monthly_cost: 5.39, indictment_status: "SUSPECT (Stale)", risk_score: 90, classification: "High / PII & Business", reasoning: "This table likely contains salesforce data", action: "Do Not Delete", state_status: "WARNING" },
  { table_schema: "stg", table_name: "diba_block_segments", size_gb: 255.88, est_monthly_cost: 5.12, indictment_status: "SUSPECT (Never Used)", risk_score: 70, classification: "High / Operational", reasoning: "The table name suggests segmentation data", action: "Do Not Delete", state_status: "WARNING" },
  { table_schema: "stg", table_name: "diim_images_backup", size_gb: 254.17, est_monthly_cost: 5.08, indictment_status: "SUSPECT (Never Used)", risk_score: 75, classification: "High / PII & Retention", reasoning: "The 'images' keyword suggests media content", action: "Do Not Delete", state_status: "WARNING" },
];

const RiskBar = ({ score }) => {
  const color = score >= 80 ? "#ef4444" : score >= 50 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 60, height: 8, background: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{score}</span>
    </div>
  );
};

const Badge = ({ text, variant }) => {
  const styles = {
    red: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" },
    amber: { bg: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" },
    green: { bg: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" },
    blue: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" },
    purple: { bg: "rgba(168,85,247,0.15)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.3)" },
    slate: { bg: "rgba(148,163,184,0.15)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.3)" },
  };
  const s = styles[variant] || styles.slate;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, border: s.border, whiteSpace: "nowrap", letterSpacing: 0.3 }}>
      {text}
    </span>
  );
};

const ActionBadge = ({ action }) => {
  if (action === "Delete") return <Badge text="DELETE" variant="red" />;
  if (action === "Archive") return <Badge text="ARCHIVE" variant="amber" />;
  return <Badge text="DO NOT DELETE" variant="slate" />;
};

const SchemaBadge = ({ schema }) => {
  const v = { prod: "red", stg: "amber", test: "blue" }[schema] || "slate";
  return <Badge text={schema.toUpperCase()} variant={v} />;
};

const StatusBadge = ({ status }) => {
  if (status.includes("Stale")) return <Badge text="STALE" variant="amber" />;
  return <Badge text="NEVER USED" variant="purple" />;
};

const StatCard = ({ label, value, sub, icon }) => (
  <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", borderRadius: 14, padding: "20px 24px", border: "1px solid rgba(148,163,184,0.1)", flex: 1, minWidth: 180 }}>
    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{sub}</div>}
  </div>
);

export default function TablesStatesViz() {
  const [schemaFilter, setSchemaFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [sortBy, setSortBy] = useState("size_gb");
  const [sortDir, setSortDir] = useState("desc");
  const [hoveredRow, setHoveredRow] = useState(null);

  const filtered = useMemo(() => {
    let d = [...SAMPLE_DATA];
    if (schemaFilter !== "all") d = d.filter(r => r.table_schema === schemaFilter);
    if (actionFilter !== "all") d = d.filter(r => r.action === actionFilter);
    d.sort((a, b) => sortDir === "desc" ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]);
    return d;
  }, [schemaFilter, actionFilter, sortBy, sortDir]);

  const totalSize = filtered.reduce((s, r) => s + r.size_gb, 0);
  const totalCost = filtered.reduce((s, r) => s + r.est_monthly_cost, 0);
  const avgRisk = filtered.length ? Math.round(filtered.reduce((s, r) => s + r.risk_score, 0) / filtered.length) : 0;
  const deletable = filtered.filter(r => r.action === "Delete" || r.action === "Archive");
  const saveable = deletable.reduce((s, r) => s + r.est_monthly_cost, 0);

  const schemas = [...new Set(SAMPLE_DATA.map(r => r.table_schema))];
  const actions = [...new Set(SAMPLE_DATA.map(r => r.action))];

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
    return <span style={{ marginLeft: 4, color: "#60a5fa" }}>{sortDir === "desc" ? "↓" : "↑"}</span>;
  };

  const FilterBtn = ({ active, onClick, children }) => (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
      background: active ? "rgba(59,130,246,0.2)" : "rgba(148,163,184,0.08)",
      color: active ? "#60a5fa" : "#94a3b8",
      border: active ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(148,163,184,0.15)",
    }}>{children}</button>
  );

  // Schema distribution bar
  const schemaGroups = schemas.map(s => {
    const rows = filtered.filter(r => r.table_schema === s);
    const size = rows.reduce((a, r) => a + r.size_gb, 0);
    return { schema: s, size, pct: totalSize ? (size / totalSize * 100) : 0 };
  }).sort((a, b) => b.size - a.size);

  const schemaColors = { prod: "#ef4444", stg: "#f59e0b", test: "#3b82f6" };

  return (
    <div style={{ background: "#020617", minHeight: "100vh", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 12px rgba(245,158,11,0.5)" }} />
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: "#f8fafc" }}>Table Health Monitor</h1>
          </div>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>Identifying suspect, stale, and unused tables across your data warehouse</p>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          <StatCard label="Suspect Tables" value={filtered.length} sub={`of ${SAMPLE_DATA.length} total`} />
          <StatCard label="Total Size" value={`${(totalSize / 1000).toFixed(1)} TB`} sub="across all suspect tables" />
          <StatCard label="Monthly Cost" value={`$${totalCost.toFixed(0)}`} sub="estimated waste" />
          <StatCard label="Avg Risk Score" value={avgRisk} sub={avgRisk >= 70 ? "⚠ High average" : "Moderate"} />
          <StatCard label="Potential Savings" value={`$${saveable.toFixed(0)}/mo`} sub={`${deletable.length} actionable tables`} />
        </div>

        {/* Storage by Schema */}
        <div style={{ background: "#0f172a", borderRadius: 12, padding: 20, border: "1px solid rgba(148,163,184,0.1)", marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 12, letterSpacing: 0.5 }}>STORAGE BY SCHEMA</div>
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 28 }}>
            {schemaGroups.map(g => (
              <div key={g.schema} style={{
                width: `${Math.max(g.pct, 2)}%`, background: schemaColors[g.schema] || "#475569",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff", transition: "width 0.5s ease",
                borderRight: "2px solid #020617"
              }}>
                {g.pct > 10 ? `${g.schema} ${g.pct.toFixed(0)}%` : ""}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
            {schemaGroups.map(g => (
              <div key={g.schema} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: schemaColors[g.schema] }} />
                {g.schema}: {(g.size / 1000).toFixed(1)} TB ({g.pct.toFixed(0)}%)
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>SCHEMA:</span>
          <FilterBtn active={schemaFilter === "all"} onClick={() => setSchemaFilter("all")}>All</FilterBtn>
          {schemas.map(s => <FilterBtn key={s} active={schemaFilter === s} onClick={() => setSchemaFilter(s)}>{s}</FilterBtn>)}
          <div style={{ width: 1, height: 24, background: "rgba(148,163,184,0.2)", margin: "0 8px" }} />
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>ACTION:</span>
          <FilterBtn active={actionFilter === "all"} onClick={() => setActionFilter("all")}>All</FilterBtn>
          {actions.map(a => <FilterBtn key={a} active={actionFilter === a} onClick={() => setActionFilter(a)}>{a}</FilterBtn>)}
        </div>

        {/* Table */}
        <div style={{ background: "#0f172a", borderRadius: 14, border: "1px solid rgba(148,163,184,0.1)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.15)" }}>
                  {[
                    { label: "Schema", col: null },
                    { label: "Table Name", col: null },
                    { label: "Size (GB)", col: "size_gb" },
                    { label: "Est. Cost/mo", col: "est_monthly_cost" },
                    { label: "Status", col: null },
                    { label: "Risk", col: "risk_score" },
                    { label: "Classification", col: null },
                    { label: "Action", col: null },
                  ].map(({ label, col }) => (
                    <th key={label} onClick={col ? () => handleSort(col) : undefined} style={{
                      padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#64748b",
                      fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase",
                      cursor: col ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap",
                    }}>
                      {label}{col && <SortIcon col={col} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      borderBottom: "1px solid rgba(148,163,184,0.07)",
                      background: hoveredRow === i ? "rgba(59,130,246,0.05)" : "transparent",
                      transition: "background 0.15s ease",
                    }}>
                    <td style={{ padding: "12px 16px" }}><SchemaBadge schema={r.table_schema} /></td>
                    <td style={{ padding: "12px 16px", fontWeight: 500, color: "#f1f5f9", fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 12 }}>{r.table_name}</td>
                    <td style={{ padding: "12px 16px", fontVariantNumeric: "tabular-nums", color: "#cbd5e1" }}>{r.size_gb.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td style={{ padding: "12px 16px", fontVariantNumeric: "tabular-nums", color: "#fbbf24", fontWeight: 600 }}>${r.est_monthly_cost.toFixed(2)}</td>
                    <td style={{ padding: "12px 16px" }}><StatusBadge status={r.indictment_status} /></td>
                    <td style={{ padding: "12px 16px" }}><RiskBar score={r.risk_score} /></td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#94a3b8" }}>{r.classification}</td>
                    <td style={{ padding: "12px 16px" }}><ActionBadge action={r.action} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>No tables match the current filters</div>
          )}
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: "#475569", textAlign: "center" }}>
          Showing {filtered.length} of {SAMPLE_DATA.length} suspect tables • Click column headers to sort
        </div>
      </div>
    </div>
  );
}

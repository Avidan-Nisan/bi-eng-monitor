import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { ExtensionContext } from '@looker/extension-sdk-react';
import { Search, AlertTriangle, EyeOff, Trash2, GitBranch, X, ZoomIn, ZoomOut, Maximize2, Loader2, RefreshCw } from 'lucide-react';

// ===========================================
// LINEAGE GRAPH COMPONENT
// ===========================================
function LineageGraph({ data }) {
  const svgRef = useRef(null);
  const [transform, setTransform] = useState({ x: 50, y: 50, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const graphData = useMemo(() => {
    const nodes = { tables: {}, views: {}, explores: {}, dashboards: {} };
    const edges = [];

    data.forEach(row => {
      const tId = `table_${row.sql_table_path}`;
      const vId = `view_${row.view_name}`;
      const eId = `explore_${row.explore_name}`;
      const dId = `dash_${row.dashboard_id}`;

      if (!nodes.tables[tId]) nodes.tables[tId] = { id: tId, type: 'table', label: row.sql_table, fullPath: row.sql_table_path, connections: 0 };
      nodes.tables[tId].connections++;

      if (!nodes.views[vId]) nodes.views[vId] = { id: vId, type: 'view', label: row.view_name, connections: 0 };
      nodes.views[vId].connections++;

      if (!nodes.explores[eId]) nodes.explores[eId] = { id: eId, type: 'explore', label: row.explore_name, isHidden: row.explore_is_hidden, runtime: row.explore_avg_runtime_seconds, connections: 0 };
      nodes.explores[eId].connections++;

      if (!nodes.dashboards[dId]) nodes.dashboards[dId] = { id: dId, type: 'dashboard', label: row.dashboard_title, viewCount: row.dashboard_view_count, connections: 0 };
      nodes.dashboards[dId].connections++;

      const e1 = `${tId}-${vId}`, e2 = `${vId}-${eId}`, e3 = `${eId}-${dId}`;
      if (!edges.find(e => e.key === e1)) edges.push({ key: e1, from: tId, to: vId });
      if (!edges.find(e => e.key === e2)) edges.push({ key: e2, from: vId, to: eId });
      if (!edges.find(e => e.key === e3)) edges.push({ key: e3, from: eId, to: dId });
    });

    return { nodes, edges };
  }, [data]);

  const layout = useMemo(() => {
    const colW = 200, nodeH = 44, gap = 16, startX = 20;
    const cols = [
      { x: startX, items: Object.values(graphData.nodes.tables) },
      { x: startX + colW, items: Object.values(graphData.nodes.views) },
      { x: startX + colW * 2, items: Object.values(graphData.nodes.explores) },
      { x: startX + colW * 3, items: Object.values(graphData.nodes.dashboards) },
    ];

    const positions = {};
    let maxY = 0;
    cols.forEach(col => {
      col.items.forEach((node, i) => {
        const y = 60 + i * (nodeH + gap);
        positions[node.id] = { ...node, x: col.x, y, width: 160, height: nodeH };
        maxY = Math.max(maxY, y + nodeH);
      });
    });
    return { positions, height: maxY + 40 };
  }, [graphData]);

  const connectedNodes = useMemo(() => {
    if (!selectedNode && !hoveredNode) return new Set();
    const target = selectedNode || hoveredNode;
    const connected = new Set([target]);
    
    const find = (nodeId, dir) => {
      graphData.edges.forEach(e => {
        if (dir === 'up' && e.to === nodeId && !connected.has(e.from)) { connected.add(e.from); find(e.from, 'up'); }
        if (dir === 'down' && e.from === nodeId && !connected.has(e.to)) { connected.add(e.to); find(e.to, 'down'); }
      });
    };
    find(target, 'up');
    find(target, 'down');
    return connected;
  }, [selectedNode, hoveredNode, graphData.edges]);

  const connectedEdges = useMemo(() => {
    if (!selectedNode && !hoveredNode) return new Set();
    return new Set(graphData.edges.filter(e => connectedNodes.has(e.from) && connectedNodes.has(e.to)).map(e => e.key));
  }, [connectedNodes, graphData.edges]);

  const onMouseDown = (e) => {
    if (e.target === svgRef.current || e.target.tagName === 'svg') {
      setDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };
  const onMouseMove = (e) => { if (dragging) setTransform(t => ({ ...t, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })); };
  const onMouseUp = () => setDragging(false);
  const zoom = (d) => setTransform(t => ({ ...t, scale: Math.max(0.3, Math.min(2, t.scale + d)) }));
  const reset = () => setTransform({ x: 50, y: 50, scale: 1 });

  const colors = {
    table: { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
    view: { bg: '#1e3a3a', border: '#14b8a6', text: '#5eead4' },
    explore: { bg: '#3a1e3a', border: '#a855f7', text: '#d8b4fe' },
    dashboard: { bg: '#3a2e1e', border: '#f59e0b', text: '#fcd34d' },
  };
  const icons = { table: '⬡', view: '◈', explore: '◎', dashboard: '▣' };

  return (
    <div className="lineage-container">
      <div className="lineage-controls">
        <button className="control-btn" onClick={() => zoom(0.2)}><ZoomIn size={18} /></button>
        <button className="control-btn" onClick={() => zoom(-0.2)}><ZoomOut size={18} /></button>
        <button className="control-btn" onClick={reset}><Maximize2 size={18} /></button>
      </div>

      <div className="lineage-legend">
        <div className="legend-title">Data Lineage</div>
        <div className="legend-items">
          <span><span style={{color: '#60a5fa'}}>⬡</span> Table</span>
          <span><span style={{color: '#2dd4bf'}}>◈</span> View</span>
          <span><span style={{color: '#c084fc'}}>◎</span> Explore</span>
          <span><span style={{color: '#fbbf24'}}>▣</span> Dashboard</span>
        </div>
        <div className="legend-hint">Click node to highlight lineage • Drag to pan</div>
      </div>

      <svg
        ref={svgRef}
        className="lineage-svg"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={(e) => { e.preventDefault(); zoom(e.deltaY > 0 ? -0.1 : 0.1); }}
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      >
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#475569" />
          </marker>
          <marker id="arrow-hl" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#60a5fa" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {[{ l: 'BigQuery Tables', x: 100 }, { l: 'Looker Views', x: 300 }, { l: 'Explores', x: 500 }, { l: 'Dashboards', x: 700 }].map((h, i) => (
            <text key={i} x={h.x} y={30} textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="600">{h.l}</text>
          ))}

          {graphData.edges.map(edge => {
            const from = layout.positions[edge.from], to = layout.positions[edge.to];
            if (!from || !to) return null;
            const hl = connectedEdges.has(edge.key);
            const dim = (selectedNode || hoveredNode) && !hl;
            const x1 = from.x + from.width, y1 = from.y + from.height / 2;
            const x2 = to.x, y2 = to.y + to.height / 2;
            const mx = (x1 + x2) / 2;
            return (
              <path key={edge.key} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none" stroke={hl ? '#60a5fa' : '#334155'} strokeWidth={hl ? 2.5 : 1.5}
                strokeOpacity={dim ? 0.15 : 1} markerEnd={hl ? 'url(#arrow-hl)' : 'url(#arrow)'} />
            );
          })}

          {Object.values(layout.positions).map(node => {
            const c = colors[node.type];
            const hl = connectedNodes.has(node.id);
            const dim = (selectedNode || hoveredNode) && !hl;
            return (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                onMouseEnter={() => !selectedNode && setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }} opacity={dim ? 0.25 : 1}>
                <rect width={node.width} height={node.height} rx="8" fill={c.bg} stroke={c.border} strokeWidth={1.5} />
                <text x="12" y="18" fill={c.text} fontSize="14">{icons[node.type]}</text>
                <text x="32" y="20" fill="#e2e8f0" fontSize="11" fontWeight="500">
                  {node.label && node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label}
                </text>
                <text x="32" y="34" fill="#64748b" fontSize="9">
                  {node.type === 'dashboard' && `${node.viewCount?.toLocaleString() || 0} views`}
                  {node.type === 'explore' && (node.isHidden ? '🔒 hidden' : `${node.runtime?.toFixed(1) || 0}s`)}
                  {node.type === 'table' && node.fullPath?.split('.').slice(-2).join('.')}
                  {node.type === 'view' && 'Looker view'}
                </text>
                {node.connections > 1 && <>
                  <circle cx={node.width - 8} cy="8" r="10" fill="#475569" />
                  <text x={node.width - 8} y="12" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="600">{node.connections}</text>
                </>}
              </g>
            );
          })}
        </g>
      </svg>

      {selectedNode && layout.positions[selectedNode] && (
        <div className="info-panel">
          <div className="info-panel-header">
            <div className="info-panel-title">
              <span>{icons[layout.positions[selectedNode].type]}</span>
              <span>{layout.positions[selectedNode].label}</span>
            </div>
            <button className="close-btn" onClick={() => setSelectedNode(null)}><X size={18} /></button>
          </div>
          <div className="info-panel-stats">
            <span>Upstream: <span className="upstream">{[...connectedNodes].filter(n => n !== selectedNode && layout.positions[n]?.x < layout.positions[selectedNode]?.x).length}</span></span>
            <span>Downstream: <span className="downstream">{[...connectedNodes].filter(n => n !== selectedNode && layout.positions[n]?.x > layout.positions[selectedNode]?.x).length}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================
// MAIN APP
// ===========================================
export default function App() {
  const { core40SDK } = useContext(ExtensionContext);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('lineage');
  const [searchTerm, setSearchTerm] = useState('');
  const [runtimeThreshold, setRuntimeThreshold] = useState(10);

  // ===========================================
  // FETCH DATA FROM LOOKER
  // ===========================================
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get latest date's data only (for lineage)
      const response = await core40SDK.ok(
        core40SDK.run_inline_query({
          result_format: 'json',
          body: {
            model: 'demand_ob',
            view: 'falm_looker_mapping_d',
            fields: [
              'falm_looker_mapping_d.dashboard_id',
              'falm_looker_mapping_d.dashboard_title',
              'falm_looker_mapping_d.project_name',
              'falm_looker_mapping_d.model_name',
              'falm_looker_mapping_d.explore_name',
              'falm_looker_mapping_d.explore_is_hidden',
              'falm_looker_mapping_d.view_name',
              'falm_looker_mapping_d.sql_table_path',
              'falm_looker_mapping_d.sql_table',
              'falm_looker_mapping_d.explore_avg_runtime_seconds',
              'falm_looker_mapping_d.dashboard_view_count',
            ],
            filters: {
              'falm_looker_mapping_d.falm_stats_date': '7 days',
            },
            sorts: ['falm_looker_mapping_d.dashboard_view_count desc'],
            limit: '2000',
          },
        })
      );

      // Transform response
      const transformed = response.map(row => ({
        dashboard_id: row['falm_looker_mapping_d.dashboard_id'],
        dashboard_title: row['falm_looker_mapping_d.dashboard_title'],
        project_name: row['falm_looker_mapping_d.project_name'],
        model_name: row['falm_looker_mapping_d.model_name'],
        explore_name: row['falm_looker_mapping_d.explore_name'],
        explore_is_hidden: row['falm_looker_mapping_d.explore_is_hidden'] === 'Yes',
        view_name: row['falm_looker_mapping_d.view_name'],
        sql_table_path: row['falm_looker_mapping_d.sql_table_path'],
        sql_table: row['falm_looker_mapping_d.sql_table'],
        explore_avg_runtime_seconds: parseFloat(row['falm_looker_mapping_d.explore_avg_runtime_seconds']) || 0,
        dashboard_view_count: parseInt(row['falm_looker_mapping_d.dashboard_view_count']) || 0,
      }));

      setData(transformed);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredData = useMemo(() => 
    data.filter(item => searchTerm === '' || Object.values(item).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))),
    [data, searchTerm]
  );

  const slowQueries = useMemo(() => 
    data.filter(d => d.explore_avg_runtime_seconds > runtimeThreshold).sort((a, b) => b.explore_avg_runtime_seconds - a.explore_avg_runtime_seconds),
    [data, runtimeThreshold]
  );

  const cleanupCandidates = useMemo(() => 
    data.filter(d => d.dashboard_view_count < 50 || d.explore_is_hidden).sort((a, b) => a.dashboard_view_count - b.dashboard_view_count),
    [data]
  );

  const stats = {
    total: data.length,
    hidden: data.filter(d => d.explore_is_hidden).length,
    slow: slowQueries.length,
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <Loader2 className="spinner" />
          <p>Loading asset data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <p style={{ color: '#f87171' }}>Error: {error}</p>
          <button className="refresh-btn" onClick={fetchData} style={{ marginTop: '16px' }}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'lineage', label: 'Lineage', icon: GitBranch },
    { id: 'browse', label: 'Browse', icon: Search },
    { id: 'optimize', label: 'Slow Queries', icon: AlertTriangle },
    { id: 'cleanup', label: 'Cleanup', icon: Trash2 },
  ];

  return (
    <div className="app-container">
      <div className="header">
        <div className="header-top">
          <div>
            <h1>Looker Asset Manager</h1>
            <p>{data.length} assets loaded</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="stats-bar">
              <div className="stat-item"><span className="stat-label">Assets:</span><span className="stat-value">{stats.total}</span></div>
              <div className="stat-item warning"><span className="stat-label">Hidden:</span><span className="stat-value warning">{stats.hidden}</span></div>
              <div className="stat-item danger"><span className="stat-label">Slow:</span><span className="stat-value danger">{stats.slow}</span></div>
            </div>
            <button className="refresh-btn" onClick={fetchData}><RefreshCw size={16} /> Refresh</button>
          </div>
        </div>

        <div className="tabs">
          {tabs.map(tab => (
            <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="content">
        {activeTab === 'lineage' && <LineageGraph data={data} />}

        {activeTab === 'browse' && (
          <div className="browse-container">
            <div className="search-box">
              <Search size={18} />
              <input type="text" className="search-input" placeholder="Search dashboards, explores, views, tables..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dashboard</th>
                    <th>Project</th>
                    <th>Explore</th>
                    <th>Table</th>
                    <th className="right">Runtime</th>
                    <th className="right">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, i) => (
                    <tr key={i}>
                      <td><div className="dashboard-cell">{row.explore_is_hidden && <EyeOff size={14} className="hidden-icon" />}{row.dashboard_title}</div></td>
                      <td className="text-muted">{row.project_name}</td>
                      <td className="text-muted">{row.explore_name}</td>
                      <td className="text-muted text-mono">{row.sql_table}</td>
                      <td className={`right ${row.explore_avg_runtime_seconds > 10 ? 'text-warning' : ''}`}>{row.explore_avg_runtime_seconds.toFixed(1)}s</td>
                      <td className={`right ${row.dashboard_view_count < 50 ? 'text-danger' : ''}`}>{row.dashboard_view_count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'optimize' && (
          <div className="optimize-container">
            <div className="threshold-control">
              <label>Runtime threshold:</label>
              <input type="range" min="1" max="60" value={runtimeThreshold} onChange={(e) => setRuntimeThreshold(Number(e.target.value))} />
              <span className="value">{runtimeThreshold}s</span>
            </div>
            <div className="card-list">
              {slowQueries.map((item, i) => (
                <div key={i} className="alert-card">
                  <div className="alert-card-header">
                    <div>
                      <h3>{item.dashboard_title}</h3>
                      <p>{item.explore_name} → <span className="mono">{item.sql_table_path}</span></p>
                    </div>
                    <div className="metric warning">{item.explore_avg_runtime_seconds.toFixed(1)}s</div>
                  </div>
                </div>
              ))}
              {slowQueries.length === 0 && <p style={{color: '#64748b', textAlign: 'center', padding: '32px'}}>No slow queries found</p>}
            </div>
          </div>
        )}

        {activeTab === 'cleanup' && (
          <div className="optimize-container">
            <div className="card-list">
              {cleanupCandidates.map((item, i) => (
                <div key={i} className="alert-card danger">
                  <div className="alert-card-header">
                    <div>
                      <h3>{item.dashboard_title}{item.explore_is_hidden && <span className="badge hidden">Hidden</span>}</h3>
                      <p>{item.project_name} / {item.explore_name}</p>
                    </div>
                    <div className="metric danger">{item.dashboard_view_count}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

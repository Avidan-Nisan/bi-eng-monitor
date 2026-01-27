(function() {
  "use strict";

  const typeConfig = {
    table: { color: '#10b981', label: 'SQL Tables' },
    view: { color: '#3b82f6', label: 'Views' },
    explore: { color: '#a855f7', label: 'Explores' },
    dashboard: { color: '#f97316', label: 'Dashboards' },
  };

  const getUpstream = (entityId, allEntities, depth) => {
    if (depth === undefined) depth = 0;
    if (depth > 10) return [];
    const entity = allEntities.find(function(e) { return e.id === entityId; });
    if (!entity || !entity.sources) return [];
    let upstream = entity.sources.slice();
    entity.sources.forEach(function(srcId) { 
      upstream = upstream.concat(getUpstream(srcId, allEntities, depth + 1)); 
    });
    return Array.from(new Set(upstream));
  };

  const getDownstream = (entityId, allEntities, depth) => {
    if (depth === undefined) depth = 0;
    if (depth > 10) return [];
    let downstream = [];
    allEntities.forEach(function(e) {
      if (e.sources && e.sources.includes(entityId)) {
        downstream.push(e.id);
        downstream = downstream.concat(getDownstream(e.id, allEntities, depth + 1));
      }
    });
    return Array.from(new Set(downstream));
  };

  const parseData = (rows) => {
    const tables = new Map(), views = new Map(), explores = new Map(), dashboards = new Map();
    const viewToTables = new Map(), exploreToViews = new Map(), dashToExplores = new Map();

    rows.forEach(function(row) {
      const tbl = row['looker_dashboard_table_mapping.table_name_short'];
      const vw = row['looker_dashboard_table_mapping.view_name'];
      const exp = row['looker_dashboard_table_mapping.explore_name'];
      const dash = row['looker_dashboard_table_mapping.dashboard_title'];

      if (tbl) tables.set(tbl, { id: 't_' + tbl, name: tbl, type: 'table' });
      if (vw) views.set(vw, { id: 'v_' + vw, name: vw, type: 'view', sources: [] });
      if (exp) explores.set(exp, { id: 'e_' + exp, name: exp, type: 'explore', sources: [] });
      if (dash) dashboards.set(dash, { id: 'd_' + dash, name: dash, type: 'dashboard', sources: [] });

      if (vw && tbl) {
        if (!viewToTables.has(vw)) viewToTables.set(vw, new Set());
        viewToTables.get(vw).add('t_' + tbl);
      }
      if (exp && vw) {
        if (!exploreToViews.has(exp)) exploreToViews.set(exp, new Set());
        exploreToViews.get(exp).add('v_' + vw);
      }
      if (dash && exp) {
        if (!dashToExplores.has(dash)) dashToExplores.set(dash, new Set());
        dashToExplores.get(dash).add('e_' + exp);
      }
    });

    views.forEach(function(v, k) { v.sources = Array.from(viewToTables.get(k) || []); });
    explores.forEach(function(e, k) { e.sources = Array.from(exploreToViews.get(k) || []); });
    dashboards.forEach(function(d, k) { d.sources = Array.from(dashToExplores.get(k) || []); });

    return {
      tables: Array.from(tables.values()),
      views: Array.from(views.values()),
      explores: Array.from(explores.values()),
      dashboards: Array.from(dashboards.values())
    };
  };

  const renderApp = (sdk) => {
    const container = document.getElementById('root') || document.body;
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1a;color:white;"><div style="text-align:center;"><div style="font-size:24px;margin-bottom:16px;">⏳</div><div>Loading lineage data...</div></div></div>';

    sdk.ok(sdk.run_inline_query({
      result_format: 'json',
      body: {
        model: 'demand_ob',
        view: 'looker_dashboard_table_mapping',
        fields: [
          'looker_dashboard_table_mapping.dashboard_title',
          'looker_dashboard_table_mapping.explore_name',
          'looker_dashboard_table_mapping.view_name',
          'looker_dashboard_table_mapping.table_name_short'
        ],
        filters: {
          'looker_dashboard_table_mapping.partition_date': '1 day ago'
        },
        limit: '5000'
      }
    })).then(function(response) {
      const data = parseData(response);
      renderGraph(container, data);
    }).catch(function(err) {
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1a;color:#ef4444;"><div style="text-align:center;"><div style="font-size:24px;margin-bottom:16px;">❌</div><div>Error: ' + (err.message || 'Failed to fetch data') + '</div></div></div>';
    });
  };

  const renderGraph = (container, data) => {
    const allEntities = data.tables.concat(data.views).concat(data.explores).concat(data.dashboards);
    const colX = { table: 80, view: 300, explore: 520, dashboard: 740 };
    const nodeW = 160, nodeH = 50;
    const counts = { table: 0, view: 0, explore: 0, dashboard: 0 };
    const totals = { table: data.tables.length, view: data.views.length, explore: data.explores.length, dashboard: data.dashboards.length };
    const maxCount = Math.max(totals.table, totals.view, totals.explore, totals.dashboard);
    const positions = {};

    allEntities.forEach(function(e) {
      const startY = (maxCount - totals[e.type]) * 35 + 60;
      positions[e.id] = { x: colX[e.type], y: startY + counts[e.type] * 70 };
      counts[e.type]++;
    });

    const svgHeight = maxCount * 70 + 120;
    let selected = null;
    let upstream = [];
    let downstream = [];

    const render = () => {
      const edges = [];
      allEntities.forEach(function(entity) {
        if (entity.sources) {
          entity.sources.forEach(function(srcId) {
            edges.push({ from: srcId, to: entity.id });
          });
        }
      });

      let edgesHtml = '';
      edges.forEach(function(edge) {
        const from = positions[edge.from];
        const to = positions[edge.to];
        if (!from || !to) return;
        
        let stroke = '#334155', opacity = 0.4, strokeWidth = 1.5;
        if (selected) {
          const isUpstream = upstream.includes(edge.from) && (upstream.includes(edge.to) || edge.to === selected.id);
          const isDownstream = downstream.includes(edge.to) && (downstream.includes(edge.from) || edge.from === selected.id);
          if (edge.from === selected.id || isDownstream) { stroke = '#f97316'; opacity = 1; strokeWidth = 2.5; }
          else if (edge.to === selected.id || isUpstream) { stroke = '#22d3ee'; opacity = 1; strokeWidth = 2.5; }
          else { opacity = 0; }
        }
        if (opacity === 0) return;
        
        const x1 = from.x + nodeW, y1 = from.y + nodeH/2;
        const x2 = to.x, y2 = to.y + nodeH/2;
        const midX = (x1 + x2) / 2;
        const markerId = stroke === '#22d3ee' ? 'arrowCyan' : stroke === '#f97316' ? 'arrowOrange' : 'arrowGray';
        edgesHtml += '<path d="M ' + x1 + ' ' + y1 + ' C ' + midX + ' ' + y1 + ', ' + midX + ' ' + y2 + ', ' + x2 + ' ' + y2 + '" fill="none" stroke="' + stroke + '" stroke-width="' + strokeWidth + '" stroke-opacity="' + opacity + '" marker-end="url(#' + markerId + ')"/>';
      });

      let nodesHtml = '';
      allEntities.forEach(function(entity) {
        const pos = positions[entity.id];
        const cfg = typeConfig[entity.type];
        let style = 'normal';
        if (selected) {
          if (selected.id === entity.id) style = 'selected';
          else if (upstream.includes(entity.id)) style = 'upstream';
          else if (downstream.includes(entity.id)) style = 'downstream';
          else style = 'dimmed';
        }
        
        const opacity = style === 'dimmed' ? 0 : 1;
        if (opacity === 0) return;
        
        const isHighlighted = style === 'selected' || style === 'upstream' || style === 'downstream';
        const strokeColor = style === 'upstream' ? '#22d3ee' : style === 'downstream' ? '#f97316' : style === 'selected' ? '#fff' : cfg.color;
        const icon = entity.type === 'table' ? '🗄' : entity.type === 'view' ? '👁' : entity.type === 'explore' ? '🔍' : '📊';
        const displayName = entity.name.length > 14 ? entity.name.slice(0, 13) + '…' : entity.name;
        
        nodesHtml += '<g data-id="' + entity.id + '" style="cursor:pointer;opacity:' + opacity + ';" transform="translate(' + pos.x + ', ' + pos.y + ')">';
        if (isHighlighted) {
          nodesHtml += '<rect x="-4" y="-4" width="' + (nodeW + 8) + '" height="' + (nodeH + 8) + '" rx="14" fill="none" stroke="' + strokeColor + '" stroke-width="2"/>';
        }
        nodesHtml += '<rect width="' + nodeW + '" height="' + nodeH + '" rx="10" fill="#0f172a" stroke="' + cfg.color + '" stroke-width="' + (isHighlighted ? 2 : 1) + '" stroke-opacity="' + (isHighlighted ? 1 : 0.5) + '"/>';
        nodesHtml += '<rect x="0" y="0" width="32" height="' + nodeH + '" rx="10" fill="' + cfg.color + '"/>';
        nodesHtml += '<rect x="10" y="0" width="22" height="' + nodeH + '" fill="' + cfg.color + '"/>';
        nodesHtml += '<text x="16" y="' + (nodeH/2 + 5) + '" fill="white" font-size="14" text-anchor="middle">' + icon + '</text>';
        nodesHtml += '<text x="42" y="' + (nodeH/2 - 4) + '" fill="white" font-size="10" font-weight="500">' + displayName + '</text>';
        nodesHtml += '<text x="42" y="' + (nodeH/2 + 10) + '" fill="' + cfg.color + '" font-size="8" opacity="0.8">' + entity.type + '</text>';
        nodesHtml += '</g>';
      });

      let colHeaders = '';
      Object.keys(typeConfig).forEach(function(type) {
        const cfg = typeConfig[type];
        colHeaders += '<text x="' + (colX[type] + nodeW/2) + '" y="30" text-anchor="middle" fill="' + cfg.color + '" font-size="12" font-weight="600">' + cfg.label + '</text>';
        colHeaders += '<line x1="' + (colX[type] + nodeW/2) + '" y1="40" x2="' + (colX[type] + nodeW/2) + '" y2="' + (svgHeight - 20) + '" stroke="' + cfg.color + '" stroke-opacity="0.1" stroke-width="2" stroke-dasharray="4"/>';
      });

      const headerInfo = selected 
        ? '<span style="color:#9ca3af;">Selected: </span><span style="font-weight:600;color:' + typeConfig[selected.type].color + ';">' + selected.name + '</span> <span style="color:#22d3ee;margin-left:16px;">↑ ' + upstream.length + '</span> <span style="color:#f97316;margin-left:8px;">↓ ' + downstream.length + '</span> <button id="clearBtn" style="background:none;border:none;color:white;cursor:pointer;margin-left:16px;">✕</button>'
        : '<span style="color:#9ca3af;">Click any node to see lineage</span>';

      container.innerHTML = 
        '<div style="min-height:100vh;background:#0a0f1a;color:white;overflow:hidden;">' +
          '<div style="border-bottom:1px solid rgba(255,255,255,0.1);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,0.4);">' +
            '<div style="display:flex;align-items:center;gap:12px;">' +
              '<div style="padding:8px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#9333ea);">📊</div>' +
              '<div><h1 style="margin:0;font-size:18px;font-weight:bold;">Looker Lineage Graph</h1><p style="margin:0;font-size:12px;color:#6b7280;">' + allEntities.length + ' entities</p></div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:16px;">' +
              '<div style="padding:8px 16px;background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid rgba(255,255,255,0.1);font-size:14px;">' + headerInfo + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="padding:24px;overflow:auto;height:calc(100vh - 70px);">' +
            '<svg width="950" height="' + svgHeight + '">' +
              '<defs>' +
                '<marker id="arrowGray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#334155"/></marker>' +
                '<marker id="arrowCyan" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee"/></marker>' +
                '<marker id="arrowOrange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316"/></marker>' +
              '</defs>' +
              colHeaders + edgesHtml + nodesHtml +
            '</svg>' +
          '</div>' +
          '<div style="position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:24px;padding:12px 24px;background:rgba(0,0,0,0.6);backdrop-filter:blur(12px);border-radius:9999px;border:1px solid rgba(255,255,255,0.1);font-size:12px;">' +
            '<div style="display:flex;align-items:center;gap:8px;"><div style="width:32px;height:2px;background:#22d3ee;border-radius:2px;"></div><span style="color:#22d3ee;">Upstream</span></div>' +
            '<div style="display:flex;align-items:center;gap:8px;"><div style="width:32px;height:2px;background:#f97316;border-radius:2px;"></div><span style="color:#f97316;">Downstream</span></div>' +
          '</div>' +
        '</div>';

      // Add click handlers
      container.querySelectorAll('g[data-id]').forEach(function(node) {
        node.addEventListener('click', function() {
          const id = node.getAttribute('data-id');
          const entity = allEntities.find(function(e) { return e.id === id; });
          if (selected && selected.id === id) {
            selected = null;
            upstream = [];
            downstream = [];
          } else {
            selected = entity;
            upstream = getUpstream(entity.id, allEntities, 0);
            downstream = getDownstream(entity.id, allEntities, 0);
          }
          render();
        });
      });

      const clearBtn = document.getElementById('clearBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', function() {
          selected = null;
          upstream = [];
          downstream = [];
          render();
        });
      }
    };

    render();
  };

  // Looker Extension initialization
  if (window.lookerExtensionSDK) {
    window.lookerExtensionSDK.init().then(function(sdk) {
      renderApp(sdk.core40SDK);
    });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      if (window.lookerExtensionSDK) {
        window.lookerExtensionSDK.init().then(function(sdk) {
          renderApp(sdk.core40SDK);
        });
      } else {
        document.body.innerHTML = '<div style="padding:20px;color:red;">Looker Extension SDK not found. Make sure this is running inside Looker.</div>';
      }
    });
  }
})();

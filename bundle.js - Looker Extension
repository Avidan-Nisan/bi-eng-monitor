(function(exports, require, module, __filename, __dirname) {
  const React = window.React || require('react');
  const ReactDOM = window.ReactDOM || require('react-dom');
  const { ExtensionProvider, ExtensionContext } = window.LookerExtensionSDK || require('@looker/extension-sdk-react');

  const { useState, useEffect, useMemo, useContext } = React;

  const typeConfig = {
    table: { color: '#10b981', label: 'SQL Tables' },
    view: { color: '#3b82f6', label: 'Views' },
    explore: { color: '#a855f7', label: 'Explores' },
    dashboard: { color: '#f97316', label: 'Dashboards' },
  };

  const getUpstream = (entityId, allEntities, depth = 0) => {
    if (depth > 10) return [];
    const entity = allEntities.find(e => e.id === entityId);
    if (!entity?.sources) return [];
    let upstream = [...entity.sources];
    entity.sources.forEach(srcId => { upstream = [...upstream, ...getUpstream(srcId, allEntities, depth + 1)]; });
    return [...new Set(upstream)];
  };

  const getDownstream = (entityId, allEntities, depth = 0) => {
    if (depth > 10) return [];
    let downstream = [];
    allEntities.forEach(e => {
      if (e.sources?.includes(entityId)) {
        downstream.push(e.id);
        downstream = [...downstream, ...getDownstream(e.id, allEntities, depth + 1)];
      }
    });
    return [...new Set(downstream)];
  };

  const parseData = (rows) => {
    const tables = new Map(), views = new Map(), explores = new Map(), dashboards = new Map();
    const viewToTables = new Map(), exploreToViews = new Map(), dashToExplores = new Map();

    rows.forEach(row => {
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

    views.forEach((v, k) => v.sources = [...(viewToTables.get(k) || [])]);
    explores.forEach((e, k) => e.sources = [...(exploreToViews.get(k) || [])]);
    dashboards.forEach((d, k) => d.sources = [...(dashToExplores.get(k) || [])]);

    return {
      tables: [...tables.values()],
      views: [...views.values()],
      explores: [...explores.values()],
      dashboards: [...dashboards.values()]
    };
  };

  const LineageGraph = () => {
    const { core40SDK } = useContext(ExtensionContext);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);
    const [zoom, setZoom] = useState(1);

    useEffect(() => {
      const fetchData = async () => {
        try {
          const response = await core40SDK.ok(core40SDK.run_inline_query({
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
          }));
          setData(parseData(response));
        } catch (err) {
          setError(err.message || 'Failed to fetch data');
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }, [core40SDK]);

    const allEntities = useMemo(() => {
      if (!data) return [];
      return [...data.tables, ...data.views, ...data.explores, ...data.dashboards];
    }, [data]);

    const colX = { table: 80, view: 300, explore: 520, dashboard: 740 };
    const nodeW = 160, nodeH = 50;

    const positions = useMemo(() => {
      if (!data) return {};
      const pos = {};
      const counts = { table: 0, view: 0, explore: 0, dashboard: 0 };
      const totals = { table: data.tables.length, view: data.views.length, explore: data.explores.length, dashboard: data.dashboards.length };
      const maxCount = Math.max(...Object.values(totals));
      
      allEntities.forEach(e => {
        const startY = (maxCount - totals[e.type]) * 35 + 60;
        pos[e.id] = { x: colX[e.type], y: startY + counts[e.type] * 70 };
        counts[e.type]++;
      });
      return pos;
    }, [data, allEntities]);

    const { upstream, downstream } = useMemo(() => {
      if (!selected) return { upstream: [], downstream: [] };
      return { upstream: getUpstream(selected.id, allEntities), downstream: getDownstream(selected.id, allEntities) };
    }, [selected, allEntities]);

    const edges = useMemo(() => {
      const e = [];
      allEntities.forEach(entity => {
        if (entity.sources) {
          entity.sources.forEach(srcId => {
            e.push({ from: srcId, to: entity.id });
          });
        }
      });
      return e;
    }, [allEntities]);

    const getEdgeStyle = (from, to) => {
      if (!selected) return { stroke: '#334155', opacity: 0.4 };
      const isUpstream = upstream.includes(from) && (upstream.includes(to) || to === selected.id);
      const isDownstream = downstream.includes(to) && (downstream.includes(from) || from === selected.id);
      if (from === selected.id || isDownstream) return { stroke: '#f97316', opacity: 1 };
      if (to === selected.id || isUpstream) return { stroke: '#22d3ee', opacity: 1 };
      return { stroke: '#334155', opacity: 0 };
    };

    const getNodeStyle = (entityId) => {
      if (selected?.id === entityId) return 'selected';
      if (upstream.includes(entityId)) return 'upstream';
      if (downstream.includes(entityId)) return 'downstream';
      if (selected) return 'dimmed';
      return 'normal';
    };

    if (loading) return React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0f1a', color: 'white' } },
      React.createElement('div', { style: { textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: '24px', marginBottom: '16px' } }, '⏳'),
        React.createElement('div', null, 'Loading lineage data...')
      )
    );

    if (error) return React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0f1a', color: '#ef4444' } },
      React.createElement('div', { style: { textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: '24px', marginBottom: '16px' } }, '❌'),
        React.createElement('div', null, 'Error: ' + error)
      )
    );

    const svgHeight = data ? Math.max(data.tables.length, data.views.length, data.explores.length, data.dashboards.length) * 70 + 120 : 400;

    return React.createElement('div', { style: { minHeight: '100vh', background: '#0a0f1a', color: 'white', overflow: 'hidden' } },
      React.createElement('div', { style: { borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.4)' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
          React.createElement('div', { style: { padding: '8px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #9333ea)' } }, '📊'),
          React.createElement('div', null,
            React.createElement('h1', { style: { margin: 0, fontSize: '18px', fontWeight: 'bold' } }, 'Looker Lineage Graph'),
            React.createElement('p', { style: { margin: 0, fontSize: '12px', color: '#6b7280' } }, allEntities.length + ' entities')
          )
        ),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '16px' } },
          selected && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' } },
            React.createElement('span', { style: { fontSize: '14px' } },
              React.createElement('span', { style: { color: '#9ca3af' } }, 'Selected: '),
              React.createElement('span', { style: { fontWeight: '600', color: typeConfig[selected.type].color } }, selected.name)
            ),
            React.createElement('span', { style: { fontSize: '12px', color: '#22d3ee' } }, '↑ ' + upstream.length),
            React.createElement('span', { style: { fontSize: '12px', color: '#f97316' } }, '↓ ' + downstream.length),
            React.createElement('button', { onClick: () => setSelected(null), style: { background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' } }, '✕')
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' } },
            React.createElement('button', { onClick: () => setZoom(z => Math.max(0.3, z - 0.1)), style: { background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '8px' } }, '➖'),
            React.createElement('span', { style: { fontSize: '12px', width: '48px', textAlign: 'center' } }, Math.round(zoom * 100) + '%'),
            React.createElement('button', { onClick: () => setZoom(z => Math.min(1.5, z + 0.1)), style: { background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '8px' } }, '➕')
          )
        )
      ),
      React.createElement('div', { style: { padding: '24px', overflow: 'auto', height: 'calc(100vh - 70px)' } },
        React.createElement('svg', { width: 950 * zoom, height: svgHeight * zoom, style: { transform: 'scale(' + zoom + ')', transformOrigin: 'top left' } },
          React.createElement('defs', null,
            React.createElement('marker', { id: 'arrowGray', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' },
              React.createElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#334155' })
            ),
            React.createElement('marker', { id: 'arrowCyan', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' },
              React.createElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#22d3ee' })
            ),
            React.createElement('marker', { id: 'arrowOrange', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' },
              React.createElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#f97316' })
            )
          ),
          Object.entries(typeConfig).map(([type, cfg]) =>
            React.createElement('g', { key: type },
              React.createElement('text', { x: colX[type] + nodeW/2, y: 30, textAnchor: 'middle', fill: cfg.color, fontSize: '12', fontWeight: '600' }, cfg.label),
              React.createElement('line', { x1: colX[type] + nodeW/2, y1: 40, x2: colX[type] + nodeW/2, y2: svgHeight - 20, stroke: cfg.color, strokeOpacity: '0.1', strokeWidth: '2', strokeDasharray: '4' })
            )
          ),
          edges.map((edge, i) => {
            const from = positions[edge.from];
            const to = positions[edge.to];
            if (!from || !to) return null;
            const style = getEdgeStyle(edge.from, edge.to);
            if (selected && style.opacity === 0) return null;
            const x1 = from.x + nodeW, y1 = from.y + nodeH/2;
            const x2 = to.x, y2 = to.y + nodeH/2;
            const midX = (x1 + x2) / 2;
            const marker = style.stroke === '#22d3ee' ? 'url(#arrowCyan)' : style.stroke === '#f97316' ? 'url(#arrowOrange)' : 'url(#arrowGray)';
            return React.createElement('path', { key: i, d: 'M ' + x1 + ' ' + y1 + ' C ' + midX + ' ' + y1 + ', ' + midX + ' ' + y2 + ', ' + x2 + ' ' + y2, fill: 'none', stroke: style.stroke, strokeWidth: style.opacity === 1 ? 2.5 : 1.5, strokeOpacity: style.opacity, markerEnd: marker });
          }),
          allEntities.map(entity => {
            const pos = positions[entity.id];
            if (!pos) return null;
            const cfg = typeConfig[entity.type];
            const style = getNodeStyle(entity.id);
            const opacity = style === 'dimmed' ? 0 : 1;
            const isHighlighted = style === 'selected' || style === 'upstream' || style === 'downstream';
            const strokeColor = style === 'upstream' ? '#22d3ee' : style === 'downstream' ? '#f97316' : style === 'selected' ? '#fff' : cfg.color;
            
            return React.createElement('g', { key: entity.id, onClick: () => setSelected(selected?.id === entity.id ? null : entity), style: { cursor: 'pointer', opacity: opacity, transition: 'opacity 0.3s' }, transform: 'translate(' + pos.x + ', ' + pos.y + ')' },
              isHighlighted && React.createElement('rect', { x: '-4', y: '-4', width: nodeW + 8, height: nodeH + 8, rx: '14', fill: 'none', stroke: strokeColor, strokeWidth: '2' }),
              React.createElement('rect', { width: nodeW, height: nodeH, rx: '10', fill: '#0f172a', stroke: cfg.color, strokeWidth: isHighlighted ? 2 : 1, strokeOpacity: isHighlighted ? 1 : 0.5 }),
              React.createElement('rect', { x: '0', y: '0', width: '32', height: nodeH, rx: '10', fill: cfg.color }),
              React.createElement('rect', { x: '10', y: '0', width: '22', height: nodeH, fill: cfg.color }),
              React.createElement('text', { x: '16', y: nodeH/2 + 4, fill: 'white', fontSize: '14', textAnchor: 'middle' }, entity.type === 'table' ? '🗄' : entity.type === 'view' ? '👁' : entity.type === 'explore' ? '🔍' : '📊'),
              React.createElement('text', { x: '42', y: nodeH/2 - 4, fill: 'white', fontSize: '10', fontWeight: '500' }, entity.name.length > 14 ? entity.name.slice(0, 13) + '…' : entity.name),
              React.createElement('text', { x: '42', y: nodeH/2 + 10, fill: cfg.color, fontSize: '8', opacity: '0.8' }, entity.type)
            );
          })
        )
      ),
      React.createElement('div', { style: { position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '24px', padding: '12px 24px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          React.createElement('div', { style: { width: '32px', height: '2px', background: '#22d3ee', borderRadius: '2px' } }),
          React.createElement('span', { style: { color: '#22d3ee' } }, 'Upstream')
        ),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          React.createElement('div', { style: { width: '32px', height: '2px', background: '#f97316', borderRadius: '2px' } }),
          React.createElement('span', { style: { color: '#f97316' } }, 'Downstream')
        )
      )
    );
  };

  const App = () => {
    return React.createElement(ExtensionProvider, null,
      React.createElement(LineageGraph, null)
    );
  };

  window.addEventListener('load', () => {
    const root = document.getElementById('root') || document.body;
    ReactDOM.render(React.createElement(App), root);
  });

  if (typeof module !== 'undefined') {
    module.exports = { App, LineageGraph };
  }
})(typeof exports !== 'undefined' ? exports : {}, typeof require !== 'undefined' ? require : () => {}, typeof module !== 'undefined' ? module : {});

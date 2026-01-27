(function(window) {
  'use strict';
  
  // Looker Extension SDK connection
  var extensionSDK = null;
  var coreSDK = null;
  
  function connectToLooker() {
    var container = document.body;
    container.style.margin = '0';
    container.style.padding = '0';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    
    container.innerHTML = 
      '<div style="padding:40px;background:#0a0f1a;min-height:100vh;color:white;">' +
        '<h1 style="color:#3b82f6;margin-bottom:16px;">✅ Extension Connected!</h1>' +
        '<p style="color:#9ca3af;">Initializing Looker SDK...</p>' +
        '<div id="content" style="margin-top:24px;"></div>' +
      '</div>';
    
    var contentDiv = document.getElementById('content');
    
    // Use postMessage to communicate with Looker
    window.addEventListener('message', function(event) {
      // Verify origin
      if (window.lookerHostOrigin && event.origin !== window.lookerHostOrigin) {
        return;
      }
      
      try {
        var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        if (data.type === 'EXTENSION_SDK_READY') {
          contentDiv.innerHTML = '<p style="color:#22d3ee;">SDK Ready! Fetching data...</p>';
          fetchDataViaMessage();
        }
        
        if (data.type === 'QUERY_RESULT') {
          contentDiv.innerHTML = '<p style="color:#10b981;">Data received!</p>';
          renderGraph(data.payload);
        }
        
        if (data.type === 'QUERY_ERROR') {
          contentDiv.innerHTML = '<p style="color:#ef4444;">Query Error: ' + data.payload + '</p>';
        }
      } catch (e) {
        // Not a JSON message, ignore
      }
    });
    
    // Try to initialize via the Looker extension handshake
    setTimeout(function() {
      if (window.lookerHostOrigin) {
        window.parent.postMessage(JSON.stringify({
          type: 'EXTENSION_API_REQUEST',
          payload: { type: 'INIT' }
        }), window.lookerHostOrigin);
      }
      
      // Fallback: try direct fetch if SDK not available after 2 seconds
      setTimeout(function() {
        if (contentDiv.innerHTML.indexOf('Fetching') === -1 && contentDiv.innerHTML.indexOf('Data received') === -1) {
          contentDiv.innerHTML = '<p style="color:#f97316;">SDK handshake timeout. Trying direct API...</p>';
          tryDirectAPI();
        }
      }, 2000);
    }, 500);
  }
  
  function fetchDataViaMessage() {
    if (window.lookerHostOrigin) {
      window.parent.postMessage(JSON.stringify({
        type: 'EXTENSION_API_REQUEST',
        payload: {
          type: 'RUN_INLINE_QUERY',
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
            limit: '500'
          }
        }
      }), window.lookerHostOrigin);
    }
  }
  
  function tryDirectAPI() {
    var contentDiv = document.getElementById('content');
    
    // Get the Looker host from the metadata
    var host = window.lookerHostOrigin || '';
    if (!host) {
      contentDiv.innerHTML = '<p style="color:#ef4444;">No Looker host origin found</p>';
      return;
    }
    
    contentDiv.innerHTML = '<p style="color:#22d3ee;">Attempting direct API call to ' + host + '...</p>';
    
    // Try using fetch with credentials
    fetch(host + '/api/4.0/queries/run/json', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
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
        limit: '500'
      })
    })
    .then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function(data) {
      contentDiv.innerHTML = '<p style="color:#10b981;">✅ Loaded ' + data.length + ' rows via direct API!</p>';
      renderGraph(data);
    })
    .catch(function(err) {
      contentDiv.innerHTML = 
        '<p style="color:#ef4444;">Direct API failed: ' + err.message + '</p>' +
        '<p style="color:#6b7280;margin-top:16px;font-size:13px;">The extension needs proper SDK integration. Please check:</p>' +
        '<ul style="color:#6b7280;font-size:13px;">' +
          '<li>manifest.lkml has correct entitlements</li>' +
          '<li>Extension Framework is enabled in Admin</li>' +
          '<li>You have access to the explore</li>' +
        '</ul>' +
        '<p style="color:#9ca3af;margin-top:16px;">Host: ' + host + '</p>' +
        '<p style="color:#9ca3af;">Metadata: ' + JSON.stringify(window.lookerExtensionMetadata || 'none') + '</p>';
    });
  }
  
  function renderGraph(rows) {
    // Parse data
    var tables = {}, views = {}, explores = {}, dashboards = {};
    var viewToTables = {}, exploreToViews = {}, dashToExplores = {};
    
    rows.forEach(function(row) {
      var tbl = row['looker_dashboard_table_mapping.table_name_short'] || row['table_name_short'];
      var vw = row['looker_dashboard_table_mapping.view_name'] || row['view_name'];
      var exp = row['looker_dashboard_table_mapping.explore_name'] || row['explore_name'];
      var dash = row['looker_dashboard_table_mapping.dashboard_title'] || row['dashboard_title'];
      
      if (tbl && !tables[tbl]) tables[tbl] = { id: 't_' + tbl, name: tbl, type: 'table', sources: [] };
      if (vw && !views[vw]) views[vw] = { id: 'v_' + vw, name: vw, type: 'view', sources: [] };
      if (exp && !explores[exp]) explores[exp] = { id: 'e_' + exp, name: exp, type: 'explore', sources: [] };
      if (dash && !dashboards[dash]) dashboards[dash] = { id: 'd_' + dash, name: dash, type: 'dashboard', sources: [] };
      
      if (vw && tbl) {
        if (!viewToTables[vw]) viewToTables[vw] = {};
        viewToTables[vw]['t_' + tbl] = true;
      }
      if (exp && vw) {
        if (!exploreToViews[exp]) exploreToViews[exp] = {};
        exploreToViews[exp]['v_' + vw] = true;
      }
      if (dash && exp) {
        if (!dashToExplores[dash]) dashToExplores[dash] = {};
        dashToExplores[dash]['e_' + exp] = true;
      }
    });
    
    Object.keys(views).forEach(function(k) { views[k].sources = Object.keys(viewToTables[k] || {}); });
    Object.keys(explores).forEach(function(k) { explores[k].sources = Object.keys(exploreToViews[k] || {}); });
    Object.keys(dashboards).forEach(function(k) { dashboards[k].sources = Object.keys(dashToExplores[k] || {}); });
    
    var allEntities = Object.values(tables).concat(Object.values(views)).concat(Object.values(explores)).concat(Object.values(dashboards));
    
    var typeConfig = {
      table: { color: '#10b981', label: 'SQL Tables' },
      view: { color: '#3b82f6', label: 'Views' },
      explore: { color: '#a855f7', label: 'Explores' },
      dashboard: { color: '#f97316', label: 'Dashboards' }
    };
    
    var colX = { table: 50, view: 220, explore: 390, dashboard: 560 };
    var nodeW = 150, nodeH = 40;
    var counts = { table: 0, view: 0, explore: 0, dashboard: 0 };
    var positions = {};
    
    allEntities.forEach(function(e) {
      positions[e.id] = { x: colX[e.type], y: 60 + counts[e.type] * 50 };
      counts[e.type]++;
    });
    
    var maxCount = Math.max(counts.table, counts.view, counts.explore, counts.dashboard);
    var svgHeight = maxCount * 50 + 100;
    
    var selected = null;
    var upstream = [];
    var downstream = [];
    
    function getUpstream(entityId, depth) {
      if (depth > 10) return [];
      var entity = allEntities.find(function(e) { return e.id === entityId; });
      if (!entity || !entity.sources) return [];
      var result = entity.sources.slice();
      entity.sources.forEach(function(srcId) {
        result = result.concat(getUpstream(srcId, (depth || 0) + 1));
      });
      return result.filter(function(v, i, a) { return a.indexOf(v) === i; });
    }
    
    function getDownstream(entityId, depth) {
      if (depth > 10) return [];
      var result = [];
      allEntities.forEach(function(e) {
        if (e.sources && e.sources.indexOf(entityId) !== -1) {
          result.push(e.id);
          result = result.concat(getDownstream(e.id, (depth || 0) + 1));
        }
      });
      return result.filter(function(v, i, a) { return a.indexOf(v) === i; });
    }
    
    function render() {
      var edges = [];
      allEntities.forEach(function(entity) {
        (entity.sources || []).forEach(function(srcId) {
          edges.push({ from: srcId, to: entity.id });
        });
      });
      
      var edgesHtml = '';
      edges.forEach(function(edge) {
        var from = positions[edge.from];
        var to = positions[edge.to];
        if (!from || !to) return;
        
        var stroke = '#334155', opacity = 0.3, sw = 1;
        if (selected) {
          var isUp = upstream.indexOf(edge.from) !== -1 && (upstream.indexOf(edge.to) !== -1 || edge.to === selected.id);
          var isDown = downstream.indexOf(edge.to) !== -1 && (downstream.indexOf(edge.from) !== -1 || edge.from === selected.id);
          if (edge.from === selected.id || isDown) { stroke = '#f97316'; opacity = 1; sw = 2; }
          else if (edge.to === selected.id || isUp) { stroke = '#22d3ee'; opacity = 1; sw = 2; }
          else { opacity = 0; }
        }
        if (opacity === 0) return;
        
        var x1 = from.x + nodeW, y1 = from.y + nodeH/2;
        var x2 = to.x, y2 = to.y + nodeH/2;
        var mx = (x1 + x2) / 2;
        edgesHtml += '<path d="M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ',' + mx + ' ' + y2 + ',' + x2 + ' ' + y2 + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-opacity="' + opacity + '" marker-end="url(#arrow' + (stroke === '#22d3ee' ? 'Cyan' : stroke === '#f97316' ? 'Orange' : 'Gray') + ')"/>';
      });
      
      var nodesHtml = '';
      allEntities.forEach(function(entity) {
        var pos = positions[entity.id];
        var cfg = typeConfig[entity.type];
        var style = 'normal';
        if (selected) {
          if (selected.id === entity.id) style = 'selected';
          else if (upstream.indexOf(entity.id) !== -1) style = 'upstream';
          else if (downstream.indexOf(entity.id) !== -1) style = 'downstream';
          else style = 'dimmed';
        }
        if (style === 'dimmed') return;
        
        var strokeCol = style === 'upstream' ? '#22d3ee' : style === 'downstream' ? '#f97316' : style === 'selected' ? '#fff' : cfg.color;
        var sw = (style !== 'normal') ? 2 : 1;
        var name = entity.name.length > 16 ? entity.name.substring(0, 15) + '…' : entity.name;
        
        nodesHtml += '<g data-id="' + entity.id + '" style="cursor:pointer;" transform="translate(' + pos.x + ',' + pos.y + ')">';
        nodesHtml += '<rect width="' + nodeW + '" height="' + nodeH + '" rx="6" fill="#1e293b" stroke="' + strokeCol + '" stroke-width="' + sw + '"/>';
        nodesHtml += '<rect width="28" height="' + nodeH + '" rx="6" fill="' + cfg.color + '"/>';
        nodesHtml += '<rect x="6" width="22" height="' + nodeH + '" fill="' + cfg.color + '"/>';
        nodesHtml += '<text x="14" y="' + (nodeH/2 + 4) + '" fill="#fff" font-size="12" text-anchor="middle">' + (entity.type === 'table' ? '⬚' : entity.type === 'view' ? '◉' : entity.type === 'explore' ? '⬡' : '▦') + '</text>';
        nodesHtml += '<text x="36" y="' + (nodeH/2 + 4) + '" fill="#fff" font-size="11">' + name + '</text>';
        nodesHtml += '</g>';
      });
      
      var headerHtml = '';
      Object.keys(typeConfig).forEach(function(type) {
        var cfg = typeConfig[type];
        headerHtml += '<text x="' + (colX[type] + nodeW/2) + '" y="24" text-anchor="middle" fill="' + cfg.color + '" font-size="11" font-weight="600">' + cfg.label + '</text>';
      });
      
      var info = selected 
        ? 'Selected: ' + selected.name + ' | ↑' + upstream.length + ' ↓' + downstream.length
        : 'Click any node to see lineage';
      
      document.body.innerHTML = 
        '<div style="background:#0a0f1a;min-height:100vh;color:#fff;padding:16px;">' +
          '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">' +
            '<div style="padding:8px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#9333ea);">📊</div>' +
            '<div><div style="font-size:16px;font-weight:600;">Looker Lineage Graph</div><div style="font-size:12px;color:#6b7280;">' + allEntities.length + ' entities</div></div>' +
            '<div style="margin-left:auto;padding:8px 16px;background:rgba(255,255,255,0.05);border-radius:6px;font-size:13px;">' + info + (selected ? ' <span id="clearBtn" style="color:#6b7280;cursor:pointer;margin-left:8px;">[clear]</span>' : '') + '</div>' +
          '</div>' +
          '<div style="overflow:auto;">' +
            '<svg width="750" height="' + svgHeight + '" style="font-family:system-ui,sans-serif;">' +
              '<defs>' +
                '<marker id="arrowGray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#334155"/></marker>' +
                '<marker id="arrowCyan" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#22d3ee"/></marker>' +
                '<marker id="arrowOrange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#f97316"/></marker>' +
              '</defs>' +
              headerHtml + edgesHtml + nodesHtml +
            '</svg>' +
          '</div>' +
          '<div style="position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:16px;padding:8px 20px;background:rgba(0,0,0,0.7);border-radius:20px;font-size:11px;">' +
            '<span style="color:#22d3ee;">— Upstream</span><span style="color:#f97316;">— Downstream</span>' +
          '</div>' +
        '</div>';
      
      document.querySelectorAll('g[data-id]').forEach(function(node) {
        node.onclick = function() {
          var id = node.getAttribute('data-id');
          var entity = allEntities.find(function(e) { return e.id === id; });
          if (selected && selected.id === id) {
            selected = null; upstream = []; downstream = [];
          } else {
            selected = entity;
            upstream = getUpstream(entity.id, 0);
            downstream = getDownstream(entity.id, 0);
          }
          render();
        };
      });
      
      var clearBtn = document.getElementById('clearBtn');
      if (clearBtn) {
        clearBtn.onclick = function() {
          selected = null; upstream = []; downstream = [];
          render();
        };
      }
    }
    
    render();
  }
  
  // Initialize when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connectToLooker);
  } else {
    connectToLooker();
  }
  
})(window);

(function(window) {
  'use strict';
  
  function showStatus(message, color) {
    var content = document.getElementById('content');
    if (content) {
      content.innerHTML = '<p style="color:' + (color || '#9ca3af') + ';">' + message + '</p>';
    }
  }
  
  function showError(message, details) {
    var content = document.getElementById('content');
    if (content) {
      content.innerHTML = 
        '<p style="color:#ef4444;">' + message + '</p>' +
        (details ? '<p style="color:#6b7280;font-size:12px;margin-top:8px;">' + details + '</p>' : '');
    }
  }

  function init() {
    var container = document.body;
    container.style.margin = '0';
    container.style.padding = '0';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    
    container.innerHTML = 
      '<div style="padding:40px;background:#0a0f1a;min-height:100vh;color:white;">' +
        '<h1 style="color:#3b82f6;margin-bottom:16px;">✅ Extension Connected!</h1>' +
        '<div id="content"><p style="color:#9ca3af;">Initializing Looker SDK...</p></div>' +
      '</div>';
    
    // Check for the Looker Extension SDK loaded via script tag
    if (window.LookerExtensionSDK) {
      showStatus('LookerExtensionSDK found, connecting...', '#22d3ee');
      
      window.LookerExtensionSDK.init()
        .then(function(sdk) {
          showStatus('SDK initialized! Fetching data...', '#22d3ee');
          return fetchData(sdk);
        })
        .catch(function(err) {
          showError('SDK init failed: ' + (err.message || err), JSON.stringify(err));
        });
    } 
    // Alternative: check for lowercase version
    else if (window.lookerExtensionSDK) {
      showStatus('lookerExtensionSDK found, connecting...', '#22d3ee');
      
      window.lookerExtensionSDK.init()
        .then(function(sdk) {
          showStatus('SDK initialized! Fetching data...', '#22d3ee');
          return fetchData(sdk);
        })
        .catch(function(err) {
          showError('SDK init failed: ' + (err.message || err), JSON.stringify(err));
        });
    }
    else {
      // List what IS available
      var lookerGlobals = Object.keys(window).filter(function(k) {
        return k.toLowerCase().indexOf('looker') !== -1 || k.toLowerCase().indexOf('extension') !== -1;
      });
      
      showError(
        'Looker Extension SDK not found',
        'Available globals: ' + (lookerGlobals.length > 0 ? lookerGlobals.join(', ') : 'none')
      );
    }
  }
  
  function fetchData(extensionSDK) {
    var sdk = extensionSDK.core40SDK || extensionSDK.coreSDK || extensionSDK.lookerSDK;
    
    if (!sdk) {
      showError('No Looker core SDK found in extension', 'Available keys: ' + Object.keys(extensionSDK).join(', '));
      return;
    }
    
    showStatus('Running inline query...', '#22d3ee');
    
    // Try using the SDK's run_inline_query
    var queryPromise;
    
    if (typeof sdk.run_inline_query === 'function') {
      queryPromise = sdk.run_inline_query({
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
          limit: '500'
        }
      });
    } else if (typeof sdk.ok === 'function') {
      queryPromise = sdk.ok(sdk.run_inline_query({
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
          limit: '500'
        }
      }));
    } else {
      showError('SDK does not have run_inline_query', 'Available methods: ' + Object.keys(sdk).slice(0, 20).join(', '));
      return;
    }
    
    queryPromise
      .then(function(response) {
        var data = response.value || response.ok || response;
        if (Array.isArray(data)) {
          showStatus('✅ Loaded ' + data.length + ' rows!', '#10b981');
          setTimeout(function() { renderGraph(data); }, 500);
        } else {
          showError('Unexpected response format', JSON.stringify(response).substring(0, 200));
        }
      })
      .catch(function(err) {
        showError('Query failed: ' + (err.message || err), JSON.stringify(err).substring(0, 200));
      });
  }
  
  function renderGraph(rows) {
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
      
      if (vw && tbl) { if (!viewToTables[vw]) viewToTables[vw] = {}; viewToTables[vw]['t_' + tbl] = true; }
      if (exp && vw) { if (!exploreToViews[exp]) exploreToViews[exp] = {}; exploreToViews[exp]['v_' + vw] = true; }
      if (dash && exp) { if (!dashToExplores[dash]) dashToExplores[dash] = {}; dashToExplores[dash]['e_' + exp] = true; }
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
    
    var selected = null, upstream = [], downstream = [];
    
    function getUpstream(id, d) {
      if (d > 10) return [];
      var e = allEntities.find(function(x) { return x.id === id; });
      if (!e || !e.sources) return [];
      var r = e.sources.slice();
      e.sources.forEach(function(s) { r = r.concat(getUpstream(s, (d||0)+1)); });
      return r.filter(function(v,i,a) { return a.indexOf(v)===i; });
    }
    
    function getDownstream(id, d) {
      if (d > 10) return [];
      var r = [];
      allEntities.forEach(function(e) {
        if (e.sources && e.sources.indexOf(id) !== -1) {
          r.push(e.id);
          r = r.concat(getDownstream(e.id, (d||0)+1));
        }
      });
      return r.filter(function(v,i,a) { return a.indexOf(v)===i; });
    }
    
    function render() {
      var edges = [];
      allEntities.forEach(function(e) { (e.sources||[]).forEach(function(s) { edges.push({from:s,to:e.id}); }); });
      
      var edgesHtml = '';
      edges.forEach(function(edge) {
        var f = positions[edge.from], t = positions[edge.to];
        if (!f || !t) return;
        var stroke = '#334155', op = 0.3, sw = 1;
        if (selected) {
          var isUp = upstream.indexOf(edge.from)!==-1 && (upstream.indexOf(edge.to)!==-1 || edge.to===selected.id);
          var isDown = downstream.indexOf(edge.to)!==-1 && (downstream.indexOf(edge.from)!==-1 || edge.from===selected.id);
          if (edge.from===selected.id || isDown) { stroke='#f97316'; op=1; sw=2; }
          else if (edge.to===selected.id || isUp) { stroke='#22d3ee'; op=1; sw=2; }
          else { op=0; }
        }
        if (op===0) return;
        var x1=f.x+nodeW, y1=f.y+nodeH/2, x2=t.x, y2=t.y+nodeH/2, mx=(x1+x2)/2;
        edgesHtml += '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-opacity="'+op+'" marker-end="url(#arrow'+(stroke==='#22d3ee'?'Cyan':stroke==='#f97316'?'Orange':'Gray')+')"/>';
      });
      
      var nodesHtml = '';
      allEntities.forEach(function(entity) {
        var pos = positions[entity.id], cfg = typeConfig[entity.type];
        var st = 'normal';
        if (selected) {
          if (selected.id===entity.id) st='selected';
          else if (upstream.indexOf(entity.id)!==-1) st='upstream';
          else if (downstream.indexOf(entity.id)!==-1) st='downstream';
          else st='dimmed';
        }
        if (st==='dimmed') return;
        var sc = st==='upstream'?'#22d3ee':st==='downstream'?'#f97316':st==='selected'?'#fff':cfg.color;
        var sw = st!=='normal'?2:1;
        var nm = entity.name.length>16?entity.name.substring(0,15)+'…':entity.name;
        nodesHtml += '<g data-id="'+entity.id+'" style="cursor:pointer;" transform="translate('+pos.x+','+pos.y+')">';
        nodesHtml += '<rect width="'+nodeW+'" height="'+nodeH+'" rx="6" fill="#1e293b" stroke="'+sc+'" stroke-width="'+sw+'"/>';
        nodesHtml += '<rect width="28" height="'+nodeH+'" rx="6" fill="'+cfg.color+'"/><rect x="6" width="22" height="'+nodeH+'" fill="'+cfg.color+'"/>';
        nodesHtml += '<text x="14" y="'+(nodeH/2+4)+'" fill="#fff" font-size="12" text-anchor="middle">'+(entity.type==='table'?'⬚':entity.type==='view'?'◉':entity.type==='explore'?'⬡':'▦')+'</text>';
        nodesHtml += '<text x="36" y="'+(nodeH/2+4)+'" fill="#fff" font-size="11">'+nm+'</text></g>';
      });
      
      var hdrHtml = '';
      Object.keys(typeConfig).forEach(function(type) {
        var cfg = typeConfig[type];
        hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="24" text-anchor="middle" fill="'+cfg.color+'" font-size="11" font-weight="600">'+cfg.label+'</text>';
      });
      
      var info = selected ? 'Selected: '+selected.name+' | ↑'+upstream.length+' ↓'+downstream.length : 'Click any node to see lineage';
      
      document.body.innerHTML = 
        '<div style="background:#0a0f1a;min-height:100vh;color:#fff;padding:16px;">'+
          '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">'+
            '<div style="padding:8px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#9333ea);">📊</div>'+
            '<div><div style="font-size:16px;font-weight:600;">Looker Lineage Graph</div><div style="font-size:12px;color:#6b7280;">'+allEntities.length+' entities</div></div>'+
            '<div style="margin-left:auto;padding:8px 16px;background:rgba(255,255,255,0.05);border-radius:6px;font-size:13px;">'+info+(selected?' <span id="clearBtn" style="color:#6b7280;cursor:pointer;margin-left:8px;">[clear]</span>':'')+'</div>'+
          '</div>'+
          '<div style="overflow:auto;">'+
            '<svg width="750" height="'+svgHeight+'" style="font-family:system-ui,sans-serif;">'+
              '<defs>'+
                '<marker id="arrowGray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#334155"/></marker>'+
                '<marker id="arrowCyan" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#22d3ee"/></marker>'+
                '<marker id="arrowOrange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#f97316"/></marker>'+
              '</defs>'+hdrHtml+edgesHtml+nodesHtml+
            '</svg>'+
          '</div>'+
          '<div style="position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:16px;padding:8px 20px;background:rgba(0,0,0,0.7);border-radius:20px;font-size:11px;">'+
            '<span style="color:#22d3ee;">— Upstream</span><span style="color:#f97316;">— Downstream</span>'+
          '</div>'+
        '</div>';
      
      document.querySelectorAll('g[data-id]').forEach(function(n) {
        n.onclick = function() {
          var id = n.getAttribute('data-id');
          var e = allEntities.find(function(x){return x.id===id;});
          if (selected && selected.id===id) { selected=null; upstream=[]; downstream=[]; }
          else { selected=e; upstream=getUpstream(e.id,0); downstream=getDownstream(e.id,0); }
          render();
        };
      });
      var cb = document.getElementById('clearBtn');
      if (cb) cb.onclick = function() { selected=null; upstream=[]; downstream=[]; render(); };
    }
    render();
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);

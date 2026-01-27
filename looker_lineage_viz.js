looker.plugins.visualizations.add({
  id: "lineage_graph",
  label: "Lineage Graph",
  options: {},
  
  create: function(element, config) {
    element.innerHTML = '<div id="lineage-container" style="width:100%;height:100%;overflow:auto;font-family:system-ui,sans-serif;"></div>';
  },
  
  updateAsync: function(data, element, config, queryResponse, details, done) {
    var container = element.querySelector('#lineage-container');
    
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:#666;">No data. Please select: dashboard_title, explore_name, view_name, table_name_short</div>';
      done();
      return;
    }
    
    var fields = queryResponse.fields.dimension_like.map(function(f) { return f.name; });
    var dashField = fields.find(function(f) { return f.toLowerCase().indexOf('dashboard') !== -1 && f.toLowerCase().indexOf('title') !== -1; });
    var expField = fields.find(function(f) { return f.toLowerCase().indexOf('explore') !== -1; });
    var viewField = fields.find(function(f) { return f.toLowerCase().indexOf('view') !== -1 && f.toLowerCase().indexOf('count') === -1; });
    var tableField = fields.find(function(f) { return f.toLowerCase().indexOf('table') !== -1 && f.toLowerCase().indexOf('short') !== -1; }) 
                  || fields.find(function(f) { return f.toLowerCase().indexOf('table') !== -1 && f.toLowerCase().indexOf('source') === -1; });
    
    if (!dashField || !expField || !viewField || !tableField) {
      container.innerHTML = '<div style="padding:20px;color:#e74c3c;">Missing required fields.<br>Found: ' + fields.join(', ') + '</div>';
      done();
      return;
    }
    
    var tables = {}, views = {}, explores = {}, dashboards = {};
    var viewToTables = {}, exploreToViews = {}, dashToExplores = {};
    
    data.forEach(function(row) {
      var tbl = row[tableField] ? row[tableField].value : null;
      var vw = row[viewField] ? row[viewField].value : null;
      var exp = row[expField] ? row[expField].value : null;
      var dash = row[dashField] ? row[dashField].value : null;
      
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
      var colX = { table: 50, view: 230, explore: 410, dashboard: 590 };
      var nodeW = 160, nodeH = 44;
      
      // Determine which entities to show
      var visibleEntities = allEntities;
      if (selected) {
        var visibleIds = [selected.id].concat(upstream).concat(downstream);
        visibleEntities = allEntities.filter(function(e) { return visibleIds.indexOf(e.id) !== -1; });
      }
      
      // Calculate positions - reflow based on visible entities only
      var positions = {};
      var counts = { table: 0, view: 0, explore: 0, dashboard: 0 };
      
      visibleEntities.forEach(function(e) {
        positions[e.id] = { x: colX[e.type], y: 60 + counts[e.type] * 54 };
        counts[e.type]++;
      });
      
      var maxCount = Math.max(counts.table || 1, counts.view || 1, counts.explore || 1, counts.dashboard || 1);
      var svgHeight = Math.max(maxCount * 54 + 100, 200);
      var svgWidth = 780;
      
      // Build edges
      var edges = [];
      visibleEntities.forEach(function(e) { 
        (e.sources||[]).forEach(function(s) { 
          if (positions[s]) edges.push({from:s,to:e.id}); 
        }); 
      });
      
      var edgesHtml = '';
      edges.forEach(function(edge) {
        var f = positions[edge.from], t = positions[edge.to];
        if (!f || !t) return;
        var stroke = '#94a3b8', op = 0.5, sw = 1.5;
        if (selected) {
          var isUp = upstream.indexOf(edge.from)!==-1 && (upstream.indexOf(edge.to)!==-1 || edge.to===selected.id);
          var isDown = downstream.indexOf(edge.to)!==-1 && (downstream.indexOf(edge.from)!==-1 || edge.from===selected.id);
          if (edge.from===selected.id || isDown) { stroke='#f97316'; op=1; sw=2.5; }
          else if (edge.to===selected.id || isUp) { stroke='#22d3ee'; op=1; sw=2.5; }
        }
        var x1=f.x+nodeW, y1=f.y+nodeH/2, x2=t.x, y2=t.y+nodeH/2, mx=(x1+x2)/2;
        edgesHtml += '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-opacity="'+op+'" marker-end="url(#arrow'+(stroke==='#22d3ee'?'Cyan':stroke==='#f97316'?'Orange':'Gray')+')"/>';
      });
      
      var nodesHtml = '';
      visibleEntities.forEach(function(entity) {
        var pos = positions[entity.id], cfg = typeConfig[entity.type];
        var st = 'normal';
        if (selected) {
          if (selected.id===entity.id) st='selected';
          else if (upstream.indexOf(entity.id)!==-1) st='upstream';
          else if (downstream.indexOf(entity.id)!==-1) st='downstream';
        }
        var sc = st==='upstream'?'#22d3ee':st==='downstream'?'#f97316':st==='selected'?'#1e293b':cfg.color;
        var fill = st==='selected'?'#f1f5f9':'#ffffff';
        var sw = st!=='normal'?2.5:1.5;
        var nm = entity.name.length>17?entity.name.substring(0,16)+'…':entity.name;
        nodesHtml += '<g data-id="'+entity.id+'" style="cursor:pointer;" transform="translate('+pos.x+','+pos.y+')">';
        nodesHtml += '<rect width="'+nodeW+'" height="'+nodeH+'" rx="8" fill="'+fill+'" stroke="'+sc+'" stroke-width="'+sw+'" filter="url(#shadow)"/>';
        nodesHtml += '<rect width="32" height="'+nodeH+'" rx="8" fill="'+cfg.color+'"/><rect x="8" width="24" height="'+nodeH+'" fill="'+cfg.color+'"/>';
        nodesHtml += '<text x="16" y="'+(nodeH/2+5)+'" fill="#fff" font-size="14" text-anchor="middle">'+(entity.type==='table'?'⬚':entity.type==='view'?'◉':entity.type==='explore'?'⬡':'▦')+'</text>';
        nodesHtml += '<text x="40" y="'+(nodeH/2+4)+'" fill="#334155" font-size="11" font-weight="500">'+nm+'</text></g>';
      });
      
      var hdrHtml = '';
      ['table','view','explore','dashboard'].forEach(function(type) {
        var cfg = typeConfig[type];
        var count = visibleEntities.filter(function(e){return e.type===type;}).length;
        hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="28" text-anchor="middle" fill="'+cfg.color+'" font-size="12" font-weight="600">'+cfg.label+' ('+count+')</text>';
      });
      
      var info = selected 
        ? 'Selected: <strong style="color:'+typeConfig[selected.type].color+'">'+selected.name+'</strong> &nbsp;|&nbsp; <span style="color:#22d3ee;">↑ '+upstream.length+'</span> &nbsp; <span style="color:#f97316;">↓ '+downstream.length+'</span>' 
        : '<span style="color:#64748b;">Click any node to trace lineage</span>';
      
      container.innerHTML = 
        '<div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">'+
          '<div style="display:flex;align-items:center;gap:10px;">'+
            '<div style="font-size:20px;">📊</div>'+
            '<div><div style="font-weight:600;color:#1e293b;font-size:15px;">Looker Lineage Graph</div><div style="font-size:11px;color:#64748b;">'+(selected ? visibleEntities.length+' of '+allEntities.length+' entities' : allEntities.length+' entities')+'</div></div>'+
          '</div>'+
          '<div style="font-size:13px;color:#475569;">'+info+(selected?' &nbsp;<button id="clearBtn" style="background:#e2e8f0;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;color:#475569;">Show All</button>':'')+'</div>'+
        '</div>'+
        '<div style="padding:16px;background:#ffffff;overflow:auto;">'+
          '<svg width="'+svgWidth+'" height="'+svgHeight+'" style="font-family:system-ui,sans-serif;">'+
            '<defs>'+
              '<filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.1"/></filter>'+
              '<marker id="arrowGray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#94a3b8"/></marker>'+
              '<marker id="arrowCyan" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#22d3ee"/></marker>'+
              '<marker id="arrowOrange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#f97316"/></marker>'+
            '</defs>'+hdrHtml+edgesHtml+nodesHtml+
          '</svg>'+
        '</div>'+
        '<div style="padding:8px 16px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;gap:24px;font-size:11px;color:#64748b;">'+
          '<span><span style="color:#22d3ee;">━━</span> Upstream (data sources)</span>'+
          '<span><span style="color:#f97316;">━━</span> Downstream (dependents)</span>'+
        '</div>';
      
      container.querySelectorAll('g[data-id]').forEach(function(n) {
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
    done();
  }
});

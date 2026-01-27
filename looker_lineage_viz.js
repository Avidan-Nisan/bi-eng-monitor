looker.plugins.visualizations.add({
  id: "lineage_graph",
  label: "Lineage Graph",
  options: {},
  
  create: function(element, config) {
    element.innerHTML = '<div id="lineage-container" style="width:100%;height:100%;overflow:auto;font-family:system-ui,sans-serif;"></div>';
  },
  
  updateAsync: function(data, element, config, queryResponse, details, done) {
    var container = element.querySelector('#lineage-container');
    var containerWidth = element.offsetWidth || 1200;
    
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="padding:40px;color:#64748b;background:#0f172a;min-height:100%;">No data. Please select: dashboard_title, explore_name, view_name, table_name_short</div>';
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
      container.innerHTML = '<div style="padding:40px;color:#ef4444;background:#0f172a;min-height:100%;">Missing required fields.<br>Found: ' + fields.join(', ') + '</div>';
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
      table: { color: '#06b6d4', label: 'SQL Tables', icon: '⬢' },
      view: { color: '#8b5cf6', label: 'Views', icon: '◈' },
      explore: { color: '#ec4899', label: 'Explores', icon: '⬡' },
      dashboard: { color: '#f97316', label: 'Dashboards', icon: '◧' }
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
      var nodeW = 180, nodeH = 44;
      var nodeSpacing = 52;
      var padding = 40;
      
      // Calculate column positions based on container width - spread evenly
      var svgWidth = Math.max(containerWidth - 40, 1000);
      var colSpacing = (svgWidth - padding * 2 - nodeW) / 3;
      var colX = { 
        table: padding, 
        view: padding + colSpacing, 
        explore: padding + colSpacing * 2, 
        dashboard: padding + colSpacing * 3 
      };
      
      var visibleEntities = allEntities;
      if (selected) {
        var visibleIds = [selected.id].concat(upstream).concat(downstream);
        visibleEntities = allEntities.filter(function(e) { return visibleIds.indexOf(e.id) !== -1; });
      }
      
      // Sort entities by type for proper column layout
      var byType = { table: [], view: [], explore: [], dashboard: [] };
      visibleEntities.forEach(function(e) { byType[e.type].push(e); });
      
      // Sort alphabetically within each type
      ['table', 'view', 'explore', 'dashboard'].forEach(function(type) {
        byType[type].sort(function(a, b) { return a.name.localeCompare(b.name); });
      });
      
      var positions = {};
      var startY = 80;
      ['table', 'view', 'explore', 'dashboard'].forEach(function(type) {
        byType[type].forEach(function(e, idx) {
          positions[e.id] = { x: colX[type], y: startY + idx * nodeSpacing };
        });
      });
      
      var maxCount = Math.max(byType.table.length || 1, byType.view.length || 1, byType.explore.length || 1, byType.dashboard.length || 1);
      var svgHeight = Math.max(maxCount * nodeSpacing + 120, 350);
      
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
        var stroke = '#334155', op = 0.3, sw = 1.5;
        if (selected) {
          var isUp = upstream.indexOf(edge.from)!==-1 && (upstream.indexOf(edge.to)!==-1 || edge.to===selected.id);
          var isDown = downstream.indexOf(edge.to)!==-1 && (downstream.indexOf(edge.from)!==-1 || edge.from===selected.id);
          if (edge.from===selected.id || isDown) { stroke='#f97316'; op=1; sw=2; }
          else if (edge.to===selected.id || isUp) { stroke='#06b6d4'; op=1; sw=2; }
        }
        var x1=f.x+nodeW, y1=f.y+nodeH/2, x2=t.x, y2=t.y+nodeH/2, mx=(x1+x2)/2;
        var glow = op===1 ? '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="6" stroke-opacity="0.3" filter="url(#glow)"/>' : '';
        edgesHtml += glow + '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-opacity="'+op+'" marker-end="url(#arrow'+(stroke==='#06b6d4'?'Cyan':stroke==='#f97316'?'Orange':'Gray')+')"/>';
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
        var borderColor = st==='upstream'?'#06b6d4':st==='downstream'?'#f97316':st==='selected'?'#fff':cfg.color;
        var sw = st!=='normal'?2:1;
        var nm = entity.name.length>18?entity.name.substring(0,17)+'…':entity.name;
        
        nodesHtml += '<g data-id="'+entity.id+'" style="cursor:pointer;" transform="translate('+pos.x+','+pos.y+')">';
        if (st!=='normal') {
          nodesHtml += '<rect x="-3" y="-3" width="'+(nodeW+6)+'" height="'+(nodeH+6)+'" rx="12" fill="none" stroke="'+borderColor+'" stroke-width="1" stroke-opacity="0.5" filter="url(#glow)"/>';
        }
        nodesHtml += '<rect width="'+nodeW+'" height="'+nodeH+'" rx="10" fill="#0f172a" fill-opacity="0.9" stroke="'+borderColor+'" stroke-width="'+sw+'"/>';
        nodesHtml += '<rect x="1" y="1" width="38" height="'+(nodeH-2)+'" rx="9" fill="'+cfg.color+'" fill-opacity="0.2"/>';
        nodesHtml += '<text x="20" y="'+(nodeH/2+5)+'" fill="'+cfg.color+'" font-size="16" text-anchor="middle">'+cfg.icon+'</text>';
        nodesHtml += '<text x="48" y="'+(nodeH/2-2)+'" fill="#e2e8f0" font-size="11" font-weight="500">'+nm+'</text>';
        nodesHtml += '<text x="48" y="'+(nodeH/2+12)+'" fill="'+cfg.color+'" font-size="9" opacity="0.8">'+entity.type.toUpperCase()+'</text>';
        nodesHtml += '</g>';
      });
      
      var hdrHtml = '';
      ['table','view','explore','dashboard'].forEach(function(type) {
        var cfg = typeConfig[type];
        var count = byType[type].length;
        hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="30" text-anchor="middle" fill="'+cfg.color+'" font-size="11" font-weight="600" letter-spacing="0.5">'+cfg.label.toUpperCase()+'</text>';
        hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="45" text-anchor="middle" fill="#475569" font-size="10">'+count+' items</text>';
        hdrHtml += '<line x1="'+(colX[type]+nodeW/2)+'" y1="55" x2="'+(colX[type]+nodeW/2)+'" y2="'+(svgHeight-20)+'" stroke="'+cfg.color+'" stroke-opacity="0.1" stroke-width="1" stroke-dasharray="4,4"/>';
      });
      
      var info = selected 
        ? '<span style="color:'+typeConfig[selected.type].color+'">'+selected.name+'</span>' 
        : '<span style="color:#64748b;">Click any node to trace lineage</span>';
      
      var stats = selected 
        ? '<span style="color:#06b6d4;margin-left:16px;">▲ '+upstream.length+' upstream</span><span style="color:#f97316;margin-left:12px;">▼ '+downstream.length+' downstream</span>'
        : '';
      
      // Logo SVG - infinity/chain style gradient logo
      var logoSvg = '<svg width="40" height="40" viewBox="0 0 100 100" style="border-radius:10px;">' +
        '<defs>' +
          '<linearGradient id="logoGrad1" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="#f97316"/>' +
            '<stop offset="50%" stop-color="#ec4899"/>' +
            '<stop offset="100%" stop-color="#8b5cf6"/>' +
          '</linearGradient>' +
          '<linearGradient id="logoGrad2" x1="0%" y1="100%" x2="100%" y2="0%">' +
            '<stop offset="0%" stop-color="#8b5cf6"/>' +
            '<stop offset="50%" stop-color="#3b82f6"/>' +
            '<stop offset="100%" stop-color="#06b6d4"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<rect width="100" height="100" fill="#000"/>' +
        '<path d="M25 50 Q25 25 50 25 Q75 25 75 50 Q75 75 50 75 Q25 75 25 50 M50 50 Q50 35 65 35 Q80 35 80 50 Q80 65 65 65 Q50 65 50 50" fill="none" stroke="url(#logoGrad1)" stroke-width="12" stroke-linecap="round"/>' +
        '<path d="M75 50 Q75 75 50 75 Q25 75 25 50 Q25 25 50 25 Q75 25 75 50 M50 50 Q50 65 35 65 Q20 65 20 50 Q20 35 35 35 Q50 35 50 50" fill="none" stroke="url(#logoGrad2)" stroke-width="12" stroke-linecap="round"/>' +
      '</svg>';
      
      container.innerHTML = 
        '<div style="background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);min-height:100%;">'+
          '<div style="padding:16px 24px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;">'+
            '<div style="display:flex;align-items:center;gap:14px;">'+
              logoSvg+
              '<div><div style="font-weight:600;color:#f1f5f9;font-size:16px;">Lineage Graph</div><div style="font-size:11px;color:#64748b;">'+(selected ? visibleEntities.length+' of '+allEntities.length+' entities' : allEntities.length+' total entities')+'</div></div>'+
            '</div>'+
            '<div style="display:flex;align-items:center;font-size:13px;">'+info+stats+(selected?'<button id="clearBtn" style="margin-left:16px;background:linear-gradient(135deg,#1e293b,#334155);border:1px solid #475569;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:11px;color:#e2e8f0;font-weight:500;">SHOW ALL</button>':'')+'</div>'+
          '</div>'+
          '<div style="padding:20px;overflow:auto;">'+
            '<svg width="'+svgWidth+'" height="'+svgHeight+'" style="font-family:system-ui,sans-serif;">'+
              '<defs>'+
                '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'+
                '<marker id="arrowGray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#334155"/></marker>'+
                '<marker id="arrowCyan" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#06b6d4"/></marker>'+
                '<marker id="arrowOrange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#f97316"/></marker>'+
              '</defs>'+hdrHtml+edgesHtml+nodesHtml+
            '</svg>'+
          '</div>'+
          '<div style="padding:10px 24px;border-top:1px solid #1e293b;display:flex;gap:24px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">'+
            '<span><span style="color:#06b6d4;">━━</span> Upstream</span>'+
            '<span><span style="color:#f97316;">━━</span> Downstream</span>'+
          '</div>'+
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

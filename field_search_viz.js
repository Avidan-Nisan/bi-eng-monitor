looker.plugins.visualizations.add({
  id: "field_search",
  label: "Asset Manager",
  options: {},
  
  create: function(element, config) {
    element.style.height = '100%';
    element.style.width = '100%';
    element.innerHTML = '<div id="asset-manager-container" style="width:100%;min-height:600px;height:100%;overflow:auto;font-family:system-ui,sans-serif;background:#0f172a;"></div>';
  },
  
  updateAsync: function(data, element, config, queryResponse, details, done) {
    var container = element.querySelector('#asset-manager-container');
    var containerWidth = element.offsetWidth || 1200;
    
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="padding:40px;color:#64748b;background:#0f172a;min-height:600px;">No data available</div>';
      done();
      return;
    }
    
    var fields = queryResponse.fields.dimension_like.map(function(f) { return f.name; });
    var dashField = fields.find(function(f) { return f.toLowerCase().indexOf('dashboard') !== -1 && f.toLowerCase().indexOf('title') !== -1; });
    var expField = fields.find(function(f) { return f.toLowerCase().indexOf('explore') !== -1 && f.toLowerCase().indexOf('name') !== -1; });
    var viewField = fields.find(function(f) { return f.toLowerCase().indexOf('view') !== -1 && f.toLowerCase().indexOf('name') !== -1 && f.toLowerCase().indexOf('count') === -1; });
    var fieldsField = fields.find(function(f) { return f.toLowerCase().indexOf('sql_table_fields') !== -1 || f.toLowerCase().indexOf('falm_sql_table_fields') !== -1; });
    var tableField = fields.find(function(f) { return f.toLowerCase().indexOf('sql_table') !== -1 && f.toLowerCase().indexOf('fields') === -1 && f.toLowerCase().indexOf('path') === -1; });
    
    // Parse all data rows
    var allRows = data.map(function(row) {
      return {
        dashboard: row[dashField] ? row[dashField].value : '',
        explore: row[expField] ? row[expField].value : '',
        view: row[viewField] ? row[viewField].value : '',
        table: tableField && row[tableField] ? row[tableField].value : '',
        fields: fieldsField && row[fieldsField] ? (row[fieldsField].value || '').split('|').filter(function(f) { return f.trim(); }) : []
      };
    });
    
    // Build lineage entities
    var tables = {}, views = {}, explores = {}, dashboards = {};
    var viewToTables = {}, exploreToViews = {}, dashToExplores = {};
    
    allRows.forEach(function(row) {
      var tbl = row.table, vw = row.view, exp = row.explore, dash = row.dashboard;
      if (tbl && !tables[tbl]) tables[tbl] = { id: 't_'+tbl, name: tbl, type: 'table', sources: [], fields: [] };
      if (vw && !views[vw]) views[vw] = { id: 'v_'+vw, name: vw, type: 'view', sources: [], fields: [] };
      if (exp && !explores[exp]) explores[exp] = { id: 'e_'+exp, name: exp, type: 'explore', sources: [], fields: [] };
      if (dash && !dashboards[dash]) dashboards[dash] = { id: 'd_'+dash, name: dash, type: 'dashboard', sources: [], fields: [] };
      
      // Store fields for each entity
      if (vw && views[vw]) {
        row.fields.forEach(function(f) {
          if (views[vw].fields.indexOf(f) === -1) views[vw].fields.push(f);
        });
      }
      if (exp && explores[exp]) {
        row.fields.forEach(function(f) {
          if (explores[exp].fields.indexOf(f) === -1) explores[exp].fields.push(f);
        });
      }
      if (dash && dashboards[dash]) {
        row.fields.forEach(function(f) {
          if (dashboards[dash].fields.indexOf(f) === -1) dashboards[dash].fields.push(f);
        });
      }
      
      if (vw && tbl) { if (!viewToTables[vw]) viewToTables[vw] = {}; viewToTables[vw]['t_'+tbl] = true; }
      if (exp && vw) { if (!exploreToViews[exp]) exploreToViews[exp] = {}; exploreToViews[exp]['v_'+vw] = true; }
      if (dash && exp) { if (!dashToExplores[dash]) dashToExplores[dash] = {}; dashToExplores[dash]['e_'+exp] = true; }
    });
    
    Object.keys(views).forEach(function(k) { views[k].sources = Object.keys(viewToTables[k] || {}); });
    Object.keys(explores).forEach(function(k) { explores[k].sources = Object.keys(exploreToViews[k] || {}); });
    Object.keys(dashboards).forEach(function(k) { dashboards[k].sources = Object.keys(dashToExplores[k] || {}); });
    
    var allEntities = Object.values(tables).concat(Object.values(views)).concat(Object.values(explores)).concat(Object.values(dashboards));
    
    // State
    var searchTerm = '';
    var selectedNode = null;
    var upstream = [], downstream = [];
    var highlightedEntities = [];
    
    var icons = {
      search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
      x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    };
    
    var typeIcons = {
      table: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="9" width="8" height="3"/><rect x="13" y="9" width="8" height="3"/><rect x="3" y="14" width="8" height="3"/><rect x="13" y="14" width="8" height="3"/></svg>',
      view: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7zm0 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/></svg>',
      explore: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
      dashboard: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="2" y="2" width="9" height="6" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="10" width="9" height="12" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>'
    };
    
    var typeConfig = {
      table: { color: '#06b6d4', label: 'SQL Tables' },
      view: { color: '#8b5cf6', label: 'Views' },
      explore: { color: '#ec4899', label: 'Explores' },
      dashboard: { color: '#f97316', label: 'Dashboards' }
    };
    
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
    
    function getSearchMatches() {
      if (!searchTerm.trim()) return [];
      var term = searchTerm.toLowerCase();
      var matches = [];
      
      allEntities.forEach(function(entity) {
        // Check if entity name matches
        var nameMatch = entity.name.toLowerCase().indexOf(term) !== -1;
        // Check if any field matches
        var fieldMatches = (entity.fields || []).filter(function(f) {
          return f.toLowerCase().indexOf(term) !== -1;
        });
        
        if (nameMatch || fieldMatches.length > 0) {
          matches.push({
            entity: entity,
            nameMatch: nameMatch,
            fieldMatches: fieldMatches
          });
        }
      });
      
      return matches;
    }
    
    function render() {
      var searchMatches = getSearchMatches();
      highlightedEntities = searchMatches.map(function(m) { return m.entity.id; });
      
      // Determine visible entities
      var visibleEntities = allEntities;
      var filterMode = '';
      
      if (selectedNode) {
        filterMode = 'lineage';
        upstream = getUpstream(selectedNode.id, 0);
        downstream = getDownstream(selectedNode.id, 0);
        var visibleIds = [selectedNode.id].concat(upstream).concat(downstream);
        visibleEntities = allEntities.filter(function(e) { return visibleIds.indexOf(e.id) !== -1; });
      } else if (searchTerm.trim() && highlightedEntities.length > 0) {
        filterMode = 'search';
        // Show matching entities plus their lineage
        var allRelated = [];
        highlightedEntities.forEach(function(id) {
          allRelated.push(id);
          allRelated = allRelated.concat(getUpstream(id, 0));
          allRelated = allRelated.concat(getDownstream(id, 0));
        });
        allRelated = allRelated.filter(function(v,i,a) { return a.indexOf(v)===i; });
        visibleEntities = allEntities.filter(function(e) { return allRelated.indexOf(e.id) !== -1; });
      }
      
      // Sort by type
      var byType = { table: [], view: [], explore: [], dashboard: [] };
      visibleEntities.forEach(function(e) { byType[e.type].push(e); });
      ['table','view','explore','dashboard'].forEach(function(t) {
        byType[t].sort(function(a,b) { return a.name.localeCompare(b.name); });
      });
      
      // Layout
      var nodeW = 170, nodeH = 42, nodeSpacing = 50, padding = 35;
      var svgWidth = Math.max(containerWidth - 50, 950);
      var colSpacing = (svgWidth - padding * 2 - nodeW) / 3;
      var colX = {
        table: padding,
        view: padding + colSpacing,
        explore: padding + colSpacing * 2,
        dashboard: padding + colSpacing * 3
      };
      
      var positions = {};
      var startY = 75;
      ['table','view','explore','dashboard'].forEach(function(type) {
        byType[type].forEach(function(e, idx) {
          positions[e.id] = { x: colX[type], y: startY + idx * nodeSpacing };
        });
      });
      
      var maxCount = Math.max(byType.table.length||1, byType.view.length||1, byType.explore.length||1, byType.dashboard.length||1);
      var svgHeight = Math.max(maxCount * nodeSpacing + 110, 350);
      
      // Draw edges
      var edgesHtml = '';
      visibleEntities.forEach(function(e) {
        (e.sources||[]).forEach(function(s) {
          var f = positions[s], t = positions[e.id];
          if (!f || !t) return;
          
          var stroke = '#334155', op = 0.25, sw = 1.5;
          
          if (selectedNode) {
            var isUp = upstream.indexOf(s)!==-1 && (upstream.indexOf(e.id)!==-1 || e.id===selectedNode.id);
            var isDown = downstream.indexOf(e.id)!==-1 && (downstream.indexOf(s)!==-1 || s===selectedNode.id);
            if (s===selectedNode.id || isDown) { stroke='#f97316'; op=0.9; sw=2.5; }
            else if (e.id===selectedNode.id || isUp) { stroke='#06b6d4'; op=0.9; sw=2.5; }
          } else if (filterMode === 'search') {
            var srcMatch = highlightedEntities.indexOf(s) !== -1;
            var tgtMatch = highlightedEntities.indexOf(e.id) !== -1;
            if (srcMatch || tgtMatch) { stroke='#10b981'; op=0.7; sw=2; }
          }
          
          var x1=f.x+nodeW, y1=f.y+nodeH/2, x2=t.x, y2=t.y+nodeH/2, mx=(x1+x2)/2;
          
          // Add glow for highlighted edges
          if (op > 0.5) {
            edgesHtml += '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="8" stroke-opacity="0.2" filter="url(#glow)"/>';
          }
          edgesHtml += '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-opacity="'+op+'" marker-end="url(#arrow'+(stroke==='#06b6d4'?'Cyan':stroke==='#f97316'?'Orange':stroke==='#10b981'?'Green':'Gray')+')"/>';
        });
      });
      
      // Draw nodes
      var nodesHtml = '';
      visibleEntities.forEach(function(entity) {
        var pos = positions[entity.id], cfg = typeConfig[entity.type];
        
        var isSelected = selectedNode && selectedNode.id === entity.id;
        var isUpstream = selectedNode && upstream.indexOf(entity.id) !== -1;
        var isDownstream = selectedNode && downstream.indexOf(entity.id) !== -1;
        var isSearchMatch = highlightedEntities.indexOf(entity.id) !== -1;
        
        var borderColor = cfg.color;
        var borderWidth = 1;
        var fillOpacity = 0.9;
        var glowHtml = '';
        
        if (isSelected) {
          borderColor = '#ffffff';
          borderWidth = 2;
          glowHtml = '<rect x="-4" y="-4" width="'+(nodeW+8)+'" height="'+(nodeH+8)+'" rx="12" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.4" filter="url(#glow)"/>';
        } else if (isUpstream) {
          borderColor = '#06b6d4';
          borderWidth = 2;
          glowHtml = '<rect x="-3" y="-3" width="'+(nodeW+6)+'" height="'+(nodeH+6)+'" rx="11" fill="none" stroke="#06b6d4" stroke-width="1" stroke-opacity="0.4" filter="url(#glow)"/>';
        } else if (isDownstream) {
          borderColor = '#f97316';
          borderWidth = 2;
          glowHtml = '<rect x="-3" y="-3" width="'+(nodeW+6)+'" height="'+(nodeH+6)+'" rx="11" fill="none" stroke="#f97316" stroke-width="1" stroke-opacity="0.4" filter="url(#glow)"/>';
        } else if (isSearchMatch && !selectedNode) {
          borderColor = '#10b981';
          borderWidth = 2;
          glowHtml = '<rect x="-3" y="-3" width="'+(nodeW+6)+'" height="'+(nodeH+6)+'" rx="11" fill="none" stroke="#10b981" stroke-width="1" stroke-opacity="0.5" filter="url(#glow)"/>';
        }
        
        var nm = entity.name.length > 17 ? entity.name.substring(0,16)+'…' : entity.name;
        var matchInfo = '';
        if (isSearchMatch && !selectedNode) {
          var match = searchMatches.find(function(m) { return m.entity.id === entity.id; });
          if (match && match.fieldMatches.length > 0) {
            matchInfo = '<text x="46" y="'+(nodeH/2+12)+'" fill="#10b981" font-size="9">'+match.fieldMatches.length+' field match'+(match.fieldMatches.length>1?'es':'')+'</text>';
          }
        }
        
        nodesHtml += '<g class="node" data-id="'+entity.id+'" style="cursor:pointer;" transform="translate('+pos.x+','+pos.y+')">'+
          glowHtml+
          '<rect width="'+nodeW+'" height="'+nodeH+'" rx="10" fill="#0f172a" fill-opacity="'+fillOpacity+'" stroke="'+borderColor+'" stroke-width="'+borderWidth+'"/>'+
          '<rect x="1" y="1" width="36" height="'+(nodeH-2)+'" rx="9" fill="'+cfg.color+'" fill-opacity="0.15"/>'+
          '<g transform="translate(11,'+(nodeH/2-7)+')" fill="'+cfg.color+'">'+typeIcons[entity.type]+'</g>'+
          '<text x="46" y="'+(nodeH/2-1)+'" fill="#e2e8f0" font-size="11" font-weight="500">'+nm+'</text>'+
          (matchInfo || '<text x="46" y="'+(nodeH/2+11)+'" fill="'+cfg.color+'" font-size="9" opacity="0.7">'+entity.type.toUpperCase()+'</text>')+
          '<title>'+entity.name.replace(/</g,'&lt;')+' ('+entity.type+')</title>'+
          '</g>';
      });
      
      // Column headers
      var hdrHtml = '';
      ['table','view','explore','dashboard'].forEach(function(type) {
        var cfg = typeConfig[type];
        var count = byType[type].length;
        hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="28" text-anchor="middle" fill="'+cfg.color+'" font-size="10" font-weight="600" letter-spacing="0.5">'+cfg.label.toUpperCase()+'</text>';
        hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="42" text-anchor="middle" fill="#475569" font-size="9">'+count+' items</text>';
        hdrHtml += '<line x1="'+(colX[type]+nodeW/2)+'" y1="52" x2="'+(colX[type]+nodeW/2)+'" y2="'+(svgHeight-15)+'" stroke="'+cfg.color+'" stroke-opacity="0.08" stroke-width="1" stroke-dasharray="4,4"/>';
      });
      
      // Stats
      var statsText = '';
      if (selectedNode) {
        statsText = '<span style="color:'+typeConfig[selectedNode.type].color+';font-weight:500;">'+selectedNode.name+'</span>'+
          '<span style="color:#06b6d4;margin-left:14px;">▲ '+upstream.length+' upstream</span>'+
          '<span style="color:#f97316;margin-left:10px;">▼ '+downstream.length+' downstream</span>';
      } else if (searchTerm && highlightedEntities.length > 0) {
        statsText = '<span style="color:#10b981;font-weight:500;">'+highlightedEntities.length+' matches</span>'+
          '<span style="color:#64748b;margin-left:10px;">for "'+searchTerm+'"</span>';
      } else if (searchTerm && highlightedEntities.length === 0) {
        statsText = '<span style="color:#ef4444;">No matches for "'+searchTerm+'"</span>';
      } else {
        statsText = '<span style="color:#64748b;">Click a node to trace lineage, or search for fields</span>';
      }
      
      var logoHtml = '<img src="https://avidan-nisan.github.io/bi-eng-monitor/logo.png" width="42" height="42" style="border-radius:10px;" onerror="this.style.display=\'none\'"/>';
      
      container.innerHTML = 
        '<div style="background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);min-height:600px;">'+
          // Header
          '<div style="padding:14px 24px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;">'+
            '<div style="display:flex;align-items:center;gap:14px;">'+
              logoHtml+
              '<div>'+
                '<div style="font-weight:600;color:#f1f5f9;font-size:16px;">Asset Manager</div>'+
                '<div style="font-size:11px;color:#64748b;">'+(filterMode?visibleEntities.length+' of ':'')+allEntities.length+' entities</div>'+
              '</div>'+
            '</div>'+
            // Search box in header
            '<div style="display:flex;align-items:center;gap:12px;">'+
              '<div style="position:relative;width:280px;">'+
                '<span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b;">'+icons.search+'</span>'+
                '<input id="searchInput" type="text" value="'+searchTerm+'" placeholder="Search fields or entities..." style="width:100%;box-sizing:border-box;padding:10px 36px 10px 40px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:13px;outline:none;"/>'+
                (searchTerm||selectedNode?'<span id="clearAll" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:#64748b;cursor:pointer;">'+icons.x+'</span>':'')+
              '</div>'+
            '</div>'+
          '</div>'+
          // Info bar
          '<div style="padding:10px 24px;border-bottom:1px solid #1e293b;font-size:12px;">'+statsText+'</div>'+
          // Graph
          '<div style="padding:15px;overflow:auto;">'+
            '<svg width="'+svgWidth+'" height="'+svgHeight+'" style="font-family:system-ui,sans-serif;">'+
              '<defs>'+
                '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'+
                '<marker id="arrowGray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#334155"/></marker>'+
                '<marker id="arrowCyan" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#06b6d4"/></marker>'+
                '<marker id="arrowOrange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#f97316"/></marker>'+
                '<marker id="arrowGreen" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#10b981"/></marker>'+
              '</defs>'+
              hdrHtml+edgesHtml+nodesHtml+
            '</svg>'+
          '</div>'+
          // Legend
          '<div style="padding:10px 24px;border-top:1px solid #1e293b;display:flex;gap:20px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">'+
            '<span><span style="color:#06b6d4;">━━</span> Upstream</span>'+
            '<span><span style="color:#f97316;">━━</span> Downstream</span>'+
            '<span><span style="color:#10b981;">━━</span> Search Match</span>'+
          '</div>'+
        '</div>';
      
      // Event: search input
      var input = container.querySelector('#searchInput');
      input.addEventListener('input', function(e) {
        searchTerm = e.target.value;
        selectedNode = null;
        upstream = [];
        downstream = [];
        render();
      });
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      
      // Event: clear button
      var clearBtn = container.querySelector('#clearAll');
      if (clearBtn) {
        clearBtn.addEventListener('click', function() {
          searchTerm = '';
          selectedNode = null;
          upstream = [];
          downstream = [];
          render();
        });
      }
      
      // Event: node click
      container.querySelectorAll('.node').forEach(function(n) {
        n.addEventListener('click', function() {
          var id = n.dataset.id;
          var entity = allEntities.find(function(x) { return x.id === id; });
          
          if (selectedNode && selectedNode.id === id) {
            // Deselect
            selectedNode = null;
            upstream = [];
            downstream = [];
          } else {
            // Select new node
            selectedNode = entity;
            searchTerm = '';
          }
          render();
        });
      });
    }
    
    render();
    done();
  }
});

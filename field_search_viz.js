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
    
    var allRows = data.map(function(row) {
      return {
        dashboard: row[dashField] ? row[dashField].value : '',
        explore: row[expField] ? row[expField].value : '',
        view: row[viewField] ? row[viewField].value : '',
        table: tableField && row[tableField] ? row[tableField].value : '',
        fields: fieldsField && row[fieldsField] ? (row[fieldsField].value || '').split('|').filter(function(f) { return f.trim(); }) : []
      };
    });
    
    var tables = {}, views = {}, explores = {}, dashboards = {};
    var viewToTables = {}, exploreToViews = {}, dashToExplores = {};
    
    allRows.forEach(function(row) {
      var tbl = row.table, vw = row.view, exp = row.explore, dash = row.dashboard;
      if (tbl && !tables[tbl]) tables[tbl] = { id: 't_'+tbl, name: tbl, type: 'table', sources: [], fields: [] };
      if (vw && !views[vw]) views[vw] = { id: 'v_'+vw, name: vw, type: 'view', sources: [], fields: [] };
      if (exp && !explores[exp]) explores[exp] = { id: 'e_'+exp, name: exp, type: 'explore', sources: [], fields: [] };
      if (dash && !dashboards[dash]) dashboards[dash] = { id: 'd_'+dash, name: dash, type: 'dashboard', sources: [], fields: [] };
      
      if (vw && views[vw]) row.fields.forEach(function(f) { if (views[vw].fields.indexOf(f) === -1) views[vw].fields.push(f); });
      if (exp && explores[exp]) row.fields.forEach(function(f) { if (explores[exp].fields.indexOf(f) === -1) explores[exp].fields.push(f); });
      if (dash && dashboards[dash]) row.fields.forEach(function(f) { if (dashboards[dash].fields.indexOf(f) === -1) dashboards[dash].fields.push(f); });
      
      if (vw && tbl) { if (!viewToTables[vw]) viewToTables[vw] = {}; viewToTables[vw]['t_'+tbl] = true; }
      if (exp && vw) { if (!exploreToViews[exp]) exploreToViews[exp] = {}; exploreToViews[exp]['v_'+vw] = true; }
      if (dash && exp) { if (!dashToExplores[dash]) dashToExplores[dash] = {}; dashToExplores[dash]['e_'+exp] = true; }
    });
    
    Object.keys(views).forEach(function(k) { views[k].sources = Object.keys(viewToTables[k] || {}); });
    Object.keys(explores).forEach(function(k) { explores[k].sources = Object.keys(exploreToViews[k] || {}); });
    Object.keys(dashboards).forEach(function(k) { dashboards[k].sources = Object.keys(dashToExplores[k] || {}); });
    
    var allEntities = Object.values(tables).concat(Object.values(views)).concat(Object.values(explores)).concat(Object.values(dashboards));
    
    // State
    var activeTab = 'lineage';
    var searchTerm = '';
    var searchTags = [];
    var selectedNode = null;
    var upstream = [], downstream = [];
    var highlightedEntities = [];
    var showFieldsPanel = null;
    var expandedDuplicates = {};
    
    var icons = {
      search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
      x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
      list: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
      lineage: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l4-6h2M11 12l4 6h2"/></svg>',
      duplicate: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/></svg>',
      chevronDown: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
      chevronRight: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'
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
    
    // Normalize text for fuzzy matching
    function normalize(text) {
      return (text || '').toLowerCase().replace(/[_\-\s]+/g, '').replace(/[^a-z0-9]/g, '');
    }
    
    function fuzzyMatch(text, searchTerms) {
      var normalizedText = normalize(text);
      return searchTerms.every(function(term) {
        return normalizedText.indexOf(normalize(term)) !== -1;
      });
    }
    
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
      var terms = searchTags.slice();
      if (searchTerm.trim()) terms.push(searchTerm.trim());
      if (terms.length === 0) return [];
      
      var matches = [];
      allEntities.forEach(function(entity) {
        var nameMatch = fuzzyMatch(entity.name, terms);
        var fieldMatches = (entity.fields || []).filter(function(f) {
          return terms.every(function(term) { return fuzzyMatch(f, [term]); });
        });
        
        // For multiple terms, require ALL terms to match (AND logic)
        var allTermsMatch = terms.every(function(term) {
          var termNorm = normalize(term);
          var inName = normalize(entity.name).indexOf(termNorm) !== -1;
          var inFields = (entity.fields || []).some(function(f) { return normalize(f).indexOf(termNorm) !== -1; });
          return inName || inFields;
        });
        
        if (allTermsMatch) {
          matches.push({ entity: entity, nameMatch: nameMatch, fieldMatches: fieldMatches });
        }
      });
      return matches;
    }
    
    // Find duplicates
    function findDuplicates() {
      var viewFields = {};
      allRows.forEach(function(row) {
        if (row.view && row.fields.length > 0) {
          var key = row.view;
          if (!viewFields[key]) viewFields[key] = { view: row.view, fields: row.fields, dashboards: [], explores: [] };
          if (row.dashboard && viewFields[key].dashboards.indexOf(row.dashboard) === -1) viewFields[key].dashboards.push(row.dashboard);
          if (row.explore && viewFields[key].explores.indexOf(row.explore) === -1) viewFields[key].explores.push(row.explore);
        }
      });
      
      var duplicates = {};
      var viewList = Object.values(viewFields);
      
      for (var i = 0; i < viewList.length; i++) {
        for (var j = i + 1; j < viewList.length; j++) {
          var v1 = viewList[i], v2 = viewList[j];
          var common = v1.fields.filter(function(f) { return v2.fields.indexOf(f) !== -1; });
          var similarity = common.length / Math.min(v1.fields.length, v2.fields.length);
          
          if (similarity >= 0.5 && common.length >= 3) {
            var key = [v1.view, v2.view].sort().join('|');
            if (!duplicates[key]) duplicates[key] = { views: [v1, v2], commonFields: common, similarity: Math.round(similarity * 100) };
          }
        }
      }
      return Object.values(duplicates).sort(function(a, b) { return b.similarity - a.similarity; });
    }
    
    function renderDuplicatesTab() {
      var duplicates = findDuplicates();
      
      var html = '<div style="padding:20px 24px;border-bottom:1px solid #1e293b;">'+
        '<div style="color:#e2e8f0;font-size:14px;font-weight:500;">Potential Duplicate Views</div>'+
        '<div style="color:#64748b;font-size:12px;margin-top:4px;">Views with 50%+ field overlap (min 3 common fields)</div></div>';
      
      if (duplicates.length === 0) {
        html += '<div style="text-align:center;padding:60px 40px;color:#64748b;">No duplicate views found</div>';
      } else {
        html += '<div style="padding:12px 24px;border-bottom:1px solid #1e293b;font-size:13px;color:#94a3b8;">'+duplicates.length+' potential duplicate pair(s)</div>';
        html += '<div style="max-height:450px;overflow-y:auto;">';
        
        duplicates.forEach(function(dup, idx) {
          var isExp = expandedDuplicates[idx];
          var v1 = dup.views[0], v2 = dup.views[1];
          
          html += '<div class="dup-row" data-idx="'+idx+'" style="border-bottom:1px solid #1e293b;">'+
            '<div class="dup-header" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;">'+
              '<span style="color:#64748b;">'+(isExp?icons.chevronDown:icons.chevronRight)+'</span>'+
              '<div style="flex:1;display:flex;align-items:center;gap:12px;">'+
                '<div style="flex:1;"><div style="color:#8b5cf6;font-size:13px;">'+v1.view+'</div>'+
                  '<div style="font-size:10px;color:#64748b;margin-top:2px;">'+v1.fields.length+' fields</div></div>'+
                '<div style="color:#64748b;font-size:20px;">↔</div>'+
                '<div style="flex:1;"><div style="color:#8b5cf6;font-size:13px;">'+v2.view+'</div>'+
                  '<div style="font-size:10px;color:#64748b;margin-top:2px;">'+v2.fields.length+' fields</div></div>'+
              '</div>'+
              '<div style="background:#f9731622;border:1px solid #f97316;padding:4px 10px;border-radius:12px;font-size:11px;color:#f97316;font-weight:600;">'+dup.similarity+'%</div>'+
            '</div>';
          
          if (isExp) {
            html += '<div style="padding:0 16px 16px 44px;background:#0c1222;">'+
              '<div style="margin-bottom:12px;"><div style="font-size:11px;color:#64748b;margin-bottom:8px;text-transform:uppercase;">'+dup.commonFields.length+' Common Fields</div>'+
                '<div style="display:flex;flex-wrap:wrap;gap:4px;max-height:100px;overflow-y:auto;">'+
                  dup.commonFields.map(function(f){ return '<span style="background:#10b98133;border:1px solid #10b981;padding:2px 8px;border-radius:4px;font-size:10px;color:#6ee7b7;">'+f+'</span>'; }).join('')+
                '</div></div>'+
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">'+
                [v1,v2].map(function(v){
                  return '<div style="background:#1e293b;padding:12px;border-radius:8px;">'+
                    '<div style="color:#8b5cf6;font-size:12px;font-weight:500;margin-bottom:8px;">'+v.view+'</div>'+
                    '<div style="font-size:10px;color:#64748b;margin-bottom:4px;">Dashboards:</div>'+
                    '<div style="margin-bottom:8px;font-size:11px;color:#f97316;">'+(v.dashboards.length?v.dashboards.join(', '):'None')+'</div>'+
                    '<div style="font-size:10px;color:#64748b;margin-bottom:4px;">Unique fields ('+(v.fields.length-dup.commonFields.length)+'):</div>'+
                    '<div style="display:flex;flex-wrap:wrap;gap:2px;">'+
                      v.fields.filter(function(f){ return dup.commonFields.indexOf(f)===-1; }).slice(0,15).map(function(f){ return '<span style="background:#334155;padding:2px 6px;border-radius:3px;font-size:9px;color:#94a3b8;">'+f+'</span>'; }).join('')+
                    '</div></div>';
                }).join('')+
              '</div></div>';
          }
          html += '</div>';
        });
        html += '</div>';
      }
      return html;
    }
    
    function renderLineageTab() {
      var searchMatches = getSearchMatches();
      highlightedEntities = searchMatches.map(function(m) { return m.entity.id; });
      
      var visibleEntities = allEntities;
      var filterMode = '';
      
      if (selectedNode) {
        filterMode = 'lineage';
        upstream = getUpstream(selectedNode.id, 0);
        downstream = getDownstream(selectedNode.id, 0);
        var visibleIds = [selectedNode.id].concat(upstream).concat(downstream);
        visibleEntities = allEntities.filter(function(e) { return visibleIds.indexOf(e.id) !== -1; });
      } else if ((searchTags.length > 0 || searchTerm.trim()) && highlightedEntities.length > 0) {
        filterMode = 'search';
        var allRelated = [];
        highlightedEntities.forEach(function(id) {
          allRelated.push(id);
          allRelated = allRelated.concat(getUpstream(id, 0));
          allRelated = allRelated.concat(getDownstream(id, 0));
        });
        allRelated = allRelated.filter(function(v,i,a) { return a.indexOf(v)===i; });
        visibleEntities = allEntities.filter(function(e) { return allRelated.indexOf(e.id) !== -1; });
      }
      
      var byType = { table: [], view: [], explore: [], dashboard: [] };
      visibleEntities.forEach(function(e) { byType[e.type].push(e); });
      ['table','view','explore','dashboard'].forEach(function(t) {
        byType[t].sort(function(a,b) { return a.name.localeCompare(b.name); });
      });
      
      var nodeW = 170, nodeH = 42, nodeSpacing = 50, padding = 35;
      var svgWidth = Math.max(containerWidth - 50, 950);
      var colSpacing = (svgWidth - padding * 2 - nodeW) / 3;
      var colX = { table: padding, view: padding + colSpacing, explore: padding + colSpacing * 2, dashboard: padding + colSpacing * 3 };
      
      var positions = {};
      var startY = 75;
      ['table','view','explore','dashboard'].forEach(function(type) {
        byType[type].forEach(function(e, idx) { positions[e.id] = { x: colX[type], y: startY + idx * nodeSpacing }; });
      });
      
      var maxCount = Math.max(byType.table.length||1, byType.view.length||1, byType.explore.length||1, byType.dashboard.length||1);
      var svgHeight = Math.max(maxCount * nodeSpacing + 110, 350);
      
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
          if (op > 0.5) edgesHtml += '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="8" stroke-opacity="0.2" filter="url(#glow)"/>';
          edgesHtml += '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-opacity="'+op+'" marker-end="url(#arrow'+(stroke==='#06b6d4'?'Cyan':stroke==='#f97316'?'Orange':stroke==='#10b981'?'Green':'Gray')+')"/>';
        });
      });
      
      var nodesHtml = '';
      visibleEntities.forEach(function(entity) {
        var pos = positions[entity.id], cfg = typeConfig[entity.type];
        var isSelected = selectedNode && selectedNode.id === entity.id;
        var isUpstream = selectedNode && upstream.indexOf(entity.id) !== -1;
        var isDownstream = selectedNode && downstream.indexOf(entity.id) !== -1;
        var isSearchMatch = highlightedEntities.indexOf(entity.id) !== -1;
        
        var borderColor = cfg.color, borderWidth = 1, glowHtml = '';
        if (isSelected) { borderColor = '#ffffff'; borderWidth = 2; glowHtml = '<rect x="-4" y="-4" width="'+(nodeW+8)+'" height="'+(nodeH+8)+'" rx="12" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.4" filter="url(#glow)"/>'; }
        else if (isUpstream) { borderColor = '#06b6d4'; borderWidth = 2; glowHtml = '<rect x="-3" y="-3" width="'+(nodeW+6)+'" height="'+(nodeH+6)+'" rx="11" fill="none" stroke="#06b6d4" stroke-width="1" stroke-opacity="0.4" filter="url(#glow)"/>'; }
        else if (isDownstream) { borderColor = '#f97316'; borderWidth = 2; glowHtml = '<rect x="-3" y="-3" width="'+(nodeW+6)+'" height="'+(nodeH+6)+'" rx="11" fill="none" stroke="#f97316" stroke-width="1" stroke-opacity="0.4" filter="url(#glow)"/>'; }
        else if (isSearchMatch && !selectedNode) { borderColor = '#10b981'; borderWidth = 2; glowHtml = '<rect x="-3" y="-3" width="'+(nodeW+6)+'" height="'+(nodeH+6)+'" rx="11" fill="none" stroke="#10b981" stroke-width="1" stroke-opacity="0.5" filter="url(#glow)"/>'; }
        
        var nm = entity.name.length > 17 ? entity.name.substring(0,16)+'…' : entity.name;
        var matchInfo = '';
        if (isSearchMatch && !selectedNode) {
          var match = searchMatches.find(function(m) { return m.entity.id === entity.id; });
          if (match && match.fieldMatches.length > 0) matchInfo = '<text x="46" y="'+(nodeH/2+12)+'" fill="#10b981" font-size="9">'+match.fieldMatches.length+' field match'+(match.fieldMatches.length>1?'es':'')+'</text>';
        }
        
        // Add fields button
        var hasFields = entity.fields && entity.fields.length > 0;
        var fieldsBtn = hasFields ? '<g class="fields-btn" data-id="'+entity.id+'" transform="translate('+(nodeW-24)+',10)" style="cursor:pointer;"><rect width="18" height="18" rx="4" fill="#334155" fill-opacity="0.8"/><g transform="translate(2,2)" fill="#94a3b8">'+icons.list+'</g></g>' : '';
        
        nodesHtml += '<g class="node" data-id="'+entity.id+'" style="cursor:pointer;" transform="translate('+pos.x+','+pos.y+')">'+
          glowHtml+
          '<rect width="'+nodeW+'" height="'+nodeH+'" rx="10" fill="#0f172a" fill-opacity="0.9" stroke="'+borderColor+'" stroke-width="'+borderWidth+'"/>'+
          '<rect x="1" y="1" width="36" height="'+(nodeH-2)+'" rx="9" fill="'+cfg.color+'" fill-opacity="0.15"/>'+
          '<g transform="translate(11,'+(nodeH/2-7)+')" fill="'+cfg.color+'">'+typeIcons[entity.type]+'</g>'+
          '<text x="46" y="'+(nodeH/2-1)+'" fill="#e2e8f0" font-size="11" font-weight="500">'+nm+'</text>'+
          (matchInfo || '<text x="46" y="'+(nodeH/2+11)+'" fill="'+cfg.color+'" font-size="9" opacity="0.7">'+entity.type.toUpperCase()+'</text>')+
          fieldsBtn+
          '<title>'+entity.name.replace(/</g,'&lt;')+' ('+entity.type+')\nClick: trace lineage\nList icon: view fields</title>'+
          '</g>';
      });
      
      var hdrHtml = '';
      ['table','view','explore','dashboard'].forEach(function(type) {
        var cfg = typeConfig[type];
        hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="28" text-anchor="middle" fill="'+cfg.color+'" font-size="10" font-weight="600" letter-spacing="0.5">'+cfg.label.toUpperCase()+'</text>';
        hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="42" text-anchor="middle" fill="#475569" font-size="9">'+byType[type].length+' items</text>';
        hdrHtml += '<line x1="'+(colX[type]+nodeW/2)+'" y1="52" x2="'+(colX[type]+nodeW/2)+'" y2="'+(svgHeight-15)+'" stroke="'+cfg.color+'" stroke-opacity="0.08" stroke-width="1" stroke-dasharray="4,4"/>';
      });
      
      var statsText = '';
      if (selectedNode) {
        statsText = '<span style="color:'+typeConfig[selectedNode.type].color+';font-weight:500;">'+selectedNode.name+'</span>'+
          '<span style="color:#06b6d4;margin-left:14px;">▲ '+upstream.length+'</span>'+
          '<span style="color:#f97316;margin-left:10px;">▼ '+downstream.length+'</span>';
      } else if ((searchTags.length > 0 || searchTerm.trim()) && highlightedEntities.length > 0) {
        statsText = '<span style="color:#10b981;font-weight:500;">'+highlightedEntities.length+' matches</span>';
      } else if ((searchTags.length > 0 || searchTerm.trim()) && highlightedEntities.length === 0) {
        statsText = '<span style="color:#ef4444;">No matches found</span>';
      } else {
        statsText = '<span style="color:#64748b;">Click node to trace lineage</span>';
      }
      
      // Fields panel
      var fieldsPanelHtml = '';
      if (showFieldsPanel) {
        var panelEntity = allEntities.find(function(e) { return e.id === showFieldsPanel; });
        if (panelEntity && panelEntity.fields && panelEntity.fields.length > 0) {
          fieldsPanelHtml = '<div id="fields-panel" style="position:absolute;top:60px;right:20px;width:280px;max-height:400px;background:#1e293b;border:1px solid #334155;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,0.5);z-index:100;overflow:hidden;">'+
            '<div style="padding:12px 16px;border-bottom:1px solid #334155;display:flex;justify-content:space-between;align-items:center;">'+
              '<div><div style="color:'+typeConfig[panelEntity.type].color+';font-size:12px;font-weight:500;">'+panelEntity.name+'</div>'+
              '<div style="color:#64748b;font-size:10px;">'+panelEntity.fields.length+' fields</div></div>'+
              '<span id="close-panel" style="color:#64748b;cursor:pointer;">'+icons.x+'</span>'+
            '</div>'+
            '<div style="padding:12px 16px;max-height:300px;overflow-y:auto;">'+
              '<div style="display:flex;flex-wrap:wrap;gap:4px;">'+
                panelEntity.fields.map(function(f) {
                  var isMatch = highlightedEntities.indexOf(panelEntity.id) !== -1 && searchMatches.some(function(m) { return m.entity.id === panelEntity.id && m.fieldMatches.indexOf(f) !== -1; });
                  return '<span style="background:'+(isMatch?'#10b98133':'#334155')+';border:1px solid '+(isMatch?'#10b981':'#475569')+';padding:3px 8px;border-radius:4px;font-size:10px;color:'+(isMatch?'#6ee7b7':'#94a3b8')+';">'+f+'</span>';
                }).join('')+
              '</div>'+
            '</div>'+
          '</div>';
        }
      }
      
      return '<div style="position:relative;">'+
        '<div style="padding:10px 24px;border-bottom:1px solid #1e293b;font-size:12px;display:flex;justify-content:space-between;">'+
          '<div>'+statsText+'</div>'+
          '<div style="color:#64748b;font-size:11px;">'+(filterMode?visibleEntities.length+' of ':'')+allEntities.length+' entities</div>'+
        '</div>'+
        '<div style="padding:15px;overflow:auto;">'+
          '<svg width="'+svgWidth+'" height="'+svgHeight+'" style="font-family:system-ui,sans-serif;">'+
            '<defs>'+
              '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'+
              '<marker id="arrowGray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#334155"/></marker>'+
              '<marker id="arrowCyan" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#06b6d4"/></marker>'+
              '<marker id="arrowOrange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#f97316"/></marker>'+
              '<marker id="arrowGreen" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#10b981"/></marker>'+
            '</defs>'+hdrHtml+edgesHtml+nodesHtml+
          '</svg>'+
        '</div>'+
        fieldsPanelHtml+
      '</div>';
    }
    
    function render() {
      var logoHtml = '<img src="https://avidan-nisan.github.io/bi-eng-monitor/logo.png" width="40" height="40" style="border-radius:8px;" onerror="this.style.display=\'none\'"/>';
      
      // Search tags HTML
      var tagsHtml = searchTags.map(function(tag, i) {
        return '<span class="search-tag" data-idx="'+i+'" style="display:inline-flex;align-items:center;gap:4px;background:#10b98133;border:1px solid #10b981;padding:4px 8px 4px 10px;border-radius:6px;font-size:11px;color:#6ee7b7;">'+tag+'<span class="remove-tag" style="cursor:pointer;opacity:0.7;">'+icons.x+'</span></span>';
      }).join('');
      
      var hasSearch = searchTags.length > 0 || searchTerm.trim();
      
      container.innerHTML = 
        '<div style="background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);min-height:600px;">'+
          // Header with prominent search
          '<div style="padding:14px 24px;border-bottom:1px solid #1e293b;">'+
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'+
              '<div style="display:flex;align-items:center;gap:12px;">'+logoHtml+
                '<div><div style="font-weight:600;color:#f1f5f9;font-size:16px;">Asset Manager</div>'+
                '<div style="font-size:10px;color:#64748b;">'+allRows.length+' assets</div></div>'+
              '</div>'+
              // Tabs
              '<div style="display:flex;gap:4px;">'+
                '<button class="tab-btn" data-tab="lineage" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:6px;border:none;cursor:pointer;font-size:12px;background:'+(activeTab==='lineage'?'#334155':'transparent')+';color:'+(activeTab==='lineage'?'#e2e8f0':'#64748b')+';">'+icons.lineage+' Lineage</button>'+
                '<button class="tab-btn" data-tab="duplicates" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:6px;border:none;cursor:pointer;font-size:12px;background:'+(activeTab==='duplicates'?'#334155':'transparent')+';color:'+(activeTab==='duplicates'?'#e2e8f0':'#64748b')+';">'+icons.duplicate+' Duplicates</button>'+
              '</div>'+
            '</div>'+
            // Prominent search box
            '<div style="background:linear-gradient(135deg,#1e293b,#334155);border:1px solid #475569;border-radius:12px;padding:16px;">'+
              '<div style="display:flex;align-items:center;gap:8px;margin-bottom:'+(searchTags.length?'10px':'0')+';">'+
                '<span style="color:#10b981;">'+icons.search+'</span>'+
                '<input id="searchInput" type="text" value="'+searchTerm+'" placeholder="Search fields (press Enter or comma to add, e.g. campaign, revenue)" style="flex:1;background:transparent;border:none;color:#e2e8f0;font-size:14px;outline:none;"/>'+
                (hasSearch||selectedNode?'<span id="clearAll" style="color:#64748b;cursor:pointer;padding:4px;">'+icons.x+'</span>':'')+
              '</div>'+
              (searchTags.length?'<div style="display:flex;flex-wrap:wrap;gap:6px;">'+tagsHtml+'</div>':'')+
              '<div style="margin-top:10px;font-size:10px;color:#64748b;">💡 Tip: Add multiple terms to find entities containing ALL of them. Matches "campaign_name", "Campaign Name", "campaignname" etc.</div>'+
            '</div>'+
          '</div>'+
          // Tab content
          '<div id="tab-content">'+(activeTab==='lineage'?renderLineageTab():renderDuplicatesTab())+'</div>'+
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
        selectedNode = null; upstream = []; downstream = [];
        render();
      });
      input.addEventListener('keydown', function(e) {
        if ((e.key === 'Enter' || e.key === ',') && searchTerm.trim()) {
          e.preventDefault();
          var term = searchTerm.trim().replace(/,/g, '');
          if (term && searchTags.indexOf(term) === -1) searchTags.push(term);
          searchTerm = '';
          render();
        } else if (e.key === 'Backspace' && !searchTerm && searchTags.length > 0) {
          searchTags.pop();
          render();
        }
      });
      input.focus();
      
      // Event: clear all
      var clearBtn = container.querySelector('#clearAll');
      if (clearBtn) clearBtn.addEventListener('click', function() {
        searchTerm = ''; searchTags = []; selectedNode = null; upstream = []; downstream = []; showFieldsPanel = null;
        render();
      });
      
      // Event: remove tag
      container.querySelectorAll('.remove-tag').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var idx = parseInt(btn.parentElement.dataset.idx);
          searchTags.splice(idx, 1);
          render();
        });
      });
      
      // Event: tabs
      container.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          activeTab = btn.dataset.tab;
          render();
        });
      });
      
      // Event: node click
      container.querySelectorAll('.node').forEach(function(n) {
        n.addEventListener('click', function(e) {
          if (e.target.closest('.fields-btn')) return;
          var id = n.dataset.id;
          var entity = allEntities.find(function(x) { return x.id === id; });
          if (selectedNode && selectedNode.id === id) { selectedNode = null; upstream = []; downstream = []; }
          else { selectedNode = entity; searchTerm = ''; searchTags = []; }
          showFieldsPanel = null;
          render();
        });
      });
      
      // Event: fields button
      container.querySelectorAll('.fields-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var id = btn.dataset.id;
          showFieldsPanel = showFieldsPanel === id ? null : id;
          render();
        });
      });
      
      // Event: close fields panel
      var closePanel = container.querySelector('#close-panel');
      if (closePanel) closePanel.addEventListener('click', function() { showFieldsPanel = null; render(); });
      
      // Event: duplicates expand
      container.querySelectorAll('.dup-header').forEach(function(h) {
        h.addEventListener('click', function() {
          var idx = parseInt(h.parentElement.dataset.idx);
          expandedDuplicates[idx] = !expandedDuplicates[idx];
          render();
        });
      });
    }
    
    render();
    done();
  }
});

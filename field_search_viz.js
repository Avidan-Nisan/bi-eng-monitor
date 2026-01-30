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
    
    // Smart match function - handles various formats
    function smartMatch(text, searchTerm) {
      if (!text || !searchTerm) return false;
      
      var textLower = text.toLowerCase();
      var termLower = searchTerm.toLowerCase().trim();
      
      // Direct contains
      if (textLower.indexOf(termLower) !== -1) return true;
      
      // Remove all separators and compare
      var textClean = textLower.replace(/[_\-\s\.]+/g, '');
      var termClean = termLower.replace(/[_\-\s\.]+/g, '');
      if (textClean.indexOf(termClean) !== -1) return true;
      
      // Check each word in the text against search term
      var textWords = textLower.split(/[_\-\s\.]+/).filter(function(w) { return w.length > 0; });
      for (var i = 0; i < textWords.length; i++) {
        if (textWords[i].indexOf(termLower) !== -1) return true;
        if (textWords[i].indexOf(termClean) !== -1) return true;
        // Partial match at start of word
        if (termClean.length >= 3 && textWords[i].substring(0, termClean.length) === termClean) return true;
      }
      
      return false;
    }
    
    function getSearchMatches() {
      var terms = searchTags.slice();
      if (searchTerm.trim()) terms.push(searchTerm.trim());
      if (terms.length === 0) return [];
      
      console.log('=== SEARCH ===');
      console.log('Terms:', terms);
      
      var matches = [];
      
      allEntities.forEach(function(entity) {
        // For each term, check if it's found in name OR in any field
        var allTermsFound = terms.every(function(term) {
          // Check name
          if (smartMatch(entity.name, term)) return true;
          // Check fields
          if (entity.fields && entity.fields.length > 0) {
            for (var i = 0; i < entity.fields.length; i++) {
              if (smartMatch(entity.fields[i], term)) return true;
            }
          }
          return false;
        });
        
        if (allTermsFound) {
          // Collect matched fields
          var fieldMatches = [];
          if (entity.fields) {
            entity.fields.forEach(function(field) {
              var fieldMatchesTerm = terms.some(function(term) {
                return smartMatch(field, term);
              });
              if (fieldMatchesTerm) fieldMatches.push(field);
            });
          }
          
          matches.push({
            entity: entity,
            nameMatch: terms.some(function(t) { return smartMatch(entity.name, t); }),
            fieldMatches: fieldMatches
          });
        }
      });
      
      console.log('Found:', matches.length);
      console.log('==============');
      
      // Sort by number of field matches
      matches.sort(function(a, b) {
        return b.fieldMatches.length - a.fieldMatches.length;
      });
      
      return matches;
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
    
    function findDuplicates() {
      var viewFields = {};
      
      allRows.forEach(function(row) {
        if (row.view && row.fields && row.fields.length > 0) {
          var key = row.view;
          if (!viewFields[key]) {
            viewFields[key] = { view: row.view, fields: [], dashboards: [], explores: [] };
          }
          row.fields.forEach(function(f) {
            if (viewFields[key].fields.indexOf(f) === -1) viewFields[key].fields.push(f);
          });
          if (row.dashboard && viewFields[key].dashboards.indexOf(row.dashboard) === -1) viewFields[key].dashboards.push(row.dashboard);
          if (row.explore && viewFields[key].explores.indexOf(row.explore) === -1) viewFields[key].explores.push(row.explore);
        }
      });
      
      var duplicates = [];
      var viewList = Object.values(viewFields).filter(function(v) { return v.fields.length >= 3; });
      
      for (var i = 0; i < viewList.length; i++) {
        for (var j = i + 1; j < viewList.length; j++) {
          var v1 = viewList[i], v2 = viewList[j];
          var common = v1.fields.filter(function(f) { return v2.fields.indexOf(f) !== -1; });
          var minFields = Math.min(v1.fields.length, v2.fields.length);
          var similarity = minFields > 0 ? (common.length / minFields) : 0;
          
          if (similarity >= 0.4 && common.length >= 3) {
            duplicates.push({ views: [v1, v2], commonFields: common, similarity: Math.round(similarity * 100) });
          }
        }
      }
      
      return duplicates.sort(function(a, b) { return b.similarity - a.similarity; });
    }
    
    function renderDuplicatesTab() {
      var duplicates = findDuplicates();
      
      var html = '<div style="padding:20px 24px;border-bottom:1px solid #1e293b;">'+
        '<div style="color:#e2e8f0;font-size:14px;font-weight:500;">Find Similar Views</div>'+
        '<div style="color:#64748b;font-size:12px;margin-top:4px;">Views with 40%+ field overlap (min 3 common fields)</div></div>';
      
      if (duplicates.length === 0) {
        html += '<div style="text-align:center;padding:60px 40px;">'+
          '<div style="font-size:48px;margin-bottom:16px;">✨</div>'+
          '<div style="color:#e2e8f0;font-size:16px;margin-bottom:8px;">No Similar Views Found</div>'+
          '<div style="color:#64748b;font-size:13px;">All views have unique field combinations.</div></div>';
      } else {
        html += '<div style="padding:12px 24px;border-bottom:1px solid #1e293b;background:#f9731615;font-size:13px;color:#f97316;">'+
          'Found '+duplicates.length+' pair(s) of similar views</div>';
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
              '<div style="margin-bottom:12px;"><div style="font-size:11px;color:#64748b;margin-bottom:8px;">'+dup.commonFields.length+' Common Fields</div>'+
                '<div style="display:flex;flex-wrap:wrap;gap:4px;max-height:100px;overflow-y:auto;">'+
                  dup.commonFields.map(function(f){ return '<span style="background:#10b98133;border:1px solid #10b981;padding:2px 8px;border-radius:4px;font-size:10px;color:#6ee7b7;">'+f+'</span>'; }).join('')+
                '</div></div></div>';
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
      } else if (searchTags.length > 0 || searchTerm.trim()) {
        filterMode = 'search';
        if (highlightedEntities.length > 0) {
          visibleEntities = allEntities.filter(function(e) { return highlightedEntities.indexOf(e.id) !== -1; });
        } else {
          visibleEntities = [];
        }
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
            stroke='#10b981'; op=0.6; sw=2;
          }
          var x1=f.x+nodeW, y1=f.y+nodeH/2, x2=t.x, y2=t.y+nodeH/2, mx=(x1+x2)/2;
          if (op > 0.5) edgesHtml += '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="8" stroke-opacity="0.15" filter="url(#glow)"/>';
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
        var isSearchMatch = highlightedEntities.indexOf(entity.id) !== -1 && !selectedNode;
        
        var borderColor = cfg.color, borderWidth = 1, glowHtml = '';
        if (isSelected) { borderColor = '#ffffff'; borderWidth = 2; glowHtml = '<rect x="-4" y="-4" width="'+(nodeW+8)+'" height="'+(nodeH+8)+'" rx="12" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.4" filter="url(#glow)"/>'; }
        else if (isUpstream) { borderColor = '#06b6d4'; borderWidth = 2; glowHtml = '<rect x="-3" y="-3" width="'+(nodeW+6)+'" height="'+(nodeH+6)+'" rx="11" fill="none" stroke="#06b6d4" stroke-width="1" stroke-opacity="0.4" filter="url(#glow)"/>'; }
        else if (isDownstream) { borderColor = '#f97316'; borderWidth = 2; glowHtml = '<rect x="-3" y="-3" width="'+(nodeW+6)+'" height="'+(nodeH+6)+'" rx="11" fill="none" stroke="#f97316" stroke-width="1" stroke-opacity="0.4" filter="url(#glow)"/>'; }
        else if (isSearchMatch) { borderColor = '#10b981'; borderWidth = 2; glowHtml = '<rect x="-3" y="-3" width="'+(nodeW+6)+'" height="'+(nodeH+6)+'" rx="11" fill="none" stroke="#10b981" stroke-width="1" stroke-opacity="0.5" filter="url(#glow)"/>'; }
        
        var nm = entity.name.length > 17 ? entity.name.substring(0,16)+'…' : entity.name;
        var subText = '<text x="46" y="'+(nodeH/2+11)+'" fill="'+cfg.color+'" font-size="9" opacity="0.7">'+entity.type.toUpperCase()+'</text>';
        
        if (isSearchMatch) {
          var match = searchMatches.find(function(m) { return m.entity.id === entity.id; });
          if (match && match.fieldMatches.length > 0) {
            subText = '<text x="46" y="'+(nodeH/2+11)+'" fill="#10b981" font-size="9">'+match.fieldMatches.length+' field'+(match.fieldMatches.length>1?'s':'')+' matched</text>';
          }
        }
        
        var hasFields = entity.fields && entity.fields.length > 0;
        var fieldsBtn = hasFields ? '<g class="fields-btn" data-id="'+entity.id+'" transform="translate('+(nodeW-26)+',8)" style="cursor:pointer;"><rect width="20" height="20" rx="5" fill="#10b981" fill-opacity="0.3" stroke="#10b981" stroke-width="1"/><g transform="translate(3,3)" fill="#10b981">'+icons.list+'</g><title>View '+entity.fields.length+' fields</title></g>' : '';
        
        nodesHtml += '<g class="node" data-id="'+entity.id+'" style="cursor:pointer;" transform="translate('+pos.x+','+pos.y+')">'+
          glowHtml+
          '<rect width="'+nodeW+'" height="'+nodeH+'" rx="10" fill="#0f172a" fill-opacity="0.95" stroke="'+borderColor+'" stroke-width="'+borderWidth+'"/>'+
          '<rect x="1" y="1" width="36" height="'+(nodeH-2)+'" rx="9" fill="'+cfg.color+'" fill-opacity="0.15"/>'+
          '<g transform="translate(11,'+(nodeH/2-7)+')" fill="'+cfg.color+'">'+typeIcons[entity.type]+'</g>'+
          '<text x="46" y="'+(nodeH/2-1)+'" fill="#e2e8f0" font-size="11" font-weight="500">'+nm+'</text>'+
          subText+
          fieldsBtn+
          '</g>';
      });
      
      // Column headers
      var hdrHtml = '';
      ['table','view','explore','dashboard'].forEach(function(type) {
        var cfg = typeConfig[type];
        hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="28" text-anchor="middle" fill="'+cfg.color+'" font-size="10" font-weight="600" letter-spacing="0.5">'+cfg.label.toUpperCase()+'</text>';
        hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="42" text-anchor="middle" fill="#475569" font-size="9">'+byType[type].length+' items</text>';
        hdrHtml += '<line x1="'+(colX[type]+nodeW/2)+'" y1="52" x2="'+(colX[type]+nodeW/2)+'" y2="'+(svgHeight-15)+'" stroke="'+cfg.color+'" stroke-opacity="0.08" stroke-width="1" stroke-dasharray="4,4"/>';
      });
      
      // Stats text
      var statsText = '';
      if (selectedNode) {
        statsText = '<span style="color:'+typeConfig[selectedNode.type].color+';font-weight:500;">'+selectedNode.name+'</span>'+
          '<span style="color:#06b6d4;margin-left:14px;">▲ '+upstream.length+'</span>'+
          '<span style="color:#f97316;margin-left:10px;">▼ '+downstream.length+'</span>';
      } else if ((searchTags.length > 0 || searchTerm.trim()) && highlightedEntities.length > 0) {
        statsText = '<span style="color:#10b981;font-weight:500;">'+highlightedEntities.length+' matches</span>';
      } else if (searchTags.length > 0 || searchTerm.trim()) {
        statsText = '<span style="color:#ef4444;">No matches found</span>';
      } else {
        statsText = '<span style="color:#64748b;">Click node to trace lineage</span>';
      }
      
      // Fields panel
      var fieldsPanelHtml = '';
      if (showFieldsPanel) {
        var panelEntity = allEntities.find(function(e) { return e.id === showFieldsPanel; });
        if (panelEntity && panelEntity.fields && panelEntity.fields.length > 0) {
          var sortedFields = panelEntity.fields.slice().sort();
          fieldsPanelHtml = '<div id="fields-panel" style="position:absolute;top:60px;right:20px;width:320px;max-height:450px;background:#1e293b;border:1px solid #475569;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.5);z-index:100;overflow:hidden;">'+
            '<div style="padding:14px 18px;border-bottom:1px solid #334155;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#1e293b,#334155);">'+
              '<div><div style="color:'+typeConfig[panelEntity.type].color+';font-size:14px;font-weight:600;">'+panelEntity.name+'</div>'+
              '<div style="color:#94a3b8;font-size:11px;margin-top:3px;">'+panelEntity.fields.length+' fields</div></div>'+
              '<span id="close-panel" style="color:#94a3b8;cursor:pointer;padding:6px;border-radius:6px;background:#334155;">'+icons.x+'</span></div>'+
            '<div style="padding:14px 18px;max-height:350px;overflow-y:auto;">'+
              '<div style="display:flex;flex-wrap:wrap;gap:6px;">'+
                sortedFields.map(function(f) {
                  var isMatch = searchMatches.some(function(m) { return m.entity.id === panelEntity.id && m.fieldMatches.indexOf(f) !== -1; });
                  return '<span style="background:'+(isMatch?'#10b98125':'#0f172a')+';border:1px solid '+(isMatch?'#10b981':'#334155')+';padding:5px 10px;border-radius:6px;font-size:11px;color:'+(isMatch?'#6ee7b7':'#e2e8f0')+';">'+f+'</span>';
                }).join('')+
              '</div></div></div>';
        }
      }
      
      return '<div style="position:relative;">'+
        '<div style="padding:12px 24px;border-bottom:1px solid #1e293b;font-size:12px;display:flex;justify-content:space-between;align-items:center;">'+
          '<div>'+statsText+'</div>'+
          '<div style="color:#64748b;font-size:11px;">'+(filterMode?visibleEntities.length+' of ':'')+allEntities.length+' entities</div></div>'+
        '<div style="padding:15px;overflow:auto;">'+
          '<svg width="'+svgWidth+'" height="'+svgHeight+'" style="font-family:system-ui,sans-serif;">'+
            '<defs>'+
              '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'+
              '<marker id="arrowGray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#334155"/></marker>'+
              '<marker id="arrowCyan" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#06b6d4"/></marker>'+
              '<marker id="arrowOrange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#f97316"/></marker>'+
              '<marker id="arrowGreen" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#10b981"/></marker>'+
            '</defs>'+hdrHtml+edgesHtml+nodesHtml+
          '</svg></div>'+fieldsPanelHtml+'</div>';
    }
    
    function attachLineageEvents() {
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
      
      container.querySelectorAll('.fields-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var id = btn.dataset.id;
          showFieldsPanel = showFieldsPanel === id ? null : id;
          var tabContent = container.querySelector('#tab-content');
          if (tabContent && activeTab === 'lineage') {
            tabContent.innerHTML = renderLineageTab();
            attachLineageEvents();
          }
        });
      });
      
      var closePanel = container.querySelector('#close-panel');
      if (closePanel) closePanel.addEventListener('click', function() { 
        showFieldsPanel = null; 
        var tabContent = container.querySelector('#tab-content');
        if (tabContent && activeTab === 'lineage') {
          tabContent.innerHTML = renderLineageTab();
          attachLineageEvents();
        }
      });
    }
    
    function render() {
      var logoHtml = '<img src="https://avidan-nisan.github.io/bi-eng-monitor/logo.png" width="40" height="40" style="border-radius:8px;" onerror="this.style.display=\'none\'"/>';
      
      var tagsHtml = searchTags.map(function(tag, i) {
        return '<span class="search-tag" data-idx="'+i+'" style="display:inline-flex;align-items:center;gap:6px;background:#10b98125;border:1px solid #10b981;padding:6px 10px 6px 12px;border-radius:8px;font-size:12px;color:#6ee7b7;font-weight:500;">'+tag+'<span class="remove-tag" style="cursor:pointer;opacity:0.7;padding:2px;">'+icons.x+'</span></span>';
      }).join('');
      
      var hasSearch = searchTags.length > 0 || searchTerm.trim();
      
      container.innerHTML = 
        '<div style="background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);min-height:600px;">'+
          '<div style="padding:14px 24px;border-bottom:1px solid #1e293b;">'+
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'+
              '<div style="display:flex;align-items:center;gap:12px;">'+logoHtml+
                '<div><div style="font-weight:600;color:#f1f5f9;font-size:16px;">Asset Manager</div>'+
                '<div style="font-size:10px;color:#64748b;">'+allRows.length+' assets</div></div></div>'+
              '<div style="display:flex;border-bottom:2px solid #334155;">'+
                '<button class="tab-btn" data-tab="lineage" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;font-weight:500;background:transparent;border-bottom:2px solid '+(activeTab==='lineage'?'#10b981':'transparent')+';margin-bottom:-2px;color:'+(activeTab==='lineage'?'#10b981':'#64748b')+';">'+icons.lineage+' Data Lineage</button>'+
                '<button class="tab-btn" data-tab="duplicates" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;font-weight:500;background:transparent;border-bottom:2px solid '+(activeTab==='duplicates'?'#f97316':'transparent')+';margin-bottom:-2px;color:'+(activeTab==='duplicates'?'#f97316':'#64748b')+';">'+icons.duplicate+' Similar Views</button>'+
              '</div></div>'+
            '<div style="background:linear-gradient(135deg,#1e293b,#334155);border:1px solid #475569;border-radius:12px;padding:16px;">'+
              '<div style="display:flex;align-items:center;gap:10px;margin-bottom:'+(searchTags.length?'12px':'0')+';">'+
                '<span style="color:#10b981;">'+icons.search+'</span>'+
                '<input id="searchInput" type="text" value="'+searchTerm+'" placeholder="Search for fields... (press Enter to add term)" autocomplete="off" spellcheck="false" style="flex:1;background:transparent;border:none;color:#e2e8f0;font-size:14px;outline:none;"/>'+
                (hasSearch||selectedNode?'<span id="clearAll" style="color:#64748b;cursor:pointer;padding:6px;border-radius:6px;background:#334155;">'+icons.x+'</span>':'')+
              '</div>'+
              (searchTags.length?'<div style="display:flex;flex-wrap:wrap;gap:8px;">'+tagsHtml+'</div>':'')+
              '<div style="margin-top:12px;font-size:11px;color:#64748b;">💡 Click the green <span style="color:#10b981;background:#10b98125;padding:1px 4px;border-radius:3px;">☰</span> button on nodes to view all fields</div>'+
            '</div></div>'+
          '<div id="tab-content">'+(activeTab==='lineage'?renderLineageTab():renderDuplicatesTab())+'</div>'+
          '<div style="padding:10px 24px;border-top:1px solid #1e293b;display:flex;gap:20px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">'+
            '<span><span style="color:#06b6d4;">━━</span> Upstream</span>'+
            '<span><span style="color:#f97316;">━━</span> Downstream</span>'+
            '<span><span style="color:#10b981;">━━</span> Match</span>'+
          '</div></div>';
      
      // Search input events
      var input = container.querySelector('#searchInput');
      var debounceTimer = null;
      
      input.addEventListener('input', function(e) {
        searchTerm = e.target.value;
        selectedNode = null; upstream = []; downstream = [];
        
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
          var tabContent = container.querySelector('#tab-content');
          if (tabContent && activeTab === 'lineage') {
            tabContent.innerHTML = renderLineageTab();
            attachLineageEvents();
          }
        }, 250);
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
      input.setSelectionRange(input.value.length, input.value.length);
      
      // Clear button
      var clearBtn = container.querySelector('#clearAll');
      if (clearBtn) clearBtn.addEventListener('click', function() {
        searchTerm = ''; searchTags = []; selectedNode = null; upstream = []; downstream = []; showFieldsPanel = null;
        render();
      });
      
      // Remove tag buttons
      container.querySelectorAll('.remove-tag').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var idx = parseInt(btn.parentElement.dataset.idx);
          searchTags.splice(idx, 1);
          render();
        });
      });
      
      // Tab buttons
      container.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          activeTab = btn.dataset.tab;
          render();
        });
      });
      
      // Lineage events
      if (activeTab === 'lineage') {
        attachLineageEvents();
      }
      
      // Duplicates expand events
      container.querySelectorAll('.dup-header').forEach(function(h) {
        h.addEventListener('click', function() {
          var idx = parseInt(h.parentElement.dataset.idx);
          expandedDuplicates[idx] = !expandedDuplicates[idx];
          var tabContent = container.querySelector('#tab-content');
          if (tabContent) {
            tabContent.innerHTML = renderDuplicatesTab();
            container.querySelectorAll('.dup-header').forEach(function(h2) {
              h2.addEventListener('click', function() {
                var idx2 = parseInt(h2.parentElement.dataset.idx);
                expandedDuplicates[idx2] = !expandedDuplicates[idx2];
                tabContent.innerHTML = renderDuplicatesTab();
              });
            });
          }
        });
      });
    }
    
    render();
    done();
  }
});

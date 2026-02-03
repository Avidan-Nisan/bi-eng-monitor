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
    var viewField = fields.find(function(f) { return f.toLowerCase().indexOf('view') !== -1 && f.toLowerCase().indexOf('name') !== -1 && f.toLowerCase().indexOf('count') === -1 && f.toLowerCase().indexOf('extended') === -1 && f.toLowerCase().indexOf('included') === -1; });
    var tableField = fields.find(function(f) { return f.toLowerCase().indexOf('sql_table') !== -1 && f.toLowerCase().indexOf('fields') === -1 && f.toLowerCase().indexOf('path') === -1; });
    var extendedViewField = fields.find(function(f) { return f.toLowerCase().indexOf('extended') !== -1 && f.toLowerCase().indexOf('view') !== -1; });
    var includedViewField = fields.find(function(f) { return f.toLowerCase().indexOf('included') !== -1 && f.toLowerCase().indexOf('view') !== -1; });
    
    var fieldsField = null;
    for (var i = 0; i < fields.length; i++) {
      var fl = fields[i].toLowerCase();
      if (fl.indexOf('sql_table_fields') !== -1) { fieldsField = fields[i]; break; }
    }
    
    // Collect all table names for filtering
    var allTableNames = {};
    data.forEach(function(row) {
      if (tableField && row[tableField] && row[tableField].value) {
        var tblName = row[tableField].value.toLowerCase().trim();
        allTableNames[tblName] = true;
        var parts = tblName.split('.');
        if (parts.length > 1) allTableNames[parts[parts.length - 1]] = true;
      }
    });
    
    // PREFIX EXTRACTION FUNCTIONS
    function getTablePrefix(tableName) {
      if (!tableName) return null;
      var name = tableName.toLowerCase();
      if (name === '[looker_derived_fields]') return null;
      if (name.indexOf('template_') === 0) return null;
      if (name.indexOf('off_platform_') === 0) return null;
      var idx = name.indexOf('_');
      return idx > 0 ? name.substring(0, idx) : null;
    }
    
    function getFieldPrefix(fieldName) {
      if (!fieldName) return null;
      var name = fieldName.toLowerCase();
      var idx = name.indexOf('_');
      return idx > 0 ? name.substring(0, idx) : null;
    }
    
    // Build per-row data with clean fields
    var allRows = data.map(function(row) {
      var fieldsVal = fieldsField && row[fieldsField] ? row[fieldsField].value || '' : '';
      var rawFields = fieldsVal ? fieldsVal.split('|').filter(function(f) { return f.trim(); }) : [];
      var cleanFields = rawFields.filter(function(f) {
        var fLower = f.toLowerCase().trim();
        if (allTableNames[fLower]) return false;
        if (fLower.indexOf('.') !== -1) return false;
        return true;
      });
      
      return { 
        dashboard: row[dashField] ? row[dashField].value : '', 
        explore: row[expField] ? row[expField].value : '', 
        view: row[viewField] ? row[viewField].value : '', 
        table: tableField && row[tableField] ? row[tableField].value : '', 
        fields: cleanFields,
        extendedView: extendedViewField && row[extendedViewField] ? row[extendedViewField].value : '',
        includedView: includedViewField && row[includedViewField] ? row[includedViewField].value : ''
      };
    });
    
    // COLLECT ALL UNIQUE FIELDS
    var allUniqueFields = {};
    allRows.forEach(function(row) {
      row.fields.forEach(function(f) {
        allUniqueFields[f] = true;
      });
    });
    var allFieldsList = Object.keys(allUniqueFields);
    
    // Collect all unique table names
    var allTablesList = [];
    allRows.forEach(function(row) {
      if (row.table && allTablesList.indexOf(row.table) === -1) {
        allTablesList.push(row.table);
      }
    });
    
    // KEY FIX: Assign fields to tables ONLY by prefix match
    var tableOwnFields = {};
    allTablesList.forEach(function(tbl) {
      var tablePrefix = getTablePrefix(tbl);
      
      if (tablePrefix) {
        tableOwnFields[tbl] = allFieldsList.filter(function(f) {
          var fieldPrefix = getFieldPrefix(f);
          return fieldPrefix === tablePrefix;
        });
      } else {
        tableOwnFields[tbl] = [];
      }
    });
    
    // DEBUG - V2 with specific table checks
    console.log('=== ASSET MANAGER V2 ===');
    console.log('Total tables:', allTablesList.length, 'Total fields:', allFieldsList.length);
    
    ['dima_marketer', 'dics_campaign_settings', 'dipb_publisher', 'dise_section'].forEach(function(t) {
      if (tableOwnFields[t]) {
        var prefix = getTablePrefix(t);
        var flds = tableOwnFields[t];
        var wrongFields = flds.filter(function(f) {
          var fp = getFieldPrefix(f);
          return fp && fp !== prefix;
        });
        console.log('TABLE:', t, '| prefix:', prefix, '| fields:', flds.length, '| wrong:', wrongFields.length);
        if (wrongFields.length > 0) {
          console.log('  WRONG FIELDS:', wrongFields.slice(0, 10));
        } else {
          console.log('  SAMPLE:', flds.slice(0, 5));
        }
      }
    });
    
    // BUILD ENTITIES
    var tables = {}, views = {}, explores = {}, dashboards = {};
    var viewToTables = {}, viewToViews = {}, exploreToViews = {}, dashToExplores = {};
    
    allRows.forEach(function(row) {
      var tbl = row.table, vw = row.view, exp = row.explore, dash = row.dashboard;
      var extVw = row.extendedView, incVw = row.includedView;
      
      // Create TABLE with ONLY prefix-matched fields
      if (tbl && !tables[tbl]) {
        tables[tbl] = { 
          id: 't_' + tbl, 
          name: tbl, 
          type: 'table', 
          sources: [], 
          fields: tableOwnFields[tbl] || [],
          sqlTables: [tbl] 
        };
      }
      
      // Create VIEW
      if (vw && !views[vw]) {
        views[vw] = { id: 'v_' + vw, name: vw, type: 'view', sources: [], fields: [], sqlTables: [] };
      }
      if (exp && !explores[exp]) {
        explores[exp] = { id: 'e_' + exp, name: exp, type: 'explore', sources: [], fields: [], sqlTables: [] };
      }
      if (dash && !dashboards[dash]) {
        dashboards[dash] = { id: 'd_' + dash, name: dash, type: 'dashboard', sources: [], fields: [], sqlTables: [] };
      }
      if (extVw && !views[extVw]) {
        views[extVw] = { id: 'v_' + extVw, name: extVw, type: 'view', sources: [], fields: [], sqlTables: [] };
      }
      if (incVw && !views[incVw]) {
        views[incVw] = { id: 'v_' + incVw, name: incVw, type: 'view', sources: [], fields: [], sqlTables: [] };
      }
      
      // Views get ALL fields from their rows
      if (vw && views[vw]) { 
        row.fields.forEach(function(f) { 
          if (views[vw].fields.indexOf(f) === -1) views[vw].fields.push(f); 
        }); 
        if (tbl && views[vw].sqlTables.indexOf(tbl) === -1) views[vw].sqlTables.push(tbl); 
      }
      
      if (exp && explores[exp]) { 
        row.fields.forEach(function(f) { 
          if (explores[exp].fields.indexOf(f) === -1) explores[exp].fields.push(f); 
        }); 
        if (tbl && explores[exp].sqlTables.indexOf(tbl) === -1) explores[exp].sqlTables.push(tbl); 
      }
      
      if (dash && dashboards[dash]) { 
        row.fields.forEach(function(f) { 
          if (dashboards[dash].fields.indexOf(f) === -1) dashboards[dash].fields.push(f); 
        }); 
        if (tbl && dashboards[dash].sqlTables.indexOf(tbl) === -1) dashboards[dash].sqlTables.push(tbl); 
      }
      
      // Build relationships
      if (vw && tbl) { 
        if (!viewToTables[vw]) viewToTables[vw] = {}; 
        viewToTables[vw]['t_' + tbl] = true; 
      }
      if (vw && extVw && vw !== extVw) { 
        if (!viewToViews[vw]) viewToViews[vw] = {}; 
        viewToViews[vw]['v_' + extVw] = true; 
      }
      if (vw && incVw && vw !== incVw) { 
        if (!viewToViews[vw]) viewToViews[vw] = {}; 
        viewToViews[vw]['v_' + incVw] = true; 
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
    
    // Assign sources
    Object.keys(views).forEach(function(k) { 
      views[k].sources = Object.keys(viewToTables[k] || {}).concat(Object.keys(viewToViews[k] || {})); 
    });
    Object.keys(explores).forEach(function(k) { 
      explores[k].sources = Object.keys(exploreToViews[k] || {}); 
    });
    Object.keys(dashboards).forEach(function(k) { 
      dashboards[k].sources = Object.keys(dashToExplores[k] || {}); 
    });
    
    var allEntities = Object.values(tables).concat(Object.values(views)).concat(Object.values(explores)).concat(Object.values(dashboards));
    
    // State
    var activeTab = 'lineage', searchTerm = '', searchTags = [], selectedNode = null;
    var upstream = [], downstream = [], highlightedEntities = [], expandedDuplicates = {};
    var similarResults = null, analysisLoading = false, analysisError = null;
    
    // Icons
    var icons = { 
      search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>', 
      x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', 
      lineage: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l4-6h2M11 12l4 6h2"/></svg>', 
      duplicate: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/></svg>', 
      chevronDown: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'
    };
    var typeIcons = { 
      table: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="9" width="8" height="3"/><rect x="13" y="9" width="8" height="3"/><rect x="3" y="14" width="8" height="3"/><rect x="13" y="14" width="8" height="3"/></svg>', 
      view: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7z"/></svg>', 
      explore: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>', 
      dashboard: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="2" y="2" width="9" height="6" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="10" width="9" height="12" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>' 
    };
    var typeConfig = { 
      table: { color: '#06b6d4', label: 'SQL Tables' }, 
      view: { color: '#8b5cf6', label: 'Views' }, 
      explore: { color: '#ec4899', label: 'Explores' }, 
      dashboard: { color: '#f97316', label: 'Dashboards' } 
    };

    function normalize(str) { return str ? str.toLowerCase().replace(/[_\-\s\.]+/g, '') : ''; }
    
    function smartMatch(text, term) {
      if (!text || !term) return false;
      var tL = text.toLowerCase(), sL = term.toLowerCase().trim();
      return tL.indexOf(sL) !== -1 || normalize(text).indexOf(normalize(term)) !== -1;
    }
    
    function getUpstream(id, d, v) { 
      if (d > 15) return []; v = v || {}; if (v[id]) return []; v[id] = true; 
      var e = allEntities.find(function(x) { return x.id === id; }); 
      if (!e || !e.sources) return []; 
      var r = []; 
      e.sources.forEach(function(s) { if (!v[s]) { r.push(s); r = r.concat(getUpstream(s, (d||0)+1, v)); } }); 
      return r.filter(function(x,i,a) { return a.indexOf(x)===i; }); 
    }
    
    function getDownstream(id, d, v) { 
      if (d > 15) return []; v = v || {}; if (v[id]) return []; v[id] = true; 
      var r = []; 
      allEntities.forEach(function(e) { 
        if (e.sources && e.sources.indexOf(id) !== -1 && !v[e.id]) { r.push(e.id); r = r.concat(getDownstream(e.id, (d||0)+1, v)); } 
      }); 
      return r.filter(function(x,i,a) { return a.indexOf(x)===i; }); 
    }
    
    function findSimilarFields(f1, f2) {
      var m = [];
      f1.forEach(function(a) { f2.forEach(function(b) { if (a.toLowerCase() === b.toLowerCase()) m.push({ f1: a, f2: b, exact: true }); }); });
      return m;
    }
    
    function runAnalysis() {
      if (analysisLoading) return;
      analysisLoading = true; analysisError = null; render();
      
      setTimeout(function() {
        try {
          var results = [];
          var vList = Object.values(views).filter(function(v) { return v.fields && v.fields.length > 0; });
          
          for (var i = 0; i < vList.length; i++) {
            for (var j = i + 1; j < vList.length; j++) {
              var v1 = vList[i], v2 = vList[j];
              var shared = v1.sqlTables.filter(function(t) { return v2.sqlTables.indexOf(t) !== -1; });
              var similar = findSimilarFields(v1.fields, v2.fields);
              var exact = similar.filter(function(m) { return m.exact; });
              
              if (shared.length >= 1 || exact.length >= 3) {
                var reasons = [];
                if (shared.length > 0) reasons.push({ type: 'tables', count: shared.length, items: shared });
                if (exact.length > 0) reasons.push({ type: 'exactFields', count: exact.length, items: exact.map(function(m) { return m.f1; }) });
                
                var sim = Math.round((shared.length * 30 + exact.length * 5) / Math.max(1, Math.min(v1.fields.length, v2.fields.length)) * 10);
                results.push({ v1: v1.name, v2: v2.name, type: 'view', similarity: Math.min(100, sim), reasons: reasons, sharedTables: shared, similarFields: similar });
              }
            }
          }
          
          results.sort(function(a, b) { return b.similarity - a.similarity; });
          similarResults = results.slice(0, 50);
          analysisLoading = false; render();
        } catch(e) { similarResults = []; analysisError = 'Error: ' + e.message; analysisLoading = false; render(); }
      }, 100);
    }
    
    function renderDuplicatesTab() {
      var vc = Object.values(views).filter(function(v) { return v.fields && v.fields.length > 0; }).length;
      
      var h = '<div style="padding:16px 24px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;">';
      h += '<div style="color:#94a3b8;font-size:13px;">Analyzing <span style="color:#e2e8f0;font-weight:500;">' + vc + '</span> views</div>';
      if (similarResults) h += '<button id="refreshBtn" style="background:transparent;border:1px solid #475569;padding:6px 12px;border-radius:6px;color:#94a3b8;cursor:pointer;font-size:11px;">Refresh</button>';
      h += '</div>';
      
      if (analysisLoading) {
        h += '<div style="text-align:center;padding:80px 40px;"><div style="color:#8b5cf6;font-size:14px;">Analyzing...</div></div>';
      } else if (analysisError) {
        h += '<div style="text-align:center;padding:80px 40px;color:#ef4444;font-size:14px;">' + analysisError + '</div>';
      } else if (!similarResults || similarResults.length === 0) {
        h += '<div style="text-align:center;padding:80px 40px;"><div style="color:#10b981;font-size:14px;">No similar views found</div></div>';
      } else {
        h += '<div style="max-height:480px;overflow-y:auto;">';
        similarResults.forEach(function(pair, idx) {
          var isExp = expandedDuplicates[idx];
          var sum = [];
          pair.reasons.forEach(function(r) {
            if (r.type === 'tables') sum.push(r.count + ' shared table' + (r.count > 1 ? 's' : ''));
            if (r.type === 'exactFields') sum.push(r.count + ' identical field' + (r.count > 1 ? 's' : ''));
          });
          
          h += '<div class="dup-row" data-idx="' + idx + '" style="border-bottom:1px solid #1e293b;">';
          h += '<div class="dup-header" style="display:flex;align-items:center;gap:16px;padding:14px 20px;cursor:pointer;">';
          h += '<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#8b5cf620,#ec489920);display:flex;align-items:center;justify-content:center;font-size:13px;color:#a78bfa;font-weight:600;">' + pair.similarity + '%</div>';
          h += '<div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span style="color:#e2e8f0;font-size:13px;font-weight:500;">' + pair.v1 + '</span><span style="color:#475569;">—</span><span style="color:#e2e8f0;font-size:13px;font-weight:500;">' + pair.v2 + '</span></div>';
          h += '<div style="color:#64748b;font-size:11px;">' + sum.join(' | ') + '</div></div>';
          h += '<span style="color:#475569;">' + icons.chevronDown + '</span></div>';
          
          if (isExp) {
            h += '<div style="padding:0 20px 16px 80px;background:#0f172a;">';
            pair.reasons.forEach(function(r) {
              if (r.type === 'tables' && r.items.length > 0) {
                h += '<div style="margin-bottom:12px;"><div style="font-size:10px;color:#64748b;margin-bottom:6px;">Shared SQL Tables</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
                r.items.forEach(function(t) { h += '<span style="background:#06b6d415;border:1px solid #06b6d450;padding:4px 10px;border-radius:4px;font-size:11px;color:#22d3ee;">' + t + '</span>'; });
                h += '</div></div>';
              }
              if (r.type === 'exactFields' && r.items.length > 0) {
                h += '<div style="margin-bottom:12px;"><div style="font-size:10px;color:#64748b;margin-bottom:6px;">Identical Fields</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
                r.items.forEach(function(f) { h += '<span style="background:#10b98115;border:1px solid #10b98150;padding:4px 10px;border-radius:4px;font-size:11px;color:#6ee7b7;">' + f + '</span>'; });
                h += '</div></div>';
              }
            });
            h += '</div>';
          }
          h += '</div>';
        });
        h += '</div>';
      }
      return h;
    }
    
    function getSearchMatches() {
      var terms = searchTags.slice(); 
      if (searchTerm.trim()) terms.push(searchTerm.trim()); 
      if (terms.length === 0) return [];
      
      var matches = [], partial = [];
      
      allEntities.forEach(function(entity) {
        var matchCount = 0, fieldMatches = [];
        
        terms.forEach(function(term) {
          var matched = false;
          if (smartMatch(entity.name, term)) matched = true;
          if (entity.fields && entity.fields.length > 0) {
            entity.fields.forEach(function(f) {
              if (smartMatch(f, term)) { matched = true; if (fieldMatches.indexOf(f) === -1) fieldMatches.push(f); }
            });
          }
          if (matched) matchCount++;
        });
        
        var data = { entity: entity, fieldMatches: fieldMatches, totalTerms: terms.length, matchedTermsCount: matchCount };
        if (matchCount === terms.length) matches.push(data);
        else if (matchCount > 0) partial.push(data);
      });
      
      window._partialMatches = partial.sort(function(a, b) { return b.matchedTermsCount - a.matchedTermsCount; }).slice(0, 10);
      return matches.sort(function(a, b) { return b.fieldMatches.length - a.fieldMatches.length; });
    }
    
    function renderLineageTab() {
      var searchMatches = getSearchMatches(); 
      highlightedEntities = searchMatches.map(function(m) { return m.entity.id; });
      var visible = allEntities, mode = '';
      
      if (selectedNode) { 
        mode = 'lineage'; 
        upstream = getUpstream(selectedNode.id, 0); 
        downstream = getDownstream(selectedNode.id, 0); 
        var ids = [selectedNode.id].concat(upstream).concat(downstream); 
        visible = allEntities.filter(function(e) { return ids.indexOf(e.id) !== -1; }); 
      } else if (searchTags.length > 0 || searchTerm.trim()) { 
        mode = 'search'; 
        visible = highlightedEntities.length > 0 ? allEntities.filter(function(e) { return highlightedEntities.indexOf(e.id) !== -1; }) : [];
      }
      
      var byType = { table: [], view: [], explore: [], dashboard: [] }; 
      visible.forEach(function(e) { byType[e.type].push(e); }); 
      ['table','view','explore','dashboard'].forEach(function(t) { byType[t].sort(function(a,b) { return a.name.localeCompare(b.name); }); });
      
      var nodeW = 200, nodeH = 38, spacing = 46, pad = 15;
      var svgW = Math.max(containerWidth - 30, 1100);
      var colSp = (svgW - pad * 2 - nodeW) / 3;
      var colX = { table: pad, view: pad + colSp, explore: pad + colSp * 2, dashboard: pad + colSp * 3 };
      var pos = {}, startY = 65;
      
      ['table','view','explore','dashboard'].forEach(function(type) { 
        byType[type].forEach(function(e, idx) { pos[e.id] = { x: colX[type], y: startY + idx * spacing }; }); 
      });
      
      var maxC = Math.max(byType.table.length||1, byType.view.length||1, byType.explore.length||1, byType.dashboard.length||1);
      var svgH = Math.max(maxC * spacing + 100, 350);
      
      var edges = ''; 
      visible.forEach(function(e) { 
        (e.sources||[]).forEach(function(s) { 
          var f = pos[s], t = pos[e.id]; 
          if (!f || !t) return; 
          var stroke = '#334155', op = 0.25, sw = 1.5; 
          if (selectedNode) { 
            if (s === selectedNode.id || downstream.indexOf(e.id) !== -1) { stroke = '#f97316'; op = 0.9; sw = 2.5; } 
            else if (e.id === selectedNode.id || upstream.indexOf(s) !== -1) { stroke = '#06b6d4'; op = 0.9; sw = 2.5; } 
          } else if (mode === 'search') { stroke = '#10b981'; op = 0.6; sw = 2; } 
          var x1 = f.x + nodeW, y1 = f.y + nodeH/2, x2 = t.x, y2 = t.y + nodeH/2, mx = (x1+x2)/2; 
          edges += '<path d="M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ',' + mx + ' ' + y2 + ',' + x2 + ' ' + y2 + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-opacity="' + op + '"/>'; 
        }); 
      });
      
      var nodes = ''; 
      visible.forEach(function(entity) { 
        var p = pos[entity.id], cfg = typeConfig[entity.type];
        var isSel = selectedNode && selectedNode.id === entity.id;
        var isUp = selectedNode && upstream.indexOf(entity.id) !== -1;
        var isDown = selectedNode && downstream.indexOf(entity.id) !== -1;
        var isMatch = highlightedEntities.indexOf(entity.id) !== -1 && !selectedNode;
        
        var bc = cfg.color, bw = 1;
        if (isSel) { bc = '#ffffff'; bw = 2; }
        else if (isUp) { bc = '#06b6d4'; bw = 2; }
        else if (isDown) { bc = '#f97316'; bw = 2; }
        else if (isMatch) { bc = '#10b981'; bw = 2; }
        
        var nm = entity.name.length > 26 ? entity.name.substring(0,25) + '...' : entity.name;
        nodes += '<g class="node" data-id="' + entity.id + '" style="cursor:pointer;" transform="translate(' + p.x + ',' + p.y + ')">';
        nodes += '<rect width="' + nodeW + '" height="' + nodeH + '" rx="8" fill="#0f172a" stroke="' + bc + '" stroke-width="' + bw + '"/>';
        nodes += '<rect x="1" y="1" width="32" height="' + (nodeH-2) + '" rx="7" fill="' + cfg.color + '" fill-opacity="0.15"/>';
        nodes += '<g transform="translate(9,' + (nodeH/2-7) + ')" fill="' + cfg.color + '">' + typeIcons[entity.type] + '</g>';
        nodes += '<text x="40" y="' + (nodeH/2+4) + '" fill="#e2e8f0" font-size="10" font-weight="500">' + nm + '</text></g>'; 
      });
      
      var hdr = ''; 
      ['table','view','explore','dashboard'].forEach(function(type) { 
        var cfg = typeConfig[type]; 
        hdr += '<text x="' + (colX[type]+nodeW/2) + '" y="22" text-anchor="middle" fill="' + cfg.color + '" font-size="9" font-weight="600">' + cfg.label.toUpperCase() + '</text>';
        hdr += '<text x="' + (colX[type]+nodeW/2) + '" y="36" text-anchor="middle" fill="#475569" font-size="8">' + byType[type].length + ' items</text>'; 
      });
      
      var stats = '';
      if (selectedNode) {
        stats = '<span style="color:' + typeConfig[selectedNode.type].color + ';">' + selectedNode.name + '</span> ';
        stats += '<span style="color:#06b6d4;">Up:' + upstream.length + '</span> <span style="color:#f97316;">Down:' + downstream.length + '</span>';
      } else if ((searchTags.length > 0 || searchTerm.trim()) && highlightedEntities.length > 0) {
        stats = '<span style="color:#10b981;">' + highlightedEntities.length + ' matches</span>';
      } else if (searchTags.length > 0 || searchTerm.trim()) {
        stats = '<span style="color:#ef4444;">No matches</span>';
      } else {
        stats = '<span style="color:#64748b;">Click node to trace lineage</span>';
      }
      
      var noRes = '';
      if (mode === 'search' && visible.length === 0) {
        noRes = '<div style="padding:20px;background:#1e293b;margin:12px;border-radius:8px;">';
        noRes += '<div style="color:#f59e0b;font-size:14px;margin-bottom:16px;">No assets found</div>';
        if (window._partialMatches && window._partialMatches.length > 0) {
          noRes += '<div style="color:#94a3b8;font-size:12px;margin-bottom:8px;">Partial matches:</div><div style="display:flex;flex-direction:column;gap:6px;">';
          window._partialMatches.slice(0, 5).forEach(function(pm) {
            var cfg = typeConfig[pm.entity.type];
            noRes += '<div style="padding:8px 12px;background:#0f172a;border-radius:6px;border-left:3px solid ' + cfg.color + ';"><div style="color:#e2e8f0;font-size:12px;">' + pm.entity.name + '</div><div style="color:#64748b;font-size:10px;margin-top:2px;">' + pm.fieldMatches.slice(0,3).join(', ') + '</div></div>';
          });
          noRes += '</div>';
        }
        noRes += '</div>';
      }
      
      var r = '<div><div style="padding:10px 20px;border-bottom:1px solid #1e293b;font-size:12px;display:flex;justify-content:space-between;"><div>' + stats + '</div><div style="color:#64748b;font-size:11px;">' + (mode ? visible.length + ' of ' : '') + allEntities.length + ' entities</div></div>';
      if (noRes) r += noRes;
      else r += '<div style="padding:12px;overflow:auto;"><svg width="' + svgW + '" height="' + svgH + '" style="font-family:system-ui,sans-serif;">' + hdr + edges + nodes + '</svg></div>';
      return r + '</div>';
    }
    
    function attachEvents() {
      container.querySelectorAll('.node').forEach(function(n) { 
        n.addEventListener('click', function() { 
          var id = n.dataset.id, entity = allEntities.find(function(x) { return x.id === id; }); 
          if (selectedNode && selectedNode.id === id) { selectedNode = null; upstream = []; downstream = []; } 
          else { selectedNode = entity; searchTerm = ''; searchTags = []; } 
          render(); 
        }); 
      });
      
      var rb = container.querySelector('#refreshBtn'); 
      if (rb) rb.addEventListener('click', function() { runAnalysis(); });
      
      container.querySelectorAll('.dup-header').forEach(function(h) { 
        h.addEventListener('click', function() { 
          var idx = parseInt(h.parentElement.dataset.idx); 
          expandedDuplicates[idx] = !expandedDuplicates[idx]; 
          var tc = container.querySelector('#tab-content'); 
          if (tc) { tc.innerHTML = renderDuplicatesTab(); attachEvents(); } 
        }); 
      });
    }
    
    function render() {
      var tags = searchTags.map(function(tag, i) { 
        return '<span class="search-tag" data-idx="' + i + '" style="display:inline-flex;align-items:center;gap:6px;background:#10b98125;border:1px solid #10b981;padding:6px 10px;border-radius:8px;font-size:12px;color:#6ee7b7;">' + (i+1) + '. ' + tag + '<span class="remove-tag" style="cursor:pointer;padding:2px;">' + icons.x + '</span></span>'; 
      }).join('');
      
      var hasS = searchTags.length > 0 || searchTerm.trim();
      
      var h = '<div style="background:#0f172a;min-height:600px;"><div style="padding:14px 24px;border-bottom:1px solid #1e293b;">';
      h += '<div style="display:flex;justify-content:space-between;margin-bottom:14px;"><div><div style="font-weight:600;color:#f1f5f9;font-size:16px;">Asset Manager</div><div style="font-size:10px;color:#64748b;">' + allRows.length + ' assets</div></div>';
      h += '<div style="display:flex;gap:0;"><button class="tab-btn" data-tab="lineage" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;background:' + (activeTab==='lineage'?'#1e293b':'transparent') + ';color:' + (activeTab==='lineage'?'#10b981':'#64748b') + ';border-radius:8px 0 0 8px;border:1px solid #334155;">' + icons.lineage + ' Lineage</button>';
      h += '<button class="tab-btn" data-tab="duplicates" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;background:' + (activeTab==='duplicates'?'#1e293b':'transparent') + ';color:' + (activeTab==='duplicates'?'#8b5cf6':'#64748b') + ';border-radius:0 8px 8px 0;border:1px solid #334155;border-left:none;">' + icons.duplicate + ' Similar Views</button></div></div>';
      h += '<div style="background:#1e293b;border:1px solid #475569;border-radius:12px;padding:16px;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:' + (searchTags.length ? '12px' : '0') + ';"><span style="color:#10b981;">' + icons.search + '</span><input id="searchInput" type="text" value="' + searchTerm + '" placeholder="Search fields (comma for AND)..." style="flex:1;background:transparent;border:none;color:#e2e8f0;font-size:14px;outline:none;"/>';
      if (hasS || selectedNode) h += '<span id="clearAll" style="color:#64748b;cursor:pointer;padding:6px 10px;border-radius:6px;background:#334155;font-size:11px;">Clear</span>';
      h += '</div>';
      if (searchTags.length) h += '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + tags + '</div>';
      h += '</div></div><div id="tab-content">' + (activeTab === 'lineage' ? renderLineageTab() : renderDuplicatesTab()) + '</div></div>';
      
      container.innerHTML = h;
      
      var input = container.querySelector('#searchInput');
      input.addEventListener('input', function(e) { 
        var val = e.target.value; 
        if (val.indexOf(',') !== -1) { 
          var parts = val.split(','); 
          for (var i = 0; i < parts.length - 1; i++) { var term = parts[i].trim(); if (term && searchTags.indexOf(term) === -1) searchTags.push(term); } 
          searchTerm = parts[parts.length - 1]; render(); return; 
        } 
        searchTerm = val; selectedNode = null; 
        var tc = container.querySelector('#tab-content'); 
        if (tc && activeTab === 'lineage') { tc.innerHTML = renderLineageTab(); attachEvents(); } 
      });
      
      input.addEventListener('keydown', function(e) { 
        if (e.key === 'Enter' && searchTerm.trim()) { if (searchTags.indexOf(searchTerm.trim()) === -1) searchTags.push(searchTerm.trim()); searchTerm = ''; render(); } 
        else if (e.key === 'Backspace' && !searchTerm && searchTags.length > 0) { searchTags.pop(); render(); } 
      });
      
      var cb = container.querySelector('#clearAll'); 
      if (cb) cb.addEventListener('click', function() { searchTerm = ''; searchTags = []; selectedNode = null; render(); });
      
      container.querySelectorAll('.remove-tag').forEach(function(btn) { 
        btn.addEventListener('click', function(e) { e.stopPropagation(); searchTags.splice(parseInt(btn.parentElement.dataset.idx), 1); render(); }); 
      });
      
      container.querySelectorAll('.tab-btn').forEach(function(btn) { 
        btn.addEventListener('click', function() { activeTab = btn.dataset.tab; render(); }); 
      });
      
      attachEvents();
    }
    
    render();
    setTimeout(function() { runAnalysis(); }, 300);
    done();
  }
});

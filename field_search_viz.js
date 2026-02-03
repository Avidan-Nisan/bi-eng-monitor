looker.plugins.visualizations.add({
  id: "field_search",
  label: "Looker Lineage Explorer",
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
    var modelField = fields.find(function(f) { return f.toLowerCase().indexOf('model') !== -1 && f.toLowerCase().indexOf('name') !== -1; });
    
    var fieldsField = null;
    for (var i = 0; i < fields.length; i++) {
      var fl = fields[i].toLowerCase();
      if (fl.indexOf('sql_table_fields') !== -1) { fieldsField = fields[i]; break; }
    }
    
    var allTableNames = {};
    data.forEach(function(row) {
      if (tableField && row[tableField] && row[tableField].value) {
        var tblName = row[tableField].value.toLowerCase().trim();
        allTableNames[tblName] = true;
        var parts = tblName.split('.');
        if (parts.length > 1) allTableNames[parts[parts.length - 1]] = true;
      }
    });
    
    function getFieldPrefix(fieldName) {
      if (!fieldName) return null;
      var name = fieldName.toLowerCase();
      var idx = name.indexOf('_');
      return idx > 0 ? name.substring(0, idx) : null;
    }
    
    // Get the core field name (after prefix) for grouping
    function getFieldCore(fieldName) {
      if (!fieldName) return '';
      var name = fieldName.toLowerCase();
      var idx = name.indexOf('_');
      if (idx > 0 && idx < 6) return name.substring(idx + 1);
      return name;
    }
    
    function getExploresForView(viewName) {
      var result = [];
      Object.values(explores).forEach(function(exp) {
        if (exp.sources && exp.sources.indexOf('v_' + viewName) !== -1) result.push(exp.name);
      });
      return result;
    }
    
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
        model: modelField && row[modelField] ? row[modelField].value : '',
        fields: cleanFields,
        extendedView: extendedViewField && row[extendedViewField] ? row[extendedViewField].value : '',
        includedView: includedViewField && row[includedViewField] ? row[includedViewField].value : ''
      };
    });
    
    var allUniqueFields = {};
    allRows.forEach(function(row) { row.fields.forEach(function(f) { allUniqueFields[f] = true; }); });
    var allFieldsList = Object.keys(allUniqueFields);
    
    var allTablesList = [];
    allRows.forEach(function(row) { if (row.table && allTablesList.indexOf(row.table) === -1) allTablesList.push(row.table); });
    
    var tables = {}, views = {}, explores = {}, dashboards = {};
    var viewToTables = {}, viewToViews = {}, exploreToViews = {}, dashToExplores = {};
    
    allRows.forEach(function(row) {
      var tbl = row.table, vw = row.view, exp = row.explore, dash = row.dashboard;
      var extVw = row.extendedView, incVw = row.includedView;
      var model = row.model;
      
      if (tbl && !tables[tbl]) tables[tbl] = { id: 't_' + tbl, name: tbl, type: 'table', sources: [], fields: [], sqlTables: [tbl] };
      if (vw && !views[vw]) views[vw] = { id: 'v_' + vw, name: vw, type: 'view', sources: [], fields: [], sqlTables: [], model: model };
      if (exp && !explores[exp]) explores[exp] = { id: 'e_' + exp, name: exp, type: 'explore', sources: [], fields: [], sqlTables: [], model: model };
      if (dash && !dashboards[dash]) dashboards[dash] = { id: 'd_' + dash, name: dash, type: 'dashboard', sources: [], fields: [], sqlTables: [] };
      if (extVw && !views[extVw]) views[extVw] = { id: 'v_' + extVw, name: extVw, type: 'view', sources: [], fields: [], sqlTables: [], model: model };
      if (incVw && !views[incVw]) views[incVw] = { id: 'v_' + incVw, name: incVw, type: 'view', sources: [], fields: [], sqlTables: [], model: model };
      
      // Update model if we have it
      if (vw && views[vw] && model && !views[vw].model) views[vw].model = model;
      
      if (vw && views[vw]) { 
        row.fields.forEach(function(f) { if (views[vw].fields.indexOf(f) === -1) views[vw].fields.push(f); }); 
        if (tbl && views[vw].sqlTables.indexOf(tbl) === -1) views[vw].sqlTables.push(tbl); 
      }
      if (exp && explores[exp]) { 
        row.fields.forEach(function(f) { if (explores[exp].fields.indexOf(f) === -1) explores[exp].fields.push(f); }); 
        if (tbl && explores[exp].sqlTables.indexOf(tbl) === -1) explores[exp].sqlTables.push(tbl); 
      }
      if (dash && dashboards[dash]) { 
        row.fields.forEach(function(f) { if (dashboards[dash].fields.indexOf(f) === -1) dashboards[dash].fields.push(f); }); 
        if (tbl && dashboards[dash].sqlTables.indexOf(tbl) === -1) dashboards[dash].sqlTables.push(tbl); 
      }
      
      if (vw && tbl) { if (!viewToTables[vw]) viewToTables[vw] = {}; viewToTables[vw]['t_' + tbl] = true; }
      if (vw && extVw && vw !== extVw) { if (!viewToViews[vw]) viewToViews[vw] = {}; viewToViews[vw]['v_' + extVw] = true; }
      if (vw && incVw && vw !== incVw) { if (!viewToViews[vw]) viewToViews[vw] = {}; viewToViews[vw]['v_' + incVw] = true; }
      if (exp && vw) { if (!exploreToViews[exp]) exploreToViews[exp] = {}; exploreToViews[exp]['v_' + vw] = true; }
      if (dash && exp) { if (!dashToExplores[dash]) dashToExplores[dash] = {}; dashToExplores[dash]['e_' + exp] = true; }
    });
    
    Object.keys(views).forEach(function(k) { views[k].sources = Object.keys(viewToTables[k] || {}).concat(Object.keys(viewToViews[k] || {})); });
    Object.keys(explores).forEach(function(k) { explores[k].sources = Object.keys(exploreToViews[k] || {}); });
    Object.keys(dashboards).forEach(function(k) { dashboards[k].sources = Object.keys(dashToExplores[k] || {}); });
    
    var allEntities = Object.values(tables).concat(Object.values(views)).concat(Object.values(explores)).concat(Object.values(dashboards));
    
    var activeTab = 'lineage', searchTerm = '', searchTags = [], selectedNode = null;
    var upstream = [], downstream = [], highlightedEntities = [], expandedDuplicates = {};
    var similarResults = null, analysisLoading = false, analysisError = null;
    
    var icons = { 
      search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>', 
      x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', 
      lineage: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l4-6h2M11 12l4 6h2"/></svg>', 
      duplicate: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/></svg>', 
      chevronDown: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
      chevronUp: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>',
      link: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
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
    
    // NEW LOGIC: Find truly duplicate fields
    // True duplicates = EXACT same field names OR same prefix pattern within same domain
    function findDuplicateFields(v1, v2) {
      var matches = [];
      var v1Prefix = null, v2Prefix = null;
      
      // Determine dominant prefix for each view
      var v1Prefixes = {}, v2Prefixes = {};
      v1.fields.forEach(function(f) {
        var p = getFieldPrefix(f);
        if (p) v1Prefixes[p] = (v1Prefixes[p] || 0) + 1;
      });
      v2.fields.forEach(function(f) {
        var p = getFieldPrefix(f);
        if (p) v2Prefixes[p] = (v2Prefixes[p] || 0) + 1;
      });
      
      // Get dominant prefix
      var maxCount1 = 0, maxCount2 = 0;
      Object.keys(v1Prefixes).forEach(function(p) { if (v1Prefixes[p] > maxCount1) { maxCount1 = v1Prefixes[p]; v1Prefix = p; } });
      Object.keys(v2Prefixes).forEach(function(p) { if (v2Prefixes[p] > maxCount2) { maxCount2 = v2Prefixes[p]; v2Prefix = p; } });
      
      // If views have DIFFERENT dominant prefixes, they are likely different domains
      // Only match if: same prefix OR one has no prefix OR exact match
      var sameDomain = !v1Prefix || !v2Prefix || v1Prefix === v2Prefix;
      
      // Find exact matches first
      v1.fields.forEach(function(f1) {
        v2.fields.forEach(function(f2) {
          if (f1.toLowerCase() === f2.toLowerCase()) {
            matches.push({ f1: f1, f2: f2, type: 'exact' });
          }
        });
      });
      
      // Only find similar matches if same domain
      if (sameDomain) {
        var v1ByCore = {};
        v1.fields.forEach(function(f) {
          var core = getFieldCore(f);
          if (core && core.length > 3) { // Skip very short cores
            if (!v1ByCore[core]) v1ByCore[core] = [];
            v1ByCore[core].push(f);
          }
        });
        
        v2.fields.forEach(function(f2) {
          var core = getFieldCore(f2);
          if (core && v1ByCore[core]) {
            v1ByCore[core].forEach(function(f1) {
              // Skip if already matched as exact
              var alreadyMatched = matches.some(function(m) { 
                return m.f1.toLowerCase() === f1.toLowerCase() && m.f2.toLowerCase() === f2.toLowerCase(); 
              });
              if (!alreadyMatched && f1.toLowerCase() !== f2.toLowerCase()) {
                matches.push({ f1: f1, f2: f2, type: 'similar', core: core });
              }
            });
          }
        });
      }
      
      return { matches: matches, sameDomain: sameDomain, v1Prefix: v1Prefix, v2Prefix: v2Prefix };
    }
    
    function runAnalysis() {
      if (analysisLoading) return;
      analysisLoading = true; analysisError = null; render();
      
      setTimeout(function() {
        try {
          var results = [];
          var viewsList = Object.values(views).filter(function(v) { return v.fields && v.fields.length >= 5; });
          
          for (var i = 0; i < viewsList.length; i++) {
            for (var j = i + 1; j < viewsList.length; j++) {
              var v1 = viewsList[i], v2 = viewsList[j];
              var analysis = findDuplicateFields(v1, v2);
              
              // Skip if different domains (different prefixes)
              if (!analysis.sameDomain) continue;
              
              var exactMatches = analysis.matches.filter(function(m) { return m.type === 'exact'; });
              var similarMatches = analysis.matches.filter(function(m) { return m.type === 'similar'; });
              
              // For true duplicates: prioritize exact matches
              // Need at least 5 exact matches OR 70%+ exact overlap
              var minFields = Math.min(v1.fields.length, v2.fields.length);
              var exactRatio = exactMatches.length / minFields;
              var totalMatches = analysis.matches.length;
              var totalRatio = totalMatches / minFields;
              
              // Scoring: exact matches worth 100%, similar worth 50%
              var score = (exactMatches.length + similarMatches.length * 0.5) / minFields;
              var similarity = Math.round(score * 100);
              
              // Only show if:
              // - At least 5 exact matches, OR
              // - At least 40% exact match ratio, OR  
              // - At least 60% total match ratio with same domain
              if (exactMatches.length >= 5 || exactRatio >= 0.4 || (totalRatio >= 0.6 && analysis.sameDomain)) {
                results.push({ 
                  v1: v1.name, 
                  v2: v2.name, 
                  v1Model: v1.model || 'unknown',
                  v2Model: v2.model || 'unknown',
                  similarity: Math.min(similarity, 100),
                  exactCount: exactMatches.length,
                  similarCount: similarMatches.length,
                  totalCount: totalMatches,
                  v1FieldCount: v1.fields.length,
                  v2FieldCount: v2.fields.length,
                  exactMatches: exactMatches,
                  similarMatches: similarMatches,
                  v1Prefix: analysis.v1Prefix,
                  v2Prefix: analysis.v2Prefix
                });
              }
            }
          }
          
          results.sort(function(a, b) { return b.similarity - a.similarity; });
          similarResults = results.slice(0, 100);
          analysisLoading = false; render();
        } catch(e) { similarResults = []; analysisError = 'Error: ' + e.message; analysisLoading = false; render(); }
      }, 100);
    }
    
    function calculateSummaryMetrics() {
      if (!similarResults || similarResults.length === 0) return null;
      var uniqueViews = {}, totalSimilarity = 0;
      similarResults.forEach(function(pair) {
        uniqueViews[pair.v1] = true;
        uniqueViews[pair.v2] = true;
        totalSimilarity += pair.similarity;
      });
      return {
        totalSimilarViews: Object.keys(uniqueViews).length,
        avgSimilarity: Math.round(totalSimilarity / similarResults.length),
        totalPairs: similarResults.length
      };
    }
    
    function renderDuplicatesTab() {
      var viewsCount = Object.values(views).filter(function(v) { return v.fields && v.fields.length >= 5; }).length;
      var metrics = calculateSummaryMetrics();
      
      var h = '<div style="padding:12px 24px;border-bottom:1px solid #1e293b;">';
      h += '<div style="color:#94a3b8;font-size:12px;">Analyzing <span style="color:#e2e8f0;font-weight:500;">' + viewsCount + '</span> views for potential consolidation</div>';
      h += '</div>';
      
      if (metrics) {
        h += '<div style="padding:12px 24px;background:#1e293b40;border-bottom:1px solid #1e293b;">';
        h += '<div style="display:flex;gap:24px;align-items:center;">';
        
        h += '<div style="display:flex;align-items:center;gap:8px;">';
        h += '<span style="font-size:20px;font-weight:700;color:#a78bfa;">' + metrics.totalSimilarViews + '</span>';
        h += '<span style="font-size:11px;color:#64748b;">Candidate Views</span>';
        h += '</div>';
        
        h += '<div style="width:1px;height:24px;background:#334155;"></div>';
        
        var simColor = metrics.avgSimilarity >= 70 ? '#10b981' : metrics.avgSimilarity >= 50 ? '#eab308' : '#f97316';
        h += '<div style="display:flex;align-items:center;gap:8px;">';
        h += '<span style="font-size:20px;font-weight:700;color:' + simColor + ';">' + metrics.avgSimilarity + '%</span>';
        h += '<span style="font-size:11px;color:#64748b;">Avg Overlap</span>';
        h += '</div>';
        
        h += '<div style="width:1px;height:24px;background:#334155;"></div>';
        
        h += '<div style="display:flex;align-items:center;gap:8px;">';
        h += '<span style="font-size:20px;font-weight:700;color:#22d3ee;">' + metrics.totalPairs + '</span>';
        h += '<span style="font-size:11px;color:#64748b;">Duplicate Pairs</span>';
        h += '</div>';
        
        h += '</div></div>';
      }
      
      if (analysisLoading) {
        h += '<div style="text-align:center;padding:80px 40px;"><div style="color:#8b5cf6;font-size:14px;">Analyzing for duplicate views...</div></div>';
      } else if (analysisError) {
        h += '<div style="text-align:center;padding:80px 40px;color:#ef4444;font-size:14px;">' + analysisError + '</div>';
      } else if (!similarResults || similarResults.length === 0) {
        h += '<div style="text-align:center;padding:80px 40px;"><div style="color:#10b981;font-size:14px;">No duplicate views found that can be consolidated</div></div>';
      } else {
        h += '<div style="max-height:500px;overflow-y:auto;">';
        
        similarResults.forEach(function(pair, idx) {
          var isExp = expandedDuplicates[idx];
          var simColor = pair.similarity >= 70 ? '#10b981' : pair.similarity >= 50 ? '#eab308' : '#f97316';
          
          // Preview of exact matches
          var previewFields = pair.exactMatches.slice(0, 3).map(function(m) { return m.f1; });
          var moreCount = pair.totalCount - 3;
          
          h += '<div class="dup-row" data-idx="' + idx + '" style="border-bottom:1px solid #1e293b;">';
          h += '<div class="dup-header" style="display:flex;align-items:center;gap:12px;padding:12px 20px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'#1e293b50\'" onmouseout="this.style.background=\'transparent\'">';
          
          h += '<div style="width:42px;height:42px;border-radius:8px;background:linear-gradient(135deg,' + simColor + '20,' + simColor + '10);border:1px solid ' + simColor + '40;display:flex;align-items:center;justify-content:center;">';
          h += '<div style="font-size:14px;color:' + simColor + ';font-weight:700;">' + pair.similarity + '%</div>';
          h += '</div>';
          
          h += '<div style="flex:1;min-width:0;">';
          
          // View names with models
          h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">';
          h += '<div style="display:flex;flex-direction:column;gap:2px;">';
          h += '<span style="color:#a78bfa;font-size:13px;font-weight:500;">' + pair.v1 + '</span>';
          h += '<span style="color:#64748b;font-size:10px;">model: ' + pair.v1Model + '</span>';
          h += '</div>';
          h += '<span style="color:#475569;font-size:16px;">↔</span>';
          h += '<div style="display:flex;flex-direction:column;gap:2px;">';
          h += '<span style="color:#a78bfa;font-size:13px;font-weight:500;">' + pair.v2 + '</span>';
          h += '<span style="color:#64748b;font-size:10px;">model: ' + pair.v2Model + '</span>';
          h += '</div>';
          h += '</div>';
          
          // Match summary
          h += '<div style="display:flex;gap:12px;align-items:center;color:#64748b;font-size:11px;">';
          h += '<span><span style="color:#10b981;">' + pair.exactCount + '</span> exact</span>';
          if (pair.similarCount > 0) h += '<span><span style="color:#eab308;">' + pair.similarCount + '</span> similar</span>';
          h += '<span style="color:#475569;">|</span>';
          h += '<span>' + pair.v1FieldCount + ' vs ' + pair.v2FieldCount + ' fields</span>';
          h += '</div>';
          
          h += '</div>';
          
          h += '<span style="color:#475569;transition:transform 0.2s;">' + (isExp ? icons.chevronUp : icons.chevronDown) + '</span>';
          h += '</div>';
          
          if (isExp) {
            h += '<div style="padding:12px 20px 16px 74px;background:#0f172a;">';
            
            // Field comparison table
            h += '<div style="margin-bottom:8px;display:flex;gap:16px;padding:8px 12px;background:#1e293b;border-radius:6px 6px 0 0;border-bottom:1px solid #334155;">';
            h += '<div style="flex:1;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">' + pair.v1 + '</div>';
            h += '<div style="width:30px;"></div>';
            h += '<div style="flex:1;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">' + pair.v2 + '</div>';
            h += '</div>';
            
            h += '<div style="max-height:300px;overflow-y:auto;background:#1e293b;border-radius:0 0 6px 6px;">';
            
            // Exact matches
            pair.exactMatches.forEach(function(match) {
              h += '<div style="display:flex;align-items:center;gap:16px;padding:8px 12px;border-bottom:1px solid #0f172a;">';
              h += '<div style="flex:1;color:#e2e8f0;font-size:11px;font-family:monospace;">' + match.f1 + '</div>';
              h += '<div style="width:30px;text-align:center;color:#10b981;font-size:14px;">=</div>';
              h += '<div style="flex:1;color:#e2e8f0;font-size:11px;font-family:monospace;">' + match.f2 + '</div>';
              h += '</div>';
            });
            
            // Similar matches
            pair.similarMatches.forEach(function(match) {
              h += '<div style="display:flex;align-items:center;gap:16px;padding:8px 12px;border-bottom:1px solid #0f172a;">';
              h += '<div style="flex:1;color:#94a3b8;font-size:11px;font-family:monospace;">' + match.f1 + '</div>';
              h += '<div style="width:30px;text-align:center;color:#eab308;font-size:14px;">≈</div>';
              h += '<div style="flex:1;color:#94a3b8;font-size:11px;font-family:monospace;">' + match.f2 + '</div>';
              h += '</div>';
            });
            
            h += '</div></div>';
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
        mode = 'lineage'; upstream = getUpstream(selectedNode.id, 0); downstream = getDownstream(selectedNode.id, 0); 
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
          var f = pos[s], t = pos[e.id]; if (!f || !t) return; 
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
        stats += '<span style="color:#06b6d4;">↑ ' + upstream.length + '</span> <span style="color:#f97316;">↓ ' + downstream.length + '</span>';
      } else if ((searchTags.length > 0 || searchTerm.trim()) && highlightedEntities.length > 0) {
        stats = '<span style="color:#10b981;">' + highlightedEntities.length + ' matches</span>';
      } else if (searchTags.length > 0 || searchTerm.trim()) {
        stats = '<span style="color:#ef4444;">No matches</span>';
      } else {
        stats = '<span style="color:#64748b;">Click a node to trace lineage</span>';
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
      
      container.querySelectorAll('.dup-header').forEach(function(h) { 
        h.addEventListener('click', function(e) { 
          if (e.target.closest('a')) return;
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
      
      h += '<div style="display:flex;justify-content:flex-end;margin-bottom:14px;">';
      h += '<div style="display:flex;gap:0;"><button class="tab-btn" data-tab="lineage" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;background:' + (activeTab==='lineage'?'#1e293b':'transparent') + ';color:' + (activeTab==='lineage'?'#10b981':'#64748b') + ';border-radius:8px 0 0 8px;border:1px solid #334155;">' + icons.lineage + ' Lineage</button>';
      h += '<button class="tab-btn" data-tab="duplicates" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;background:' + (activeTab==='duplicates'?'#1e293b':'transparent') + ';color:' + (activeTab==='duplicates'?'#8b5cf6':'#64748b') + ';border-radius:0 8px 8px 0;border:1px solid #334155;border-left:none;">' + icons.duplicate + ' Duplicates</button></div></div>';
      
      h += '<div style="background:#1e293b;border:1px solid #475569;border-radius:12px;padding:16px;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:' + (searchTags.length ? '12px' : '0') + ';"><span style="color:#10b981;">' + icons.search + '</span><input id="searchInput" type="text" value="' + searchTerm + '" placeholder="Search tables, views, explores, dashboards, or fields..." style="flex:1;background:transparent;border:none;color:#e2e8f0;font-size:14px;outline:none;"/>';
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

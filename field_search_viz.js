looker.plugins.visualizations.add({
  id: "field_search",
  label: "Looker Lineage Explorer",
  options: {},
  create: function(element, config) {
    element.style.height = '100%';
    element.style.width = '100%';
    element.innerHTML = '<div id="asset-manager-container" style="width:100%;height:100%;overflow:auto;font-family:system-ui,sans-serif;background:#0f172a;"></div>';
  },
  updateAsync: function(data, element, config, queryResponse, details, done) {
    var container = element.querySelector('#asset-manager-container');
    var containerWidth = element.offsetWidth || 1200;
    
    if (!data || data.length === 0) { 
      container.innerHTML = '<div style="padding:40px;color:#64748b;background:#0f172a;">No data available</div>'; 
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
    var modelField = fields.find(function(f) { 
      var fl = f.toLowerCase();
      return (fl.indexOf('model') !== -1 && fl.indexOf('name') !== -1) || fl === 'model' || fl.endsWith('.model');
    });
    var fieldsField = null;
    for (var i = 0; i < fields.length; i++) {
      var fl = fields[i].toLowerCase();
      if (fl.indexOf('sql_table_fields') !== -1) { fieldsField = fields[i]; break; }
    }
    
    // Filter state
    var filters = { model: '', dashboard: '', explore: '', view: '', table: '', field: '' };
    var filterOptions = { models: [], dashboards: [], explores: [], views: [], tables: [], fields: [] };
    
    function getFieldPrefix(fieldName) {
      if (!fieldName) return null;
      var name = fieldName.toLowerCase();
      var idx = name.indexOf('_');
      return idx > 0 ? name.substring(0, idx) : null;
    }
    
    var genericCores = ['id', 'name', 'type', 'date', 'value', 'status', 'code', 'key', 'count', 'sum', 'avg', 'min', 'max', 'total', 'amount', 'number', 'num', 'flag', 'is', 'has'];
    var levelIndicators = ['ad', 'ads', 'campaign', 'campaigns', 'section', 'sections', 'publisher', 'publishers', 'marketer', 'marketers', 'advertiser', 'advertisers', 'account', 'accounts', 'user', 'users', 'website', 'websites', 'order', 'orders', 'line_item', 'lineitem', 'creative', 'creatives', 'placement', 'placements', 'insertion', 'insertions', 'daily', 'weekly', 'monthly', 'hourly', 'yearly', 'agg', 'aggregate', 'summary', 'rollup'];
    
    function extractLevels(viewName) {
      if (!viewName) return [];
      var name = viewName.toLowerCase(), found = [];
      levelIndicators.forEach(function(level) {
        if (name.indexOf(level) !== -1) {
          var idx = name.indexOf(level);
          var before = idx === 0 ? '_' : name[idx - 1];
          var after = idx + level.length >= name.length ? '_' : name[idx + level.length];
          if ((before === '_' || before === '-' || idx === 0) && (after === '_' || after === '-' || idx + level.length === name.length)) found.push(level);
        }
      });
      return found;
    }
    
    function hasDifferentLevels(v1Name, v2Name) {
      var levels1 = extractLevels(v1Name), levels2 = extractLevels(v2Name);
      if (levels1.length > 0 && levels2.length > 0) {
        var normalize = function(lvl) {
          if (lvl.indexOf('ad') === 0) return 'ad';
          if (lvl.indexOf('campaign') === 0) return 'campaign';
          if (lvl.indexOf('account') === 0) return 'account';
          if (lvl.indexOf('user') === 0) return 'user';
          if (lvl === 'daily') return 'daily';
          if (lvl === 'weekly') return 'weekly';
          if (lvl === 'monthly') return 'monthly';
          return lvl;
        };
        var norm1 = levels1.map(normalize), norm2 = levels2.map(normalize);
        var diff1 = norm1.filter(function(l) { return norm2.indexOf(l) === -1; });
        var diff2 = norm2.filter(function(l) { return norm1.indexOf(l) === -1; });
        if (diff1.length > 0 || diff2.length > 0) return true;
      }
      return false;
    }
    
    function getFieldCore(fieldName) {
      if (!fieldName) return '';
      var name = fieldName.toLowerCase(), idx = name.indexOf('_');
      if (idx > 0 && idx < 6) return name.substring(idx + 1);
      return name;
    }
    
    function isGenericCore(core) {
      if (!core || core.length <= 2) return true;
      return genericCores.indexOf(core) !== -1;
    }
    
    function extractModel(row) {
      if (modelField && row[modelField] && row[modelField].value) return row[modelField].value;
      if (expField && row[expField] && row[expField].value) {
        var exp = row[expField].value;
        if (exp.indexOf('.') !== -1) return exp.split('.')[0];
      }
      return null;
    }
    
    var allRows = data.map(function(row) {
      var fieldsVal = fieldsField && row[fieldsField] ? row[fieldsField].value || '' : '';
      var rawFields = fieldsVal ? fieldsVal.split('|').map(function(f) { return f.trim(); }).filter(function(f) { return f.length > 0; }) : [];
      var cleanFields = rawFields.filter(function(f) { return f.indexOf('.') === -1; });
      return { 
        dashboard: row[dashField] ? row[dashField].value : '', 
        explore: row[expField] ? row[expField].value : '', 
        view: row[viewField] ? row[viewField].value : '', 
        table: tableField && row[tableField] ? row[tableField].value : '', 
        model: extractModel(row),
        fields: cleanFields,
        extendedView: extendedViewField && row[extendedViewField] ? row[extendedViewField].value : '',
        includedView: includedViewField && row[includedViewField] ? row[includedViewField].value : ''
      };
    });
    
    // Build unique filter options from raw data
    var allModels = {}, allDashboards = {}, allExplores = {}, allViews = {}, allTables = {}, allFields = {};
    allRows.forEach(function(row) {
      if (row.model) allModels[row.model] = true;
      if (row.dashboard) allDashboards[row.dashboard] = true;
      if (row.explore) allExplores[row.explore] = true;
      if (row.view) allViews[row.view] = true;
      if (row.table) allTables[row.table] = true;
      row.fields.forEach(function(f) { if (f) allFields[f] = true; });
    });
    filterOptions.models = Object.keys(allModels).sort();
    filterOptions.dashboards = Object.keys(allDashboards).sort();
    filterOptions.explores = Object.keys(allExplores).sort();
    filterOptions.views = Object.keys(allViews).sort();
    filterOptions.tables = Object.keys(allTables).sort();
    filterOptions.fields = Object.keys(allFields).sort();
    
    // Get filtered rows based on current filters
    function getFilteredRows() {
      return allRows.filter(function(row) {
        if (filters.model && row.model !== filters.model) return false;
        if (filters.dashboard && row.dashboard !== filters.dashboard) return false;
        if (filters.explore && row.explore !== filters.explore) return false;
        if (filters.view && row.view !== filters.view) return false;
        if (filters.table && row.table !== filters.table) return false;
        if (filters.field && row.fields.indexOf(filters.field) === -1) return false;
        return true;
      });
    }
    
    // Get available options based on current filters (cascading)
    function getAvailableOptions() {
      var rows = getFilteredRows();
      var opts = { models: {}, dashboards: {}, explores: {}, views: {}, tables: {}, fields: {} };
      rows.forEach(function(row) {
        if (row.model) opts.models[row.model] = true;
        if (row.dashboard) opts.dashboards[row.dashboard] = true;
        if (row.explore) opts.explores[row.explore] = true;
        if (row.view) opts.views[row.view] = true;
        if (row.table) opts.tables[row.table] = true;
        row.fields.forEach(function(f) { if (f) opts.fields[f] = true; });
      });
      return {
        models: Object.keys(opts.models).sort(),
        dashboards: Object.keys(opts.dashboards).sort(),
        explores: Object.keys(opts.explores).sort(),
        views: Object.keys(opts.views).sort(),
        tables: Object.keys(opts.tables).sort(),
        fields: Object.keys(opts.fields).sort()
      };
    }
    
    var tables = {}, views = {}, explores = {}, dashboards = {};
    var viewToTables = {}, viewToViews = {}, exploreToViews = {}, dashToExplores = {};
    var viewModels = {};
    
    function buildEntities() {
      tables = {}; views = {}; explores = {}; dashboards = {};
      viewToTables = {}; viewToViews = {}; exploreToViews = {}; dashToExplores = {};
      viewModels = {};
      
      var filteredRows = getFilteredRows();
      
      filteredRows.forEach(function(row) {
        var tbl = row.table, vw = row.view, exp = row.explore, dash = row.dashboard;
        var extVw = row.extendedView, incVw = row.includedView, model = row.model;
        
        if (tbl && !tables[tbl]) tables[tbl] = { id: 't_' + tbl, name: tbl, type: 'table', sources: [], fields: [], sqlTables: [tbl] };
        if (vw && !views[vw]) views[vw] = { id: 'v_' + vw, name: vw, type: 'view', sources: [], fields: [], sqlTables: [], model: null };
        if (exp && !explores[exp]) explores[exp] = { id: 'e_' + exp, name: exp, type: 'explore', sources: [], fields: [], sqlTables: [], model: model };
        if (dash && !dashboards[dash]) dashboards[dash] = { id: 'd_' + dash, name: dash, type: 'dashboard', sources: [], fields: [], sqlTables: [] };
        if (extVw && !views[extVw]) views[extVw] = { id: 'v_' + extVw, name: extVw, type: 'view', sources: [], fields: [], sqlTables: [], model: null };
        if (incVw && !views[incVw]) views[incVw] = { id: 'v_' + incVw, name: incVw, type: 'view', sources: [], fields: [], sqlTables: [], model: null };
      });
      
      filteredRows.forEach(function(row) {
        var tbl = row.table, vw = row.view, exp = row.explore, dash = row.dashboard;
        var extVw = row.extendedView, incVw = row.includedView, model = row.model;
        
        if (vw && model) { if (!viewModels[vw]) viewModels[vw] = {}; viewModels[vw][model] = true; }
        if (tbl && tables[tbl] && row.fields) row.fields.forEach(function(f) { if (f && tables[tbl].fields.indexOf(f) === -1) tables[tbl].fields.push(f); });
        if (vw && views[vw] && row.fields) { 
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
      
      Object.keys(views).forEach(function(vw) { if (viewModels[vw]) { var models = Object.keys(viewModels[vw]); views[vw].model = models.length > 0 ? models.join(', ') : null; } });
      Object.keys(views).forEach(function(k) { views[k].sources = Object.keys(viewToTables[k] || {}).concat(Object.keys(viewToViews[k] || {})); });
      Object.keys(explores).forEach(function(k) { explores[k].sources = Object.keys(exploreToViews[k] || {}); });
      Object.keys(dashboards).forEach(function(k) { dashboards[k].sources = Object.keys(dashToExplores[k] || {}); });
    }
    
    function getAllEntities() {
      return Object.values(tables).concat(Object.values(views)).concat(Object.values(explores)).concat(Object.values(dashboards));
    }
    
    var activeTab = 'lineage', searchTerm = '', searchTags = [], selectedNode = null;
    var upstream = [], downstream = [], highlightedEntities = [], expandedDuplicates = {};
    var similarResults = null, analysisLoading = false, analysisError = null;
    var showFilters = true;
    
    var icons = { 
      search: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>', 
      x: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', 
      lineage: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l4-6h2M11 12l4 6h2"/></svg>', 
      overlap: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>', 
      chevronDown: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
      chevronUp: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>',
      filter: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>'
    };
    var typeIcons = { 
      table: '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="9" width="8" height="3"/><rect x="13" y="9" width="8" height="3"/><rect x="3" y="14" width="8" height="3"/><rect x="13" y="14" width="8" height="3"/></svg>', 
      view: '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7z"/></svg>', 
      explore: '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>', 
      dashboard: '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="2" y="2" width="9" height="6" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="10" width="9" height="12" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>' 
    };
    var typeConfig = { 
      table: { color: '#06b6d4', label: 'Tables' }, 
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
      var allEntities = getAllEntities();
      if (d > 15) return []; v = v || {}; if (v[id]) return []; v[id] = true; 
      var e = allEntities.find(function(x) { return x.id === id; }); 
      if (!e || !e.sources) return []; 
      var r = []; 
      e.sources.forEach(function(s) { if (!v[s]) { r.push(s); r = r.concat(getUpstream(s, (d||0)+1, v)); } }); 
      return r.filter(function(x,i,a) { return a.indexOf(x)===i; }); 
    }
    
    function getDownstream(id, d, v) { 
      var allEntities = getAllEntities();
      if (d > 15) return []; v = v || {}; if (v[id]) return []; v[id] = true; 
      var r = []; 
      allEntities.forEach(function(e) { 
        if (e.sources && e.sources.indexOf(id) !== -1 && !v[e.id]) { r.push(e.id); r = r.concat(getDownstream(e.id, (d||0)+1, v)); } 
      }); 
      return r.filter(function(x,i,a) { return a.indexOf(x)===i; }); 
    }
    
    function findDuplicateFields(v1, v2) {
      var matches = [], v1Prefixes = {}, v2Prefixes = {}, v1Prefix = null, v2Prefix = null;
      v1.fields.forEach(function(f) { var p = getFieldPrefix(f); if (p) v1Prefixes[p] = (v1Prefixes[p] || 0) + 1; });
      v2.fields.forEach(function(f) { var p = getFieldPrefix(f); if (p) v2Prefixes[p] = (v2Prefixes[p] || 0) + 1; });
      var maxCount1 = 0, maxCount2 = 0;
      Object.keys(v1Prefixes).forEach(function(p) { if (v1Prefixes[p] > maxCount1) { maxCount1 = v1Prefixes[p]; v1Prefix = p; } });
      Object.keys(v2Prefixes).forEach(function(p) { if (v2Prefixes[p] > maxCount2) { maxCount2 = v2Prefixes[p]; v2Prefix = p; } });
      var sameDomain = !v1Prefix || !v2Prefix || v1Prefix === v2Prefix;
      var v1Matched = {}, v2Matched = {};
      
      v1.fields.forEach(function(f1) {
        if (v1Matched[f1.toLowerCase()]) return;
        v2.fields.forEach(function(f2) {
          if (v2Matched[f2.toLowerCase()]) return;
          if (f1.toLowerCase() === f2.toLowerCase()) {
            matches.push({ f1: f1, f2: f2, type: 'exact' });
            v1Matched[f1.toLowerCase()] = true;
            v2Matched[f2.toLowerCase()] = true;
          }
        });
      });
      
      if (sameDomain) {
        var v1ByCore = {};
        v1.fields.forEach(function(f) {
          if (v1Matched[f.toLowerCase()]) return;
          var core = getFieldCore(f);
          if (core && !isGenericCore(core)) { if (!v1ByCore[core]) v1ByCore[core] = []; v1ByCore[core].push(f); }
        });
        v2.fields.forEach(function(f2) {
          if (v2Matched[f2.toLowerCase()]) return;
          var core = getFieldCore(f2);
          if (core && !isGenericCore(core) && v1ByCore[core] && v1ByCore[core].length > 0) {
            for (var i = 0; i < v1ByCore[core].length; i++) {
              var f1 = v1ByCore[core][i];
              if (!v1Matched[f1.toLowerCase()]) {
                matches.push({ f1: f1, f2: f2, type: 'similar', core: core });
                v1Matched[f1.toLowerCase()] = true;
                v2Matched[f2.toLowerCase()] = true;
                break;
              }
            }
          }
        });
      }
      
      var v1Only = v1.fields.filter(function(f) { return !v1Matched[f.toLowerCase()]; });
      var v2Only = v2.fields.filter(function(f) { return !v2Matched[f.toLowerCase()]; });
      return { matches: matches, sameDomain: sameDomain, v1Prefix: v1Prefix, v2Prefix: v2Prefix, v1Only: v1Only, v2Only: v2Only };
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
              if (!analysis.sameDomain) continue;
              if (hasDifferentLevels(v1.name, v2.name)) continue;
              
              var exactMatches = analysis.matches.filter(function(m) { return m.type === 'exact'; });
              var similarMatches = analysis.matches.filter(function(m) { return m.type === 'similar'; });
              var minFields = Math.min(v1.fields.length, v2.fields.length);
              var exactRatio = exactMatches.length / minFields;
              var totalRatio = analysis.matches.length / minFields;
              var score = (exactMatches.length + similarMatches.length * 0.5) / minFields;
              var similarity = Math.round(score * 100);
              
              if (exactMatches.length >= 5 || exactRatio >= 0.4 || (totalRatio >= 0.6 && analysis.sameDomain)) {
                results.push({ 
                  v1: v1.name, v2: v2.name, v1Model: v1.model || '-', v2Model: v2.model || '-',
                  similarity: Math.min(similarity, 100), exactCount: exactMatches.length, similarCount: similarMatches.length,
                  totalCount: analysis.matches.length, v1FieldCount: v1.fields.length, v2FieldCount: v2.fields.length,
                  exactMatches: exactMatches, similarMatches: similarMatches, v1Only: analysis.v1Only, v2Only: analysis.v2Only
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
    
    function renderFilters() {
      var availOpts = getAvailableOptions();
      var activeCount = Object.values(filters).filter(function(v) { return v; }).length;
      
      var h = '<div style="border-bottom:1px solid #1e293b;">';
      h += '<div class="toggle-filters" style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;cursor:pointer;background:#0f172a80;">';
      h += '<div style="display:flex;align-items:center;gap:8px;"><span style="color:#64748b;">' + icons.filter + '</span><span style="color:#94a3b8;font-size:11px;font-weight:500;">FILTERS</span>';
      if (activeCount > 0) h += '<span style="background:#10b981;color:#0f172a;font-size:10px;padding:2px 6px;border-radius:10px;font-weight:600;">' + activeCount + '</span>';
      h += '</div><span style="color:#475569;">' + (showFilters ? icons.chevronUp : icons.chevronDown) + '</span></div>';
      
      if (showFilters) {
        h += '<div style="padding:12px 16px;display:grid;grid-template-columns:repeat(6,1fr);gap:8px;background:#0f172a;">';
        
        var filterDefs = [
          { key: 'model', label: 'Model', opts: filters.model ? filterOptions.models : availOpts.models, color: '#22d3ee' },
          { key: 'dashboard', label: 'Dashboard', opts: filters.dashboard ? filterOptions.dashboards : availOpts.dashboards, color: '#f97316' },
          { key: 'explore', label: 'Explore', opts: filters.explore ? filterOptions.explores : availOpts.explores, color: '#ec4899' },
          { key: 'view', label: 'View', opts: filters.view ? filterOptions.views : availOpts.views, color: '#8b5cf6' },
          { key: 'table', label: 'Table', opts: filters.table ? filterOptions.tables : availOpts.tables, color: '#06b6d4' },
          { key: 'field', label: 'Field', opts: filters.field ? filterOptions.fields : availOpts.fields, color: '#10b981' }
        ];
        
        filterDefs.forEach(function(fd) {
          var isActive = filters[fd.key];
          h += '<div style="display:flex;flex-direction:column;gap:4px;">';
          h += '<label style="font-size:9px;color:' + fd.color + ';text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">' + fd.label + '</label>';
          h += '<select class="filter-select" data-filter="' + fd.key + '" style="background:#1e293b;border:1px solid ' + (isActive ? fd.color : '#334155') + ';color:#e2e8f0;padding:6px 8px;border-radius:6px;font-size:11px;cursor:pointer;outline:none;">';
          h += '<option value="">All (' + fd.opts.length + ')</option>';
          fd.opts.forEach(function(opt) {
            var sel = filters[fd.key] === opt ? ' selected' : '';
            var display = opt.length > 20 ? opt.substring(0, 18) + '...' : opt;
            h += '<option value="' + opt + '"' + sel + '>' + display + '</option>';
          });
          h += '</select></div>';
        });
        
        h += '</div>';
        if (activeCount > 0) {
          h += '<div style="padding:8px 16px;background:#0f172a;border-top:1px solid #1e293b20;">';
          h += '<button class="clear-filters" style="background:#ef444420;border:1px solid #ef4444;color:#f87171;padding:4px 12px;border-radius:4px;font-size:10px;cursor:pointer;">Clear All Filters</button>';
          h += '</div>';
        }
      }
      h += '</div>';
      return h;
    }
    
    function renderDuplicatesTab() {
      var viewsCount = Object.values(views).filter(function(v) { return v.fields && v.fields.length >= 5; }).length;
      var metrics = null;
      if (similarResults && similarResults.length > 0) {
        var uniqueViews = {}, totalSimilarity = 0;
        similarResults.forEach(function(pair) { uniqueViews[pair.v1] = true; uniqueViews[pair.v2] = true; totalSimilarity += pair.similarity; });
        metrics = { totalSimilarViews: Object.keys(uniqueViews).length, avgSimilarity: Math.round(totalSimilarity / similarResults.length), totalPairs: similarResults.length };
      }
      
      var h = '<div style="padding:10px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;">';
      h += '<div style="color:#94a3b8;font-size:11px;">Analyzing <span style="color:#e2e8f0;font-weight:500;">' + viewsCount + '</span> views</div>';
      if (metrics) {
        var simColor = metrics.avgSimilarity >= 70 ? '#10b981' : metrics.avgSimilarity >= 50 ? '#eab308' : '#f97316';
        h += '<div style="display:flex;gap:16px;align-items:center;font-size:11px;">';
        h += '<span><span style="color:#a78bfa;font-weight:600;">' + metrics.totalSimilarViews + '</span> <span style="color:#64748b;">views</span></span>';
        h += '<span><span style="color:' + simColor + ';font-weight:600;">' + metrics.avgSimilarity + '%</span> <span style="color:#64748b;">avg</span></span>';
        h += '<span><span style="color:#22d3ee;font-weight:600;">' + metrics.totalPairs + '</span> <span style="color:#64748b;">pairs</span></span>';
        h += '</div>';
      }
      h += '</div>';
      
      if (analysisLoading) {
        h += '<div style="text-align:center;padding:40px;"><div style="color:#8b5cf6;font-size:12px;">Analyzing...</div></div>';
      } else if (analysisError) {
        h += '<div style="text-align:center;padding:40px;color:#ef4444;font-size:12px;">' + analysisError + '</div>';
      } else if (!similarResults || similarResults.length === 0) {
        h += '<div style="text-align:center;padding:40px;color:#10b981;font-size:12px;">No significant overlap found</div>';
      } else {
        h += '<div style="overflow-y:auto;max-height:calc(100vh - 280px);">';
        similarResults.forEach(function(pair, idx) {
          var isExp = expandedDuplicates[idx];
          var simColor = pair.similarity >= 70 ? '#10b981' : pair.similarity >= 50 ? '#eab308' : '#f97316';
          
          h += '<div class="dup-row" data-idx="' + idx + '" style="border-bottom:1px solid #1e293b;">';
          h += '<div class="dup-header" style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'#1e293b40\'" onmouseout="this.style.background=\'transparent\'">';
          
          // Similarity badge
          h += '<div style="min-width:36px;width:36px;height:36px;border-radius:6px;background:' + simColor + '15;border:1px solid ' + simColor + '40;display:flex;align-items:center;justify-content:center;">';
          h += '<span style="font-size:12px;color:' + simColor + ';font-weight:700;">' + pair.similarity + '%</span></div>';
          
          // View names
          h += '<div style="flex:1;min-width:0;">';
          h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
          h += '<span style="color:#a78bfa;font-size:12px;font-weight:500;">' + pair.v1 + '</span>';
          h += '<span style="color:#475569;font-size:10px;">(' + pair.v1Model + ')</span>';
          h += '<span style="color:#334155;">↔</span>';
          h += '<span style="color:#a78bfa;font-size:12px;font-weight:500;">' + pair.v2 + '</span>';
          h += '<span style="color:#475569;font-size:10px;">(' + pair.v2Model + ')</span>';
          h += '</div>';
          h += '<div style="display:flex;gap:10px;margin-top:4px;font-size:10px;color:#64748b;">';
          h += '<span><span style="color:#10b981;">' + pair.exactCount + '</span> exact</span>';
          if (pair.similarCount > 0) h += '<span><span style="color:#eab308;">' + pair.similarCount + '</span> similar</span>';
          h += '<span>' + pair.v1FieldCount + ' / ' + pair.v2FieldCount + ' fields</span>';
          h += '</div></div>';
          h += '<span style="color:#475569;">' + (isExp ? icons.chevronUp : icons.chevronDown) + '</span></div>';
          
          if (isExp) {
            h += '<div style="padding:8px 16px 12px;background:#0c1322;">';
            h += '<div style="display:grid;grid-template-columns:1fr 40px 1fr;gap:0;font-size:10px;border-radius:6px;overflow:hidden;border:1px solid #1e293b;">';
            
            // Headers
            h += '<div style="padding:8px 10px;background:#1e293b;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;font-size:9px;">' + pair.v1 + '</div>';
            h += '<div style="padding:8px;background:#1e293b;color:#64748b;text-align:center;"></div>';
            h += '<div style="padding:8px 10px;background:#1e293b;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;font-size:9px;">' + pair.v2 + '</div>';
            
            // Exact matches
            pair.exactMatches.forEach(function(m) {
              h += '<div style="padding:6px 10px;background:#0f172a;color:#e2e8f0;font-family:\'SF Mono\',Monaco,monospace;border-top:1px solid #1e293b30;">' + m.f1 + '</div>';
              h += '<div style="padding:6px;background:#0f172a;color:#10b981;text-align:center;border-top:1px solid #1e293b30;font-weight:600;">=</div>';
              h += '<div style="padding:6px 10px;background:#0f172a;color:#e2e8f0;font-family:\'SF Mono\',Monaco,monospace;border-top:1px solid #1e293b30;">' + m.f2 + '</div>';
            });
            
            // Similar matches with better styling
            pair.similarMatches.forEach(function(m) {
              h += '<div style="padding:6px 10px;background:#0f172a;color:#fbbf24;font-family:\'SF Mono\',Monaco,monospace;border-top:1px solid #1e293b30;font-style:italic;">' + m.f1 + '</div>';
              h += '<div style="padding:6px;background:#0f172a;color:#eab308;text-align:center;border-top:1px solid #1e293b30;font-size:11px;">≈</div>';
              h += '<div style="padding:6px 10px;background:#0f172a;color:#fbbf24;font-family:\'SF Mono\',Monaco,monospace;border-top:1px solid #1e293b30;font-style:italic;">' + m.f2 + '</div>';
            });
            
            // Unique to v1
            pair.v1Only.slice(0, 10).forEach(function(f) {
              h += '<div style="padding:6px 10px;background:#0f172a;color:#f87171;font-family:\'SF Mono\',Monaco,monospace;border-top:1px solid #1e293b30;opacity:0.7;">' + f + '</div>';
              h += '<div style="padding:6px;background:#0f172a;color:#334155;text-align:center;border-top:1px solid #1e293b30;">—</div>';
              h += '<div style="padding:6px 10px;background:#0f172a;color:#334155;border-top:1px solid #1e293b30;"></div>';
            });
            
            // Unique to v2
            pair.v2Only.slice(0, 10).forEach(function(f) {
              h += '<div style="padding:6px 10px;background:#0f172a;color:#334155;border-top:1px solid #1e293b30;"></div>';
              h += '<div style="padding:6px;background:#0f172a;color:#334155;text-align:center;border-top:1px solid #1e293b30;">—</div>';
              h += '<div style="padding:6px 10px;background:#0f172a;color:#f87171;font-family:\'SF Mono\',Monaco,monospace;border-top:1px solid #1e293b30;opacity:0.7;">' + f + '</div>';
            });
            
            if (pair.v1Only.length > 10 || pair.v2Only.length > 10) {
              h += '<div style="grid-column:span 3;padding:6px 10px;background:#0f172a;color:#64748b;text-align:center;font-size:9px;border-top:1px solid #1e293b30;">+ ' + Math.max(0, pair.v1Only.length - 10 + pair.v2Only.length - 10) + ' more unique fields</div>';
            }
            
            h += '</div></div>';
          }
          h += '</div>';
        });
        h += '</div>';
      }
      return h;
    }
    
    function getSearchMatches() {
      var allEntities = getAllEntities();
      var terms = searchTags.slice(); 
      if (searchTerm.trim()) terms.push(searchTerm.trim()); 
      if (terms.length === 0) return [];
      var matches = [], partial = [];
      
      allEntities.forEach(function(entity) {
        var matchCount = 0, fieldMatches = [];
        terms.forEach(function(term) {
          var matched = false;
          if (smartMatch(entity.name, term)) matched = true;
          if (entity.fields && Array.isArray(entity.fields)) {
            for (var i = 0; i < entity.fields.length; i++) {
              var f = entity.fields[i];
              if (f && smartMatch(f, term)) { matched = true; if (fieldMatches.indexOf(f) === -1) fieldMatches.push(f); }
            }
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
      var allEntities = getAllEntities();
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
      
      var nodeW = 180, nodeH = 32, spacing = 40, pad = 12;
      var svgW = Math.max(containerWidth - 24, 900);
      var colSp = (svgW - pad * 2 - nodeW) / 3;
      var colX = { table: pad, view: pad + colSp, explore: pad + colSp * 2, dashboard: pad + colSp * 3 };
      var pos = {}, startY = 55;
      
      ['table','view','explore','dashboard'].forEach(function(type) { 
        byType[type].forEach(function(e, idx) { pos[e.id] = { x: colX[type], y: startY + idx * spacing }; }); 
      });
      
      var maxC = Math.max(byType.table.length||1, byType.view.length||1, byType.explore.length||1, byType.dashboard.length||1);
      var svgH = Math.max(maxC * spacing + 70, 250);
      
      var edges = ''; 
      visible.forEach(function(e) { 
        (e.sources||[]).forEach(function(s) { 
          var f = pos[s], t = pos[e.id]; if (!f || !t) return; 
          var stroke = '#334155', op = 0.25, sw = 1.5; 
          if (selectedNode) { 
            if (s === selectedNode.id || downstream.indexOf(e.id) !== -1) { stroke = '#f97316'; op = 0.9; sw = 2; } 
            else if (e.id === selectedNode.id || upstream.indexOf(s) !== -1) { stroke = '#06b6d4'; op = 0.9; sw = 2; } 
          } else if (mode === 'search') { stroke = '#10b981'; op = 0.6; sw = 1.5; } 
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
        if (isSel) { bc = '#ffffff'; bw = 2; } else if (isUp) { bc = '#06b6d4'; bw = 2; } else if (isDown) { bc = '#f97316'; bw = 2; } else if (isMatch) { bc = '#10b981'; bw = 2; }
        var nm = entity.name.length > 22 ? entity.name.substring(0,20) + '...' : entity.name;
        nodes += '<g class="node" data-id="' + entity.id + '" style="cursor:pointer;" transform="translate(' + p.x + ',' + p.y + ')">';
        nodes += '<rect width="' + nodeW + '" height="' + nodeH + '" rx="6" fill="#0f172a" stroke="' + bc + '" stroke-width="' + bw + '"/>';
        nodes += '<rect x="1" y="1" width="28" height="' + (nodeH-2) + '" rx="5" fill="' + cfg.color + '" fill-opacity="0.15"/>';
        nodes += '<g transform="translate(8,' + (nodeH/2-6) + ')" fill="' + cfg.color + '">' + typeIcons[entity.type] + '</g>';
        nodes += '<text x="34" y="' + (nodeH/2+3) + '" fill="#e2e8f0" font-size="9" font-weight="500">' + nm + '</text></g>'; 
      });
      
      var hdr = ''; 
      ['table','view','explore','dashboard'].forEach(function(type) { 
        var cfg = typeConfig[type]; 
        hdr += '<text x="' + (colX[type]+nodeW/2) + '" y="18" text-anchor="middle" fill="' + cfg.color + '" font-size="8" font-weight="600">' + cfg.label.toUpperCase() + '</text>';
        hdr += '<text x="' + (colX[type]+nodeW/2) + '" y="30" text-anchor="middle" fill="#475569" font-size="8">' + byType[type].length + '</text>'; 
      });
      
      var stats = '';
      if (selectedNode) {
        stats = '<span style="color:' + typeConfig[selectedNode.type].color + ';">' + selectedNode.name + '</span> ';
        stats += '<span style="color:#06b6d4;">↑' + upstream.length + '</span> <span style="color:#f97316;">↓' + downstream.length + '</span>';
      } else if ((searchTags.length > 0 || searchTerm.trim()) && highlightedEntities.length > 0) {
        stats = '<span style="color:#10b981;">' + highlightedEntities.length + ' matches</span>';
      } else if (searchTags.length > 0 || searchTerm.trim()) {
        stats = '<span style="color:#ef4444;">No matches</span>';
      } else {
        stats = '<span style="color:#64748b;">Click node to trace lineage</span>';
      }
      
      var r = '<div><div style="padding:8px 16px;border-bottom:1px solid #1e293b;font-size:11px;display:flex;justify-content:space-between;"><div>' + stats + '</div><div style="color:#64748b;">' + allEntities.length + ' entities</div></div>';
      
      if (mode === 'search' && visible.length === 0) {
        r += '<div style="padding:16px;background:#1e293b;margin:8px;border-radius:6px;"><div style="color:#f59e0b;font-size:12px;margin-bottom:12px;">No matches</div>';
        if (window._partialMatches && window._partialMatches.length > 0) {
          r += '<div style="color:#94a3b8;font-size:10px;margin-bottom:6px;">Partial:</div>';
          window._partialMatches.slice(0, 3).forEach(function(pm) {
            var cfg = typeConfig[pm.entity.type];
            r += '<div style="padding:6px 8px;background:#0f172a;border-radius:4px;border-left:2px solid ' + cfg.color + ';margin-bottom:4px;"><div style="color:#e2e8f0;font-size:10px;">' + pm.entity.name + '</div></div>';
          });
        }
        r += '</div>';
      } else {
        r += '<div style="padding:8px;overflow:auto;"><svg width="' + svgW + '" height="' + svgH + '" style="font-family:system-ui,sans-serif;">' + hdr + edges + nodes + '</svg></div>';
      }
      return r + '</div>';
    }
    
    function attachEvents() {
      var allEntities = getAllEntities();
      
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
          var idx = parseInt(h.parentElement.dataset.idx); 
          expandedDuplicates[idx] = !expandedDuplicates[idx]; 
          var tc = container.querySelector('#tab-content'); 
          if (tc) { tc.innerHTML = renderDuplicatesTab(); attachEvents(); } 
        }); 
      });
      
      container.querySelectorAll('.filter-select').forEach(function(sel) {
        sel.addEventListener('change', function() {
          var key = sel.dataset.filter;
          filters[key] = sel.value;
          // Reset downstream filters when upstream changes
          if (key === 'model') { filters.dashboard = ''; filters.explore = ''; filters.view = ''; filters.table = ''; filters.field = ''; }
          if (key === 'dashboard') { filters.explore = ''; filters.view = ''; filters.table = ''; filters.field = ''; }
          if (key === 'explore') { filters.view = ''; filters.table = ''; filters.field = ''; }
          if (key === 'view') { filters.table = ''; filters.field = ''; }
          if (key === 'table') { filters.field = ''; }
          buildEntities();
          similarResults = null;
          selectedNode = null;
          render();
          if (activeTab === 'duplicates') setTimeout(runAnalysis, 100);
        });
      });
      
      var clearBtn = container.querySelector('.clear-filters');
      if (clearBtn) {
        clearBtn.addEventListener('click', function() {
          filters = { model: '', dashboard: '', explore: '', view: '', table: '', field: '' };
          buildEntities();
          similarResults = null;
          selectedNode = null;
          render();
          if (activeTab === 'duplicates') setTimeout(runAnalysis, 100);
        });
      }
      
      var toggleBtn = container.querySelector('.toggle-filters');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
          showFilters = !showFilters;
          render();
        });
      }
    }
    
    function render() {
      buildEntities();
      
      var tags = searchTags.map(function(tag, i) { 
        return '<span class="search-tag" data-idx="' + i + '" style="display:inline-flex;align-items:center;gap:4px;background:#10b98120;border:1px solid #10b981;padding:4px 8px;border-radius:6px;font-size:10px;color:#6ee7b7;">' + tag + '<span class="remove-tag" style="cursor:pointer;">' + icons.x + '</span></span>'; 
      }).join('');
      
      var hasS = searchTags.length > 0 || searchTerm.trim();
      
      var h = '<div style="background:#0f172a;height:100%;display:flex;flex-direction:column;">';
      
      // Header with tabs
      h += '<div style="padding:10px 16px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;">';
      h += '<div style="display:flex;gap:0;">';
      h += '<button class="tab-btn" data-tab="lineage" style="display:flex;align-items:center;gap:4px;padding:6px 14px;border:none;cursor:pointer;font-size:11px;background:' + (activeTab==='lineage'?'#1e293b':'transparent') + ';color:' + (activeTab==='lineage'?'#10b981':'#64748b') + ';border-radius:6px 0 0 6px;border:1px solid #334155;">' + icons.lineage + ' Lineage</button>';
      h += '<button class="tab-btn" data-tab="duplicates" style="display:flex;align-items:center;gap:4px;padding:6px 14px;border:none;cursor:pointer;font-size:11px;background:' + (activeTab==='duplicates'?'#1e293b':'transparent') + ';color:' + (activeTab==='duplicates'?'#8b5cf6':'#64748b') + ';border-radius:0 6px 6px 0;border:1px solid #334155;border-left:none;">' + icons.overlap + ' Overlap</button>';
      h += '</div>';
      
      // Mini search
      h += '<div style="display:flex;align-items:center;gap:8px;background:#1e293b;border:1px solid #334155;border-radius:6px;padding:4px 10px;min-width:200px;">';
      h += '<span style="color:#64748b;">' + icons.search + '</span>';
      h += '<input id="searchInput" type="text" value="' + searchTerm + '" placeholder="Search..." style="flex:1;background:transparent;border:none;color:#e2e8f0;font-size:11px;outline:none;width:100px;"/>';
      if (hasS || selectedNode) h += '<span id="clearAll" style="color:#64748b;cursor:pointer;">' + icons.x + '</span>';
      h += '</div></div>';
      
      // Filters
      h += renderFilters();
      
      // Search tags
      if (searchTags.length > 0) {
        h += '<div style="padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid #1e293b;">' + tags + '</div>';
      }
      
      // Tab content
      h += '

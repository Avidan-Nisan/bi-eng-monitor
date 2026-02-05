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
    
    // Try multiple patterns for model field
    var modelField = fields.find(function(f) { 
      var fl = f.toLowerCase();
      return fl.indexOf('model') !== -1;
    });
    
    var fieldsField = null;
    for (var i = 0; i < fields.length; i++) {
      var fl = fields[i].toLowerCase();
      if (fl.indexOf('sql_table_fields') !== -1) { fieldsField = fields[i]; break; }
    }
    
    var filters = { model: '', dashboard: '', explore: '', view: '', table: '', field: '' };
    var filterSearch = { model: '', dashboard: '', explore: '', view: '', table: '', field: '' };
    var filterOptions = { models: [], dashboards: [], explores: [], views: [], tables: [], fields: [] };
    
    function getFieldPrefix(fn) {
      if (!fn) return null;
      var nm = fn.toLowerCase(), idx = nm.indexOf('_');
      return idx > 0 ? nm.substring(0, idx) : null;
    }
    
    var genericCores = ['id','name','type','date','value','status','code','key','count','sum','avg','min','max','total','amount','number','num','flag','is','has'];
    var levelIndicators = ['ad','ads','campaign','campaigns','section','sections','publisher','publishers','marketer','marketers','advertiser','advertisers','account','accounts','user','users','website','websites','order','orders','line_item','lineitem','creative','creatives','placement','placements','daily','weekly','monthly','hourly','yearly','agg','aggregate','summary','rollup'];
    
    function extractLevels(vn) {
      if (!vn) return [];
      var nm = vn.toLowerCase(), found = [];
      levelIndicators.forEach(function(lv) {
        if (nm.indexOf(lv) !== -1) {
          var idx = nm.indexOf(lv);
          var bef = idx === 0 ? '_' : nm[idx - 1];
          var aft = idx + lv.length >= nm.length ? '_' : nm[idx + lv.length];
          if ((bef === '_' || bef === '-' || idx === 0) && (aft === '_' || aft === '-' || idx + lv.length === nm.length)) found.push(lv);
        }
      });
      return found;
    }
    
    function hasDifferentLevels(v1, v2) {
      var l1 = extractLevels(v1), l2 = extractLevels(v2);
      if (l1.length > 0 && l2.length > 0) {
        var norm = function(l) {
          if (l.indexOf('ad') === 0) return 'ad';
          if (l.indexOf('campaign') === 0) return 'campaign';
          if (l.indexOf('account') === 0) return 'account';
          if (l.indexOf('user') === 0) return 'user';
          return l;
        };
        var n1 = l1.map(norm), n2 = l2.map(norm);
        if (n1.filter(function(x) { return n2.indexOf(x) === -1; }).length > 0) return true;
        if (n2.filter(function(x) { return n1.indexOf(x) === -1; }).length > 0) return true;
      }
      return false;
    }
    
    function getFieldCore(fn) {
      if (!fn) return '';
      var nm = fn.toLowerCase(), idx = nm.indexOf('_');
      return (idx > 0 && idx < 6) ? nm.substring(idx + 1) : nm;
    }
    
    function isGenericCore(c) { return !c || c.length <= 2 || genericCores.indexOf(c) !== -1; }
    
    function extractModel(row) {
      // Try direct model field first
      if (modelField && row[modelField] && row[modelField].value) {
        return row[modelField].value;
      }
      // Try to extract from explore name (model.explore format)
      if (expField && row[expField] && row[expField].value) {
        var exp = row[expField].value;
        if (exp.indexOf('.') !== -1) return exp.split('.')[0];
      }
      // Try to find any field with 'model' in the name
      for (var key in row) {
        if (key.toLowerCase().indexOf('model') !== -1 && row[key] && row[key].value) {
          return row[key].value;
        }
      }
      return '';
    }
    
    var allRows = data.map(function(row) {
      var fv = fieldsField && row[fieldsField] ? row[fieldsField].value || '' : '';
      var rf = fv ? fv.split('|').map(function(f) { return f.trim(); }).filter(function(f) { return f.length > 0; }) : [];
      var cf = rf.filter(function(f) { return f.indexOf('.') === -1; });
      return { 
        dashboard: row[dashField] ? row[dashField].value : '', 
        explore: row[expField] ? row[expField].value : '', 
        view: row[viewField] ? row[viewField].value : '', 
        table: tableField && row[tableField] ? row[tableField].value : '', 
        model: extractModel(row),
        fields: cf,
        extendedView: extendedViewField && row[extendedViewField] ? row[extendedViewField].value : '',
        includedView: includedViewField && row[includedViewField] ? row[includedViewField].value : ''
      };
    });
    
    // Build all unique options
    var am = {}, ad = {}, ae = {}, av = {}, at = {}, af = {};
    allRows.forEach(function(r) {
      if (r.model) am[r.model] = true;
      if (r.dashboard) ad[r.dashboard] = true;
      if (r.explore) ae[r.explore] = true;
      if (r.view) av[r.view] = true;
      if (r.table) at[r.table] = true;
      r.fields.forEach(function(f) { if (f) af[f] = true; });
    });
    filterOptions.models = Object.keys(am).sort();
    filterOptions.dashboards = Object.keys(ad).sort();
    filterOptions.explores = Object.keys(ae).sort();
    filterOptions.views = Object.keys(av).sort();
    filterOptions.tables = Object.keys(at).sort();
    filterOptions.fields = Object.keys(af).sort();
    
    function getFilteredRows() {
      return allRows.filter(function(r) {
        if (filters.model && r.model !== filters.model) return false;
        if (filters.dashboard && r.dashboard !== filters.dashboard) return false;
        if (filters.explore && r.explore !== filters.explore) return false;
        if (filters.view && r.view !== filters.view) return false;
        if (filters.table && r.table !== filters.table) return false;
        if (filters.field && r.fields.indexOf(filters.field) === -1) return false;
        return true;
      });
    }
    
    function getAvailableOptions() {
      var rows = getFilteredRows();
      var o = { models: {}, dashboards: {}, explores: {}, views: {}, tables: {}, fields: {} };
      rows.forEach(function(r) {
        if (r.model) o.models[r.model] = true;
        if (r.dashboard) o.dashboards[r.dashboard] = true;
        if (r.explore) o.explores[r.explore] = true;
        if (r.view) o.views[r.view] = true;
        if (r.table) o.tables[r.table] = true;
        r.fields.forEach(function(f) { if (f) o.fields[f] = true; });
      });
      return {
        models: Object.keys(o.models).sort(),
        dashboards: Object.keys(o.dashboards).sort(),
        explores: Object.keys(o.explores).sort(),
        views: Object.keys(o.views).sort(),
        tables: Object.keys(o.tables).sort(),
        fields: Object.keys(o.fields).sort()
      };
    }
    
    var tables = {}, views = {}, explores = {}, dashboards = {};
    var viewToTables = {}, viewToViews = {}, exploreToViews = {}, dashToExplores = {}, viewModels = {};
    
    function buildEntities() {
      tables = {}; views = {}; explores = {}; dashboards = {};
      viewToTables = {}; viewToViews = {}; exploreToViews = {}; dashToExplores = {}; viewModels = {};
      var fr = getFilteredRows();
      
      fr.forEach(function(r) {
        var tbl = r.table, vw = r.view, exp = r.explore, dash = r.dashboard;
        var extVw = r.extendedView, incVw = r.includedView, mdl = r.model;
        if (tbl && !tables[tbl]) tables[tbl] = { id: 't_' + tbl, name: tbl, type: 'table', sources: [], fields: [], sqlTables: [tbl] };
        if (vw && !views[vw]) views[vw] = { id: 'v_' + vw, name: vw, type: 'view', sources: [], fields: [], sqlTables: [], model: null };
        if (exp && !explores[exp]) explores[exp] = { id: 'e_' + exp, name: exp, type: 'explore', sources: [], fields: [], sqlTables: [], model: mdl };
        if (dash && !dashboards[dash]) dashboards[dash] = { id: 'd_' + dash, name: dash, type: 'dashboard', sources: [], fields: [], sqlTables: [] };
        if (extVw && !views[extVw]) views[extVw] = { id: 'v_' + extVw, name: extVw, type: 'view', sources: [], fields: [], sqlTables: [], model: null };
        if (incVw && !views[incVw]) views[incVw] = { id: 'v_' + incVw, name: incVw, type: 'view', sources: [], fields: [], sqlTables: [], model: null };
      });
      
      fr.forEach(function(r) {
        var tbl = r.table, vw = r.view, exp = r.explore, dash = r.dashboard;
        var extVw = r.extendedView, incVw = r.includedView, mdl = r.model;
        if (vw && mdl) { if (!viewModels[vw]) viewModels[vw] = {}; viewModels[vw][mdl] = true; }
        if (tbl && tables[tbl]) r.fields.forEach(function(f) { if (f && tables[tbl].fields.indexOf(f) === -1) tables[tbl].fields.push(f); });
        if (vw && views[vw]) { 
          r.fields.forEach(function(f) { if (views[vw].fields.indexOf(f) === -1) views[vw].fields.push(f); }); 
          if (tbl && views[vw].sqlTables.indexOf(tbl) === -1) views[vw].sqlTables.push(tbl); 
        }
        if (exp && explores[exp]) { 
          r.fields.forEach(function(f) { if (explores[exp].fields.indexOf(f) === -1) explores[exp].fields.push(f); }); 
          if (tbl && explores[exp].sqlTables.indexOf(tbl) === -1) explores[exp].sqlTables.push(tbl); 
        }
        if (dash && dashboards[dash]) { 
          r.fields.forEach(function(f) { if (dashboards[dash].fields.indexOf(f) === -1) dashboards[dash].fields.push(f); }); 
          if (tbl && dashboards[dash].sqlTables.indexOf(tbl) === -1) dashboards[dash].sqlTables.push(tbl); 
        }
        if (vw && tbl) { if (!viewToTables[vw]) viewToTables[vw] = {}; viewToTables[vw]['t_' + tbl] = true; }
        if (vw && extVw && vw !== extVw) { if (!viewToViews[vw]) viewToViews[vw] = {}; viewToViews[vw]['v_' + extVw] = true; }
        if (vw && incVw && vw !== incVw) { if (!viewToViews[vw]) viewToViews[vw] = {}; viewToViews[vw]['v_' + incVw] = true; }
        if (exp && vw) { if (!exploreToViews[exp]) exploreToViews[exp] = {}; exploreToViews[exp]['v_' + vw] = true; }
        if (dash && exp) { if (!dashToExplores[dash]) dashToExplores[dash] = {}; dashToExplores[dash]['e_' + exp] = true; }
      });
      
      Object.keys(views).forEach(function(vw) { if (viewModels[vw]) { var m = Object.keys(viewModels[vw]); views[vw].model = m.length > 0 ? m.join(', ') : null; } });
      Object.keys(views).forEach(function(k) { views[k].sources = Object.keys(viewToTables[k] || {}).concat(Object.keys(viewToViews[k] || {})); });
      Object.keys(explores).forEach(function(k) { explores[k].sources = Object.keys(exploreToViews[k] || {}); });
      Object.keys(dashboards).forEach(function(k) { dashboards[k].sources = Object.keys(dashToExplores[k] || {}); });
    }
    
    function getAllEntities() {
      return Object.values(tables).concat(Object.values(views)).concat(Object.values(explores)).concat(Object.values(dashboards));
    }
    
    var activeTab = 'lineage', searchTerm = '', searchTags = [], selectedNode = null;
    var upstream = [], downstream = [], highlightedEntities = [], expandedDuplicates = {};
    var similarResults = null, analysisLoading = false, analysisError = null, showFilters = true;
    var openDropdown = null;
    
    var icons = { 
      search: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>', 
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

    function normalize(s) { return s ? s.toLowerCase().replace(/[_\-\s\.]+/g, '') : ''; }
    function smartMatch(t, s) {
      if (!t || !s) return false;
      return t.toLowerCase().indexOf(s.toLowerCase()) !== -1 || normalize(t).indexOf(normalize(s)) !== -1;
    }
    
    function getUpstream(id, d, v) { 
      var ae = getAllEntities();
      if (d > 15) return []; v = v || {}; if (v[id]) return []; v[id] = true; 
      var e = ae.find(function(x) { return x.id === id; }); 
      if (!e || !e.sources) return []; 
      var r = []; 
      e.sources.forEach(function(s) { if (!v[s]) { r.push(s); r = r.concat(getUpstream(s, (d||0)+1, v)); } }); 
      return r.filter(function(x,i,a) { return a.indexOf(x)===i; }); 
    }
    
    function getDownstream(id, d, v) { 
      var ae = getAllEntities();
      if (d > 15) return []; v = v || {}; if (v[id]) return []; v[id] = true; 
      var r = []; 
      ae.forEach(function(e) { 
        if (e.sources && e.sources.indexOf(id) !== -1 && !v[e.id]) { r.push(e.id); r = r.concat(getDownstream(e.id, (d||0)+1, v)); } 
      }); 
      return r.filter(function(x,i,a) { return a.indexOf(x)===i; }); 
    }
    
    function findDuplicateFields(v1, v2) {
      var matches = [], p1 = {}, p2 = {}, v1Prefix = null, v2Prefix = null;
      v1.fields.forEach(function(f) { var p = getFieldPrefix(f); if (p) p1[p] = (p1[p] || 0) + 1; });
      v2.fields.forEach(function(f) { var p = getFieldPrefix(f); if (p) p2[p] = (p2[p] || 0) + 1; });
      var m1 = 0, m2 = 0;
      Object.keys(p1).forEach(function(p) { if (p1[p] > m1) { m1 = p1[p]; v1Prefix = p; } });
      Object.keys(p2).forEach(function(p) { if (p2[p] > m2) { m2 = p2[p]; v2Prefix = p; } });
      var sameDomain = !v1Prefix || !v2Prefix || v1Prefix === v2Prefix;
      var v1M = {}, v2M = {};
      
      v1.fields.forEach(function(f1) {
        if (v1M[f1.toLowerCase()]) return;
        v2.fields.forEach(function(f2) {
          if (v2M[f2.toLowerCase()]) return;
          if (f1.toLowerCase() === f2.toLowerCase()) {
            matches.push({ f1: f1, f2: f2, type: 'exact' });
            v1M[f1.toLowerCase()] = true; v2M[f2.toLowerCase()] = true;
          }
        });
      });
      
      if (sameDomain) {
        var v1ByCore = {};
        v1.fields.forEach(function(f) {
          if (v1M[f.toLowerCase()]) return;
          var c = getFieldCore(f);
          if (c && !isGenericCore(c)) { if (!v1ByCore[c]) v1ByCore[c] = []; v1ByCore[c].push(f); }
        });
        v2.fields.forEach(function(f2) {
          if (v2M[f2.toLowerCase()]) return;
          var c = getFieldCore(f2);
          if (c && !isGenericCore(c) && v1ByCore[c] && v1ByCore[c].length > 0) {
            for (var i = 0; i < v1ByCore[c].length; i++) {
              var f1 = v1ByCore[c][i];
              if (!v1M[f1.toLowerCase()]) {
                matches.push({ f1: f1, f2: f2, type: 'similar', core: c });
                v1M[f1.toLowerCase()] = true; v2M[f2.toLowerCase()] = true;
                break;
              }
            }
          }
        });
      }
      
      return { matches: matches, sameDomain: sameDomain, v1Only: v1.fields.filter(function(f) { return !v1M[f.toLowerCase()]; }), v2Only: v2.fields.filter(function(f) { return !v2M[f.toLowerCase()]; }) };
    }
    
    function runAnalysis() {
      if (analysisLoading) return;
      analysisLoading = true; analysisError = null; render();
      
      setTimeout(function() {
        try {
          var results = [], vl = Object.values(views).filter(function(v) { return v.fields && v.fields.length >= 5; });
          for (var i = 0; i < vl.length; i++) {
            for (var j = i + 1; j < vl.length; j++) {
              var v1 = vl[i], v2 = vl[j], a = findDuplicateFields(v1, v2);
              if (!a.sameDomain || hasDifferentLevels(v1.name, v2.name)) continue;
              var em = a.matches.filter(function(m) { return m.type === 'exact'; });
              var sm = a.matches.filter(function(m) { return m.type === 'similar'; });
              var minF = Math.min(v1.fields.length, v2.fields.length);
              var score = (em.length + sm.length * 0.5) / minF, sim = Math.round(score * 100);
              if (em.length >= 5 || em.length / minF >= 0.4 || (a.matches.length / minF >= 0.6)) {
                results.push({ v1: v1.name, v2: v2.name, v1Model: v1.model || '-', v2Model: v2.model || '-', similarity: Math.min(sim, 100), exactCount: em.length, similarCount: sm.length, v1FieldCount: v1.fields.length, v2FieldCount: v2.fields.length, exactMatches: em, similarMatches: sm, v1Only: a.v1Only, v2Only: a.v2Only });
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
      var ao = getAvailableOptions();
      var activeCount = Object.values(filters).filter(function(v) { return v; }).length;
      
      var h = '<div style="border-bottom:1px solid #1e293b;">';
      h += '<div class="toggle-filters" style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;cursor:pointer;background:#0f172a80;">';
      h += '<div style="display:flex;align-items:center;gap:8px;"><span style="color:#64748b;">' + icons.filter + '</span><span style="color:#94a3b8;font-size:11px;font-weight:500;">FILTERS</span>';
      if (activeCount > 0) h += '<span style="background:#10b981;color:#0f172a;font-size:10px;padding:2px 6px;border-radius:10px;font-weight:600;">' + activeCount + '</span>';
      h += '</div><span style="color:#475569;">' + (showFilters ? icons.chevronUp : icons.chevronDown) + '</span></div>';
      
      if (showFilters) {
        h += '<div style="padding:12px 16px;display:grid;grid-template-columns:repeat(6,1fr);gap:8px;background:#0f172a;">';
        var fd = [
          { key: 'model', label: 'Model', opts: filters.model ? filterOptions.models : ao.models, color: '#22d3ee' },
          { key: 'dashboard', label: 'Dashboard', opts: filters.dashboard ? filterOptions.dashboards : ao.dashboards, color: '#f97316' },
          { key: 'explore', label: 'Explore', opts: filters.explore ? filterOptions.explores : ao.explores, color: '#ec4899' },
          { key: 'view', label: 'View', opts: filters.view ? filterOptions.views : ao.views, color: '#8b5cf6' },
          { key: 'table', label: 'Table', opts: filters.table ? filterOptions.tables : ao.tables, color: '#06b6d4' },
          { key: 'field', label: 'Field', opts: filters.field ? filterOptions.fields : ao.fields, color: '#10b981' }
        ];
        
        fd.forEach(function(f) {
          var isActive = filters[f.key];
          var isOpen = openDropdown === f.key;
          var searchVal = filterSearch[f.key] || '';
          var filteredOpts = f.opts.filter(function(o) { return !searchVal || o.toLowerCase().indexOf(searchVal.toLowerCase()) !== -1; });
          
          h += '<div style="display:flex;flex-direction:column;gap:4px;position:relative;">';
          h += '<label style="font-size:9px;color:' + f.color + ';text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">' + f.label + ' (' + f.opts.length + ')</label>';
          
          // Custom dropdown trigger
          h += '<div class="filter-trigger" data-filter="' + f.key + '" style="background:#1e293b;border:1px solid ' + (isActive ? f.color : '#334155') + ';color:' + (isActive ? '#e2e8f0' : '#94a3b8') + ';padding:6px 8px;border-radius:6px;font-size:11px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;min-height:32px;">';
          h += '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (isActive ? filters[f.key] : 'All') + '</span>';
          h += '<span style="color:#64748b;flex-shrink:0;">' + icons.chevronDown + '</span></div>';
          
          // Dropdown panel
          if (isOpen) {
            h += '<div style="position:absolute;top:100%;left:0;right:0;background:#1e293b;border:1px solid #334155;border-radius:6px;z-index:1000;margin-top:4px;box-shadow:0 10px 25px rgba(0,0,0,0.5);max-height:250px;display:flex;flex-direction:column;">';
            
            // Search input
            h += '<div style="padding:8px;border-bottom:1px solid #334155;">';
            h += '<input class="filter-search-input" data-filter="' + f.key + '" type="text" value="' + searchVal + '" placeholder="Search..." style="width:100%;background:#0f172a;border:1px solid #334155;color:#e2e8f0;padding:6px 8px;border-radius:4px;font-size:11px;outline:none;box-sizing:border-box;"/>';
            h += '</div>';
            
            // Options list
            h += '<div style="overflow-y:auto;flex:1;">';
            h += '<div class="filter-option" data-filter="' + f.key + '" data-value="" style="padding:8px 12px;cursor:pointer;font-size:11px;color:#94a3b8;border-bottom:1px solid #33415520;" onmouseover="this.style.background=\'#334155\'" onmouseout="this.style.background=\'transparent\'">All (' + f.opts.length + ')</div>';
            
            filteredOpts.slice(0, 100).forEach(function(opt) {
              var sel = filters[f.key] === opt;
              h += '<div class="filter-option" data-filter="' + f.key + '" data-value="' + opt + '" style="padding:8px 12px;cursor:pointer;font-size:11px;color:' + (sel ? f.color : '#e2e8f0') + ';background:' + (sel ? f.color + '20' : 'transparent') + ';" onmouseover="this.style.background=\'' + f.color + '30\'" onmouseout="this.style.background=\'' + (sel ? f.color + '20' : 'transparent') + '\'">' + opt + '</div>';
            });
            
            if (filteredOpts.length > 100) {
              h += '<div style="padding:8px 12px;font-size:10px;color:#64748b;text-align:center;">+' + (filteredOpts.length - 100) + ' more</div>';
            }
            if (filteredOpts.length === 0) {
              h += '<div style="padding:12px;font-size:11px;color:#64748b;text-align:center;">No matches</div>';
            }
            h += '</div></div>';
          }
          h += '</div>';
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
      var vc = Object.values(views).filter(function(v) { return v.fields && v.fields.length >= 5; }).length;
      var metrics = null;
      if (similarResults && similarResults.length > 0) {
        var uv = {}, ts = 0;
        similarResults.forEach(function(p) { uv[p.v1] = true; uv[p.v2] = true; ts += p.similarity; });
        metrics = { totalViews: Object.keys(uv).length, avgSim: Math.round(ts / similarResults.length), totalPairs: similarResults.length };
      }
      
      var h = '<div style="padding:10px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;">';
      h += '<div style="color:#94a3b8;font-size:11px;">Analyzing <span style="color:#e2e8f0;font-weight:500;">' + vc + '</span> views</div>';
      if (metrics) {
        var sc = metrics.avgSim >= 70 ? '#10b981' : metrics.avgSim >= 50 ? '#eab308' : '#f97316';
        h += '<div style="display:flex;gap:16px;font-size:11px;">';
        h += '<span><span style="color:#a78bfa;font-weight:600;">' + metrics.totalViews + '</span> <span style="color:#64748b;">views</span></span>';
        h += '<span><span style="color:' + sc + ';font-weight:600;">' + metrics.avgSim + '%</span> <span style="color:#64748b;">avg</span></span>';
        h += '<span><span style="color:#22d3ee;font-weight:600;">' + metrics.totalPairs + '</span> <span style="color:#64748b;">pairs</span></span>';
        h += '</div>';
      }
      h += '</div>';
      
      if (analysisLoading) h += '<div style="text-align:center;padding:40px;color:#8b5cf6;font-size:12px;">Analyzing...</div>';
      else if (analysisError) h += '<div style="text-align:center;padding:40px;color:#ef4444;font-size:12px;">' + analysisError + '</div>';
      else if (!similarResults || similarResults.length === 0) h += '<div style="text-align:center;padding:40px;color:#10b981;font-size:12px;">No significant overlap found</div>';
      else {
        h += '<div style="overflow-y:auto;max-height:calc(100vh - 280px);">';
        similarResults.forEach(function(p, idx) {
          var isExp = expandedDuplicates[idx];
          var sc = p.similarity >= 70 ? '#10b981' : p.similarity >= 50 ? '#eab308' : '#f97316';
          
          h += '<div class="dup-row" data-idx="' + idx + '" style="border-bottom:1px solid #1e293b;">';
          h += '<div class="dup-header" style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;" onmouseover="this.style.background=\'#1e293b40\'" onmouseout="this.style.background=\'transparent\'">';
          h += '<div style="min-width:36px;width:36px;height:36px;border-radius:6px;background:' + sc + '15;border:1px solid ' + sc + '40;display:flex;align-items:center;justify-content:center;"><span style="font-size:12px;color:' + sc + ';font-weight:700;">' + p.similarity + '%</span></div>';
          h += '<div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
          h += '<span style="color:#a78bfa;font-size:12px;font-weight:500;">' + p.v1 + '</span><span style="color:#475569;font-size:10px;">(' + p.v1Model + ')</span>';
          h += '<span style="color:#334155;">↔</span>';
          h += '<span style="color:#a78bfa;font-size:12px;font-weight:500;">' + p.v2 + '</span><span style="color:#475569;font-size:10px;">(' + p.v2Model + ')</span></div>';
          h += '<div style="display:flex;gap:10px;margin-top:4px;font-size:10px;color:#64748b;">';
          h += '<span><span style="color:#10b981;">' + p.exactCount + '</span> exact</span>';
          if (p.similarCount > 0) h += '<span><span style="color:#eab308;">' + p.similarCount + '</span> similar</span>';
          h += '<span>' + p.v1FieldCount + ' / ' + p.v2FieldCount + ' fields</span></div></div>';
          h += '<span style="color:#475569;">' + (isExp ? icons.chevronUp : icons.chevronDown) + '</span></div>';
          
          if (isExp) {
            h += '<div style="padding:8px 16px 12px;background:#0c1322;">';
            h += '<div style="display:grid;grid-template-columns:1fr 40px 1fr;font-size:10px;border-radius:6px;overflow:hidden;border:1px solid #1e293b;">';
            h += '<div style="padding:8px 10px;background:#1e293b;color:#64748b;font-weight:600;font-size:9px;">' + p.v1 + '</div>';
            h += '<div style="padding:8px;background:#1e293b;"></div>';
            h += '<div style="padding:8px 10px;background:#1e293b;color:#64748b;font-weight:600;font-size:9px;">' + p.v2 + '</div>';
            
            p.exactMatches.forEach(function(m) {
              h += '<div style="padding:6px 10px;background:#0f172a;color:#e2e8f0;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;">' + m.f1 + '</div>';
              h += '<div style="padding:6px;background:#0f172a;color:#10b981;text-align:center;border-top:1px solid #1e293b30;font-weight:600;">=</div>';
              h += '<div style="padding:6px 10px;background:#0f172a;color:#e2e8f0;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;">' + m.f2 + '</div>';
            });
            p.similarMatches.forEach(function(m) {
              h += '<div style="padding:6px 10px;background:#1e293b20;color:#fbbf24;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;">' + m.f1 + '</div>';
              h += '<div style="padding:6px;background:#1e293b20;color:#eab308;text-align:center;border-top:1px solid #1e293b30;">≈</div>';
              h += '<div style="padding:6px 10px;background:#1e293b20;color:#fbbf24;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;">' + m.f2 + '</div>';
            });
            p.v1Only.slice(0, 8).forEach(function(f) {
              h += '<div style="padding:6px 10px;background:#0f172a;color:#f87171;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;opacity:0.8;">' + f + '</div>';
              h += '<div style="padding:6px;background:#0f172a;color:#334155;text-align:center;border-top:1px solid #1e293b30;">—</div>';
              h += '<div style="padding:6px;background:#0f172a;border-top:1px solid #1e293b30;"></div>';
            });
            p.v2Only.slice(0, 8).forEach(function(f) {
              h += '<div style="padding:6px;background:#0f172a;border-top:1px solid #1e293b30;"></div>';
              h += '<div style="padding:6px;background:#0f172a;color:#334155;text-align:center;border-top:1px solid #1e293b30;">—</div>';
              h += '<div style="padding:6px 10px;background:#0f172a;color:#f87171;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;opacity:0.8;">' + f + '</div>';
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
      var ae = getAllEntities(), terms = searchTags.slice();
      if (searchTerm.trim()) terms.push(searchTerm.trim());
      if (terms.length === 0) return [];
      var matches = [], partial = [];
      
      ae.forEach(function(e) {
        var mc = 0, fm = [];
        terms.forEach(function(t) {
          var matched = false;
          if (smartMatch(e.name, t)) matched = true;
          if (e.fields) e.fields.forEach(function(f) { if (smartMatch(f, t)) { matched = true; if (fm.indexOf(f) === -1) fm.push(f); } });
          if (matched) mc++;
        });
        var d = { entity: e, fieldMatches: fm, totalTerms: terms.length, matchedTermsCount: mc };
        if (mc === terms.length) matches.push(d);
        else if (mc > 0) partial.push(d);
      });
      
      window._partialMatches = partial.sort(function(a, b) { return b.matchedTermsCount - a.matchedTermsCount; }).slice(0, 10);
      return matches.sort(function(a, b) { return b.fieldMatches.length - a.fieldMatches.length; });
    }
    
    function renderLineageTab() {
      var ae = getAllEntities(), sm = getSearchMatches();
      highlightedEntities = sm.map(function(m) { return m.entity.id; });
      var visible = ae, mode = '';
      
      if (selectedNode) {
        mode = 'lineage'; upstream = getUpstream(selectedNode.id, 0); downstream = getDownstream(selectedNode.id, 0);
        var ids = [selectedNode.id].concat(upstream).concat(downstream);
        visible = ae.filter(function(e) { return ids.indexOf(e.id) !== -1; });
      } else if (searchTags.length > 0 || searchTerm.trim()) {
        mode = 'search';
        visible = highlightedEntities.length > 0 ? ae.filter(function(e) { return highlightedEntities.indexOf(e.id) !== -1; }) : [];
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
      
      var r = '<div><div style="padding:8px 16px;border-bottom:1px solid #1e293b;font-size:11px;display:flex;justify-content:space-between;"><div>' + stats + '</div><div style="color:#64748b;">' + ae.length + ' entities</div></div>';
      
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
      var ae = getAllEntities();
      
      container.querySelectorAll('.node').forEach(function(n) {
        n.addEventListener('click', function() {
          var id = n.dataset.id, entity = ae.find(function(x) { return x.id === id; });
          if (selectedNode && selectedNode.id === id) { selectedNode = null; upstream = []; downstream = []; }
          else { selectedNode = entity; searchTerm = ''; searchTags = []; }
          render();
        });
      });
      
      container.querySelectorAll('.dup-header').forEach(function(h) {
        h.addEventListener('click', function() {
          var idx = parseInt(h.parentElement.dataset.idx);
          expandedDuplicates[idx] = !expandedDuplicates[idx];
          var tc = container.querySelector('#tab-content');
          if (tc) { tc.innerHTML = renderDuplicatesTab(); attachEvents(); }
        });
      });
      
      // Filter trigger clicks
      container.querySelectorAll('.filter-trigger').forEach(function(t) {
        t.addEventListener('click', function(e) {
          e.stopPropagation();
          var key = t.dataset.filter;
          openDropdown = openDropdown === key ? null : key;
          filterSearch[key] = '';
          render();
          // Focus search input
          setTimeout(function() {
            var inp = container.querySelector('.filter-search-input[data-filter="' + key + '"]');
            if (inp) inp.focus();
          }, 50);
        });
      });
      
      // Filter search inputs
      container.querySelectorAll('.filter-search-input').forEach(function(inp) {
        inp.addEventListener('input', function(e) {
          filterSearch[inp.dataset.filter] = e.target.value;
          render();
          setTimeout(function() {
            var newInp = container.querySelector('.filter-search-input[data-filter="' + inp.dataset.filter + '"]');
            if (newInp) { newInp.focus(); newInp.selectionStart = newInp.selectionEnd = newInp.value.length; }
          }, 10);
        });
        inp.addEventListener('click', function(e) { e.stopPropagation(); });
      });
      
      // Filter option clicks
      container.querySelectorAll('.filter-option').forEach(function(opt) {
        opt.addEventListener('click', function(e) {
          e.stopPropagation();
          var key = opt.dataset.filter, val = opt.dataset.value;
          filters[key] = val;
          filterSearch[key] = '';
          openDropdown = null;
          // Reset downstream filters
          var keys = ['model','dashboard','explore','view','table','field'];
          var idx = keys.indexOf(key);
          for (var i = idx + 1; i < keys.length; i++) filters[keys[i]] = '';
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
          buildEntities(); similarResults = null; selectedNode = null; render();
          if (activeTab === 'duplicates') setTimeout(runAnalysis, 100);
        });
      }
      
      var toggleBtn = container.querySelector('.toggle-filters');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', function() { showFilters = !showFilters; render(); });
      }
      
      // Close dropdown on outside click
      document.addEventListener('click', function() {
        if (openDropdown) { openDropdown = null; render(); }
      });
    }
    
    function render() {
      buildEntities();
      
      var tags = searchTags.map(function(tag, i) {
        return '<span class="search-tag" data-idx="' + i + '" style="display:inline-flex;align-items:center;gap:4px;background:#10b98120;border:1px solid #10b981;padding:4px 8px;border-radius:6px;font-size:10px;color:#6ee7b7;">' + tag + '<span class="remove-tag" style="cursor:pointer;">' + icons.x + '</span></span>';
      }).join('');
      
      var hasS = searchTags.length > 0 || searchTerm.trim();
      
      var h = '<div style="background:#0f172a;height:100%;display:flex;flex-direction:column;">';
      h += '<div style="padding:10px 16px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;">';
      h += '<div style="display:flex;gap:0;">';
      h += '<button class="tab-btn" data-tab="lineage" style="display:flex;align-items:center;gap:4px;padding:6px 14px;border:none;cursor:pointer;font-size:11px;background:' + (activeTab==='lineage'?'#1e293b':'transparent') + ';color:' + (activeTab==='lineage'?'#10b981':'#64748b') + ';border-radius:6px 0 0 6px;border:1px solid #334155;">' + icons.lineage + ' Lineage</button>';
      h += '<button class="tab-btn" data-tab="duplicates" style="display:flex;align-items:center;gap:4px;padding:6px 14px;border:none;cursor:pointer;font-size:11px;background:' + (activeTab==='duplicates'?'#1e293b':'transparent') + ';color:' + (activeTab==='duplicates'?'#8b5cf6':'#64748b') + ';border-radius:0 6px 6px 0;border:1px solid #334155;border-left:none;">' + icons.overlap + ' Overlap</button>';
      h += '</div>';
      h += '<div style="display:flex;align-items:center;gap:8px;background:#1e293b;border:1px solid #334155;border-radius:6px;padding:4px 10px;min-width:200px;">';
      h += '<span style="color:#64748b;">' + icons.search + '</span>';
      h += '<input id="searchInput" type="text" value="' + searchTerm + '" placeholder="Search..." style="flex:1;background:transparent;border:none;color:#e2e8f0;font-size:11px;outline:none;width:100px;"/>';
      if (hasS || selectedNode) h += '<span id="clearAll" style="color:#64748b;cursor:pointer;">' + icons.x + '</span>';
      h += '</div></div>';
      h += renderFilters();
      if (searchTags.length > 0) h += '<div style="padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid #1e293b;">' + tags + '</div>';
      h += '<div id="tab-content" style="flex:1;overflow:auto;">' + (activeTab === 'lineage' ? renderLineageTab() : renderDuplicatesTab()) + '</div></div>';
      
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
        btn.addEventListener('click', function() {
          activeTab = btn.dataset.tab;
          render();
          if (activeTab === 'duplicates' && !similarResults && !analysisLoading) setTimeout(runAnalysis, 100);
        });
      });
      
      attachEvents();
    }
    
    buildEntities();
    render();
    done();
  }
});

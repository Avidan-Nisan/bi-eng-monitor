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
    if (!data || data.length === 0) { container.innerHTML = '<div style="padding:40px;color:#64748b;background:#0f172a;min-height:600px;">No data available</div>'; done(); return; }
    
    var fields = queryResponse.fields.dimension_like.map(function(f) { return f.name; });
    var dashField = fields.find(function(f) { return f.toLowerCase().indexOf('dashboard') !== -1 && f.toLowerCase().indexOf('title') !== -1; });
    var expField = fields.find(function(f) { return f.toLowerCase().indexOf('explore') !== -1 && f.toLowerCase().indexOf('name') !== -1; });
    var viewField = fields.find(function(f) { return f.toLowerCase().indexOf('view') !== -1 && f.toLowerCase().indexOf('name') !== -1 && f.toLowerCase().indexOf('count') === -1 && f.toLowerCase().indexOf('extended') === -1 && f.toLowerCase().indexOf('included') === -1; });
    var fieldsField = fields.find(function(f) { return f.toLowerCase().indexOf('sql_table_fields') !== -1 || f.toLowerCase().indexOf('falm_sql_table_fields') !== -1; });
    var tableField = fields.find(function(f) { return f.toLowerCase().indexOf('sql_table') !== -1 && f.toLowerCase().indexOf('fields') === -1 && f.toLowerCase().indexOf('path') === -1; });
    var extendedViewField = fields.find(function(f) { return f.toLowerCase().indexOf('extended') !== -1 && f.toLowerCase().indexOf('view') !== -1; });
    var includedViewField = fields.find(function(f) { return f.toLowerCase().indexOf('included') !== -1 && f.toLowerCase().indexOf('view') !== -1; });
    
    var allRows = data.map(function(row) {
      return { 
        dashboard: row[dashField] ? row[dashField].value : '', 
        explore: row[expField] ? row[expField].value : '', 
        view: row[viewField] ? row[viewField].value : '', 
        table: tableField && row[tableField] ? row[tableField].value : '', 
        fields: fieldsField && row[fieldsField] ? (row[fieldsField].value || '').split('|').filter(function(f) { return f.trim(); }) : [],
        extendedView: extendedViewField && row[extendedViewField] ? row[extendedViewField].value : '',
        includedView: includedViewField && row[includedViewField] ? row[includedViewField].value : ''
      };
    });
    
    var tables = {}, views = {}, explores = {}, dashboards = {}, viewToTables = {}, viewToViews = {}, exploreToViews = {}, dashToExplores = {};
    
    allRows.forEach(function(row) {
      var tbl = row.table, vw = row.view, exp = row.explore, dash = row.dashboard, extVw = row.extendedView, incVw = row.includedView;
      if (tbl && !tables[tbl]) tables[tbl] = { id: 't_'+tbl, name: tbl, type: 'table', sources: [], fields: [], sqlTables: [] };
      if (vw && !views[vw]) views[vw] = { id: 'v_'+vw, name: vw, type: 'view', sources: [], fields: [], sqlTables: [] };
      if (exp && !explores[exp]) explores[exp] = { id: 'e_'+exp, name: exp, type: 'explore', sources: [], fields: [], sqlTables: [] };
      if (dash && !dashboards[dash]) dashboards[dash] = { id: 'd_'+dash, name: dash, type: 'dashboard', sources: [], fields: [], sqlTables: [] };
      if (extVw && !views[extVw]) views[extVw] = { id: 'v_'+extVw, name: extVw, type: 'view', sources: [], fields: [], sqlTables: [] };
      if (incVw && !views[incVw]) views[incVw] = { id: 'v_'+incVw, name: incVw, type: 'view', sources: [], fields: [], sqlTables: [] };
      if (vw && views[vw]) { row.fields.forEach(function(f) { if (views[vw].fields.indexOf(f) === -1) views[vw].fields.push(f); }); if (tbl && views[vw].sqlTables.indexOf(tbl) === -1) views[vw].sqlTables.push(tbl); }
      if (exp && explores[exp]) { row.fields.forEach(function(f) { if (explores[exp].fields.indexOf(f) === -1) explores[exp].fields.push(f); }); if (tbl && explores[exp].sqlTables.indexOf(tbl) === -1) explores[exp].sqlTables.push(tbl); }
      if (dash && dashboards[dash]) { row.fields.forEach(function(f) { if (dashboards[dash].fields.indexOf(f) === -1) dashboards[dash].fields.push(f); }); if (tbl && dashboards[dash].sqlTables.indexOf(tbl) === -1) dashboards[dash].sqlTables.push(tbl); }
      if (vw && tbl) { if (!viewToTables[vw]) viewToTables[vw] = {}; viewToTables[vw]['t_'+tbl] = true; }
      if (vw && extVw && vw !== extVw) { if (!viewToViews[vw]) viewToViews[vw] = {}; viewToViews[vw]['v_'+extVw] = true; }
      if (vw && incVw && vw !== incVw) { if (!viewToViews[vw]) viewToViews[vw] = {}; viewToViews[vw]['v_'+incVw] = true; }
      if (exp && vw) { if (!exploreToViews[exp]) exploreToViews[exp] = {}; exploreToViews[exp]['v_'+vw] = true; }
      if (dash && exp) { if (!dashToExplores[dash]) dashToExplores[dash] = {}; dashToExplores[dash]['e_'+exp] = true; }
    });
    
    Object.keys(views).forEach(function(k) { views[k].sources = Object.keys(viewToTables[k] || {}).concat(Object.keys(viewToViews[k] || {})); });
    Object.keys(explores).forEach(function(k) { explores[k].sources = Object.keys(exploreToViews[k] || {}); });
    Object.keys(dashboards).forEach(function(k) { dashboards[k].sources = Object.keys(dashToExplores[k] || {}); });
    
    var allEntities = Object.values(tables).concat(Object.values(views)).concat(Object.values(explores)).concat(Object.values(dashboards));
    var activeTab = 'lineage', searchTerm = '', searchTags = [], selectedNode = null, upstream = [], downstream = [], highlightedEntities = [], showFieldsPanel = null, expandedDuplicates = {};
    
    var icons = { search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>', x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', list: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>', lineage: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l4-6h2M11 12l4 6h2"/></svg>', duplicate: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/></svg>', chevronDown: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>', chevronRight: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>', ai: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2M7.5 13A2.5 2.5 0 005 15.5 2.5 2.5 0 007.5 18a2.5 2.5 0 002.5-2.5A2.5 2.5 0 007.5 13m9 0a2.5 2.5 0 00-2.5 2.5 2.5 2.5 0 002.5 2.5 2.5 2.5 0 002.5-2.5 2.5 2.5 0 00-2.5-2.5z"/></svg>' };
    var typeIcons = { table: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="9" width="8" height="3"/><rect x="13" y="9" width="8" height="3"/><rect x="3" y="14" width="8" height="3"/><rect x="13" y="14" width="8" height="3"/></svg>', view: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7zm0 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/></svg>', explore: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>', dashboard: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="2" y="2" width="9" height="6" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="10" width="9" height="12" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>' };
    var typeConfig = { table: { color: '#06b6d4', label: 'SQL Tables' }, view: { color: '#8b5cf6', label: 'Views' }, explore: { color: '#ec4899', label: 'Explores' }, dashboard: { color: '#f97316', label: 'Dashboards' } };

    function normalize(s) { return s ? s.toLowerCase().replace(/[_\-\s\.]+/g, '') : ''; }
    function tokenize(s) { if (!s) return []; return s.toLowerCase().split(/[_\-\s\.]+/).filter(function(t) { return t.length > 0; }); }
    
    // Enhanced prefix list for semantic matching
    var prefixes = ['dics','hics','dim','fct','fact','stg','raw','src','tgt','tmp','temp','v','vw','tb','tbl','f','d','pk','fk','sk','bk','nk','facm','fasg','fasm','facd','falm','farm','facs','fadm','dicm','disg','dism','dicd','dilm','dirm','didm','hicm','hisg','hism','hicd','hilm','hirm','hidm','crm','erp','fin','hr','mkt','ops','prd','sal','inv','cust','prod','ord','pay','ship','ret','ref'];
    
    function stripPrefix(field) {
      if (!field) return '';
      var tokens = field.toLowerCase().split(/[_\-\.]+/);
      while (tokens.length > 1 && (prefixes.indexOf(tokens[0]) !== -1 || /^[a-z]{2,4}$/.test(tokens[0]))) tokens.shift();
      return tokens.join('_');
    }
    
    function getCore(field) {
      return stripPrefix(field).replace(/[_\-\s\.]+/g, '').replace(/(id|key|code|num|no)$/i, '');
    }
    
    function fieldsSimilar(f1, f2) {
      if (!f1 || !f2) return { match: false, score: 0 };
      if (f1 === f2) return { match: true, score: 100, reason: 'exact' };
      var n1 = normalize(f1), n2 = normalize(f2);
      if (n1 === n2) return { match: true, score: 98, reason: 'normalized' };
      var c1 = getCore(f1), c2 = getCore(f2);
      if (c1 === c2 && c1.length >= 3) return { match: true, score: 95, reason: 'same core' };
      var s1 = stripPrefix(f1), s2 = stripPrefix(f2);
      if (s1 === s2 && s1.length >= 3) return { match: true, score: 93, reason: 'prefix stripped' };
      if (c1.length >= 4 && c2.length >= 4 && (c1.indexOf(c2) !== -1 || c2.indexOf(c1) !== -1)) return { match: true, score: 88, reason: 'core contains' };
      var t1 = tokenize(s1), t2 = tokenize(s2);
      if (t1.length > 0 && t2.length > 0 && t1.join('') === t2.join('')) return { match: true, score: 90, reason: 'tokens match' };
      var common = t1.filter(function(t) { return t2.indexOf(t) !== -1; });
      if (common.length >= 1 && common.length / Math.max(t1.length, t2.length) >= 0.5) return { match: true, score: 80, reason: common.length + ' common' };
      if (t1.length > 0 && t2.length > 0 && t1[t1.length-1] === t2[t2.length-1] && t1[t1.length-1].length > 3) return { match: true, score: 65, reason: 'same suffix' };
      return { match: false, score: 0 };
    }
    
    function smartMatch(text, term, retScore) {
      if (!text || !term) return retScore ? 0 : false;
      var tl = text.toLowerCase(), tml = term.toLowerCase().trim(), tn = normalize(text), tmn = normalize(term);
      var score = 0;
      if (tl === tml) score = 100;
      else if (tn === tmn) score = 98;
      else if (tl.indexOf(tml) !== -1 || tn.indexOf(tmn) !== -1) score = 90;
      else { var tt = tokenize(text), tmt = tokenize(term); if (tmt.length > 0 && tmt.every(function(t) { return tt.some(function(x) { return x.indexOf(t) !== -1; }); })) score = 80; }
      return retScore ? score : score >= 35;
    }
    
    function getSearchMatches() {
      var terms = searchTags.slice(); if (searchTerm.trim()) terms.push(searchTerm.trim()); if (terms.length === 0) return [];
      var matches = [];
      allEntities.forEach(function(entity) {
        var matchedTerms = 0, fieldMatches = [], nameScore = 0;
        terms.forEach(function(term) {
          var termMatched = false;
          var ns = smartMatch(entity.name, term, true); if (ns >= 35) { termMatched = true; nameScore = Math.max(nameScore, ns); }
          if (entity.fields) entity.fields.forEach(function(field) { var fs = smartMatch(field, term, true); if (fs >= 35) { termMatched = true; if (fieldMatches.indexOf(field) === -1) fieldMatches.push(field); } });
          if (termMatched) matchedTerms++;
        });
        if (matchedTerms === terms.length) matches.push({ entity: entity, fieldMatches: fieldMatches, nameMatch: nameScore >= 35 });
      });
      return matches;
    }
    
    function getUpstream(id, depth, visited) { 
      if (depth > 15 || !visited) visited = visited || {};
      if (visited[id]) return [];
      visited[id] = true;
      var e = allEntities.find(function(x) { return x.id === id; }); 
      if (!e || !e.sources) return []; 
      var r = []; 
      e.sources.forEach(function(s) { if (!visited[s]) { r.push(s); r = r.concat(getUpstream(s, (depth||0)+1, visited)); } }); 
      return r.filter(function(v,i,a) { return a.indexOf(v)===i; }); 
    }
    
    function getDownstream(id, depth, visited) { 
      if (depth > 15 || !visited) visited = visited || {};
      if (visited[id]) return [];
      visited[id] = true;
      var r = []; 
      allEntities.forEach(function(e) { if (e.sources && e.sources.indexOf(id) !== -1 && !visited[e.id]) { r.push(e.id); r = r.concat(getDownstream(e.id, (depth||0)+1, visited)); } }); 
      return r.filter(function(v,i,a) { return a.indexOf(v)===i; }); 
    }
    
    function findDuplicates() {
      var entities = [];
      Object.values(views).forEach(function(v) { if (v.fields && v.fields.length > 0) entities.push({ name: v.name, fields: v.fields, type: 'view' }); });
      Object.values(explores).forEach(function(e) { if (e.fields && e.fields.length > 0) entities.push({ name: e.name, fields: e.fields, type: 'explore' }); });
      Object.values(dashboards).forEach(function(d) { if (d.fields && d.fields.length > 0) entities.push({ name: d.name, fields: d.fields, type: 'dashboard' }); });
      var duplicates = [];
      for (var i = 0; i < entities.length; i++) {
        for (var j = i + 1; j < entities.length; j++) {
          var v1 = entities[i], v2 = entities[j]; if (v1.name === v2.name) continue;
          var pairs = [], m1 = {}, m2 = {};
          v1.fields.forEach(function(f1) { 
            if (m1[f1]) return; 
            var best = null; 
            v2.fields.forEach(function(f2) { 
              if (m2[f2]) return; 
              var r = fieldsSimilar(f1, f2); 
              if (r.match && (!best || r.score > best.score)) best = { f1: f1, f2: f2, score: r.score, reason: r.reason }; 
            }); 
            if (best) { pairs.push(best); m1[best.f1] = true; m2[best.f2] = true; } 
          });
          var sim = pairs.length / Math.min(v1.fields.length, v2.fields.length);
          if (pairs.length >= 1 && sim >= 0.2) duplicates.push({ views: [v1, v2], matchedPairs: pairs, commonCount: pairs.length, similarity: Math.round(sim * 100) });
        }
      }
      return duplicates.sort(function(a, b) { return b.similarity - a.similarity; });
    }
    
    function renderDuplicatesTab() {
      var dups = findDuplicates();
      var html = '<div style="padding:20px 24px;border-bottom:1px solid #1e293b;"><div style="color:#e2e8f0;font-size:14px;font-weight:500;">Find Similar Entities</div><div style="color:#64748b;font-size:12px;margin-top:4px;">Semantic field matching (prefix-aware: facm_revenue ≈ fasg_revenue)</div></div>';
      if (dups.length === 0) { html += '<div style="text-align:center;padding:60px 40px;"><div style="font-size:48px;margin-bottom:16px;">🔍</div><div style="color:#e2e8f0;font-size:16px;">No Similar Entities Found</div></div>'; }
      else { 
        html += '<div style="padding:12px 24px;border-bottom:1px solid #1e293b;background:#f9731615;font-size:13px;color:#f97316;">Found '+dups.length+' similar pair(s)</div><div style="max-height:450px;overflow-y:auto;">'; 
        dups.forEach(function(dup, idx) { 
          var isExp = expandedDuplicates[idx], v1 = dup.views[0], v2 = dup.views[1], c1 = typeConfig[v1.type].color, c2 = typeConfig[v2.type].color; 
          html += '<div class="dup-row" data-idx="'+idx+'" style="border-bottom:1px solid #1e293b;"><div class="dup-header" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;"><span style="color:#64748b;">'+(isExp?icons.chevronDown:icons.chevronRight)+'</span><div style="flex:1;display:flex;align-items:center;gap:12px;"><div style="flex:1;"><div style="color:'+c1+';font-size:13px;">'+v1.name+'</div><div style="font-size:10px;color:#64748b;">'+v1.type.toUpperCase()+' • '+v1.fields.length+' fields</div></div><div style="color:#64748b;">↔</div><div style="flex:1;"><div style="color:'+c2+';font-size:13px;">'+v2.name+'</div><div style="font-size:10px;color:#64748b;">'+v2.type.toUpperCase()+' • '+v2.fields.length+' fields</div></div></div><div style="text-align:center;"><div style="background:#f9731622;border:1px solid #f97316;padding:4px 10px;border-radius:12px;font-size:11px;color:#f97316;font-weight:600;">'+dup.similarity+'%</div><div style="font-size:9px;color:#64748b;">'+dup.commonCount+' matches</div></div></div>'; 
          if (isExp) { 
            html += '<div style="padding:0 16px 16px 44px;background:#0c1222;"><div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;">'; 
            dup.matchedPairs.forEach(function(p) { 
              var col = p.f1 === p.f2 ? '#10b981' : p.score >= 90 ? '#22d3ee' : '#f59e0b'; 
              html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#1e293b;border-radius:6px;"><span style="flex:1;font-size:11px;color:#e2e8f0;font-family:monospace;">'+p.f1+'</span><span style="color:'+col+';">'+(p.f1===p.f2?'=':'≈')+'</span><span style="flex:1;font-size:11px;color:#e2e8f0;font-family:monospace;">'+p.f2+'</span><span style="font-size:9px;color:#64748b;background:#334155;padding:2px 6px;border-radius:4px;">'+p.score+'% '+p.reason+'</span></div>'; 
            }); 
            html += '</div></div>'; 
          } 
          html += '</div>'; 
        }); 
        html += '</div>'; 
      }
      return html;
    }
    
    function renderLineageTab() {
      var searchMatches = getSearchMatches(); highlightedEntities = searchMatches.map(function(m) { return m.entity.id; });
      var visibleEntities = allEntities, filterMode = '';
      if (selectedNode) { filterMode = 'lineage'; upstream = getUpstream(selectedNode.id, 0); downstream = getDownstream(selectedNode.id, 0); var ids = [selectedNode.id].concat(upstream).concat(downstream); visibleEntities = allEntities.filter(function(e) { return ids.indexOf(e.id) !== -1; }); }
      else if (searchTags.length > 0 || searchTerm.trim()) { filterMode = 'search'; visibleEntities = highlightedEntities.length > 0 ? allEntities.filter(function(e) { return highlightedEntities.indexOf(e.id) !== -1; }) : []; }
      var byType = { table: [], view: [], explore: [], dashboard: [] }; visibleEntities.forEach(function(e) { byType[e.type].push(e); });
      var nodeW = 280, nodeH = 46, nodeSpacing = 54, padding = 20, svgWidth = Math.max(containerWidth - 30, 1250), colSpacing = (svgWidth - padding * 2 - nodeW) / 3;
      var colX = { table: padding, view: padding + colSpacing, explore: padding + colSpacing * 2, dashboard: padding + colSpacing * 3 }, positions = {}, startY = 75;
      ['table','view','explore','dashboard'].forEach(function(type) { byType[type].forEach(function(e, idx) { positions[e.id] = { x: colX[type], y: startY + idx * nodeSpacing }; }); });
      var maxCount = Math.max(byType.table.length||1, byType.view.length||1, byType.explore.length||1, byType.dashboard.length||1), svgHeight = Math.max(maxCount * nodeSpacing + 110, 350);
      var edgesHtml = ''; visibleEntities.forEach(function(e) { (e.sources||[]).forEach(function(s) { var f = positions[s], t = positions[e.id]; if (!f || !t) return; var stroke = '#334155', op = 0.25, sw = 1.5; if (selectedNode) { if (s===selectedNode.id || downstream.indexOf(e.id)!==-1) { stroke='#f97316'; op=0.9; sw=2.5; } else if (e.id===selectedNode.id || upstream.indexOf(s)!==-1) { stroke='#06b6d4'; op=0.9; sw=2.5; } } else if (filterMode === 'search') { stroke='#10b981'; op=0.6; sw=2; } var x1=f.x+nodeW, y1=f.y+nodeH/2, x2=t.x, y2=t.y+nodeH/2, mx=(x1+x2)/2; edgesHtml += '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-opacity="'+op+'"/>'; }); });
      var nodesHtml = ''; visibleEntities.forEach(function(entity) { var pos = positions[entity.id], cfg = typeConfig[entity.type], isSel = selectedNode && selectedNode.id === entity.id, isUp = selectedNode && upstream.indexOf(entity.id) !== -1, isDown = selectedNode && downstream.indexOf(entity.id) !== -1, isMatch = highlightedEntities.indexOf(entity.id) !== -1 && !selectedNode; var borderColor = isSel ? '#ffffff' : isUp ? '#06b6d4' : isDown ? '#f97316' : isMatch ? '#10b981' : cfg.color, borderWidth = (isSel||isUp||isDown||isMatch) ? 2 : 1; var nm = entity.name.length > 32 ? entity.name.substring(0,31)+'…' : entity.name, fc = entity.fields ? entity.fields.length : 0; nodesHtml += '<g class="node" data-id="'+entity.id+'" data-name="'+entity.name.replace(/"/g,'&quot;')+'" style="cursor:pointer;" transform="translate('+pos.x+','+pos.y+')"><rect width="'+nodeW+'" height="'+nodeH+'" rx="10" fill="#0f172a" stroke="'+borderColor+'" stroke-width="'+borderWidth+'"/><rect x="1" y="1" width="40" height="'+(nodeH-2)+'" rx="9" fill="'+cfg.color+'" fill-opacity="0.15"/><g transform="translate(13,'+(nodeH/2-7)+')" fill="'+cfg.color+'">'+typeIcons[entity.type]+'</g><text x="48" y="'+(nodeH/2)+'" fill="#e2e8f0" font-size="11" font-weight="500">'+nm+'</text><text x="48" y="'+(nodeH/2+12)+'" fill="'+cfg.color+'" font-size="9" opacity="0.7">'+entity.type.toUpperCase()+' • '+fc+' fields</text></g>'; });
      var hdrHtml = ''; ['table','view','explore','dashboard'].forEach(function(type) { var cfg = typeConfig[type]; hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="28" text-anchor="middle" fill="'+cfg.color+'" font-size="10" font-weight="600">'+cfg.label.toUpperCase()+'</text><text x="'+(colX[type]+nodeW/2)+'" y="42" text-anchor="middle" fill="#475569" font-size="9">'+byType[type].length+' items</text>'; });
      var statsText = selectedNode ? '<span style="color:'+typeConfig[selectedNode.type].color+';">'+selectedNode.name+'</span> <span style="color:#06b6d4;">▲'+upstream.length+'</span> <span style="color:#f97316;">▼'+downstream.length+'</span>' : highlightedEntities.length > 0 ? '<span style="color:#10b981;">'+highlightedEntities.length+' matches</span>' : '<span style="color:#64748b;">Click node to trace lineage</span>';
      return '<div style="position:relative;"><div style="padding:12px 24px;border-bottom:1px solid #1e293b;font-size:12px;">'+statsText+'</div><div style="padding:15px;overflow:auto;"><svg width="'+svgWidth+'" height="'+svgHeight+'" style="font-family:system-ui,sans-serif;">'+hdrHtml+edgesHtml+nodesHtml+'</svg></div></div>';
    }
    
    function render() {
      var tagsHtml = searchTags.map(function(tag, i) { return '<span class="search-tag" data-idx="'+i+'" style="display:inline-flex;align-items:center;gap:6px;background:#10b98125;border:1px solid #10b981;padding:6px 10px;border-radius:8px;font-size:12px;color:#6ee7b7;">'+tag+'<span class="remove-tag" style="cursor:pointer;">'+icons.x+'</span></span>'; }).join('');
      var hasSearch = searchTags.length > 0 || searchTerm.trim();
      container.innerHTML = '<div style="background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);min-height:600px;"><div style="padding:14px 24px;border-bottom:1px solid #1e293b;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div style="display:flex;align-items:center;gap:12px;"><div style="font-weight:600;color:#f1f5f9;font-size:16px;">Asset Manager</div></div><div style="display:flex;"><button class="tab-btn" data-tab="lineage" style="padding:10px 20px;border:none;cursor:pointer;font-size:12px;background:transparent;border-bottom:2px solid '+(activeTab==='lineage'?'#10b981':'transparent')+';color:'+(activeTab==='lineage'?'#10b981':'#64748b')+';">'+icons.lineage+' Data Lineage</button><button class="tab-btn" data-tab="duplicates" style="padding:10px 20px;border:none;cursor:pointer;font-size:12px;background:transparent;border-bottom:2px solid '+(activeTab==='duplicates'?'#f97316':'transparent')+';color:'+(activeTab==='duplicates'?'#f97316':'#64748b')+';">'+icons.duplicate+' Similar Views</button></div></div><div style="background:#1e293b;border:1px solid #475569;border-radius:12px;padding:16px;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:'+(searchTags.length?'12px':'0')+';"><span style="color:#10b981;">'+icons.search+'</span><input id="searchInput" type="text" value="'+searchTerm+'" placeholder="Search fields (comma to add multiple)..." style="flex:1;background:transparent;border:none;color:#e2e8f0;font-size:14px;outline:none;"/>'+(hasSearch||selectedNode?'<span id="clearAll" style="color:#64748b;cursor:pointer;padding:6px;border-radius:6px;background:#334155;">'+icons.x+'</span>':'')+'</div>'+(searchTags.length?'<div style="display:flex;flex-wrap:wrap;gap:8px;">'+tagsHtml+'</div>':'')+'</div></div><div id="tab-content">'+(activeTab==='lineage'?renderLineageTab():renderDuplicatesTab())+'</div></div>';
      
      var input = container.querySelector('#searchInput');
      input.addEventListener('input', function(e) { 
        var val = e.target.value; 
        if (val.indexOf(',') !== -1) { 
          var parts = val.split(','); 
          for (var i = 0; i < parts.length - 1; i++) { var term = parts[i].trim(); if (term && searchTags.indexOf(term) === -1) searchTags.push(term); } 
          searchTerm = parts[parts.length - 1]; 
          render(); 
          return; 
        } 
        searchTerm = val; selectedNode = null; 
        var tc = container.querySelector('#tab-content'); 
        if (tc && activeTab === 'lineage') { tc.innerHTML = renderLineageTab(); attachNodeEvents(); } 
      });
      input.addEventListener('keydown', function(e) { if (e.key === 'Enter' && searchTerm.trim()) { if (searchTags.indexOf(searchTerm.trim()) === -1) searchTags.push(searchTerm.trim()); searchTerm = ''; render(); } else if (e.key === 'Backspace' && !searchTerm && searchTags.length > 0) { searchTags.pop(); render(); } });
      input.focus();
      
      var clearBtn = container.querySelector('#clearAll'); 
      if (clearBtn) clearBtn.addEventListener('click', function() { searchTerm = ''; searchTags = []; selectedNode = null; render(); });
      container.querySelectorAll('.remove-tag').forEach(function(btn) { btn.addEventListener('click', function(e) { e.stopPropagation(); searchTags.splice(parseInt(btn.parentElement.dataset.idx), 1); render(); }); });
      container.querySelectorAll('.tab-btn').forEach(function(btn) { btn.addEventListener('click', function() { activeTab = btn.dataset.tab; render(); }); });
      
      if (activeTab === 'lineage') attachNodeEvents();
      container.querySelectorAll('.dup-header').forEach(function(h) { 
        h.addEventListener('click', function() { 
          var idx = parseInt(h.parentElement.dataset.idx); 
          expandedDuplicates[idx] = !expandedDuplicates[idx]; 
          container.querySelector('#tab-content').innerHTML = renderDuplicatesTab(); 
          container.querySelectorAll('.dup-header').forEach(function(h2) { h2.addEventListener('click', arguments.callee); }); 
        }); 
      });
    }
    
    function attachNodeEvents() {
      container.querySelectorAll('.node').forEach(function(n) { 
        n.addEventListener('click', function() { 
          var id = n.dataset.id, entity = allEntities.find(function(x) { return x.id === id; }); 
          if (selectedNode && selectedNode.id === id) { selectedNode = null; } 
          else { selectedNode = entity; searchTerm = ''; searchTags = []; } 
          render(); 
        }); 
      });
    }
    
    render(); done();
  }
});

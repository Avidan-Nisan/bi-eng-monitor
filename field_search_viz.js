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
    
    // Log all available fields for debugging
    console.log('=== ASSET MANAGER DEBUG ===');
    console.log('All available fields:', fields);
    
    var dashField = fields.find(function(f) { return f.toLowerCase().indexOf('dashboard') !== -1 && f.toLowerCase().indexOf('title') !== -1; });
    var expField = fields.find(function(f) { return f.toLowerCase().indexOf('explore') !== -1 && f.toLowerCase().indexOf('name') !== -1; });
    var viewField = fields.find(function(f) { return f.toLowerCase().indexOf('view') !== -1 && f.toLowerCase().indexOf('name') !== -1 && f.toLowerCase().indexOf('count') === -1 && f.toLowerCase().indexOf('extended') === -1 && f.toLowerCase().indexOf('included') === -1; });
    var tableField = fields.find(function(f) { return f.toLowerCase().indexOf('sql_table') !== -1 && f.toLowerCase().indexOf('fields') === -1 && f.toLowerCase().indexOf('path') === -1; });
    var extendedViewField = fields.find(function(f) { return f.toLowerCase().indexOf('extended') !== -1 && f.toLowerCase().indexOf('view') !== -1; });
    var includedViewField = fields.find(function(f) { return f.toLowerCase().indexOf('included') !== -1 && f.toLowerCase().indexOf('view') !== -1; });
    
    // Find fields field - looking for any column containing falm_sql_table_fields or sql_table_fields
    var fieldsField = null;
    for (var i = 0; i < fields.length; i++) {
      var fl = fields[i].toLowerCase();
      if (fl.indexOf('falm_sql_table_fields') !== -1 || fl.indexOf('sql_table_fields') !== -1) {
        fieldsField = fields[i];
        break;
      }
    }
    // If not found, try partial match
    if (!fieldsField) {
      for (var i = 0; i < fields.length; i++) {
        var fl = fields[i].toLowerCase();
        if (fl.indexOf('table_fields') !== -1 || fl.indexOf('_fields') !== -1) {
          fieldsField = fields[i];
          break;
        }
      }
    }
    
    console.log('Field mappings:', { 
      dashField: dashField, 
      expField: expField, 
      viewField: viewField, 
      fieldsField: fieldsField, 
      tableField: tableField 
    });
    
    if (!fieldsField) {
      console.log('WARNING: fieldsField not found! Available fields are:', fields);
    }
    
    var allRows = data.map(function(row) {
      var fieldsVal = '';
      if (fieldsField && row[fieldsField]) {
        fieldsVal = row[fieldsField].value || '';
      }
      return { 
        dashboard: row[dashField] ? row[dashField].value : '', 
        explore: row[expField] ? row[expField].value : '', 
        view: row[viewField] ? row[viewField].value : '', 
        table: tableField && row[tableField] ? row[tableField].value : '', 
        fields: fieldsVal ? fieldsVal.split('|').filter(function(f) { return f.trim(); }) : [],
        extendedView: extendedViewField && row[extendedViewField] ? row[extendedViewField].value : '',
        includedView: includedViewField && row[includedViewField] ? row[includedViewField].value : ''
      };
    });
    
    // Debug field capture
    var rowsWithFields = allRows.filter(function(r) { return r.fields.length > 0; });
    console.log('Rows with fields:', rowsWithFields.length, 'of', allRows.length);
    if (rowsWithFields.length > 0) {
      console.log('Sample row with fields:', rowsWithFields[0]);
    } else if (fieldsField && data.length > 0) {
      console.log('fieldsField found but no data. Raw value:', data[0][fieldsField]);
    }
    
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
    
    Object.keys(views).forEach(function(k) { 
      var tableSources = Object.keys(viewToTables[k] || {});
      var viewSources = Object.keys(viewToViews[k] || {});
      views[k].sources = tableSources.concat(viewSources);
    });
    Object.keys(explores).forEach(function(k) { explores[k].sources = Object.keys(exploreToViews[k] || {}); });
    Object.keys(dashboards).forEach(function(k) { dashboards[k].sources = Object.keys(dashToExplores[k] || {}); });
    
    // Debug entity field counts
    var viewsWithFields = Object.values(views).filter(function(v) { return v.fields.length > 0; });
    var exploresWithFields = Object.values(explores).filter(function(e) { return e.fields.length > 0; });
    console.log('Views with fields:', viewsWithFields.length);
    console.log('Explores with fields:', exploresWithFields.length);
    if (viewsWithFields.length > 0) {
      console.log('Sample view with fields:', viewsWithFields[0].name, '- fields:', viewsWithFields[0].fields.slice(0,5));
    }
    
    var allEntities = Object.values(tables).concat(Object.values(views)).concat(Object.values(explores)).concat(Object.values(dashboards));
    var activeTab = 'lineage', searchTerm = '', searchTags = [], selectedNode = null, upstream = [], downstream = [], highlightedEntities = [], showFieldsPanel = null, expandedDuplicates = {};
    
    var icons = { search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>', x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', list: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>', lineage: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l4-6h2M11 12l4 6h2"/></svg>', duplicate: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/></svg>', chevronDown: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>', chevronRight: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>', ai: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2M7.5 13A2.5 2.5 0 005 15.5 2.5 2.5 0 007.5 18a2.5 2.5 0 002.5-2.5A2.5 2.5 0 007.5 13m9 0a2.5 2.5 0 00-2.5 2.5 2.5 2.5 0 002.5 2.5 2.5 2.5 0 002.5-2.5 2.5 2.5 0 00-2.5-2.5z"/></svg>' };
    var typeIcons = { table: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="9" width="8" height="3"/><rect x="13" y="9" width="8" height="3"/><rect x="3" y="14" width="8" height="3"/><rect x="13" y="14" width="8" height="3"/></svg>', view: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7zm0 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/></svg>', explore: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>', dashboard: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="2" y="2" width="9" height="6" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="10" width="9" height="12" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>' };
    var typeConfig = { table: { color: '#06b6d4', label: 'SQL Tables' }, view: { color: '#8b5cf6', label: 'Views' }, explore: { color: '#ec4899', label: 'Explores' }, dashboard: { color: '#f97316', label: 'Dashboards' } };

    function normalize(str) { return str ? str.toLowerCase().replace(/[_\-\s\.]+/g, '') : ''; }
    function tokenize(str) { if (!str) return []; var tokens = str.toLowerCase().split(/[_\-\s\.]+/).filter(function(t) { return t.length > 0; }); var camelSplit = str.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/); return tokens.concat(camelSplit).filter(function(v, i, a) { return a.indexOf(v) === i && v.length > 0; }); }
    function levenshtein(a, b) { if (!a || !b) return Math.max((a||'').length, (b||'').length); var m = a.length, n = b.length; if (m === 0) return n; if (n === 0) return m; var d = []; for (var i = 0; i <= m; i++) d[i] = [i]; for (var j = 0; j <= n; j++) d[0][j] = j; for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) { var cost = a[i-1] === b[j-1] ? 0 : 1; d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + cost); } return d[m][n]; }
    
    var synonyms = { 'campaign': ['cmpgn', 'camp', 'cmp'], 'name': ['nm', 'title', 'label'], 'date': ['dt', 'time', 'timestamp', 'ts'], 'number': ['num', 'no', 'nr', 'count', 'cnt'], 'amount': ['amt', 'value', 'val'], 'customer': ['cust', 'client', 'user'], 'product': ['prod', 'item', 'sku'], 'order': ['ord', 'purchase'], 'identifier': ['id', 'key', 'code'], 'description': ['desc', 'descr'], 'quantity': ['qty', 'qnty'], 'category': ['cat', 'catg', 'type'], 'status': ['stat', 'state'], 'revenue': ['rev', 'sales'], 'transaction': ['trans', 'txn', 'trx'], 'account': ['acct', 'acc'], 'total': ['tot', 'sum', 'ttl'], 'average': ['avg', 'mean'] };
    
    function expandWithSynonyms(term) { var expanded = [term], termLower = term.toLowerCase(); Object.keys(synonyms).forEach(function(key) { if (key === termLower || synonyms[key].indexOf(termLower) !== -1) { expanded.push(key); expanded = expanded.concat(synonyms[key]); } }); return expanded.filter(function(v, i, a) { return a.indexOf(v) === i; }); }
    
    function calculateMatchScore(text, searchTerm) {
      if (!text || !searchTerm) return 0;
      var textLower = text.toLowerCase(), termLower = searchTerm.toLowerCase().trim(), termClean = termLower.replace(/[_\-\s\.]+$/, ''), textNorm = normalize(text), termNorm = normalize(termClean);
      if (textLower === termLower || textLower === termClean) return 100;
      if (textNorm === termNorm) return 98;
      if (textLower.indexOf(termLower) !== -1 || textLower.indexOf(termClean) !== -1) return 90;
      if (textNorm.indexOf(termNorm) !== -1) return 88;
      if (textLower.indexOf(termClean) === 0 || textNorm.indexOf(termNorm) === 0) return 90;
      var textTokens = tokenize(text), termTokens = tokenize(searchTerm);
      if (textTokens.some(function(t) { return t.indexOf(termNorm) === 0 || termNorm.indexOf(t) === 0; })) return 85;
      if (termTokens.length > 0 && termTokens.every(function(tt) { return textTokens.some(function(txtt) { return txtt.indexOf(tt) !== -1 || tt.indexOf(txtt) !== -1; }); })) return 80;
      var expandedTerms = []; termTokens.forEach(function(tt) { expandedTerms = expandedTerms.concat(expandWithSynonyms(tt)); });
      if (expandedTerms.some(function(et) { var etNorm = normalize(et); return textNorm.indexOf(etNorm) !== -1 || textTokens.some(function(txtt) { return txtt.indexOf(etNorm) !== -1 || etNorm.indexOf(txtt) !== -1; }); })) return 75;
      var minDist = Infinity; textTokens.forEach(function(txtt) { termTokens.forEach(function(tt) { if (tt.length >= 3) { var dist = levenshtein(txtt, tt), maxLen = Math.max(txtt.length, tt.length); if (dist / maxLen < minDist) minDist = dist / maxLen; } }); });
      if (minDist <= 0.25) return 60;
      if (minDist <= 0.4) return 45;
      return 0;
    }
    
    function smartMatch(text, searchTerm, returnScore) { var score = calculateMatchScore(text, searchTerm); return returnScore ? score : score >= 35; }
    
    function getSearchMatches() {
      var terms = searchTags.slice(); if (searchTerm.trim()) terms.push(searchTerm.trim()); if (terms.length === 0) return [];
      var matches = [];
      allEntities.forEach(function(entity) {
        var totalScore = 0, matchedTerms = 0, fieldMatches = [], nameScore = 0, tableMatches = [];
        terms.forEach(function(term) {
          var termMatched = false, bestFieldScore = 0, termTokens = tokenize(term);
          var ns = smartMatch(entity.name, term, true); if (ns >= 35) { termMatched = true; nameScore = Math.max(nameScore, ns); }
          var tableContextMatch = false, matchedTable = null;
          if (entity.sqlTables && entity.sqlTables.length > 0) { entity.sqlTables.forEach(function(tbl) { var ts = smartMatch(tbl, term, true); if (ts >= 35) { tableContextMatch = true; matchedTable = tbl; tableMatches.push({ table: tbl, term: term, score: ts }); } }); }
          if (entity.fields && entity.fields.length > 0) {
            entity.fields.forEach(function(field) {
              var fs = smartMatch(field, term, true);
              if (fs < 35 && tableContextMatch && termTokens.length > 1) { var fieldTokens = tokenize(field); if (termTokens.some(function(tt) { return fieldTokens.some(function(ft) { return ft === tt || ft.indexOf(tt) !== -1 || tt.indexOf(ft) !== -1; }); })) fs = 70; }
              if (fs >= 35) { termMatched = true; if (fs > bestFieldScore) { bestFieldScore = fs; } var existing = fieldMatches.find(function(fm) { return fm.field === field; }); if (!existing) fieldMatches.push({ field: field, score: fs, matchedTerms: [term], tableContext: tableContextMatch ? matchedTable : null }); else if (existing.matchedTerms.indexOf(term) === -1) { existing.matchedTerms.push(term); existing.score = Math.max(existing.score, fs); } }
            });
          }
          if (!termMatched && tableContextMatch) { termMatched = true; bestFieldScore = 50; }
          if (termMatched) { matchedTerms++; totalScore += Math.max(nameScore, bestFieldScore); }
        });
        if (matchedTerms === terms.length) { fieldMatches.sort(function(a, b) { return b.score - a.score; }); matches.push({ entity: entity, score: totalScore / terms.length + Math.min(fieldMatches.length * 2, 10), nameMatch: nameScore >= 35, fieldMatches: fieldMatches.map(function(fm) { return fm.field; }), fieldScores: fieldMatches, tableMatches: tableMatches, totalTerms: terms.length }); }
      });
      return matches.sort(function(a, b) { return b.fieldMatches.length !== a.fieldMatches.length ? b.fieldMatches.length - a.fieldMatches.length : b.score - a.score; });
    }
    
    // Get only relevant upstream tables - those that are direct sources of matched entities
    function getRelevantUpstreamTables(matches) {
      var relevantTableIds = {};
      matches.forEach(function(m) {
        var entity = m.entity;
        // Get tables from sqlTables of matched entity
        if (entity.sqlTables && entity.sqlTables.length > 0) {
          entity.sqlTables.forEach(function(tableName) {
            relevantTableIds['t_' + tableName] = true;
          });
        }
        // Also check sources that are tables
        if (entity.sources) {
          entity.sources.forEach(function(sourceId) {
            if (sourceId.indexOf('t_') === 0) {
              relevantTableIds[sourceId] = true;
            }
          });
        }
      });
      return Object.keys(relevantTableIds);
    }
    
    function getUpstream(id, depth, visited) { if (depth > 15) return []; if (!visited) visited = {}; if (visited[id]) return []; visited[id] = true; var e = allEntities.find(function(x) { return x.id === id; }); if (!e || !e.sources) return []; var r = []; e.sources.forEach(function(s) { if (!visited[s]) { r.push(s); r = r.concat(getUpstream(s, (depth||0)+1, visited)); } }); return r.filter(function(v,i,a) { return a.indexOf(v)===i; }); }
    function getDownstream(id, depth, visited) { if (depth > 15) return []; if (!visited) visited = {}; if (visited[id]) return []; visited[id] = true; var r = []; allEntities.forEach(function(e) { if (e.sources && e.sources.indexOf(id) !== -1 && !visited[e.id]) { r.push(e.id); r = r.concat(getDownstream(e.id, (depth||0)+1, visited)); } }); return r.filter(function(v,i,a) { return a.indexOf(v)===i; }); }
    
    // Enhanced prefix list for semantic field matching
    var prefixes = ['dics','hics','dim','fct','fact','stg','raw','src','tgt','tmp','temp','v','vw','tb','tbl','f','d','pk','fk','sk','bk','nk','facm','fasg','fasm','facd','falm','farm','facs','fadm','dicm','disg','dism','dicd','dilm','dirm','didm','hicm','hisg','hism','hicd','hilm','hirm','hidm','crm','erp','fin','hr','mkt','ops','prd','sal','inv','cust','prod','ord','pay','ship','ret','ref','dica','dicl','dicw','disa','maom'];
    
    function stripPrefix(field) { if (!field) return ''; var tokens = field.toLowerCase().split(/[_\-\.]+/); while (tokens.length > 1 && (prefixes.indexOf(tokens[0]) !== -1 || /^[a-z]{2,4}$/.test(tokens[0]))) tokens.shift(); return tokens.join('_'); }
    function getCore(field) { return stripPrefix(field).replace(/[_\-\s\.]+/g, '').replace(/(id|key|code|num|no)$/i, ''); }
    
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
    
    function findDuplicates() {
      var viewsList = [], exploresList = [], dashboardsList = [];
      
      Object.values(views).forEach(function(v) { 
        if (v.fields && v.fields.length > 0) viewsList.push({ name: v.name, fields: v.fields, sqlTables: v.sqlTables || [], type: 'view' }); 
      });
      Object.values(explores).forEach(function(e) { 
        if (e.fields && e.fields.length > 0) exploresList.push({ name: e.name, fields: e.fields, sqlTables: e.sqlTables || [], type: 'explore' }); 
      });
      Object.values(dashboards).forEach(function(d) { 
        if (d.fields && d.fields.length > 0) dashboardsList.push({ name: d.name, fields: d.fields, sqlTables: d.sqlTables || [], type: 'dashboard' }); 
      });
      
      console.log('Similarity check - Views:', viewsList.length, 'Explores:', exploresList.length, 'Dashboards:', dashboardsList.length);
      
      var duplicates = [];
      
      function compareWithinType(list) {
        for (var i = 0; i < list.length; i++) {
          for (var j = i + 1; j < list.length; j++) {
            var v1 = list[i], v2 = list[j]; 
            if (v1.name === v2.name) continue;
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
            var minFields = Math.min(v1.fields.length, v2.fields.length);
            var sim = minFields > 0 ? (pairs.length / minFields) * 100 : 0;
            if (pairs.length >= 1 && sim >= 20) {
              duplicates.push({ views: [v1, v2], matchedPairs: pairs, commonCount: pairs.length, similarity: Math.round(sim), v1Total: v1.fields.length, v2Total: v2.fields.length });
            }
          }
        }
      }
      
      compareWithinType(viewsList);
      compareWithinType(exploresList);
      compareWithinType(dashboardsList);
      
      console.log('Found similar pairs:', duplicates.length);
      return duplicates.sort(function(a, b) { return b.similarity - a.similarity; });
    }
    
    function renderDuplicatesTab() {
      var dups = findDuplicates();
      var vCount = Object.values(views).filter(function(v) { return v.fields && v.fields.length > 0; }).length;
      var eCount = Object.values(explores).filter(function(e) { return e.fields && e.fields.length > 0; }).length;
      var dCount = Object.values(dashboards).filter(function(d) { return d.fields && d.fields.length > 0; }).length;
      
      var html = '<div style="padding:20px 24px;border-bottom:1px solid #1e293b;"><div style="color:#e2e8f0;font-size:14px;font-weight:500;">Find Similar Entities</div><div style="color:#64748b;font-size:12px;margin-top:4px;">Comparing within same type: '+vCount+' views, '+eCount+' explores, '+dCount+' dashboards</div><div style="color:#64748b;font-size:11px;margin-top:4px;">Semantic matching: facm_revenue ≈ fasg_revenue (20%+ field overlap required)</div></div>';
      if (dups.length === 0) { 
        html += '<div style="text-align:center;padding:60px 40px;"><div style="font-size:48px;margin-bottom:16px;">🔍</div><div style="color:#e2e8f0;font-size:16px;margin-bottom:8px;">No Similar Entities Found</div><div style="color:#64748b;font-size:13px;">Entities need 20%+ field overlap within the same type.</div><div style="color:#f97316;font-size:12px;margin-top:12px;">Views with fields: '+vCount+' | Explores with fields: '+eCount+'</div><div style="color:#64748b;font-size:11px;margin-top:8px;">If counts are 0, check that falm_sql_table_fields column exists in your query</div></div>'; 
      } else { 
        html += '<div style="padding:12px 24px;border-bottom:1px solid #1e293b;background:#f9731615;font-size:13px;color:#f97316;">Found '+dups.length+' pair(s) of similar entities</div><div style="max-height:450px;overflow-y:auto;">'; 
        dups.forEach(function(dup, idx) { 
          var isExp = expandedDuplicates[idx], v1 = dup.views[0], v2 = dup.views[1];
          var c1 = typeConfig[v1.type] ? typeConfig[v1.type].color : '#8b5cf6';
          html += '<div class="dup-row" data-idx="'+idx+'" style="border-bottom:1px solid #1e293b;"><div class="dup-header" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;"><span style="color:#64748b;">'+(isExp?icons.chevronDown:icons.chevronRight)+'</span><div style="flex:1;display:flex;align-items:center;gap:12px;"><div style="flex:1;"><div style="color:'+c1+';font-size:13px;">'+v1.name+'</div><div style="font-size:10px;color:#64748b;margin-top:2px;">'+v1.type.toUpperCase()+' • '+v1.fields.length+' fields</div></div><div style="color:#64748b;font-size:20px;">↔</div><div style="flex:1;"><div style="color:'+c1+';font-size:13px;">'+v2.name+'</div><div style="font-size:10px;color:#64748b;margin-top:2px;">'+v2.type.toUpperCase()+' • '+v2.fields.length+' fields</div></div></div><div style="text-align:center;"><div style="background:#f9731622;border:1px solid #f97316;padding:4px 10px;border-radius:12px;font-size:11px;color:#f97316;font-weight:600;">'+dup.similarity+'%</div><div style="font-size:9px;color:#64748b;margin-top:2px;">'+dup.commonCount+' of '+Math.min(v1.fields.length, v2.fields.length)+'</div></div></div>'; 
          if (isExp) { 
            html += '<div style="padding:0 16px 16px 44px;background:#0c1222;"><div style="font-size:11px;color:#64748b;margin-bottom:8px;">Matched Field Pairs ('+dup.matchedPairs.length+')</div><div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;">'; 
            dup.matchedPairs.forEach(function(p) { 
              var ex = p.f1 === p.f2, col = ex ? '#10b981' : p.score >= 90 ? '#22d3ee' : '#f59e0b'; 
              html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#1e293b;border-radius:6px;"><span style="flex:1;font-size:11px;color:#e2e8f0;font-family:monospace;">'+p.f1+'</span><span style="color:'+col+';font-size:12px;">'+(ex?'=':'≈')+'</span><span style="flex:1;font-size:11px;color:#e2e8f0;font-family:monospace;">'+p.f2+'</span><span style="font-size:9px;color:#64748b;background:#334155;padding:2px 6px;border-radius:4px;">'+p.score+'%</span></div>'; 
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
      var searchMatches = getSearchMatches(); 
      highlightedEntities = searchMatches.map(function(m) { return m.entity.id; });
      var visibleEntities = allEntities, filterMode = '';
      if (selectedNode) { 
        filterMode = 'lineage'; 
        upstream = getUpstream(selectedNode.id, 0); 
        downstream = getDownstream(selectedNode.id, 0); 
        var ids = [selectedNode.id].concat(upstream).concat(downstream); 
        visibleEntities = allEntities.filter(function(e) { return ids.indexOf(e.id) !== -1; }); 
      }
      else if (searchTags.length > 0 || searchTerm.trim()) { 
        filterMode = 'search'; 
        if (highlightedEntities.length > 0) {
          var relevantTableIds = getRelevantUpstreamTables(searchMatches);
          var allVisibleIds = highlightedEntities.concat(relevantTableIds);
          visibleEntities = allEntities.filter(function(e) { return allVisibleIds.indexOf(e.id) !== -1; });
        } else {
          visibleEntities = [];
        }
      }
      var byType = { table: [], view: [], explore: [], dashboard: [] }; visibleEntities.forEach(function(e) { byType[e.type].push(e); }); ['table','view','explore','dashboard'].forEach(function(t) { byType[t].sort(function(a,b) { return a.name.localeCompare(b.name); }); });
      
      var nodeW = 200, nodeH = 38, nodeSpacing = 46, padding = 15, svgWidth = Math.max(containerWidth - 30, 1100), colSpacing = (svgWidth - padding * 2 - nodeW) / 3;
      var colX = { table: padding, view: padding + colSpacing, explore: padding + colSpacing * 2, dashboard: padding + colSpacing * 3 }, positions = {}, startY = 65;
      ['table','view','explore','dashboard'].forEach(function(type) { byType[type].forEach(function(e, idx) { positions[e.id] = { x: colX[type], y: startY + idx * nodeSpacing }; }); });
      var maxCount = Math.max(byType.table.length||1, byType.view.length||1, byType.explore.length||1, byType.dashboard.length||1), svgHeight = Math.max(maxCount * nodeSpacing + 100, 350);
      var edgesHtml = ''; visibleEntities.forEach(function(e) { (e.sources||[]).forEach(function(s) { var f = positions[s], t = positions[e.id]; if (!f || !t) return; var stroke = '#334155', op = 0.25, sw = 1.5; if (selectedNode) { var isUp = upstream.indexOf(s)!==-1 && (upstream.indexOf(e.id)!==-1 || e.id===selectedNode.id), isDown = downstream.indexOf(e.id)!==-1 && (downstream.indexOf(s)!==-1 || s===selectedNode.id); if (s===selectedNode.id || isDown) { stroke='#f97316'; op=0.9; sw=2.5; } else if (e.id===selectedNode.id || isUp) { stroke='#06b6d4'; op=0.9; sw=2.5; } } else if (filterMode === 'search') { stroke='#10b981'; op=0.6; sw=2; } var x1=f.x+nodeW, y1=f.y+nodeH/2, x2=t.x, y2=t.y+nodeH/2, mx=(x1+x2)/2; edgesHtml += '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-opacity="'+op+'"/>'; }); });
      var nodesHtml = ''; visibleEntities.forEach(function(entity) { var pos = positions[entity.id], cfg = typeConfig[entity.type], isSel = selectedNode && selectedNode.id === entity.id, isUp = selectedNode && upstream.indexOf(entity.id) !== -1, isDown = selectedNode && downstream.indexOf(entity.id) !== -1, isMatch = highlightedEntities.indexOf(entity.id) !== -1 && !selectedNode; var borderColor = cfg.color, borderWidth = 1; if (isSel) { borderColor = '#ffffff'; borderWidth = 2; } else if (isUp) { borderColor = '#06b6d4'; borderWidth = 2; } else if (isDown) { borderColor = '#f97316'; borderWidth = 2; } else if (isMatch) { borderColor = '#10b981'; borderWidth = 2; } var nm = entity.name.length > 26 ? entity.name.substring(0,25)+'…' : entity.name, fc = entity.fields ? entity.fields.length : 0; nodesHtml += '<g class="node" data-id="'+entity.id+'" data-name="'+entity.name.replace(/"/g,'&quot;')+'" style="cursor:pointer;" transform="translate('+pos.x+','+pos.y+')"><rect width="'+nodeW+'" height="'+nodeH+'" rx="8" fill="#0f172a" fill-opacity="0.95" stroke="'+borderColor+'" stroke-width="'+borderWidth+'"/><rect x="1" y="1" width="32" height="'+(nodeH-2)+'" rx="7" fill="'+cfg.color+'" fill-opacity="0.15"/><g transform="translate(9,'+(nodeH/2-7)+')" fill="'+cfg.color+'">'+typeIcons[entity.type]+'</g><text x="40" y="'+(nodeH/2-2)+'" fill="#e2e8f0" font-size="10" font-weight="500">'+nm+'</text><text x="40" y="'+(nodeH/2+10)+'" fill="'+cfg.color+'" font-size="8" opacity="0.8">'+entity.type.toUpperCase()+' • '+fc+' fields</text></g>'; });
      var hdrHtml = ''; ['table','view','explore','dashboard'].forEach(function(type) { var cfg = typeConfig[type]; hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="22" text-anchor="middle" fill="'+cfg.color+'" font-size="9" font-weight="600" letter-spacing="0.5">'+cfg.label.toUpperCase()+'</text><text x="'+(colX[type]+nodeW/2)+'" y="36" text-anchor="middle" fill="#475569" font-size="8">'+byType[type].length+' items</text>'; });
      var statsText = ''; if (selectedNode) statsText = '<span style="color:'+typeConfig[selectedNode.type].color+';font-weight:500;">'+selectedNode.name+'</span><span style="color:#06b6d4;margin-left:14px;">▲ '+upstream.length+'</span><span style="color:#f97316;margin-left:10px;">▼ '+downstream.length+'</span>'; else if ((searchTags.length > 0 || searchTerm.trim()) && highlightedEntities.length > 0) statsText = '<span style="color:#10b981;font-weight:500;">'+highlightedEntities.length+' matches</span>'; else if (searchTags.length > 0 || searchTerm.trim()) statsText = '<span style="color:#ef4444;">No matches found</span>'; else statsText = '<span style="color:#64748b;">Click node to trace lineage</span>';
      return '<div style="position:relative;"><div style="padding:10px 20px;border-bottom:1px solid #1e293b;font-size:12px;display:flex;justify-content:space-between;align-items:center;"><div>'+statsText+'</div><div style="color:#64748b;font-size:11px;">'+(filterMode?visibleEntities.length+' of ':'')+allEntities.length+' entities</div></div><div style="padding:12px;overflow:auto;"><svg width="'+svgWidth+'" height="'+svgHeight+'" style="font-family:system-ui,sans-serif;">'+hdrHtml+edgesHtml+nodesHtml+'</svg></div></div>';
    }
    
    function attachLineageEvents() { container.querySelectorAll('.node').forEach(function(n) { n.addEventListener('contextmenu', function(e) { e.preventDefault(); var name = n.dataset.name; if (name && navigator.clipboard) navigator.clipboard.writeText(name); }); n.addEventListener('click', function(e) { var id = n.dataset.id, entity = allEntities.find(function(x) { return x.id === id; }); if (selectedNode && selectedNode.id === id) { selectedNode = null; upstream = []; downstream = []; showFieldsPanel = null; } else { selectedNode = entity; searchTerm = ''; searchTags = []; showFieldsPanel = id; } render(); }); }); }
    
    function render() {
      var tagsHtml = searchTags.map(function(tag, i) { return '<span class="search-tag" data-idx="'+i+'" style="display:inline-flex;align-items:center;gap:6px;background:#10b98125;border:1px solid #10b981;padding:6px 10px 6px 12px;border-radius:8px;font-size:12px;color:#6ee7b7;font-weight:500;"><span style="opacity:0.6;font-size:10px;">'+(i+1)+'.</span> '+tag+'<span class="remove-tag" style="cursor:pointer;opacity:0.7;padding:2px;">'+icons.x+'</span></span>'; }).join('');
      var hasSearch = searchTags.length > 0 || searchTerm.trim();
      container.innerHTML = '<div style="background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);min-height:600px;"><div style="padding:14px 24px;border-bottom:1px solid #1e293b;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div style="display:flex;align-items:center;gap:12px;"><div><div style="font-weight:600;color:#f1f5f9;font-size:16px;">Asset Manager</div><div style="font-size:10px;color:#64748b;">'+allRows.length+' assets</div></div></div><div style="display:flex;border-bottom:2px solid #334155;"><button class="tab-btn" data-tab="lineage" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;font-weight:500;background:transparent;border-bottom:2px solid '+(activeTab==='lineage'?'#10b981':'transparent')+';margin-bottom:-2px;color:'+(activeTab==='lineage'?'#10b981':'#64748b')+';">'+icons.lineage+' Data Lineage</button><button class="tab-btn" data-tab="duplicates" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;font-weight:500;background:transparent;border-bottom:2px solid '+(activeTab==='duplicates'?'#f97316':'transparent')+';margin-bottom:-2px;color:'+(activeTab==='duplicates'?'#f97316':'#64748b')+';">'+icons.duplicate+' Similar Views</button></div></div><div style="background:linear-gradient(135deg,#1e293b,#334155);border:1px solid #475569;border-radius:12px;padding:16px;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:'+(searchTags.length?'12px':'0')+';"><span style="color:#10b981;display:flex;align-items:center;gap:4px;">'+icons.ai+icons.search+'</span><input id="searchInput" type="text" value="'+searchTerm+'" placeholder="Search fields: use comma to separate multiple terms..." autocomplete="off" spellcheck="false" style="flex:1;background:transparent;border:none;color:#e2e8f0;font-size:14px;outline:none;"/>'+(hasSearch||selectedNode?'<span id="clearAll" style="color:#64748b;cursor:pointer;padding:6px;border-radius:6px;background:#334155;">'+icons.x+'</span>':'')+'</div>'+(searchTags.length?'<div style="display:flex;flex-wrap:wrap;gap:8px;">'+tagsHtml+'</div>':'')+'<div style="margin-top:12px;font-size:11px;color:#64748b;">🤖 <span style="color:#10b981;">Semantic matching</span>: facm_revenue ≈ fasg_revenue</div></div></div><div id="tab-content">'+(activeTab==='lineage'?renderLineageTab():renderDuplicatesTab())+'</div><div style="padding:10px 24px;border-top:1px solid #1e293b;display:flex;gap:20px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;"><span><span style="color:#06b6d4;">━━</span> Upstream</span><span><span style="color:#f97316;">━━</span> Downstream</span><span><span style="color:#10b981;">━━</span> Match</span></div></div>';
      var input = container.querySelector('#searchInput'), debounceTimer = null;
      input.addEventListener('input', function(e) { var val = e.target.value; if (val.indexOf(',') !== -1) { var parts = val.split(','); for (var i = 0; i < parts.length - 1; i++) { var term = parts[i].trim(); if (term && searchTags.indexOf(term) === -1) searchTags.push(term); } searchTerm = parts[parts.length - 1]; render(); return; } searchTerm = val; selectedNode = null; upstream = []; downstream = []; clearTimeout(debounceTimer); debounceTimer = setTimeout(function() { var tc = container.querySelector('#tab-content'); if (tc && activeTab === 'lineage') { tc.innerHTML = renderLineageTab(); attachLineageEvents(); } }, 200); });
      input.addEventListener('keydown', function(e) { if (e.key === 'Enter' && searchTerm.trim()) { e.preventDefault(); if (searchTags.indexOf(searchTerm.trim()) === -1) searchTags.push(searchTerm.trim()); searchTerm = ''; render(); } else if (e.key === 'Backspace' && !searchTerm && searchTags.length > 0) { searchTags.pop(); render(); } });
      input.focus(); input.setSelectionRange(input.value.length, input.value.length);
      var clearBtn = container.querySelector('#clearAll'); if (clearBtn) clearBtn.addEventListener('click', function() { searchTerm = ''; searchTags = []; selectedNode = null; upstream = []; downstream = []; showFieldsPanel = null; render(); });
      container.querySelectorAll('.remove-tag').forEach(function(btn) { btn.addEventListener('click', function(e) { e.stopPropagation(); searchTags.splice(parseInt(btn.parentElement.dataset.idx), 1); render(); }); });
      container.querySelectorAll('.tab-btn').forEach(function(btn) { btn.addEventListener('click', function() { activeTab = btn.dataset.tab; render(); }); });
      if (activeTab === 'lineage') attachLineageEvents();
      container.querySelectorAll('.dup-header').forEach(function(h) { h.addEventListener('click', function() { var idx = parseInt(h.parentElement.dataset.idx); expandedDuplicates[idx] = !expandedDuplicates[idx]; var tc = container.querySelector('#tab-content'); if (tc) { tc.innerHTML = renderDuplicatesTab(); container.querySelectorAll('.dup-header').forEach(function(h2) { h2.addEventListener('click', arguments.callee); }); } }); });
    }
    render(); done();
  }
});

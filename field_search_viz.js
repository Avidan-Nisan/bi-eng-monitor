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
    
    Object.keys(views).forEach(function(k) { 
      var tableSources = Object.keys(viewToTables[k] || {});
      var viewSources = Object.keys(viewToViews[k] || {});
      views[k].sources = tableSources.concat(viewSources);
    });
    Object.keys(explores).forEach(function(k) { explores[k].sources = Object.keys(exploreToViews[k] || {}); });
    Object.keys(dashboards).forEach(function(k) { dashboards[k].sources = Object.keys(dashToExplores[k] || {}); });
    
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
          var termMatched = false, bestFieldScore = 0, bestFieldForTerm = null, termTokens = tokenize(term);
          var ns = smartMatch(entity.name, term, true); if (ns >= 35) { termMatched = true; nameScore = Math.max(nameScore, ns); }
          var tableContextMatch = false, matchedTable = null;
          if (entity.sqlTables && entity.sqlTables.length > 0) { entity.sqlTables.forEach(function(tbl) { var ts = smartMatch(tbl, term, true); if (ts >= 35) { tableContextMatch = true; matchedTable = tbl; tableMatches.push({ table: tbl, term: term, score: ts }); } }); }
          if (entity.fields && entity.fields.length > 0) {
            entity.fields.forEach(function(field) {
              var fs = smartMatch(field, term, true);
              if (fs < 35 && tableContextMatch && termTokens.length > 1) { var fieldTokens = tokenize(field); if (termTokens.some(function(tt) { return fieldTokens.some(function(ft) { return ft === tt || ft.indexOf(tt) !== -1 || tt.indexOf(ft) !== -1; }); })) fs = 70; }
              if (fs >= 35) { termMatched = true; if (fs > bestFieldScore) { bestFieldScore = fs; bestFieldForTerm = field; } var existing = fieldMatches.find(function(fm) { return fm.field === field; }); if (!existing) fieldMatches.push({ field: field, score: fs, matchedTerms: [term], tableContext: tableContextMatch ? matchedTable : null }); else if (existing.matchedTerms.indexOf(term) === -1) { existing.matchedTerms.push(term); existing.score = Math.max(existing.score, fs); } }
            });
          }
          if (!termMatched && tableContextMatch) { termMatched = true; bestFieldScore = 50; }
          if (termMatched) { matchedTerms++; totalScore += Math.max(nameScore, bestFieldScore); }
        });
        if (matchedTerms === terms.length) { fieldMatches.sort(function(a, b) { return b.score - a.score; }); matches.push({ entity: entity, score: totalScore / terms.length + Math.min(fieldMatches.length * 2, 10), nameMatch: nameScore >= 35, fieldMatches: fieldMatches.map(function(fm) { return fm.field; }), fieldScores: fieldMatches, tableMatches: tableMatches, totalTerms: terms.length }); }
      });
      return matches.sort(function(a, b) { return b.fieldMatches.length !== a.fieldMatches.length ? b.fieldMatches.length - a.fieldMatches.length : b.score - a.score; });
    }
    
    function getUpstream(id, depth, visited) { 
      if (depth > 15) return []; 
      if (!visited) visited = {};
      if (visited[id]) return [];
      visited[id] = true;
      var e = allEntities.find(function(x) { return x.id === id; }); 
      if (!e || !e.sources) return []; 
      var r = []; 
      e.sources.forEach(function(s) { 
        if (!visited[s]) {
          r.push(s); 
          r = r.concat(getUpstream(s, (depth||0)+1, visited)); 
        }
      }); 
      return r.filter(function(v,i,a) { return a.indexOf(v)===i; }); 
    }
    function getDownstream(id, depth, visited) { 
      if (depth > 15) return []; 
      if (!visited) visited = {};
      if (visited[id]) return [];
      visited[id] = true;
      var r = []; 
      allEntities.forEach(function(e) { 
        if (e.sources && e.sources.indexOf(id) !== -1 && !visited[e.id]) { 
          r.push(e.id); 
          r = r.concat(getDownstream(e.id, (depth||0)+1, visited)); 
        } 
      }); 
      return r.filter(function(v,i,a) { return a.indexOf(v)===i; }); 
    }
    
    // Enhanced prefix stripping for field comparison
    var knownPrefixes = [
      // Data layer prefixes
      'dics', 'hics', 'dim', 'fct', 'fact', 'stg', 'raw', 'src', 'tgt', 'tmp', 'temp',
      // View/table prefixes  
      'v', 'vw', 'tb', 'tbl', 'f', 'd',
      // Key prefixes
      'pk', 'fk', 'sk', 'bk', 'nk',
      // Business domain prefixes (common 3-4 letter codes)
      'facm', 'fasg', 'fasm', 'facd', 'falm', 'farm', 'facs', 'fadm',
      'dicm', 'disg', 'dism', 'dicd', 'dilm', 'dirm', 'dics', 'didm',
      'hicm', 'hisg', 'hism', 'hicd', 'hilm', 'hirm', 'hics', 'hidm',
      // Generic business prefixes
      'crm', 'erp', 'fin', 'hr', 'mkt', 'ops', 'prd', 'sal', 'inv',
      'cust', 'prod', 'ord', 'pay', 'ship', 'ret', 'ref',
      // Numbered/versioned prefixes
      'v1', 'v2', 'v3', 'ver1', 'ver2'
    ];
    
    function stripPrefixes(fieldName) {
      if (!fieldName) return '';
      var lower = fieldName.toLowerCase();
      var tokens = lower.split(/[_\-\.]+/);
      
      // Remove known prefixes from the beginning
      while (tokens.length > 1) {
        var first = tokens[0];
        // Check if first token is a known prefix OR matches pattern like 4-letter code
        var isPrefix = knownPrefixes.indexOf(first) !== -1 || 
                       /^[a-z]{2,4}$/.test(first) && tokens.length > 2;
        if (isPrefix) {
          tokens.shift();
        } else {
          break;
        }
      }
      return tokens.join('_');
    }
    
    function getFieldCore(fieldName) {
      // Get the semantic core of a field name
      var stripped = stripPrefixes(fieldName);
      // Also normalize common variations
      return stripped
        .replace(/[_\-\s\.]+/g, '')  // Remove separators
        .replace(/id$/i, '')          // Remove trailing 'id'
        .replace(/key$/i, '')         // Remove trailing 'key'
        .replace(/code$/i, '')        // Remove trailing 'code'
        .replace(/num$/i, '')         // Remove trailing 'num'
        .replace(/no$/i, '');         // Remove trailing 'no'
    }
    
    function fieldsSimilar(f1, f2) {
      if (!f1 || !f2) return { match: false, score: 0 };
      if (f1 === f2) return { match: true, score: 100, reason: 'exact' };
      
      var n1 = normalize(f1), n2 = normalize(f2);
      if (n1 === n2) return { match: true, score: 98, reason: 'normalized exact' };
      
      // Strip prefixes and compare cores
      var core1 = getFieldCore(f1), core2 = getFieldCore(f2);
      var stripped1 = stripPrefixes(f1), stripped2 = stripPrefixes(f2);
      
      // Core match after stripping prefixes (e.g., facm_gross_revenue vs fasg_gross_revenue)
      if (core1 === core2 && core1.length >= 3) {
        return { match: true, score: 95, reason: 'same core: ' + core1 };
      }
      
      // Stripped match (keeping underscores)
      if (stripped1 === stripped2 && stripped1.length >= 3) {
        return { match: true, score: 93, reason: 'same after prefix strip' };
      }
      
      // One contains the other after stripping
      if (core1.length >= 4 && core2.length >= 4) {
        if (core1.indexOf(core2) !== -1 || core2.indexOf(core1) !== -1) {
          return { match: true, score: 88, reason: 'core contains' };
        }
      }
      
      // Token-based comparison on stripped fields
      var t1 = tokenize(stripped1), t2 = tokenize(stripped2);
      var t1c = t1.filter(function(t) { return t.length > 1; });
      var t2c = t2.filter(function(t) { return t.length > 1; });
      
      if (t1c.length > 0 && t2c.length > 0) {
        // Check if tokens match after stripping
        if (t1c.join('') === t2c.join('')) {
          return { match: true, score: 90, reason: 'tokens match' };
        }
        
        // Count common tokens
        var common = t1c.filter(function(t) { 
          return t2c.some(function(t2t) { 
            return t === t2t || 
                   (t.length > 3 && t2t.length > 3 && (t.indexOf(t2t) !== -1 || t2t.indexOf(t) !== -1));
          }); 
        });
        
        var overlap = common.length / Math.max(t1c.length, t2c.length);
        if (common.length >= 2 || (common.length >= 1 && overlap >= 0.5)) {
          return { match: true, score: Math.round(75 + overlap * 15), reason: common.length + ' common tokens' };
        }
      }
      
      // Levenshtein on cores
      var maxLen = Math.max(core1.length, core2.length);
      if (maxLen > 3 && maxLen < 30) {
        var dist = levenshtein(core1, core2);
        var sim = 1 - dist / maxLen;
        if (sim >= 0.75) {
          return { match: true, score: Math.round(sim * 85), reason: 'fuzzy match ' + Math.round(sim*100) + '%' };
        }
      }
      
      // Last token match (often the most meaningful part)
      if (t1.length > 0 && t2.length > 0) {
        var last1 = t1[t1.length-1], last2 = t2[t2.length-1];
        if (last1 === last2 && last1.length > 3) {
          return { match: true, score: 65, reason: 'same suffix: ' + last1 };
        }
      }
      
      return { match: false, score: 0 };
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
            var best = null, bestScore = 0; 
            v2.fields.forEach(function(f2) { 
              if (m2[f2]) return; 
              var r = fieldsSimilar(f1, f2); 
              if (r.match && r.score > bestScore) { 
                bestScore = r.score; 
                best = { f1: f1, f2: f2, score: r.score, reason: r.reason }; 
              } 
            }); 
            if (best) { 
              pairs.push(best); 
              m1[best.f1] = true; 
              m2[best.f2] = true; 
            } 
          });
          var sim = pairs.length / Math.min(v1.fields.length, v2.fields.length);
          if (pairs.length >= 1 && sim >= 0.2) duplicates.push({ views: [v1, v2], matchedPairs: pairs, commonCount: pairs.length, similarity: Math.round(sim * 100) });
        }
      }
      return duplicates.sort(function(a, b) { return b.similarity - a.similarity; });
    }
    
    function renderDuplicatesTab() {
      var dups = findDuplicates(), vF = Object.values(views).filter(function(v) { return v.fields && v.fields.length > 0; }).length, eF = Object.values(explores).filter(function(e) { return e.fields && e.fields.length > 0; }).length, dF = Object.values(dashboards).filter(function(d) { return d.fields && d.fields.length > 0; }).length, tot = vF + eF + dF;
      var html = '<div style="padding:20px 24px;border-bottom:1px solid #1e293b;"><div style="color:#e2e8f0;font-size:14px;font-weight:500;">Find Similar Entities</div><div style="color:#64748b;font-size:12px;margin-top:4px;">Comparing '+tot+' entities with semantic field matching (prefix-aware)</div></div>';
      if (dups.length === 0) { html += '<div style="text-align:center;padding:60px 40px;"><div style="font-size:48px;margin-bottom:16px;">🔍</div><div style="color:#e2e8f0;font-size:16px;margin-bottom:8px;">No Similar Entities Found</div><div style="color:#64748b;font-size:13px;">Entities need at least 20% field overlap to be considered similar.</div></div>'; }
      else { 
        html += '<div style="padding:12px 24px;border-bottom:1px solid #1e293b;background:#f9731615;font-size:13px;color:#f97316;">Found '+dups.length+' pair(s) of similar entities</div><div style="max-height:450px;overflow-y:auto;">'; 
        dups.forEach(function(dup, idx) { 
          var isExp = expandedDuplicates[idx], v1 = dup.views[0], v2 = dup.views[1], c1 = typeConfig[v1.type] ? typeConfig[v1.type].color : '#8b5cf6', c2 = typeConfig[v2.type] ? typeConfig[v2.type].color : '#8b5cf6'; 
          html += '<div class="dup-row" data-idx="'+idx+'" style="border-bottom:1px solid #1e293b;"><div class="dup-header" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;"><span style="color:#64748b;">'+(isExp?icons.chevronDown:icons.chevronRight)+'</span><div style="flex:1;display:flex;align-items:center;gap:12px;"><div style="flex:1;"><div style="color:'+c1+';font-size:13px;">'+v1.name+'</div><div style="font-size:10px;color:#64748b;margin-top:2px;">'+v1.type.toUpperCase()+' • '+v1.fields.length+' fields</div></div><div style="color:#64748b;font-size:20px;">↔</div><div style="flex:1;"><div style="color:'+c2+';font-size:13px;">'+v2.name+'</div><div style="font-size:10px;color:#64748b;margin-top:2px;">'+v2.type.toUpperCase()+' • '+v2.fields.length+' fields</div></div></div><div style="text-align:center;"><div style="background:#f9731622;border:1px solid #f97316;padding:4px 10px;border-radius:12px;font-size:11px;color:#f97316;font-weight:600;">'+dup.similarity+'%</div><div style="font-size:9px;color:#64748b;margin-top:2px;">'+dup.commonCount+' matches</div></div></div>'; 
          if (isExp) { 
            html += '<div style="padding:0 16px 16px 44px;background:#0c1222;"><div style="font-size:11px;color:#64748b;margin-bottom:8px;">'+dup.matchedPairs.length+' Matched Field Pairs</div><div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;">'; 
            dup.matchedPairs.forEach(function(p) { 
              var ex = p.f1 === p.f2, col = ex ? '#10b981' : p.score >= 90 ? '#22d3ee' : '#f59e0b'; 
              var reasonText = p.reason ? '<span style="font-size:8px;color:#64748b;margin-left:4px;">'+p.reason+'</span>' : '';
              html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#1e293b;border-radius:6px;"><span style="flex:1;font-size:11px;color:#e2e8f0;font-family:monospace;word-break:break-all;">'+p.f1+'</span><span style="color:'+col+';font-size:12px;flex-shrink:0;">'+(ex?'=':'≈')+'</span><span style="flex:1;font-size:11px;color:#e2e8f0;font-family:monospace;word-break:break-all;">'+p.f2+'</span><span style="font-size:9px;color:#64748b;background:#334155;padding:2px 6px;border-radius:4px;flex-shrink:0;">'+p.score+'%'+reasonText+'</span></div>'; 
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
      var byType = { table: [], view: [], explore: [], dashboard: [] }; visibleEntities.forEach(function(e) { byType[e.type].push(e); }); ['table','view','explore','dashboard'].forEach(function(t) { byType[t].sort(function(a,b) { return a.name.localeCompare(b.name); }); });
      var nodeW = 280, nodeH = 46, nodeSpacing = 54, padding = 20, svgWidth = Math.max(containerWidth - 30, 1250), colSpacing = (svgWidth - padding * 2 - nodeW) / 3;
      var colX = { table: padding, view: padding + colSpacing, explore: padding + colSpacing * 2, dashboard: padding + colSpacing * 3 }, positions = {}, startY = 75;
      ['table','view','explore','dashboard'].forEach(function(type) { byType[type].forEach(function(e, idx) { positions[e.id] = { x: colX[type], y: startY + idx * nodeSpacing }; }); });
      var maxCount = Math.max(byType.table.length||1, byType.view.length||1, byType.explore.length||1, byType.dashboard.length||1), svgHeight = Math.max(maxCount * nodeSpacing + 110, 350);
      var edgesHtml = ''; visibleEntities.forEach(function(e) { (e.sources||[]).forEach(function(s) { var f = positions[s], t = positions[e.id]; if (!f || !t) return; var stroke = '#334155', op = 0.25, sw = 1.5; if (selectedNode) { var isUp = upstream.indexOf(s)!==-1 && (upstream.indexOf(e.id)!==-1 || e.id===selectedNode.id), isDown = downstream.indexOf(e.id)!==-1 && (downstream.indexOf(s)!==-1 || s===selectedNode.id); if (s===selectedNode.id || isDown) { stroke='#f97316'; op=0.9; sw=2.5; } else if (e.id===selectedNode.id || isUp) { stroke='#06b6d4'; op=0.9; sw=2.5; } } else if (filterMode === 'search') { stroke='#10b981'; op=0.6; sw=2; } var x1=f.x+nodeW, y1=f.y+nodeH/2, x2=t.x, y2=t.y+nodeH/2, mx=(x1+x2)/2; if (op > 0.5) edgesHtml += '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="8" stroke-opacity="0.15" filter="url(#glow)"/>'; edgesHtml += '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-opacity="'+op+'" marker-end="url(#arrow'+(stroke==='#06b6d4'?'Cyan':stroke==='#f97316'?'Orange':stroke==='#10b981'?'Green':'Gray')+')"/>'; }); });
      var nodesHtml = ''; visibleEntities.forEach(function(entity) { var pos = positions[entity.id], cfg = typeConfig[entity.type], isSel = selectedNode && selectedNode.id === entity.id, isUp = selectedNode && upstream.indexOf(entity.id) !== -1, isDown = selectedNode && downstream.indexOf(entity.id) !== -1, isMatch = highlightedEntities.indexOf(entity.id) !== -1 && !selectedNode; var borderColor = cfg.color, borderWidth = 1, glowHtml = ''; if (isSel) { borderColor = '#ffffff'; borderWidth = 2; glowHtml = '<rect x="-4" y="-4" width="'+(nodeW+8)+'" height="'+(nodeH+8)+'" rx="12" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.4" filter="url(#glow)"/>'; } else if (isUp) { borderColor = '#06b6d4'; borderWidth = 2; glowHtml = '<rect x="-3" y="-3" width="'+(nodeW+6)+'" height="'+(nodeH+6)+'" rx="11" fill="none" stroke="#06b6d4" stroke-width="1" stroke-opacity="0.4" filter="url(#glow)"/>'; } else if (isDown) { borderColor = '#f97316'; borderWidth = 2; glowHtml = '<rect x="-3" y="-3" width="'+(nodeW+6)+'" height="'+(nodeH+6)+'" rx="11" fill="none" stroke="#f97316" stroke-width="1" stroke-opacity="0.4" filter="url(#glow)"/>'; } else if (isMatch) { borderColor = '#10b981'; borderWidth = 2; glowHtml = '<rect x="-3" y="-3" width="'+(nodeW+6)+'" height="'+(nodeH+6)+'" rx="11" fill="none" stroke="#10b981" stroke-width="1" stroke-opacity="0.5" filter="url(#glow)"/>'; } var nm = entity.name.length > 32 ? entity.name.substring(0,31)+'…' : entity.name, fc = entity.fields ? entity.fields.length : 0, subText = '<text x="48" y="'+(nodeH/2+12)+'" fill="'+cfg.color+'" font-size="9" opacity="0.7">'+entity.type.toUpperCase()+' • '+fc+' fields</text>'; if (isMatch) { var m = searchMatches.find(function(x) { return x.entity.id === entity.id; }); if (m && m.fieldMatches.length > 0) subText = '<text x="48" y="'+(nodeH/2+12)+'" fill="#10b981" font-size="9">'+m.fieldMatches.length+' matched ('+fc+' total)</text>'; } var fieldsBtn = fc > 0 ? '<g class="fields-btn" data-id="'+entity.id+'" transform="translate('+(nodeW-28)+',13)" style="cursor:pointer;"><rect width="20" height="20" rx="5" fill="#10b981" fill-opacity="0.3" stroke="#10b981" stroke-width="1"/><g transform="translate(3,3)" fill="#10b981">'+icons.list+'</g></g>' : ''; nodesHtml += '<g class="node" data-id="'+entity.id+'" data-name="'+entity.name.replace(/"/g,'&quot;')+'" style="cursor:pointer;" transform="translate('+pos.x+','+pos.y+')"><title>'+entity.name+' (right-click to copy)</title>'+glowHtml+'<rect width="'+nodeW+'" height="'+nodeH+'" rx="10" fill="#0f172a" fill-opacity="0.95" stroke="'+borderColor+'" stroke-width="'+borderWidth+'"/><rect x="1" y="1" width="40" height="'+(nodeH-2)+'" rx="9" fill="'+cfg.color+'" fill-opacity="0.15"/><g transform="translate(13,'+(nodeH/2-7)+')" fill="'+cfg.color+'">'+typeIcons[entity.type]+'</g><text x="48" y="'+(nodeH/2)+'" fill="#e2e8f0" font-size="11" font-weight="500">'+nm+'</text>'+subText+fieldsBtn+'</g>'; });
      var hdrHtml = ''; ['table','view','explore','dashboard'].forEach(function(type) { var cfg = typeConfig[type]; hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="28" text-anchor="middle" fill="'+cfg.color+'" font-size="10" font-weight="600" letter-spacing="0.5">'+cfg.label.toUpperCase()+'</text><text x="'+(colX[type]+nodeW/2)+'" y="42" text-anchor="middle" fill="#475569" font-size="9">'+byType[type].length+' items</text><line x1="'+(colX[type]+nodeW/2)+'" y1="52" x2="'+(colX[type]+nodeW/2)+'" y2="'+(svgHeight-15)+'" stroke="'+cfg.color+'" stroke-opacity="0.08" stroke-width="1" stroke-dasharray="4,4"/>'; });
      var statsText = ''; if (selectedNode) statsText = '<span style="color:'+typeConfig[selectedNode.type].color+';font-weight:500;">'+selectedNode.name+'</span><span style="color:#06b6d4;margin-left:14px;">▲ '+upstream.length+'</span><span style="color:#f97316;margin-left:10px;">▼ '+downstream.length+'</span>'; else if ((searchTags.length > 0 || searchTerm.trim()) && highlightedEntities.length > 0) statsText = '<span style="color:#10b981;font-weight:500;">'+highlightedEntities.length+' matches</span>'; else if (searchTags.length > 0 || searchTerm.trim()) statsText = '<span style="color:#ef4444;">No matches found</span>'; else statsText = '<span style="color:#64748b;">Click node to trace lineage</span>';
      var fieldsPanelHtml = ''; if (showFieldsPanel) { var pe = allEntities.find(function(e) { return e.id === showFieldsPanel; }); if (pe) { var hF = pe.fields && pe.fields.length > 0, hT = pe.sqlTables && pe.sqlTables.length > 0, sF = hF ? pe.fields.slice().sort() : [], md = searchMatches.find(function(m) { return m.entity.id === pe.id; }); var tablesHtml = ''; if (hT) { var tm = md ? md.tableMatches : []; tablesHtml = '<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #334155;"><div style="font-size:10px;color:#64748b;margin-bottom:6px;">SQL TABLES ('+pe.sqlTables.length+')</div><div style="display:flex;flex-wrap:wrap;gap:4px;">'+pe.sqlTables.map(function(tbl) { var tM = tm.find(function(x) { return x.table === tbl; }), isM = tM != null; return '<span style="background:'+(isM?'#06b6d425':'#0f172a')+';border:1px solid '+(isM?'#06b6d4':'#334155')+';padding:4px 8px;border-radius:4px;font-size:10px;color:'+(isM?'#67e8f9':'#94a3b8')+';font-family:monospace;">'+tbl+'</span>'; }).join('')+'</div></div>'; } var fieldsHtml = hF ? '<div style="font-size:10px;color:#64748b;margin-bottom:6px;">FIELDS ('+sF.length+')</div><div style="display:flex;flex-wrap:wrap;gap:6px;">'+sF.map(function(f) { var mi = md ? md.fieldScores.find(function(fs) { return fs.field === f; }) : null, isM = mi != null; return '<span style="background:'+(isM?'#10b98125':'#0f172a')+';border:1px solid '+(isM?'#10b981':'#334155')+';padding:5px 10px;border-radius:6px;font-size:11px;color:'+(isM?'#6ee7b7':'#e2e8f0')+';">'+f+(isM && mi.matchedTerms ? ' <span style="font-size:9px;opacity:0.7;">('+mi.matchedTerms.join(', ')+')</span>' : '')+'</span>'; }).join('')+'</div>' : '<div style="color:#64748b;font-size:12px;text-align:center;padding:20px;">No fields available</div>'; fieldsPanelHtml = '<div id="fields-panel" style="position:absolute;top:60px;right:20px;width:340px;max-height:500px;background:#1e293b;border:1px solid #475569;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.5);z-index:100;overflow:hidden;"><div style="padding:14px 18px;border-bottom:1px solid #334155;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#1e293b,#334155);"><div><div style="color:'+typeConfig[pe.type].color+';font-size:14px;font-weight:600;">'+pe.name+'</div><div style="color:#94a3b8;font-size:11px;margin-top:3px;">'+(hF?pe.fields.length+' fields':'')+(hT?(hF?' • ':'')+pe.sqlTables.length+' table(s)':'')+'</div></div><span id="close-panel" style="color:#94a3b8;cursor:pointer;padding:6px;border-radius:6px;background:#334155;">'+icons.x+'</span></div><div style="padding:14px 18px;max-height:400px;overflow-y:auto;">'+tablesHtml+fieldsHtml+'</div></div>'; } }
      return '<div style="position:relative;"><div style="padding:12px 24px;border-bottom:1px solid #1e293b;font-size:12px;display:flex;justify-content:space-between;align-items:center;"><div>'+statsText+'</div><div style="color:#64748b;font-size:11px;">'+(filterMode?visibleEntities.length+' of ':'')+allEntities.length+' entities</div></div><div style="padding:15px;overflow:auto;"><svg width="'+svgWidth+'" height="'+svgHeight+'" style="font-family:system-ui,sans-serif;"><defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><marker id="arrowGray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#334155"/></marker><marker id="arrowCyan" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#06b6d4"/></marker><marker id="arrowOrange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#f97316"/></marker><marker id="arrowGreen" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#10b981"/></marker></defs>'+hdrHtml+edgesHtml+nodesHtml+'</svg></div>'+fieldsPanelHtml+'</div>';
    }
    
    function attachLineageEvents() { container.querySelectorAll('.node').forEach(function(n) { n.addEventListener('contextmenu', function(e) { e.preventDefault(); var name = n.dataset.name; if (name && navigator.clipboard) navigator.clipboard.writeText(name).then(function() { var r = n.querySelector('rect'); if (r) { var o = r.getAttribute('stroke'); r.setAttribute('stroke', '#10b981'); setTimeout(function() { r.setAttribute('stroke', o); }, 300); } }); }); n.addEventListener('click', function(e) { var id = n.dataset.id, entity = allEntities.find(function(x) { return x.id === id; }); if (e.target.closest('.fields-btn')) { showFieldsPanel = showFieldsPanel === id ? null : id; var tc = container.querySelector('#tab-content'); if (tc && activeTab === 'lineage') { tc.innerHTML = renderLineageTab(); attachLineageEvents(); } return; } if (selectedNode && selectedNode.id === id) { selectedNode = null; upstream = []; downstream = []; showFieldsPanel = null; } else { selectedNode = entity; searchTerm = ''; searchTags = []; showFieldsPanel = id; } render(); }); }); var cp = container.querySelector('#close-panel'); if (cp) cp.addEventListener('click', function(e) { e.stopPropagation(); showFieldsPanel = null; var tc = container.querySelector('#tab-content'); if (tc && activeTab === 'lineage') { tc.innerHTML = renderLineageTab(); attachLineageEvents(); } }); }
    
    function render() {
      var logo = '<img src="https://avidan-nisan.github.io/bi-eng-monitor/logo.png" width="40" height="40" style="border-radius:8px;" onerror="this.style.display=\'none\'"/>';
      var tagsHtml = searchTags.map(function(tag, i) { return '<span class="search-tag" data-idx="'+i+'" style="display:inline-flex;align-items:center;gap:6px;background:#10b98125;border:1px solid #10b981;padding:6px 10px 6px 12px;border-radius:8px;font-size:12px;color:#6ee7b7;font-weight:500;"><span style="opacity:0.6;font-size:10px;">'+(i+1)+'.</span> '+tag+'<span class="remove-tag" style="cursor:pointer;opacity:0.7;padding:2px;">'+icons.x+'</span></span>'; }).join('');
      var hasSearch = searchTags.length > 0 || searchTerm.trim();
      container.innerHTML = '<div style="background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);min-height:600px;"><div style="padding:14px 24px;border-bottom:1px solid #1e293b;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div style="display:flex;align-items:center;gap:12px;">'+logo+'<div><div style="font-weight:600;color:#f1f5f9;font-size:16px;">Asset Manager</div><div style="font-size:10px;color:#64748b;">'+allRows.length+' assets</div></div></div><div style="display:flex;border-bottom:2px solid #334155;"><button class="tab-btn" data-tab="lineage" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;font-weight:500;background:transparent;border-bottom:2px solid '+(activeTab==='lineage'?'#10b981':'transparent')+';margin-bottom:-2px;color:'+(activeTab==='lineage'?'#10b981':'#64748b')+';">'+icons.lineage+' Data Lineage</button><button class="tab-btn" data-tab="duplicates" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;font-weight:500;background:transparent;border-bottom:2px solid '+(activeTab==='duplicates'?'#f97316':'transparent')+';margin-bottom:-2px;color:'+(activeTab==='duplicates'?'#f97316':'#64748b')+';">'+icons.duplicate+' Similar Views</button></div></div><div style="background:linear-gradient(135deg,#1e293b,#334155);border:1px solid #475569;border-radius:12px;padding:16px;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:'+(searchTags.length?'12px':'0')+';"><span style="color:#10b981;display:flex;align-items:center;gap:4px;">'+icons.ai+icons.search+'</span><input id="searchInput" type="text" value="'+searchTerm+'" placeholder="Search fields: use comma to separate multiple terms..." autocomplete="off" spellcheck="false" style="flex:1;background:transparent;border:none;color:#e2e8f0;font-size:14px;outline:none;"/>'+(hasSearch||selectedNode?'<span id="clearAll" style="color:#64748b;

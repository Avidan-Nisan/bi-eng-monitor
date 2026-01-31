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
    var tableField = fields.find(function(f) { return f.toLowerCase().indexOf('sql_table') !== -1 && f.toLowerCase().indexOf('fields') === -1 && f.toLowerCase().indexOf('path') === -1; });
    var extendedViewField = fields.find(function(f) { return f.toLowerCase().indexOf('extended') !== -1 && f.toLowerCase().indexOf('view') !== -1; });
    var includedViewField = fields.find(function(f) { return f.toLowerCase().indexOf('included') !== -1 && f.toLowerCase().indexOf('view') !== -1; });
    
    var fieldsField = null;
    for (var i = 0; i < fields.length; i++) {
      var fl = fields[i].toLowerCase();
      if (fl.indexOf('falm_sql_table_fields') !== -1 || fl.indexOf('sql_table_fields') !== -1) { fieldsField = fields[i]; break; }
    }
    
    var allRows = data.map(function(row) {
      var fieldsVal = fieldsField && row[fieldsField] ? row[fieldsField].value || '' : '';
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
    var activeTab = 'lineage', searchTerm = '', searchTags = [], selectedNode = null, upstream = [], downstream = [], highlightedEntities = [], expandedDuplicates = {};
    var similarResults = null, analysisLoading = false, analysisError = null;
    
    var icons = { search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>', x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', lineage: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l4-6h2M11 12l4 6h2"/></svg>', duplicate: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/></svg>', chevronDown: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>', chevronRight: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' };
    var typeIcons = { table: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="9" width="8" height="3"/><rect x="13" y="9" width="8" height="3"/><rect x="3" y="14" width="8" height="3"/><rect x="13" y="14" width="8" height="3"/></svg>', view: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7z"/></svg>', explore: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>', dashboard: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="2" y="2" width="9" height="6" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="10" width="9" height="12" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>' };
    var typeConfig = { table: { color: '#06b6d4', label: 'SQL Tables' }, view: { color: '#8b5cf6', label: 'Views' }, explore: { color: '#ec4899', label: 'Explores' }, dashboard: { color: '#f97316', label: 'Dashboards' } };

    // === ENHANCED SEARCH AGENT ===
    function normalize(str) { return str ? str.toLowerCase().replace(/[_\-\s\.]+/g, '') : ''; }
    function tokenize(str) { if (!str) return []; var tokens = str.toLowerCase().split(/[_\-\s\.]+/).filter(function(t) { return t.length > 0; }); var camelSplit = str.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/); return tokens.concat(camelSplit).filter(function(v, i, a) { return a.indexOf(v) === i && v.length > 0; }); }
    function levenshtein(a, b) { if (!a || !b) return Math.max((a||'').length, (b||'').length); var m = a.length, n = b.length; if (m === 0) return n; if (n === 0) return m; var d = []; for (var i = 0; i <= m; i++) d[i] = [i]; for (var j = 0; j <= n; j++) d[0][j] = j; for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) { var cost = a[i-1] === b[j-1] ? 0 : 1; d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + cost); } return d[m][n]; }
    
    var synonyms = { 'campaign': ['cmpgn', 'camp', 'cmp'], 'name': ['nm', 'title', 'label'], 'date': ['dt', 'time', 'timestamp', 'ts'], 'number': ['num', 'no', 'nr', 'count', 'cnt'], 'amount': ['amt', 'value', 'val'], 'customer': ['cust', 'client', 'user'], 'product': ['prod', 'item', 'sku'], 'order': ['ord', 'purchase'], 'identifier': ['id', 'key', 'code'], 'description': ['desc', 'descr'], 'quantity': ['qty', 'qnty'], 'category': ['cat', 'catg', 'type'], 'status': ['stat', 'state'], 'revenue': ['rev', 'sales', 'income'], 'transaction': ['trans', 'txn', 'trx'], 'account': ['acct', 'acc'], 'total': ['tot', 'sum', 'ttl'], 'average': ['avg', 'mean'], 'gross': ['total', 'sum', 'ttl'] };
    
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
    // === END SEARCH AGENT ===
    
    function getUpstream(id, depth, visited) { if (depth > 15) return []; if (!visited) visited = {}; if (visited[id]) return []; visited[id] = true; var e = allEntities.find(function(x) { return x.id === id; }); if (!e || !e.sources) return []; var r = []; e.sources.forEach(function(s) { if (!visited[s]) { r.push(s); r = r.concat(getUpstream(s, (depth||0)+1, visited)); } }); return r.filter(function(v,i,a) { return a.indexOf(v)===i; }); }
    function getDownstream(id, depth, visited) { if (depth > 15) return []; if (!visited) visited = {}; if (visited[id]) return []; visited[id] = true; var r = []; allEntities.forEach(function(e) { if (e.sources && e.sources.indexOf(id) !== -1 && !visited[e.id]) { r.push(e.id); r = r.concat(getDownstream(e.id, (depth||0)+1, visited)); } }); return r.filter(function(v,i,a) { return a.indexOf(v)===i; }); }
    
    function findSimilarFields(fields1, fields2) {
      var matches = [];
      fields1.forEach(function(f1) {
        fields2.forEach(function(f2) {
          var score = calculateMatchScore(f1, f2);
          if (score >= 75) matches.push({ f1: f1, f2: f2, exact: f1.toLowerCase() === f2.toLowerCase() });
        });
      });
      return matches;
    }
    
    function runAnalysis() {
      if (analysisLoading) return;
      analysisLoading = true; analysisError = null; render();
      
      setTimeout(function() {
        try {
          var results = [];
          var viewsList = Object.values(views).filter(function(v) { return v.fields && v.fields.length > 0; });
          
          for (var i = 0; i < viewsList.length; i++) {
            for (var j = i + 1; j < viewsList.length; j++) {
              var v1 = viewsList[i], v2 = viewsList[j];
              var sharedTables = v1.sqlTables.filter(function(t) { return v2.sqlTables.indexOf(t) !== -1; });
              var similarFields = findSimilarFields(v1.fields, v2.fields);
              var exactFields = similarFields.filter(function(m) { return m.exact; });
              
              if (sharedTables.length >= 1 || similarFields.length >= 3) {
                var reasons = [];
                if (sharedTables.length > 0) reasons.push({ type: 'tables', count: sharedTables.length, items: sharedTables });
                if (exactFields.length > 0) reasons.push({ type: 'exactFields', count: exactFields.length, items: exactFields.map(function(m) { return m.f1; }) });
                if (similarFields.length > exactFields.length) reasons.push({ type: 'similarFields', count: similarFields.length - exactFields.length, items: similarFields.filter(function(m) { return !m.exact; }) });
                
                var similarity = Math.round((sharedTables.length * 30 + exactFields.length * 5 + (similarFields.length - exactFields.length) * 2) / Math.max(1, Math.min(v1.fields.length, v2.fields.length)) * 10);
                similarity = Math.min(100, similarity);
                
                results.push({ v1: v1.name, v2: v2.name, type: 'view', similarity: similarity, reasons: reasons, sharedTables: sharedTables, similarFields: similarFields });
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
      var viewsCount = Object.values(views).filter(function(v) { return v.fields && v.fields.length > 0; }).length;
      
      var html = '<div style="padding:16px 24px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;"><div style="color:#94a3b8;font-size:13px;">Analyzing <span style="color:#e2e8f0;font-weight:500;">'+viewsCount+'</span> views for similarities</div>'+(similarResults ? '<button id="refreshBtn" style="background:transparent;border:1px solid #475569;padding:6px 12px;border-radius:6px;color:#94a3b8;cursor:pointer;font-size:11px;">↻ Refresh</button>' : '')+'</div>';
      
      if (analysisLoading) {
        html += '<div style="text-align:center;padding:80px 40px;"><div style="color:#8b5cf6;font-size:14px;">Analyzing...</div></div>';
      } else if (analysisError) {
        html += '<div style="text-align:center;padding:80px 40px;color:#ef4444;font-size:14px;">'+analysisError+'</div>';
      } else if (!similarResults || similarResults.length === 0) {
        html += '<div style="text-align:center;padding:80px 40px;"><div style="color:#10b981;font-size:14px;">✓ No similar views found</div><div style="color:#64748b;font-size:12px;margin-top:8px;">Views need shared tables or 3+ similar fields</div></div>';
      } else {
        html += '<div style="max-height:480px;overflow-y:auto;">';
        similarResults.forEach(function(pair, idx) {
          var isExp = expandedDuplicates[idx];
          var reasonSummary = [];
          pair.reasons.forEach(function(r) {
            if (r.type === 'tables') reasonSummary.push(r.count + ' shared table' + (r.count > 1 ? 's' : ''));
            if (r.type === 'exactFields') reasonSummary.push(r.count + ' identical field' + (r.count > 1 ? 's' : ''));
            if (r.type === 'similarFields') reasonSummary.push(r.count + ' similar field' + (r.count > 1 ? 's' : ''));
          });
          
          html += '<div class="dup-row" data-idx="'+idx+'" style="border-bottom:1px solid #1e293b;">';
          html += '<div class="dup-header" style="display:flex;align-items:center;gap:16px;padding:14px 20px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'#1e293b\'" onmouseout="this.style.background=\'transparent\'">';
          html += '<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#8b5cf620,#ec489920);display:flex;align-items:center;justify-content:center;font-size:13px;color:#a78bfa;font-weight:600;">'+pair.similarity+'%</div>';
          html += '<div style="flex:1;min-width:0;">';
          html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span style="color:#e2e8f0;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+pair.v1+'</span><span style="color:#475569;">↔</span><span style="color:#e2e8f0;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+pair.v2+'</span></div>';
          html += '<div style="color:#64748b;font-size:11px;">'+reasonSummary.join(' • ')+'</div>';
          html += '</div>';
          html += '<span style="color:#475569;transition:transform 0.2s;transform:rotate('+(isExp?'180':'0')+'deg);">'+icons.chevronDown+'</span>';
          html += '</div>';
          
          if (isExp) {
            html += '<div style="padding:0 20px 16px 80px;background:#0f172a;">';
            pair.reasons.forEach(function(r) {
              if (r.type === 'tables' && r.items.length > 0) {
                html += '<div style="margin-bottom:12px;"><div style="font-size:10px;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Shared SQL Tables</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
                r.items.forEach(function(t) { html += '<span style="background:#06b6d415;border:1px solid #06b6d450;padding:4px 10px;border-radius:4px;font-size:11px;color:#22d3ee;font-family:monospace;">'+t+'</span>'; });
                html += '</div></div>';
              }
              if (r.type === 'exactFields' && r.items.length > 0) {
                html += '<div style="margin-bottom:12px;"><div style="font-size:10px;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Identical Fields</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
                r.items.forEach(function(f) { html += '<span style="background:#10b98115;border:1px solid #10b98150;padding:4px 10px;border-radius:4px;font-size:11px;color:#6ee7b7;font-family:monospace;">'+f+'</span>'; });
                html += '</div></div>';
              }
              if (r.type === 'similarFields' && r.items.length > 0) {
                html += '<div style="margin-bottom:12px;"><div style="font-size:10px;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Similar Fields</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
                r.items.forEach(function(m) { html += '<span style="background:#f59e0b15;border:1px solid #f59e0b50;padding:4px 10px;border-radius:4px;font-size:11px;color:#fbbf24;font-family:monospace;">'+m.f1+' ≈ '+m.f2+'</span>'; });
                html += '</div></div>';
              }
            });
            html += '</div>';
          }
          html += '</div>';
        });
        html += '</div>';
      }
      return html;
    }
    
    function getSearchMatches() {
      var terms = searchTags.slice(); if (searchTerm.trim()) terms.push(searchTerm.trim()); if (terms.length === 0) return [];
      var matches = [];
      
      allEntities.forEach(function(entity) {
        var matchedTermsCount = 0, fieldMatches = [], nameScore = 0, tableMatches = [];
        
        terms.forEach(function(term) {
          var termMatched = false;
          
          // Check entity name
          var ns = smartMatch(entity.name, term, true);
          if (ns >= 35) { termMatched = true; nameScore = Math.max(nameScore, ns); }
          
          // Check SQL tables
          if (entity.sqlTables && entity.sqlTables.length > 0) {
            entity.sqlTables.forEach(function(tbl) {
              var ts = smartMatch(tbl, term, true);
              if (ts >= 35) { termMatched = true; tableMatches.push({ table: tbl, term: term, score: ts }); }
            });
          }
          
          // Check fields - look for ANY field that matches this term
          if (entity.fields && entity.fields.length > 0) {
            entity.fields.forEach(function(field) {
              var fs = smartMatch(field, term, true);
              if (fs >= 35) {
                termMatched = true;
                var existing = fieldMatches.find(function(fm) { return fm.field === field; });
                if (!existing) fieldMatches.push({ field: field, score: fs, matchedTerms: [term] });
                else if (existing.matchedTerms.indexOf(term) === -1) { existing.matchedTerms.push(term); existing.score = Math.max(existing.score, fs); }
              }
            });
          }
          
          if (termMatched) matchedTermsCount++;
        });
        
        // Include if ALL search terms found a match somewhere in this entity
        if (matchedTermsCount === terms.length) {
          fieldMatches.sort(function(a, b) { return b.score - a.score; });
          var score = nameScore + fieldMatches.length * 5 + tableMatches.length * 3;
          matches.push({ entity: entity, score: score, nameMatch: nameScore >= 35, fieldMatches: fieldMatches.map(function(fm) { return fm.field; }), fieldScores: fieldMatches, tableMatches: tableMatches, totalTerms: terms.length });
        }
      });
      
      return matches.sort(function(a, b) { return b.fieldMatches.length !== a.fieldMatches.length ? b.fieldMatches.length - a.fieldMatches.length : b.score - a.score; });
    }
    
    function renderLineageTab() {
      var searchMatches = getSearchMatches(); 
      highlightedEntities = searchMatches.map(function(m) { return m.entity.id; });
      var visibleEntities = allEntities, filterMode = '';
      
      if (selectedNode) { 
        filterMode = 'lineage'; upstream = getUpstream(selectedNode.id, 0); downstream = getDownstream(selectedNode.id, 0); 
        var ids = [selectedNode.id].concat(upstream).concat(downstream); 
        visibleEntities = allEntities.filter(function(e) { return ids.indexOf(e.id) !== -1; }); 
      } else if (searchTags.length > 0 || searchTerm.trim()) { 
        filterMode = 'search'; 
        visibleEntities = highlightedEntities.length > 0 ? allEntities.filter(function(e) { return highlightedEntities.indexOf(e.id) !== -1; }) : [];
      }
      
      var byType = { table: [], view: [], explore: [], dashboard: [] }; 
      visibleEntities.forEach(function(e) { byType[e.type].push(e); }); 
      ['table','view','explore','dashboard'].forEach(function(t) { byType[t].sort(function(a,b) { return a.name.localeCompare(b.name); }); });
      
      var nodeW = 200, nodeH = 38, nodeSpacing = 46, padding = 15, svgWidth = Math.max(containerWidth - 30, 1100), colSpacing = (svgWidth - padding * 2 - nodeW) / 3;
      var colX = { table: padding, view: padding + colSpacing, explore: padding + colSpacing * 2, dashboard: padding + colSpacing * 3 }, positions = {}, startY = 65;
      ['table','view','explore','dashboard'].forEach(function(type) { byType[type].forEach(function(e, idx) { positions[e.id] = { x: colX[type], y: startY + idx * nodeSpacing }; }); });
      var maxCount = Math.max(byType.table.length||1, byType.view.length||1, byType.explore.length||1, byType.dashboard.length||1), svgHeight = Math.max(maxCount * nodeSpacing + 100, 350);
      
      var edgesHtml = ''; 
      visibleEntities.forEach(function(e) { (e.sources||[]).forEach(function(s) { var f = positions[s], t = positions[e.id]; if (!f || !t) return; var stroke = '#334155', op = 0.25, sw = 1.5; if (selectedNode) { if (s===selectedNode.id || downstream.indexOf(e.id)!==-1) { stroke='#f97316'; op=0.9; sw=2.5; } else if (e.id===selectedNode.id || upstream.indexOf(s)!==-1) { stroke='#06b6d4'; op=0.9; sw=2.5; } } else if (filterMode === 'search') { stroke='#10b981'; op=0.6; sw=2; } var x1=f.x+nodeW, y1=f.y+nodeH/2, x2=t.x, y2=t.y+nodeH/2, mx=(x1+x2)/2; edgesHtml += '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-opacity="'+op+'"/>'; }); });
      
      var nodesHtml = ''; 
      visibleEntities.forEach(function(entity) { var pos = positions[entity.id], cfg = typeConfig[entity.type], isSel = selectedNode && selectedNode.id === entity.id, isUp = selectedNode && upstream.indexOf(entity.id) !== -1, isDown = selectedNode && downstream.indexOf(entity.id) !== -1, isMatch = highlightedEntities.indexOf(entity.id) !== -1 && !selectedNode; var borderColor = cfg.color, borderWidth = 1; if (isSel) { borderColor = '#ffffff'; borderWidth = 2; } else if (isUp) { borderColor = '#06b6d4'; borderWidth = 2; } else if (isDown) { borderColor = '#f97316'; borderWidth = 2; } else if (isMatch) { borderColor = '#10b981'; borderWidth = 2; } var nm = entity.name.length > 26 ? entity.name.substring(0,25)+'…' : entity.name; nodesHtml += '<g class="node" data-id="'+entity.id+'" data-name="'+entity.name.replace(/"/g,'&quot;')+'" style="cursor:pointer;" transform="translate('+pos.x+','+pos.y+')"><rect width="'+nodeW+'" height="'+nodeH+'" rx="8" fill="#0f172a" stroke="'+borderColor+'" stroke-width="'+borderWidth+'"/><rect x="1" y="1" width="32" height="'+(nodeH-2)+'" rx="7" fill="'+cfg.color+'" fill-opacity="0.15"/><g transform="translate(9,'+(nodeH/2-7)+')" fill="'+cfg.color+'">'+typeIcons[entity.type]+'</g><text x="40" y="'+(nodeH/2+4)+'" fill="#e2e8f0" font-size="10" font-weight="500">'+nm+'</text></g>'; });
      
      var hdrHtml = ''; ['table','view','explore','dashboard'].forEach(function(type) { var cfg = typeConfig[type]; hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="22" text-anchor="middle" fill="'+cfg.color+'" font-size="9" font-weight="600">'+cfg.label.toUpperCase()+'</text><text x="'+(colX[type]+nodeW/2)+'" y="36" text-anchor="middle" fill="#475569" font-size="8">'+byType[type].length+' items</text>'; });
      
      var statsText = '';
      if (selectedNode) statsText = '<span style="color:'+typeConfig[selectedNode.type].color+';">'+selectedNode.name+'</span> <span style="color:#06b6d4;">▲'+upstream.length+'</span> <span style="color:#f97316;">▼'+downstream.length+'</span>';
      else if ((searchTags.length > 0 || searchTerm.trim()) && highlightedEntities.length > 0) statsText = '<span style="color:#10b981;">'+highlightedEntities.length+' matches</span>';
      else if (searchTags.length > 0 || searchTerm.trim()) statsText = '<span style="color:#ef4444;">No matches found</span>';
      else statsText = '<span style="color:#64748b;">Click node to trace lineage</span>';
      
      return '<div><div style="padding:10px 20px;border-bottom:1px solid #1e293b;font-size:12px;display:flex;justify-content:space-between;"><div>'+statsText+'</div><div style="color:#64748b;font-size:11px;">'+(filterMode?visibleEntities.length+' of ':'')+allEntities.length+' entities</div></div><div style="padding:12px;overflow:auto;"><svg width="'+svgWidth+'" height="'+svgHeight+'" style="font-family:system-ui,sans-serif;">'+hdrHtml+edgesHtml+nodesHtml+'</svg></div></div>';
    }
    
    function attachEvents() {
      container.querySelectorAll('.node').forEach(function(n) { n.addEventListener('click', function() { var id = n.dataset.id, entity = allEntities.find(function(x) { return x.id === id; }); if (selectedNode && selectedNode.id === id) { selectedNode = null; upstream = []; downstream = []; } else { selectedNode = entity; searchTerm = ''; searchTags = []; } render(); }); });
      var refreshBtn = container.querySelector('#refreshBtn'); if (refreshBtn) refreshBtn.addEventListener('click', function() { runAnalysis(); });
      container.querySelectorAll('.dup-header').forEach(function(h) { h.addEventListener('click', function() { var idx = parseInt(h.parentElement.dataset.idx); expandedDuplicates[idx] = !expandedDuplicates[idx]; var tc = container.querySelector('#tab-content'); if (tc) { tc.innerHTML = renderDuplicatesTab(); attachEvents(); } }); });
    }
    
    function render() {
      var tagsHtml = searchTags.map(function(tag, i) { return '<span class="search-tag" data-idx="'+i+'" style="display:inline-flex;align-items:center;gap:6px;background:#10b98125;border:1px solid #10b981;padding:6px 10px;border-radius:8px;font-size:12px;color:#6ee7b7;"><span style="opacity:0.6;font-size:10px;">'+(i+1)+'.</span> '+tag+'<span class="remove-tag" style="cursor:pointer;padding:2px;">'+icons.x+'</span></span>'; }).join('');
      var hasSearch = searchTags.length > 0 || searchTerm.trim();
      
      container.innerHTML = '<div style="background:#0f172a;min-height:600px;"><div style="padding:14px 24px;border-bottom:1px solid #1e293b;"><div style="display:flex;justify-content:space-between;margin-bottom:14px;"><div><div style="font-weight:600;color:#f1f5f9;font-size:16px;">Asset Manager</div><div style="font-size:10px;color:#64748b;">'+allRows.length+' assets</div></div><div style="display:flex;gap:0;"><button class="tab-btn" data-tab="lineage" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;background:'+(activeTab==='lineage'?'#1e293b':'transparent')+';color:'+(activeTab==='lineage'?'#10b981':'#64748b')+';border-radius:8px 0 0 8px;border:1px solid #334155;">'+icons.lineage+' Lineage</button><button class="tab-btn" data-tab="duplicates" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;background:'+(activeTab==='duplicates'?'#1e293b':'transparent')+';color:'+(activeTab==='duplicates'?'#8b5cf6':'#64748b')+';border-radius:0 8px 8px 0;border:1px solid #334155;border-left:none;">'+icons.duplicate+' Similar Views</button></div></div><div style="background:#1e293b;border:1px solid #475569;border-radius:12px;padding:16px;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:'+(searchTags.length?'12px':'0')+';"><span style="color:#10b981;">'+icons.search+'</span><input id="searchInput" type="text" value="'+searchTerm+'" placeholder="Search fields (comma to add multiple)..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="flex:1;background:transparent;border:none;color:#e2e8f0;font-size:14px;outline:none;"/>'+(hasSearch||selectedNode?'<span id="clearAll" style="color:#64748b;cursor:pointer;padding:6px 10px;border-radius:6px;background:#334155;font-size:11px;">Clear</span>':'')+'</div>'+(searchTags.length?'<div style="display:flex;flex-wrap:wrap;gap:8px;">'+tagsHtml+'</div>':'')+'</div></div><div id="tab-content">'+(activeTab==='lineage'?renderLineageTab():renderDuplicatesTab())+'</div></div>';
      
      var input = container.querySelector('#searchInput');
      input.addEventListener('input', function(e) { var val = e.target.value; if (val.indexOf(',') !== -1) { var parts = val.split(','); for (var i = 0; i < parts.length - 1; i++) { var term = parts[i].trim(); if (term && searchTags.indexOf(term) === -1) searchTags.push(term); } searchTerm = parts[parts.length - 1]; render(); return; } searchTerm = val; selectedNode = null; var tc = container.querySelector('#tab-content'); if (tc && activeTab === 'lineage') { tc.innerHTML = renderLineageTab(); attachEvents(); } });
      input.addEventListener('keydown', function(e) { if (e.key === 'Enter' && searchTerm.trim()) { if (searchTags.indexOf(searchTerm.trim()) === -1) searchTags.push(searchTerm.trim()); searchTerm = ''; render(); } else if (e.key === 'Backspace' && !searchTerm && searchTags.length > 0) { searchTags.pop(); render(); } });
      input.focus();
      
      var clearBtn = container.querySelector('#clearAll'); if (clearBtn) clearBtn.addEventListener('click', function() { searchTerm = ''; searchTags = []; selectedNode = null; render(); });
      container.querySelectorAll('.remove-tag').forEach(function(btn) { btn.addEventListener('click', function(e) { e.stopPropagation(); searchTags.splice(parseInt(btn.parentElement.dataset.idx), 1); render(); }); });
      container.querySelectorAll('.tab-btn').forEach(function(btn) { btn.addEventListener('click', function() { activeTab = btn.dataset.tab; render(); }); });
      attachEvents();
    }
    
    render();
    setTimeout(function() { runAnalysis(); }, 300);
    done();
  }
});

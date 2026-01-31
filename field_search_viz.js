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
    var viewTableMap = {}; // Track which tables each view uses
    
    allRows.forEach(function(row) {
      var tbl = row.table, vw = row.view, exp = row.explore, dash = row.dashboard;
      if (tbl && !tables[tbl]) tables[tbl] = { id: 't_'+tbl, name: tbl, type: 'table', sources: [], fields: [] };
      if (vw && !views[vw]) views[vw] = { id: 'v_'+vw, name: vw, type: 'view', sources: [], fields: [], sqlTables: [] };
      if (exp && !explores[exp]) explores[exp] = { id: 'e_'+exp, name: exp, type: 'explore', sources: [], fields: [], sqlTables: [] };
      if (dash && !dashboards[dash]) dashboards[dash] = { id: 'd_'+dash, name: dash, type: 'dashboard', sources: [], fields: [], sqlTables: [] };
      
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
      chevronRight: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
      ai: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2M7.5 13A2.5 2.5 0 005 15.5 2.5 2.5 0 007.5 18a2.5 2.5 0 002.5-2.5A2.5 2.5 0 007.5 13m9 0a2.5 2.5 0 00-2.5 2.5 2.5 2.5 0 002.5 2.5 2.5 2.5 0 002.5-2.5 2.5 2.5 0 00-2.5-2.5z"/></svg>'
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
    
    // ========== AI-LIKE SMART SEARCH ENGINE ==========
    
    // Normalize text: remove all separators and convert to lowercase
    function normalize(str) {
      if (!str) return '';
      return str.toLowerCase().replace(/[_\-\s\.]+/g, '');
    }
    
    // Tokenize: split into meaningful words
    function tokenize(str) {
      if (!str) return [];
      // Split by common separators
      var tokens = str.toLowerCase().split(/[_\-\s\.]+/).filter(function(t) { return t.length > 0; });
      // Also add camelCase splits
      var camelSplit = str.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/);
      tokens = tokens.concat(camelSplit);
      return tokens.filter(function(v, i, a) { return a.indexOf(v) === i && v.length > 0; });
    }
    
    // Levenshtein distance for fuzzy matching
    function levenshtein(a, b) {
      if (!a || !b) return Math.max((a||'').length, (b||'').length);
      var m = a.length, n = b.length;
      if (m === 0) return n;
      if (n === 0) return m;
      var d = [];
      for (var i = 0; i <= m; i++) { d[i] = [i]; }
      for (var j = 0; j <= n; j++) { d[0][j] = j; }
      for (i = 1; i <= m; i++) {
        for (j = 1; j <= n; j++) {
          var cost = a[i-1] === b[j-1] ? 0 : 1;
          d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + cost);
        }
      }
      return d[m][n];
    }
    
    // Common synonyms/abbreviations in data contexts
    var synonyms = {
      'campaign': ['cmpgn', 'camp', 'cmp'],
      'name': ['nm', 'title', 'label'],
      'date': ['dt', 'time', 'timestamp', 'ts'],
      'number': ['num', 'no', 'nr', 'count', 'cnt'],
      'amount': ['amt', 'value', 'val'],
      'customer': ['cust', 'client', 'user'],
      'product': ['prod', 'item', 'sku'],
      'order': ['ord', 'purchase'],
      'identifier': ['id', 'key', 'code'],
      'description': ['desc', 'descr'],
      'quantity': ['qty', 'qnty'],
      'category': ['cat', 'catg', 'type'],
      'status': ['stat', 'state'],
      'created': ['crtd', 'create'],
      'updated': ['upd', 'update', 'modified'],
      'revenue': ['rev', 'sales'],
      'transaction': ['trans', 'txn', 'trx'],
      'account': ['acct', 'acc'],
      'address': ['addr', 'adr'],
      'phone': ['ph', 'tel', 'telephone'],
      'email': ['mail', 'eml'],
      'first': ['fst', '1st'],
      'last': ['lst', 'final'],
      'total': ['tot', 'sum', 'ttl'],
      'average': ['avg', 'mean'],
      'maximum': ['max', 'highest'],
      'minimum': ['min', 'lowest']
    };
    
    // Expand search term with synonyms
    function expandWithSynonyms(term) {
      var expanded = [term];
      var termLower = term.toLowerCase();
      
      // Check if term matches any synonym key or value
      Object.keys(synonyms).forEach(function(key) {
        if (key === termLower || synonyms[key].indexOf(termLower) !== -1) {
          expanded.push(key);
          expanded = expanded.concat(synonyms[key]);
        }
      });
      
      return expanded.filter(function(v, i, a) { return a.indexOf(v) === i; });
    }
    
    // Calculate match score (0-100)
    function calculateMatchScore(text, searchTerm) {
      if (!text || !searchTerm) return 0;
      
      var textLower = text.toLowerCase();
      var termLower = searchTerm.toLowerCase().trim();
      
      // Remove trailing underscore/separator from search term for matching
      var termClean = termLower.replace(/[_\-\s\.]+$/, '');
      var textNorm = normalize(text);
      var termNorm = normalize(termClean);
      
      // Exact match = 100
      if (textLower === termLower || textLower === termClean) return 100;
      if (textNorm === termNorm) return 98;
      
      // Contains exact term = 90 (including with trailing separator)
      if (textLower.indexOf(termLower) !== -1) return 90;
      if (textLower.indexOf(termClean) !== -1) return 90;
      if (textNorm.indexOf(termNorm) !== -1) return 88;
      
      // Check if text starts with search term (prefix match)
      if (textLower.indexOf(termClean) === 0) return 92;
      if (textNorm.indexOf(termNorm) === 0) return 90;
      
      // Tokenize and check word matches
      var textTokens = tokenize(text);
      var termTokens = tokenize(searchTerm);
      
      // Check if any token starts with search term
      var tokenStartMatch = textTokens.some(function(txtt) {
        return txtt.indexOf(termNorm) === 0 || termNorm.indexOf(txtt) === 0;
      });
      if (tokenStartMatch) return 85;
      
      // All search tokens found in text tokens
      var allTokensFound = termTokens.every(function(tt) {
        return textTokens.some(function(txtt) {
          return txtt.indexOf(tt) !== -1 || tt.indexOf(txtt) !== -1;
        });
      });
      if (allTokensFound && termTokens.length > 0) return 80;
      
      // Check with synonyms
      var expandedTerms = [];
      termTokens.forEach(function(tt) {
        expandedTerms = expandedTerms.concat(expandWithSynonyms(tt));
      });
      
      var synonymMatch = expandedTerms.some(function(et) {
        var etNorm = normalize(et);
        return textNorm.indexOf(etNorm) !== -1 || textTokens.some(function(txtt) {
          return txtt.indexOf(etNorm) !== -1 || etNorm.indexOf(txtt) !== -1;
        });
      });
      if (synonymMatch) return 75;
      
      // Word starts with search term
      var startsWithMatch = textTokens.some(function(txtt) {
        return txtt.indexOf(termNorm) === 0 || termNorm.indexOf(txtt) === 0;
      });
      if (startsWithMatch) return 70;
      
      // Fuzzy match with Levenshtein distance
      var minDist = Infinity;
      textTokens.forEach(function(txtt) {
        termTokens.forEach(function(tt) {
          if (tt.length >= 3) {
            var dist = levenshtein(txtt, tt);
            var maxLen = Math.max(txtt.length, tt.length);
            var normalizedDist = dist / maxLen;
            if (normalizedDist < minDist) minDist = normalizedDist;
          }
        });
      });
      
      // Allow ~25% typo tolerance for words >= 4 chars
      if (minDist <= 0.25) return 60;
      // Allow ~40% typo tolerance
      if (minDist <= 0.4) return 45;
      
      // Partial character sequence match (for abbreviations)
      var charSeqMatch = termNorm.split('').every(function(c, idx) {
        var pos = textNorm.indexOf(c, idx === 0 ? 0 : textNorm.indexOf(termNorm[idx-1]) + 1);
        return pos !== -1;
      });
      if (charSeqMatch && termNorm.length >= 2) return 35;
      
      return 0;
    }
    
    // Main AI-like smart match function
    function smartMatch(text, searchTerm, returnScore) {
      var score = calculateMatchScore(text, searchTerm);
      if (returnScore) return score;
      return score >= 35; // Threshold for match
    }
    
    function getSearchMatches() {
      var terms = searchTags.slice();
      if (searchTerm.trim()) terms.push(searchTerm.trim());
      if (terms.length === 0) return [];
      
      console.log('=== AI SEARCH ===');
      console.log('Terms:', terms);
      
      var matches = [];
      
      allEntities.forEach(function(entity) {
        var totalScore = 0;
        var matchedTerms = 0;
        var fieldMatches = [];
        var termDetails = [];
        var nameScore = 0;
        var tableMatches = []; // Track table name matches
        
        terms.forEach(function(term) {
          var termMatched = false;
          var bestFieldScore = 0;
          var bestFieldForTerm = null;
          var termTokens = tokenize(term);
          
          // Check entity name
          var ns = smartMatch(entity.name, term, true);
          if (ns >= 35) {
            termMatched = true;
            nameScore = Math.max(nameScore, ns);
          }
          
          // Check SQL table names for context
          var tableContextMatch = false;
          var matchedTable = null;
          if (entity.sqlTables && entity.sqlTables.length > 0) {
            entity.sqlTables.forEach(function(tbl) {
              var ts = smartMatch(tbl, term, true);
              if (ts >= 35) {
                tableContextMatch = true;
                matchedTable = tbl;
                if (tableMatches.indexOf(tbl) === -1) {
                  tableMatches.push({ table: tbl, term: term, score: ts });
                }
              }
            });
          }
          
          // Check fields
          if (entity.fields && entity.fields.length > 0) {
            entity.fields.forEach(function(field) {
              var fs = smartMatch(field, term, true);
              
              // Smart context matching: if term has multiple parts (like "campaign_id")
              // and field is just "id" but table contains "campaign", boost the match
              if (fs < 35 && tableContextMatch && termTokens.length > 1) {
                var fieldTokens = tokenize(field);
                // Check if any part of the search term matches the field
                var partialMatch = termTokens.some(function(tt) {
                  return fieldTokens.some(function(ft) {
                    return ft === tt || ft.indexOf(tt) !== -1 || tt.indexOf(ft) !== -1;
                  });
                });
                if (partialMatch) {
                  // Combine table context with field partial match
                  fs = 70; // Give a good score for contextual match
                }
              }
              
              if (fs >= 35) {
                termMatched = true;
                if (fs > bestFieldScore) {
                  bestFieldScore = fs;
                  bestFieldForTerm = field;
                }
                var existing = fieldMatches.find(function(fm) { return fm.field === field; });
                if (!existing) {
                  fieldMatches.push({ 
                    field: field, 
                    score: fs, 
                    matchedTerms: [term],
                    tableContext: tableContextMatch ? matchedTable : null
                  });
                } else if (existing.matchedTerms.indexOf(term) === -1) {
                  existing.matchedTerms.push(term);
                  existing.score = Math.max(existing.score, fs);
                }
              }
            });
          }
          
          // Also match if table name matches (even without field match)
          if (!termMatched && tableContextMatch) {
            termMatched = true;
            bestFieldScore = 50;
          }
          
          if (termMatched) {
            matchedTerms++;
            totalScore += Math.max(nameScore, bestFieldScore);
            termDetails.push({
              term: term,
              matchedName: ns >= 35,
              matchedField: bestFieldForTerm,
              matchedTable: matchedTable,
              score: Math.max(ns, bestFieldScore)
            });
          }
        });
        
        // All terms must match (AND logic)
        if (matchedTerms === terms.length) {
          var avgScore = totalScore / terms.length;
          var uniqueFieldCount = fieldMatches.length;
          var bonusScore = Math.min(uniqueFieldCount * 2, 10);
          avgScore += bonusScore;
          
          fieldMatches.sort(function(a, b) { return b.score - a.score; });
          
          matches.push({
            entity: entity,
            score: avgScore,
            nameMatch: nameScore >= 35,
            nameScore: nameScore,
            fieldMatches: fieldMatches.map(function(fm) { return fm.field; }),
            fieldScores: fieldMatches,
            tableMatches: tableMatches,
            termDetails: termDetails,
            matchedTermCount: matchedTerms,
            totalTerms: terms.length
          });
        }
      });
      
      matches.sort(function(a, b) {
        if (b.fieldMatches.length !== a.fieldMatches.length) {
          return b.fieldMatches.length - a.fieldMatches.length;
        }
        return b.score - a.score;
      });
      
      console.log('Found:', matches.length, 'matches');
      if (matches.length > 0) {
        console.log('Top match:', matches[0].entity.name, 'Fields:', matches[0].fieldMatches.length, 'Tables:', matches[0].tableMatches.length);
      }
      console.log('=================');
      
      return matches;
    }
    
    // ========== END AI SEARCH ENGINE ==========
    
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
    
    // Fuzzy field comparison for Similar Views
    function fieldsSimilar(field1, field2) {
      if (!field1 || !field2) return { match: false, score: 0 };
      if (field1 === field2) return { match: true, score: 100 };
      
      var f1 = normalize(field1);
      var f2 = normalize(field2);
      
      // Exact normalized match
      if (f1 === f2) return { match: true, score: 95 };
      
      // One contains the other
      if (f1.length > 3 && f2.length > 3) {
        if (f1.indexOf(f2) !== -1 || f2.indexOf(f1) !== -1) return { match: true, score: 85 };
      }
      
      // Tokenize and compare
      var t1 = tokenize(field1);
      var t2 = tokenize(field2);
      
      // Common prefixes to ignore
      var prefixes = ['dics', 'hics', 'dim', 'fct', 'fact', 'stg', 'raw', 'src', 'tgt', 'tmp', 'temp', 'v', 'vw', 'tb', 'tbl', 'f', 'd', 'pk', 'fk', 'sk', 'bk', 'nk'];
      var t1Clean = t1.filter(function(t) { return prefixes.indexOf(t) === -1 && t.length > 1; });
      var t2Clean = t2.filter(function(t) { return prefixes.indexOf(t) === -1 && t.length > 1; });
      
      if (t1Clean.length > 0 && t2Clean.length > 0) {
        // Check if cleaned tokens match
        var t1Joined = t1Clean.join('');
        var t2Joined = t2Clean.join('');
        if (t1Joined === t2Joined) return { match: true, score: 90 };
        
        // Check significant overlap in tokens
        var commonTokens = t1Clean.filter(function(t) { 
          return t2Clean.some(function(t2t) {
            return t === t2t || (t.length > 3 && t2t.length > 3 && (t.indexOf(t2t) !== -1 || t2t.indexOf(t) !== -1));
          });
        });
        var maxTokens = Math.max(t1Clean.length, t2Clean.length);
        var overlapRatio = maxTokens > 0 ? commonTokens.length / maxTokens : 0;
        if (overlapRatio >= 0.5 && commonTokens.length >= 1) return { match: true, score: 75 + Math.round(overlapRatio * 15) };
      }
      
      // Levenshtein on normalized strings (for typos/small differences)
      var maxLen = Math.max(f1.length, f2.length);
      if (maxLen > 0 && maxLen < 30) {
        var dist = levenshtein(f1, f2);
        var similarity = 1 - (dist / maxLen);
        if (similarity >= 0.7) return { match: true, score: Math.round(similarity * 100) };
      }
      
      // Check if fields end the same way (e.g., xxx_id vs yyy_id)
      if (t1.length > 0 && t2.length > 0) {
        var lastT1 = t1[t1.length - 1];
        var lastT2 = t2[t2.length - 1];
        if (lastT1 === lastT2 && lastT1.length > 2) {
          // Same suffix - partial match
          return { match: true, score: 60 };
        }
      }
      
      return { match: false, score: 0 };
    }
    
    function findDuplicates() {
      // Build view fields from the views object directly (not from allRows)
      var viewList = Object.values(views).filter(function(v) { 
        return v.fields && v.fields.length >= 1; 
      });
      
      console.log('=== SIMILAR VIEWS DEBUG ===');
      console.log('Total views with fields:', viewList.length);
      if (viewList.length > 0) {
        console.log('Sample view:', viewList[0].name, 'Fields:', viewList[0].fields.length);
      }
      
      var duplicates = [];
      
      for (var i = 0; i < viewList.length; i++) {
        for (var j = i + 1; j < viewList.length; j++) {
          var v1 = viewList[i], v2 = viewList[j];
          
          // Skip if same view or one has no fields
          if (v1.name === v2.name || v1.fields.length === 0 || v2.fields.length === 0) continue;
          
          // Find matching fields using fuzzy comparison
          var matchedPairs = [];
          var v1Matched = {};
          var v2Matched = {};
          
          v1.fields.forEach(function(f1) {
            if (v1Matched[f1]) return;
            
            var bestMatch = null;
            var bestScore = 0;
            
            v2.fields.forEach(function(f2) {
              if (v2Matched[f2]) return;
              var result = fieldsSimilar(f1, f2);
              if (result.match && result.score > bestScore) {
                bestScore = result.score;
                bestMatch = { f1: f1, f2: f2, score: result.score };
              }
            });
            
            if (bestMatch) {
              matchedPairs.push(bestMatch);
              v1Matched[bestMatch.f1] = true;
              v2Matched[bestMatch.f2] = true;
            }
          });
          
          var minFields = Math.min(v1.fields.length, v2.fields.length);
          var similarity = minFields > 0 ? (matchedPairs.length / minFields) : 0;
          
          // Lower threshold: 25% overlap with at least 1 match
          if (matchedPairs.length >= 1 && similarity >= 0.25) {
            duplicates.push({
              views: [
                { view: v1.name, fields: v1.fields },
                { view: v2.name, fields: v2.fields }
              ],
              matchedPairs: matchedPairs,
              commonCount: matchedPairs.length,
              similarity: Math.round(similarity * 100)
            });
          }
        }
      }
      
      console.log('Found duplicates:', duplicates.length);
      console.log('===========================');
      
      return duplicates.sort(function(a, b) { return b.similarity - a.similarity; });
    }
    
    function renderDuplicatesTab() {
      var duplicates = findDuplicates();
      var viewsWithFields = Object.values(views).filter(function(v) { return v.fields && v.fields.length > 0; }).length;
      var exploresWithFields = Object.values(explores).filter(function(e) { return e.fields && e.fields.length > 0; }).length;
      var dashboardsWithFields = Object.values(dashboards).filter(function(d) { return d.fields && d.fields.length > 0; }).length;
      var totalWithFields = viewsWithFields + exploresWithFields + dashboardsWithFields;
      
      var html = '<div style="padding:20px 24px;border-bottom:1px solid #1e293b;">'+
        '<div style="color:#e2e8f0;font-size:14px;font-weight:500;">Find Similar Entities</div>'+
        '<div style="color:#64748b;font-size:12px;margin-top:4px;">Comparing '+totalWithFields+' entities ('+viewsWithFields+' views, '+exploresWithFields+' explores, '+dashboardsWithFields+' dashboards) with fuzzy field matching</div></div>';
      
      if (duplicates.length === 0) {
        html += '<div style="text-align:center;padding:60px 40px;">'+
          '<div style="font-size:48px;margin-bottom:16px;">🔍</div>'+
          '<div style="color:#e2e8f0;font-size:16px;margin-bottom:8px;">No Similar Entities Found</div>'+
          '<div style="color:#64748b;font-size:13px;margin-bottom:16px;">Entities need at least 20% field overlap to be considered similar.</div>'+
          '<div style="color:#475569;font-size:11px;background:#1e293b;padding:12px;border-radius:8px;text-align:left;max-width:400px;margin:0 auto;">'+
            '<div style="margin-bottom:6px;"><strong style="color:#94a3b8;">Debug Info:</strong></div>'+
            '<div>• Views with fields: '+viewsWithFields+'</div>'+
            '<div>• Explores with fields: '+exploresWithFields+'</div>'+
            '<div>• Dashboards with fields: '+dashboardsWithFields+'</div>'+
            '<div>• Total comparisons: '+(totalWithFields > 1 ? (totalWithFields * (totalWithFields - 1) / 2) : 0)+'</div>'+
            '<div style="margin-top:8px;color:#f59e0b;">Check browser console (F12) for detailed debug info</div>'+
          '</div></div>';
      } else {
        html += '<div style="padding:12px 24px;border-bottom:1px solid #1e293b;background:#f9731615;font-size:13px;color:#f97316;">'+
          'Found '+duplicates.length+' pair(s) of similar views</div>';
        html += '<div style="max-height:450px;overflow-y:auto;">';
        
        duplicates.forEach(function(dup, idx) {
          var isExp = expandedDuplicates[idx];
          var v1 = dup.views[0], v2 = dup.views[1];
          var v1Color = typeConfig[v1.type] ? typeConfig[v1.type].color : '#8b5cf6';
          var v2Color = typeConfig[v2.type] ? typeConfig[v2.type].color : '#8b5cf6';
          
          html += '<div class="dup-row" data-idx="'+idx+'" style="border-bottom:1px solid #1e293b;">'+
            '<div class="dup-header" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;">'+
              '<span style="color:#64748b;">'+(isExp?icons.chevronDown:icons.chevronRight)+'</span>'+
              '<div style="flex:1;display:flex;align-items:center;gap:12px;">'+
                '<div style="flex:1;"><div style="color:'+v1Color+';font-size:13px;">'+v1.view+'</div>'+
                  '<div style="font-size:10px;color:#64748b;margin-top:2px;">'+v1.type.toUpperCase()+' • '+v1.fields.length+' fields</div></div>'+
                '<div style="color:#64748b;font-size:20px;">↔</div>'+
                '<div style="flex:1;"><div style="color:'+v2Color+';font-size:13px;">'+v2.view+'</div>'+
                  '<div style="font-size:10px;color:#64748b;margin-top:2px;">'+v2.type.toUpperCase()+' • '+v2.fields.length+' fields</div></div>'+
              '</div>'+
              '<div style="text-align:center;">'+
                '<div style="background:#f9731622;border:1px solid #f97316;padding:4px 10px;border-radius:12px;font-size:11px;color:#f97316;font-weight:600;">'+dup.similarity+'%</div>'+
                '<div style="font-size:9px;color:#64748b;margin-top:2px;">'+dup.commonCount+' matches</div>'+
              '</div>'+
            '</div>';
          
          if (isExp) {
            html += '<div style="padding:0 16px 16px 44px;background:#0c1222;">'+
              '<div style="margin-bottom:12px;">'+
                '<div style="font-size:11px;color:#64748b;margin-bottom:8px;">'+dup.matchedPairs.length+' Matched Field Pairs</div>'+
                '<div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;">';
            
            dup.matchedPairs.forEach(function(pair) {
              var isExact = pair.f1 === pair.f2;
              var pairColor = isExact ? '#10b981' : '#f59e0b';
              html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#1e293b;border-radius:6px;">'+
                '<span style="flex:1;font-size:11px;color:#e2e8f0;font-family:monospace;">'+pair.f1+'</span>'+
                '<span style="color:'+pairColor+';font-size:12px;">'+(isExact?'=':'≈')+'</span>'+
                '<span style="flex:1;font-size:11px;color:#e2e8f0;font-family:monospace;">'+pair.f2+'</span>'+
                '<span style="font-size:9px;color:#64748b;background:#334155;padding:2px 6px;border-radius:4px;">'+pair.score+'%</span>'+
              '</div>';
            });
            
            html += '</div></div></div>';
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
      
      var nodeW = 260, nodeH = 44, nodeSpacing = 52, padding = 25;
      var svgWidth = Math.max(containerWidth - 40, 1150);
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
        
        var nm = entity.name.length > 28 ? entity.name.substring(0,27)+'…' : entity.name;
        var fieldCount = entity.fields ? entity.fields.length : 0;
        var subText = '<text x="46" y="'+(nodeH/2+12)+'" fill="'+cfg.color+'" font-size="9" opacity="0.7">'+entity.type.toUpperCase()+' • '+fieldCount+' fields</text>';
        
        if (isSearchMatch) {
          var match = searchMatches.find(function(m) { return m.entity.id === entity.id; });
          if (match && match.fieldMatches.length > 0) {
            var fieldText = match.fieldMatches.length+' field'+(match.fieldMatches.length>1?'s':'')+' matched';
            if (match.totalTerms > 1) {
              fieldText = match.fieldMatches.length+'/'+match.totalTerms+' terms found';
            }
            subText = '<text x="46" y="'+(nodeH/2+12)+'" fill="#10b981" font-size="9">'+fieldText+' ('+fieldCount+' total)</text>';
          }
        }
        
        var hasFields = entity.fields && entity.fields.length > 0;
        var fieldsBtn = hasFields ? '<g class="fields-btn" data-id="'+entity.id+'" transform="translate('+(nodeW-26)+',12)" style="cursor:pointer;"><rect width="20" height="20" rx="5" fill="#10b981" fill-opacity="0.3" stroke="#10b981" stroke-width="1"/><g transform="translate(3,3)" fill="#10b981">'+icons.list+'</g></g>' : '';
        
        // Tooltip with full name - click to copy
        var tooltipHtml = '<title>'+entity.name+' (right-click to copy)</title>';
        
        nodesHtml += '<g class="node" data-id="'+entity.id+'" data-name="'+entity.name.replace(/"/g, '&quot;')+'" style="cursor:pointer;" transform="translate('+pos.x+','+pos.y+')">'+
          tooltipHtml+
          glowHtml+
          '<rect width="'+nodeW+'" height="'+nodeH+'" rx="10" fill="#0f172a" fill-opacity="0.95" stroke="'+borderColor+'" stroke-width="'+borderWidth+'"/>'+
          '<rect x="1" y="1" width="38" height="'+(nodeH-2)+'" rx="9" fill="'+cfg.color+'" fill-opacity="0.15"/>'+
          '<g transform="translate(12,'+(nodeH/2-7)+')" fill="'+cfg.color+'">'+typeIcons[entity.type]+'</g>'+
          '<text x="46" y="'+(nodeH/2)+'" fill="#e2e8f0" font-size="11" font-weight="500">'+nm+'</text>'+
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
        var topMatch = searchMatches[0];
        var termCount = searchTags.length + (searchTerm.trim() ? 1 : 0);
        var scoreInfo = topMatch ? ' <span style="color:#64748b;font-size:10px;">('+topMatch.fieldMatches.length+' fields, '+Math.round(topMatch.score)+'% match)</span>' : '';
        var termInfo = termCount > 1 ? '<span style="color:#94a3b8;margin-left:8px;">'+termCount+' terms</span>' : '';
        statsText = '<span style="color:#10b981;font-weight:500;">'+highlightedEntities.length+' matches</span>'+termInfo+scoreInfo;
      } else if (searchTags.length > 0 || searchTerm.trim()) {
        statsText = '<span style="color:#ef4444;">No matches found</span>';
      } else {
        statsText = '<span style="color:#64748b;">Click node to trace lineage</span>';
      }
      
      // Fields panel - always show when a node is clicked
      var fieldsPanelHtml = '';
      if (showFieldsPanel) {
        var panelEntity = allEntities.find(function(e) { return e.id === showFieldsPanel; });
        if (panelEntity) {
          var hasFields = panelEntity.fields && panelEntity.fields.length > 0;
          var hasTables = panelEntity.sqlTables && panelEntity.sqlTables.length > 0;
          var sortedFields = hasFields ? panelEntity.fields.slice().sort() : [];
          var matchData = searchMatches.find(function(m) { return m.entity.id === panelEntity.id; });
          
          // Show SQL tables if available
          var tablesHtml = '';
          if (hasTables) {
            var tableMatchTerms = matchData ? matchData.tableMatches : [];
            tablesHtml = '<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #334155;">'+
              '<div style="font-size:10px;color:#64748b;margin-bottom:6px;">SQL TABLES ('+panelEntity.sqlTables.length+')</div>'+
              '<div style="display:flex;flex-wrap:wrap;gap:4px;">'+
                panelEntity.sqlTables.map(function(tbl) {
                  var tblMatch = tableMatchTerms.find(function(tm) { return tm.table === tbl; });
                  var isMatch = tblMatch !== null && tblMatch !== undefined;
                  return '<span style="background:'+(isMatch?'#06b6d425':'#0f172a')+';border:1px solid '+(isMatch?'#06b6d4':'#334155')+';padding:4px 8px;border-radius:4px;font-size:10px;color:'+(isMatch?'#67e8f9':'#94a3b8')+';font-family:monospace;">'+tbl+(isMatch?' <span style="opacity:0.7;">('+tblMatch.term+')</span>':'')+'</span>';
                }).join('')+
              '</div></div>';
          }
          
          // Fields section
          var fieldsHtml = '';
          if (hasFields) {
            fieldsHtml = '<div style="font-size:10px;color:#64748b;margin-bottom:6px;">FIELDS ('+sortedFields.length+')</div>'+
              '<div style="display:flex;flex-wrap:wrap;gap:6px;">'+
                sortedFields.map(function(f) {
                  var matchInfo = null;
                  if (matchData) {
                    matchInfo = matchData.fieldScores.find(function(fs) { return fs.field === f; });
                  }
                  var isMatch = matchInfo !== null && matchInfo !== undefined;
                  var matchLabel = '';
                  if (isMatch && matchInfo.matchedTerms && matchInfo.matchedTerms.length > 0) {
                    matchLabel = '<span style="font-size:9px;opacity:0.7;margin-left:4px;">(' + matchInfo.matchedTerms.join(', ') + ')</span>';
                  }
                  if (isMatch && matchInfo.tableContext) {
                    matchLabel += '<span style="font-size:9px;color:#06b6d4;margin-left:4px;">via '+matchInfo.tableContext+'</span>';
                  }
                  return '<span style="background:'+(isMatch?'#10b98125':'#0f172a')+';border:1px solid '+(isMatch?'#10b981':'#334155')+';padding:5px 10px;border-radius:6px;font-size:11px;color:'+(isMatch?'#6ee7b7':'#e2e8f0')+';">'+f+matchLabel+'</span>';
                }).join('')+
              '</div>';
          } else {
            fieldsHtml = '<div style="color:#64748b;font-size:12px;text-align:center;padding:20px;">No fields available for this '+panelEntity.type+'</div>';
          }
          
          var subtitleParts = [];
          if (hasFields) subtitleParts.push(panelEntity.fields.length + ' fields');
          if (hasTables) subtitleParts.push(panelEntity.sqlTables.length + ' table(s)');
          var subtitle = subtitleParts.length > 0 ? subtitleParts.join(' • ') : panelEntity.type;
          
          fieldsPanelHtml = '<div id="fields-panel" style="position:absolute;top:60px;right:20px;width:340px;max-height:500px;background:#1e293b;border:1px solid #475569;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.5);z-index:100;overflow:hidden;">'+
            '<div style="padding:14px 18px;border-bottom:1px solid #334155;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#1e293b,#334155);">'+
              '<div><div style="color:'+typeConfig[panelEntity.type].color+';font-size:14px;font-weight:600;">'+panelEntity.name+'</div>'+
              '<div style="color:#94a3b8;font-size:11px;margin-top:3px;">'+subtitle+'</div></div>'+
              '<span id="close-panel" style="color:#94a3b8;cursor:pointer;padding:6px;border-radius:6px;background:#334155;">'+icons.x+'</span></div>'+
            '<div style="padding:14px 18px;max-height:400px;overflow-y:auto;">'+
              tablesHtml+
              fieldsHtml+
            '</div></div>';
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
        // Right-click to copy name
        n.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          var name = n.dataset.name;
          if (name && navigator.clipboard) {
            navigator.clipboard.writeText(name).then(function() {
              // Show brief feedback
              var rect = n.querySelector('rect');
              if (rect) {
                var origStroke = rect.getAttribute('stroke');
                rect.setAttribute('stroke', '#10b981');
                setTimeout(function() { rect.setAttribute('stroke', origStroke); }, 300);
              }
            });
          }
        });
        
        n.addEventListener('click', function(e) {
          var id = n.dataset.id;
          var entity = allEntities.find(function(x) { return x.id === id; });
          
          // If clicking the fields button, just toggle fields panel
          if (e.target.closest('.fields-btn')) {
            showFieldsPanel = showFieldsPanel === id ? null : id;
            var tabContent = container.querySelector('#tab-content');
            if (tabContent && activeTab === 'lineage') {
              tabContent.innerHTML = renderLineageTab();
              attachLineageEvents();
            }
            return;
          }
          
          // If clicking the same selected node, deselect it
          if (selectedNode && selectedNode.id === id) {
            selectedNode = null;
            upstream = [];
            downstream = [];
            showFieldsPanel = null;
          } else {
            // Select node and always show its fields panel
            selectedNode = entity;
            searchTerm = '';
            searchTags = [];
            showFieldsPanel = id; // Always show panel, even if no fields
          }
          render();
        });
      });
      
      var closePanel = container.querySelector('#close-panel');
      if (closePanel) closePanel.addEventListener('click', function(e) {
        e.stopPropagation();
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
        return '<span class="search-tag" data-idx="'+i+'" style="display:inline-flex;align-items:center;gap:6px;background:#10b98125;border:1px solid #10b981;padding:6px 10px 6px 12px;border-radius:8px;font-size:12px;color:#6ee7b7;font-weight:500;"><span style="opacity:0.6;font-size:10px;">'+(i+1)+'.</span> '+tag+'<span class="remove-tag" style="cursor:pointer;opacity:0.7;padding:2px;">'+icons.x+'</span></span>';
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
                '<span style="color:#10b981;display:flex;align-items:center;gap:4px;">'+icons.ai+icons.search+'</span>'+
                '<input id="searchInput" type="text" value="'+searchTerm+'" placeholder="Search fields: campaign name, gross revenue, country... (Enter to add each)" autocomplete="off" spellcheck="false" style="flex:1;background:transparent;border:none;color:#e2e8f0;font-size:14px;outline:none;"/>'+
                (hasSearch||selectedNode?'<span id="clearAll" style="color:#64748b;cursor:pointer;padding:6px;border-radius:6px;background:#334155;">'+icons.x+'</span>':'')+
              '</div>'+
              (searchTags.length?'<div style="display:flex;flex-wrap:wrap;gap:8px;">'+tagsHtml+'</div>':'')+
              '<div style="margin-top:12px;font-size:11px;color:#64748b;">🤖 <span style="color:#10b981;">AI-powered</span>: Use comma for multiple fields. Searches fields + table names (e.g., "campaign_id" finds "id" in campaign table)</div>'+
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
        var val = e.target.value;
        
        // Check if user typed a comma - add current term as tag
        if (val.indexOf(',') !== -1) {
          var parts = val.split(',');
          // Add all complete terms (before last comma) as tags
          for (var i = 0; i < parts.length - 1; i++) {
            var term = parts[i].trim();
            if (term && searchTags.indexOf(term) === -1) {
              searchTags.push(term);
            }
          }
          // Keep the part after last comma in input
          searchTerm = parts[parts.length - 1];
          render();
          return;
        }
        
        searchTerm = val;
        selectedNode = null; upstream = []; downstream = [];
        
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
          var tabContent = container.querySelector('#tab-content');
          if (tabContent && activeTab === 'lineage') {
            tabContent.innerHTML = renderLineageTab();
            attachLineageEvents();
          }
        }, 200);
      });
      
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && searchTerm.trim()) {
          e.preventDefault();
          var term = searchTerm.trim();
          if (searchTags.indexOf(term) === -1) searchTags.push(term);
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

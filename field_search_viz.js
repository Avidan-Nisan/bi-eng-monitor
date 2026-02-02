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
    
    // Collect all table names for filtering out table names from fields
    var allTableNames = {};
    data.forEach(function(row) {
      if (tableField && row[tableField] && row[tableField].value) {
        var tblName = row[tableField].value.toLowerCase().trim();
        allTableNames[tblName] = true;
        var parts = tblName.split('.');
        if (parts.length > 1) allTableNames[parts[parts.length - 1]] = true;
      }
    });
    
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
    
    // ============================================================
    // KEY FIX: PREFIX-BASED FIELD ASSIGNMENT FOR TABLES
    // Tables only get fields where field prefix matches table prefix
    // e.g., dima_marketer only gets dima_* fields
    // ============================================================
    
    // Extract prefix from table name (e.g., "dima_marketer" -> "dima")
    function getTablePrefix(tableName) {
      if (!tableName) return null;
      var name = tableName.toLowerCase();
      // Special tables that don't follow prefix pattern
      if (name === '[looker_derived_fields]') return null;
      if (name.indexOf('template_') === 0) return null;
      if (name.indexOf('off_platform_') === 0) return null;
      var idx = name.indexOf('_');
      return idx > 0 ? name.substring(0, idx) : null;
    }
    
    // Extract prefix from field name (e.g., "dima_name" -> "dima")
    function getFieldPrefix(fieldName) {
      if (!fieldName) return null;
      var name = fieldName.toLowerCase();
      var idx = name.indexOf('_');
      return idx > 0 ? name.substring(0, idx) : null;
    }
    
    // Check if field belongs to table based on prefix match
    function fieldBelongsToTable(field, tableName) {
      var tablePrefix = getTablePrefix(tableName);
      var fieldPrefix = getFieldPrefix(field);
      // If table has no clear prefix, don't assign any fields based on prefix
      if (!tablePrefix) return false;
      if (!fieldPrefix) return false;
      return tablePrefix === fieldPrefix;
    }
    
    // Collect all unique table names
    var allTablesList = [];
    allRows.forEach(function(row) {
      if (row.table && allTablesList.indexOf(row.table) === -1) {
        allTablesList.push(row.table);
      }
    });
    
    // Collect ALL fields that appear in data for each table (from row associations)
    var tableFieldsFromData = {};
    allRows.forEach(function(row) {
      if (row.table) {
        if (!tableFieldsFromData[row.table]) tableFieldsFromData[row.table] = {};
        row.fields.forEach(function(f) {
          tableFieldsFromData[row.table][f] = true;
        });
      }
    });
    
    // FOR TABLES: Filter to only keep fields where prefix matches table prefix
    // This ensures dima_marketer only has dima_* fields, not dics_* fields
    var tableOwnFields = {};
    allTablesList.forEach(function(tbl) {
      var allFieldsForTable = Object.keys(tableFieldsFromData[tbl] || {});
      var tablePrefix = getTablePrefix(tbl);
      
      if (tablePrefix) {
        // Only keep fields that match this table's prefix
        tableOwnFields[tbl] = allFieldsForTable.filter(function(f) {
          return fieldBelongsToTable(f, tbl);
        });
      } else {
        // For tables without clear prefix (like [LOOKER_DERIVED_FIELDS], template_*, etc.)
        // Keep all their fields
        tableOwnFields[tbl] = allFieldsForTable;
      }
    });
    
    // Debug: verify the fix is working
    console.log('=== ASSET MANAGER: TABLE FIELDS (PREFIX-FILTERED) ===');
    var testTables = ['dima_marketer', 'dics_campaign_settings', 'dipb_publisher', 'dise_section', 'diub_unified_blocks'];
    testTables.forEach(function(t) {
      if (tableOwnFields[t]) {
        var prefix = getTablePrefix(t);
        var wrongPrefixFields = tableOwnFields[t].filter(function(f) {
          var fp = getFieldPrefix(f);
          return fp && prefix && fp !== prefix;
        });
        console.log(t + ' (prefix=' + prefix + ', fields=' + tableOwnFields[t].length + ', wrongPrefix=' + wrongPrefixFields.length + ')');
        if (wrongPrefixFields.length > 0) {
          console.log('  WARNING - wrong prefix fields:', wrongPrefixFields.slice(0, 5));
        } else {
          console.log('  Sample fields:', tableOwnFields[t].slice(0, 5));
        }
      }
    });
    
    // ============================================================
    // END OF KEY FIX
    // ============================================================
    
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
          fields: tableOwnFields[tbl] || [],  // Use prefix-filtered fields!
          sqlTables: [tbl] 
        };
      }
      
      // Create VIEW - views get ALL fields (they can join multiple tables)
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
      
      // Views get ALL fields from their rows (they join multiple tables)
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
    
    // State variables
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

    function normalize(str) { 
      return str ? str.toLowerCase().replace(/[_\-\s\.]+/g, '') : ''; 
    }
    
    function smartMatch(text, searchTerm) {
      if (!text || !searchTerm) return false;
      var textLower = text.toLowerCase();
      var termLower = searchTerm.toLowerCase().trim();
      if (textLower.indexOf(termLower) !== -1) return true;
      if (normalize(text).indexOf(normalize(searchTerm)) !== -1) return true;
      return false;
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
    
    function findSimilarFields(fields1, fields2) {
      var matches = [];
      fields1.forEach(function(f1) {
        fields2.forEach(function(f2) {
          if (f1.toLowerCase() === f2.toLowerCase()) {
            matches.push({ f1: f1, f2: f2, exact: true });
          }
        });
      });
      return matches;
    }
    
    function runAnalysis() {
      if (analysisLoading) return;
      analysisLoading = true; 
      analysisError = null; 
      render();
      
      setTimeout(function() {
        try {
          var results = [];
          var viewsList = Object.values(views).filter(function(v) { 
            return v.fields && v.fields.length > 0; 
          });
          
          for (var i = 0; i < viewsList.length; i++) {
            for (var j = i + 1; j < viewsList.length; j++) {
              var v1 = viewsList[i], v2 = viewsList[j];
              var sharedTables = v1.sqlTables.filter(function(t) { 
                return v2.sqlTables.indexOf(t) !== -1; 
              });
              var similarFields = findSimilarFields(v1.fields, v2.fields);
              var exactFields = similarFields.filter(function(m) { return m.exact; });
              
              if (sharedTables.length >= 1 || exactFields.length >= 3) {
                var reasons = [];
                if (sharedTables.length > 0) {
                  reasons.push({ type: 'tables', count: sharedTables.length, items: sharedTables });
                }
                if (exactFields.length > 0) {
                  reasons.push({ type: 'exactFields', count: exactFields.length, items: exactFields.map(function(m) { return m.f1; }) });
                }
                
                var similarity = Math.round((sharedTables.length * 30 + exactFields.length * 5) / Math.max(1, Math.min(v1.fields.length, v2.fields.length)) * 10);
                similarity = Math.min(100, similarity);
                
                results.push({ 
                  v1: v1.name, v2: v2.name, type: 'view', 
                  similarity: similarity, reasons: reasons, 
                  sharedTables: sharedTables, similarFields: similarFields 
                });
              }
            }
          }
          
          results.sort(function(a, b) { return b.similarity - a.similarity; });
          similarResults = results.slice(0, 50);
          analysisLoading = false; 
          render();
        } catch(e) { 
          similarResults = []; 
          analysisError = 'Error: ' + e.message; 
          analysisLoading = false; 
          render(); 
        }
      }, 100);
    }
    
    function renderDuplicatesTab() {
      var viewsCount = Object.values(views).filter(function(v) { 
        return v.fields && v.fields.length > 0; 
      }).length;
      
      var html = '<div style="padding:16px 24px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;">';
      html += '<div style="color:#94a3b8;font-size:13px;">Analyzing <span style="color:#e2e8f0;font-weight:500;">' + viewsCount + '</span> views</div>';
      if (similarResults) {
        html += '<button id="refreshBtn" style="background:transparent;border:1px solid #475569;padding:6px 12px;border-radius:6px;color:#94a3b8;cursor:pointer;font-size:11px;">Refresh</button>';
      }
      html += '</div>';
      
      if (analysisLoading) {
        html += '<div style="text-align:center;padding:80px 40px;"><div style="color:#8b5cf6;font-size:14px;">Analyzing...</div></div>';
      } else if (analysisError) {
        html += '<div style="text-align:center;padding:80px 40px;color:#ef4444;font-size:14px;">' + analysisError + '</div>';
      } else if (!similarResults || similarResults.length === 0) {
        html += '<div style="text-align:center;padding:80px 40px;"><div style="color:#10b981;font-size:14px;">No similar views found</div></div>';
      } else {
        html += '<div style="max-height:480px;overflow-y:auto;">';
        similarResults.forEach(function(pair, idx) {
          var isExp = expandedDuplicates[idx];
          var reasonSummary = [];
          pair.reasons.forEach(function(r) {
            if (r.type === 'tables') reasonSummary.push(r.count + ' shared table' + (r.count > 1 ? 's' : ''));
            if (r.type === 'exactFields') reasonSummary.push(r.count + ' identical field' + (r.count > 1 ? 's' : ''));
          });
          
          html += '<div class="dup-row" data-idx="' + idx + '" style="border-bottom:1px solid #1e293b;">';
          html += '<div class="dup-header" style="display:flex;align-items:center;gap:16px;padding:14px 20px;cursor:pointer;">';
          html += '<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#8b5cf620,#ec489920);display:flex;align-items:center;justify-content:center;font-size:13px;color:#a78bfa;font-weight:600;">' + pair.similarity + '%</div>';
          html += '<div style="flex:1;min-width:0;">';
          html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span style="color:#e2e8f0;font-size:13px;font-weight:500;">' + pair.v1 + '</span><span style="color:#475569;">—</span><span style="color:#e2e8f0;font-size:13px;font-weight:500;">' + pair.v2 + '</span></div>';
          html += '<div style="color:#64748b;font-size:11px;">' + reasonSummary.join(' | ') + '</div>';
          html += '</div>';
          html += '<span style="color:#475569;">' + icons.chevronDown + '</span>';
          html += '</div>';
          
          if (isExp) {
            html += '<div style="padding:0 20px 16px 80px;background:#0f172a;">';
            pair.reasons.forEach(function(r) {
              if (r.type === 'tables' && r.items.length > 0) {
                html += '<div style="margin-bottom:12px;"><div style="font-size:10px;color:#64748b;margin-bottom:6px;">Shared SQL Tables</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
                r.items.forEach(function(t) { 
                  html += '<span style="background:#06b6d415;border:1px solid #06b6d450;padding:4px 10px;border-radius:4px;font-size:11px;color:#22d3ee;">' + t + '</span>'; 
                });
                html += '</div></div>';
              }
              if (r.type === 'exactFields' && r.items.length > 0) {
                html += '<div style="margin-bottom:12px;"><div style="font-size:10px;color:#64748b;margin-bottom:6px;">Identical Fields</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
                r.items.forEach(function(f) { 
                  html += '<span style="background:#10b98115;border:1px solid #10b98150;padding:4px 10px;border-radius:4px;font-size:11px;color:#6ee7b7;">' + f + '</span>'; 
                });
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
      var terms = searchTags.slice(); 
      if (searchTerm.trim()) terms.push(searchTerm.trim()); 
      if (terms.length === 0) return [];
      
      var matches = [], partialMatches = [];
      
      allEntities.forEach(function(entity) {
        var matchedTermsCount = 0, fieldMatches = [];
        
        terms.forEach(function(term) {
          var termMatched = false;
          
          // Match entity name
          if (smartMatch(entity.name, term)) termMatched = true;
          
          // Match fields
          if (entity.fields && entity.fields.length > 0) {
            entity.fields.forEach(function(field) {
              if (smartMatch(field, term)) {
                termMatched = true;
                if (fieldMatches.indexOf(field) === -1) fieldMatches.push(field);
              }
            });
          }
          
          if (termMatched) matchedTermsCount++;
        });
        
        var matchData = { 
          entity: entity, 
          fieldMatches: fieldMatches, 
          totalTerms: terms.length, 
          matchedTermsCount: matchedTermsCount 
        };
        
        if (matchedTermsCount === terms.length) {
          matches.push(matchData);
        } else if (matchedTermsCount > 0) {
          partialMatches.push(matchData);
        }
      });
      
      window._partialMatches = partialMatches.sort(function(a, b) { 
        return b.matchedTermsCount - a.matchedTermsCount; 
      }).slice(0, 10);
      
      return matches.sort(function(a, b) { 
        return b.fieldMatches.length - a.fieldMatches.length; 
      });
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
      } else if (searchTags.length > 0 || searchTerm.trim()) { 
        filterMode = 'search'; 
        visibleEntities = highlightedEntities.length > 0 ? allEntities.filter(function(e) { 
          return highlightedEntities.indexOf(e.id) !== -1; 
        }) : [];
      }
      
      var byType = { table: [], view: [], explore: [], dashboard: [] }; 
      visibleEntities.forEach(function(e) { byType[e.type].push(e); }); 
      ['table','view','explore','dashboard'].forEach(function(t) { 
        byType[t].sort(function(a,b) { return a.name.localeCompare(b.name); }); 
      });
      
      var nodeW = 200, nodeH = 38, nodeSpacing = 46, padding = 15;
      var svgWidth = Math.max(containerWidth - 30, 1100);
      var colSpacing = (svgWidth - padding * 2 - nodeW) / 3;
      var colX = { 
        table: padding, 
        view: padding + colSpacing, 
        explore: padding + colSpacing * 2, 
        dashboard: padding + colSpacing * 3 
      };
      var positions = {}, startY = 65;
      
      ['table','view','explore','dashboard'].forEach(function(type) { 
        byType[type].forEach(function(e, idx) { 
          positions[e.id] = { x: colX[type], y: startY + idx * nodeSpacing }; 
        }); 
      });
      
      var maxCount = Math.max(byType.table.length||1, byType.view.length||1, byType.explore.length||1, byType.dashboard.length||1);
      var svgHeight = Math.max(maxCount * nodeSpacing + 100, 350);
      
      // Draw edges
      var edgesHtml = ''; 
      visibleEntities.forEach(function(e) { 
        (e.sources||[]).forEach(function(s) { 
          var f = positions[s], t = positions[e.id]; 
          if (!f || !t) return; 
          var stroke = '#334155', op = 0.25, sw = 1.5; 
          if (selectedNode) { 
            if (s === selectedNode.id || downstream.indexOf(e.id) !== -1) { 
              stroke = '#f97316'; op = 0.9; sw = 2.5; 
            } else if (e.id === selectedNode.id || upstream.indexOf(s) !== -1) { 
              stroke = '#06b6d4'; op = 0.9; sw = 2.5; 
            } 
          } else if (filterMode === 'search') { 
            stroke = '#10b981'; op = 0.6; sw = 2; 
          } 
          var x1 = f.x + nodeW, y1 = f.y + nodeH/2, x2 = t.x, y2 = t.y + nodeH/2, mx = (x1+x2)/2; 
          edgesHtml += '<path d="M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ',' + mx + ' ' + y2 + ',' + x2 + ' ' + y2 + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-opacity="' + op + '"/>'; 
        }); 
      });
      
      // Draw nodes
      var nodesHtml = ''; 
      visibleEntities.forEach(function(entity) { 
        var pos = positions[entity.id];
        var cfg = typeConfig[entity.type];
        var isSel = selectedNode && selectedNode.id === entity.id;
        var isUp = selectedNode && upstream.indexOf(entity.id) !== -1;
        var isDown = selectedNode && downstream.indexOf(entity.id) !== -1;
        var isMatch = highlightedEntities.indexOf(entity.id) !== -1 && !selectedNode;
        
        var borderColor = cfg.color, borderWidth = 1;
        if (isSel) { borderColor = '#ffffff'; borderWidth = 2; }
        else if (isUp) { borderColor = '#06b6d4'; borderWidth = 2; }
        else if (isDown) { borderColor = '#f97316'; borderWidth = 2; }
        else if (isMatch) { borderColor = '#10b981'; borderWidth = 2; }
        
        var nm = entity.name.length > 26 ? entity.name.substring(0,25) + '...' : entity.name;
        nodesHtml += '<g class="node" data-id="' + entity.id + '" style="cursor:pointer;" transform="translate(' + pos.x + ',' + pos.y + ')">';
        nodesHtml += '<rect width="' + nodeW + '" height="' + nodeH + '" rx="8" fill="#0f172a" stroke="' + borderColor + '" stroke-width="' + borderWidth + '"/>';
        nodesHtml += '<rect x="1" y="1" width="32" height="' + (nodeH-2) + '" rx="7" fill="' + cfg.color + '" fill-opacity="0.15"/>';
        nodesHtml += '<g transform="translate(9,' + (nodeH/2-7) + ')" fill="' + cfg.color + '">' + typeIcons[entity.type] + '</g>';
        nodesHtml += '<text x="40" y="' + (nodeH/2+4) + '" fill="#e2e8f0" font-size="10" font-weight="500">' + nm + '</text>';
        nodesHtml += '</g>'; 
      });
      
      // Draw headers
      var hdrHtml = ''; 
      ['table','view','explore','dashboard'].forEach(function(type) { 
        var cfg = typeConfig[type]; 
        hdrHtml += '<text x="' + (colX[type]+nodeW/2) + '" y="22" text-anchor="middle" fill="' + cfg.color + '" font-size="9" font-weight="600">' + cfg.label.toUpperCase() + '</text>';
        hdrHtml += '<text x="' + (colX[type]+nodeW/2) + '" y="36" text-anchor="middle" fill="#475569" font-size="8">' + byType[type].length + ' items</text>'; 
      });
      
      // Stats text
      var statsText = '';
      if (selectedNode) {
        statsText = '<span style="color:' + typeConfig[selectedNode.type].color + ';">' + selectedNode.name + '</span> ';
        statsText += '<span style="color:#06b6d4;">Up:' + upstream.length + '</span> ';
        statsText += '<span style="color:#f97316;">Down:' + downstream.length + '</span>';
      } else if ((searchTags.length > 0 || searchTerm.trim()) && highlightedEntities.length > 0) {
        statsText = '<span style="color:#10b981;">' + highlightedEntities.length + ' matches</span>';
      } else if (searchTags.length > 0 || searchTerm.trim()) {
        statsText = '<span style="color:#ef4444;">No matches</span>';
      } else {
        statsText = '<span style="color:#64748b;">Click node to trace lineage</span>';
      }
      
      // No results message with partial matches
      var noResultsHtml = '';
      if (filterMode === 'search' && visibleEntities.length === 0) {
        noResultsHtml = '<div style="padding:20px;background:#1e293b;margin:12px;border-radius:8px;">';
        noResultsHtml += '<div style="color:#f59e0b;font-size:14px;margin-bottom:16px;">No assets found</div>';
        if (window._partialMatches && window._partialMatches.length > 0) {
          noResultsHtml += '<div style="color:#94a3b8;font-size:12px;margin-bottom:8px;">Partial matches:</div>';
          noResultsHtml += '<div style="display:flex;flex-direction:column;gap:6px;">';
          window._partialMatches.slice(0, 5).forEach(function(pm) {
            var cfg = typeConfig[pm.entity.type];
            noResultsHtml += '<div style="padding:8px 12px;background:#0f172a;border-radius:6px;border-left:3px solid ' + cfg.color + ';">';
            noResultsHtml += '<div style="color:#e2e8f0;font-size:12px;">' + pm.entity.name + '</div>';
            noResultsHtml += '<div style="color:#64748b;font-size:10px;margin-top:2px;">' + pm.fieldMatches.slice(0,3).join(', ') + '</div>';
            noResultsHtml += '</div>';
          });
          noResultsHtml += '</div>';
        }
        noResultsHtml += '</div>';
      }
      
      var result = '<div>';
      result += '<div style="padding:10px 20px;border-bottom:1px solid #1e293b;font-size:12px;display:flex;justify-content:space-between;">';
      result += '<div>' + statsText + '</div>';
      result += '<div style="color:#64748b;font-size:11px;">' + (filterMode ? visibleEntities.length + ' of ' : '') + allEntities.length + ' entities</div>';
      result += '</div>';
      
      if (noResultsHtml) {
        result += noResultsHtml;
      } else {
        result += '<div style="padding:12px;overflow:auto;">';
        result += '<svg width="' + svgWidth + '" height="' + svgHeight + '" style="font-family:system-ui,sans-serif;">' + hdrHtml + edgesHtml + nodesHtml + '</svg>';
        result += '</div>';
      }
      result += '</div>';
      
      return result;
    }
    
    function attachEvents() {
      container.querySelectorAll('.node').forEach(function(n) { 
        n.addEventListener('click', function() { 
          var id = n.dataset.id;
          var entity = allEntities.find(function(x) { return x.id === id; }); 
          if (selectedNode && selectedNode.id === id) { 
            selectedNode = null; upstream = []; downstream = []; 
          } else { 
            selectedNode = entity; searchTerm = ''; searchTags = []; 
          } 
          render(); 
        }); 
      });
      
      var refreshBtn = container.querySelector('#refreshBtn'); 
      if (refreshBtn) {
        refreshBtn.addEventListener('click', function() { runAnalysis(); });
      }
      
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
      var tagsHtml = searchTags.map(function(tag, i) { 
        return '<span class="search-tag" data-idx="' + i + '" style="display:inline-flex;align-items:center;gap:6px;background:#10b98125;border:1px solid #10b981;padding:6px 10px;border-radius:8px;font-size:12px;color:#6ee7b7;">' + (i+1) + '. ' + tag + '<span class="remove-tag" style="cursor:pointer;padding:2px;">' + icons.x + '</span></span>'; 
      }).join('');
      
      var hasSearch = searchTags.length > 0 || searchTerm.trim();
      
      var html = '<div style="background:#0f172a;min-height:600px;">';
      html += '<div style="padding:14px 24px;border-bottom:1px solid #1e293b;">';
      
      // Header
      html += '<div style="display:flex;justify-content:space-between;margin-bottom:14px;">';
      html += '<div><div style="font-weight:600;color:#f1f5f9;font-size:16px;">Asset Manager</div>';
      html += '<div style="font-size:10px;color:#64748b;">' + allRows.length + ' assets</div></div>';
      
      // Tabs
      html += '<div style="display:flex;gap:0;">';
      html += '<button class="tab-btn" data-tab="lineage" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;background:' + (activeTab==='lineage'?'#1e293b':'transparent') + ';color:' + (activeTab==='lineage'?'#10b981':'#64748b') + ';border-radius:8px 0 0 8px;border:1px solid #334155;">' + icons.lineage + ' Lineage</button>';
      html += '<button class="tab-btn" data-tab="duplicates" style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:none;cursor:pointer;font-size:12px;background:' + (activeTab==='duplicates'?'#1e293b':'transparent') + ';color:' + (activeTab==='duplicates'?'#8b5cf6':'#64748b') + ';border-radius:0 8px 8px 0;border:1px solid #334155;border-left:none;">' + icons.duplicate + ' Similar Views</button>';
      html += '</div></div>';
      
      // Search box
      html += '<div style="background:#1e293b;border:1px solid #475569;border-radius:12px;padding:16px;">';
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:' + (searchTags.length ? '12px' : '0') + ';">';
      html += '<span style="color:#10b981;">' + icons.search + '</span>';
      html += '<input id="searchInput" type="text" value="' + searchTerm + '" placeholder="Search fields (comma for AND)..." style="flex:1;background:transparent;border:none;color:#e2e8f0;font-size:14px;outline:none;"/>';
      if (hasSearch || selectedNode) {
        html += '<span id="clearAll" style="color:#64748b;cursor:pointer;padding:6px 10px;border-radius:6px;background:#334155;font-size:11px;">Clear</span>';
      }
      html += '</div>';
      if (searchTags.length) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + tagsHtml + '</div>';
      }
      html += '</div></div>';
      
      // Tab content
      html += '<div id="tab-content">' + (activeTab === 'lineage' ? renderLineageTab() : renderDuplicatesTab()) + '</div>';
      html += '</div>';
      
      container.innerHTML = html;
      
      // Search input events
      var input = container.querySelector('#searchInput');
      input.addEventListener('input', function(e) { 
        var val = e.target.value; 
        if (val.indexOf(',') !== -1) { 
          var parts = val.split(','); 
          for (var i = 0; i < parts.length - 1; i++) { 
            var term = parts[i].trim(); 
            if (term && searchTags.indexOf(term) === -1) searchTags.push(term); 
          } 
          searchTerm = parts[parts.length - 1]; 
          render(); 
          return; 
        } 
        searchTerm = val; 
        selectedNode = null; 
        var tc = container.querySelector('#tab-content'); 
        if (tc && activeTab === 'lineage') { 
          tc.innerHTML = renderLineageTab(); 
          attachEvents(); 
        } 
      });
      
      input.addEventListener('keydown', function(e) { 
        if (e.key === 'Enter' && searchTerm.trim()) { 
          if (searchTags.indexOf(searchTerm.trim()) === -1) searchTags.push(searchTerm.trim()); 
          searchTerm = ''; 
          render(); 
        } else if (e.key === 'Backspace' && !searchTerm && searchTags.length > 0) { 
          searchTags.pop(); 
          render(); 
        } 
      });
      
      // Clear button
      var clearBtn = container.querySelector('#clearAll'); 
      if (clearBtn) {
        clearBtn.addEventListener('click', function() { 
          searchTerm = ''; searchTags = []; selectedNode = null; 
          render(); 
        });
      }
      
      // Remove tag buttons
      container.querySelectorAll('.remove-tag').forEach(function(btn) { 
        btn.addEventListener('click', function(e) { 
          e.stopPropagation(); 
          searchTags.splice(parseInt(btn.parentElement.dataset.idx), 1); 
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
      
      attachEvents();
    }
    
    render();
    setTimeout(function() { runAnalysis(); }, 300);
    done();
  }
});

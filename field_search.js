looker.plugins.visualizations.add({
  id: "field_search",
  label: "Field Search",
  options: {},
  
  create: function(element, config) {
    element.innerHTML = '<div id="search-container" style="width:100%;height:100%;overflow:auto;font-family:system-ui,sans-serif;"></div>';
  },
  
  updateAsync: function(data, element, config, queryResponse, details, done) {
    var container = element.querySelector('#search-container');
    
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="padding:40px;color:#64748b;background:#0f172a;min-height:100%;">No data. Please select: dashboard_title, explore_name, view_name, sql_table_fields</div>';
      done();
      return;
    }
    
    var fields = queryResponse.fields.dimension_like.map(function(f) { return f.name; });
    var dashField = fields.find(function(f) { return f.toLowerCase().indexOf('dashboard') !== -1 && f.toLowerCase().indexOf('title') !== -1; });
    var dashIdField = fields.find(function(f) { return f.toLowerCase().indexOf('dashboard') !== -1 && f.toLowerCase().indexOf('id') !== -1; });
    var expField = fields.find(function(f) { return f.toLowerCase().indexOf('explore') !== -1 && f.toLowerCase().indexOf('name') !== -1; });
    var viewField = fields.find(function(f) { return f.toLowerCase().indexOf('view') !== -1 && f.toLowerCase().indexOf('name') !== -1; });
    var fieldsField = fields.find(function(f) { return f.toLowerCase().indexOf('fields') !== -1 || f.toLowerCase().indexOf('sql_table_fields') !== -1; });
    var modelField = fields.find(function(f) { return f.toLowerCase().indexOf('model') !== -1; });
    var tableField = fields.find(function(f) { return f.toLowerCase().indexOf('sql_table') !== -1 && f.toLowerCase().indexOf('fields') === -1; });
    
    if (!dashField || !expField || !viewField || !fieldsField) {
      container.innerHTML = '<div style="padding:40px;color:#ef4444;background:#0f172a;min-height:100%;">Missing required fields.<br>Need: dashboard_title, explore_name, view_name, sql_table_fields<br>Found: ' + fields.join(', ') + '</div>';
      done();
      return;
    }
    
    // Parse all data rows
    var allRows = data.map(function(row) {
      return {
        dashboard: row[dashField] ? row[dashField].value : '',
        dashboardId: dashIdField && row[dashIdField] ? row[dashIdField].value : '',
        explore: row[expField] ? row[expField].value : '',
        view: row[viewField] ? row[viewField].value : '',
        model: modelField && row[modelField] ? row[modelField].value : '',
        table: tableField && row[tableField] ? row[tableField].value : '',
        fields: row[fieldsField] ? (row[fieldsField].value || '').split('|').filter(function(f) { return f.trim(); }) : []
      };
    });
    
    var searchTerm = '';
    var expandedRows = {};
    var groupBy = 'none';
    
    // SVG icons matching lineage graph style
    var icons = {
      search: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
      dashboard: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="2" y="2" width="9" height="6" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="10" width="9" height="12" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>',
      explore: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
      view: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7zm0 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/></svg>',
      field: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="9" width="8" height="3"/><rect x="13" y="9" width="8" height="3"/><rect x="3" y="14" width="8" height="3"/><rect x="13" y="14" width="8" height="3"/></svg>',
      chevronRight: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
      chevronDown: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
      x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    };
    
    var typeConfig = {
      dashboard: { color: '#f97316', label: 'Dashboards' },
      explore: { color: '#ec4899', label: 'Explores' },
      view: { color: '#8b5cf6', label: 'Views' },
      field: { color: '#10b981', label: 'Fields' }
    };
    
    function getFilteredResults() {
      if (!searchTerm.trim()) return [];
      var term = searchTerm.toLowerCase();
      return allRows.filter(function(row) {
        return row.fields.some(function(f) { return f.toLowerCase().indexOf(term) !== -1; }) ||
               row.view.toLowerCase().indexOf(term) !== -1 ||
               row.explore.toLowerCase().indexOf(term) !== -1 ||
               row.dashboard.toLowerCase().indexOf(term) !== -1;
      }).map(function(row) {
        return Object.assign({}, row, {
          matchedFields: row.fields.filter(function(f) { return f.toLowerCase().indexOf(term) !== -1; })
        });
      });
    }
    
    function highlightMatch(text, term) {
      if (!term) return text;
      var idx = text.toLowerCase().indexOf(term.toLowerCase());
      if (idx === -1) return text;
      return text.slice(0, idx) + '<span style="background:#fbbf24;color:#0f172a;padding:0 2px;border-radius:2px;">' + text.slice(idx, idx + term.length) + '</span>' + text.slice(idx + term.length);
    }
    
    function getStats(results) {
      var dashboards = {}, explores = {}, views = {}, fieldCount = 0;
      results.forEach(function(r) {
        if (r.dashboard) dashboards[r.dashboard] = true;
        if (r.explore) explores[r.explore] = true;
        if (r.view) views[r.view] = true;
        fieldCount += r.matchedFields.length;
      });
      return {
        dashboards: Object.keys(dashboards).length,
        explores: Object.keys(explores).length,
        views: Object.keys(views).length,
        fields: fieldCount
      };
    }
    
    function render() {
      var results = getFilteredResults();
      var stats = getStats(results);
      
      // Group results if needed
      var grouped = { 'all': results };
      if (groupBy !== 'none' && results.length > 0) {
        grouped = {};
        results.forEach(function(row) {
          var key = groupBy === 'explore' ? row.explore : 
                    groupBy === 'view' ? row.view : 
                    groupBy === 'dashboard' ? row.dashboard : row.model || 'Unknown';
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(row);
        });
      }
      
      // Build results HTML
      var resultsHtml = '';
      
      if (!searchTerm.trim()) {
        resultsHtml = '<div style="text-align:center;padding:60px 40px;">'+
          '<div style="color:#64748b;margin-bottom:16px;">'+icons.search.replace('width="20"', 'width="48"').replace('height="20"', 'height="48"')+'</div>'+
          '<div style="font-size:18px;color:#e2e8f0;margin-bottom:8px;">Start Searching</div>'+
          '<div style="color:#64748b;font-size:13px;margin-bottom:24px;">Enter a field name to find related views, explores, and dashboards</div>'+
          '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">'+
            ['revenue','account','spend','sales_rep','marketer'].map(function(t) {
              return '<span class="suggestion-chip" data-term="'+t+'" style="background:linear-gradient(135deg,#1e293b,#334155);border:1px solid #475569;padding:6px 14px;border-radius:16px;cursor:pointer;font-size:12px;color:#94a3b8;">'+t+'</span>';
            }).join('')+
          '</div>'+
        '</div>';
      } else if (results.length === 0) {
        resultsHtml = '<div style="text-align:center;padding:60px 40px;">'+
          '<div style="color:#ef4444;font-size:14px;">No fields found matching "'+searchTerm+'"</div>'+
          '<div style="color:#64748b;font-size:12px;margin-top:8px;">Try searching for terms like "revenue", "account", or "spend"</div>'+
        '</div>';
      } else {
        Object.keys(grouped).forEach(function(groupKey) {
          var rows = grouped[groupKey];
          if (groupBy !== 'none') {
            var gColor = groupBy === 'explore' ? typeConfig.explore.color : 
                         groupBy === 'view' ? typeConfig.view.color : 
                         groupBy === 'dashboard' ? typeConfig.dashboard.color : '#64748b';
            var gIcon = groupBy === 'explore' ? icons.explore : 
                        groupBy === 'view' ? icons.view : 
                        groupBy === 'dashboard' ? icons.dashboard : icons.field;
            resultsHtml += '<div style="padding:12px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;gap:8px;">'+
              '<span style="color:'+gColor+';">'+gIcon+'</span>'+
              '<span style="color:'+gColor+';font-weight:600;font-size:13px;">'+groupKey+'</span>'+
              '<span style="color:#64748b;font-size:11px;">('+rows.length+')</span>'+
            '</div>';
          }
          
          rows.forEach(function(row, idx) {
            var rowId = groupKey + '_' + idx;
            var isExpanded = expandedRows[rowId];
            
            resultsHtml += '<div class="result-row" data-row-id="'+rowId+'" style="border-bottom:1px solid #1e293b;">'+
              '<div class="row-header" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'#1e293b\'" onmouseout="this.style.background=\'transparent\'">'+
                '<span style="color:#64748b;transition:transform 0.2s;">'+(isExpanded ? icons.chevronDown : icons.chevronRight)+'</span>'+
                '<div style="flex:1;display:grid;grid-template-columns:1.5fr 1fr 1fr 0.7fr;gap:16px;align-items:center;">'+
                  '<div>'+
                    '<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Dashboard</div>'+
                    '<div style="color:#f97316;font-size:13px;font-weight:500;">'+highlightMatch(row.dashboard, searchTerm)+'</div>'+
                  '</div>'+
                  '<div>'+
                    '<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Explore</div>'+
                    '<div style="color:#ec4899;font-size:13px;">'+highlightMatch(row.explore, searchTerm)+'</div>'+
                  '</div>'+
                  '<div>'+
                    '<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">View</div>'+
                    '<div style="color:#8b5cf6;font-size:13px;">'+highlightMatch(row.view, searchTerm)+'</div>'+
                  '</div>'+
                  '<div>'+
                    '<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Matched</div>'+
                    '<div style="color:#10b981;font-size:13px;font-weight:600;">'+row.matchedFields.length+' field'+(row.matchedFields.length !== 1 ? 's' : '')+'</div>'+
                  '</div>'+
                '</div>'+
              '</div>';
            
            if (isExpanded) {
              resultsHtml += '<div style="padding:0 16px 16px 44px;background:#0c1222;">'+
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;font-size:12px;">'+
                  (row.model ? '<div><span style="color:#64748b;">Model:</span> <span style="color:#e2e8f0;">'+row.model+'</span></div>' : '')+
                  (row.table ? '<div><span style="color:#64748b;">SQL Table:</span> <code style="background:#1e293b;padding:2px 6px;border-radius:4px;color:#06b6d4;font-size:11px;">'+row.table+'</code></div>' : '')+
                '</div>'+
                '<div style="margin-bottom:12px;">'+
                  '<div style="font-size:11px;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Matched Fields</div>'+
                  '<div style="display:flex;flex-wrap:wrap;gap:6px;">'+
                    row.matchedFields.map(function(f) {
                      return '<span style="background:linear-gradient(135deg,#064e3b,#065f46);border:1px solid #10b981;padding:4px 10px;border-radius:4px;font-size:11px;color:#6ee7b7;">'+highlightMatch(f, searchTerm)+'</span>';
                    }).join('')+
                  '</div>'+
                '</div>'+
                '<div>'+
                  '<div style="font-size:11px;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">All Fields ('+row.fields.length+')</div>'+
                  '<div style="display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow-y:auto;">'+
                    row.fields.map(function(f) {
                      var isMatch = f.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1;
                      return '<span style="background:'+(isMatch ? '#fbbf24' : '#1e293b')+';color:'+(isMatch ? '#0f172a' : '#94a3b8')+';padding:2px 8px;border-radius:3px;font-size:10px;">'+f+'</span>';
                    }).join('')+
                  '</div>'+
                '</div>'+
              '</div>';
            }
            
            resultsHtml += '</div>';
          });
        });
      }
      
      // Stats bar
      var statsHtml = searchTerm && results.length > 0 ? 
        '<div style="display:flex;gap:20px;font-size:12px;">'+
          '<span style="color:#f97316;">'+icons.dashboard+' '+stats.dashboards+'</span>'+
          '<span style="color:#ec4899;">'+icons.explore+' '+stats.explores+'</span>'+
          '<span style="color:#8b5cf6;">'+icons.view+' '+stats.views+'</span>'+
          '<span style="color:#10b981;">'+icons.field+' '+stats.fields+'</span>'+
        '</div>' : '';
      
      // Logo
      var logoHtml = '<img src="https://avidan-nisan.github.io/bi-eng-monitor/logo.png" width="44" height="44" style="border-radius:10px;" onerror="this.style.display=\'none\'" />';
      
      container.innerHTML = 
        '<div style="background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);min-height:100%;">'+
          // Header
          '<div style="padding:16px 24px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;">'+
            '<div style="display:flex;align-items:center;gap:14px;">'+
              logoHtml+
              '<div>'+
                '<div style="font-weight:600;color:#f1f5f9;font-size:16px;">Field Search</div>'+
                '<div style="font-size:11px;color:#64748b;">Search across '+allRows.length+' assets</div>'+
              '</div>'+
            '</div>'+
            statsHtml+
          '</div>'+
          
          // Search bar
          '<div style="padding:20px 24px;border-bottom:1px solid #1e293b;">'+
            '<div style="display:flex;gap:12px;align-items:center;">'+
              '<div style="flex:1;position:relative;">'+
                '<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#64748b;">'+icons.search+'</span>'+
                '<input id="searchInput" type="text" value="'+searchTerm+'" placeholder="Search for a field name..." style="width:100%;padding:12px 14px 12px 44px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor=\'#6366f1\'" onblur="this.style.borderColor=\'#334155\'"/>'+
                (searchTerm ? '<span id="clearSearch" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);color:#64748b;cursor:pointer;">'+icons.x+'</span>' : '')+
              '</div>'+
              '<div style="display:flex;align-items:center;gap:8px;">'+
                '<span style="color:#64748b;font-size:11px;">Group:</span>'+
                '<select id="groupSelect" style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:8px 12px;color:#e2e8f0;font-size:12px;cursor:pointer;">'+
                  '<option value="none"'+(groupBy==='none'?' selected':'')+'>None</option>'+
                  '<option value="explore"'+(groupBy==='explore'?' selected':'')+'>Explore</option>'+
                  '<option value="view"'+(groupBy==='view'?' selected':'')+'>View</option>'+
                  '<option value="dashboard"'+(groupBy==='dashboard'?' selected':'')+'>Dashboard</option>'+
                '</select>'+
              '</div>'+
            '</div>'+
          '</div>'+
          
          // Results count
          (searchTerm && results.length > 0 ? 
            '<div style="padding:12px 24px;border-bottom:1px solid #1e293b;font-size:13px;color:#94a3b8;">'+
              results.length+' result'+(results.length !== 1 ? 's' : '')+' found'+
            '</div>' : '')+
          
          // Results
          '<div style="max-height:calc(100% - 200px);overflow-y:auto;">'+resultsHtml+'</div>'+
          
          // Footer legend
          '<div style="padding:10px 24px;border-top:1px solid #1e293b;display:flex;gap:24px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">'+
            '<span><span style="color:#f97316;">●</span> Dashboard</span>'+
            '<span><span style="color:#ec4899;">●</span> Explore</span>'+
            '<span><span style="color:#8b5cf6;">●</span> View</span>'+
            '<span><span style="color:#10b981;">●</span> Field</span>'+
          '</div>'+
        '</div>';
      
      // Event listeners
      var searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.addEventListener('input', function(e) {
          searchTerm = e.target.value;
          expandedRows = {};
          render();
        });
        searchInput.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') {
            searchTerm = '';
            expandedRows = {};
            render();
          }
        });
      }
      
      var clearBtn = document.getElementById('clearSearch');
      if (clearBtn) {
        clearBtn.onclick = function() {
          searchTerm = '';
          expandedRows = {};
          render();
        };
      }
      
      var groupSelect = document.getElementById('groupSelect');
      if (groupSelect) {
        groupSelect.onchange = function(e) {
          groupBy = e.target.value;
          render();
        };
      }
      
      // Suggestion chips
      container.querySelectorAll('.suggestion-chip').forEach(function(chip) {
        chip.onclick = function() {
          searchTerm = chip.getAttribute('data-term');
          render();
        };
      });
      
      // Row expansion
      container.querySelectorAll('.row-header').forEach(function(header) {
        header.onclick = function() {
          var rowId = header.parentElement.getAttribute('data-row-id');
          expandedRows[rowId] = !expandedRows[rowId];
          render();
        };
      });
    }
    
    render();
    done();
  }
});

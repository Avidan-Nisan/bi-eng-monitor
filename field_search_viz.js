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
    if (!data || data.length === 0) { container.innerHTML = '<div style="padding:40px;color:#64748b;">No data</div>'; done(); return; }
    
    var allFieldNames = queryResponse.fields.dimension_like.map(function(f) { return f.name; });
    var tableField = null, fieldsField = null, viewField = null, expField = null, dashField = null;
    
    for (var i = 0; i < allFieldNames.length; i++) {
      var n = allFieldNames[i].toLowerCase();
      if (n.indexOf('sql_table_fields') !== -1 || n.indexOf('table_fields') !== -1) fieldsField = allFieldNames[i];
      else if (n.indexOf('sql_table') !== -1 && !tableField) tableField = allFieldNames[i];
      if (n.indexOf('view') !== -1 && n.indexOf('name') !== -1 && !viewField) viewField = allFieldNames[i];
      if (n.indexOf('explore') !== -1 && n.indexOf('name') !== -1 && !expField) expField = allFieldNames[i];
      if (n.indexOf('dashboard') !== -1 && n.indexOf('title') !== -1 && !dashField) dashField = allFieldNames[i];
    }
    
    var tables = {}, views = {}, explores = {}, dashboards = {};
    var viewToTables = {}, exploreToViews = {}, dashToExplores = {};
    
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var tbl = tableField && row[tableField] ? (row[tableField].value || '') : '';
      var vw = viewField && row[viewField] ? (row[viewField].value || '') : '';
      var exp = expField && row[expField] ? (row[expField].value || '') : '';
      var dash = dashField && row[dashField] ? (row[dashField].value || '') : '';
      var fieldsStr = fieldsField && row[fieldsField] ? (row[fieldsField].value || '') : '';
      var fieldsList = fieldsStr ? fieldsStr.split('|').filter(function(f) { return f.trim(); }) : [];
      
      if (tbl && !tables[tbl]) tables[tbl] = { id: 't_'+tbl, name: tbl, type: 'table', sources: [], fields: [], sqlTables: [tbl] };
      if (vw && !views[vw]) views[vw] = { id: 'v_'+vw, name: vw, type: 'view', sources: [], fields: [], sqlTables: [] };
      if (exp && !explores[exp]) explores[exp] = { id: 'e_'+exp, name: exp, type: 'explore', sources: [], fields: [], sqlTables: [] };
      if (dash && !dashboards[dash]) dashboards[dash] = { id: 'd_'+dash, name: dash, type: 'dashboard', sources: [], fields: [], sqlTables: [] };
      
      if (vw && views[vw]) {
        for (var fi = 0; fi < fieldsList.length; fi++) { if (views[vw].fields.indexOf(fieldsList[fi]) === -1) views[vw].fields.push(fieldsList[fi]); }
        if (tbl && views[vw].sqlTables.indexOf(tbl) === -1) views[vw].sqlTables.push(tbl);
      }
      if (exp && explores[exp]) {
        for (var fi = 0; fi < fieldsList.length; fi++) { if (explores[exp].fields.indexOf(fieldsList[fi]) === -1) explores[exp].fields.push(fieldsList[fi]); }
        if (tbl && explores[exp].sqlTables.indexOf(tbl) === -1) explores[exp].sqlTables.push(tbl);
      }
      if (dash && dashboards[dash]) {
        for (var fi = 0; fi < fieldsList.length; fi++) { if (dashboards[dash].fields.indexOf(fieldsList[fi]) === -1) dashboards[dash].fields.push(fieldsList[fi]); }
        if (tbl && dashboards[dash].sqlTables.indexOf(tbl) === -1) dashboards[dash].sqlTables.push(tbl);
      }
      if (vw && tbl) { if (!viewToTables[vw]) viewToTables[vw] = {}; viewToTables[vw]['t_'+tbl] = true; }
      if (exp && vw) { if (!exploreToViews[exp]) exploreToViews[exp] = {}; exploreToViews[exp]['v_'+vw] = true; }
      if (dash && exp) { if (!dashToExplores[dash]) dashToExplores[dash] = {}; dashToExplores[dash]['e_'+exp] = true; }
    }
    
    var vKeys = Object.keys(views); for (var i = 0; i < vKeys.length; i++) views[vKeys[i]].sources = Object.keys(viewToTables[vKeys[i]] || {});
    var eKeys = Object.keys(explores); for (var i = 0; i < eKeys.length; i++) explores[eKeys[i]].sources = Object.keys(exploreToViews[eKeys[i]] || {});
    var dKeys = Object.keys(dashboards); for (var i = 0; i < dKeys.length; i++) dashboards[dKeys[i]].sources = Object.keys(dashToExplores[dKeys[i]] || {});
    
    var allEntities = Object.values(tables).concat(Object.values(views)).concat(Object.values(explores)).concat(Object.values(dashboards));
    var entitiesWithFields = 0; for (var i = 0; i < allEntities.length; i++) { if (allEntities[i].fields.length > 0) entitiesWithFields++; }
    
    var searchTerm = '', searchTags = [], selectedNode = null, upstream = [], downstream = [], highlightedEntities = [];
    
    var icons = { search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>', x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' };
    var typeIcons = { table: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="9" width="8" height="3"/><rect x="13" y="9" width="8" height="3"/><rect x="3" y="14" width="8" height="3"/><rect x="13" y="14" width="8" height="3"/></svg>', view: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7z"/></svg>', explore: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>', dashboard: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="2" y="2" width="9" height="6" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="10" width="9" height="12" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>' };
    var typeConfig = { table: { color: '#06b6d4', label: 'SQL Tables' }, view: { color: '#8b5cf6', label: 'Views' }, explore: { color: '#ec4899', label: 'Explores' }, dashboard: { color: '#f97316', label: 'Dashboards' } };

    function normalize(str) { return str ? str.toLowerCase().replace(/[_\-\s\.]+/g, '') : ''; }
    function fieldMatches(field, term) {
      if (!field || !term) return false;
      if (field.toLowerCase().indexOf(term.toLowerCase()) !== -1) return true;
      if (normalize(field).indexOf(normalize(term)) !== -1) return true;
      return false;
    }
    
    function getUpstream(id, depth, visited) {
      if (depth > 15 || !id) return [];
      visited = visited || {};
      if (visited[id]) return [];
      visited[id] = true;
      var entity = null;
      for (var i = 0; i < allEntities.length; i++) { if (allEntities[i].id === id) { entity = allEntities[i]; break; } }
      if (!entity || !entity.sources) return [];
      var result = [];
      for (var i = 0; i < entity.sources.length; i++) {
        var s = entity.sources[i];
        if (!visited[s]) { result.push(s); result = result.concat(getUpstream(s, depth + 1, visited)); }
      }
      return result;
    }
    
    function getDownstream(id, depth, visited) {
      if (depth > 15 || !id) return [];
      visited = visited || {};
      if (visited[id]) return [];
      visited[id] = true;
      var result = [];
      for (var i = 0; i < allEntities.length; i++) {
        var e = allEntities[i];
        if (e.sources) {
          for (var j = 0; j < e.sources.length; j++) {
            if (e.sources[j] === id && !visited[e.id]) { result.push(e.id); result = result.concat(getDownstream(e.id, depth + 1, visited)); break; }
          }
        }
      }
      return result;
    }
    
    function getSearchMatches() {
      var terms = searchTags.slice();
      if (searchTerm.trim()) terms.push(searchTerm.trim());
      if (terms.length === 0) return [];
      var matches = [];
      for (var i = 0; i < allEntities.length; i++) {
        var entity = allEntities[i], matchedCount = 0, matchedFields = [];
        for (var t = 0; t < terms.length; t++) {
          var term = terms[t], found = false;
          if (fieldMatches(entity.name, term)) found = true;
          if (entity.sqlTables) { for (var j = 0; j < entity.sqlTables.length; j++) { if (fieldMatches(entity.sqlTables[j], term)) found = true; } }
          if (entity.fields) { for (var j = 0; j < entity.fields.length; j++) { if (fieldMatches(entity.fields[j], term)) { found = true; if (matchedFields.indexOf(entity.fields[j]) === -1) matchedFields.push(entity.fields[j]); } } }
          if (found) matchedCount++;
        }
        if (matchedCount === terms.length) matches.push({ entity: entity, fieldMatches: matchedFields });
      }
      return matches;
    }
    
    function render() {
      var searchMatches = getSearchMatches();
      highlightedEntities = [];
      for (var i = 0; i < searchMatches.length; i++) highlightedEntities.push(searchMatches[i].entity.id);
      
      var visibleEntities = allEntities, filterMode = '';
      if (selectedNode) {
        filterMode = 'lineage';
        upstream = getUpstream(selectedNode.id, 0);
        downstream = getDownstream(selectedNode.id, 0);
        var ids = [selectedNode.id].concat(upstream).concat(downstream);
        visibleEntities = [];
        for (var i = 0; i < allEntities.length; i++) { if (ids.indexOf(allEntities[i].id) !== -1) visibleEntities.push(allEntities[i]); }
      } else if (searchTags.length > 0 || searchTerm.trim()) {
        filterMode = 'search';
        if (highlightedEntities.length > 0) {
          visibleEntities = [];
          for (var i = 0; i < allEntities.length; i++) { if (highlightedEntities.indexOf(allEntities[i].id) !== -1) visibleEntities.push(allEntities[i]); }
        } else { visibleEntities = []; }
      }
      
      var byType = { table: [], view: [], explore: [], dashboard: [] };
      for (var i = 0; i < visibleEntities.length; i++) byType[visibleEntities[i].type].push(visibleEntities[i]);
      
      var nodeW = 200, nodeH = 38, nodeSpacing = 46, padding = 15, svgWidth = Math.max(containerWidth - 30, 1100), colSpacing = (svgWidth - padding * 2 - nodeW) / 3;
      var colX = { table: padding, view: padding + colSpacing, explore: padding + colSpacing * 2, dashboard: padding + colSpacing * 3 };
      var positions = {}, startY = 65;
      var types = ['table', 'view', 'explore', 'dashboard'];
      for (var ti = 0; ti < types.length; ti++) { var type = types[ti]; byType[type].sort(function(a,b) { return a.name.localeCompare(b.name); }); for (var i = 0; i < byType[type].length; i++) positions[byType[type][i].id] = { x: colX[type], y: startY + i * nodeSpacing }; }
      var maxCount = Math.max(byType.table.length||1, byType.view.length||1, byType.explore.length||1, byType.dashboard.length||1);
      var svgHeight = Math.max(maxCount * nodeSpacing + 100, 350);
      
      var edgesHtml = '';
      for (var i = 0; i < visibleEntities.length; i++) {
        var e = visibleEntities[i];
        if (e.sources) {
          for (var j = 0; j < e.sources.length; j++) {
            var s = e.sources[j], f = positions[s], t = positions[e.id];
            if (f && t) {
              var stroke = '#334155', op = 0.25, sw = 1.5;
              if (selectedNode) { if (s === selectedNode.id || downstream.indexOf(e.id) !== -1) { stroke = '#f97316'; op = 0.9; sw = 2.5; } else if (e.id === selectedNode.id || upstream.indexOf(s) !== -1) { stroke = '#06b6d4'; op = 0.9; sw = 2.5; } }
              else if (filterMode === 'search') { stroke = '#10b981'; op = 0.6; sw = 2; }
              var x1 = f.x + nodeW, y1 = f.y + nodeH/2, x2 = t.x, y2 = t.y + nodeH/2, mx = (x1 + x2) / 2;
              edgesHtml += '<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-opacity="'+op+'"/>';
            }
          }
        }
      }
      
      var nodesHtml = '';
      for (var i = 0; i < visibleEntities.length; i++) {
        var entity = visibleEntities[i], pos = positions[entity.id], cfg = typeConfig[entity.type];
        var isSel = selectedNode && selectedNode.id === entity.id;
        var isUp = selectedNode && upstream.indexOf(entity.id) !== -1;
        var isDown = selectedNode && downstream.indexOf(entity.id) !== -1;
        var isMatch = highlightedEntities.indexOf(entity.id) !== -1 && !selectedNode;
        var borderColor = cfg.color, borderWidth = 1;
        if (isSel) { borderColor = '#ffffff'; borderWidth = 2; }
        else if (isUp) { borderColor = '#06b6d4'; borderWidth = 2; }
        else if (isDown) { borderColor = '#f97316'; borderWidth = 2; }
        else if (isMatch) { borderColor = '#10b981'; borderWidth = 2; }
        var nm = entity.name.length > 26 ? entity.name.substring(0, 25) + '…' : entity.name;
        nodesHtml += '<g class="node" data-id="'+entity.id+'" style="cursor:pointer;" transform="translate('+pos.x+','+pos.y+')"><rect width="'+nodeW+'" height="'+nodeH+'" rx="8" fill="#0f172a" stroke="'+borderColor+'" stroke-width="'+borderWidth+'"/><rect x="1" y="1" width="32" height="'+(nodeH-2)+'" rx="7" fill="'+cfg.color+'" fill-opacity="0.15"/><g transform="translate(9,'+(nodeH/2-7)+')" fill="'+cfg.color+'">'+typeIcons[entity.type]+'</g><text x="40" y="'+(nodeH/2+4)+'" fill="#e2e8f0" font-size="10" font-weight="500">'+nm+'</text></g>';
      }
      
      var hdrHtml = '';
      for (var ti = 0; ti < types.length; ti++) { var type = types[ti], cfg = typeConfig[type]; hdrHtml += '<text x="'+(colX[type]+nodeW/2)+'" y="22" text-anchor="middle" fill="'+cfg.color+'" font-size="9" font-weight="600">'+cfg.label.toUpperCase()+'</text><text x="'+(colX[type]+nodeW/2)+'" y="36" text-anchor="middle" fill="#475569" font-size="8">'+byType[type].length+'</text>'; }
      
      var statsText = selectedNode ? '<span style="color:'+typeConfig[selectedNode.type].color+';">'+selectedNode.name+'</span>' : (highlightedEntities.length > 0 ? '<span style="color:#10b981;">'+highlightedEntities.length+' matches</span>' : (searchTerm || searchTags.length ? '<span style="color:#ef4444;">No matches</span>' : '<span style="color:#64748b;">Click node or search</span>'));
      
      var tagsHtml = '';
      for (var i = 0; i < searchTags.length; i++) tagsHtml += '<span class="search-tag" data-idx="'+i+'" style="display:inline-flex;align-items:center;gap:6px;background:#10b98125;border:1px solid #10b981;padding:6px 10px;border-radius:8px;font-size:12px;color:#6ee7b7;">'+searchTags[i]+'<span class="remove-tag" style="cursor:pointer;">'+icons.x+'</span></span>';
      
      container.innerHTML = '<div style="background:#0f172a;min-height:600px;"><div style="padding:14px 24px;border-bottom:1px solid #1e293b;"><div style="font-weight:600;color:#f1f5f9;font-size:16px;margin-bottom:14px;">Asset Manager <span style="font-size:10px;color:#64748b;font-weight:400;">'+allEntities.length+' entities | '+entitiesWithFields+' with fields</span></div><div style="background:#1e293b;border:1px solid #475569;border-radius:12px;padding:16px;"><div style="display:flex;align-items:center;gap:10px;'+(searchTags.length?'margin-bottom:12px;':'')+'"><span style="color:#10b981;">'+icons.search+'</span><input id="searchInput" type="text" value="'+searchTerm+'" placeholder="Search fields (comma for AND)..." style="flex:1;background:transparent;border:none;color:#e2e8f0;font-size:14px;outline:none;"/>'+(searchTerm||searchTags.length||selectedNode?'<span id="clearAll" style="color:#64748b;cursor:pointer;padding:6px 10px;border-radius:6px;background:#334155;font-size:11px;">Clear</span>':'')+'</div>'+(searchTags.length?'<div style="display:flex;flex-wrap:wrap;gap:8px;">'+tagsHtml+'</div>':'')+'</div></div><div style="padding:10px 20px;border-bottom:1px solid #1e293b;font-size:12px;">'+statsText+'</div><div style="padding:12px;overflow:auto;"><svg width="'+svgWidth+'" height="'+svgHeight+'" style="font-family:system-ui,sans-serif;">'+hdrHtml+edgesHtml+nodesHtml+'</svg></div></div>';
      
      var input = container.querySelector('#searchInput');
      input.addEventListener('input', function(e) {
        var val = e.target.value;
        if (val.indexOf(',') !== -1) {
          var parts = val.split(',');
          for (var i = 0; i < parts.length - 1; i++) { var t = parts[i].trim(); if (t && searchTags.indexOf(t) === -1) searchTags.push(t); }
          searchTerm = parts[parts.length - 1];
        } else { searchTerm = val; }
        selectedNode = null;
        render();
      });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && searchTerm.trim()) { if (searchTags.indexOf(searchTerm.trim()) === -1) searchTags.push(searchTerm.trim()); searchTerm = ''; render(); }
        else if (e.key === 'Backspace' && !searchTerm && searchTags.length > 0) { searchTags.pop(); render(); }
      });
      input.focus();
      
      var clearBtn = container.querySelector('#clearAll');
      if (clearBtn) clearBtn.addEventListener('click', function() { searchTerm = ''; searchTags = []; selectedNode = null; render(); });
      
      var removeBtns = container.querySelectorAll('.remove-tag');
      for (var i = 0; i < removeBtns.length; i++) {
        removeBtns[i].addEventListener('click', function(e) { e.stopPropagation(); searchTags.splice(parseInt(this.parentElement.dataset.idx), 1); render(); });
      }
      
      var nodes = container.querySelectorAll('.node');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].addEventListener('click', function() {
          var id = this.dataset.id, entity = null;
          for (var j = 0; j < allEntities.length; j++) { if (allEntities[j].id === id) { entity = allEntities[j]; break; } }
          if (selectedNode && selectedNode.id === id) { selectedNode = null; } else { selectedNode = entity; searchTerm = ''; searchTags = []; }
          render();
        });
      }
    }
    
    render();
    done();
  }
});

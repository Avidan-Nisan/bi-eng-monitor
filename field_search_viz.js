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

    var totalRows = data.length;
    var isTruncated = false;
    if (queryResponse && queryResponse.truncated !== undefined) {
      isTruncated = queryResponse.truncated;
    } else {
      isTruncated = (totalRows === 5000 || totalRows === 500 || totalRows === 10000);
    }

    var fields = queryResponse.fields.dimension_like.map(function(f) { return f.name; });

    var dashField = fields.find(function(f) { return f.toLowerCase().indexOf('dashboard') !== -1 && f.toLowerCase().indexOf('title') !== -1; });
    var expField = fields.find(function(f) { return f.toLowerCase().indexOf('explore') !== -1 && f.toLowerCase().indexOf('name') !== -1; });
    var viewField = fields.find(function(f) { return f.toLowerCase().indexOf('view') !== -1 && f.toLowerCase().indexOf('name') !== -1 && f.toLowerCase().indexOf('count') === -1 && f.toLowerCase().indexOf('extended') === -1 && f.toLowerCase().indexOf('included') === -1; });
    var tableField = fields.find(function(f) { return f.toLowerCase().indexOf('sql_table') !== -1 && f.toLowerCase().indexOf('fields') === -1 && f.toLowerCase().indexOf('path') === -1; });
    var extendedViewField = fields.find(function(f) { return f.toLowerCase().indexOf('extended') !== -1 && f.toLowerCase().indexOf('view') !== -1; });
    var includedViewField = fields.find(function(f) { return f.toLowerCase().indexOf('included') !== -1 && f.toLowerCase().indexOf('view') !== -1; });
    var fieldsField = fields.find(function(f) { return f.toLowerCase().indexOf('sql_table_fields') !== -1; });
    var dateField = fields.find(function(f) { return f.toLowerCase().indexOf('stats_date') !== -1 || f.toLowerCase().indexOf('date') !== -1; });
    var dashIdField = fields.find(function(f) { return f.toLowerCase().indexOf('dashboard_id') !== -1; });
    var dashViewCountField = null;
    if (queryResponse.fields.measure_like) {
      dashViewCountField = queryResponse.fields.measure_like.map(function(f){return f.name;}).find(function(f) {
        return f.toLowerCase().indexOf('view_count') !== -1 || f.toLowerCase().indexOf('dashboard_view') !== -1;
      });
    }
    var modelField = fields.find(function(f) {
      var fl = f.toLowerCase();
      return fl.indexOf('.model') !== -1 || fl.endsWith('model_name') || fl === 'model' || (fl.indexOf('model') !== -1 && fl.indexOf('name') !== -1);
    });
    if (!modelField) {
      modelField = fields.find(function(f) { return f.toLowerCase().indexOf('model') !== -1; });
    }

    // =============================================
    // PARSE ALL ROWS WITH DATE
    // =============================================
    function parseDate(val) {
      if (!val) return null;
      var s = String(val).substring(0, 10);
      var d = new Date(s + 'T00:00:00');
      return isNaN(d.getTime()) ? null : d;
    }
    function dateStr(d) {
      if (!d) return '';
      return d.toISOString().substring(0, 10);
    }

    function gfp(fn) { if (!fn) return null; var nm = fn.toLowerCase(), idx = nm.indexOf('_'); return idx > 0 ? nm.substring(0, idx) : null; }
    var genericCores = ['id','name','type','date','value','status','code','key','count','sum','avg','min','max','total','amount','number','num','flag','is','has'];
    var levelIndicators = ['ad','ads','campaign','campaigns','section','publisher','marketer','advertiser','account','user','website','order','line_item','lineitem','creative','placement','daily','weekly','monthly','hourly','yearly','agg','aggregate','summary','rollup'];
    function extractLevels(vn) {
      if (!vn) return [];
      var nm = vn.toLowerCase(), found = [];
      levelIndicators.forEach(function(lv) { if (nm.indexOf(lv) !== -1) { var idx = nm.indexOf(lv), bef = idx === 0 ? '_' : nm[idx-1], aft = idx+lv.length >= nm.length ? '_' : nm[idx+lv.length]; if ((bef==='_'||bef==='-'||idx===0)&&(aft==='_'||aft==='-'||idx+lv.length===nm.length)) found.push(lv); } });
      return found;
    }
    function hasDifferentLevels(v1, v2) {
      var l1 = extractLevels(v1), l2 = extractLevels(v2);
      if (l1.length > 0 && l2.length > 0) { var norm = function(l) { if (l.indexOf('ad')===0) return 'ad'; if (l.indexOf('campaign')===0) return 'campaign'; if (l.indexOf('account')===0) return 'account'; if (l.indexOf('user')===0) return 'user'; return l; }; var n1=l1.map(norm),n2=l2.map(norm); if (n1.filter(function(x){return n2.indexOf(x)===-1;}).length>0||n2.filter(function(x){return n1.indexOf(x)===-1;}).length>0) return true; }
      return false;
    }
    function gfc(fn) { if (!fn) return ''; var nm = fn.toLowerCase(), idx = nm.indexOf('_'); return (idx > 0 && idx < 6) ? nm.substring(idx+1) : nm; }
    function igc(c) { return !c || c.length <= 2 || genericCores.indexOf(c) !== -1; }

    // Parse all rows
    var allRowsRaw = [];
    var allDates = {};
    data.forEach(function(row) {
      var fv = fieldsField && row[fieldsField] ? row[fieldsField].value || '' : '';
      var rf = fv ? fv.split('|').map(function(f){return f.trim();}).filter(function(f){return f.length>0&&f.indexOf('.')===-1;}) : [];
      var modelVal = '';
      if (modelField && row[modelField]) modelVal = row[modelField].value || '';
      if (!modelVal) { Object.keys(row).forEach(function(key) { if (key.toLowerCase().indexOf('model')!==-1 && row[key] && row[key].value) modelVal = row[key].value; }); }
      if (!modelVal && expField && row[expField] && row[expField].value) { var ev = row[expField].value; if (ev.indexOf('.')!==-1) modelVal = ev.split('.')[0]; }

      var dateVal = dateField && row[dateField] ? row[dateField].value || '' : '';
      var parsedDate = parseDate(dateVal);
      if (parsedDate) allDates[dateStr(parsedDate)] = parsedDate;

      var viewCount = 0;
      if (dashViewCountField && row[dashViewCountField]) {
        viewCount = parseFloat(row[dashViewCountField].value) || 0;
      }

      allRowsRaw.push({
        dashboard: dashField && row[dashField] ? row[dashField].value||'' : '',
        dashboardId: dashIdField && row[dashIdField] ? row[dashIdField].value||'' : '',
        explore: expField && row[expField] ? row[expField].value||'' : '',
        view: viewField && row[viewField] ? row[viewField].value||'' : '',
        table: tableField && row[tableField] ? row[tableField].value||'' : '',
        model: modelVal, fields: rf,
        extendedView: extendedViewField && row[extendedViewField] ? row[extendedViewField].value||'' : '',
        includedView: includedViewField && row[includedViewField] ? row[includedViewField].value||'' : '',
        date: parsedDate,
        dateStr: parsedDate ? dateStr(parsedDate) : '',
        viewCount: viewCount
      });
    });

    // Find max date
    var sortedDates = Object.keys(allDates).sort();
    var maxDateStr = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : '';
    var maxDate = maxDateStr ? allDates[maxDateStr] : null;

    // Compute 30-day cutoff
    var cutoff30 = null;
    if (maxDate) {
      cutoff30 = new Date(maxDate);
      cutoff30.setDate(cutoff30.getDate() - 30);
    }

    console.log('Date range:', sortedDates[0], '→', maxDateStr, '| Total rows:', totalRows, '| Unique dates:', sortedDates.length);

    // --- Deduplicate helper ---
    function dedup(rows) {
      var seen = {}, out = [];
      rows.forEach(function(r) {
        var key = [r.dashboard,r.explore,r.view,r.table,r.model,r.extendedView,r.includedView].join('||');
        if (seen[key]) {
          var ex = seen[key];
          r.fields.forEach(function(f) { if (ex.fields.indexOf(f)===-1) ex.fields.push(f); });
          ex.viewCount = Math.max(ex.viewCount || 0, r.viewCount || 0);
        } else { seen[key] = r; out.push(r); }
      });
      return out;
    }

    // MAX DAY rows (for lineage & overlap)
    var maxDayRows = dedup(allRowsRaw.filter(function(r) { return r.dateStr === maxDateStr; }));

    // ALL rows last 30 days (for unused)
    var last30Rows = allRowsRaw.filter(function(r) { return r.date && cutoff30 && r.date >= cutoff30; });

    console.log('Max day rows:', maxDayRows.length, '| Last 30 day rows:', last30Rows.length);

    // =============================================
    // CASCADING FILTERS (operate on active tab's data)
    // =============================================
    var filterOrder = ['model','dashboard','explore','view','table'];
    var filters = { model:'', dashboard:'', explore:'', view:'', table:'' };
    var filterSearch = { model:'', dashboard:'', explore:'', view:'', table:'' };
    var openDropdown = null;

    function getActiveRows() {
      return activeTab === 'unused' ? dedup(last30Rows) : maxDayRows;
    }

    function getCascadedOptions() {
      var base = getActiveRows();
      var result = {};
      filterOrder.forEach(function(key, idx) {
        var rows = base.filter(function(r) {
          for (var i = 0; i < idx; i++) {
            var k = filterOrder[i];
            if (filters[k] && r[k] !== filters[k]) return false;
          }
          return true;
        });
        var vals = {};
        rows.forEach(function(r) { if (r[key] && r[key].trim()) vals[r[key]] = true; });
        result[key] = Object.keys(vals).sort();
      });
      return result;
    }

    function getAllUniqueValues() {
      var base = getActiveRows();
      var uv = { model:{}, dashboard:{}, explore:{}, view:{}, table:{} };
      base.forEach(function(r) {
        if (r.model && r.model.trim()) uv.model[r.model] = true;
        if (r.dashboard && r.dashboard.trim()) uv.dashboard[r.dashboard] = true;
        if (r.explore && r.explore.trim()) uv.explore[r.explore] = true;
        if (r.view && r.view.trim()) uv.view[r.view] = true;
        if (r.table && r.table.trim()) uv.table[r.table] = true;
      });
      return uv;
    }

    function getFilteredRows() {
      return getActiveRows().filter(function(r) {
        for (var i = 0; i < filterOrder.length; i++) {
          var k = filterOrder[i];
          if (filters[k] && r[k] !== filters[k]) return false;
        }
        return true;
      });
    }

    // --- Build entities from filtered rows ---
    var tbls={},vws={},exps={},dashs={},viewToTables={},viewToViews={},exploreToViews={},dashToExplores={},viewModels={};
    function buildEntities() {
      tbls={};vws={};exps={};dashs={};viewToTables={};viewToViews={};exploreToViews={};dashToExplores={};viewModels={};
      var fr = getFilteredRows();
      fr.forEach(function(r) {
        if (r.table && !tbls[r.table]) tbls[r.table]={id:'t_'+r.table,name:r.table,type:'table',sources:[],fields:[]};
        if (r.view && !vws[r.view]) vws[r.view]={id:'v_'+r.view,name:r.view,type:'view',sources:[],fields:[],model:null};
        if (r.explore && !exps[r.explore]) exps[r.explore]={id:'e_'+r.explore,name:r.explore,type:'explore',sources:[],fields:[],model:r.model};
        if (r.dashboard && !dashs[r.dashboard]) dashs[r.dashboard]={id:'d_'+r.dashboard,name:r.dashboard,type:'dashboard',sources:[],fields:[],viewCount:0};
        if (r.extendedView && !vws[r.extendedView]) vws[r.extendedView]={id:'v_'+r.extendedView,name:r.extendedView,type:'view',sources:[],fields:[],model:null};
        if (r.includedView && !vws[r.includedView]) vws[r.includedView]={id:'v_'+r.includedView,name:r.includedView,type:'view',sources:[],fields:[],model:null};
      });
      fr.forEach(function(r) {
        if (r.view&&r.model){if(!viewModels[r.view])viewModels[r.view]={};viewModels[r.view][r.model]=true;}
        if (r.table&&tbls[r.table]) r.fields.forEach(function(f){if(tbls[r.table].fields.indexOf(f)===-1)tbls[r.table].fields.push(f);});
        if (r.view&&vws[r.view]) r.fields.forEach(function(f){if(vws[r.view].fields.indexOf(f)===-1)vws[r.view].fields.push(f);});
        if (r.explore&&exps[r.explore]) r.fields.forEach(function(f){if(exps[r.explore].fields.indexOf(f)===-1)exps[r.explore].fields.push(f);});
        if (r.dashboard&&dashs[r.dashboard]) r.fields.forEach(function(f){if(dashs[r.dashboard].fields.indexOf(f)===-1)dashs[r.dashboard].fields.push(f);});
        if (r.view&&r.table){if(!viewToTables[r.view])viewToTables[r.view]={};viewToTables[r.view]['t_'+r.table]=true;}
        if (r.view&&r.extendedView&&r.view!==r.extendedView){if(!viewToViews[r.view])viewToViews[r.view]={};viewToViews[r.view]['v_'+r.extendedView]=true;}
        if (r.view&&r.includedView&&r.view!==r.includedView){if(!viewToViews[r.view])viewToViews[r.view]={};viewToViews[r.view]['v_'+r.includedView]=true;}
        if (r.explore&&r.view){if(!exploreToViews[r.explore])exploreToViews[r.explore]={};exploreToViews[r.explore]['v_'+r.view]=true;}
        if (r.dashboard&&r.explore){if(!dashToExplores[r.dashboard])dashToExplores[r.dashboard]={};dashToExplores[r.dashboard]['e_'+r.explore]=true;}
      });
      Object.keys(vws).forEach(function(vw){if(viewModels[vw])vws[vw].model=Object.keys(viewModels[vw]).join(', ');});
      Object.keys(vws).forEach(function(k){vws[k].sources=Object.keys(viewToTables[k]||{}).concat(Object.keys(viewToViews[k]||{}));});
      Object.keys(exps).forEach(function(k){exps[k].sources=Object.keys(exploreToViews[k]||{});});
      Object.keys(dashs).forEach(function(k){dashs[k].sources=Object.keys(dashToExplores[k]||{});});
    }
    function getAllEntities(){return Object.values(tbls).concat(Object.values(vws)).concat(Object.values(exps)).concat(Object.values(dashs));}

    var activeTab='lineage', selectedNode=null, upstream=[], downstream=[], expandedDuplicates={};
    var similarResults=null, analysisLoading=false, analysisError=null, dismissedWarning=false;
    var unusedSort = { col: 'type', dir: 'asc' };

    var icons = {
      lineage:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l4-6h2M11 12l4 6h2"/></svg>',
      overlap:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>',
      unused:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
      chevronDown:'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
      chevronUp:'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>',
      x:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      warning:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      filter:'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>'
    };
    var typeIcons = {
      table:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="9" width="8" height="3"/><rect x="13" y="9" width="8" height="3"/><rect x="3" y="14" width="8" height="3"/><rect x="13" y="14" width="8" height="3"/></svg>',
      view:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7z"/></svg>',
      explore:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
      dashboard:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="2" y="2" width="9" height="6" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="10" width="9" height="12" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>'
    };
    var typeConfig = {table:{color:'#06b6d4',label:'Tables'},view:{color:'#8b5cf6',label:'Views'},explore:{color:'#ec4899',label:'Explores'},dashboard:{color:'#f97316',label:'Dashboards'}};
    var filterColors = {model:'#22d3ee',dashboard:'#f97316',explore:'#ec4899',view:'#8b5cf6',table:'#06b6d4'};

    function getUpstream(id,d,v){var ae=getAllEntities();if(d>15)return[];v=v||{};if(v[id])return[];v[id]=true;var e=ae.find(function(x){return x.id===id;});if(!e||!e.sources)return[];var r=[];e.sources.forEach(function(s){if(!v[s]){r.push(s);r=r.concat(getUpstream(s,(d||0)+1,v));}});return r.filter(function(x,i,a){return a.indexOf(x)===i;});}
    function getDownstream(id,d,v){var ae=getAllEntities();if(d>15)return[];v=v||{};if(v[id])return[];v[id]=true;var r=[];ae.forEach(function(e){if(e.sources&&e.sources.indexOf(id)!==-1&&!v[e.id]){r.push(e.id);r=r.concat(getDownstream(e.id,(d||0)+1,v));}});return r.filter(function(x,i,a){return a.indexOf(x)===i;});}

    function findDuplicateFields(v1,v2) {
      var matches=[],p1={},p2={},v1P=null,v2P=null;
      v1.fields.forEach(function(f){var p=gfp(f);if(p)p1[p]=(p1[p]||0)+1;});
      v2.fields.forEach(function(f){var p=gfp(f);if(p)p2[p]=(p2[p]||0)+1;});
      var m1=0,m2=0;Object.keys(p1).forEach(function(p){if(p1[p]>m1){m1=p1[p];v1P=p;}});Object.keys(p2).forEach(function(p){if(p2[p]>m2){m2=p2[p];v2P=p;}});
      var sameDomain=!v1P||!v2P||v1P===v2P,v1M={},v2M={};
      v1.fields.forEach(function(f1){if(v1M[f1.toLowerCase()])return;v2.fields.forEach(function(f2){if(v2M[f2.toLowerCase()])return;if(f1.toLowerCase()===f2.toLowerCase()){matches.push({f1:f1,f2:f2,type:'exact'});v1M[f1.toLowerCase()]=true;v2M[f2.toLowerCase()]=true;}});});
      if(sameDomain){var v1ByCore={};v1.fields.forEach(function(f){if(v1M[f.toLowerCase()])return;var c=gfc(f);if(c&&!igc(c)){if(!v1ByCore[c])v1ByCore[c]=[];v1ByCore[c].push(f);}});v2.fields.forEach(function(f2){if(v2M[f2.toLowerCase()])return;var c=gfc(f2);if(c&&!igc(c)&&v1ByCore[c]&&v1ByCore[c].length>0){for(var i=0;i<v1ByCore[c].length;i++){var f1=v1ByCore[c][i];if(!v1M[f1.toLowerCase()]){matches.push({f1:f1,f2:f2,type:'similar',core:c});v1M[f1.toLowerCase()]=true;v2M[f2.toLowerCase()]=true;break;}}}});}
      return {matches:matches,sameDomain:sameDomain,v1Only:v1.fields.filter(function(f){return !v1M[f.toLowerCase()];}),v2Only:v2.fields.filter(function(f){return !v2M[f.toLowerCase()];})};
    }

    function runAnalysis() {
      if(analysisLoading)return;analysisLoading=true;analysisError=null;render();
      setTimeout(function(){
        try {
          var results=[],vl=Object.values(vws).filter(function(v){return v.fields&&v.fields.length>=5;});
          for(var i=0;i<vl.length;i++){for(var j=i+1;j<vl.length;j++){var v1=vl[i],v2=vl[j],a=findDuplicateFields(v1,v2);if(!a.sameDomain||hasDifferentLevels(v1.name,v2.name))continue;var em=a.matches.filter(function(m){return m.type==='exact';}),sm=a.matches.filter(function(m){return m.type==='similar';});var minF=Math.min(v1.fields.length,v2.fields.length),score=(em.length+sm.length*0.5)/minF,sim=Math.round(score*100);if(em.length>=5||em.length/minF>=0.4||(a.matches.length/minF>=0.6))results.push({v1:v1.name,v2:v2.name,v1Model:v1.model||'-',v2Model:v2.model||'-',similarity:Math.min(sim,100),exactCount:em.length,similarCount:sm.length,v1FieldCount:v1.fields.length,v2FieldCount:v2.fields.length,exactMatches:em,similarMatches:sm,v1Only:a.v1Only,v2Only:a.v2Only});}}
          results.sort(function(a,b){return b.similarity-a.similarity;});similarResults=results.slice(0,100);analysisLoading=false;render();
        }catch(e){similarResults=[];analysisError='Error: '+e.message;analysisLoading=false;render();}
      },100);
    }

    // =============================================
    // UNUSED TAB: find dashboards/explores/views with 0 usage in last 30 days
    // =============================================
    function getUnusedAssets() {
      // Collect all assets that exist on max day
      var maxDayAssets = { dashboards:{}, explores:{}, views:{} };
      maxDayRows.forEach(function(r) {
        if (r.dashboard) maxDayAssets.dashboards[r.dashboard] = { name:r.dashboard, model:r.model, type:'dashboard' };
        if (r.explore) maxDayAssets.explores[r.explore] = { name:r.explore, model:r.model, type:'explore' };
        if (r.view) maxDayAssets.views[r.view] = { name:r.view, model:r.model, type:'view' };
      });

      // Track which assets appear in last 30 days with view counts
      var usedDashboards = {}, usedExplores = {}, usedViews = {};
      var dashViewCounts = {};
      last30Rows.forEach(function(r) {
        if (r.dashboard) { usedDashboards[r.dashboard] = true; dashViewCounts[r.dashboard] = (dashViewCounts[r.dashboard] || 0) + (r.viewCount || 0); }
        if (r.explore) usedExplores[r.explore] = true;
        if (r.view) usedViews[r.view] = true;
      });

      var unused = [];

      // Find dashboards with 0 views in 30 days
      Object.keys(maxDayAssets.dashboards).forEach(function(name) {
        var a = maxDayAssets.dashboards[name];
        var vc = dashViewCounts[name] || 0;
        if (vc === 0) {
          unused.push({ name:name, type:'dashboard', model:a.model, reason:'0 views in last 30 days' });
        }
      });

      // Find explores that exist but have no dashboard usage in 30 days
      // An explore is "unused" if no dashboard references it in the last 30 days
      var dashExplores30 = {};
      last30Rows.forEach(function(r) {
        if (r.dashboard && r.explore) dashExplores30[r.explore] = true;
      });
      Object.keys(maxDayAssets.explores).forEach(function(name) {
        if (!dashExplores30[name]) {
          var a = maxDayAssets.explores[name];
          unused.push({ name:name, type:'explore', model:a.model, reason:'Not referenced by any dashboard in last 30 days' });
        }
      });

      // Find views that exist but are not referenced by any explore in 30 days
      var exploreViews30 = {};
      last30Rows.forEach(function(r) {
        if (r.explore && r.view) exploreViews30[r.view] = true;
      });
      Object.keys(maxDayAssets.views).forEach(function(name) {
        if (!exploreViews30[name]) {
          var a = maxDayAssets.views[name];
          unused.push({ name:name, type:'view', model:a.model, reason:'Not referenced by any explore in last 30 days' });
        }
      });

      // Apply current filters
      unused = unused.filter(function(item) {
        if (filters.model && item.model !== filters.model) return false;
        return true;
      });

      // Sort
      unused.sort(function(a, b) {
        var va, vb;
        if (unusedSort.col === 'type') { va = a.type; vb = b.type; }
        else if (unusedSort.col === 'name') { va = a.name; vb = b.name; }
        else if (unusedSort.col === 'model') { va = a.model||''; vb = b.model||''; }
        else { va = a.reason; vb = b.reason; }
        var cmp = va.localeCompare(vb);
        return unusedSort.dir === 'asc' ? cmp : -cmp;
      });

      return unused;
    }

    function renderUnusedTab() {
      var unused = getUnusedAssets();
      var byType = { dashboard:0, explore:0, view:0 };
      unused.forEach(function(u) { byType[u.type]++; });

      var h = '<div style="padding:10px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;">';
      h += '<div style="color:#94a3b8;font-size:11px;">Unused assets <span style="color:#64748b;">(last 30 days vs max day)</span></div>';
      h += '<div style="display:flex;gap:12px;font-size:11px;">';
      h += '<span><span style="color:#f97316;font-weight:600;">' + byType.dashboard + '</span> <span style="color:#64748b;">dashboards</span></span>';
      h += '<span><span style="color:#ec4899;font-weight:600;">' + byType.explore + '</span> <span style="color:#64748b;">explores</span></span>';
      h += '<span><span style="color:#8b5cf6;font-weight:600;">' + byType.view + '</span> <span style="color:#64748b;">views</span></span>';
      h += '<span style="color:#e2e8f0;font-weight:600;">' + unused.length + ' <span style="color:#64748b;">total</span></span>';
      h += '</div></div>';

      if (unused.length === 0) {
        h += '<div style="text-align:center;padding:40px;color:#10b981;font-size:12px;">No unused assets found</div>';
        return h;
      }

      // Table header
      var cols = [
        { key:'type', label:'Type', w:'80px' },
        { key:'name', label:'Name', w:'1fr' },
        { key:'model', label:'Model', w:'150px' },
        { key:'reason', label:'Reason', w:'1fr' }
      ];
      h += '<div style="overflow-y:auto;max-height:calc(100vh - 240px);">';
      h += '<div style="display:grid;grid-template-columns:80px 1fr 150px 1fr;border-bottom:1px solid #1e293b;position:sticky;top:0;background:#0f172a;z-index:1;">';
      cols.forEach(function(col) {
        var isActive = unusedSort.col === col.key;
        var arrow = isActive ? (unusedSort.dir === 'asc' ? ' ↑' : ' ↓') : '';
        h += '<div class="sort-col" data-col="' + col.key + '" style="padding:8px 10px;font-size:10px;font-weight:600;color:' + (isActive ? '#e2e8f0' : '#64748b') + ';cursor:pointer;user-select:none;">' + col.label + arrow + '</div>';
      });
      h += '</div>';

      unused.forEach(function(item) {
        var cfg = typeConfig[item.type];
        h += '<div style="display:grid;grid-template-columns:80px 1fr 150px 1fr;border-bottom:1px solid #1e293b20;" onmouseover="this.style.background=\'#1e293b40\'" onmouseout="this.style.background=\'transparent\'">';
        h += '<div style="padding:6px 10px;display:flex;align-items:center;gap:4px;"><span style="color:' + cfg.color + ';">' + typeIcons[item.type] + '</span><span style="font-size:10px;color:' + cfg.color + ';">' + item.type + '</span></div>';
        h += '<div style="padding:6px 10px;font-size:11px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + item.name + '</div>';
        h += '<div style="padding:6px 10px;font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (item.model || '-') + '</div>';
        h += '<div style="padding:6px 10px;font-size:10px;color:#f59e0b;">' + item.reason + '</div>';
        h += '</div>';
      });
      h += '</div>';
      return h;
    }

    function renderTruncationWarning() {
      if (!isTruncated || dismissedWarning) return '';
      return '<div id="truncation-warning" style="margin:8px 16px;padding:10px 14px;background:#78350f20;border:1px solid #f59e0b40;border-radius:8px;display:flex;align-items:flex-start;gap:10px;">' +
        '<span style="color:#f59e0b;flex-shrink:0;margin-top:1px;">' + icons.warning + '</span>' +
        '<div style="flex:1;">' +
          '<div style="color:#fbbf24;font-size:12px;font-weight:600;margin-bottom:4px;">Data Truncated — ' + totalRows + ' rows loaded</div>' +
          '<div style="color:#d97706;font-size:11px;line-height:1.5;">Use a <strong>Looker dashboard filter</strong> (e.g. Model) to reduce data at the SQL level.</div>' +
        '</div>' +
        '<span id="dismiss-warning" style="color:#92400e;cursor:pointer;flex-shrink:0;padding:2px;">' + icons.x + '</span>' +
      '</div>';
    }

    function renderFilters() {
      var cascaded = getCascadedOptions();
      var allUniq = getAllUniqueValues();
      var activeCount = filterOrder.filter(function(k) { return filters[k]; }).length;
      var h = '<div style="display:flex;align-items:center;gap:6px;padding:6px 16px;background:#0f172a;border-bottom:1px solid #1e293b;flex-wrap:wrap;">';
      h += '<span style="color:#64748b;font-size:10px;display:flex;align-items:center;gap:4px;">' + icons.filter + ' Filters:</span>';
      filterOrder.forEach(function(key) {
        var color = filterColors[key];
        var label = key.charAt(0).toUpperCase() + key.slice(1);
        var isActive = filters[key];
        var isOpen = openDropdown === key;
        var searchVal = filterSearch[key] || '';
        var opts = cascaded[key] || [];
        var filteredOpts = opts.filter(function(o) { return !searchVal || o.toLowerCase().indexOf(searchVal.toLowerCase()) !== -1; });
        var totalCount = Object.keys(allUniq[key] || {}).length;
        var availCount = opts.length;
        h += '<div style="position:relative;">';
        h += '<div class="filter-trigger" data-filter="' + key + '" style="display:flex;align-items:center;gap:4px;background:' + (isActive ? color + '20' : '#1e293b') + ';border:1px solid ' + (isActive ? color : '#334155') + ';padding:4px 8px;border-radius:4px;cursor:pointer;font-size:10px;color:' + (isActive ? color : '#94a3b8') + ';">';
        h += '<span>' + label + '</span>';
        if (isActive) h += '<span style="color:#e2e8f0;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">: ' + filters[key] + '</span>';
        else h += '<span style="color:#64748b;">(' + availCount + (availCount !== totalCount ? '/' + totalCount : '') + ')</span>';
        h += icons.chevronDown + '</div>';
        if (isOpen) {
          h += '<div style="position:absolute;top:100%;left:0;background:#1e293b;border:1px solid #475569;border-radius:6px;z-index:1000;margin-top:4px;box-shadow:0 10px 25px rgba(0,0,0,0.5);max-height:300px;display:flex;flex-direction:column;min-width:200px;">';
          h += '<div style="padding:6px;border-bottom:1px solid #334155;"><input class="filter-search-input" data-filter="' + key + '" type="text" value="' + searchVal + '" placeholder="Search ' + label + '..." style="width:100%;background:#0f172a;border:1px solid #334155;color:#e2e8f0;padding:5px 8px;border-radius:4px;font-size:11px;outline:none;box-sizing:border-box;"/></div>';
          h += '<div style="overflow-y:auto;flex:1;">';
          if (isActive) h += '<div class="filter-option" data-filter="' + key + '" data-value="" style="padding:6px 10px;cursor:pointer;font-size:11px;color:#f87171;border-bottom:1px solid #1e293b30;">✕ Clear ' + label + '</div>';
          filteredOpts.slice(0, 200).forEach(function(opt) {
            var sel = filters[key] === opt;
            h += '<div class="filter-option" data-filter="' + key + '" data-value="' + opt.replace(/"/g, '&quot;') + '" style="padding:6px 10px;cursor:pointer;font-size:11px;color:' + (sel ? color : '#e2e8f0') + ';background:' + (sel ? color + '20' : 'transparent') + ';">' + opt + '</div>';
          });
          if (filteredOpts.length > 200) h += '<div style="padding:6px;font-size:10px;color:#64748b;text-align:center;">+' + (filteredOpts.length - 200) + ' more</div>';
          if (filteredOpts.length === 0) h += '<div style="padding:10px;font-size:11px;color:#64748b;text-align:center;">No matches</div>';
          h += '</div></div>';
        }
        h += '</div>';
        if (key !== 'table') h += '<span style="color:#334155;font-size:10px;">›</span>';
      });
      if (activeCount > 0) h += '<button class="clear-filters" style="background:transparent;border:1px solid #ef4444;color:#f87171;padding:3px 8px;border-radius:4px;font-size:10px;cursor:pointer;margin-left:4px;">Clear All</button>';
      h += '</div>';
      return h;
    }

    function renderDuplicatesTab() {
      var vc=Object.values(vws).filter(function(v){return v.fields&&v.fields.length>=5;}).length,metrics=null;
      if(similarResults&&similarResults.length>0){var uv={},ts=0;similarResults.forEach(function(p){uv[p.v1]=true;uv[p.v2]=true;ts+=p.similarity;});metrics={totalViews:Object.keys(uv).length,avgSim:Math.round(ts/similarResults.length),totalPairs:similarResults.length};}
      var h='<div style="padding:10px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;"><div style="color:#94a3b8;font-size:11px;">Analyzing <span style="color:#e2e8f0;font-weight:500;">'+vc+'</span> views <span style="color:#475569;">(max day: '+maxDateStr+')</span></div>';
      if(metrics){var sc=metrics.avgSim>=70?'#10b981':metrics.avgSim>=50?'#eab308':'#f97316';h+='<div style="display:flex;gap:16px;font-size:11px;"><span><span style="color:#a78bfa;font-weight:600;">'+metrics.totalViews+'</span> <span style="color:#64748b;">views</span></span><span><span style="color:'+sc+';font-weight:600;">'+metrics.avgSim+'%</span> <span style="color:#64748b;">avg</span></span><span><span style="color:#22d3ee;font-weight:600;">'+metrics.totalPairs+'</span> <span style="color:#64748b;">pairs</span></span></div>';}
      h+='</div>';
      if(analysisLoading)h+='<div style="text-align:center;padding:40px;color:#8b5cf6;font-size:12px;">Analyzing...</div>';
      else if(analysisError)h+='<div style="text-align:center;padding:40px;color:#ef4444;font-size:12px;">'+analysisError+'</div>';
      else if(!similarResults||similarResults.length===0)h+='<div style="text-align:center;padding:40px;color:#10b981;font-size:12px;">No significant overlap found</div>';
      else {
        h+='<div style="overflow-y:auto;max-height:calc(100vh - 260px);">';
        similarResults.forEach(function(p,idx){
          var isExp=expandedDuplicates[idx],sc=p.similarity>=70?'#10b981':p.similarity>=50?'#eab308':'#f97316';
          h+='<div class="dup-row" data-idx="'+idx+'" style="border-bottom:1px solid #1e293b;"><div class="dup-header" style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;" onmouseover="this.style.background=\'#1e293b40\'" onmouseout="this.style.background=\'transparent\'"><div style="min-width:36px;width:36px;height:36px;border-radius:6px;background:'+sc+'15;border:1px solid '+sc+'40;display:flex;align-items:center;justify-content:center;"><span style="font-size:12px;color:'+sc+';font-weight:700;">'+p.similarity+'%</span></div><div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span style="color:#a78bfa;font-size:12px;font-weight:500;">'+p.v1+'</span><span style="color:#475569;font-size:10px;">('+p.v1Model+')</span><span style="color:#334155;">↔</span><span style="color:#a78bfa;font-size:12px;font-weight:500;">'+p.v2+'</span><span style="color:#475569;font-size:10px;">('+p.v2Model+')</span></div><div style="display:flex;gap:10px;margin-top:4px;font-size:10px;color:#64748b;"><span><span style="color:#10b981;">'+p.exactCount+'</span> exact</span>'+(p.similarCount>0?'<span><span style="color:#eab308;">'+p.similarCount+'</span> similar</span>':'')+'<span>'+p.v1FieldCount+' / '+p.v2FieldCount+' fields</span></div></div><span style="color:#475569;">'+(isExp?icons.chevronUp:icons.chevronDown)+'</span></div>';
          if(isExp){h+='<div style="padding:8px 16px 12px;background:#0c1322;"><div style="display:grid;grid-template-columns:1fr 40px 1fr;font-size:10px;border-radius:6px;overflow:hidden;border:1px solid #1e293b;"><div style="padding:8px 10px;background:#1e293b;color:#64748b;font-weight:600;font-size:9px;">'+p.v1+'</div><div style="padding:8px;background:#1e293b;"></div><div style="padding:8px 10px;background:#1e293b;color:#64748b;font-weight:600;font-size:9px;">'+p.v2+'</div>';p.exactMatches.forEach(function(m){h+='<div style="padding:6px 10px;background:#0f172a;color:#e2e8f0;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;">'+m.f1+'</div><div style="padding:6px;background:#0f172a;color:#10b981;text-align:center;border-top:1px solid #1e293b30;font-weight:600;">=</div><div style="padding:6px 10px;background:#0f172a;color:#e2e8f0;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;">'+m.f2+'</div>';});p.similarMatches.forEach(function(m){h+='<div style="padding:6px 10px;background:#1e293b20;color:#fbbf24;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;">'+m.f1+'</div><div style="padding:6px;background:#1e293b20;color:#eab308;text-align:center;border-top:1px solid #1e293b30;">≈</div><div style="padding:6px 10px;background:#1e293b20;color:#fbbf24;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;">'+m.f2+'</div>';});p.v1Only.slice(0,8).forEach(function(f){h+='<div style="padding:6px 10px;background:#0f172a;color:#f87171;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;opacity:0.8;">'+f+'</div><div style="padding:6px;background:#0f172a;color:#334155;text-align:center;border-top:1px solid #1e293b30;">—</div><div style="padding:6px;background:#0f172a;border-top:1px solid #1e293b30;"></div>';});p.v2Only.slice(0,8).forEach(function(f){h+='<div style="padding:6px;background:#0f172a;border-top:1px solid #1e293b30;"></div><div style="padding:6px;background:#0f172a;color:#334155;text-align:center;border-top:1px solid #1e293b30;">—</div><div style="padding:6px 10px;background:#0f172a;color:#f87171;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;opacity:0.8;">'+f+'</div>';});h+='</div></div>';}
          h+='</div>';
        });
        h+='</div>';
      }
      return h;
    }

    function renderLineageTab() {
      var ae=getAllEntities(),visible=ae,mode='';
      if(selectedNode){mode='lineage';upstream=getUpstream(selectedNode.id,0);downstream=getDownstream(selectedNode.id,0);var ids=[selectedNode.id].concat(upstream).concat(downstream);visible=ae.filter(function(e){return ids.indexOf(e.id)!==-1;});}
      var byType={table:[],view:[],explore:[],dashboard:[]};visible.forEach(function(e){byType[e.type].push(e);});['table','view','explore','dashboard'].forEach(function(t){byType[t].sort(function(a,b){return a.name.localeCompare(b.name);});});
      var nodeW=180,nodeH=32,spacing=40,pad=12,svgW=Math.max(containerWidth-24,900),colSp=(svgW-pad*2-nodeW)/3;
      var colX={table:pad,view:pad+colSp,explore:pad+colSp*2,dashboard:pad+colSp*3},pos={},startY=55;
      ['table','view','explore','dashboard'].forEach(function(type){byType[type].forEach(function(e,idx){pos[e.id]={x:colX[type],y:startY+idx*spacing};});});
      var maxC=Math.max(byType.table.length||1,byType.view.length||1,byType.explore.length||1,byType.dashboard.length||1),svgH=Math.max(maxC*spacing+70,250);
      var edges='';visible.forEach(function(e){(e.sources||[]).forEach(function(s){var f=pos[s],t=pos[e.id];if(!f||!t)return;var stroke='#334155',op=0.25,sw=1.5;if(selectedNode){if(s===selectedNode.id||downstream.indexOf(e.id)!==-1){stroke='#f97316';op=0.9;sw=2;}else if(e.id===selectedNode.id||upstream.indexOf(s)!==-1){stroke='#06b6d4';op=0.9;sw=2;}}var x1=f.x+nodeW,y1=f.y+nodeH/2,x2=t.x,y2=t.y+nodeH/2,mx=(x1+x2)/2;edges+='<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-opacity="'+op+'"/>';});});
      var nodes='';visible.forEach(function(entity){var p=pos[entity.id],cfg=typeConfig[entity.type],isSel=selectedNode&&selectedNode.id===entity.id,isUp=selectedNode&&upstream.indexOf(entity.id)!==-1,isDown=selectedNode&&downstream.indexOf(entity.id)!==-1;var bc=cfg.color,bw=1;if(isSel){bc='#ffffff';bw=2;}else if(isUp){bc='#06b6d4';bw=2;}else if(isDown){bc='#f97316';bw=2;}var nm=entity.name.length>22?entity.name.substring(0,20)+'...':entity.name;nodes+='<g class="node" data-id="'+entity.id+'" style="cursor:pointer;" transform="translate('+p.x+','+p.y+')"><rect width="'+nodeW+'" height="'+nodeH+'" rx="6" fill="#0f172a" stroke="'+bc+'" stroke-width="'+bw+'"/><rect x="1" y="1" width="28" height="'+(nodeH-2)+'" rx="5" fill="'+cfg.color+'" fill-opacity="0.15"/><g transform="translate(8,'+(nodeH/2-6)+')" fill="'+cfg.color+'">'+typeIcons[entity.type]+'</g><text x="34" y="'+(nodeH/2+3)+'" fill="#e2e8f0" font-size="9" font-weight="500">'+nm+'</text></g>';});
      var hdr='';['table','view','explore','dashboard'].forEach(function(type){var cfg=typeConfig[type];hdr+='<text x="'+(colX[type]+nodeW/2)+'" y="18" text-anchor="middle" fill="'+cfg.color+'" font-size="8" font-weight="600">'+cfg.label.toUpperCase()+'</text><text x="'+(colX[type]+nodeW/2)+'" y="30" text-anchor="middle" fill="#475569" font-size="8">'+byType[type].length+'</text>';});
      var stats='';if(selectedNode){stats='<span style="color:'+typeConfig[selectedNode.type].color+';">'+selectedNode.name+'</span> <span style="color:#06b6d4;">↑'+upstream.length+'</span> <span style="color:#f97316;">↓'+downstream.length+'</span>';}else{stats='<span style="color:#64748b;">Click node to trace lineage</span>';}
      var r='<div><div style="padding:8px 16px;border-bottom:1px solid #1e293b;font-size:11px;display:flex;justify-content:space-between;"><div>'+stats+' <span style="color:#475569;">('+maxDateStr+')</span></div><div style="color:#64748b;">'+ae.length+' entities</div></div>';
      r+='<div style="padding:8px;overflow:auto;"><svg width="'+svgW+'" height="'+svgH+'" style="font-family:system-ui,sans-serif;">'+hdr+edges+nodes+'</svg></div>';
      return r+'</div>';
    }

    function attachEvents() {
      var ae=getAllEntities();
      container.querySelectorAll('.node').forEach(function(n){
        n.addEventListener('click',function(){
          var id=n.dataset.id,entity=ae.find(function(x){return x.id===id;});
          if(selectedNode&&selectedNode.id===id){selectedNode=null;upstream=[];downstream=[];}
          else{selectedNode=entity;}
          render();
        });
      });
      container.querySelectorAll('.dup-header').forEach(function(hdr){hdr.addEventListener('click',function(){var idx=parseInt(hdr.parentElement.dataset.idx);expandedDuplicates[idx]=!expandedDuplicates[idx];var tc=container.querySelector('#tab-content');if(tc){tc.innerHTML=renderDuplicatesTab();attachEvents();}});});
      container.querySelectorAll('.sort-col').forEach(function(col){
        col.addEventListener('click',function(){
          var c=col.dataset.col;
          if(unusedSort.col===c)unusedSort.dir=unusedSort.dir==='asc'?'desc':'asc';
          else{unusedSort.col=c;unusedSort.dir='asc';}
          var tc=container.querySelector('#tab-content');
          if(tc){tc.innerHTML=renderUnusedTab();attachEvents();}
        });
      });
      var dw=container.querySelector('#dismiss-warning');if(dw)dw.addEventListener('click',function(){dismissedWarning=true;render();});
      // Filter events
      container.querySelectorAll('.filter-trigger').forEach(function(t){
        t.addEventListener('click',function(e){e.stopPropagation();var key=t.dataset.filter;openDropdown=openDropdown===key?null:key;filterSearch[key]='';render();setTimeout(function(){var inp=container.querySelector('.filter-search-input[data-filter="'+key+'"]');if(inp)inp.focus();},50);});
      });
      container.querySelectorAll('.filter-search-input').forEach(function(inp){
        inp.addEventListener('input',function(e){filterSearch[inp.dataset.filter]=e.target.value;render();setTimeout(function(){var ni=container.querySelector('.filter-search-input[data-filter="'+inp.dataset.filter+'"]');if(ni){ni.focus();ni.selectionStart=ni.selectionEnd=ni.value.length;}},10);});
        inp.addEventListener('click',function(e){e.stopPropagation();});
      });
      container.querySelectorAll('.filter-option').forEach(function(opt){
        opt.addEventListener('click',function(e){e.stopPropagation();var key=opt.dataset.filter,val=opt.dataset.value;filters[key]=val;filterSearch[key]='';openDropdown=null;var idx=filterOrder.indexOf(key);for(var i=idx+1;i<filterOrder.length;i++)filters[filterOrder[i]]='';similarResults=null;selectedNode=null;render();if(activeTab==='duplicates')setTimeout(runAnalysis,100);});
        opt.addEventListener('mouseover',function(){opt.style.background='#334155';});
        opt.addEventListener('mouseout',function(){var sel=filters[opt.dataset.filter]===opt.dataset.value;opt.style.background=sel?filterColors[opt.dataset.filter]+'20':'transparent';});
      });
      var clearBtn=container.querySelector('.clear-filters');
      if(clearBtn)clearBtn.addEventListener('click',function(){filterOrder.forEach(function(k){filters[k]='';});similarResults=null;selectedNode=null;render();if(activeTab==='duplicates')setTimeout(runAnalysis,100);});
    }

    document.addEventListener('click',function(e){if(openDropdown&&!e.target.closest('.filter-trigger')&&!e.target.closest('.filter-search-input')&&!e.target.closest('.filter-option')){openDropdown=null;render();}});

    function render() {
      buildEntities();
      var tabDateLabel = activeTab === 'unused' ? '30 days' : maxDateStr;
      var h='<div style="background:#0f172a;height:100%;display:flex;flex-direction:column;">';
      h+='<div style="padding:8px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;">';
      h+='<div style="display:flex;gap:0;">';
      h+='<button class="tab-btn" data-tab="lineage" style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:none;cursor:pointer;font-size:11px;background:'+(activeTab==='lineage'?'#1e293b':'transparent')+';color:'+(activeTab==='lineage'?'#10b981':'#64748b')+';border-radius:6px 0 0 6px;border:1px solid #334155;">'+icons.lineage+' Lineage</button>';
      h+='<button class="tab-btn" data-tab="duplicates" style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:none;cursor:pointer;font-size:11px;background:'+(activeTab==='duplicates'?'#1e293b':'transparent')+';color:'+(activeTab==='duplicates'?'#8b5cf6':'#64748b')+';border:1px solid #334155;border-left:none;">'+icons.overlap+' Overlap</button>';
      h+='<button class="tab-btn" data-tab="unused" style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:none;cursor:pointer;font-size:11px;background:'+(activeTab==='unused'?'#1e293b':'transparent')+';color:'+(activeTab==='unused'?'#f59e0b':'#64748b')+';border-radius:0 6px 6px 0;border:1px solid #334155;border-left:none;">'+icons.unused+' Unused</button>';
      h+='</div>';
      h+='<div style="font-size:11px;color:#64748b;">'+totalRows+' rows · '+sortedDates.length+' days'+(isTruncated?' <span style="color:#f59e0b;">⚠ truncated</span>':'')+'</div>';
      h+='</div>';
      h+=renderTruncationWarning();
      h+=renderFilters();
      h+='<div id="tab-content" style="flex:1;overflow:auto;">';
      if(activeTab==='lineage')h+=renderLineageTab();
      else if(activeTab==='duplicates')h+=renderDuplicatesTab();
      else h+=renderUnusedTab();
      h+='</div></div>';
      container.innerHTML=h;
      container.querySelectorAll('.tab-btn').forEach(function(btn){btn.addEventListener('click',function(){var prev=activeTab;activeTab=btn.dataset.tab;similarResults=null;selectedNode=null;render();if(activeTab==='duplicates'&&!similarResults&&!analysisLoading)setTimeout(runAnalysis,100);});});
      attachEvents();
    }

    buildEntities();render();done();
  }
});

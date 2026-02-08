looker.plugins.visualizations.add({
  id: "field_search",
  label: "Looker Lineage Explorer",
  options: {
    looker_base_url: {
      type: "string",
      label: "Looker Base URL (e.g. https://mycompany.cloud.looker.com)",
      default: "",
      section: "Settings"
    }
  },
  create: function(element, config) {
    element.style.height = '100%';
    element.style.width = '100%';
    element.innerHTML = '<div id="asset-manager-container" style="width:100%;height:100%;overflow:auto;font-family:system-ui,sans-serif;background:#0f172a;"></div>';
  },
  updateAsync: function(data, element, config, queryResponse, details, done) {
    var container = element.querySelector('#asset-manager-container');
    var containerWidth = element.offsetWidth || 1200;
    var baseUrl = (config.looker_base_url || '').replace(/\/+$/, '');

    if (!data || data.length === 0) {
      container.innerHTML = '<div style="padding:40px;color:#64748b;background:#0f172a;">No data available</div>';
      done();
      return;
    }

    var totalRows = data.length;
    var isTruncated = false;
    if (queryResponse && queryResponse.truncated !== undefined) isTruncated = queryResponse.truncated;
    else isTruncated = (totalRows === 5000 || totalRows === 500 || totalRows === 10000);

    var fields = queryResponse.fields.dimension_like.map(function(f) { return f.name; });
    var dashField = fields.find(function(f) { return f.toLowerCase().indexOf('dashboard') !== -1 && f.toLowerCase().indexOf('title') !== -1; });
    var dashIdField = fields.find(function(f) { return f.toLowerCase().indexOf('dashboard_id') !== -1; });
    var expField = fields.find(function(f) { return f.toLowerCase().indexOf('explore') !== -1 && f.toLowerCase().indexOf('name') !== -1; });
    var viewField = fields.find(function(f) { return f.toLowerCase().indexOf('view') !== -1 && f.toLowerCase().indexOf('name') !== -1 && f.toLowerCase().indexOf('count') === -1 && f.toLowerCase().indexOf('extended') === -1 && f.toLowerCase().indexOf('included') === -1; });
    var tableField = fields.find(function(f) { return f.toLowerCase().indexOf('sql_table') !== -1 && f.toLowerCase().indexOf('fields') === -1 && f.toLowerCase().indexOf('path') === -1; });
    var extViewField = fields.find(function(f) { return f.toLowerCase().indexOf('extended') !== -1 && f.toLowerCase().indexOf('view') !== -1; });
    var incViewField = fields.find(function(f) { return f.toLowerCase().indexOf('included') !== -1 && f.toLowerCase().indexOf('view') !== -1; });
    var fieldsField = fields.find(function(f) { return f.toLowerCase().indexOf('sql_table_fields') !== -1; });
    var dateField = fields.find(function(f) { return f.toLowerCase().indexOf('stats_date') !== -1 || f.toLowerCase().indexOf('date') !== -1; });
    var modelField = fields.find(function(f) {
      var fl = f.toLowerCase();
      return fl.indexOf('.model') !== -1 || fl.endsWith('model_name') || fl === 'model' || (fl.indexOf('model') !== -1 && fl.indexOf('name') !== -1);
    });
    if (!modelField) modelField = fields.find(function(f) { return f.toLowerCase().indexOf('model') !== -1; });
    var dashViewCountField = null;
    if (queryResponse.fields.measure_like) {
      dashViewCountField = queryResponse.fields.measure_like.map(function(f){return f.name;}).find(function(f) {
        return f.toLowerCase().indexOf('view_count') !== -1 || f.toLowerCase().indexOf('dashboard_view') !== -1;
      });
    }

    function parseDate(v) { if (!v) return null; var d = new Date(String(v).substring(0,10)+'T00:00:00'); return isNaN(d.getTime()) ? null : d; }
    function dateStr(d) { return d ? d.toISOString().substring(0,10) : ''; }
    function gfp(fn) { if (!fn) return null; var nm = fn.toLowerCase(), i = nm.indexOf('_'); return i > 0 ? nm.substring(0,i) : null; }
    var genericCores = ['id','name','type','date','value','status','code','key','count','sum','avg','min','max','total','amount','number','num','flag','is','has'];
    var levelIndicators = ['ad','ads','campaign','campaigns','section','publisher','marketer','advertiser','account','user','website','order','line_item','lineitem','creative','placement','daily','weekly','monthly','hourly','yearly','agg','aggregate','summary','rollup'];
    function extractLevels(vn) { if (!vn) return []; var nm = vn.toLowerCase(), f = []; levelIndicators.forEach(function(lv) { if (nm.indexOf(lv) !== -1) { var i = nm.indexOf(lv), b = i===0?'_':nm[i-1], a = i+lv.length>=nm.length?'_':nm[i+lv.length]; if ((b==='_'||b==='-'||i===0)&&(a==='_'||a==='-'||i+lv.length===nm.length)) f.push(lv); } }); return f; }
    function hasDifferentLevels(v1,v2) { var l1=extractLevels(v1),l2=extractLevels(v2); if(l1.length>0&&l2.length>0){var n=function(l){if(l.indexOf('ad')===0)return'ad';if(l.indexOf('campaign')===0)return'campaign';if(l.indexOf('account')===0)return'account';if(l.indexOf('user')===0)return'user';return l;};var n1=l1.map(n),n2=l2.map(n);if(n1.filter(function(x){return n2.indexOf(x)===-1;}).length>0||n2.filter(function(x){return n1.indexOf(x)===-1;}).length>0)return true;}return false; }
    function gfc(fn) { if(!fn) return ''; var nm=fn.toLowerCase(),i=nm.indexOf('_'); return (i>0&&i<6)?nm.substring(i+1):nm; }
    function igc(c) { return !c||c.length<=2||genericCores.indexOf(c)!==-1; }

    // Parse rows
    var allRowsRaw = [], allDates = {};
    data.forEach(function(row) {
      var fv = fieldsField && row[fieldsField] ? row[fieldsField].value||'' : '';
      var rf = fv ? fv.split('|').map(function(f){return f.trim();}).filter(function(f){return f.length>0&&f.indexOf('.')===-1;}) : [];
      var mv = '';
      if (modelField && row[modelField]) mv = row[modelField].value||'';
      if (!mv) Object.keys(row).forEach(function(k){ if(k.toLowerCase().indexOf('model')!==-1&&row[k]&&row[k].value) mv=row[k].value; });
      if (!mv && expField && row[expField] && row[expField].value) { var ev=row[expField].value; if(ev.indexOf('.')!==-1) mv=ev.split('.')[0]; }
      var dv = dateField && row[dateField] ? row[dateField].value||'' : '';
      var pd = parseDate(dv);
      if (pd) allDates[dateStr(pd)] = pd;
      var vc = dashViewCountField && row[dashViewCountField] ? parseFloat(row[dashViewCountField].value)||0 : 0;
      allRowsRaw.push({
        dashboard: dashField&&row[dashField]?row[dashField].value||'':'',
        dashboardId: dashIdField&&row[dashIdField]?row[dashIdField].value||'':'',
        explore: expField&&row[expField]?row[expField].value||'':'',
        view: viewField&&row[viewField]?row[viewField].value||'':'',
        table: tableField&&row[tableField]?row[tableField].value||'':'',
        model: mv, fields: rf,
        extendedView: extViewField&&row[extViewField]?row[extViewField].value||'':'',
        includedView: incViewField&&row[incViewField]?row[incViewField].value||'':'',
        date: pd, dateStr: pd?dateStr(pd):'', viewCount: vc
      });
    });

    var sortedDates = Object.keys(allDates).sort();
    var maxDateStr = sortedDates.length>0 ? sortedDates[sortedDates.length-1] : '';
    var maxDate = maxDateStr ? allDates[maxDateStr] : null;
    var cutoff30 = null;
    if (maxDate) { cutoff30 = new Date(maxDate); cutoff30.setDate(cutoff30.getDate()-30); }

    function dedup(rows) {
      var seen={}, out=[];
      rows.forEach(function(r) {
        var k=[r.dashboard,r.explore,r.view,r.table,r.model,r.extendedView,r.includedView].join('||');
        if(seen[k]){var ex=seen[k];r.fields.forEach(function(f){if(ex.fields.indexOf(f)===-1)ex.fields.push(f);});ex.viewCount=Math.max(ex.viewCount||0,r.viewCount||0);}
        else{seen[k]=r;out.push(r);}
      });
      return out;
    }

    var maxDayRows = dedup(allRowsRaw.filter(function(r){return r.dateStr===maxDateStr;}));
    var last30Rows = allRowsRaw.filter(function(r){return r.date&&cutoff30&&r.date>=cutoff30;});

    // Build entities
    var tbls={},vws={},exps={},dashs={},v2t={},v2v={},e2v={},d2e={},vModels={};
    function buildEntities(rows) {
      tbls={};vws={};exps={};dashs={};v2t={};v2v={};e2v={};d2e={};vModels={};
      rows.forEach(function(r) {
        if(r.table&&!tbls[r.table]) tbls[r.table]={id:'t_'+r.table,name:r.table,type:'table',sources:[],fields:[]};
        if(r.view&&!vws[r.view]) vws[r.view]={id:'v_'+r.view,name:r.view,type:'view',sources:[],fields:[],model:null};
        if(r.explore&&!exps[r.explore]) exps[r.explore]={id:'e_'+r.explore,name:r.explore,type:'explore',sources:[],fields:[],model:r.model};
        if(r.dashboard&&!dashs[r.dashboard]) dashs[r.dashboard]={id:'d_'+r.dashboard,name:r.dashboard,type:'dashboard',sources:[],fields:[],dashboardId:r.dashboardId};
        if(r.extendedView&&!vws[r.extendedView]) vws[r.extendedView]={id:'v_'+r.extendedView,name:r.extendedView,type:'view',sources:[],fields:[],model:null};
        if(r.includedView&&!vws[r.includedView]) vws[r.includedView]={id:'v_'+r.includedView,name:r.includedView,type:'view',sources:[],fields:[],model:null};
      });
      rows.forEach(function(r) {
        if(r.view&&r.model){if(!vModels[r.view])vModels[r.view]={};vModels[r.view][r.model]=true;}
        if(r.table&&tbls[r.table])r.fields.forEach(function(f){if(tbls[r.table].fields.indexOf(f)===-1)tbls[r.table].fields.push(f);});
        if(r.view&&vws[r.view])r.fields.forEach(function(f){if(vws[r.view].fields.indexOf(f)===-1)vws[r.view].fields.push(f);});
        if(r.explore&&exps[r.explore])r.fields.forEach(function(f){if(exps[r.explore].fields.indexOf(f)===-1)exps[r.explore].fields.push(f);});
        if(r.dashboard&&dashs[r.dashboard])r.fields.forEach(function(f){if(dashs[r.dashboard].fields.indexOf(f)===-1)dashs[r.dashboard].fields.push(f);});
        if(r.view&&r.table){if(!v2t[r.view])v2t[r.view]={};v2t[r.view]['t_'+r.table]=true;}
        if(r.view&&r.extendedView&&r.view!==r.extendedView){if(!v2v[r.view])v2v[r.view]={};v2v[r.view]['v_'+r.extendedView]=true;}
        if(r.view&&r.includedView&&r.view!==r.includedView){if(!v2v[r.view])v2v[r.view]={};v2v[r.view]['v_'+r.includedView]=true;}
        if(r.explore&&r.view){if(!e2v[r.explore])e2v[r.explore]={};e2v[r.explore]['v_'+r.view]=true;}
        if(r.dashboard&&r.explore){if(!d2e[r.dashboard])d2e[r.dashboard]={};d2e[r.dashboard]['e_'+r.explore]=true;}
      });
      Object.keys(vws).forEach(function(v){if(vModels[v])vws[v].model=Object.keys(vModels[v]).join(', ');});
      Object.keys(vws).forEach(function(k){vws[k].sources=Object.keys(v2t[k]||{}).concat(Object.keys(v2v[k]||{}));});
      Object.keys(exps).forEach(function(k){exps[k].sources=Object.keys(e2v[k]||{});});
      Object.keys(dashs).forEach(function(k){dashs[k].sources=Object.keys(d2e[k]||{});});
    }
    function allEntities(){return Object.values(tbls).concat(Object.values(vws)).concat(Object.values(exps)).concat(Object.values(dashs));}

    var activeTab='lineage',selNode=null,up=[],down=[],expDups={};
    var simResults=null,simLoading=false,simError=null,dismissedWarn=false;
    var unusedSort={col:'type',dir:'asc'};

    var icons={
      lineage:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l4-6h2M11 12l4 6h2"/></svg>',
      overlap:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>',
      unused:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
      chevDown:'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
      chevUp:'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>',
      x:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      warn:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      link:'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
    };
    var tIcons={
      table:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="9" width="8" height="3"/><rect x="13" y="9" width="8" height="3"/><rect x="3" y="14" width="8" height="3"/><rect x="13" y="14" width="8" height="3"/></svg>',
      view:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7z"/></svg>',
      explore:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
      dashboard:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="2" y="2" width="9" height="6" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="10" width="9" height="12" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>'
    };
    var tCfg={table:{color:'#06b6d4',label:'Tables'},view:{color:'#8b5cf6',label:'Views'},explore:{color:'#ec4899',label:'Explores'},dashboard:{color:'#f97316',label:'Dashboards'}};

    // --- Link builders ---
    function buildLink(type, name, model, dashId) {
      if (!baseUrl) return null;
      switch(type) {
        case 'dashboard':
          if (dashId) return baseUrl + '/dashboards/' + dashId;
          return null;
        case 'explore':
          if (model && name) return baseUrl + '/explore/' + model + '/' + name;
          return null;
        case 'view':
          return null; // Views don't have direct URLs
        case 'table':
          return null; // Tables don't have direct Looker URLs
        default: return null;
      }
    }

    function linkHtml(url) {
      if (!url) return '';
      return ' <a href="' + url + '" target="_blank" rel="noopener" style="color:#64748b;opacity:0.7;vertical-align:middle;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">' + icons.link + '</a>';
    }

    function getUp(id,d,v){var ae=allEntities();if(d>15)return[];v=v||{};if(v[id])return[];v[id]=true;var e=ae.find(function(x){return x.id===id;});if(!e||!e.sources)return[];var r=[];e.sources.forEach(function(s){if(!v[s]){r.push(s);r=r.concat(getUp(s,(d||0)+1,v));}});return r.filter(function(x,i,a){return a.indexOf(x)===i;});}
    function getDown(id,d,v){var ae=allEntities();if(d>15)return[];v=v||{};if(v[id])return[];v[id]=true;var r=[];ae.forEach(function(e){if(e.sources&&e.sources.indexOf(id)!==-1&&!v[e.id]){r.push(e.id);r=r.concat(getDown(e.id,(d||0)+1,v));}});return r.filter(function(x,i,a){return a.indexOf(x)===i;});}

    function findDupFields(v1,v2) {
      var m=[],p1={},p2={},v1P=null,v2P=null;
      v1.fields.forEach(function(f){var p=gfp(f);if(p)p1[p]=(p1[p]||0)+1;});
      v2.fields.forEach(function(f){var p=gfp(f);if(p)p2[p]=(p2[p]||0)+1;});
      var m1=0,m2=0;Object.keys(p1).forEach(function(p){if(p1[p]>m1){m1=p1[p];v1P=p;}});Object.keys(p2).forEach(function(p){if(p2[p]>m2){m2=p2[p];v2P=p;}});
      var sd=!v1P||!v2P||v1P===v2P,v1M={},v2M={};
      v1.fields.forEach(function(f1){if(v1M[f1.toLowerCase()])return;v2.fields.forEach(function(f2){if(v2M[f2.toLowerCase()])return;if(f1.toLowerCase()===f2.toLowerCase()){m.push({f1:f1,f2:f2,type:'exact'});v1M[f1.toLowerCase()]=true;v2M[f2.toLowerCase()]=true;}});});
      if(sd){var bc={};v1.fields.forEach(function(f){if(v1M[f.toLowerCase()])return;var c=gfc(f);if(c&&!igc(c)){if(!bc[c])bc[c]=[];bc[c].push(f);}});v2.fields.forEach(function(f2){if(v2M[f2.toLowerCase()])return;var c=gfc(f2);if(c&&!igc(c)&&bc[c]&&bc[c].length>0){for(var i=0;i<bc[c].length;i++){var f1=bc[c][i];if(!v1M[f1.toLowerCase()]){m.push({f1:f1,f2:f2,type:'similar',core:c});v1M[f1.toLowerCase()]=true;v2M[f2.toLowerCase()]=true;break;}}}});}
      return {matches:m,sameDomain:sd,v1Only:v1.fields.filter(function(f){return !v1M[f.toLowerCase()];}),v2Only:v2.fields.filter(function(f){return !v2M[f.toLowerCase()];})};
    }

    function runAnalysis() {
      if(simLoading)return;simLoading=true;simError=null;render();
      setTimeout(function(){
        try {
          var res=[],vl=Object.values(vws).filter(function(v){return v.fields&&v.fields.length>=5;});
          for(var i=0;i<vl.length;i++){for(var j=i+1;j<vl.length;j++){var v1=vl[i],v2=vl[j],a=findDupFields(v1,v2);if(!a.sameDomain||hasDifferentLevels(v1.name,v2.name))continue;var em=a.matches.filter(function(m){return m.type==='exact';}),sm=a.matches.filter(function(m){return m.type==='similar';});var mn=Math.min(v1.fields.length,v2.fields.length),sc=Math.round((em.length+sm.length*0.5)/mn*100);if(em.length>=5||em.length/mn>=0.4||a.matches.length/mn>=0.6)res.push({v1:v1.name,v2:v2.name,v1Model:v1.model||'-',v2Model:v2.model||'-',similarity:Math.min(sc,100),exactCount:em.length,similarCount:sm.length,v1FC:v1.fields.length,v2FC:v2.fields.length,exactMatches:em,similarMatches:sm,v1Only:a.v1Only,v2Only:a.v2Only});}}
          res.sort(function(a,b){return b.similarity-a.similarity;});simResults=res.slice(0,100);simLoading=false;render();
        }catch(e){simResults=[];simError='Error: '+e.message;simLoading=false;render();}
      },100);
    }

    function getUnusedAssets() {
      var maxAssets={d:{},e:{},v:{}};
      maxDayRows.forEach(function(r){
        if(r.dashboard) maxAssets.d[r.dashboard]={name:r.dashboard,model:r.model,dashboardId:r.dashboardId};
        if(r.explore) maxAssets.e[r.explore]={name:r.explore,model:r.model};
        if(r.view) maxAssets.v[r.view]={name:r.view,model:r.model};
      });
      var dvc={},de30={},ev30={};
      last30Rows.forEach(function(r){
        if(r.dashboard){dvc[r.dashboard]=(dvc[r.dashboard]||0)+(r.viewCount||0);}
        if(r.dashboard&&r.explore)de30[r.explore]=true;
        if(r.explore&&r.view)ev30[r.view]=true;
      });
      var unused=[];
      Object.keys(maxAssets.d).forEach(function(n){if((dvc[n]||0)===0)unused.push({name:n,type:'dashboard',model:maxAssets.d[n].model,dashboardId:maxAssets.d[n].dashboardId,reason:'0 views in last 30 days'});});
      Object.keys(maxAssets.e).forEach(function(n){if(!de30[n])unused.push({name:n,type:'explore',model:maxAssets.e[n].model,reason:'Not used by any dashboard (30d)'});});
      Object.keys(maxAssets.v).forEach(function(n){if(!ev30[n])unused.push({name:n,type:'view',model:maxAssets.v[n].model,reason:'Not used by any explore (30d)'});});
      unused.sort(function(a,b){var va,vb;if(unusedSort.col==='type'){va=a.type;vb=b.type;}else if(unusedSort.col==='name'){va=a.name;vb=b.name;}else if(unusedSort.col==='model'){va=a.model||'';vb=b.model||'';}else{va=a.reason;vb=b.reason;}var c=va.localeCompare(vb);return unusedSort.dir==='asc'?c:-c;});
      return unused;
    }

    function renderWarn() {
      if(!isTruncated||dismissedWarn) return '';
      return '<div id="trunc-warn" style="margin:8px 16px;padding:10px 14px;background:#78350f20;border:1px solid #f59e0b40;border-radius:8px;display:flex;align-items:flex-start;gap:10px;"><span style="color:#f59e0b;flex-shrink:0;margin-top:1px;">'+icons.warn+'</span><div style="flex:1;"><div style="color:#fbbf24;font-size:12px;font-weight:600;margin-bottom:4px;">Data Truncated — '+totalRows+' rows loaded</div><div style="color:#d97706;font-size:11px;">Use Looker dashboard filters to reduce data at the SQL level.</div></div><span id="dismiss-warn" style="color:#92400e;cursor:pointer;padding:2px;">'+icons.x+'</span></div>';
    }

    function renderLineage() {
      var ae=allEntities(),vis=ae;
      if(selNode){up=getUp(selNode.id,0);down=getDown(selNode.id,0);var ids=[selNode.id].concat(up).concat(down);vis=ae.filter(function(e){return ids.indexOf(e.id)!==-1;});}
      var bt={table:[],view:[],explore:[],dashboard:[]};vis.forEach(function(e){bt[e.type].push(e);});['table','view','explore','dashboard'].forEach(function(t){bt[t].sort(function(a,b){return a.name.localeCompare(b.name);});});
      var nW=180,nH=32,sp=40,pd=12,sW=Math.max(containerWidth-24,900),cS=(sW-pd*2-nW)/3;
      var cX={table:pd,view:pd+cS,explore:pd+cS*2,dashboard:pd+cS*3},pos={},sY=55;
      ['table','view','explore','dashboard'].forEach(function(t){bt[t].forEach(function(e,i){pos[e.id]={x:cX[t],y:sY+i*sp};});});
      var mC=Math.max(bt.table.length||1,bt.view.length||1,bt.explore.length||1,bt.dashboard.length||1),sH=Math.max(mC*sp+70,250);
      var edges='';vis.forEach(function(e){(e.sources||[]).forEach(function(s){var f=pos[s],t=pos[e.id];if(!f||!t)return;var st='#334155',op=0.25,sw=1.5;if(selNode){if(s===selNode.id||down.indexOf(e.id)!==-1){st='#f97316';op=0.9;sw=2;}else if(e.id===selNode.id||up.indexOf(s)!==-1){st='#06b6d4';op=0.9;sw=2;}}var x1=f.x+nW,y1=f.y+nH/2,x2=t.x,y2=t.y+nH/2,mx=(x1+x2)/2;edges+='<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+st+'" stroke-width="'+sw+'" stroke-opacity="'+op+'"/>';});});
      var nodes='';vis.forEach(function(en){var p=pos[en.id],cf=tCfg[en.type],iS=selNode&&selNode.id===en.id,iU=selNode&&up.indexOf(en.id)!==-1,iD=selNode&&down.indexOf(en.id)!==-1;var bc=cf.color,bw=1;if(iS){bc='#ffffff';bw=2;}else if(iU){bc='#06b6d4';bw=2;}else if(iD){bc='#f97316';bw=2;}var nm=en.name.length>22?en.name.substring(0,20)+'...':en.name;nodes+='<g class="node" data-id="'+en.id+'" style="cursor:pointer;" transform="translate('+p.x+','+p.y+')"><rect width="'+nW+'" height="'+nH+'" rx="6" fill="#0f172a" stroke="'+bc+'" stroke-width="'+bw+'"/><rect x="1" y="1" width="28" height="'+(nH-2)+'" rx="5" fill="'+cf.color+'" fill-opacity="0.15"/><g transform="translate(8,'+(nH/2-6)+')" fill="'+cf.color+'">'+tIcons[en.type]+'</g><text x="34" y="'+(nH/2+3)+'" fill="#e2e8f0" font-size="9" font-weight="500">'+nm+'</text></g>';});
      var hdr='';['table','view','explore','dashboard'].forEach(function(t){var cf=tCfg[t];hdr+='<text x="'+(cX[t]+nW/2)+'" y="18" text-anchor="middle" fill="'+cf.color+'" font-size="8" font-weight="600">'+cf.label.toUpperCase()+'</text><text x="'+(cX[t]+nW/2)+'" y="30" text-anchor="middle" fill="#475569" font-size="8">'+bt[t].length+'</text>';});
      var stats='';if(selNode){stats='<span style="color:'+tCfg[selNode.type].color+';">'+selNode.name+'</span> <span style="color:#06b6d4;">↑'+up.length+'</span> <span style="color:#f97316;">↓'+down.length+'</span>';}else{stats='<span style="color:#64748b;">Click node to trace lineage</span>';}
      return '<div><div style="padding:8px 16px;border-bottom:1px solid #1e293b;font-size:11px;display:flex;justify-content:space-between;"><div>'+stats+' <span style="color:#475569;">('+maxDateStr+')</span></div><div style="color:#64748b;">'+ae.length+' entities</div></div><div style="padding:8px;overflow:auto;"><svg width="'+sW+'" height="'+sH+'" style="font-family:system-ui,sans-serif;">'+hdr+edges+nodes+'</svg></div></div>';
    }

    function renderOverlap() {
      var vc=Object.values(vws).filter(function(v){return v.fields&&v.fields.length>=5;}).length,met=null;
      if(simResults&&simResults.length>0){var uv={},ts=0;simResults.forEach(function(p){uv[p.v1]=true;uv[p.v2]=true;ts+=p.similarity;});met={tv:Object.keys(uv).length,avg:Math.round(ts/simResults.length),tp:simResults.length};}
      var h='<div style="padding:10px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;"><div style="color:#94a3b8;font-size:11px;">Analyzing <span style="color:#e2e8f0;font-weight:500;">'+vc+'</span> views <span style="color:#475569;">('+maxDateStr+')</span></div>';
      if(met){var sc=met.avg>=70?'#10b981':met.avg>=50?'#eab308':'#f97316';h+='<div style="display:flex;gap:16px;font-size:11px;"><span><span style="color:#a78bfa;font-weight:600;">'+met.tv+'</span> <span style="color:#64748b;">views</span></span><span><span style="color:'+sc+';font-weight:600;">'+met.avg+'%</span> <span style="color:#64748b;">avg</span></span><span><span style="color:#22d3ee;font-weight:600;">'+met.tp+'</span> <span style="color:#64748b;">pairs</span></span></div>';}
      h+='</div>';
      if(simLoading)h+='<div style="text-align:center;padding:40px;color:#8b5cf6;font-size:12px;">Analyzing...</div>';
      else if(simError)h+='<div style="text-align:center;padding:40px;color:#ef4444;font-size:12px;">'+simError+'</div>';
      else if(!simResults||simResults.length===0)h+='<div style="text-align:center;padding:40px;color:#10b981;font-size:12px;">No significant overlap found</div>';
      else{
        h+='<div style="overflow-y:auto;max-height:calc(100vh - 200px);">';
        simResults.forEach(function(p,idx){
          var isE=expDups[idx],sc=p.similarity>=70?'#10b981':p.similarity>=50?'#eab308':'#f97316';
          h+='<div class="dup-row" data-idx="'+idx+'" style="border-bottom:1px solid #1e293b;"><div class="dup-header" style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;" onmouseover="this.style.background=\'#1e293b40\'" onmouseout="this.style.background=\'transparent\'"><div style="min-width:36px;width:36px;height:36px;border-radius:6px;background:'+sc+'15;border:1px solid '+sc+'40;display:flex;align-items:center;justify-content:center;"><span style="font-size:12px;color:'+sc+';font-weight:700;">'+p.similarity+'%</span></div><div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span style="color:#a78bfa;font-size:12px;font-weight:500;">'+p.v1+'</span><span style="color:#475569;font-size:10px;">('+p.v1Model+')</span><span style="color:#334155;">↔</span><span style="color:#a78bfa;font-size:12px;font-weight:500;">'+p.v2+'</span><span style="color:#475569;font-size:10px;">('+p.v2Model+')</span></div><div style="display:flex;gap:10px;margin-top:4px;font-size:10px;color:#64748b;"><span><span style="color:#10b981;">'+p.exactCount+'</span> exact</span>'+(p.similarCount>0?'<span><span style="color:#eab308;">'+p.similarCount+'</span> similar</span>':'')+'<span>'+p.v1FC+' / '+p.v2FC+' fields</span></div></div><span style="color:#475569;">'+(isE?icons.chevUp:icons.chevDown)+'</span></div>';
          if(isE){h+='<div style="padding:8px 16px 12px;background:#0c1322;"><div style="display:grid;grid-template-columns:1fr 40px 1fr;font-size:10px;border-radius:6px;overflow:hidden;border:1px solid #1e293b;"><div style="padding:8px 10px;background:#1e293b;color:#64748b;font-weight:600;font-size:9px;">'+p.v1+'</div><div style="padding:8px;background:#1e293b;"></div><div style="padding:8px 10px;background:#1e293b;color:#64748b;font-weight:600;font-size:9px;">'+p.v2+'</div>';p.exactMatches.forEach(function(m){h+='<div style="padding:6px 10px;background:#0f172a;color:#e2e8f0;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;">'+m.f1+'</div><div style="padding:6px;background:#0f172a;color:#10b981;text-align:center;border-top:1px solid #1e293b30;font-weight:600;">=</div><div style="padding:6px 10px;background:#0f172a;color:#e2e8f0;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;">'+m.f2+'</div>';});p.similarMatches.forEach(function(m){h+='<div style="padding:6px 10px;background:#1e293b20;color:#fbbf24;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;">'+m.f1+'</div><div style="padding:6px;background:#1e293b20;color:#eab308;text-align:center;border-top:1px solid #1e293b30;">≈</div><div style="padding:6px 10px;background:#1e293b20;color:#fbbf24;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;">'+m.f2+'</div>';});p.v1Only.slice(0,8).forEach(function(f){h+='<div style="padding:6px 10px;background:#0f172a;color:#f87171;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;opacity:0.8;">'+f+'</div><div style="padding:6px;background:#0f172a;color:#334155;text-align:center;border-top:1px solid #1e293b30;">—</div><div style="padding:6px;background:#0f172a;border-top:1px solid #1e293b30;"></div>';});p.v2Only.slice(0,8).forEach(function(f){h+='<div style="padding:6px;background:#0f172a;border-top:1px solid #1e293b30;"></div><div style="padding:6px;background:#0f172a;color:#334155;text-align:center;border-top:1px solid #1e293b30;">—</div><div style="padding:6px 10px;background:#0f172a;color:#f87171;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;opacity:0.8;">'+f+'</div>';});h+='</div></div>';}
          h+='</div>';
        });
        h+='</div>';
      }
      return h;
    }

    function renderUnused() {
      var unused = getUnusedAssets();
      var bt={dashboard:0,explore:0,view:0};
      unused.forEach(function(u){bt[u.type]++;});
      var h='<div style="padding:10px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;"><div style="color:#94a3b8;font-size:11px;">Unused assets <span style="color:#475569;">(last 30 days)</span></div><div style="display:flex;gap:12px;font-size:11px;"><span><span style="color:#f97316;font-weight:600;">'+bt.dashboard+'</span> <span style="color:#64748b;">dashboards</span></span><span><span style="color:#ec4899;font-weight:600;">'+bt.explore+'</span> <span style="color:#64748b;">explores</span></span><span><span style="color:#8b5cf6;font-weight:600;">'+bt.view+'</span> <span style="color:#64748b;">views</span></span><span style="color:#e2e8f0;font-weight:600;">'+unused.length+'</span></div></div>';
      if(unused.length===0) return h+'<div style="text-align:center;padding:40px;color:#10b981;font-size:12px;">All assets are in use</div>';

      var cols=[{key:'type',label:'Type',w:'90px'},{key:'name',label:'Name',w:'1fr'},{key:'model',label:'Model',w:'140px'},{key:'reason',label:'Reason',w:'1fr'},{key:'link',label:'',w:'40px'}];
      h+='<div style="overflow-y:auto;max-height:calc(100vh - 200px);">';
      h+='<div style="display:grid;grid-template-columns:90px 1fr 140px 1fr 40px;border-bottom:1px solid #1e293b;position:sticky;top:0;background:#0f172a;z-index:1;">';
      cols.forEach(function(c){
        if(c.key==='link'){h+='<div style="padding:8px 6px;"></div>';return;}
        var act=unusedSort.col===c.key,arr=act?(unusedSort.dir==='asc'?' ↑':' ↓'):'';
        h+='<div class="sort-col" data-col="'+c.key+'" style="padding:8px 10px;font-size:10px;font-weight:600;color:'+(act?'#e2e8f0':'#64748b')+';cursor:pointer;user-select:none;">'+c.label+arr+'</div>';
      });
      h+='</div>';

      unused.forEach(function(item){
        var cf=tCfg[item.type];
        var url = buildLink(item.type, item.name, item.model, item.dashboardId);
        h+='<div style="display:grid;grid-template-columns:90px 1fr 140px 1fr 40px;border-bottom:1px solid #1e293b20;" onmouseover="this.style.background=\'#1e293b40\'" onmouseout="this.style.background=\'transparent\'">';
        h+='<div style="padding:6px 10px;display:flex;align-items:center;gap:4px;"><span style="color:'+cf.color+';">'+tIcons[item.type]+'</span><span style="font-size:10px;color:'+cf.color+';">'+item.type+'</span></div>';
        h+='<div style="padding:6px 10px;font-size:11px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+item.name+'</div>';
        h+='<div style="padding:6px 10px;font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(item.model||'-')+'</div>';
        h+='<div style="padding:6px 10px;font-size:10px;color:#f59e0b;">'+item.reason+'</div>';
        h+='<div style="padding:6px 6px;text-align:center;">';
        if(url) h+='<a href="'+url+'" target="_blank" rel="noopener" style="color:#64748b;text-decoration:none;" onmouseover="this.style.color=\'#e2e8f0\'" onmouseout="this.style.color=\'#64748b\'" title="Open in Looker">'+icons.link+'</a>';
        h+='</div></div>';
      });
      h+='</div>';
      return h;
    }

    function attachEvents() {
      var ae=allEntities();
      container.querySelectorAll('.node').forEach(function(n){n.addEventListener('click',function(){var id=n.dataset.id,en=ae.find(function(x){return x.id===id;});if(selNode&&selNode.id===id){selNode=null;up=[];down=[];}else selNode=en;render();});});
      container.querySelectorAll('.dup-header').forEach(function(hdr){hdr.addEventListener('click',function(){var idx=parseInt(hdr.parentElement.dataset.idx);expDups[idx]=!expDups[idx];var tc=container.querySelector('#tab-content');if(tc){tc.innerHTML=renderOverlap();attachEvents();}});});
      container.querySelectorAll('.sort-col').forEach(function(col){col.addEventListener('click',function(){var c=col.dataset.col;if(unusedSort.col===c)unusedSort.dir=unusedSort.dir==='asc'?'desc':'asc';else{unusedSort.col=c;unusedSort.dir='asc';}var tc=container.querySelector('#tab-content');if(tc){tc.innerHTML=renderUnused();attachEvents();}});});
      var dw=container.querySelector('#dismiss-warn');if(dw)dw.addEventListener('click',function(){dismissedWarn=true;render();});
    }

    function render() {
      buildEntities(maxDayRows);
      var h='<div style="background:#0f172a;height:100%;display:flex;flex-direction:column;">';
      h+='<div style="padding:8px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;">';
      h+='<div style="display:flex;gap:0;">';
      h+='<button class="tab-btn" data-tab="lineage" style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:none;cursor:pointer;font-size:11px;background:'+(activeTab==='lineage'?'#1e293b':'transparent')+';color:'+(activeTab==='lineage'?'#10b981':'#64748b')+';border-radius:6px 0 0 6px;border:1px solid #334155;">'+icons.lineage+' Lineage</button>';
      h+='<button class="tab-btn" data-tab="overlap" style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:none;cursor:pointer;font-size:11px;background:'+(activeTab==='overlap'?'#1e293b':'transparent')+';color:'+(activeTab==='overlap'?'#8b5cf6':'#64748b')+';border:1px solid #334155;border-left:none;">'+icons.overlap+' Overlap</button>';
      h+='<button class="tab-btn" data-tab="unused" style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:none;cursor:pointer;font-size:11px;background:'+(activeTab==='unused'?'#1e293b':'transparent')+';color:'+(activeTab==='unused'?'#f59e0b':'#64748b')+';border-radius:0 6px 6px 0;border:1px solid #334155;border-left:none;">'+icons.unused+' Unused</button>';
      h+='</div>';
      h+='<div style="font-size:11px;color:#64748b;">'+totalRows+' rows · '+sortedDates.length+' days'+(isTruncated?' <span style="color:#f59e0b;">⚠ truncated</span>':'')+'</div>';
      h+='</div>';
      h+=renderWarn();
      h+='<div id="tab-content" style="flex:1;overflow:auto;">';
      if(activeTab==='lineage')h+=renderLineage();
      else if(activeTab==='overlap')h+=renderOverlap();
      else h+=renderUnused();
      h+='</div></div>';
      container.innerHTML=h;
      container.querySelectorAll('.tab-btn').forEach(function(btn){btn.addEventListener('click',function(){activeTab=btn.dataset.tab;selNode=null;simResults=null;render();if(activeTab==='overlap'&&!simResults&&!simLoading)setTimeout(runAnalysis,100);});});
      attachEvents();
    }

    buildEntities(maxDayRows);render();done();
  }
});

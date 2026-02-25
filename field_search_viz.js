looker.plugins.visualizations.add({

  id: "lineage_explorer",

  label: "Lineage Explorer",

  options: {

    looker_base_url: {type:"string",label:"Looker Base URL (e.g. https://company.cloud.looker.com)",default:"",section:"Settings",order:1},

    lineage_dashboard_id: {type:"string",label:"Lineage Dashboard ID",default:"",section:"Navigation",order:2},

    overlap_dashboard_id: {type:"string",label:"Overlap Dashboard ID",default:"",section:"Navigation",order:3},

    usage_dashboard_id: {type:"string",label:"Usage Dashboard ID",default:"",section:"Navigation",order:4}

  },

  create: function(element) {

    element.style.height='100%';element.style.width='100%';

    element.innerHTML='<div id="lex" style="width:100%;height:100%;font-family:Inter,system-ui,-apple-system,sans-serif;background:#0a0e1a;color:#e2e8f0;display:flex;flex-direction:column;overflow:hidden"></div>';

    var s=document.createElement('style');

    s.textContent='#lex *{box-sizing:border-box}.lx-nav{display:flex;align-items:center;gap:2px;padding:14px 20px 0;background:linear-gradient(180deg,#0f1629,#0a0e1a)}.lx-nav-btn{padding:10px 22px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#475569;border-radius:10px 10px 0 0;transition:all .2s;display:flex;align-items:center;gap:8px;letter-spacing:.3px;text-decoration:none;position:relative}.lx-nav-btn:hover{color:#94a3b8;background:rgba(30,41,59,0.25)}.lx-nav-btn.active{color:#e2e8f0;background:#131b2e;cursor:default}.lx-nav-btn.active::after{content:"";position:absolute;bottom:0;left:10px;right:10px;height:2px;border-radius:2px 2px 0 0}.lx-nav-btn.t-lineage.active{color:#10b981}.lx-nav-btn.t-lineage.active::after{background:#10b981}.lx-nav-btn.t-overlap.active{color:#8b5cf6}.lx-nav-btn.t-overlap.active::after{background:#8b5cf6}.lx-nav-btn.t-usage.active{color:#f59e0b}.lx-nav-btn.t-usage.active::after{background:#f59e0b}.lx-body{flex:1;background:#131b2e;border-radius:12px 12px 0 0;overflow:hidden;display:flex;flex-direction:column;border:1px solid #1e293b;border-bottom:none;margin:0 12px}.lx-bar{padding:10px 16px;border-bottom:1px solid rgba(30,41,59,0.25);display:flex;align-items:center;justify-content:space-between;font-size:11px;min-height:42px}.lx-scroll{flex:1;overflow:auto}.lx-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:500}.lx-node{cursor:pointer;transition:opacity .15s}.lx-node:hover{opacity:.85}.lx-row{display:grid;border-bottom:1px solid rgba(30,41,59,0.1);transition:background .15s}.lx-row:hover{background:rgba(30,41,59,0.3)}.lx-hdr{display:grid;border-bottom:1px solid #1e293b;position:sticky;top:0;background:#131b2e;z-index:1}.lx-hdr>div{padding:10px 12px;font-size:10px;font-weight:600;color:#475569;cursor:pointer;user-select:none;text-transform:uppercase;letter-spacing:.5px;transition:color .15s}.lx-hdr>div:hover{color:#94a3b8}.lx-hdr>div.on{color:#e2e8f0}.lx-cell{padding:8px 12px;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lx-ebtn{padding:7px 16px;border:1px solid #1e293b;cursor:pointer;font-size:11px;font-weight:500;transition:all .15s;background:transparent;color:#64748b;letter-spacing:.3px}.lx-ebtn:hover{background:#1e293b;color:#94a3b8}.lx-ebtn.on{background:#1e293b;border-color:#334155}.lx-link{color:#475569;text-decoration:none;transition:color .15s;display:inline-flex}.lx-link:hover{color:#e2e8f0}.dp-card{border-bottom:1px solid rgba(30,41,59,0.12)}.dp-head{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;transition:background .15s}.dp-head:hover{background:rgba(30,41,59,0.2)}';

    element.appendChild(s);

  },

  updateAsync: function(data, element, config, queryResponse, details, done) {

    var R=element.querySelector('#lex'),W=element.offsetWidth||1200;

    var baseUrl=(config.looker_base_url||'').replace(/\/+$/,'');

    if(!data||data.length===0){R.innerHTML='<div style="padding:40px;color:#475569;text-align:center">No data available</div>';done();return;}



    var dims=queryResponse.fields.dimension_like.map(function(f){return f.name;});

    var meas=queryResponse.fields.measure_like?queryResponse.fields.measure_like.map(function(f){return f.name;}):[];

    var F={};

    F.dash=dims.find(function(f){var l=f.toLowerCase();return l.indexOf('dashboard')!==-1&&l.indexOf('title')!==-1;});

    F.dashId=dims.find(function(f){return f.toLowerCase().indexOf('dashboard_id')!==-1;});

    F.exp=dims.find(function(f){var l=f.toLowerCase();return l.indexOf('explore')!==-1&&l.indexOf('name')!==-1;});

    F.view=dims.find(function(f){var l=f.toLowerCase();return l.indexOf('view')!==-1&&l.indexOf('name')!==-1&&l.indexOf('count')===-1&&l.indexOf('extended')===-1&&l.indexOf('included')===-1;});

    F.tbl=dims.find(function(f){var l=f.toLowerCase();return l.indexOf('sql_table')!==-1&&l.indexOf('fields')===-1&&l.indexOf('path')===-1;});

    F.flds=dims.find(function(f){return f.toLowerCase().indexOf('sql_table_fields')!==-1;});

    F.ext=dims.find(function(f){var l=f.toLowerCase();return l.indexOf('extended')!==-1&&l.indexOf('view')!==-1;});

    F.inc=dims.find(function(f){var l=f.toLowerCase();return l.indexOf('included')!==-1&&l.indexOf('view')!==-1;});

    F.model=dims.find(function(f){var l=f.toLowerCase();return(l.indexOf('model')!==-1&&l.indexOf('name')!==-1)||l.endsWith('model_name');});

    if(!F.model)F.model=dims.find(function(f){return f.toLowerCase().indexOf('model')!==-1;});

    F.date=dims.find(function(f){var l=f.toLowerCase();return l.indexOf('stats_date')!==-1||(l.indexOf('date')!==-1&&l.indexOf('is_last')===-1);});

    F.vc=meas.find(function(f){var l=f.toLowerCase();return l.indexOf('view_count')!==-1||l.indexOf('dashboard_view')!==-1;});



    var mode;

    if(F.date&&F.vc)mode='usage';

    else if(F.dash&&F.exp&&F.view)mode='lineage';

    else if(F.view&&F.flds)mode='overlap';

    else mode='lineage';



    function gv(row,k){return k&&row[k]?row[k].value||'':'';}

    function gn(row,k){return k&&row[k]?parseFloat(row[k].value)||0:0;}



    var ic={

      lin:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l4-6h2M11 12l4 6h2"/></svg>',

      ovl:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>',

      usg:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',

      lnk:'<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',

      chD:'<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>',

      ext:'<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'

    };

    var tI={

      table:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="9" width="8" height="3"/><rect x="13" y="9" width="8" height="3"/><rect x="3" y="14" width="8" height="3"/><rect x="13" y="14" width="8" height="3"/></svg>',

      view:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7z"/></svg>',

      explore:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',

      dashboard:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="2" y="2" width="9" height="6" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="10" width="9" height="12" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>'

    };

    var tCfg={table:{c:'#06b6d4',l:'Tables'},view:{c:'#8b5cf6',l:'Views'},explore:{c:'#ec4899',l:'Explores'},dashboard:{c:'#f97316',l:'Dashboards'}};

    var eC={dashboard:'#f97316',explore:'#ec4899',view:'#8b5cf6',table:'#06b6d4'};



    function doNav(url){

      try{if(typeof LookerCharts!=='undefined'&&LookerCharts.Utils&&LookerCharts.Utils.openUrl){LookerCharts.Utils.openUrl(url);return;}}catch(e){}

      try{window.parent.postMessage({type:'page-changed',url:url},'*');}catch(e){}

      try{window.parent.location.href=url;return;}catch(e){}

      try{window.top.location.href=url;return;}catch(e){}

      window.location.href=url;

    }



    function navBar(){

      var tabs=[

        {id:'lineage',label:'Lineage',icon:ic.lin,did:config.lineage_dashboard_id},

        {id:'overlap',label:'Overlap',icon:ic.ovl,did:config.overlap_dashboard_id},

        {id:'usage',label:'Usage',icon:ic.usg,did:config.usage_dashboard_id}

      ];

      var h='<div class="lx-nav">';

      tabs.forEach(function(t){

        if(t.id===mode){

          h+='<div class="lx-nav-btn active t-'+t.id+'">'+t.icon+' '+t.label+'</div>';

        }else if(baseUrl&&t.did){

          h+='<a href="'+baseUrl+'/dashboards/'+t.did+'" target="_parent" class="lx-nav-btn t-'+t.id+'" style="text-decoration:none">'+t.icon+' '+t.label+'</a>';

        }else{

          h+='<div class="lx-nav-btn t-'+t.id+'" style="opacity:.3;cursor:default" title="Set dashboard ID in viz settings">'+t.icon+' '+t.label+'</div>';

        }

      });

      h+='</div>';

      return h;

    }



    // ========== LINEAGE ==========

    if(mode==='lineage'){

      var seen={},rows=[];

      data.forEach(function(row){

        var fv=gv(row,F.flds),rf=fv?fv.split('|').map(function(f){return f.trim();}).filter(function(f){return f.length>0&&f.indexOf('.')===-1;}):[];

        var mv=gv(row,F.model);if(!mv)Object.keys(row).forEach(function(k){if(k.toLowerCase().indexOf('model')!==-1&&row[k]&&row[k].value)mv=row[k].value;});

        var r={dash:gv(row,F.dash),exp:gv(row,F.exp),view:gv(row,F.view),tbl:gv(row,F.tbl),model:mv,fields:rf,extV:gv(row,F.ext),incV:gv(row,F.inc)};

        var k=[r.dash,r.exp,r.view,r.tbl,r.model,r.extV,r.incV].join('||');

        if(seen[k]){rf.forEach(function(f){if(seen[k].fields.indexOf(f)===-1)seen[k].fields.push(f);});}else{seen[k]=r;rows.push(r);}

      });

      var Tb={},Vw={},Ex={},Da={},v2t={},v2v={},e2v={},d2e={},vM={};

      rows.forEach(function(r){

        if(r.tbl&&!Tb[r.tbl])Tb[r.tbl]={id:'t_'+r.tbl,name:r.tbl,type:'table',src:[]};

        if(r.view&&!Vw[r.view])Vw[r.view]={id:'v_'+r.view,name:r.view,type:'view',src:[],model:null};

        if(r.exp&&!Ex[r.exp])Ex[r.exp]={id:'e_'+r.exp,name:r.exp,type:'explore',src:[],model:r.model};

        if(r.dash&&!Da[r.dash])Da[r.dash]={id:'d_'+r.dash,name:r.dash,type:'dashboard',src:[]};

        if(r.extV&&!Vw[r.extV])Vw[r.extV]={id:'v_'+r.extV,name:r.extV,type:'view',src:[],model:null};

        if(r.incV&&!Vw[r.incV])Vw[r.incV]={id:'v_'+r.incV,name:r.incV,type:'view',src:[],model:null};

      });

      rows.forEach(function(r){

        if(r.view&&r.model){if(!vM[r.view])vM[r.view]={};vM[r.view][r.model]=true;}

        if(r.view&&r.tbl){if(!v2t[r.view])v2t[r.view]={};v2t[r.view]['t_'+r.tbl]=true;}

        if(r.view&&r.extV&&r.view!==r.extV){if(!v2v[r.view])v2v[r.view]={};v2v[r.view]['v_'+r.extV]=true;}

        if(r.view&&r.incV&&r.view!==r.incV){if(!v2v[r.view])v2v[r.view]={};v2v[r.view]['v_'+r.incV]=true;}

        if(r.exp&&r.view){if(!e2v[r.exp])e2v[r.exp]={};e2v[r.exp]['v_'+r.view]=true;}

        if(r.dash&&r.exp){if(!d2e[r.dash])d2e[r.dash]={};d2e[r.dash]['e_'+r.exp]=true;}

      });

      Object.keys(Vw).forEach(function(v){if(vM[v])Vw[v].model=Object.keys(vM[v]).join(', ');});

      Object.keys(Vw).forEach(function(k){Vw[k].src=Object.keys(v2t[k]||{}).concat(Object.keys(v2v[k]||{}));});

      Object.keys(Ex).forEach(function(k){Ex[k].src=Object.keys(e2v[k]||{});});

      Object.keys(Da).forEach(function(k){Da[k].src=Object.keys(d2e[k]||{});});

      var ae=Object.values(Tb).concat(Object.values(Vw)).concat(Object.values(Ex)).concat(Object.values(Da));

      var sel=null,up=[],dn=[];

      function gUp(id,d,vi){if(d>15)return[];vi=vi||{};if(vi[id])return[];vi[id]=true;var e=ae.find(function(x){return x.id===id;});if(!e||!e.src)return[];var r=[];e.src.forEach(function(s){if(!vi[s]){r.push(s);r=r.concat(gUp(s,(d||0)+1,vi));}});return r.filter(function(x,i,a){return a.indexOf(x)===i;});}

      function gDn(id,d,vi){if(d>15)return[];vi=vi||{};if(vi[id])return[];vi[id]=true;var r=[];ae.forEach(function(e){if(e.src&&e.src.indexOf(id)!==-1&&!vi[e.id]){r.push(e.id);r=r.concat(gDn(e.id,(d||0)+1,vi));}});return r.filter(function(x,i,a){return a.indexOf(x)===i;});}



      function rL(){

        var vis=ae;

        if(sel){up=gUp(sel.id,0);dn=gDn(sel.id,0);var ids=[sel.id].concat(up).concat(dn);vis=ae.filter(function(e){return ids.indexOf(e.id)!==-1;});}

        var bt={table:[],view:[],explore:[],dashboard:[]};vis.forEach(function(e){bt[e.type].push(e);});['table','view','explore','dashboard'].forEach(function(t){bt[t].sort(function(a,b){return a.name.localeCompare(b.name);});});

        var nW=180,nH=34,sp=42,pd=16,sW=Math.max(W-50,900),cS=(sW-pd*2-nW)/3;

        var cX={table:pd,view:pd+cS,explore:pd+cS*2,dashboard:pd+cS*3},pos={},sY=58;

        ['table','view','explore','dashboard'].forEach(function(t){bt[t].forEach(function(e,i){pos[e.id]={x:cX[t],y:sY+i*sp};});});

        var mC=Math.max(bt.table.length||1,bt.view.length||1,bt.explore.length||1,bt.dashboard.length||1),sH=Math.max(mC*sp+80,280);

        var ed='';vis.forEach(function(e){(e.src||[]).forEach(function(s){var f=pos[s],t=pos[e.id];if(!f||!t)return;var st='#1e293b',op=.4,sw=1.5;if(sel){if(s===sel.id||dn.indexOf(e.id)!==-1){st='#f97316';op=.85;sw=2.5;}else if(e.id===sel.id||up.indexOf(s)!==-1){st='#06b6d4';op=.85;sw=2.5;}}var x1=f.x+nW,y1=f.y+nH/2,x2=t.x,y2=t.y+nH/2,mx=(x1+x2)/2;ed+='<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+st+'" stroke-width="'+sw+'" stroke-opacity="'+op+'"/>';});});

        var nd='';vis.forEach(function(en){var p=pos[en.id],cf=tCfg[en.type],iS=sel&&sel.id===en.id,iU=sel&&up.indexOf(en.id)!==-1,iD=sel&&dn.indexOf(en.id)!==-1;var bc=cf.c,bw=1.5,bg='#131b2e';if(iS){bc='#e2e8f0';bw=2.5;bg='#1e293b';}else if(iU){bc='#06b6d4';bw=2;bg='#06b6d408';}else if(iD){bc='#f97316';bw=2;bg='#f9731608';}var nm=en.name.length>20?en.name.substring(0,18)+'\u2026':en.name;nd+='<g class="lx-node nd" data-id="'+en.id+'" transform="translate('+p.x+','+p.y+')"><rect width="'+nW+'" height="'+nH+'" rx="8" fill="'+bg+'" stroke="'+bc+'" stroke-width="'+bw+'"/><rect x="1.5" y="1.5" width="30" height="'+(nH-3)+'" rx="7" fill="'+cf.c+'" fill-opacity=".1"/><g transform="translate(9,'+(nH/2-6)+')" fill="'+cf.c+'">'+tI[en.type]+'</g><text x="36" y="'+(nH/2+4)+'" fill="#e2e8f0" font-size="10" font-weight="500">'+nm+'</text></g>';});

        var hd='';['table','view','explore','dashboard'].forEach(function(t){var cf=tCfg[t];hd+='<text x="'+(cX[t]+nW/2)+'" y="20" text-anchor="middle" fill="'+cf.c+'" font-size="9" font-weight="700" letter-spacing="1">'+cf.l.toUpperCase()+'</text><text x="'+(cX[t]+nW/2)+'" y="34" text-anchor="middle" fill="#475569" font-size="9">'+bt[t].length+'</text>';});

        var st=sel?'<span class="lx-pill" style="background:'+tCfg[sel.type].c+'15;color:'+tCfg[sel.type].c+'">'+tI[sel.type]+' '+sel.name+'</span> <span style="color:#06b6d4;margin-left:8px">\u2191 '+up.length+'</span> <span style="color:#f97316;margin-left:4px">\u2193 '+dn.length+'</span>':'<span style="color:#475569">Click any node to trace its lineage</span>';

        var rowBanner='';

        if(data.length>=5000){

          rowBanner='<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(245,158,11,0.06);border-bottom:1px solid rgba(245,158,11,0.12)"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span style="font-size:10px;color:#f59e0b">Showing max 5,000 rows. Results may be incomplete.</span></div>';

        }else if(data.length>=3000){

          rowBanner='<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(59,130,246,0.06);border-bottom:1px solid rgba(59,130,246,0.12)"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span style="font-size:10px;color:#3b82f6">Showing '+data.length.toLocaleString()+' rows.</span></div>';

        }

        var h=navBar()+'<div class="lx-body">'+rowBanner+'<div class="lx-bar"><div>'+st+'</div><div style="color:#475569">'+ae.length+' entities \u00B7 '+data.length.toLocaleString()+' rows</div></div><div class="lx-scroll" style="padding:8px"><svg width="'+sW+'" height="'+sH+'">'+hd+ed+nd+'</svg></div></div>';

        R.innerHTML=h;

        R.querySelectorAll('.nd').forEach(function(n){n.addEventListener('click',function(){var id=n.dataset.id,en=ae.find(function(x){return x.id===id;});if(sel&&sel.id===id){sel=null;up=[];dn=[];}else sel=en;rL();});});

      }

      rL();done();return;

    }



    // ========== OVERLAP ==========

    if(mode==='overlap'){

      function gfp(fn){if(!fn)return null;var nm=fn.toLowerCase(),i=nm.indexOf('_');return i>0?nm.substring(0,i):null;}

      var genC=['id','name','type','date','value','status','code','key','count','sum','avg','min','max','total','amount','number','num','flag','is','has'];

      var lvlI=['ad','ads','campaign','campaigns','section','publisher','marketer','advertiser','account','user','website','order','line_item','lineitem','creative','placement','daily','weekly','monthly','hourly','yearly','agg','aggregate','summary','rollup'];

      function eLvl(vn){if(!vn)return[];var nm=vn.toLowerCase(),f=[];lvlI.forEach(function(lv){if(nm.indexOf(lv)!==-1){var i=nm.indexOf(lv),b=i===0?'_':nm[i-1],a=i+lv.length>=nm.length?'_':nm[i+lv.length];if((b==='_'||b==='-'||i===0)&&(a==='_'||a==='-'||i+lv.length===nm.length))f.push(lv);}});return f;}

      function dLvl(a,b){var l1=eLvl(a),l2=eLvl(b);if(l1.length>0&&l2.length>0){var n=function(l){if(l.indexOf('ad')===0)return'ad';if(l.indexOf('campaign')===0)return'campaign';if(l.indexOf('account')===0)return'account';if(l.indexOf('user')===0)return'user';return l;};if(l1.map(n).filter(function(x){return l2.map(n).indexOf(x)===-1;}).length>0||l2.map(n).filter(function(x){return l1.map(n).indexOf(x)===-1;}).length>0)return true;}return false;}

      function gfc(fn){if(!fn)return'';var nm=fn.toLowerCase(),i=nm.indexOf('_');return(i>0&&i<6)?nm.substring(i+1):nm;}

      function igc(c){return!c||c.length<=2||genC.indexOf(c)!==-1;}



      var viewModelMap={};

      data.forEach(function(row){var vn=gv(row,F.view),mv=gv(row,F.model);if(vn&&mv&&!viewModelMap[vn])viewModelMap[vn]=mv;});



      var views={};

      data.forEach(function(row){var vn=gv(row,F.view),fv=gv(row,F.flds),mv=gv(row,F.model);if(!vn)return;if(!views[vn])views[vn]={name:vn,model:mv,fields:[]};if(mv&&!views[vn].model)views[vn].model=mv;fv.split('|').forEach(function(f){f=f.trim();if(f&&f.indexOf('.')===-1&&views[vn].fields.indexOf(f)===-1)views[vn].fields.push(f);});});

      var expD={},simR=null;



      function mkVL(vn){

        var m=viewModelMap[vn]||'';

        if(baseUrl&&m){

          return '<a href="'+baseUrl+'/explore/'+m+'/'+vn+'" target="_parent" class="ov-vlink" style="color:#a78bfa;font-weight:500;text-decoration:none;display:inline-flex;align-items:center;gap:4px;transition:color .15s" onmouseover="this.style.color=\'#c4b5fd\'" onmouseout="this.style.color=\'#a78bfa\'">'+vn+' '+ic.ext+'</a>';

        }

        return '<span style="color:#a78bfa;font-weight:500">'+vn+'</span>';

      }



      function analyze(){

        R.innerHTML=navBar()+'<div class="lx-body"><div class="lx-bar"><div style="color:#94a3b8">Analyzing\u2026</div></div><div class="lx-scroll"><div style="text-align:center;padding:60px;color:#8b5cf6">Analyzing field overlap\u2026</div></div></div>';

        setTimeout(function(){try{

          var res=[],vl=Object.values(views).filter(function(v){return v.fields&&v.fields.length>=5;});

          for(var i=0;i<vl.length;i++){for(var j=i+1;j<vl.length;j++){var v1=vl[i],v2=vl[j],p1={},p2={},v1P=null,v2P=null;

            v1.fields.forEach(function(f){var p=gfp(f);if(p)p1[p]=(p1[p]||0)+1;});v2.fields.forEach(function(f){var p=gfp(f);if(p)p2[p]=(p2[p]||0)+1;});

            var m1=0,m2=0;Object.keys(p1).forEach(function(p){if(p1[p]>m1){m1=p1[p];v1P=p;}});Object.keys(p2).forEach(function(p){if(p2[p]>m2){m2=p2[p];v2P=p;}});

            if(!(!v1P||!v2P||v1P===v2P)||dLvl(v1.name,v2.name))continue;

            var mt=[],v1M={},v2M={};

            v1.fields.forEach(function(f1){if(v1M[f1.toLowerCase()])return;v2.fields.forEach(function(f2){if(v2M[f2.toLowerCase()])return;if(f1.toLowerCase()===f2.toLowerCase()){mt.push({f1:f1,f2:f2,t:'e'});v1M[f1.toLowerCase()]=true;v2M[f2.toLowerCase()]=true;}});});

            var bc={};v1.fields.forEach(function(f){if(v1M[f.toLowerCase()])return;var c=gfc(f);if(c&&!igc(c)){if(!bc[c])bc[c]=[];bc[c].push(f);}});v2.fields.forEach(function(f2){if(v2M[f2.toLowerCase()])return;var c=gfc(f2);if(c&&!igc(c)&&bc[c]&&bc[c].length>0){for(var k=0;k<bc[c].length;k++){var f1=bc[c][k];if(!v1M[f1.toLowerCase()]){mt.push({f1:f1,f2:f2,t:'s'});v1M[f1.toLowerCase()]=true;v2M[f2.toLowerCase()]=true;break;}}}});

            var em=mt.filter(function(m){return m.t==='e';}),sm=mt.filter(function(m){return m.t==='s';});

            // Collect unmatched fields

            var um1=v1.fields.filter(function(f){return !v1M[f.toLowerCase()];});

            var um2=v2.fields.filter(function(f){return !v2M[f.toLowerCase()];});

            var mn=Math.min(v1.fields.length,v2.fields.length),sc=Math.round((em.length+sm.length*.5)/mn*100);

            if(em.length>=5||em.length/mn>=.4||mt.length/mn>=.6)res.push({v1:v1.name,v2:v2.name,m1:v1.model||'-',m2:v2.model||'-',sim:Math.min(sc,100),ec:em.length,sc:sm.length,c1:v1.fields.length,c2:v2.fields.length,em:em,sm:sm,um1:um1,um2:um2});

          }}

          res.sort(function(a,b){return b.sim-a.sim;});simR=res.slice(0,100);rO();

        }catch(e){console.log('LEX_V3 overlap error:',e);simR=[];rO();}},100);

      }



      function rO(){

        var vc=Object.values(views).filter(function(v){return v.fields&&v.fields.length>=5;}).length,met=null;

        if(simR&&simR.length>0){var uv={},ts=0;simR.forEach(function(p){uv[p.v1]=true;uv[p.v2]=true;ts+=p.sim;});met={tv:Object.keys(uv).length,avg:Math.round(ts/simR.length),tp:simR.length};}

        var h=navBar()+'<div class="lx-body"><div class="lx-bar"><div style="color:#94a3b8">Analyzing <span style="color:#e2e8f0;font-weight:600">'+vc+'</span> views \u00B7 '+data.length+' rows</div>';

        if(met){var mc=met.avg>=70?'#10b981':met.avg>=50?'#eab308':'#f97316';h+='<div style="display:flex;gap:14px"><span><span style="color:#a78bfa;font-weight:600">'+met.tv+'</span> <span style="color:#475569">views</span></span><span><span style="color:'+mc+';font-weight:600">'+met.avg+'%</span> <span style="color:#475569">avg</span></span><span><span style="color:#22d3ee;font-weight:600">'+met.tp+'</span> <span style="color:#475569">pairs</span></span></div>';}

        h+='</div><div class="lx-scroll">';

        if(!simR||!simR.length){h+='<div style="text-align:center;padding:60px;color:#10b981">No significant overlap found</div>';}

        else{

          simR.forEach(function(p,idx){

            var isE=expD[idx],sc=p.sim>=70?'#10b981':p.sim>=50?'#eab308':'#f97316';

            var rgb=p.sim>=70?'16,185,129':p.sim>=50?'234,179,8':'249,115,22';

            h+='<div class="dp-card" data-i="'+idx+'">';



            // --- Card header ---

            h+='<div class="dp-head dp-toggle" data-idx="'+idx+'">';

            h+='<div style="min-width:44px;width:44px;height:44px;border-radius:10px;background:rgba('+rgb+',0.06);border:1px solid rgba('+rgb+',0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="font-size:13px;color:'+sc+';font-weight:700">'+p.sim+'<span style="font-size:8px;opacity:.6">%</span></span></div>';

            var v1HUrl=baseUrl&&viewModelMap[p.v1]?baseUrl+'/explore/'+viewModelMap[p.v1]+'/'+p.v1:'';

            var v2HUrl=baseUrl&&viewModelMap[p.v2]?baseUrl+'/explore/'+viewModelMap[p.v2]+'/'+p.v2:'';

            h+='<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';

            if(v1HUrl){h+='<a href="'+v1HUrl+'" target="_parent" class="ov-vlink" style="color:#c4b5fd;font-weight:600;font-size:12px;text-decoration:none;display:inline-flex;align-items:center;gap:4px" onmouseover="this.style.color=\'#e0d5ff\'" onmouseout="this.style.color=\'#c4b5fd\'">'+p.v1+' '+ic.ext+'</a>';}

            else{h+='<span style="color:#c4b5fd;font-weight:600;font-size:12px">'+p.v1+'</span>';}

            h+='<span style="color:#2d3748;font-size:9px">'+p.m1+'</span>';

            h+='<span style="color:#2d3748;font-size:11px">\u2194</span>';

            if(v2HUrl){h+='<a href="'+v2HUrl+'" target="_parent" class="ov-vlink" style="color:#c4b5fd;font-weight:600;font-size:12px;text-decoration:none;display:inline-flex;align-items:center;gap:4px" onmouseover="this.style.color=\'#e0d5ff\'" onmouseout="this.style.color=\'#c4b5fd\'">'+p.v2+' '+ic.ext+'</a>';}

            else{h+='<span style="color:#c4b5fd;font-weight:600;font-size:12px">'+p.v2+'</span>';}

            h+='<span style="color:#2d3748;font-size:9px">'+p.m2+'</span>';

            h+='</div>';

            h+='<div style="display:flex;gap:12px;margin-top:5px;font-size:10px;color:#475569">';

            h+='<span><span style="color:#34d399;font-weight:600">'+p.ec+'</span> exact</span>';

            if(p.sc>0)h+='<span><span style="color:#fbbf24;font-weight:600">'+p.sc+'</span> similar</span>';

            h+='<span style="color:#334155">'+p.um1.length+' / '+p.um2.length+' unmatched</span>';

            h+='<span style="color:#334155">'+p.c1+' / '+p.c2+' fields</span>';

            h+='</div></div>';

            h+='<span style="color:#334155;display:inline-flex;transform:rotate('+(isE?'180':'0')+'deg);transition:transform .2s">'+ic.chD+'</span></div>';



            // --- Expanded detail ---

            if(isE){

              h+='<div style="padding:0 16px 20px">';

              h+='<div style="background:#0b1120;border:1px solid #162032;border-radius:10px;overflow:hidden">';



              var allM=p.em.concat(p.sm);

              var maxUm=Math.max(p.um1.length,p.um2.length);

              var v1Url=baseUrl&&viewModelMap[p.v1]?baseUrl+'/explore/'+viewModelMap[p.v1]+'/'+p.v1:'';

              var v2Url=baseUrl&&viewModelMap[p.v2]?baseUrl+'/explore/'+viewModelMap[p.v2]+'/'+p.v2:'';



              // Column headers

              h+='<div style="display:grid;grid-template-columns:1fr 40px 1fr;border-bottom:1px solid #162032">';

              h+='<div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between">';

              if(v1Url){h+='<a href="'+v1Url+'" target="_parent" style="color:#c4b5fd;font-size:11px;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:5px;transition:color .15s" onmouseover="this.style.color=\'#e0d5ff\'" onmouseout="this.style.color=\'#c4b5fd\'">'+p.v1+' <span style="opacity:.5">'+ic.ext+'</span></a>';}

              else{h+='<span style="color:#c4b5fd;font-size:11px;font-weight:600">'+p.v1+'</span>';}

              h+='<span style="color:#2d3748;font-size:9px">'+p.c1+'</span></div>';

              h+='<div></div>';

              h+='<div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between">';

              if(v2Url){h+='<a href="'+v2Url+'" target="_parent" style="color:#c4b5fd;font-size:11px;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:5px;transition:color .15s" onmouseover="this.style.color=\'#e0d5ff\'" onmouseout="this.style.color=\'#c4b5fd\'">'+p.v2+' <span style="opacity:.5">'+ic.ext+'</span></a>';}

              else{h+='<span style="color:#c4b5fd;font-size:11px;font-weight:600">'+p.v2+'</span>';}

              h+='<span style="color:#2d3748;font-size:9px">'+p.c2+'</span></div>';

              h+='</div>';



              // Matched rows

              if(allM.length>0){

                h+='<div style="padding:6px 16px 2px"><span style="font-size:8px;font-weight:600;color:#334155;text-transform:uppercase;letter-spacing:1px">Matched \u00B7 '+allM.length+'</span></div>';

                allM.forEach(function(m){

                  var isExact=m.t==='e';

                  var dotC=isExact?'#34d399':'#fbbf24';

                  var lbl=isExact?'=':'\u2248';

                  var lblC=isExact?'#10b981':'#eab308';

                  var lblBg=isExact?'rgba(16,185,129,0.08)':'rgba(234,179,8,0.08)';

                  h+='<div style="display:grid;grid-template-columns:1fr 40px 1fr;align-items:center;padding:0 16px">';

                  h+='<div style="padding:5px 0;display:flex;align-items:center;gap:6px;overflow:hidden"><span style="width:4px;height:4px;border-radius:50%;background:'+dotC+';flex-shrink:0"></span><span style="font-size:11px;color:#94a3b8;font-family:\'SF Mono\',Menlo,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+m.f1+'">'+m.f1+'</span></div>';

                  h+='<div style="text-align:center"><span style="font-size:9px;font-weight:700;color:'+lblC+';background:'+lblBg+';padding:2px 6px;border-radius:4px;display:inline-block">'+lbl+'</span></div>';

                  h+='<div style="padding:5px 0;display:flex;align-items:center;gap:6px;overflow:hidden"><span style="width:4px;height:4px;border-radius:50%;background:'+dotC+';flex-shrink:0"></span><span style="font-size:11px;color:#94a3b8;font-family:\'SF Mono\',Menlo,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+m.f2+'">'+m.f2+'</span></div>';

                  h+='</div>';

                });

              }



              // Unmatched rows

              if(p.um1.length>0||p.um2.length>0){

                h+='<div style="border-top:1px solid #162032;margin-top:4px;padding:6px 16px 2px"><span style="font-size:8px;font-weight:600;color:#1e293b;text-transform:uppercase;letter-spacing:1px">Unmatched \u00B7 '+(p.um1.length+p.um2.length)+'</span></div>';

                for(var ui=0;ui<maxUm;ui++){

                  h+='<div style="display:grid;grid-template-columns:1fr 40px 1fr;align-items:center;padding:0 16px">';

                  if(ui<p.um1.length){

                    h+='<div style="padding:4px 0;display:flex;align-items:center;gap:6px;overflow:hidden"><span style="width:4px;height:4px;border-radius:50%;background:#1e293b;flex-shrink:0"></span><span style="font-size:10px;color:#3e4c5e;font-family:\'SF Mono\',Menlo,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+p.um1[ui]+'">'+p.um1[ui]+'</span></div>';

                  }else{h+='<div></div>';}

                  h+='<div></div>';

                  if(ui<p.um2.length){

                    h+='<div style="padding:4px 0;display:flex;align-items:center;gap:6px;overflow:hidden"><span style="width:4px;height:4px;border-radius:50%;background:#1e293b;flex-shrink:0"></span><span style="font-size:10px;color:#3e4c5e;font-family:\'SF Mono\',Menlo,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+p.um2[ui]+'">'+p.um2[ui]+'</span></div>';

                  }else{h+='<div></div>';}

                  h+='</div>';

                }

              }



              h+='<div style="height:8px"></div>';

              h+='</div>'; // close bg container

              h+='</div>'; // close padding wrapper

            }

            h+='</div>'; // close dp-card

          });

        }

        h+='</div></div>';

        R.innerHTML=h;



        // Toggle handler - use dp-toggle class, ignore clicks on links

        R.querySelectorAll('.dp-toggle').forEach(function(hd){

          hd.addEventListener('click',function(e){

            // If the click was on a link (view link), don't toggle

            var t=e.target;

            while(t&&t!==hd){

              if(t.tagName==='A')return;

              t=t.parentElement;

            }

            var idx=parseInt(hd.getAttribute('data-idx'));

            if(!isNaN(idx)){

              expD[idx]=!expD[idx];

              rO();

            }

          });

        });

      }

      analyze();done();return;

    }



    // ========== USAGE ==========

    if(mode==='usage'){

      function pdt(v){if(!v)return null;var d=new Date(String(v).substring(0,10)+'T00:00:00');return isNaN(d.getTime())?null:d;}

      function dts(d){return d?d.toISOString().substring(0,10):'';}

      var uR=[];data.forEach(function(row){uR.push({dash:gv(row,F.dash),dashId:gv(row,F.dashId),exp:gv(row,F.exp),view:gv(row,F.view),tbl:gv(row,F.tbl),model:gv(row,F.model),ds:dts(pdt(gv(row,F.date))),vc:gn(row,F.vc)});});

      var ddV={};uR.forEach(function(r){if(!r.dash||!r.ds)return;var k=r.dash+'||'+r.ds;if(!ddV[k])ddV[k]={d:r.dash,di:r.dashId,m:r.model,vc:r.vc};});

      var dT={};Object.values(ddV).forEach(function(d){if(!dT[d.d])dT[d.d]={vc:0,di:d.di,m:d.m};dT[d.d].vc+=d.vc;});

      var eD={};uR.forEach(function(r){if(r.exp&&r.dash){if(!eD[r.exp])eD[r.exp]={};eD[r.exp][r.dash]=true;}});

      var eT={};Object.keys(eD).forEach(function(e){var tv=0,m='';Object.keys(eD[e]).forEach(function(d){if(dT[d]){tv+=dT[d].vc;if(!m)m=dT[d].m;}});eT[e]={vc:tv,m:m,dc:Object.keys(eD[e]).length};});

      var vE={};uR.forEach(function(r){if(r.view&&r.exp){if(!vE[r.view])vE[r.view]={};vE[r.view][r.exp]=true;}});

      var vT={};Object.keys(vE).forEach(function(v){var tv=0,vd={},m='';Object.keys(vE[v]).forEach(function(e){if(eD[e])Object.keys(eD[e]).forEach(function(d){vd[d]=true;});});Object.keys(vd).forEach(function(d){if(dT[d])tv+=dT[d].vc;});uR.forEach(function(r){if(r.view===v&&r.model&&!m)m=r.model;});vT[v]={vc:tv,m:m,ec:Object.keys(vE[v]).length,dc:Object.keys(vd).length};});

      var tVw={};uR.forEach(function(r){if(r.tbl&&r.view){if(!tVw[r.tbl])tVw[r.tbl]={};tVw[r.tbl][r.view]=true;}});

      var tT={};Object.keys(tVw).forEach(function(t){var tv=0;Object.keys(tVw[t]).forEach(function(v){if(vT[v])tv+=vT[v].vc;});tT[t]={vc:tv,wc:Object.keys(tVw[t]).length};});



      var aE='dashboard',sC='vc',sD='desc';

      function bL(t,n,m,di){if(!baseUrl)return null;if(t==='dashboard'&&di)return baseUrl+'/dashboards/'+di;if(t==='explore'&&m&&n)return baseUrl+'/explore/'+m+'/'+n;return null;}



      function gL(){

        var ls=[];

        if(aE==='dashboard')Object.keys(dT).forEach(function(d){var v=dT[d];ls.push({name:d,model:v.m,vc:v.vc,extra:'',link:bL('dashboard',d,v.m,v.di)});});

        else if(aE==='explore')Object.keys(eT).forEach(function(e){var v=eT[e];ls.push({name:e,model:v.m,vc:v.vc,extra:v.dc+' dashboards',link:bL('explore',e,v.m)});});

        else if(aE==='view')Object.keys(vT).forEach(function(w){var v=vT[w];ls.push({name:w,model:v.m,vc:v.vc,extra:v.dc+' dash \u00B7 '+v.ec+' exp',link:null});});

        else Object.keys(tT).forEach(function(t){var v=tT[t];ls.push({name:t,model:'',vc:v.vc,extra:v.wc+' views',link:null});});

        ls.sort(function(a,b){if(sC==='vc')return sD==='asc'?a.vc-b.vc:b.vc-a.vc;var va=a[sC]||'',vb=b[sC]||'';return sD==='asc'?va.localeCompare(vb):vb.localeCompare(va);});

        return ls;

      }



      function rU(){

        var ls=gL(),tv=0;ls.forEach(function(i){tv+=i.vc;});var col=eC[aE];

        var h=navBar()+'<div class="lx-body"><div class="lx-bar"><div style="display:flex;gap:2px">';

        ['dashboard','explore','view','table'].forEach(function(t,i){var c=eC[t],a=aE===t;h+='<button class="lx-ebtn eb'+(a?' on':'')+'" data-e="'+t+'" style="color:'+(a?c:'')+(i===0?';border-radius:6px 0 0 6px':'')+(i===3?';border-radius:0 6px 6px 0':'')+'">'+t.charAt(0).toUpperCase()+t.slice(1)+'s</button>';});

        h+='</div><div style="color:#475569">'+ls.length+' '+aE+'s \u00B7 <span style="color:'+col+';font-weight:600">'+tv.toLocaleString()+'</span> views (30d)</div></div>';

        h+='<div class="lx-hdr" style="grid-template-columns:1fr 140px 130px 150px 36px">';

        [{k:'name',l:'Name'},{k:'model',l:'Model'},{k:'vc',l:'Views (30d)'},{k:'extra',l:'References'},{k:'lnk',l:''}].forEach(function(c){if(c.k==='lnk'){h+='<div></div>';return;}var a=sC===c.k;h+='<div class="sc'+(a?' on':'')+'" data-c="'+c.k+'">'+c.l+(a?(sD==='asc'?' \u2191':' \u2193'):'')+'</div>';});

        h+='</div><div class="lx-scroll">';

        var mx=ls.length>0?ls.reduce(function(m,i){return Math.max(m,i.vc);},0):1;

        ls.forEach(function(it){

          var bW=mx>0?Math.max(it.vc/mx*100,0):0,vc=it.vc===0?'#ef4444':it.vc<10?'#f59e0b':'#10b981';

          h+='<div class="lx-row" style="grid-template-columns:1fr 140px 130px 150px 36px">';

          h+='<div class="lx-cell" style="color:#e2e8f0" title="'+it.name+'">'+it.name+'</div>';

          h+='<div class="lx-cell" style="color:#64748b">'+(it.model||'-')+'</div>';

          h+='<div class="lx-cell"><div style="display:flex;align-items:center;gap:8px"><span style="color:'+vc+';font-weight:600;min-width:44px">'+it.vc.toLocaleString()+'</span><div style="flex:1;height:4px;background:#1e293b;border-radius:3px;overflow:hidden"><div style="width:'+bW+'%;height:100%;background:'+col+';border-radius:3px;transition:width .3s"></div></div></div></div>';

          h+='<div class="lx-cell" style="color:#475569">'+it.extra+'</div>';

          h+='<div class="lx-cell" style="text-align:center;padding:6px 4px">';

          if(it.link)h+='<a href="'+it.link+'" target="_blank" rel="noopener" class="lx-link" title="Open in Looker">'+ic.lnk+'</a>';

          h+='</div></div>';

        });

        if(!ls.length)h+='<div style="text-align:center;padding:60px;color:#475569">No data</div>';

        h+='</div></div>';

        R.innerHTML=h;

        R.querySelectorAll('.eb').forEach(function(b){b.addEventListener('click',function(){aE=b.dataset.e;sC='vc';sD='desc';rU();});});

        R.querySelectorAll('.sc').forEach(function(c){c.addEventListener('click',function(){var k=c.dataset.c;if(sC===k)sD=sD==='asc'?'desc':'asc';else{sC=k;sD=k==='vc'?'desc':'asc';}rU();});});

      }

      rU();done();return;

    }

    done();

  }

});

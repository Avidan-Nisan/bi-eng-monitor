looker.plugins.visualizations.add({
  id: "lineage_explorer",
  label: "Lineage Explorer",
  options: {
    looker_base_url: { type:"string", label:"Looker Base URL", default:"", section:"Settings" }
  },
  create: function(element, config) {
    element.style.height = '100%';
    element.style.width = '100%';
    element.innerHTML = '<div id="lex-root" style="width:100%;height:100%;overflow:auto;font-family:system-ui,sans-serif;background:#0f172a"></div>';
  },
  updateAsync: function(data, element, config, queryResponse, details, done) {
    var R = element.querySelector('#lex-root');
    var W = element.offsetWidth || 1200;
    var baseUrl = (config.looker_base_url || '').replace(/\/+$/, '');
    if (!data || data.length === 0) { R.innerHTML = '<div style="padding:40px;color:#64748b">No data</div>'; done(); return; }

    var dims = queryResponse.fields.dimension_like.map(function(f){return f.name;});
    var meas = queryResponse.fields.measure_like ? queryResponse.fields.measure_like.map(function(f){return f.name;}) : [];
    var allF = dims.concat(meas);

    // Detect fields
    var F = {};
    F.dash = dims.find(function(f){var l=f.toLowerCase();return l.indexOf('dashboard')!==-1&&l.indexOf('title')!==-1;});
    F.dashId = dims.find(function(f){return f.toLowerCase().indexOf('dashboard_id')!==-1;});
    F.exp = dims.find(function(f){var l=f.toLowerCase();return l.indexOf('explore')!==-1&&l.indexOf('name')!==-1;});
    F.view = dims.find(function(f){var l=f.toLowerCase();return l.indexOf('view')!==-1&&l.indexOf('name')!==-1&&l.indexOf('count')===-1&&l.indexOf('extended')===-1&&l.indexOf('included')===-1;});
    F.tbl = dims.find(function(f){var l=f.toLowerCase();return l.indexOf('sql_table')!==-1&&l.indexOf('fields')===-1&&l.indexOf('path')===-1;});
    F.flds = dims.find(function(f){return f.toLowerCase().indexOf('sql_table_fields')!==-1;});
    F.ext = dims.find(function(f){var l=f.toLowerCase();return l.indexOf('extended')!==-1&&l.indexOf('view')!==-1;});
    F.inc = dims.find(function(f){var l=f.toLowerCase();return l.indexOf('included')!==-1&&l.indexOf('view')!==-1;});
    F.model = dims.find(function(f){var l=f.toLowerCase();return(l.indexOf('model')!==-1&&l.indexOf('name')!==-1)||l.endsWith('model_name');});
    if(!F.model) F.model = dims.find(function(f){return f.toLowerCase().indexOf('model')!==-1;});
    F.date = dims.find(function(f){var l=f.toLowerCase();return l.indexOf('stats_date')!==-1||(l.indexOf('date')!==-1&&l.indexOf('is_last')===-1);});
    F.vc = meas.find(function(f){var l=f.toLowerCase();return l.indexOf('view_count')!==-1||l.indexOf('dashboard_view')!==-1;});

    // --- AUTO-DETECT MODE ---
    // Usage: has date field + view_count measure
    // Lineage: has dashboard + explore + view + table (no date)
    // Overlap: has view + fields but no dashboard (or no explore)
    var mode;
    if (F.date && F.vc) mode = 'usage';
    else if (F.dash && F.exp && F.view) mode = 'lineage';
    else if (F.view && F.flds) mode = 'overlap';
    else mode = 'lineage'; // fallback

    function gv(row, key) { return key && row[key] ? row[key].value || '' : ''; }
    function gn(row, key) { return key && row[key] ? parseFloat(row[key].value) || 0 : 0; }

    // ========== LINEAGE MODE ==========
    if (mode === 'lineage') {
      var seen = {}, rows = [];
      data.forEach(function(row) {
        var fv = gv(row, F.flds);
        var rf = fv ? fv.split('|').map(function(f){return f.trim();}).filter(function(f){return f.length>0&&f.indexOf('.')===-1;}) : [];
        var mv = gv(row, F.model);
        if (!mv) Object.keys(row).forEach(function(k){if(k.toLowerCase().indexOf('model')!==-1&&row[k]&&row[k].value)mv=row[k].value;});
        var r = { dash:gv(row,F.dash), exp:gv(row,F.exp), view:gv(row,F.view), tbl:gv(row,F.tbl), model:mv, fields:rf, extV:gv(row,F.ext), incV:gv(row,F.inc) };
        var k = [r.dash,r.exp,r.view,r.tbl,r.model,r.extV,r.incV].join('||');
        if (seen[k]) { var ex=seen[k]; rf.forEach(function(f){if(ex.fields.indexOf(f)===-1)ex.fields.push(f);}); }
        else { seen[k]=r; rows.push(r); }
      });

      var tbls={},vws={},exps={},dashs={},v2t={},v2v={},e2v={},d2e={},vM={};
      rows.forEach(function(r){
        if(r.tbl&&!tbls[r.tbl])tbls[r.tbl]={id:'t_'+r.tbl,name:r.tbl,type:'table',sources:[],fields:[]};
        if(r.view&&!vws[r.view])vws[r.view]={id:'v_'+r.view,name:r.view,type:'view',sources:[],fields:[],model:null};
        if(r.exp&&!exps[r.exp])exps[r.exp]={id:'e_'+r.exp,name:r.exp,type:'explore',sources:[],fields:[],model:r.model};
        if(r.dash&&!dashs[r.dash])dashs[r.dash]={id:'d_'+r.dash,name:r.dash,type:'dashboard',sources:[],fields:[]};
        if(r.extV&&!vws[r.extV])vws[r.extV]={id:'v_'+r.extV,name:r.extV,type:'view',sources:[],fields:[],model:null};
        if(r.incV&&!vws[r.incV])vws[r.incV]={id:'v_'+r.incV,name:r.incV,type:'view',sources:[],fields:[],model:null};
      });
      rows.forEach(function(r){
        if(r.view&&r.model){if(!vM[r.view])vM[r.view]={};vM[r.view][r.model]=true;}
        if(r.tbl&&tbls[r.tbl])r.fields.forEach(function(f){if(tbls[r.tbl].fields.indexOf(f)===-1)tbls[r.tbl].fields.push(f);});
        if(r.view&&vws[r.view])r.fields.forEach(function(f){if(vws[r.view].fields.indexOf(f)===-1)vws[r.view].fields.push(f);});
        if(r.exp&&exps[r.exp])r.fields.forEach(function(f){if(exps[r.exp].fields.indexOf(f)===-1)exps[r.exp].fields.push(f);});
        if(r.dash&&dashs[r.dash])r.fields.forEach(function(f){if(dashs[r.dash].fields.indexOf(f)===-1)dashs[r.dash].fields.push(f);});
        if(r.view&&r.tbl){if(!v2t[r.view])v2t[r.view]={};v2t[r.view]['t_'+r.tbl]=true;}
        if(r.view&&r.extV&&r.view!==r.extV){if(!v2v[r.view])v2v[r.view]={};v2v[r.view]['v_'+r.extV]=true;}
        if(r.view&&r.incV&&r.view!==r.incV){if(!v2v[r.view])v2v[r.view]={};v2v[r.view]['v_'+r.incV]=true;}
        if(r.exp&&r.view){if(!e2v[r.exp])e2v[r.exp]={};e2v[r.exp]['v_'+r.view]=true;}
        if(r.dash&&r.exp){if(!d2e[r.dash])d2e[r.dash]={};d2e[r.dash]['e_'+r.exp]=true;}
      });
      Object.keys(vws).forEach(function(v){if(vM[v])vws[v].model=Object.keys(vM[v]).join(', ');});
      Object.keys(vws).forEach(function(k){vws[k].sources=Object.keys(v2t[k]||{}).concat(Object.keys(v2v[k]||{}));});
      Object.keys(exps).forEach(function(k){exps[k].sources=Object.keys(e2v[k]||{});});
      Object.keys(dashs).forEach(function(k){dashs[k].sources=Object.keys(d2e[k]||{});});

      var ae=Object.values(tbls).concat(Object.values(vws)).concat(Object.values(exps)).concat(Object.values(dashs));
      var selNode=null,up=[],dn=[];
      var tCfg={table:{c:'#06b6d4',l:'Tables'},view:{c:'#8b5cf6',l:'Views'},explore:{c:'#ec4899',l:'Explores'},dashboard:{c:'#f97316',l:'Dashboards'}};
      var tI={
        table:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="9" width="8" height="3"/><rect x="13" y="9" width="8" height="3"/><rect x="3" y="14" width="8" height="3"/><rect x="13" y="14" width="8" height="3"/></svg>',
        view:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7z"/></svg>',
        explore:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
        dashboard:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="2" y="2" width="9" height="6" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="10" width="9" height="12" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>'
      };

      function gUp(id,d,v){if(d>15)return[];v=v||{};if(v[id])return[];v[id]=true;var e=ae.find(function(x){return x.id===id;});if(!e||!e.sources)return[];var r=[];e.sources.forEach(function(s){if(!v[s]){r.push(s);r=r.concat(gUp(s,(d||0)+1,v));}});return r.filter(function(x,i,a){return a.indexOf(x)===i;});}
      function gDn(id,d,v){if(d>15)return[];v=v||{};if(v[id])return[];v[id]=true;var r=[];ae.forEach(function(e){if(e.sources&&e.sources.indexOf(id)!==-1&&!v[e.id]){r.push(e.id);r=r.concat(gDn(e.id,(d||0)+1,v));}});return r.filter(function(x,i,a){return a.indexOf(x)===i;});}

      function renderLin(){
        var vis=ae;
        if(selNode){up=gUp(selNode.id,0);dn=gDn(selNode.id,0);var ids=[selNode.id].concat(up).concat(dn);vis=ae.filter(function(e){return ids.indexOf(e.id)!==-1;});}
        var bt={table:[],view:[],explore:[],dashboard:[]};vis.forEach(function(e){bt[e.type].push(e);});['table','view','explore','dashboard'].forEach(function(t){bt[t].sort(function(a,b){return a.name.localeCompare(b.name);});});
        var nW=180,nH=32,sp=40,pd=12,sW=Math.max(W-24,900),cS=(sW-pd*2-nW)/3;
        var cX={table:pd,view:pd+cS,explore:pd+cS*2,dashboard:pd+cS*3},pos={},sY=55;
        ['table','view','explore','dashboard'].forEach(function(t){bt[t].forEach(function(e,i){pos[e.id]={x:cX[t],y:sY+i*sp};});});
        var mC=Math.max(bt.table.length||1,bt.view.length||1,bt.explore.length||1,bt.dashboard.length||1),sH=Math.max(mC*sp+70,250);
        var edges='';vis.forEach(function(e){(e.sources||[]).forEach(function(s){var f=pos[s],t=pos[e.id];if(!f||!t)return;var st='#334155',op=0.25,sw=1.5;if(selNode){if(s===selNode.id||dn.indexOf(e.id)!==-1){st='#f97316';op=0.9;sw=2;}else if(e.id===selNode.id||up.indexOf(s)!==-1){st='#06b6d4';op=0.9;sw=2;}}var x1=f.x+nW,y1=f.y+nH/2,x2=t.x,y2=t.y+nH/2,mx=(x1+x2)/2;edges+='<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+st+'" stroke-width="'+sw+'" stroke-opacity="'+op+'"/>';});});
        var nodes='';vis.forEach(function(en){var p=pos[en.id],cf=tCfg[en.type],iS=selNode&&selNode.id===en.id,iU=selNode&&up.indexOf(en.id)!==-1,iD=selNode&&dn.indexOf(en.id)!==-1;var bc=cf.c,bw=1;if(iS){bc='#fff';bw=2;}else if(iU){bc='#06b6d4';bw=2;}else if(iD){bc='#f97316';bw=2;}var nm=en.name.length>22?en.name.substring(0,20)+'..':en.name;nodes+='<g class="nd" data-id="'+en.id+'" style="cursor:pointer" transform="translate('+p.x+','+p.y+')"><rect width="'+nW+'" height="'+nH+'" rx="6" fill="#0f172a" stroke="'+bc+'" stroke-width="'+bw+'"/><rect x="1" y="1" width="28" height="'+(nH-2)+'" rx="5" fill="'+cf.c+'" fill-opacity="0.15"/><g transform="translate(8,'+(nH/2-6)+')" fill="'+cf.c+'">'+tI[en.type]+'</g><text x="34" y="'+(nH/2+3)+'" fill="#e2e8f0" font-size="9" font-weight="500">'+nm+'</text></g>';});
        var hdr='';['table','view','explore','dashboard'].forEach(function(t){var cf=tCfg[t];hdr+='<text x="'+(cX[t]+nW/2)+'" y="18" text-anchor="middle" fill="'+cf.c+'" font-size="8" font-weight="600">'+cf.l.toUpperCase()+'</text><text x="'+(cX[t]+nW/2)+'" y="30" text-anchor="middle" fill="#475569" font-size="8">'+bt[t].length+'</text>';});
        var stats=selNode?'<span style="color:'+tCfg[selNode.type].c+'">'+selNode.name+'</span> <span style="color:#06b6d4">↑'+up.length+'</span> <span style="color:#f97316">↓'+dn.length+'</span>':'<span style="color:#64748b">Click node to trace lineage</span>';
        var h='<div style="background:#0f172a;height:100%;display:flex;flex-direction:column"><div style="padding:8px 16px;border-bottom:1px solid #1e293b;font-size:11px;display:flex;justify-content:space-between"><div>'+stats+'</div><div style="color:#64748b">'+ae.length+' entities · '+data.length+' rows</div></div><div style="flex:1;overflow:auto;padding:8px"><svg width="'+sW+'" height="'+sH+'" style="font-family:system-ui,sans-serif">'+hdr+edges+nodes+'</svg></div></div>';
        R.innerHTML=h;
        R.querySelectorAll('.nd').forEach(function(n){n.addEventListener('click',function(){var id=n.dataset.id,en=ae.find(function(x){return x.id===id;});if(selNode&&selNode.id===id){selNode=null;up=[];dn=[];}else selNode=en;renderLin();});});
      }
      renderLin(); done(); return;
    }

    // ========== OVERLAP MODE ==========
    if (mode === 'overlap') {
      function gfp(fn){if(!fn)return null;var nm=fn.toLowerCase(),i=nm.indexOf('_');return i>0?nm.substring(0,i):null;}
      var genC=['id','name','type','date','value','status','code','key','count','sum','avg','min','max','total','amount','number','num','flag','is','has'];
      var lvlI=['ad','ads','campaign','campaigns','section','publisher','marketer','advertiser','account','user','website','order','line_item','lineitem','creative','placement','daily','weekly','monthly','hourly','yearly','agg','aggregate','summary','rollup'];
      function eLvl(vn){if(!vn)return[];var nm=vn.toLowerCase(),f=[];lvlI.forEach(function(lv){if(nm.indexOf(lv)!==-1){var i=nm.indexOf(lv),b=i===0?'_':nm[i-1],a=i+lv.length>=nm.length?'_':nm[i+lv.length];if((b==='_'||b==='-'||i===0)&&(a==='_'||a==='-'||i+lv.length===nm.length))f.push(lv);}});return f;}
      function dLvl(a,b){var l1=eLvl(a),l2=eLvl(b);if(l1.length>0&&l2.length>0){var n=function(l){if(l.indexOf('ad')===0)return'ad';if(l.indexOf('campaign')===0)return'campaign';if(l.indexOf('account')===0)return'account';if(l.indexOf('user')===0)return'user';return l;};var n1=l1.map(n),n2=l2.map(n);if(n1.filter(function(x){return n2.indexOf(x)===-1;}).length>0||n2.filter(function(x){return n1.indexOf(x)===-1;}).length>0)return true;}return false;}
      function gfc(fn){if(!fn)return'';var nm=fn.toLowerCase(),i=nm.indexOf('_');return(i>0&&i<6)?nm.substring(i+1):nm;}
      function igc(c){return!c||c.length<=2||genC.indexOf(c)!==-1;}

      var views={};
      data.forEach(function(row){
        var vn=gv(row,F.view),fv=gv(row,F.flds),mv=gv(row,F.model);
        if(!vn)return;
        if(!views[vn])views[vn]={name:vn,model:mv,fields:[]};
        if(mv&&!views[vn].model)views[vn].model=mv;
        fv.split('|').forEach(function(f){f=f.trim();if(f&&f.indexOf('.')===-1&&views[vn].fields.indexOf(f)===-1)views[vn].fields.push(f);});
      });

      var expD={},simR=null,simL=false,simE=null;
      var chD='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
      var chU='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>';

      function analyze(){
        simL=true;simE=null;renderOvl();
        setTimeout(function(){
          try{
            var res=[],vl=Object.values(views).filter(function(v){return v.fields&&v.fields.length>=5;});
            for(var i=0;i<vl.length;i++){for(var j=i+1;j<vl.length;j++){
              var v1=vl[i],v2=vl[j];
              var p1={},p2={},v1P=null,v2P=null;
              v1.fields.forEach(function(f){var p=gfp(f);if(p)p1[p]=(p1[p]||0)+1;});v2.fields.forEach(function(f){var p=gfp(f);if(p)p2[p]=(p2[p]||0)+1;});
              var m1=0,m2=0;Object.keys(p1).forEach(function(p){if(p1[p]>m1){m1=p1[p];v1P=p;}});Object.keys(p2).forEach(function(p){if(p2[p]>m2){m2=p2[p];v2P=p;}});
              if((!v1P||!v2P||v1P===v2P)===false||dLvl(v1.name,v2.name))continue;
              var matches=[],v1M={},v2M={};
              v1.fields.forEach(function(f1){if(v1M[f1.toLowerCase()])return;v2.fields.forEach(function(f2){if(v2M[f2.toLowerCase()])return;if(f1.toLowerCase()===f2.toLowerCase()){matches.push({f1:f1,f2:f2,type:'exact'});v1M[f1.toLowerCase()]=true;v2M[f2.toLowerCase()]=true;}});});
              var bc={};v1.fields.forEach(function(f){if(v1M[f.toLowerCase()])return;var c=gfc(f);if(c&&!igc(c)){if(!bc[c])bc[c]=[];bc[c].push(f);}});v2.fields.forEach(function(f2){if(v2M[f2.toLowerCase()])return;var c=gfc(f2);if(c&&!igc(c)&&bc[c]&&bc[c].length>0){for(var k=0;k<bc[c].length;k++){var f1=bc[c][k];if(!v1M[f1.toLowerCase()]){matches.push({f1:f1,f2:f2,type:'similar',core:c});v1M[f1.toLowerCase()]=true;v2M[f2.toLowerCase()]=true;break;}}}});
              var em=matches.filter(function(m){return m.type==='exact';}),sm=matches.filter(function(m){return m.type==='similar';});
              var mn=Math.min(v1.fields.length,v2.fields.length),sc=Math.round((em.length+sm.length*0.5)/mn*100);
              if(em.length>=5||em.length/mn>=0.4||matches.length/mn>=0.6)
                res.push({v1:v1.name,v2:v2.name,v1M:v1.model||'-',v2M:v2.model||'-',sim:Math.min(sc,100),ec:em.length,sc:sm.length,v1c:v1.fields.length,v2c:v2.fields.length,em:em,sm:sm,v1o:v1.fields.filter(function(f){return!v1M[f.toLowerCase()];}),v2o:v2.fields.filter(function(f){return!v2M[f.toLowerCase()];})});
            }}
            res.sort(function(a,b){return b.sim-a.sim;});simR=res.slice(0,100);simL=false;renderOvl();
          }catch(e){simR=[];simE='Error: '+e.message;simL=false;renderOvl();}
        },100);
      }

      function renderOvl(){
        var vc=Object.values(views).filter(function(v){return v.fields&&v.fields.length>=5;}).length,met=null;
        if(simR&&simR.length>0){var uv={},ts=0;simR.forEach(function(p){uv[p.v1]=true;uv[p.v2]=true;ts+=p.sim;});met={tv:Object.keys(uv).length,avg:Math.round(ts/simR.length),tp:simR.length};}
        var h='<div style="background:#0f172a;height:100%;display:flex;flex-direction:column"><div style="padding:10px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between"><div style="color:#94a3b8;font-size:11px">Analyzing <span style="color:#e2e8f0;font-weight:500">'+vc+'</span> views · '+data.length+' rows</div>';
        if(met){var sc=met.avg>=70?'#10b981':met.avg>=50?'#eab308':'#f97316';h+='<div style="display:flex;gap:16px;font-size:11px"><span><span style="color:#a78bfa;font-weight:600">'+met.tv+'</span> <span style="color:#64748b">views</span></span><span><span style="color:'+sc+';font-weight:600">'+met.avg+'%</span> <span style="color:#64748b">avg</span></span><span><span style="color:#22d3ee;font-weight:600">'+met.tp+'</span> <span style="color:#64748b">pairs</span></span></div>';}
        h+='</div>';
        if(simL)h+='<div style="text-align:center;padding:40px;color:#8b5cf6;font-size:12px">Analyzing...</div>';
        else if(simE)h+='<div style="text-align:center;padding:40px;color:#ef4444;font-size:12px">'+simE+'</div>';
        else if(!simR||simR.length===0)h+='<div style="text-align:center;padding:40px;color:#10b981;font-size:12px">No significant overlap</div>';
        else{
          h+='<div style="flex:1;overflow-y:auto">';
          simR.forEach(function(p,idx){
            var isE=expD[idx],sc=p.sim>=70?'#10b981':p.sim>=50?'#eab308':'#f97316';
            h+='<div class="dr" data-i="'+idx+'" style="border-bottom:1px solid #1e293b"><div class="dh" style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer" onmouseover="this.style.background=\'#1e293b40\'" onmouseout="this.style.background=\'transparent\'"><div style="min-width:36px;width:36px;height:36px;border-radius:6px;background:'+sc+'15;border:1px solid '+sc+'40;display:flex;align-items:center;justify-content:center"><span style="font-size:12px;color:'+sc+';font-weight:700">'+p.sim+'%</span></div><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="color:#a78bfa;font-size:12px;font-weight:500">'+p.v1+'</span><span style="color:#475569;font-size:10px">('+p.v1M+')</span><span style="color:#334155">↔</span><span style="color:#a78bfa;font-size:12px;font-weight:500">'+p.v2+'</span><span style="color:#475569;font-size:10px">('+p.v2M+')</span></div><div style="display:flex;gap:10px;margin-top:4px;font-size:10px;color:#64748b"><span><span style="color:#10b981">'+p.ec+'</span> exact</span>'+(p.sc>0?'<span><span style="color:#eab308">'+p.sc+'</span> similar</span>':'')+'<span>'+p.v1c+' / '+p.v2c+' fields</span></div></div><span style="color:#475569">'+(isE?chU:chD)+'</span></div>';
            if(isE){h+='<div style="padding:8px 16px 12px;background:#0c1322"><div style="display:grid;grid-template-columns:1fr 40px 1fr;font-size:10px;border-radius:6px;overflow:hidden;border:1px solid #1e293b"><div style="padding:8px 10px;background:#1e293b;color:#64748b;font-weight:600;font-size:9px">'+p.v1+'</div><div style="padding:8px;background:#1e293b"></div><div style="padding:8px 10px;background:#1e293b;color:#64748b;font-weight:600;font-size:9px">'+p.v2+'</div>';p.em.forEach(function(m){h+='<div style="padding:6px 10px;background:#0f172a;color:#e2e8f0;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px">'+m.f1+'</div><div style="padding:6px;background:#0f172a;color:#10b981;text-align:center;border-top:1px solid #1e293b30;font-weight:600">=</div><div style="padding:6px 10px;background:#0f172a;color:#e2e8f0;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px">'+m.f2+'</div>';});p.sm.forEach(function(m){h+='<div style="padding:6px 10px;background:#1e293b20;color:#fbbf24;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px">'+m.f1+'</div><div style="padding:6px;background:#1e293b20;color:#eab308;text-align:center;border-top:1px solid #1e293b30">≈</div><div style="padding:6px 10px;background:#1e293b20;color:#fbbf24;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px">'+m.f2+'</div>';});p.v1o.slice(0,8).forEach(function(f){h+='<div style="padding:6px 10px;background:#0f172a;color:#f87171;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;opacity:.8">'+f+'</div><div style="padding:6px;background:#0f172a;color:#334155;text-align:center;border-top:1px solid #1e293b30">—</div><div style="padding:6px;background:#0f172a;border-top:1px solid #1e293b30"></div>';});p.v2o.slice(0,8).forEach(function(f){h+='<div style="padding:6px;background:#0f172a;border-top:1px solid #1e293b30"></div><div style="padding:6px;background:#0f172a;color:#334155;text-align:center;border-top:1px solid #1e293b30">—</div><div style="padding:6px 10px;background:#0f172a;color:#f87171;font-family:monospace;border-top:1px solid #1e293b30;font-size:11px;opacity:.8">'+f+'</div>';});h+='</div></div>';}
            h+='</div>';
          });
          h+='</div>';
        }
        h+='</div>';
        R.innerHTML=h;
        R.querySelectorAll('.dh').forEach(function(hdr){hdr.addEventListener('click',function(){var i=parseInt(hdr.parentElement.dataset.i);expD[i]=!expD[i];renderOvl();});});
      }
      analyze(); done(); return;
    }

    // ========== USAGE MODE ==========
    if (mode === 'usage') {
      function pd(v){if(!v)return null;var d=new Date(String(v).substring(0,10)+'T00:00:00');return isNaN(d.getTime())?null:d;}
      function dss(d){return d?d.toISOString().substring(0,10):'';}

      var uRows=[];
      data.forEach(function(row){
        uRows.push({dash:gv(row,F.dash),dashId:gv(row,F.dashId),exp:gv(row,F.exp),view:gv(row,F.view),tbl:gv(row,F.tbl),model:gv(row,F.model),date:pd(gv(row,F.date)),dateStr:dss(pd(gv(row,F.date))),vc:gn(row,F.vc)});
      });

      // Dashboard: dedup per day (same dash+date = take vc once)
      var ddVc={};
      uRows.forEach(function(r){if(!r.dash||!r.dateStr)return;var k=r.dash+'||'+r.dateStr;if(!ddVc[k])ddVc[k]={dash:r.dash,dashId:r.dashId,model:r.model,vc:r.vc};});
      var dashTotal={};
      Object.values(ddVc).forEach(function(d){if(!dashTotal[d.dash])dashTotal[d.dash]={vc:0,dashId:d.dashId,model:d.model};dashTotal[d.dash].vc+=d.vc;});

      // Explore: sum dashboard views of dashboards using this explore
      var expDash={};
      uRows.forEach(function(r){if(r.exp&&r.dash){if(!expDash[r.exp])expDash[r.exp]={};expDash[r.exp][r.dash]=true;}});
      var expTotal={};
      Object.keys(expDash).forEach(function(e){var tv=0,m='';Object.keys(expDash[e]).forEach(function(d){if(dashTotal[d]){tv+=dashTotal[d].vc;if(!m)m=dashTotal[d].model;}});expTotal[e]={vc:tv,model:m,dc:Object.keys(expDash[e]).length};});

      // View: through explores
      var viewExp={};
      uRows.forEach(function(r){if(r.view&&r.exp){if(!viewExp[r.view])viewExp[r.view]={};viewExp[r.view][r.exp]=true;}});
      var viewTotal={};
      Object.keys(viewExp).forEach(function(v){var tv=0,vd={},m='';Object.keys(viewExp[v]).forEach(function(e){if(expDash[e])Object.keys(expDash[e]).forEach(function(d){vd[d]=true;});});Object.keys(vd).forEach(function(d){if(dashTotal[d])tv+=dashTotal[d].vc;});uRows.forEach(function(r){if(r.view===v&&r.model&&!m)m=r.model;});viewTotal[v]={vc:tv,model:m,ec:Object.keys(viewExp[v]).length,dc:Object.keys(vd).length};});

      // Table: through views
      var tblView={};
      uRows.forEach(function(r){if(r.tbl&&r.view){if(!tblView[r.tbl])tblView[r.tbl]={};tblView[r.tbl][r.view]=true;}});
      var tblTotal={};
      Object.keys(tblView).forEach(function(t){var tv=0;Object.keys(tblView[t]).forEach(function(v){if(viewTotal[v])tv+=viewTotal[v].vc;});tblTotal[t]={vc:tv,vc2:Object.keys(tblView[t]).length};});

      var actEnt='dashboard',sCol='vc',sDir='desc';
      var lnk='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
      var eC={dashboard:'#f97316',explore:'#ec4899',view:'#8b5cf6',table:'#06b6d4'};

      function bLink(t,n,m,did){if(!baseUrl)return null;if(t==='dashboard'&&did)return baseUrl+'/dashboards/'+did;if(t==='explore'&&m&&n)return baseUrl+'/explore/'+m+'/'+n;return null;}

      function getList(){
        var ls=[];
        if(actEnt==='dashboard')Object.keys(dashTotal).forEach(function(d){var v=dashTotal[d];ls.push({name:d,model:v.model,vc:v.vc,extra:'',link:bLink('dashboard',d,v.model,v.dashId)});});
        else if(actEnt==='explore')Object.keys(expTotal).forEach(function(e){var v=expTotal[e];ls.push({name:e,model:v.model,vc:v.vc,extra:v.dc+' dash',link:bLink('explore',e,v.model)});});
        else if(actEnt==='view')Object.keys(viewTotal).forEach(function(w){var v=viewTotal[w];ls.push({name:w,model:v.model,vc:v.vc,extra:v.dc+' dash · '+v.ec+' exp',link:null});});
        else Object.keys(tblTotal).forEach(function(t){var v=tblTotal[t];ls.push({name:t,model:'',vc:v.vc,extra:v.vc2+' views',link:null});});
        ls.sort(function(a,b){if(sCol==='vc')return sDir==='asc'?a.vc-b.vc:b.vc-a.vc;var va=a[sCol]||'',vb=b[sCol]||'';return sDir==='asc'?va.localeCompare(vb):vb.localeCompare(va);});
        return ls;
      }

      function renderUsg(){
        var ls=getList(),tv=0;ls.forEach(function(i){tv+=i.vc;});var col=eC[actEnt];
        var h='<div style="background:#0f172a;height:100%;display:flex;flex-direction:column">';
        h+='<div style="padding:8px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between">';
        h+='<div style="display:flex;gap:0">';
        ['dashboard','explore','view','table'].forEach(function(t,i){var c=eC[t],a=actEnt===t;h+='<button class="eb" data-e="'+t+'" style="padding:6px 12px;border:1px solid #334155;'+(i>0?'border-left:none;':'')+(i===0?'border-radius:6px 0 0 6px;':'')+(i===3?'border-radius:0 6px 6px 0;':'')+'cursor:pointer;font-size:11px;background:'+(a?'#1e293b':'transparent')+';color:'+(a?c:'#64748b')+'">'+t.charAt(0).toUpperCase()+t.slice(1)+'s</button>';});
        h+='</div>';
        h+='<div style="font-size:11px;color:#64748b">'+ls.length+' '+actEnt+'s · <span style="color:'+col+'">'+tv.toLocaleString()+'</span> views (30d)</div></div>';
        // Header
        h+='<div style="display:grid;grid-template-columns:1fr 140px 120px 150px 40px;border-bottom:1px solid #1e293b;background:#0f172a;position:sticky;top:0;z-index:1">';
        [{k:'name',l:'Name'},{k:'model',l:'Model'},{k:'vc',l:'Views (30d)'},{k:'extra',l:'References'},{k:'link',l:''}].forEach(function(c){
          if(c.k==='link'){h+='<div style="padding:8px 6px"></div>';return;}
          var a=sCol===c.k,ar=a?(sDir==='asc'?' ↑':' ↓'):'';
          h+='<div class="sc" data-c="'+c.k+'" style="padding:8px 10px;font-size:10px;font-weight:600;color:'+(a?'#e2e8f0':'#64748b')+';cursor:pointer;user-select:none">'+c.l+ar+'</div>';
        });
        h+='</div>';
        h+='<div style="flex:1;overflow-y:auto">';
        var mx=ls.length>0?ls.reduce(function(m,i){return Math.max(m,i.vc);},0):1;
        ls.forEach(function(it){
          var bW=mx>0?Math.max(it.vc/mx*100,0):0;var vc=it.vc===0?'#ef4444':it.vc<10?'#f59e0b':'#10b981';
          h+='<div style="display:grid;grid-template-columns:1fr 140px 120px 150px 40px;border-bottom:1px solid #1e293b20" onmouseover="this.style.background=\'#1e293b40\'" onmouseout="this.style.background=\'transparent\'">';
          h+='<div style="padding:6px 10px;font-size:11px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+it.name+'">'+it.name+'</div>';
          h+='<div style="padding:6px 10px;font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(it.model||'-')+'</div>';
          h+='<div style="padding:6px 10px"><div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;color:'+vc+';font-weight:600;min-width:40px">'+it.vc.toLocaleString()+'</span><div style="flex:1;height:4px;background:#1e293b;border-radius:2px;overflow:hidden"><div style="width:'+bW+'%;height:100%;background:'+col+';border-radius:2px"></div></div></div></div>';
          h+='<div style="padding:6px 10px;font-size:10px;color:#64748b">'+it.extra+'</div>';
          h+='<div style="padding:6px 6px;text-align:center">';
          if(it.link)h+='<a href="'+it.link+'" target="_blank" rel="noopener" style="color:#64748b;text-decoration:none" onmouseover="this.style.color=\'#e2e8f0\'" onmouseout="this.style.color=\'#64748b\'">'+lnk+'</a>';
          h+='</div></div>';
        });
        if(ls.length===0)h+='<div style="text-align:center;padding:40px;color:#64748b;font-size:12px">No data</div>';
        h+='</div></div>';
        R.innerHTML=h;
        R.querySelectorAll('.eb').forEach(function(b){b.addEventListener('click',function(){actEnt=b.dataset.e;sCol='vc';sDir='desc';renderUsg();});});
        R.querySelectorAll('.sc').forEach(function(c){c.addEventListener('click',function(){var k=c.dataset.c;if(sCol===k)sDir=sDir==='asc'?'desc':'asc';else{sCol=k;sDir=k==='vc'?'desc':'asc';}renderUsg();});});
      }
      renderUsg(); done(); return;
    }

    done();
  }
});

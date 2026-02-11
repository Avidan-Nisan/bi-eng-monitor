looker.plugins.visualizations.add({
  id: "storage_cost_explorer",
  label: "Storage Cost Explorer",
  options: {
    primary_color: {type:"string",label:"Primary Color (Cost)",default:"#8b5cf6",section:"Style",order:1},
    secondary_color: {type:"string",label:"Secondary Color (Models)",default:"#06b6d4",section:"Style",order:2},
    show_trend: {type:"boolean",label:"Show Trend Chart",default:true,section:"Display",order:3},
    show_schema: {type:"boolean",label:"Show Schema Distribution",default:true,section:"Display",order:4},
    show_table: {type:"boolean",label:"Show Model List",default:true,section:"Display",order:5}
  },
  create: function(element) {
    element.style.height='100%';element.style.width='100%';
    element.innerHTML='<div id="scx" style="width:100%;height:100%;font-family:Inter,system-ui,-apple-system,sans-serif;background:#0a0e1a;color:#e2e8f0;display:flex;flex-direction:column;overflow:hidden"></div>';
    var s=document.createElement('style');
    s.textContent='#scx *{box-sizing:border-box}'+
    '.sc-body{flex:1;display:flex;flex-direction:column;overflow:hidden;margin:0 12px;background:#131b2e;border-radius:12px 12px 0 0;border:1px solid #1e293b;border-bottom:none}'+
    '.sc-bar{padding:10px 16px;border-bottom:1px solid rgba(30,41,59,0.25);display:flex;align-items:center;justify-content:space-between;font-size:11px;min-height:42px}'+
    '.sc-trend{position:relative;border-bottom:1px solid #1e293b;flex-shrink:0;overflow:hidden}'+
    '.sc-schema{border-bottom:1px solid #1e293b;flex-shrink:0;overflow:hidden;padding:16px 20px}'+
    '.sc-scroll{flex:1;overflow:auto}'+
    '.sc-hdr{display:grid;grid-template-columns:40px 1fr 180px;border-bottom:1px solid #1e293b;position:sticky;top:0;background:#131b2e;z-index:1}'+
    '.sc-hdr>div{padding:10px 12px;font-size:10px;font-weight:600;color:#475569;cursor:pointer;user-select:none;text-transform:uppercase;letter-spacing:.5px;transition:color .15s}'+
    '.sc-hdr>div:hover{color:#94a3b8}.sc-hdr>div.on{color:#e2e8f0}'+
    '.sc-row{display:grid;grid-template-columns:40px 1fr 180px;border-bottom:1px solid rgba(30,41,59,0.1);transition:background .15s}'+
    '.sc-row:hover{background:rgba(30,41,59,0.3)}'+
    '.sc-cell{padding:8px 12px;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
    '.sc-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:5px;font-size:9px;font-weight:600;letter-spacing:.3px}'+
    '.sc-tab{padding:8px 18px;font-size:11px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#475569;border-radius:8px;transition:all .2s;letter-spacing:.3px}'+
    '.sc-tab:hover{color:#94a3b8;background:rgba(30,41,59,0.25)}.sc-tab.on{color:#e2e8f0;background:#1e293b}'+
    '.sc-ttip{position:absolute;pointer-events:none;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 14px;font-size:11px;z-index:10;box-shadow:0 8px 24px rgba(0,0,0,.4);white-space:nowrap;transition:opacity .12s;opacity:0}'+
    '.sc-kpi{display:flex;gap:12px;padding:16px 20px;background:linear-gradient(180deg,#0f1629,#0a0e1a);flex-wrap:wrap}'+
    '.sc-kpi-card{flex:1;min-width:140px;padding:16px 20px;background:#131b2e;border:1px solid #1e293b;border-radius:12px;display:flex;flex-direction:column;gap:6px}'+
    '.sc-kpi-label{font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.8px}'+
    '.sc-kpi-val{font-size:28px;font-weight:800;line-height:1.1;letter-spacing:-.5px}'+
    '.sc-kpi-sub{font-size:10px;color:#475569}'+
    '.sc-srow{display:flex;align-items:center;gap:10px;padding:6px 0;cursor:pointer;transition:opacity .15s;border-radius:6px}.sc-srow:hover{opacity:.85}';
    element.appendChild(s);
  },
  updateAsync: function(data, element, config, queryResponse, details, done) {
    var R=element.querySelector('#scx'),W=element.offsetWidth||1200,H=element.offsetHeight||600;
    var pc=config.primary_color||'#8b5cf6',sc2=config.secondary_color||'#06b6d4';
    var showTrend=config.show_trend!==false,showSchema=config.show_schema!==false,showTable=config.show_table!==false;

    if(!data||!data.length){R.innerHTML='<div style="padding:40px;color:#475569;text-align:center">No data available</div>';done();return;}

    var dims=queryResponse.fields.dimension_like.map(function(f){return f.name;});
    var meas=queryResponse.fields.measure_like?queryResponse.fields.measure_like.map(function(f){return f.name;}):[];
    var allF=dims.concat(meas);

    var F={};
    F.date=dims.find(function(f){var l=f.toLowerCase();return l.indexOf('stats_date')!==-1||(l.indexOf('date')!==-1&&l.indexOf('is_')===-1);});
    F.schema=dims.find(function(f){return f.toLowerCase().indexOf('table_schema')!==-1;});
    F.table=dims.find(function(f){return f.toLowerCase().indexOf('table_name')!==-1;});
    F.billing=dims.find(function(f){return f.toLowerCase().indexOf('current_billing')!==-1;});
    F.cost=allF.find(function(f){return f.toLowerCase().indexOf('current_monthly_cost')!==-1;});
    F.logGib=allF.find(function(f){return f.toLowerCase().indexOf('total_logical_gib')!==-1;});
    F.phyGib=allF.find(function(f){return f.toLowerCase().indexOf('total_physical_gib')!==-1;});
    F.savings=allF.find(function(f){return f.toLowerCase().indexOf('potential_monthly_savings')!==-1;});
    F.preferred=dims.find(function(f){return f.toLowerCase().indexOf('preferred_billing')!==-1;});
    F.optStatus=dims.find(function(f){return f.toLowerCase().indexOf('optimization_status')!==-1;});
    F.ttWaste=allF.find(function(f){return f.toLowerCase().indexOf('time_travel_waste')!==-1;});
    F.ttAlert=dims.find(function(f){return f.toLowerCase().indexOf('time_travel_alert')!==-1;});

    function gv(row,k){return k&&row[k]?row[k].value||'':'';}
    function gn(row,k){return k&&row[k]?parseFloat(row[k].value)||0:0;}
    function fmt$(v){if(v>=10000)return'$'+Math.round(v).toLocaleString();if(v>=1)return'$'+v.toFixed(2);return'$'+v.toFixed(4);}
    function fmtG(v){return v>=1000?(v/1024).toFixed(1)+' TiB':v.toFixed(2)+' GiB';}

    var sPal=['#8b5cf6','#06b6d4','#f59e0b','#ec4899','#10b981','#f97316','#3b82f6','#ef4444','#a855f7','#14b8a6','#eab308','#6366f1','#d946ef','#22d3ee','#84cc16'];

    var rows=[];
    data.forEach(function(row){
      rows.push({
        date:gv(row,F.date),schema:gv(row,F.schema),table:gv(row,F.table),
        billing:gv(row,F.billing),cost:gn(row,F.cost),
        logGib:gn(row,F.logGib),phyGib:gn(row,F.phyGib),
        savings:gn(row,F.savings),preferred:gv(row,F.preferred),
        optStatus:gv(row,F.optStatus),ttWaste:gn(row,F.ttWaste),ttAlert:gv(row,F.ttAlert)
      });
    });

    // --- Find the latest date ---
    var allDates={};
    rows.forEach(function(r){
      var d=r.date?String(r.date).substring(0,10):'';
      if(d)allDates[d]=true;
    });
    var sortedDates=Object.keys(allDates).sort();
    var latestDate=sortedDates.length>0?sortedDates[sortedDates.length-1]:'';
    var prevDate=sortedDates.length>1?sortedDates[sortedDates.length-2]:'';

    // --- Latest-day rows only (for KPIs, schema dist, model list) ---
    var latestRows=rows.filter(function(r){return String(r.date).substring(0,10)===latestDate;});
    var prevRows=prevDate?rows.filter(function(r){return String(r.date).substring(0,10)===prevDate;}):[];

    // Aggregate latest-day models
    var models={};
    latestRows.forEach(function(r){
      var key=(r.schema?r.schema+'.':'')+r.table;
      if(!key||key==='.')return;
      if(!models[key])models[key]={name:key,schema:r.schema,table:r.table,cost:0,logGib:0,phyGib:0,savings:0,ttWaste:0,billing:r.billing,preferred:r.preferred,optStatus:r.optStatus,ttAlert:r.ttAlert};
      var m=models[key];
      m.cost=Math.max(m.cost,r.cost);m.logGib=Math.max(m.logGib,r.logGib);
      m.phyGib=Math.max(m.phyGib,r.phyGib);m.savings=Math.max(m.savings,r.savings);
      m.ttWaste=Math.max(m.ttWaste,r.ttWaste);
      if(r.billing)m.billing=r.billing;if(r.preferred)m.preferred=r.preferred;
      if(r.optStatus)m.optStatus=r.optStatus;if(r.ttAlert)m.ttAlert=r.ttAlert;
    });
    var mList=Object.values(models);

    // Aggregate prev-day totals for delta
    var prevTotalCost=0,prevModelCount=0;
    if(prevRows.length>0){
      var prevModels={};
      prevRows.forEach(function(r){
        var key=(r.schema?r.schema+'.':'')+r.table;
        if(!key||key==='.')return;
        if(!prevModels[key])prevModels[key]={cost:0};
        prevModels[key].cost=Math.max(prevModels[key].cost,r.cost);
      });
      var pvList=Object.values(prevModels);
      prevModelCount=pvList.length;
      pvList.forEach(function(m){prevTotalCost+=m.cost;});
    }

    // Aggregate latest-day schemas
    var schemas={};
    mList.forEach(function(m){
      var s=m.schema||'(no schema)';
      if(!schemas[s])schemas[s]={name:s,cost:0,models:0,logGib:0,savings:0};
      schemas[s].cost+=m.cost;schemas[s].models++;schemas[s].logGib+=m.logGib;schemas[s].savings+=m.savings;
    });
    var sList=Object.values(schemas);
    sList.sort(function(a,b){return b.cost-a.cost;});
    var sColorMap={};
    sList.forEach(function(s,i){sColorMap[s.name]=sPal[i%sPal.length];});

    // Aggregate ALL dates for trend
    var byDate={};
    rows.forEach(function(r){
      var d=r.date?String(r.date).substring(0,10):'';if(!d)return;
      if(!byDate[d])byDate[d]={date:d,cost:0,models:{}};
      var key=(r.schema?r.schema+'.':'')+r.table;
      byDate[d].cost+=r.cost;
      if(key&&key!=='.')byDate[d].models[key]=true;
    });
    var trend=Object.values(byDate).map(function(d){return{date:d.date,cost:d.cost,count:Object.keys(d.models).length};});
    trend.sort(function(a,b){return a.date.localeCompare(b.date);});

    // Latest-day totals for KPIs
    var totalCost=0,totalSavings=0,totalLogGib=0,ttAlertCount=0;
    mList.forEach(function(m){
      totalCost+=m.cost;totalSavings+=m.savings;totalLogGib+=m.logGib;
      if(m.ttAlert&&m.ttAlert!=='null'&&m.ttAlert!=='')ttAlertCount++;
    });
    var optimizeCount=mList.filter(function(m){return m.savings>0;}).length;

    // Deltas
    var costDelta=prevTotalCost>0?totalCost-prevTotalCost:null;
    var modelDelta=prevModelCount>0?mList.length-prevModelCount:null;

    function fmtDelta(v,prefix){
      if(v===null||v===0)return'';
      var sign=v>0?'+':'';
      var clr=v>0?'#ef4444':'#10b981'; // cost up = red, cost down = green
      return ' <span style="color:'+clr+';font-size:11px;font-weight:600">'+sign+(prefix||'')+Math.abs(v<1&&v>-1?parseFloat(v.toFixed(4)):Math.round(v)).toLocaleString()+'</span>';
    }
    function fmtDeltaModels(v){
      if(v===null||v===0)return'';
      var sign=v>0?'+':'';
      var clr=v>0?sc2:'#f59e0b';
      return ' <span style="color:'+clr+';font-size:11px;font-weight:600">'+sign+v+'</span>';
    }

    // State
    var sC='cost',sD='desc',tab='all',schemaFilter=null;

    function getList(){
      var ls=mList.slice();
      if(schemaFilter)ls=ls.filter(function(m){return(m.schema||'(no schema)')===schemaFilter;});
      if(tab==='optimize')ls=ls.filter(function(m){return m.savings>0;});
      else if(tab==='alert')ls=ls.filter(function(m){return m.ttAlert&&m.ttAlert!=='null'&&m.ttAlert!=='';});
      ls.sort(function(a,b){
        if(sC==='name'){return sD==='asc'?(a.name||'').localeCompare(b.name||''):(b.name||'').localeCompare(a.name||'');}
        return sD==='asc'?(a[sC]||0)-(b[sC]||0):(b[sC]||0)-(a[sC]||0);
      });
      return ls;
    }

    function render(){
      var ls=getList();
      var h='';

      // ========== KPI CARDS ==========
      h+='<div class="sc-kpi">';
      var deltaLabel=prevDate?' <span style="color:#334155;font-size:9px;font-weight:400">(vs '+prevDate+')</span>':'';
      h+='<div class="sc-kpi-card"><div class="sc-kpi-label">Total Models</div><div class="sc-kpi-val" style="color:'+sc2+'">'+mList.length+fmtDeltaModels(modelDelta)+deltaLabel+'</div><div class="sc-kpi-sub">across '+sList.length+' schemas \u00B7 as of '+latestDate+'</div></div>';
      var gibSub=totalLogGib>0?fmtG(totalLogGib)+' logical storage \u00B7 ':'';
      h+='<div class="sc-kpi-card"><div class="sc-kpi-label">Monthly Cost</div><div class="sc-kpi-val" style="color:'+pc+'">'+fmt$(totalCost)+fmtDelta(costDelta,'
      if(totalSavings>0)h+='<div class="sc-kpi-card"><div class="sc-kpi-label">Potential Savings</div><div class="sc-kpi-val" style="color:#10b981">'+fmt$(totalSavings)+'</div><div class="sc-kpi-sub">'+optimizeCount+' models can optimize</div></div>';
      if(ttAlertCount>0)h+='<div class="sc-kpi-card"><div class="sc-kpi-label">Time Travel Alerts</div><div class="sc-kpi-val" style="color:#f59e0b">'+ttAlertCount+'</div><div class="sc-kpi-sub">tables with excess time travel storage</div></div>';
      h+='</div>';

      h+='<div class="sc-body">';

      // ========== TREND CHART ==========
      if(showTrend&&trend.length>1){
        var tH=Math.min(220,Math.max(160,Math.round(H*0.28)));
        var cW=W-120,cH=tH-70,px=60,py=30;
        var maxC=0,maxN=0;
        trend.forEach(function(t){if(t.cost>maxC)maxC=t.cost;if(t.count>maxN)maxN=t.count;});
        if(maxC===0)maxC=1;if(maxN===0)maxN=1;
        maxC*=1.1;maxN=Math.ceil(maxN*1.15);
        var stepX=trend.length>1?cW/(trend.length-1):cW;

        var costPts=[],costPath='',countPts=[],countPath='';
        trend.forEach(function(t,i){
          var x=px+i*stepX;
          var yc=py+cH-((t.cost/maxC)*cH);
          var yn=py+cH-((t.count/maxN)*cH);
          costPts.push({x:x,y:yc,d:t.date,c:t.cost,n:t.count});
          countPts.push({x:x,y:yn});
          costPath+=(i===0?'M':'L')+x.toFixed(1)+' '+yc.toFixed(1);
          countPath+=(i===0?'M':'L')+x.toFixed(1)+' '+yn.toFixed(1);
        });
        var costArea=costPath+'L'+(px+(trend.length-1)*stepX).toFixed(1)+' '+(py+cH)+' L'+px+' '+(py+cH)+' Z';
        var countArea=countPath+'L'+(px+(trend.length-1)*stepX).toFixed(1)+' '+(py+cH)+' L'+px+' '+(py+cH)+' Z';

        var svgW=cW+140;
        h+='<div class="sc-trend" style="height:'+tH+'px">';
        h+='<svg width="100%" height="'+tH+'" viewBox="0 0 '+svgW+' '+tH+'" preserveAspectRatio="xMidYMid meet">';
        h+='<defs>';
        h+='<linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+pc+'" stop-opacity="0.12"/><stop offset="100%" stop-color="'+pc+'" stop-opacity="0"/></linearGradient>';
        h+='<linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+sc2+'" stop-opacity="0.08"/><stop offset="100%" stop-color="'+sc2+'" stop-opacity="0"/></linearGradient>';
        h+='</defs>';

        for(var yi=0;yi<=4;yi++){
          var vy=py+cH-(yi/4)*cH;
          h+='<line x1="'+px+'" y1="'+vy+'" x2="'+(px+cW)+'" y2="'+vy+'" stroke="#1e293b" stroke-width="0.5"/>';
          h+='<text x="'+(px-10)+'" y="'+(vy+3)+'" text-anchor="end" fill="'+pc+'" font-size="9" font-weight="500" opacity=".7">'+fmt$(maxC*(yi/4))+'</text>';
          h+='<text x="'+(px+cW+10)+'" y="'+(vy+3)+'" text-anchor="start" fill="'+sc2+'" font-size="9" font-weight="500" opacity=".7">'+Math.round(maxN*(yi/4))+'</text>';
        }

        h+='<text x="'+(px-10)+'" y="'+(py-12)+'" text-anchor="end" fill="'+pc+'" font-size="9" font-weight="700" letter-spacing=".5">COST ($)</text>';
        h+='<text x="'+(px+cW+10)+'" y="'+(py-12)+'" text-anchor="start" fill="'+sc2+'" font-size="9" font-weight="700" letter-spacing=".5"># MODELS</text>';

        var xStep=Math.max(1,Math.floor(trend.length/7));
        trend.forEach(function(t,i){if(i%xStep===0||i===trend.length-1){var x=px+i*stepX;h+='<text x="'+x+'" y="'+(py+cH+18)+'" text-anchor="middle" fill="#64748b" font-size="9">'+t.date.substring(5)+'</text>';}});

        h+='<path d="'+costArea+'" fill="url(#cg1)"/>';
        h+='<path d="'+countArea+'" fill="url(#cg2)"/>';
        h+='<path d="'+costPath+'" fill="none" stroke="'+pc+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
        h+='<path d="'+countPath+'" fill="none" stroke="'+sc2+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';

        costPts.forEach(function(p){h+='<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="4" fill="#131b2e" stroke="'+pc+'" stroke-width="2"/>';});
        countPts.forEach(function(p){h+='<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3.5" fill="#131b2e" stroke="'+sc2+'" stroke-width="1.5"/>';});

        // Highlight latest day
        var lastCp=costPts[costPts.length-1],lastNp=countPts[countPts.length-1];
        if(lastCp)h+='<circle cx="'+lastCp.x.toFixed(1)+'" cy="'+lastCp.y.toFixed(1)+'" r="6" fill="'+pc+'" fill-opacity=".2" stroke="'+pc+'" stroke-width="2"/>';
        if(lastNp)h+='<circle cx="'+lastNp.x.toFixed(1)+'" cy="'+lastNp.y.toFixed(1)+'" r="5.5" fill="'+sc2+'" fill-opacity=".2" stroke="'+sc2+'" stroke-width="1.5"/>';

        var lgX=px,lgY=tH-6;
        h+='<circle cx="'+lgX+'" cy="'+(lgY-2)+'" r="4" fill="'+pc+'"/>';
        h+='<text x="'+(lgX+8)+'" y="'+lgY+'" fill="'+pc+'" font-size="10" font-weight="600">Monthly Cost</text>';
        h+='<circle cx="'+(lgX+110)+'" cy="'+(lgY-2)+'" r="4" fill="'+sc2+'"/>';
        h+='<text x="'+(lgX+118)+'" y="'+lgY+'" fill="'+sc2+'" font-size="10" font-weight="600"># Models</text>';

        costPts.forEach(function(p,i){h+='<rect class="sc-hover" data-i="'+i+'" x="'+(p.x-stepX/2)+'" y="'+py+'" width="'+Math.max(stepX,10)+'" height="'+cH+'" fill="transparent" style="cursor:crosshair"/>';});
        h+='</svg><div class="sc-ttip" id="sc-tip"></div></div>';
      }

      // ========== SCHEMA DISTRIBUTION ==========
      if(showSchema&&sList.length>0){
        var totalSchCost=0;sList.forEach(function(s){totalSchCost+=s.cost;});
        if(totalSchCost===0)totalSchCost=1;
        var maxSchCost=sList[0]?sList[0].cost:1;

        h+='<div class="sc-schema">';
        h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
        h+='<div style="display:flex;align-items:center;gap:8px"><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px">Schema Distribution</span>';
        if(schemaFilter)h+='<span style="font-size:9px;color:'+sColorMap[schemaFilter]+';background:'+sColorMap[schemaFilter]+'12;padding:2px 8px;border-radius:4px;cursor:pointer" class="sf-clear">\u2715 '+schemaFilter+'</span>';
        h+='</div>';
        h+='<span style="font-size:10px;color:#334155">'+sList.length+' schemas \u00B7 '+fmt$(totalSchCost)+' total \u00B7 '+latestDate+'</span></div>';

        sList.forEach(function(s,i){
          var pct=((s.cost/totalSchCost)*100);
          var barPct=Math.max((s.cost/maxSchCost)*100,2);
          var c=sColorMap[s.name];
          var isActive=!schemaFilter||schemaFilter===s.name;
          var op=isActive?'1':'0.3';

          h+='<div class="sc-srow sf-bar" data-s="'+s.name+'" style="opacity:'+op+'">';
          h+='<div style="min-width:140px;width:140px;display:flex;align-items:center;gap:8px;overflow:hidden">';
          h+='<span style="width:10px;height:10px;border-radius:3px;background:'+c+';flex-shrink:0"></span>';
          h+='<span style="font-size:11px;color:#e2e8f0;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+s.name+'">'+s.name+'</span></div>';
          h+='<div style="flex:1;height:20px;background:#0b1120;border-radius:4px;overflow:hidden;position:relative">';
          h+='<div style="width:'+barPct+'%;height:100%;background:'+c+';opacity:.35;border-radius:4px;transition:width .3s"></div>';
          h+='<span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:600;color:'+c+'">'+fmt$(s.cost)+'</span>';
          h+='</div>';
          h+='<div style="min-width:120px;text-align:right;display:flex;gap:10px;justify-content:flex-end">';
          h+='<span style="font-size:10px;color:#64748b">'+pct.toFixed(1)+'%</span>';
          h+='<span style="font-size:10px;color:#475569">'+s.models+' models</span>';
          h+='</div></div>';
        });
        h+='</div>';
      }

      // ========== TABS ==========
      h+='<div class="sc-bar"><div style="display:flex;gap:4px">';
      [{id:'all',l:'All Models ('+mList.length+')'},{id:'optimize',l:'Can Optimize ('+optimizeCount+')'},{id:'alert',l:'Time Travel Alerts ('+ttAlertCount+')'}].forEach(function(t){
        h+='<button class="sc-tab t-tab'+(tab===t.id?' on':'')+'" data-t="'+t.id+'">'+t.l+'</button>';
      });
      h+='</div><div style="display:flex;align-items:center;gap:10px">';
      if(schemaFilter)h+='<span class="sc-pill" style="background:'+sColorMap[schemaFilter]+'15;color:'+sColorMap[schemaFilter]+';border:1px solid '+sColorMap[schemaFilter]+'30">'+schemaFilter+'</span>';
      h+='<span style="color:#475569">Showing '+ls.length+' models</span></div></div>';

      // ========== TABLE ==========
      if(showTable){
        h+='<div class="sc-hdr"><div>#</div>';
        [{k:'name',l:'Model'},{k:'cost',l:'Monthly Cost'}].forEach(function(c){
          var isOn=sC===c.k;
          h+='<div class="sc-sort'+(isOn?' on':'')+'" data-c="'+c.k+'">'+c.l+(isOn?(sD==='asc'?' \u2191':' \u2193'):'')+'</div>';
        });
        h+='</div><div class="sc-scroll">';

        var mx=ls.length>0?ls.reduce(function(m,i){return Math.max(m,i.cost);},0):1;
        ls.forEach(function(m,i){
          var bW=mx>0?Math.max(m.cost/mx*100,1):0;
          var schClr=sColorMap[m.schema||'(no schema)']||'#475569';

          h+='<div class="sc-row">';
          h+='<div class="sc-cell" style="color:#334155;font-weight:600;text-align:center">'+(i+1)+'</div>';
          h+='<div class="sc-cell" title="'+m.name+'"><span style="display:inline-block;width:6px;height:6px;border-radius:2px;background:'+schClr+';margin-right:6px;vertical-align:middle"></span><span style="color:#e2e8f0;font-weight:500">'+m.table+'</span>';
          if(m.schema)h+=' <span style="color:#334155;font-size:9px">'+m.schema+'</span>';
          h+='</div>';
          h+='<div class="sc-cell"><div style="display:flex;align-items:center;gap:8px"><span style="color:'+pc+';font-weight:600;min-width:60px">'+fmt$(m.cost)+'</span><div style="flex:1;height:4px;background:#1e293b;border-radius:3px;overflow:hidden"><div style="width:'+bW+'%;height:100%;background:'+pc+';border-radius:3px;opacity:.6"></div></div></div></div>';
          h+='</div>';
        });
        if(!ls.length)h+='<div style="text-align:center;padding:60px;color:#475569">No models match this filter</div>';
        h+='</div>';
      }

      h+='</div>';
      R.innerHTML=h;

      // --- Events ---
      R.querySelectorAll('.t-tab').forEach(function(b){b.addEventListener('click',function(){tab=b.dataset.t;render();});});
      R.querySelectorAll('.sc-sort').forEach(function(c){c.addEventListener('click',function(){var k=c.dataset.c;if(sC===k)sD=sD==='asc'?'desc':'asc';else{sC=k;sD=k==='name'?'asc':'desc';}render();});});

      R.querySelectorAll('.sf-bar').forEach(function(b){
        b.addEventListener('click',function(){var s=b.dataset.s;schemaFilter=schemaFilter===s?null:s;render();});
      });
      var clr=R.querySelector('.sf-clear');
      if(clr)clr.addEventListener('click',function(e){e.stopPropagation();schemaFilter=null;render();});

      var tip=R.querySelector('#sc-tip');
      if(tip&&typeof costPts!=='undefined'){
        R.querySelectorAll('.sc-hover').forEach(function(rect){
          rect.addEventListener('mouseenter',function(){
            var i=parseInt(rect.dataset.i),pt=costPts[i];if(!pt)return;
            tip.innerHTML='<div style="color:#e2e8f0;font-weight:700;margin-bottom:6px;font-size:12px">'+pt.d+'</div>'+
              '<div style="display:flex;gap:20px">'+
              '<div><div style="color:#475569;font-size:9px;margin-bottom:2px">COST</div><div style="color:'+pc+';font-weight:700;font-size:13px">'+fmt$(pt.c)+'</div></div>'+
              '<div><div style="color:#475569;font-size:9px;margin-bottom:2px">MODELS</div><div style="color:'+sc2+';font-weight:700;font-size:13px">'+pt.n+'</div></div></div>';
            tip.style.opacity='1';tip.style.left=Math.min(pt.x+10,W-220)+'px';tip.style.top=Math.max(pt.y-60,5)+'px';
          });
          rect.addEventListener('mouseleave',function(){tip.style.opacity='0';});
        });
      }
    }
    render();done();
  }
});
)+deltaLabel+'</div><div class="sc-kpi-sub">'+gibSub+'as of '+latestDate+'</div></div>';
      if(totalSavings>0)h+='<div class="sc-kpi-card"><div class="sc-kpi-label">Potential Savings</div><div class="sc-kpi-val" style="color:#10b981">'+fmt$(totalSavings)+'</div><div class="sc-kpi-sub">'+optimizeCount+' models can optimize</div></div>';
      if(ttAlertCount>0)h+='<div class="sc-kpi-card"><div class="sc-kpi-label">Time Travel Alerts</div><div class="sc-kpi-val" style="color:#f59e0b">'+ttAlertCount+'</div><div class="sc-kpi-sub">tables with excess time travel storage</div></div>';
      h+='</div>';

      h+='<div class="sc-body">';

      // ========== TREND CHART ==========
      if(showTrend&&trend.length>1){
        var tH=Math.min(220,Math.max(160,Math.round(H*0.28)));
        var cW=W-120,cH=tH-70,px=60,py=30;
        var maxC=0,maxN=0;
        trend.forEach(function(t){if(t.cost>maxC)maxC=t.cost;if(t.count>maxN)maxN=t.count;});
        if(maxC===0)maxC=1;if(maxN===0)maxN=1;
        maxC*=1.1;maxN=Math.ceil(maxN*1.15);
        var stepX=trend.length>1?cW/(trend.length-1):cW;

        var costPts=[],costPath='',countPts=[],countPath='';
        trend.forEach(function(t,i){
          var x=px+i*stepX;
          var yc=py+cH-((t.cost/maxC)*cH);
          var yn=py+cH-((t.count/maxN)*cH);
          costPts.push({x:x,y:yc,d:t.date,c:t.cost,n:t.count});
          countPts.push({x:x,y:yn});
          costPath+=(i===0?'M':'L')+x.toFixed(1)+' '+yc.toFixed(1);
          countPath+=(i===0?'M':'L')+x.toFixed(1)+' '+yn.toFixed(1);
        });
        var costArea=costPath+'L'+(px+(trend.length-1)*stepX).toFixed(1)+' '+(py+cH)+' L'+px+' '+(py+cH)+' Z';
        var countArea=countPath+'L'+(px+(trend.length-1)*stepX).toFixed(1)+' '+(py+cH)+' L'+px+' '+(py+cH)+' Z';

        var svgW=cW+140;
        h+='<div class="sc-trend" style="height:'+tH+'px">';
        h+='<svg width="100%" height="'+tH+'" viewBox="0 0 '+svgW+' '+tH+'" preserveAspectRatio="xMidYMid meet">';
        h+='<defs>';
        h+='<linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+pc+'" stop-opacity="0.12"/><stop offset="100%" stop-color="'+pc+'" stop-opacity="0"/></linearGradient>';
        h+='<linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+sc2+'" stop-opacity="0.08"/><stop offset="100%" stop-color="'+sc2+'" stop-opacity="0"/></linearGradient>';
        h+='</defs>';

        for(var yi=0;yi<=4;yi++){
          var vy=py+cH-(yi/4)*cH;
          h+='<line x1="'+px+'" y1="'+vy+'" x2="'+(px+cW)+'" y2="'+vy+'" stroke="#1e293b" stroke-width="0.5"/>';
          h+='<text x="'+(px-10)+'" y="'+(vy+3)+'" text-anchor="end" fill="'+pc+'" font-size="9" font-weight="500" opacity=".7">'+fmt$(maxC*(yi/4))+'</text>';
          h+='<text x="'+(px+cW+10)+'" y="'+(vy+3)+'" text-anchor="start" fill="'+sc2+'" font-size="9" font-weight="500" opacity=".7">'+Math.round(maxN*(yi/4))+'</text>';
        }

        h+='<text x="'+(px-10)+'" y="'+(py-12)+'" text-anchor="end" fill="'+pc+'" font-size="9" font-weight="700" letter-spacing=".5">COST ($)</text>';
        h+='<text x="'+(px+cW+10)+'" y="'+(py-12)+'" text-anchor="start" fill="'+sc2+'" font-size="9" font-weight="700" letter-spacing=".5"># MODELS</text>';

        var xStep=Math.max(1,Math.floor(trend.length/7));
        trend.forEach(function(t,i){if(i%xStep===0||i===trend.length-1){var x=px+i*stepX;h+='<text x="'+x+'" y="'+(py+cH+18)+'" text-anchor="middle" fill="#64748b" font-size="9">'+t.date.substring(5)+'</text>';}});

        h+='<path d="'+costArea+'" fill="url(#cg1)"/>';
        h+='<path d="'+countArea+'" fill="url(#cg2)"/>';
        h+='<path d="'+costPath+'" fill="none" stroke="'+pc+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
        h+='<path d="'+countPath+'" fill="none" stroke="'+sc2+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';

        costPts.forEach(function(p){h+='<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="4" fill="#131b2e" stroke="'+pc+'" stroke-width="2"/>';});
        countPts.forEach(function(p){h+='<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3.5" fill="#131b2e" stroke="'+sc2+'" stroke-width="1.5"/>';});

        // Highlight latest day
        var lastCp=costPts[costPts.length-1],lastNp=countPts[countPts.length-1];
        if(lastCp)h+='<circle cx="'+lastCp.x.toFixed(1)+'" cy="'+lastCp.y.toFixed(1)+'" r="6" fill="'+pc+'" fill-opacity=".2" stroke="'+pc+'" stroke-width="2"/>';
        if(lastNp)h+='<circle cx="'+lastNp.x.toFixed(1)+'" cy="'+lastNp.y.toFixed(1)+'" r="5.5" fill="'+sc2+'" fill-opacity=".2" stroke="'+sc2+'" stroke-width="1.5"/>';

        var lgX=px,lgY=tH-6;
        h+='<circle cx="'+lgX+'" cy="'+(lgY-2)+'" r="4" fill="'+pc+'"/>';
        h+='<text x="'+(lgX+8)+'" y="'+lgY+'" fill="'+pc+'" font-size="10" font-weight="600">Monthly Cost</text>';
        h+='<circle cx="'+(lgX+110)+'" cy="'+(lgY-2)+'" r="4" fill="'+sc2+'"/>';
        h+='<text x="'+(lgX+118)+'" y="'+lgY+'" fill="'+sc2+'" font-size="10" font-weight="600"># Models</text>';

        costPts.forEach(function(p,i){h+='<rect class="sc-hover" data-i="'+i+'" x="'+(p.x-stepX/2)+'" y="'+py+'" width="'+Math.max(stepX,10)+'" height="'+cH+'" fill="transparent" style="cursor:crosshair"/>';});
        h+='</svg><div class="sc-ttip" id="sc-tip"></div></div>';
      }

      // ========== SCHEMA DISTRIBUTION ==========
      if(showSchema&&sList.length>0){
        var totalSchCost=0;sList.forEach(function(s){totalSchCost+=s.cost;});
        if(totalSchCost===0)totalSchCost=1;
        var maxSchCost=sList[0]?sList[0].cost:1;

        h+='<div class="sc-schema">';
        h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
        h+='<div style="display:flex;align-items:center;gap:8px"><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px">Schema Distribution</span>';
        if(schemaFilter)h+='<span style="font-size:9px;color:'+sColorMap[schemaFilter]+';background:'+sColorMap[schemaFilter]+'12;padding:2px 8px;border-radius:4px;cursor:pointer" class="sf-clear">\u2715 '+schemaFilter+'</span>';
        h+='</div>';
        h+='<span style="font-size:10px;color:#334155">'+sList.length+' schemas \u00B7 '+fmt$(totalSchCost)+' total \u00B7 '+latestDate+'</span></div>';

        sList.forEach(function(s,i){
          var pct=((s.cost/totalSchCost)*100);
          var barPct=Math.max((s.cost/maxSchCost)*100,2);
          var c=sColorMap[s.name];
          var isActive=!schemaFilter||schemaFilter===s.name;
          var op=isActive?'1':'0.3';

          h+='<div class="sc-srow sf-bar" data-s="'+s.name+'" style="opacity:'+op+'">';
          h+='<div style="min-width:140px;width:140px;display:flex;align-items:center;gap:8px;overflow:hidden">';
          h+='<span style="width:10px;height:10px;border-radius:3px;background:'+c+';flex-shrink:0"></span>';
          h+='<span style="font-size:11px;color:#e2e8f0;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+s.name+'">'+s.name+'</span></div>';
          h+='<div style="flex:1;height:20px;background:#0b1120;border-radius:4px;overflow:hidden;position:relative">';
          h+='<div style="width:'+barPct+'%;height:100%;background:'+c+';opacity:.35;border-radius:4px;transition:width .3s"></div>';
          h+='<span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:600;color:'+c+'">'+fmt$(s.cost)+'</span>';
          h+='</div>';
          h+='<div style="min-width:120px;text-align:right;display:flex;gap:10px;justify-content:flex-end">';
          h+='<span style="font-size:10px;color:#64748b">'+pct.toFixed(1)+'%</span>';
          h+='<span style="font-size:10px;color:#475569">'+s.models+' models</span>';
          h+='</div></div>';
        });
        h+='</div>';
      }

      // ========== TABS ==========
      h+='<div class="sc-bar"><div style="display:flex;gap:4px">';
      [{id:'all',l:'All Models ('+mList.length+')'},{id:'optimize',l:'Can Optimize ('+optimizeCount+')'},{id:'alert',l:'Time Travel Alerts ('+ttAlertCount+')'}].forEach(function(t){
        h+='<button class="sc-tab t-tab'+(tab===t.id?' on':'')+'" data-t="'+t.id+'">'+t.l+'</button>';
      });
      h+='</div><div style="display:flex;align-items:center;gap:10px">';
      if(schemaFilter)h+='<span class="sc-pill" style="background:'+sColorMap[schemaFilter]+'15;color:'+sColorMap[schemaFilter]+';border:1px solid '+sColorMap[schemaFilter]+'30">'+schemaFilter+'</span>';
      h+='<span style="color:#475569">Showing '+ls.length+' models</span></div></div>';

      // ========== TABLE ==========
      if(showTable){
        h+='<div class="sc-hdr"><div>#</div>';
        [{k:'name',l:'Model'},{k:'cost',l:'Monthly Cost'},{k:'savings',l:'Savings'},{k:'logGib',l:'Logical GiB'},{k:'billing',l:'Billing'},{k:'optStatus',l:'Status'}].forEach(function(c){
          var isOn=sC===c.k;
          h+='<div class="sc-sort'+(isOn?' on':'')+'" data-c="'+c.k+'">'+c.l+(isOn?(sD==='asc'?' \u2191':' \u2193'):'')+'</div>';
        });
        h+='</div><div class="sc-scroll">';

        var mx=ls.length>0?ls.reduce(function(m,i){return Math.max(m,i.cost);},0):1;
        ls.forEach(function(m,i){
          var bW=mx>0?Math.max(m.cost/mx*100,1):0;
          var sClr=m.savings>0?'#10b981':'#334155';
          var stClr=m.optStatus==='Switch Recommended'?'#f59e0b':m.optStatus?'#10b981':'#334155';
          var stBg=m.optStatus==='Switch Recommended'?'rgba(245,158,11,0.08)':m.optStatus?'rgba(16,185,129,0.08)':'transparent';
          var schClr=sColorMap[m.schema||'(no schema)']||'#475569';

          h+='<div class="sc-row">';
          h+='<div class="sc-cell" style="color:#334155;font-weight:600;text-align:center">'+(i+1)+'</div>';
          h+='<div class="sc-cell" title="'+m.name+'"><span style="display:inline-block;width:6px;height:6px;border-radius:2px;background:'+schClr+';margin-right:6px;vertical-align:middle"></span><span style="color:#e2e8f0;font-weight:500">'+m.table+'</span>';
          if(m.schema)h+=' <span style="color:#334155;font-size:9px">'+m.schema+'</span>';
          h+='</div>';
          h+='<div class="sc-cell"><div style="display:flex;align-items:center;gap:8px"><span style="color:'+pc+';font-weight:600;min-width:60px">'+fmt$(m.cost)+'</span><div style="flex:1;height:4px;background:#1e293b;border-radius:3px;overflow:hidden"><div style="width:'+bW+'%;height:100%;background:'+pc+';border-radius:3px;opacity:.6"></div></div></div></div>';
          h+='<div class="sc-cell" style="color:'+sClr+';font-weight:'+(m.savings>0?'600':'400')+'">'+(m.savings>0?fmt$(m.savings):'\u2014')+'</div>';
          h+='<div class="sc-cell" style="color:#64748b">'+fmtG(m.logGib)+'</div>';
          h+='<div class="sc-cell"><span class="sc-pill" style="background:rgba(30,41,59,0.4);color:#94a3b8">'+(m.billing||'\u2014')+'</span></div>';
          h+='<div class="sc-cell">';
          if(m.optStatus)h+='<span class="sc-pill" style="background:'+stBg+';color:'+stClr+'">'+m.optStatus+'</span>';
          else h+='<span style="color:#334155">\u2014</span>';
          h+='</div></div>';
        });
        if(!ls.length)h+='<div style="text-align:center;padding:60px;color:#475569">No models match this filter</div>';
        h+='</div>';
      }

      h+='</div>';
      R.innerHTML=h;

      // --- Events ---
      R.querySelectorAll('.t-tab').forEach(function(b){b.addEventListener('click',function(){tab=b.dataset.t;render();});});
      R.querySelectorAll('.sc-sort').forEach(function(c){c.addEventListener('click',function(){var k=c.dataset.c;if(sC===k)sD=sD==='asc'?'desc':'asc';else{sC=k;sD=k==='name'?'asc':'desc';}render();});});

      R.querySelectorAll('.sf-bar').forEach(function(b){
        b.addEventListener('click',function(){var s=b.dataset.s;schemaFilter=schemaFilter===s?null:s;render();});
      });
      var clr=R.querySelector('.sf-clear');
      if(clr)clr.addEventListener('click',function(e){e.stopPropagation();schemaFilter=null;render();});

      var tip=R.querySelector('#sc-tip');
      if(tip&&typeof costPts!=='undefined'){
        R.querySelectorAll('.sc-hover').forEach(function(rect){
          rect.addEventListener('mouseenter',function(){
            var i=parseInt(rect.dataset.i),pt=costPts[i];if(!pt)return;
            tip.innerHTML='<div style="color:#e2e8f0;font-weight:700;margin-bottom:6px;font-size:12px">'+pt.d+'</div>'+
              '<div style="display:flex;gap:20px">'+
              '<div><div style="color:#475569;font-size:9px;margin-bottom:2px">COST</div><div style="color:'+pc+';font-weight:700;font-size:13px">'+fmt$(pt.c)+'</div></div>'+
              '<div><div style="color:#475569;font-size:9px;margin-bottom:2px">MODELS</div><div style="color:'+sc2+';font-weight:700;font-size:13px">'+pt.n+'</div></div></div>';
            tip.style.opacity='1';tip.style.left=Math.min(pt.x+10,W-220)+'px';tip.style.top=Math.max(pt.y-60,5)+'px';
          });
          rect.addEventListener('mouseleave',function(){tip.style.opacity='0';});
        });
      }
    }
    render();done();
  }
});

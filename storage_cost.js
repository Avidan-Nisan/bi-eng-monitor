looker.plugins.visualizations.add({
  id: "storage_cost_explorer",
  label: "Storage Cost Explorer",
  options: {
    primary_color: {type:"string",label:"Primary Color (Cost)",default:"#8b5cf6",section:"Style",order:1},
    secondary_color: {type:"string",label:"Secondary Color (Models)",default:"#06b6d4",section:"Style",order:2},
    show_trend: {type:"boolean",label:"Show Trend Chart",default:true,section:"Display",order:3},
    show_schema: {type:"boolean",label:"Show Schema Distribution",default:true,section:"Display",order:4},
    show_table: {type:"boolean",label:"Show Model List",default:true,section:"Display",order:5},
    trend_height_pct: {type:"number",label:"Trend Chart Height %",default:30,section:"Display",order:6}
  },
  create: function(element) {
    element.style.height='100%';element.style.width='100%';
    element.innerHTML='<div id="scx" style="width:100%;height:100%;font-family:Inter,system-ui,-apple-system,sans-serif;background:#0a0e1a;color:#e2e8f0;display:flex;flex-direction:column;overflow:hidden"></div>';
    var s=document.createElement('style');
    s.textContent='#scx *{box-sizing:border-box}.sc-body{flex:1;display:flex;flex-direction:column;overflow:hidden;margin:0 12px;background:#131b2e;border-radius:12px 12px 0 0;border:1px solid #1e293b;border-bottom:none}.sc-bar{padding:10px 16px;border-bottom:1px solid rgba(30,41,59,0.25);display:flex;align-items:center;justify-content:space-between;font-size:11px;min-height:42px}.sc-trend{position:relative;border-bottom:1px solid #1e293b;flex-shrink:0;overflow:hidden}.sc-schema{border-bottom:1px solid #1e293b;flex-shrink:0;overflow:hidden}.sc-scroll{flex:1;overflow:auto}.sc-hdr{display:grid;grid-template-columns:40px 1fr 120px 130px 130px 100px 90px;border-bottom:1px solid #1e293b;position:sticky;top:0;background:#131b2e;z-index:1}.sc-hdr>div{padding:10px 12px;font-size:10px;font-weight:600;color:#475569;cursor:pointer;user-select:none;text-transform:uppercase;letter-spacing:.5px;transition:color .15s}.sc-hdr>div:hover{color:#94a3b8}.sc-hdr>div.on{color:#e2e8f0}.sc-row{display:grid;grid-template-columns:40px 1fr 120px 130px 130px 100px 90px;border-bottom:1px solid rgba(30,41,59,0.1);transition:background .15s}.sc-row:hover{background:rgba(30,41,59,0.3)}.sc-cell{padding:8px 12px;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sc-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:5px;font-size:9px;font-weight:600;letter-spacing:.3px}.sc-tab{padding:8px 18px;font-size:11px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#475569;border-radius:8px;transition:all .2s;letter-spacing:.3px}.sc-tab:hover{color:#94a3b8;background:rgba(30,41,59,0.25)}.sc-tab.on{color:#e2e8f0;background:#1e293b}.sc-ttip{position:absolute;pointer-events:none;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 14px;font-size:11px;z-index:10;box-shadow:0 8px 24px rgba(0,0,0,.4);white-space:nowrap;transition:opacity .12s;opacity:0}.sc-sbar{cursor:pointer;transition:opacity .15s}.sc-sbar:hover{opacity:.85}';
    element.appendChild(s);
  },
  updateAsync: function(data, element, config, queryResponse, details, done) {
    var R=element.querySelector('#scx'),W=element.offsetWidth||1200,H=element.offsetHeight||600;
    var pc=config.primary_color||'#8b5cf6',sc2=config.secondary_color||'#06b6d4';
    var showTrend=config.show_trend!==false,showSchema=config.show_schema!==false,showTable=config.show_table!==false;
    var trendPct=Math.max(15,Math.min(50,config.trend_height_pct||30));

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
    F.logCost=allF.find(function(f){return f.toLowerCase().indexOf('logical_model_monthly_cost')!==-1;});
    F.phyCost=allF.find(function(f){return f.toLowerCase().indexOf('physical_model_monthly_cost')!==-1;});
    F.logGib=allF.find(function(f){return f.toLowerCase().indexOf('total_logical_gib')!==-1;});
    F.phyGib=allF.find(function(f){return f.toLowerCase().indexOf('total_physical_gib')!==-1;});
    F.savings=allF.find(function(f){return f.toLowerCase().indexOf('potential_monthly_savings')!==-1;});
    F.preferred=dims.find(function(f){return f.toLowerCase().indexOf('preferred_billing')!==-1;});
    F.optStatus=dims.find(function(f){return f.toLowerCase().indexOf('optimization_status')!==-1;});
    F.ttWaste=allF.find(function(f){return f.toLowerCase().indexOf('time_travel_waste')!==-1;});
    F.ttAlert=dims.find(function(f){return f.toLowerCase().indexOf('time_travel_alert')!==-1;});

    function gv(row,k){return k&&row[k]?row[k].value||'':'';}
    function gn(row,k){return k&&row[k]?parseFloat(row[k].value)||0:0;}
    function fmt$(v){if(v>=1000)return'$'+Math.round(v).toLocaleString();if(v>=1)return'$'+v.toFixed(2);return'$'+v.toFixed(4);}
    function fmtG(v){return v>=1000?(v/1024).toFixed(1)+' TiB':v.toFixed(2)+' GiB';}

    // Schema color palette
    var sPal=['#8b5cf6','#06b6d4','#f59e0b','#ec4899','#10b981','#f97316','#3b82f6','#ef4444','#a855f7','#14b8a6','#eab308','#6366f1','#d946ef','#22d3ee','#84cc16'];

    var rows=[];
    data.forEach(function(row){
      rows.push({
        date:gv(row,F.date),schema:gv(row,F.schema),table:gv(row,F.table),
        billing:gv(row,F.billing),cost:gn(row,F.cost),logCost:gn(row,F.logCost),
        phyCost:gn(row,F.phyCost),logGib:gn(row,F.logGib),phyGib:gn(row,F.phyGib),
        savings:gn(row,F.savings),preferred:gv(row,F.preferred),
        optStatus:gv(row,F.optStatus),ttWaste:gn(row,F.ttWaste),ttAlert:gv(row,F.ttAlert)
      });
    });

    // --- Aggregate by model ---
    var models={};
    rows.forEach(function(r){
      var key=(r.schema?r.schema+'.':'')+r.table;
      if(!key||key==='.')return;
      if(!models[key])models[key]={name:key,schema:r.schema,table:r.table,cost:0,logCost:0,phyCost:0,logGib:0,phyGib:0,savings:0,ttWaste:0,billing:r.billing,preferred:r.preferred,optStatus:r.optStatus,ttAlert:r.ttAlert,cnt:0};
      var m=models[key];
      m.cost=Math.max(m.cost,r.cost);m.logCost=Math.max(m.logCost,r.logCost);
      m.phyCost=Math.max(m.phyCost,r.phyCost);m.logGib=Math.max(m.logGib,r.logGib);
      m.phyGib=Math.max(m.phyGib,r.phyGib);m.savings=Math.max(m.savings,r.savings);
      m.ttWaste=Math.max(m.ttWaste,r.ttWaste);m.cnt++;
      if(r.billing)m.billing=r.billing;if(r.preferred)m.preferred=r.preferred;
      if(r.optStatus)m.optStatus=r.optStatus;if(r.ttAlert)m.ttAlert=r.ttAlert;
    });
    var mList=Object.values(models);

    // --- Aggregate by schema ---
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

    // --- Aggregate by date ---
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

    // --- State ---
    var sC='cost',sD='desc',tab='all',schemaFilter=null;

    function getList(){
      var ls=mList.slice();
      if(schemaFilter)ls=ls.filter(function(m){return(m.schema||'(no schema)')===schemaFilter;});
      if(tab==='optimize')ls=ls.filter(function(m){return m.savings>0;});
      else if(tab==='alert')ls=ls.filter(function(m){return m.ttAlert&&m.ttAlert!=='null'&&m.ttAlert!=='';});
      ls.sort(function(a,b){
        if(sC==='name'){var va=(a.name||''),vb=(b.name||'');return sD==='asc'?va.localeCompare(vb):vb.localeCompare(va);}
        return sD==='asc'?(a[sC]||0)-(b[sC]||0):(b[sC]||0)-(a[sC]||0);
      });
      return ls;
    }

    function render(){
      var ls=getList();
      var totalCost=0,totalSavings=0;
      mList.forEach(function(m){totalCost+=m.cost;totalSavings+=m.savings;});

      var h='';

      // --- Header ---
      h+='<div style="padding:14px 20px 0;background:linear-gradient(180deg,#0f1629,#0a0e1a)">';
      h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
      h+='<div style="display:flex;align-items:center;gap:12px">';
      h+='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="'+pc+'" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>';
      h+='<span style="font-size:14px;font-weight:700;color:#e2e8f0">Storage Cost Explorer</span></div>';
      h+='<div style="display:flex;gap:16px;font-size:11px">';
      h+='<span><span style="color:#475569">Models</span> <span style="color:'+sc2+';font-weight:700">'+mList.length+'</span></span>';
      h+='<span><span style="color:#475569">Schemas</span> <span style="color:#f59e0b;font-weight:700">'+sList.length+'</span></span>';
      h+='<span><span style="color:#475569">Monthly Cost</span> <span style="color:'+pc+';font-weight:700">'+fmt$(totalCost)+'</span></span>';
      if(totalSavings>0)h+='<span><span style="color:#475569">Savings</span> <span style="color:#10b981;font-weight:700">'+fmt$(totalSavings)+'</span></span>';
      h+='</div></div></div>';

      h+='<div class="sc-body">';

      // ========== TREND CHART ==========
      if(showTrend&&trend.length>1){
        var tH=Math.round(H*trendPct/100);tH=Math.max(120,Math.min(tH,300));
        var cW=W-80,cH=tH-60,px=50,py=24;
        var maxC=0,maxN=0;trend.forEach(function(t){if(t.cost>maxC)maxC=t.cost;if(t.count>maxN)maxN=t.count;});
        if(maxC===0)maxC=1;if(maxN===0)maxN=1;
        var stepX=trend.length>1?cW/(trend.length-1):cW;

        var costPts=[],costPath='';
        trend.forEach(function(t,i){
          var x=px+i*stepX,y=py+cH-((t.cost/maxC)*cH);
          costPts.push({x:x,y:y,d:t.date,c:t.cost,n:t.count});
          costPath+=(i===0?'M':'L')+x.toFixed(1)+' '+y.toFixed(1);
        });
        var costArea=costPath+'L'+(px+(trend.length-1)*stepX).toFixed(1)+' '+(py+cH)+' L'+px+' '+(py+cH)+' Z';
        var countPath='';
        trend.forEach(function(t,i){
          var x=px+i*stepX,y=py+cH-((t.count/maxN)*cH);
          countPath+=(i===0?'M':'L')+x.toFixed(1)+' '+y.toFixed(1);
        });

        var yLabels='';
        for(var yi=0;yi<=4;yi++){
          var vy=py+cH-(yi/4)*cH,vc2=maxC*(yi/4),vn=maxN*(yi/4);
          yLabels+='<line x1="'+px+'" y1="'+vy+'" x2="'+(px+cW)+'" y2="'+vy+'" stroke="#1e293b" stroke-width="0.5"/>';
          yLabels+='<text x="'+(px-6)+'" y="'+(vy+3)+'" text-anchor="end" fill="'+pc+'" font-size="8" opacity=".6">'+fmt$(vc2)+'</text>';
          yLabels+='<text x="'+(px+cW+6)+'" y="'+(vy+3)+'" text-anchor="start" fill="'+sc2+'" font-size="8" opacity=".6">'+Math.round(vn)+'</text>';
        }
        var xLabels='',xStep=Math.max(1,Math.floor(trend.length/6));
        trend.forEach(function(t,i){if(i%xStep===0||i===trend.length-1){var x=px+i*stepX;xLabels+='<text x="'+x+'" y="'+(py+cH+16)+'" text-anchor="middle" fill="#475569" font-size="8">'+t.date.substring(5)+'</text>';}});

        h+='<div class="sc-trend" style="height:'+tH+'px;padding:0">';
        h+='<svg width="100%" height="'+tH+'" viewBox="0 0 '+(cW+100)+' '+tH+'" preserveAspectRatio="xMidYMid meet">';
        h+='<defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+pc+'" stop-opacity="0.15"/><stop offset="100%" stop-color="'+pc+'" stop-opacity="0"/></linearGradient></defs>';
        h+=yLabels+xLabels;
        h+='<path d="'+costArea+'" fill="url(#cg)"/>';
        h+='<path d="'+costPath+'" fill="none" stroke="'+pc+'" stroke-width="2" stroke-linejoin="round"/>';
        h+='<path d="'+countPath+'" fill="none" stroke="'+sc2+'" stroke-width="1.5" stroke-dasharray="4 3" stroke-linejoin="round"/>';
        costPts.forEach(function(p){h+='<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3" fill="#131b2e" stroke="'+pc+'" stroke-width="1.5"/>';});
        h+='<g transform="translate('+px+','+(tH-8)+'">';
        h+='<line x1="0" y1="0" x2="14" y2="0" stroke="'+pc+'" stroke-width="2"/><text x="18" y="3" fill="'+pc+'" font-size="9" font-weight="500">Monthly Cost</text>';
        h+='<line x1="110" y1="0" x2="124" y2="0" stroke="'+sc2+'" stroke-width="1.5" stroke-dasharray="4 3"/><text x="128" y="3" fill="'+sc2+'" font-size="9" font-weight="500"># Models</text></g>';
        costPts.forEach(function(p,i){h+='<rect class="sc-hover" data-i="'+i+'" x="'+(p.x-stepX/2)+'" y="'+py+'" width="'+stepX+'" height="'+cH+'" fill="transparent" style="cursor:crosshair"/>';});
        h+='</svg><div class="sc-ttip" id="sc-tip"></div></div>';
      }

      // ========== SCHEMA DISTRIBUTION ==========
      if(showSchema&&sList.length>0){
        var sH=140,barW=W-80,barY=50,barH=24;
        var totalSchCost=0;sList.forEach(function(s){totalSchCost+=s.cost;});
        if(totalSchCost===0)totalSchCost=1;

        h+='<div class="sc-schema" style="height:'+sH+'px;padding:0;position:relative">';
        h+='<svg width="100%" height="'+sH+'" viewBox="0 0 '+(barW+60)+' '+sH+'" preserveAspectRatio="xMidYMid meet">';

        // Section label
        h+='<text x="16" y="20" fill="#475569" font-size="9" font-weight="600" letter-spacing="1">SCHEMA DISTRIBUTION</text>';
        h+='<text x="'+(barW+44)+'" y="20" text-anchor="end" fill="#334155" font-size="9">'+sList.length+' schemas \u00B7 '+fmt$(totalSchCost)+' total</text>';

        // Stacked horizontal bar
        var sx=16;
        sList.forEach(function(s,i){
          var w=Math.max((s.cost/totalSchCost)*barW,2);
          var c=sColorMap[s.name];
          var isActive=schemaFilter===s.name;
          var op=schemaFilter?(isActive?'1':'0.25'):'1';
          h+='<rect class="sc-sbar sb" data-s="'+s.name+'" x="'+sx+'" y="'+barY+'" width="'+w+'" height="'+barH+'" rx="'+(i===0?'4 0 0 4':i===sList.length-1?'0 4 4 0':'0')+'" fill="'+c+'" opacity="'+op+'"/>';
          sx+=w;
        });

        // Legend rows below bar
        var lx=16,ly=barY+barH+18,maxLW=barW+30;
        sList.forEach(function(s,i){
          if(i>=12)return; // max 12 in legend
          var c=sColorMap[s.name];
          var pct=((s.cost/totalSchCost)*100).toFixed(1);
          var nm=s.name.length>20?s.name.substring(0,18)+'\u2026':s.name;
          var itemW=nm.length*5.5+70;
          if(lx+itemW>maxLW){lx=16;ly+=16;} // wrap
          var isActive=schemaFilter===s.name;
          var op=schemaFilter?(isActive?'1':'0.4'):'1';
          h+='<g class="sc-sbar sb" data-s="'+s.name+'" style="cursor:pointer" opacity="'+op+'">';
          h+='<rect x="'+lx+'" y="'+(ly-6)+'" width="8" height="8" rx="2" fill="'+c+'"/>';
          h+='<text x="'+(lx+12)+'" y="'+ly+'" fill="#94a3b8" font-size="9" font-weight="500">'+nm+'</text>';
          h+='<text x="'+(lx+12+nm.length*5.2)+'" y="'+ly+'" fill="#475569" font-size="8"> '+pct+'% \u00B7 '+fmt$(s.cost)+' \u00B7 '+s.models+'</text>';
          h+='</g>';
          lx+=itemW;
        });

        if(schemaFilter){
          h+='<g class="sc-sbar sb-clear" style="cursor:pointer"><rect x="'+(barW+10)+'" y="'+(barY+2)+'" width="36" height="20" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1"/><text x="'+(barW+28)+'" y="'+(barY+15)+'" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600">\u2715</text></g>';
        }

        h+='</svg>';
        h+='<div class="sc-ttip" id="sc-stip"></div>';
        h+='</div>';
      }

      // ========== TABS ==========
      h+='<div class="sc-bar"><div style="display:flex;gap:4px">';
      [{id:'all',l:'All Models'},{id:'optimize',l:'Can Optimize'},{id:'alert',l:'TT Alerts'}].forEach(function(t){
        h+='<button class="sc-tab t-tab'+(tab===t.id?' on':'')+'" data-t="'+t.id+'">'+t.l+'</button>';
      });
      h+='</div><div style="display:flex;align-items:center;gap:10px">';
      if(schemaFilter)h+='<span class="sc-pill" style="background:'+sColorMap[schemaFilter]+'15;color:'+sColorMap[schemaFilter]+';border:1px solid '+sColorMap[schemaFilter]+'30">'+schemaFilter+'</span>';
      h+='<span style="color:#475569">'+ls.length+' models</span></div></div>';

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

      // Schema bar click to filter
      R.querySelectorAll('.sb').forEach(function(b){
        b.addEventListener('click',function(){
          var s=b.dataset.s;
          schemaFilter=schemaFilter===s?null:s;
          render();
        });
      });
      var clr=R.querySelector('.sb-clear');
      if(clr)clr.addEventListener('click',function(e){e.stopPropagation();schemaFilter=null;render();});

      // Schema bar tooltip
      var stip=R.querySelector('#sc-stip');
      if(stip){
        R.querySelectorAll('.sb[data-s]').forEach(function(b){
          b.addEventListener('mouseenter',function(e){
            var sn=b.dataset.s,si=schemas[sn]||schemas['(no schema)'];
            if(!si)return;
            var pct=((si.cost/totalSchCost)*100).toFixed(1);
            stip.innerHTML='<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="width:8px;height:8px;border-radius:2px;background:'+sColorMap[sn]+'"></span><span style="color:#e2e8f0;font-weight:600">'+sn+'</span></div><div style="display:flex;gap:14px"><span><span style="color:#475569">Cost</span> <span style="color:'+pc+'">'+fmt$(si.cost)+'</span></span><span><span style="color:#475569">Models</span> <span style="color:'+sc2+'">'+si.models+'</span></span><span><span style="color:#475569">Share</span> '+pct+'%</span></div>';
            stip.style.opacity='1';
            var r=b.getBoundingClientRect(),p=b.closest('.sc-schema').getBoundingClientRect();
            stip.style.left=Math.min(r.left-p.left+10,p.width-200)+'px';
            stip.style.top=(r.top-p.top-50)+'px';
          });
          b.addEventListener('mouseleave',function(){stip.style.opacity='0';});
        });
      }

      // Trend tooltip
      var tip=R.querySelector('#sc-tip');
      if(tip&&typeof costPts!=='undefined'){
        R.querySelectorAll('.sc-hover').forEach(function(rect){
          rect.addEventListener('mouseenter',function(){
            var i=parseInt(rect.dataset.i),pt=costPts[i];if(!pt)return;
            tip.innerHTML='<div style="color:#e2e8f0;font-weight:600;margin-bottom:4px">'+pt.d+'</div><div style="display:flex;gap:16px"><span><span style="color:'+pc+'">Cost</span> '+fmt$(pt.c)+'</span><span><span style="color:'+sc2+'">Models</span> '+pt.n+'</span></div>';
            tip.style.opacity='1';tip.style.left=(pt.x+10)+'px';tip.style.top=(pt.y-50)+'px';
          });
          rect.addEventListener('mouseleave',function(){tip.style.opacity='0';});
        });
      }
    }
    render();done();
  }
});

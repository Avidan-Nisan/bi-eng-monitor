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
    s.textContent=[
      '#scx *{box-sizing:border-box}',
      '.sc-body{flex:1;display:flex;flex-direction:column;overflow:hidden;margin:0 12px;background:#131b2e;border-radius:12px 12px 0 0;border:1px solid #1e293b;border-bottom:none}',
      '.sc-trend{position:relative;border-bottom:1px solid #1e293b;flex-shrink:0;overflow:hidden}',
      '.sc-schema{border-bottom:1px solid #1e293b;flex-shrink:0;overflow:hidden;padding:16px 20px}',
      '.sc-scroll{flex:1;overflow:auto}',
      '.sc-hdr{display:grid;grid-template-columns:40px 1fr 180px;border-bottom:1px solid #1e293b;position:sticky;top:0;background:#131b2e;z-index:1}',
      '.sc-hdr>div{padding:10px 12px;font-size:10px;font-weight:600;color:#475569;cursor:pointer;user-select:none;text-transform:uppercase;letter-spacing:.5px}',
      '.sc-hdr>div:hover{color:#94a3b8}',
      '.sc-hdr>div.on{color:#e2e8f0}',
      '.sc-row{display:grid;grid-template-columns:40px 1fr 180px;border-bottom:1px solid rgba(30,41,59,0.1)}',
      '.sc-row:hover{background:rgba(30,41,59,0.3)}',
      '.sc-cell{padding:8px 12px;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sc-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:5px;font-size:9px;font-weight:600}',
      '.sc-kpi{display:flex;gap:12px;padding:16px 20px;background:linear-gradient(180deg,#0f1629,#0a0e1a);flex-wrap:wrap}',
      '.sc-kpi-card{flex:1;min-width:140px;padding:16px 20px;background:#131b2e;border:1px solid #1e293b;border-radius:12px}',
      '.sc-kpi-label{font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}',
      '.sc-kpi-val{font-size:28px;font-weight:800;line-height:1.1;letter-spacing:-.5px;margin-bottom:6px}',
      '.sc-kpi-sub{font-size:10px;color:#475569}',
      '.sc-srow{display:flex;align-items:center;gap:10px;padding:6px 0;cursor:pointer}',
      '.sc-srow:hover{opacity:.85}',
      '.sc-ttip{position:absolute;pointer-events:none;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 14px;font-size:11px;z-index:10;box-shadow:0 8px 24px rgba(0,0,0,.4);white-space:nowrap;opacity:0}',
      '.sc-info{padding:10px 16px;border-bottom:1px solid rgba(30,41,59,0.25);display:flex;align-items:center;justify-content:space-between;font-size:11px}'
    ].join('');
    element.appendChild(s);
  },
  updateAsync: function(data, element, config, queryResponse, details, done) {
    try {
    var R=element.querySelector('#scx'),W=element.offsetWidth||1200,H=element.offsetHeight||600;
    var pc=config.primary_color||'#8b5cf6',sc2=config.secondary_color||'#06b6d4';
    var showTrend=config.show_trend!==false,showSchema=config.show_schema!==false,showTable=config.show_table!==false;

    if(!data||!data.length){R.innerHTML='<div style="padding:40px;color:#475569;text-align:center">No data available</div>';done();return;}

    var dims=queryResponse.fields.dimension_like.map(function(f){return f.name;});
    var meas=queryResponse.fields.measure_like?queryResponse.fields.measure_like.map(function(f){return f.name;}):[];
    var allF=dims.concat(meas);

    function findF(arr,kw){return arr.find(function(f){return f.toLowerCase().indexOf(kw)!==-1;});}

    // UPDATED: Adjusted to look for malm fields based on LKML definition
    var F={};
    F.date=dims.find(function(f){var l=f.toLowerCase();return l.indexOf('snapshot_date')!==-1||(l.indexOf('date')!==-1&&l.indexOf('is_')===-1);});
    F.schema=findF(dims,'project_name'); // Mapping schema to malm_project_name per LKML context
    F.table=findF(dims,'model_name');   // Mapping table/model to malm_model_name
    F.cost=findF(allF,'current_monthly_cost'); // Assuming cost measure exists in explore

    function gv(row,k){if(!k||!row||!row[k])return'';return row[k].value||'';}
    function gn(row,k){if(!k||!row||!row[k])return 0;return parseFloat(row[k].value)||0;}
    function fmt$(v){if(v>=10000)return'$'+Math.round(v).toLocaleString();if(v>=1)return'$'+v.toFixed(2);return'$'+v.toFixed(4);}

    var sPal=['#8b5cf6','#06b6d4','#f59e0b','#ec4899','#10b981','#f97316','#3b82f6','#ef4444','#a855f7','#14b8a6','#eab308','#6366f1'];

    // Parse rows
    var rows=[];
    for(var di=0;di<data.length;di++){
      var row=data[di];
      rows.push({date:gv(row,F.date),schema:gv(row,F.schema),table:gv(row,F.table),cost:gn(row,F.cost)});
    }

    // Find latest and prev dates
    var dateSet={};
    for(var ri=0;ri<rows.length;ri++){
      var dd=rows[ri].date?String(rows[ri].date).substring(0,10):'';
      if(dd)dateSet[dd]=true;
    }
    var sortedDates=Object.keys(dateSet).sort();
    var latestDate=sortedDates.length>0?sortedDates[sortedDates.length-1]:'';
    var prevDate=sortedDates.length>1?sortedDates[sortedDates.length-2]:'';

    // Latest-day models
    var models={},prevModels={};
    for(var i=0;i<rows.length;i++){
      var r=rows[i],d=r.date?String(r.date).substring(0,10):'';
      var key=(r.schema?r.schema+'.':'')+r.table;
      if(!key||key==='.')continue;
      if(d===latestDate){
        if(!models[key])models[key]={name:key,schema:r.schema,table:r.table,cost:0};
        models[key].cost=Math.max(models[key].cost,r.cost);
      }
      if(d===prevDate){
        if(!prevModels[key])prevModels[key]={cost:0};
        prevModels[key].cost=Math.max(prevModels[key].cost,r.cost);
      }
    }
    var mList=Object.values(models);
    mList.sort(function(a,b){return b.cost-a.cost;});

    var prevList=Object.values(prevModels);
    var prevTotalCost=0;for(var pi=0;pi<prevList.length;pi++)prevTotalCost+=prevList[pi].cost;

    // Totals
    var totalCost=0;
    for(var mi=0;mi<mList.length;mi++)totalCost+=mList[mi].cost;
    var costDelta=prevDate?totalCost-prevTotalCost:null;
    var modelDelta=prevDate?mList.length-prevList.length:null;

    // Schemas from latest day
    var schemas={};
    for(var si=0;si<mList.length;si++){
      var sn=mList[si].schema||'(no schema)';
      if(!schemas[sn])schemas[sn]={name:sn,cost:0,models:0};
      schemas[sn].cost+=mList[si].cost;schemas[sn].models++;
    }
    var sList=Object.values(schemas);
    sList.sort(function(a,b){return b.cost-a.cost;});
    var sColorMap={};
    for(var ci=0;ci<sList.length;ci++)sColorMap[sList[ci].name]=sPal[ci%sPal.length];

    // Trend from all dates
    var byDate={};
    for(var ti=0;ti<rows.length;ti++){
      var td=rows[ti].date?String(rows[ti].date).substring(0,10):'';
      if(!td)continue;
      if(!byDate[td])byDate[td]={date:td,cost:0,models:{}};
      var tk=(rows[ti].schema?rows[ti].schema+'.':'')+rows[ti].table;
      byDate[td].cost+=rows[ti].cost;
      if(tk&&tk!=='.')byDate[td].models[tk]=true;
    }
    var trend=Object.values(byDate).map(function(d){return{date:d.date,cost:d.cost,count:Object.keys(d.models).length};});
    trend.sort(function(a,b){return a.date.localeCompare(b.date);});

    // State
    var sC='cost',sD='desc',schemaFilter=null;

    function getList(){
      var ls=mList.slice();
      if(schemaFilter)ls=ls.filter(function(m){return(m.schema||'(no schema)')===schemaFilter;});
      ls.sort(function(a,b){
        if(sC==='name')return sD==='asc'?(a.name||'').localeCompare(b.name||''):(b.name||'').localeCompare(a.name||'');
        return sD==='asc'?(a.cost-b.cost):(b.cost-a.cost);
      });
      return ls;
    }

    function fmtD(v,prefix,inv){
      if(v===null||v===0)return'';
      var sign=v>0?'+':'';
      var clr=inv?(v>0?'#ef4444':'#10b981'):(v>0?sc2:'#f59e0b');
      var display=prefix?prefix+Math.abs(Math.round(v)).toLocaleString():Math.abs(v).toString();
      return ' <span style="color:'+clr+';font-size:11px;font-weight:600">'+sign+display+'</span>';
    }

    function render(){
      var ls=getList();
      var h='';
      var deltaLabel=prevDate?' <span style="color:#334155;font-size:9px;font-weight:400">(vs '+prevDate+')</span>':'';

      // KPI CARDS
      h+='<div class="sc-kpi">';
      h+='<div class="sc-kpi-card"><div class="sc-kpi-label">Total Models</div><div class="sc-kpi-val" style="color:'+sc2+'">'+mList.length+fmtD(modelDelta)+deltaLabel+'</div><div class="sc-kpi-sub">across '+sList.length+' schemas \u00B7 as of '+latestDate+'</div></div>';
      h+='<div class="sc-kpi-card"><div class="sc-kpi-label">Monthly Cost</div><div class="sc-kpi-val" style="color:'+pc+'">'+fmt$(totalCost)+fmtD(costDelta,'$',true)+deltaLabel+'</div><div class="sc-kpi-sub">as of '+latestDate+'</div></div>';
      h+='</div>';

      h+='<div class="sc-body">';

      // TREND CHART
      if(showTrend&&trend.length>1){
        var tH=Math.min(220,Math.max(160,Math.round(H*0.28)));
        var cW=Math.max(W-120,200),cH=tH-70,px=60,py=30;
        var maxC=1,maxN=1;
        for(var g=0;g<trend.length;g++){if(trend[g].cost>maxC)maxC=trend[g].cost;if(trend[g].count>maxN)maxN=trend[g].count;}
        maxC*=1.1;maxN=Math.ceil(maxN*1.15);
        var stepX=cW/(trend.length-1);
        var costPts=[],countPts=[],costPath='',countPath='';
        for(var j=0;j<trend.length;j++){
          var x=px+j*stepX,yc=py+cH-((trend[j].cost/maxC)*cH),yn=py+cH-((trend[j].count/maxN)*cH);
          costPts.push({x:x,y:yc,d:trend[j].date,c:trend[j].cost,n:trend[j].count});
          countPts.push({x:x,y:yn});
          costPath+=(j===0?'M':'L')+x.toFixed(1)+' '+yc.toFixed(1);
          countPath+=(j===0?'M':'L')+x.toFixed(1)+' '+yn.toFixed(1);
        }
        var costArea=costPath+'L'+(px+(trend.length-1)*stepX).toFixed(1)+' '+(py+cH)+' L'+px+' '+(py+cH)+' Z';
        var svgW=cW+140;

        h+='<div class="sc-trend" style="height:'+tH+'px">';
        h+='<svg width="100%" height="'+tH+'" viewBox="0 0 '+svgW+' '+tH+'" preserveAspectRatio="xMidYMid meet">';
        h+='<defs><linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+pc+'" stop-opacity="0.12"/><stop offset="100%" stop-color="'+pc+'" stop-opacity="0"/></linearGradient></defs>';

        for(var yi=0;yi<=4;yi++){
          var vy=py+cH-(yi/4)*cH;
          h+='<line x1="'+px+'" y1="'+vy+'" x2="'+(px+cW)+'" y2="'+vy+'" stroke="#1e293b" stroke-width="0.5"/>';
          h+='<text x="'+(px-10)+'" y="'+(vy+3)+'" text-anchor="end" fill="'+pc+'" font-size="9" opacity=".7">'+fmt$(maxC*(yi/4))+'</text>';
          h+='<text x="'+(px+cW+10)+'" y="'+(vy+3)+'" text-anchor="start" fill="'+sc2+'" font-size="9" opacity=".7">'+Math.round(maxN*(yi/4))+'</text>';
        }
        h+='<text x="'+(px-10)+'" y="'+(py-12)+'" text-anchor="end" fill="'+pc+'" font-size="9" font-weight="700">COST ($)</text>';
        h+='<text x="'+(px+cW+10)+'" y="'+(py-12)+'" text-anchor="start" fill="'+sc2+'" font-size="9" font-weight="700"># MODELS</text>';

        var xStep=Math.max(1,Math.floor(trend.length/7));
        for(var xi=0;xi<trend.length;xi++){
          if(xi%xStep===0||xi===trend.length-1){
            h+='<text x="'+(px+xi*stepX)+'" y="'+(py+cH+18)+'" text-anchor="middle" fill="#64748b" font-size="9">'+trend[xi].date.substring(5)+'</text>';
          }
        }

        h+='<path d="'+costArea+'" fill="url(#cg1)"/>';
        h+='<path d="'+costPath+'" fill="none" stroke="'+pc+'" stroke-width="2.5" stroke-linejoin="round"/>';
        h+='<path d="'+countPath+'" fill="none" stroke="'+sc2+'" stroke-width="2" stroke-linejoin="round"/>';
        for(var cd=0;cd<costPts.length;cd++)h+='<circle cx="'+costPts[cd].x.toFixed(1)+'" cy="'+costPts[cd].y.toFixed(1)+'" r="3.5" fill="#131b2e" stroke="'+pc+'" stroke-width="2"/>';
        for(var nd=0;nd<countPts.length;nd++)h+='<circle cx="'+countPts[nd].x.toFixed(1)+'" cy="'+countPts[nd].y.toFixed(1)+'" r="3" fill="#131b2e" stroke="'+sc2+'" stroke-width="1.5"/>';

        // Highlight last point
        var lc=costPts[costPts.length-1],ln=countPts[countPts.length-1];
        if(lc)h+='<circle cx="'+lc.x.toFixed(1)+'" cy="'+lc.y.toFixed(1)+'" r="6" fill="'+pc+'" fill-opacity=".2" stroke="'+pc+'" stroke-width="2"/>';
        if(ln)h+='<circle cx="'+ln.x.toFixed(1)+'" cy="'+ln.y.toFixed(1)+'" r="5.5" fill="'+sc2+'" fill-opacity=".2" stroke="'+sc2+'" stroke-width="1.5"/>';

        var lgY=tH-6;
        h+='<circle cx="'+px+'" cy="'+(lgY-2)+'" r="4" fill="'+pc+'"/><text x="'+(px+8)+'" y="'+lgY+'" fill="'+pc+'" font-size="10" font-weight="600">Monthly Cost</text>';
        h+='<circle cx="'+(px+110)+'" cy="'+(lgY-2)+'" r="4" fill="'+sc2+'"/><text x="'+(px+118)+'" y="'+lgY+'" fill="'+sc2+'" font-size="10" font-weight="600"># Models</text>';

        for(var hi=0;hi<costPts.length;hi++)h+='<rect class="sc-hover" data-i="'+hi+'" x="'+(costPts[hi].x-stepX/2)+'" y="'+py+'" width="'+Math.max(stepX,10)+'" height="'+cH+'" fill="transparent" style="cursor:crosshair"/>';
        h+='</svg><div class="sc-ttip" id="sc-tip"></div></div>';
      }

      // SCHEMA DISTRIBUTION
      if(showSchema&&sList.length>0){
        var tsc=0;for(var q=0;q<sList.length;q++)tsc+=sList[q].cost;
        if(tsc===0)tsc=1;
        var msc=sList[0].cost||1;

        h+='<div class="sc-schema">';
        h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
        h+='<div style="display:flex;align-items:center;gap:8px"><span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px">Schema Distribution</span>';
        if(schemaFilter)h+='<span style="font-size:9px;color:'+sColorMap[schemaFilter]+';padding:2px 8px;border-radius:4px;cursor:pointer" class="sf-clear">\u2715 '+schemaFilter+'</span>';
        h+='</div>';
        h+='<span style="font-size:10px;color:#334155">'+sList.length+' schemas \u00B7 '+fmt$(tsc)+' \u00B7 '+latestDate+'</span></div>';

        for(var sb=0;sb<sList.length;sb++){
          var sv=sList[sb],spct=(sv.cost/tsc*100),bpct=Math.max(sv.cost/msc*100,2),scl=sColorMap[sv.name];
          var sop=(!schemaFilter||schemaFilter===sv.name)?'1':'0.3';
          h+='<div class="sc-srow sf-bar" data-s="'+sv.name+'" style="opacity:'+sop+'">';
          h+='<div style="min-width:140px;width:140px;display:flex;align-items:center;gap:8px;overflow:hidden">';
          h+='<span style="width:10px;height:10px;border-radius:3px;background:'+scl+';flex-shrink:0"></span>';
          h+='<span style="font-size:11px;color:#e2e8f0;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+sv.name+'</span></div>';
          h+='<div style="flex:1;height:20px;background:#0b1120;border-radius:4px;overflow:hidden;position:relative">';
          h+='<div style="width:'+bpct+'%;height:100%;background:'+scl+';opacity:.35;border-radius:4px"></div>';
          h+='<span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:600;color:'+scl+'">'+fmt$(sv.cost)+'</span></div>';
          h+='<div style="min-width:120px;text-align:right;display:flex;gap:10px;justify-content:flex-end">';
          h+='<span style="font-size:10px;color:#64748b">'+spct.toFixed(1)+'%</span>';
          h+='<span style="font-size:10px;color:#475569">'+sv.models+' models</span></div></div>';
        }
        h+='</div>';
      }

      // INFO BAR
      h+='<div class="sc-info"><div style="display:flex;align-items:center;gap:10px">';
      if(schemaFilter)h+='<span class="sc-pill" style="background:'+sColorMap[schemaFilter]+'15;color:'+sColorMap[schemaFilter]+'">'+schemaFilter+'</span>';
      h+='<span style="color:#475569">'+ls.length+' models</span></div></div>';

      // TABLE
      if(showTable){
        h+='<div class="sc-hdr"><div>#</div>';
        var cols=[{k:'name',l:'Model'},{k:'cost',l:'Monthly Cost'}];
        for(var hc=0;hc<cols.length;hc++){
          var isOn=sC===cols[hc].k;
          h+='<div class="sc-sort'+(isOn?' on':'')+'" data-c="'+cols[hc].k+'">'+cols[hc].l+(isOn?(sD==='asc'?' \u2191':' \u2193'):'')+'</div>';
        }
        h+='</div><div class="sc-scroll">';

        var mx=ls.length>0?ls[0].cost:1;
        if(mx===0)mx=1;
        for(var tr=0;tr<ls.length;tr++){
          var m=ls[tr],bW=Math.max(m.cost/mx*100,1);
          var schClr=sColorMap[m.schema||'(no schema)']||'#475569';
          h+='<div class="sc-row">';
          h+='<div class="sc-cell" style="color:#334155;font-weight:600;text-align:center">'+(tr+1)+'</div>';
          h+='<div class="sc-cell" title="'+m.name+'"><span style="display:inline-block;width:6px;height:6px;border-radius:2px;background:'+schClr+';margin-right:6px;vertical-align:middle"></span><span style="color:#e2e8f0;font-weight:500">'+m.table+'</span>';
          if(m.schema)h+=' <span style="color:#334155;font-size:9px">'+m.schema+'</span>';
          h+='</div>';
          h+='<div class="sc-cell"><div style="display:flex;align-items:center;gap:8px"><span style="color:'+pc+';font-weight:600;min-width:60px">'+fmt$(m.cost)+'</span><div style="flex:1;height:4px;background:#1e293b;border-radius:3px;overflow:hidden"><div style="width:'+bW+'%;height:100%;background:'+pc+';border-radius:3px;opacity:.6"></div></div></div></div>';
          h+='</div>';
        }
        if(!ls.length)h+='<div style="text-align:center;padding:60px;color:#475569">No models found</div>';
        h+='</div>';
      }

      h+='</div>';
      R.innerHTML=h;

      // Events
      R.querySelectorAll('.sc-sort').forEach(function(c){c.addEventListener('click',function(){var k=c.getAttribute('data-c');if(sC===k)sD=sD==='asc'?'desc':'asc';else{sC=k;sD=k==='name'?'asc':'desc';}render();});});
      R.querySelectorAll('.sf-bar').forEach(function(b){b.addEventListener('click',function(){var s=b.getAttribute('data-s');schemaFilter=schemaFilter===s?null:s;render();});});
      var clr=R.querySelector('.sf-clear');
      if(clr)clr.addEventListener('click',function(e){e.stopPropagation();schemaFilter=null;render();});

      var tip=R.querySelector('#sc-tip');
      if(tip&&costPts&&costPts.length>0){
        R.querySelectorAll('.sc-hover').forEach(function(rect){
          rect.addEventListener('mouseenter',function(){
            var idx=parseInt(rect.getAttribute('data-i')),pt=costPts[idx];
            if(!pt)return;
            tip.innerHTML='<div style="color:#e2e8f0;font-weight:700;margin-bottom:6px">'+pt.d+'</div><div style="display:flex;gap:20px"><div><div style="color:#475569;font-size:9px;margin-bottom:2px">COST</div><div style="color:'+pc+';font-weight:700;font-size:13px">'+fmt$(pt.c)+'</div></div><div><div style="color:#475569;font-size:9px;margin-bottom:2px">MODELS</div><div style="color:'+sc2+';font-weight:700;font-size:13px">'+pt.n+'</div></div></div>';
            tip.style.opacity='1';
            tip.style.left=Math.min(pt.x+10,W-220)+'px';
            tip.style.top=Math.max(pt.y-60,5)+'px';
          });
          rect.addEventListener('mouseleave',function(){tip.style.opacity='0';});
        });
      }
    }
    render();
    } catch(e) { console.error('StorageCostExplorer error:',e); }
    done();
  }
});

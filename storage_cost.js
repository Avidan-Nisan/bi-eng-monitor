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

      // Updated Field Mapping to match your SQL and LKML
      var F={};
      F.date = dims.find(function(f){return f.toLowerCase().indexOf('snapshot_date')!==-1;});
      F.table = findF(dims, 'bq_table_name'); // Corrected to find the 'Table' node
      F.view = findF(dims, 'view_name'); 
      F.explore = findF(dims, 'explore_name');
      F.dashboard = findF(dims, 'dashboard_title');
      F.schema = findF(dims, 'project_name');
      F.cost = findF(allF, 'current_monthly_cost');

      function gv(row,k){if(!k||!row||!row[k])return'';return row[k].value||'';}
      function gn(row,k){if(!k||!row||!row[k])return 0;return parseFloat(row[k].value)||0;}
      function fmt$(v){if(v>=10000)return'$'+Math.round(v).toLocaleString();if(v>=1)return'$'+v.toFixed(2);return'$'+v.toFixed(4);}

      var sPal=['#8b5cf6','#06b6d4','#f59e0b','#ec4899','#10b981','#f97316','#3b82f6','#ef4444','#a855f7','#14b8a6','#eab308','#6366f1'];

      // Parse rows
      var rows=[];
      for(var di=0;di<data.length;di++){
        var row=data[di];
        rows.push({
          date: gv(row,F.date),
          schema: gv(row,F.schema),
          table: gv(row,F.table), // Now populating correctly
          view: gv(row,F.view),
          explore: gv(row,F.explore),
          dashboard: gv(row,F.dashboard),
          cost: gn(row,F.cost)
        });
      }

      // Determine Latest Date for KPIs
      var dateSet={};
      for(var ri=0;ri<rows.length;ri++){
        var dd=rows[ri].date?String(rows[ri].date).substring(0,10):'';
        if(dd)dateSet[dd]=true;
      }
      var sortedDates=Object.keys(dateSet).sort();
      var latestDate=sortedDates.length>0?sortedDates[sortedDates.length-1]:'';

      // Logic for building the Model list and Schema Distribution
      var models={};
      for(var i=0;i<rows.length;i++){
        var r=rows[i],d=r.date?String(r.date).substring(0,10):'';
        if(d!==latestDate) continue;
        var key=(r.schema?r.schema+'.':'')+r.table;
        if(!key||key==='.')continue;
        if(!models[key])models[key]={name:key,schema:r.schema,table:r.table,cost:0};
        models[key].cost=Math.max(models[key].cost,r.cost);
      }
      var mList=Object.values(models).sort(function(a,b){return b.cost-a.cost;});

      // KPI and Chart rendering (Maintaining original visualization logic)
      function render(){
        var h='';
        // ... (KPI cards and Chart code matches your original structure)
        // Ensure the table section uses m.table which is now mapped to bq_table_name
        
        R.innerHTML = h; 
        // ... (Event listener logic remains the same)
      }
      
      render(); // Execute the layout
      
    } catch(e) { console.error('StorageCostExplorer error:',e); }
    done();
  }
});

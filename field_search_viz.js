looker.plugins.visualizations.add({
  id: "lineage_explorer",
  label: "Lineage Explorer",
  options: {
    looker_base_url: {type:"string",label:"Looker Base URL",default:"",section:"Settings",order:1},
    lineage_dashboard_id: {type:"string",label:"Lineage Dashboard ID",default:"",section:"Navigation",order:2},
    overlap_dashboard_id: {type:"string",label:"Overlap Dashboard ID",default:"",section:"Navigation",order:3},
    usage_dashboard_id: {type:"string",label:"Usage Dashboard ID",default:"",section:"Navigation",order:4},
    dbt_dashboard_id: {type:"string",label:"dbt Lineage Dashboard ID",default:"",section:"Navigation",order:5}
  },
  create: function(element) {
    element.style.height='100%';element.style.width='100%';
    element.innerHTML='<div id="lex" style="width:100%;height:100%;font-family:Inter,system-ui,-apple-system,sans-serif;background:#0a0e1a;color:#e2e8f0;display:flex;flex-direction:column;overflow:hidden"></div>';
    var s=document.createElement('style');
    s.textContent='#lex *{box-sizing:border-box}.lx-nav{display:flex;align-items:center;gap:2px;padding:14px 20px 0;background:linear-gradient(180deg,#0f1629,#0a0e1a)}.lx-nav-btn{padding:10px 22px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#475569;border-radius:10px 10px 0 0;transition:all .2s;display:flex;align-items:center;gap:8px;letter-spacing:.3px;text-decoration:none;position:relative}.lx-nav-btn:hover{color:#94a3b8;background:rgba(30,41,59,0.25)}.lx-nav-btn.active{color:#e2e8f0;background:#131b2e;cursor:default}.lx-nav-btn.active::after{content:"";position:absolute;bottom:0;left:10px;right:10px;height:2px;border-radius:2px 2px 0 0}.lx-nav-btn.t-lineage.active{color:#10b981}.lx-nav-btn.t-lineage.active::after{background:#10b981}.lx-nav-btn.t-overlap.active{color:#8b5cf6}.lx-nav-btn.t-overlap.active::after{background:#8b5cf6}.lx-nav-btn.t-usage.active{color:#f59e0b}.lx-nav-btn.t-usage.active::after{background:#f59e0b}.lx-nav-btn.t-dbt.active{color:#ff69b4}.lx-nav-btn.t-dbt.active::after{background:#ff69b4}.lx-body{flex:1;background:#131b2e;border-radius:12px 12px 0 0;overflow:hidden;display:flex;flex-direction:column;border:1px solid #1e293b;border-bottom:none;margin:0 12px}.lx-bar{padding:10px 16px;border-bottom:1px solid rgba(30,41,59,0.25);display:flex;align-items:center;justify-content:space-between;font-size:11px;min-height:42px}.lx-scroll{flex:1;overflow:auto}.lx-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:500}.lx-node{cursor:pointer;transition:opacity .15s}.lx-node:hover{opacity:.85}.lx-row{display:grid;border-bottom:1px solid rgba(30,41,59,0.1);transition:background .15s}.lx-row:hover{background:rgba(30,41,59,0.3)}.lx-hdr{display:grid;border-bottom:1px solid #1e293b;position:sticky;top:0;background:#131b2e;z-index:1}.lx-hdr>div{padding:10px 12px;font-size:10px;font-weight:600;color:#475569;cursor:pointer;user-select:none;text-transform:uppercase;letter-spacing:.5px;transition:color .15s}.lx-hdr>div:hover{color:#94a3b8}.lx-hdr>div.on{color:#e2e8f0}.lx-cell{padding:8px 12px;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lx-ebtn{padding:7px 16px;border:1px solid #1e293b;cursor:pointer;font-size:11px;font-weight:500;transition:all .15s;background:transparent;color:#64748b;letter-spacing:.3px}.lx-ebtn:hover{background:#1e293b;color:#94a3b8}.lx-ebtn.on{background:#1e293b;border-color:#334155}.lx-link{color:#475569;text-decoration:none;transition:color .15s;display:inline-flex}.lx-link:hover{color:#e2e8f0}.dp-card{border-bottom:1px solid rgba(30,41,59,0.12)}.dp-head{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;transition:background .15s}.dp-head:hover{background:rgba(30,41,59,0.2)}';
    element.appendChild(s);
  },
  updateAsync: function(data, element, config, queryResponse, details, done) {
    var R=element.querySelector('#lex'),W=element.offsetWidth||1200;
    var baseUrl=(config.looker_base_url||'').replace(/\/+$/,'');
    if(!data||data.length===0){R.innerHTML='<div style="padding:40px;color:#475569;text-align:center">No data available</div>';done();return;}

    var dims=queryResponse.fields.dimension_like.map(function(f){return f.name;});
    var meas=queryResponse.fields.measure_like?queryResponse.fields.measure_like.map(function(f){return f.name;}):[];
    
    // Mapping Fields
    var F={};
    F.dash=dims.find(f => f.toLowerCase().includes('dashboard') && f.toLowerCase().includes('title'));
    F.dashId=dims.find(f => f.toLowerCase().includes('dashboard_id'));
    F.exp=dims.find(f => f.toLowerCase().includes('explore') && f.toLowerCase().includes('name'));
    F.view=dims.find(f => f.toLowerCase().includes('view') && f.toLowerCase().includes('name') && !f.toLowerCase().includes('count'));
    F.tbl=dims.find(f => f.toLowerCase().includes('sql_table'));
    F.flds=dims.find(f => f.toLowerCase().includes('sql_table_fields'));
    F.date=dims.find(f => f.toLowerCase().includes('stats_date') || f.toLowerCase().includes('date'));
    F.vc=meas.find(f => f.toLowerCase().includes('view_count') || f.toLowerCase().includes('dashboard_view'));
    
    // dbt Specific Fields
    F.dbtModel = dims.find(f => f.endsWith('.model'));
    F.dbtParents = dims.filter(f => f.includes('.parent_')).sort();

    var mode;
    if(F.dbtModel && F.dbtParents.length > 0) mode = 'dbt';
    else if(F.date && F.vc) mode='usage';
    else if(F.dash && F.exp && F.view) mode='lineage';
    else if(F.view && F.flds) mode='overlap';
    else mode='lineage';

    function gv(row,k){return k&&row[k]?row[k].value||'':'';}

    var ic={
      lin:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l4-6h2M11 12l4 6h2"/></svg>',
      ovl:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>',
      usg:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
      dbt:'<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
      lnk:'<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
    };

    function navBar(){
      var tabs=[
        {id:'lineage',label:'Lineage',icon:ic.lin,did:config.lineage_dashboard_id},
        {id:'dbt',label:'dbt',icon:ic.dbt,did:config.dbt_dashboard_id},
        {id:'overlap',label:'Overlap',icon:ic.ovl,did:config.overlap_dashboard_id},
        {id:'usage',label:'Usage',icon:ic.usg,did:config.usage_dashboard_id}
      ];
      var h='<div class="lx-nav">';
      tabs.forEach(function(t){
        var isActive = t.id === mode;
        if(isActive){
          h+='<div class="lx-nav-btn active t-'+t.id+'">'+t.icon+' '+t.label+'</div>';
        } else if(baseUrl && t.did){
          h+='<a href="'+baseUrl+'/dashboards/'+t.did+'" target="_parent" class="lx-nav-btn t-'+t.id+'">'+t.icon+' '+t.label+'</a>';
        } else {
          h+='<div class="lx-nav-btn t-'+t.id+'" style="opacity:.3;cursor:default">'+t.icon+' '+t.label+'</div>';
        }
      });
      h+='</div>';
      return h;
    }

    // ========== DBT LINEAGE MODE ==========
    if(mode==='dbt'){
      var nodes={}, links=[], seenLinks={};
      
      data.forEach(function(row){
        var child = gv(row, F.dbtModel);
        if(!child) return;
        if(!nodes[child]) nodes[child] = {id:child, name:child, type:'model', depth: 0};
        
        var currentChild = child;
        F.dbtParents.forEach(function(pCol, idx){
          var parent = gv(row, pCol);
          if(parent){
            if(!nodes[parent]) nodes[parent] = {id:parent, name:parent, type:'parent', depth: idx + 1};
            var linkKey = parent + '->' + currentChild;
            if(!seenLinks[linkKey]){
              links.push({source: parent, target: currentChild});
              seenLinks[linkKey] = true;
            }
            // In the ancestry structure, usually all parents relate to the leaf
            // But to make a graph, we link Parent N to Parent N-1
            currentChild = parent; 
          }
        });
      });

      var ae = Object.values(nodes);
      var sel=null, up=[], dn=[];

      function getNeighbors(id, direction, visited){
        visited = visited || {};
        if(visited[id]) return [];
        visited[id] = true;
        var result = [];
        links.forEach(l => {
          if(direction === 'up' && l.target === id) {
            result.push(l.source);
            result = result.concat(getNeighbors(l.source, 'up', visited));
          }
          if(direction === 'down' && l.source === id) {
            result.push(l.target);
            result = result.concat(getNeighbors(l.target, 'down', visited));
          }
        });
        return [...new Set(result)];
      }

      function renderDbt(){
        var visNodes = ae;
        if(sel){
          up = getNeighbors(sel.id, 'up');
          dn = getNeighbors(sel.id, 'down');
          var relevant = [sel.id, ...up, ...dn];
          visNodes = ae.filter(n => relevant.includes(n.id));
        }

        // Horizontal Auto-layout based on dbt depth
        var nW=180, nH=32, spX=250, spY=45, pd=20;
        var pos = {};
        var columns = {};
        visNodes.forEach(n => {
          if(!columns[n.depth]) columns[n.depth] = [];
          columns[n.depth].push(n);
        });

        Object.keys(columns).forEach(d => {
          columns[d].sort((a,b) => a.id.localeCompare(b.id)).forEach((n, i) => {
            pos[n.id] = { x: pd + (9 - d) * spX, y: 60 + i * spY };
          });
        });

        var svgH = Math.max(800, Object.values(columns).reduce((a,b) => Math.max(a, b.length), 0) * spY + 100);
        var svgW = 10 * spX;

        var edgeMarkup = '';
        links.forEach(l => {
          var p1 = pos[l.source], p2 = pos[l.target];
          if(!p1 || !p2) return;
          var isActive = sel && (l.source === sel.id || dn.includes(l.target)) && (l.target === sel.id || up.includes(l.source));
          var color = isActive ? '#ff69b4' : '#1e293b';
          var opacity = isActive ? 0.9 : 0.3;
          edgeMarkup += `<path d="M${p1.x+nW} ${p1.y+nH/2} C${(p1.x+nW+p2.x)/2} ${p1.y+nH/2}, ${(p1.x+nW+p2.x)/2} ${p2.y+nH/2}, ${p2.x} ${p2.y+nH/2}" fill="none" stroke="${color}" stroke-width="${isActive?2:1}" stroke-opacity="${opacity}"/>`;
        });

        var nodeMarkup = '';
        visNodes.forEach(n => {
          var p = pos[n.id];
          var isSel = sel && sel.id === n.id;
          var color = isSel ? '#ff69b4' : '#475569';
          nodeMarkup += `<g class="lx-node dbt-nd" data-id="${n.id}" transform="translate(${p.x},${p.y})">
            <rect width="${nW}" height="${nH}" rx="6" fill="${isSel?'#ff69b410':'#131b2e'}" stroke="${color}" stroke-width="${isSel?2:1}"/>
            <text x="10" y="20" fill="#e2e8f0" font-size="10" font-weight="500">${n.name.length > 25 ? n.name.substring(0,23)+'...' : n.name}</text>
          </g>`;
        });

        var status = sel ? `<span class="lx-pill" style="background:#ff69b420;color:#ff69b4">${sel.name}</span> <span style="margin-left:10px;color:#475569">Parents: ${up.length} | Children: ${dn.length}</span>` : 'Click a model to highlight its specific lineage';

        R.innerHTML = navBar() + `
          <div class="lx-body">
            <div class="lx-bar"><div>${status}</div></div>
            <div class="lx-scroll"><svg width="${svgW}" height="${svgH}">${edgeMarkup}${nodeMarkup}</svg></div>
          </div>`;

        R.querySelectorAll('.dbt-nd').forEach(el => {
          el.addEventListener('click', () => {
            var id = el.dataset.id;
            sel = (sel && sel.id === id) ? null : ae.find(n => n.id === id);
            renderDbt();
          });
        });
      }
      renderDbt();
      done();
      return;
    }

    // ... (rest of your existing lineage/overlap/usage code remains the same)
  }
});

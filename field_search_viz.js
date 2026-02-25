looker.plugins.visualizations.add({
  id: "lineage_explorer",
  label: "Lineage Explorer",
  options: {
    looker_base_url: {type:"string",label:"Looker Base URL",default:"",section:"Settings",order:1},
    lineage_dashboard_id: {type:"string",label:"Lineage Dashboard ID",default:"",section:"Navigation",order:2},
    overlap_dashboard_id: {type:"string",label:"Overlap Dashboard ID",default:"",section:"Navigation",order:3},
    usage_dashboard_id: {type:"string",label:"Usage Dashboard ID",default:"",section:"Navigation",order:4},
    dbt_dashboard_id: {type:"string",label:"dbt Dashboard ID",default:"",section:"Navigation",order:5}
  },
  create: function(element) {
    element.style.height='100%';element.style.width='100%';
    element.innerHTML='<div id="lex" style="width:100%;height:100%;font-family:Inter,system-ui,-apple-system,sans-serif;background:#0a0e1a;color:#e2e8f0;display:flex;flex-direction:column;overflow:hidden"></div>';
    var s=document.createElement('style');
    s.textContent='#lex *{box-sizing:border-box}.lx-nav{display:flex;align-items:center;gap:2px;padding:14px 20px 0;background:linear-gradient(180deg,#0f1629,#0a0e1a)}.lx-nav-btn{padding:10px 22px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#475569;border-radius:10px 10px 0 0;transition:all .2s;display:flex;align-items:center;gap:8px;letter-spacing:.3px;text-decoration:none;position:relative}.lx-nav-btn:hover{color:#94a3b8;background:rgba(30,41,59,0.25)}.lx-nav-btn.active{color:#e2e8f0;background:#131b2e;cursor:default}.lx-nav-btn.active::after{content:"";position:absolute;bottom:0;left:10px;right:10px;height:2px;border-radius:2px 2px 0 0}.lx-nav-btn.t-lineage.active{color:#10b981}.lx-nav-btn.t-lineage.active::after{background:#10b981}.lx-nav-btn.t-overlap.active{color:#8b5cf6}.lx-nav-btn.t-overlap.active::after{background:#8b5cf6}.lx-nav-btn.t-usage.active{color:#f59e0b}.lx-nav-btn.t-usage.active::after{background:#f59e0b}.lx-nav-btn.t-dbt.active{color:#ff69b4}.lx-nav-btn.t-dbt.active::after{background:#ff69b4}.lx-body{flex:1;background:#131b2e;border-radius:12px 12px 0 0;overflow:hidden;display:flex;flex-direction:column;border:1px solid #1e293b;border-bottom:none;margin:0 12px}.lx-bar{padding:10px 16px;border-bottom:1px solid rgba(30,41,59,0.25);display:flex;align-items:center;justify-content:space-between;font-size:11px;min-height:42px}.lx-scroll{flex:1;overflow:auto}.lx-node{cursor:pointer;transition:opacity .15s}.lx-node:hover{opacity:.85}';
    element.appendChild(s);
  },
  updateAsync: function(data, element, config, queryResponse, details, done) {
    var R=element.querySelector('#lex'),W=element.offsetWidth||1200;
    var baseUrl=(config.looker_base_url||'').replace(/\/+$/,'');
    if(!data||data.length===0){R.innerHTML='<div style="padding:40px;color:#475569;text-align:center">No data available</div>';done();return;}

    var dims=queryResponse.fields.dimension_like.map(function(f){return f.name;});
    var F={};
    F.dbtModel = dims.find(f => f.toLowerCase().includes('model'));
    F.dbtParents = dims.filter(f => f.toLowerCase().includes('parent_')).sort().reverse(); // Reverse so parent_9 is first
    
    // Determine mode based on fields present
    var mode = (F.dbtModel && F.dbtParents.length > 0) ? 'dbt' : 'lineage';

    var ic={
      lin:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l4-6h2M11 12l4 6h2"/></svg>',
      dbt:'<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
      ovl:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>',
      usg:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>'
    };

    function gv(row,k){return k&&row[k]?row[k].value||'':'';}

    // ========== DBT LINEAGE LOGIC ==========
    if(mode === 'dbt') {
      var nodes = {}, links = [], seenLinks = {};
      
      data.forEach(row => {
        var child = gv(row, F.dbtModel);
        if(!child) return;
        if(!nodes[child]) nodes[child] = {id: child, name: child, type: 'leaf'};
        
        var chain = [];
        F.dbtParents.forEach(pCol => {
            var pVal = gv(row, pCol);
            if(pVal) chain.push(pVal);
        });
        chain.push(child);

        // Build links from parent sequence
        for(var i=0; i < chain.length - 1; i++) {
            var s = chain[i], t = chain[i+1];
            if(!nodes[s]) nodes[s] = {id: s, name: s, type: 'ancestor'};
            var lKey = s + '->' + t;
            if(!seenLinks[lKey] && s !== t) {
                links.push({source: s, target: t});
                seenLinks[lKey] = true;
            }
        }
      });

      var ae = Object.values(nodes);
      var sel = null;

      function renderDbt() {
        var nW=160, nH=30, spX=220, spY=40;
        var pos = {};
        
        // Simple rank-based layout
        var ranks = {};
        ae.forEach(n => {
           // Find distance from root (approximate by parents)
           var rank = 0;
           links.forEach(l => { if(l.target === n.id) rank++; });
           if(!ranks[rank]) ranks[rank] = [];
           ranks[rank].push(n);
        });

        Object.keys(ranks).forEach(r => {
            ranks[r].forEach((n, i) => {
                pos[n.id] = { x: 20 + r * spX, y: 60 + i * spY };
            });
        });

        var edgeMarkup = '';
        links.forEach(l => {
            var p1 = pos[l.source], p2 = pos[l.target];
            if(!p1 || !p2) return;
            var isPath = sel && (l.source === sel || l.target === sel);
            edgeMarkup += `<path d="M${p1.x+nW} ${p1.y+nH/2} L${p2.x} ${p2.y+nH/2}" fill="none" stroke="${isPath?'#ff69b4':'#1e293b'}" stroke-width="${isPath?2:1}" stroke-opacity="${isPath?1:0.4}"/>`;
        });

        var nodeMarkup = '';
        ae.forEach(n => {
            var p = pos[n.id];
            var isSel = sel === n.id;
            nodeMarkup += `<g class="lx-node dbt-nd" data-id="${n.id}" transform="translate(${p.x},${p.y})">
                <rect width="${nW}" height="${nH}" rx="4" fill="${isSel?'#ff69b420':'#131b2e'}" stroke="${isSel?'#ff69b4':'#334155'}" stroke-width="${isSel?2:1}"/>
                <text x="8" y="19" fill="#e2e8f0" font-size="10">${n.name.substring(0,22)}</text>
            </g>`;
        });

        R.innerHTML = `
          <div class="lx-nav">
            <div class="lx-nav-btn active t-dbt">${ic.dbt} dbt Lineage</div>
          </div>
          <div class="lx-body">
            <div class="lx-bar"><div style="color:#94a3b8">DBT Model Dependencies</div></div>
            <div class="lx-scroll"><svg width="2000" height="1000">${edgeMarkup}${nodeMarkup}</svg></div>
          </div>`;

        R.querySelectorAll('.dbt-nd').forEach(el => {
            el.addEventListener('click', () => { sel = el.dataset.id; renderDbt(); });
        });
      }
      renderDbt();
    }
    done();
  }
});

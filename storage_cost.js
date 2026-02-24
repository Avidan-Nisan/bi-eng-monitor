looker.plugins.visualizations.add({
  id: "storage_cost_explorer",
  label: "Storage Cost Explorer",
  options: {
    primary_color: {type:"string",label:"Primary Color (Cost)",default:"#8b5cf6",section:"Style",order:1},
    secondary_color: {type:"string",label:"Secondary Color (Models)",default:"#06b6d4",section:"Style",order:2},
    // New Option for Lineage
    show_lineage: {type:"boolean",label:"Show Lineage View",default:true,section:"Display",order:6}
  },

  create: function(element) {
    element.style.height='100%';element.style.width='100%';
    element.innerHTML='<div id="scx" style="width:100%;height:100%;font-family:Inter,system-ui,-apple-system,sans-serif;background:#0a0e1a;color:#e2e8f0;display:flex;flex-direction:column;overflow:hidden"></div>';
    
    var s=document.createElement('style');
    s.textContent=[
      '#scx *{box-sizing:border-box}',
      '.sc-body{flex:1;display:flex;flex-direction:column;overflow:hidden;margin:0 12px;background:#131b2e;border-radius:12px;border:1px solid #1e293b}',
      '.sc-scroll{flex:1;overflow:auto}',
      // LINEAGE STYLES
      '.lineage-container{display:flex;padding:20px;gap:40px;align-items:flex-start;justify-content:center;background:rgba(15,22,41,0.5)}',
      '.node-col{display:flex;flex-direction:column;gap:15px;align-items:center}',
      '.node-card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px;min-width:180px;position:relative}',
      '.node-label{font-size:10px;color:#64748b;text-transform:uppercase;margin-bottom:4px}',
      '.node-title{font-size:13px;font-weight:600;color:#f8fafc}',
      '.consumer-tag{display:flex;align-items:center;gap:8px;padding:6px;background:#0f172a;border-radius:6px;margin-top:5px;border:1px solid #1e293b}',
      '.unused-list{margin-top:10px;padding-top:10px;border-top:1px dashed #334155}',
      '.unused-item{font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}',
      '.unused-badge{color:#ef4444;font-size:9px;background:rgba(239,68,68,0.1);padding:0 4px;border-radius:3px}',
      '.line-connector{height:2px;background:#334155;flex:1;align-self:center;min-width:40px;position:relative}'
    ].join('');
    element.appendChild(s);
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    var R=element.querySelector('#scx'), W=element.offsetWidth;
    var pc=config.primary_color, sc2=config.secondary_color;

    // Helper to find your specific LKML fields
    function findF(kw){
        return queryResponse.fields.dimension_like.find(f => f.name.toLowerCase().includes(kw))?.name;
    }

    const F = {
        table: findF('table_name'),
        schema: findF('table_schema'),
        consumer: findF('consumer_type'),
        column: findF('column_name'),
        used: findF('column_used_in_query')
    };

    // Logic to aggregate unused columns and consumers per table
    var tableMap = {};
    data.forEach(row => {
        let tName = row[F.table]?.value;
        if(!tName) return;
        if(!tableMap[tName]) tableMap[tName] = { consumers: new Set(), columns: {} };
        
        if(row[F.consumer]?.value) tableMap[tName].consumers.add(row[F.consumer].value);
        
        let col = row[F.column]?.value;
        if(col){
            if(!tableMap[tName].columns[col]) tableMap[tName].columns[col] = 0;
            tableMap[tName].columns[col] += (parseFloat(row[F.used]?.value) || 0);
        }
    });

    const getLogo = (type) => {
        const logos = {
            'Looker': '💜', // Replace with <img src="..."> for actual logos
            'DBT': '🟧',
            'Service Account': '🤖',
            'User': '👤',
            'Redash': '📊'
        };
        return logos[type] || '🔗';
    };

    function renderLineage() {
        let h = '<div class="sc-body" style="margin-top:20px"><div class="sc-scroll">';
        
        Object.keys(tableMap).forEach(tName => {
            const t = tableMap[tName];
            const unusedCols = Object.keys(t.columns).filter(c => t.columns[c] === 0);

            h += `<div class="lineage-container">
                <div class="node-col">
                    <div class="node-card" style="border-left:4px solid ${pc}">
                        <div class="node-label">Table</div>
                        <div class="node-title">${tName}</div>
                        ${unusedCols.length > 0 ? `
                            <div class="unused-list">
                                <div class="node-label" style="color:#ef4444">Unused Columns (${unusedCols.length})</div>
                                ${unusedCols.slice(0,3).map(c => `<div class="unused-item">${c} <span class="unused-badge">0 hits</span></div>`).join('')}
                                ${unusedCols.length > 3 ? `<div class="unused-item" style="opacity:0.5">...and ${unusedCols.length - 3} more</div>` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="line-connector"></div>

                <div class="node-col">
                    <div class="node-label">Downstream Consumers</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px">
                        ${Array.from(t.consumers).map(c => `
                            <div class="consumer-tag">
                                <span>${getLogo(c)}</span>
                                <span style="font-size:11px">${c}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
        });

        h += '</div></div>';
        return h;
    }

    R.innerHTML = `<div style="padding:20px"><h2>Storage & Usage Lineage</h2></div>` + renderLineage();
    done();
  }
});

looker.plugins.visualizations.add({
  id: "storage_cost_explorer", 
  label: "Storage Cost & Usage Explorer",   
  options: {
    primary_color: {type:"string",label:"Primary Color",default:"#8b5cf6",section:"Style"},
    secondary_color: {type:"string",label:"Secondary Color",default:"#06b6d4",section:"Style"}
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        #scx-root { font-family: 'Inter', sans-serif; background: #0a0e1a; color: #e2e8f0; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
        .scx-nav { display: flex; gap: 30px; padding: 0 20px; background: #0f172a; border-bottom: 1px solid #1e293b; height: 45px; align-items: center; flex-shrink: 0; }
        .scx-tab { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; height: 100%; display: flex; align-items: center; border-bottom: 2px solid transparent; }
        .scx-tab.active { color: #8b5cf6; border-bottom-color: #8b5cf6; }
        .scx-content { flex: 1; overflow-y: auto; padding: 25px; }
        
        /* Lineage Design */
        .ln-row { display: flex; align-items: flex-start; margin-bottom: 35px; }
        .ln-source { width: 320px; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .ln-schema { font-size: 9px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 4px; }
        .ln-table { font-size: 14px; font-weight: 700; color: #f8fafc; margin-bottom: 10px; word-break: break-all; }
        .ln-unused { background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); border-radius: 6px; padding: 8px; }
        .ln-unused-title { font-size: 9px; font-weight: 800; color: #ef4444; margin-bottom: 6px; }
        .ln-col-pill { font-size: 9px; color: #94a3b8; background: #1e293b; padding: 2px 6px; border-radius: 4px; display: inline-block; margin: 1px; border: 1px solid rgba(255,255,255,0.05); }
        .ln-connector { flex: 1; height: 2px; background: #1e293b; margin-top: 35px; position: relative; min-width: 40px; }
        .ln-connector::after { content: '▶'; position: absolute; right: -5px; top: -5px; font-size: 10px; color: #1e293b; }
        .ln-consumers { display: flex; flex-wrap: wrap; gap: 10px; max-width: 500px; padding-top: 15px; }
        .ln-consumer-card { display: flex; align-items: center; gap: 8px; background: #131b2e; border: 1px solid #1e293b; padding: 8px 14px; border-radius: 50px; font-size: 11px; font-weight: 600; }
        .ln-logo { font-size: 14px; }
      </style>
      <div id="scx-root">
        <div class="scx-nav" id="viz-nav">
          <div class="scx-tab" id="tab-cost" data-tab="cost">Cost Explorer</div>
          <div class="scx-tab active" id="tab-usage" data-tab="usage">Usage Lineage</div>
        </div>
        <div id="scx-content" class="scx-content"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const content = element.querySelector('#scx-content');
    const nav = element.querySelector('#viz-nav');
    
    // DETECT EXPLORE: Force "Usage" tab if we are in BIE DBT Usage
    const currentExplore = queryResponse.explore || "";
    const isUsageExplore = currentExplore.toLowerCase().includes("bie_dbt_usage");

    if (isUsageExplore) {
        element.querySelector('#tab-usage').classList.add('active');
        element.querySelector('#tab-cost').style.display = 'none'; 
    }

    // Dynamic Field Mapping from your screenshot labels
    const getField = (label) => {
        const field = queryResponse.fields.dimension_like.concat(queryResponse.fields.measure_like)
                      .find(f => f.label_short === label || f.label.includes(label));
        return field ? field.name : null;
    };

    const F = {
      table: getField('Table Name'),
      schema: getField('Table Schema'),
      consumer: getField('Consumer Type'),
      column: getField('Column Name'),
      usage: getField('Total Column Usage')
    };

    const logos = {
      'Looker': '💜', 'DBT': '🟧', 'Redash': '📊', 'Amplify': '⚡', 'Service Account': '🤖', 'User': '👤'
    };

    // Data Aggregation
    const tableData = {};
    data.forEach(row => {
      const name = row[F.table]?.value;
      if (!name) return;

      if (!tableData[name]) {
        tableData[name] = { 
            schema: row[F.schema]?.value || 'MART', 
            consumers: new Set(), 
            unused: new Set() 
        };
      }

      if (row[F.consumer]?.value) tableData[name].consumers.add(row[F.consumer].value);
      
      // A column is unused if its usage measure is exactly 0
      if (parseFloat(row[F.usage]?.value) === 0) {
        tableData[name].unused.add(row[F.column]?.value);
      }
    });

    // Render Usage Lineage
    let html = '';
    Object.keys(tableData).forEach(tName => {
      const t = tableData[tName];
      const consumers = Array.from(t.consumers);
      const unused = Array.from(t.unused);

      html += `
        <div class="ln-row">
          <div class="ln-source">
            <div class="ln-schema">${t.schema}</div>
            <div class="ln-table">${tName}</div>
            ${unused.length > 0 ? `
              <div class="ln-unused">
                <div class="ln-unused-title">⚠️ UNUSED COLUMNS (${unused.length})</div>
                ${unused.slice(0, 10).map(c => `<span class="ln-col-pill">${c}</span>`).join('')}
                ${unused.length > 10 ? `<span style="font-size:9px; color:#475569"> +${unused.length - 10}</span>` : ''}
              </div>
            ` : ''}
          </div>
          <div class="ln-connector"></div>
          <div class="ln-consumers">
            ${consumers.length > 0 ? consumers.map(c => `
              <div class="ln-consumer-card">
                <span class="ln-logo">${logos[c] || '🔗'}</span>
                <span>${c}</span>
              </div>
            `).join('') : '<span style="color:#475569; font-size:11px">No consumers detected</span>'}
          </div>
        </div>
      `;
    });

    content.innerHTML = html || '<div style="text-align:center; padding:100px; color:#475569">No data found. Ensure dimensions are selected.</div>';
    done();
  }
});

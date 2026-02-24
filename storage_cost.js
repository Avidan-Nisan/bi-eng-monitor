looker.plugins.visualizations.add({
  id: "storage_cost_explorer",
  label: "Storage Cost Explorer",
  options: {
    primary_color: {type:"string",label:"Primary Color",default:"#8b5cf6",section:"Style"},
    secondary_color: {type:"string",label:"Secondary Color",default:"#06b6d4",section:"Style"}
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        #scx-root { font-family: 'Inter', system-ui, sans-serif; background: #0a0e1a; color: #e2e8f0; height: 100%; display: flex; flex-direction: column; }
        .tabs-header { display: flex; gap: 24px; padding: 12px 20px; border-bottom: 1px solid #1e293b; background: #0f172a; flex-shrink: 0; }
        .tab-item { cursor: pointer; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 8px; position: relative; }
        .tab-item.active { color: #8b5cf6; }
        .tab-item.active::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: #8b5cf6; }
        
        .tab-pane { flex: 1; overflow-y: auto; padding: 24px; display: none; }
        .tab-pane.active { display: block; }

        /* Usage/Lineage Styling */
        .usage-row { display: flex; align-items: flex-start; gap: 30px; margin-bottom: 30px; }
        .table-card { width: 300px; background: #131b2e; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; flex-shrink: 0; }
        .table-meta { font-size: 9px; color: #475569; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; }
        .table-name { font-size: 14px; font-weight: 700; color: #f8fafc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        
        .unused-section { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(30,41,59,0.5); }
        .unused-title { font-size: 9px; color: #ef4444; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.5px;}
        .col-pill { font-size: 10px; color: #94a3b8; background: rgba(30, 41, 59, 0.5); padding: 3px 8px; border-radius: 4px; display: inline-block; margin: 0 4px 4px 0; border: 1px solid #1e293b; }
        
        .flow-line { width: 40px; height: 2px; background: #1e293b; margin-top: 30px; position: relative; flex-shrink: 0; }
        .flow-line::after { content: '▶'; position: absolute; right: -5px; top: -5px; color: #1e293b; font-size: 10px; }
        
        .consumer-list { display: flex; flex-wrap: wrap; gap: 10px; padding-top: 15px; }
        .consumer-node { display: flex; align-items: center; gap: 10px; background: #0f172a; border: 1px solid #1e293b; padding: 8px 14px; border-radius: 20px; font-size: 12px; }
        .logo { font-size: 14px; width: 20px; text-align: center; }
      </style>
      <div id="scx-root">
        <div class="tabs-header">
          <div class="tab-item" data-tab="cost">Cost Explorer</div>
          <div class="tab-item active" data-tab="usage">Usage</div>
        </div>
        <div id="cost-view" class="tab-pane">
           <div style="text-align:center; padding-top:100px; color:#475569">Cost Explorer Content...</div>
        </div>
        <div id="usage-view" class="tab-pane active"></div>
      </div>
    `;

    // Simple Tab Switcher logic
    element.querySelectorAll('.tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        element.querySelectorAll('.tab-item, .tab-pane').forEach(el => el.classList.remove('active'));
        tab.classList.add('active');
        element.querySelector(`#${tab.dataset.tab}-view`).classList.add('active');
      });
    });
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const usageContainer = element.querySelector('#usage-view');
    
    // Explicitly mapping based on your screenshot's column names
    const findField = (label) => {
        const field = queryResponse.fields.dimension_like.concat(queryResponse.fields.measure_like)
                      .find(f => f.label_short === label || f.label === label);
        return field ? field.name : null;
    };

    const F = {
      table: findField('Table Name'),
      schema: findField('Table Schema'),
      consumer: findField('Consumer Type'),
      column: findField('Column Name'),
      usage: findField('Total Column Usage')
    };

    const logoMap = {
      'Looker': '💜', 'DBT': '🟧', 'Redash': '📊', 'Amplify': '⚡', 'Service Account': '🤖', 'User': '👤'
    };

    // 1. Aggregate data by table
    const tables = {};
    data.forEach(row => {
      const tName = row[F.table]?.value;
      if (!tName) return;

      if (!tables[tName]) {
        tables[tName] = { 
          schema: row[F.schema]?.value || 'MART', 
          consumers: new Set(), 
          unused: [] 
        };
      }

      if (row[F.consumer]?.value) tables[tName].consumers.add(row[F.consumer].value);
      
      // If the sum for this column is 0, it is unused
      if (parseFloat(row[F.usage]?.value) === 0) {
        tables[tName].unused.push(row[F.column]?.value);
      }
    });

    // 2. Build the Usage HTML
    let html = '';
    Object.keys(tables).forEach(tName => {
      const t = tables[tName];
      const consumerArray = Array.from(t.consumers);

      html += `
        <div class="usage-row">
          <div class="table-card">
            <div class="table-meta">${t.schema}</div>
            <div class="table-name" title="${tName}">${tName}</div>
            
            ${t.unused.length > 0 ? `
              <div class="unused-section">
                <div class="unused-title">UNUSED COLUMNS (${t.unused.length})</div>
                ${t.unused.slice(0, 6).map(c => `<span class="col-pill">${c}</span>`).join('')}
                ${t.unused.length > 6 ? `<span style="font-size:10px; color:#475569">... +${t.unused.length - 6} more</span>` : ''}
              </div>
            ` : ''}
          </div>

          <div class="flow-line"></div>

          <div class="consumer-list">
            ${consumerArray.map(c => `
              <div class="consumer-node">
                <span class="logo">${logoMap[c] || '🔗'}</span>
                <span>${c}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    usageContainer.innerHTML = html || '<div style="text-align:center; padding:50px;">No usage data found.</div>';
    done();
  }
});

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
        .tabs { display: flex; gap: 24px; padding: 12px 20px; border-bottom: 1px solid #1e293b; background: #0f172a; }
        .tab { cursor: pointer; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 1px; transition: all 0.2s; }
        .tab.active { color: #8b5cf6; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px; margin-bottom: -13px; }
        .content { flex: 1; overflow-y: auto; padding: 24px; }
        
        /* Lineage Specific Styling */
        .lineage-row { display: flex; align-items: center; gap: 40px; margin-bottom: 40px; }
        .table-node { width: 280px; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; position: relative; }
        .table-node::after { content: ''; position: absolute; right: -40px; top: 50%; width: 40px; height: 2px; background: #1e293b; }
        .schema-label { font-size: 9px; color: #475569; text-transform: uppercase; font-weight: 800; margin-bottom: 4px; }
        .table-title { font-size: 14px; font-weight: 700; color: #f8fafc; }
        
        .unused-box { margin-top: 12px; padding-top: 12px; border-top: 1px dashed #1e293b; }
        .unused-title { font-size: 9px; color: #ef4444; font-weight: 700; margin-bottom: 6px; }
        .unused-col { font-size: 10px; color: #94a3b8; background: rgba(239,68,68,0.05); padding: 2px 6px; border-radius: 4px; display: inline-block; margin: 2px; }
        
        .consumers-container { display: flex; flex-wrap: wrap; gap: 12px; flex: 1; }
        .consumer-node { display: flex; align-items: center; gap: 10px; background: #131b2e; border: 1px solid #1e293b; padding: 10px 16px; border-radius: 50px; transition: transform 0.2s; }
        .consumer-node:hover { transform: translateY(-2px); border-color: #8b5cf6; }
        .logo-circle { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #0a0e1a; font-size: 12px; }
      </style>
      <div id="scx-root">
        <div class="tabs">
          <div class="tab active">Usage & Lineage</div>
        </div>
        <div id="scx-content" class="content"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const content = element.querySelector('#scx-content');

    // Field Finder
    const find = (kw) => queryResponse.fields.dimension_like.concat(queryResponse.fields.measure_like)
                          .find(f => f.name.toLowerCase().includes(kw))?.name;

    const F = {
      table: find('table_name'),
      schema: find('table_schema'),
      consumer: find('consumer_type'),
      col: find('column_name'),
      usage: find('total_column_usage')
    };

    // Consumer Branding
    const brands = {
      'Looker': { icon: '💜', color: '#6e2cf2' },
      'DBT': { icon: '🟧', color: '#ff694b' },
      'Redash': { icon: '📊', color: '#33b5e5' },
      'Amplify': { icon: '⚡', color: '#ffac31' },
      'Service Account': { icon: '🤖', color: '#94a3b8' },
      'User': { icon: '👤', color: '#10b981' }
    };

    // Data Processing: Aggregate by Table
    const tableMap = {};
    data.forEach(row => {
      const tName = row[F.table]?.value;
      if (!tName) return;

      if (!tableMap[tName]) {
        tableMap[tName] = { 
          schema: row[F.schema]?.value || 'public', 
          consumers: new Set(), 
          unused: [] 
        };
      }

      if (row[F.consumer]?.value) tableMap[tName].consumers.add(row[F.consumer].value);
      
      // If total usage is 0, it's an unused column
      if (parseFloat(row[F.usage]?.value) === 0) {
        tableMap[tName].unused.push(row[F.col]?.value);
      }
    });

    // Render HTML
    let html = '';
    Object.entries(tableMap).forEach(([name, meta]) => {
      const consumerArray = Array.from(meta.consumers);
      
      html += `
        <div class="lineage-row">
          <div class="table-node">
            <div class="schema-label">${meta.schema}</div>
            <div class="table-title">${name}</div>
            
            ${meta.unused.length > 0 ? `
              <div class="unused-box">
                <div class="unused-title">UNUSED COLUMNS (${meta.unused.length})</div>
                ${meta.unused.slice(0, 5).map(c => `<span class="unused-col">${c}</span>`).join('')}
                ${meta.unused.length > 5 ? `<span style="font-size:10px; color:#475569"> +${meta.unused.length - 5} more</span>` : ''}
              </div>
            ` : ''}
          </div>

          <div class="consumers-container">
            ${consumerArray.map(c => {
              const brand = brands[c] || { icon: '🔗', color: '#334155' };
              return `
                <div class="consumer-node">
                  <div class="logo-circle" style="border: 1px solid ${brand.color}55">${brand.icon}</div>
                  <div style="font-size: 12px; font-weight: 500">${c}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    content.innerHTML = html || '<div style="text-align:center; padding:100px; color:#475569">No data found. Ensure fields are selected.</div>';
    done();
  }
});

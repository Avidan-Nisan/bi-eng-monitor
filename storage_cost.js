looker.plugins.visualizations.add({
  id: "dbt_usage_explorer_v2", // Unique ID to prevent caching issues
  label: "DBT Usage Explorer",
  options: {
    primary_color: {type:"string",label:"Primary Color",default:"#8b5cf6",section:"Style"},
    secondary_color: {type:"string",label:"Secondary Color",default:"#06b6d4",section:"Style"}
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        #scx-root { font-family: 'Inter', sans-serif; background: #0a0e1a; color: #e2e8f0; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
        
        /* New Navigation Tabs */
        .scx-nav { display: flex; gap: 30px; padding: 0 20px; background: #0f172a; border-bottom: 1px solid #1e293b; height: 45px; align-items: center; flex-shrink: 0; }
        .scx-tab { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; height: 100%; display: flex; align-items: center; border-bottom: 2px solid transparent; transition: 0.2s; }
        .scx-tab.active { color: #8b5cf6; border-bottom-color: #8b5cf6; }
        
        .scx-content { flex: 1; overflow-y: auto; padding: 25px; scroll-behavior: smooth; }
        
        /* Lineage/Usage UI Design */
        .ln-row { display: flex; align-items: flex-start; margin-bottom: 40px; position: relative; }
        .ln-source { width: 320px; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; z-index: 2; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
        .ln-schema { font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 4px; }
        .ln-table { font-size: 14px; font-weight: 700; color: #f8fafc; margin-bottom: 12px; word-break: break-all; }
        
        .ln-unused { background: rgba(239, 68, 68, 0.03); border: 1px solid rgba(239, 68, 68, 0.1); border-radius: 8px; padding: 10px; }
        .ln-unused-title { font-size: 9px; font-weight: 800; color: #ef4444; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
        .ln-col-pill { font-size: 10px; color: #94a3b8; background: #1e293b; padding: 3px 8px; border-radius: 4px; display: inline-block; margin: 2px; }

        .ln-connector { flex: 1; height: 2px; background: linear-gradient(90deg, #1e293b 0%, #334155 100%); margin-top: 35px; position: relative; min-width: 60px; }
        .ln-connector::after { content: '▶'; position: absolute; right: -5px; top: -5px; font-size: 10px; color: #334155; }

        .ln-consumers { display: flex; flex-wrap: wrap; gap: 12px; max-width: 500px; padding-top: 15px; }
        .ln-consumer-card { display: flex; align-items: center; gap: 10px; background: #131b2e; border: 1px solid #1e293b; padding: 10px 16px; border-radius: 50px; font-size: 12px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .ln-logo-img { width: 22px; height: 22px; object-fit: contain; }
      </style>
      <div id="scx-root">
        <div class="scx-nav" id="viz-nav">
          <div class="scx-tab" id="tab-cost" data-tab="cost">Cost Explorer</div>
          <div class="scx-tab active" id="tab-usage" data-tab="usage">DBT Usage</div>
        </div>
        <div id="scx-content" class="scx-content"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const content = element.querySelector('#scx-content');
    
    // FORCE TAB LOGIC: Detect if we are in the "BIE DBT Usage" explore
    const exploreName = queryResponse.explore || "";
    const isDbtExplore = exploreName.toLowerCase().includes("bie_dbt_usage");

    if (isDbtExplore) {
        element.querySelector('#tab-usage').classList.add('active');
        element.querySelector('#tab-cost').style.display = 'none'; // Hide cost explorer to avoid confusion
    }

    const findField = (label) => {
        const field = queryResponse.fields.dimension_like.concat(queryResponse.fields.measure_like)
                      .find(f => f.label_short === label || f.label.includes(label));
        return field ? field.name : null;
    };

    const F = {
      table: findField('Table Name'),
      schema: findField('Table Schema'),
      consumer: findField('Consumer Type'),
      column: findField('Column Name'),
      usage: findField('Total Column Usage')
    };

    // CONSUMER LOGO MAPPING
    const logoMap = {
      'Salesforce': '<img src="https://upload.wikimedia.org/wikipedia/commons/f/f9/Salesforce.com_logo.svg" class="ln-logo-img">',
      'Looker': '<span style="font-size:18px">💜</span>',
      'DBT': '<span style="font-size:18px">🟧</span>',
      'Redash': '<span style="font-size:18px">📊</span>',
      'Service Account': '<span style="font-size:18px">🤖</span>',
      'User': '<span style="font-size:18px">👤</span>'
    };

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
      
      // Identify unused columns where usage measure is 0
      if (parseFloat(row[F.usage]?.value) === 0) {
        tableData[name].unused.add(row[F.column]?.value);
      }
    });

    let html = '';
    Object.keys(tableData).forEach(tName => {
      const t = tableData[tName];
      const consumerList = Array.from(t.consumers);
      const unusedList = Array.from(t.unused);

      html += `
        <div class="ln-row">
          <div class="ln-source">
            <div class="ln-schema">${t.schema}</div>
            <div class="ln-table">${tName}</div>
            ${unusedList.length > 0 ? `
              <div class="ln-unused">
                <div class="ln-unused-title">⚠️ UNUSED COLUMNS (${unusedList.length})</div>
                ${unusedList.slice(0, 8).map(c => `<span class="ln-col-pill">${c}</span>`).join('')}
                ${unusedList.length > 8 ? `<span style="font-size: 9px; color: #475569; padding-left: 5px">... +${unusedList.length - 8}</span>` : ''}
              </div>
            ` : ''}
          </div>
          <div class="ln-connector"></div>
          <div class="ln-consumers">
            ${consumerList.map(c => `
              <div class="ln-consumer-card">
                ${logoMap[c] || '<span style="font-size:18px">🔗</span>'}
                <span>${c}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    content.innerHTML = html || '<div style="text-align:center; padding:100px; color:#475569">No data found in current selection.</div>';
    done();
  }
});

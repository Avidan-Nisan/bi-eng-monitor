looker.plugins.visualizations.add({
  id: "dbt_usage_explorer_final", // Unique ID to force Looker to re-register
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
        
        /* New Forced Navigation */
        .scx-header { display: flex; gap: 30px; padding: 0 20px; background: #0f172a; border-bottom: 1px solid #1e293b; height: 48px; align-items: center; flex-shrink: 0; }
        .scx-tab-label { font-size: 11px; font-weight: 700; color: #8b5cf6; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #8b5cf6; height: 100%; display: flex; align-items: center; }
        
        .scx-scroll-area { flex: 1; overflow-y: auto; padding: 25px; scroll-behavior: smooth; }
        
        /* Lineage/Node Styling */
        .node-row { display: flex; align-items: flex-start; margin-bottom: 40px; position: relative; }
        .node-source { width: 320px; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; z-index: 2; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4); }
        .node-schema { font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 4px; }
        .node-table { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 12px; word-break: break-all; }
        
        .unused-container { background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); border-radius: 8px; padding: 10px; }
        .unused-header { font-size: 9px; font-weight: 800; color: #ef4444; margin-bottom: 8px; }
        .col-tag { font-size: 10px; color: #94a3b8; background: #1e293b; padding: 3px 8px; border-radius: 4px; display: inline-block; margin: 2px; border: 1px solid rgba(255,255,255,0.05); }

        .line-bridge { flex: 1; height: 2px; background: #1e293b; margin-top: 35px; position: relative; min-width: 50px; }
        .line-bridge::after { content: '▶'; position: absolute; right: -5px; top: -5px; font-size: 10px; color: #1e293b; }

        .consumer-group { display: flex; flex-wrap: wrap; gap: 12px; max-width: 550px; padding-top: 15px; }
        .consumer-pill { display: flex; align-items: center; gap: 10px; background: #131b2e; border: 1px solid #1e293b; padding: 10px 18px; border-radius: 50px; font-size: 12px; font-weight: 600; transition: border-color 0.2s; }
        .consumer-pill:hover { border-color: #8b5cf6; }
        .sf-logo { width: 22px; height: 16px; object-fit: contain; }
      </style>
      <div id="scx-root">
        <div class="scx-header">
          <div class="scx-tab-label" id="main-label">Usage Explorer</div>
        </div>
        <div id="scx-main" class="scx-scroll-area"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const mainArea = element.querySelector('#scx-main');
    const label = element.querySelector('#main-label');

    const exploreName = (queryResponse.explore || "").toLowerCase();
    const isBieDbtUsageExplore = exploreName.includes("bie_dbt_usage") || exploreName.includes("bie dbt usage");

    // BIE DBT Usage explore → show usage view and label; otherwise keep default (e.g. lineage)
    if (isBieDbtUsageExplore) {
      label.innerText = "DBT Usage";
    } else {
      label.innerText = "Usage Explorer";
    }

    const allFields = (queryResponse.fields.dimension_like || []).concat(queryResponse.fields.measure_like || []);
    const getFieldId = (labelStr) => {
      const field = allFields.find(f => f.label_short === labelStr || (f.label && f.label.includes(labelStr)));
      return field ? field.name : null;
    };

    // For BIE DBT Usage explore, try common alternate labels in case this explore uses different names
    const tryLabels = (primary, alternates) => {
      let id = getFieldId(primary);
      if (id) return id;
      for (const alt of alternates) {
        id = getFieldId(alt);
        if (id) return id;
      }
      return null;
    };

    const F = {
      table:  isBieDbtUsageExplore ? tryLabels('Table Name', ['Table', 'table_name', 'Table Name']) : getFieldId('Table Name'),
      schema: isBieDbtUsageExplore ? tryLabels('Table Schema', ['Schema', 'schema', 'Table Schema']) : getFieldId('Table Schema'),
      consumer: isBieDbtUsageExplore ? tryLabels('Consumer Type', ['Consumer', 'consumer_type', 'Consumer Type']) : getFieldId('Consumer Type'),
      column:  isBieDbtUsageExplore ? tryLabels('Column Name', ['Column', 'column_name', 'Column Name']) : getFieldId('Column Name'),
      usage:   isBieDbtUsageExplore ? tryLabels('Total Column Usage', ['Usage', 'column_usage', 'Total Column Usage']) : getFieldId('Total Column Usage')
    };

    // CONSUMER BRANDING
    const brands = {
      'Salesforce': '<img src="https://upload.wikimedia.org/wikipedia/commons/f/f9/Salesforce.com_logo.svg" class="sf-logo">',
      'Looker': '<span style="font-size:16px">💜</span>',
      'DBT': '<span style="font-size:16px">🟧</span>',
      'Redash': '<span style="font-size:16px">📊</span>',
      'Service Account': '<span style="font-size:16px">🤖</span>'
    };

    const aggregated = {};
    data.forEach(row => {
      const t = row[F.table]?.value;
      if (!t) return;
      if (!aggregated[t]) {
        aggregated[t] = { schema: row[F.schema]?.value || 'N/A', consumers: new Set(), unused: new Set() };
      }
      if (row[F.consumer]?.value) aggregated[t].consumers.add(row[F.consumer].value);
      if (F.usage && parseFloat(row[F.usage]?.value) === 0) {
        if (row[F.column]?.value) aggregated[t].unused.add(row[F.column].value);
      }
    });

    let html = '';
    Object.keys(aggregated).forEach(tableName => {
      const entry = aggregated[tableName];
      const consumers = Array.from(entry.consumers);
      const unused = Array.from(entry.unused);

      html += `
        <div class="node-row">
          <div class="node-source">
            <div class="node-schema">${entry.schema}</div>
            <div class="node-table">${tableName}</div>
            ${unused.length > 0 ? `
              <div class="unused-container">
                <div class="unused-header">⚠️ UNUSED COLUMNS (${unused.length})</div>
                ${unused.slice(0, 10).map(c => `<span class="col-tag">${c}</span>`).join('')}
                ${unused.length > 10 ? `<span style="font-size:9px; color:#475569; padding-left:5px">... +${unused.length - 10}</span>` : ''}
              </div>
            ` : ''}
          </div>
          <div class="line-bridge"></div>
          <div class="consumer-group">
            ${consumers.map(c => `
              <div class="consumer-pill">
                ${brands[c] || '<span style="font-size:16px">🔗</span>'}
                <span>${c}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    mainArea.innerHTML = html || '<div style="text-align:center; padding-top:100px; color:#475569">No data found. For BIE DBT Usage: add dimensions (e.g. Table Name, Table Schema, Consumer Type, Column Name) and measure Total Column Usage.</div>';
    done();
  }
});

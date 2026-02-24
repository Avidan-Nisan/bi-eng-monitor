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

        /* Tabs */
        .scx-tabs { display: flex; gap: 0; align-items: center; height: 100%; }
        .scx-tab { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding: 0 16px; height: 100%; display: flex; align-items: center; cursor: pointer; border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s; }
        .scx-tab:hover { color: #94a3b8; }
        .scx-tab.active { color: #8b5cf6; border-bottom-color: #8b5cf6; }

        /* Lineage tab: vertical flow */
        .scx-lineage-flow { display: flex; flex-direction: column; gap: 20px; }
        .scx-lineage-node { background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 16px 20px; }
        .scx-lineage-arrow { text-align: center; color: #475569; font-size: 14px; padding: 4px 0; }
        /* Overlap tab */
        .scx-overlap-section { margin-bottom: 28px; }
        .scx-overlap-title { font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 10px; }
        .scx-overlap-list { display: flex; flex-wrap: wrap; gap: 8px; }
        .scx-overlap-item { background: #131b2e; border: 1px solid #1e293b; padding: 8px 14px; border-radius: 8px; font-size: 12px; color: #e2e8f0; }
      </style>
      <div id="scx-root">
        <div class="scx-header">
          <div class="scx-tabs">
            <div class="scx-tab active" data-tab="usage">Usage</div>
            <div class="scx-tab" data-tab="lineage">Lineage</div>
            <div class="scx-tab" data-tab="overlap">Overlap</div>
          </div>
        </div>
        <div id="scx-main" class="scx-scroll-area"></div>
      </div>
    `;
    element.querySelectorAll('.scx-tab').forEach(tabEl => {
      tabEl.addEventListener('click', function() {
        const tab = this.getAttribute('data-tab');
        element.querySelectorAll('.scx-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        if (element._scxRender) element._scxRender(tab);
      });
    });
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const mainArea = element.querySelector('#scx-main');
    const activeTab = element.dataset.scxTab || 'usage';

    const allFields = (queryResponse.fields.dimension_like || []).concat(queryResponse.fields.measure_like || []);
    const getFieldId = (labelStr) => {
      const field = allFields.find(f => f.label_short === labelStr || (f.label && f.label.includes(labelStr)));
      return field ? field.name : null;
    };
    const getFieldIdByName = (suffix) => {
      const field = allFields.find(f => f.name && (f.name === suffix || f.name.endsWith("." + suffix)));
      return field ? field.name : null;
    };

    const exploreNameLower = ((queryResponse.explore || "").trim()).toLowerCase();
    const isBieDbtUsageExplore = exploreNameLower === "dbt_usage" || exploreNameLower.includes("bie_dbt_usage") || exploreNameLower.includes("bie dbt usage");

    const F = {
      table:  isBieDbtUsageExplore ? (getFieldIdByName("table_name") || getFieldId("Table Name")) : getFieldId('Table Name'),
      schema: isBieDbtUsageExplore ? (getFieldIdByName("table_schema") || getFieldId("Table Schema")) : getFieldId('Table Schema'),
      consumer: isBieDbtUsageExplore ? (getFieldIdByName("consumer_type") || getFieldId("Consumer Type")) : getFieldId('Consumer Type'),
      column:  isBieDbtUsageExplore ? (getFieldIdByName("column_name") || getFieldId("Column Name")) : getFieldId('Column Name'),
      usage:   isBieDbtUsageExplore ? (getFieldIdByName("total_column_usage") || getFieldId("Total Column Usage")) : getFieldId('Total Column Usage')
    };

    const brands = {
      'Salesforce': '<img src="https://upload.wikimedia.org/wikipedia/commons/f/f9/Salesforce.com_logo.svg" class="sf-logo">',
      'Looker': '<span style="font-size:16px">💜</span>',
      'DBT': '<span style="font-size:16px">🟧</span>',
      'Redash': '<span style="font-size:16px">📊</span>',
      'Service Account': '<span style="font-size:16px">🤖</span>'
    };

    const aggregated = {};
    const byConsumer = {};
    data.forEach(row => {
      const t = row[F.table]?.value;
      if (!t) return;
      if (!aggregated[t]) {
        aggregated[t] = { schema: row[F.schema]?.value || 'N/A', consumers: new Set(), unused: new Set() };
      }
      const cons = row[F.consumer]?.value;
      if (cons) {
        aggregated[t].consumers.add(cons);
        if (!byConsumer[cons]) byConsumer[cons] = new Set();
        byConsumer[cons].add(t);
      }
      if (F.usage && parseFloat(row[F.usage]?.value) === 0 && row[F.column]?.value) {
        aggregated[t].unused.add(row[F.column].value);
      }
    });

    function renderUsage() {
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
      return html;
    }

    function renderLineage() {
      let html = '<div class="scx-lineage-flow">';
      const tables = Object.keys(aggregated);
      tables.forEach((tableName, i) => {
        const entry = aggregated[tableName];
        const consumers = Array.from(entry.consumers);
        html += `
          <div class="scx-lineage-node">
            <div class="node-schema">${entry.schema}</div>
            <div class="node-table">${tableName}</div>
            <div style="margin-top:12px; font-size:11px; color:#64748b;">Used by: ${consumers.length ? consumers.join(', ') : '—'}</div>
          </div>
        `;
        if (i < tables.length - 1) html += '<div class="scx-lineage-arrow">↓</div>';
      });
      html += '</div>';
      return html;
    }

    function renderOverlap() {
      let html = '';
      Object.keys(byConsumer).sort().forEach(consumer => {
        const tables = Array.from(byConsumer[consumer]);
        html += `
          <div class="scx-overlap-section">
            <div class="scx-overlap-title">${brands[consumer] || '🔗'} ${consumer} (${tables.length} table${tables.length !== 1 ? 's' : ''})</div>
            <div class="scx-overlap-list">
              ${tables.map(t => `<span class="scx-overlap-item">${t}</span>`).join('')}
            </div>
          </div>
        `;
      });
      return html;
    }

    const noDataMsg = '<div style="text-align:center; padding-top:100px; color:#475569">No data found. Add dimensions (e.g. Table Name, Table Schema, Consumer Type, Column Name) and measure Total Column Usage.</div>';

    element._scxRender = function(tab) {
      element.dataset.scxTab = tab;
      let content = '';
      if (Object.keys(aggregated).length === 0) content = noDataMsg;
      else if (tab === 'usage') content = renderUsage();
      else if (tab === 'lineage') content = renderLineage();
      else if (tab === 'overlap') content = Object.keys(byConsumer).length ? renderOverlap() : noDataMsg;
      mainArea.innerHTML = content;
    };

    element._scxRender(activeTab);
    done();
  }
});

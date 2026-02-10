looker.plugins.visualizations.add({
  id: "data_dyson",
  label: "Data Dyson - Table Health Monitor",
  options: {
    colorScheme: {
      type: "string",
      label: "Color Scheme",
      display: "select",
      values: [{ "Dark": "dark" }, { "Light": "light" }],
      default: "dark",
    },
  },

  create: function (element, config) {
    element.innerHTML = "";
    element.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    element.style.overflow = "auto";
    this._container = document.createElement("div");
    element.appendChild(this._container);
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    this.clearErrors();

    // --- Parse field names from queryResponse ---
    var dims = queryResponse.fields.dimension_like.map(function(f) { return f.name; });
    var meas = queryResponse.fields.measure_like.map(function(f) { return f.name; });

    // Helper: find field name containing a keyword
    function findField(list, keyword) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].toLowerCase().indexOf(keyword) !== -1) return list[i];
      }
      return null;
    }

    var F = {
      schema:      findField(dims, "table_schema"),
      name:        findField(dims, "table_name"),
      indictment:  findField(dims, "indictment"),
      classif:     findField(dims, "classification"),
      reasoning:   findField(dims, "reasoning"),
      action:      findField(dims, "action"),
      state:       findField(dims, "state_status"),
      size:        findField(meas, "size"),
      cost:        findField(meas, "cost") || findField(meas, "monthly"),
      risk:        findField(meas, "risk"),
    };

    // --- Extract rows ---
    var rows = data.map(function(row) {
      return {
        schema:     F.schema     ? (row[F.schema]     && row[F.schema].value     || "") : "",
        name:       F.name       ? (row[F.name]       && row[F.name].value       || "") : "",
        indictment: F.indictment ? (row[F.indictment] && row[F.indictment].value || "") : "",
        classif:    F.classif    ? (row[F.classif]    && row[F.classif].value    || "") : "",
        reasoning:  F.reasoning  ? (row[F.reasoning]  && row[F.reasoning].value  || "") : "",
        action:     F.action     ? (row[F.action]     && row[F.action].value     || "") : "",
        state:      F.state      ? (row[F.state]      && row[F.state].value      || "") : "",
        size:       F.size       ? (parseFloat(row[F.size]   && row[F.size].value)   || 0) : 0,
        cost:       F.cost       ? (parseFloat(row[F.cost]   && row[F.cost].value)   || 0) : 0,
        risk:       F.risk       ? (parseFloat(row[F.risk]   && row[F.risk].value)   || 0) : 0,
      };
    });

    // --- Compute summary stats ---
    var totalSize = 0, totalCost = 0, totalRisk = 0;
    for (var i = 0; i < rows.length; i++) {
      totalSize += rows[i].size;
      totalCost += rows[i].cost;
      totalRisk += rows[i].risk;
    }
    var avgRisk = rows.length ? Math.round(totalRisk / rows.length) : 0;

    var actionable = rows.filter(function(r) { return r.action === "Delete" || r.action === "Archive"; });
    var savings = 0;
    for (var i = 0; i < actionable.length; i++) savings += actionable[i].cost;

    // --- Schema distribution ---
    var schemaMap = {};
    rows.forEach(function(r) { schemaMap[r.schema] = (schemaMap[r.schema] || 0) + r.size; });
    var schemaEntries = Object.keys(schemaMap).map(function(k) { return [k, schemaMap[k]]; });
    schemaEntries.sort(function(a, b) { return b[1] - a[1]; });
    var schemaColors = { prod: "#ef4444", stg: "#f59e0b", test: "#3b82f6" };

    // --- Unique values for filters ---
    var allSchemasMap = {}, allActionsMap = {};
    rows.forEach(function(r) { allSchemasMap[r.schema] = true; allActionsMap[r.action] = true; });
    var allSchemas = Object.keys(allSchemasMap);
    var allActions = Object.keys(allActionsMap);

    // --- State ---
    var currentSort = "size";
    var sortDir = "desc";
    var schemaFilter = "all";
    var actionFilter = "all";
    var self = this;

    function render() {
      var filtered = rows.slice();
      if (schemaFilter !== "all") filtered = filtered.filter(function(r) { return r.schema === schemaFilter; });
      if (actionFilter !== "all") filtered = filtered.filter(function(r) { return r.action === actionFilter; });
      filtered.sort(function(a, b) { return sortDir === "desc" ? b[currentSort] - a[currentSort] : a[currentSort] - b[currentSort]; });

      var isDark = config.colorScheme !== "light";
      var bg          = isDark ? "#020617" : "#ffffff";
      var cardBg      = isDark ? "#0f172a" : "#f8fafc";
      var cardBorder  = isDark ? "rgba(148,163,184,0.1)" : "rgba(0,0,0,0.08)";
      var textPrimary = isDark ? "#f1f5f9" : "#0f172a";
      var textSecond  = isDark ? "#94a3b8" : "#64748b";
      var textMuted   = isDark ? "#64748b" : "#94a3b8";
      var rowHoverBg  = isDark ? "rgba(59,130,246,0.05)" : "rgba(59,130,246,0.04)";
      var tableBorder = isDark ? "rgba(148,163,184,0.07)" : "rgba(0,0,0,0.06)";
      var headerBorder= isDark ? "rgba(148,163,184,0.15)" : "rgba(0,0,0,0.1)";
      var barTrackBg  = isDark ? "#1e293b" : "#e2e8f0";

      // Badge helper
      function badge(text, variant) {
        var styles = {
          red:    { bg: "rgba(239,68,68,0.15)", c: "#f87171", b: "rgba(239,68,68,0.3)" },
          amber:  { bg: "rgba(245,158,11,0.15)", c: "#fbbf24", b: "rgba(245,158,11,0.3)" },
          green:  { bg: "rgba(34,197,94,0.15)", c: "#4ade80", b: "rgba(34,197,94,0.3)" },
          blue:   { bg: "rgba(59,130,246,0.15)", c: "#60a5fa", b: "rgba(59,130,246,0.3)" },
          purple: { bg: "rgba(168,85,247,0.15)", c: "#c084fc", b: "rgba(168,85,247,0.3)" },
          slate:  { bg: "rgba(148,163,184,0.15)", c: "#94a3b8", b: "rgba(148,163,184,0.3)" },
        };
        var s = styles[variant] || styles.slate;
        return '<span style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;background:' + s.bg + ';color:' + s.c + ';border:1px solid ' + s.b + ';white-space:nowrap;letter-spacing:0.3px">' + text + '</span>';
      }

      function schemaBadge(schema) {
        var v = { prod: "red", stg: "amber", test: "blue" }[schema] || "slate";
        return badge(schema.toUpperCase(), v);
      }

      function statusBadge(status) {
        return status.indexOf("Stale") !== -1 ? badge("STALE", "amber") : badge("NEVER USED", "purple");
      }

      function actionBadge(action) {
        if (action === "Delete") return badge("DELETE", "red");
        if (action === "Archive") return badge("ARCHIVE", "amber");
        return badge("DO NOT DELETE", "slate");
      }

      function riskBar(score) {
        var color = score >= 80 ? "#ef4444" : score >= 50 ? "#f59e0b" : "#22c55e";
        return '<div style="display:flex;align-items:center;gap:8px">' +
          '<div style="width:60px;height:8px;background:' + barTrackBg + ';border-radius:4px;overflow:hidden">' +
          '<div style="width:' + score + '%;height:100%;background:' + color + ';border-radius:4px"></div>' +
          '</div>' +
          '<span style="font-size:13px;font-weight:600;color:' + color + '">' + score + '</span>' +
          '</div>';
      }

      function statCard(label, value, sub) {
        return '<div style="background:' + cardBg + ';border-radius:14px;padding:20px 24px;border:1px solid ' + cardBorder + ';flex:1;min-width:170px">' +
          '<div style="font-size:12px;color:' + textMuted + ';font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">' + label + '</div>' +
          '<div style="font-size:28px;font-weight:700;color:' + textPrimary + ';line-height:1.1">' + value + '</div>' +
          (sub ? '<div style="font-size:12px;color:' + textMuted + ';margin-top:6px">' + sub + '</div>' : '') +
          '</div>';
      }

      function filterBtn(text, active, dataAttr) {
        var bgColor = active ? "rgba(59,130,246,0.2)" : "rgba(148,163,184,0.08)";
        var fColor  = active ? "#60a5fa" : textSecond;
        var bColor  = active ? "1px solid rgba(59,130,246,0.4)" : "1px solid " + cardBorder;
        return '<button data-' + dataAttr + '="' + text + '" style="padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;background:' + bgColor + ';color:' + fColor + ';border:' + bColor + '">' + text + '</button>';
      }

      function sortIcon(col) {
        if (currentSort !== col) return '<span style="opacity:0.3;margin-left:4px">↕</span>';
        return '<span style="margin-left:4px;color:#60a5fa">' + (sortDir === "desc" ? "↓" : "↑") + '</span>';
      }

      // Schema distribution bar
      var schemaBarHtml = "";
      for (var i = 0; i < schemaEntries.length; i++) {
        var s = schemaEntries[i][0], sz = schemaEntries[i][1];
        var pct = totalSize ? (sz / totalSize * 100) : 0;
        var w = Math.max(pct, 2);
        var sc = schemaColors[s] || "#475569";
        var label = pct > 10 ? (s + " " + pct.toFixed(0) + "%") : "";
        schemaBarHtml += '<div style="width:' + w + '%;background:' + sc + ';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;border-right:2px solid ' + bg + '">' + label + '</div>';
      }

      var schemaLegendHtml = "";
      for (var i = 0; i < schemaEntries.length; i++) {
        var s = schemaEntries[i][0], sz = schemaEntries[i][1];
        var pct = totalSize ? (sz / totalSize * 100) : 0;
        var sc = schemaColors[s] || "#475569";
        schemaLegendHtml += '<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:' + textSecond + '">' +
          '<div style="width:8px;height:8px;border-radius:2px;background:' + sc + '"></div>' +
          s + ': ' + (sz / 1000).toFixed(1) + ' TB (' + pct.toFixed(0) + '%)' +
          '</div>';
      }

      // Filter buttons HTML
      var schemaFiltersHtml = filterBtn("all", schemaFilter === "all", "schema");
      for (var i = 0; i < allSchemas.length; i++) {
        schemaFiltersHtml += filterBtn(allSchemas[i], schemaFilter === allSchemas[i], "schema");
      }
      var actionFiltersHtml = filterBtn("all", actionFilter === "all", "action");
      for (var i = 0; i < allActions.length; i++) {
        actionFiltersHtml += filterBtn(allActions[i], actionFilter === allActions[i], "action");
      }

      // Table rows
      var tableRowsHtml = "";
      for (var i = 0; i < filtered.length; i++) {
        var r = filtered[i];
        tableRowsHtml += '<tr class="data-row" style="border-bottom:1px solid ' + tableBorder + '">' +
          '<td style="padding:12px 16px">' + schemaBadge(r.schema) + '</td>' +
          '<td style="padding:12px 16px;font-weight:500;color:' + textPrimary + ';font-family:monospace;font-size:12px">' + r.name + '</td>' +
          '<td style="padding:12px 16px;font-variant-numeric:tabular-nums;color:' + (isDark ? '#cbd5e1' : '#334155') + '">' + r.size.toLocaleString(undefined, { maximumFractionDigits: 0 }) + '</td>' +
          '<td style="padding:12px 16px;font-variant-numeric:tabular-nums;color:#fbbf24;font-weight:600">$' + r.cost.toFixed(2) + '</td>' +
          '<td style="padding:12px 16px">' + statusBadge(r.indictment) + '</td>' +
          '<td style="padding:12px 16px">' + riskBar(r.risk) + '</td>' +
          '<td style="padding:12px 16px;font-size:12px;color:' + textSecond + '">' + r.classif + '</td>' +
          '<td style="padding:12px 16px">' + actionBadge(r.action) + '</td>' +
          '</tr>';
      }

      // Sortable header style
      var thStyle = 'padding:14px 16px;text-align:left;font-weight:600;color:' + textMuted + ';font-size:11px;letter-spacing:0.8px;text-transform:uppercase';
      var thSortStyle = thStyle + ';cursor:pointer;user-select:none';

      self._container.innerHTML =
        '<div style="background:' + bg + ';color:' + textPrimary + ';padding:32px 24px;max-width:1280px;margin:0 auto">' +

        // Header
        '<div style="margin-bottom:32px">' +
          '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">' +
            '<div style="width:10px;height:10px;border-radius:50%;background:#f59e0b;box-shadow:0 0 12px rgba(245,158,11,0.5)"></div>' +
            '<h1 style="font-size:26px;font-weight:700;margin:0;color:' + textPrimary + '">Table Health Monitor</h1>' +
          '</div>' +
          '<p style="font-size:14px;color:' + textMuted + ';margin:0">Identifying suspect, stale, and unused tables across your data warehouse</p>' +
        '</div>' +

        // Stat Cards
        '<div style="display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap">' +
          statCard("Suspect Tables", filtered.length, "of " + rows.length + " total") +
          statCard("Total Size", (totalSize / 1000).toFixed(1) + " TB", "across all suspect tables") +
          statCard("Monthly Cost", "$" + totalCost.toFixed(0), "estimated waste") +
          statCard("Avg Risk Score", avgRisk, avgRisk >= 70 ? "⚠ High average" : "Moderate") +
          statCard("Potential Savings", "$" + savings.toFixed(0) + "/mo", actionable.length + " actionable tables") +
        '</div>' +

        // Schema Bar
        '<div style="background:' + cardBg + ';border-radius:12px;padding:20px;border:1px solid ' + cardBorder + ';margin-bottom:28px">' +
          '<div style="font-size:13px;font-weight:600;color:' + textSecond + ';margin-bottom:12px;letter-spacing:0.5px">STORAGE BY SCHEMA</div>' +
          '<div style="display:flex;border-radius:6px;overflow:hidden;height:28px">' + schemaBarHtml + '</div>' +
          '<div style="display:flex;gap:20px;margin-top:10px">' + schemaLegendHtml + '</div>' +
        '</div>' +

        // Filters
        '<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center">' +
          '<span style="font-size:12px;color:' + textMuted + ';font-weight:600">SCHEMA:</span>' +
          schemaFiltersHtml +
          '<div style="width:1px;height:24px;background:' + cardBorder + ';margin:0 8px"></div>' +
          '<span style="font-size:12px;color:' + textMuted + ';font-weight:600">ACTION:</span>' +
          actionFiltersHtml +
        '</div>' +

        // Table
        '<div style="background:' + cardBg + ';border-radius:14px;border:1px solid ' + cardBorder + ';overflow:hidden">' +
          '<div style="overflow-x:auto">' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
              '<thead>' +
                '<tr style="border-bottom:1px solid ' + headerBorder + '">' +
                  '<th style="' + thStyle + '">Schema</th>' +
                  '<th style="' + thStyle + '">Table Name</th>' +
                  '<th data-sort="size" style="' + thSortStyle + '">Size (GB)' + sortIcon("size") + '</th>' +
                  '<th data-sort="cost" style="' + thSortStyle + '">Est. Cost/mo' + sortIcon("cost") + '</th>' +
                  '<th style="' + thStyle + '">Status</th>' +
                  '<th data-sort="risk" style="' + thSortStyle + '">Risk' + sortIcon("risk") + '</th>' +
                  '<th style="' + thStyle + '">Classification</th>' +
                  '<th style="' + thStyle + '">Action</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>' + tableRowsHtml + '</tbody>' +
            '</table>' +
          '</div>' +
          (filtered.length === 0 ? '<div style="padding:40px;text-align:center;color:' + textMuted + '">No tables match the current filters</div>' : '') +
        '</div>' +

        '<div style="margin-top:16px;font-size:12px;color:' + textMuted + ';text-align:center">' +
          'Showing ' + filtered.length + ' of ' + rows.length + ' suspect tables • Click column headers to sort' +
        '</div>' +

        '</div>';

      // --- Attach event listeners ---
      var schemaButtons = self._container.querySelectorAll("[data-schema]");
      for (var i = 0; i < schemaButtons.length; i++) {
        (function(btn) {
          btn.addEventListener("click", function() {
            schemaFilter = btn.getAttribute("data-schema");
            render();
          });
        })(schemaButtons[i]);
      }

      var actionButtons = self._container.querySelectorAll("[data-action]");
      for (var i = 0; i < actionButtons.length; i++) {
        (function(btn) {
          btn.addEventListener("click", function() {
            actionFilter = btn.getAttribute("data-action");
            render();
          });
        })(actionButtons[i]);
      }

      var sortHeaders = self._container.querySelectorAll("[data-sort]");
      for (var i = 0; i < sortHeaders.length; i++) {
        (function(th) {
          th.addEventListener("click", function() {
            var col = th.getAttribute("data-sort");
            if (currentSort === col) {
              sortDir = sortDir === "desc" ? "asc" : "desc";
            } else {
              currentSort = col;
              sortDir = "desc";
            }
            render();
          });
        })(sortHeaders[i]);
      }

      var dataRows = self._container.querySelectorAll(".data-row");
      for (var i = 0; i < dataRows.length; i++) {
        (function(tr) {
          tr.addEventListener("mouseenter", function() { tr.style.background = rowHoverBg; });
          tr.addEventListener("mouseleave", function() { tr.style.background = "transparent"; });
        })(dataRows[i]);
      }
    }

    render();
    done();
  },
});

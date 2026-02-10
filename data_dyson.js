looker.plugins.visualizations.add({
  id: "data_dyson_kpi",
  label: "Data Dyson - KPI Dashboard",
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

    var dims = queryResponse.fields.dimension_like.map(function(f) { return f.name; });
    var meas = queryResponse.fields.measure_like.map(function(f) { return f.name; });

    function findField(list, keyword) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].toLowerCase().indexOf(keyword) !== -1) return list[i];
      }
      return null;
    }

    var F = {
      schema:     findField(dims, "table_schema"),
      name:       findField(dims, "table_name"),
      indictment: findField(dims, "indictment"),
      classif:    findField(dims, "classification"),
      reasoning:  findField(dims, "reasoning"),
      action:     findField(dims, "action"),
      state:      findField(dims, "state_status"),
      size:       findField(meas, "size"),
      cost:       findField(meas, "cost") || findField(meas, "monthly"),
      risk:       findField(meas, "risk"),
    };

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

    // --- Compute KPIs ---
    var total = rows.length;
    var deletes = rows.filter(function(r) { return r.action === "Delete"; });
    var archives = rows.filter(function(r) { return r.action === "Archive"; });
    var keeps = rows.filter(function(r) { return r.action !== "Delete" && r.action !== "Archive"; });
    var stale = rows.filter(function(r) { return r.indictment && r.indictment.indexOf("Stale") !== -1; });
    var neverUsed = rows.filter(function(r) { return r.indictment && r.indictment.indexOf("Never") !== -1; });

    var totalSize = 0, totalCost = 0, totalRisk = 0;
    var deleteCost = 0, archiveCost = 0, deleteSize = 0, archiveSize = 0;
    for (var i = 0; i < rows.length; i++) {
      totalSize += rows[i].size;
      totalCost += rows[i].cost;
      totalRisk += rows[i].risk;
    }
    for (var i = 0; i < deletes.length; i++) { deleteCost += deletes[i].cost; deleteSize += deletes[i].size; }
    for (var i = 0; i < archives.length; i++) { archiveCost += archives[i].cost; archiveSize += archives[i].size; }
    var avgRisk = total ? Math.round(totalRisk / total) : 0;
    var savingsCost = deleteCost + archiveCost;
    var actionableRate = total ? Math.round((deletes.length + archives.length) / total * 100) : 0;

    // Risk distribution
    var riskHigh = rows.filter(function(r) { return r.risk >= 80; });
    var riskMed = rows.filter(function(r) { return r.risk >= 50 && r.risk < 80; });
    var riskLow = rows.filter(function(r) { return r.risk < 50; });

    // Schema distribution
    var schemaMap = {};
    rows.forEach(function(r) {
      if (!schemaMap[r.schema]) schemaMap[r.schema] = { count: 0, size: 0, cost: 0, del: 0, arch: 0 };
      schemaMap[r.schema].count++;
      schemaMap[r.schema].size += r.size;
      schemaMap[r.schema].cost += r.cost;
      if (r.action === "Delete") schemaMap[r.schema].del++;
      if (r.action === "Archive") schemaMap[r.schema].arch++;
    });
    var schemas = Object.keys(schemaMap).sort(function(a, b) { return schemaMap[b].size - schemaMap[a].size; });

    // Classification distribution
    var classifMap = {};
    rows.forEach(function(r) {
      var c = r.classif || "Unknown";
      if (!classifMap[c]) classifMap[c] = { count: 0, size: 0, cost: 0 };
      classifMap[c].count++;
      classifMap[c].size += r.size;
      classifMap[c].cost += r.cost;
    });
    var classifs = Object.keys(classifMap).sort(function(a, b) { return classifMap[b].count - classifMap[a].count; });

    // Action breakdown by schema for stacked view
    var actionBySchema = {};
    rows.forEach(function(r) {
      if (!actionBySchema[r.schema]) actionBySchema[r.schema] = { Delete: 0, Archive: 0, Keep: 0 };
      if (r.action === "Delete") actionBySchema[r.schema].Delete++;
      else if (r.action === "Archive") actionBySchema[r.schema].Archive++;
      else actionBySchema[r.schema].Keep++;
    });

    // Top costly tables
    var topCost = rows.slice().sort(function(a, b) { return b.cost - a.cost; }).slice(0, 5);
    var topSize = rows.slice().sort(function(a, b) { return b.size - a.size; }).slice(0, 5);

    var self = this;
    var activeTab = "overview";

    function render() {
      var isDark = config.colorScheme !== "light";
      var bg          = isDark ? "#020617" : "#f1f5f9";
      var cardBg      = isDark ? "#0f172a" : "#ffffff";
      var cardBorder  = isDark ? "rgba(148,163,184,0.08)" : "rgba(0,0,0,0.06)";
      var textPrimary = isDark ? "#f1f5f9" : "#0f172a";
      var textSecond  = isDark ? "#94a3b8" : "#64748b";
      var textMuted   = isDark ? "#475569" : "#94a3b8";
      var accentBlue  = "#3b82f6";
      var accentGreen = "#22c55e";
      var accentRed   = "#ef4444";
      var accentAmber = "#f59e0b";
      var accentPurple= "#a855f7";
      var barTrackBg  = isDark ? "#1e293b" : "#e2e8f0";
      var dividerColor= isDark ? "rgba(148,163,184,0.08)" : "rgba(0,0,0,0.06)";

      function fmt(n) { return n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }
      function fmtMoney(n) { return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }
      function fmtTB(n) { return (n / 1000).toFixed(1) + " TB"; }
      function pct(n, d) { return d ? Math.round(n / d * 100) : 0; }

      // --- Reusable Components ---
      function kpiCard(icon, label, value, sub, accent, extra) {
        return '<div style="background:' + cardBg + ';border-radius:16px;padding:24px;border:1px solid ' + cardBorder + ';flex:1;min-width:200px;position:relative;overflow:hidden">' +
          '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:' + accent + ';opacity:0.06"></div>' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">' +
            '<div style="width:36px;height:36px;border-radius:10px;background:' + accent + '15;display:flex;align-items:center;justify-content:center;font-size:18px">' + icon + '</div>' +
            '<div style="font-size:11px;color:' + textMuted + ';font-weight:700;letter-spacing:1.2px;text-transform:uppercase">' + label + '</div>' +
          '</div>' +
          '<div style="font-size:36px;font-weight:800;color:' + textPrimary + ';line-height:1;margin-bottom:6px;font-variant-numeric:tabular-nums">' + value + '</div>' +
          (sub ? '<div style="font-size:12px;color:' + textSecond + ';margin-top:4px">' + sub + '</div>' : '') +
          (extra || '') +
          '</div>';
      }

      function miniBar(val, max, color, w) {
        var pw = max ? (val / max * 100) : 0;
        return '<div style="width:' + (w || '100%') + ';height:6px;background:' + barTrackBg + ';border-radius:3px;overflow:hidden">' +
          '<div style="width:' + pw + '%;height:100%;background:' + color + ';border-radius:3px;transition:width 0.3s"></div></div>';
      }

      function donutSVG(slices, size, thickness) {
        var r = (size - thickness) / 2, cx = size / 2, cy = size / 2;
        var total = 0;
        slices.forEach(function(s) { total += s.value; });
        var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">';
        var cumAngle = -90;
        slices.forEach(function(s) {
          if (s.value === 0) return;
          var angle = (s.value / total) * 360;
          var startRad = cumAngle * Math.PI / 180;
          var endRad = (cumAngle + angle) * Math.PI / 180;
          var x1 = cx + r * Math.cos(startRad), y1 = cy + r * Math.sin(startRad);
          var x2 = cx + r * Math.cos(endRad), y2 = cy + r * Math.sin(endRad);
          var large = angle > 180 ? 1 : 0;
          svg += '<path d="M ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2 + '" fill="none" stroke="' + s.color + '" stroke-width="' + thickness + '" stroke-linecap="round"/>';
          cumAngle += angle;
        });
        svg += '</svg>';
        return svg;
      }

      function sectionTitle(text) {
        return '<div style="font-size:13px;font-weight:700;color:' + textSecond + ';letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:8px">' +
          '<div style="width:3px;height:16px;border-radius:2px;background:' + accentBlue + '"></div>' + text + '</div>';
      }

      function tabBtn(id, label) {
        var isActive = activeTab === id;
        var tabBg = isActive ? accentBlue : "transparent";
        var tabColor = isActive ? "#fff" : textSecond;
        return '<button data-tab="' + id + '" style="padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;background:' + tabBg + ';color:' + tabColor + ';border:none;transition:all 0.2s">' + label + '</button>';
      }

      // --- Action Funnel ---
      function actionFunnel() {
        var items = [
          { label: "Scanned", count: total, color: accentBlue, icon: "🔍" },
          { label: "Flagged", count: stale.length + neverUsed.length, color: accentAmber, icon: "⚠️" },
          { label: "Archive", count: archives.length, color: accentPurple, icon: "📦" },
          { label: "Delete", count: deletes.length, color: accentRed, icon: "🗑️" },
          { label: "Retained", count: keeps.length, color: accentGreen, icon: "✅" },
        ];
        var h = '';
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          var w = total ? Math.max(it.count / total * 100, 12) : 20;
          h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">' +
            '<div style="width:80px;text-align:right;font-size:11px;font-weight:700;color:' + textSecond + ';text-transform:uppercase;letter-spacing:0.5px">' + it.icon + ' ' + it.label + '</div>' +
            '<div style="flex:1;position:relative">' +
              '<div style="height:32px;background:' + barTrackBg + ';border-radius:8px;overflow:hidden">' +
                '<div style="width:' + w + '%;height:100%;background:' + it.color + '20;border-left:3px solid ' + it.color + ';display:flex;align-items:center;padding-left:12px">' +
                  '<span style="font-size:14px;font-weight:800;color:' + it.color + '">' + it.count + '</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div style="width:50px;font-size:12px;color:' + textMuted + ';text-align:right">' + pct(it.count, total) + '%</div>' +
          '</div>';
        }
        return h;
      }

      // --- Schema Breakdown Table ---
      function schemaBreakdown() {
        var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">';
        h += '<thead><tr style="border-bottom:2px solid ' + dividerColor + '">';
        var cols = ["Schema", "Tables", "Size", "Cost/mo", "Delete", "Archive", "Action Rate"];
        cols.forEach(function(c) {
          h += '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:' + textMuted + ';letter-spacing:0.8px;text-transform:uppercase">' + c + '</th>';
        });
        h += '</tr></thead><tbody>';
        var schemaColors = { prod: accentRed, stg: accentAmber, test: accentBlue };
        schemas.forEach(function(s) {
          var d = schemaMap[s];
          var sc = schemaColors[s] || "#475569";
          var ar = d.count ? Math.round((d.del + d.arch) / d.count * 100) : 0;
          h += '<tr style="border-bottom:1px solid ' + dividerColor + '">' +
            '<td style="padding:10px 14px"><span style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;background:' + sc + '18;color:' + sc + ';border:1px solid ' + sc + '30">' + s.toUpperCase() + '</span></td>' +
            '<td style="padding:10px 14px;font-weight:600;color:' + textPrimary + '">' + d.count + '</td>' +
            '<td style="padding:10px 14px;color:' + textSecond + '">' + fmtTB(d.size) + '</td>' +
            '<td style="padding:10px 14px;color:#fbbf24;font-weight:600">' + fmtMoney(d.cost) + '</td>' +
            '<td style="padding:10px 14px;color:' + accentRed + ';font-weight:600">' + d.del + '</td>' +
            '<td style="padding:10px 14px;color:' + accentPurple + ';font-weight:600">' + d.arch + '</td>' +
            '<td style="padding:10px 14px">' +
              '<div style="display:flex;align-items:center;gap:8px">' + miniBar(ar, 100, ar > 70 ? accentGreen : accentAmber, "80px") +
              '<span style="font-size:12px;font-weight:600;color:' + textSecond + '">' + ar + '%</span></div>' +
            '</td>' +
          '</tr>';
        });
        h += '</tbody></table></div>';
        return h;
      }

      // --- Top Tables ---
      function topTablesCard(title, items, metric, colorFn) {
        var maxVal = items.length ? items[0][metric] : 1;
        var h = '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:1;min-width:320px">';
        h += '<div style="font-size:12px;font-weight:700;color:' + textMuted + ';letter-spacing:1px;text-transform:uppercase;margin-bottom:14px">' + title + '</div>';
        items.forEach(function(r, idx) {
          var v = metric === "cost" ? fmtMoney(r.cost) : fmt(r.size) + " GB";
          var c = colorFn(r);
          h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
            '<div style="width:20px;font-size:12px;font-weight:700;color:' + textMuted + '">#' + (idx + 1) + '</div>' +
            '<div style="flex:1">' +
              '<div style="font-size:12px;font-weight:600;color:' + textPrimary + ';font-family:monospace;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + r.name + '</div>' +
              miniBar(r[metric], maxVal, c) +
            '</div>' +
            '<div style="font-size:13px;font-weight:700;color:' + c + ';min-width:70px;text-align:right">' + v + '</div>' +
          '</div>';
        });
        h += '</div>';
        return h;
      }

      // --- Classification Distribution ---
      function classifDistribution() {
        var colors = [accentBlue, accentAmber, accentRed, accentGreen, accentPurple, "#f472b6", "#06b6d4"];
        var maxCount = 0;
        classifs.forEach(function(c) { if (classifMap[c].count > maxCount) maxCount = classifMap[c].count; });
        var h = '';
        classifs.forEach(function(c, idx) {
          var d = classifMap[c];
          var color = colors[idx % colors.length];
          h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">' +
            '<div style="width:100px;font-size:12px;font-weight:600;color:' + textSecond + ';text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + c + '</div>' +
            '<div style="flex:1">' + miniBar(d.count, maxCount, color) + '</div>' +
            '<div style="min-width:40px;font-size:13px;font-weight:700;color:' + textPrimary + '">' + d.count + '</div>' +
            '<div style="min-width:60px;font-size:11px;color:' + textMuted + '">' + fmtMoney(d.cost) + '</div>' +
          '</div>';
        });
        return h;
      }

      // --- Risk Distribution ---
      function riskDistribution() {
        var slices = [
          { value: riskHigh.length, color: accentRed },
          { value: riskMed.length, color: accentAmber },
          { value: riskLow.length, color: accentGreen },
        ];
        var donut = donutSVG(slices, 120, 14);
        return '<div style="display:flex;align-items:center;gap:24px">' +
          '<div style="position:relative;width:120px;height:120px">' + donut +
            '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
              '<div style="font-size:28px;font-weight:800;color:' + textPrimary + '">' + avgRisk + '</div>' +
              '<div style="font-size:10px;color:' + textMuted + ';font-weight:600">AVG RISK</div>' +
            '</div>' +
          '</div>' +
          '<div style="flex:1">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
              '<div style="width:10px;height:10px;border-radius:3px;background:' + accentRed + '"></div>' +
              '<span style="font-size:12px;color:' + textSecond + '">High (80+)</span>' +
              '<span style="font-size:14px;font-weight:700;color:' + accentRed + ';margin-left:auto">' + riskHigh.length + '</span></div>' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
              '<div style="width:10px;height:10px;border-radius:3px;background:' + accentAmber + '"></div>' +
              '<span style="font-size:12px;color:' + textSecond + '">Medium (50-79)</span>' +
              '<span style="font-size:14px;font-weight:700;color:' + accentAmber + ';margin-left:auto">' + riskMed.length + '</span></div>' +
            '<div style="display:flex;align-items:center;gap:8px">' +
              '<div style="width:10px;height:10px;border-radius:3px;background:' + accentGreen + '"></div>' +
              '<span style="font-size:12px;color:' + textSecond + '">Low (&lt;50)</span>' +
              '<span style="font-size:14px;font-weight:700;color:' + accentGreen + ';margin-left:auto">' + riskLow.length + '</span></div>' +
          '</div>' +
        '</div>';
      }

      // --- Savings Breakdown ---
      function savingsBreakdown() {
        var totalSavings = deleteCost + archiveCost;
        var delPct = totalSavings ? Math.round(deleteCost / totalSavings * 100) : 0;
        var archPct = 100 - delPct;
        return '<div style="margin-bottom:16px">' +
          '<div style="display:flex;border-radius:8px;overflow:hidden;height:24px;margin-bottom:12px">' +
            '<div style="width:' + delPct + '%;background:' + accentRed + ';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff">' + (delPct > 15 ? delPct + '%' : '') + '</div>' +
            '<div style="width:' + archPct + '%;background:' + accentPurple + ';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff">' + (archPct > 15 ? archPct + '%' : '') + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:20px">' +
            '<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:' + textSecond + '">' +
              '<div style="width:8px;height:8px;border-radius:2px;background:' + accentRed + '"></div>' +
              'Delete: ' + fmtMoney(deleteCost) + '/mo (' + deletes.length + ' tables, ' + fmtTB(deleteSize) + ')' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:' + textSecond + '">' +
              '<div style="width:8px;height:8px;border-radius:2px;background:' + accentPurple + '"></div>' +
              'Archive: ' + fmtMoney(archiveCost) + '/mo (' + archives.length + ' tables, ' + fmtTB(archiveSize) + ')' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:12px;margin-top:16px">' +
          '<div style="flex:1;background:' + accentGreen + '10;border:1px solid ' + accentGreen + '25;border-radius:10px;padding:14px;text-align:center">' +
            '<div style="font-size:10px;font-weight:700;color:' + accentGreen + ';letter-spacing:1px;margin-bottom:4px">MONTHLY SAVINGS</div>' +
            '<div style="font-size:24px;font-weight:800;color:' + accentGreen + '">' + fmtMoney(totalSavings) + '</div>' +
          '</div>' +
          '<div style="flex:1;background:' + accentGreen + '10;border:1px solid ' + accentGreen + '25;border-radius:10px;padding:14px;text-align:center">' +
            '<div style="font-size:10px;font-weight:700;color:' + accentGreen + ';letter-spacing:1px;margin-bottom:4px">ANNUAL SAVINGS</div>' +
            '<div style="font-size:24px;font-weight:800;color:' + accentGreen + '">' + fmtMoney(totalSavings * 12) + '</div>' +
          '</div>' +
          '<div style="flex:1;background:' + accentBlue + '10;border:1px solid ' + accentBlue + '25;border-radius:10px;padding:14px;text-align:center">' +
            '<div style="font-size:10px;font-weight:700;color:' + accentBlue + ';letter-spacing:1px;margin-bottom:4px">STORAGE FREED</div>' +
            '<div style="font-size:24px;font-weight:800;color:' + accentBlue + '">' + fmtTB(deleteSize + archiveSize) + '</div>' +
          '</div>' +
        '</div>';
      }

      // --- Detail Table (Tab) ---
      function detailTable() {
        var sorted = rows.slice().sort(function(a, b) { return b.cost - a.cost; });
        var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
        h += '<thead><tr style="border-bottom:2px solid ' + dividerColor + '">';
        ["Schema","Table","Size (GB)","Cost/mo","Status","Risk","Classification","Action"].forEach(function(c) {
          h += '<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:' + textMuted + ';letter-spacing:0.8px;text-transform:uppercase">' + c + '</th>';
        });
        h += '</tr></thead><tbody>';
        var schemaC = { prod: accentRed, stg: accentAmber, test: accentBlue };
        var actionC = { Delete: accentRed, Archive: accentPurple };
        sorted.forEach(function(r) {
          var sc = schemaC[r.schema] || "#475569";
          var ac = actionC[r.action] || textMuted;
          var rc = r.risk >= 80 ? accentRed : r.risk >= 50 ? accentAmber : accentGreen;
          h += '<tr style="border-bottom:1px solid ' + dividerColor + '">' +
            '<td style="padding:8px 12px"><span style="padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;background:' + sc + '15;color:' + sc + '">' + r.schema.toUpperCase() + '</span></td>' +
            '<td style="padding:8px 12px;font-family:monospace;font-weight:500;color:' + textPrimary + '">' + r.name + '</td>' +
            '<td style="padding:8px 12px;color:' + textSecond + ';font-variant-numeric:tabular-nums">' + fmt(r.size) + '</td>' +
            '<td style="padding:8px 12px;color:#fbbf24;font-weight:600">' + fmtMoney(r.cost) + '</td>' +
            '<td style="padding:8px 12px;font-size:11px;color:' + textSecond + '">' + r.indictment + '</td>' +
            '<td style="padding:8px 12px"><div style="display:flex;align-items:center;gap:6px">' + miniBar(r.risk, 100, rc, "50px") + '<span style="font-size:11px;font-weight:600;color:' + rc + '">' + r.risk + '</span></div></td>' +
            '<td style="padding:8px 12px;font-size:11px;color:' + textSecond + '">' + r.classif + '</td>' +
            '<td style="padding:8px 12px"><span style="padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;background:' + ac + '15;color:' + ac + '">' + r.action.toUpperCase() + '</span></td>' +
          '</tr>';
        });
        h += '</tbody></table></div>';
        return h;
      }

      // === MAIN LAYOUT ===
      var html = '<div style="background:' + bg + ';color:' + textPrimary + ';padding:28px 24px;max-width:1400px;margin:0 auto">';

      // Header
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px">' +
        '<div>' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' +
            '<div style="width:10px;height:10px;border-radius:50%;background:' + accentAmber + ';box-shadow:0 0 12px ' + accentAmber + '80"></div>' +
            '<h1 style="font-size:24px;font-weight:800;margin:0;color:' + textPrimary + '">Data Dyson</h1>' +
            '<span style="font-size:11px;padding:3px 8px;border-radius:5px;background:' + accentBlue + '15;color:' + accentBlue + ';font-weight:700">KPI DASHBOARD</span>' +
          '</div>' +
          '<p style="font-size:13px;color:' + textMuted + ';margin:0">Table health analysis • ' + total + ' tables scanned • ' + actionableRate + '% actionable</p>' +
        '</div>' +
        '<div style="display:flex;gap:4px;background:' + cardBg + ';padding:4px;border-radius:10px;border:1px solid ' + cardBorder + '">' +
          tabBtn("overview", "Overview") + tabBtn("details", "Table Details") +
        '</div>' +
      '</div>';

      if (activeTab === "overview") {
        // KPI Row
        html += '<div style="display:flex;gap:14px;margin-bottom:24px;flex-wrap:wrap">' +
          kpiCard("🔍", "Tables Scanned", fmt(total), "Across " + schemas.length + " schemas", accentBlue) +
          kpiCard("🗑️", "Marked Delete", fmt(deletes.length), pct(deletes.length, total) + "% of total • " + fmtTB(deleteSize), accentRed) +
          kpiCard("📦", "Marked Archive", fmt(archives.length), pct(archives.length, total) + "% of total • " + fmtTB(archiveSize), accentPurple) +
          kpiCard("✅", "Retained", fmt(keeps.length), pct(keeps.length, total) + "% of total", accentGreen) +
          kpiCard("💰", "Total Savings", fmtMoney(savingsCost) + '<span style="font-size:16px;font-weight:400;color:' + textMuted + '">/mo</span>', fmtMoney(savingsCost * 12) + " annually", accentGreen) +
        '</div>';

        // Middle row: Funnel + Risk + Savings
        html += '<div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap">';

        // Action Funnel
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:1.2;min-width:340px">' +
          sectionTitle("Action Funnel") + actionFunnel() + '</div>';

        // Risk Distribution
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:0.8;min-width:280px">' +
          sectionTitle("Risk Distribution") + riskDistribution() + '</div>';

        html += '</div>';

        // Savings Breakdown
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';margin-bottom:24px">' +
          sectionTitle("Cost Savings Breakdown") + savingsBreakdown() + '</div>';

        // Schema + Classification
        html += '<div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap">';

        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:1.4;min-width:400px">' +
          sectionTitle("Schema Breakdown") + schemaBreakdown() + '</div>';

        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:0.6;min-width:280px">' +
          sectionTitle("Classification Distribution") + classifDistribution() + '</div>';

        html += '</div>';

        // Top Tables
        html += '<div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">' +
          topTablesCard("Top 5 Costliest Tables", topCost, "cost", function(r) { return r.action === "Delete" ? accentRed : r.action === "Archive" ? accentPurple : accentAmber; }) +
          topTablesCard("Top 5 Largest Tables", topSize, "size", function(r) { return r.risk >= 80 ? accentRed : r.risk >= 50 ? accentAmber : accentBlue; }) +
        '</div>';

      } else {
        // Details tab
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + '">' +
          sectionTitle("All Suspect Tables (sorted by cost)") + detailTable() + '</div>';
      }

      html += '</div>';

      self._container.innerHTML = html;

      // Tab events
      var tabBtns = self._container.querySelectorAll("[data-tab]");
      for (var i = 0; i < tabBtns.length; i++) {
        (function(btn) {
          btn.addEventListener("click", function() {
            activeTab = btn.getAttribute("data-tab");
            render();
          });
        })(tabBtns[i]);
      }
    }

    render();
    done();
  },
});

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

    // --- Helper: is this an "approved to delete" action ---
    function isApprovedDelete(action) {
      var a = action.toLowerCase();
      return a === "delete" || a === "approved to delete";
    }

    // --- KPI Computation ---
    var total = rows.length;
    var archived = rows.filter(function(r) { return r.action === "Archive"; });
    var approvedDel = rows.filter(function(r) { return isApprovedDelete(r.action); });
    var warnings = rows.filter(function(r) { return r.action === "Warning"; });
    var doNotDelete = rows.filter(function(r) { return r.action === "Do Not Delete"; });

    var candidates = rows.filter(function(r) { return r.action !== "Do Not Delete"; });

    var totalSize = 0, totalCost = 0, totalRisk = 0;
    var archivedCost = 0, archivedSize = 0;
    var approvedCost = 0, approvedSize = 0;
    var warningCost = 0, warningSize = 0;
    var candidateCost = 0, candidateSize = 0;
    for (var i = 0; i < rows.length; i++) { totalSize += rows[i].size; totalCost += rows[i].cost; totalRisk += rows[i].risk; }
    for (var i = 0; i < archived.length; i++) { archivedCost += archived[i].cost; archivedSize += archived[i].size; }
    for (var i = 0; i < approvedDel.length; i++) { approvedCost += approvedDel[i].cost; approvedSize += approvedDel[i].size; }
    for (var i = 0; i < warnings.length; i++) { warningCost += warnings[i].cost; warningSize += warnings[i].size; }
    for (var i = 0; i < candidates.length; i++) { candidateCost += candidates[i].cost; candidateSize += candidates[i].size; }

    var archiveRate = candidates.length ? Math.round(archived.length / candidates.length * 100) : 0;
    var savingsRemaining = approvedCost + warningCost;

    // Risk buckets
    var riskHigh = rows.filter(function(r) { return r.risk >= 80; });
    var riskMed = rows.filter(function(r) { return r.risk >= 50 && r.risk < 80; });
    var riskLow = rows.filter(function(r) { return r.risk < 50; });
    var avgRisk = total ? Math.round(totalRisk / total) : 0;

    // Schema distribution
    var schemaMap = {};
    rows.forEach(function(r) {
      if (!schemaMap[r.schema]) schemaMap[r.schema] = { count: 0, size: 0, cost: 0, archived: 0, archivedCost: 0, approved: 0, warn: 0, keep: 0, pendingCost: 0 };
      var s = schemaMap[r.schema];
      s.count++; s.size += r.size; s.cost += r.cost;
      if (r.action === "Archive") { s.archived++; s.archivedCost += r.cost; }
      else if (isApprovedDelete(r.action)) { s.approved++; s.pendingCost += r.cost; }
      else if (r.action === "Warning") { s.warn++; s.pendingCost += r.cost; }
      else s.keep++;
    });
    var schemas = Object.keys(schemaMap).sort(function(a, b) { return schemaMap[b].cost - schemaMap[a].cost; });

    // Schema colors
    var schemaColors = { prod: "#ef4444", stg: "#f59e0b", test: "#3b82f6", dev: "#a855f7", raw: "#06b6d4", analytics: "#f472b6" };
    var defaultSchemaClrs = ["#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];
    var schemaClrIdx = 0;
    schemas.forEach(function(s) {
      if (!schemaColors[s]) { schemaColors[s] = defaultSchemaClrs[schemaClrIdx % defaultSchemaClrs.length]; schemaClrIdx++; }
    });

    // Top tables
    var pendingTables = rows.filter(function(r) { return r.action !== "Archive" && r.action !== "Do Not Delete"; });
    var topOpportunity = pendingTables.slice().sort(function(a, b) { return b.cost - a.cost; }).slice(0, 7);
    var topArchived = archived.slice().sort(function(a, b) { return b.cost - a.cost; }).slice(0, 7);

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
      var accentOrange= "#f97316";
      var accentEmerald= "#10b981";
      var barTrackBg  = isDark ? "#1e293b" : "#e2e8f0";
      var dividerColor= isDark ? "rgba(148,163,184,0.08)" : "rgba(0,0,0,0.06)";

      var actionColorMap = { "Archive": accentEmerald, "Approved to Delete": accentRed, "Delete": accentRed, "Warning": accentOrange, "Do Not Delete": accentBlue };

      function fmt(n) { return n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }
      function fmtMoney(n) { return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }
      function fmtTB(n) { return (n / 1000).toFixed(1) + " TB"; }
      function pct(n, d) { return d ? Math.round(n / d * 100) : 0; }

      function miniBar(val, max, color, w) {
        var pw = max ? Math.min(val / max * 100, 100) : 0;
        return '<div style="width:' + (w || '100%') + ';height:6px;background:' + barTrackBg + ';border-radius:3px;overflow:hidden">' +
          '<div style="width:' + pw + '%;height:100%;background:' + color + ';border-radius:3px"></div></div>';
      }

      function donutSVG(slices, size, thickness) {
        var r = (size - thickness) / 2, cx = size / 2, cy = size / 2;
        var tot = 0; slices.forEach(function(s) { tot += s.value; });
        if (tot === 0) return '<svg width="' + size + '" height="' + size + '"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + barTrackBg + '" stroke-width="' + thickness + '"/></svg>';
        var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">';
        var cum = -90;
        slices.forEach(function(s) {
          if (s.value === 0) return;
          var a = (s.value / tot) * 360, s1 = cum * Math.PI / 180, s2 = (cum + a) * Math.PI / 180;
          var x1 = cx + r * Math.cos(s1), y1 = cy + r * Math.sin(s1);
          var x2 = cx + r * Math.cos(s2), y2 = cy + r * Math.sin(s2);
          svg += '<path d="M ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + (a > 180 ? 1 : 0) + ' 1 ' + x2 + ' ' + y2 + '" fill="none" stroke="' + s.color + '" stroke-width="' + thickness + '" stroke-linecap="round"/>';
          cum += a;
        });
        svg += '</svg>';
        return svg;
      }

      function sectionTitle(text, icon) {
        return '<div style="font-size:13px;font-weight:700;color:' + textSecond + ';letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:8px">' +
          (icon ? '<span style="font-size:15px">' + icon + '</span>' : '<div style="width:3px;height:16px;border-radius:2px;background:' + accentEmerald + '"></div>') + text + '</div>';
      }

      function tabBtn(id, label) {
        var act = activeTab === id;
        return '<button data-tab="' + id + '" style="padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;background:' + (act ? accentEmerald : "transparent") + ';color:' + (act ? "#fff" : textSecond) + ';border:none">' + label + '</button>';
      }

      // === HERO ===
      function archiveHero() {
        var barW = Math.max(archiveRate, 2);
        return '<div style="background:linear-gradient(135deg,' + (isDark ? '#064e3b' : '#ecfdf5') + ',' + (isDark ? '#0f172a' : '#f0fdf4') + ');border-radius:16px;padding:28px;border:1px solid ' + accentEmerald + '30;margin-bottom:24px;position:relative;overflow:hidden">' +
          '<div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:' + accentEmerald + ';opacity:0.05"></div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px">' +
            '<div style="flex:1;min-width:300px">' +
              '<div style="font-size:12px;font-weight:700;color:' + accentEmerald + ';letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">📦 Archive Progress</div>' +
              '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px">' +
                '<span style="font-size:48px;font-weight:900;color:' + accentEmerald + ';line-height:1">' + archived.length + '</span>' +
                '<span style="font-size:20px;color:' + textMuted + ';font-weight:600">/ ' + candidates.length + ' candidates archived</span>' +
              '</div>' +
              '<div style="height:14px;background:' + barTrackBg + ';border-radius:7px;overflow:hidden;margin-bottom:8px">' +
                '<div style="width:' + barW + '%;height:100%;background:linear-gradient(90deg,' + accentEmerald + ',' + accentGreen + ');border-radius:7px"></div>' +
              '</div>' +
              '<div style="display:flex;justify-content:space-between;font-size:12px;color:' + textSecond + '">' +
                '<span>' + archiveRate + '% complete</span>' +
                '<span>' + (candidates.length - archived.length) + ' tables remaining</span>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex;gap:16px;flex-wrap:wrap">' +
              '<div style="text-align:center;min-width:120px">' +
                '<div style="font-size:10px;font-weight:700;color:' + accentEmerald + ';letter-spacing:1px;margin-bottom:4px">ARCHIVED SAVINGS</div>' +
                '<div style="font-size:30px;font-weight:900;color:' + accentEmerald + '">' + fmtMoney(archivedCost) + '</div>' +
                '<div style="font-size:11px;color:' + textMuted + '">per month</div>' +
              '</div>' +
              '<div style="width:1px;background:' + accentEmerald + '20;margin:4px 0"></div>' +
              '<div style="text-align:center;min-width:120px">' +
                '<div style="font-size:10px;font-weight:700;color:' + accentAmber + ';letter-spacing:1px;margin-bottom:4px">REMAINING POTENTIAL</div>' +
                '<div style="font-size:30px;font-weight:900;color:' + accentAmber + '">' + fmtMoney(savingsRemaining) + '</div>' +
                '<div style="font-size:11px;color:' + textMuted + '">per month</div>' +
              '</div>' +
              '<div style="width:1px;background:' + accentEmerald + '20;margin:4px 0"></div>' +
              '<div style="text-align:center;min-width:120px">' +
                '<div style="font-size:10px;font-weight:700;color:' + textMuted + ';letter-spacing:1px;margin-bottom:4px">ANNUAL PROJECTION</div>' +
                '<div style="font-size:30px;font-weight:900;color:' + textPrimary + '">' + fmtMoney(archivedCost * 12) + '</div>' +
                '<div style="font-size:11px;color:' + textMuted + '">if sustained</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }

      // === KPI Row ===
      function kpiRow() {
        function kpi(icon, label, value, sub, accent) {
          return '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:1;min-width:180px;border-top:3px solid ' + accent + '">' +
            '<div style="font-size:11px;color:' + textMuted + ';font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">' + icon + ' ' + label + '</div>' +
            '<div style="font-size:28px;font-weight:800;color:' + textPrimary + ';line-height:1;margin-bottom:4px">' + value + '</div>' +
            (sub ? '<div style="font-size:11px;color:' + textSecond + ';margin-top:6px">' + sub + '</div>' : '') +
          '</div>';
        }
        return '<div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap">' +
          kpi("🔍", "Tables Scanned", fmt(total), schemas.length + " schemas", accentBlue) +
          kpi("📦", "Archived", fmt(archived.length), fmtTB(archivedSize) + " freed • " + fmtMoney(archivedCost) + "/mo saved", accentEmerald) +
          kpi("⚠️", "Pending Warning", fmt(warnings.length), fmtMoney(warningCost) + "/mo at stake", accentOrange) +
          kpi("🗑️", "Approved to Delete", fmt(approvedDel.length), fmtMoney(approvedCost) + "/mo recoverable", accentRed) +
        '</div>';
      }

      // === Pipeline ===
      function actionPipeline() {
        var stages = [
          { label: "Warning", desc: "Awaiting user review", count: warnings.length, cost: warningCost, size: warningSize, color: accentOrange, icon: "⚠️" },
          { label: "Approved to Delete", desc: "User confirmed deletion", count: approvedDel.length, cost: approvedCost, size: approvedSize, color: accentRed, icon: "🗑️" },
          { label: "Archived", desc: "Moved to archive", count: archived.length, cost: archivedCost, size: archivedSize, color: accentEmerald, icon: "📦" },
        ];
        var h = '';
        var maxCount = Math.max(warnings.length, approvedDel.length, archived.length, 1);
        for (var i = 0; i < stages.length; i++) {
          var s = stages[i];
          var w = Math.max(s.count / maxCount * 100, 8);
          var isLast = i === stages.length - 1;
          h += '<div style="display:flex;align-items:stretch;gap:14px;margin-bottom:' + (isLast ? '0' : '6') + 'px">' +
            '<div style="width:160px;padding:14px 0;text-align:right">' +
              '<div style="font-size:12px;font-weight:700;color:' + s.color + '">' + s.icon + ' ' + s.label + '</div>' +
              '<div style="font-size:10px;color:' + textMuted + ';margin-top:2px">' + s.desc + '</div>' +
            '</div>' +
            '<div style="flex:1;display:flex;align-items:center">' +
              '<div style="width:' + w + '%;min-width:60px;height:44px;background:' + s.color + '15;border:1px solid ' + s.color + '30;border-radius:10px;display:flex;align-items:center;padding:0 16px;gap:12px">' +
                '<span style="font-size:20px;font-weight:900;color:' + s.color + '">' + s.count + '</span>' +
                '<div style="width:1px;height:20px;background:' + s.color + '30"></div>' +
                '<span style="font-size:12px;color:' + textSecond + '">' + fmtMoney(s.cost) + '/mo</span>' +
                '<span style="font-size:11px;color:' + textMuted + '">•</span>' +
                '<span style="font-size:12px;color:' + textSecond + '">' + fmtTB(s.size) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>';
          if (!isLast) {
            h += '<div style="margin-left:167px;padding-left:4px"><div style="width:2px;height:12px;background:' + textMuted + ';margin-left:20px;border-radius:1px;opacity:0.3"></div></div>';
          }
        }
        h += '<div style="margin-top:14px;padding-top:14px;border-top:1px dashed ' + dividerColor + ';display:flex;align-items:center;gap:14px">' +
          '<div style="width:160px;text-align:right;font-size:12px;font-weight:700;color:' + accentBlue + '">🛡️ Do Not Delete</div>' +
          '<div style="padding:8px 16px;background:' + accentBlue + '10;border:1px solid ' + accentBlue + '25;border-radius:8px;font-size:13px;color:' + textSecond + '">' +
            '<span style="font-weight:800;color:' + accentBlue + '">' + doNotDelete.length + '</span> tables excluded from archiving' +
          '</div>' +
        '</div>';
        return h;
      }

      // === Schema Distribution Visual ===
      function schemaDistribution() {
        var totalArchSav = archivedCost || 0.001;
        var metrics = [
          { label: "Tables", key: "count", fmtVal: function(v) { return fmt(v); }, total: total },
          { label: "Cost/mo", key: "cost", fmtVal: function(v) { return fmtMoney(v); }, total: totalCost },
          { label: "Savings from Archiving", key: "archivedCost", fmtVal: function(v) { return fmtMoney(v); }, total: totalArchSav },
        ];
        var h = '';
        for (var mi = 0; mi < metrics.length; mi++) {
          var m = metrics[mi];
          h += '<div style="margin-bottom:' + (mi < metrics.length - 1 ? '14' : '0') + 'px">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
              '<span style="font-size:11px;font-weight:700;color:' + textMuted + ';letter-spacing:0.8px;text-transform:uppercase">' + m.label + '</span>' +
              '<span style="font-size:11px;color:' + textMuted + '">' + m.fmtVal(m.total) + ' total</span>' +
            '</div>' +
            '<div style="display:flex;border-radius:8px;overflow:hidden;height:32px">';
          for (var si = 0; si < schemas.length; si++) {
            var s = schemas[si], val = schemaMap[s][m.key];
            var p = m.total ? (val / m.total * 100) : 0;
            var w = Math.max(p, 1.5);
            var sc = schemaColors[s] || "#475569";
            h += '<div style="width:' + w + '%;background:' + sc + ';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;border-right:2px solid ' + bg + ';overflow:hidden;white-space:nowrap;padding:0 4px">' +
              (p > 12 ? s + ' ' + p.toFixed(0) + '%' : '') + '</div>';
          }
          h += '</div></div>';
        }
                  h += '<div style="display:flex;gap:16px;margin-top:14px;flex-wrap:wrap">';
        for (var si = 0; si < schemas.length; si++) {
          var s = schemas[si], d = schemaMap[s], sc = schemaColors[s] || "#475569";
          h += '<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:' + textSecond + '">' +
            '<div style="width:10px;height:10px;border-radius:3px;background:' + sc + '"></div>' +
            '<span style="font-weight:600">' + s.toUpperCase() + '</span>' +
            '<span style="color:' + textMuted + '">' + d.count + ' tables • ' + fmtMoney(d.cost) + '/mo • ' + fmtMoney(d.archivedCost) + ' saved</span>' +
          '</div>';
        }
        h += '</div>';
        return h;
      }

      // === Cost Savings Breakdown by Schema ===
      function costSavingsBreakdown() {
        var totalArchSavings = archivedCost;
        var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">';
        h += '<thead><tr style="border-bottom:2px solid ' + dividerColor + '">';
        ["Schema", "Total Cost/mo", "% of Total Cost", "Archived Savings/mo", "% of Total Savings", "Savings Rate"].forEach(function(c) {
          h += '<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:' + textMuted + ';letter-spacing:0.8px;text-transform:uppercase;white-space:nowrap">' + c + '</th>';
        });
        h += '</tr></thead><tbody>';
        schemas.forEach(function(s) {
          var d = schemaMap[s];
          var sc = schemaColors[s] || "#475569";
          var costPct = totalCost ? (d.cost / totalCost * 100) : 0;
          var savPct = totalArchSavings ? (d.archivedCost / totalArchSavings * 100) : 0;
          var savRate = d.cost ? Math.round(d.archivedCost / d.cost * 100) : 0;
          h += '<tr style="border-bottom:1px solid ' + dividerColor + '">' +
            '<td style="padding:10px 12px"><span style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;background:' + sc + '18;color:' + sc + ';border:1px solid ' + sc + '30">' + s.toUpperCase() + '</span></td>' +
            '<td style="padding:10px 12px;color:#fbbf24;font-weight:600">' + fmtMoney(d.cost) + '</td>' +
            '<td style="padding:10px 12px"><div style="display:flex;align-items:center;gap:8px">' +
              miniBar(costPct, 100, sc, "60px") +
              '<span style="font-size:12px;font-weight:600;color:' + textSecond + '">' + costPct.toFixed(1) + '%</span></div></td>' +
            '<td style="padding:10px 12px;color:' + accentEmerald + ';font-weight:600">' + fmtMoney(d.archivedCost) + '</td>' +
            '<td style="padding:10px 12px"><div style="display:flex;align-items:center;gap:8px">' +
              miniBar(savPct, 100, accentEmerald, "60px") +
              '<span style="font-size:12px;font-weight:600;color:' + accentEmerald + '">' + savPct.toFixed(1) + '%</span></div></td>' +
            '<td style="padding:10px 12px"><div style="display:flex;align-items:center;gap:8px">' +
              miniBar(savRate, 100, savRate >= 50 ? accentEmerald : savRate >= 25 ? accentAmber : accentOrange, "60px") +
              '<span style="font-size:12px;font-weight:700;color:' + (savRate >= 50 ? accentEmerald : savRate >= 25 ? accentAmber : accentOrange) + '">' + savRate + '%</span></div></td>' +
          '</tr>';
        });
        h += '</tbody></table></div>';
        return h;
      }

      // === Schema Archive Progress ===
      function schemaArchiveProgress() {
        var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">';
        h += '<thead><tr style="border-bottom:2px solid ' + dividerColor + '">';
        ["Schema","Tables","Archived","Pending","Do Not Delete","Archive Rate"].forEach(function(c) {
          h += '<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:' + textMuted + ';letter-spacing:0.8px;text-transform:uppercase;white-space:nowrap">' + c + '</th>';
        });
        h += '</tr></thead><tbody>';
        schemas.forEach(function(s) {
          var d = schemaMap[s];
          var sc = schemaColors[s] || "#475569";
          var archivable = d.count - d.keep;
          var rate = archivable ? Math.round(d.archived / archivable * 100) : 0;
          var pending = d.approved + d.warn;
          h += '<tr style="border-bottom:1px solid ' + dividerColor + '">' +
            '<td style="padding:10px 12px"><span style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;background:' + sc + '18;color:' + sc + ';border:1px solid ' + sc + '30">' + s.toUpperCase() + '</span></td>' +
            '<td style="padding:10px 12px;font-weight:600;color:' + textPrimary + '">' + d.count + '</td>' +
            '<td style="padding:10px 12px;color:' + accentEmerald + ';font-weight:700">' + d.archived + '</td>' +
            '<td style="padding:10px 12px;color:' + accentOrange + ';font-weight:600">' + pending + '</td>' +
            '<td style="padding:10px 12px;color:' + accentBlue + ';font-weight:600">' + d.keep + '</td>' +
            '<td style="padding:10px 12px"><div style="display:flex;align-items:center;gap:8px">' +
              miniBar(rate, 100, rate >= 70 ? accentEmerald : rate >= 40 ? accentAmber : accentOrange, "80px") +
              '<span style="font-size:12px;font-weight:700;color:' + (rate >= 70 ? accentEmerald : rate >= 40 ? accentAmber : accentOrange) + '">' + rate + '%</span>' +
            '</div></td>' +
          '</tr>';
        });
        h += '</tbody></table></div>';
        return h;
      }

      // === Risk Distribution ===
      function riskSection() {
        var slices = [
          { value: riskHigh.length, color: accentRed },
          { value: riskMed.length, color: accentAmber },
          { value: riskLow.length, color: accentGreen },
        ];
        var donut = donutSVG(slices, 110, 13);
        return '<div style="display:flex;align-items:center;gap:24px">' +
          '<div style="position:relative;width:110px;height:110px">' + donut +
            '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
              '<div style="font-size:26px;font-weight:800;color:' + textPrimary + '">' + avgRisk + '</div>' +
              '<div style="font-size:9px;color:' + textMuted + ';font-weight:700">AVG RISK</div>' +
            '</div>' +
          '</div>' +
          '<div style="flex:1">' +
            [{ label: "High Risk (80+)", count: riskHigh.length, color: accentRed },
             { label: "Medium (50-79)", count: riskMed.length, color: accentAmber },
             { label: "Low (&lt;50)", count: riskLow.length, color: accentGreen }]
            .map(function(item) {
              return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
                '<div style="width:10px;height:10px;border-radius:3px;background:' + item.color + '"></div>' +
                '<span style="font-size:12px;color:' + textSecond + ';flex:1">' + item.label + '</span>' +
                '<span style="font-size:14px;font-weight:700;color:' + item.color + '">' + item.count + '</span></div>';
            }).join('') +
          '</div>' +
        '</div>';
      }

      // === Top Tables List ===
      function topTablesList(title, subtitle, items, accentColor) {
        var maxCost = items.length ? items[0].cost : 1;
        var h = '<div style="font-size:12px;font-weight:700;color:' + textMuted + ';letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">' + title + '</div>';
        h += '<div style="font-size:11px;color:' + textMuted + ';margin-bottom:14px">' + subtitle + '</div>';
        if (!items.length) { h += '<div style="padding:20px;text-align:center;color:' + textMuted + ';font-size:12px">No tables</div>'; return h; }
        items.forEach(function(r, idx) {
          var ac = actionColorMap[r.action] || textMuted;
          h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
            '<div style="width:18px;font-size:11px;font-weight:700;color:' + textMuted + '">' + (idx + 1) + '</div>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">' +
                '<span style="font-size:11px;font-weight:600;color:' + textPrimary + ';font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + r.name + '</span>' +
                '<span style="padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;background:' + ac + '15;color:' + ac + ';white-space:nowrap;flex-shrink:0">' + r.action + '</span>' +
              '</div>' +
              miniBar(r.cost, maxCost, accentColor) +
            '</div>' +
            '<div style="font-size:12px;font-weight:700;color:' + accentColor + ';min-width:65px;text-align:right">' + fmtMoney(r.cost) + '/mo</div>' +
          '</div>';
        });
        return h;
      }

      // === Detail Table ===
      function detailTable() {
        var sorted = rows.slice().sort(function(a, b) { return b.cost - a.cost; });
        var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
        h += '<thead><tr style="border-bottom:2px solid ' + dividerColor + '">';
        ["Schema","Table","Size (GB)","Cost/mo","Status","Risk","Action"].forEach(function(c) {
          h += '<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:' + textMuted + ';letter-spacing:0.8px;text-transform:uppercase">' + c + '</th>';
        });
        h += '</tr></thead><tbody>';
        sorted.forEach(function(r) {
          var sc = schemaColors[r.schema] || "#475569";
          var ac = actionColorMap[r.action] || textMuted;
          var rc = r.risk >= 80 ? accentRed : r.risk >= 50 ? accentAmber : accentGreen;
          h += '<tr style="border-bottom:1px solid ' + dividerColor + '">' +
            '<td style="padding:8px 12px"><span style="padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;background:' + sc + '15;color:' + sc + '">' + r.schema.toUpperCase() + '</span></td>' +
            '<td style="padding:8px 12px;font-family:monospace;font-weight:500;color:' + textPrimary + '">' + r.name + '</td>' +
            '<td style="padding:8px 12px;color:' + textSecond + ';font-variant-numeric:tabular-nums">' + fmt(r.size) + '</td>' +
            '<td style="padding:8px 12px;color:#fbbf24;font-weight:600">' + fmtMoney(r.cost) + '</td>' +
            '<td style="padding:8px 12px;font-size:11px;color:' + textSecond + '">' + r.indictment + '</td>' +
            '<td style="padding:8px 12px"><div style="display:flex;align-items:center;gap:6px">' + miniBar(r.risk, 100, rc, "50px") + '<span style="font-size:11px;font-weight:600;color:' + rc + '">' + r.risk + '</span></div></td>' +
            '<td style="padding:8px 12px"><span style="padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;background:' + ac + '15;color:' + ac + ';white-space:nowrap">' + r.action + '</span></td>' +
          '</tr>';
        });
        h += '</tbody></table></div>';
        return h;
      }

      // === BUILD ===
      var html = '<div style="background:' + bg + ';color:' + textPrimary + ';padding:28px 24px;max-width:1400px;margin:0 auto">';

      // Header
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">' +
        '<div>' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">' +
            '<div style="width:10px;height:10px;border-radius:50%;background:' + accentEmerald + ';box-shadow:0 0 12px ' + accentEmerald + '80"></div>' +
            '<h1 style="font-size:24px;font-weight:800;margin:0;color:' + textPrimary + '">Data Dyson</h1>' +
            '<span style="font-size:11px;padding:3px 8px;border-radius:5px;background:' + accentEmerald + '15;color:' + accentEmerald + ';font-weight:700">ARCHIVE DASHBOARD</span>' +
          '</div>' +
          '<p style="font-size:13px;color:' + textMuted + ';margin:0">Maximizing cost savings through table archival • ' + total + ' tables analyzed</p>' +
        '</div>' +
        '<div style="display:flex;gap:4px;background:' + cardBg + ';padding:4px;border-radius:10px;border:1px solid ' + cardBorder + '">' +
          tabBtn("overview", "Overview") + tabBtn("details", "All Tables") +
        '</div>' +
      '</div>';

      if (activeTab === "overview") {
        html += archiveHero();
        html += kpiRow();

        // Pipeline + Risk
        html += '<div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap">';
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:1.3;min-width:400px">' +
          sectionTitle("Archival Pipeline", "🔄") + actionPipeline() + '</div>';
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:0.7;min-width:260px">' +
          sectionTitle("Risk Distribution", "📊") + riskSection() + '</div>';
        html += '</div>';

        // Schema Distribution
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';margin-bottom:24px">' +
          sectionTitle("Schema Distribution", "🗂️") + schemaDistribution() + '</div>';

        // Cost Savings Breakdown by Schema
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';margin-bottom:24px">' +
          sectionTitle("Cost Savings Breakdown by Schema", "💰") + costSavingsBreakdown() + '</div>';

        // Schema Archive Progress
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';margin-bottom:24px">' +
          sectionTitle("Archive Progress by Schema", "🗄️") + schemaArchiveProgress() + '</div>';

        // Top tables
        html += '<div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">';
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:1;min-width:320px">' +
          topTablesList("🎯 Top Savings Opportunities", "Highest cost tables not yet archived", topOpportunity, accentOrange) + '</div>';
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:1;min-width:320px">' +
          topTablesList("✅ Top Archived Savings", "Highest cost savings already achieved", topArchived, accentEmerald) + '</div>';
        html += '</div>';

      } else {
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + '">' +
          sectionTitle("All Tables — Sorted by Cost", "📋") + detailTable() + '</div>';
      }

      html += '</div>';
      self._container.innerHTML = html;

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

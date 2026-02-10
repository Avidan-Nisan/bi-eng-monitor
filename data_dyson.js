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
    var all = dims.concat(meas);

    function ff(list, kw) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].toLowerCase().indexOf(kw) !== -1) return list[i];
      }
      return null;
    }

    var F = {
      schema:   ff(dims, "table_schema"),
      name:     ff(dims, "table_name"),
      size:     ff(all, "total_logical") || ff(all, "size_gib") || ff(all, "size"),
      cost:     ff(all, "monthly_cost") || ff(all, "cost_usd") || ff(all, "cost"),
      usage:    ff(all, "total_usage") || ff(all, "usage"),
      risk:     ff(all, "risk_level") || ff(all, "risk"),
      delScore: ff(all, "deletion_score") || ff(all, "del_score"),
      reason:   ff(dims, "reasoning") || ff(dims, "reason"),
      action:   ff(dims, "action"),
      owner:    ff(dims, "suggested_owner") || ff(dims, "owner"),
    };
    // Debug: log matched fields to console
    console.log("Data Dyson field mapping:", JSON.stringify(F));
    if (data.length > 0) console.log("First row keys:", Object.keys(data[0]).join(", "));

    function gv(row, key) { return row[key] && row[key].value != null ? row[key].value : ""; }
    function gn(row, key) { return row[key] && row[key].value != null ? parseFloat(row[key].value) || 0 : 0; }

    var rows = data.map(function(row) {
      return {
        schema:   F.schema   ? gv(row, F.schema)   : "",
        name:     F.name     ? gv(row, F.name)      : "",
        size:     F.size     ? gn(row, F.size)      : 0,
        cost:     F.cost     ? gn(row, F.cost)      : 0,
        usage:    F.usage    ? gn(row, F.usage)     : 0,
        risk:     F.risk     ? gv(row, F.risk)      : "",
        delScore: F.delScore ? gn(row, F.delScore)  : 0,
        reason:   F.reason   ? gv(row, F.reason)    : "",
        action:   F.action   ? gv(row, F.action)    : "",
        owner:    F.owner    ? gv(row, F.owner)     : "",
      };
    });

    // Normalize action values to handle different naming conventions
    // Your data: "Delete", "Investigate", "Keep"
    // Dashboard categories: Delete → approved to delete, Investigate → warning/pending, Keep → do not delete, Archive → archived
    function normAction(a) {
      var l = a.toLowerCase().trim();
      if (l === "delete" || l === "approved to delete") return "delete";
      if (l === "archive" || l === "archived") return "archive";
      if (l === "investigate" || l === "warning" || l === "review") return "investigate";
      if (l === "keep" || l === "do not delete") return "keep";
      return l;
    }

    var total = rows.length;
    var archived = rows.filter(function(r) { return normAction(r.action) === "archive"; });
    var approvedDel = rows.filter(function(r) { return normAction(r.action) === "delete"; });
    var warnings = rows.filter(function(r) { return normAction(r.action) === "investigate"; });
    var doNotDelete = rows.filter(function(r) { return normAction(r.action) === "keep"; });
    var candidates = rows.filter(function(r) { return normAction(r.action) !== "keep"; });

    var totalSize = 0, totalCost = 0, totalDelScore = 0, totalUsage = 0;
    var archivedCost = 0, archivedSize = 0;
    var approvedCost = 0, approvedSize = 0;
    var warningCost = 0, warningSize = 0;
    for (var i = 0; i < rows.length; i++) { totalSize += rows[i].size; totalCost += rows[i].cost; totalDelScore += rows[i].delScore; totalUsage += rows[i].usage; }
    for (var i = 0; i < archived.length; i++) { archivedCost += archived[i].cost; archivedSize += archived[i].size; }
    for (var i = 0; i < approvedDel.length; i++) { approvedCost += approvedDel[i].cost; approvedSize += approvedDel[i].size; }
    for (var i = 0; i < warnings.length; i++) { warningCost += warnings[i].cost; warningSize += warnings[i].size; }

    var archiveRate = candidates.length ? Math.round(archived.length / candidates.length * 100) : 0;
    var savingsRemaining = approvedCost + warningCost;
    var doNotDeletePct = total ? Math.round(doNotDelete.length / total * 100) : 0;

    // Risk level is a string (e.g. "High", "Medium", "Low")
    var riskHigh = rows.filter(function(r) { return r.risk.toLowerCase() === "high"; });
    var riskMed = rows.filter(function(r) { return r.risk.toLowerCase() === "medium" || r.risk.toLowerCase() === "med"; });
    var riskLow = rows.filter(function(r) { return r.risk.toLowerCase() === "low"; });
    var avgDelScore = total ? Math.round(totalDelScore / total) : 0;

    var schemaMap = {};
    rows.forEach(function(r) {
      if (!schemaMap[r.schema]) schemaMap[r.schema] = { count: 0, size: 0, cost: 0, archived: 0, archivedCost: 0, approved: 0, warn: 0, keep: 0, pendingCost: 0 };
      var s = schemaMap[r.schema];
      s.count++; s.size += r.size; s.cost += r.cost;
      var na = normAction(r.action);
      if (na === "archive") { s.archived++; s.archivedCost += r.cost; }
      else if (na === "delete") { s.approved++; s.pendingCost += r.cost; }
      else if (na === "investigate") { s.warn++; s.pendingCost += r.cost; }
      else s.keep++;
    });
    var schemas = Object.keys(schemaMap).sort(function(a, b) { return schemaMap[b].cost - schemaMap[a].cost; });

    var schemaColors = { prod: "#ef4444", stg: "#f59e0b", test: "#3b82f6", dev: "#a855f7", raw: "#06b6d4", analytics: "#f472b6" };
    var defaultSchemaClrs = ["#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];
    var schemaClrIdx = 0;
    schemas.forEach(function(s) {
      if (!schemaColors[s]) { schemaColors[s] = defaultSchemaClrs[schemaClrIdx % defaultSchemaClrs.length]; schemaClrIdx++; }
    });

    // Owner breakdown
    var ownerMap = {};
    rows.forEach(function(r) {
      var o = r.owner || "Unknown";
      if (!ownerMap[o]) ownerMap[o] = { count: 0, cost: 0, archived: 0, pending: 0 };
      ownerMap[o].count++;
      ownerMap[o].cost += r.cost;
      if (normAction(r.action) === "archive") ownerMap[o].archived++;
      else if (normAction(r.action) !== "keep") ownerMap[o].pending++;
    });
    var owners = Object.keys(ownerMap).sort(function(a, b) { return ownerMap[b].cost - ownerMap[a].cost; });

    var pendingTables = rows.filter(function(r) { var na = normAction(r.action); return na !== "archive" && na !== "keep"; });
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
      var accentOrange= "#f97316";
      var accentEmerald= "#10b981";
      var accentPurple= "#a855f7";
      var barTrackBg  = isDark ? "#1e293b" : "#e2e8f0";
      var dividerColor= isDark ? "rgba(148,163,184,0.08)" : "rgba(0,0,0,0.06)";

      var actionColorMap = { "Delete": accentRed, "Approved to Delete": accentRed, "Archive": accentEmerald, "Archived": accentEmerald, "Investigate": accentOrange, "Warning": accentOrange, "Keep": accentBlue, "Do Not Delete": accentBlue };

      var ownerNA = normAction;  // alias for use in owner section
      function getActionColor(action) {
        return actionColorMap[action] || textMuted;
      }
      var riskColorMap = { "high": accentRed, "medium": accentAmber, "med": accentAmber, "low": accentGreen };

      function fmt(n) { return n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }
      function fmtDec(n) { return n.toLocaleString(undefined, { maximumFractionDigits: 2 }); }
      function fmtMoney(n) { return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }
      function fmtMoneyDec(n) { return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 }); }
      function fmtTB(n) { return n >= 1000 ? (n / 1024).toFixed(1) + " TiB" : fmtDec(n) + " GiB"; }

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

      function riskBadge(risk) {
        var rl = risk.toLowerCase();
        var c = riskColorMap[rl] || textMuted;
        return '<span style="padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;background:' + c + '15;color:' + c + ';white-space:nowrap">' + risk + '</span>';
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
        function kpi(icon, label, value, sub, accent, extra) {
          return '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:1;min-width:180px;border-top:3px solid ' + accent + '">' +
            '<div style="font-size:11px;color:' + textMuted + ';font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">' + icon + ' ' + label + '</div>' +
            '<div style="font-size:28px;font-weight:800;color:' + textPrimary + ';line-height:1;margin-bottom:4px">' + value + '</div>' +
            (sub ? '<div style="font-size:11px;color:' + textSecond + ';margin-top:6px">' + sub + '</div>' : '') +
            (extra || '') +
          '</div>';
        }

        var dndHealth = doNotDeletePct <= 15 ? accentEmerald : doNotDeletePct <= 30 ? accentAmber : accentRed;
        var dndLabel = doNotDeletePct <= 15 ? "Model performing well" : doNotDeletePct <= 30 ? "Model needs review" : "Model accuracy concern";
        var dndExtra = '<div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:' + dndHealth + '10;border:1px solid ' + dndHealth + '25">' +
          '<div style="display:flex;align-items:center;gap:6px">' +
            '<div style="width:7px;height:7px;border-radius:50%;background:' + dndHealth + '"></div>' +
            '<span style="font-size:11px;font-weight:600;color:' + dndHealth + '">' + doNotDeletePct + '% Do Not Delete</span>' +
          '</div>' +
          '<div style="font-size:10px;color:' + textMuted + ';margin-top:3px">' + dndLabel + '</div>' +
        '</div>';

        var dsColor = avgDelScore >= 70 ? accentRed : avgDelScore >= 40 ? accentAmber : accentEmerald;
        var dsLabel = avgDelScore >= 70 ? "High deletion confidence" : avgDelScore >= 40 ? "Moderate confidence" : "Low deletion risk";
        var dsExtra = '<div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:' + dsColor + '10;border:1px solid ' + dsColor + '25">' +
          '<div style="display:flex;align-items:center;gap:6px">' +
            '<div style="width:7px;height:7px;border-radius:50%;background:' + dsColor + '"></div>' +
            '<span style="font-size:11px;font-weight:600;color:' + dsColor + '">Avg Deletion Score: ' + avgDelScore + '</span>' +
          '</div>' +
          '<div style="font-size:10px;color:' + textMuted + ';margin-top:3px">' + dsLabel + '</div>' +
        '</div>';

        return '<div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap">' +
          kpi("🔍", "Tables Scanned", fmt(total), schemas.length + " schemas • " + fmtTB(totalSize) + " total", accentBlue, dndExtra) +
          kpi("🗑️", "Approved to Delete", fmt(approvedDel.length), fmtMoney(approvedCost) + "/mo recoverable", accentRed, dsExtra) +
          kpi("📦", "Archived", fmt(archived.length), fmtTB(archivedSize) + " freed • " + fmtMoney(archivedCost) + "/mo saved", accentEmerald) +
          kpi("⚠️", "Pending Warning", fmt(warnings.length), fmtMoney(warningCost) + "/mo at stake", accentOrange) +
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

      // === Schema Distribution ===
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

      // === Schema Archive Progress ===
      function schemaArchiveProgress() {
        var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">';
        h += '<thead><tr style="border-bottom:2px solid ' + dividerColor + '">';
        ["Schema","Tables","Archived","Warning","Approved to Delete","Do Not Delete"].forEach(function(c) {
          h += '<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:' + textMuted + ';letter-spacing:0.8px;text-transform:uppercase;white-space:nowrap">' + c + '</th>';
        });
        h += '</tr></thead><tbody>';
        schemas.forEach(function(s) {
          var d = schemaMap[s];
          var sc = schemaColors[s] || "#475569";
          h += '<tr style="border-bottom:1px solid ' + dividerColor + '">' +
            '<td style="padding:10px 12px"><span style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;background:' + sc + '18;color:' + sc + ';border:1px solid ' + sc + '30">' + s.toUpperCase() + '</span></td>' +
            '<td style="padding:10px 12px;font-weight:600;color:' + textPrimary + '">' + d.count + '</td>' +
            '<td style="padding:10px 12px;color:' + accentEmerald + ';font-weight:700">' + d.archived + '</td>' +
            '<td style="padding:10px 12px;color:' + accentOrange + ';font-weight:600">' + d.warn + '</td>' +
            '<td style="padding:10px 12px;color:' + accentRed + ';font-weight:600">' + d.approved + '</td>' +
            '<td style="padding:10px 12px;color:' + accentBlue + ';font-weight:600">' + d.keep + '</td>' +
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
              '<div style="font-size:22px;font-weight:800;color:' + textPrimary + '">' + total + '</div>' +
              '<div style="font-size:9px;color:' + textMuted + ';font-weight:700">TABLES</div>' +
            '</div>' +
          '</div>' +
          '<div style="flex:1">' +
            [{ label: "High Risk", count: riskHigh.length, color: accentRed },
             { label: "Medium Risk", count: riskMed.length, color: accentAmber },
             { label: "Low Risk", count: riskLow.length, color: accentGreen }]
            .map(function(item) {
              return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
                '<div style="width:10px;height:10px;border-radius:3px;background:' + item.color + '"></div>' +
                '<span style="font-size:12px;color:' + textSecond + ';flex:1">' + item.label + '</span>' +
                '<span style="font-size:14px;font-weight:700;color:' + item.color + '">' + item.count + '</span></div>';
            }).join('') +
            '<div style="margin-top:10px;padding-top:10px;border-top:1px solid ' + dividerColor + '">' +
              '<div style="display:flex;align-items:center;justify-content:space-between">' +
                '<span style="font-size:11px;color:' + textMuted + '">Avg Deletion Score</span>' +
                '<span style="font-size:16px;font-weight:800;color:' + (avgDelScore >= 70 ? accentRed : avgDelScore >= 40 ? accentAmber : accentEmerald) + '">' + avgDelScore + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }

      // === Owner Breakdown ===
      function ownerBreakdown() {
        var maxCost = owners.length ? ownerMap[owners[0]].cost : 1;
        var h = '';
        owners.slice(0, 8).forEach(function(o) {
          var d = ownerMap[o];
          h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
            '<div style="flex:1;min-width:0">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">' +
                '<span style="font-size:12px;font-weight:600;color:' + textPrimary + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + o + '</span>' +
                '<span style="font-size:11px;color:' + textMuted + ';flex-shrink:0;margin-left:8px">' + d.count + ' tables • ' + d.archived + ' archived</span>' +
              '</div>' +
              miniBar(d.cost, maxCost, accentPurple) +
            '</div>' +
            '<div style="font-size:12px;font-weight:700;color:' + accentPurple + ';min-width:65px;text-align:right">' + fmtMoney(d.cost) + '/mo</div>' +
          '</div>';
        });
        return h;
      }

      // === Top Tables ===
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
        var maxDelScore = 100;
        var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
        h += '<thead><tr style="border-bottom:2px solid ' + dividerColor + '">';
        ["Schema","Table","Size (GiB)","Cost/mo","Usage","Risk Level","Del. Score","Action","Owner"].forEach(function(c) {
          h += '<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:' + textMuted + ';letter-spacing:0.8px;text-transform:uppercase;white-space:nowrap">' + c + '</th>';
        });
        h += '</tr></thead><tbody>';
        sorted.forEach(function(r) {
          var sc = schemaColors[r.schema] || "#475569";
          var ac = actionColorMap[r.action] || textMuted;
          var dc = r.delScore >= 70 ? accentRed : r.delScore >= 40 ? accentAmber : accentEmerald;
          h += '<tr style="border-bottom:1px solid ' + dividerColor + '">' +
            '<td style="padding:8px 12px"><span style="padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;background:' + sc + '15;color:' + sc + '">' + r.schema.toUpperCase() + '</span></td>' +
            '<td style="padding:8px 12px;font-family:monospace;font-weight:500;color:' + textPrimary + ';max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + r.name + '</td>' +
            '<td style="padding:8px 12px;color:' + textSecond + ';font-variant-numeric:tabular-nums">' + fmtDec(r.size) + '</td>' +
            '<td style="padding:8px 12px;color:#fbbf24;font-weight:600">' + fmtMoneyDec(r.cost) + '</td>' +
            '<td style="padding:8px 12px;color:' + textSecond + ';font-variant-numeric:tabular-nums">' + fmt(r.usage) + '</td>' +
            '<td style="padding:8px 12px">' + riskBadge(r.risk) + '</td>' +
            '<td style="padding:8px 12px"><div style="display:flex;align-items:center;gap:6px">' + miniBar(r.delScore, maxDelScore, dc, "50px") + '<span style="font-size:11px;font-weight:600;color:' + dc + '">' + r.delScore + '</span></div></td>' +
            '<td style="padding:8px 12px"><span style="padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;background:' + ac + '15;color:' + ac + ';white-space:nowrap">' + r.action + '</span></td>' +
            '<td style="padding:8px 12px;font-size:11px;color:' + textSecond + ';max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + r.owner + '</td>' +
          '</tr>';
        });
        h += '</tbody></table></div>';
        return h;
      }

      // === BUILD ===
      var html = '<div style="background:' + bg + ';color:' + textPrimary + ';padding:28px 24px;max-width:1400px;margin:0 auto">';

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

        html += '<div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap">';
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:1.3;min-width:400px">' +
          sectionTitle("Archival Pipeline", "🔄") + actionPipeline() + '</div>';
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:0.7;min-width:260px">' +
          sectionTitle("Risk Distribution", "📊") + riskSection() + '</div>';
        html += '</div>';

        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';margin-bottom:24px">' +
          sectionTitle("Schema Distribution", "🗂️") + schemaDistribution() + '</div>';

        html += '<div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap">';
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:1;min-width:400px">' +
          sectionTitle("Archive Progress by Schema", "🗄️") + schemaArchiveProgress() + '</div>';
        html += '<div style="background:' + cardBg + ';border-radius:14px;padding:20px;border:1px solid ' + cardBorder + ';flex:0.7;min-width:280px">' +
          sectionTitle("Ownership Breakdown", "👤") + ownerBreakdown() + '</div>';
        html += '</div>';

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

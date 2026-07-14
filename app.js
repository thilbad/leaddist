/* ANZ Zoho Lead Distribution Tracker
 * Single-page app. State persists in localStorage under `anz_v3`.
 * No backend, no auth — safe to host on GitHub Pages. */
(function () {
  "use strict";

  var STORAGE_KEY = "anz_v3";
  var THEME_KEY = "anz_theme";

  /* Avatar background/foreground pairs, assigned by member index mod 8. */
  var AVATAR_COLORS = [
    { bg: "#E6F1FB", fg: "#185FA5" },
    { bg: "#E1F5EE", fg: "#0F6E56" },
    { bg: "#EEEDFE", fg: "#534AB7" },
    { bg: "#FAECE7", fg: "#993C1D" },
    { bg: "#FAEEDA", fg: "#854F0B" },
    { bg: "#EAF3DE", fg: "#3B6D11" },
    { bg: "#FBEAF0", fg: "#993556" },
    { bg: "#FCEBEB", fg: "#A32D2D" },
  ];
  /* Progress-bar / chart-bar colours, assigned by member index mod 8. */
  var BAR_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834", "#008300"];

  /* ---------- State ---------- */
  var state = load();
  var charts = {}; // history index -> Chart instance

  function defaultState() {
    return {
      sections: [
        {
          id: "retail", label: "Retail", hasBB: true,
          members: [
            { name: "Ashutosh", leads: 27, bb: 0 },
            { name: "Jack", leads: 25, bb: 0 },
            { name: "Naman", leads: 28, bb: 0 },
            { name: "Noah", leads: 15, bb: 0 },
          ],
        },
        {
          id: "midmarket", label: "Mid Market", hasBB: true,
          members: [
            { name: "Grant", leads: 16, bb: 1 },
            { name: "Karthik", leads: 14, bb: 1 },
          ],
        },
        {
          id: "midmarket_sos", label: "Mid Market – SOS", hasBB: true,
          members: [
            { name: "Grant", leads: 0, bb: 0 },
            { name: "Karthik", leads: 0, bb: 0 },
          ],
        },
      ],
      history: [],
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.sections) && Array.isArray(parsed.history)) return migrate(parsed);
      }
    } catch (e) { /* fall through */ }
    return defaultState();
  }

  /* Bring older saved state up to date: all live segments now track BB, so
   * ensure every section has hasBB and every member has a bb integer.
   * History snapshots are left as-is — they reflect what was tracked then. */
  function migrate(s) {
    s.sections.forEach(function (sec) {
      sec.hasBB = true;
      sec.members.forEach(function (m) {
        if (typeof m.bb !== "number") m.bb = 0;
      });
    });
    return s;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /* ---------- Helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function initials(name) {
    var parts = String(name).trim().split(/\s+/);
    var s = parts[0] ? parts[0][0] : "";
    if (parts.length > 1) s += parts[parts.length - 1][0];
    return s.toUpperCase();
  }
  function currentMonth() {
    var d = new Date();
    return d.toLocaleString("en-US", { month: "long" }) + " " + d.getFullYear();
  }
  function sectionSubtotal(sec) {
    return sec.members.reduce(function (t, m) { return t + (m.leads || 0); }, 0);
  }
  function grandTotal() {
    return state.sections.reduce(function (t, s) { return t + sectionSubtotal(s); }, 0);
  }

  /* ---------- Theme ---------- */
  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    var dark = saved ? saved === "dark"
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    applyTheme(dark);
    $("#themeToggle").addEventListener("click", function () {
      var isDark = document.documentElement.getAttribute("data-theme") === "dark";
      applyTheme(!isDark);
      localStorage.setItem(THEME_KEY, !isDark ? "dark" : "light");
      if ($("#panel-history").classList.contains("active")) renderHistory();
    });
  }
  function applyTheme(dark) {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    $("#themeToggle").innerHTML = '<i class="ti ti-' + (dark ? "sun" : "moon") + '"></i>';
  }

  /* ---------- Tracker render ---------- */
  function renderHeader() {
    var m = currentMonth();
    $("#subtitle").textContent = "Tracking " + m;
    var n = grandTotal();
    $("#grandTotal").textContent = n + " total lead" + (n === 1 ? "" : "s");
    $("#closeBarText").textContent =
      "Ready to close " + m + "? Snapshot this month and reset all counters.";
  }

  function renderTracker() {
    // Preserve focus/value of an add-member input across re-render.
    var active = document.activeElement;
    var focusSid = null, focusVal = "", focusCaret = 0;
    if (active && active.classList && active.classList.contains("add-input")) {
      focusSid = active.getAttribute("data-add");
      focusVal = active.value;
      focusCaret = active.selectionStart || focusVal.length;
    }

    var wrap = $("#sections");
    wrap.innerHTML = "";
    state.sections.forEach(function (sec) {
      var maxLeads = sec.members.reduce(function (mx, m) { return Math.max(mx, m.leads || 0); }, 0);

      var secEl = el("div", "section");
      var head = el("div", "section-head");
      head.appendChild(el("h2", null, esc(sec.label)));
      head.appendChild(el("span", "section-subtotal", sectionSubtotal(sec) + " leads"));
      secEl.appendChild(head);

      var grid = el("div", "member-grid");
      sec.members.forEach(function (m, idx) {
        grid.appendChild(memberCard(sec, m, idx, maxLeads));
      });
      secEl.appendChild(grid);

      // Add-member row
      var addRow = el("div", "add-member");
      var input = el("input");
      input.className = "add-input";
      input.type = "text";
      input.maxLength = 25;
      input.placeholder = "Add member…";
      input.setAttribute("data-add", sec.id);
      var addBtn = el("button", "btn", '<i class="ti ti-plus"></i> Add');
      addBtn.setAttribute("data-addbtn", sec.id);
      addRow.appendChild(input);
      addRow.appendChild(addBtn);
      secEl.appendChild(addRow);

      wrap.appendChild(secEl);
    });

    renderHeader();

    // Restore focus
    if (focusSid) {
      var restore = wrap.querySelector('.add-input[data-add="' + CSS.escape(focusSid) + '"]');
      if (restore) {
        restore.value = focusVal;
        restore.focus();
        try { restore.setSelectionRange(focusCaret, focusCaret); } catch (e) {}
      }
    }
  }

  function memberCard(sec, m, idx, maxLeads) {
    var av = AVATAR_COLORS[idx % 8];
    var bar = BAR_COLORS[idx % 8];
    var pct = maxLeads > 0 ? Math.round(((m.leads || 0) / maxLeads) * 100) : 0;

    var card = el("div", "member-card");

    var remove = el("button", "mc-remove", '<i class="ti ti-x"></i>');
    remove.title = "Remove member";
    remove.setAttribute("data-remove", sec.id + "|" + idx);
    card.appendChild(remove);

    var headHtml =
      '<span class="avatar" style="background:' + av.bg + ';color:' + av.fg + '">' + esc(initials(m.name)) + "</span>" +
      '<span class="mc-name" title="' + esc(m.name) + '">' + esc(m.name) + "</span>";
    card.appendChild(el("div", "mc-head", headHtml));

    card.appendChild(el("div", "mc-count", String(m.leads || 0)));
    card.appendChild(el("div", "mc-label", (m.leads === 1 ? "lead" : "leads")));

    var prog = el("div", "progress", '<span style="width:' + pct + "%;background:" + bar + '"></span>');
    card.appendChild(prog);

    if (sec.hasBB) {
      var bb = el("div", "bb-row");
      bb.innerHTML =
        '<span class="bb-label">BB</span>' +
        '<div class="counter-group">' +
          '<button class="step" data-bb="' + sec.id + "|" + idx + '|dec">−</button>' +
          '<span class="cval">' + (m.bb || 0) + "</span>" +
          '<button class="step" data-bb="' + sec.id + "|" + idx + '|inc">+</button>' +
        "</div>";
      card.appendChild(bb);
    }

    var lead = el("div", "lead-controls");
    lead.innerHTML =
      '<button class="step" data-lead="' + sec.id + "|" + idx + '|dec">−</button>' +
      '<button class="step" data-lead="' + sec.id + "|" + idx + '|inc">+</button>';
    card.appendChild(lead);

    return card;
  }

  /* ---------- Tracker interactions ---------- */
  function findMember(sid, idx) {
    var sec = state.sections.find(function (s) { return s.id === sid; });
    if (!sec) return null;
    return { sec: sec, m: sec.members[idx] };
  }

  $("#sections").addEventListener("click", function (e) {
    var t;
    if ((t = e.target.closest("[data-lead]"))) {
      var p = t.getAttribute("data-lead").split("|");
      var ref = findMember(p[0], +p[1]); if (!ref) return;
      ref.m.leads = Math.max(0, (ref.m.leads || 0) + (p[2] === "inc" ? 1 : -1));
      save(); renderTracker();
    } else if ((t = e.target.closest("[data-bb]"))) {
      var pb = t.getAttribute("data-bb").split("|");
      var rb = findMember(pb[0], +pb[1]); if (!rb) return;
      rb.m.bb = Math.max(0, (rb.m.bb || 0) + (pb[2] === "inc" ? 1 : -1));
      save(); renderTracker();
    } else if ((t = e.target.closest("[data-remove]"))) {
      var pr = t.getAttribute("data-remove").split("|");
      var sec = state.sections.find(function (s) { return s.id === pr[0]; });
      if (sec) { sec.members.splice(+pr[1], 1); save(); renderTracker(); }
    } else if ((t = e.target.closest("[data-addbtn]"))) {
      addMember(t.getAttribute("data-addbtn"));
    }
  });

  $("#sections").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.classList.contains("add-input")) {
      e.preventDefault();
      addMember(e.target.getAttribute("data-add"));
    }
  });

  function addMember(sid) {
    var input = $('.add-input[data-add="' + CSS.escape(sid) + '"]');
    if (!input) return;
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    var sec = state.sections.find(function (s) { return s.id === sid; });
    if (!sec) return;
    var dup = sec.members.some(function (m) { return m.name.toLowerCase() === name.toLowerCase(); });
    if (dup) {
      input.classList.add("error");
      setTimeout(function () { input.classList.remove("error"); }, 1400);
      return;
    }
    var member = { name: name, leads: 0 };
    if (sec.hasBB) member.bb = 0;
    sec.members.push(member);
    save();
    renderTracker();
    // Keep focus in that section's (now empty) add input.
    var again = $('.add-input[data-add="' + CSS.escape(sid) + '"]');
    if (again) { again.value = ""; again.focus(); }
  }

  /* ---------- History render ---------- */
  function renderHistory() {
    // Destroy any existing charts before rebuilding the DOM.
    Object.keys(charts).forEach(function (k) { try { charts[k].destroy(); } catch (e) {} });
    charts = {};

    var count = state.history.length;
    $("#historyCount").textContent = count + " month" + (count === 1 ? "" : "s") + " recorded";
    $("#exportCsvBtn").hidden = count === 0;
    if (count === 0) { $("#exportPanel").hidden = true; }

    var wrap = $("#historyRecords");
    wrap.innerHTML = "";
    if (count === 0) {
      wrap.appendChild(el("div", "empty", "No history yet. Close your first month to see data here."));
      return;
    }

    state.history.forEach(function (rec, hi) {
      var total = rec.sections.reduce(function (t, s) { return t + sectionSubtotal(s); }, 0);
      var card = el("div", "history-card");

      var head = el("div", "history-head");
      head.innerHTML =
        '<div class="hh-left"><span class="hh-month">' + esc(rec.month) + "</span>" +
          '<span class="hh-total">' + total + " leads</span></div>" +
        '<i class="ti ti-chevron-down chevron"></i>';
      head.addEventListener("click", function () {
        var open = card.classList.toggle("open");
        if (open && !charts[hi]) buildChart(card, rec, hi);
      });
      card.appendChild(head);

      var body = el("div", "history-body");
      rec.sections.forEach(function (sec) {
        var s = el("div", "hist-section");
        s.appendChild(el("h3", null,
          esc(sec.label) + ' <span class="hs-total">(' + sectionSubtotal(sec) + ")</span>"));
        sec.members.forEach(function (m, idx) {
          var av = AVATAR_COLORS[idx % 8];
          var row = el("div", "hist-member");
          row.innerHTML =
            '<div class="hm-left"><span class="avatar" style="background:' + av.bg + ";color:" + av.fg +
              '">' + esc(initials(m.name)) + "</span>" + esc(m.name) + "</div>" +
            '<div class="hm-right">' +
              (sec.hasBB ? "<span>BB " + (m.bb || 0) + "</span>" : "") +
              "<span><strong>" + (m.leads || 0) + "</strong> leads</span>" +
            "</div>";
          s.appendChild(row);
        });
        body.appendChild(s);
      });

      var chartWrap = el("div", "chart-wrap");
      chartWrap.appendChild(el("canvas"));
      body.appendChild(chartWrap);
      card.appendChild(body);
      wrap.appendChild(card);
    });
  }

  function buildChart(card, rec, hi) {
    if (typeof Chart === "undefined") return;
    var canvas = card.querySelector("canvas");
    if (!canvas) return;

    // Sum leads per member name across all sections in this month.
    var order = [];
    var totals = {};
    rec.sections.forEach(function (sec) {
      sec.members.forEach(function (m) {
        if (!(m.name in totals)) { totals[m.name] = 0; order.push(m.name); }
        totals[m.name] += (m.leads || 0);
      });
    });
    var labels = order;
    var data = order.map(function (n) { return totals[n]; });
    var colors = order.map(function (_, i) { return BAR_COLORS[i % 8]; });

    var gridColor = getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "#e2e7ee";
    var textColor = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#667085";

    charts[hi] = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{ label: "Leads", data: data, backgroundColor: colors, borderRadius: 6 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor } },
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } },
        },
      },
    });
  }

  /* ---------- Close month flow ---------- */
  function snapshot() {
    return JSON.parse(JSON.stringify(state.sections));
  }
  function resetCounters() {
    state.sections.forEach(function (sec) {
      sec.members.forEach(function (m) {
        m.leads = 0;
        if (sec.hasBB) m.bb = 0;
      });
    });
  }
  function findHistoryIndex(month) {
    return state.history.findIndex(function (r) { return r.month === month; });
  }

  $("#closeMonthBtn").addEventListener("click", function () {
    var month = currentMonth();
    var existing = findHistoryIndex(month);
    if (existing === -1) openConfirmModal(month);
    else openDuplicateModal(month, existing);
  });

  function finishClose() {
    resetCounters();
    save();
    closeModal();
    switchTab("history");
    renderTracker();
    renderHistory();
  }

  function openConfirmModal(month) {
    var body = el("div", "modal");
    body.innerHTML =
      "<h3>Close " + esc(month) + "?</h3>" +
      "<p>Current lead counts will be saved to history and all counters will reset to zero.</p>" +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="cancel">Cancel</button>' +
        '<button class="btn btn-primary" data-act="confirm">Close month</button>' +
      "</div>";
    showModal(body, function (act) {
      if (act === "confirm") {
        state.history.unshift({ month: month, date: new Date().toISOString(), sections: snapshot() });
        finishClose();
      } else { closeModal(); }
    });
  }

  function openDuplicateModal(month, existingIdx) {
    var body = el("div", "modal");
    body.innerHTML =
      '<span class="warn-badge"><i class="ti ti-alert-triangle"></i> Month already closed</span>' +
      "<h3>" + esc(month) + " already has a record</h3>" +
      "<p>You can add the current counts on top of the existing record, or replace it entirely with the current counts.</p>" +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="cancel">Cancel</button>' +
        '<button class="btn btn-danger" data-act="replace">Replace</button>' +
        '<button class="btn btn-primary" data-act="merge">Add to existing</button>' +
      "</div>";
    showModal(body, function (act) {
      if (act === "replace") {
        state.history[existingIdx] = { month: month, date: new Date().toISOString(), sections: snapshot() };
        finishClose();
      } else if (act === "merge") {
        mergeInto(state.history[existingIdx]);
        state.history[existingIdx].date = new Date().toISOString();
        finishClose();
      } else { closeModal(); }
    });
  }

  function mergeInto(record) {
    state.sections.forEach(function (sec) {
      var snapSec = record.sections.find(function (s) { return s.id === sec.id; });
      if (!snapSec) { record.sections.push(JSON.parse(JSON.stringify(sec))); return; }
      sec.members.forEach(function (m) {
        var target = snapSec.members.find(function (x) {
          return x.name.toLowerCase() === m.name.toLowerCase();
        });
        if (target) {
          target.leads = (target.leads || 0) + (m.leads || 0);
          if (sec.hasBB) target.bb = (target.bb || 0) + (m.bb || 0);
        } else {
          snapSec.members.push(JSON.parse(JSON.stringify(m)));
        }
      });
    });
  }

  /* ---------- Modal plumbing (inline overlay, not position:fixed) ---------- */
  function showModal(modalEl, onAction) {
    closeModal();
    window.scrollTo(0, 0);
    var overlay = el("div", "modal-overlay");
    overlay.appendChild(modalEl);
    overlay.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (btn) { onAction(btn.getAttribute("data-act")); return; }
      if (e.target === overlay) closeModal(); // click backdrop = cancel
    });
    $("#modalRoot").appendChild(overlay);
    document.addEventListener("keydown", escClose);
  }
  function escClose(e) { if (e.key === "Escape") closeModal(); }
  function closeModal() {
    $("#modalRoot").innerHTML = "";
    document.removeEventListener("keydown", escClose);
  }

  /* ---------- CSV export ---------- */
  function buildCsv() {
    var rows = ['"Month","Segment","Member","Leads","BB"'];
    var q = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
    state.history.forEach(function (rec) {
      rec.sections.forEach(function (sec) {
        sec.members.forEach(function (m) {
          rows.push([
            q(rec.month), q(sec.label), q(m.name),
            q(m.leads || 0), q(sec.hasBB ? (m.bb || 0) : ""),
          ].join(","));
        });
      });
    });
    return rows.join("\r\n");
  }

  $("#exportCsvBtn").addEventListener("click", function () {
    var panel = $("#exportPanel");
    if (!panel.hidden) { panel.hidden = true; return; } // toggle closed
    $("#csvText").value = buildCsv();
    $("#copiedMsg").hidden = true;
    panel.hidden = false;
  });
  $("#dismissCsvBtn").addEventListener("click", function () { $("#exportPanel").hidden = true; });
  $("#copyCsvBtn").addEventListener("click", function () {
    var ta = $("#csvText");
    ta.focus(); ta.select();
    try {
      document.execCommand("copy");
      var msg = $("#copiedMsg");
      msg.hidden = false;
      setTimeout(function () { msg.hidden = true; }, 2000);
    } catch (e) { /* clipboard blocked */ }
    window.getSelection && window.getSelection().removeAllRanges();
  });

  /* ---------- Tabs ---------- */
  function switchTab(name) {
    document.querySelectorAll(".tab").forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === name);
    });
    document.querySelectorAll(".panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "panel-" + name);
    });
    if (name === "history") renderHistory();
  }
  $("#tabs").addEventListener("click", function (e) {
    var btn = e.target.closest(".tab");
    if (btn) switchTab(btn.getAttribute("data-tab"));
  });

  /* ---------- Go ---------- */
  initTheme();
  save(); // persist any migration applied during load()
  renderTracker();
})();

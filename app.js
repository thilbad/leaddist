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
      if (!requireUnlock()) return;
      var p = t.getAttribute("data-lead").split("|");
      var ref = findMember(p[0], +p[1]); if (!ref) return;
      ref.m.leads = Math.max(0, (ref.m.leads || 0) + (p[2] === "inc" ? 1 : -1));
      commit(); renderTracker();
    } else if ((t = e.target.closest("[data-bb]"))) {
      if (!requireUnlock()) return;
      var pb = t.getAttribute("data-bb").split("|");
      var rb = findMember(pb[0], +pb[1]); if (!rb) return;
      rb.m.bb = Math.max(0, (rb.m.bb || 0) + (pb[2] === "inc" ? 1 : -1));
      commit(); renderTracker();
    } else if ((t = e.target.closest("[data-remove]"))) {
      if (!requireUnlock()) return;
      var pr = t.getAttribute("data-remove").split("|");
      var sec = state.sections.find(function (s) { return s.id === pr[0]; });
      if (sec) { sec.members.splice(+pr[1], 1); commit(); renderTracker(); }
    } else if ((t = e.target.closest("[data-addbtn]"))) {
      if (!requireUnlock()) return;
      addMember(t.getAttribute("data-addbtn"));
    }
  });

  $("#sections").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.classList.contains("add-input")) {
      e.preventDefault();
      if (!requireUnlock()) return;
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
    commit();
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
        '<div class="hh-actions">' +
          '<button class="icon-btn hist-dl" title="Download ' + esc(rec.month) + ' as CSV" ' +
            'aria-label="Download ' + esc(rec.month) + ' CSV"><i class="ti ti-download"></i></button>' +
          '<i class="ti ti-chevron-down chevron"></i>' +
        "</div>";
      head.addEventListener("click", function (e) {
        // Download button lives inside the header — don't toggle the card for it.
        if (e.target.closest(".hist-dl")) { e.stopPropagation(); downloadMonth(hi); return; }
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
    if (!requireUnlock()) return;
    var month = currentMonth();
    var existing = findHistoryIndex(month);
    if (existing === -1) openConfirmModal(month);
    else openDuplicateModal(month, existing);
  });

  function finishClose() {
    resetCounters();
    commit();
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
  function buildCsv(records) {
    var rows = ['"Month","Segment","Member","Leads","BB"'];
    var q = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
    records.forEach(function (rec) {
      rec.sections.forEach(function (sec) {
        sec.members.forEach(function (m) {
          rows.push([
            q(rec.month), q(sec.label), q(m.name),
            q(m.leads || 0), q(sec.hasBB ? (m.bb || 0) : ""),
          ].join(","));
        });
      });
    });
    return rows.join("\r\n") + "\r\n";
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function downloadCsv(filename, csv) {
    // Prepend a UTF-8 BOM so Excel reads it correctly; a Blob preserves CRLF.
    var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadMonth(hi) {
    var rec = state.history[hi];
    if (!rec) return;
    downloadCsv("anz-leads-" + (slug(rec.month) || "month") + ".csv", buildCsv([rec]));
  }

  // Toolbar button downloads every recorded month in a single file.
  $("#exportCsvBtn").addEventListener("click", function () {
    if (!state.history.length) return;
    downloadCsv("anz-leads-all.csv", buildCsv(state.history));
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

  /* ================= Cloud sync (Supabase) ================= */
  var SUPABASE_URL = "https://pvaywerscttkzzcuonpn.supabase.co";
  var SUPABASE_KEY = "sb_publishable_lwYBm5MxeeB0iKpI2CW6xw_2o1K4wkt";
  var PC_KEY = "anz_pc";

  var sb = null;
  try {
    if (window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
  } catch (e) { sb = null; }

  var passcode = null;
  var unlocked = false;
  var dirty = false;        // local edits not yet pushed to cloud
  var pushTimer = null;
  var afterUnlock = null;   // callback to run once editing is unlocked

  // Canonical JSON (sorted keys) so jsonb key-order changes don't read as edits.
  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === "object") {
      return Object.keys(v).sort().reduce(function (a, k) { a[k] = sortKeys(v[k]); return a; }, {});
    }
    return v;
  }
  function canon(o) { return JSON.stringify(sortKeys(o)); }

  function toast(msg) {
    var t = $("#toast");
    if (!t) { t = el("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  function setSync(kind) {
    var elx = $("#syncStatus");
    if (!elx) return;
    if (dirty && kind !== "error" && kind !== "offline") kind = "saving";
    var map = {
      connecting: ["#eda100", "Connecting…"],
      synced: ["#1baf7a", "Synced"],
      saving: ["#eda100", "Saving…"],
      offline: ["#94a3b8", "Local only"],
      error: ["#e34948", "Save failed"],
    };
    var v = map[kind] || map.synced;
    elx.innerHTML = '<span class="dot" style="background:' + v[0] + '"></span>' + v[1];
  }

  function requireUnlock() {
    if (unlocked) return true;
    openUnlockModal();
    return false;
  }

  function restorePasscode() {
    try {
      var pc = sessionStorage.getItem(PC_KEY);
      if (pc) { passcode = pc; unlocked = true; }
    } catch (e) {}
  }

  function setLockUI() {
    document.body.classList.toggle("locked", !unlocked);
    var b = $("#lockBtn");
    if (!b) return;
    b.innerHTML = unlocked
      ? '<i class="ti ti-lock-open"></i> Lock editing'
      : '<i class="ti ti-lock"></i> Unlock editing';
  }

  function openUnlockModal(cb) {
    afterUnlock = cb || null;
    var m = el("div", "modal");
    m.innerHTML =
      "<h3>Unlock editing</h3>" +
      "<p>Enter the team passcode to edit the tracker. Viewing and History stay open to everyone.</p>" +
      '<input id="unlockInput" type="password" placeholder="Team passcode" autocomplete="off" style="width:100%" />' +
      '<p id="unlockErr" style="color:var(--danger);font-size:0.85rem;margin:0.6rem 0 0" hidden></p>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="cancel">Cancel</button>' +
        '<button class="btn btn-primary" data-act="unlock">Unlock</button>' +
      "</div>";
    showModal(m, function (act) {
      if (act !== "unlock") { afterUnlock = null; closeModal(); return; }
      doUnlock(m);
    });
    m.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); doUnlock(m); }
    });
    setTimeout(function () { var i = $("#unlockInput"); if (i) i.focus(); }, 40);
  }

  function doUnlock(m) {
    var input = $("#unlockInput");
    if (!input) return;
    var pc = input.value;
    if (!pc) { input.focus(); return; }
    var btn = m.querySelector('[data-act="unlock"]');
    var err = $("#unlockErr");
    if (!sb) {
      if (err) { err.hidden = false; err.textContent = "Can't reach the server — check your connection."; }
      return;
    }
    btn.disabled = true; btn.textContent = "Checking…";
    // Validate by writing the current state back through the passcode-checked function.
    sb.rpc("save_tracker", { p_passcode: pc, p_data: JSON.parse(JSON.stringify(state)) }).then(function (res) {
      if (res.error) {
        var invalid = /invalid passcode/i.test(res.error.message || "");
        if (err) { err.hidden = false; err.textContent = invalid ? "Incorrect passcode." : "Couldn't verify — please retry."; }
        btn.disabled = false; btn.textContent = "Unlock";
        input.focus(); input.select();
      } else {
        passcode = pc; unlocked = true;
        try { sessionStorage.setItem(PC_KEY, pc); } catch (e) {}
        closeModal();
        setLockUI();
        renderTracker();
        setSync("synced");
        toast("Editing unlocked");
        var cb = afterUnlock; afterUnlock = null;
        if (cb) cb();
      }
    });
  }

  // Persist locally, then debounce a cloud push (only when unlocked).
  function commit() {
    save();
    if (!sb || !unlocked) return;
    dirty = true;
    setSync("saving");
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(flushPush, 400);
  }

  function flushPush() {
    if (!sb || !passcode) { dirty = false; return; }
    sb.rpc("save_tracker", { p_passcode: passcode, p_data: JSON.parse(JSON.stringify(state)) }).then(function (res) {
      dirty = false;
      if (res.error) { setSync("error"); toast("Cloud save failed"); }
      else setSync("synced");
    }, function () { dirty = false; setSync("error"); });
  }

  // Live update from another device (realtime).
  function applyRemote(data) {
    if (!data || dirty) return;
    if (canon(data) === canon(state)) return; // no change / our own echo
    state = migrate(data);
    save();
    renderTracker();
    if ($("#panel-history").classList.contains("active")) renderHistory();
    setSync("synced");
  }

  var SYNCED_KEY = "anz_synced";
  function markSynced() { try { localStorage.setItem(SYNCED_KEY, "1"); } catch (e) {} }
  function hasSyncedBefore() { try { return localStorage.getItem(SYNCED_KEY) === "1"; } catch (e) { return false; } }

  function adoptCloud(data) {
    state = migrate(data);
    save();
    markSynced();
    renderTracker();
    if ($("#panel-history").classList.contains("active")) renderHistory();
  }

  function pushLocalAsTruth() {
    dirty = true; setSync("saving"); flushPush();
    markSynced();
    toast("Uploaded this device's data");
  }

  // On first cloud connect only, and only when this device holds real local
  // work (not the untouched seed) that differs from the cloud, ask the user
  // which copy wins. A pristine/new device or an already-synced device just
  // adopts the shared cloud copy silently.
  function reconcile(cloudData) {
    var pristine = canon(state) === canon(defaultState());
    if (hasSyncedBefore() || pristine || canon(cloudData) === canon(state)) {
      adoptCloud(cloudData);
      return;
    }
    var m = el("div", "modal");
    m.innerHTML =
      "<h3>Set up sync on this device</h3>" +
      "<p>This device has tracker data that differs from the shared cloud copy. Which should the team use?</p>" +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="cloud">Use shared cloud data</button>' +
        '<button class="btn btn-primary" data-act="upload">Upload this device\'s data</button>' +
      "</div>";
    showModal(m, function (act) {
      closeModal();
      if (act === "upload") {
        if (unlocked) pushLocalAsTruth();
        else openUnlockModal(pushLocalAsTruth);
      } else {
        adoptCloud(cloudData);
      }
    });
  }

  function cloudInit() {
    if (!sb) { setSync("offline"); return; }
    setSync("connecting");
    sb.from("tracker_state").select("data").eq("id", "main").single().then(function (res) {
      if (!res.error && res.data && res.data.data) reconcile(res.data.data);
      else setSync(dirty ? "saving" : "synced");
      sb.channel("tracker_state_main")
        .on("postgres_changes",
          { event: "*", schema: "public", table: "tracker_state", filter: "id=eq.main" },
          function (payload) { if (payload.new && payload.new.data) applyRemote(payload.new.data); })
        .subscribe(function (status) { if (status === "SUBSCRIBED" && !dirty) setSync("synced"); });
    }, function () { setSync("offline"); });
  }

  $("#lockBtn").addEventListener("click", function () {
    if (unlocked) {
      unlocked = false; passcode = null;
      try { sessionStorage.removeItem(PC_KEY); } catch (e) {}
      setLockUI(); renderTracker(); toast("Editing locked");
    } else {
      openUnlockModal();
    }
  });

  /* ---------- Go ---------- */
  initTheme();
  restorePasscode();
  save(); // persist any migration applied during load()
  setLockUI();
  renderTracker();
  cloudInit();
})();

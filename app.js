/* LeadDist — client-side lead distribution tracker.
 * State persists in localStorage. No backend, safe for GitHub Pages. */
(function () {
  "use strict";

  const STORAGE_KEY = "leaddist.v1";
  const STATUSES = ["New", "Contacted", "Qualified", "Won", "Lost"];
  const SOURCES = ["Website", "Referral", "Cold Call", "Event", "Social", "Other"];
  const AVATAR_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#38bdf8", "#ec4899", "#a855f7", "#14b8a6", "#ef4444"];

  /* ---------- State ---------- */
  let state = load();
  let sortKey = "name";
  let sortDir = 1;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to seed */ }
    return seed();
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function seed() {
    const reps = [
      { id: uid(), name: "Alex Rivera", email: "alex@team.co", active: true },
      { id: uid(), name: "Jordan Lee", email: "jordan@team.co", active: true },
      { id: uid(), name: "Sam Patel", email: "sam@team.co", active: true },
    ];
    const demoLeads = [
      ["Maria Gomez", "Nimbus Cloud", "Website", 12000, "Qualified", 0],
      ["Tom Becker", "Becker & Co", "Referral", 8000, "Contacted", 1],
      ["Lena Fischer", "BrightApps", "Event", 25000, "New", null],
      ["Chris Yamada", "Yamada Retail", "Cold Call", 5000, "Won", 2],
      ["Priya Nair", "Delta Health", "Social", 15000, "New", null],
      ["Owen Clarke", "Clarke Legal", "Website", 3000, "Lost", 0],
      ["Nadia Rossi", "Rossi Foods", "Referral", 18000, "Qualified", 1],
    ];
    const leads = demoLeads.map(function (d, i) {
      return {
        id: uid(),
        name: d[0], company: d[1], email: "", phone: "",
        source: d[2], value: d[3], status: d[4],
        repId: d[5] === null ? null : reps[d[5]].id,
        notes: "", createdAt: Date.now() - i * 86400000,
      };
    });
    return { reps: reps, leads: leads };
  }

  /* ---------- Helpers ---------- */
  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  const esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  const money = function (n) { return "$" + Number(n || 0).toLocaleString(); };
  const repById = function (id) { return state.reps.find(function (r) { return r.id === id; }); };
  const repName = function (id) { const r = repById(id); return r ? r.name : "Unassigned"; };
  const avatarColor = function (id) {
    const i = state.reps.findIndex(function (r) { return r.id === id; });
    return AVATAR_COLORS[(i < 0 ? 0 : i) % AVATAR_COLORS.length];
  };
  const initials = function (name) {
    return name.split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase();
  };

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* ---------- Rendering ---------- */
  function renderAll() {
    renderDashboard();
    renderLeads();
    renderReps();
    populateFilters();
  }

  function renderDashboard() {
    const leads = state.leads;
    const total = leads.length;
    const won = leads.filter(function (l) { return l.status === "Won"; });
    const unassigned = leads.filter(function (l) { return !l.repId; }).length;
    const pipeline = leads
      .filter(function (l) { return l.status !== "Lost"; })
      .reduce(function (s, l) { return s + Number(l.value || 0); }, 0);
    const wonValue = won.reduce(function (s, l) { return s + Number(l.value || 0); }, 0);
    const closed = leads.filter(function (l) { return l.status === "Won" || l.status === "Lost"; }).length;
    const convRate = closed ? Math.round((won.length / closed) * 100) : 0;

    const cards = [
      { label: "Total leads", value: total, cls: "accent" },
      { label: "Unassigned", value: unassigned, sub: unassigned ? "needs distribution" : "all assigned" },
      { label: "Pipeline value", value: money(pipeline), sub: "excl. lost" },
      { label: "Won", value: won.length, sub: money(wonValue), cls: "green" },
      { label: "Conversion", value: convRate + "%", sub: closed + " closed" },
      { label: "Active reps", value: state.reps.filter(function (r) { return r.active; }).length },
    ];
    $("#statGrid").innerHTML = cards.map(function (c) {
      return '<div class="stat ' + (c.cls || "") + '">' +
        '<div class="label">' + c.label + '</div>' +
        '<div class="value">' + c.value + '</div>' +
        (c.sub ? '<div class="sub">' + c.sub + '</div>' : "") +
        '</div>';
    }).join("");

    // Distribution by rep
    const counts = state.reps.map(function (r) {
      return { rep: r, n: leads.filter(function (l) { return l.repId === r.id; }).length };
    });
    const unassignedCount = unassigned;
    const max = Math.max(1, unassignedCount, counts.reduce(function (m, c) { return Math.max(m, c.n); }, 0));
    let rows = counts.map(function (c) {
      const w = Math.round((c.n / max) * 100);
      return '<div class="dist-row">' +
        '<div class="name">' + esc(c.rep.name) + (c.rep.active ? "" : ' <span class="off">(inactive)</span>') + '</div>' +
        '<div class="dist-bar"><span style="width:' + w + '%"></span></div>' +
        '<div class="count">' + c.n + '</div></div>';
    }).join("");
    if (unassignedCount > 0) {
      const w = Math.round((unassignedCount / max) * 100);
      rows += '<div class="dist-row">' +
        '<div class="name off">Unassigned</div>' +
        '<div class="dist-bar"><span style="width:' + w + '%;background:linear-gradient(90deg,#64748b,#94a3b8)"></span></div>' +
        '<div class="count">' + unassignedCount + '</div></div>';
    }
    $("#distChart").innerHTML = rows || '<p class="empty">Add reps and leads to see distribution.</p>';

    // Status & source breakdown
    renderBreakdown("#statusChart", STATUSES, "status", {
      New: "#38bdf8", Contacted: "#818cf8", Qualified: "#f59e0b", Won: "#22c55e", Lost: "#ef4444",
    });
    renderBreakdown("#sourceChart", SOURCES, "source", null);
  }

  function renderBreakdown(sel, keys, field, colorMap) {
    const leads = state.leads;
    const max = Math.max(1, keys.reduce(function (m, k) {
      return Math.max(m, leads.filter(function (l) { return l[field] === k; }).length);
    }, 0));
    $(sel).innerHTML = keys.map(function (k, i) {
      const n = leads.filter(function (l) { return l[field] === k; }).length;
      const w = Math.round((n / max) * 100);
      const color = colorMap ? colorMap[k] : AVATAR_COLORS[i % AVATAR_COLORS.length];
      return '<div class="bl-row"><div>' + esc(k) + '</div>' +
        '<div class="bl-bar"><span style="width:' + w + '%;background:' + color + '"></span></div>' +
        '<div>' + n + '</div></div>';
    }).join("");
  }

  function getFilteredLeads() {
    const q = $("#leadSearch").value.trim().toLowerCase();
    const fs = $("#filterStatus").value;
    const fr = $("#filterRep").value;
    const fsrc = $("#filterSource").value;
    let list = state.leads.filter(function (l) {
      if (fs && l.status !== fs) return false;
      if (fsrc && l.source !== fsrc) return false;
      if (fr === "__none__") { if (l.repId) return false; }
      else if (fr && l.repId !== fr) return false;
      if (q) {
        const hay = (l.name + " " + l.company + " " + l.email + " " + l.phone).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    list.sort(function (a, b) {
      let va = a[sortKey], vb = b[sortKey];
      if (sortKey === "repId") { va = repName(a.repId); vb = repName(b.repId); }
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sortDir;
      return String(va).localeCompare(String(vb)) * sortDir;
    });
    return list;
  }

  function renderLeads() {
    const list = getFilteredLeads();
    const repOpts = function (sel) {
      return '<option value=""' + (!sel ? " selected" : "") + '>— Unassigned —</option>' +
        state.reps.map(function (r) {
          return '<option value="' + r.id + '"' + (r.id === sel ? " selected" : "") + '>' + esc(r.name) + '</option>';
        }).join("");
    };
    $("#leadsBody").innerHTML = list.map(function (l) {
      return '<tr data-id="' + l.id + '">' +
        '<td><strong>' + esc(l.name) + '</strong>' + (l.email ? '<div class="sub">' + esc(l.email) + '</div>' : "") + '</td>' +
        '<td>' + esc(l.company || "—") + '</td>' +
        '<td>' + esc(l.source) + '</td>' +
        '<td>' + money(l.value) + '</td>' +
        '<td><span class="badge ' + l.status + '">' + l.status + '</span></td>' +
        '<td><select class="assign-select" data-assign="' + l.id + '">' + repOpts(l.repId) + '</select></td>' +
        '<td style="white-space:nowrap">' +
          '<button class="btn-icon" data-edit="' + l.id + '" title="Edit">✏️</button>' +
          '<button class="btn-icon" data-del="' + l.id + '" title="Delete">🗑</button>' +
        '</td></tr>';
    }).join("");
    $("#leadsEmpty").hidden = list.length !== 0;
  }

  function renderReps() {
    const wrap = $("#repCards");
    $("#repsEmpty").hidden = state.reps.length !== 0;
    wrap.innerHTML = state.reps.map(function (r) {
      const assigned = state.leads.filter(function (l) { return l.repId === r.id; });
      const won = assigned.filter(function (l) { return l.status === "Won"; });
      const value = assigned
        .filter(function (l) { return l.status !== "Lost"; })
        .reduce(function (s, l) { return s + Number(l.value || 0); }, 0);
      return '<div class="rep-card">' +
        '<div class="rep-top">' +
          '<div class="avatar" style="background:' + avatarColor(r.id) + '">' + initials(r.name) + '</div>' +
          '<div><h3>' + esc(r.name) + '</h3><div class="rep-email">' + esc(r.email || "") + '</div></div>' +
        '</div>' +
        '<span class="pill ' + (r.active ? "on" : "off") + '">' + (r.active ? "Active" : "Inactive") + '</span>' +
        '<div class="rep-metrics">' +
          '<div><span class="m-val">' + assigned.length + '</span><span class="m-lab">Leads</span></div>' +
          '<div><span class="m-val">' + won.length + '</span><span class="m-lab">Won</span></div>' +
          '<div><span class="m-val">' + money(value) + '</span><span class="m-lab">Pipeline</span></div>' +
        '</div>' +
        '<div class="rep-actions">' +
          '<button class="btn btn-sm" data-editrep="' + r.id + '">Edit</button>' +
          '<button class="btn btn-sm btn-danger" data-delrep="' + r.id + '">Delete</button>' +
        '</div></div>';
    }).join("");
  }

  function populateFilters() {
    const statusSel = '<option value="">All statuses</option>' +
      STATUSES.map(function (s) { return '<option>' + s + '</option>'; }).join("");
    const sourceSel = '<option value="">All sources</option>' +
      SOURCES.map(function (s) { return '<option>' + s + '</option>'; }).join("");
    const repSel = '<option value="">All reps</option><option value="__none__">Unassigned</option>' +
      state.reps.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + '</option>'; }).join("");
    setSelect("#filterStatus", statusSel);
    setSelect("#filterSource", sourceSel);
    setSelect("#filterRep", repSel);
  }
  function setSelect(sel, html) {
    const el = $(sel);
    const prev = el.value;
    el.innerHTML = html;
    el.value = prev;
  }

  /* ---------- Lead modal ---------- */
  function openLeadModal(lead) {
    $("#leadModalTitle").textContent = lead ? "Edit lead" : "Add lead";
    $("#leadId").value = lead ? lead.id : "";
    $("#f_name").value = lead ? lead.name : "";
    $("#f_company").value = lead ? lead.company : "";
    $("#f_email").value = lead ? lead.email : "";
    $("#f_phone").value = lead ? lead.phone : "";
    $("#f_value").value = lead ? lead.value : 0;
    $("#f_notes").value = lead ? lead.notes : "";
    $("#f_source").innerHTML = SOURCES.map(function (s) { return '<option>' + s + '</option>'; }).join("");
    $("#f_status").innerHTML = STATUSES.map(function (s) { return '<option>' + s + '</option>'; }).join("");
    $("#f_rep").innerHTML = '<option value="">— Unassigned —</option>' +
      state.reps.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + '</option>'; }).join("");
    $("#f_source").value = lead ? lead.source : "Website";
    $("#f_status").value = lead ? lead.status : "New";
    $("#f_rep").value = lead && lead.repId ? lead.repId : "";
    $("#leadModal").hidden = false;
    $("#f_name").focus();
  }

  $("#leadForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const id = $("#leadId").value;
    const data = {
      name: $("#f_name").value.trim(),
      company: $("#f_company").value.trim(),
      email: $("#f_email").value.trim(),
      phone: $("#f_phone").value.trim(),
      source: $("#f_source").value,
      value: Number($("#f_value").value) || 0,
      status: $("#f_status").value,
      repId: $("#f_rep").value || null,
      notes: $("#f_notes").value.trim(),
    };
    if (id) {
      const lead = state.leads.find(function (l) { return l.id === id; });
      Object.assign(lead, data);
      toast("Lead updated");
    } else {
      data.id = uid();
      data.createdAt = Date.now();
      state.leads.push(data);
      toast("Lead added");
    }
    save();
    $("#leadModal").hidden = true;
    renderAll();
  });

  /* ---------- Rep modal ---------- */
  function openRepModal(rep) {
    $("#repModalTitle").textContent = rep ? "Edit rep" : "Add rep";
    $("#repId").value = rep ? rep.id : "";
    $("#r_name").value = rep ? rep.name : "";
    $("#r_email").value = rep ? rep.email : "";
    $("#r_active").checked = rep ? rep.active : true;
    $("#repModal").hidden = false;
    $("#r_name").focus();
  }

  $("#repForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const id = $("#repId").value;
    const data = {
      name: $("#r_name").value.trim(),
      email: $("#r_email").value.trim(),
      active: $("#r_active").checked,
    };
    if (id) {
      Object.assign(repById(id), data);
      toast("Rep updated");
    } else {
      data.id = uid();
      state.reps.push(data);
      toast("Rep added");
    }
    save();
    $("#repModal").hidden = true;
    renderAll();
  });

  /* ---------- Auto-assign (round-robin by current load) ---------- */
  function autoAssign() {
    const active = state.reps.filter(function (r) { return r.active; });
    if (!active.length) { toast("Add an active rep first"); return; }
    const unassigned = state.leads.filter(function (l) { return !l.repId; });
    if (!unassigned.length) { toast("No unassigned leads"); return; }
    // Load map seeded with current counts so distribution stays balanced.
    const load = {};
    active.forEach(function (r) {
      load[r.id] = state.leads.filter(function (l) { return l.repId === r.id; }).length;
    });
    unassigned.forEach(function (lead) {
      // pick the active rep with the smallest current load
      let target = active[0];
      active.forEach(function (r) { if (load[r.id] < load[target.id]) target = r; });
      lead.repId = target.id;
      load[target.id]++;
    });
    save();
    renderAll();
    toast("Assigned " + unassigned.length + " lead" + (unassigned.length > 1 ? "s" : ""));
  }

  /* ---------- Import / Export ---------- */
  function download(filename, text, type) {
    const blob = new Blob([text], { type: type || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const head = ["Name", "Company", "Email", "Phone", "Source", "Value", "Status", "Assigned To", "Notes"];
    const rows = state.leads.map(function (l) {
      return [l.name, l.company, l.email, l.phone, l.source, l.value, l.status, repName(l.repId), l.notes]
        .map(function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; })
        .join(",");
    });
    download("leads.csv", head.join(",") + "\n" + rows.join("\n"), "text/csv");
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.reps) || !Array.isArray(data.leads)) {
          throw new Error("bad shape");
        }
        state = data;
        save();
        renderAll();
        toast("Data imported");
      } catch (e) {
        toast("Import failed: invalid file");
      }
    };
    reader.readAsText(file);
  }

  /* ---------- Events ---------- */
  // Tabs
  $("#tabs").addEventListener("click", function (e) {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    $$(".tab").forEach(function (t) { t.classList.remove("active"); });
    $$(".view").forEach(function (v) { v.classList.remove("active"); });
    btn.classList.add("active");
    $("#view-" + btn.dataset.view).classList.add("active");
  });

  // Dashboard
  $("#autoAssignBtn").addEventListener("click", autoAssign);

  // Leads
  $("#addLeadBtn").addEventListener("click", function () { openLeadModal(null); });
  ["#leadSearch", "#filterStatus", "#filterRep", "#filterSource"].forEach(function (sel) {
    $(sel).addEventListener("input", renderLeads);
  });
  $$("#leadsTable th[data-sort]").forEach(function (th) {
    th.addEventListener("click", function () {
      const k = th.dataset.sort;
      if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; }
      renderLeads();
    });
  });
  $("#leadsBody").addEventListener("click", function (e) {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    if (edit) {
      openLeadModal(state.leads.find(function (l) { return l.id === edit.dataset.edit; }));
    } else if (del) {
      const lead = state.leads.find(function (l) { return l.id === del.dataset.del; });
      if (confirm("Delete lead \"" + lead.name + "\"?")) {
        state.leads = state.leads.filter(function (l) { return l.id !== del.dataset.del; });
        save(); renderAll(); toast("Lead deleted");
      }
    }
  });
  $("#leadsBody").addEventListener("change", function (e) {
    const sel = e.target.closest("[data-assign]");
    if (!sel) return;
    const lead = state.leads.find(function (l) { return l.id === sel.dataset.assign; });
    lead.repId = sel.value || null;
    save(); renderDashboard(); renderReps();
    toast(lead.repId ? "Assigned to " + repName(lead.repId) : "Unassigned");
  });

  // Reps
  $("#addRepBtn").addEventListener("click", function () { openRepModal(null); });
  $("#repCards").addEventListener("click", function (e) {
    const edit = e.target.closest("[data-editrep]");
    const del = e.target.closest("[data-delrep]");
    if (edit) {
      openRepModal(repById(edit.dataset.editrep));
    } else if (del) {
      const rep = repById(del.dataset.delrep);
      const n = state.leads.filter(function (l) { return l.repId === rep.id; }).length;
      const msg = n
        ? "Delete " + rep.name + "? Their " + n + " lead(s) will become unassigned."
        : "Delete " + rep.name + "?";
      if (confirm(msg)) {
        state.leads.forEach(function (l) { if (l.repId === rep.id) l.repId = null; });
        state.reps = state.reps.filter(function (r) { return r.id !== rep.id; });
        save(); renderAll(); toast("Rep deleted");
      }
    }
  });

  // Modals: close on backdrop / cancel
  $$(".modal-backdrop").forEach(function (m) {
    m.addEventListener("click", function (e) {
      if (e.target === m || e.target.hasAttribute("data-close")) m.hidden = true;
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") $$(".modal-backdrop").forEach(function (m) { m.hidden = true; });
  });

  // Data
  $("#exportJsonBtn").addEventListener("click", function () {
    download("leaddist-backup.json", JSON.stringify(state, null, 2), "application/json");
  });
  $("#exportCsvBtn").addEventListener("click", exportCsv);
  $("#importFile").addEventListener("change", function (e) {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = "";
  });
  $("#resetBtn").addEventListener("click", function () {
    if (confirm("Reset ALL data and reload demo content? This cannot be undone.")) {
      state = seed(); save(); renderAll(); toast("Data reset");
    }
  });

  /* ---------- Go ---------- */
  renderAll();
})();

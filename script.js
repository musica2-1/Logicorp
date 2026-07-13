/* ============================================================
   LogiCorp — Portal de Entregas
   Camada de comportamento (autenticação, DOM, calendário,
   formulários). Nenhuma dependência externa.
   ============================================================ */
(function () {
  "use strict";

  /* -------------------- Configuração geral -------------------- */
  var AUTH_KEY = "logicorp.session";
  var CREDENTIALS = { user: "user", pass: "123" };

  var PROFILE = {
    name: "Carlos Almeida",
    role: "Motorista de Entregas",
    initials: "CA"
  };

  /* -------------------- Utilidades -------------------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "class") node.className = attrs[key];
        else if (key === "text") node.textContent = attrs[key];
        else if (key === "html") node.innerHTML = attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    (children || []).forEach(function (child) {
      if (typeof child === "string") node.appendChild(document.createTextNode(child));
      else if (child) node.appendChild(child);
    });
    return node;
  }

  function storageGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* armazenamento indisponível */ }
  }

  function formatDate(iso) {
    var parts = iso.split("-");
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  var STATUS_MAP = {
    "Entregue": "entregue",
    "Em rota": "rota",
    "Pendente": "pendente",
    "Atrasado": "atrasado"
  };

  /* -------------------- Dados simulados (mock) -------------------- */
  var ENTREGAS = [
    { id: "ENT-1042", inicio: "2026-07-06", prevista: "2026-07-08", destino: "Campinas - SP", status: "Entregue" },
    { id: "ENT-1047", inicio: "2026-07-09", prevista: "2026-07-11", destino: "São Paulo - SP", status: "Entregue" },
    { id: "ENT-1070", inicio: "2026-07-11", prevista: "2026-07-13", destino: "Sorocaba - SP", status: "Atrasado" },
    { id: "ENT-1051", inicio: "2026-07-10", prevista: "2026-07-13", destino: "Santos - SP", status: "Entregue" },
    { id: "ENT-1055", inicio: "2026-07-12", prevista: "2026-07-14", destino: "Guarulhos - SP", status: "Em rota" },
    { id: "ENT-1058", inicio: "2026-07-13", prevista: "2026-07-15", destino: "Osasco - SP", status: "Em rota" },
    { id: "ENT-1061", inicio: "2026-07-14", prevista: "2026-07-16", destino: "Ribeirão Preto - SP", status: "Pendente" },
    { id: "ENT-1064", inicio: "2026-07-14", prevista: "2026-07-18", destino: "Curitiba - PR", status: "Pendente" },
    { id: "ENT-1067", inicio: "2026-07-15", prevista: "2026-07-20", destino: "Belo Horizonte - MG", status: "Pendente" },
    { id: "ENT-1073", inicio: "2026-07-16", prevista: "2026-07-22", destino: "Rio de Janeiro - RJ", status: "Pendente" }
  ];

  /* -------------------- Autenticação -------------------- */
  function isLoggedIn() {
    try { return localStorage.getItem(AUTH_KEY) === "active"; } catch (e) { return false; }
  }

  function guard() {
    if (!isLoggedIn()) { window.location.replace("index.html"); return false; }
    return true;
  }

  function initLogin() {
    if (isLoggedIn()) { window.location.replace("dashboard.html"); return; }
    var form = $("#login-form");
    var errorBox = $("#login-error");
    if (!form) return;

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var user = $("#login-user").value.trim();
      var pass = $("#login-pass").value;
      if (user === CREDENTIALS.user && pass === CREDENTIALS.pass) {
        try { localStorage.setItem(AUTH_KEY, "active"); } catch (e) { /* segue sem persistência */ }
        window.location.href = "dashboard.html";
      } else {
        errorBox.hidden = false;
        $("#login-pass").value = "";
        $("#login-pass").focus();
      }
    });
  }

  function initLogout() {
    $all("[data-logout]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        try { localStorage.removeItem(AUTH_KEY); } catch (e) { /* nada a fazer */ }
        window.location.href = "index.html";
      });
    });
  }

  /* -------------------- Casca comum (menu, usuário, data) -------------------- */
  function initShell() {
    var sidebar = $("#sidebar");
    var overlay = $("[data-overlay]");
    var toggle = $("[data-menu-toggle]");

    function closeMenu() {
      if (sidebar) sidebar.classList.remove("open");
      if (overlay) overlay.classList.remove("show");
    }

    if (toggle && sidebar) {
      toggle.addEventListener("click", function () {
        sidebar.classList.toggle("open");
        if (overlay) overlay.classList.toggle("show");
      });
    }
    if (overlay) overlay.addEventListener("click", closeMenu);
    $all(".nav-link").forEach(function (link) { link.addEventListener("click", closeMenu); });

    $all("[data-user-name]").forEach(function (n) { n.textContent = PROFILE.name; });
    $all("[data-user-initials]").forEach(function (n) { n.textContent = PROFILE.initials; });

    var dateBox = $("[data-current-date]");
    if (dateBox) {
      var now = new Date();
      dateBox.textContent = now.toLocaleDateString("pt-BR", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric"
      });
    }
  }

  /* -------------------- Feed de entregas -------------------- */
  function renderFeed() {
    var feed = $("#delivery-feed");
    if (!feed) return;

    var sorted = ENTREGAS.slice().sort(function (a, b) {
      return a.prevista < b.prevista ? -1 : 1;
    });

    sorted.forEach(function (item) {
      var statusKey = STATUS_MAP[item.status] || "pendente";
      var row = el("div", { class: "delivery-item" }, [
        el("div", {}, [
          el("div", { class: "delivery-item__id", text: item.id }),
          el("div", { class: "delivery-item__dates", text: "Início " + formatDate(item.inicio) + " · Prevista " + formatDate(item.prevista) })
        ]),
        el("div", { class: "delivery-item__dest" }, [
          document.createTextNode(item.destino),
          el("small", { text: "Destino final" })
        ]),
        el("span", { class: "badge badge--" + statusKey, text: item.status })
      ]);
      feed.appendChild(row);
    });

    var countBox = $("#feed-count");
    if (countBox) {
      var ativas = ENTREGAS.filter(function (e) { return e.status !== "Entregue"; }).length;
      countBox.textContent = ativas + (ativas === 1 ? " ativa" : " ativas");
    }
  }

  /* -------------------- Disponibilidade -------------------- */
  var DISP_KEY = "logicorp.disponibilidade";

  function renderAvailability() {
    var list = $("#availability-list");
    if (!list) return;
    var items = storageGet(DISP_KEY, []);
    list.innerHTML = "";

    if (!items.length) {
      list.appendChild(el("p", { class: "list-empty", text: "Nenhum horário cadastrado. Adicione sua disponibilidade acima." }));
      return;
    }

    items.forEach(function (item, index) {
      var removeBtn = el("button", { class: "btn btn--danger-ghost btn--sm", type: "button", "aria-label": "Remover horário de " + item.day }, ["Remover"]);
      removeBtn.addEventListener("click", function () {
        var current = storageGet(DISP_KEY, []);
        current.splice(index, 1);
        storageSet(DISP_KEY, current);
        renderAvailability();
      });

      list.appendChild(el("div", { class: "availability-row" }, [
        el("span", { class: "availability-row__day", text: item.day }),
        el("span", { class: "availability-row__hours", text: item.start + " — " + item.end }),
        removeBtn
      ]));
    });
  }

  function initAvailability() {
    var form = $("#availability-form");
    if (!form) return;
    var errorBox = $("#disp-error");

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var day = $("#disp-day").value;
      var start = $("#disp-start").value;
      var end = $("#disp-end").value;

      if (!day || !start || !end) {
        errorBox.textContent = "Preencha dia, horário de início e término.";
        errorBox.hidden = false;
        return;
      }
      if (start >= end) {
        errorBox.textContent = "O horário de término deve ser posterior ao início.";
        errorBox.hidden = false;
        return;
      }
      errorBox.hidden = true;

      var items = storageGet(DISP_KEY, []);
      var existing = -1;
      items.forEach(function (it, i) { if (it.day === day) existing = i; });
      if (existing >= 0) items[existing] = { day: day, start: start, end: end };
      else items.push({ day: day, start: start, end: end });

      var ORDER = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
      items.sort(function (a, b) { return ORDER.indexOf(a.day) - ORDER.indexOf(b.day); });

      storageSet(DISP_KEY, items);
      renderAvailability();
    });

    renderAvailability();
  }

  /* -------------------- Calendário interativo -------------------- */
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  var calState = { year: null, month: null, selected: null };

  function deliveriesByDate() {
    var map = {};
    ENTREGAS.forEach(function (e) {
      if (!map[e.prevista]) map[e.prevista] = [];
      map[e.prevista].push(e);
    });
    return map;
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function renderCalendar() {
    var grid = $("#calendar-grid");
    if (!grid) return;
    var map = deliveriesByDate();
    var today = new Date();
    var todayIso = today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate());

    $("#cal-title-label").textContent = MESES[calState.month] + " de " + calState.year;
    grid.innerHTML = "";

    var firstDay = new Date(calState.year, calState.month, 1).getDay();
    var daysInMonth = new Date(calState.year, calState.month + 1, 0).getDate();

    for (var i = 0; i < firstDay; i++) {
      grid.appendChild(el("div", { class: "calendar__day calendar__day--empty" }));
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var iso = calState.year + "-" + pad(calState.month + 1) + "-" + pad(d);
      var dayDeliveries = map[iso] || [];
      var classes = "calendar__day";
      if (iso === todayIso) classes += " calendar__day--today";
      if (iso === calState.selected) classes += " calendar__day--selected";
      if (dayDeliveries.length) classes += " has-deliveries";

      var cell = el("div", { class: classes, role: "gridcell" }, [
        el("span", { text: "" + d })
      ]);

      if (dayDeliveries.length) {
        var dots = el("div", { class: "calendar__dots" });
        dayDeliveries.slice(0, 4).forEach(function (item) {
          dots.appendChild(el("i", { class: "calendar__dot calendar__dot--" + (STATUS_MAP[item.status] || "pendente") }));
        });
        cell.appendChild(dots);
        (function (isoRef) {
          cell.addEventListener("click", function () {
            calState.selected = isoRef;
            renderCalendar();
            renderCalendarDetail(isoRef);
          });
        })(iso);
      }
      grid.appendChild(cell);
    }
  }

  function renderCalendarDetail(iso) {
    var box = $("#calendar-detail");
    if (!box) return;
    var map = deliveriesByDate();
    var items = map[iso] || [];
    box.innerHTML = "";

    var parts = iso.split("-");
    box.appendChild(el("div", { class: "calendar__detail-title", text: "Entregas em " + parts[2] + "/" + parts[1] + "/" + parts[0] }));

    if (!items.length) {
      box.appendChild(el("p", { class: "list-empty mt-0", text: "Nenhuma entrega prevista para esta data." }));
      return;
    }

    items.forEach(function (item) {
      box.appendChild(el("div", { class: "calendar__detail-item" }, [
        el("div", {}, [
          el("strong", { text: item.id }),
          document.createTextNode(" — " + item.destino)
        ]),
        el("span", { class: "badge badge--" + (STATUS_MAP[item.status] || "pendente"), text: item.status })
      ]));
    });
  }

  function initCalendar() {
    var grid = $("#calendar-grid");
    if (!grid) return;

    var weekdaysBox = $("#calendar-weekdays");
    if (weekdaysBox) {
      DIAS_SEMANA.forEach(function (dia) {
        weekdaysBox.appendChild(el("div", { class: "calendar__weekday", text: dia }));
      });
    }

    var today = new Date();
    calState.year = today.getFullYear();
    calState.month = today.getMonth();

    $("#cal-prev").addEventListener("click", function () {
      calState.month--;
      if (calState.month < 0) { calState.month = 11; calState.year--; }
      renderCalendar();
    });
    $("#cal-next").addEventListener("click", function () {
      calState.month++;
      if (calState.month > 11) { calState.month = 0; calState.year++; }
      renderCalendar();
    });

    renderCalendar();

    /* Seleciona automaticamente o dia de hoje, se houver entregas */
    var todayIso = today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate());
    var map = deliveriesByDate();
    if (map[todayIso]) {
      calState.selected = todayIso;
      renderCalendar();
      renderCalendarDetail(todayIso);
    }
  }

  /* -------------------- FAQ (acordeão) -------------------- */
  function initFaq() {
    $all(".faq__question").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".faq__item");
        var answer = item.querySelector(".faq__answer");
        var isOpen = item.classList.toggle("open");
        btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        answer.style.maxHeight = isOpen ? answer.scrollHeight + "px" : "0";
      });
    });
  }

  /* -------------------- Chamados (Suporte / RH) -------------------- */
  function initTicketForm(formId, listId, storageKey, prefix) {
    var form = $("#" + formId);
    var list = $("#" + listId);
    if (!form || !list) return;

    function render() {
      var tickets = storageGet(storageKey, []);
      list.innerHTML = "";
      if (!tickets.length) {
        list.appendChild(el("p", { class: "list-empty", text: "Nenhum registro enviado até o momento." }));
        return;
      }
      tickets.slice().reverse().forEach(function (t) {
        list.appendChild(el("div", { class: "ticket" }, [
          el("div", {}, [
            el("div", { class: "ticket__protocol", text: t.protocol }),
            el("div", { class: "ticket__subject", text: t.subject }),
            el("div", { class: "ticket__meta", text: t.category + " · Aberto em " + t.date })
          ]),
          el("span", { class: "badge badge--pendente", text: "Em análise" })
        ]));
      });
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var subjectField = form.querySelector("[name=subject]");
      var categoryField = form.querySelector("[name=category]");
      var messageField = form.querySelector("[name=message]");
      var successBox = form.querySelector(".form__success");

      var subject = subjectField ? subjectField.value.trim() : "";
      if (!subject) { subjectField.focus(); return; }

      var now = new Date();
      var protocol = prefix + "-" + now.getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);
      var ticket = {
        protocol: protocol,
        subject: subject,
        category: categoryField ? categoryField.value : "Geral",
        message: messageField ? messageField.value.trim() : "",
        date: now.toLocaleDateString("pt-BR")
      };

      var tickets = storageGet(storageKey, []);
      tickets.push(ticket);
      storageSet(storageKey, tickets);

      form.reset();
      if (successBox) {
        successBox.textContent = "Registro enviado com sucesso. Protocolo: " + protocol;
        successBox.hidden = false;
        setTimeout(function () { successBox.hidden = true; }, 6000);
      }
      render();
    });

    render();
  }

  /* -------------------- Inicialização por página -------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.getAttribute("data-page");

    if (page === "login") {
      initLogin();
      return;
    }

    if (!guard()) return;

    initShell();
    initLogout();
    initFaq();

    if (page === "dashboard") {
      renderFeed();
      initAvailability();
      initCalendar();
    }

    if (page === "suporte") {
      initTicketForm("ticket-form", "ticket-list", "logicorp.chamados.suporte", "SUP");
    }

    if (page === "rh") {
      initTicketForm("rh-form", "rh-list", "logicorp.chamados.rh", "RH");
    }
  });
})();

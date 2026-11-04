/* =========================================================
   Mills Brewery — app (vanilla JS)
   ========================================================= */
(() => {
  "use strict";

  const WHATSAPP = "5531995272062";
  const FREE_SHIPPING = 250;
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ---------- Persistência ---------- */
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* armazenamento indisponível: segue só em memória */
      }
    },
  };

  /* ---------- Estado ---------- */
  const state = {
    cart: sanitizeCart(store.get("mills-cart", {})),
    wish: new Set(store.get("mills-wish", []).filter((id) => byId[id])),
    filter: "todos",
    query: "",
    sort: "relevancia",
  };

  function sanitizeCart(obj) {
    const out = {};
    for (const [id, qty] of Object.entries(obj || {})) {
      if (byId[id] && Number.isInteger(qty) && qty > 0) out[id] = Math.min(qty, 99);
    }
    return out;
  }

  /* ---------- Helpers ---------- */
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const fmt = (n) => brl.format(n);
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const discount = (p) => (p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);
  const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const cartQty = () => Object.values(state.cart).reduce((a, b) => a + b, 0);
  const cartTotal = () => Object.entries(state.cart).reduce((s, [id, q]) => s + byId[id].price * q, 0);
  const cartSavings = () =>
    Object.entries(state.cart).reduce((s, [id, q]) => {
      const p = byId[id];
      return s + (p.oldPrice ? (p.oldPrice - p.price) * q : 0);
    }, 0);

  function badgesHTML(p) {
    const out = [];
    if (p.tags.includes("lancamento")) out.push(`<span class="badge badge--new">Lançamento</span>`);
    const off = discount(p);
    if (off) out.push(`<span class="badge badge--off">-${off}%</span>`);
    if (p.tags.includes("sem-alcool")) out.push(`<span class="badge badge--light">Sem álcool</span>`);
    else if (p.tags.includes("low-carb")) out.push(`<span class="badge badge--light">Sem glúten</span>`);
    return out.join("");
  }

  function priceHTML(p, extra = "") {
    return `<div class="price ${p.oldPrice ? "price--sale" : ""} ${extra}">
      ${p.oldPrice ? `<s>${fmt(p.oldPrice)}</s>` : ""}
      <strong>${fmt(p.price)}</strong>
    </div>`;
  }

  /* ---------- Ficha técnica ----------
     Cada linha só aparece se o produto tiver o dado. Para incluir a
     temperatura de serviço, basta preencher `temp` em products.js. */
  const SPEC_ROWS = [
    { icon: "glass", label: "Estilo", value: (p) => p.style },
    { icon: "hop", label: "Lúpulos e ingredientes", value: (p) => p.ingr },
    { icon: "drop", label: "Volume", value: (p) => p.volume && p.volume.replace("ml", " ml") },
    { icon: "citrus", label: "Aroma e sabor", value: (p) => p.notes },
    { icon: "snow", label: "Temperatura de serviço", value: (p) => p.temp },
    {
      icon: "percent",
      label: "Teor alcoólico e amargor",
      value: (p) =>
        [p.abv && `${p.abv} vol./álc.`, p.ibu && `${p.ibu} IBU`].filter(Boolean).join(" · "),
    },
  ];

  const hasSpecs = (p) => p.category === "cervejas";

  function specRow(icon, label, text, extra = "") {
    return `<li title="${label}: ${text}">${icon ? `<svg aria-hidden="true"><use href="#i-${icon}"/></svg>` : ""}<span><span class="sr-only">${label}: </span>${text}</span>${extra}</li>`;
  }

  // compact = card (1 linha por dado, só a principal medalha); senão = detalhe completo
  function specsHTML(p, compact = true) {
    const rows = SPEC_ROWS.map((r) => [r, r.value(p)])
      .filter(([, v]) => v)
      .map(([r, v]) => specRow(r.icon, r.label, v));

    const awards = p.awards || [];
    if (awards.length) {
      if (compact) {
        const more = awards.length > 1 ? `<em class="specs__more-n">+${awards.length - 1}</em>` : "";
        rows.push(specRow("medal", "Premiação", awards[0], more));
      } else {
        awards.forEach((a) => rows.push(specRow("medal", "Premiação", a)));
      }
    }
    return rows.join("");
  }

  function subtitle(p) {
    return [p.style, p.volume].filter(Boolean).join(" · ");
  }

  function buyHTML(p) {
    const qty = state.cart[p.id] || 0;
    if (!qty) {
      return `<button class="add" data-add="${p.id}" aria-label="Adicionar ${p.name} ao carrinho">${icon("plus")}<span>Adicionar</span></button>`;
    }
    return `<div class="stepper" aria-label="Quantidade de ${p.name}">
      <button type="button" data-step="-1" data-id="${p.id}" aria-label="Diminuir">${icon("minus")}</button>
      <output>${qty}</output>
      <button type="button" data-step="1" data-id="${p.id}" aria-label="Aumentar">${icon("plus")}</button>
    </div>`;
  }

  function cardHTML(p, i = 0) {
    const on = state.wish.has(p.id);
    return `<article class="card" data-card="${p.id}" style="--i:${Math.min(i, 12)}">
      <div class="card__media" data-view="${p.id}">
        <img src="${p.img}" alt="${p.name}" loading="lazy" width="448" height="448" />
        <div class="badges">${badgesHTML(p)}</div>
        <button class="wish ${on ? "is-on" : ""}" data-wish="${p.id}" aria-pressed="${on}" aria-label="${on ? "Remover dos" : "Adicionar aos"} favoritos">${icon("heart")}</button>
        ${
          hasSpecs(p)
            ? `<div class="card__specs">
                <ul class="specs">${specsHTML(p)}</ul>
                <button class="specs__cta" data-view="${p.id}">Ver detalhes ${icon("arrow")}</button>
              </div>`
            : `<button class="card__peek" data-view="${p.id}">Ver detalhes</button>`
        }
      </div>
      <div class="card__body">
        <span class="card__style">${subtitle(p)}</span>
        <h3 class="card__name"><a href="#${p.id}" data-view="${p.id}">${p.name}</a></h3>
        <div class="card__foot">
          ${priceHTML(p)}
          <div class="card__buy">${buyHTML(p)}</div>
        </div>
      </div>
    </article>`;
  }

  /* ---------- Catálogo ---------- */
  const grid = $("#grid");
  const rail = $("#rail");

  const FILTERS = {
    todos: () => true,
    lancamento: (p) => p.tags.includes("lancamento"),
    cervejas: (p) => p.category === "cervejas",
    packs: (p) => p.category === "packs",
    souvenir: (p) => p.category === "souvenir",
    leves: (p) => p.tags.includes("sem-alcool") || p.tags.includes("low-carb"),
    promo: (p) => !!p.oldPrice,
    favoritos: (p) => state.wish.has(p.id),
  };

  const SORTS = {
    relevancia: null,
    menor: (a, b) => a.price - b.price,
    maior: (a, b) => b.price - a.price,
    az: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
    desconto: (a, b) => discount(b) - discount(a),
  };

  function visibleProducts() {
    const q = norm(state.query.trim());
    let list = PRODUCTS.filter(FILTERS[state.filter]);
    if (q) list = list.filter((p) => norm(`${p.name} ${p.style}`).includes(q));
    if (SORTS[state.sort]) list = [...list].sort(SORTS[state.sort]);
    return list;
  }

  function renderGrid() {
    const list = visibleProducts();
    grid.innerHTML = list.map(cardHTML).join("");
    $("#empty").hidden = list.length > 0;
    $("#results").textContent = list.length
      ? `${list.length} ${list.length === 1 ? "produto" : "produtos"}`
      : "";
  }

  function renderRail() {
    rail.innerHTML = PRODUCTS.filter(FILTERS.lancamento).map(cardHTML).join("");
    updateRailNav();
  }

  function setFilter(filter) {
    state.filter = filter;
    $$(".chip").forEach((c) => {
      const on = c.dataset.filter === filter;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-selected", on);
    });
    renderGrid();
  }

  // Atualiza só o bloco de compra dos cards daquele produto (sem re-render completo)
  function refreshCard(id) {
    $$(`[data-card="${id}"] .card__buy`).forEach((el) => (el.innerHTML = buyHTML(byId[id])));
  }

  function refreshWish(id) {
    const on = state.wish.has(id);
    $$(`[data-wish="${id}"]`).forEach((b) => {
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on);
      b.setAttribute("aria-label", `${on ? "Remover dos" : "Adicionar aos"} favoritos`);
      b.classList.remove("pop");
      void b.offsetWidth;
      b.classList.add("pop");
    });
  }

  /* ---------- Carrinho ---------- */
  function setQty(id, qty) {
    qty = Math.max(0, Math.min(99, qty));
    if (qty) state.cart[id] = qty;
    else delete state.cart[id];
    store.set("mills-cart", state.cart);
    refreshCard(id);
    renderCart();
  }

  function addToCart(id, amount = 1) {
    const before = cartQty();
    setQty(id, (state.cart[id] || 0) + amount);
    if (cartQty() !== before) {
      bump($("#cartCount"));
      toast(byId[id], amount);
    }
  }

  function renderCart() {
    const qty = cartQty();
    const total = cartTotal();
    const savings = cartSavings();

    const countEl = $("#cartCount");
    countEl.hidden = qty === 0;
    countEl.textContent = qty;
    $("#cartHeadCount").textContent = qty ? `(${qty})` : "";

    const ids = Object.keys(state.cart);
    $("#cartItems").innerHTML = ids
      .map((id) => {
        const p = byId[id];
        const q = state.cart[id];
        return `<li class="line">
          <div class="line__img"><img src="${p.img}" alt="" /></div>
          <div>
            <p class="line__name">${p.name}</p>
            <p class="line__meta">${fmt(p.price)} un.</p>
            <div class="stepper stepper--sm">
              <button type="button" data-step="-1" data-id="${id}" aria-label="Diminuir">${icon("minus")}</button>
              <output>${q}</output>
              <button type="button" data-step="1" data-id="${id}" aria-label="Aumentar">${icon("plus")}</button>
            </div>
          </div>
          <div class="line__right">
            <span class="line__price">${fmt(p.price * q)}</span>
            <button class="line__remove" data-remove="${id}">Remover</button>
          </div>
        </li>`;
      })
      .join("");

    const empty = ids.length === 0;
    $("#cartEmpty").hidden = !empty;
    $("#cartItems").hidden = empty;
    $("#cartFoot").hidden = empty;
    $("#ship").hidden = empty;

    $("#cartSubtotal").textContent = fmt(total);
    $("#cartSavingsRow").hidden = savings <= 0;
    $("#cartSavings").textContent = fmt(savings);

    const missing = FREE_SHIPPING - total;
    const ship = $("#ship");
    ship.classList.toggle("is-done", missing <= 0);
    $("#shipText").innerHTML =
      missing > 0
        ? `Faltam <strong>${fmt(missing)}</strong> para o frete grátis no Sudeste.`
        : `Você ganhou <strong>frete grátis</strong> para o Sudeste!`;
    $("#shipBar").style.width = `${Math.min(100, (total / FREE_SHIPPING) * 100)}%`;

    $("#checkoutBtn").href = checkoutLink();
  }

  function checkoutLink() {
    const lines = Object.entries(state.cart).map(
      ([id, q]) => `• ${q}x ${byId[id].name} — ${fmt(byId[id].price * q)}`
    );
    const msg = [
      "Olá, Mills! Gostaria de fazer este pedido pelo site:",
      "",
      ...lines,
      "",
      `Subtotal: ${fmt(cartTotal())}`,
    ].join("\n");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }

  /* ---------- Drawer ---------- */
  const drawer = $("#cart");
  const scrim = $("#scrim");
  let lastFocus = null;

  function openCart() {
    lastFocus = document.activeElement;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    scrim.hidden = false;
    document.body.classList.add("is-locked");
    setTimeout(() => $(".drawer__head .icon-btn", drawer).focus(), 50);
  }

  function closeCart() {
    if (!drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    scrim.hidden = true;
    document.body.classList.remove("is-locked");
    lastFocus?.focus?.();
  }

  /* ---------- Favoritos ---------- */
  function toggleWish(id) {
    if (state.wish.has(id)) state.wish.delete(id);
    else state.wish.add(id);
    store.set("mills-wish", [...state.wish]);
    refreshWish(id);
    renderWishCount();
    if (state.filter === "favoritos") renderGrid();
    if (qvId === id) syncQvWish();
  }

  function renderWishCount() {
    const el = $("#wishCount");
    el.hidden = state.wish.size === 0;
    el.textContent = state.wish.size;
  }

  /* ---------- Detalhe do produto ---------- */
  const qv = $("#quickView");
  let qvId = null;
  let qvQty = 1;

  function openQuickView(id) {
    const p = byId[id];
    qvId = id;
    qvQty = 1;
    $("#qvImg").src = p.img;
    $("#qvImg").alt = p.name;
    $("#qvBadges").innerHTML = badgesHTML(p);
    $("#qvStyle").textContent = p.style;
    $("#qvName").textContent = p.name;
    $("#qvPrice").outerHTML = priceHTML(p, "price--lg").replace('class="price', 'id="qvPrice" class="price');
    $("#qvDesc").textContent = p.desc;

    const specs = $("#qvSpecs");
    specs.innerHTML = hasSpecs(p) ? specsHTML(p, false) : "";
    specs.hidden = !hasSpecs(p);
    $("#qvQty").textContent = qvQty;
    syncQvWish();
    qv.showModal();
  }

  function syncQvWish() {
    const on = state.wish.has(qvId);
    const b = $("#qvWish");
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", on);
  }

  /* ---------- Toast ---------- */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(p, amount) {
    toastEl.innerHTML = `<img src="${p.img}" alt="" />
      <span>${amount > 1 ? `${amount}× ` : ""}${p.name} no carrinho</span>
      <button type="button" data-open-cart>Ver carrinho</button>`;
    toastEl.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 2800);
  }

  function bump(el) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  /* ---------- Rail ---------- */
  function updateRailNav() {
    const max = rail.scrollWidth - rail.clientWidth - 2;
    $('[data-rail="-1"]').disabled = rail.scrollLeft <= 2;
    $('[data-rail="1"]').disabled = rail.scrollLeft >= max;
  }

  /* ---------- Menu mobile ---------- */
  const nav = $("#nav");
  const menuBtn = $("#menuBtn");
  function setMenu(open) {
    nav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.innerHTML = icon(open ? "close" : "menu");
  }

  function goToCatalog(filter) {
    if (filter) setFilter(filter);
    $("#catalogo").scrollIntoView({ behavior: "smooth" });
  }

  /* ---------- Eventos ---------- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest(
      "[data-add],[data-step],[data-wish],[data-view],[data-remove],[data-open-cart],[data-close-cart],[data-nav-filter],[data-rail],[data-close-modal]"
    );
    if (!t) return;

    if (t.dataset.wish) return toggleWish(t.dataset.wish);
    if (t.dataset.add) return addToCart(t.dataset.add);
    if (t.dataset.step) {
      const id = t.dataset.id;
      return setQty(id, (state.cart[id] || 0) + Number(t.dataset.step));
    }
    if (t.dataset.remove) return setQty(t.dataset.remove, 0);
    if (t.dataset.view) {
      e.preventDefault();
      return openQuickView(t.dataset.view);
    }
    if ("openCart" in t.dataset) {
      toastEl.classList.remove("is-show");
      return openCart();
    }
    if ("closeCart" in t.dataset) {
      closeCart();
      if (t.dataset.goto) $(t.dataset.goto).scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (t.dataset.navFilter) {
      e.preventDefault();
      setMenu(false);
      return goToCatalog(t.dataset.navFilter);
    }
    if (t.dataset.rail) {
      return rail.scrollBy({ left: Number(t.dataset.rail) * rail.clientWidth * 0.9, behavior: "smooth" });
    }
    if ("closeModal" in t.dataset) return t.closest("dialog").close();
  });

  $("#chips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) setFilter(chip.dataset.filter);
  });

  let searchTimer;
  $("#searchInput").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = e.target.value;
      renderGrid();
    }, 120);
  });

  $("#sortSelect").addEventListener("change", (e) => {
    state.sort = e.target.value;
    renderGrid();
  });

  $("#clearFilters").addEventListener("click", () => {
    state.query = "";
    $("#searchInput").value = "";
    setFilter("todos");
  });

  $("#searchBtn").addEventListener("click", () => {
    setMenu(false);
    $("#catalogo").scrollIntoView({ behavior: "smooth" });
    const box = $("#searchBox");
    setTimeout(() => {
      $("#searchInput").focus({ preventScroll: true });
      box.classList.remove("flash");
      void box.offsetWidth;
      box.classList.add("flash");
    }, 450);
  });

  $("#wishBtn").addEventListener("click", () => {
    setMenu(false);
    goToCatalog("favoritos");
  });

  $("#cartBtn").addEventListener("click", openCart);
  scrim.addEventListener("click", closeCart);
  menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
  $$("#nav a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCart();
      setMenu(false);
    }
  });

  // Quick view: quantidade, adicionar, favoritar, fechar clicando fora
  $$("[data-qv-step]").forEach((b) =>
    b.addEventListener("click", () => {
      qvQty = Math.max(1, Math.min(99, qvQty + Number(b.dataset.qvStep)));
      $("#qvQty").textContent = qvQty;
    })
  );
  $("#qvAdd").addEventListener("click", () => {
    addToCart(qvId, qvQty);
    qv.close();
  });
  $("#qvWish").addEventListener("click", () => toggleWish(qvId));
  qv.addEventListener("click", (e) => {
    if (e.target === qv) qv.close(); // clique no backdrop
  });

  rail.addEventListener("scroll", updateRailNav, { passive: true });
  window.addEventListener("resize", updateRailNav);

  // Toolbar "grudada" ganha borda
  const toolbar = $(".toolbar");
  const onScroll = () => {
    const headerH = $(".header").offsetHeight;
    toolbar.classList.toggle("is-stuck", toolbar.getBoundingClientRect().top <= headerH + 1);
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Verificação de idade ---------- */
  const age = $("#ageGate");
  if (!store.get("mills-age-ok", false)) {
    age.addEventListener("cancel", (e) => e.preventDefault()); // não fecha com Esc
    age.showModal();
    $("#ageYes").addEventListener("click", () => {
      store.set("mills-age-ok", true);
      age.close();
    });
    $("#ageNo").addEventListener("click", () => {
      $("#ageTitle").textContent = "Volte em breve!";
      $("#ageText").textContent = "A venda de bebidas alcoólicas é proibida para menores de 18 anos.";
      $("#ageCtas").hidden = true;
    });
  }

  /* ---------- Init ---------- */
  $("#year").textContent = new Date().getFullYear();
  renderRail();
  renderGrid();
  renderCart();
  renderWishCount();
})();

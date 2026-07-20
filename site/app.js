/* StyleStashHome — montra dinâmica (lê montra.json exportado pela app de gestão) */
(function () {
  "use strict";

  const grid = document.querySelector("[data-grid]");
  const chipsBox = document.querySelector("[data-chips]");
  const emptyBox = document.querySelector("[data-empty]");
  const updatedEl = document.querySelector("[data-updated]");
  const footerEl = document.querySelector("[data-montra-footer]");
  const vendasEl = document.querySelector('[data-stat="vendas"]');
  const anoEl = document.querySelector("[data-ano]");

  if (anoEl) anoEl.textContent = String(new Date().getFullYear());

  const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
  let pecas = [];
  let filtro = "todas";

  /* Agrupa variantes de marca ("Ralph Lauren (NL)" → "Ralph Lauren") */
  function marcaBase(marca) {
    if (!marca) return "Outras";
    const base = marca.trim();
    for (const m of ["Ralph Lauren", "Carhartt", "Lacoste"]) {
      if (base.toLowerCase().startsWith(m.toLowerCase())) return m;
    }
    return base;
  }

  function cardHTML(p) {
    const meta = [p.tamanho, p.estado].filter(Boolean).join(" · ");
    const preco =
      p.preco !== null && p.preco !== undefined
        ? eur.format(p.preco)
        : '<small>preço na Vinted</small>';
    const badge = p.disponivel ? "" : '<span class="card-badge">Brevemente</span>';
    const href = p.link || "https://www.vinted.pt/member/195656793";
    return `
      <a class="card reveal" href="${href}" target="_blank" rel="noopener">
        <span class="card-photo">${badge}
          <img src="${p.foto}" alt="${escapeHtml(p.nome)}" loading="lazy" />
        </span>
        <span class="card-info">
          ${p.marca ? `<span class="card-brand">${escapeHtml(marcaBase(p.marca))}</span>` : ""}
          <span class="card-name">${escapeHtml(p.nome)}</span>
          ${meta ? `<span class="card-meta">${escapeHtml(meta)}</span>` : ""}
          <span class="card-price">${preco}</span>
        </span>
      </a>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function render() {
    const visiveis =
      filtro === "todas" ? pecas : pecas.filter((p) => marcaBase(p.marca) === filtro);
    grid.innerHTML = visiveis.map(cardHTML).join("");
    observeReveals(grid);
  }

  function renderChips() {
    const marcas = [...new Set(pecas.map((p) => marcaBase(p.marca)))];
    if (marcas.length < 2) return; // sem filtros se só há uma marca
    const todas = ["todas", ...marcas];
    chipsBox.innerHTML = todas
      .map(
        (m) =>
          `<button class="chip" type="button" data-marca="${escapeHtml(m)}"
             aria-pressed="${m === filtro}">${m === "todas" ? "Todas" : escapeHtml(m)}</button>`,
      )
      .join("");
    chipsBox.hidden = false;
    chipsBox.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      filtro = btn.dataset.marca;
      chipsBox
        .querySelectorAll(".chip")
        .forEach((c) => c.setAttribute("aria-pressed", String(c === btn)));
      render();
    });
  }

  /* reveal-on-scroll */
  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const en of entries) {
              if (en.isIntersecting) {
                en.target.classList.add("on");
                io.unobserve(en.target);
              }
            }
          },
          { threshold: 0.12 },
        )
      : null;

  function observeReveals(scope) {
    const els = (scope || document).querySelectorAll(".reveal:not(.on)");
    els.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i * 45, 360)}ms`;
      if (io) io.observe(el);
      else el.classList.add("on");
    });
  }

  /* secções estáticas também fazem reveal */
  document
    .querySelectorAll(".step, .sobre-inner, .montra-empty")
    .forEach((el) => el.classList.add("reveal"));
  observeReveals(document);

  /* carregar a montra */
  fetch("montra.json", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then((data) => {
      pecas = Array.isArray(data.pecas) ? data.pecas : [];

      if (data.loja && typeof data.loja.vendas === "number" && vendasEl) {
        vendasEl.textContent = String(data.loja.vendas);
      }
      if (data.atualizado && updatedEl) {
        const d = new Date(data.atualizado);
        updatedEl.textContent = `Atualizada a ${d.toLocaleDateString("pt-PT")}`;
        updatedEl.hidden = false;
      }

      if (pecas.length === 0) {
        emptyBox.hidden = false;
        emptyBox.classList.add("on");
        return;
      }
      renderChips();
      render();
      footerEl.hidden = false;
    })
    .catch(() => {
      // sem montra.json (ex.: primeira publicação) — mostra o estado vazio
      emptyBox.hidden = false;
      emptyBox.classList.add("on");
    });
})();

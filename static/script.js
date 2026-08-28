(function () {
  "use strict";

  const dataEl = document.getElementById("papers-data");
  const papers = JSON.parse(dataEl.textContent);

  const grid = document.getElementById("card-grid");
  const searchInput = document.getElementById("search-input");
  const resultCount = document.getElementById("result-count");
  const classFilterRow = document.getElementById("class-filter");
  const backdrop = document.getElementById("modal-backdrop");
  const modalBody = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");

  const CLASS_COLOR_SLOTS = 8;
  const activeClasses = new Set();

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Method classes come from the Scopus export's method_class_name column,
  // one value per paper, attached to every method/code-link entry of that
  // paper. Colors are assigned in order of first appearance so they stay
  // stable across rebuilds as long as paper ordering doesn't change.
  function collectMethodClasses() {
    const seen = [];
    papers.forEach((paper) => {
      (paper.methods || []).forEach((method) => {
        if (method.method_class && !seen.includes(method.method_class)) {
          seen.push(method.method_class);
        }
      });
    });
    return seen;
  }

  const methodClasses = collectMethodClasses();
  const classColorVar = (className) => {
    const index = methodClasses.indexOf(className);
    if (index === -1) return null;
    return `var(--class-color-${(index % CLASS_COLOR_SLOTS) + 1})`;
  };

  function paperMethodClass(paper) {
    const withClass = (paper.methods || []).find((m) => m.method_class);
    return withClass ? withClass.method_class : null;
  }

  function linkOrNone(link) {
    if (!link) {
      return '<span class="item__link item__link--none">no direct link available</span>';
    }
    const safe = escapeHtml(link);
    return `<a class="item__link" href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
  }

  function renderItemList(items) {
    if (!items || items.length === 0) {
      return `<p class="modal__assessment" style="background:transparent;padding:0;color:var(--color-text-faint);font-style:italic;">None reported.</p>`;
    }
    return `<ul class="item-list">${items
      .map((item) => {
        const colorVar = item.method_class ? classColorVar(item.method_class) : null;
        const style = colorVar ? ` style="--item-accent:${colorVar}"` : "";
        const classChip = item.method_class
          ? `<div class="item__class">${escapeHtml(item.method_class)}</div>`
          : "";
        const typeTag =
          item.method_type
            ? `<span class="tag">${escapeHtml(item.method_type.replace(/_/g, " "))}</span><br>`
            : "";
        const source = item.source ? `<div class="item__source">${escapeHtml(item.source)}</div>` : "";
        const summary = item.summary ? `<div class="item__summary">${escapeHtml(item.summary)}</div>` : "";
        return `<li class="item"${style}>
          ${classChip}
          ${typeTag}
          <div class="item__name">${escapeHtml(item.name || "Untitled")}</div>
          ${source}
          ${summary}
          ${linkOrNone(item.link)}
        </li>`;
      })
      .join("")}</ul>`;
  }

  function statusLabel(status) {
    if (!status) return "—";
    return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }

  function isPartial(paper) {
    return paper.status === "PARTIALLY_REPRODUCIBLE";
  }

  function renderCard(paper) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "card";
    el.setAttribute("data-id", paper.id);

    const partial = isPartial(paper);
    const badgeClass = `card__badge${partial ? " card__badge--partial" : ""}`;
    const badgeText = partial ? "Partially reproducible" : "Reproducible";
    const methodClass = paperMethodClass(paper);
    const classDot = methodClass
      ? `<div class="card__classdots" title="${escapeHtml(methodClass)}">
           <span class="card__classdot" style="background:${classColorVar(methodClass)}"></span>
         </div>`
      : "";

    el.innerHTML = `
      <span class="${badgeClass}">${badgeText}</span>
      <h3 class="card__title">${escapeHtml(paper.title)}</h3>
      <div class="card__meta">${escapeHtml(paper.authors)} &middot; ${paper.year ?? ""}</div>
      ${classDot}
      <p class="card__abstract">${escapeHtml(paper.abstract)}</p>
      <div class="card__footer">
        <span class="card__tagcount">${paper.datasets?.length || 0} datasets &middot; ${paper.methods?.length || 0
      } methods</span>
        <span class="card__open">View details &rarr;</span>
      </div>
    `;
    el.addEventListener("click", () => openModal(paper));
    return el;
  }

  function openModal(paper) {
    const partial = isPartial(paper);
    const badgeClass = `modal__badge${partial ? " modal__badge--partial" : ""}`;
    const badgeText = partial ? "Partially reproducible" : "Reproducible";

    modalBody.innerHTML = `
      <span class="${badgeClass}">${badgeText}</span>
      <h2 class="modal__title">${escapeHtml(paper.title)}</h2>
      <div class="modal__meta">
        ${escapeHtml(paper.authors)} &middot; ${paper.year ?? ""}
        ${paper.doi_url ? `<br><a href="${escapeHtml(paper.doi_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(paper.doi)}</a>` : ""}
      </div>

      <div class="modal__section">
        <h3>Abstract</h3>
        <p class="modal__abstract">${escapeHtml(paper.abstract)}</p>
      </div>

      <div class="modal__section">
        <h3>Reproducibility assessment</h3>
        <p class="modal__assessment">${escapeHtml(paper.reproducibility_assessment)}</p>
      </div>

      <div class="modal__section">
        <h3>Methods (${paper.methods?.length || 0})</h3>
        ${renderItemList(paper.methods)}
      </div>

      <div class="modal__section">
        <h3>Datasets (${paper.datasets?.length || 0})</h3>
        ${renderItemList(paper.datasets)}
      </div>

      <div class="modal__section">
        <h3>Data &amp; code availability on the publication's page</h3>
        <dl class="availability-grid">
          <div>
            <dt>Access</dt>
            <dd>${escapeHtml(statusLabel(paper.availability?.access_status))}</dd>
          </div>
          <div>
            <dt>Data</dt>
            <dd>${escapeHtml(statusLabel(paper.availability?.data_status))}</dd>
          </div>
          <div>
            <dt>Code</dt>
            <dd>${escapeHtml(statusLabel(paper.availability?.code_status))}</dd>
          </div>
        </dl>
        ${paper.availability?.author_statement
        ? `<p class="modal__assessment">${escapeHtml(paper.availability.author_statement)}</p>`
        : ""
      }
        ${renderItemList(paper.availability?.data_links)}
        ${renderItemList(paper.availability?.code_links)}
      </div>
    `;
    backdrop.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    backdrop.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  modalClose.addEventListener("click", closeModal);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  function searchHaystack(paper) {
    const datasetNames = (paper.datasets || []).map((d) => d.name).join(" ");
    const methodNames = (paper.methods || []).map((m) => m.name).join(" ");
    return [paper.title, paper.authors, paper.abstract, datasetNames, methodNames]
      .join(" ")
      .toLowerCase();
  }

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = papers.filter((paper) => {
      if (query && !searchHaystack(paper).includes(query)) return false;
      if (activeClasses.size > 0) {
        const cls = paperMethodClass(paper);
        if (!cls || !activeClasses.has(cls)) return false;
      }
      return true;
    });
    renderGrid(filtered);
  }

  function renderGrid(filtered) {
    grid.innerHTML = "";
    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No papers match your search/filter.";
      grid.appendChild(empty);
    } else {
      filtered.forEach((paper) => grid.appendChild(renderCard(paper)));
    }
    resultCount.textContent = `${filtered.length} of ${papers.length} shown`;
  }

  function renderClassFilter() {
    if (methodClasses.length === 0) {
      classFilterRow.style.display = "none";
      return;
    }
    classFilterRow.innerHTML = methodClasses
      .map((cls) => {
        const safe = escapeHtml(cls);
        return `<button type="button" class="chip" data-class="${safe}" style="--chip-color:${classColorVar(
          cls
        )}">
          <span class="chip__dot"></span>${safe}
        </button>`;
      })
      .join("");

    classFilterRow.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const cls = chip.getAttribute("data-class");
        if (activeClasses.has(cls)) {
          activeClasses.delete(cls);
          chip.classList.remove("is-active");
        } else {
          activeClasses.add(cls);
          chip.classList.add("is-active");
        }
        renderClearButton();
        applyFilters();
      });
    });
    renderClearButton();
  }

  function renderClearButton() {
    const existing = classFilterRow.querySelector(".chip__clear");
    if (existing) existing.remove();
    if (activeClasses.size === 0) return;
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "chip__clear";
    clearBtn.textContent = "Clear method filters";
    clearBtn.addEventListener("click", () => {
      activeClasses.clear();
      classFilterRow.querySelectorAll(".chip.is-active").forEach((c) => c.classList.remove("is-active"));
      renderClearButton();
      applyFilters();
    });
    classFilterRow.appendChild(clearBtn);
  }

  searchInput.addEventListener("input", applyFilters);

  renderClassFilter();
  renderGrid(papers);
})();

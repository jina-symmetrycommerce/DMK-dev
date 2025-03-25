let filterData = [];

class FacetFiltersForm extends HTMLElement {
  constructor() {
    super();
    FacetFiltersForm.bulkOrderBody = document.getElementById("bulk-order-body");
    FacetFiltersForm.locales = document.getElementById("bulk-order-locales");
    this.onActiveFilterClick = this.onActiveFilterClick.bind(this);
    this.debouncedOnSubmit = debounce((event) => {
      this.onSubmitHandler(event);
    }, 500);
    this.querySelector("form").addEventListener(
      "input",
      this.debouncedOnSubmit.bind(this)
    );
  }

  static setListeners() {
    const onHistoryChange = (event) => {
      const searchParams = event.state
        ? event.state.searchParams
        : FacetFiltersForm.searchParamsInitial;
      const searchParamsObj = new URLSearchParams(searchParams);
      if (searchParams === FacetFiltersForm.searchParamsPrev) {
        FacetFiltersForm.renderSearchInput();
        return;
      }
      if (!searchParamsObj.get("facets__search-input")) {
        FacetFiltersForm.renderPage(searchParams, null, false);
        FacetFiltersForm.renderSearchInput();
      }
    };
    window.addEventListener("popstate", onHistoryChange);
  }

  static renderPage(searchParams, event, updateURLHash = true) {
    FacetFiltersForm.searchParamsPrev = searchParams;
    const sections = FacetFiltersForm.getSections();
    const facetDrawer = document.getElementById("FacetDrawer");
    const countContainer = document.getElementById("ProductCount");
    const countContainerMobile = document.getElementById("ProductCountMobile");
    const countContainerDesktop = document.getElementById(
      "ProductCountDesktop"
    );
    if (countContainer) {
      countContainer.classList.add("loading");
    }
    if (countContainerMobile) {
      countContainerMobile.classList.add("loading");
    }
    if (countContainerDesktop) {
      countContainerDesktop.classList.add("loading");
    }
    if (facetDrawer) {
      facetDrawer.classList.add("loading");
    }

    sections.forEach((section) => {
      const url = `${window.location.pathname}?section_id=${section.section}&${searchParams}`;

      const filterDataUrl = (element) => element.url === url;
      filterData.some(filterDataUrl)
        ? FacetFiltersForm.renderSectionFromCache(filterDataUrl, event)
        : FacetFiltersForm.renderSectionFromFetch(url, event);
    });

    if (updateURLHash) FacetFiltersForm.updateURLHash(searchParams);

    document.dispatchEvent(new CustomEvent("collection:reloaded"));
  }

  static renderSectionFromFetch(url, event) {
    fetch(url)
      .then((response) => response.text())
      .then((responseText) => {
        const html = responseText;
        filterData = [...filterData, { html, url }];
        FacetFiltersForm.renderFilters(html, event);
        FacetFiltersForm.renderBulkOrderProducts(html);
        FacetFiltersForm.renderProductCount();
      })
      .catch((e) => {
        console.error(e);
      });
  }

  static renderSectionFromCache(filterDataUrl, event) {
    const html = filterData.find(filterDataUrl).html;
    FacetFiltersForm.renderFilters(html, event);
    FacetFiltersForm.renderBulkOrderProducts(html);
    FacetFiltersForm.renderProductCount();
  }

  static renderBulkOrderProducts(html) {
    document.getElementById("bulk-order-body").innerHTML = new DOMParser()
      .parseFromString(html, "text/html")
      .getElementById("bulk-order-body").innerHTML;
  }

  static renderProductCount(infiniteScroll = false) {
    if (!infiniteScroll) {
      // update number of variants on the page
      FacetFiltersForm.bulkOrderBody.dataset.numVariants =
        document.querySelectorAll(".variant-row").length;
    }
    // update results
    const numVariants = parseInt(
      document.getElementById("bulk-order-body").dataset.numVariants
    );
    const localesJSON = JSON.parse(FacetFiltersForm.locales.textContent);
    const count =
      numVariants == 1
        ? localesJSON["product-one"].replace("1", numVariants)
        : localesJSON["product-other"].replace("#", numVariants);

    const container = document.getElementById("ProductCount");
    const containerMobile = document.getElementById("ProductCountMobile");
    const containerDesktop = document.getElementById("ProductCountDesktop");

    if (container) {
      container.innerHTML = count;
      container.classList.remove("loading");
    }
    if (containerMobile) {
      containerMobile.innerHTML = count;
      containerMobile.classList.remove("loading");
    }
    if (containerDesktop) {
      containerDesktop.innerHTML = count;
      containerDesktop.classList.remove("loading");
    }
  }

  static renderFilters(html, event) {
    const parsedHTML = new DOMParser().parseFromString(html, "text/html");

    const facetDetailsElementsFromFetch = parsedHTML.querySelectorAll(
      "#FacetSortFiltersForm .js-filter, #FacetFiltersForm .js-filter, #FacetFiltersFormMobile .js-filter"
    );
    const facetDetailsElementsFromDom = document.querySelectorAll(
      "#FacetSortFiltersForm .js-filter, #FacetFiltersForm .js-filter, #FacetFiltersFormMobile .js-filter"
    );

    // Remove facets that are no longer returned from the server
    Array.from(facetDetailsElementsFromDom).forEach((currentElement) => {
      if (
        !Array.from(facetDetailsElementsFromFetch).some(
          ({ id }) => currentElement.id === id
        )
      ) {
        currentElement.remove();
      }
    });

    const matchesId = (element) => {
      const jsFilter = event ? event.target.closest(".js-filter") : undefined;
      return jsFilter ? element.id === jsFilter.id : false;
    };

    const facetsToRender = Array.from(facetDetailsElementsFromFetch).filter(
      (element) => !matchesId(element)
    );
    const countsToRender = Array.from(facetDetailsElementsFromFetch).find(
      matchesId
    );
    facetsToRender.forEach((elementToRender, index) => {
      const currentElement = document.getElementById(elementToRender.id);
      // Element already rendered in the DOM so just update the innerHTML
      if (currentElement) {
        document.getElementById(elementToRender.id).innerHTML =
          elementToRender.innerHTML;
      } else {
        if (index > 0) {
          const { className: previousElementClassName, id: previousElementId } =
            facetsToRender[index - 1];
          // Same facet type (eg horizontal/vertical or drawer/mobile)
          if (elementToRender.className === previousElementClassName) {
            document.getElementById(previousElementId).after(elementToRender);
            return;
          }
        }

        if (elementToRender.parentElement) {
          document
            .querySelector(`#${elementToRender.parentElement.id} .js-filter`)
            .before(elementToRender);
        }
      }
    });

    FacetFiltersForm.renderActiveFacets(parsedHTML);
    FacetFiltersForm.renderAdditionalElements(parsedHTML);

    if (countsToRender)
      FacetFiltersForm.renderCounts(
        countsToRender,
        event.target.closest(".js-filter")
      );

    const facetDrawer = document.getElementById("FacetDrawer");
    if (facetDrawer) {
      facetDrawer.classList.remove("loading");
    }
  }

  static renderActiveFacets(html) {
    const activeFacetElementSelectors = [
      ".active-facets-mobile",
      ".active-facets-desktop",
    ];

    activeFacetElementSelectors.forEach((selector) => {
      const activeFacetsElement = html.querySelector(selector);
      if (!activeFacetsElement) return;
      document.querySelector(selector).innerHTML =
        activeFacetsElement.innerHTML;
    });
  }

  static renderAdditionalElements(html) {
    const mobileElementSelectors = [
      ".mobile-facets__open",
      ".facets__open",
      ".sorting",
    ];

    mobileElementSelectors.forEach((selector) => {
      if (!html.querySelector(selector)) return;
      document.querySelector(selector).innerHTML =
        html.querySelector(selector).innerHTML;
    });

    document
      .getElementById("FacetFiltersFormMobile")
      .closest("facet-drawer")
      .bindEvents();
  }

  static renderCounts(source, target) {
    const targetElement = target.querySelector(".facets__selected");
    const sourceElement = source.querySelector(".facets__selected");

    if (sourceElement && targetElement) {
      target.querySelector(".facets__selected").outerHTML =
        source.querySelector(".facets__selected").outerHTML;
    }
  }

  static renderSearchInput() {
    const searchInputsToUpdate = document.querySelectorAll(
      ".facets__search-input"
    );
    searchInputsToUpdate.forEach((element) => {
      element.value = "";
    });
  }

  static updateURLHash(searchParams) {
    history.pushState(
      { searchParams },
      "",
      `${window.location.pathname}${searchParams && "?".concat(searchParams)}`
    );
  }

  static getSections() {
    return [
      {
        section: document.getElementById("bulk-order-body").dataset.id,
      },
    ];
  }

  createSearchParams(form) {
    const formData = new FormData(form);
    return new URLSearchParams(formData);
  }

  mergeSearchParams(form, searchParams) {
    const params = this.createSearchParams(form);
    params.forEach((value, key) => {
      searchParams.append(key, value);
    });
    return searchParams;
  }

  onSubmitForm(searchParams, event) {
    FacetFiltersForm.renderPage(searchParams, event);
  }

  onSubmitHandler(event) {
    event.preventDefault();
    console.log("filter form submit");
    if (event && event.target.id == "facets__search-input") return;
    // FacetSearch.renderPage("", null, false);
    FacetFiltersForm.renderSearchInput();

    const currentForm = event.target.closest("form");
    if (currentForm.id === "FacetFiltersFormMobile") {
      const searchParams = this.createSearchParams(currentForm);
      this.onSubmitForm(searchParams.toString(), event);
    } else {
      let searchParams = new URLSearchParams();

      if (
        currentForm.id === "FacetSortFiltersForm" &&
        currentForm.dataset.filterType === "drawer"
      ) {
        const mobileForm = document.getElementById("FacetFiltersFormMobile");
        searchParams = this.mergeSearchParams(mobileForm, searchParams);
        searchParams.delete("sort_by");
      }

      const sortFilterForms = document.querySelectorAll(
        "facet-filters-form form"
      );
      sortFilterForms.forEach((form) => {
        if (
          form.id === "FacetFiltersForm" ||
          form.id === "FacetSortFiltersForm"
        ) {
          searchParams = this.mergeSearchParams(form, searchParams);
        }
      });

      this.onSubmitForm(searchParams.toString(), event);
    }
  }

  onActiveFilterClick(event) {
    event.preventDefault();
    FacetFiltersForm.renderPage(
      new URL(event.currentTarget.href).searchParams.toString()
    );
  }
}
FacetFiltersForm.searchParamsInitial = window.location.search.slice(1);
FacetFiltersForm.searchParamsPrev = window.location.search.slice(1);
customElements.define("facet-filters-form", FacetFiltersForm);
FacetFiltersForm.setListeners();
FacetFiltersForm.renderProductCount();

class FacetSearch extends HTMLElement {
  constructor() {
    super();
    this.searchInput = this.querySelector(".facets__search-input");
    this.mobileSearchInput = this.querySelector(".mobile-facets__search-input");
    this.mobileSearchSubmit = this.querySelector("#mobileSearchSubmit");
    FacetSearch.bulkOrderBody = document.getElementById("bulk-order-body");
    FacetSearch.locales = document.getElementById("bulk-order-locales");
    FacetSearch.fetchSearchBulkOrderBodyId();
    this.debouncedOnSubmit = debounce((event) => {
      this.onSubmitHandler(event);
    }, 750);
    this.mobileSearchSubmit &&
      this.mobileSearchSubmit.addEventListener(
        "click",
        this.debouncedOnSubmit.bind(this)
      );
    this.searchInput &&
      this.searchInput.addEventListener("input", (event) => {
        console.log(
          "logging event, not debounced: ",
          event.target.value,
          event
        );
      });
    this.searchInput &&
      this.searchInput.addEventListener(
        "input",
        this.debouncedOnSubmit.bind(this)
      );
  }

  static fetchSearchBulkOrderBodyId() {
    fetch(`/search?view=bulk-order`)
      .then((response) => response.text())
      .then((responseText) => {
        const html = responseText;
        this.searchBulkOrderBodyId = new DOMParser()
          .parseFromString(html, "text/html")
          .getElementById("bulk-order-body").dataset.id;
      });
  }

  static setListeners() {
    const onHistoryChange = (event) => {
      const searchParams = event.state
        ? event.state.searchParams
        : FacetSearch.searchParamsInitial;
      const searchParamsObj = new URLSearchParams(searchParams);
      if (searchParams === FacetSearch.searchParamsPrev) return;
      if (searchParamsObj.get("facets__search-input"))
        FacetSearch.renderPage(searchParams, null, false);
    };
    window.addEventListener("popstate", onHistoryChange);
  }

  static renderPage(searchParams, event, updateURLHash = true) {
    console.log("render page func. params are: ", searchParams, event);
    const searchParamsObj = new URLSearchParams(searchParams);
    FacetSearch.searchParamsPrev = searchParams;
    const facetDrawer = document.getElementById("FacetDrawer");
    const countContainer = document.getElementById("ProductCount");
    const countContainerMobile = document.getElementById("ProductCountMobile");
    const countContainerDesktop = document.getElementById(
      "ProductCountDesktop"
    );
    if (countContainer) {
      countContainer.classList.add("loading");
    }
    if (countContainerMobile) {
      countContainerMobile.classList.add("loading");
    }
    if (countContainerDesktop) {
      countContainerDesktop.classList.add("loading");
    }
    if (facetDrawer) {
      facetDrawer.classList.add("loading");
    }
    let url = "/collections/bulk-order";
    if (searchParamsObj.get("facets__search-input")) {
      const query = searchParamsObj.get("facets__search-input");
      url = `/search?section_id=${this.searchBulkOrderBodyId}&q=${query}&type=product&view=bulk-order`;
    } else {
      searchParamsObj.delete("facets__search-input");
      searchParams = searchParamsObj.toString();
    }
    const filterDataUrl = (element) => element.url === url;
    filterData.some(filterDataUrl)
      ? FacetSearch.renderSectionFromCache(filterDataUrl, event)
      : FacetSearch.renderSectionFromFetch(url, event);
    if (updateURLHash) FacetSearch.updateURLHash(searchParams);
    document.dispatchEvent(new CustomEvent("collection:reloaded"));
  }

  static renderSectionFromFetch(url) {
    fetch(url)
      .then((response) => response.text())
      .then((responseText) => {
        const html = responseText;
        filterData = [...filterData, { html, url }];
        FacetSearch.renderBulkOrderProducts(html);
        FacetSearch.renderProductCount(html);
      })
      .catch((e) => {
        console.error(e);
      });
  }

  static renderSectionFromCache(filterDataUrl) {
    const html = filterData.find(filterDataUrl).html;
    FacetSearch.renderBulkOrderProducts(html);
    FacetSearch.renderProductCount(html);
    FacetSearch.renderSearchInput(html);
  }

  static renderBulkOrderProducts(html) {
    document.getElementById("bulk-order-body").innerHTML = new DOMParser()
      .parseFromString(html, "text/html")
      .getElementById("bulk-order-body").innerHTML;
  }

  static renderProductCount(html, infiniteScroll = false) {
    const dom = new DOMParser().parseFromString(html, "text/html");
    // recount if not from infinite scroll
    if (!infiniteScroll) {
      // update locales
      FacetSearch.locales.innerHTML =
        dom.getElementById("bulk-order-locales").innerHTML;
      // update number of variants on the page
      FacetSearch.bulkOrderBody.dataset.numVariants =
        dom.querySelectorAll(".variant-row").length;
    }
    const localesJSON = JSON.parse(FacetSearch.locales.textContent);
    // update results
    const numVariants = parseInt(
      document.getElementById("bulk-order-body").dataset.numVariants
    );
    const count =
      numVariants == 1
        ? localesJSON["search-one"].replace("1", numVariants)
        : localesJSON["search-other"].replace("#", numVariants);
    const container = document.getElementById("ProductCount");
    const containerMobile = document.getElementById("ProductCountMobile");
    const containerDesktop = document.getElementById("ProductCountDesktop");
    if (container) {
      container.innerHTML = count;
      container.classList.remove("loading");
    }
    if (containerMobile) {
      containerMobile.innerHTML = count;
      containerMobile.classList.remove("loading");
    }
    if (containerDesktop) {
      containerDesktop.innerHTML = count;
      containerDesktop.classList.remove("loading");
    }
  }

  static renderSearchInput(html) {
    console.log("search input");
    const dom = new DOMParser().parseFromString(html, "text/html");

    const searchInputFetchValue = dom.getElementById("Search-In-Template")
      ? dom.getElementById("Search-In-Template").value
      : "";
    const searchInputsToUpdate = document.querySelectorAll(
      ".facets__search-input"
    );
    searchInputsToUpdate.forEach((element) => {
      element.value = searchInputFetchValue;
    });
  }

  static updateURLHash(searchParams) {
    history.pushState(
      { searchParams },
      "",
      `${window.location.pathname}${searchParams && "?".concat(searchParams)}`
    );
  }

  static getSections() {
    return [
      {
        section: document.getElementById("bulk-order-body").dataset.id,
      },
    ];
  }

  createSearchParams() {
    this.searchInput.value = this.searchInput.value.trim();
    return new URLSearchParams(
      `${this.searchInput.name}=${this.searchInput.value}`
    );
  }
  createMobileSearchParams() {
    this.mobileSearchInput.value = this.mobileSearchInput.value.trim();
    return new URLSearchParams(
      `${this.mobileSearchInput.name}=${this.mobileSearchInput.value}`
    );
  }
  onSubmitForm(searchParams, event) {
    FacetSearch.renderPage(searchParams, event);
  }

  onSubmitHandler(event) {
    event.preventDefault();
    FacetFiltersForm.renderPage("", null, false);
    console.log("this in on submit: ", this);
    console.log("event in on submit: ", event);
    if (event.target === this.mobileSearchSubmit) {
      const searchParams = this.createMobileSearchParams();
      console.log("mobile params: ", searchParams);
      this.onSubmitForm(searchParams.toString(), this.mobileSearchInput.value);
    } else {
      const searchParams = this.createSearchParams();
      this.onSubmitForm(searchParams.toString(), event);
    }
  }
}

FacetSearch.searchParamsInitial = window.location.search.slice(1);
FacetSearch.searchParamsPrev = window.location.search.slice(1);
customElements.define("facet-search", FacetSearch);
FacetSearch.setListeners();

class FacetRemove extends HTMLElement {
  constructor() {
    super();
    this.querySelector("#clearSearchButton") &&
      this.querySelector("#clearSearchButton").addEventListener("click", () => {
        const searchForm =
          this.closest("facet-search") ||
          document.querySelector("facet-search");
        const drawerSummary = document.querySelector("facet-drawer summary");
        searchForm.mobileSearchInput.value = "";
        const searchParams = searchForm.createMobileSearchParams();
        searchForm.onSubmitForm(searchParams.toString(), "");
        drawerSummary && drawerSummary.click();
      });
    this.querySelector("a") &&
      this.querySelector("a").addEventListener("click", (event) => {
        event.preventDefault();
        const form =
          this.closest("facet-filters-form") ||
          document.querySelector("facet-filters-form");
        form.onActiveFilterClick(event);
      });
  }
}
customElements.define("facet-remove", FacetRemove);

class PriceRange extends HTMLElement {
  constructor() {
    super();

    this.min = Number(this.dataset.min);
    this.max = Number(this.dataset.max);
    this.track = this.querySelector(".price-range__track");
    this.handles = [...this.querySelectorAll(".price-range__thumbs")];
    this.startPos = 0;
    this.activeHandle;

    this.handles.forEach((handle) => {
      handle.addEventListener("mousedown", this.startMove.bind(this));
    });

    window.addEventListener("mouseup", this.stopMove.bind(this));

    this.querySelectorAll("input").forEach((element) =>
      element.addEventListener("change", this.onRangeChange.bind(this))
    );
  }

  onRangeChange(event) {
    this.adjustToValidValues(event.currentTarget);
    this.setMinAndMaxValues();
  }

  startMove(e) {
    this.startPos = e.offsetX;
    this.activeHandle = e.target;
    this.moveListener = this.move.bind(this);
    window.addEventListener("mousemove", this.moveListener);
  }

  move(e) {
    const isLower = this.activeHandle.classList.contains("is-lower");
    const property = isLower ? "--progress-lower" : "--progress-upper";
    const parentRect = this.track.getBoundingClientRect();
    const handleRect = this.activeHandle.getBoundingClientRect();
    let newX = e.clientX - parentRect.x - this.startPos;

    if (isLower) {
      const otherX = parseInt(this.style.getPropertyValue("--progress-upper"));
      const percentageX = (otherX * parentRect.width) / 100;
      newX = Math.min(newX, percentageX - handleRect.width);
      newX = Math.max(newX, 0 - handleRect.width / 2);
    } else {
      const otherX = parseInt(this.style.getPropertyValue("--progress-lower"));
      const percentageX = (otherX * parentRect.width) / 100;
      newX = Math.max(newX, percentageX);
      newX = Math.min(newX, parentRect.width - handleRect.width / 2);
    }

    const percentage = (newX + handleRect.width / 2) / parentRect.width;
    const valuenow = this.calcHandleValue(percentage);
    this.style.setProperty(property, percentage * 100 + "%");
    this.activeHandle.ariaValueNow = valuenow;

    const output = this.activeHandle.nextElementSibling;
    const text = output.querySelector(".price-range__output-text");
    text.innerHTML = valuenow;

    const inputs = this.querySelectorAll("input");
    const input = isLower ? inputs[0] : inputs[1];
    input.value = valuenow;

    this.adjustToValidValues(input);
    this.setMinAndMaxValues();
  }

  calcHandleValue(percentage) {
    return Math.round(percentage * (this.max - this.min) + this.min);
  }

  stopMove() {
    window.removeEventListener("mousemove", this.moveListener);
    const form = this.closest("form");

    if (this.activeHandle && form) form.dispatchEvent(new Event("input"));
  }

  setMinAndMaxValues() {
    const inputs = this.querySelectorAll("input");
    const minInput = inputs[0];
    const maxInput = inputs[1];
    if (maxInput.value) minInput.setAttribute("max", maxInput.value);
    if (minInput.value) maxInput.setAttribute("min", minInput.value);
    if (minInput.value === "") maxInput.setAttribute("min", 0);
    if (maxInput.value === "")
      minInput.setAttribute("max", maxInput.getAttribute("max"));
  }

  adjustToValidValues(input) {
    const value = Number(input.value);
    const min = Number(input.getAttribute("min"));
    const max = Number(input.getAttribute("max"));

    if (value < min) input.value = min;
    if (value > max) input.value = max;
  }
}
customElements.define("price-range", PriceRange);

class StickyFacetFilters extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.onScrollHandler = this.onScroll.bind(this);

    window.addEventListener("scroll", this.onScrollHandler, false);
    this.onScrollHandler();
  }

  disconnectedCallback() {
    window.removeEventListener("scroll", this.onScrollHandler);
  }

  onScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > this.parentNode.offsetTop) {
      window.requestAnimationFrame(this.reveal.bind(this));
    } else {
      window.requestAnimationFrame(this.reset.bind(this));
    }
  }

  reveal() {
    this.classList.add("shopify-section-filters-sticky");
  }

  reset() {
    this.classList.remove("shopify-section-filters-sticky");
  }
}
customElements.define("sticky-facet-filters", StickyFacetFilters);

class ShowMoreButton extends HTMLElement {
  constructor() {
    super();

    const attributes = {
      expanded: "aria-expanded",
    };

    const button = this.querySelector(".button-show-more");
    button.addEventListener("click", () => {
      const filter = this.closest(".js-filter");
      filter.setAttribute(
        attributes.expanded,
        (filter.getAttribute(attributes.expanded) === "false").toString()
      );

      this.querySelectorAll(".visually-hidden").forEach((element) =>
        element.classList.toggle("hidden")
      );
    });
  }
}
customElements.define("show-more-button", ShowMoreButton);

class FilterSearchToggle extends HTMLElement {
  constructor() {
    super();
    this.facetToggleButtons = this.querySelectorAll("[data-facet-toggle]");
    this.searchButton = this.querySelector('[data-facet-toggle="search"]');
    this.filterButton = this.querySelector('[data-facet-toggle="filter"]');
    this.shownFacet;
    this.standardizeFacetElements = this.standardizeFacetElements.bind(this);
  }
  standardizeFacetElements() {
    console.log("shown facet: ", this.shownFacet);
    if (window.innerWidth > 749 && this.shownFacet === "filter") {
      const searchWidth = document.querySelector(
        ".facets-sort-filter__wrapper"
      ).offsetWidth;
      document.querySelector(
        "facet-search input"
      ).style.width = `${searchWidth}px`;
      const widestButton = [...this.facetToggleButtons]
        .map((button) => button.offsetWidth)
        .sort((a, b) => {
          return b - a;
        })[0];
      this.facetToggleButtons.forEach((button) => {
        button.style.width = `${widestButton}px`;
      });
    }
  }
  setDefaultShownFacet() {
    const activeToggleParam = window.location.search.split("=")[0] || null;
    const searchFacet = document.querySelector('[data-facet="search"]');
    const filterFacet = document.querySelector('[data-facet="filter"]');
    this.shownFacet =
      activeToggleParam === "?facets__search-input" ? "search" : "filter";
    const searchQuery =
      this.shownFacet === "search" ? window.location.search.split("=")[1] : "";
    console.log("we should be showing ", this.shownFacet);

    if (this.shownFacet === "search") {
      searchFacet.querySelector("#facets__search-input").value = searchQuery;
      searchFacet.classList.remove("hidden");
      this.filterButton.classList.remove("hide-toggle");
      filterFacet.classList.add("hidden");
      this.searchButton.classList.add("hide-toggle");
    } else if (this.shownFacet === "filter") {
      filterFacet.classList.remove("hidden");
      this.searchButton.classList.remove("hide-toggle");
      searchFacet.classList.add("hidden");
      this.filterButton.classList.add("hide-toggle");
    }
  }
  toggleShownFacet() {
    this.shownFacet = this.shownFacet === "search" ? "filter" : "search";
    document.querySelectorAll("[data-facet]").forEach((el) => {
      console.log(el.dataset.facet);
      el.classList.toggle("hidden");
    });
    this.facetToggleButtons.forEach((button) => {
      button.classList.toggle("hide-toggle");
    });
  }
  connectedCallback() {
    this.setDefaultShownFacet();
    this.standardizeFacetElements();
    this.facetToggleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.toggleShownFacet();
      });
    });
    window.addEventListener("resize", this.standardizeFacetElements);
  }
}
customElements.define("filter-search-toggle", FilterSearchToggle);

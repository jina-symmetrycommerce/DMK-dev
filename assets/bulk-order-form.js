class BulkOrderForm extends HTMLElement {
  constructor() {
    super();
    this.setup();
  }
  setup() {
    this.form = this.querySelector("#bulk-order-quantities");
    this.filter = this.querySelector("#bulk-order-filter");
    this.search = this.querySelector("#search");
    this.searchBy = this.querySelector("#search-by");
    this.addToCartButton = this.querySelector("#bulk-order-form__submit");
    this.cart = document.querySelector("mini-cart");
    this.hideErrors = this.dataset.hideErrors === "true";

    this.form.addEventListener("submit", this.onSubmitHandler.bind(this));
    // this.search.addEventListener("input", this.onSearchInput.bind(this));
    // this.searchBy.addEventListener("input", this.onSearchInput.bind(this));

    let timeoutId;
    window.addEventListener("scroll", () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        this.infiniteScroll();
      }, 200); // Debounce the scroll event
    });
  }
  onSubmitHandler(evt) {
    evt.preventDefault();
    this.quantities = document.querySelectorAll(
      "bulk-order-form .quantity__input"
    );
    if (this.addToCartButton.getAttribute("aria-disabled") === "true") return;

    this.handleErrorMessage();

    // process all items to add
    const items = [];
    this.quantities.forEach((quantity) => {
      if (quantity.value > 0) {
        items.push({
          id: `${quantity.dataset.quantityVariantId}`,
          quantity: `${quantity.value}`,
        });
      }
    });
    if (items.length == 0) {
      return;
    }

    // change button to loading
    this.addToCartButton.setAttribute("aria-disabled", true);
    this.addToCartButton.classList.add("loading");

    const formData = {};
    if (this.cart) {
      formData.sections = this.cart
        .getSectionsToRender()
        .map((section) => section.id);
      formData.sections_url = window.location.pathname;
      this.cart.setActiveElement(document.activeElement);
    }

    // configure API call
    formData.items = items;
    const config = fetchConfig("javascript");
    config.headers["X-Requested-With"] = "XMLHttpRequest";
    config.body = JSON.stringify(formData);

    fetch(`${theme.routes.cart_add_url}`, config)
      .then((response) => response.json())
      .then((response) => {
        if (response.status) {
          publish(PUB_SUB_EVENTS.cartError, {
            source: "bulk-order-quantities",
            errors: response.errors || response.description,
            message: response.message,
          });
          this.handleErrorMessage(response.description);
        } else if (!this.cart) {
          window.location = theme.routes.cart_url;
          return;
        }

        if (!this.error)
          publish(PUB_SUB_EVENTS.cartUpdate, {
            source: "bulk-order-quantities",
            cartData: response,
          });
        if (!this.cart) {
          window.location = theme.routes.cart_url;
          return;
        }
        this.error = false;
        const quickAddModal = this.closest("quick-add-modal");
        if (quickAddModal) {
          document.body.addEventListener(
            "modalClosed",
            () => {
              setTimeout(() => {
                this.cart.renderContents(response);
              });
            },
            { once: true }
          );
          quickAddModal.hide(true);
        } else {
          this.cart.renderContents(response);
        }
      })
      .catch((error) => {
        console.error("Error:", error);
      })
      .finally(() => {
        this.addToCartButton.classList.remove("loading");
        if (this.cart && this.cart.classList.contains("is-empty"))
          this.cart.classList.remove("is-empty");
        if (!this.error) this.addToCartButton.removeAttribute("aria-disabled");
      });
  }
  handleErrorMessage(errorMessage = false) {
    if (this.hideErrors) return;
    this.errorMessageWrapper =
      this.errorMessageWrapper ||
      this.querySelector(".bulk-order-form__error-message-wrapper");
    if (!this.errorMessageWrapper) return;
    this.errorMessage =
      this.errorMessage ||
      this.errorMessageWrapper.querySelector(".bulk-order-form__error-message");

    this.errorMessageWrapper.toggleAttribute("hidden", !errorMessage);

    if (errorMessage) {
      this.errorMessage.textContent = errorMessage;
    }
  }
  infiniteScroll() {
    const documentHeight = document.documentElement.scrollHeight; // Height of the document
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop; // Current scroll position
    const windowHeight = window.innerHeight; // Height of the viewport

    if (documentHeight - windowHeight < scrollTop + windowHeight) {
      const scrollNode = document.querySelector(
        ".bulk-order-form-more.current"
      );
      const scrollLink = scrollNode?.querySelector("a"); // Select the last link inside "product#more"

      if (scrollNode && scrollNode.style.display !== "none") {
        const scrollURL = scrollLink?.getAttribute("href");

        if (scrollURL) {
          fetch(scrollURL, { method: "GET" })
            .then((response) => response.text())
            .then((data) => {
              // Remove loading feedback
              const loadingNode = scrollNode.nextElementSibling;
              if (loadingNode) loadingNode.remove();

              const parser = new DOMParser();
              const htmlDocument = parser.parseFromString(data, "text/html");
              const filteredData =
                htmlDocument.querySelectorAll(".variant-row");
              const productListFoot = this.querySelector("#product-list-foot");
              let n = 1;
              filteredData.forEach((product) => {
                // nice cascade effect
                product.style.animationDelay = 0.15 * n + "s";
                n += 1;
                if (productListFoot) {
                  productListFoot.parentNode.insertBefore(
                    product,
                    productListFoot
                  );
                }
              });

              // check if any more pages left
              const nextPage = parseInt(scrollNode.dataset.nextPage);
              const totalPages = parseInt(scrollNode.dataset.totalPages);
              // create new link to insert before footer
              if (productListFoot && nextPage < totalPages) {
                const more = this.createMoreLink(nextPage, totalPages);
                productListFoot.parentNode.insertBefore(more, productListFoot);
              }
            })
            .catch((error) => console.error("Error fetching data:", error))
            .finally(() => {
              this.quantities = this.querySelectorAll(".quantity__input");
            });

          // Add loading feedback before hiding the node
          const loadingRow = document.createElement("div");
          const loadingWrapper = document.createElement("div");
          const loadingBar = document.createElement("span");
          loadingRow.classList.add(
            "bulk-order-form-loading",
            "desktop-table-row"
          );
          loadingWrapper.classList.add("wrapper", "desktop-table-cell");
          loadingBar.classList.add("loading-bar");

          loadingWrapper.appendChild(loadingBar);
          loadingRow.appendChild(loadingWrapper);
          scrollNode.parentNode.insertBefore(
            loadingRow,
            scrollNode.nextSibling
          );
          scrollNode.classList.remove("current");
          scrollNode.classList.add("hidden");
        }
      }
    }
  }
  createMoreLink(nextPage, totalPages) {
    const tr = document.createElement("div");
    tr.classList.add("bulk-order-form-more", "current", "desktop-table-row");
    tr.dataset.nextPage = nextPage + 1;
    tr.dataset.totalPages = totalPages;

    const td = document.createElement("div");
    td.classList.add("desktop-table-cell");

    const anchor = document.createElement("a");
    anchor.classList.add("more-link");
    anchor.href = `${window.location.pathname}?page=${nextPage + 1}${
      window.location.search &&
      "&".concat(window.location.search.replace("?", ""))
    }`;
    anchor.textContent = "More ⬇";

    td.appendChild(anchor);
    tr.appendChild(td);
    return tr;
  }
}
customElements.define("bulk-order-form", BulkOrderForm);

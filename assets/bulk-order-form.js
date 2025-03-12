class BulkOrderForm extends HTMLElement {
  constructor() {
    super();
    this.form = this.querySelector("#bulk-order-form");
    this.filter = this.querySelector("#bulk-order-filter");
    this.form.addEventListener("submit", this.onSubmitHandler.bind(this));
    this.quantities = this.querySelectorAll(".quantity__input");
    this.addToCartButton = this.querySelector("#bulk-order-form__submit");
    this.cart = document.querySelector("mini-cart");
  }
  onSubmitHandler(evt) {
    evt.preventDefault();
    const formData = {};
    if (this.cart) {
      formData.sections = this.cart
        .getSectionsToRender()
        .map((section) => section.id);
      formData.sections_url = window.location.pathname;
      this.cart.setActiveElement(document.activeElement);
    }
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
    // change button to loading
    this.addToCartButton.setAttribute("aria-disabled", true);
    this.addToCartButton.classList.add("loading");

    // configure API call
    formData.items = items;
    const config = fetchConfig("javascript");
    config.headers["X-Requested-With"] = "XMLHttpRequest";
    config.body = JSON.stringify(formData);

    fetch(window.Shopify.routes.root + "cart/add.js", config)
      .then((response) => response.json())
      .then((response) => {
        if (!this.cart) {
          window.location = theme.routes.cart_url;
          return;
        }
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
}
customElements.define("bulk-order-form", BulkOrderForm);

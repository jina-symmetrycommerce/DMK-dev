class BulkOrderForm extends HTMLElement {
  constructor() {
    super();
    this.form = this.querySelector("#bulk-order-form");
    this.filter = this.querySelector("#bulk-order-filter");
    this.form.addEventListener("submit", this.onSubmitHandler.bind(this));
    this.quantities = this.querySelectorAll(".quantity__input");
    this.addToCartButton = this.querySelector("#bulk-order-form__submit");
    this.cart = document.querySelector("mini-cart");
    this.hideErrors = this.dataset.hideErrors === "true";
  }
  onSubmitHandler(evt) {
    evt.preventDefault();
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
            source: "bulk-order-form",
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
            source: "bulk-order-form",
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
}
customElements.define("bulk-order-form", BulkOrderForm);

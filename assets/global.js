/*
@license
  Be Yours by roartheme (https://roartheme.co)
  Access unminified JS in assets/global.js

  Use this event listener to run your own JS outside of this file.
  Documentation - https://roartheme.co/blogs/beyours/javascript-events-for-developers

  document.addEventListener('page:loaded', function() {
    // Page has loaded and theme assets are ready
  });
*/
window.theme = window.theme || {};

theme.config = {
  mqlSmall: false,
  mediaQuerySmall: 'screen and (max-width: 749px)',
  isTouch: ('ontouchstart' in window) || window.DocumentTouch && window.document instanceof DocumentTouch || window.navigator.maxTouchPoints || window.navigator.msMaxTouchPoints ? true : false,
  rtl: document.documentElement.getAttribute('dir') === 'rtl' ? true : false
};

if (console && console.log) {
  console.log(theme.settings.themeName + ' theme (' + theme.settings.themeVersion + ') by RoarTheme | Learn more at https://roartheme.co');
}

class HTMLUpdateUtility {
  /**
   * Used to swap an HTML node with a new node.
   * The new node is inserted as a previous sibling to the old node, the old node is hidden, and then the old node is removed.
   *
   * The function currently uses a double buffer approach, but this should be replaced by a view transition once it is more widely supported https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
   */
  static viewTransition(oldNode, newContent, preProcessCallbacks = [], postProcessCallbacks = []) {
    preProcessCallbacks?.forEach((callback) => callback(newContent));

    const newNodeWrapper = document.createElement('div');
    HTMLUpdateUtility.setInnerHTML(newNodeWrapper, newContent.outerHTML);
    const newNode = newNodeWrapper.firstChild;

    // dedupe IDs
    const uniqueKey = Date.now();
    oldNode.querySelectorAll('[id], [form]').forEach((element) => {
      element.id && (element.id = `${element.id}-${uniqueKey}`);
      element.form && element.setAttribute('form', `${element.form.getAttribute('id')}-${uniqueKey}`);
    });

    oldNode.parentNode.insertBefore(newNode, oldNode);
    oldNode.style.display = 'none';

    postProcessCallbacks?.forEach((callback) => callback(newNode));

    setTimeout(() => oldNode.remove(), 500);
  }

  // Sets inner HTML and reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
  static setInnerHTML(element, html) {
    element.innerHTML = html;
    element.querySelectorAll('script').forEach((oldScriptTag) => {
      const newScriptTag = document.createElement('script');
      Array.from(oldScriptTag.attributes).forEach((attribute) => {
        newScriptTag.setAttribute(attribute.name, attribute.value);
      });
      newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
      oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
    });
  }
}

theme.Currency = (function() {
  const moneyFormat = '${{amount}}'; // eslint-disable-line camelcase

  function formatMoney(cents, format) {
    if (typeof cents === 'string') {
      cents = cents.replace('.', '');
    }
    let value = '';
    const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
    const formatString = format || moneyFormat;

    function formatWithDelimiters(number, precision, thousands, decimal) {
      thousands = thousands || ',';
      decimal = decimal || '.';

      if (isNaN(number) || number === null) {
        return 0;
      }

      number = (number / 100.0).toFixed(precision);

      const parts = number.split('.');
      const dollarsAmount = parts[0].replace(
        /(\d)(?=(\d\d\d)+(?!\d))/g,
        '$1' + thousands
      );
      const centsAmount = parts[1] ? decimal + parts[1] : '';

      return dollarsAmount + centsAmount;
    }

    switch (formatString.match(placeholderRegex)[1]) {
      case 'amount':
        value = formatWithDelimiters(cents, 2);
        break;
      case 'amount_no_decimals':
        value = formatWithDelimiters(cents, 0);
        break;
      case 'amount_with_comma_separator':
        value = formatWithDelimiters(cents, 2, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        value = formatWithDelimiters(cents, 0, '.', ',');
        break;
      case 'amount_no_decimals_with_space_separator':
        value = formatWithDelimiters(cents, 0, ' ');
        break;
      case 'amount_with_apostrophe_separator':
        value = formatWithDelimiters(cents, 2, "'");
        break;
    }

    return formatString.replace(placeholderRegex, value);
  }

  function getBaseUnit(variant) {
    if (!variant) {
      return;
    }

    if (!variant.unit_price_measurement || !variant.unit_price_measurement.reference_value) {
      return;
    }

    return variant.unit_price_measurement.reference_value === 1
      ? variant.unit_price_measurement.reference_unit
      : variant.unit_price_measurement.reference_value +
          variant.unit_price_measurement.reference_unit;
  }

  return {
    formatMoney: formatMoney,
    getBaseUnit: getBaseUnit
  };
})();

// Init section function when it's visible, then disable observer
theme.initWhenVisible = function(options) {
  const threshold = options.threshold ? options.threshold : 0;

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (typeof options.callback === 'function') {
          options.callback();
          observer.unobserve(entry.target);
        }
      }
    });
  }, {rootMargin: `0px 0px ${threshold}px 0px`});

  observer.observe(options.element);
};

(function() {
  // Trigger events when going between breakpoints
  const mql = window.matchMedia(theme.config.mediaQuerySmall);
  theme.config.mqlSmall = mql.matches;
  mql.onchange = (e) => {
    if (e.matches) {
      theme.config.mqlSmall = true;
      document.dispatchEvent(new CustomEvent('matchSmall'));
    }
    else {
      theme.config.mqlSmall = false;
      document.dispatchEvent(new CustomEvent('unmatchSmall'));
    }
  }

  // Page transition
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a');
    if (anchor?.href && /^(mailto:|tel:)/.test(anchor.href)) {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    } else {
      window.addEventListener('beforeunload', beforeUnloadHandler);
    }
  });
  const beforeUnloadHandler = (event) => {
    document.body.classList.add('unloading');
  }
  window.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded');

    document.dispatchEvent(new CustomEvent('page:loaded'));
  });
  window.addEventListener('pageshow', (event) => {
    // Removes unload class when returning to page via history
    if (event.persisted) {
      document.body.classList.remove('unloading');
    }
  });

  // Viewport height
  function viewportHeight() {
    if (window.matchMedia('(max-width: 990px)')) {
      document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
    }

    setHeaderBottomPosition();
  }
  window.addEventListener('resize', viewportHeight);
  window.addEventListener('DOMContentLoaded', viewportHeight);

  if (document.body.getAttribute('data-page-rendering') !== null) {
    // Improve initial load time by skipping the rendering of offscreen content
    const observer = new IntersectionObserver(
      (entries, _observer) => {
        entries.forEach((entry) => {
          const el = entry.target;
          // Not currently in intersection area.
          if (entry.intersectionRatio == 0) {
            return;
          }
          // Trigger rendering for elements within scroll area that haven't already been marked.
          if (!el.markedVisible) {
            el.attributeStyleMap && el.attributeStyleMap.set('content-visibility', 'visible');
            el.markedVisible = true;
          }
        });
      },
      // Set a rendering 50px above and 100px below the main scroll area.
      { rootMargin: '50px 0px 100px 0px' }
    );
    const sections = document.querySelectorAll('.shopify-section + .shopify-section');
    sections.forEach((section) => { observer.observe(section); });
  }

  /*
  // Delay JavaScript until user interaction
  const loadScriptsTimer = setTimeout(loadScripts, 5000);
  const userInteractionEvents = ["mouseover", "mousemove", "keydown", "touchstart", "touchend", "touchmove", "wheel"];
  userInteractionEvents.forEach(function(event) {
    window.addEventListener(event, triggerScriptLoader, {
      passive: !0
    });
  });
  function triggerScriptLoader() {
    loadScripts();
    clearTimeout(loadScriptsTimer);
    userInteractionEvents.forEach(function(event) {
      window.removeEventListener(event, triggerScriptLoader, {
        passive: !0
      });
    });
  }
  function loadScripts() {
    document.querySelectorAll("script[data-type='lazy']").forEach(function(script) {
      script.setAttribute("src", script.getAttribute("data-src"));
    });
  }
  */
})();

// Prevent vertical scroll while using flickity sliders
(function() {
  var e = !1;
  var t;

  document.body.addEventListener('touchstart', function(i) {
    if (!i.target.closest('.flickity-slider')) {
      return e = !1;
    }
    e = !0;
    t = {
      x: i.touches[0].pageX,
      y: i.touches[0].pageY
    }
  })

  document.body.addEventListener('touchmove', function(i) {
    if (e && i.cancelable) {
      var n = {
        x: i.touches[0].pageX - t.x,
        y: i.touches[0].pageY - t.y
      };
      Math.abs(n.x) > Flickity.defaults.dragThreshold && i.preventDefault()
    }
  }, { passive: !1 })
})();

function isStorageSupported (type) {
  // Return false if we are in an iframe without access to sessionStorage
  if (window.self !== window.top) {
    return false;
  }

  const testKey = 'beyours:test';
  let storage;
  if (type === 'session') {
    storage = window.sessionStorage;
  }
  if (type === 'local') {
    storage = window.localStorage;
  }

  try {
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  }
  catch (error) {
    // Do nothing, this may happen in Safari in incognito mode
    return false;
  }
}

function checkScrollbar() {
  const rect = document.body.getBoundingClientRect();
  return Math.round(rect.left + rect.right) < window.innerWidth;
}

function setScrollbarWidth() {
  if (checkScrollbar()) {
    const element = document.createElement('span');
    element.className = 'modal-scrollbar-measure', document.body.appendChild(element);
  
    const width = element.getBoundingClientRect().width - element.clientWidth;
    document.body.removeChild(element);
    document.documentElement.style.setProperty('--scrollbar-width', `${width}px`);
  }
}

function setHeaderBottomPosition() {
  const header = document.querySelector('.shopify-section-header');
  if (header) {
    document.documentElement.style.setProperty('--header-bottom-position', `${parseInt(header.getBoundingClientRect().bottom)}px`);
  }
}

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
    )
  );
}

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
  var elements = getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (
      event.target !== container &&
      event.target !== last &&
      event.target !== first
    )
      return;

    document.addEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function() {
    document.removeEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function(event) {
    const charCode = event.code ? event.code.toUpperCase() : event.key.toUpperCase();
    if (charCode !== 'TAB') return; // If not TAB key
    
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if (
      (event.target === container || event.target === first) &&
      event.shiftKey
    ) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener('focusout', trapFocusHandlers.focusout);
  document.addEventListener('focusin', trapFocusHandlers.focusin);

  if (elementToFocus) elementToFocus.focus();

  if (elementToFocus.tagName === 'INPUT' && ['search', 'text', 'email', 'url'].includes(elementToFocus.type) && elementToFocus.value) {
    elementToFocus.setSelectionRange(0, elementToFocus.value.length);
  }
}

// Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
try {
  document.querySelector(":focus-visible");
} catch {
  focusVisiblePolyfill();
}

function focusVisiblePolyfill() {
  const navKeys = ['ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT', 'TAB', 'ENTER', 'SPACE', 'ESCAPE', 'HOME', 'END', 'PAGEUP', 'PAGEDOWN']
  let currentFocusedElement = null;
  let mouseClick = null;

  window.addEventListener('keydown', (event) => {
    if(navKeys.includes(event.code.toUpperCase())) {
      mouseClick = false;
    }
  });

  window.addEventListener('mousedown', (event) => {
    mouseClick = true;
  });

  window.addEventListener('focus', () => {
    if (currentFocusedElement) currentFocusedElement.classList.remove('focused');

    if (mouseClick) return;

    currentFocusedElement = document.activeElement;
    currentFocusedElement.classList.add('focused');

  }, true);
}

function pauseAllMedia() {
  document.querySelectorAll('iframe.js-youtube').forEach((video) => {
    video.contentWindow.postMessage('{"event":"command","func":"' + 'pauseVideo' + '","args":""}', '*');
  });
  document.querySelectorAll('iframe.js-vimeo').forEach((video) => {
    video.contentWindow.postMessage('{"method":"pause"}', '*');
  });
  document.querySelectorAll('video-section[data-type="youtube"]:not([data-video-hero]) iframe').forEach((video) => {
    video.contentWindow.postMessage('{"event":"command","func":"' + 'pauseVideo' + '","args":""}', '*');
  });
  document.querySelectorAll('video-section[data-type="vimeo"]:not([data-video-hero]) iframe').forEach((video) => {
    video.contentWindow.postMessage('{"method":"pause"}', '*');
  });
  document.querySelectorAll('video').forEach((video) => {
    if (!video.closest('[data-video-hero]')) video.pause();
  });
  document.querySelectorAll('product-model').forEach((model) => {
    if (model.modelViewerUI) model.modelViewerUI.pause();
  });
}

function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener('focusin', trapFocusHandlers.focusin);
  document.removeEventListener('focusout', trapFocusHandlers.focusout);
  document.removeEventListener('keydown', trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

function onKeyUpEscape(event) {
  const charCode = event.code ? event.code.toUpperCase() : event.key.toUpperCase();
  if (charCode !== 'ESCAPE') return;

  const openDetailsElement = event.target.closest('details[open]');
  if (!openDetailsElement) return;

  const summaryElement = openDetailsElement.querySelector('summary');
  openDetailsElement.removeAttribute('open');
  summaryElement.setAttribute('aria-expanded', false);
  summaryElement.focus();
}

function filterShopifyEvent(event, domElement, callback) {
  let executeCallback = false;
  if (event.type.includes('shopify:section')) {
    if (domElement.hasAttribute('data-section-id') && domElement.getAttribute('data-section-id') === event.detail.sectionId) {
      executeCallback = true;
    }
  }
  else if (event.type.includes('shopify:block') && event.target === domElement) {
    executeCallback = true;
  }
  if (executeCallback) {
    callback(event);
  }
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function fetchConfig(type = 'json') {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': `application/${type}` }
  };
}

const serializeForm = form => {
  const obj = {};
  const formData = new FormData(form);

  for (const key of formData.keys()) {
    const regex = /(?:^(properties\[))(.*?)(?:\]$)/;

    if (regex.test(key)) { 
      obj.properties = obj.properties || {};
      obj.properties[regex.exec(key)[2]] = formData.get(key);
    } else {
      obj[key] = formData.get(key);
    }
  }

  return JSON.stringify(obj);
};

/*
 * Shopify Common JS
 *
 */
if ((typeof window.Shopify) == 'undefined') {
  window.Shopify = {};
}

Shopify.bind = function(fn, scope) {
  return function() {
    return fn.apply(scope, arguments);
  }
};

Shopify.setSelectorByValue = function(selector, value) {
  for (var i = 0, count = selector.options.length; i < count; i++) {
    var option = selector.options[i];
    if (value == option.value || value == option.innerHTML) {
      selector.selectedIndex = i;
      return i;
    }
  }
};

Shopify.addListener = function(target, eventName, callback) {
  target.addEventListener ? target.addEventListener(eventName, callback, false) : target.attachEvent('on'+eventName, callback);
};

Shopify.postLink = function(path, options) {
  options = options || {};
  const method = options['method'] || 'post';
  const params = options['parameters'] || {};

  const form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", path);

  for (const key in params) {
    const hiddenField = document.createElement("input");
    hiddenField.setAttribute("type", "hidden");
    hiddenField.setAttribute("name", key);
    hiddenField.setAttribute("value", params[key]);
    form.appendChild(hiddenField);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

Shopify.postLink2 = function(path, options) {
  options = options || {};
  const method = options['method'] || 'post';
  const params = options['parameters'] || {};

  const form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", path);

  for (const key in params) {
    for (const index in params[key]) {
      for (const key2 in params[key][index]) {
        const hiddenField = document.createElement("input");
        hiddenField.setAttribute("type", "hidden");
        hiddenField.setAttribute("name", `${key}[${index}][${key2}]`);
        hiddenField.setAttribute("value", params[key][index][key2]);
        form.appendChild(hiddenField);
      }
    }
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

Shopify.CountryProvinceSelector = function(country_domid, province_domid, options) {
  this.countryEl         = document.getElementById(country_domid);
  this.provinceEl        = document.getElementById(province_domid);
  this.provinceContainer = document.getElementById(options['hideElement'] || province_domid);

  Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler,this));

  this.initCountry();
  this.initProvince();
};

Shopify.CountryProvinceSelector.prototype = {
  initCountry: function() {
    var value = this.countryEl.getAttribute('data-default');
    Shopify.setSelectorByValue(this.countryEl, value);
    this.countryHandler();
  },

  initProvince: function() {
    var value = this.provinceEl.getAttribute('data-default');
    if (value && this.provinceEl.options.length > 0) {
      Shopify.setSelectorByValue(this.provinceEl, value);
    }
  },

  countryHandler: function(e) {
    var opt       = this.countryEl.options[this.countryEl.selectedIndex];
    var raw       = opt.getAttribute('data-provinces');
    var provinces = JSON.parse(raw);

    this.clearOptions(this.provinceEl);
    if (provinces && provinces.length == 0) {
      this.provinceContainer.style.display = 'none';
    } else {
      for (var i = 0; i < provinces.length; i++) {
        var opt = document.createElement('option');
        opt.value = provinces[i][0];
        opt.innerHTML = provinces[i][1];
        this.provinceEl.appendChild(opt);
      }

      this.provinceContainer.style.display = "";
    }
  },

  clearOptions: function(selector) {
    while (selector.firstChild) {
      selector.removeChild(selector.firstChild);
    }
  },

  setOptions: function(selector, values) {
    for (var i = 0, count = values.length; i < values.length; i++) {
      var opt = document.createElement('option');
      opt.value = values[i];
      opt.innerHTML = values[i];
      selector.appendChild(opt);
    }
  }
};

class QuantityInput extends HTMLElement {
  constructor() {
    super();

    this.init();
  }

  init() {
    this.input = this.querySelector('input');
    this.changeEvent = new Event('change', { bubbles: true });
    this.input.addEventListener('change', this.onInputChange.bind(this));
    this.querySelectorAll('button').forEach(
      (button) => button.addEventListener('click', this.onButtonClick.bind(this))
    );
  }

  quantityUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.validateQtyRules();
    this.quantityUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.quantityUpdate, this.validateQtyRules.bind(this));
  }

  disconnectedCallback() {
    if (this.quantityUpdateUnsubscriber) {
      this.quantityUpdateUnsubscriber();
    }
  }

  onInputChange(event) {
    this.validateQtyRules();
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;

    if (event.target.name === 'plus') {
      if (parseInt(this.input.dataset.min) > parseInt(this.input.step) && this.input.value == 0) {
        this.input.value = this.input.dataset.min;
      } else {
        this.input.stepUp();
      }
    } else {
      this.input.stepDown();
    }

    if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);

    if (this.input.dataset.min === previousValue && event.target.name === 'minus') {
      this.input.value = parseInt(this.input.min);
    }
  }

  validateQtyRules() {
    const value = parseInt(this.input.value);
    if (this.input.min) {
      const buttonMinus = this.querySelector(".quantity__button[name='minus']");
      buttonMinus?.classList.toggle('disabled', parseInt(value) <= parseInt(this.input.min));
    }
    if (this.input.max) {
      const max = parseInt(this.input.max);
      const buttonPlus = this.querySelector(".quantity__button[name='plus']");
      buttonPlus?.classList.toggle('disabled', value >= max);
    }
  }
}
customElements.define('quantity-input', QuantityInput);

class DrawerCloseButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', () => this.dispatchEvent(new CustomEvent('drawer:force-close', { bubbles: true, cancelable: true, composed: true })));
  }
}
customElements.define('drawer-close-button', DrawerCloseButton);

class MenuDrawer extends HTMLElement {
  constructor() {
    super();

    this.classes = {
      open: 'menu-drawer--open',
      opening: 'menu-drawer--opening',
      closing: 'menu-drawer--closing'
    };

    this.mainDetailsToggle = this.querySelector('details');

    this.addEventListener('keyup', this.onKeyUp.bind(this));
    this.addEventListener('focusout', this.onFocusOut.bind(this));
    this.bindEvents();
  }

  setClasses(classes) {
    this.classes = classes;
  }

  bindEvents() {
    this.querySelectorAll('summary').forEach(summary => summary.addEventListener('click', this.onSummaryClick.bind(this)));
    this.querySelectorAll('button[data-close]').forEach(button => button.addEventListener('click', this.onCloseButtonClick.bind(this)));

    this.addEventListener('drawer:force-close', (event) => {
      event.stopPropagation();
      this.closeMenuDrawer(event);
    });
  }

  onKeyUp(event) {
    const charCode = event.code ? event.code.toUpperCase() : event.key.toUpperCase();
  if (charCode !== 'ESCAPE') return;

    const openDetailsElement = event.target.closest('details[open]');
    if (!openDetailsElement) return;

    openDetailsElement === this.mainDetailsToggle ? this.closeMenuDrawer(event, this.mainDetailsToggle.querySelector('summary')) : this.closeSubmenu(openDetailsElement);
  }

  onSummaryClick(event) {
    const summaryElement = event.currentTarget;
    const detailsElement = summaryElement.parentNode;
    const isOpen = detailsElement.hasAttribute('open');
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function addTrapFocus() {
      trapFocus(summaryElement.nextElementSibling, detailsElement.querySelector('button'));
      summaryElement.nextElementSibling.removeEventListener('transitionend', addTrapFocus);
    }

    if (detailsElement === this.mainDetailsToggle) {
      if (isOpen) event.preventDefault();
      isOpen ? this.closeMenuDrawer(event, summaryElement) : this.openMenuDrawer(summaryElement);
    } else {
      setTimeout(() => {
        detailsElement.classList.add('menu-opening');
        summaryElement.setAttribute('aria-expanded', true);
        !reducedMotion || reducedMotion.matches ? addTrapFocus() : summaryElement.nextElementSibling.addEventListener('transitionend', addTrapFocus);
      }, 100);
    }
  }

  openMenuDrawer(summaryElement = false) {
    setScrollbarWidth();
    setHeaderBottomPosition();

    if (summaryElement) {
      summaryElement.setAttribute('aria-expanded', true);
      trapFocus(this.mainDetailsToggle, summaryElement);
    }

    setTimeout(() => {
      this.onBodyClickEvent = this.onBodyClickEvent || this.onBodyClick.bind(this);
      document.body.addEventListener('click', this.onBodyClickEvent);
    });
    document.body.classList.add(this.classes.opening);

    this.openAnimation();
    setTimeout(() => {
      this.mainDetailsToggle.setAttribute('open', '');
      setTimeout(() => {
        this.mainDetailsToggle.classList.add('menu-opening');
      }, 10);
    });
  }

  closeMenuDrawer(event, elementToFocus = false) {
    if (event !== undefined) {
      this.mainDetailsToggle.querySelectorAll('details').forEach(details =>  {
        details.removeAttribute('open');
        details.classList.remove('menu-opening');
      });
      this.mainDetailsToggle.classList.remove('menu-opening');
      this.mainDetailsToggle.classList.add('menu-closing');
      removeTrapFocus(elementToFocus);
      
      document.body.removeEventListener('click', this.onBodyClickEvent);
      document.body.classList.remove(this.classes.open);
      document.body.classList.add(this.classes.closing);
      
      this.closeAnimation(this.mainDetailsToggle);
      this.dispatchEvent(new CustomEvent('close'));
      document.dispatchEvent(new CustomEvent('menudrawer:close'));
    }
  }

  onFocusOut() {
    setTimeout(() => {
      if (this.mainDetailsToggle.hasAttribute('open') && !this.mainDetailsToggle.contains(document.activeElement)) this.closeMenuDrawer();
    });
  }

  onCloseButtonClick(event) {
    const target = event.currentTarget;
    if (target.classList.contains('noclose')) return;
    
    const detailsElement = target.closest('details');
    this.closeSubmenu(detailsElement);
  }

  closeSubmenu(detailsElement) {
    detailsElement.classList.remove('menu-opening');
    detailsElement.querySelector('summary').setAttribute('aria-expanded', false);
    removeTrapFocus();
    this.closeAnimation(detailsElement);
  }

  openAnimation() {
    let animationStart;

    const handleAnimation = (time) => {
      if (animationStart === undefined) {
        animationStart = time;
      }

      const elapsedTime = time - animationStart;

      if (elapsedTime < 400) {
        window.requestAnimationFrame(handleAnimation);
      }
      else {
        document.body.classList.remove(this.classes.opening);
        document.body.classList.add(this.classes.open);
      }
    }

    window.requestAnimationFrame(handleAnimation);
  }

  closeAnimation(detailsElement) {
    let animationStart;

    const handleAnimation = (time) => {
      if (animationStart === undefined) {
        animationStart = time;
      }

      const elapsedTime = time - animationStart;

      if (elapsedTime < 400) {
        window.requestAnimationFrame(handleAnimation);
      }
      else {
        if (detailsElement === this.mainDetailsToggle) {
          document.body.classList.remove(this.classes.closing);
          detailsElement.classList.remove('menu-closing');
        }
        detailsElement.removeAttribute('open');

        if (detailsElement.closest('details[open]')) {
          trapFocus(detailsElement.closest('details[open]'), detailsElement.querySelector('summary'));
        }
      }
    }

    window.requestAnimationFrame(handleAnimation);
  }

  onBodyClick(event) {
    if (!this.contains(event.target)) this.closeMenuDrawer(event);
  }
}
customElements.define('menu-drawer', MenuDrawer);

class CartDrawer extends MenuDrawer {
  constructor() {
    super();

    this.setClasses({
      open: 'mini-cart--open',
      opening: 'mini-cart--opening',
      closing: 'mini-cart--closing'
    });
  }
}
customElements.define('cart-drawer', CartDrawer);

class FacetDrawer extends MenuDrawer {
  constructor() {
    super();

    if (this.dataset.desktop == 'true') {
      this.setClasses({
        open: 'facet-horizontal--open',
        opening: 'facet-horizontal--opening',
        closing: 'facet-horizontal--closing'
      });
    }
    else {
      this.setClasses({
        open: 'facet-drawer--open',
        opening: 'facet-drawer--opening',
        closing: 'facet-drawer--closing'
      });
    }
  }
}
customElements.define('facet-drawer', FacetDrawer);

class HeaderDrawer extends MenuDrawer {
  constructor() {
    super();

    this.setClasses({
      open: 'menu-mobile--open',
      opening: 'menu-mobile--opening',
      closing: 'menu-mobile--closing'
    });
  }
}
customElements.define('header-drawer', HeaderDrawer);

class ModalDialog extends HTMLElement {
  constructor() {
    super();
    
    this.querySelector('[id^="ModalClose-"]').addEventListener(
      'click',
      this.hide.bind(this)
    );
    this.addEventListener('keyup', (event) => {
      const charCode = event.code ? event.code.toUpperCase() : event.key.toUpperCase();
      if (charCode === 'ESCAPE') this.hide();
    });
    if (this.classList.contains('media-modal')) {
      this.addEventListener('pointerup', (event) => {
        if (event.pointerType === 'mouse' && !event.target.closest('deferred-media, product-model')) this.hide();
      });
    } else {
      this.addEventListener('click', (event) => {
        if (event.target.nodeName === 'MODAL-DIALOG') this.hide();
      });
    }
  }

  show(opener) {
    setScrollbarWidth();
    this.openedBy = opener;
    const popup = this.querySelector('.template-popup');
    document.body.classList.add('overflow-hidden');
    this.setAttribute('open', '');
    if (popup) popup.loadContent();
    trapFocus(this, this.querySelector('[role="dialog"]'));
    window.pauseAllMedia();
  }

  hide() {
    document.body.classList.remove('overflow-hidden');
    this.removeAttribute('open');
    removeTrapFocus(this.openedBy);
    window.pauseAllMedia();
  }
}
customElements.define('modal-dialog', ModalDialog);

class ModalOpener extends HTMLElement {
  constructor() {
    super();

    this.button = this.querySelector('button');
    if (!this.button) return;

    this.button.addEventListener('click', () => {
      const modal = document.querySelector(this.getAttribute('data-modal'));
      if (modal) modal.show(this.button);
    });
  }
}
customElements.define('modal-opener', ModalOpener);

class DeferredMedia extends HTMLElement {
  constructor() {
    super();
    
    this.poster = this.querySelector('[id^="Deferred-Poster-"]');
    if (!this.poster) return;

    this.poster.addEventListener('click', this.loadContent.bind(this));
  }

  loadContent(focus = true) {
    window.pauseAllMedia();
    if (!this.getAttribute('loaded')) {
      const content = document.createElement('div');
      content.appendChild(this.querySelector('template').content.firstElementChild.cloneNode(true));

      if (content.querySelector('video-section')) {
        const deferredElement = this.appendChild(content);
        if (focus) deferredElement.focus();
        if (deferredElement.nodeName == 'VIDEO' && deferredElement.getAttribute('autoplay')) {
          // force autoplay for safari
          deferredElement.play();
        }
      } else {
        this.setAttribute('loaded', true);
        const deferredElement = this.appendChild(content.querySelector('video, model-viewer, iframe'));
        if (focus) deferredElement.focus();
        if (deferredElement.nodeName == 'VIDEO' && deferredElement.getAttribute('autoplay')) {
          // force autoplay for safari
          deferredElement.play();
        }
      }
    }
  }
}
customElements.define('deferred-media', DeferredMedia);

class SliderComponent extends HTMLElement {
  constructor() {
    super();

    this.slider = this.querySelector('[id^="Slider-"]');
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.enableSliderLooping = false;
    this.currentPageElement = this.querySelector('.slider-counter--current');
    this.pageTotalElement = this.querySelector('.slider-counter--total');
    this.prevButton = this.querySelector('button[name="previous"]');
    this.nextButton = this.querySelector('button[name="next"]');

    if (!this.slider || !this.nextButton) return;

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 200
    });
  }

  init() {
    const resizeObserver = new ResizeObserver(() => this.initPages());
    resizeObserver.observe(this.slider);

    this.slider.addEventListener('scroll', this.update.bind(this));
    this.prevButton.addEventListener('click', this.onButtonClick.bind(this));
    this.nextButton.addEventListener('click', this.onButtonClick.bind(this));
  }

  initPages() {
    this.sliderItemsToShow = Array.from(this.sliderItems).filter(element => element.clientWidth > 0);
    if (this.sliderItemsToShow.length < 2) return;
    this.sliderItemOffset = this.sliderItemsToShow[1].offsetLeft - this.sliderItemsToShow[0].offsetLeft;
    this.slidesPerPage = Math.floor(this.slider.clientWidth / this.sliderItemOffset);
    this.totalPages = this.sliderItemsToShow.length - this.slidesPerPage + 1;
    this.update();
  }

  resetPages() {
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.initPages();
  }

  update() {
    const previousPage = this.currentPage;
    this.currentPage = Math.round(this.slider.scrollLeft / this.sliderItemOffset) + 1;

    if (this.currentPageElement && this.pageTotalElement) {
      this.currentPageElement.textContent = this.currentPage;
      this.pageTotalElement.textContent = this.totalPages;
    }

    if (this.currentPage != previousPage) {
      this.dispatchEvent(new CustomEvent('slideChanged', { detail: {
        currentPage: this.currentPage,
        currentElement: this.sliderItemsToShow[this.currentPage - 1]
      }}));
    }

    if (this.currentPage === 1 && this.currentPage === this.totalPages) {
      this.classList.add('slider--no-buttons');
    } else {
      this.classList.remove('slider--no-buttons');
    }

    if (this.enableSliderLooping) return;

    const isFirstSlide = this.currentPage === 1;
    const isLastSlide = this.currentPage === this.sliderItemsToShow.length;

    if (isFirstSlide || this.isSlideVisible(this.sliderItemsToShow[0])) {
      this.prevButton.setAttribute('disabled', 'disabled');
    } else {
      this.prevButton.removeAttribute('disabled');
    }

    if (isLastSlide || this.isSlideVisible(this.sliderItemsToShow[this.sliderItemsToShow.length - 1])) {
      this.nextButton.setAttribute('disabled', 'disabled');
    } else {
      this.nextButton.removeAttribute('disabled');
    }
  }

  isSlideVisible(element, offset = 0) {
    const lastVisibleSlide = this.slider.clientWidth + this.slider.scrollLeft - offset;
    return (element.offsetLeft + element.clientWidth) <= lastVisibleSlide && element.offsetLeft >= this.slider.scrollLeft;
  }

  onButtonClick(event) {
    event.preventDefault();

    const step = event.currentTarget.dataset.step || 1;
    this.slideScrollPosition = event.currentTarget.name === 'next' ? this.slider.scrollLeft + (step * this.sliderItemOffset) : this.slider.scrollLeft - (step * this.sliderItemOffset);
    //this.slideScrollPosition = theme.config.rtl ? this.slideScrollPosition * -1 : this.slideScrollPosition;
    this.slider.scrollTo({
      left: this.slideScrollPosition
    });
  }
}
customElements.define('slider-component', SliderComponent);

class ThumbnailSlider extends SliderComponent {
  constructor() {
    super();
  }

  init() {
    super.init();

    const variantItems = this.querySelectorAll('.thumbnail-list_item--variant:not(.is-active)');
    this.slider.dataset.mediaCount = this.sliderItems.length - variantItems.length;

    if(this.querySelector('[data-gang-option]')) {
      const inactiveGangItems = this.querySelectorAll('[data-gang-option]:not(.gang__active)');
      this.slider.dataset.mediaCount = this.sliderItems.length - inactiveGangItems.length;
    }

    if (this.slider.dataset.mediaCount < 2) this.classList.add('hidden');
  }
}
customElements.define('thumbnail-slider', ThumbnailSlider);

class QuoteSlider extends SliderComponent {
  constructor() {
    super();
  }

  update() {
    super.update();

    if (this.currentPageElement && this.pageTotalElement) {
      this.sliderItems.forEach((element) => {
        element.removeAttribute('aria-current');
      });

      const currentElement = this.sliderItemsToShow[this.currentPage - 1];
      currentElement.setAttribute('aria-current', true);
    }
  }
}
customElements.define('quote-slider', QuoteSlider);

class ProductGallery extends SliderComponent {
  constructor() {
    super();
  }

  init() {
    super.init();

    const gallerySliderButtons = this.querySelector('.slider-buttons');
    if (gallerySliderButtons && this.querySelector('[data-gang-option]')) {
      if (this.querySelectorAll('.product__media-item.gang__active').length < 2) {
        gallerySliderButtons.classList.add('hidden');
      } else {
        gallerySliderButtons.classList.remove('hidden');
      }
    }

    this.cursor = this.querySelector('.gallery-cursor');
    if (!this.cursor) return;

    const images = this.querySelectorAll('.product__modal-opener--image');
    images.forEach((image) => image.addEventListener('mousemove', this.onMoveHandler.bind(this)));
    images.forEach((image) => image.addEventListener('mouseenter', this.onEnterHandler.bind(this)));
    images.forEach((image) => image.addEventListener('mouseleave', this.onLeaveHandler.bind(this)));
  }

  onMoveHandler(event) {
    this.cursor.style.left = `${event.clientX - 32}px`;
    this.cursor.style.top = `${event.clientY - 32}px`;
  }

  onEnterHandler() {
    this.cursor.classList.add('show');
  }

  onLeaveHandler() {
    this.cursor.classList.remove('show');
  }

  update() {
    super.update();

    if (this.currentPageElement && this.pageTotalElement) {
      const currentElement = this.sliderItemsToShow[this.currentPage - 1];
      if (currentElement) {
        this.slider.style.setProperty('--force-image-ratio-percent', currentElement.querySelector('.media').style.getPropertyValue('--image-ratio-percent'));
      }
    }
  }

  goToFirstSlide() {
    this.slider.scrollTo({
      left: 0
    });
  }
}
customElements.define('product-gallery', ProductGallery);
class VariantSelects extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.addEventListener('change', (event) => {
      const target = this.getInputForEventTarget(event.target);
      this.updateSelectionMetadata(event);

      publish(PUB_SUB_EVENTS.optionValueSelectionChange, {
        data: {
          event,
          target,
          selectedOptionValues: this.selectedOptionValues,
        },
      });
    });
  }

  updateSelectionMetadata({ target }) {
    const { value, tagName } = target;

    if (tagName === 'SELECT' && target.selectedOptions.length) {
      Array.from(target.options)
        .find((option) => option.getAttribute('selected'))
        .removeAttribute('selected');
      target.selectedOptions[0].setAttribute('selected', 'selected');

      const swatchValue = target.selectedOptions[0].dataset.optionSwatchValue;
      const selectedDropdownSwatchValue = target
        .closest('.product-form__input')
        .querySelector('[data-selected-value] > .swatch');
      if (!selectedDropdownSwatchValue) return;
      if (swatchValue) {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', swatchValue);
        selectedDropdownSwatchValue.classList.remove('swatch--unavailable');
      } else {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', 'unset');
        selectedDropdownSwatchValue.classList.add('swatch--unavailable');
      }

      selectedDropdownSwatchValue.style.setProperty(
        '--swatch-focal-point',
        target.selectedOptions[0].dataset.optionSwatchFocalPoint || 'unset'
      );
    } else if (tagName === 'INPUT' && target.type === 'radio') {
      const selectedSwatchValue = target.closest(`.product-form__input`).querySelector('[data-selected-value]');
      if (selectedSwatchValue) selectedSwatchValue.innerHTML = value;
    }
  }

  getInputForEventTarget(target) {
    return target.tagName === 'SELECT' ? target.selectedOptions[0] : target;
  }

  get selectedOptionValues() {
    return Array.from(this.querySelectorAll('select option[selected], fieldset input:checked')).map(
      ({ dataset }) => dataset.optionValueId
    );
  }
}

customElements.define('variant-selects', VariantSelects);

class ProgressBar extends HTMLElement {
  constructor() {
    super();

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 0
    });
  }

  init() {
    setTimeout(() => {
      const quantity = parseInt(this.dataset.quantity);
      this.style.setProperty('--progress-bar-width', `${quantity * 100 / 30}%`);
    }, 1e3);
  }
}
customElements.define('progress-bar', ProgressBar);

class FormState extends HTMLElement {
  constructor() {
    super();

    this.formInputs = this.querySelectorAll('input,select,textarea');
    this.form = this.querySelector('form');

    this.formInputs.forEach((input) => {
      input.addEventListener('input', this.onInputChange.bind(this));
      input.addEventListener('blur', this.onInputChange.bind(this));
    });

    if (this.form) this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
  }

  onInputChange(event) {
    this.handleInputCheck(event.target);
  }

  onSubmitHandler(event) {
    let valid = !0;

    this.formInputs.forEach((input) => {
      if (!this.handleInputCheck(input)) {
        valid = !1;
      }
    });

    if (!valid) {
      event.preventDefault();
      return;
    }
  }

  handleInputCheck(input) {
    if (input.classList.contains('required')) {

      if (input.value.length === 0 || input.value === input.dataset.empty) {
        input.classList.remove('valid');
        input.classList.add('invalid');
        
        return !1;
      }
      else {
        input.classList.remove('invalid');
        input.classList.add('valid');

        return !0;
      }
    }

    return !0;
  }
}
customElements.define('form-state', FormState);

class ListMenuItem extends HTMLElement {
  constructor() {
    super();

    this.listMenuHover = this.closest('menu-drawer').querySelector('list-menu-hover');

    this.addEventListener('mouseenter', () => {
      this.listMenuHover.open({
        title: this.dataset.title,
        url: this.dataset.url,
        image: this.dataset.image,
        description: this.dataset.description
      });
    });
  }
}
customElements.define('list-menu-item', ListMenuItem);

class ListMenuHover extends HTMLElement {
  constructor() {
    super();
  }

  open(obj) {
    let html = '';
    const opened = obj.image.length > 0 || obj.description.length > 0;

    if (opened) {
      html += `<a href="${obj.url}" class="hover-collection${obj.image.length > 0 ? '' : ' hover-collection--no-image'}">`;
        html += '<figure class="hover-collection__image"' + (obj.image.length > 0 ? `style="background-image:url(${obj.image})"` : '') + '></figure>';
        html += '<div class="hover-collection__content">'
          html += `<span class="hover-collection__title h4">${obj.title}</span>`;
          html += obj.description.length > 0 ? `<div class="hover-collection__description">${obj.description}</div>` : '';
        html += '</div>';
      html += '</a>';
    }

    this.innerHTML = html;
  }

  close() {
    this.innerHTML = '';
  }
}
customElements.define('list-menu-hover', ListMenuHover);

class TransparentHeader extends HTMLElement {
  constructor() {
    super();

    const header = document.querySelector('.shopify-section-header');

    header.classList.add('transparent-header');
    if (this.dataset.showSeparator == 'true') {
      header.classList.add('transparent-separator');
    }
  }
}
customElements.define('transparent-header', TransparentHeader);

class AddToCart extends HTMLElement {
  constructor() {
    super();

    this.miniCart = document.querySelector('mini-cart');
    this.addEventListener('click', this.onClickHandler.bind(this));
  }

  onClickHandler() {
    const variantId = this.dataset.variantId;

    if (variantId) {
      if (document.body.classList.contains('template-cart') || !theme.shopSettings.cartDrawer) {
        Shopify.postLink(theme.routes.cart_add_url, {
          parameters: {
            id: variantId,
            quantity: 1
          },
        });
        return;
      }

      this.setAttribute('disabled', true);
      this.classList.add('loading');
      const sections = this.miniCart ? this.miniCart.getSectionsToRender().map((section) => section.id) : [];

      const body = JSON.stringify({
        id: variantId,
        quantity: 1,
        sections: sections,
        sections_url: window.location.pathname
      });

      fetch(`${theme.routes.cart_add_url}`, { ...fetchConfig('javascript'), body })
        .then((response) => response.json())
        .then((parsedState) => {
          if (parsedState.status === 422) {
             document.dispatchEvent(new CustomEvent('ajaxProduct:error', {
                detail: {
                  errorMessage: parsedState.description
                }
              }));
           }
           else {
            this.miniCart && this.miniCart.renderContents(parsedState);

             document.dispatchEvent(new CustomEvent('ajaxProduct:added', {
              detail: {
                product: parsedState
              }
            }));
          }
        })
        .catch((e) => {
          console.error(e);
        })
        .finally(() => {
          this.classList.remove('loading');
          this.removeAttribute('disabled');
        });
    }
  }
}
customElements.define('add-to-cart', AddToCart);

class PriceMoney extends HTMLElement {
  constructor() {
    super();

    if (this.shouldInit()) {
      this.init();
    }
  }

  shouldInit() {
    if (document.body.dataset.priceSuperscript === undefined) {
      return false;
    }  

    const moneyFormat = theme.shopSettings.moneyFormat.toLowerCase();
    if (moneyFormat.indexOf('class=') !== -1) {
      return false;
    }
    
    return true;
  }

  init() {
    const currencies_using_comma_decimals = 'ANG,ARS,BRL,BYN,BYR,CLF,CLP,COP,CRC,CZK,DKK,EUR,HRK,HUF,IDR,ISK,MZN,NOK,PLN,RON,RUB,SEK,TRY,UYU,VES,VND'.split(',');
    const symbol = theme.shopSettings.moneyFormat.replace(/\{{.*}}/, '').trim();
    const bdi = this.querySelector('bdi');
    const price = bdi.textContent.replace(theme.shopSettings.isoCode,'');
    let html = price.replace(' ', '');
    let money_symbol_decimal = '.';
    if (currencies_using_comma_decimals.includes(theme.shopSettings.isoCode)) {
      money_symbol_decimal = ',';
    }
    if (price.includes(money_symbol_decimal)) {
      if (price.lastIndexOf(symbol) + symbol.length === price.length) {
        const price_without_symbol = price.slice(0, price.lastIndexOf(symbol));
        const price_without_decimal = price.slice(0, price.lastIndexOf(money_symbol_decimal));
        const decimal = price_without_symbol.replace(price_without_decimal, '').trim();
        html = html.replace(decimal, `<sup class="price__suffix">${decimal}</sup>`);
      }
      else {
        const price_without_decimal = price.slice(0, price.lastIndexOf(money_symbol_decimal));
        const decimal = price.replace(price_without_decimal, '').trim();
        html = html.replace(decimal, `<sup class="price__suffix">${decimal}</sup>`);
      }
    }
    html = html.replace(symbol, `<span class="price__prefix">${symbol}</span>`);
    if(theme.shopSettings.currencyCode){
       html = html + " " + theme.shopSettings.isoCode;
    }
    bdi.innerHTML = html;
  }
}
customElements.define('price-money', PriceMoney);

class SlideshowComponent extends HTMLElement {
  constructor() {
    super();

    this.elements = {
      small: this.querySelector('.slideshow__left'),
      content: this.querySelector('.slideshow__content'),
      large: this.querySelector('.slideshow__right')
    }
    this.settings = {
      autorotate: this.dataset.autorotate == 'true',
      autorotateSpeed: parseInt(this.dataset.autorotateSpeed),
      slidesSmall: this.elements.small.querySelectorAll('.slideshow__image'),
      slidesLarge: this.elements.large.querySelectorAll('.slideshow__image')
    };

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 600
    });
    this.matchMedia();
  }

  init() {
    setTimeout(() => {
      this.flickitySmall = new Flickity(this.elements.small, {
        accessibility: false,
        rightToLeft: theme.config.rtl,
        prevNextButtons: false,
        pageDots: false,
        wrapAround: true,
        draggable: false,
        setGallerySize: false,
        autoPlay: this.settings.autorotate ? this.settings.autorotateSpeed : false,
      });

      this.flickityContent = new Flickity(this.elements.content, {
        accessibility: false,
        rightToLeft: theme.config.rtl,
        prevNextButtons: true,
        pageDots: true,
        wrapAround: true,
        draggable: theme.config.mqlSmall ? true : false,
        asNavFor: this.elements.small,
        adaptiveHeight: true,
        arrowShape: 'M29.043 19.756l-28.125 28.125c-0.605 0.606-0.918 1.406-0.918 2.031s0.305 1.599 0.916 2.209l28.125 28.125c1.221 1.221 3.199 1.221 4.418 0s1.221-3.199 0-4.418l-22.793-22.793h86.209c1.727 0 3.125-1.398 3.125-2.949 0-1.727-1.398-3.125-3.125-3.125h-86.211l22.793-22.793c1.221-1.221 1.221-3.199 0-4.418s-3.203-1.217-4.414 0.006z',
        on: {
          ready: () => {
            const prevNextButtons = this.querySelectorAll('.flickity-button');
            if (prevNextButtons) {
              prevNextButtons.forEach((button) => {
                button.setAttribute('tabindex', '-1');
              });
            }
          }
        }
      });

      this.flickityLarge = new Flickity(this.elements.large, {
        accessibility: false,
        rightToLeft: theme.config.rtl,
        prevNextButtons: false,
        pageDots: false,
        wrapAround: true,
        draggable: true,
        setGallerySize: false,
        asNavFor: this.elements.content,
        dragThreshold: 10
      });

      this.bindEvents();
    });
  }

  bindEvents() {
    this.flickitySmall.on('scroll', () => {
      this.flickitySmall.slides.forEach((slide, i) => {
        const flickity = this.flickitySmall;
        const image = this.settings.slidesSmall[i];
        let x = 0;

        if (image) {
          if( 0 === i ) {
            x = Math.abs( flickity.x ) > flickity.slidesWidth ? ( flickity.slidesWidth + flickity.x + flickity.slides[flickity.slides.length - 1 ].outerWidth + slide.target ) : ( slide.target + flickity.x );
          }
          else if( i === flickity.slides.length - 1 ) {
            x = Math.abs( flickity.x ) + flickity.slides[i].outerWidth < flickity.slidesWidth ? ( slide.target - flickity.slidesWidth + flickity.x - flickity.slides[i].outerWidth ) : ( slide.target + flickity.x );
          }
          else {
            x = slide.target + flickity.x;
          }
          
          if (!theme.config.isTouch && !theme.config.rtl) {
            image.style.transform = 'translateX(' + x * ( -1 / 2 ) + 'px)';
          }
        }
      });
    });

    this.flickityLarge.on('scroll', () => {
      this.flickityLarge.slides.forEach((slide, i) => {
        const flickity = this.flickityLarge;
        const image = this.settings.slidesLarge[i];
        let x = 0;

        if (image) {
          if( 0 === i ) {
            x = Math.abs( flickity.x ) > flickity.slidesWidth ? ( flickity.slidesWidth + flickity.x + flickity.slides[flickity.slides.length - 1 ].outerWidth + slide.target ) : ( slide.target + flickity.x );
          }
          else if( i === flickity.slides.length - 1 ) {
            x = Math.abs( flickity.x ) + flickity.slides[i].outerWidth < flickity.slidesWidth ? ( slide.target - flickity.slidesWidth + flickity.x - flickity.slides[i].outerWidth ) : ( slide.target + flickity.x );
          }
          else {
            x = slide.target + flickity.x;
          }

          if (!theme.config.isTouch && !theme.config.rtl) {
            image.style.transform = 'translateX(' + x * ( -1 / 2 ) + 'px)';
          }
        }
      });
    });

    this.elements.content.querySelector('.flickity-button.next').addEventListener('click', () => {
      this.flickitySmall && this.flickitySmall.next();
      this.stopPlayer();
    });

    this.elements.content.querySelector('.flickity-button.previous').addEventListener('click', () => {
      this.flickitySmall && this.flickitySmall.previous();
      this.stopPlayer();
    });

    this.elements.content.querySelectorAll('.flickity-page-dot').forEach((button) => {
      button.addEventListener('click', () => {
        this.stopPlayer();
      });
    });

    let currentIndex = null,
      swipeDirection = null;
  
    // Detect swipe direction
    this.flickityLarge.on('dragMove',  (_event, _pointer, moveVector) => {
      currentIndex = this.flickityLarge.selectedIndex;
      swipeDirection = this.getSwipeDirection(moveVector);

      this.stopPlayer();
    });
    
    // Do stuff based on a successful swipe and it's direction
    this.flickityLarge.on('dragEnd', () => {
      if (this.flickityLarge.selectedIndex !== currentIndex) {
        
        if (swipeDirection === 'left') {
          this.flickitySmall.next();
        }
        else {
          this.flickitySmall.previous();
        }
      }
    });
  }

  stopPlayer() {
    if (this.settings.autorotate) {
      this.flickitySmall && this.flickitySmall.stopPlayer();
    }
  }

  getSwipeDirection(moveVector) {
    return moveVector.x > 0 ? 'right' : 'left';
  }

  matchMedia() {
    document.addEventListener('matchSmall', () => {
      this.unload();
      this.init();
    });

    document.addEventListener('unmatchSmall', () => {
      this.unload();
      this.init();
    });
  }

  unload() {
    if (this.flickitySmall && typeof this.flickitySmall.destroy === 'function') {
      this.flickitySmall.destroy();
    }
    if (this.flickityContent && typeof this.flickityContent.destroy === 'function') {
      this.flickityContent.destroy();
    }
    if (this.flickityLarge && typeof this.flickityLarge.destroy === 'function') {
      this.flickityLarge.destroy();
    }
  }
}
customElements.define('slideshow-component', SlideshowComponent);

class TestimonialsComponent extends HTMLElement {
  constructor() {
    super();

    if (this.dataset.slider == 'true') {
      this.settings = {
        autorotate: this.dataset.autorotate == 'true',
        autorotateSpeed: parseInt(this.dataset.autorotateSpeed)
      };
      this.slider = this.querySelector('.testimonial__list');
      this.previews = this.querySelector('.testimonial__previews');

      theme.initWhenVisible({
        element: this,
        callback: this.init.bind(this),
        threshold: 600
      });
      theme.initWhenVisible({
        element: this,
        callback: this.update.bind(this),
        threshold: 0
      });
    }
  }

  init() {
    setTimeout(() => {
      if (this.slider) {
        this.flickity = new Flickity(this.slider, {
          accessibility: false,
          rightToLeft: theme.config.rtl,
          prevNextButtons: true,
          arrowShape: 'M29.043 19.756l-28.125 28.125c-0.605 0.606-0.918 1.406-0.918 2.031s0.305 1.599 0.916 2.209l28.125 28.125c1.221 1.221 3.199 1.221 4.418 0s1.221-3.199 0-4.418l-22.793-22.793h86.209c1.727 0 3.125-1.398 3.125-2.949 0-1.727-1.398-3.125-3.125-3.125h-86.211l22.793-22.793c1.221-1.221 1.221-3.199 0-4.418s-3.203-1.217-4.414 0.006z',
          pageDots: false,
          wrapAround: true,
          draggable: true,
          cellAlign: 'center',
          autoPlay: this.settings.autorotate ? this.settings.autorotateSpeed : false,
          pauseAutoPlayOnHover: true,
          asNavFor: this.previews
        });
      }

      this.flickityNav = new Flickity(this.previews, {
        accessibility: false,
        rightToLeft: theme.config.rtl,
        prevNextButtons: this.flickity ? false : true,
        arrowShape: this.flickity ? '' : 'M29.043 19.756l-28.125 28.125c-0.605 0.606-0.918 1.406-0.918 2.031s0.305 1.599 0.916 2.209l28.125 28.125c1.221 1.221 3.199 1.221 4.418 0s1.221-3.199 0-4.418l-22.793-22.793h86.209c1.727 0 3.125-1.398 3.125-2.949 0-1.727-1.398-3.125-3.125-3.125h-86.211l22.793-22.793c1.221-1.221 1.221-3.199 0-4.418s-3.203-1.217-4.414 0.006z',
        pageDots: false,
        wrapAround: true,
        selectedAttraction: 0.2,
        friction: 0.8,
        adaptiveHeight: true,
      });

      this.flickityNav.previous();
      if (this.settings.autorotate) {
        this.flickity.pausePlayer();
      }

      this.flickity && this.flickity.on('staticClick', (_event, _pointer, _cellElement, cellIndex) => {
        if (typeof cellIndex == 'number') {
          this.flickityNav.select(cellIndex);
        }
      });
      
      // Do stuff based on a successful swipe and it's direction
      this.flickity && this.flickity.on('change', (index) => {
        this.flickityNav.select(index);
      });
    });
  }

  update() {
    setTimeout(() => {
      if (this.flickity && this.flickityNav) {
        this.flickityNav.next();
        if (this.settings.autorotate) {
          this.flickity.unpausePlayer();
        }
      }
    }, 300);
  }

  getSwipeDirection(moveVector) {
    return moveVector.x > 0 ? 'right' : 'left';
  }
}
customElements.define('testimonials-component', TestimonialsComponent);

class UseAnimate extends HTMLElement {
  constructor() {
    super();

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 0
    });
  }

  init() {
    this.setAttribute('animate', '');
  }
}
customElements.define('use-animate', UseAnimate);

class AnimateSticky extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.onScrollHandler = this.onScroll.bind(this);

    window.addEventListener('scroll', this.onScrollHandler, false);
    this.onScrollHandler();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScrollHandler);
  }

  onScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > this.getOffsetTop(this)) {
      window.requestAnimationFrame(this.reveal.bind(this));
    } else {
      window.requestAnimationFrame(this.reset.bind(this));
    }
  }

  reveal() {
    this.setAttribute('animate', '');
  }

  reset() {
    this.removeAttribute('animate');
  }

  getOffsetTop(element) {
    let offsetTop = 0;
    while(element) {
      offsetTop += element.offsetTop;
      element = element.offsetParent;
    }
    return offsetTop;
  }
}
customElements.define('animate-sticky', AnimateSticky);

class LookbookComponent extends HTMLElement {
  constructor() {
    super();

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 0
    });
  }

  init() {
    const hotspots = this.querySelectorAll('.look__hotspot');
    hotspots.forEach((hotspot) => {
      hotspot.classList.add('is-active');
    });

    setTimeout(() => {
      hotspots.forEach((hotspot) => {
        hotspot.classList.remove('is-active');
      });
    }, 3e3);
  }
}
customElements.define('lookbook-component', LookbookComponent);

class TabCollage extends HTMLElement {
  constructor() {
    super();

    this.querySelectorAll('.tab-collage__heading').forEach(
      (button) => button.addEventListener('click', this.onButtonClick.bind(this))
    );

    if (this.dataset.accordion === undefined) {
      this.querySelectorAll('.tab-collage__heading').forEach(
        (button) => button.addEventListener('mouseover', this.onButtonClick.bind(this))
      );
    }
  }

  onButtonClick(event) {
    const target = event.target;
    if (target.classList.contains('is-active')) {
      if (this.dataset.accordion !== undefined) {
        target.classList.remove('is-active');
      }
      return;
    }

    this.pauseAllMedia();

    this.querySelectorAll('[data-block-id]').forEach((button) => {
      if (target.dataset.blockId === button.dataset.blockId) {
        button.classList.add('is-active');
      }
      else {
        button.classList.remove('is-active');
      }
    });
  }

  pauseAllMedia() {
    this.querySelectorAll('video-section[data-type="youtube"] iframe').forEach((video) => {
      video.contentWindow.postMessage('{"event":"command","func":"' + 'pauseVideo' + '","args":""}', '*');
    });
    this.querySelectorAll('video-section[data-type="vimeo"] iframe').forEach((video) => {
      video.contentWindow.postMessage('{"method":"pause"}', '*');
    });
    this.querySelectorAll('video').forEach((video) => video.pause());
  }
}
customElements.define('tab-collage', TabCollage);

class CountdownTimer extends HTMLElement {
  constructor() {
    super();

    this.parent = this.closest('.product-countdown');
    this.date = this.parseToDate(this.dataset.date).getTime();
    
    if (isNaN(this.date)) {
      this.unload();
      return;
    }

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 200
    });
  }

  parseToDate(input) {
    if (input.includes("T")) {
      return new Date(input);
    }
    
    const [month, day, year] = input.split('-');
    return new Date(`${year}-${month}-${day}`);
  }

  init() {
    this.timer();
    this.dataset.interval = setInterval(this.timer.bind(this), 1000);
  }

  timer() {
    const now = new Date(),
      countTo = new Date(this.date),
      timeDifference = (countTo - now);

    if (timeDifference < 0) {
      this.unload();
      return;
    }

    const secondsInADay = 60 * 60 * 1000 * 24,
      secondsInAHour = 60 * 60 * 1000;

    const days = Math.floor(timeDifference / (secondsInADay) * 1);
    const hours = Math.floor((timeDifference % (secondsInADay)) / (secondsInAHour) * 1);
    const mins = Math.floor(((timeDifference % (secondsInADay)) % (secondsInAHour)) / (60 * 1000) * 1);
    const secs = Math.floor((((timeDifference % (secondsInADay)) % (secondsInAHour)) % (60 * 1000)) / 1000 * 1);

    if (this.dataset.compact == 'true') {
      const dayHTML = days > 0 ? `<div class="countdown__item"><span>${days}${theme.dateStrings.d}</span></div>` : '';
      const otherHTML = `<div class="countdown__item"><span>${hours > 9 ? hours : '0' + hours}:${mins > 9 ? mins : '0' + mins}:${secs > 9 ? secs : '0' + secs}</span></div>`;
  
      this.innerHTML = dayHTML + otherHTML;
    }
    else {
      const dayHTML = days > 0 ? `<div class="countdown__item"><span>${days}</span> ${days == 1 ? theme.dateStrings.day : theme.dateStrings.days}</div>` : '';
      const hourHTML = `<div class="countdown__item"><span>${hours}</span> ${hours == 1 ? theme.dateStrings.hour : theme.dateStrings.hours}</div>`;
      const minHTML = `<div class="countdown__item"><span>${mins}</span> ${mins == 1 ? theme.dateStrings.minute : theme.dateStrings.minutes}</div>`;
      const secHTML = `<div class="countdown__item"><span>${secs}</span> ${secs == 1 ? theme.dateStrings.second : theme.dateStrings.seconds}</div>`;

      this.innerHTML = dayHTML + hourHTML + minHTML + secHTML;
    }
  }

  unload() {
    if (this.dataset.interval) {
      clearInterval(this.dataset.interval);
    }

    this.classList.add('hidden');
    if (this.parent) {
      this.parent.classList.add('hidden');
    }
  }
}
customElements.define('countdown-timer', CountdownTimer);

class GMap extends HTMLElement {
  constructor() {
    super();

    if (!this.dataset.apiKey || !this.dataset.mapAddress) {
      return;
    }

    theme.initWhenVisible({
      element: this,
      callback: this.prepMapApi.bind(this),
      threshold: 200
    });
  }

  prepMapApi() {
    this.loadScript().then(this.initMap.bind(this));
  }

  loadScript() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      document.body.appendChild(script);
      script.onload = resolve;
      script.onerror = reject;
      script.async = true;
      script.src = 'https://maps.googleapis.com/maps/api/js?key=' + this.dataset.apiKey;
    });
  }

  initMap() {
    const geocoder = new google.maps.Geocoder();

    geocoder.geocode({ address: this.dataset.mapAddress }, (results, status) => {
      if (status !== google.maps.GeocoderStatus.OK) {
        if (Shopify.designMode) {}
      }
      else {
        const mapOptions = {
          zoom: parseInt(this.dataset.zoom),
          center: results[0].geometry.location,
          draggable: true,
          clickableIcons: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
          disableDefaultUI: true
        };

        const map = new google.maps.Map(this, mapOptions), center = map.getCenter();

        map.setCenter(center);

        const icon = {
          path: "M32.7374478,5.617 C29.1154478,1.995 24.2994478,0 19.1774478,0 C14.0544478,0 9.23944778,1.995 5.61744778,5.617 C-1.08555222,12.319 -1.91855222,24.929 3.81344778,32.569 L19.1774478,54.757 L34.5184478,32.6 C40.2734478,24.929 39.4404478,12.319 32.7374478,5.617 Z M19.3544478,26 C15.4954478,26 12.3544478,22.859 12.3544478,19 C12.3544478,15.141 15.4954478,12 19.3544478,12 C23.2134478,12 26.3544478,15.141 26.3544478,19 C26.3544478,22.859 23.2134478,26 19.3544478,26 Z",
          fillColor: this.dataset.markerColor,
          fillOpacity: 1,
          anchor: new google.maps.Point(15, 55),
          strokeWeight: 0,
          scale: 0.6
        };

        new google.maps.Marker({
          map: map,
          position: map.getCenter(),
          icon: icon
        });

        const styledMapType = new google.maps.StyledMapType(JSON.parse(this.parentNode.querySelector('[data-gmap-style]').innerHTML));

        map.mapTypes.set('styled_map', styledMapType);
        map.setMapTypeId('styled_map');

        google.maps.event.addDomListener(window, 'resize', function () {
          google.maps.event.trigger(map, 'resize');
          map.setCenter(center);
        });
      }
    });
  }
}
customElements.define('g-map', GMap);

class RelatedButtons extends HTMLElement {
  constructor() {
    super();

    if(!document.querySelector(this.dataset.scrollto)) {
      this.classList.add('hidden');
      return;
    }

    window.addEventListener('scroll', this.checkListener.bind(this));
    this.querySelectorAll('a').forEach(
      (button) => button.addEventListener('click', this.onButtonClick.bind(this))
    );
  }

  checkListener() {
    const element = document.querySelector(this.dataset.scrollto);
    const show = window.scrollY >= element.offsetTop - element.clientHeight;

    if (show) {
      this.classList.add('is-flipped');
    } else {
      this.classList.remove('is-flipped');
    }
  }

  onButtonClick(event) {
    event.preventDefault();
    const target = event.target;
    const scrollIntoView = document.querySelector(target.getAttribute('href'));

    scrollIntoView.scrollIntoView({behavior: "smooth"});
  }
}
customElements.define('related-buttons', RelatedButtons);

class ProductRecentlyViewed extends HTMLElement {
  constructor() {
    super();
    
    // We save the product ID in local storage to be eventually used for recently viewed section
    if (isStorageSupported('local')) {
      const productId = parseInt(this.dataset.productId);
      const cookieName = 'beyours:recently-viewed';
      const items = JSON.parse(window.localStorage.getItem(cookieName) || '[]');

      // We check if the current product already exists, and if it does not, we add it at the start
      if (!items.includes(productId)) {
        items.unshift(productId);
      }

      // By keeping only the 4 most recent
      window.localStorage.setItem(cookieName, JSON.stringify(items.slice(0, 5)));
    }
  }
}
customElements.define('product-recently-viewed', ProductRecentlyViewed);

class RecentlyViewedProducts extends HTMLElement {
  constructor() {
    super();

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 600
    });
  }

  init() {
    fetch(this.dataset.url + this.getQueryString())
      .then(response => response.text())
      .then(text => {
        const html = document.createElement('div');
        html.innerHTML = text;
        const recommendations = html.querySelector('recently-viewed-products');
        if (recommendations && recommendations.innerHTML.trim().length) {
          this.innerHTML = recommendations.innerHTML;
        }
      })
      .catch(e => {
        console.error(e);
      });
  }

  getQueryString() {
    const cookieName = 'beyours:recently-viewed';
    const items = JSON.parse(window.localStorage.getItem(cookieName) || "[]");
    if (this.dataset.productId && items.includes(parseInt(this.dataset.productId))) {
      items.splice(items.indexOf(parseInt(this.dataset.productId)), 1);
    }
    return items.map((item) => "id:" + item).slice(0, 4).join(" OR ");
  }
}
customElements.define('recently-viewed-products', RecentlyViewedProducts);

class VideoSection extends HTMLElement {
  constructor() {
    super();

    this.background = this.dataset.initMode !== 'template';
    this.loop = this.dataset.loop;

    if (this.background) {
      theme.initWhenVisible({
        element: this,
        callback: this.init.bind(this),
        threshold: 600
      });
    }
    else {
      this.init();
    }
  }

  init() {
    this.parentSelector = this.dataset.parent || '.media-wrapper';
    this.parent = this.closest(this.parentSelector);

    switch(this.dataset.type) {
      case 'youtube':
        this.initYoutubeVideo();
        break;

      case 'vimeo':
        this.initVimeoVideo();
        break;

      case 'mp4':
        this.initMp4Video();
        break;
    }
  }

  initYoutubeVideo() {
    this.setAsLoading();
    this.loadScript('youtube').then(this.setupYoutubePlayer.bind(this));
  }

  initVimeoVideo() {
    this.setAsLoading();
    this.loadScript('vimeo').then(this.setupVimeoPlayer.bind(this));
  }

  initMp4Video() {
    const player = this.querySelector('video');

    if (player) {
      const promise = player.play();

      // Edge does not return a promise (video still plays)
      if (typeof promise !== 'undefined') {
        promise.then(function() {
          // playback normal
        }).catch(function() {
          player.setAttribute('controls', '');
        });
      }
    }
  }

  loadScript(videoType) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      document.body.appendChild(script);
      script.onload = resolve;
      script.onerror = reject;
      script.async = true;
      script.src = videoType === 'youtube' ? '//www.youtube.com/iframe_api' : '//player.vimeo.com/api/player.js';
    });
  }

  setAsLoading() {
    this.parent.setAttribute('loading', true);
  }

  setAsLoaded() {
    this.parent.removeAttribute('loading');
    this.parent.setAttribute('loaded', true);
  }

  setupYoutubePlayer() {
    const videoId = this.dataset.videoId;
    
    const playerInterval = setInterval(() => {
      if (window.YT) {
        window.YT.ready(() => {
          const element = document.createElement('div');
          this.appendChild(element);

          this.player = new YT.Player(element, {
            videoId: videoId,
            playerVars: {
              showinfo: 0,
              controls: !this.background,
              fs: !this.background,
              rel: 0,
              height: '100%',
              width: '100%',
              iv_load_policy: 3,
              html5: 1,
              loop: this.loop == '1' ? 1 : 0,
              playlist: videoId,
              playsinline: 1,
              modestbranding: 1,
              disablekb: 1
            },
            events: {
              onReady: this.onYoutubeReady.bind(this),
              onStateChange: this.onYoutubeStateChange.bind(this)
            }
          });
          clearInterval(playerInterval);
        });
      }
    }, 50);
  }

  onYoutubeReady() {
    this.iframe = this.querySelector('iframe'); // iframe once YT loads
    this.iframe.setAttribute('tabindex', '-1');

    this.background && this.player.mute();
    if (typeof this.player.playVideo === 'function') this.player.playVideo();

    this.setAsLoaded();

    // pause when out of view
    const observer = new IntersectionObserver((entries, _observer) => {
      entries.forEach(entry => {
        entry.isIntersecting ? this.youtubePlay() : this.youtubePause();
      });
    }, {rootMargin: '0px 0px 50px 0px'});

    observer.observe(this.iframe);
  }

  onYoutubeStateChange(event) {
    switch (event.data) {
      case -1: // unstarted
        // Handle low power state on iOS by checking if
        // video is reset to unplayed after attempting to buffer
        if (this.attemptedToPlay) {
          this.setAsLoaded();
          this.closest('.banner').classList.add('video-interactable');
        }
        break;
      case 0: // ended, loop it
        this.youtubePlay();
        break;
      case 1: // playing
        this.setAsLoaded();
        break;
      case 3: // buffering
        this.attemptedToPlay = true;
        break;
    }
  }

  youtubePlay() {
    if (this.background && this.player && typeof this.player.playVideo === 'function') {
      this.player.playVideo();
    }
  }

  youtubePause() {
    if (this.background && this.player && typeof this.player.pauseVideo === 'function') {
      this.player.pauseVideo();
    }
  }

  setupVimeoPlayer() {
    const videoId = this.dataset.videoId;

    const playerInterval = setInterval(() => {
      if (window.Vimeo) {
        this.player = new Vimeo.Player(this, {
          id: videoId,
          autoplay: true,
          autopause: false,
          background: this.background,
          controls: !this.background,
          loop: this.loop == '1' ? true : false,
          playlist: videoId,
          height: '100%',
          width: '100%'
        });
        this.player.ready().then(this.onVimeoReady.bind(this));

        clearInterval(playerInterval);
      }
    }, 50);
  }

  onVimeoReady() {
    this.iframe = this.querySelector('iframe');
    this.iframe.setAttribute('tabindex', '-1');

    this.background && this.player.setMuted(true);

    this.setAsLoaded();

    // pause when out of view
    const observer = new IntersectionObserver((entries, _observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.vimeoPlay();
        } else {
          this.vimeoPause();
        }
      });
    }, {rootMargin: '0px 0px 50px 0px'});

    observer.observe(this.iframe);
  }

  vimeoPlay() {
    if (this.background && this.player && typeof this.player.play === 'function') {
      this.player.play();
    }
  }

  vimeoPause() {
    if (this.background && this.player && typeof this.player.pause === 'function') {
      this.player.pause();
    }
  }
}
customElements.define('video-section', VideoSection);

class BundleProduct extends HTMLElement {
  constructor() {
    super();

    this.classes = {
      souldout: 'price--sold-out',
      onsale: 'price--on-sale',
      nocompare: 'price--no-compare'
    };

    this.addToCart = this.querySelector('add-to-cart');
    this.price = this.querySelector('.price');
    this.variants = this.querySelector('select');
    if (this.variants) {
      this.variants.addEventListener('change', this.onSelectChange.bind(this));
    }
  }

  onSelectChange(event) {
    const variants = event.target;
    const variant = variants.options[variants.selectedIndex];
    const compare_at_price = parseInt(variant.dataset.compare_at_price || 0);
    const price = parseInt(variant.dataset.price || 0);
    const available = variant.dataset.available === 'true';
    const price_varies = variants.dataset.price_varies === 'true';
    const compare_at_price_varies = variants.dataset.compare_at_price_varies === 'true';

    // Remove classes
    this.price.classList.remove(this.classes.souldout);
    this.price.classList.remove(this.classes.onsale);
    this.price.classList.remove(this.classes.nocompare);

    // Add classes
    if (available === false) {
      this.price.classList.add(this.classes.souldout);
    }
    else if (compare_at_price > price && available) {
      this.price.classList.add(this.classes.onsale);
    }
    if (price_varies == false && compare_at_price_varies) {
      this.price.classList.add(this.classes.nocompare);
    }

    // Change price
    const price__regular = this.querySelector('.price__regular');
    price__regular.querySelector('.price-item--regular').innerHTML = `<price-money><bdi>${theme.Currency.formatMoney(price, theme.shopSettings.moneyFormat)}</bdi></price-money>`;

    const price__sale = this.querySelector('.price__sale');
    price__sale.querySelector('.price-item--regular').innerHTML = `<price-money><bdi>${theme.Currency.formatMoney(compare_at_price, theme.shopSettings.moneyFormat)}</bdi></price-money>`;
    price__sale.querySelector('.price-item--sale').innerHTML = `<price-money><bdi>${theme.Currency.formatMoney(price, theme.shopSettings.moneyFormat)}</bdi></price-money>`;

    // Change variant id
    if (this.addToCart) {
      this.addToCart.dataset.variantId = variant.value;
    }
  }
}
customElements.define('bundle-product', BundleProduct);

class BundleProducts extends HTMLElement {
  constructor() {
    super();

    this.classes = {
      hover: 'is-hover',
      active: 'is-active',
    };

    this.miniCart = document.querySelector('mini-cart');
    this.button = this.querySelector('button');
    if (this.button) this.button.addEventListener('click', this.onButtonClick.bind(this));

    this.blocks = this.querySelectorAll('[data-block-id]');
    this.blocks.forEach((block) => block.addEventListener('mouseenter', this.onEnterHandler.bind(this)));
    this.blocks.forEach((block) => block.addEventListener('mouseleave', this.onLeaveHandler.bind(this)));
  }

  onEnterHandler(event) {
    this.classList.add(this.classes.hover);

    const target = event.target;
    const blockId = target.dataset.blockId;
    this.blocks.forEach((block) => {
      if (target.nodeName === 'BUNDLE-PRODUCT') {
        if (block.nodeName === 'BUNDLE-PRODUCT') {
          block.classList.add(this.classes.active);
          return;
        }
      }
      if (block.dataset.blockId === blockId) {
        block.classList.add(this.classes.active);
      }
    });
  }

  onLeaveHandler() {
    this.classList.remove(this.classes.hover);
    this.blocks.forEach((block) => block.classList.remove(this.classes.active));
  }

  onButtonClick(event) {
    event.preventDefault();

    const ids = this.querySelectorAll('[name="id"]');
    const items = {
      items: [...ids].map((e => e.value)).map((e => ({
        id: e,
        quantity: 1
      })))
    };

    if (document.body.classList.contains('template-cart') || !theme.shopSettings.cartDrawer) {
      Shopify.postLink2(theme.routes.cart_add_url, {
        parameters: {
          ...items
        }
      });
      return;
    }

    this.handleErrorMessage();

    this.button.setAttribute('disabled', true);
    this.button.classList.add('loading');
    const sections = this.miniCart ? this.miniCart.getSectionsToRender().map((section) => section.id) : [];

    const body = JSON.stringify({
      ...items,
      sections: sections,
      sections_url: window.location.pathname
    });

    fetch(`${theme.routes.cart_add_url}`, { ...fetchConfig('javascript'), body })
      .then((response) => response.json())
      .then((response) => {
        if (response.status) {
          this.handleErrorMessage(response.description);
          return;
        }

        if (response.status === 422) {
          document.dispatchEvent(new CustomEvent('ajaxProduct:error', {
            detail: {
              errorMessage: response.description
            }
          }));
        }
        else {
          this.miniCart && this.miniCart.renderContents(response);

          document.dispatchEvent(new CustomEvent('ajaxProduct:added', {
            detail: {
              product: response
            }
          }));
        }
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => {
        this.button.classList.remove('loading');
        this.button.removeAttribute('disabled');
      });
  }

  handleErrorMessage(errorMessage = false) {
    this.errorMessageWrapper = this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
    
    if (this.errorMessageWrapper) {
      this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');
      this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

      if (errorMessage) {
        this.errorMessage.textContent = errorMessage;
      }
    }
    else {
      if (errorMessage) {
        alert(errorMessage);
      }
    }
  }
}
customElements.define('bundle-products', BundleProducts);

class ShopTheLook extends HTMLElement {
  constructor() {
    super();

    if (this.dataset.blockCount == 1) {
      return;
    }

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 600
    });
  }

  init() {
    this.products = this.querySelector('.image-with-text__products');

    this.blocks = this.querySelectorAll('lookbook-component [data-block-index]');
    this.blocks.forEach((block) => block.addEventListener('mouseenter', this.onEnterHandler.bind(this)));

    this.initSlider();
  }

  onEnterHandler(event) {
    if (this.flickity && typeof this.flickity.select === 'function') {
      const index = parseInt(event.target.dataset.blockIndex);
      this.flickity.select(index);
    }
  }

  onFocusHandler(index) {
    this.blocks.forEach((block) => {
      block.classList.remove('focus');

      if (parseInt(block.dataset.blockIndex) === index) {
        block.classList.add('focus');
      }
    });
  }

  initSlider() {
    this.flickity = new Flickity(this.products, {
      accessibility: false,
      rightToLeft: theme.config.rtl,
      prevNextButtons: false,
      pageDots: true,
      wrapAround: true,
      fade: true,
      setGallerySize: true,
      on: {
        ready: () => {
          this.onFocusHandler(0);
        },
        change: (index) => {
          this.onFocusHandler(index);
        }
      }    
    });
  }
}
customElements.define('shop-the-look', ShopTheLook);

class SelectWrapper extends HTMLElement {
  constructor() {
    super();

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 200
    });

    this.select = this.querySelector('select');
    if (this.select) {
      this.select.addEventListener('change', this.handleSelectChange.bind(this));
    }
  }

  init() {
    const style = window.getComputedStyle(this.select);
    const value = this.select.options[this.select.selectedIndex].text;

    const text = document.createElement('span');
    text.style.fontFamily = style.fontFamily;
    text.style.fontSize = style.fontSize;
    text.style.fontWeight = style.fontWeight;
    text.style.visibility = 'hidden';
    text.style.position = 'absolute';
    text.innerHTML = value;

    document.body.appendChild(text);
    const width = text.clientWidth;
    
    this.style.setProperty('--width', `${width}px`);
    text.remove();
  }

  handleSelectChange() {
    this.init();
  }
}
customElements.define('select-wrapper', SelectWrapper);

class ImageComparison extends HTMLElement {
  constructor() {
    super();

    this.active = false;
    this.button = this.querySelector('button');
    this.horizontal = this.dataset.layout === 'horizontal';
    this.bodyStyleOverflowY = document.body.style.overflowY;
    this.init();

    theme.initWhenVisible({
      element: this.querySelector('.image-comparison__animate'),
      callback: this.animate.bind(this),
      threshold: 0
    });
  }

  animate() {
    this.setAttribute('animate', '');
    this.classList.add('animating');
    setTimeout(() => {
      this.classList.remove('animating');
    }, 1e3);
  }

  init() {
    this.button.addEventListener('touchstart', this.startHandler.bind(this));
    document.body.addEventListener('touchend', this.endHandler.bind(this));
    document.body.addEventListener('touchmove', this.onHandler.bind(this));
    
    this.button.addEventListener('mousedown', this.startHandler.bind(this));
    document.body.addEventListener('mouseup', this.endHandler.bind(this));
    document.body.addEventListener('mousemove', this.onHandler.bind(this));
  }

  startHandler() {
    if(window.innerWidth <= 750) {
      document.body.style.overflowY = 'hidden';
    }

    this.active = true;
    this.classList.add('scrolling');
  }

  endHandler() {
    this.active = false;
    this.classList.remove('scrolling');
    document.body.style.overflowY = this.bodyStyleOverflowY;
  }

  onHandler(e) {
    if (!this.active) return;
    
    const event = (e.touches && e.touches[0]) || e;
    const x = this.horizontal
                ? event.pageX - this.offsetLeft
                : event.pageY - this.offsetTop;

    this.scrollIt(x);
  }

  scrollIt(x) {
    const distance = this.horizontal ? this.clientWidth : this.clientHeight;
    
    const max = distance - 20;
    const min = 20;
    const mouseX = Math.max(min, (Math.min(x, max)));
    const mousePercent = (mouseX * 100) / distance;
    this.style.setProperty('--percent', mousePercent + '%');
  }
}
customElements.define('image-comparison', ImageComparison);

class ScrollingPromotion extends HTMLElement {
  constructor() {
    super();

    this.config = {
      moveTime: parseFloat(this.dataset.speed), // 100px going to move for
      space: 100, // 100px
    };

    this.promotion = this.querySelector('.promotion');

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 600
    });
  }

  init() {
    if (this.childElementCount === 1) {
      this.promotion.classList.add('promotion--animated');

      for (let index = 0; index < 10; index++) {
        this.clone = this.promotion.cloneNode(true);
        this.clone.setAttribute('aria-hidden', true);
        this.appendChild(this.clone);

        const imageWrapper = this.clone.querySelector('.media-wrapper');
        if (imageWrapper) {
          imageWrapper.classList.remove('loading');
        }
      }

      const animationTimeFrame = (this.promotion.clientWidth / this.config.space) * this.config.moveTime;
      this.style.setProperty('--duration', `${animationTimeFrame}s`);

      // pause when out of view
      const observer = new IntersectionObserver((entries, _observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.scrollingPlay();
          } else {
            this.scrollingPause();
          }
        });
      }, {rootMargin: '0px 0px 50px 0px'});

      observer.observe(this);
    }
  }

  scrollingPlay() {
    this.classList.remove('scrolling-promotion--paused');
  }

  scrollingPause() {
    this.classList.add('scrolling-promotion--paused');
  }
}
customElements.define('scrolling-promotion', ScrollingPromotion);

class AccordionTab extends HTMLElement {
  constructor() {
    super();

    this.details = this.querySelector('details');
    this.summary = this.querySelector('summary');
    this.content = this.querySelector('.accordion__content');

    this.animation = null;
    this.isClosing = false;
    this.isExpanding = false;

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 200
    });
  }

  init() {
    this.summary.addEventListener('click', (e) => this.onClick(e));
  }

  onClick(e) {
    e.preventDefault();

    this.details.style.overflow = 'hidden';
    if (this.isClosing || !this.details.open) {
      this.open();
    }
    else if (this.isExpanding || this.details.open) {
      this.shrink();
    }
  }

  shrink() {
    this.isClosing = true;
    
    const summaryStyle = window.getComputedStyle(this.summary);
    const startHeight = `${this.details.offsetHeight}px`;
    const endHeight = `${this.summary.offsetHeight + parseInt(summaryStyle.marginTop)}px`;
    
    if (this.animation) {
      this.animation.cancel();
    }
    
    this.animation = this.details.animate({
      height: [startHeight, endHeight]
    }, {
      duration: 250,
      easing: 'ease'
    });
    
    this.animation.onfinish = () => this.onAnimationFinish(false);
    this.animation.oncancel = () => this.isClosing = false;
  }

  open() {
    this.details.style.height = `${this.details.offsetHeight}px`;
    this.details.open = true;
    window.requestAnimationFrame(() => this.expand());
  }

  expand() {
    this.isExpanding = true;

    const summaryStyle = window.getComputedStyle(this.summary);
    const startHeight = `${this.details.offsetHeight}px`;
    const endHeight = `${this.summary.offsetHeight + parseInt(summaryStyle.marginTop) + this.content.offsetHeight}px`;
    
    if (this.animation) {
      this.animation.cancel();
    }
    
    this.animation = this.details.animate({
      height: [startHeight, endHeight]
    }, {
      duration: 400,
      easing: 'ease-out'
    });
    this.animation.onfinish = () => this.onAnimationFinish(true);
    this.animation.oncancel = () => this.isExpanding = false;
  }

  onAnimationFinish(open) {
    this.details.open = open;
    this.animation = null;
    this.isClosing = false;
    this.isExpanding = false;
    this.details.style.height = this.details.style.overflow = '';
  }
}
customElements.define('accordion-tab', AccordionTab);

class ProductRecommendations extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    new IntersectionObserver(this.handleIntersection.bind(this), {rootMargin: '0px 0px 600px 0px'}).observe(this);
  }

  handleIntersection(entries, observer) {
    if (!entries[0].isIntersecting) return;
    observer.unobserve(this);

    fetch(this.dataset.url)
      .then(response => response.text())
      .then(text => {
        const html = document.createElement('div');
        html.innerHTML = text;
        const recommendations = html.querySelector('product-recommendations');
        if (recommendations && recommendations.innerHTML.trim().length) {
          this.innerHTML = recommendations.innerHTML;
        }
      })
      .catch(e => {
        console.error(e);
      });
  }
}
customElements.define('product-recommendations', ProductRecommendations);

class HeaderMenuToggle extends HTMLElement {
  constructor() {
    super();
    
    this.header = document.querySelector('.shopify-section-header');
    this.addEventListener('click', this.onButtonClick.bind(this));
  }

  onButtonClick() {
    this.header.classList.toggle('shopify-section-header-menu-open');
  }
}
customElements.define('header-menu-toggle', HeaderMenuToggle);

class OptionTable extends HTMLElement {
  constructor() {
    super();

    this.config = {
    };

    this.imageOptionRows = this.querySelectorAll(".ot--images .ot--option-row");
    this.dataOptionRows = this.querySelectorAll(".ot--data .ot--option-row");

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 600
    });
  }

  init() {
    const optionTable = this;

    this.imageOptionRows.forEach((imageOptionRow) => {
      imageOptionRow.addEventListener("mouseenter", function () {
        optionTable.querySelectorAll(".ot--data .ot--option-row").forEach((el) => {
          el.classList.remove("active");
        });
        optionTable.querySelectorAll(".ot--images .ot--option-row").forEach((el) => {
          el.style.opacity = "0.3";
        });
        optionTable.querySelectorAll(".ot--images .ot--option-row").forEach((el) => {
          el.style.zIndex = "initial";
        });

        this.style.opacity = "1";
        this.style.zIndex = "3";

        var imageRowId = this.id;
        var dataRowId = imageRowId.replace("imageRow", "dataRow");
        var activeDataRow = optionTable.querySelector(`#${dataRowId}`);
        activeDataRow.classList.add("active");

        optionTable.querySelectorAll(`:scope .data-row.data-headers>div:not(.blank)`).forEach(el => {
          el.classList.remove('active');
        });
        var activeDataRowValues = activeDataRow.querySelectorAll(`:scope div:not(.is-header)`);
        activeDataRowValues.forEach((activeDataRowValue, i) => {
          if (activeDataRowValue.querySelectorAll(`:scope svg.checkmark`).length > 0) {
            optionTable.querySelectorAll(`:scope .data-row.data-headers>div:not(.blank)`)[i].classList.add('active');
          }
        });
      });
      imageOptionRow.addEventListener("mouseleave", function () {
        optionTable.querySelectorAll(".ot--data .ot--option-row").forEach((el) => {
          el.classList.remove("active");
        });
        optionTable.querySelectorAll(".ot--images .ot--option-row").forEach((el) => {
          el.style.opacity = "1";
        });
        optionTable.querySelectorAll(`:scope .data-row.data-headers>div:not(.blank)`).forEach(el => {
          el.classList.remove('active');
        });
      });
    });

    this.dataOptionRows.forEach((dataOptionRow) => {
      dataOptionRow.addEventListener("mouseenter", function () {
        optionTable.querySelectorAll(".ot--data .ot--option-row").forEach((el) => {
          el.classList.remove("active");
        });
        this.classList.add("active");
        optionTable.querySelectorAll(".ot--images .ot--option-row").forEach((el) => {
          el.style.opacity = "0.3";
        });
        optionTable.querySelectorAll(".ot--images .ot--option-row").forEach((el) => {
          el.style.zIndex = "initial";
        });

        var dataRowId = this.id;
        var imageRowId = dataRowId.replace("dataRow", "imageRow");
        optionTable.querySelector(`#${imageRowId}`).style.opacity = "1";
        optionTable.querySelector(`#${imageRowId}`).style.zIndex = "3";
      });
      dataOptionRow.addEventListener("mouseleave", function () {
        optionTable.querySelectorAll(".ot--data .ot--option-row").forEach((el) => {
          el.classList.remove("active");
        });
        optionTable.querySelectorAll(".ot--images .ot--option-row").forEach((el) => {
          el.style.opacity = "1";
        });
        optionTable.querySelectorAll(`:scope .data-row.data-headers>div:not(.blank)`).forEach(el => {
          el.classList.remove('active');
        })
      });
    });
  }
}
customElements.define('option-table', OptionTable);

class LocalizationForm extends HTMLElement {
  constructor() {
    super();

    this.elements = {
      input: this.querySelector('input[name="locale_code"], input[name="country_code"]'),
      button: this.querySelector('button'),
      panel: this.querySelector('ul'),
    };
    
    this.elements.button.addEventListener('click', this.openSelector.bind(this));
    this.elements.button.addEventListener('focusout', this.closeSelector.bind(this));
    this.addEventListener('keyup', this.onContainerKeyUp.bind(this));

    this.querySelectorAll('a').forEach(item => item.addEventListener('click', this.onItemClick.bind(this)));
  }

  hidePanel() {
    this.elements.button.setAttribute('aria-expanded', 'false');
    this.elements.panel.setAttribute('hidden', true);

    if (this.classList.contains('on-header')) {
      document.body.classList.remove('localization--open');
    }
  }

  onContainerKeyUp(event) {
    if (event.code.toUpperCase() !== 'ESCAPE') return;

    this.hidePanel();
    // this.elements.button.focus();
  }

  onItemClick(event) {
    event.preventDefault();
    const form = this.querySelector('form');
    this.elements.input.value = event.currentTarget.dataset.value;
    if (form) form.submit();
  }

  openSelector() {
    // this.elements.button.focus();
    this.elements.panel.toggleAttribute('hidden');
    this.elements.button.setAttribute('aria-expanded', (this.elements.button.getAttribute('aria-expanded') === 'false').toString());

    if (this.classList.contains('on-header')) {
      document.body.classList.toggle('localization--open');
    }
  }

  closeSelector(event) {
    const shouldClose = event.relatedTarget && event.relatedTarget.nodeName === 'BUTTON';
    if (event.relatedTarget === null || shouldClose) {
      this.hidePanel();
    }
  }
}
customElements.define('localization-form', LocalizationForm);
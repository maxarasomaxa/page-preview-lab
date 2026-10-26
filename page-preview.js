const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      font-family: system-ui, sans-serif;
      margin: 10px 0;
    }
    .card {
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 16px;
      background: #f9f9f9;
      max-width: 400px;
    }
    .card:hover {
      background: #f0f0f0;
    }
    a {
      text-decoration: none;
      color: #0366d6;
      display: block;
    }
    .title {
      font-weight: bold;
      font-size: 1.1em;
      display: block;
      margin-bottom: 8px;
    }
    .heading {
      color: #333;
      font-size: 0.9em;
    }
    .error {
      color: #d73a49;
    }
  </style>
  <div class="card">
    <a part="link" target="_blank">
      <span part="title" class="title"></span>
      <span part="heading" class="heading"></span>
    </a>
  </div>
`;

class PagePreview extends HTMLElement {
  #shadow;
  #link;
  #title;
  #heading;
  #abortController = null;
  #currentSrc = '';

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#shadow.appendChild(template.content.cloneNode(true));

    this.#link = this.#shadow.querySelector('a');
    this.#title = this.#shadow.querySelector('[part="title"]');
    this.#heading = this.#shadow.querySelector('[part="heading"]');
  }

  static get observedAttributes() {
    return ['src'];
  }

  connectedCallback() {
  // Всегда вызываем загрузку, метод сам обработает отсутствие src
  this.#loadData(this.getAttribute('src'));
  }

  disconnectedCallback() {
    // Отменяем запрос, если элемент удален со страницы
    if (this.#abortController) {
      this.#abortController.abort();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'src' && oldValue !== newValue && this.isConnected) {
      this.#loadData(newValue);
    }
  }

  async #loadData(src) {
    if (!src) {
      this.setAttribute('data-status', 'error');
      this.#link.href = '#';
      this.#title.textContent = 'Название отсутствует';
      this.#heading.textContent = 'Заголовок отсутствует';
      return;
    }

    // Отменяем предыдущий запрос, если он был
    if (this.#abortController) {
      this.#abortController.abort();
    }
    this.#abortController = new AbortController();
    
    // Запоминаем текущий src, чтобы избежать перезаписи старым ответом
    this.#currentSrc = src;
    this.setAttribute('data-status', 'loading');

    try {
      // Разрешаем относительный URL
      const absoluteUrl = new URL(src, document.baseURI).href;
      this.#link.href = absoluteUrl;

      const response = await fetch(absoluteUrl, { signal: this.#abortController.signal });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const htmlText = await response.text();

      // Если за время запроса src изменился - прерываем выполнение
      if (this.#currentSrc !== src) return;

      // Парсим HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // Извлекаем title и h1
      const docTitle = doc.title ? doc.title.trim() : '';
      const firstH1 = doc.querySelector('h1');
      const h1Text = firstH1 ? firstH1.textContent.trim() : '';

      // Безопасный вывод текста (защита от XSS)
      this.#title.textContent = docTitle || 'Название отсутствует';
      this.#heading.textContent = h1Text || 'Заголовок отсутствует';
      
      // Если title нет, но есть URL, можно вывести URL в ссылку
      if (!docTitle && this.#title.textContent === 'Название отсутствует') {
        this.#title.textContent = src;
      }

      this.setAttribute('data-status', 'ready');

    } catch (error) {
      if (error.name === 'AbortError') {
        // Запрос был отменен, ничего не делаем
        return;
      }
      
      if (this.#currentSrc !== src) return;

      this.setAttribute('data-status', 'error');
      this.#title.textContent = 'Ошибка загрузки';
      this.#heading.textContent = src;
      this.#link.href = '#';
    }
  }
}

// Регистрируем компонент
customElements.define('page-preview', PagePreview);
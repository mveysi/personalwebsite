(function () {
  const ENDPOINT = '/api/chat';

  const i18n = {
    en: {
      toggleTitle: 'Talk to the assistant',
      dialogLabel: 'Chat window',
      headerTitle: 'Assistant',
      closeLabel: 'Close',
      placeholder: 'Ask something...',
      sendLabel: 'Send',
      greeting: 'Hi! Feel free to ask me anything about Muhammet Veysi.',
      errorGeneric: 'An error occurred. Please try again.',
      errorConn: 'Connection error. Please try again.',
    },
    tr: {
      toggleTitle: 'Asistan ile konuş',
      dialogLabel: 'Sohbet penceresi',
      headerTitle: 'Asistan',
      closeLabel: 'Kapat',
      placeholder: 'Bir şey sorun...',
      sendLabel: 'Gönder',
      greeting: 'Merhaba! Muhammet Veysi hakkında merak ettiklerinizi sorabilirsiniz.',
      errorGeneric: 'Bir hata oluştu. Lütfen tekrar deneyin.',
      errorConn: 'Bağlantı hatası. Lütfen tekrar deneyin.',
    },
  };

  function getLang() {
    try { return localStorage.getItem('lang') === 'en' ? 'en' : 'tr'; } catch { return 'tr'; }
  }

  function t(key) { return i18n[getLang()][key]; }

  // ── Build DOM ──────────────────────────────────────────────────────────────
  const toggle = document.createElement('button');
  toggle.id = 'chatbot-toggle';
  toggle.title = t('toggleTitle');
  toggle.innerHTML = '<i class="fas fa-comment-dots"></i>';

  const win = document.createElement('div');
  win.id = 'chatbot-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', t('dialogLabel'));
  win.innerHTML = `
    <div id="chatbot-header">
      <span><i class="fas fa-robot"></i> <span id="chatbot-header-title">${t('headerTitle')}</span></span>
      <button id="chatbot-close" aria-label="${t('closeLabel')}">&times;</button>
    </div>
    <div id="chatbot-messages" aria-live="polite"></div>
    <div id="chatbot-input-area">
      <input id="chatbot-input" type="text" placeholder="${t('placeholder')}" autocomplete="off" maxlength="500" />
      <button id="chatbot-send" aria-label="${t('sendLabel')}">
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  `;

  document.body.appendChild(toggle);
  document.body.appendChild(win);

  const messages = win.querySelector('#chatbot-messages');
  const input = win.querySelector('#chatbot-input');
  const sendBtn = win.querySelector('#chatbot-send');
  const closeBtn = win.querySelector('#chatbot-close');
  const headerTitle = win.querySelector('#chatbot-header-title');

  // ── Helpers ────────────────────────────────────────────────────────────────
  function applyLang() {
    toggle.title = t('toggleTitle');
    win.setAttribute('aria-label', t('dialogLabel'));
    headerTitle.textContent = t('headerTitle');
    closeBtn.setAttribute('aria-label', t('closeLabel'));
    input.placeholder = t('placeholder');
    sendBtn.setAttribute('aria-label', t('sendLabel'));
    if (greetingEl) greetingEl.textContent = t('greeting');
  }

  function addMessage(text, role) {
    const el = document.createElement('div');
    el.className = `chat-msg ${role}`;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'chat-msg bot typing';
    el.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function setLoading(on) {
    sendBtn.disabled = on;
    input.disabled = on;
  }

  // ── Open / close ───────────────────────────────────────────────────────────
  let opened = false;
  let greetingEl = null;

  function openChat() {
    opened = true;
    applyLang();
    win.classList.add('open');
    toggle.innerHTML = '<i class="fas fa-times"></i>';
    input.focus();
    if (!messages.children.length) {
      greetingEl = addMessage(t('greeting'), 'bot');
    }
  }

  function closeChat() {
    opened = false;
    win.classList.remove('open');
    toggle.innerHTML = '<i class="fas fa-comment-dots"></i>';
  }

  toggle.addEventListener('click', () => (opened ? closeChat() : openChat()));
  closeBtn.addEventListener('click', closeChat);
  new MutationObserver(applyLang).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang'],
  });

  // ── Send ───────────────────────────────────────────────────────────────────
  async function send() {
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    addMessage(text, 'user');
    setLoading(true);

    const typing = showTyping();

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, lang: getLang() }),
      });

      const data = await res.json();
      typing.remove();

      if (!res.ok || data.error) {
        addMessage(data.error || t('errorGeneric'), 'bot');
      } else {
        addMessage(data.reply, 'bot');
      }
    } catch {
      typing.remove();
      addMessage(t('errorConn'), 'bot');
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
})();

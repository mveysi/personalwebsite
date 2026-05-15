(function () {
  const ENDPOINT = '/api/chat';

  // ── Build DOM ──────────────────────────────────────────────────────────────
  const toggle = document.createElement('button');
  toggle.id = 'chatbot-toggle';
  toggle.title = 'Asistan ile konuş';
  toggle.innerHTML = '<i class="fas fa-comment-dots"></i>';

  const win = document.createElement('div');
  win.id = 'chatbot-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', 'Sohbet penceresi');
  win.innerHTML = `
    <div id="chatbot-header">
      <span><i class="fas fa-robot"></i> Asistan</span>
      <button id="chatbot-close" aria-label="Kapat">&times;</button>
    </div>
    <div id="chatbot-messages" aria-live="polite"></div>
    <div id="chatbot-input-area">
      <input id="chatbot-input" type="text" placeholder="Bir şey sorun..." autocomplete="off" maxlength="500" />
      <button id="chatbot-send" aria-label="Gönder">
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

  // ── Helpers ────────────────────────────────────────────────────────────────
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

  function openChat() {
    opened = true;
    win.classList.add('open');
    toggle.innerHTML = '<i class="fas fa-times"></i>';
    input.focus();
    if (!messages.children.length) {
      addMessage('Merhaba! Muhammet Veysi hakkında merak ettiklerinizi sorabilirsiniz.', 'bot');
    }
  }

  function closeChat() {
    opened = false;
    win.classList.remove('open');
    toggle.innerHTML = '<i class="fas fa-comment-dots"></i>';
  }

  toggle.addEventListener('click', () => (opened ? closeChat() : openChat()));
  closeBtn.addEventListener('click', closeChat);

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
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      typing.remove();

      if (!res.ok || data.error) {
        addMessage(data.error || 'Bir hata oluştu. Lütfen tekrar deneyin.', 'bot');
      } else {
        addMessage(data.reply, 'bot');
      }
    } catch {
      typing.remove();
      addMessage('Bağlantı hatası. Lütfen tekrar deneyin.', 'bot');
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

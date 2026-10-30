/**
 * Chat panel client — TikTok Live WS (standalone window)
 */
(function () {
  const feed = document.getElementById('chatFeed');
  const statusEl = document.getElementById('chatStatus');
  const donorCountEl = document.getElementById('chatDonorCount');

  /* ---------- Tema ---------- */
  const THEMES = ['neon', 'sunset', 'ocean', 'forest', 'purple', 'cyber'];
  const themeBtns = document.querySelectorAll('#themeSwitcher .theme-btn');

  function applyTheme(theme) {
    document.body.className = document.body.className.replace(/theme-\S+/g, '') + ` theme-${theme}`;
    themeBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
    localStorage.setItem('ttl_theme', theme);
  }

  const savedTheme = localStorage.getItem('ttl_theme') || 'neon';
  if (THEMES.includes(savedTheme)) applyTheme(savedTheme);

  themeBtns.forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
  });

  let socket = null;

  function escapeHtml(text) {
    if (text == null) return '';
    const d = document.createElement('div');
    d.textContent = String(text);
    return d.innerHTML;
  }

  const MAX_CHAT = 7;

  function setEmpty() {
    if (feed.children.length === 0) {
      feed.innerHTML = '<div class="empty-feed">Belum ada chat.</div>';
    }
  }

  function addChat(chat) {
    const existing = feed.querySelector('.empty-feed');
    if (existing) existing.remove();

    const isDonor = !!chat.isDonor;
    const card = document.createElement('div');
    card.className = `chat-card ${isDonor ? 'is-donor' : ''}`;

    const avatar = chat.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(chat.uniqueId)}`;

    let badges = '';
    if (isDonor) {
      const dia = chat.donorInfo?.totalDiamonds || 0;
      badges = `
        <span class="pill donor">👑 DONATUR</span>
        ${dia > 0 ? `<span class="pill dia">💎 ${dia.toLocaleString('id-ID')}</span>` : ''}
      `;
    }

    card.innerHTML = `
      <img class="chat-avatar" src="${escapeHtml(avatar)}" alt="" onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'">
      <div class="chat-content">
        <div class="chat-header-line">
          <span class="chat-user">${escapeHtml(chat.nickname || chat.uniqueId)}</span>
          ${badges}
        </div>
        <div class="chat-text">${escapeHtml(chat.comment)}</div>
      </div>
    `;

    feed.appendChild(card);
    while (feed.children.length > MAX_CHAT) feed.removeChild(feed.firstChild);
    feed.scrollTop = feed.scrollHeight;
  }

  function updateStatus(status, username) {
    statusEl.className = `chat-status ${status.toLowerCase()}`;
    statusEl.textContent = status === 'CONNECTED' ? `Terhubung (@${username})` : 'Terputus';
  }

  function updateDonorCount(donors) {
    const n = donors ? donors.length : 0;
    donorCountEl.className = n > 0 ? 'donor-count' : 'donor-count hidden';
    donorCountEl.textContent = `${n} DONATUR`;
  }

  function connectWS() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socket.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        switch (type) {
          case 'INIT':
            updateStatus(data.status, data.username);
            if (data.recentComments?.length) {
              feed.innerHTML = '';
              data.recentComments.forEach((c) => addChat(c));
            }
            updateDonorCount(data.donors);
            break;
          case 'STATUS_CHANGE':
            updateStatus(data.status, data.username);
            break;
          case 'CHAT':
            addChat(data);
            break;
          case 'DONOR_UPDATE':
            updateDonorCount(data.donors);
            break;
          case 'RESET_CHAT':
            feed.innerHTML = '';
            setEmpty();
            updateDonorCount([]);
            break;
        }
      } catch (e) { console.error('[Chat] parse error', e); }
    };
    socket.onclose = () => {
      updateStatus('DISCONNECTED', '');
      setTimeout(connectWS, 2000);
    };
  }

  connectWS();
})();

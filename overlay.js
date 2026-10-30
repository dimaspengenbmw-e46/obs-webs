/**
 * Overlay client — TikTok Live WS (OBS / Browser Source)
 */
(function () {
  const chatBox = document.getElementById('chatBox');
  const giftAlert = document.getElementById('giftAlert');
  const giftIcon = document.getElementById('giftIcon');
  const giftSender = document.getElementById('giftSender');
  const giftCount = document.getElementById('giftCount');
  const giftTitle = document.getElementById('giftTitle');
  const giftDiamonds = document.getElementById('giftDiamonds');
  const donorSpotlight = document.getElementById('donorSpotlight');
  const topDonorName = document.getElementById('topDonorName');
  const topDonorDia = document.getElementById('topDonorDiamonds');
  const viewerBar = document.getElementById('viewerBar');
  const viewerCount = document.getElementById('viewerCount');

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

  const savedTheme = localStorage.getItem('ttl_theme') || 'cyber';
  if (THEMES.includes(savedTheme)) applyTheme(savedTheme);

  themeBtns.forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
  });

  const urlParams = new URLSearchParams(window.location.search);
  const soundEnabled = urlParams.get('sound') !== '0';
  const maxMessages = parseInt(urlParams.get('max') || '7', 10);

  let socket = null;
  let alertTimer = null;
  let audioCtx = null;

  function playSound(isDonor = false) {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = isDonor ? 'triangle' : 'sine';
      if (isDonor) {
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.1);
        osc.frequency.setValueAtTime(1174.66, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      } else {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      }
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(now); osc.stop(now + (isDonor ? 0.6 : 0.35));
    } catch (e) { console.warn('Audio error', e); }
  }

  function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function giftEmoji(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('rose') || n.includes('mawar')) return '🌹';
    if (n.includes('heart') || n.includes('hati')) return '❤️';
    if (n.includes('lion') || n.includes('singa')) return '🦁';
    if (n.includes('whale') || n.includes('paus')) return '🐳';
    if (n.includes('universe') || n.includes('galaxy')) return '🌌';
    if (n.includes('crown') || n.includes('mahkota')) return '👑';
    if (n.includes('car') || n.includes('ferrari')) return '🏎️';
    if (n.includes('diamond') || n.includes('berlian')) return '💎';
    return '🎁';
  }

  function addChat(chat, silent = false) {
    const isDonor = !!chat.isDonor;
    const card = document.createElement('div');
    card.className = `chat-card ${isDonor ? 'is-donor' : ''}`;

    const avatar = chat.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(chat.uniqueId)}`;

    let badges = '';
    if (isDonor) {
      const dia = chat.donorInfo?.totalDiamonds || 0;
      badges = `
        <span class="pill pill-donor">👑 DONATUR</span>
        ${dia > 0 ? `<span class="pill pill-diamond">💎 ${dia.toLocaleString('id-ID')}</span>` : ''}
      `;
    }

    card.innerHTML = `
      <img class="chat-avatar" src="${escapeHtml(avatar)}" alt="" onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'">
      <div class="chat-content">
        <div class="chat-header">
          <span class="chat-user">${escapeHtml(chat.nickname || chat.uniqueId)}</span>
          ${badges}
        </div>
        <div class="chat-text">${escapeHtml(chat.comment)}</div>
      </div>
    `;

    chatBox.appendChild(card);
    while (chatBox.children.length > maxMessages) chatBox.removeChild(chatBox.firstChild);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (isDonor && !silent) playSound(true);
  }

  function showGift(gift) {
    giftIcon.textContent = giftEmoji(gift.giftName);
    giftSender.textContent = escapeHtml(gift.nickname || gift.uniqueId);
    giftCount.textContent = `x${gift.repeatCount || 1}`;
    giftTitle.textContent = `${escapeHtml(gift.giftName)}`;
    giftDiamonds.textContent = `${((gift.diamondCount || 0) * (gift.repeatCount || 1)).toLocaleString('id-ID')} 💎`;

    giftAlert.classList.add('show');
    playSound(true);

    if (alertTimer) clearTimeout(alertTimer);
    alertTimer = setTimeout(() => giftAlert.classList.remove('show'), 4500);
  }

  function updateSpotlight(donors) {
    if (!donors || donors.length === 0) {
      donorSpotlight.classList.add('hidden');
      return;
    }
    const sorted = [...donors].sort((a, b) => (b.totalDiamonds || 0) - (a.totalDiamonds || 0));
    const top = sorted[0];
    if (!top || (top.totalDiamonds || 0) <= 0) {
      donorSpotlight.classList.add('hidden');
      return;
    }
    topDonorName.textContent = escapeHtml(top.nickname || top.uniqueId);
    topDonorDia.textContent = `${(top.totalDiamonds || 0).toLocaleString('id-ID')} 💎`;
    donorSpotlight.classList.remove('hidden');
  }

  function connectWS() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socket.onopen = () => console.log('[Overlay] WS connected');
    socket.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        switch (type) {
          case 'INIT':
            if (data.stats?.viewerCount !== undefined) {
              viewerBar.classList.remove('hidden');
              viewerCount.textContent = data.stats.viewerCount;
            }
            if (data.recentComments?.length) {
              chatBox.innerHTML = '';
              data.recentComments.forEach((c) => addChat(c, true));
            }
            if (data.donors) updateSpotlight(data.donors);
            break;
          case 'CHAT': addChat(data); break;
          case 'GIFT': showGift(data); break;
          case 'DONOR_UPDATE': updateSpotlight(data.donors); break;
          case 'ROOM_USER':
            if (data.viewerCount !== undefined) {
              viewerBar.classList.remove('hidden');
              viewerCount.textContent = data.viewerCount;
            }
            break;
          case 'RESET_CHAT':
            chatBox.innerHTML = '';
            donorSpotlight.classList.add('hidden');
            viewerCount.textContent = '0';
            break;
        }
      } catch (e) { console.error('[Overlay] parse error', e); }
    };
    socket.onclose = () => {
      console.warn('[Overlay] WS closed, reconnecting...');
      setTimeout(connectWS, 2000);
    };
  }

  window.addEventListener('click', () => {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
  }, { once: true });

  connectWS();
})();

/**
 * Dashboard client — TikTok Live WS
 */
(function () {
  const $ = (id) => document.getElementById(id);

  const tiktokUsername = $('tiktokUsername');
  const btnConnect = $('btnConnect');
  const btnDisconnect = $('btnDisconnect');
  const connMessage = $('connMessage');
  const statusBadge = $('statusBadge');
  const statusText = $('statusText');

  const statViewers = $('statViewers');
  const statLikes = $('statLikes');
  const statComments = $('statComments');
  const statDonors = $('statDonors');

  const overlayUrl = $('overlayUrl');
  const btnCopyOverlay = $('btnCopyOverlay');
  const chatOverlayUrl = $('chatOverlayUrl');
  const btnCopyChat = $('btnCopyChat');

  const simCommentText = $('simCommentText');
  const btnSimChat = $('btnSimChat');
  const simDonorText = $('simDonorCommentText');
  const btnSimDonor = $('btnSimDonorChat');
  const btnQuickGifts = document.querySelectorAll('.btn-quick-gift');
  const btnResetData = $('btnResetData');

  const donorsTableBody = $('donorsTableBody');
  const donorCountBadge = $('donorCountBadge');

  let socket = null;

  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  const fullOverlayUrl = `${baseUrl}/overlay`;
  const fullChatUrl = `${baseUrl}/chat`;

  if (overlayUrl) overlayUrl.textContent = fullOverlayUrl;
  if (chatOverlayUrl) chatOverlayUrl.textContent = fullChatUrl;

  function copy(el, text) {
    navigator.clipboard.writeText(text).then(() => {
      const orig = el.textContent;
      el.textContent = 'Tersalin! ✅';
      setTimeout(() => { el.textContent = orig; }, 2000);
    }).catch(() => alert(text));
  }
  if (btnCopyOverlay) btnCopyOverlay.addEventListener('click', () => copy(btnCopyOverlay, fullOverlayUrl));
  if (btnCopyChat) btnCopyChat.addEventListener('click', () => copy(btnCopyChat, fullChatUrl));

  function show(msg, type = 'info') {
    connMessage.textContent = msg;
    connMessage.className = 'msg show ' + type;
  }

  function updateStatus(status, username, error) {
    statusBadge.className = `status ${status.toLowerCase()}`;
    if (status === 'CONNECTED') {
      statusText.textContent = `Terhubung (@${username})`;
      btnConnect.classList.add('hidden');
      btnDisconnect.classList.remove('hidden');
      show(`Terhubung ke @${username}`, 'success');
    } else if (status === 'CONNECTING') {
      statusText.textContent = `Menghubungkan (@${username})...`;
      btnConnect.disabled = true;
      btnConnect.textContent = 'Menghubungkan...';
      btnDisconnect.classList.add('hidden');
      show(`Menghubungkan ke @${username}...`, 'info');
    } else if (status === 'ERROR') {
      statusText.textContent = 'Gagal Terhubung';
      btnConnect.disabled = false;
      btnConnect.classList.remove('hidden');
      btnConnect.textContent = 'Hubungkan';
      btnDisconnect.classList.add('hidden');
      show(`Error: ${error || 'Tidak dapat terhubung'}`, 'error');
    } else {
      statusText.textContent = 'Terputus';
      btnConnect.disabled = false;
      btnConnect.classList.remove('hidden');
      btnConnect.textContent = 'Hubungkan';
      btnDisconnect.classList.add('hidden');
      show('Tidak terhubung ke live TikTok.', 'info');
    }
  }

  function escapeHtml(text) {
    if (text == null) return '';
    const d = document.createElement('div');
    d.textContent = String(text);
    return d.innerHTML;
  }

  function fmt(n) { return (n || 0).toLocaleString('id-ID'); }

  function renderDonors(donors) {
    if (!donors || donors.length === 0) {
      donorsTableBody.innerHTML = '<tr><td colspan="4" class="empty">Belum ada donasi.</td></tr>';
      donorCountBadge.textContent = '0 DONATUR';
      statDonors.textContent = '0';
      return;
    }
    statDonors.textContent = donors.length;
    donorCountBadge.textContent = `${donors.length} DONATUR`;

    const sorted = [...donors].sort((a, b) => (b.totalDiamonds || 0) - (a.totalDiamonds || 0));
    donorsTableBody.innerHTML = sorted.map((d, i) => {
      const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      const avatar = d.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${d.uniqueId}`;
      return `
        <tr>
          <td class="rank">${rank}</td>
          <td class="name-cell">
            <div class="donor-row">
              <img class="donor-avatar" src="${escapeHtml(avatar)}" alt="" onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'">
              <span class="donor-name">${escapeHtml(d.nickname || d.uniqueId)}</span>
            </div>
          </td>
          <td class="gift-cell">${escapeHtml(d.lastGiftName || '-')}</td>
          <td class="dia-cell text-right">💎 ${fmt(d.totalDiamonds)}</td>
        </tr>
      `;
    }).join('');
  }

  function connectWS() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socket.onopen = () => console.log('[Dashboard] WS connected');
    socket.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        switch (type) {
          case 'INIT':
            updateStatus(data.status, data.username, data.lastError);
            if (data.username) tiktokUsername.value = data.username;
            if (data.stats) {
              statViewers.textContent = fmt(data.stats.viewerCount);
              statLikes.textContent = fmt(data.stats.likeCount);
              statComments.textContent = fmt(data.stats.totalComments);
            }
            if (data.donors) renderDonors(data.donors);
            break;
          case 'STATUS_CHANGE':
            updateStatus(data.status, data.username, data.error);
            break;
          case 'CHAT':
            statComments.textContent = fmt(parseInt(statComments.textContent.replace(/\D/g, '') || '0', 10) + 1);
            break;
          case 'GIFT':
          case 'DONOR_UPDATE':
            if (data.donors) renderDonors(data.donors);
            break;
          case 'ROOM_USER':
            statViewers.textContent = fmt(data.viewerCount || 0);
            break;
          case 'LIKE':
            statLikes.textContent = fmt(data.totalLikeCount || 0);
            break;
        }
      } catch (e) { console.error('[Dashboard] parse error', e); }
    };
    socket.onclose = () => {
      setTimeout(connectWS, 2000);
      updateStatus('DISCONNECTED', '');
    };
  }

  btnConnect.addEventListener('click', async () => {
    const username = tiktokUsername.value.trim();
    if (!username) { alert('Masukkan username TikTok.'); return; }
    updateStatus('CONNECTING', username);
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!data.success) updateStatus('ERROR', username, data.error);
    } catch (err) {
      updateStatus('ERROR', username, err.message);
    }
  });

  btnDisconnect.addEventListener('click', async () => {
    try {
      await fetch('/api/disconnect', { method: 'POST' });
      updateStatus('DISCONNECTED', '');
    } catch (err) {
      alert('Gagal memutuskan: ' + err.message);
    }
  });

  btnSimChat.addEventListener('click', async () => {
    const comment = simCommentText.value.trim();
    if (!comment) { show('Masukkan pesan chat terlebih dahulu.', 'error'); return; }
    const names = ['Rizky', 'Siti', 'Budi', 'Dina', 'Gamer'];
    const nick = names[Math.floor(Math.random() * names.length)];
    try {
      await fetch('/api/simulate/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uniqueId: 'v_' + Math.floor(Math.random() * 9999), nickname: nick, comment, isDonor: false }),
      });
      show(`Simulasi chat terkirim: "${comment}"`, 'success');
    } catch (err) {
      show('Gagal mengirim simulasi chat: ' + err.message, 'error');
    }
  });

  btnSimDonor.addEventListener('click', async () => {
    const comment = simDonorText.value.trim();
    if (!comment) { show('Masukkan pesan donatur terlebih dahulu.', 'error'); return; }
    try {
      await fetch('/api/simulate/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uniqueId: 'vip_master', nickname: 'Sultan Dermawan 👑', comment, isDonor: true, diamonds: 5000 }),
      });
      show(`Simulasi chat donatur terkirim: "${comment}"`, 'success');
    } catch (err) {
      show('Gagal mengirim simulasi donatur: ' + err.message, 'error');
    }
  });

  btnQuickGifts.forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await fetch('/api/simulate/gift', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uniqueId: 'vip_master',
            nickname: 'Sultan Dermawan 👑',
            giftName: btn.dataset.gift,
            diamonds: btn.dataset.diamonds,
            repeatCount: 1,
          }),
        });
        show(`Gift ${btn.dataset.gift} terkirim!`, 'success');
      } catch (err) {
        show('Gagal mengirim gift: ' + err.message, 'error');
      }
    });
  });

  btnResetData.addEventListener('click', async () => {
    if (!confirm('Reset semua donatur dan riwayat chat?')) return;
    try {
      await fetch('/api/reset-donors', { method: 'POST' });
      renderDonors([]);
      statComments.textContent = '0';
      show('Data berhasil di-reset.', 'success');
    } catch (err) {
      show('Gagal reset data: ' + err.message, 'error');
    }
  });

  fetch('/api/status')
    .then((r) => r.json())
    .then((data) => {
      updateStatus(data.status, data.username, data.lastError);
      if (data.username) tiktokUsername.value = data.username;
      if (data.stats) {
        statViewers.textContent = fmt(data.stats.viewerCount);
        statLikes.textContent = fmt(data.stats.likeCount);
        statComments.textContent = fmt(data.stats.totalComments);
      }
      if (data.donors) renderDonors(data.donors);
    })
    .catch(console.error);

  connectWS();
})();

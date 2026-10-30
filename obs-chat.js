/**
 * ============================================================================
 * OBS CHAT JAVASCRIPT CONTROLLER
 * ============================================================================
 * File ini menangani logika chat OBS secara terpisah.
 * Anda dapat bebas menyesuaikan konfigurasi, filter pesan, efek suara,
 * dan template HTML chat di bawah ini!
 * ============================================================================
 */

(function () {
    // ========================================================================
    // ⚙️ PENGATURAN KUSTOM CHAT OBS (SILAKAN UBAH DI SINI)
    // ========================================================================
    const CHAT_CONFIG = {
        // Jumlah maksimal pesan chat yang muncul di layar OBS
        maxMessages: 25,

        // Waktu hilang otomatis untuk setiap chat (dalam detik)
        // Set ke 0 jika ingin chat TETAP ADA dan tidak pernah hilang otomatis
        fadeTimeoutSeconds: 0,

        // Putar suara notifikasi saat ada chat baru? (true / false)
        soundEnabled: true,

        // Hanya putar suara jika pengirimnya adalah Donatur? (true / false)
        soundOnlyForDonors: false,

        // Apakah hanya ingin menampilkan chat dari Donatur saja di OBS? (true / false)
        onlyDonors: false,

        // Pilihan gaya animasi masuk: 'anim-slide-left', 'anim-pop', 'anim-fade-in'
        animationClass: 'anim-slide-left',

        // Tampilkan avatar profil pengirim? (true / false)
        showAvatar: true,

        // Tampilkan jam/menit pesan dikirim? (true / false)
        showTimestamp: false
    };

    // ========================================================================
    // 🔍 DUKUNGAN QUERY PARAMETER (Bisa disetel langsung dari URL Browser Source di OBS)
    // Contoh URL OBS: http://localhost:3000/chat?timeout=15&onlyDonors=1&sound=0
    // ========================================================================
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('max')) CHAT_CONFIG.maxMessages = parseInt(urlParams.get('max'), 10) || CHAT_CONFIG.maxMessages;
    if (urlParams.has('timeout')) CHAT_CONFIG.fadeTimeoutSeconds = parseInt(urlParams.get('timeout'), 10) || 0;
    if (urlParams.has('sound')) CHAT_CONFIG.soundEnabled = urlParams.get('sound') !== '0';
    if (urlParams.has('onlyDonors')) CHAT_CONFIG.onlyDonors = urlParams.get('onlyDonors') === '1';
    if (urlParams.has('anim')) CHAT_CONFIG.animationClass = `anim-${urlParams.get('anim')}`;

    // Elemen DOM
    const chatContainer = document.getElementById('chatContainer');
    let audioCtx = null;

    /**
     * ========================================================================
     * 🔊 SISTEM AUDIO NOTIFIKASI
     * ========================================================================
     */
    function playChatSound(isDonor = false) {
        if (!CHAT_CONFIG.soundEnabled) return;
        if (CHAT_CONFIG.soundOnlyForDonors && !isDonor) return;

        try {
            if (!audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                audioCtx = new AudioContext();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            if (isDonor) {
                // Notifikasi merdu dua nada untuk donatur
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(659.25, now); // E5
                osc.frequency.setValueAtTime(987.77, now + 0.12); // B5
                gain.gain.setValueAtTime(0.28, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.6);
            } else {
                // Notifikasi lembut untuk chat biasa
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, now); // C5
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.25);
            }
        } catch (err) {
            console.warn('[OBS Chat] Audio error:', err);
        }
    }

    /**
     * Helper untuk mencegah XSS injection
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * ========================================================================
     * 🎨 TEMPLATE KARTU CHAT (CUSTOM TAMPILAN SESUKA ANDA DI SINI)
     * ========================================================================
     * @param {Object} chat
     * @param {string} chat.nickname - Nama pengirim
     * @param {string} chat.uniqueId - Username unik
     * @param {string} chat.comment - Isi chat
     * @param {boolean} chat.isDonor - True jika sudah pernah memberi gift
     * @param {Object} [chat.donorInfo] - Info total diamonds, gift count
     * @param {string} [chat.profilePictureUrl] - URL avatar pengirim
     */
    function renderChatCard(chat) {
        const isDonor = !!chat.isDonor;
        const diamonds = chat.donorInfo?.totalDiamonds || 0;
        const avatarUrl = chat.profilePictureUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(chat.uniqueId)}`;

        const card = document.createElement('div');
        card.className = `obs-chat-card ${isDonor ? 'is-donor' : ''} ${CHAT_CONFIG.animationClass}`;
        card.dataset.id = chat.id || `chat-${Date.now()}`;

        // Format waktu jika diaktifkan
        let timeHtml = '';
        if (CHAT_CONFIG.showTimestamp) {
            const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            timeHtml = `<span class="obs-time">${timeStr}</span>`;
        }

        // Badge khusus donatur
        let donorBadges = '';
        if (isDonor) {
            donorBadges = `
                <span class="obs-vip-badge">👑 DONATUR</span>
                ${diamonds > 0 ? `<span class="obs-diamond-pill">💎 ${diamonds.toLocaleString('id-ID')}</span>` : ''}
            `;
        }

        // Avatar
        const avatarHtml = CHAT_CONFIG.showAvatar
            ? `<img class="obs-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(chat.nickname)}" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=fallback'">`
            : '';

        // Gabungkan seluruh struktur kartu
        card.innerHTML = `
            ${avatarHtml}
            <div class="obs-content">
                <div class="obs-header">
                    <span class="obs-username">${escapeHtml(chat.nickname)}</span>
                    ${donorBadges}
                    ${timeHtml}
                </div>
                <div class="obs-text">${escapeHtml(chat.comment)}</div>
            </div>
        `;

        return card;
    }

    /**
     * Tambahkan chat baru ke container OBS
     * @param {Object} chat - Data chat dari server
     * @param {Object} [options] - Opsi tambahan
     * @param {boolean} [options.silent] - Jika true, tidak memutar suara notifikasi
     *                                     (dipakai saat memuat riwayat chat awal)
     */
    function addChat(chat, options = {}) {
        // Filter jika hanya ingin chat dari donatur
        if (CHAT_CONFIG.onlyDonors && !chat.isDonor) {
            return;
        }

        const card = renderChatCard(chat);
        chatContainer.appendChild(card);

        // Batasi jumlah chat maksimal di layar
        while (chatContainer.children.length > CHAT_CONFIG.maxMessages) {
            chatContainer.removeChild(chatContainer.firstChild);
        }

        // Auto scroll ke bawah
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Bunyikan notifikasi audio (dilewati saat memuat riwayat chat)
        if (!options.silent) {
            playChatSound(chat.isDonor);
        }

        // Jika fadeTimeoutSeconds disetel (> 0), jadwalkan kartu menghilang
        if (CHAT_CONFIG.fadeTimeoutSeconds > 0) {
            setTimeout(() => {
                card.classList.add('fade-out');
                setTimeout(() => {
                    if (card.parentNode) {
                        card.parentNode.removeChild(card);
                    }
                }, 500);
            }, CHAT_CONFIG.fadeTimeoutSeconds * 1000);
        }
    }

    /**
     * ========================================================================
     * 🌐 INISIALISASI WEBSOCKET CLIENT MANDIRI
     * ========================================================================
     */
    const socket = new TikTokLiveSocket({
        debug: true,
        reconnectInterval: 2000
    });

    // Menerima riwayat awal chat saat connect
    socket.on('init', (data) => {
        if (data.recentComments && data.recentComments.length > 0) {
            chatContainer.innerHTML = '';
            // Muat riwayat chat tanpa memutar suara notifikasi berulang kali
            data.recentComments.forEach(chat => addChat(chat, { silent: true }));
        }
    });

    // Menerima chat live baru
    socket.on('chat', (chat) => {
        addChat(chat);
    });

    // Menerima reset chat dari dashboard
    socket.on('reset_chat', () => {
        chatContainer.innerHTML = '';
    });

    // Unlock audio saat pertama kali berinteraksi (jika dibuka di browser biasa)
    window.addEventListener('click', () => {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
    }, { once: true });

    // Expose fungsi ke window agar bisa diuji atau di-custom via console
    window.obsChat = {
        config: CHAT_CONFIG,
        addChat: addChat,
        clearChat: () => { chatContainer.innerHTML = ''; },
        socket: socket
    };

    console.log('✅ OBS Chat Client siap & terhubung!');
})();


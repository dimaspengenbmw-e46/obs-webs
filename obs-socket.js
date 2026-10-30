/**
 * ============================================================================
 * TikTokLiveSocket - Client WebSocket Mandiri untuk OBS & Custom Overlay
 * ============================================================================
 * File ini menyediakan koneksi WebSocket yang ringan, stabil, dan otomatis reconnect.
 * Anda dapat menggunakannya di file HTML kustom apa pun atau langsung di Browser Source OBS.
 *
 * CARA PAKAI CEPAT:
 * ----------------------------------------------------------------------------
 * const live = new TikTokLiveSocket();
 *
 * // Mendengarkan event chat baru
 * live.on('chat', (data) => {
 *     console.log('Pesan dari:', data.nickname, 'Teks:', data.comment);
 *     if (data.isDonor) {
 *         console.log('DONATUR!', data.donorInfo.totalDiamonds, 'Diamonds');
 *     }
 * });
 *
 * // Mendengarkan event gift masuk
 * live.on('gift', (gift) => {
 *     console.log('Gift:', gift.giftName, 'x' + gift.repeatCount, 'dari', gift.nickname);
 * });
 *
 * // Event lainnya: 'open', 'close', 'init', 'status', 'donors', 'stats'
 * ============================================================================
 */

class TikTokLiveSocket {
    /**
     * @param {Object} options
     * @param {string} [options.url] - URL WebSocket (default: auto detect ws:// atau wss://)
     * @param {number} [options.reconnectInterval=2000] - Jeda waktu reconnect dalam ms
     * @param {boolean} [options.autoConnect=true] - Otomatis terhubung saat diinisialisasi
     * @param {boolean} [options.debug=false] - Aktifkan log console debug
     */
    constructor(options = {}) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host || 'localhost:3000';
        
        this.url = options.url || `${protocol}//${host}`;
        this.reconnectInterval = options.reconnectInterval || 2000;
        this.debug = options.debug || false;
        
        this.socket = null;
        this.isConnected = false;
        this.listeners = {};
        this._reconnectTimer = null;

        if (options.autoConnect !== false) {
            this.connect();
        }
    }

    /**
     * Membuka koneksi WebSocket ke server
     */
    connect() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }

        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this._log(`Menghubungkan ke ${this.url}...`);

        try {
            this.socket = new WebSocket(this.url);

            this.socket.onopen = () => {
                this.isConnected = true;
                this._log('Terhubung!');
                this._emit('open', { url: this.url, timestamp: Date.now() });
            };

            this.socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    const { type, data } = message;

                    // Emit event umum
                    this._emit('message', message);

                    if (!type) return;

                    // Emit berdasarkan tipe (case insensitive)
                    const lowerType = type.toLowerCase();
                    this._emit(lowerType, data);
                    if (type !== lowerType) {
                        this._emit(type, data);
                    }

                    // Alias helper khusus
                    if (type === 'INIT') {
                        if (data.status) this._emit('status', data.status);
                        if (data.donors) this._emit('donors', data.donors);
                        if (data.stats) this._emit('stats', data.stats);
                    } else if (type === 'STATUS_CHANGE') {
                        this._emit('status', data.status, data);
                    } else if (type === 'DONOR_UPDATE') {
                        this._emit('donors', data.donors);
                    } else if (type === 'ROOM_USER') {
                        this._emit('viewers', data.viewerCount);
                    } else if (type === 'LIKE') {
                        this._emit('likes', data.totalLikeCount);
                    }
                } catch (err) {
                    this._error('Gagal parse pesan WebSocket:', err);
                }
            };

            this.socket.onclose = (event) => {
                this.isConnected = false;
                this._log(`Koneksi terputus (code: ${event.code}). Menghubungkan ulang dalam ${this.reconnectInterval}ms...`);
                this._emit('close', event);
                this._scheduleReconnect();
            };

            this.socket.onerror = (err) => {
                this._error('WebSocket error:', err);
                this._emit('error', err);
            };

        } catch (err) {
            this._error('Gagal inisialisasi WebSocket:', err);
            this._scheduleReconnect();
        }
    }

    /**
     * Putus koneksi WebSocket secara manual
     */
    disconnect() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isConnected = false;
    }

    /**
     * Mendaftarkan event listener
     * @param {string} event - Nama event ('chat', 'gift', 'open', 'close', 'status', dll)
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (typeof callback !== 'function') return this;
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return this;
    }

    /**
     * Menghapus event listener
     */
    off(event, callback) {
        if (!this.listeners[event]) return this;
        if (!callback) {
            delete this.listeners[event];
        } else {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
        return this;
    }

    /**
     * Kirim data ke WebSocket server
     */
    send(action, payload = {}) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ action, ...payload }));
        } else {
            this._error('Gagal mengirim data: WebSocket belum terbuka.');
        }
    }

    _scheduleReconnect() {
        if (this._reconnectTimer) return;
        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            this.connect();
        }, this.reconnectInterval);
    }

    _emit(event, ...args) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => {
                try {
                    cb(...args);
                } catch (err) {
                    this._error(`Error pada handler event '${event}':`, err);
                }
            });
        }
    }

    _log(...args) {
        if (this.debug) {
            console.log('[TikTokLiveSocket]', ...args);
        }
    }

    _error(...args) {
        console.error('[TikTokLiveSocket]', ...args);
    }
}

// Export global untuk penggunaan langsung di browser atau OBS Browser Source
if (typeof window !== 'undefined') {
    window.TikTokLiveSocket = TikTokLiveSocket;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TikTokLiveSocket;
}


const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- Routes ---------- */
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/overlay', (req, res) => res.sendFile(path.join(__dirname, 'public', 'overlay.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));

/* ---------- State ---------- */
let tiktokLiveConnection = null;
let currentUsername = process.env.TIKTOK_USERNAME || 'the_dimsuk';
let connectionStatus = 'DISCONNECTED';
let lastError = null;

const liveStats = { viewerCount: 0, likeCount: 0, totalComments: 0, totalGifts: 0 };
const donorMap = new Map();
const recentComments = [];
const MAX_RECENT = 50;

/* ---------- Helpers ---------- */
function broadcast(type, payload) {
    const message = JSON.stringify({ type, data: payload, timestamp: Date.now() });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(message);
    });
}

function recordDonation(uniqueId, nickname, profilePictureUrl, giftName, diamonds, repeatCount = 1) {
    const totalAdded = (diamonds || 1) * (repeatCount || 1);
    const existing = donorMap.get(uniqueId) || {
        uniqueId, nickname, profilePictureUrl, totalDiamonds: 0, giftCount: 0,
        lastGiftName: giftName, createdAt: Date.now(),
    };
    existing.nickname = nickname || existing.nickname;
    if (profilePictureUrl) existing.profilePictureUrl = profilePictureUrl;
    existing.totalDiamonds += totalAdded;
    existing.giftCount += repeatCount || 1;
    existing.lastGiftName = giftName;
    existing.updatedAt = Date.now();
    donorMap.set(uniqueId, existing);
    return existing;
}

function pushComment(chat) {
    recentComments.push(chat);
    if (recentComments.length > MAX_RECENT) recentComments.shift();
}

function sendInit(ws) {
    ws.send(JSON.stringify({
        type: 'INIT',
        data: {
            status: connectionStatus,
            username: currentUsername,
            stats: liveStats,
            donors: Array.from(donorMap.values()),
            recentComments: recentComments.slice(-20),
            lastError,
        },
        timestamp: Date.now(),
    }));
}

/* ---------- TikTok Live ---------- */
async function connectToTikTok(username) {
    if (!username) throw new Error('Username TikTok tidak boleh kosong');
    const clean = username.replace(/^@/, '').trim();

    if (tiktokLiveConnection) {
        try { tiktokLiveConnection.disconnect(); } catch (e) {}
    }

    currentUsername = clean;
    connectionStatus = 'CONNECTING';
    lastError = null;
    broadcast('STATUS_CHANGE', { status: connectionStatus, username: currentUsername });

    tiktokLiveConnection = new WebcastPushConnection(clean, {
        processInitialData: true,
        enableExtendedGiftInfo: true,
        enableWebsocketUpgrade: true,
        requestPollingIntervalMs: 2000,
        clientParams: { app_language: 'id-ID', device_platform: 'web' },
    });

    tiktokLiveConnection.on('connected', (state) => {
        connectionStatus = 'CONNECTED';
        liveStats.viewerCount = state.roomInfo?.user_count || 0;
        broadcast('STATUS_CHANGE', {
            status: connectionStatus, username: currentUsername,
            roomId: state.roomId, roomInfo: state.roomInfo,
        });
    });

    tiktokLiveConnection.on('disconnected', () => {
        connectionStatus = 'DISCONNECTED';
        broadcast('STATUS_CHANGE', { status: connectionStatus, username: currentUsername });
    });

    tiktokLiveConnection.on('streamEnd', () => {
        connectionStatus = 'DISCONNECTED';
        broadcast('STREAM_END', { username: clean });
        broadcast('STATUS_CHANGE', { status: connectionStatus, username: currentUsername });
    });

    tiktokLiveConnection.on('error', (err) => {
        const info = err && err.info ? err.info : '';
        const exception = err && err.exception !== undefined ? err.exception : err;
        let detail = String(exception);
        if (exception && exception.message) detail = exception.message;
        lastError = info ? `${info}: ${detail}` : detail;
        console.error('[TikTok Error]', lastError);
        broadcast('STATUS_CHANGE', { status: connectionStatus, username: currentUsername, error: lastError });
    });

    tiktokLiveConnection.on('chat', (data) => {
        liveStats.totalComments++;
        const isDonor = donorMap.has(data.uniqueId);
        const donorInfo = isDonor ? donorMap.get(data.uniqueId) : null;
        const chat = {
            id: data.msgId || `chat-${Date.now()}`,
            uniqueId: data.uniqueId,
            nickname: data.nickname || data.uniqueId,
            profilePictureUrl: data.profilePictureUrl || '',
            comment: data.comment,
            isDonor: !!isDonor,
            donorInfo,
            timestamp: Date.now(),
        };
        pushComment(chat);
        broadcast('CHAT', chat);
    });

    tiktokLiveConnection.on('gift', (data) => {
        const isStreak = data.giftType === 1 && !data.repeatEnd;
        if (isStreak) return;

        const donorInfo = recordDonation(
            data.uniqueId, data.nickname, data.profilePictureUrl,
            data.giftName, data.diamondCount || 0, data.repeatCount || 1
        );
        liveStats.totalGifts += data.repeatCount || 1;

        const gift = {
            id: data.msgId || `gift-${Date.now()}`,
            uniqueId: data.uniqueId,
            nickname: data.nickname || data.uniqueId,
            profilePictureUrl: data.profilePictureUrl || '',
            giftName: data.giftName,
            giftPictureUrl: data.giftPictureUrl || '',
            diamondCount: data.diamondCount || 0,
            repeatCount: data.repeatCount || 1,
            totalDiamonds: donorInfo.totalDiamonds,
            timestamp: Date.now(),
        };
        broadcast('GIFT', gift);
        broadcast('DONOR_UPDATE', { donors: Array.from(donorMap.values()) });
    });

    tiktokLiveConnection.on('roomUser', (data) => {
        if (data.viewerCount !== undefined) {
            liveStats.viewerCount = data.viewerCount;
            broadcast('ROOM_USER', { viewerCount: data.viewerCount });
        }
    });

    tiktokLiveConnection.on('like', (data) => {
        if (data.totalLikeCount !== undefined) liveStats.likeCount = data.totalLikeCount;
        else if (data.likeCount) liveStats.likeCount += data.likeCount;
        broadcast('LIKE', { uniqueId: data.uniqueId, nickname: data.nickname, likeCount: data.likeCount, totalLikeCount: liveStats.likeCount });
    });

    const state = await tiktokLiveConnection.connect();
    return state;
}

function disconnectTikTok() {
    if (tiktokLiveConnection) {
        try { tiktokLiveConnection.disconnect(); } catch (e) {}
        tiktokLiveConnection = null;
    }
    connectionStatus = 'DISCONNECTED';
    broadcast('STATUS_CHANGE', { status: connectionStatus, username: currentUsername });
}

/* ---------- WebSocket ---------- */
wss.on('connection', (ws) => {
    sendInit(ws);
    ws.on('message', () => {});
    ws.on('close', () => {});
});

/* ---------- REST API ---------- */
app.get('/api/status', (req, res) => res.json({
    status: connectionStatus, username: currentUsername, stats: liveStats,
    donors: Array.from(donorMap.values()), clientCount: wss.clients.size, lastError,
}));

app.post('/api/connect', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, error: 'Username wajib diisi.' });
    try {
        await connectToTikTok(username);
        res.json({ success: true, message: `Menghubungkan ke @${username}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/disconnect', (req, res) => {
    disconnectTikTok();
    res.json({ success: true, message: 'Terputus.' });
});

app.post('/api/reset-donors', (req, res) => {
    donorMap.clear();
    recentComments.length = 0;
    broadcast('DONOR_UPDATE', { donors: [] });
    broadcast('RESET_CHAT', {});
    res.json({ success: true, message: 'Reset selesai.' });
});

app.post('/api/simulate/chat', (req, res) => {
    const { nickname, uniqueId, comment, isDonor, diamonds } = req.body;
    const uid = uniqueId || `sim_${Math.floor(Math.random() * 9999)}`;
    const nick = nickname || 'Penonton';
    const text = comment || 'Halo streamer!';
    if (isDonor && !donorMap.has(uid)) recordDonation(uid, nick, '', 'Mawar', diamonds || 10, 1);
    const exists = donorMap.has(uid);
    const donorInfo = exists ? donorMap.get(uid) : null;
    const chat = {
        id: `sim-${Date.now()}`, uniqueId: uid, nickname: nick,
        profilePictureUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
        comment: text, isDonor: exists, donorInfo, timestamp: Date.now(),
    };
    liveStats.totalComments++;
    pushComment(chat);
    broadcast('CHAT', chat);
    res.json({ success: true, chat });
});

app.post('/api/simulate/gift', (req, res) => {
    const { nickname, uniqueId, giftName, diamonds, repeatCount } = req.body;
    const uid = uniqueId || `sultan_${Math.floor(Math.random() * 999)}`;
    const nick = nickname || 'Sultan Dermawan';
    const gName = giftName || 'TikTok Universe';
    const dia = Number(diamonds) || 34999;
    const reps = Number(repeatCount) || 1;
    const donorInfo = recordDonation(uid, nick, `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`, gName, dia, reps);
    liveStats.totalGifts += reps;
    const gift = {
        id: `simgift-${Date.now()}`, uniqueId: uid, nickname: nick,
        profilePictureUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
        giftName: gName, diamondCount: dia, repeatCount: reps,
        totalDiamonds: donorInfo.totalDiamonds, timestamp: Date.now(),
    };
    broadcast('GIFT', gift);
    broadcast('DONOR_UPDATE', { donors: Array.from(donorMap.values()) });
    res.json({ success: true, gift, donor: donorInfo });
});

server.listen(PORT, () => {
    console.log(`\n🚀 TikTok Live WS running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard   : http://localhost:${PORT}`);
    console.log(`🎥 Overlay     : http://localhost:${PORT}/overlay`);
    console.log(`💬 Chat Panel  : http://localhost:${PORT}/chat\n`);
});

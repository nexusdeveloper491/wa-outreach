const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const xlsx = require('xlsx');
const qrcode = require('qrcode');
const pino = require('pino');
require('dotenv').config();

const {
  default: makeWASocket,
  Browsers,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay
} = require('@whiskeysockets/baileys');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'wa_outreach_secret_key_2026';
const AUTH_FOLDER = path.join(__dirname, 'auth_info_baileys');

// Session setup
const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
});

app.use(sessionMiddleware);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io session sharing
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
}

// Global WhatsApp Client State (Baileys Legacy)
let waSock = null;
let qrCodeDataUrl = null;
let pairingCode = null;
let waConnectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'pairing_ready' | 'connected'
let waUserInfo = null;
let isExplicitLogout = false;
let isInitializing = false;
let isQueueLoopRunning = false; // Concurrency Guard

// In-Memory Chat Store & Messages Cache
const chatsStore = new Map(); // jid -> { jid, name, phone, unreadCount, lastMessage, timestamp }
const messagesStore = new Map(); // jid -> array of message objects

// Helper: Safely purge session folder
function clearSessionFolder() {
  try {
    if (fs.existsSync(AUTH_FOLDER)) {
      fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      console.log('🧹 Purged session directory auth_info_baileys.');
    }
  } catch (err) {
    console.error('Error clearing session folder:', err.message);
  }
}

// Global Background Campaign State
let campaignState = {
  status: 'idle', // 'idle' | 'running' | 'paused' | 'stopped' | 'completed'
  engineMode: 'meta_cloud', // 'meta_cloud' | 'baileys'
  leads: [],
  currentIndex: 0,
  config: {
    engineMode: 'meta_cloud',
    metaPhoneNumberId: '',
    metaAccessToken: '',
    metaTemplateName: 'nexus_outreach_v1',
    metaTemplateLanguage: 'en',
    template: 'Hello {shop_name}, check out our store location here: {map_url}',
    minDelay: 10,
    maxDelay: 20,
    appendUnsubscribe: true,
    targetCap: 100
  },
  stats: {
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0
  },
  nextDispatchTime: null,
  timerHandle: null,
  countdownIntervalHandle: null,
  logs: []
};

// Helper to push chat item to store & format phone cleanly
function upsertChatMessage(jid, msgObj) {
  if (!messagesStore.has(jid)) {
    messagesStore.set(jid, []);
  }
  const thread = messagesStore.get(jid);
  thread.push(msgObj);
  if (thread.length > 200) thread.shift(); // Keep last 200 messages

  let rawPhone = jid.split('@')[0];
  if (rawPhone.includes(':')) {
    rawPhone = rawPhone.split(':')[0];
  }

  // Format display phone (e.g. 917001681958 -> +91 7001681958)
  const displayPhone = (rawPhone.length === 12 && rawPhone.startsWith('91')) 
    ? `+91 ${rawPhone.substring(2)}` 
    : `+${rawPhone}`;

  const existingChat = chatsStore.get(jid) || {
    jid,
    name: displayPhone,
    phone: rawPhone,
    unreadCount: 0,
    lastMessage: '',
    timestamp: Date.now()
  };

  existingChat.lastMessage = msgObj.text || '[Attachment]';
  existingChat.timestamp = msgObj.timestamp || Date.now();
  if (!msgObj.fromMe) {
    existingChat.unreadCount = (existingChat.unreadCount || 0) + 1;
  }

  chatsStore.set(jid, existingChat);

  // Emit realtime socket events
  io.emit('chat:new_message', { jid, chat: existingChat, message: msgObj });
  io.emit('chat:list', Array.from(chatsStore.values()));
}

// Initialize WhatsApp Baileys Engine
async function initWhatsApp(requestedPhone = null) {
  if (isInitializing) {
    return;
  }

  isInitializing = true;
  waConnectionStatus = 'connecting';
  qrCodeDataUrl = null;
  pairingCode = null;

  io.emit('whatsapp:status', {
    status: waConnectionStatus,
    qr: null,
    pairingCode: null,
    user: null
  });

  if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    let version;
    let isLatest = false;
    try {
      const versionResult = await fetchLatestBaileysVersion();
      version = versionResult.version;
      isLatest = versionResult.isLatest;
      console.log(`ℹ️ Fetched WhatsApp Web Version: v${version.join('.')}, isLatest: ${isLatest}`);
    } catch (vErr) {
      console.warn('⚠️ Could not fetch latest Baileys version dynamically, using fallback:', vErr.message);
      version = [2, 3000, 1017531287];
    }

    waSock = makeWASocket({
      version,
      auth: state,
      browser: Browsers.macOS('Desktop'),
      syncFullHistory: false,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      getMessage: async (key) => {
        try {
          if (key.remoteJid && messagesStore.has(key.remoteJid)) {
            const thread = messagesStore.get(key.remoteJid);
            const found = thread.find(m => m.id === key.id);
            if (found && found.text) {
              return { conversation: found.text };
            }
          }
        } catch (e) {}
        return { conversation: 'Hello' };
      }
    });

    waSock.ev.on('creds.update', saveCreds);

    waSock.ev.on('messages.upsert', async ({ messages, type }) => {
      for (const m of messages) {
        if (!m.message) continue;
        let jid = m.key.remoteJid;
        if (!jid) continue;

        if (jid === 'status@broadcast' || jid.endsWith('@broadcast') || jid.endsWith('@newsletter') || jid.endsWith('@g.us')) {
          continue;
        }

        if (jid.endsWith('@lid') && m.key.remoteJidAlt) {
          jid = m.key.remoteJidAlt;
        }

        jid = jid.replace(/:.*@/, '@');

        const fromMe = Boolean(m.key.fromMe);
        const text = m.message.conversation ||
                     m.message.extendedTextMessage?.text ||
                     m.message.imageMessage?.caption ||
                     m.message.videoMessage?.caption ||
                     '[Attachment]';

        const msgObj = {
          id: m.key.id,
          jid,
          fromMe,
          text,
          timestamp: (m.messageTimestamp ? Number(m.messageTimestamp) * 1000 : Date.now()),
          status: fromMe ? 'sent' : 'received'
        };

        upsertChatMessage(jid, msgObj);
      }
    });

    if (requestedPhone && !waSock.authState.creds.registered) {
      const cleanPhone = String(requestedPhone).replace(/\D/g, '');
      if (cleanPhone) {
        setTimeout(async () => {
          try {
            const rawCode = await waSock.requestPairingCode(cleanPhone);
            const formattedCode = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
            pairingCode = formattedCode;

            addCampaignLog('info', `🔑 Generated Pairing Code: ${formattedCode} for +${cleanPhone}`);
            io.emit('whatsapp:status', {
              status: 'pairing_ready',
              qr: null,
              pairingCode: formattedCode,
              user: null
            });
          } catch (pErr) {
            console.error('Error requesting pairing code:', pErr);
            addCampaignLog('danger', `❌ Pairing code request failed: ${pErr.message}`);
          }
        }, 3000);
      }
    }

    waSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !requestedPhone) {
        waConnectionStatus = 'qr_ready';
        qrCodeDataUrl = await qrcode.toDataURL(qr);
        io.emit('whatsapp:status', {
          status: waConnectionStatus,
          qr: qrCodeDataUrl,
          pairingCode: null,
          user: null
        });
      }

      if (connection === 'open') {
        waConnectionStatus = 'connected';
        isExplicitLogout = false;
        qrCodeDataUrl = null;
        pairingCode = null;

        waUserInfo = {
          id: waSock.user?.id ? waSock.user.id.split(':')[0] : 'Connected User',
          name: waSock.user?.name || 'Active WhatsApp Business Session'
        };

        io.emit('whatsapp:status', {
          status: waConnectionStatus,
          qr: null,
          pairingCode: null,
          user: waUserInfo
        });

        addCampaignLog('success', `✅ WhatsApp connected successfully for account: ${waUserInfo.id}`);
        console.log('✅ WhatsApp Connected Successfully:', waUserInfo);

        if (campaignState.status === 'paused' && campaignState.leads.length > 0 && campaignState.currentIndex < campaignState.leads.length) {
          addCampaignLog('info', '▶️ Connection restored. Auto-resuming campaign queue...');
          campaignState.status = 'running';
          emitCampaignStateUpdate();
          runCampaignQueueLoop();
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401 || isExplicitLogout;

        waConnectionStatus = 'disconnected';
        waUserInfo = null;
        qrCodeDataUrl = null;
        pairingCode = null;

        console.log(`⚠️ Connection closed. StatusCode: ${statusCode}. LoggedOut: ${isLoggedOut}`);

        if (statusCode === 515 || statusCode === DisconnectReason.restartRequired) {
          addCampaignLog('info', '🔄 WhatsApp socket restarting (StatusCode 515). Reconnecting in 3 seconds...');
          io.emit('whatsapp:status', { status: 'connecting', qr: null, pairingCode: null, user: null });
          setTimeout(() => {
            isInitializing = false;
            initWhatsApp().catch(err => console.error('515 Reconnect error:', err));
          }, 3000);
          return;
        }

        if (isLoggedOut) {
          addCampaignLog('warning', `🔴 Logged out by WhatsApp (StatusCode: ${statusCode || 401}). Purging session directory...`);
          clearSessionFolder();
          isExplicitLogout = false;

          io.emit('whatsapp:status', {
            status: 'disconnected',
            qr: null,
            pairingCode: null,
            user: null
          });
        } else {
          addCampaignLog('info', `🔄 Connection interrupted (StatusCode: ${statusCode || 'transient'}). Reconnecting in 5 seconds...`);
          io.emit('whatsapp:status', {
            status: 'connecting',
            qr: null,
            pairingCode: null,
            user: null
          });

          setTimeout(() => {
            isInitializing = false;
            initWhatsApp().catch(err => console.error('Reconnect error:', err));
          }, 5000);
        }
      }
    });
  } catch (err) {
    console.error('Failed to initialize WhatsApp:', err);
    waConnectionStatus = 'disconnected';
    io.emit('whatsapp:status', { status: 'disconnected', qr: null, pairingCode: null, user: null });
  } finally {
    isInitializing = false;
  }
}

// Start WhatsApp engine on server boot
initWhatsApp().catch(err => console.error('Initial WhatsApp load error:', err));

// Socket.io Realtime Listener
io.on('connection', (socket) => {
  socket.emit('whatsapp:status', {
    status: waConnectionStatus,
    qr: qrCodeDataUrl,
    pairingCode: pairingCode,
    user: waUserInfo
  });
  socket.emit('campaign:state', getPublicCampaignState());
  socket.emit('chat:list', Array.from(chatsStore.values()));
});

function getPublicCampaignState() {
  return {
    status: campaignState.status,
    engineMode: campaignState.engineMode,
    leads: campaignState.leads,
    currentIndex: campaignState.currentIndex,
    config: campaignState.config,
    stats: campaignState.stats,
    nextDispatchTime: campaignState.nextDispatchTime,
    logs: campaignState.logs.slice(-100)
  };
}

function emitCampaignStateUpdate() {
  io.emit('campaign:state', getPublicCampaignState());
}

function addCampaignLog(type, message, lead = null) {
  const logEntry = {
    id: Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toLocaleTimeString(),
    type,
    message,
    phone: lead ? lead.phone : null,
    shop_name: lead ? lead.shop_name : null
  };
  campaignState.logs.push(logEntry);
  if (campaignState.logs.length > 500) {
    campaignState.logs.shift();
  }
  io.emit('campaign:log', logEntry);
}

// --- OFFICIAL META WHATSAPP CLOUD API DISPATCHER ---
async function sendMetaCloudApiTemplateMessage({ phoneNumberId, accessToken, templateName, templateLanguage, recipientPhone, shopName, mapUrl }) {
  const cleanPhone = String(recipientPhone).replace(/\D/g, '');
  const formattedPhone = cleanPhone.length === 10 ? '91' + cleanPhone : (cleanPhone.length === 11 && cleanPhone.startsWith('0') ? '91' + cleanPhone.substring(1) : cleanPhone);

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: templateLanguage || 'en'
      },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: shopName || 'Valued Customer' },
            { type: 'text', text: mapUrl || 'N/A' }
          ]
        }
      ]
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const resData = await response.json();

  if (!response.ok || resData.error) {
    const errMsg = resData.error ? `${resData.error.message} (Code: ${resData.error.code})` : `HTTP ${response.status} Error`;
    throw new Error(errMsg);
  }

  const messageId = resData.messages?.[0]?.id || 'meta_' + Date.now();
  return { messageId, formattedPhone };
}

// --- BACKGROUND CAMPAIGN QUEUE ENGINE ---
async function runCampaignQueueLoop() {
  if (isQueueLoopRunning) {
    console.log('⚠️ Queue loop already running. Skipping duplicate invocation.');
    return;
  }

  isQueueLoopRunning = true;

  try {
    while (campaignState.status === 'running') {
      const cap = Math.min(campaignState.config.targetCap || 100, campaignState.leads.length);

      if (campaignState.currentIndex >= cap) {
        campaignState.status = 'completed';
        campaignState.nextDispatchTime = null;
        clearCountdownInterval();
        addCampaignLog('info', `🎉 Campaign completed! Processed all ${cap} target leads.`);
        emitCampaignStateUpdate();
        break;
      }

      // Check engine readiness
      const isMetaMode = campaignState.engineMode === 'meta_cloud';
      if (!isMetaMode && (waConnectionStatus !== 'connected' || !waSock || !waSock.user)) {
        addCampaignLog('warning', `⚠️ Baileys WhatsApp is not connected! Pausing campaign queue...`);
        campaignState.status = 'paused';
        campaignState.nextDispatchTime = null;
        clearCountdownInterval();
        emitCampaignStateUpdate();
        break;
      }

      const currentLead = campaignState.leads[campaignState.currentIndex];
      if (!currentLead) {
        campaignState.status = 'completed';
        campaignState.nextDispatchTime = null;
        clearCountdownInterval();
        emitCampaignStateUpdate();
        break;
      }

      // 1. DELAY CALCULATION:
      const minDelay = parseInt(campaignState.config.minDelay, 10) || 5;
      const maxDelay = parseInt(campaignState.config.maxDelay, 10) || 15;
      const actualMin = Math.min(minDelay, maxDelay);
      const actualMax = Math.max(minDelay, maxDelay);

      let currentDelayMs;
      if (campaignState.currentIndex === 0) {
        currentDelayMs = 1000; // 1s fast start
      } else {
        currentDelayMs = Math.floor(Math.random() * (actualMax - actualMin + 1) + actualMin) * 1000;
      }

      const delaySeconds = Math.round(currentDelayMs / 1000);
      addCampaignLog('info', `⏱ Waiting ${delaySeconds}s delay before dispatching lead #${currentLead.id} (${currentLead.phone})...`);
      campaignState.nextDispatchTime = Date.now() + currentDelayMs;
      emitCampaignStateUpdate();
      startCountdownInterval();

      await new Promise(r => {
        campaignState.timerHandle = setTimeout(r, currentDelayMs);
      });

      clearCountdownInterval();
      campaignState.nextDispatchTime = null;

      if (campaignState.status !== 'running') {
        break;
      }

      const cleanPhone = String(currentLead.phone).replace(/\D/g, '');
      const formattedPhone = cleanPhone.length === 10 ? '91' + cleanPhone : (cleanPhone.length === 11 && cleanPhone.startsWith('0') ? '91' + cleanPhone.substring(1) : cleanPhone);
      const businessName = currentLead.shop_name || currentLead.business_name || 'Business Owner';
      const mapUrl = currentLead.map_url || currentLead.map || currentLead.url || 'N/A';

      if (!formattedPhone || formattedPhone.length < 8) {
        currentLead.status = 'failed';
        currentLead.error = 'Invalid phone format';
        campaignState.stats.failed++;
        campaignState.stats.pending = cap - (campaignState.stats.sent + campaignState.stats.failed);
        addCampaignLog('danger', `❌ Invalid phone number format: ${currentLead.phone}`, currentLead);
        campaignState.currentIndex++;
        emitCampaignStateUpdate();
        continue;
      }

      // --- DISPATCH BASED ON ENGINE MODE ---
      if (isMetaMode) {
        // --- MODE 1: OFFICIAL META WHATSAPP CLOUD API ---
        try {
          addCampaignLog('info', `🔵 Sending via Official Meta Cloud API (Template: ${campaignState.config.metaTemplateName}) to +${formattedPhone}...`, currentLead);

          const metaRes = await sendMetaCloudApiTemplateMessage({
            phoneNumberId: campaignState.config.metaPhoneNumberId,
            accessToken: campaignState.config.metaAccessToken,
            templateName: campaignState.config.metaTemplateName,
            templateLanguage: campaignState.config.metaTemplateLanguage,
            recipientPhone: formattedPhone,
            shopName: businessName,
            mapUrl: mapUrl
          });

          const targetJid = `${formattedPhone}@s.whatsapp.net`;
          upsertChatMessage(targetJid, {
            id: metaRes.messageId,
            jid: targetJid,
            fromMe: true,
            text: `[Meta Template: ${campaignState.config.metaTemplateName}] Hello ${businessName}, check location: ${mapUrl}`,
            timestamp: Date.now(),
            status: 'sent'
          });

          currentLead.status = 'sent';
          currentLead.sentAt = new Date().toLocaleTimeString();
          campaignState.stats.sent++;
          campaignState.stats.pending = cap - (campaignState.stats.sent + campaignState.stats.failed);

          addCampaignLog('success', `✅ Official Meta Cloud API Delivered (ID: ${metaRes.messageId}) to +${formattedPhone}`, currentLead);
        } catch (err) {
          currentLead.status = 'failed';
          currentLead.error = err.message || 'Meta API Send Error';
          campaignState.stats.failed++;
          campaignState.stats.pending = cap - (campaignState.stats.sent + campaignState.stats.failed);

          addCampaignLog('danger', `❌ Meta Cloud API Error for +${formattedPhone}: ${err.message}`, currentLead);
        }
      } else {
        // --- MODE 2: BAILEYS WEB SOCKET (LEGACY) ---
        let text = campaignState.config.template || '';
        text = text.replace(/\{shop_name\}/gi, businessName);
        text = text.replace(/\{business_name\}/gi, businessName);
        text = text.replace(/\{name\}/gi, currentLead.name || businessName);
        text = text.replace(/\{phone\}/gi, currentLead.phone || '');
        text = text.replace(/\{map_url\}/gi, mapUrl);
        text = text.replace(/\{map\}/gi, mapUrl);

        if (campaignState.config.appendUnsubscribe) {
          text += '\n\nReply STOP to unsubscribe';
        }

        try {
          addCampaignLog('info', `🟢 Dispatching via Baileys Web Socket to +${formattedPhone}...`, currentLead);
          let targetJid = `${formattedPhone}@s.whatsapp.net`;

          try {
            const onWaResults = await waSock.onWhatsApp(formattedPhone);
            if (onWaResults && onWaResults.length > 0 && onWaResults[0].exists) {
              targetJid = onWaResults[0].jid;
            }
          } catch (e) {}

          try {
            await waSock.sendPresenceUpdate('composing', targetJid);
            await delay(1500);
          } catch (pErr) {}

          const sentMsg = await waSock.sendMessage(targetJid, { text });

          try {
            await waSock.sendPresenceUpdate('paused', targetJid);
          } catch (pErr) {}

          upsertChatMessage(targetJid, {
            id: sentMsg.key.id,
            jid: targetJid,
            fromMe: true,
            text,
            timestamp: Date.now(),
            status: 'sent'
          });

          currentLead.status = 'sent';
          currentLead.sentAt = new Date().toLocaleTimeString();
          campaignState.stats.sent++;
          campaignState.stats.pending = cap - (campaignState.stats.sent + campaignState.stats.failed);

          addCampaignLog('success', `✅ Baileys Delivered (ID: ${sentMsg.key.id}) to +${formattedPhone}`, currentLead);
        } catch (err) {
          currentLead.status = 'failed';
          currentLead.error = err.message || 'Baileys send error';
          campaignState.stats.failed++;
          campaignState.stats.pending = cap - (campaignState.stats.sent + campaignState.stats.failed);

          addCampaignLog('danger', `❌ Baileys Error for ${currentLead.phone}: ${err.message}`, currentLead);
        }
      }

      campaignState.currentIndex++;
      emitCampaignStateUpdate();
    }
  } finally {
    isQueueLoopRunning = false;
  }
}

function startCountdownInterval() {
  clearCountdownInterval();
  campaignState.countdownIntervalHandle = setInterval(() => {
    if (campaignState.status === 'running' && campaignState.nextDispatchTime) {
      const remainingSeconds = Math.max(0, Math.ceil((campaignState.nextDispatchTime - Date.now()) / 1000));
      io.emit('campaign:tick', { remainingSeconds });
    }
  }, 1000);
}

function clearCountdownInterval() {
  if (campaignState.countdownIntervalHandle) {
    clearInterval(campaignState.countdownIntervalHandle);
    campaignState.countdownIntervalHandle = null;
  }
}

// Multer Upload Setup
const upload = multer({ storage: multer.memoryStorage() });

// --- API ENDPOINTS ---

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    return res.json({ success: true, message: 'Authenticated successfully' });
  }
  return res.status(401).json({ success: false, message: 'Invalid admin password' });
});

app.get('/api/check-auth', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.json({ authenticated: true });
  }
  return res.json({ authenticated: false });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  return res.json({ success: true });
});

app.get('/api/whatsapp/status', requireAuth, (req, res) => {
  return res.json({
    status: waConnectionStatus,
    qr: qrCodeDataUrl,
    pairingCode: pairingCode,
    user: waUserInfo
  });
});

app.post('/api/reset-session', requireAuth, async (req, res) => {
  try {
    addCampaignLog('warning', '🧹 Admin requested full session reset. Purging auth state...');
    isExplicitLogout = true;
    if (waSock) {
      try { waSock.logout(); } catch (e) {}
      try { waSock.end(); } catch (e) {}
    }

    clearSessionFolder();
    waConnectionStatus = 'disconnected';
    waUserInfo = null;
    qrCodeDataUrl = null;
    pairingCode = null;

    isInitializing = false;
    io.emit('whatsapp:status', { status: 'disconnected', qr: null, pairingCode: null, user: null });

    setTimeout(() => {
      initWhatsApp().catch(err => console.error('Error re-init after reset:', err));
    }, 1500);

    return res.json({ success: true, message: 'Session reset successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/whatsapp/pairing-code', requireAuth, async (req, res) => {
  const { phone } = req.body;
  const cleanPhone = String(phone || '').replace(/\D/g, '');

  if (!cleanPhone || cleanPhone.length < 8) {
    return res.status(400).json({ success: false, message: 'Please enter a valid phone number with country code.' });
  }

  try {
    addCampaignLog('info', `📱 Requesting pairing code for +${cleanPhone}...`);
    if (waSock) {
      try { waSock.end(); } catch (e) {}
    }
    isInitializing = false;
    await initWhatsApp(cleanPhone);

    return res.json({
      success: true,
      message: 'Pairing code request initiated.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/whatsapp/reconnect', requireAuth, async (req, res) => {
  try {
    isInitializing = false;
    await initWhatsApp();
    return res.json({ success: true, message: 'Reconnecting WhatsApp engine...' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/whatsapp/logout', requireAuth, async (req, res) => {
  try {
    isExplicitLogout = true;
    if (waSock) {
      try {
        await waSock.logout();
      } catch (err) {
        try { waSock.end(); } catch (e) {}
      }
    }

    clearSessionFolder();

    waConnectionStatus = 'disconnected';
    waUserInfo = null;
    qrCodeDataUrl = null;
    pairingCode = null;

    io.emit('whatsapp:status', { status: waConnectionStatus, qr: null, pairingCode: null, user: null });
    addCampaignLog('warning', '🔴 Explicit logout completed.');

    return res.json({ success: true, message: 'Logged out of WhatsApp session.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- INBOX CRM API ENDPOINTS ---

app.get('/api/chats', requireAuth, (req, res) => {
  const chatList = Array.from(chatsStore.values())
    .filter(c => c.jid && !c.jid.endsWith('@lid') && !c.jid.includes('broadcast'))
    .sort((a, b) => b.timestamp - a.timestamp);
  return res.json({ success: true, chats: chatList });
});

app.get('/api/chats/:jid/messages', requireAuth, (req, res) => {
  const { jid } = req.params;
  const chatObj = chatsStore.get(jid);
  if (chatObj) {
    chatObj.unreadCount = 0;
    chatsStore.set(jid, chatObj);
    io.emit('chat:list', Array.from(chatsStore.values()).filter(c => c.jid && !c.jid.endsWith('@lid') && !c.jid.includes('broadcast')));
  }
  const thread = messagesStore.get(jid) || [];
  return res.json({ success: true, messages: thread });
});

app.post('/api/chats/send', requireAuth, async (req, res) => {
  const { phone, text } = req.body;
  if (!phone || !text) {
    return res.status(400).json({ success: false, message: 'Phone number and message text are required.' });
  }

  if (waConnectionStatus !== 'connected' || !waSock) {
    return res.status(400).json({ success: false, message: 'Baileys WhatsApp is not connected!' });
  }

  try {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? '91' + cleanPhone : (cleanPhone.length === 11 && cleanPhone.startsWith('0') ? '91' + cleanPhone.substring(1) : cleanPhone);
    let targetJid = `${formattedPhone}@s.whatsapp.net`;

    try {
      const [waResult] = await waSock.onWhatsApp(formattedPhone);
      if (waResult && waResult.exists) {
        targetJid = waResult.jid;
      }
    } catch (e) {}

    try {
      await waSock.sendPresenceUpdate('composing', targetJid);
      await delay(1000);
    } catch (e) {}

    const sentMsg = await waSock.sendMessage(targetJid, { text });

    try {
      await waSock.sendPresenceUpdate('paused', targetJid);
    } catch (e) {}

    const msgObj = {
      id: sentMsg.key.id,
      jid: targetJid,
      fromMe: true,
      text,
      timestamp: Date.now(),
      status: 'sent'
    };

    upsertChatMessage(targetJid, msgObj);

    return res.json({ success: true, message: 'Message sent successfully', msgObj });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// File Upload API
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (!rawData || rawData.length < 2) {
      return res.status(400).json({ success: false, message: 'Sheet is empty or missing headers' });
    }

    const headers = rawData[0].map(h => String(h || '').trim());
    const rowObjects = xlsx.utils.sheet_to_json(sheet);

    let shopCol = headers.find(h => /business|shop|store|company|vendor|merchant/i.test(h)) || headers[0];
    let phoneCol = headers.find(h => /phone|mobile|whatsapp|number|contact|tel/i.test(h)) || headers[1] || headers[0];
    let mapCol = headers.find(h => /map|url|link|location|gmap/i.test(h)) || headers[2] || headers[1] || headers[0];
    let nameCol = headers.find(h => /name|owner|client|customer/i.test(h)) || shopCol;

    const leads = rowObjects.map((row, idx) => {
      const shop_name = String(row[shopCol] || row['Business Name'] || row['Shop Name'] || 'Business Owner').trim();
      const phone = String(row[phoneCol] || row['Phone Number'] || row['Phone'] || row['Mobile'] || '').trim();
      const map_url = String(row[mapCol] || row['Map URL'] || row['Map'] || row['Link'] || row['Location'] || '').trim();
      const name = String(row[nameCol] || row['Name'] || shop_name).trim();

      return {
        id: idx + 1,
        shop_name,
        business_name: shop_name,
        phone,
        map_url,
        name,
        status: 'pending',
        error: null,
        sentAt: null
      };
    }).filter(lead => lead.phone.length > 0);

    return res.json({
      success: true,
      headers,
      suggestedMapping: { shopCol, phoneCol, mapCol, nameCol },
      totalLeads: leads.length,
      leads
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: `Excel parsing failed: ${err.message}` });
  }
});

// Campaign Controls API
app.post('/api/campaign/start', requireAuth, (req, res) => {
  const { leads, config } = req.body;

  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ success: false, message: 'No leads provided' });
  }

  const engineMode = config.engineMode || 'meta_cloud';

  if (engineMode === 'meta_cloud') {
    if (!config.metaPhoneNumberId || !config.metaAccessToken || !config.metaTemplateName) {
      return res.status(400).json({
        success: false,
        message: 'Meta Cloud API requires Phone Number ID, Access Token, and Approved Template Name!'
      });
    }
  } else {
    if (waConnectionStatus !== 'connected' || !waSock || !waSock.user) {
      return res.status(400).json({ success: false, message: 'Baileys WhatsApp is not connected!' });
    }
  }

  campaignState.engineMode = engineMode;
  campaignState.config = {
    engineMode,
    metaPhoneNumberId: (config.metaPhoneNumberId || '').trim(),
    metaAccessToken: (config.metaAccessToken || '').trim(),
    metaTemplateName: (config.metaTemplateName || 'nexus_outreach_v1').trim(),
    metaTemplateLanguage: (config.metaTemplateLanguage || 'en').trim(),
    template: config.template || 'Hello {shop_name}, check out our store location here: {map_url}',
    minDelay: parseInt(config.minDelay, 10) || 10,
    maxDelay: parseInt(config.maxDelay, 10) || 20,
    appendUnsubscribe: Boolean(config.appendUnsubscribe),
    targetCap: Math.min(parseInt(config.targetCap, 10) || 100, 500)
  };

  const cap = Math.min(campaignState.config.targetCap, leads.length);
  const targetLeads = leads.slice(0, cap).map((l, i) => ({
    ...l,
    id: i + 1,
    status: 'pending',
    error: null,
    sentAt: null
  }));

  campaignState.leads = targetLeads;
  campaignState.currentIndex = 0;
  campaignState.status = 'running';
  campaignState.stats = {
    total: cap,
    sent: 0,
    failed: 0,
    pending: cap
  };
  campaignState.logs = [];

  addCampaignLog('info', `🚀 Campaign initialized using ${engineMode === 'meta_cloud' ? '🔵 Official Meta Cloud API' : '🟢 Baileys Web Socket'}. Target: ${cap} leads.`);
  emitCampaignStateUpdate();

  runCampaignQueueLoop();

  return res.json({ success: true, message: 'Campaign started successfully.' });
});

app.post('/api/campaign/pause', requireAuth, (req, res) => {
  if (campaignState.status === 'running') {
    campaignState.status = 'paused';
    if (campaignState.timerHandle) {
      clearTimeout(campaignState.timerHandle);
    }
    clearCountdownInterval();
    campaignState.nextDispatchTime = null;
    addCampaignLog('warning', '⏸ Campaign queue paused by admin.');
    emitCampaignStateUpdate();
    return res.json({ success: true, message: 'Campaign paused' });
  }
  return res.status(400).json({ success: false, message: 'Campaign is not running' });
});

app.post('/api/campaign/resume', requireAuth, (req, res) => {
  if (campaignState.status === 'paused') {
    campaignState.status = 'running';
    addCampaignLog('info', '▶️ Campaign queue resumed by admin.');
    emitCampaignStateUpdate();
    runCampaignQueueLoop();
    return res.json({ success: true, message: 'Campaign resumed' });
  }
  return res.status(400).json({ success: false, message: 'Campaign is not paused' });
});

app.post('/api/campaign/stop', requireAuth, (req, res) => {
  campaignState.status = 'stopped';
  if (campaignState.timerHandle) {
    clearTimeout(campaignState.timerHandle);
  }
  clearCountdownInterval();
  campaignState.nextDispatchTime = null;
  addCampaignLog('danger', '🛑 Campaign queue stopped by admin.');
  emitCampaignStateUpdate();
  return res.json({ success: true, message: 'Campaign stopped' });
});

app.get('/api/campaign/status', requireAuth, (req, res) => {
  return res.json(getPublicCampaignState());
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️ Port ${PORT} is already in use by another running Node process.`);
    console.error(`Please stop the existing server or close the terminal running on port ${PORT}.\n`);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 WA Outreach Server running on port ${PORT}`);
  console.log(`🔗 Admin Portal: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});

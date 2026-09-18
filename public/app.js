document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const loginModal = document.getElementById('login-modal');
  const loginForm = document.getElementById('login-form');
  const adminPasswordInput = document.getElementById('admin-password');
  const togglePwdBtn = document.getElementById('toggle-pwd-btn');
  const loginError = document.getElementById('login-error');
  const dashboardView = document.getElementById('dashboard-view');
  const logoutBtn = document.getElementById('logout-btn');

  // Main Platform Tab Switcher
  const mainTabOutreach = document.getElementById('main-tab-outreach');
  const mainTabInbox = document.getElementById('main-tab-inbox');
  const outreachView = document.getElementById('outreach-view');
  const inboxView = document.getElementById('inbox-view');

  // Engine Mode Toggle (Meta Cloud API vs Baileys)
  const modeMetaBtn = document.getElementById('mode-meta-btn');
  const modeBaileysBtn = document.getElementById('mode-baileys-btn');
  const cardMetaConfig = document.getElementById('card-meta-config');
  const cardBaileysConfig = document.getElementById('card-baileys-config');
  const baileysTemplateContainer = document.getElementById('baileys-template-container');

  const metaPhoneIdInput = document.getElementById('meta-phone-id');
  const metaTokenInput = document.getElementById('meta-token');
  const toggleTokenBtn = document.getElementById('toggle-token-btn');
  const metaTemplateNameInput = document.getElementById('meta-template-name');
  const metaTemplateLangInput = document.getElementById('meta-template-lang');

  // WhatsApp DOM & Dual Linking Elements
  const navStatusDot = document.querySelector('.status-dot');
  const navStatusText = document.getElementById('nav-status-text');
  const qrPlaceholder = document.getElementById('qr-placeholder');
  const qrImage = document.getElementById('qr-image');
  const userInfoBox = document.getElementById('user-info-box');
  const userPhoneText = document.getElementById('user-phone');
  const connectWaBtn = document.getElementById('connect-wa-btn');
  const disconnectWaBtn = document.getElementById('disconnect-wa-btn');
  const refreshQrBtn = document.getElementById('refresh-qr-btn');

  // Linking Tabs & Pairing Code Elements
  const tabBtns = document.querySelectorAll('#linking-tabs-container .tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const pairingPhoneInput = document.getElementById('pairing-phone');
  const getPairingCodeBtn = document.getElementById('get-pairing-code-btn');
  const pairingCodeResultCard = document.getElementById('pairing-code-result');
  const pairingCodeValueDisplay = document.getElementById('pairing-code-value');

  // Lead Input Method Tabs (Excel vs Manual)
  const leadTabBtns = document.querySelectorAll('#lead-input-tabs-container .tab-btn');
  const leadTabContents = document.querySelectorAll('.lead-tab-content');
  const manualPhoneInput = document.getElementById('manual-phone-input');
  const parseManualBtn = document.getElementById('parse-manual-btn');

  // File Upload & Mapping
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const uploadStatus = document.getElementById('upload-status');
  const columnMapper = document.getElementById('column-mapper');
  const mapPhoneCol = document.getElementById('map-phone-col');
  const mapShopCol = document.getElementById('map-shop-col');
  const mapUrlCol = document.getElementById('map-url-col');

  // Campaign Settings
  const messageTemplate = document.getElementById('message-template');
  const minDelayInput = document.getElementById('min-delay');
  const maxDelayInput = document.getElementById('max-delay');
  const targetCapInput = document.getElementById('target-cap');
  const startCampaignBtn = document.getElementById('start-campaign-btn');
  const varTags = document.querySelectorAll('.var-tag');

  // Queue Monitoring Controls
  const engineStatusBadge = document.getElementById('engine-status-badge');
  const countdownTimer = document.getElementById('countdown-timer');
  const progressText = document.getElementById('progress-text');
  const progressPercent = document.getElementById('progress-percent');
  const progressFill = document.getElementById('progress-fill');
  const statTotal = document.getElementById('stat-total');
  const statSent = document.getElementById('stat-sent');
  const statPending = document.getElementById('stat-pending');
  const statFailed = document.getElementById('stat-failed');

  const pauseBtn = document.getElementById('pause-btn');
  const resumeBtn = document.getElementById('resume-btn');
  const stopBtn = document.getElementById('stop-btn');

  // Tables & Logs
  const previewCount = document.getElementById('preview-count');
  const leadsTbody = document.getElementById('leads-tbody');
  const logConsole = document.getElementById('log-console');
  const clearLogsBtn = document.getElementById('clear-logs-btn');

  // WhatsApp Web Inbox CRM Elements
  const chatSearchInput = document.getElementById('chat-search-input');
  const chatThreadsList = document.getElementById('chat-threads-list');
  const emptyChatState = document.getElementById('empty-chat-state');
  const activeChatContainer = document.getElementById('active-chat-container');
  const activeChatAvatar = document.getElementById('active-chat-avatar');
  const activeChatName = document.getElementById('active-chat-name');
  const activeChatPhone = document.getElementById('active-chat-phone');
  const chatMessagesBody = document.getElementById('chat-messages-body');
  const composerText = document.getElementById('composer-text');
  const composerSendBtn = document.getElementById('composer-send-btn');
  const toolsContactAvatar = document.getElementById('tools-contact-avatar');
  const toolsContactName = document.getElementById('tools-contact-name');
  const toolsContactPhone = document.getElementById('tools-contact-phone');
  const quickReplyBtns = document.querySelectorAll('.quick-reply-btn');

  // Socket.io initialization
  const socket = io();

  // App State
  let loadedLeads = [];
  let isWhatsAppConnected = false;
  let currentChats = [];
  let selectedJid = null;
  let currentEngineMode = 'meta_cloud'; // Default to official Meta Cloud API

  // --- AUTHENTICATION ---
  checkAuth();

  async function checkAuth() {
    try {
      const res = await fetch('/api/check-auth');
      const data = await res.json();
      if (data.authenticated) {
        showDashboard();
      } else {
        showLogin();
      }
    } catch (err) {
      showLogin();
    }
  }

  function showDashboard() {
    loginModal.classList.add('hidden');
    dashboardView.classList.remove('hidden');
  }

  function showLogin() {
    loginModal.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }

  // --- ENGINE MODE TOGGLE (META CLOUD API VS BAILEYS) ---
  modeMetaBtn.addEventListener('click', () => {
    currentEngineMode = 'meta_cloud';
    modeMetaBtn.classList.add('active');
    modeBaileysBtn.classList.remove('active');
    cardMetaConfig.classList.remove('hidden');
    cardBaileysConfig.classList.add('hidden');
    baileysTemplateContainer.classList.add('hidden');
    checkCanStartCampaign();
  });

  modeBaileysBtn.addEventListener('click', () => {
    currentEngineMode = 'baileys';
    modeBaileysBtn.classList.add('active');
    modeMetaBtn.classList.remove('active');
    cardBaileysConfig.classList.remove('hidden');
    cardMetaConfig.classList.add('hidden');
    baileysTemplateContainer.classList.remove('hidden');
    checkCanStartCampaign();
  });

  toggleTokenBtn.addEventListener('click', () => {
    const type = metaTokenInput.type === 'password' ? 'text' : 'password';
    metaTokenInput.type = type;
    toggleTokenBtn.innerHTML = type === 'password' ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
  });

  [metaPhoneIdInput, metaTokenInput, metaTemplateNameInput].forEach(inp => {
    inp.addEventListener('input', checkCanStartCampaign);
  });

  // --- MAIN PLATFORM TAB SWITCHER (OUTREACH VS WHATSAPP INBOX) ---
  mainTabOutreach.addEventListener('click', () => {
    mainTabOutreach.classList.add('active');
    mainTabInbox.classList.remove('active');
    outreachView.classList.add('active');
    inboxView.classList.remove('active');
  });

  mainTabInbox.addEventListener('click', () => {
    mainTabInbox.classList.add('active');
    mainTabOutreach.classList.remove('active');
    inboxView.classList.add('active');
    outreachView.classList.remove('active');
    loadChatsList();
  });

  // Toggle password visibility
  togglePwdBtn.addEventListener('click', () => {
    const type = adminPasswordInput.type === 'password' ? 'text' : 'password';
    adminPasswordInput.type = type;
    togglePwdBtn.innerHTML = type === 'password' ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    const password = adminPasswordInput.value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (data.success) {
        showDashboard();
      } else {
        loginError.textContent = data.message || 'Invalid password';
        loginError.classList.remove('hidden');
      }
    } catch (err) {
      loginError.textContent = 'Server connection error';
      loginError.classList.remove('hidden');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    showLogin();
  });

  // --- LINKING TABS ---
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // --- LEAD INPUT METHOD TABS ---
  leadTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      leadTabBtns.forEach(b => b.classList.remove('active'));
      leadTabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // --- GET PAIRING CODE BUTTON ---
  getPairingCodeBtn.addEventListener('click', async () => {
    const phone = pairingPhoneInput.value.trim();
    if (!phone || phone.length < 8) {
      alert('Please enter your full WhatsApp phone number with country code (e.g. 919876543210).');
      return;
    }

    try {
      getPairingCodeBtn.disabled = true;
      getPairingCodeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Requesting...';
      pairingCodeResultCard.classList.add('hidden');

      const res = await fetch('/api/whatsapp/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();

      if (!data.success) {
        alert(data.message || 'Failed to request pairing code.');
        getPairingCodeBtn.disabled = false;
        getPairingCodeBtn.innerHTML = '<span>Get Code</span> <i class="fa-solid fa-key"></i>';
      }
    } catch (err) {
      alert('Network error requesting pairing code.');
      getPairingCodeBtn.disabled = false;
      getPairingCodeBtn.innerHTML = '<span>Get Code</span> <i class="fa-solid fa-key"></i>';
    }
  });

  // --- PARSE MANUAL PHONE NUMBERS TEXTAREA ---
  parseManualBtn.addEventListener('click', () => {
    const rawText = manualPhoneInput.value.trim();
    if (!rawText) {
      alert('Please paste or type phone numbers into the text area.');
      return;
    }

    const rawTokens = rawText.split(/\s+|,|\n|\r/);
    const parsedList = [];
    const seen = new Set();

    rawTokens.forEach(token => {
      let cleaned = String(token).replace(/\D/g, '');
      if (!cleaned) return;

      if (cleaned.length === 10) {
        cleaned = '91' + cleaned;
      } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
        cleaned = '91' + cleaned.substring(1);
      }

      if (cleaned.length >= 10 && !seen.has(cleaned)) {
        seen.add(cleaned);
        parsedList.push({
          id: parsedList.length + 1,
          shop_name: `Business #${parsedList.length + 1}`,
          phone: cleaned,
          map_url: 'N/A',
          status: 'pending',
          error: null,
          sentAt: null
        });
      }
    });

    if (parsedList.length === 0) {
      alert('No valid phone numbers detected. Make sure to include numbers with country codes or 10-digit numbers.');
      return;
    }

    loadedLeads = parsedList;
    renderLeadsTable(loadedLeads);
    checkCanStartCampaign();

    alert(`✅ Successfully parsed ${loadedLeads.length} unique phone numbers into the queue!`);
  });

  // --- SOCKET.IO REALTIME EVENTS ---
  socket.on('whatsapp:status', (data) => {
    updateWhatsAppStatusUI(data);
  });

  socket.on('campaign:state', (state) => {
    renderCampaignState(state);
  });

  socket.on('campaign:tick', (data) => {
    if (data.remainingSeconds !== undefined) {
      const mins = Math.floor(data.remainingSeconds / 60);
      const secs = data.remainingSeconds % 60;
      countdownTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  });

  socket.on('campaign:log', (log) => {
    appendLog(log);
  });

  // --- SOCKET.IO INBOX CHAT EVENTS ---
  socket.on('chat:list', (chats) => {
    currentChats = (chats || []).filter(c => c.jid && !c.jid.endsWith('@lid') && !c.jid.includes('broadcast'));
    renderChatThreads(currentChats);
  });

  socket.on('chat:new_message', (data) => {
    const { jid, message } = data;
    if (selectedJid === jid) {
      appendChatMessageBubble(message);
    }
    loadChatsList();
  });

  // --- WHATSAPP UI UPDATER ---
  function updateWhatsAppStatusUI(data) {
    const { status, qr, pairingCode, user } = data;
    navStatusDot.className = `status-dot ${status}`;

    if (status === 'connected') {
      isWhatsAppConnected = true;
      navStatusText.textContent = 'Connected (Baileys)';
      qrPlaceholder.classList.add('hidden');
      qrImage.classList.add('hidden');
      pairingCodeResultCard.classList.add('hidden');
      userInfoBox.classList.remove('hidden');
      userPhoneText.textContent = user?.name || user?.id || 'Connected Account';
      connectWaBtn.classList.add('hidden');
      disconnectWaBtn.classList.remove('hidden');
      getPairingCodeBtn.disabled = false;
      getPairingCodeBtn.innerHTML = '<span>Get Code</span> <i class="fa-solid fa-key"></i>';
      checkCanStartCampaign();
    } else if (status === 'pairing_ready' && pairingCode) {
      isWhatsAppConnected = false;
      navStatusText.textContent = 'Enter Pairing Code';
      pairingCodeValueDisplay.textContent = pairingCode;
      pairingCodeResultCard.classList.remove('hidden');
      userInfoBox.classList.add('hidden');
      getPairingCodeBtn.disabled = false;
      getPairingCodeBtn.innerHTML = '<span>Get Code</span> <i class="fa-solid fa-key"></i>';
      checkCanStartCampaign();
    } else if (status === 'qr_ready' && qr) {
      isWhatsAppConnected = false;
      navStatusText.textContent = 'Scan QR Code';
      qrPlaceholder.classList.add('hidden');
      qrImage.src = qr;
      qrImage.classList.remove('hidden');
      userInfoBox.classList.add('hidden');
      connectWaBtn.classList.add('hidden');
      disconnectWaBtn.classList.remove('hidden');
      checkCanStartCampaign();
    } else if (status === 'connecting') {
      isWhatsAppConnected = false;
      navStatusText.textContent = 'Connecting...';
      qrPlaceholder.innerHTML = '<i class="fa-solid fa-spinner fa-spin placeholder-icon"></i><p>Initializing engine...</p>';
      qrPlaceholder.classList.remove('hidden');
      qrImage.classList.add('hidden');
      userInfoBox.classList.add('hidden');
      checkCanStartCampaign();
    } else {
      isWhatsAppConnected = false;
      navStatusText.textContent = 'Disconnected';
      qrPlaceholder.innerHTML = '<i class="fa-solid fa-qrcode placeholder-icon"></i><p>Device not paired</p>';
      qrPlaceholder.classList.remove('hidden');
      qrImage.classList.add('hidden');
      userInfoBox.classList.add('hidden');
      connectWaBtn.classList.remove('hidden');
      disconnectWaBtn.classList.add('hidden');
      getPairingCodeBtn.disabled = false;
      getPairingCodeBtn.innerHTML = '<span>Get Code</span> <i class="fa-solid fa-key"></i>';
      checkCanStartCampaign();
    }
  }

  connectWaBtn.addEventListener('click', async () => {
    await fetch('/api/whatsapp/reconnect', { method: 'POST' });
  });

  refreshQrBtn.addEventListener('click', async () => {
    await fetch('/api/whatsapp/reconnect', { method: 'POST' });
  });

  disconnectWaBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to log out of WhatsApp? This will clear session credentials.')) {
      await fetch('/api/whatsapp/logout', { method: 'POST' });
    }
  });

  // --- DRAG AND DROP & FILE UPLOAD ---
  browseBtn.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileUpload(fileInput.files[0]);
    }
  });

  async function handleFileUpload(file) {
    const formData = new FormData();
    formData.append('file', file);

    uploadStatus.textContent = 'Uploading and parsing Excel file...';
    uploadStatus.classList.remove('hidden');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        uploadStatus.textContent = `✅ Successfully loaded ${data.totalLeads} leads from "${file.name}"`;
        loadedLeads = data.leads;
        populateColumnMapper(data.headers, data.suggestedMapping);
        renderLeadsTable(loadedLeads);
        checkCanStartCampaign();
      } else {
        uploadStatus.textContent = `❌ Error: ${data.message}`;
      }
    } catch (err) {
      uploadStatus.textContent = '❌ Upload failed due to server error.';
    }
  }

  function populateColumnMapper(headers, suggested) {
    columnMapper.classList.remove('hidden');
    const createOptions = (selectedVal) => {
      return headers.map(h => `<option value="${h}" ${h === selectedVal ? 'selected' : ''}>${h}</option>`).join('');
    };

    mapShopCol.innerHTML = createOptions(suggested.shopCol);
    mapPhoneCol.innerHTML = createOptions(suggested.phoneCol);
    if (mapUrlCol) {
      mapUrlCol.innerHTML = createOptions(suggested.mapCol || headers[2] || headers[0]);
    }
  }

  // --- VARIABLE INSERTION IN TEMPLATE ---
  varTags.forEach(tag => {
    tag.addEventListener('click', () => {
      const variable = tag.getAttribute('data-var');
      const start = messageTemplate.selectionStart;
      const end = messageTemplate.selectionEnd;
      const text = messageTemplate.value;

      messageTemplate.value = text.substring(0, start) + variable + text.substring(end);
      messageTemplate.focus();
      messageTemplate.setSelectionRange(start + variable.length, start + variable.length);
    });
  });

  function checkCanStartCampaign() {
    if (loadedLeads.length === 0) {
      startCampaignBtn.disabled = true;
      return;
    }

    if (currentEngineMode === 'meta_cloud') {
      const phoneId = metaPhoneIdInput.value.trim();
      const token = metaTokenInput.value.trim();
      const templateName = metaTemplateNameInput.value.trim();
      if (phoneId && token && templateName) {
        startCampaignBtn.disabled = false;
      } else {
        startCampaignBtn.disabled = true;
      }
    } else {
      if (isWhatsAppConnected) {
        startCampaignBtn.disabled = false;
      } else {
        startCampaignBtn.disabled = true;
      }
    }
  }

  // --- LAUNCH CAMPAIGN ---
  startCampaignBtn.addEventListener('click', async () => {
    if (loadedLeads.length === 0) {
      alert('Please upload an Excel/CSV file or parse manual phone numbers.');
      return;
    }

    if (currentEngineMode === 'meta_cloud') {
      if (!metaPhoneIdInput.value.trim() || !metaTokenInput.value.trim() || !metaTemplateNameInput.value.trim()) {
        alert('Please fill in Phone Number ID, Access Token, and Approved Template Name for Meta Cloud API!');
        return;
      }
    } else {
      if (!isWhatsAppConnected) {
        alert('Please pair/connect your WhatsApp account via QR Code or Pairing Code first!');
        return;
      }
    }

    const payload = {
      leads: loadedLeads,
      config: {
        engineMode: currentEngineMode,
        metaPhoneNumberId: metaPhoneIdInput.value.trim(),
        metaAccessToken: metaTokenInput.value.trim(),
        metaTemplateName: metaTemplateNameInput.value.trim(),
        metaTemplateLanguage: metaTemplateLangInput.value.trim() || 'en',
        template: messageTemplate.value,
        minDelay: minDelayInput.value,
        maxDelay: maxDelayInput.value,
        targetCap: targetCapInput.value,
        appendUnsubscribe: true
      }
    };

    try {
      startCampaignBtn.disabled = true;
      startCampaignBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Initializing Queue...';

      const res = await fetch('/api/campaign/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) {
        alert(data.message || 'Failed to start campaign');
      }
    } catch (err) {
      alert('Failed to trigger campaign launch.');
    } finally {
      startCampaignBtn.disabled = false;
      startCampaignBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Launch Background Campaign';
    }
  });

  // Campaign Controls
  pauseBtn.addEventListener('click', async () => {
    await fetch('/api/campaign/pause', { method: 'POST' });
  });

  resumeBtn.addEventListener('click', async () => {
    await fetch('/api/campaign/resume', { method: 'POST' });
  });

  stopBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to stop the background campaign?')) {
      await fetch('/api/campaign/stop', { method: 'POST' });
    }
  });

  // --- RENDER CAMPAIGN STATE ---
  function renderCampaignState(state) {
    const { status, leads, stats, config } = state;

    if (config && config.engineMode) {
      currentEngineMode = config.engineMode;
      if (currentEngineMode === 'meta_cloud') {
        modeMetaBtn.classList.add('active');
        modeBaileysBtn.classList.remove('active');
        cardMetaConfig.classList.remove('hidden');
        cardBaileysConfig.classList.add('hidden');
        baileysTemplateContainer.classList.add('hidden');
      } else {
        modeBaileysBtn.classList.add('active');
        modeMetaBtn.classList.remove('active');
        cardBaileysConfig.classList.remove('hidden');
        cardMetaConfig.classList.add('hidden');
        baileysTemplateContainer.classList.remove('hidden');
      }
    }

    engineStatusBadge.className = `badge-status ${status}`;
    engineStatusBadge.textContent = status.toUpperCase();

    statTotal.textContent = stats.total || 0;
    statSent.textContent = stats.sent || 0;
    statPending.textContent = stats.pending || 0;
    statFailed.textContent = stats.failed || 0;

    const total = stats.total || 1;
    const processed = (stats.sent || 0) + (stats.failed || 0);
    const percent = Math.min(100, Math.round((processed / total) * 100));

    progressText.textContent = `${processed} / ${stats.total || 0} Leads Processed`;
    progressPercent.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;

    if (status === 'running') {
      pauseBtn.classList.remove('hidden');
      resumeBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
    } else if (status === 'paused') {
      pauseBtn.classList.add('hidden');
      resumeBtn.classList.remove('hidden');
      stopBtn.classList.remove('hidden');
    } else {
      pauseBtn.classList.add('hidden');
      resumeBtn.classList.add('hidden');
      stopBtn.classList.add('hidden');
      countdownTimer.textContent = '--:--';
    }

    if (leads && leads.length > 0) {
      renderLeadsTable(leads);
    }
  }

  // --- LEADS TABLE RENDER ---
  function renderLeadsTable(leads) {
    previewCount.textContent = `${leads.length} Leads`;
    if (!leads || leads.length === 0) {
      leadsTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted pad-20">No leads loaded yet. Upload an Excel or CSV file (Business Name | Phone Number | Map URL), or paste manual numbers to begin.</td></tr>`;
      return;
    }

    leadsTbody.innerHTML = leads.map(lead => `
      <tr>
        <td><strong>#${lead.id}</strong></td>
        <td>${escapeHtml(lead.shop_name || lead.business_name || 'N/A')}</td>
        <td><code>${escapeHtml(lead.phone)}</code></td>
        <td><span class="truncate-link" title="${escapeHtml(lead.map_url || '')}">${escapeHtml(lead.map_url || 'N/A')}</span></td>
        <td><span class="status-badge-row ${lead.status}">${lead.status.toUpperCase()}</span></td>
      </tr>
    `).join('');
  }

  // --- LOG CONSOLE RENDER ---
  function appendLog(log) {
    const row = document.createElement('div');
    row.className = `log-row ${log.type || 'info'}`;
    row.innerHTML = `<span class="log-time">[${log.timestamp}]</span> <span class="log-msg">${escapeHtml(log.message)}</span>`;
    logConsole.appendChild(row);
    logConsole.scrollTop = logConsole.scrollHeight;
  }

  clearLogsBtn.addEventListener('click', () => {
    logConsole.innerHTML = '<div class="log-row info"><span class="log-time">[System]</span><span class="log-msg">Logs cleared.</span></div>';
  });

  // --- WHATSAPP WEB INBOX CRM ENGINE ---
  async function loadChatsList() {
    try {
      const res = await fetch('/api/chats');
      const data = await res.json();
      if (data.success) {
        currentChats = (data.chats || []).filter(c => c.jid && !c.jid.endsWith('@lid') && !c.jid.includes('broadcast'));
        renderChatThreads(currentChats);
      }
    } catch (err) {
      console.error('Error fetching chat threads:', err);
    }
  }

  chatSearchInput.addEventListener('input', () => {
    const query = chatSearchInput.value.toLowerCase().trim();
    if (!query) {
      renderChatThreads(currentChats);
      return;
    }
    const filtered = currentChats.filter(c => (c.name && c.name.toLowerCase().includes(query)) || (c.jid && c.jid.includes(query)) || (c.phone && c.phone.includes(query)));
    renderChatThreads(filtered);
  });

  function renderChatThreads(chats) {
    const validChats = (chats || []).filter(c => c.jid && !c.jid.endsWith('@lid') && !c.jid.includes('broadcast'));

    if (validChats.length === 0) {
      chatThreadsList.innerHTML = `
        <div class="no-chats-placeholder">
          <i class="fa-solid fa-comment-dots"></i>
          <p>No active chat threads yet.</p>
          <span>Incoming and outgoing WhatsApp messages will appear here in real time.</span>
        </div>
      `;
      return;
    }

    chatThreadsList.innerHTML = validChats.map(c => {
      let rawPhone = c.phone || c.jid.split('@')[0];
      if (rawPhone.includes(':')) rawPhone = rawPhone.split(':')[0];

      const formattedDisplay = (rawPhone.length === 12 && rawPhone.startsWith('91')) 
        ? `+91 ${rawPhone.substring(2)}` 
        : `+${rawPhone}`;

      const initial = formattedDisplay.replace(/\D/g, '').slice(-4) || 'C';
      const timeStr = c.timestamp ? new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const isSelected = selectedJid === c.jid ? 'active' : '';

      return `
        <div class="chat-thread-item ${isSelected}" data-jid="${c.jid}" data-name="${escapeHtml(formattedDisplay)}" data-phone="${rawPhone}">
          <div class="thread-avatar">${initial}</div>
          <div class="thread-details">
            <div class="thread-header-row">
              <span class="thread-name">${escapeHtml(formattedDisplay)}</span>
              <span class="thread-time">${timeStr}</span>
            </div>
            <div class="thread-sub-row">
              <span class="thread-snippet">${escapeHtml(c.lastMessage || '')}</span>
              ${c.unreadCount > 0 ? `<span class="unread-badge">${c.unreadCount}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.chat-thread-item').forEach(item => {
      item.addEventListener('click', () => {
        const jid = item.getAttribute('data-jid');
        const name = item.getAttribute('data-name');
        const phone = item.getAttribute('data-phone');
        openChatThread(jid, name, phone);
      });
    });
  }

  async function openChatThread(jid, name, phone) {
    selectedJid = jid;
    renderChatThreads(currentChats);

    emptyChatState.classList.add('hidden');
    activeChatContainer.classList.remove('hidden');

    const displayNum = phone.startsWith('+') ? phone : `+${phone}`;
    activeChatAvatar.textContent = phone.slice(-2);
    activeChatName.textContent = displayNum;
    activeChatPhone.textContent = displayNum;

    toolsContactAvatar.innerHTML = phone.slice(-2);
    toolsContactName.textContent = displayNum;
    toolsContactPhone.textContent = displayNum;

    chatMessagesBody.innerHTML = '<div class="text-center text-muted pad-20"><i class="fa-solid fa-spinner fa-spin"></i> Loading messages...</div>';

    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(jid)}/messages`);
      const data = await res.json();
      if (data.success) {
        renderChatMessages(data.messages || []);
      }
    } catch (err) {
      chatMessagesBody.innerHTML = '<div class="text-center text-danger pad-20">Failed to load message thread.</div>';
    }
  }

  function renderChatMessages(messages) {
    if (!messages || messages.length === 0) {
      chatMessagesBody.innerHTML = '<div class="text-center text-muted pad-20">No previous messages in this conversation. Type below to start chat.</div>';
      return;
    }

    chatMessagesBody.innerHTML = messages.map(m => {
      const bubbleClass = m.fromMe ? 'msg-outgoing' : 'msg-incoming';
      const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <div class="message-bubble ${bubbleClass}">
          <div class="msg-text">${escapeHtml(m.text)}</div>
          <span class="msg-meta">${timeStr} ${m.fromMe ? '<i class="fa-solid fa-check-double color-emerald"></i>' : ''}</span>
        </div>
      `;
    }).join('');

    chatMessagesBody.scrollTop = chatMessagesBody.scrollHeight;
  }

  function appendChatMessageBubble(m) {
    if (chatMessagesBody.querySelector('.text-muted')) {
      chatMessagesBody.innerHTML = '';
    }
    const bubbleClass = m.fromMe ? 'msg-outgoing' : 'msg-incoming';
    const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const div = document.createElement('div');
    div.className = `message-bubble ${bubbleClass}`;
    div.innerHTML = `
      <div class="msg-text">${escapeHtml(m.text)}</div>
      <span class="msg-meta">${timeStr} ${m.fromMe ? '<i class="fa-solid fa-check-double color-emerald"></i>' : ''}</span>
    `;
    chatMessagesBody.appendChild(div);
    chatMessagesBody.scrollTop = chatMessagesBody.scrollHeight;
  }

  // Send 1-on-1 Direct Message from Inbox
  composerSendBtn.addEventListener('click', sendDirectMessage);
  composerText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendDirectMessage();
    }
  });

  async function sendDirectMessage() {
    const text = composerText.value.trim();
    if (!text || !selectedJid) return;

    const phone = selectedJid.split('@')[0];
    composerText.value = '';

    try {
      composerSendBtn.disabled = true;
      const res = await fetch('/api/chats/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, text })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || 'Failed to send message.');
      }
    } catch (err) {
      alert('Error sending direct message.');
    } finally {
      composerSendBtn.disabled = false;
    }
  }

  // Quick Reply Buttons Handler
  quickReplyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-reply');
      if (text) {
        composerText.value = text;
        composerText.focus();
      }
    });
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});

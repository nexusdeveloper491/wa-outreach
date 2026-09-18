# 🚀 WA-Outreach — Smart WhatsApp Marketing & CRM Platform

<div align="center">

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B%20%7C%20v20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.21.0-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7.5-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io)
[![Baileys](https://img.shields.io/badge/WhatsApp-Baileys%20MD-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://github.com/WhiskeySockets/Baileys)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

<br/>

**A high-performance, full-stack WhatsApp outreach and customer messaging application featuring dual dispatch engines, dynamic Excel parsing, anti-ban randomized delays, real-time Socket.io dashboards, and a live two-way chat inbox.**

[⚡ Quick Start](#-quick-start) • [✨ Features](#-features) • [🏗️ Architecture](#️-architecture) • [🐳 Docker](#-docker-deployment) • [🔒 Security](#-security--best-practices)

</div>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [✨ Key Features](#-key-features)
- [🏗️ System Architecture](#️-system-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [📂 Directory Structure](#-directory-structure)
- [⚡ Quick Start](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration (.env)](#configuration-env)
  - [Running the Application](#running-the-application)
- [📱 How to Use](#-how-to-use)
  - [1. WhatsApp Authentication](#1-whatsapp-authentication)
  - [2. Uploading Leads (Excel / CSV)](#2-uploading-leads-excel--csv)
  - [3. Template Customization & Variables](#3-template-customization--variables)
  - [4. Anti-Ban Safety Controls](#4-anti-ban-safety-controls)
  - [5. Live 2-Way Chat Inbox](#5-live-2-way-chat-inbox)
- [🐳 Docker Deployment](#-docker-deployment)
- [🔒 Security & Best Practices](#-security--best-practices)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)
- [👨‍💻 Author & Credits](#-author--credits)

---

## 📖 Overview

**WA-Outreach** is built for businesses, marketers, and developers who need a reliable, automated, and intelligent WhatsApp messaging platform. Whether you are running targeted customer notifications, promotional campaigns, appointment reminders, or customer outreach, WA-Outreach provides enterprise-grade control with zero subscription bloat.

### 💡 Why WA-Outreach?
- **Dual-Engine Flexibility:** Connect directly using your phone via **Baileys Multi-Device** (QR / Pairing code) or hook into the official **Meta Cloud API**.
- **Anti-Ban Protection:** Randomized humanized delay intervals, batch caps, and concurrency guards to safeguard your WhatsApp accounts.
- **Real-Time Live UI:** Stream progress, countdowns, statistics, and terminal logs directly to your browser with WebSockets.
- **Built-in 2-Way CRM Inbox:** Receive customer replies and chat back in real-time without leaving the web dashboard.

---

## ✨ Key Features

### 🔌 1. Dual Dispatch Engine
- **Baileys Multi-Device Engine:** Connect any standard or WhatsApp Business number via QR code scan or 8-digit Pairing Code. Fully automated session persistence.
- **Meta Cloud API Engine:** Direct REST API integration with Meta Graph API for verified business templates.

### 📊 2. Excel & CSV Smart Lead Parser
- Drag & drop `.xlsx`, `.xls`, or `.csv` contact sheets.
- Automatic column detection: Extracts phone numbers, recipient names, shop/company names, custom URLs, and custom tags.
- Automatic phone normalization: Cleanses spaces, dashes, parentheses, and prefixes standard country codes (e.g. `+91`).

### 📝 3. Dynamic Template Engine
- Personalize each message dynamically using template variables:
  ```text
  Hello {name}, we noticed your store {shop_name} could benefit from our new service!
  Check out details here: {map_url}
  Reply STOP to unsubscribe.
  ```
- Live preview card renders individual recipient placeholders in real time before launching.

### 🛡️ 4. Anti-Ban Smart Delay & Queue Management
- **Random Delay Interval:** Configure min/max delays (e.g., 10s to 25s) between consecutive dispatches to emulate human typing cadence.
- **Target Cap:** Set max batch limits to control daily volume.
- **Queue Controls:** `Start`, `Pause`, `Resume`, and `Emergency Stop` buttons with real-time countdown timers.

### 💬 5. Live Two-Way Chat Inbox
- Centralized customer communication hub.
- Real-time incoming & outgoing message synchronization over Socket.io.
- Unread count badges, formatted phone numbers, message timestamps, and instant reply capability.

### 📈 6. Live Dashboard & Telemetry
- Visual progress bar tracking campaign completion.
- Real-time counters: `Total Leads`, `Sent`, `Failed`, and `Pending`.
- Live WebSocket console log feed for instant debugging.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    User([Admin User]) -->|HTTP / WebSocket| WebUI[Modern Glassmorphism Web UI]
    WebUI -->|Socket.io & REST API| Express[Express.js Server]
    
    subgraph Backend Server
        Express --> Auth[Session Auth Middleware]
        Express --> LeadParser[Excel / CSV Parser (Multer + SheetJS)]
        Express --> QueueManager[Campaign Dispatcher & Delay Queue]
        QueueManager --> EngineRouter{Engine Mode}
        
        EngineRouter -->|Baileys Mode| BaileysEngine[Baileys Multi-Device Socket]
        EngineRouter -->|Cloud API Mode| MetaEngine[Meta Cloud API Graph SDK]
        
        BaileysEngine --> Store[(Local Multi-File Auth Store)]
        BaileysEngine --> ChatStore[(In-Memory 2-Way Chat Cache)]
    end
    
    BaileysEngine -->|End-to-End Encrypted| WhatsAppNetwork[WhatsApp Web Gateway]
    MetaEngine -->|HTTPS REST| MetaGraph[Meta WhatsApp Business Cloud API]
    
    WhatsAppNetwork --> Recipients([Customer WhatsApp Clients])
    MetaGraph --> Recipients
```

---

## 🛠️ Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Runtime** | [Node.js (v18+)](https://nodejs.org/) | Event-driven JavaScript runtime |
| **Backend Framework** | [Express.js (v4.21)](https://expressjs.com/) | REST API routing and session management |
| **Real-Time Layer** | [Socket.io (v4.7)](https://socket.io/) | Full-duplex WebSocket communication |
| **WhatsApp Client** | [@whiskeysockets/baileys (v6.7)](https://github.com/WhiskeySockets/Baileys) | Production-ready WhatsApp Web Multi-Device protocol |
| **File Parsing** | [SheetJS (xlsx v0.18)](https://sheetjs.com/) & [Multer](https://github.com/expressjs/multer) | Excel/CSV ingestion and buffer handling |
| **Frontend UI** | HTML5, Modern CSS3 & Vanilla JavaScript | Ultra-responsive dark-mode glassmorphic dashboard |
| **Containerization** | [Docker](https://www.docker.com/) | Multi-stage lightweight deployment container |

---

## 📂 Directory Structure

```bash
wa-outreach/
├── public/                    # Frontend client assets
│   ├── index.html             # Dashboard UI layout, modals & tabs
│   ├── style.css              # Glassmorphism design system & responsive layout
│   └── app.js                 # WebSocket client, UI bindings & campaign state
├── Dockerfile                 # Optimized production container definition
├── package.json               # Dependencies & scripts
├── package-lock.json          # Dependency lockfile
├── server.js                  # Core Express server, Baileys socket & queue engine
├── .env.example               # Template environment configuration
├── .gitignore                 # Excludes auth tokens, node_modules & temp files
├── LICENSE                    # MIT License
└── README.md                  # Project documentation
```

---

## ⚡ Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **npm**: v9.0.0 or higher
- A working WhatsApp number on a smartphone (for Baileys connection) or Meta Developer Account (for Cloud API).

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nexusdeveloper491/wa-outreach.git
   cd wa-outreach
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the `.env.example` to create your local `.env`:
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env`:**
   ```env
   PORT=3000
   SESSION_SECRET=your_super_secret_session_key_change_me
   ADMIN_PASSWORD=your_secure_admin_password
   ```

### Running the Application

- **Production Mode:**
  ```bash
  npm start
  ```

- **Development / Watch Mode:**
  ```bash
  npm run dev
  ```

Open your browser and navigate to: **`http://localhost:3000`**

---

## 📱 How to Use

### 1. WhatsApp Authentication
1. Log in to the dashboard using the `ADMIN_PASSWORD` defined in your `.env`.
2. Under **WhatsApp Connection**:
   - **QR Code Method:** Click **"Connect WhatsApp"** and scan the displayed QR code with your WhatsApp mobile app (*Settings > Linked Devices > Link a Device*).
   - **Pairing Code Method:** Enter your phone number with country code (e.g., `919876543210`) to generate an 8-character pairing code.

### 2. Uploading Leads (Excel / CSV)
Prepare an Excel file (`.xlsx`) or CSV containing contact details:
| phone | name | shop_name | map_url |
| :--- | :--- | :--- | :--- |
| `919876543210` | Rahul Sharma | Sharma Fitness Store | `https://maps.app.goo.gl/xyz` |
| `918765432109` | Priya Das | Das Nutrition Hub | `https://maps.app.goo.gl/abc` |

Upload the file via the **Upload Leads** zone. The table will populate and show total valid leads.

### 3. Template Customization & Variables
Compose your message in the template box. Insert `{column_header}` matching your sheet:
- `{name}` — Recipient Name
- `{shop_name}` — Business / Shop Name
- `{phone}` — Phone Number
- `{map_url}` — Custom Link

### 4. Anti-Ban Safety Controls
- Set **Minimum Delay** (e.g. `12` seconds) and **Maximum Delay** (e.g. `25` seconds).
- Set **Daily Cap** (e.g. `100` messages).
- Click **"Launch Campaign"**. Monitor live progress, logs, and countdowns in real time.

### 5. Live 2-Way Chat Inbox
Navigate to the **Live Chat** tab to view incoming customer replies, view unread badges, and respond directly.

---

## 🐳 Docker Deployment

You can build and run WA-Outreach with Docker:

```bash
# Build the Docker image
docker build -t wa-outreach:latest .

# Run the container
docker run -d \
  -p 3000:3000 \
  --name wa-outreach-app \
  -v wa_auth_data:/usr/src/app/auth_info_baileys \
  --env-file .env \
  wa-outreach:latest
```

---

## 🔒 Security & Best Practices

- **Never Commit Auth Credentials:** The `auth_info_baileys/` folder contains sensitive WhatsApp multi-device authentication keys. It is strictly excluded in `.gitignore`.
- **Session Protection:** Keep your `SESSION_SECRET` and `ADMIN_PASSWORD` safe and never share `.env` files.
- **WhatsApp Policy Compliance:** Ensure outreach adheres to WhatsApp Business and Messaging Terms of Service. Avoid spamming and always provide an opt-out mechanism.

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome!

1. Fork the project
2. Create your feature branch (`git checkout -b feature/NewFeature`)
3. Commit your changes (`git commit -m 'feat: add NewFeature'`)
4. Push to the branch (`git push origin feature/NewFeature`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author & Credits

- **Developed by:** [NEXUS](https://github.com/nexusdeveloper491)
- **GitHub Repository:** [nexusdeveloper491/wa-outreach](https://github.com/nexusdeveloper491/wa-outreach)

<div align="center">
  <sub>Built for speed, reliability, and high-efficiency communication.</sub>
</div>

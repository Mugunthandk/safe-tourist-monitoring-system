# 🏗 Enterprise Project Structure

```text
SafeGuard-Tourist-Monitoring-System/
│
├── client/                                  # React Frontend
│   ├── public/
│   │
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   │   ├── images/
│   │   │   ├── icons/
│   │   │   └── animations/
│   │   │
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── dashboard/
│   │   │   ├── maps/
│   │   │   ├── charts/
│   │   │   ├── forms/
│   │   │   ├── tables/
│   │   │   ├── notifications/
│   │   │   ├── emergency/
│   │   │   └── ui/
│   │   │
│   │   ├── pages/
│   │   │   ├── Home/
│   │   │   ├── Login/
│   │   │   ├── Register/
│   │   │   ├── Dashboard/
│   │   │   ├── LiveTracking/
│   │   │   ├── SafetyHeatmap/
│   │   │   ├── SOS/
│   │   │   ├── Reports/
│   │   │   ├── Analytics/
│   │   │   ├── Notifications/
│   │   │   ├── Profile/
│   │   │   ├── Settings/
│   │   │   └── Admin/
│   │   │
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── constants/
│   │   ├── styles/
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── server/                                  # Express Backend
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── repositories/
│   ├── validators/
│   ├── database/
│   ├── sockets/
│   ├── helpers/
│   ├── utils/
│   ├── uploads/
│   ├── logs/
│   ├── tests/
│   ├── app.js
│   ├── server.js
│   └── package.json
│
├── docs/
│   ├── API.md
│   ├── Architecture.md
│   ├── Database.md
│   ├── Deployment.md
│   └── UserGuide.md
│
├── screenshots/
├── .github/
├── .env.example
├── package.json
├── README.md
└── LICENSE
```

---

# 💻 Frontend Architecture

```text
Authentication

Dashboard

Home

Live GPS Tracking

Interactive Maps

Safety Heatmap

Emergency SOS

Notifications

Analytics Dashboard

Reports

Profile Management

Admin Panel

Settings

Dark Mode

Responsive Layout
```

---

# ⚙ Backend Architecture

```text
Authentication Service

User Management

Tourist Management

Location Tracking Engine

Geo-Fencing Engine

Emergency SOS Service

Incident Management

Notification Service

Analytics Engine

Dashboard Service

Report Generator

Admin Management

Database Layer

Logging System

File Upload Service

Socket.IO Server

REST API Layer

Security Middleware
```

---

# 🗄 Database Collections

```text
Users

Tourists

Locations

SOS_Requests

GeoFences

Incidents

Notifications

Reports

ActivityLogs

Admins

Sessions
```

---

# 🔐 Security Layer

```text
JWT Authentication

Password Encryption (bcrypt)

Protected Routes

Role-Based Access Control

Input Validation

CORS Protection

Helmet Security

Rate Limiting

Environment Variables

Error Handling
```

---

# 🌐 API Modules

```text
Authentication API

User API

Tourist API

Location API

SOS API

Geo-Fencing API

Incident API

Notification API

Analytics API

Dashboard API

Reports API

Admin API
```

---

# 🛠 Technology Stack

```text
Frontend
• React
• TypeScript
• Tailwind CSS
• Vite

Backend
• Node.js
• Express.js

Database
• MongoDB

Authentication
• JWT
• bcrypt

Maps
• Google Maps API
• Leaflet

Realtime
• Socket.IO

Charts
• Chart.js / Recharts

API
• REST API

Deployment
• Render
• Vercel

Version Control
• Git
• GitHub
```

---

# 📄 Environment Variables

```env
PORT=

MONGO_URI=

JWT_SECRET=

APP_URL=

NODE_ENV=
```

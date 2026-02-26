import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('safeguard.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    walletAddress TEXT,
    blockchainIDHash TEXT,
    role TEXT DEFAULT 'tourist'
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    latitude REAL,
    longitude REAL,
    speed REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    riskLevel TEXT,
    coordinates TEXT -- JSON string of polygon points
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    type TEXT,
    description TEXT,
    latitude REAL,
    longitude REAL,
    status TEXT DEFAULT 'pending',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id)
  );
`);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

app.use(express.json());

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- Hybrid AI Risk Scoring Engine with Behavior Pattern Analysis ---

function isPointInPolygon(point: { lat: number, lng: number }, polygon: { lat: number, lng: number }[]) {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > point.lng) !== (yj > point.lng)) &&
      (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

/**
 * Hybrid AI Risk Scoring Engine
 * Analyzes real-time movement data, geo-fencing, and behavioral patterns
 * to calculate a multi-vector safety score.
 */
/**
 * Supervised ML Inference Simulation
 * This function simulates a trained Random Forest model predicting risk probability.
 * It uses weighted features and calculates feature importance (SHAP values).
 */
function runMLRiskInference(userId: number, latitude: number, longitude: number, speed: number) {
  const zones: any[] = db.prepare("SELECT * FROM zones").all();
  let currentZoneRisk = 'safe';
  let zoneName = 'Unknown';
  
  zones.forEach(zone => {
    const poly = JSON.parse(zone.coordinates);
    if (isPointInPolygon({ lat: latitude, lng: longitude }, poly)) {
      currentZoneRisk = zone.riskLevel;
      zoneName = zone.name;
    }
  });

  // 1. Proximity Detection (Predictive Geo-fencing)
  let proximityWarning = false;
  zones.forEach(zone => {
    const poly = JSON.parse(zone.coordinates);
    // Simple proximity check: if not inside, check if very close (simulated by a slightly larger polygon or distance)
    if (zone.riskLevel === 'high' && !isPointInPolygon({ lat: latitude, lng: longitude }, poly)) {
      // Mock proximity: if within ~200m of a high risk zone
      // In a real app, we'd use a distance-to-polygon algorithm
      const dist = Math.sqrt(Math.pow(latitude - poly[0].lat, 2) + Math.pow(longitude - poly[0].lng, 2));
      if (dist < 0.005) proximityWarning = true; 
    }
  });

  // Feature Extraction
  const features = {
    zone_risk_weight: currentZoneRisk === 'high' ? 0.85 : currentZoneRisk === 'moderate' ? 0.45 : 0.05,
    kinetic_velocity: Math.min(speed / 120, 1.0),
    temporal_dwell: 0,
    historical_density: 0.3,
    proximity_risk: proximityWarning ? 0.4 : 0
  };

  // Temporal Dwell Feature Engineering
  const recentLocs = db.prepare('SELECT * FROM locations WHERE userId = ? ORDER BY id DESC LIMIT 5').all(userId);
  if (recentLocs.length >= 3 && currentZoneRisk === 'high') {
    const sameZone = recentLocs.every((l: any) => {
      const zone = zones.find(z => z.riskLevel === 'high' && isPointInPolygon({ lat: l.latitude, lng: l.longitude }, JSON.parse(z.coordinates)));
      return !!zone;
    });
    if (sameZone) features.temporal_dwell = 0.75;
  }

  // Model Weights (Simulated Random Forest Feature Importance)
  const weights = {
    zone_risk_weight: 0.50,
    kinetic_velocity: 0.20,
    temporal_dwell: 0.15,
    proximity_risk: 0.10,
    historical_density: 0.05
  };

  // Calculate Probability (Inference)
  let probability = (
    features.zone_risk_weight * weights.zone_risk_weight +
    features.kinetic_velocity * weights.kinetic_velocity +
    features.temporal_dwell * weights.temporal_dwell +
    features.proximity_risk * weights.proximity_risk +
    features.historical_density * weights.historical_density
  );

  // SHAP-like Feature Importance Calculation
  const featureImportance = [
    { name: 'Spatial Sector', value: Math.round(features.zone_risk_weight * weights.zone_risk_weight * 100) },
    { name: 'Kinetic Velocity', value: Math.round(features.kinetic_velocity * weights.kinetic_velocity * 100) },
    { name: 'Temporal Dwell', value: Math.round(features.temporal_dwell * weights.temporal_dwell * 100) },
    { name: 'Proximity Alert', value: Math.round(features.proximity_risk * weights.proximity_risk * 100) },
    { name: 'Area Density', value: Math.round(features.historical_density * weights.historical_density * 100) }
  ].sort((a, b) => b.value - a.value);

  const reasons: string[] = [];
  if (features.zone_risk_weight > 0.5) reasons.push(`ML Insight: High-risk sector penetration detected (${zoneName})`);
  if (features.proximity_risk > 0.3) reasons.push(`ML Insight: Proximity warning - Approaching restricted zone`);
  if (features.kinetic_velocity > 0.6) reasons.push(`ML Insight: Kinetic anomaly - Velocity exceeds safe threshold`);
  if (features.temporal_dwell > 0.5) reasons.push(`ML Insight: Temporal anomaly - Prolonged dwell in restricted zone`);

  const score = Math.round(probability * 100);
  let level = 'Low';
  if (score >= 70) level = 'High';
  else if (score >= 35) level = 'Medium';

  // Predictive Trend (Next 30 mins)
  const predictiveTrend = [
    { time: '+5m', risk: Math.min(score + (Math.random() * 10 - 2), 100) },
    { time: '+15m', risk: Math.min(score + (Math.random() * 15 - 5), 100) },
    { time: '+30m', risk: Math.min(score + (Math.random() * 20 - 10), 100) }
  ];

  return {
    score,
    level,
    reasons,
    confidence: 0.92 + (Math.random() * 0.05),
    featureImportance,
    predictiveTrend,
    behavioralPatterns: reasons.map(r => r.split(': ')[1]),
    modelType: 'RandomForest-v2.2-Predictive'
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API Routes ---

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    // Generate Blockchain ID Hash (Demo Level)
    const blockchainIDHash = crypto.createHash('sha256').update(email + Date.now()).digest('hex');
    
    const info = db.prepare('INSERT INTO users (name, email, password, role, blockchainIDHash) VALUES (?, ?, ?, ?, ?)').run(
      name, email, hashedPassword, role || 'tourist', blockchainIDHash
    );
    const user = db.prepare('SELECT id, name, email, role, blockchainIDHash FROM users WHERE id = ?').get(info.lastInsertRowid);
    const token = jwt.sign(user, JWT_SECRET);
    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const { password: _, ...userWithoutPass } = user;
  const token = jwt.sign(userWithoutPass, JWT_SECRET);
  res.json({ token, user: userWithoutPass });
});

app.post('/api/location', authenticate, (req: any, res) => {
  const { latitude, longitude, speed } = req.body;
  db.prepare('INSERT INTO locations (userId, latitude, longitude, speed) VALUES (?, ?, ?, ?)').run(req.user.id, latitude, longitude, speed);
  
  // Supervised ML Inference Simulation
  const riskAnalysis = runMLRiskInference(req.user.id, latitude, longitude, speed);
  let riskAlert = null;

  if (riskAnalysis.level !== 'Low') {
    riskAlert = { 
      type: 'AI_BEHAVIOR_ALERT', 
      level: riskAnalysis.level,
      message: riskAnalysis.reasons.join('. '),
      score: riskAnalysis.score,
      behavioralPatterns: riskAnalysis.behavioralPatterns
    };
    
    io.to(`user_${req.user.id}`).emit('risk_alert', riskAlert);
    io.emit('admin_alert', { ...riskAlert, userId: req.user.id, userName: req.user.name, latitude, longitude });
  }

  // Always broadcast location to admins for real-time map updates
  io.emit('location_update', { 
    userId: req.user.id, 
    name: req.user.name, 
    latitude, 
    longitude, 
    speed, 
    timestamp: new Date().toISOString(),
    riskLevel: riskAnalysis.level
  });

  res.json({ status: 'ok', riskAlert, riskAnalysis });
});

app.post('/api/sos', authenticate, (req: any, res) => {
  const { latitude, longitude, type, description } = req.body;
  const info = db.prepare('INSERT INTO incidents (userId, type, description, latitude, longitude) VALUES (?, ?, ?, ?, ?)').run(req.user.id, type, description, latitude, longitude);
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(info.lastInsertRowid);
  
  io.emit('admin_alert', { type: 'SOS', incident, userName: req.user.name });
  res.json({ status: 'ok', incident });
});

app.get('/api/admin/stats', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'tourist'").get();
  const activeIncidents = db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status = 'pending'").get();
  
  // Count users active in the last 5 minutes
  const activeNow = db.prepare(`
    SELECT COUNT(DISTINCT userId) as count 
    FROM locations 
    WHERE timestamp >= DATETIME('now', '-5 minutes')
  `).get();

  const recentLocations = db.prepare(`
    SELECT l.*, u.name 
    FROM locations l 
    JOIN users u ON l.userId = u.id 
    WHERE l.id IN (SELECT MAX(id) FROM locations GROUP BY userId)
  `).all();

  // Operational Metrics
  const avgRisk = 24 + Math.floor(Math.random() * 10); // Simulated avg risk
  const responseTime = 3.2 + (Math.random() * 0.5); // Simulated response time in mins
  
  res.json({ 
    totalUsers: totalUsers.count, 
    activeIncidents: activeIncidents.count, 
    activeNow: activeNow.count,
    avgRisk,
    responseTime: responseTime.toFixed(1),
    recentLocations 
  });
});

app.get('/api/admin/tourists', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const tourists = db.prepare("SELECT id, name, email, role, walletAddress, blockchainIDHash FROM users WHERE role = 'tourist'").all();
  res.json(tourists);
});

app.post('/api/blockchain/verify', authenticate, (req: any, res) => {
  const user = db.prepare('SELECT blockchainIDHash, email, name FROM users WHERE id = ?').get(req.user.id);
  // Mock verification delay to simulate chain consensus
  setTimeout(() => {
    res.json({ 
      verified: true, 
      identityHash: user.blockchainIDHash,
      metadata: {
        email: user.email,
        name: user.name,
        issuedBy: "SafeGuard Gov Authority",
        network: "Safeguard Mainnet v2.0"
      },
      timestamp: new Date().toISOString(),
      blockNumber: Math.floor(Math.random() * 1000000) + 8400000,
      consensus: "98.4% Validator Approval"
    });
  }, 2000);
});

app.get('/api/zones', (req, res) => {
  const zones = db.prepare('SELECT * FROM zones').all();
  res.json(zones.map((z: any) => ({ ...z, coordinates: JSON.parse(z.coordinates) })));
});

app.post('/api/zones', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, riskLevel, coordinates } = req.body;
  db.prepare('INSERT INTO zones (name, riskLevel, coordinates) VALUES (?, ?, ?)').run(name, riskLevel, JSON.stringify(coordinates));
  res.json({ status: 'ok' });
});

// --- Socket.io ---
io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
  });
});

async function startServer() {
  try {
    // --- Vite Integration ---
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('âœ… Vite middleware attached');
    } else {
      app.use(express.static('dist'));
      app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'dist', 'index.html')));
    }

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`âœ… SafeGuard Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('âŒ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

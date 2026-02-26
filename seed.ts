import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const db = new Database('safeguard.db');

async function seed() {
  // Create tables first
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
      coordinates TEXT
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

  const adminPass = await bcrypt.hash('admin123', 10);
  const touristPass = await bcrypt.hash('tourist123', 10);

  try {
    // Clear existing data
    db.exec('DELETE FROM users');
    db.exec('DELETE FROM zones');
    db.exec('DELETE FROM incidents');
    db.exec('DELETE FROM locations');

    // Seed Users
    db.prepare('INSERT INTO users (name, email, password, role, blockchainIDHash) VALUES (?, ?, ?, ?, ?)').run(
      'Gov Admin', 'admin@safeguard.gov', adminPass, 'admin', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
    );
    db.prepare('INSERT INTO users (name, email, password, role, blockchainIDHash) VALUES (?, ?, ?, ?, ?)').run(
      'John Doe', 'tourist@demo.com', touristPass, 'tourist', '0x123d35Cc6634C0532925a3b844Bc454e4438f44e'
    );
    db.prepare('INSERT INTO users (name, email, password, role, blockchainIDHash) VALUES (?, ?, ?, ?, ?)').run(
      'Alice Smith', 'alice@demo.com', touristPass, 'tourist', '0x987d35Cc6634C0532925a3b844Bc454e4438f44e'
    );
    db.prepare('INSERT INTO users (name, email, password, role, blockchainIDHash) VALUES (?, ?, ?, ?, ?)').run(
      'Bob Johnson', 'bob@demo.com', touristPass, 'tourist', '0x456d35Cc6634C0532925a3b844Bc454e4438f44e'
    );

    // Seed Zones
    const bangkokHighRisk = [
      { lat: 13.75, lng: 100.50 },
      { lat: 13.76, lng: 100.50 },
      { lat: 13.76, lng: 100.51 },
      { lat: 13.75, lng: 100.51 }
    ];
    db.prepare('INSERT INTO zones (name, riskLevel, coordinates) VALUES (?, ?, ?)').run(
      'Khao San Road (Crowded)', 'moderate', JSON.stringify(bangkokHighRisk)
    );

    const darkAlley = [
      { lat: 13.74, lng: 100.49 },
      { lat: 13.745, lng: 100.49 },
      { lat: 13.745, lng: 100.495 },
      { lat: 13.74, lng: 100.495 }
    ];
    db.prepare('INSERT INTO zones (name, riskLevel, coordinates) VALUES (?, ?, ?)').run(
      'Old Town Alleyways', 'high', JSON.stringify(darkAlley)
    );

    const touristPark = [
      { lat: 13.73, lng: 100.53 },
      { lat: 13.74, lng: 100.53 },
      { lat: 13.74, lng: 100.54 },
      { lat: 13.73, lng: 100.54 }
    ];
    db.prepare('INSERT INTO zones (name, riskLevel, coordinates) VALUES (?, ?, ?)').run(
      'Lumpini Park (Safe)', 'safe', JSON.stringify(touristPark)
    );

    console.log('Database seeded successfully.');
  } catch (err) {
    console.error('Error seeding database:', err);
  }
}

seed();

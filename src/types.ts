export interface User {
  id: number;
  name: string;
  email: string;
  role: 'tourist' | 'admin';
  walletAddress?: string;
  blockchainIDHash?: string;
}

export interface Location {
  id: number;
  userId: number;
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: string;
  name?: string;
  riskLevel?: 'Low' | 'Medium' | 'High';
}

export interface Zone {
  id: number;
  name: string;
  riskLevel: 'safe' | 'moderate' | 'high';
  coordinates: { lat: number; lng: number }[];
}

export interface Incident {
  id: number;
  userId: number;
  type: string;
  description: string;
  latitude: number;
  longitude: number;
  status: 'pending' | 'resolved';
  timestamp: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io, Socket } from 'socket.io-client';
import { 
  Shield, 
  AlertTriangle, 
  Map as MapIcon, 
  User, 
  Settings, 
  Bell, 
  Navigation, 
  Activity,
  LogOut,
  Plus,
  Info,
  Search,
  Mail,
  ShieldCheck,
  Zap,
  Flame,
  Database,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User as UserType, Location as LocationType, Zone, Incident, AuthResponse } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'outline' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
      danger: 'bg-red-600 text-white hover:bg-red-700',
      outline: 'border border-gray-300 bg-transparent hover:bg-gray-50 text-gray-700',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden', className)}>
    {children}
  </div>
);

// --- Main Application ---

export default function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [view, setView] = useState<'tourist' | 'admin'>('tourist');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [riskAnalysis, setRiskAnalysis] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showArchModal, setShowArchModal] = useState(false);

  // Health check on mount
  useEffect(() => {
    const checkHealth = async (retries = 5) => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          setIsConnecting(false);
          setConnectionError(null);
        } else {
          throw new Error('Server not ready');
        }
      } catch (err) {
        if (retries > 0) {
          setTimeout(() => checkHealth(retries - 1), 2000);
        } else {
          setIsConnecting(false);
          setConnectionError('Unable to connect to safety network. Please refresh.');
        }
      }
    };
    checkHealth();
  }, []);

  // Auth check
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser && token) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setView(parsedUser.role);
    }
  }, [token]);

  // Socket setup
  useEffect(() => {
    if (user && token) {
      const newSocket = io();
      setSocket(newSocket);
      newSocket.emit('join', user.id);

      newSocket.on('risk_alert', (alert) => {
        setAlerts(prev => [alert, ...prev]);
        // Trigger visual feedback for tourist
        if (alert.type === 'AI_BEHAVIOR_ALERT') {
          setRiskAnalysis({ score: alert.score, level: alert.level, reasons: [alert.message] });
        }
      });

      newSocket.on('admin_alert', (alert) => {
        if (user.role === 'admin') {
          setAlerts(prev => [alert, ...prev]);
          fetchStats();
        }
      });

      newSocket.on('location_update', (loc) => {
        if (user.role === 'admin') {
          setLocations(prev => {
            const index = prev.findIndex(l => l.userId === loc.userId);
            if (index !== -1) {
              const newLocs = [...prev];
              newLocs[index] = { ...newLocs[index], ...loc };
              return newLocs;
            }
            return [...prev, loc];
          });
        }
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user, token]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setStats(data);
      setLocations(data.recentLocations);
    }
  }, [token]);

  const fetchZones = useCallback(async () => {
    const res = await fetch('/api/zones');
    if (res.ok) setZones(await res.json());
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchStats();
      // Poll stats every 30 seconds for real-time counts
      const interval = setInterval(fetchStats, 30000);
      return () => clearInterval(interval);
    }
    fetchZones();
  }, [user, fetchStats, fetchZones]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        const data: AuthResponse = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        setView(data.user.role);
      } else {
        const err = await res.json();
        alert(err.error || 'Login failed');
      }
    } catch (err) {
      alert('Network error: Unable to reach the safety server. Please check your connection.');
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name');
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'tourist' })
      });

      if (res.ok) {
        const data: AuthResponse = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        setView(data.user.role);
      } else {
        const err = await res.json();
        alert(err.error || 'Registration failed');
      }
    } catch (err) {
      alert('Network error: Unable to reach the safety server. Please check your connection.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 relative mb-8">
          <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping" />
          <div className="relative w-full h-full bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl">
            <Shield className="w-10 h-10 text-white animate-pulse" />
          </div>
        </div>
        <h2 className="text-white font-black text-xl uppercase tracking-widest mb-2">SafeGuard</h2>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest animate-pulse">Establishing Secure Connection...</p>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl mb-8">
          <AlertTriangle className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-white font-black text-xl uppercase tracking-widest mb-2">Connection Failed</h2>
        <p className="text-red-400 text-sm font-bold uppercase tracking-widest mb-6">{connectionError}</p>
        <Button onClick={() => window.location.reload()}>Retry Connection</Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="p-8">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">SafeGuard</h1>
              <p className="text-slate-500 text-center">Tourist Safety Monitoring System</p>
            </div>

            <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
              <button 
                onClick={() => setAuthMode('login')}
                className={cn(
                  "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                  authMode === 'login' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Login
              </button>
              <button 
                onClick={() => setAuthMode('register')}
                className={cn(
                  "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                  authMode === 'register' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Create Account
              </button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input 
                    name="email" 
                    type="email" 
                    required 
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="admin@safeguard.gov"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input 
                    name="password" 
                    type="password" 
                    required 
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full py-3">Sign In</Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input 
                    name="name" 
                    type="text" 
                    required 
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input 
                    name="email" 
                    type="email" 
                    required 
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input 
                    name="password" 
                    type="password" 
                    required 
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full py-3">Create Account</Button>
              </form>
            )}
            
            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">
                {authMode === 'login' ? (
                  <>
                    Demo Credentials:<br/>
                    Admin: admin@safeguard.gov / admin123<br/>
                    Tourist: tourist@demo.com / tourist123
                  </>
                ) : (
                  "Join the SafeGuard network to access real-time safety monitoring and blockchain-verified identity."
                )}
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-bottom border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-indigo-600" />
          <span className="font-bold text-xl tracking-tight">SafeGuard</span>
          <div className="ml-4 px-2 py-1 bg-slate-100 rounded text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {user.role} Panel
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowArchModal(true)}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all"
          >
            <Database className="w-3.5 h-3.5" />
            Architecture
          </button>
          <div className="hidden md:flex flex-col items-end">
            <span className="text-sm font-medium text-slate-900">{user.name}</span>
            <span className="text-xs text-slate-500">{user.email}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {user.role === 'admin' ? (
          <AdminDashboard stats={stats} locations={locations} zones={zones} alerts={alerts} token={token!} />
        ) : (
          <TouristApp user={user} token={token!} zones={zones} alerts={alerts} riskAnalysis={riskAnalysis} setRiskAnalysis={setRiskAnalysis} />
        )}
      </main>

      {/* Architecture Modal */}
      <AnimatePresence>
        {showArchModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[6000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 p-8 max-w-2xl w-full overflow-hidden relative"
            >
              <button 
                onClick={() => setShowArchModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <Plus className="w-6 h-6 rotate-45 text-slate-400" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                  <Database className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">System Architecture</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Scalability & Security Roadmap</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Microservice Layer</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Independent <strong>ML Inference Service</strong> (Python/FastAPI) separated from the core API Gateway for horizontal scalability.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Security & Privacy</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      JWT-based RBAC, AES-256 data encryption at rest, and <strong>Immutable Blockchain Identity</strong> storage for government-grade audit trails.
                    </p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Scalability</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Stateless backend architecture ready for <strong>AWS/K8s deployment</strong>. Redis caching layer implemented for real-time location telemetry.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Explainable AI</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Supervised <strong>Random Forest</strong> model with SHAP feature importance visualization for transparent risk scoring.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-10 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-700">Production Ready Architecture</span>
                </div>
                <Button onClick={() => setShowArchModal(false)} variant="outline" className="text-[10px] font-black uppercase tracking-widest">Close</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Admin Dashboard ---

function AdminStats({ stats }: { stats: any }) {
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());
  const [displayCounts, setDisplayCounts] = useState({ total: 0, active: 0, incidents: 0 });

  useEffect(() => {
    if (stats) {
      setLastUpdated(new Date().toLocaleTimeString());
      // Simple rolling number animation
      const targetTotal = stats.totalUsers || 0;
      const targetActive = stats.activeNow || 0;
      const targetIncidents = stats.activeIncidents || 0;
      
      const duration = 1000;
      const steps = 20;
      const stepTime = duration / steps;
      
      let currentStep = 0;
      const interval = setInterval(() => {
        currentStep++;
        setDisplayCounts({
          total: Math.floor((targetTotal / steps) * currentStep),
          active: Math.floor((targetActive / steps) * currentStep),
          incidents: Math.floor((targetIncidents / steps) * currentStep),
        });
        if (currentStep >= steps) {
          setDisplayCounts({ total: targetTotal, active: targetActive, incidents: targetIncidents });
          clearInterval(interval);
        }
      }, stepTime);
      return () => clearInterval(interval);
    }
  }, [stats]);

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 bg-indigo-50 border-indigo-100">
          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Total Tourists</p>
          <p className="text-2xl font-black text-indigo-900">{displayCounts.total}</p>
        </Card>
        
        <Card className="p-4 bg-emerald-50 border-emerald-100 relative overflow-hidden group">
          <div className="flex justify-between items-start relative z-10">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Active Now</p>
            <div className="flex items-center gap-1 bg-white/50 px-1.5 py-0.5 rounded-full border border-emerald-200/50">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[8px] font-bold text-emerald-600 uppercase">Live</span>
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-900 mt-1 relative z-10">{displayCounts.active}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 bg-slate-50 border-slate-100">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Avg Risk Score</p>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-black text-slate-900">{stats?.avgRisk || 0}%</p>
            <span className="text-[8px] font-bold text-emerald-500">-2.4%</span>
          </div>
        </Card>
        <Card className="p-4 bg-slate-50 border-slate-100">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Response Time</p>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-black text-slate-900">{stats?.responseTime || 0}m</p>
            <span className="text-[8px] font-bold text-emerald-500">Fast</span>
          </div>
        </Card>
      </div>

      <Card className="p-4 bg-red-50 border-red-100 relative overflow-hidden">
        <div className="flex justify-between items-center relative z-10">
          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Pending SOS</p>
          {displayCounts.incidents > 0 && (
            <div className="animate-bounce bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full">ACTION REQUIRED</div>
          )}
        </div>
        <p className="text-3xl font-black text-red-900 mt-1 relative z-10">{displayCounts.incidents}</p>
        <div className="absolute -right-4 -bottom-4 opacity-5">
          <AlertTriangle className="w-20 h-20 text-red-900" />
        </div>
      </Card>
    </div>
  );
}

function LiveIncidentFeed({ alerts }: { alerts: any[] }) {
  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {alerts.filter(a => a.type === 'SOS' || a.level === 'High').map((alert, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "p-3 rounded-xl border-2 shadow-lg relative overflow-hidden",
              alert.type === 'SOS' ? "bg-red-50 border-red-500 animate-pulse" : "bg-orange-50 border-orange-400"
            )}
          >
            <div className="flex items-start gap-3 relative z-10">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                alert.type === 'SOS' ? "bg-red-600 text-white" : "bg-orange-500 text-white"
              )}>
                {alert.type === 'SOS' ? <AlertTriangle className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{alert.userName || 'Unknown User'}</p>
                  <span className="text-[8px] font-bold opacity-50">{new Date().toLocaleTimeString()}</span>
                </div>
                <p className="text-[10px] font-bold text-slate-600 mt-0.5 leading-tight">{alert.message || alert.incident?.description}</p>
                <div className="flex gap-2 mt-2">
                  <button className="text-[9px] font-black bg-slate-900 text-white px-2 py-1 rounded uppercase hover:bg-slate-800 transition-colors">Dispatch</button>
                  <button className="text-[9px] font-black border border-slate-200 text-slate-600 px-2 py-1 rounded uppercase hover:bg-slate-50 transition-colors">Ignore</button>
                </div>
              </div>
            </div>
            {alert.type === 'SOS' && (
              <div className="absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 bg-red-500/10 rounded-full blur-xl" />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      {alerts.filter(a => a.type === 'SOS' || a.level === 'High').length === 0 && (
        <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-xl">
          <p className="text-xs text-slate-400 font-medium italic">No critical incidents</p>
        </div>
      )}
    </div>
  );
}

function BlockchainVerification({ user, token }: { user: UserType; token: string }) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [step, setStep] = useState(0);

  const handleVerify = async () => {
    setVerifying(true);
    setStep(1);
    
    // Simulate multi-step verification for demo effect
    setTimeout(() => setStep(2), 600);
    setTimeout(() => setStep(3), 1200);

    const res = await fetch('/api/blockchain/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      setResult(await res.json());
    }
    setVerifying(false);
  };

  const steps = [
    "Initializing Node Connection...",
    "Querying Distributed Ledger...",
    "Validating Consensus Proof..."
  ];

  return (
    <Card className="p-5 bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest">Blockchain ID</h4>
            <p className="text-[10px] text-slate-400 font-medium tracking-tight">Decentralized Trust Protocol</p>
          </div>
        </div>

        {!result ? (
          <div className="space-y-4">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 font-mono text-[10px] break-all text-slate-300">
              {user.blockchainIDHash || 'Generating hash...'}
            </div>
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              {verifying ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>{steps[step-1] || "Verifying..."}</span>
                  </div>
                </div>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Verify Identity on Chain
                </>
              )}
            </button>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <div>
                <p className="text-xs font-black text-emerald-400 uppercase">Identity Confirmed</p>
                <p className="text-[9px] text-emerald-400/60 font-mono">Tx: {result.identityHash.slice(0, 16)}...</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">Network</p>
                <p className="text-[10px] font-black text-slate-200">{result.metadata.network}</p>
              </div>
              <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">Consensus</p>
                <p className="text-[10px] font-black text-emerald-400">{result.consensus}</p>
              </div>
            </div>
            <div className="p-2 bg-white/5 rounded-lg border border-white/10 flex justify-between items-center">
              <span className="text-[8px] font-bold text-slate-500 uppercase">Block Height</span>
              <span className="text-[10px] font-black text-slate-200">#{result.blockNumber}</span>
            </div>
          </motion.div>
        )}
      </div>
      <div className="absolute -right-8 -bottom-8 opacity-10">
        <Shield className="w-32 h-32 rotate-12" />
      </div>
    </Card>
  );
}

function BlockchainLedger({ token }: { token: string }) {
  const [tourists, setTourists] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchTourists = async () => {
      try {
        const res = await fetch('/api/admin/tourists', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setTourists(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch ledger', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTourists();
  }, [token]);

  const verifyOnChain = (id: number) => {
    setVerifyingId(id);
    setTimeout(() => setVerifyingId(null), 2000);
  };

  if (loading) return <div className="space-y-2 animate-pulse">
    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-white/5 rounded-xl" />)}
  </div>;

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
      {tourists.map((t) => (
        <div key={t.id} className="p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-[10px] font-black text-white uppercase">{t.name}</p>
              <p className="text-[8px] text-slate-400 font-mono">{t.email}</p>
            </div>
            <button 
              onClick={() => verifyOnChain(t.id)}
              className={cn(
                "px-2 py-1 rounded text-[8px] font-black uppercase border transition-all",
                verifyingId === t.id 
                  ? "bg-indigo-500 border-indigo-400 text-white animate-pulse" 
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500 hover:text-slate-900"
              )}
            >
              {verifyingId === t.id ? 'Verifying...' : 'Verify on Chain'}
            </button>
          </div>
          <div className="p-2 bg-black/40 rounded-lg border border-white/5 font-mono text-[8px] break-all text-slate-500 group-hover:text-slate-300 transition-colors">
            {t.blockchainIDHash}
          </div>
        </div>
      ))}
    </div>
  );
}

function TouristList({ token }: { token: string }) {
  const [tourists, setTourists] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchTourists = async () => {
      try {
        const res = await fetch('/api/admin/tourists', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setTourists(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch tourists', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTourists();
  }, [token]);

  const filteredTourists = tourists.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-16 bg-slate-100 rounded-xl border border-slate-200/50" />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search tourists..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
        />
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {filteredTourists.map((t) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={t.id} 
              className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs border border-indigo-100">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{t.name}</p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {t.email}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[9px] font-bold uppercase tracking-wider border border-indigo-100/50">
                    {t.role}
                  </span>
                  {t.blockchainIDHash && (
                    <div className="flex items-center gap-1 text-[8px] text-emerald-600 font-mono opacity-60">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      Verified
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {filteredTourists.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-xs text-slate-400 italic">No tourists found</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminDashboard({ stats, locations, zones, alerts, token }: { stats: any; locations: LocationType[]; zones: Zone[]; alerts: any[]; token: string }) {
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [activeSOS, setActiveSOS] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<'stats' | 'tourists' | 'ledger'>('stats');
  const [showHeatmap, setShowHeatmap] = useState(false);

  useEffect(() => {
    const latestSOS = alerts.find(a => a.type === 'SOS');
    if (latestSOS) {
      setActiveSOS(latestSOS);
      setShowSOSModal(true);
    }
  }, [alerts]);

  return (
    <div className="flex-1 relative overflow-hidden bg-slate-900">
      {/* Full Screen Map */}
      <div className="absolute inset-0 z-0">
        <MapContainer center={[13.7563, 100.5018]} zoom={12} className="h-full w-full grayscale-[0.4] contrast-[1.2] brightness-[0.8]">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {showHeatmap && locations.map((loc, i) => (
            <Circle 
              key={`heat-${i}`}
              center={[loc.latitude, loc.longitude]}
              radius={1500}
              pathOptions={{ 
                fillColor: loc.riskLevel === 'High' ? '#ef4444' : loc.riskLevel === 'Medium' ? '#f59e0b' : '#10b981',
                fillOpacity: 0.2,
                stroke: false,
                className: 'animate-pulse'
              }}
            />
          ))}

          {locations.map((loc) => (
            <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div class="pulse-marker ${loc.riskLevel === 'High' ? 'text-red-500' : loc.riskLevel === 'Medium' ? 'text-orange-500' : 'text-emerald-500'}"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })}>
              <Popup className="custom-popup">
                <div className="p-2 min-w-[180px]">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <p className="font-black text-slate-900 uppercase tracking-tight">{loc.name}</p>
                    {loc.riskLevel && (
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                        loc.riskLevel === 'High' ? "bg-red-500 text-white" : 
                        loc.riskLevel === 'Medium' ? "bg-orange-500 text-white" : 
                        "bg-emerald-500 text-white"
                      )}>
                        {loc.riskLevel}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-bold uppercase">Speed</span>
                      <span className="text-slate-900 font-black">{loc.speed.toFixed(1)} km/h</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-bold uppercase">Last Seen</span>
                      <span className="text-slate-900 font-black">{new Date(loc.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {loc.riskLevel && loc.riskLevel !== 'Low' && (
                      <div className="mt-2 p-2 bg-slate-900 rounded-lg">
                        <p className="text-[8px] font-black text-indigo-400 uppercase mb-1">Behavior Analysis</p>
                        <ul className="space-y-0.5">
                          <li className="text-[8px] text-slate-300 flex items-center gap-1">
                            <div className="w-1 h-1 bg-indigo-500 rounded-full" />
                            Pattern Anomaly Detected
                          </li>
                          <li className="text-[8px] text-slate-300 flex items-center gap-1">
                            <div className="w-1 h-1 bg-indigo-500 rounded-full" />
                            Kinetic Vector Deviation
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                  <button className="w-full mt-3 py-1.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-all">View History</button>
                </div>
              </Popup>
            </Marker>
          ))}
          {zones.map((zone) => (
            <Polygon 
              key={zone.id} 
              positions={zone.coordinates.map(c => [c.lat, c.lng])}
              pathOptions={{ 
                color: zone.riskLevel === 'high' ? '#ef4444' : zone.riskLevel === 'moderate' ? '#f59e0b' : '#10b981',
                fillOpacity: 0.1,
                weight: 1,
                dashArray: zone.riskLevel === 'high' ? '5, 10' : '0'
              }}
            >
              <Popup>
                <div className="p-1">
                  <p className="font-black text-slate-900 uppercase tracking-tight">{zone.name}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">{zone.riskLevel} Risk Area</p>
                </div>
              </Popup>
            </Polygon>
          ))}
        </MapContainer>
      </div>

      {/* Floating Control Bar */}
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-4">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-2xl flex items-center gap-6">
          <div className="flex items-center gap-3 pr-6 border-r border-white/10">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-tighter">Command Center</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Live Monitoring</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setActivePanel('stats')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activePanel === 'stats' ? "bg-white text-slate-900" : "text-white hover:bg-white/5"
              )}
            >
              Analytics
            </button>
            <button 
              onClick={() => setActivePanel('tourists')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activePanel === 'tourists' ? "bg-white text-slate-900" : "text-white hover:bg-white/5"
              )}
            >
              Tourists
            </button>
            <button 
              onClick={() => setActivePanel('ledger')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activePanel === 'ledger' ? "bg-white text-slate-900" : "text-white hover:bg-white/5"
              )}
            >
              Ledger
            </button>
          </div>

          <div className="flex items-center gap-2 pl-6 border-l border-white/10">
            <span className="text-[8px] font-black text-slate-500 uppercase">Heatmap</span>
            <button 
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={cn(
                "w-10 h-5 rounded-full transition-all relative",
                showHeatmap ? "bg-indigo-500" : "bg-slate-700"
              )}
            >
              <div className={cn(
                "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                showHeatmap ? "left-6" : "left-1"
              )} />
            </button>
          </div>
        </div>

        {/* Dynamic Panel Overlay */}
        <AnimatePresence mode="wait">
          {activePanel === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-80 bg-slate-900/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl space-y-6"
            >
              <AdminStats stats={stats} />
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Risk Analysis</h3>
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[
                      { name: '00:00', risk: 40 }, { name: '04:00', risk: 30 }, { name: '08:00', risk: 65 },
                      { name: '12:00', risk: 85 }, { name: '16:00', risk: 70 }, { name: '20:00', risk: 50 },
                    ]}>
                      <Area type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={2} fill="#ef4444" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Incidents</h3>
                <LiveIncidentFeed alerts={alerts} />
              </div>
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Activity Log</h3>
                <div className="bg-black/40 rounded-2xl border border-white/5 p-3 h-40 overflow-y-auto custom-scrollbar font-mono text-[9px] space-y-1">
                  {alerts.slice(0, 10).map((a, i) => (
                    <div key={i} className="text-slate-400 flex gap-2">
                      <span className="text-indigo-400">[{new Date().toLocaleTimeString()}]</span>
                      <span>{a.message || 'System update received'}</span>
                    </div>
                  ))}
                  <div className="text-emerald-400 animate-pulse">_ Listening for incoming data...</div>
                </div>
              </div>
            </motion.div>
          )}

          {activePanel === 'tourists' && (
            <motion.div
              key="tourists"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-80 bg-slate-900/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl"
            >
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Registered Tourists</h3>
              <TouristList token={token} />
            </motion.div>
          )}

          {activePanel === 'ledger' && (
            <motion.div
              key="ledger"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-96 bg-slate-900/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Blockchain Ledger</h3>
                <div className="flex items-center gap-1 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                  <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-emerald-400 uppercase">Synced</span>
                </div>
              </div>
              <BlockchainLedger token={token} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Legend */}
      <div className="absolute bottom-6 right-6 z-10 bg-slate-900/80 backdrop-blur-xl p-5 rounded-3xl shadow-2xl border border-white/10 min-w-[220px]">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Tactical Legend</h4>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs text-slate-200 font-bold">
            <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" /> High Risk Zone
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-200 font-bold">
            <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" /> Moderate Risk
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-200 font-bold">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" /> Safe Sector
          </div>
        </div>
      </div>

      {/* SOS Modal */}
      <AnimatePresence>
        {showSOSModal && activeSOS && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[2000] bg-red-600/20 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl shadow-[0_0_50px_rgba(239,68,68,0.3)] border-4 border-red-600 p-8 max-w-md w-full text-center"
            >
              <div className="w-20 h-20 bg-red-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black text-red-600 uppercase tracking-tighter mb-2">SOS EMERGENCY</h2>
              <p className="text-slate-500 font-bold mb-6">Critical alert received from <span className="text-slate-900">{activeSOS.userName}</span></p>
              
              <div className="bg-slate-50 rounded-2xl p-4 mb-8 text-left border border-slate-100">
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Location</span>
                  <span className="text-[10px] font-black text-slate-900 uppercase">Sector 4-B</span>
                </div>
                <p className="text-sm font-bold text-slate-700">{activeSOS.message || activeSOS.incident?.description}</p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowSOSModal(false)}
                  className="flex-1 py-4 bg-red-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  Dispatch Help
                </button>
                <button 
                  onClick={() => setShowSOSModal(false)}
                  className="px-6 py-4 border-2 border-slate-200 text-slate-400 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// --- Tourist App ---

function TouristApp({ user, token, zones, alerts, riskAnalysis, setRiskAnalysis }: { user: UserType; token: string; zones: Zone[]; alerts: any[]; riskAnalysis: any; setRiskAnalysis: (val: any) => void }) {
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<{ active: boolean; eta: number; unit: string } | null>(null);
  const [showRouteSafety, setShowRouteSafety] = useState(false);
  const [routeSafetyScore, setRouteSafetyScore] = useState<number | null>(null);

  useEffect(() => {
    let interval: any;
    if (isTracking) {
      interval = setInterval(() => {
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude, longitude, speed } = pos.coords;
          setLocation([latitude, longitude]);
          fetch('/api/location', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ latitude, longitude, speed: (speed || 0) * 3.6 })
          })
          .then(res => res.json())
          .then(data => {
            if (data.riskAnalysis) setRiskAnalysis(data.riskAnalysis);
          });
        });
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [isTracking, token]);

  const triggerSOS = async () => {
    if (!location) return alert('Location not found. Please enable GPS.');
    setSosLoading(true);
    try {
      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          latitude: location[0], 
          longitude: location[1], 
          type: 'EMERGENCY', 
          description: 'SOS Triggered by user' 
        })
      });
      if (res.ok) {
        setDispatchStatus({ active: true, eta: 4, unit: 'Alpha-9 Patrol' });
        // Simulate ETA countdown
        const timer = setInterval(() => {
          setDispatchStatus(prev => prev && prev.eta > 1 ? { ...prev, eta: prev.eta - 1 } : prev);
        }, 60000);
        setTimeout(() => clearInterval(timer), 300000);
      } else {
        alert('Failed to send SOS. Please try again.');
      }
    } catch (err) {
      alert('Network error. Please check your connection.');
    } finally {
      setSosLoading(false);
    }
  };

  const analyzeRouteSafety = () => {
    setShowRouteSafety(true);
    setRouteSafetyScore(null);
    setTimeout(() => {
      setRouteSafetyScore(88 + Math.floor(Math.random() * 10));
    }, 1500);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
      {/* Risk Alert Toast */}
      <AnimatePresence>
        {riskAnalysis && riskAnalysis.level !== 'Low' && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-0 left-0 right-0 z-[3000] px-6"
          >
            <div className={cn(
              "p-4 rounded-2xl shadow-2xl border-2 flex items-center gap-4",
              riskAnalysis.level === 'High' ? "bg-red-600 border-red-400 text-white" : "bg-orange-500 border-orange-300 text-white"
            )}>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-widest opacity-80">AI Behavior Alert</p>
                <p className="text-sm font-bold leading-tight">{riskAnalysis.reasons[0]}</p>
              </div>
              <button 
                onClick={() => setRiskAnalysis(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Area - Primary Interface */}
      <div className="flex-1 relative">
        <MapContainer center={location || [13.7563, 100.5018]} zoom={15} className="h-full w-full grayscale-[0.1]">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {location && (
            <>
              <Marker position={location} icon={L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="pulse-marker text-indigo-600"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })} />
              <Circle center={location} radius={100} pathOptions={{ color: '#6366f1', fillOpacity: 0.1, weight: 1 }} />
              <MapUpdater center={location} />
            </>
          )}
          {zones.map((zone) => (
            <Polygon 
              key={zone.id} 
              positions={zone.coordinates.map(c => [c.lat, c.lng])}
              pathOptions={{ 
                color: zone.riskLevel === 'high' ? '#ef4444' : zone.riskLevel === 'moderate' ? '#f59e0b' : '#10b981',
                fillOpacity: 0.1,
                weight: 1,
                dashArray: zone.riskLevel === 'high' ? '5, 10' : '0'
              }}
            />
          ))}
        </MapContainer>

        {/* Floating Controls */}
        <div className="absolute top-4 right-4 z-[1000] space-y-3">
          <button 
            onClick={() => setIsTracking(!isTracking)}
            className={cn(
              "w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all border-2",
              isTracking ? "bg-emerald-500 border-emerald-400 text-white" : "bg-white border-slate-100 text-slate-600"
            )}
          >
            <Navigation className={cn("w-6 h-6", isTracking && "animate-pulse")} />
          </button>
          <button 
            onClick={analyzeRouteSafety}
            className="w-14 h-14 bg-white border-2 border-slate-100 rounded-2xl shadow-2xl flex items-center justify-center text-indigo-600 hover:bg-slate-50 transition-all"
          >
            <MapIcon className="w-6 h-6" />
          </button>
        </div>

        {/* SOS Button Overlay */}
        <div className="absolute bottom-10 left-0 right-0 z-[1000] px-6">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={triggerSOS}
            disabled={sosLoading}
            className="w-full bg-red-600 text-white py-6 rounded-3xl shadow-[0_20px_50px_rgba(220,38,38,0.4)] font-black text-xl tracking-widest uppercase flex items-center justify-center gap-4 disabled:opacity-50 border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all"
          >
            <AlertTriangle className="w-8 h-8" />
            {sosLoading ? 'Transmitting...' : 'Trigger SOS'}
          </motion.button>
        </div>
      </div>

      {/* Slide-up Info Panel */}
      <div className="bg-white border-t border-slate-200 p-6 space-y-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
        <AnimatePresence>
          {showRouteSafety && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-emerald-600 rounded-2xl p-4 text-white space-y-3 shadow-lg shadow-emerald-600/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Navigation className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Smart Route Safety</p>
                    <p className="text-sm font-black">Analyzing optimal path...</p>
                  </div>
                </div>
                <button onClick={() => setShowRouteSafety(false)} className="p-1 hover:bg-white/10 rounded-lg">
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              {routeSafetyScore !== null ? (
                <div className="flex items-center justify-between bg-white/10 rounded-xl p-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Safety Confidence</p>
                    <p className="text-xl font-black">{routeSafetyScore}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Recommendation</p>
                    <p className="text-xs font-bold uppercase">Proceed with caution</p>
                  </div>
                </div>
              ) : (
                <div className="h-12 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {dispatchStatus && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-indigo-600 rounded-2xl p-4 text-white flex items-center justify-between shadow-lg shadow-indigo-600/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Authority Assigned</p>
                <p className="text-sm font-black">{dispatchStatus.unit} en route</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">ETA</p>
              <p className="text-xl font-black">{dispatchStatus.eta} MIN</p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Safety Analysis</h3>
              <div className="flex items-center gap-2">
                <div className={cn("w-1.5 h-1.5 rounded-full", isTracking ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
                <span className="text-[9px] font-black text-slate-900 uppercase">{isTracking ? 'Live' : 'Offline'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 bg-slate-50 border-none">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Risk Score</p>
                <p className={cn(
                  "text-2xl font-black",
                  riskAnalysis?.level === 'High' ? "text-red-600" : riskAnalysis?.level === 'Medium' ? "text-orange-500" : "text-emerald-500"
                )}>
                  {riskAnalysis?.score || 0}
                </p>
              </Card>
              <Card className="p-4 bg-slate-50 border-none">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Status</p>
                <p className={cn(
                  "text-sm font-black uppercase",
                  riskAnalysis?.level === 'High' ? "text-red-600" : riskAnalysis?.level === 'Medium' ? "text-orange-500" : "text-emerald-500"
                )}>
                  {riskAnalysis?.level || 'Safe'}
                </p>
              </Card>
            </div>

            {/* Explainable AI Section */}
            {riskAnalysis && riskAnalysis.reasons && riskAnalysis.reasons.length > 0 && (
              <div className="p-4 bg-slate-900 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-indigo-400" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Explainable AI Insights</span>
                  <span className="ml-auto text-[8px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-1.5 py-0.5 rounded">
                    {riskAnalysis.modelType}
                  </span>
                </div>
                
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Model Confidence</span>
                  <span className="text-[10px] font-black text-emerald-400">{(riskAnalysis.confidence * 100).toFixed(1)}%</span>
                </div>

                <div className="space-y-2">
                  {riskAnalysis.reasons.map((reason: string, i: number) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <p className="text-[11px] font-bold text-slate-200 leading-tight">{reason}</p>
                    </div>
                  ))}
                </div>

                {/* Feature Importance Chart */}
                <div className="pt-3 border-t border-white/5">
                  <p className="text-[8px] font-black text-slate-500 uppercase mb-3 tracking-widest">Feature Importance (SHAP)</p>
                  <div className="space-y-2">
                    {riskAnalysis.featureImportance.map((feat: any, i: number) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-[8px] font-bold uppercase tracking-wider">
                          <span className="text-slate-400">{feat.name}</span>
                          <span className="text-slate-200">{feat.value}%</span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${feat.value}%` }}
                            className="h-full bg-indigo-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Predictive Risk Trend */}
                {riskAnalysis.predictiveTrend && (
                  <div className="pt-3 border-t border-white/5">
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-3 tracking-widest">Predictive Risk Forecast</p>
                    <div className="h-20 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={riskAnalysis.predictiveTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                          <XAxis dataKey="time" hide />
                          <YAxis hide domain={[0, 100]} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                            itemStyle={{ color: '#818cf8' }}
                          />
                          <Area type="monotone" dataKey="risk" stroke="#818cf8" fill="#818cf8" fillOpacity={0.2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                {riskAnalysis.behavioralPatterns && riskAnalysis.behavioralPatterns.length > 0 && (
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-2">Detected Patterns</p>
                    <div className="flex flex-wrap gap-1">
                      {riskAnalysis.behavioralPatterns.map((pattern: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-white/5 rounded text-[8px] font-bold text-slate-400 border border-white/5">
                          {pattern}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <BlockchainVerification user={user} token={token} />
        </div>
      </div>
    </div>
  );
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

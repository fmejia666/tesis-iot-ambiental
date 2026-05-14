import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { 
  Wind, Activity, Thermometer, LayoutDashboard, Database, Download, 
  MapPin, Sliders, Save, LogOut, ShieldAlert, Plus, RotateCw, Edit2, X, Check
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend, AreaChart, Area 
} from 'recharts';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import { useSensorData } from './useSensorData';
import Login from './Login';

// URL servidor en Render
const API_BASE_URL = "https://tesis-iot-ambiental.onrender.com";

// =========================================================
// COMPONENTES BASE
// =========================================================
function KPICard({ title, value, unit, icon, level, message }) {
  const styles = {
    danger: "border-red-500 bg-red-50 text-red-700",
    warning: "border-yellow-500 bg-yellow-50 text-yellow-700",
    normal: "border-green-500 bg-green-50 text-green-700"
  };

  return (
    <div className={`p-6 rounded-2xl border-t-8 shadow-lg bg-white transition-all ${styles[level] || 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 rounded-xl bg-white shadow-sm">{icon}</div>
        <span className="text-xs font-black uppercase tracking-widest">{level}</span>
      </div>
      <p className="text-sm text-gray-500 font-bold uppercase">{title}</p>
      <h3 className="text-4xl font-black mt-1">{value} <span className="text-lg font-medium">{unit}</span></h3>
      {message && <p className="mt-3 text-sm font-medium opacity-80">{message}</p>}
    </div>
  );
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => { map.invalidateSize(); }, 300);
  }, [map]);
  return null;
}

// =========================================================
// VISTAS DEL SISTEMA
// =========================================================

// --- 1. DASHBOARD PRINCIPAL ---
function DashboardView({ data, history, thresholds }) {
  const { metrics } = data;
  const sensorLocation = [-3.988, -79.202]; // Coordenadas UTPL Loja aproximadas

  const pm25Risk = metrics.pm25_ugm3 > thresholds.pm25 ? 'danger' : (metrics.pm25_ugm3 > (thresholds.pm25 * 0.5) ? 'warning' : 'normal');
  const pm10Risk = metrics.pm10_ugm3 > thresholds.pm10 ? 'warning' : 'normal';
  const co2Risk = metrics.co2_ppm > thresholds.co2 ? 'danger' : 'normal';

  const getMapRiskColor = (level) => {
    if (level === 'danger') return '#ef4444';
    if (level === 'warning') return '#eab308';
    return '#22c55e';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="PM 2.5 (Finas)" value={metrics.pm25_ugm3} unit="µg/m³" icon={<Wind className="text-blue-500" size={28}/>} level={pm25Risk} message={`Umbral: ${thresholds.pm25}`} />
        <KPICard title="PM 10 (Gruesas)" value={metrics.pm10_ugm3} unit="µg/m³" icon={<Wind className="text-cyan-600" size={28}/>} level={pm10Risk} message={`Umbral: ${thresholds.pm10}`} />
        <KPICard title="Dióxido de Carbono" value={metrics.co2_ppm} unit="ppm" icon={<Activity className="text-orange-500" size={28}/>} level={co2Risk} message={`Umbral: ${thresholds.co2}`} />
        <KPICard title="Temperatura / Hum." value={`${metrics.temperature_c}° / ${metrics.humidity_pct}%`} unit="" icon={<Thermometer className="text-purple-500" size={28}/>} level="normal" message="Condiciones estables" />
      </div>

      <div className="flex flex-col gap-8">
        <div className="w-full bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Monitoreo en Tiempo Real (UTPL)</h2>
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">EN VIVO</span>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                <XAxis dataKey="time" tick={{fontSize: 12, fill: '#6b7280'}} />
                <YAxis yAxisId="left" stroke="#f97316" tick={{fontSize: 12}} />
                <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" tick={{fontSize: 12}} />
                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }}/>
                <Line yAxisId="right" type="monotone" dataKey="pm25" name="PM 2.5" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line yAxisId="left" type="monotone" dataKey="co2" name="CO2" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="w-full bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="text-red-500" size={24} />
            <h2 className="text-xl font-bold text-gray-800">Ubicación del Nodo</h2>
          </div>
          <div className="w-full rounded-2xl overflow-hidden border-2 border-gray-100 relative z-0" style={{ height: '400px' }}>
            <MapContainer center={sensorLocation} zoom={16} style={{ height: '100%', width: '100%' }}>
              <MapResizer />
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
              <Circle center={sensorLocation} radius={250} pathOptions={{ color: getMapRiskColor(pm25Risk), fillColor: getMapRiskColor(pm25Risk), fillOpacity: 0.4 }}>
                <Popup> Estación Activa: Av. del Maestro </Popup>
              </Circle>
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 2. VISTA DE HISTORIAL (CON GRÁFICA NUEVA) ---
function HistoryView() {
  const [historicalData, setHistoricalData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [range, setRange] = useState(24);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/history?range_h=${range}`);
      const data = await response.json();
      setHistoricalData(data);
    } catch (error) { console.error("Error", error); }
    setIsLoading(false);
  };

  useEffect(() => { fetchHistory(); }, [range]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <Database className="text-blue-500" />
            <select 
                value={range} 
                onChange={(e) => setRange(e.target.value)}
                className="bg-gray-50 border border-gray-200 p-2 rounded-lg font-bold text-gray-700 outline-none"
            >
                <option value={12}>Últimas 12 horas</option>
                <option value={24}>Últimas 24 horas</option>
                <option value={48}>Últimos 2 días</option>
                <option value={168}>Última semana</option>
            </select>
        </div>
        <button className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex gap-2"><Download size={20}/> Exportar CSV</button>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
          <h3 className="text-lg font-bold text-gray-700 mb-4">Tendencia del Periodo Seleccionado</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalData}>
                    <defs>
                        <linearGradient id="colorPm" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2}/>
                    <XAxis dataKey="time" hide />
                    <YAxis hide />
                    <RechartsTooltip />
                    <Area type="monotone" dataKey="pm25" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPm)" />
                </AreaChart>
            </ResponsiveContainer>
          </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-400 text-xs font-bold uppercase">
                <tr>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">PM 2.5</th>
                    <th className="p-4">CO2</th>
                    <th className="p-4">Temp</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {historicalData.slice(0, 10).map((r, i) => (
                    <tr key={i} className="text-sm text-gray-600">
                        <td className="p-4 font-medium">{r.time}</td>
                        <td className="p-4">{r.pm25} µg/m³</td>
                        <td className="p-4">{r.co2} ppm</td>
                        <td className="p-4">{r.temp}°C</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}

// --- 3. VISTA DE GESTIÓN DE NODOS ---
function SettingsView({ thresholds, updateThresholds }) {
  const [nodes, setNodes] = useState([]);
  const [editingNode, setEditingNode] = useState(null);
  const [localThresholds, setLocalThresholds] = useState(thresholds);

  const fetchNodes = () => {
    fetch(`${API_BASE_URL}/nodos`)
      .then(res => res.json())
      .then(data => setNodes(data));
  };

  useEffect(() => { fetchNodes(); }, []);

  const handleRestart = async (id) => {
    if (!window.confirm(`¿Reiniciar el nodo ${id}?`)) return;
    try {
        await fetch(`${API_BASE_URL}/nodos/${id}/restart`, { method: 'POST' });
        alert("Comando de reinicio enviado vía MQTT");
    } catch (e) { alert("Error de conexión"); }
  };

  const handleEditSave = async () => {
    try {
        await fetch(`${API_BASE_URL}/nodos/${editingNode.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingNode)
        });
        setNodes(nodes.map(n => n.id === editingNode.id ? editingNode : n));
        setEditingNode(null);
    } catch (e) { alert("Error al guardar"); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
            <h3 className="text-xl font-black text-gray-800">Gestión de Nodos UTPL</h3>
            <button className="bg-blue-500 text-white px-4 py-2 rounded-xl font-bold flex gap-2 items-center"><Plus size={18}/> Nuevo Nodo</button>
        </div>
        
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase">
            <tr>
              <th className="p-6">ID</th>
              <th className="p-6">Ubicación</th>
              <th className="p-6">Estado</th>
              <th className="p-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {nodes.map((node) => (
              <tr key={node.id} className="text-sm">
                <td className="p-6 font-bold">{node.id}</td>
                <td className="p-6">
                    {editingNode?.id === node.id ? (
                        <input className="border p-1 rounded" value={editingNode.ubicacion} onChange={e => setEditingNode({...editingNode, ubicacion: e.target.value})} />
                    ) : node.ubicacion}
                </td>
                <td className="p-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${node.estado === 'Activo' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                        {node.estado}
                    </span>
                </td>
                <td className="p-6 text-right flex justify-end gap-3">
                  {editingNode?.id === node.id ? (
                      <>
                        <button onClick={handleEditSave} className="text-green-600 p-2"><Check size={20}/></button>
                        <button onClick={() => setEditingNode(null)} className="text-red-600 p-2"><X size={20}/></button>
                      </>
                  ) : (
                      <>
                        <button onClick={() => handleRestart(node.id)} className="text-orange-500 p-2" title="Reiniciar"><RotateCw size={20}/></button>
                        <button onClick={() => setEditingNode(node)} className="text-blue-500 p-2" title="Editar"><Edit2 size={20}/></button>
                      </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-md border border-gray-100">
        <h3 className="text-xl font-black text-gray-800 mb-6">Configuración de Alertas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">PM 2.5 Limit (µg/m³)</label>
                <input type="number" className="w-full border p-3 rounded-xl" value={localThresholds.pm25} onChange={e => setLocalThresholds({...localThresholds, pm25: e.target.value})}/>
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">CO2 Limit (ppm)</label>
                <input type="number" className="w-full border p-3 rounded-xl" value={localThresholds.co2} onChange={e => setLocalThresholds({...localThresholds, co2: e.target.value})}/>
            </div>
        </div>
        <button onClick={() => updateThresholds(localThresholds)} className="w-full mt-8 bg-blue-600 text-white py-4 rounded-2xl font-black">
            <Save size={20} className="inline mr-2"/> Guardar Configuración
        </button>
      </div>
    </div>
  );
}

// =========================================================
// LAYOUT PRINCIPAL
// =========================================================
function DashboardUnificado({ thresholds, updateThresholds }) {
  const sensorInfo = useSensorData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();
  const isAdmin = !!localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    setActiveTab('dashboard');
    navigate('/');
  };

  if (!sensorInfo || !sensorInfo.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col justify-between hidden md:flex">
        <div>
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-2xl font-black text-gray-900">SANA<span className="text-blue-600">IoT</span></h1>
            <p className="text-xs text-gray-500 font-bold uppercase mt-1">UTPL - Tesis Farith</p>
          </div>
          
          <nav className="p-4 space-y-2">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
              <LayoutDashboard size={20} /> Dashboard
            </button>
            <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'history' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Database size={20} /> Registros
            </button>
            {isAdmin && (
              <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                <Sliders size={20} /> Nodos
              </button>
            )}
          </nav>
        </div>
        
        <div className="p-4 border-t border-gray-100">
          {isAdmin ? (
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-red-600 hover:bg-red-50">
              <LogOut size={20} /> Salir
            </button>
          ) : (
            <button onClick={() => navigate('/login')} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-gray-600 border border-gray-200">
              <ShieldAlert size={16} /> Admin Login
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-10">
          <h2 className="text-3xl font-black text-gray-800">
            {activeTab === 'dashboard' && 'Calidad del Aire en Tiempo Real'}
            {activeTab === 'history' && 'Historial de Mediciones'}
            {activeTab === 'settings' && 'Panel de Control de Nodos'}
          </h2>
          <p className="text-gray-500 font-medium">Estación: Av. del Maestro (Loja)</p>
        </header>

        {activeTab === 'dashboard' && <DashboardView data={sensorInfo.current} history={sensorInfo.history} thresholds={thresholds} />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'settings' && <SettingsView thresholds={thresholds} updateThresholds={updateThresholds} />}
      </main>
    </div>
  );
}

// --- APP COMPONENT ---
export default function App() {
  const [thresholds, setThresholds] = useState(() => {
    const saved = localStorage.getItem('thresholds');
    return saved ? JSON.parse(saved) : { pm25: 15, pm10: 45, co2: 1000, temp: 30 };
  });

  const updateThresholds = (newT) => {
    setThresholds(newT);
    localStorage.setItem('thresholds', JSON.stringify(newT));
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardUnificado thresholds={thresholds} updateThresholds={updateThresholds} />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
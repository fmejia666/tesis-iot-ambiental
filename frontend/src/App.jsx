import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { 
  Wind, Activity, Thermometer, LayoutDashboard, Database, Download, 
  MapPin, Sliders, Save, LogOut, ShieldAlert, Plus, RotateCw, Edit2, X, Check,
  Battery, Wifi, Trash2 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend, AreaChart, Area 
} from 'recharts';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import { useSensorData } from './useSensorData';
import Login from './Login';

const API_BASE_URL = "https://tesis-iot-ambiental.onrender.com";

// =========================================================
// COMPONENTES DE APOYO (UI)
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
// VISTAS DEL DASHBOARD
// =========================================================

function DashboardView({ data, history, thresholds }) {
  const { metrics } = data;
  const sensorLocation = [-0.1231680, -78.4925269]; 

  const pm25Risk = metrics.pm25_ugm3 > thresholds.pm25 ? 'danger' : (metrics.pm25_ugm3 > (thresholds.pm25 * 0.5) ? 'warning' : 'normal');
  const co2Risk = metrics.co2_ppm > thresholds.co2 ? 'danger' : 'normal';

  const getMapRiskColor = (level) => {
    if (level === 'danger') return '#ef4444';
    if (level === 'warning') return '#eab308';
    return '#22c55e';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="PM 2.5" value={metrics.pm25_ugm3} unit="µg/m³" icon={<Wind className="text-blue-500" />} level={pm25Risk} message={`Umbral: ${thresholds.pm25}`} />
        <KPICard title="Dióxido de Carbono" value={metrics.co2_ppm} unit="ppm" icon={<Activity className="text-orange-500" />} level={co2Risk} message={`Umbral: ${thresholds.co2}`} />
        <KPICard title="Temperatura" value={`${metrics.temperature_c}°`} unit="C" icon={<Thermometer className="text-purple-500" />} level="normal" message="Ambiente controlado" />
        <KPICard title="Humedad" value={`${metrics.humidity_pct}`} unit="%" icon={<Activity className="text-cyan-500" />} level="normal" message="Nivel óptimo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800 tracking-tight">Telemetría en Tiempo Real</h2>
            <span className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span> TRANSMITIENDO
            </span>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="time" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} />
                <RechartsTooltip contentStyle={{ borderRadius: '15px', border: 'none' }} />
                <Legend />
                <Line type="monotone" dataKey="pm25" name="PM 2.5" stroke="#3b82f6" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="co2" name="CO2" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <MapPin size={20} className="text-red-500" /> Georreferenciación
          </h2>
          <div className="h-80 w-full rounded-2xl overflow-hidden z-0">
            <MapContainer center={sensorLocation} zoom={17} style={{ height: '100%', width: '100%' }}>
              <MapResizer />
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
              <Circle center={sensorLocation} radius={100} pathOptions={{ color: getMapRiskColor(pm25Risk), fillColor: getMapRiskColor(pm25Risk), fillOpacity: 0.3 }}>
                <Popup>Estación: Av. del Maestro</Popup>
              </Circle>
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- VISTA DE HISTORIAL (CORREGIDA CON SELECTOR Y TABLA) ---
function HistoryView() {
  const [historicalData, setHistoricalData] = useState([]);
  const [range, setRange] = useState(24);
  const [selectedMetric, setSelectedMetric] = useState('pm25'); // Nuevo: Selector de métrica

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/history?range_h=${range}`);
      const data = await response.json();
      setHistoricalData(data);
    } catch (error) { console.error("Error cargando historial"); }
  };

  useEffect(() => { fetchHistory(); }, [range]);

  // Función para descargar el reporte CSV
  const downloadCSV = () => {
    if (historicalData.length === 0) return alert("No hay datos disponibles");
    const headers = "Fecha_Hora,PM25,CO2,Temperatura,Dispositivo\n";
    const csv = historicalData.map(r => `${r.time},${r.pm25},${r.co2},${r.temp},${r.device}`).join("\n");
    const blob = new Blob([headers + csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HealthIoT_Reporte_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Selector de periodo y métrica */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex flex-wrap justify-between items-center gap-4">
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Database className="text-blue-600" size={18} />
            <select value={range} onChange={(e) => setRange(e.target.value)} className="font-bold text-gray-700 outline-none bg-gray-50 p-2 rounded-lg">
              <option value={12}>Últimas 12h</option>
              <option value={24}>Últimas 24h</option>
              <option value={168}>Última Semana</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Sliders className="text-purple-600" size={18} />
            <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)} className="font-bold text-gray-700 outline-none bg-gray-50 p-2 rounded-lg">
              <option value="pm25">Visualizar PM 2.5</option>
              <option value="co2">Visualizar CO2</option>
              <option value="temp">Visualizar Temp</option>
            </select>
          </div>
        </div>
        <button onClick={downloadCSV} className="bg-green-600 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-100">
          <Download size={18} /> Descargar CSV
        </button>
      </div>

      {/* Gráfica Histórica Dinámica */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <h3 className="text-gray-500 text-sm font-black uppercase mb-4 tracking-widest">
          Tendencia Histórica: {selectedMetric.toUpperCase()}
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historicalData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis tick={{fontSize: 12}} />
              <RechartsTooltip />
              <Area type="monotone" dataKey={selectedMetric} stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla de registros históricos */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <tr>
              <th className="p-6">Timestamp</th>
              <th className="p-6">PM 2.5</th>
              <th className="p-6">CO2</th>
              <th className="p-6">Temperatura</th>
              <th className="p-6">Nodo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {historicalData.slice(0, 50).map((r, i) => (
              <tr key={i} className="text-sm hover:bg-gray-50/50 transition-colors">
                <td className="p-6 text-gray-500">{r.time}</td>
                <td className="p-6 font-bold text-blue-600">{r.pm25} µg/m³</td>
                <td className="p-6 font-bold text-orange-600">{r.co2} ppm</td>
                <td className="p-6 font-bold text-purple-600">{r.temp}°C</td>
                <td className="p-6 text-gray-400">{r.device}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- VISTA DE GESTIÓN ---
function SettingsView({ thresholds, updateThresholds }) {
  const [nodes, setNodes] = useState([]);
  const [editingNode, setEditingNode] = useState(null);

  const fetchNodes = () => {
    fetch(`${API_BASE_URL}/nodos`)
      .then(res => res.json())
      .then(data => setNodes(data));
  };

  useEffect(() => { fetchNodes(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("¿Confirmas la eliminación de este nodo de la red?")) return;
    await fetch(`${API_BASE_URL}/nodos/${id}`, { method: 'DELETE' });
    fetchNodes();
  };

  const handleRestart = async (id) => {
    await fetch(`${API_BASE_URL}/nodos/${id}/restart`, { method: 'POST' });
    alert("Orden de reinicio enviada al hardware vía MQTT.");
  };

  const handleSaveEdit = async () => {
    await fetch(`${API_BASE_URL}/nodos/${editingNode.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingNode)
    });
    setEditingNode(null);
    fetchNodes();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
          <h3 className="text-xl font-black text-gray-800">Infraestructura de Nodos</h3>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2">
            <Plus size={18}/> Nuevo Punto de Monitoreo
          </button>
        </div>
        
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <tr>
              <th className="p-6">Nodo ID</th>
              <th className="p-6">Ubicación</th>
              <th className="p-6">Estado</th>
              <th className="p-6">Energía</th>
              <th className="p-6">Señal</th>
              <th className="p-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {nodes.map((node) => (
              <tr key={node.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="p-6 font-bold text-blue-600">{node.id}</td>
                <td className="p-6">
                  {editingNode?.id === node.id ? (
                    <input className="border p-2 rounded-lg w-full" value={editingNode.ubicacion} onChange={e => setEditingNode({...editingNode, ubicacion: e.target.value})} />
                  ) : <span className="text-gray-600 font-medium">{node.ubicacion}</span>}
                </td>
                <td className="p-6">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${node.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {node.estado}
                  </span>
                </td>
                <td className="p-6">
                  <div className="flex items-center gap-2 text-gray-500 font-bold">
                    <Battery size={16} className={node.bateria < 20 ? 'text-red-500' : 'text-green-500'} />
                    {node.bateria}%
                  </div>
                </td>
                <td className="p-6">
                  <div className="flex items-center gap-2 text-gray-500 font-bold">
                    <Wifi size={16} className="text-blue-400" />
                    {node.rssi} dBm
                  </div>
                </td>
                <td className="p-6 text-right flex justify-end gap-2">
                  {editingNode?.id === node.id ? (
                    <button onClick={handleSaveEdit} className="p-2 bg-green-500 text-white rounded-lg"><Check size={18}/></button>
                  ) : (
                    <>
                      <button onClick={() => handleRestart(node.id)} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg"><RotateCw size={18}/></button>
                      <button onClick={() => setEditingNode(node)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={18}/></button>
                      <button onClick={() => handleDelete(node.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
        <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center gap-2">
          <Sliders className="text-blue-600" /> Parámetros de Alerta
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase">Umbral Crítico PM 2.5</label>
            <input type="number" className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-blue-500 outline-none font-bold" value={thresholds.pm25} onChange={e => updateThresholds({...thresholds, pm25: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase">Límite CO2 (ppm)</label>
            <input type="number" className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-blue-500 outline-none font-bold" value={thresholds.co2} onChange={e => updateThresholds({...thresholds, co2: e.target.value})} />
          </div>
        </div>
        <button onClick={() => alert("Configuración guardada en el sistema")} className="mt-10 w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-lg hover:shadow-blue-200 transition-all">
          ACTUALIZAR POLÍTICAS DE ALERTA
        </button>
      </div>
    </div>
  );
}

// =========================================================
// ESTRUCTURA PRINCIPAL
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-bounce text-blue-600 font-black text-4xl tracking-tighter">HEALTH<span className="text-gray-300">IOT</span></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-72 bg-white border-r border-gray-100 shadow-xl flex flex-col justify-between hidden md:flex">
        <div>
          <div className="p-10">
            <h1 className="text-3xl font-black text-gray-900 tracking-tighter">HEALTH<span className="text-blue-600">IOT</span></h1>
          </div>
          <nav className="px-6 space-y-3">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-400 hover:bg-gray-50'}`}>
              <LayoutDashboard size={22} /> Dashboard
            </button>
            <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-400 hover:bg-gray-50'}`}>
              <Database size={22} /> Historial
            </button>
            {isAdmin && (
              <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-400 hover:bg-gray-50'}`}>
                <Sliders size={22} /> Gestión
              </button>
            )}
          </nav>
        </div>
        <div className="p-8">
          {isAdmin ? (
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-red-500 hover:bg-red-50 transition-all border-2 border-transparent hover:border-red-100">
              <LogOut size={20} /> CERRAR SESIÓN
            </button>
          ) : (
            <button onClick={() => navigate('/login')} className="w-full py-4 rounded-2xl font-black text-gray-400 border-2 border-gray-50 hover:bg-gray-50 flex items-center justify-center gap-2">
              <ShieldAlert size={18} /> ACCESO TÉCNICO
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 p-12 overflow-y-auto">
        <header className="mb-12 flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">
              {activeTab === 'dashboard' && 'Calidad del Aire'}
              {activeTab === 'history' && 'Registros Históricos'}
              {activeTab === 'settings' && 'Control de Infraestructura'}
            </h2>
            <p className="text-blue-600 font-black uppercase text-xs mt-2 tracking-widest">Estación: Av. del Maestro</p>
          </div>
        </header>

        {activeTab === 'dashboard' && <DashboardView data={sensorInfo.current} history={sensorInfo.history} thresholds={thresholds} />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'settings' && <SettingsView thresholds={thresholds} updateThresholds={updateThresholds} />}
      </main>
    </div>
  );
}

export default function App() {
  const [thresholds, setThresholds] = useState(() => {
    const saved = localStorage.getItem('thresholds');
    return saved ? JSON.parse(saved) : { pm25: 15, co2: 1000 };
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
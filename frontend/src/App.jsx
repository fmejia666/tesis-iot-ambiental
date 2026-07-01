import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { 
  Wind, Activity, Thermometer, LayoutDashboard, Database, Download, 
  MapPin, Sliders, LogOut, ShieldAlert, Plus, RotateCw, Edit2, Check,
  Wifi, Trash2, Calendar, Droplets
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import { useSensorData } from './useSensorData';
import Login from './Login';

const API_BASE_URL = "https://tesis-iot-ambiental.onrender.com";

function KPICard({ title, value, unit, icon, level, message }) {
  const styles = {
    danger: "border-red-500 bg-red-50 text-red-700",
    warning: "border-yellow-500 bg-yellow-50 text-yellow-700",
    normal: "border-green-500 bg-green-50 text-green-700"
  };
  return (
    <div className={`p-6 rounded-2xl border-t-8 shadow-lg bg-white ${styles[level] || 'border-gray-200'}`}>
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
  useEffect(() => { setTimeout(() => { map.invalidateSize(); }, 300); }, [map]);
  return null;
}

function DashboardView({ data, history, thresholds }) {
  const { metrics } = data;
  const sensorLocation = [-0.1231680, -78.4925269]; 
  const pm25 = metrics.pm25 ?? 0;
  const pm10 = metrics.pm10 ?? 0;
  const co2 = metrics.co2 ?? 0;
  const temp = metrics.temp ?? 0;
  const hum = metrics.hum ?? 0;

  const pm25Risk = pm25 > thresholds.pm25 ? 'danger' : (pm25 > (thresholds.pm25 * 0.5) ? 'warning' : 'normal');
  const pm10Risk = pm10 > thresholds.pm10 ? 'danger' : (pm10 > (thresholds.pm10 * 0.5) ? 'warning' : 'normal');
  const co2Risk = co2 > thresholds.co2 ? 'danger' : 'normal';

  const getMapRiskColor = (level) => level === 'danger' ? '#ef4444' : (level === 'warning' ? '#eab308' : '#22c55e');

  const metricasGraficos = [
    { key: 'pm25', name: 'Partículas PM 2.5', color: '#3b82f6' },
    { key: 'pm10', name: 'Partículas PM 10', color: '#64748b' },
    { key: 'co2', name: 'Dióxido de Carbono (CO2)', color: '#f97316' },
    { key: 'temp', name: 'Temperatura', color: '#a855f7' },
    { key: 'hum', name: 'Humedad Relativa', color: '#06b6d4' }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6">
        <KPICard title="PM 2.5" value={Number(pm25).toFixed(1)} unit="µg/m³" icon={<Wind className="text-blue-500" />} level={pm25Risk} message={`Umbral: ${thresholds.pm25}`} />
        <KPICard title="PM 10" value={Number(pm10).toFixed(1)} unit="µg/m³" icon={<Wind className="text-gray-500" />} level={pm10Risk} message={`Umbral: ${thresholds.pm10}`} />
        <KPICard title="CO2" value={Number(co2).toFixed(1)} unit="ppm" icon={<Activity className="text-orange-500" />} level={co2Risk} message={`Umbral: ${thresholds.co2}`} />
        <KPICard title="Temperatura" value={Number(temp).toFixed(1)} unit="°C" icon={<Thermometer className="text-purple-500" />} level="normal" />
        <KPICard title="Humedad" value={Number(hum).toFixed(1)} unit="%" icon={<Droplets className="text-cyan-500" />} level="normal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-6">
          {metricasGraficos.map((grafico) => (
            <div key={grafico.key} className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-4">{grafico.name}</h2>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="time" hide />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} width={40} />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey={grafico.key} stroke={grafico.color} strokeWidth={3} dot={false} connectNulls={true} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 sticky top-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Georreferenciación</h2>
          <div className="h-80 w-full rounded-2xl overflow-hidden">
            <MapContainer center={sensorLocation} zoom={17} style={{ height: '100%', width: '100%' }}>
              <MapResizer />
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
              <Circle center={sensorLocation} radius={100} pathOptions={{ color: getMapRiskColor(pm25Risk), fillOpacity: 0.3 }} />
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ thresholds, updateThresholds }) {
  const [localThresh, setLocalThresh] = useState(thresholds);
  useEffect(() => { setLocalThresh(thresholds); }, [thresholds]);

  const handleSave = () => {
    updateThresholds({
      pm25: Number(localThresh.pm25),
      pm10: Number(localThresh.pm10),
      co2: Number(localThresh.co2)
    });
  };

  return (
    <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
      <h3 className="text-xl font-black text-gray-800 mb-8">Parámetros de Alerta Globales</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase">Umbral PM 2.5</label>
          <input type="number" className="w-full border-2 border-gray-100 p-4 rounded-2xl font-bold" 
                 value={localThresh.pm25} onChange={e => setLocalThresh({...localThresh, pm25: e.target.value})} />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase">Umbral PM 10</label>
          <input type="number" className="w-full border-2 border-gray-100 p-4 rounded-2xl font-bold" 
                 value={localThresh.pm10} onChange={e => setLocalThresh({...localThresh, pm10: e.target.value})} />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase">Límite CO2</label>
          <input type="number" className="w-full border-2 border-gray-100 p-4 rounded-2xl font-bold" 
                 value={localThresh.co2} onChange={e => setLocalThresh({...localThresh, co2: e.target.value})} />
        </div>
      </div>
      <button onClick={handleSave} className="mt-10 w-full bg-blue-600 text-white py-5 rounded-2xl font-black hover:bg-blue-700">GUARDAR POLÍTICAS</button>
    </div>
  );
}

export default function App() {
  const [thresholds, setThresholds] = useState({ pm25: 15, pm10: 50, co2: 1000 });
  const [activeTab, setActiveTab] = useState('dashboard');
  const sensorInfo = useSensorData();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/configuracion`)
      .then(res => res.json())
      .then(data => { if(data.umbral_pm25) setThresholds({ pm25: data.umbral_pm25, pm10: data.umbral_pm10, co2: data.limite_co2 }); })
      .catch(err => console.error("Error", err));
  }, []);

  const updateThresholds = async (newT) => {
    try {
      await fetch(`${API_BASE_URL}/api/configuracion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newT)
      });
      setThresholds(newT);
      alert("¡Configuración guardada!");
    } catch(e) { console.error(e); }
  };

  if (!sensorInfo || !sensorInfo.current) return <div className="min-h-screen flex items-center justify-center font-black text-2xl">CARGANDO...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-72 bg-white border-r p-10 flex flex-col justify-between hidden md:flex">
        <div className="space-y-10">
          <h1 className="text-2xl font-black">HEALTH<span className="text-blue-600">IOT</span></h1>
          <nav className="space-y-4">
            <button onClick={() => setActiveTab('dashboard')} className="w-full text-left font-bold text-gray-500">Dashboard</button>
            <button onClick={() => setActiveTab('history')} className="w-full text-left font-bold text-gray-500">Historial</button>
            <button onClick={() => setActiveTab('settings')} className="w-full text-left font-bold text-gray-500">Gestión</button>
          </nav>
        </div>
      </aside>
      <main className="flex-1 p-12 overflow-y-auto">
        {activeTab === 'dashboard' && <DashboardView data={sensorInfo.current} history={sensorInfo.history} thresholds={thresholds} />}
        {activeTab === 'settings' && <SettingsView thresholds={thresholds} updateThresholds={updateThresholds} />}
      </main>
    </div>
  );
}
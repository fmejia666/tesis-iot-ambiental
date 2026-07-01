import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { 
  Wind, Activity, Thermometer, Database, Download, 
  MapPin, Sliders, LogOut, ShieldAlert, Plus, RotateCw, Edit2, Check,
  Wifi, Trash2, Calendar, Droplets, LayoutDashboard
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from 'recharts';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import { useSensorData } from './useSensorData';
import Login from './Login';

const API_BASE_URL = "https://tesis-iot-ambiental.onrender.com";

function KPICard({ title, value, unit, icon, level }) {
  const styles = {
    danger: "border-red-500 bg-red-50 text-red-700",
    warning: "border-yellow-500 bg-yellow-50 text-yellow-700",
    normal: "border-green-500 bg-green-50 text-green-700"
  };
  return (
    <div className={`p-4 rounded-2xl border-t-4 shadow-sm bg-white ${styles[level] || 'border-gray-200'}`}>
      <p className="text-[10px] font-bold text-gray-500 uppercase">{title}</p>
      <div className="flex justify-between items-center mt-2">
        <h3 className="text-2xl font-black">{value} <span className="text-xs font-medium">{unit}</span></h3>
        {icon}
      </div>
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

  const getRisk = (val, limit) => val > limit ? 'danger' : (val > limit * 0.7 ? 'warning' : 'normal');

  const metricasGraficos = [
    { key: 'pm25', name: 'PM 2.5', color: '#3b82f6' },
    { key: 'pm10', name: 'PM 10', color: '#64748b' },
    { key: 'co2', name: 'CO2', color: '#f97316' },
    { key: 'temp', name: 'Temp', color: '#a855f7' },
    { key: 'hum', name: 'Humedad', color: '#06b6d4' }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard title="PM 2.5" value={Number(pm25).toFixed(1)} unit="µg/m³" icon={<Wind size={16}/>} level={getRisk(pm25, thresholds.pm25)} />
        <KPICard title="PM 10" value={Number(pm10).toFixed(1)} unit="µg/m³" icon={<Wind size={16}/>} level={getRisk(pm10, thresholds.pm10)} />
        <KPICard title="CO2" value={Number(co2).toFixed(1)} unit="ppm" icon={<Activity size={16}/>} level={getRisk(co2, thresholds.co2)} />
        <KPICard title="Temp" value={Number(temp).toFixed(1)} unit="°C" icon={<Thermometer size={16}/>} level="normal" />
        <KPICard title="Humedad" value={Number(hum).toFixed(1)} unit="%" icon={<Droplets size={16}/>} level="normal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          {metricasGraficos.map((g) => (
            <div key={g.key} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-bold text-gray-700 mb-2">{g.name}</h2>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="time" hide />
                    <YAxis tick={{fontSize: 9}} width={30} domain={['auto', 'auto']} />
                    <Line type="monotone" dataKey={g.key} stroke={g.color} strokeWidth={2} dot={false} connectNulls={true} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 sticky top-4">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Ubicación: Av. Maestro</h2>
          <div className="h-64 w-full rounded-xl overflow-hidden">
            <MapContainer center={sensorLocation} zoom={17} style={{ height: '100%', width: '100%' }}>
              <MapResizer /><TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
              <Circle center={sensorLocation} radius={50} pathOptions={{ color: '#3b82f6' }} />
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ thresholds }) {
  const [data, setData] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchHistory = async () => {
    try {
      const url = `${API_BASE_URL}/api/history${startDate ? `?start_date=${startDate}&end_date=${endDate}` : ''}`;
      const res = await fetch(url);
      setData(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchHistory(); }, [startDate, endDate]);

  const downloadCSV = () => {
    const headers = "Fecha,PM25,PM10,CO2,Temp,Hum\n";
    const csv = data.map(r => `${r.time},${r.pm25},${r.pm10},${r.co2},${r.temp},${r.hum}`).join("\n");
    const blob = new Blob([headers + csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'reporte_historico.csv'; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-2">
        <input type="date" className="p-2 border rounded-lg text-sm" onChange={e => setStartDate(e.target.value)} />
        <input type="date" className="p-2 border rounded-lg text-sm" onChange={e => setEndDate(e.target.value)} />
        <button onClick={downloadCSV} className="bg-green-600 text-white px-6 py-3 rounded-lg text-sm font-bold flex items-center gap-2"><Download size={16}/> Descargar CSV</button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-50 uppercase">
            <tr><th className="p-3">Fecha</th><th className="p-3">PM2.5</th><th className="p-3">PM10</th><th className="p-3">CO2</th><th className="p-3">Temp</th><th className="p-3">Hum</th></tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-3">{r.time}</td><td className="p-3">{r.pm25}</td><td className="p-3">{r.pm10}</td><td className="p-3">{r.co2}</td><td className="p-3">{r.temp}°</td><td className="p-3">{r.hum}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsView({ thresholds, updateThresholds }) {
  const [local, setLocal] = useState(thresholds);
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border">
      <h3 className="font-bold text-lg mb-4">Configuración de Alertas</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <input type="number" placeholder="PM 2.5" className="p-3 border rounded-xl" value={local.pm25} onChange={e => setLocal({...local, pm25: e.target.value})}/>
         <input type="number" placeholder="PM 10" className="p-3 border rounded-xl" value={local.pm10} onChange={e => setLocal({...local, pm10: e.target.value})}/>
         <input type="number" placeholder="CO2" className="p-3 border rounded-xl" value={local.co2} onChange={e => setLocal({...local, co2: e.target.value})}/>
      </div>
      <button onClick={() => updateThresholds(local)} className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">Guardar Cambios</button>
    </div>
  );
}

export default function App() {
  const [thresholds, setThresholds] = useState({ pm25: 15, pm10: 50, co2: 1000 });
  const [activeTab, setActiveTab] = useState('dashboard');
  const sensorInfo = useSensorData();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/configuracion`)
      .then(res => res.json())
      .then(data => { 
        if(data.umbral_pm25) setThresholds({ pm25: data.umbral_pm25, pm10: data.umbral_pm10, co2: data.limite_co2 }); 
      })
      .catch(err => console.error("Error al cargar config", err));
  }, []);

  const updateThresholds = async (newT) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/configuracion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ umbral_pm25: Number(newT.pm25), umbral_pm10: Number(newT.pm10), limite_co2: Number(newT.co2) })
      });
      if(res.ok) {
        setThresholds(newT);
        alert("Guardado!");
      } else {
        alert("Error al guardar");
      }
    } catch(e) { console.error(e); }
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex">
        <aside className="w-64 bg-white border-r p-6 flex flex-col gap-8">
          <h1 className="text-xl font-black">HEALTH<span className="text-blue-600">IOT</span></h1>
          <nav className="flex flex-col gap-2">
            <button onClick={() => setActiveTab('dashboard')} className="p-3 rounded-lg hover:bg-gray-100 font-bold">Dashboard</button>
            <button onClick={() => setActiveTab('history')} className="p-3 rounded-lg hover:bg-gray-100 font-bold">Historial</button>
            <button onClick={() => setActiveTab('settings')} className="p-3 rounded-lg hover:bg-gray-100 font-bold">Gestión</button>
          </nav>
        </aside>
        <main className="flex-1 p-8">
           {activeTab === 'dashboard' && <DashboardView data={sensorInfo.current} history={sensorInfo.history} thresholds={thresholds} />}
           {activeTab === 'history' && <HistoryView thresholds={thresholds} />}
           {activeTab === 'settings' && <SettingsView thresholds={thresholds} updateThresholds={updateThresholds} />}
        </main>
      </div>
    </BrowserRouter>
  );
}
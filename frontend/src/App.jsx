import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { 
  Wind, Activity, Thermometer, LayoutDashboard, Database, Download, 
  MapPin, Sliders, LogOut, ShieldAlert, Plus, RotateCw, Edit2, Check,
  Wifi, Trash2, Calendar
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import { useSensorData } from './useSensorData';
import Login from './Login';

const API_BASE_URL = "https://tesis-iot-ambiental.onrender.com";

// --- FUNCIÓN AUXILIAR PARA SEGURIDAD JWT ---
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

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

function DashboardView({ data, history, thresholds }) {
  const { metrics } = data;
  const sensorLocation = [-0.1231680, -78.4925269]; 

  const pm25 = metrics.pm25 ?? metrics.pm25_ugm3 ?? 0;
  const pm10 = metrics.pm10 ?? metrics.pm10_ugm3 ?? 0;
  const co2 = metrics.co2 ?? metrics.co2_ppm ?? 0;
  const temp = metrics.temp ?? metrics.temperature_c ?? 0;
  const hum = metrics.hum ?? metrics.humidity_pct ?? 0;

  const pm25Risk = pm25 > thresholds.pm25 ? 'danger' : (pm25 > (thresholds.pm25 * 0.5) ? 'warning' : 'normal');
  const pm10Risk = pm10 > thresholds.pm10 ? 'danger' : (pm10 > (thresholds.pm10 * 0.5) ? 'warning' : 'normal');
  const co2Risk = co2 > thresholds.co2 ? 'danger' : 'normal';

  const getMapRiskColor = (level) => {
    if (level === 'danger') return '#ef4444';
    if (level === 'warning') return '#eab308';
    return '#22c55e';
  };


  const metricasGraficos = [
    { key: 'pm25', name: 'Partículas PM 2.5', color: '#3b82f6' },
    { key: 'pm10', name: 'Partículas PM 10', color: '#64748b' },
    { key: 'co2', name: 'Dióxido de Carbono (CO2)', color: '#f97316' },
    { key: 'temp', name: 'Temperatura', color: '#a855f7' }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6">
        <KPICard title="PM 2.5" value={Number(pm25).toFixed(1)} unit="µg/m³" icon={<Wind className="text-blue-500" />} level={pm25Risk} message={`Umbral: ${thresholds.pm25}`} />
        <KPICard title="PM 10" value={Number(pm10).toFixed(1)} unit="µg/m³" icon={<Wind className="text-gray-500" />} level={pm10Risk} message={`Umbral: ${thresholds.pm10}`} />
        <KPICard title="Dióxido de Carbono" value={Number(co2).toFixed(1)} unit="ppm" icon={<Activity className="text-orange-500" />} level={co2Risk} message={`Umbral: ${thresholds.co2}`} />
        <KPICard title="Temperatura" value={Number(temp).toFixed(1)} unit="°C" icon={<Thermometer className="text-purple-500" />} level="normal" message="Ambiente controlado" />
        <KPICard title="Humedad" value={Number(hum).toFixed(1)} unit="%" icon={<Activity className="text-cyan-500" />} level="normal" message="Nivel óptimo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-6">
          {metricasGraficos.map((grafico) => (
            <div key={grafico.key} className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800 tracking-tight">{grafico.name}</h2>
                <span className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold animate-pulse">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span> EN VIVO
                </span>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="time" hide />
                    <YAxis tick={{fontSize: 10}} width={40} />
                    <RechartsTooltip contentStyle={{ borderRadius: '15px', border: 'none' }} />
                    <Line type="monotone" dataKey={grafico.key} name={grafico.name} stroke={grafico.color} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 overflow-hidden sticky top-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <MapPin size={20} className="text-red-500" /> Georreferenciación
          </h2>
          <div className="h-80 w-full rounded-2xl overflow-hidden z-0">
            <MapContainer center={sensorLocation} zoom={17} style={{ height: '100%', width: '100%' }}>
              <MapResizer />
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
              <Circle center={sensorLocation} radius={100} pathOptions={{ color: getMapRiskColor(pm25Risk), fillColor: getMapRiskColor(pm25Risk), fillOpacity: 0.3 }}>
                <Popup>Estación Activa: NODE-001</Popup>
              </Circle>
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ thresholds }) {
  const [historicalData, setHistoricalData] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMetric, setSelectedMetric] = useState('pm25');

  const fetchHistory = async () => {
    try {
      let url = `${API_BASE_URL}/api/history`;
      if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
      } else {
        url += `?range_h=24h`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setHistoricalData(data);
    } catch (error) { 
      console.error("Error cargando historial", error); 
    }
  };

  useEffect(() => { fetchHistory(); }, [startDate, endDate]);

  const evaluarRiesgoPM25 = (val) => {
    if (val > thresholds.pm25) return 'CRITICO (Excede OMS)';
    if (val > thresholds.pm25 * 0.5) return 'PRECAUCION (Moderado)';
    return 'OPTIMO (Seguro)';
  };

  const evaluarRiesgoPM10 = (val) => {
    if (val > thresholds.pm10) return 'CRITICO (Excede OMS)';
    if (val > thresholds.pm10 * 0.5) return 'PRECAUCION (Moderado)';
    return 'OPTIMO (Seguro)';
  };

  const evaluarRiesgoCO2 = (val) => {
    if (val > thresholds.co2) return 'CRITICO (Ambiente Confinado)';
    return 'OPTIMO (Ventilado)';
  };

  const downloadCSV = () => {
    if (historicalData.length === 0) return alert("No hay datos disponibles para exportar");
    
    const headers = "Fecha_Hora,PM25_ugm3,Rango_Peligro_PM25,PM10_ugm3,Rango_Peligro_PM10,CO2_ppm,Rango_Peligro_CO2,Temperatura_C,Humedad_Pct,Nodo_Emisor\n";
    
    const csv = historicalData.map(r => {
      const pm25_val = r.pm25 ?? 0;
      const pm10_val = r.pm10 ?? 0;
      const co2_val = r.co2 ?? 0;
      return `${r.time},${pm25_val},${evaluarRiesgoPM25(pm25_val)},${pm10_val},${evaluarRiesgoPM10(pm10_val)},${co2_val},${evaluarRiesgoCO2(co2_val)},${r.temp ?? 0},${r.hum ?? 0},${r.device || 'NODE-001'}`;
    }).join("\n");
    
    const blob = new Blob([headers + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HealthIoT_Reporte_Clinico_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap gap-4 items-center">
          
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
            <Calendar className="text-blue-600" size={16} />
            <span className="text-xs font-bold text-gray-500 uppercase">Desde:</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent font-bold text-gray-700 outline-none text-sm cursor-pointer" />
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
            <Calendar className="text-blue-600" size={16} />
            <span className="text-xs font-bold text-gray-500 uppercase">Hasta:</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent font-bold text-gray-700 outline-none text-sm cursor-pointer" />
          </div>

          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
            <Sliders className="text-purple-600" size={16} />
            <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)} className="font-bold text-gray-700 outline-none bg-transparent text-sm cursor-pointer">
              <option value="pm25">Métrica: PM 2.5</option>
              <option value="pm10">Métrica: PM 10</option>
              <option value="co2">Métrica: CO2</option>
              <option value="temp">Métrica: Temp</option>
            </select>
          </div>
        </div>
        <button onClick={downloadCSV} className="bg-green-600 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-100 hover:bg-green-700 transition-colors">
          <Download size={18} /> Exportar Reporte
        </button>
      </div>

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

      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <tr>
              <th className="p-6">Timestamp</th>
              <th className="p-6">PM 2.5</th>
              <th className="p-6">PM 10</th>
              <th className="p-6">CO2</th>
              <th className="p-6">Temperatura</th>
              <th className="p-6">Humedad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {historicalData.slice(0, 50).map((r, i) => (
              <tr key={i} className="text-sm hover:bg-gray-50/50 transition-colors">
                <td className="p-6 text-gray-500">{r.time}</td>
                <td className="p-6 font-bold text-blue-600">{Number(r.pm25).toFixed(1)} µg/m³</td>
                <td className="p-6 font-bold text-gray-600">{Number(r.pm10).toFixed(1)} µg/m³</td>
                <td className="p-6 font-bold text-orange-600">{Number(r.co2).toFixed(0)} ppm</td>
                <td className="p-6 font-bold text-purple-600">{Number(r.temp).toFixed(1)}°C</td>
                <td className="p-6 font-bold text-cyan-600">{Number(r.hum).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsView({ thresholds, updateThresholds }) {
  const [nodes, setNodes] = useState([]);
  const [editingNode, setEditingNode] = useState(null);
  const [localThresh, setLocalThresh] = useState(thresholds);

  useEffect(() => { setLocalThresh(thresholds); }, [thresholds]);

  const fetchNodes = () => {
    fetch(`${API_BASE_URL}/nodos`)
      .then(res => res.json())
      .then(data => {

        setNodes(data);
      });
  };

  useEffect(() => { fetchNodes(); }, []);

  const handleAddNode = async () => {
    const id = window.prompt("Ingrese el ID del nuevo nodo (ej. NODE-001):");
    if (!id) return;
    const ubicacion = window.prompt("Ingrese la ubicación del nodo:");
    if (!ubicacion) return;
    
    const lat = window.prompt("Ingrese la Latitud (ej. -0.123):");
    const lng = window.prompt("Ingrese la Longitud (ej. -78.492):");

    try {
      const res = await fetch(`${API_BASE_URL}/nodos`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          id, 
          ubicacion, 
          estado: 'Activo', 
          rssi: -50,
          latitud: parseFloat(lat) || 0,
          longitud: parseFloat(lng) || 0 
        })
      });
      if (res.ok) {
        alert("Nodo registrado exitosamente en MongoDB");
        fetchNodes();
      } else {
        const error = await res.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Confirmas la eliminación de este nodo de la red?")) return;
    await fetch(`${API_BASE_URL}/nodos/${id}`, { 
      method: 'DELETE',
      headers: getAuthHeaders() 
    });
    fetchNodes();
  };

  const handleRestart = async (id) => {
    await fetch(`${API_BASE_URL}/nodos/${id}/restart`, { 
      method: 'POST',
      headers: getAuthHeaders()
    });
    alert("Orden de reinicio enviada al hardware vía MQTT.");
  };

  const handleSaveEdit = async () => {
    await fetch(`${API_BASE_URL}/nodos/${editingNode.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
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
          <button onClick={handleAddNode} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors">
            <Plus size={18}/> Nuevo Punto de Monitoreo
          </button>
        </div>
        
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <tr>
              <th className="p-6">Nodo ID</th>
              <th className="p-6">Ubicación y Coordenadas</th>
              <th className="p-6">Estado</th>
              <th className="p-6">Señal</th>
              <th className="p-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {nodes.length === 0 && (
              <tr><td colSpan="5" className="p-6 text-center text-gray-400 font-bold">No hay nodos registrados en MongoDB. Haz clic en 'Nuevo Punto de Monitoreo'.</td></tr>
            )}
            {nodes.map((node) => (
              <tr key={node.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="p-6 font-bold text-blue-600">{node.id}</td>
                <td className="p-6">
                  {editingNode?.id === node.id ? (
                    <div className="space-y-2">
                      <input className="border p-2 rounded-lg w-full text-sm" placeholder="Ubicación" value={editingNode.ubicacion} onChange={e => setEditingNode({...editingNode, ubicacion: e.target.value})} />
                      <div className="flex gap-2">
                        <input type="number" className="border p-2 rounded-lg w-1/2 text-sm" placeholder="Latitud" value={editingNode.latitud} onChange={e => setEditingNode({...editingNode, latitud: parseFloat(e.target.value)})} />
                        <input type="number" className="border p-2 rounded-lg w-1/2 text-sm" placeholder="Longitud" value={editingNode.longitud} onChange={e => setEditingNode({...editingNode, longitud: parseFloat(e.target.value)})} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-gray-800 font-bold block">{node.ubicacion}</span>
                      <span className="text-gray-400 text-xs font-mono">{node.latitud}, {node.longitud}</span>
                    </div>
                  )}
                </td>
                <td className="p-6">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${node.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {node.estado}
                  </span>
                </td>
                <td className="p-6">
                  <div className="flex items-center gap-2 text-gray-500 font-bold">
                    <Wifi size={16} className="text-blue-400" />
                    {node.rssi} dBm
                  </div>
                </td>
                <td className="p-6 text-right flex justify-end gap-2 items-center h-full pt-8">
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
          <Sliders className="text-blue-600" /> Parámetros de Alerta Globales
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase">Umbral Crítico PM 2.5</label>
            <input type="number" className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-blue-500 outline-none font-bold" 
                   value={localThresh.pm25} onChange={e => setLocalThresh({...localThresh, pm25: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase">Umbral Crítico PM 10</label>
            <input type="number" className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-blue-500 outline-none font-bold" 
                   value={localThresh.pm10} onChange={e => setLocalThresh({...localThresh, pm10: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase">Límite CO2 (ppm)</label>
            <input type="number" className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-blue-500 outline-none font-bold" 
                   value={localThresh.co2} onChange={e => setLocalThresh({...localThresh, co2: e.target.value})} />
          </div>
        </div>
        
        <button onClick={() => updateThresholds(localThresh)} className="mt-10 w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-lg hover:shadow-blue-200 transition-all">
          ACTUALIZAR POLÍTICAS DE ALERTA PARA TODO EL SISTEMA
        </button>
      </div>
    </div>
  );
}

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
            <p className="text-blue-600 font-black uppercase text-xs mt-2 tracking-widest">Estación Activa: NODE-001</p>
          </div>
        </header>

        {activeTab === 'dashboard' && <DashboardView data={sensorInfo.current} history={sensorInfo.history} thresholds={thresholds} />}
        {activeTab === 'history' && <HistoryView thresholds={thresholds} />}
        {activeTab === 'settings' && <SettingsView thresholds={thresholds} updateThresholds={updateThresholds} />}
      </main>
    </div>
  );
}

export default function App() {
  const [thresholds, setThresholds] = useState({ pm25: 15, pm10: 50, co2: 1000 });

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/configuracion`)
      .then(res => res.json())
      .then(data => {
        if(data.umbral_pm25) {
          setThresholds({ 
            pm25: data.umbral_pm25, 
            pm10: data.umbral_pm10 || 50, 
            co2: data.limite_co2 
          });
        }
      })
      .catch(err => console.error("Error al cargar configuración", err));
  }, []);


  const updateThresholds = async (newT) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/configuracion`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          umbral_pm25: Number(newT.pm25), 
          umbral_pm10: Number(newT.pm10),
          limite_co2: Number(newT.co2) 
        })
      });
      
      if (res.ok) {
        setThresholds(newT);
        alert("¡Parámetros guardados exitosamente en la Base de Datos!");
      } else {
        const err = await res.json();
        alert(`Error del Servidor: ${err.detail || 'Fallo de autorización o token inválido'}`);
      }
    } catch(e) { 
      console.error("Error de conexión", e);
      alert("Error de conexión con el backend. ¿Se desplegaron los últimos cambios en Render?");
    }
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
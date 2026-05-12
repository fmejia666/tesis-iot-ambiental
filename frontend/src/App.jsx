import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { Wind, Activity, Thermometer, LayoutDashboard, Database, Download, MapPin, Sliders, Save, LogOut, ShieldAlert, Plus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import { useSensorData } from './useSensorData';
import Login from './Login';

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
function DashboardView({ data, history, thresholds }) {
  const { metrics } = data;
  const sensorLocation = [-0.123167, -78.492528]; // Coordenadas de San Antonio

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
            <h2 className="text-xl font-bold text-gray-800">Comportamiento Respiratorio (Real-Time)</h2>
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
                <Line yAxisId="right" type="monotone" dataKey="pm10" name="PM 10" stroke="#0891b2" strokeWidth={3} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="co2" name="CO2" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="w-full bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="text-red-500" size={24} />
            <h2 className="text-xl font-bold text-gray-800">Ubicación del Nodo y Área de Exposición</h2>
          </div>
          <div className="w-full rounded-2xl overflow-hidden border-2 border-gray-100 relative z-0" style={{ height: '400px' }}>
            <MapContainer center={sensorLocation} zoom={16} style={{ height: '100%', width: '100%' }}>
              <MapResizer />
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
              <Circle center={sensorLocation} radius={250} pathOptions={{ color: getMapRiskColor(pm25Risk), fillColor: getMapRiskColor(pm25Risk), fillOpacity: 0.4 }}>
                <Popup>
                  <div className="text-center">
                    <strong className="block text-gray-800">Estación Av. del Maestro</strong>
                    <span className="text-xs text-gray-500 mt-1 block">Riesgo PM2.5: <b>{pm25Risk.toUpperCase()}</b></span>
                  </div>
                </Popup>
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
  const [isLoading, setIsLoading] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`https://tesis-iot-ambiental.onrender.com/api/history?start_date=${startDate}&end_date=${endDate}`).catch(() => ({ json: () => [] }));
      const data = await response.json();
      setHistoricalData(data);
    } catch (error) { console.error("Error obteniendo historial", error); }
    setIsLoading(false);
  };

  useEffect(() => { fetchHistory(); }, []);

  const downloadCSV = () => {
    const headers = "Fecha_Hora,PM2.5,PM10,CO2,Temperatura\n";
    const rows = historicalData.map(r => `${r.time},${r.pm25},${r.pm10},${r.co2},${r.temp}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `Reporte_Aire_${startDate}_al_${endDate}.csv`; a.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex gap-4 w-full md:w-auto">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-gray-50 border p-2 rounded-lg flex-1" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-gray-50 border p-2 rounded-lg flex-1" />
          <button onClick={fetchHistory} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-colors">Filtrar</button>
        </div>
        <button onClick={downloadCSV} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex gap-2 w-full md:w-auto justify-center transition-colors"><Download size={20}/> CSV</button>
      </div>
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 text-center text-gray-500 font-bold">
        {isLoading ? <p>Cargando datos...</p> : <p>Los datos históricos aparecerán aquí tras realizar la búsqueda.</p>}
      </div>
    </div>
  );
}

function SettingsView({ thresholds, updateThresholds }) {
  const [local, setLocal] = useState(thresholds);
  const [saved, setSaved] = useState(false);

  const nodes = [
    { id: 'NODE-001', location: 'Av. del Maestro', status: 'Online' },
    { id: 'NODE-002', location: 'Plaza Central', status: 'Online' },
    { id: 'NODE-003', location: 'Industrial Zone B', status: 'Offline' }
  ];

  const handleSave = () => {
    updateThresholds(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const ThresholdCard = ({ title, value, onChange, unit, helperText }) => (
    <div className="border border-gray-100 rounded-2xl p-5 mb-5 shadow-sm bg-white">
      <label className="font-bold text-gray-700 text-sm block mb-3">{title}</label>
      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#0ea5e9] focus-within:ring-1 focus-within:ring-[#0ea5e9] transition-all">
        <input 
          type="number" 
          value={value} 
          onChange={onChange} 
          className="flex-1 p-4 outline-none text-xl font-medium text-gray-800" 
        />
        <span className="bg-gray-50 text-gray-500 font-bold px-5 py-4 border-l border-gray-200 flex items-center h-full">
          {unit}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-3 font-medium">{helperText}</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-10">
      
      {/* GESTIÓN DE NODOS */}
      <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-xl font-black text-gray-800">Deployed Nodes</h3>
            <p className="text-sm text-gray-500 font-medium mt-1">Manage and monitor active hardware nodes in the field.</p>
          </div>
          <button className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm w-full md:w-auto justify-center">
            <Plus size={20} /> Register New Node
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="p-4 md:p-6 text-xs font-bold uppercase tracking-wider text-gray-400">NODE ID</th>
                <th className="p-4 md:p-6 text-xs font-bold uppercase tracking-wider text-gray-400">LOCATION</th>
                <th className="p-4 md:p-6 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">CONNECTION STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {nodes.map((node, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 md:p-6 font-bold text-gray-800 text-sm">{node.id}</td>
                  <td className="p-4 md:p-6 text-gray-600 text-sm font-medium">{node.location}</td>
                  <td className="p-4 md:p-6 text-right">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${
                      node.status === 'Online' 
                        ? 'border-green-200 bg-green-50 text-green-600' 
                        : 'border-red-200 bg-red-50 text-red-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'Online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      {node.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* UMBRALES GLOBALES DE ALERTA */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-md border border-gray-100">
        <h3 className="text-xl font-black text-gray-800 mb-6">Global Alert Thresholds (WHO Standards)</h3>
        
        <div className="space-y-2">
          <ThresholdCard 
            title="PM2.5 Warning Limit (PMS5003)"
            value={local.pm25}
            onChange={(e) => setLocal({...local, pm25: Number(e.target.value)})}
            unit="µg/m³"
            helperText="WHO 24-hour mean guideline is 15 µg/m³."
          />

          <ThresholdCard 
            title="PM10 Warning Limit (PMS5003)"
            value={local.pm10}
            onChange={(e) => setLocal({...local, pm10: Number(e.target.value)})}
            unit="µg/m³"
            helperText="WHO 24-hour mean guideline is 45 µg/m³."
          />

          <ThresholdCard 
            title="CO2 Warning Limit (MH-Z19C)"
            value={local.co2}
            onChange={(e) => setLocal({...local, co2: Number(e.target.value)})}
            unit="ppm"
            helperText="Typical indoor baseline is 400-1000 ppm. Alerts indicate inadequate ventilation."
          />
          
          <ThresholdCard 
            title="Temp Warning Limit (DHT22)"
            value={local.temp || 30} 
            onChange={(e) => setLocal({...local, temp: Number(e.target.value)})}
            unit="°C"
            helperText="Alerts when ambient temperature exceeds maximum comfort limits."
          />
        </div>

        <button 
          onClick={handleSave} 
          className="mt-8 w-full flex justify-center items-center gap-2 bg-[#0ea5e9] hover:bg-[#0284c7] text-white py-4 rounded-xl font-black transition-all shadow-md text-lg"
        >
          <Save size={20} /> Save Configuration
        </button>

        {saved && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-center font-bold text-sm animate-pulse flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Configuration updated successfully.
          </div>
        )}
      </div>

    </div>
  );
}

// =========================================================
// DASHBOARD UNIFICADO (Público + Admin Condicional)
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0ea5e9]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex animate-fade-in">
      <aside className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col justify-between hidden md:flex">
        <div>
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              E-Health<span className={isAdmin ? "text-[#0ea5e9]" : "text-green-600"}>IoT</span>
            </h1>
            <p className="text-xs text-gray-500 font-bold uppercase mt-1">
              {isAdmin ? "Mode: Admin" : "Mode: Public"}
            </p>
          </div>
          
          <nav className="p-4 space-y-2">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'dashboard' ? (isAdmin ? 'bg-sky-50 text-[#0ea5e9]' : 'bg-green-50 text-green-700') : 'text-gray-500 hover:bg-gray-50'}`}>
              <LayoutDashboard size={20} /> Live Dashboard
            </button>
            
            <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'history' ? (isAdmin ? 'bg-sky-50 text-[#0ea5e9]' : 'bg-green-50 text-green-700') : 'text-gray-500 hover:bg-gray-50'}`}>
              <Database size={20} /> Open Data
            </button>

            {isAdmin && (
              <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'settings' ? 'bg-sky-50 text-[#0ea5e9]' : 'text-gray-500 hover:bg-gray-50'}`}>
                <Sliders size={20} /> Node Management
              </button>
            )}
          </nav>
        </div>
        
        <div className="p-4 border-t border-gray-100 text-center">
          {isAdmin ? (
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-red-600 hover:bg-red-50 transition-all">
              <LogOut size={20} /> Sign Out
            </button>
          ) : (
            <button onClick={() => navigate('/login')} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-all border border-gray-200">
              <ShieldAlert size={16} /> Technical Login
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto">
        <header className="mb-8 md:mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-800">
              {activeTab === 'dashboard' && 'Air Quality Monitoring'}
              {activeTab === 'history' && 'Medical History Download'}
              {activeTab === 'settings' && 'Node Management'}
            </h2>
            <p className="text-gray-500 font-medium mt-1">Active Station: Av. del Maestro</p>
          </div>
          {isAdmin && (
            <div className="text-left md:text-right">
              <span className="text-xs font-bold text-gray-400 uppercase">Privileges</span>
              <p className="text-[#0ea5e9] font-bold">● ADMIN ACTIVE</p>
            </div>
          )}
        </header>

        {activeTab === 'dashboard' && <DashboardView data={sensorInfo.current} history={sensorInfo.history} thresholds={thresholds} />}
        {activeTab === 'history' && <HistoryView thresholds={thresholds} />}
        {activeTab === 'settings' && <SettingsView thresholds={thresholds} updateThresholds={updateThresholds} />}
      </main>
    </div>
  );
}

// =========================================================
// ENRUTADOR PRINCIPAL
// =========================================================
export default function App() {
  const [thresholds, setThresholds] = useState(() => {
    const guardado = localStorage.getItem('thresholds');
    // Valores por defecto de la OMS basados en la interfaz UI Mockup
    return guardado ? JSON.parse(guardado) : { pm25: 15, pm10: 45, co2: 1000, temp: 30 };
  });

  const updateThresholds = (nuevosUmbrales) => {
    setThresholds(nuevosUmbrales);
    localStorage.setItem('thresholds', JSON.stringify(nuevosUmbrales));
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
import React, { useState, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { Wind, Activity, Thermometer, LayoutDashboard, Database, Settings, Search, Download, MapPin, Sliders, Save, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import { useSensorData } from './useSensorData';

// --- COMPONENTE: TARJETA DE INDICADORES (KPI) ---
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

// --- COMPONENTE PARA RECALCULAR EL MAPA ---
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => { map.invalidateSize(); }, 300);
  }, [map]);
  return null;
}

// --- VISTA 1: DASHBOARD CON GRÁFICAS Y MAPA ---
function DashboardView({ data, history, thresholds }) {
  const { metrics } = data;
  const sensorLocation = [-0.123167, -78.492528]; 

  // Cálculo de riesgo clínico dinámico basado en los umbrales configurados
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

// --- VISTA 2: HISTORIAL Y EXPORTACIÓN ---
function HistoryView({ thresholds }) {
  const [historicalData, setHistoricalData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/history?start_date=${startDate}&end_date=${endDate}`);
      const data = await response.json();
      setHistoricalData(data);
    } catch (error) { console.error(error); }
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
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex justify-between items-center">
        <div className="flex gap-4">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-gray-50 border p-2 rounded-lg" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-gray-50 border p-2 rounded-lg" />
          <button onClick={fetchHistory} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">Filtrar</button>
        </div>
        <button onClick={downloadCSV} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex gap-2"><Download size={20}/> CSV</button>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 border-b sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-black uppercase text-gray-400">Fecha / Hora</th>
                <th className="p-4 text-xs font-black uppercase text-gray-400 text-center">PM 2.5</th>
                <th className="p-4 text-xs font-black uppercase text-gray-400 text-center">PM 10</th>
                <th className="p-4 text-xs font-black uppercase text-gray-400 text-center">CO2 (ppm)</th>
                <th className="p-4 text-xs font-black uppercase text-gray-400 text-center">Estado Médico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {historicalData.map((reg, idx) => (
                <tr key={idx} className="hover:bg-blue-50/30">
                  <td className="p-4 text-sm font-bold">{reg.time}</td>
                  <td className="p-4 text-sm text-center">{reg.pm25}</td>
                  <td className="p-4 text-sm text-center">{reg.pm10}</td>
                  <td className="p-4 text-sm text-center">{reg.co2}</td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${reg.pm25 > thresholds.pm25 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {reg.pm25 > thresholds.pm25 ? 'Riesgo' : 'Normal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- VISTA 3: CONFIGURACIÓN CLÍNICA (NUEVA) ---
function SettingsView({ thresholds, setThresholds }) {
  const [local, setLocal] = useState(thresholds);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setThresholds(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <div className="flex items-center gap-3 mb-8 border-b pb-4">
          <Sliders className="text-blue-600" size={28} />
          <h2 className="text-2xl font-black text-gray-800">Parámetros Epidemiológicos</h2>
        </div>

        <div className="space-y-8">
          {/* Control PM2.5 */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="font-bold text-gray-700 flex items-center gap-2">Alerta Peligro PM 2.5 <AlertTriangle size={16} className="text-red-500"/></label>
              <span className="font-black text-blue-600">{local.pm25} µg/m³</span>
            </div>
            <input type="range" min="5" max="50" step="1" value={local.pm25} onChange={(e) => setLocal({...local, pm25: Number(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
            <p className="text-xs text-gray-400 mt-2 font-medium">Límite recomendado por la OMS: 15 µg/m³ en 24h.</p>
          </div>

          {/* Control PM10 */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="font-bold text-gray-700">Alerta Precaución PM 10</label>
              <span className="font-black text-cyan-600">{local.pm10} µg/m³</span>
            </div>
            <input type="range" min="20" max="100" step="1" value={local.pm10} onChange={(e) => setLocal({...local, pm10: Number(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-600" />
            <p className="text-xs text-gray-400 mt-2 font-medium">Límite recomendado por la OMS: 45 µg/m³ en 24h.</p>
          </div>

          {/* Control CO2 */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="font-bold text-gray-700">Alerta Ventilación CO2</label>
              <span className="font-black text-orange-600">{local.co2} ppm</span>
            </div>
            <input type="range" min="600" max="2000" step="50" value={local.co2} onChange={(e) => setLocal({...local, co2: Number(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600" />
            <p className="text-xs text-gray-400 mt-2 font-medium">Nivel en interiores no debe superar los 1000 ppm.</p>
          </div>
        </div>

        <button onClick={handleSave} className="mt-10 w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black transition-all shadow-md text-lg">
          <Save size={20} /> Aplicar Umbrales al Sistema
        </button>

        {saved && (
          <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-center font-bold text-sm animate-pulse">
            ✅ Umbrales médicos actualizados correctamente.
          </div>
        )}
      </div>
    </div>
  );
}

// --- ESTRUCTURA PRINCIPAL DE LA APLICACIÓN ---
export default function App() {
  const sensorInfo = useSensorData();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // ESTADO GLOBAL: Los umbrales médicos por defecto
  const [thresholds, setThresholds] = useState({
    pm25: 25,
    pm10: 50,
    co2: 1000
  });

  if (!sensorInfo || !sensorInfo.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Sincronizando Sistema E-Health...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">E-Health<span className="text-blue-600">IoT</span></h1>
          <p className="text-xs text-gray-500 font-bold uppercase mt-1">Admin Panel • UTPL</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>
            <LayoutDashboard size={20} /> Dashboard Real-Time
          </button>
          <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'history' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Database size={20} /> Historial y Nodos
          </button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Settings size={20} /> Configuración Clínica
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8 md:p-12 overflow-y-auto">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-black text-gray-800">
              {activeTab === 'dashboard' && 'Monitoreo de Calidad del Aire'}
              {activeTab === 'history' && 'Gestión de Historial Médico'}
              {activeTab === 'settings' && 'Ajuste de Variables Clínicas'}
            </h2>
            <p className="text-gray-500 font-medium mt-1">Estación Activa: Av. del Maestro</p>
          </div>
          <div className="text-right hidden md:block">
            <span className="text-xs font-bold text-gray-400 uppercase">Red MQTT</span>
            <p className="text-green-500 font-bold">● CONECTADO</p>
          </div>
        </header>

        {activeTab === 'dashboard' && <DashboardView data={sensorInfo.current} history={sensorInfo.history} thresholds={thresholds} />}
        {activeTab === 'history' && <HistoryView thresholds={thresholds} />}
        {activeTab === 'settings' && <SettingsView thresholds={thresholds} setThresholds={setThresholds} />}
      </main>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { LayoutDashboard, Database, Sliders, Wind, Activity, Thermometer, Droplets, MapPin, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
import { useSensorData } from './useSensorData'; // Asegúrate que este archivo exista

const API_BASE_URL = "https://tesis-iot-ambiental.onrender.com";

// --- COMPONENTES SIMPLIFICADOS ---
function KPICard({ title, value, unit, icon, level }) {
  const styles = level === 'danger' ? "border-red-500" : (level === 'warning' ? "border-yellow-500" : "border-green-500");
  return (
    <div className={`p-4 rounded-2xl border-t-4 shadow-sm bg-white ${styles}`}>
      <p className="text-[10px] font-bold text-gray-500 uppercase">{title}</p>
      <h3 className="text-xl font-black mt-2">{value} <span className="text-xs">{unit}</span></h3>
    </div>
  );
}

// --- APP PRINCIPAL ---
export default function App() {
  const [thresholds, setThresholds] = useState({ pm25: 15, pm10: 50, co2: 1000 });
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Capturamos el error de los datos
  let sensorInfo = null;
  try {
    sensorInfo = useSensorData();
  } catch (e) {
    console.error("Error en useSensorData:", e);
  }

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/configuracion`)
      .then(res => res.json())
      .then(data => { if(data.umbral_pm25) setThresholds({ pm25: data.umbral_pm25, pm10: data.umbral_pm10, co2: data.limite_co2 }); })
      .catch(err => console.error("Error al cargar config", err));
  }, []);

  const updateThresholds = async (newT) => {
    try {
      await fetch(`${API_BASE_URL}/api/configuracion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newT)
      });
      setThresholds(newT);
      alert("Guardado!");
    } catch(e) { console.error(e); }
  };

  // Renderizado seguro
  if (!sensorInfo || !sensorInfo.current) {
    return <div className="p-20 text-center font-black text-2xl text-gray-400">CARGANDO... SI NO PASA DE AQUÍ, REVISA CONSOLA (F12)</div>;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex">
        <aside className="w-64 bg-white border-r p-6 flex flex-col gap-4">
          <h1 className="text-xl font-black mb-8">HEALTH<span className="text-blue-600">IOT</span></h1>
          <button onClick={() => setActiveTab('dashboard')} className="p-3 rounded-lg hover:bg-gray-100 font-bold w-full text-left">Dashboard</button>
          <button onClick={() => setActiveTab('settings')} className="p-3 rounded-lg hover:bg-gray-100 font-bold w-full text-left">Gestión</button>
        </aside>
        <main className="flex-1 p-8">
           {activeTab === 'dashboard' && (
             <div className="grid grid-cols-2 gap-4">
               <KPICard title="PM 2.5" value={sensorInfo.current.metrics.pm25} unit="µg/m³" level="normal" />
               <KPICard title="PM 10" value={sensorInfo.current.metrics.pm10} unit="µg/m³" level="normal" />
             </div>
           )}
           {activeTab === 'settings' && (
             <div className="bg-white p-6 rounded-2xl shadow-sm border">
               <h3 className="font-bold mb-4">Configuración</h3>
               <input type="number" className="p-2 border rounded block mb-2" value={thresholds.pm25} onChange={e => setThresholds({...thresholds, pm25: e.target.value})} />
               <button onClick={() => updateThresholds(thresholds)} className="bg-blue-600 text-white p-3 rounded-lg">Guardar</button>
             </div>
           )}
        </main>
      </div>
    </BrowserRouter>
  );
}
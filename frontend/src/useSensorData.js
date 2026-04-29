import { useState, useEffect } from 'react';

export function useSensorData() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]); // Memoria para la gráfica

  useEffect(() => {
    // Nos conectamos a tu backend en FastAPI
    const socket = new WebSocket("ws://127.0.0.1:8000/ws/monitoreo");
    
    socket.onmessage = (event) => {
      const newData = JSON.parse(event.data);
      setData(newData);

      // Guardamos el historial para Recharts
      setHistory(prev => {
        const newHistory = [...prev, {
          time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          co2: newData.metrics.co2_ppm,
          pm25: newData.metrics.pm25_ugm3,
          pm10: newData.metrics.pm10_ugm3 || (newData.metrics.pm25_ugm3 * 1.5).toFixed(1) // Fallback temporal por si el sensor no manda pm10 aún
        }];
        return newHistory.slice(-20); // Guardamos solo los últimos 20 puntos
      });
    };
    
    socket.onerror = () => console.log("Esperando al backend...");
    return () => socket.close();
  }, []);

  return { current: data, history };
}
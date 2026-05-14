import { useState, useEffect } from 'react';

const API_BASE_URL = "https://tesis-iot-ambiental.onrender.com";

export function useSensorData() {
  const [data, setData] = useState(null);

  const fetchRealTimeData = async () => {
    try {
      // Consultamos las últimas 2 horas de datos para el Dashboard
      const response = await fetch(`${API_BASE_URL}/api/history?range_h=2`);
      const history = await response.json();

      if (history && history.length > 0) {
        // El último elemento del array es el dato más reciente
        const lastReading = history[history.length - 1];

        setData({
          current: {
            metrics: {
              pm25_ugm3: lastReading.pm25 || 0,
              pm10_ugm3: lastReading.pm10 || 0, // Si el sensor no envía PM10, marcará 0
              co2_ppm: lastReading.co2 || 0,
              temperature_c: lastReading.temp || 0,
              humidity_pct: lastReading.hum || 0 
            }
          },
          // Pasamos todo el historial para la gráfica (limitamos a los últimos 20 puntos)
          history: history.slice(-20).map(item => ({
            time: item.time.split(' ')[1], // Solo mostramos la hora HH:MM:SS
            pm25: item.pm25,
            pm10: item.pm10 || 0,
            co2: item.co2,
            temp: item.temp
          }))
        });
      }
    } catch (error) {
      console.error("Error conectando con el Backend de la UTPL:", error);
    }
  };

  useEffect(() => {
    // Primera carga inmediata
    fetchRealTimeData();

    // Actualización cada 20 segundos 
    const intervalo = setInterval(fetchRealTimeData, 20000);

    return () => clearInterval(intervalo);
  }, []);

  return data;
}
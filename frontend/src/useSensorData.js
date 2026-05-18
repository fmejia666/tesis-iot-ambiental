import { useState, useEffect } from 'react';

const API_BASE_URL = "https://tesis-iot-ambiental.onrender.com";

export function useSensorData() {
  
  const [data, setData] = useState({
    current: {
      metrics: {
        pm25_ugm3: 0,
        pm10_ugm3: 0,
        co2_ppm: 0,
        temperature_c: 0,
        humidity_pct: 0
      }
    },
    history: []
  });

  const fetchRealTimeData = async () => {
    try {
      // Consultamos las últimas 2 horas
      const response = await fetch(`${API_BASE_URL}/api/history?range_h=2`);
      const history = await response.json();

      // Solo actualizamos si realmente llegaron datos del sensor
      if (history && history.length > 0) {
        const lastReading = history[history.length - 1];

        setData({
          current: {
            metrics: {
              pm25_ugm3: lastReading.pm25 || 0,
              pm10_ugm3: lastReading.pm10 || 0,
              co2_ppm: lastReading.co2 || 0,
              temperature_c: lastReading.temp || 0,
              humidity_pct: lastReading.hum || 0 
            }
          },
          history: history.slice(-20).map(item => ({
            time: item.time.split(' ')[1],
            pm25: item.pm25,
            pm10: item.pm10 || 0,
            co2: item.co2,
            temp: item.temp
          }))
        });
      }
    } catch (error) {
      console.error("Error conectando con el Backend:", error);
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
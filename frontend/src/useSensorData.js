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
      const response = await fetch(`${API_BASE_URL}/api/history?range_h=2`);
      const history = await response.json();

      if (Array.isArray(history) && history.length > 0) {
        // Busca desde el final hacia atrás el último registro que realmente contenga datos válidos (> 0)
        const validReading = [...history].reverse().find(item => {
          const pm = item.pm25 ?? item.pm25_ugm3 ?? 0;
          const co2 = item.co2 ?? item.co2_ppm ?? 0;
          const temp = item.temp ?? item.temperature_c ?? 0;
          return pm > 0 || co2 > 0 || temp > 0;
        }) || history[history.length - 1];

        const extractVal = (obj, ...keys) => {
          for (const k of keys) {
            if (obj && obj[k] !== undefined && obj[k] !== null) return Number(obj[k]);
          }
          return 0;
        };

        const currentMetrics = {
          pm25: extractVal(validReading, 'pm25', 'pm25_ugm3'),
          pm10: extractVal(validReading, 'pm10', 'pm10_ugm3'),
          co2: extractVal(validReading, 'co2', 'co2_ppm'),
          temp: extractVal(validReading, 'temp', 'temperature_c'),
          hum: extractVal(validReading, 'hum', 'humidity_pct')
        };

        setData({
          current: {
            metrics: {
              ...currentMetrics,
              pm25_ugm3: currentMetrics.pm25,
              pm10_ugm3: currentMetrics.pm10,
              co2_ppm: currentMetrics.co2,
              temperature_c: currentMetrics.temp,
              humidity_pct: currentMetrics.hum
            }
          },
          history: history.slice(-20).map(item => ({
            time: item.time ? (item.time.includes(' ') ? item.time.split(' ')[1] : item.time) : '',
            pm25: extractVal(item, 'pm25', 'pm25_ugm3'),
            pm10: extractVal(item, 'pm10', 'pm10_ugm3'),
            co2: extractVal(item, 'co2', 'co2_ppm'),
            temp: extractVal(item, 'temp', 'temperature_c'),
            hum: extractVal(item, 'hum', 'humidity_pct')
          }))
        });
      }
    } catch (error) {
      console.error("Error conectando con el Backend:", error);
    }
  };

  useEffect(() => {
    fetchRealTimeData();
    const intervalo = setInterval(fetchRealTimeData, 20000);
    return () => clearInterval(intervalo);
  }, []);

  return data;
}
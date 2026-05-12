import { useState, useEffect } from 'react';

export function useSensorData() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // 1. Generamos un historial falso de los últimos 10 minutos para que la gráfica no nazca vacía
    const historialInicial = Array.from({ length: 10 }).map((_, i) => {
      const d = new Date();
      d.setMinutes(d.getMinutes() - (10 - i));
      return {
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pm25: Math.floor(Math.random() * 20) + 10, // Entre 10 y 30
        pm10: Math.floor(Math.random() * 30) + 20, // Entre 20 y 50
        co2: Math.floor(Math.random() * 300) + 700, // Entre 700 y 1000
        temp: 18 + Math.floor(Math.random() * 5),
      };
    });

    // 2. Cargamos el primer dato instantáneo
    setData({
      current: {
        metrics: {
          pm25_ugm3: 15,
          pm10_ugm3: 40,
          co2_ppm: 850,
          temperature_c: 19,
          humidity_pct: 55
        }
      },
      history: historialInicial
    });

    // 3. El Mock en Acción: Cada 3 segundos inyecta un nuevo dato respiratorio
    const intervalo = setInterval(() => {
      setData(prevData => {
        if (!prevData) return prevData;

        const ahora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        // Generamos fluctuaciones aleatorias
        const nuevoPm25 = Math.floor(Math.random() * 40) + 5;   // Puede disparar la alerta roja si pasa de 25
        const nuevoPm10 = Math.floor(Math.random() * 60) + 10;
        const nuevoCo2 = Math.floor(Math.random() * 600) + 600; // Puede disparar alerta si pasa de 1000

        const nuevoRegistro = { 
          time: ahora, 
          pm25: nuevoPm25, 
          pm10: nuevoPm10, 
          co2: nuevoCo2, 
          temp: 19 
        };

        // Mantenemos solo los últimos 10 puntos en la gráfica para que se vea como un electrocardiograma continuo
        const nuevoHistorial = [...prevData.history.slice(1), nuevoRegistro];

        return {
          current: {
            metrics: {
              pm25_ugm3: nuevoPm25,
              pm10_ugm3: nuevoPm10,
              co2_ppm: nuevoCo2,
              temperature_c: 19,
              humidity_pct: 56
            }
          },
          history: nuevoHistorial
        };
      });
    }, 3000); // Se actualiza cada 3000 milisegundos (3 segundos)

    return () => clearInterval(intervalo);
  }, []);

  return data;
}
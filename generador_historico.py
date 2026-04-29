import random
import time
from datetime import datetime, timedelta
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

# Credenciales de tu AWS Cloud
INFLUX_URL = "https://us-east-1-1.aws.cloud2.influxdata.com"
INFLUX_TOKEN = "5j94SEjqRfX1jOwFcFL2WApRMm_qRhTNCK8DgKnJx5UyoEQM8FJuVG_49W4ZzFmU5XytuXvdL3qii454OkSQeg=="
INFLUX_ORG = "UTPL"
INFLUX_BUCKET = "aire_utpl"

print("💉 Iniciando inyección de historial clínico simulado (Últimas 24h)...")

client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
write_api = client.write_api(write_options=SYNCHRONOUS)

# Configurar el tiempo: Desde hace 24 horas hasta ahora
ahora = datetime.utcnow()
inicio = ahora - timedelta(hours=24)

puntos = []
tiempo_actual = inicio

# Generar 1 dato cada 5 minutos
while tiempo_actual <= ahora:
    # Simular ciclo día/noche (Más contaminación en hora pico)
    hora_local = (tiempo_actual - timedelta(hours=5)).hour
    
    if 7 <= hora_local <= 9 or 17 <= hora_local <= 19:
        # Hora pico (tráfico)
        pm25 = random.uniform(25.0, 55.0)
        co2 = random.uniform(800.0, 1200.0)
    else:
        # Horas valle (noche/madrugada)
        pm25 = random.uniform(5.0, 20.0)
        co2 = random.uniform(400.0, 600.0)
        
    pm10 = pm25 * random.uniform(1.2, 2.0)
    
    punto = Point("calidad_aire") \
        .tag("ubicacion", "av_maestro") \
        .field("pm25_ugm3", round(pm25, 1)) \
        .field("pm10_ugm3", round(pm10, 1)) \
        .field("co2_ppm", round(co2, 1)) \
        .field("temperature_c", round(random.uniform(15.0, 22.0), 1)) \
        .field("humidity_pct", round(random.uniform(50.0, 80.0), 1)) \
        .time(tiempo_actual, WritePrecision.NS)
        
    puntos.append(punto)
    tiempo_actual += timedelta(minutes=5)

# Guardar todo en AWS de golpe
write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=puntos)

print(f"✅ ¡Éxito! Se inyectaron {len(puntos)} registros médicos al pasado en la nube de AWS.")
client.close()
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
import paho.mqtt.client as mqtt
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime, timedelta

app = FastAPI(title="E-Health Monitor Backend")

# --- CORS para permitir la conexión de React ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURACIÓN INFLUXDB (AWS Cloud) ---
INFLUX_URL = "https://us-east-1-1.aws.cloud2.influxdata.com"
INFLUX_TOKEN = "5j94SEjqRfX1jOwFcFL2WApRMm_qRhTNCK8DgKnJx5UyoEQM8FJuVG_49W4ZzFmU5XytuXvdL3qii454OkSQeg=="
INFLUX_ORG = "UTPL"
INFLUX_BUCKET = "aire_utpl" 

influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
write_api = influx_client.write_api(write_options=SYNCHRONOUS)
query_api = influx_client.query_api()

# --- CONFIGURACIÓN MQTT ---
MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883
MQTT_TOPIC = "sensores/utpl/aire"

# --- WEBSOCKET MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()
main_loop = None

@app.on_event("startup")
async def startup_event():
    global main_loop
    main_loop = asyncio.get_running_loop()

# --- LÓGICA DE DECISIÓN CLÍNICA ---
def evaluar_salud(pm25, co2):
    if pm25 > 50 or co2 > 1500:
        return {"level": "danger", "msg": "Riesgo Respiratorio Crítico"}
    elif pm25 > 25 or co2 > 1000:
        return {"level": "warning", "msg": "Precaución: Vías sensibles"}
    else:
        return {"level": "normal", "msg": "Condiciones Óptimas"}

# --- EVENTOS DE MQTT ---
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Backend conectado al Broker MQTT")
        client.subscribe(MQTT_TOPIC)
    else:
        print(f"❌ Error conectando a MQTT. Código: {rc}")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        
        # 1. Guardar el registro en InfluxDB Cloud
        point = Point("calidad_aire") \
            .tag("ubicacion", "av_maestro") \
            .field("pm25_ugm3", float(payload.get("pm25", 0))) \
            .field("pm10_ugm3", float(payload.get("pm10", 0))) \
            .field("co2_ppm", float(payload.get("co2", 0))) \
            .field("temperature_c", float(payload.get("temp", 0))) \
            .field("humidity_pct", float(payload.get("hum", 0))) \
            .time(datetime.utcnow(), WritePrecision.NS)
        
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
        
        # 2. Armar el paquete de datos en tiempo real para React
        estado = evaluar_salud(payload.get("pm25", 0), payload.get("co2", 0))
        mensaje_ws = {
            "metrics": {
                "pm25_ugm3": payload.get("pm25", 0),
                "pm10_ugm3": payload.get("pm10", 0),
                "co2_ppm": payload.get("co2", 0),
                "temperature_c": payload.get("temp", 0),
                "humidity_pct": payload.get("hum", 0)
            },
            "health_status": estado
        }
        
        # 3. Transmitir por WebSocket (usando el puente seguro)
        global main_loop
        if main_loop and main_loop.is_running():
            asyncio.run_coroutine_threadsafe(manager.broadcast(json.dumps(mensaje_ws)), main_loop)
            
        print(f"📥 Dato Procesado a la Nube: PM2.5={payload.get('pm25')} | PM10={payload.get('pm10')} | CO2={payload.get('co2')}")
        
    except Exception as e:
        print(f"❌ Error procesando mensaje del sensor: {e}")
        
    except Exception as e:
        print(f"❌ Error procesando mensaje del sensor: {e}")

# Inicializar cliente MQTT
mqtt_client = mqtt.Client()
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

try:
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    mqtt_client.loop_start()
except Exception as e:
    print(f"⚠️ Advertencia: No se pudo conectar al broker MQTT: {e}")

# --- RUTAS DE LA API (ENDPOINTS) ---

@app.websocket("/ws/monitoreo")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/history")
async def get_history(start_date: str = Query(None), end_date: str = Query(None)):
    """
    Ruta para descargar la data histórica filtrada por fechas de forma segura.
    Compensa la zona horaria de Ecuador (UTC-5) matemáticamente.
    """
    try:
        if start_date and end_date:
            # 1. Convertir el texto a objetos de fecha de Python
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            # El final es el mismo día seleccionado pero a las 23:59:59
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1, seconds=-1)

            # 2. Sumar 5 horas exactas para igualar el reloj de la nube (UTC)
            start_utc = start_dt + timedelta(hours=5)
            end_utc = end_dt + timedelta(hours=5)

            # 3. Formatear en el estándar estricto que InfluxDB exige (RFC3339)
            start_str = start_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
            end_str = end_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

            time_filter = f'|> range(start: {start_str}, stop: {end_str})'
        else:
            time_filter = '|> range(start: -24h)'

        query = f'''
        from(bucket: "{INFLUX_BUCKET}")
          {time_filter}
          |> filter(fn: (r) => r["_measurement"] == "calidad_aire")
          |> filter(fn: (r) => r["ubicacion"] == "av_maestro")
          |> aggregateWindow(every: 5m, fn: mean, createEmpty: false) 
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        
        result = query_api.query(org=INFLUX_ORG, query=query)
        
        history_list = []
        for table in result:
            for record in table.records:
                # Al recibir la fecha de la nube, le volvemos a restar las 5 horas 
                # para que en tu tabla de React salga la hora exacta de Ecuador.
                time_obj = record.get_time() - timedelta(hours=5)
                
                history_list.append({
                    "time": time_obj.strftime('%Y-%m-%d %H:%M'),
                    "pm25": round(record.values.get("pm25_ugm3", 0), 1),
                    "pm10": round(record.values.get("pm10_ugm3", 0), 1),
                    "co2": round(record.values.get("co2_ppm", 0), 1),
                    "temp": round(record.values.get("temperature_c", 0), 1)
                })
                
        return history_list[::-1]
    except Exception as e:
        print(f"❌ Error en consulta histórica: {e}")
        return []
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import paho.mqtt.client as mqtt
import ssl
import json
import asyncio
import ssl
import paho.mqtt.client as mqtt
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from pymongo import MongoClient
from passlib.context import CryptContext
from datetime import datetime, timedelta

app = FastAPI(title="Backend HealthIoT - UTPL")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CREDENCIALES ---
INFLUX_URL = "https://us-east-1-1.aws.cloud2.influxdata.com"
INFLUX_TOKEN = "5j94SEjqRfX1jOwFcFL2WApRMm_qRhTNCK8DgKnJx5UyoEQM8FJuVG_49W4ZzFmU5XytuXvdL3qii454OkSQeg=="
INFLUX_ORG = "nodos"
INFLUX_BUCKET = "Monitoreo_UTPL"

influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
write_api = influx_client.write_api(write_options=SYNCHRONOUS)
query_api = influx_client.query_api()

MONGO_URI = "mongodb+srv://mejiafarith12:jyjHAF9YG0srzQaq@utpl.hpoaxun.mongodb.net/?appName=Utpl"
mongo_client = MongoClient(MONGO_URI)
db_mongo = mongo_client["HealthIoT"]
coleccion_usuarios = db_mongo["usuarios"]
coleccion_nodos = db_mongo["nodos"]
coleccion_config = db_mongo["configuracion"]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

AWS_ENDPOINT = "a3efp99tqsedcx-ats.iot.us-east-2.amazonaws.com"
TOPIC_TELEMETRIA = "utpl/telemetria"
TOPIC_COMANDOS = "utpl/comandos/"

# --- MODELOS ---
class Nodo(BaseModel):
    id: str
    ubicacion: str
    estado: str  
    rssi: Optional[int] = -50    

class DatosSensor(BaseModel):
    device_id: str
    pm25: float
    pm10: float
    co2: float
    temp: float
    hum: float

class ConfiguracionAlerta(BaseModel):
    umbral_pm25: float
    umbral_pm10: float
    limite_co2: float

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
            try: await connection.send_text(message)
            except: pass

manager = ConnectionManager()
main_loop = None

# --- MQTT ---
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ CONEXIÓN EXITOSA AWS")
        client.subscribe(TOPIC_TELEMETRIA)

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        
        point = Point("calidad_aire") \
            .tag("device", payload.get("device_id", "NODE-001")) \
            .field("pm25", float(payload.get("pm25", 0))) \
            .field("pm10", float(payload.get("pm10", 0))) \
            .field("co2", float(payload.get("co2", 0))) \
            .field("temp", float(payload.get("temp", 0))) \
            .field("hum", float(payload.get("hum", 0))) \
            .time(datetime.utcnow(), WritePrecision.NS)
        
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
        
        global main_loop
        if main_loop and main_loop.is_running():
            asyncio.run_coroutine_threadsafe(manager.broadcast(json.dumps(payload)), main_loop)
            
    except Exception as e:
        print(f"❌ Error MQTT: {e}")

mqtt_client = mqtt.Client(client_id="Backend_HealthIoT_Service")
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

try:
    mqtt_client.tls_set(
        ca_certs="certs/root-CA.pem", 
        certfile="certs/certificate.pem.crt", 
        keyfile="certs/private.pem.key", 
        tls_version=ssl.PROTOCOL_TLSv1_2
    )
except: print("⚠️ Certificados no encontrados")

@app.on_event("startup")
async def startup_event():
    global main_loop
    main_loop = asyncio.get_running_loop()
    mqtt_client.connect(AWS_ENDPOINT, 8883, 60)
    mqtt_client.loop_start()

# --- ENDPOINTS ---

@app.websocket("/ws/monitoreo")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True: await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/configuracion")
async def obtener_configuracion():
    config = coleccion_config.find_one({"_id": "politicas_globales"})
    return config if config else {"umbral_pm25": 15, "umbral_pm10": 50, "limite_co2": 1000}

@app.put("/api/configuracion")
async def actualizar_configuracion(config: ConfiguracionAlerta):
    coleccion_config.update_one({"_id": "politicas_globales"}, {"$set": config.dict()}, upsert=True)
    return {"mensaje": "Actualizado"}

@app.post("/nodos")
async def registrar_nodo(nuevo_nodo: Nodo):
    if coleccion_nodos.find_one({"id": nuevo_nodo.id}):
        raise HTTPException(status_code=400, detail="Ya existe")
    coleccion_nodos.insert_one(nuevo_nodo.dict())
    return {"mensaje": "OK"}

@app.get("/nodos", response_model=List[Nodo])
async def obtener_nodos():
    return list(coleccion_nodos.find({}, {"_id": 0}))

@app.delete("/nodos/{nodo_id}")
async def eliminar_nodo(nodo_id: str):
    coleccion_nodos.delete_one({"id": nodo_id})
    return {"mensaje": "Borrado"}

@app.get("/api/history")
async def get_history(range_h: int = 24, start_date: str = None, end_date: str = None):
    # Lógica de consulta histórica con soporte de fechas o rango
    time_filter = f'range(start: -{range_h}h)'
    if start_date and end_date:
        time_filter = f'range(start: {start_date}T00:00:00Z, stop: {end_date}T23:59:59Z)'
        
    query = f'''
        from(bucket: "{INFLUX_BUCKET}")
        |> {time_filter}
        |> filter(fn: (r) => r["_measurement"] == "calidad_aire")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"], desc: false)
    '''
    result = query_api.query(org=INFLUX_ORG, query=query)
    output = []
    for table in result:
        for record in table.records:
            output.append({
                "time": record.get_time().strftime('%Y-%m-%d %H:%M:%S'),
                "pm25": record.values.get("pm25"),
                "pm10": record.values.get("pm10"),
                "co2": record.values.get("co2"),
                "temp": record.values.get("temp"),
                "hum": record.values.get("hum"),
                "device": record.values.get("device")
            })
    return output

@app.get("/")
def inicio(): return {"status": "HealthIoT Backend Online"}
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


class LoginRequest(BaseModel):
    email: str
    password: str

class NuevoUsuario(BaseModel):
    email: str
    password: str

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
    limite_co2: float


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


def evaluar_salud(pm25, co2):
  
    if pm25 > 50 or co2 > 1500:
        return {"level": "danger", "msg": "Riesgo Respiratorio Crítico"}
    elif pm25 > 25 or co2 > 1000:
        return {"level": "warning", "msg": "Precaución: Vías sensibles"}
    else:
        return {"level": "normal", "msg": "Condiciones Óptimas"}

# --- FUNCIONES MQTT (AWS) ---
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ CONEXIÓN EXITOSA AL BROKER DE AWS IOT")
        client.subscribe(TOPIC_TELEMETRIA)
    else:
        print(f"❌ Error conectando a MQTT. Código: {rc}")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        
        # 1. Guardar en InfluxDB
        point = Point("calidad_aire") \
            .tag("device", payload.get("device_id", "NODE-001")) \
            .field("pm25", float(payload.get("pm25", 0))) \
            .field("pm10", float(payload.get("pm10", 0))) \
            .field("co2", float(payload.get("co2", 0))) \
            .field("temp", float(payload.get("temp", 0))) \
            .field("hum", float(payload.get("hum", 0))) \
            .time(datetime.utcnow(), WritePrecision.NS)
        
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
        
        # 2. Armar paquete WebSocket con evaluación de salud
        estado = evaluar_salud(payload.get("pm25", 0), payload.get("co2", 0))
        mensaje_ws = {
            "metrics": {
                "pm25": payload.get("pm25", 0),
                "pm10": payload.get("pm10", 0),
                "co2": payload.get("co2", 0),
                "temp": payload.get("temp", 0),
                "hum": payload.get("hum", 0)
            },
            "health_status": estado
        }
        
        # 3. Transmitir por WebSockets
        global main_loop
        if main_loop and main_loop.is_running():
            asyncio.run_coroutine_threadsafe(manager.broadcast(json.dumps(mensaje_ws)), main_loop)
            
        print(f"✅ Dato Procesado a la Nube (AWS -> WS): {payload}")
    except Exception as e:
        print(f"❌ Error en la ingesta de datos: {e}")

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
except:
    print("⚠️ Revisa la carpeta de certificados pem")

@app.on_event("startup")
async def startup_event():
    global main_loop
    main_loop = asyncio.get_running_loop()
    mqtt_client.connect(AWS_ENDPOINT, 8883, 60)
    mqtt_client.loop_start()

# --- RUTAS DE LA API (ENDPOINTS) ---

@app.websocket("/ws/monitoreo")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/login")
async def login(request: LoginRequest):
    usuario_db = coleccion_usuarios.find_one({"email": request.email})
    if not usuario_db:
        raise HTTPException(status_code=404, detail="Usuario no registrado en el sistema")
    
    contrasena_valida = pwd_context.verify(request.password, usuario_db["password"])
    if not contrasena_valida:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    return {"token": "auth_token_utpl_2026", "user": request.email}

@app.get("/nodos", response_model=List[Nodo])
async def obtener_nodos():
    nodos_cursor = coleccion_nodos.find({}, {"_id": 0})
    return list(nodos_cursor)

@app.post("/nodos")
async def registrar_nodo(nuevo_nodo: Nodo):
    if coleccion_nodos.find_one({"id": nuevo_nodo.id}):
        raise HTTPException(status_code=400, detail="Este ID de nodo ya existe")
    coleccion_nodos.insert_one(nuevo_nodo.dict())
    return {"mensaje": "Nodo registrado exitosamente en MongoDB"}

@app.put("/nodos/{nodo_id}")
async def editar_nodo(nodo_id: str, datos: Nodo):
    resultado = coleccion_nodos.update_one({"id": nodo_id}, {"$set": datos.dict()})
    if resultado.matched_count == 0:
        raise HTTPException(status_code=404, detail="Nodo no encontrado")
    return {"mensaje": "Cambios guardados exitosamente"}

@app.delete("/nodos/{nodo_id}")
async def eliminar_nodo(nodo_id: str):
    resultado = coleccion_nodos.delete_one({"id": nodo_id})
    if resultado.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nodo no encontrado")
    return {"mensaje": f"El dispositivo {nodo_id} ha sido borrado"}

@app.post("/nodos/{nodo_id}/restart")
async def reiniciar_nodo(nodo_id: str):
    comando = {"action": "reboot", "origin": "web_admin"}
    mqtt_client.publish(f"{TOPIC_COMANDOS}{nodo_id}", json.dumps(comando))
    return {"mensaje": f"Señal de reinicio enviada a {nodo_id}"}

# [NUEVO] Endpoints para la Configuración Global de Parámetros de Alerta
@app.get("/api/configuracion")
async def obtener_configuracion():
    config = coleccion_config.find_one({"_id": "politicas_globales"})
    if not config:
        # Valores por defecto para la primera vez que se cargue
        return {"umbral_pm25": 20.0, "limite_co2": 900.0}
    return {"umbral_pm25": config["umbral_pm25"], "limite_co2": config["limite_co2"]}

@app.put("/api/configuracion")
async def actualizar_configuracion(config: ConfiguracionAlerta):
    coleccion_config.update_one(
        {"_id": "politicas_globales"},
        {"$set": config.dict()},
        upsert=True
    )
    return {"mensaje": "Políticas de alerta actualizadas globalmente"}

@app.get("/api/history")
async def get_history(start_date: str = Query(None), end_date: str = Query(None)):
    try:
        if start_date and end_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1, seconds=-1)

            # Sumar 5 horas exactas para UTC
            start_utc = start_dt + timedelta(hours=5)
            end_utc = end_dt + timedelta(hours=5)

            start_str = start_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
            end_str = end_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
            time_filter = f'|> range(start: {start_str}, stop: {end_str})'
        else:
            time_filter = '|> range(start: -24h)'

        query = f'''
        from(bucket: "{INFLUX_BUCKET}")
          {time_filter}
          |> filter(fn: (r) => r["_measurement"] == "calidad_aire")
          |> aggregateWindow(every: 5m, fn: mean, createEmpty: false) 
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"], desc: false)
        '''
        
        result = query_api.query(org=INFLUX_ORG, query=query)
        
        history_list = []
        for table in result:
            for record in table.records:
                time_obj = record.get_time() - timedelta(hours=5)
                history_list.append({
                    "time": time_obj.strftime('%Y-%m-%d %H:%M:%S'),
                    "pm25": round(record.values.get("pm25", 0), 1),
                    "pm10": round(record.values.get("pm10", 0), 1),
                    "co2": round(record.values.get("co2", 0), 1),
                    "temp": round(record.values.get("temp", 0), 1),
                    "hum": round(record.values.get("hum", 0), 1)
                })
                
        return history_list
    except Exception as e:
        print(f"❌ Error en consulta histórica: {e}")
        return []

@app.get("/")
def inicio():
    return {"status": "HealthIoT Backend Online"}
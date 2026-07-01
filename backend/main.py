from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import paho.mqtt.client as mqtt
import ssl
import json
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from pymongo import MongoClient
from passlib.context import CryptContext

# --- CREDENCIALES INFLUXDB ---
INFLUX_URL = "https://us-east-1-1.aws.cloud2.influxdata.com"
INFLUX_TOKEN = "5j94SEjqRfX1jOwFcFL2WApRMm_qRhTNCK8DgKnJx5UyoEQM8FJuVG_49W4ZzFmU5XytuXvdL3qii454OkSQeg=="
INFLUX_ORG = "nodos"
INFLUX_BUCKET = "Monitoreo_UTPL"

influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
write_api = influx_client.write_api(write_options=SYNCHRONOUS)
query_api = influx_client.query_api()

# --- CREDENCIALES MONGODB ---
MONGO_URI = "mongodb+srv://mejiafarith12:jyjHAF9YG0srzQaq@utpl.hpoaxun.mongodb.net/?appName=Utpl"
mongo_client = MongoClient(MONGO_URI)
db_mongo = mongo_client["HealthIoT"]
coleccion_usuarios = db_mongo["usuarios"]
coleccion_nodos = db_mongo["nodos"]
coleccion_config = db_mongo["configuracion"] 

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- CREDENCIALES AWS IOT ---
AWS_ENDPOINT = "a3efp99tqsedcx-ats.iot.us-east-2.amazonaws.com"
TOPIC_TELEMETRIA = "utpl/telemetria"
TOPIC_COMANDOS = "utpl/comandos/"

app = FastAPI(title="Backend HealthIoT - UTPL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS PYDANTIC ---
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
    umbral_pm10: float
    limite_co2: float

# --- FUNCIONES MQTT (AWS) ---
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ CONEXIÓN EXITOSA AL BROKER DE AWS")
        client.subscribe(TOPIC_TELEMETRIA)

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        point = Point("calidad_aire") \
            .tag("device", payload.get("device_id", "Nodo_Desconocido")) \
            .field("pm25", float(payload.get("pm25", 0))) \
            .field("pm10", float(payload.get("pm10", 0))) \
            .field("co2", float(payload.get("co2", 0))) \
            .field("temp", float(payload.get("temp", 0))) \
            .field("hum", float(payload.get("hum", 0)))
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
        print(f"✅ Datos guardados: {payload}")
    except Exception as e:
        print(f"❌ Error: {e}")

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
def startup_event():
    mqtt_client.connect(AWS_ENDPOINT, 8883, 60)
    mqtt_client.loop_start()

# --- ENDPOINTS CONFIGURACIÓN (GLOBAL) ---
@app.get("/api/configuracion")
async def obtener_configuracion():
    config = coleccion_config.find_one({"_id": "politicas_globales"})
    return config if config else {"umbral_pm25": 15, "umbral_pm10": 50, "limite_co2": 1000}

@app.put("/api/configuracion")
async def actualizar_configuracion(config: ConfiguracionAlerta):
    coleccion_config.update_one({"_id": "politicas_globales"}, {"$set": config.dict()}, upsert=True)
    return {"mensaje": "Configuración actualizada"}

# --- ENDPOINTS USUARIOS ---
@app.post("/login")
async def login(request: LoginRequest):
    usuario_db = coleccion_usuarios.find_one({"email": request.email})
    if not usuario_db or not pwd_context.verify(request.password, usuario_db["password"]):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    return {"token": "auth_token_utpl_2026", "user": request.email}

# --- ENDPOINTS TELEMETRÍA ---
@app.post("/api/telemetria")
async def recibir_telemetria(datos: DatosSensor):
    punto = Point("calidad_aire").tag("device", datos.device_id) \
        .field("pm25", float(datos.pm25)).field("pm10", float(datos.pm10)) \
        .field("co2", float(datos.co2)).field("temp", float(datos.temp)).field("hum", float(datos.hum))
    write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=punto)
    return {"estado": "éxito"}

@app.get("/api/history")
async def get_history(range_h: int = 24):
    query = f'from(bucket: "{INFLUX_BUCKET}") |> range(start: -{range_h}h) |> filter(fn: (r) => r["_measurement"] == "calidad_aire") |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value") |> sort(columns: ["_time"], desc: false)'
    result = query_api.query(org=INFLUX_ORG, query=query)
    return [{"time": r.get_time().strftime('%Y-%m-%d %H:%M:%S'), **r.values} for table in result for r in table.records]

@app.get("/nodos", response_model=List[Nodo])
async def obtener_nodos(): return list(coleccion_nodos.find({}, {"_id": 0}))

@app.post("/nodos")
async def registrar_nodo(nuevo_nodo: Nodo):
    if coleccion_nodos.find_one({"id": nuevo_nodo.id}): raise HTTPException(status_code=400, detail="Ya existe")
    coleccion_nodos.insert_one(nuevo_nodo.dict())
    return {"mensaje": "OK"}

@app.put("/nodos/{nodo_id}")
async def editar_nodo(nodo_id: str, datos: Nodo):
    coleccion_nodos.update_one({"id": nodo_id}, {"$set": datos.dict()})
    return {"mensaje": "OK"}

@app.delete("/nodos/{nodo_id}")
async def eliminar_nodo(nodo_id: str):
    coleccion_nodos.delete_one({"id": nodo_id})
    return {"mensaje": "OK"}

@app.post("/nodos/{nodo_id}/restart")
async def reiniciar_nodo(nodo_id: str):
    mqtt_client.publish(f"{TOPIC_COMANDOS}{nodo_id}", json.dumps({"action": "reboot"}))
    return {"mensaje": "Enviado"}

@app.get("/")
def inicio(): return {"status": "HealthIoT Backend Online"}
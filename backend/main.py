from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import paho.mqtt.client as mqtt
import ssl
import json
import os
import jwt
from datetime import datetime, timedelta
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from pymongo import MongoClient
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURACIÓN DE SEGURIDAD (JWT) ---
SECRET_KEY = os.getenv("JWT_SECRET", "super_secret_key_utpl_2026_healthiot_security_hash")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# --- CREDENCIALES INFLUXDB ---
INFLUX_URL = os.getenv("INFLUX_URL", "https://us-east-1-1.aws.cloud2.influxdata.com")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "5j94SEjqRfX1jOwFcFL2WApRMm_qRhTNCK8DgKnJx5UyoEQM8FJuVG_49W4ZzFmU5XytuXvdL3qii454OkSQeg==")
INFLUX_ORG = "nodos"
INFLUX_BUCKET = "Monitoreo_UTPL"

influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
write_api = influx_client.write_api(write_options=SYNCHRONOUS)
query_api = influx_client.query_api()

# --- CREDENCIALES MONGODB ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://mejiafarith12:jyjHAF9YG0srzQaq@utpl.hpoaxun.mongodb.net/?appName=Utpl")
mongo_client = MongoClient(MONGO_URI)
db_mongo = mongo_client["HealthIoT"]
coleccion_usuarios = db_mongo["usuarios"]
coleccion_nodos = db_mongo["nodos"]
coleccion_config = db_mongo["configuracion"] 

# --- CREDENCIALES AWS IOT ---
AWS_ENDPOINT = "a3efp99tqsedcx-ats.iot.us-east-2.amazonaws.com"
TOPIC_TELEMETRIA = "utpl/telemetria"
TOPIC_COMANDOS = "utpl/comandos/"

app = FastAPI(title="Backend HealthIoT - UTPL - Secure Version")

# --- CONFIGURACIÓN ESTRICTA DE CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tesis-iot-ambiental.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- FUNCIONES DE SOPORTE CRIPTOGRÁFICO ---
def generar_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verificar_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

# --- MODELOS PYDANTIC (VALIDACIÓN) ---
class LoginRequest(BaseModel):
    email: str
    password: str

class Nodo(BaseModel):
    id: str
    ubicacion: str
    estado: str  
    latitud: float = Field(..., description="Coordenada geográfica Y")
    longitud: float = Field(..., description="Coordenada geográfica X")
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
        print(f"✅ Telemetría MQTT persistida automáticamente: {payload}")
    except Exception as e:
        print(f"❌ Error procesando paquete MQTT: {e}")

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
except Exception:
    print("⚠️ Revisa la disponibilidad de los certificados criptográficos X.509 en el directorio /certs")

@app.on_event("startup")
def startup_event():
    try:
        mqtt_client.connect(AWS_ENDPOINT, 8883, 60)
        mqtt_client.loop_start()
    except Exception as e:
        print(f"⚠️ No se pudo inicializar el demonio MQTT en startup: {e}")

# --- ENDPOINTS CONFIGURACIÓN (GLOBAL) ---
@app.get("/api/configuracion")
async def obtener_configuracion():
    config = coleccion_config.find_one({"_id": "politicas_globales"}, {"_id": 0})
    return config if config else {"umbral_pm25": 15.0, "umbral_pm10": 50.0, "limite_co2": 1000.0}

@app.put("/api/configuracion")
async def actualizar_configuracion(config: ConfiguracionAlerta, token_data: dict = Depends(verificar_token)):
    coleccion_config.update_one({"_id": "politicas_globales"}, {"$set": config.dict()}, upsert=True)
    return {"mensaje": "Políticas globales actualizadas exitosamente en base de datos"}

# --- ENDPOINTS AUTENTICACIÓN ---
@app.post("/login")
async def login(request: LoginRequest):
    usuario_db = coleccion_usuarios.find_one({"email": request.email})
    if not usuario_db or not pwd_context.verify(request.password, usuario_db["password"]):
        raise HTTPException(status_code=401, detail="Credenciales de acceso incorrectas")
    
    token_criptografico = generar_token(data={"sub": request.email})
    return {"token": token_criptografico, "user": request.email}

# --- ENDPOINTS TELEMETRÍA HISTÓRICA ---
@app.post("/api/telemetria")
async def recibir_telemetria(datos: DatosSensor):
    punto = Point("calidad_aire").tag("device", datos.device_id) \
        .field("pm25", float(datos.pm25)).field("pm10", float(datos.pm10)) \
        .field("co2", float(datos.co2)).field("temp", float(datos.temp)).field("hum", float(datos.hum))
    write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=punto)
    return {"estado": "éxito"}

@app.get("/api/history")
async def get_history(range_h: str = "24h", start_date: Optional[str] = None, end_date: Optional[str] = None):

    if start_date and end_date:
   
        inicio = f"{start_date}T00:00:00Z"
        fin = f"{end_date}T23:59:59Z"
        filtro_tiempo = f'range(start: {inicio}, stop: {fin})'
    else:
        # Si no hay calendario, usamos el rango relativo (ej. últimas 24 horas)
        tiempo_filtrado = f"{range_h}h" if range_h.isdigit() else range_h
        filtro_tiempo = f'range(start: -{tiempo_filtrado})'
    
    query = f'from(bucket: "{INFLUX_BUCKET}") |> {filtro_tiempo} |> filter(fn: (r) => r["_measurement"] == "calidad_aire") |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value") |> sort(columns: ["_time"], desc: false)'
    
    result = query_api.query(org=INFLUX_ORG, query=query)
    return [{"time": r.get_time().strftime('%Y-%m-%d %H:%M:%S'), **r.values} for table in result for r in table.records]

# --- CRUD DE NODOS (PROTEGIDO POR MIDDLEWARE JWT) ---
@app.get("/nodos", response_model=List[Nodo])
async def obtener_nodos(): 
    return list(coleccion_nodos.find({}, {"_id": 0}))

@app.post("/nodos")
async def registrar_nodo(nuevo_nodo: Nodo, token_data: dict = Depends(verificar_token)):
    if coleccion_nodos.find_one({"id": nuevo_nodo.id}): 
        raise HTTPException(status_code=400, detail="El identificador del dispositivo ya se encuentra registrado")
    coleccion_nodos.insert_one(nuevo_nodo.dict())
    return {"mensaje": "Dispositivo IoT registrado exitosamente"}

@app.put("/nodos/{nodo_id}")
async def editar_nodo(nodo_id: str, datos: Nodo, token_data: dict = Depends(verificar_token)):
    coleccion_nodos.update_one({"id": nodo_id}, {"$set": datos.dict()})
    return {"mensaje": "Metadatos del nodo actualizados correctamente"}

@app.delete("/nodos/{nodo_id}")
async def eliminar_nodo(nodo_id: str, token_data: dict = Depends(verificar_token)):
    coleccion_nodos.delete_one({"id": nodo_id})
    return {"mensaje": "Dispositivo removido de la infraestructura"}

@app.post("/nodos/{nodo_id}/restart")
async def reiniciar_nodo(nodo_id: str, token_data: dict = Depends(verificar_token)):
    mqtt_client.publish(f"{TOPIC_COMANDOS}{nodo_id}", json.dumps({"action": "reboot"}))
    return {"mensaje": "Comando de reinicio transmitido al broker de AWS"}

@app.get("/")
def inicio(): 
    return {"status": "HealthIoT Backend Online", "version": "1.2.0-Secure"}
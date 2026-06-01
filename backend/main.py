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

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    bateria: Optional[int] = 100 
    rssi: Optional[int] = -50    

class DatosSensor(BaseModel):
    device_id: str
    pm25: float
    co2: float
    temp: float

nodos_db = [
    {"id": "NODE-001", "ubicacion": "Av. del Maestro", "estado": "Activo", "bateria": 95, "rssi": -65},
    {"id": "CENTRO-01", "ubicacion": "Plaza Central", "estado": "Activo", "bateria": 80, "rssi": -70}
]

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ CONEXIÓN EXITOSA AL BROKER DE AWS")
        client.subscribe(TOPIC_TELEMETRIA)

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        
        point = Point("calidad_aire") \
            .tag("device", payload.get("sensor_id", "Nodo_Desconocido")) \
            .field("pm25", float(payload.get("pm25", 0))) \
            .field("co2", float(payload.get("co2", 0))) \
            .field("temp", float(payload.get("temp", 0)))
        
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
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
def startup_event():
    mqtt_client.connect(AWS_ENDPOINT, 8883, 60)
    mqtt_client.loop_start()

@app.post("/login")
async def login(request: LoginRequest):
    usuario_db = coleccion_usuarios.find_one({"email": request.email})
    if not usuario_db:
        raise HTTPException(status_code=404, detail="Usuario no registrado en el sistema")
    
    contrasena_valida = pwd_context.verify(request.password, usuario_db["password"])
    if not contrasena_valida:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    return {"token": "auth_token_utpl_2026", "user": request.email}

@app.post("/api/crear_admin_secreto")
async def crear_admin(usuario: NuevoUsuario):
    if coleccion_usuarios.find_one({"email": usuario.email}):
        raise HTTPException(status_code=400, detail="El usuario ya existe")
        
    password_hash = pwd_context.hash(usuario.password)
    
    nuevo_doc = {
        "email": usuario.email,
        "password": password_hash,
        "rol": "administrador"
    }
    coleccion_usuarios.insert_one(nuevo_doc)
    return {"mensaje": f"Usuario {usuario.email} creado con éxito en MongoDB"}

@app.post("/api/telemetria")
async def recibir_telemetria(datos: DatosSensor):
    try:
        punto = Point("calidad_aire") \
            .tag("device", datos.device_id) \
            .field("pm25", float(datos.pm25)) \
            .field("co2", float(datos.co2)) \
            .field("temp", float(datos.temp))
        
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=punto)
        return {"estado": "éxito", "mensaje": "Telemetría ambiental registrada en InfluxDB"}
    except Exception as e:
        return {"estado": "error", "mensaje": str(e)}

@app.get("/nodos", response_model=List[Nodo])
async def obtener_nodos():
    return nodos_db

@app.post("/nodos")
async def registrar_nodo(nuevo_nodo: Nodo):
    nodos_db.append(nuevo_nodo.dict())
    return {"mensaje": "Nodo registrado exitosamente"}

@app.put("/nodos/{nodo_id}")
async def editar_nodo(nodo_id: str, datos: Nodo):
    for i, nodo in enumerate(nodos_db):
        if nodo["id"] == nodo_id:
            nodos_db[i] = datos.dict()
            return {"mensaje": "Cambios guardados"}
    raise HTTPException(status_code=404, detail="Nodo no encontrado")

@app.delete("/nodos/{nodo_id}")
async def eliminar_nodo(nodo_id: str):
    global nodos_db
    nodos_db = [n for n in nodos_db if n["id"] != nodo_id]
    return {"mensaje": "Nodo removido de la red"}

@app.post("/nodos/{nodo_id}/restart")
async def reiniciar_nodo(nodo_id: str):
    comando = {"action": "reboot", "origin": "web_admin"}
    mqtt_client.publish(f"{TOPIC_COMANDOS}{nodo_id}", json.dumps(comando))
    return {"mensaje": f"Señal de reinicio enviada a {nodo_id}"}

@app.get("/api/history")
async def get_history(range_h: int = 24):
    query = f'''
        from(bucket: "{INFLUX_BUCKET}")
        |> range(start: -{range_h}h)
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
                "co2": record.values.get("co2"),
                "temp": record.values.get("temp"),
                "device": record.values.get("device")
            })
    return output

@app.get("/")
def inicio():
    return {"status": "HealthIoT Backend Online"}
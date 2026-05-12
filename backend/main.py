from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import paho.mqtt.client as mqtt
import ssl
import json

app = FastAPI(title="Backend de Monitoreo Ambiental - UTPL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite peticiones desde cualquier origen 
    allow_credentials=True,
    allow_methods=["*"],  # Permite POST, GET, OPTIONS, etc.
    allow_headers=["*"],  # Permite cualquier tipo de header
)

# --- CONFIGURACIÓN DE AWS IOT CORE ---
AWS_ENDPOINT = "a3efp99tqsedcx-ats.iot.us-east-2.amazonaws.com"
AWS_PORT = 8883
CLIENT_ID = "Backend_FastAPI_UTPL"
TOPIC_TELEMETRIA = "utpl/telemetria"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Conectado exitosamente a AWS IoT Core")
        client.subscribe(TOPIC_TELEMETRIA)
    else:
        print(f"❌ Error al conectar a AWS. Código: {rc}")

def on_message(client, userdata, msg):
    try:
        # Aquí es donde llega el dato del sensor (Ej: {"pm25": 15, "co2": 400})
        payload = json.loads(msg.payload.decode('utf-8'))
        print(f"📡 Nuevo dato recibido en {msg.topic}: {payload}")
        # Próximo paso: Aquí guardaremos este dato en InfluxDB
    except Exception as e:
        print(f"Error procesando mensaje: {e}")

# Inicializar cliente MQTT
mqtt_client = mqtt.Client(client_id=CLIENT_ID)
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

# Configurar los certificados de seguridad
try:
    mqtt_client.tls_set(
        ca_certs="certs/root-CA.pem",
        certfile="certs/certificate.pem.crt",
        keyfile="certs/private.pem.key",
        tls_version=ssl.PROTOCOL_TLSv1_2
    )
except Exception as e:
    print(f"⚠️ Error cargando certificados (Asegúrate de que la carpeta 'certs' exista): {e}")

# Evento de inicio de FastAPI: Arrancar la conexión MQTT en segundo plano
@app.on_event("startup")
def startup_event():
    try:
        mqtt_client.connect(AWS_ENDPOINT, AWS_PORT, 60)
        mqtt_client.loop_start()  # Mantiene la conexión viva en un hilo secundario
    except Exception as e:
        print(f"⚠️ No se pudo iniciar la conexión MQTT: {e}")


# --- MODELOS DE DATOS ---
class LoginRequest(BaseModel):
    username: str
    password: str

class Nodo(BaseModel):
    id: str
    ubicacion: str
    estado: str

# --- RUTAS ---
@app.get("/")
def inicio():
    return {"mensaje": "Servidor de Monitoreo Ambiental Activo y escuchando a AWS"}

@app.post("/auth/login")
async def login(data: LoginRequest):
    if data.username == "admin@tesis.com" and data.password == "12345":
        return {
            "access_token": "token_seguro_jwt_generado",
            "token_type": "bearer",
            "user": data.username
        }
    raise HTTPException(status_code=401, detail="Credenciales incorrectas")

# Simulación temporal de Nodos
nodos_db = [] 

@app.post("/nodos/registrar")
async def registrar_nodo(nodo: Nodo):
    nodos_db.append(nodo)
    return {"mensaje": f"Nodo {nodo.id} registrado exitosamente"}

@app.get("/nodos/estado", response_model=List[Nodo])
async def obtener_nodos():
    return nodos_db

@app.get("/api/history")
async def get_history(start_date: str = None, end_date: str = None):
    return [
        {"time": "08:00", "pm25": 12, "pm10": 30, "co2": 450, "temp": 22},
        {"time": "12:00", "pm25": 18, "pm10": 48, "co2": 600, "temp": 26},
        {"time": "16:00", "pm25": 25, "pm10": 55, "co2": 850, "temp": 28},
        {"time": "20:00", "pm25": 14, "pm10": 35, "co2": 500, "temp": 20}
    ]
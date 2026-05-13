from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import paho.mqtt.client as mqtt
import ssl
import json

app = FastAPI(title="Backend Monitoreo Ambiental UTPL - Farith")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURACIÓN DE AWS IOT CORE ---
AWS_ENDPOINT = "a3efp99tqsedcx-ats.iot.us-east-2.amazonaws.com"
AWS_PORT = 8883
CLIENT_ID = "Backend_FastAPI_UTPL"
TOPIC_TELEMETRIA = "utpl/telemetria"  

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ CONECTADO A AWS IOT CORE (UTPL)")
        client.subscribe(TOPIC_TELEMETRIA)
    else:
        print(f"❌ ERROR DE CONEXIÓN: {rc}")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        print(f"📡 DATO RECIBIDO EN {msg.topic}: {payload}")
    except Exception as e:
        print(f"Error procesando mensaje: {e}")

# Configurar cliente MQTT
mqtt_client = mqtt.Client(client_id=CLIENT_ID)
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

# Cargar Certificados 
try:
    mqtt_client.tls_set(
        ca_certs="certs/root-CA.pem",
        certfile="certs/certificate.pem.crt",
        keyfile="certs/private.pem.key",
        tls_version=ssl.PROTOCOL_TLSv1_2
    )
except Exception as e:
    print(f"⚠️ Error en certificados: {e}")

@app.on_event("startup")
def startup_event():
    try:
        mqtt_client.connect(AWS_ENDPOINT, AWS_PORT, 60)
        mqtt_client.loop_start()
        print("🚀 MQTT Escuchando...")
    except Exception as e:
        print(f"❌ No se pudo conectar a AWS: {e}")

# --- RUTAS ---
@app.get("/")
def inicio():
    return {"mensaje": "Servidor UTPL - Monitoreo Ambiental Activo"}

@app.post("/auth/login")
async def login(data: dict):
    if data.get("username") == "admin@tesis.com" and data.get("password") == "12345":
        return {"access_token": "token_utpl", "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="Error")

@app.get("/api/history")
async def get_history():
    return [{"time": "10:00", "pm25": 15, "co2": 400}]
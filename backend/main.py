from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import paho.mqtt.client as mqtt
import ssl
import json
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

# --- CONFIGURACIÓN INFLUXDB ---
INFLUX_URL = "https://us-east-1-1.aws.cloud2.influxdata.com"
INFLUX_TOKEN = "5j94SEjqRfX1jOwFcFL2WApRMm_qRhTNCK8DgKnJx5UyoEQM8FJuVG_49W4ZzFmU5XytuXvdL3qii454OkSQeg=="
INFLUX_ORG = "nodos"
INFLUX_BUCKET = "Monitoreo_UTPL"

influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
write_api = influx_client.write_api(write_options=SYNCHRONOUS)
query_api = influx_client.query_api()

# --- CONFIGURACIÓN AWS IOT CORE ---
AWS_ENDPOINT = "a3efp99tqsedcx-ats.iot.us-east-2.amazonaws.com"
TOPIC_TELEMETRIA = "utpl/telemetria"
TOPIC_COMANDOS = "utpl/comandos/" # Prefijo para enviar órdenes a los nodos

app = FastAPI(title="Backend Monitoreo Ambiental UTPL - Control Center")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS DE DATOS ---
class Nodo(BaseModel):
    id: str
    ubicacion: str
    estado: str  # "Activo", "Inactivo", "Mantenimiento"

# Simulación de base de datos de nodos (Para la sección de Gestión)
nodos_db = [
    {"id": "MAESTRO-01", "ubicacion": "Av. del Maestro y 18 de Nov.", "estado": "Activo"},
    {"id": "UTPL-02", "ubicacion": "Campus UTPL - Entrada Principal", "estado": "Mantenimiento"}
]

# --- LÓGICA MQTT ---
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ CONECTADO A AWS - SISTEMA DE CONTROL ACTIVO")
        client.subscribe(TOPIC_TELEMETRIA)

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        # GUARDAR EN INFLUXDB
        point = Point("calidad_aire") \
            .tag("device", payload.get("sensor_id", "Nodo_Desconocido")) \
            .field("pm25", float(payload.get("pm25", 0))) \
            .field("co2", float(payload.get("co2", 0))) \
            .field("temp", float(payload.get("temp", 0)))
        
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
    except Exception as e:
        print(f"❌ Error procesando telemetría: {e}")

mqtt_client = mqtt.Client(client_id="Backend_UTPL_Control")
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

try:
    mqtt_client.tls_set(ca_certs="certs/root-CA.pem", certfile="certs/certificate.pem.crt", keyfile="certs/private.pem.key", tls_version=ssl.PROTOCOL_TLSv1_2)
except:
    print("⚠️ Error cargando certificados de seguridad")

@app.on_event("startup")
def startup_event():
    mqtt_client.connect(AWS_ENDPOINT, 8883, 60)
    mqtt_client.loop_start()

# --- RUTAS DE ADMINISTRACIÓN DE NODOS ---

@app.get("/nodos", response_model=List[Nodo])
async def obtener_nodos():
    return nodos_db

@app.put("/nodos/{nodo_id}")
async def editar_nodo(nodo_id: str, datos: Nodo):
    for i, nodo in enumerate(nodos_db):
        if nodo["id"] == nodo_id:
            nodos_db[i] = datos.dict()
            return {"mensaje": f"Nodo {nodo_id} actualizado"}
    raise HTTPException(status_code=404, detail="Nodo no encontrado")

@app.post("/nodos/{nodo_id}/restart")
async def reiniciar_nodo(nodo_id: str):
    # Enviamos comando vía MQTT al hardware
    comando = {"action": "reboot", "origin": "dashboard_web"}
    mqtt_client.publish(f"{TOPIC_COMANDOS}{nodo_id}", json.dumps(comando))
    return {"mensaje": f"Orden de reinicio enviada al nodo {nodo_id}"}

# --- RUTA DE HISTORIAL PARA GRÁFICAS ---

@app.get("/api/history")
async def get_history(range_h: int = 24):
    # Consulta dinámica según las horas que pida el usuario
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
    return {"mensaje": "SANA-UTPL: Control Center Online"}
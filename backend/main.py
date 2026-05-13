from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import paho.mqtt.client as mqtt
import ssl
import json
from influxdb_client import InfluxDBClient, Point, WriteOptions
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

app = FastAPI(title="Backend Monitoreo Ambiental UTPL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ CONECTADO A AWS Y LISTO PARA GUARDAR EN INFLUXDB")
        client.subscribe(TOPIC_TELEMETRIA)

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        print(f"📡 Recibido: {payload}")
        
        # GUARDAR EN INFLUXDB
        point = Point("calidad_aire") \
            .tag("device", payload.get("sensor_id", "Nodo_Desconocido")) \
            .field("pm25", float(payload.get("pm25", 0))) \
            .field("co2", float(payload.get("co2", 0))) \
            .field("temp", float(payload.get("temp", 0)))
        
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
        print("💾 Dato guardado en InfluxDB exitosamente")
        
    except Exception as e:
        print(f"❌ Error al guardar en InfluxDB: {e}")

mqtt_client = mqtt.Client(client_id="Backend_UTPL_Final")
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

try:
    mqtt_client.tls_set(ca_certs="certs/root-CA.pem", certfile="certs/certificate.pem.crt", keyfile="certs/private.pem.key", tls_version=ssl.PROTOCOL_TLSv1_2)
except:
    print("⚠️ Error cargando certificados")

@app.on_event("startup")
def startup_event():
    mqtt_client.connect(AWS_ENDPOINT, 8883, 60)
    mqtt_client.loop_start()

@app.get("/")
def inicio():
    return {"mensaje": "Servidor UTPL - Telemetría e InfluxDB Activos"}

# --- RUTA PARA EL DASHBOARD (DATOS REALES) ---
@app.get("/api/history")
async def get_history():
    # Consulta los últimos 100 datos de las últimas 24 horas
    query = f'from(bucket: "{INFLUX_BUCKET}") |> range(start: -24h) |> filter(fn: (r) => r["_measurement"] == "calidad_aire") |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")'
    
    result = query_api.query(org=INFLUX_ORG, query=query)
    
    output = []
    for table in result:
        for record in table.records:
            output.append({
                "time": record.get_time().strftime('%H:%M:%S'),
                "pm25": record.values.get("pm25"),
                "co2": record.values.get("co2"),
                "temp": record.values.get("temp")
            })
    return output
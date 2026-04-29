import time
import json
import random
import paho.mqtt.client as mqtt

# Configuración idéntica a tu main.py
BROKER = "broker.emqx.io"
PORT = 1883
TOPIC = "sensores/utpl/aire"

client = mqtt.Client()

try:
    client.connect(BROKER, PORT, 60)
    print("📡 Estación UTPL conectada. Iniciando transmisión de datos respiratorios...")
except Exception as e:
    print(f"❌ Error conectando al broker: {e}")
    print("⚠️ ¿Aseguraste de tener Mosquitto instalado y corriendo?")
    exit()

while True:
    # Generar datos simulados realistas
    pm25_val = round(random.uniform(5.0, 45.0), 1)
    
    payload = {
        "pm25": pm25_val,
        "pm10": round(pm25_val * random.uniform(1.2, 2.5), 1), # PM10 simulado realista
        "co2": round(random.uniform(400.0, 1100.0), 1),
        "temp": round(random.uniform(15.0, 25.0), 1),
        "hum": round(random.uniform(40.0, 80.0), 1)
    }

    mensaje = json.dumps(payload)
    client.publish(TOPIC, mensaje)
    
    print(f"📤 [Transmitiendo a {TOPIC}]: {mensaje}")
    
    time.sleep(5) # Envía datos cada 5 segundos
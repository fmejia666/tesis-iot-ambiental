from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI(title="Backend de Monitoreo Ambiental - Av. del Maestro")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite peticiones desde cualquier origen (tu React)
    allow_credentials=True,
    allow_methods=["*"],  # Permite POST, GET, OPTIONS, etc.
    allow_headers=["*"],  # Permite cualquier tipo de header
)
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
    return {"mensaje": "Servidor de Monitoreo Ambiental Activo"}

@app.post("/auth/login")
async def login(data: LoginRequest):
    # Validación de credenciales administrativas
    if data.username == "admin@tesis.com" and data.password == "12345":
        return {
            "access_token": "token_seguro_jwt_generado",
            "token_type": "bearer",
            "user": data.username
        }
    
    # Bloqueo de acceso no autorizado
    raise HTTPException(status_code=401, detail="Credenciales incorrectas")

# HU-03: Gestión de Nodos (Sprint 2)
nodos_db = [] # Simulación temporal antes de conectar InfluxDB

@app.post("/nodos/registrar")
async def registrar_nodo(nodo: Nodo):
    nodos_db.append(nodo)
    return {"mensaje": f"Nodo {nodo.id} registrado exitosamente"}

@app.get("/nodos/estado", response_model=List[Nodo])
async def obtener_nodos():
    return nodos_db
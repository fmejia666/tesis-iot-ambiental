import React, { useState } from 'react';

function Login() {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const manejarIngreso = async (e) => {
    e.preventDefault();
    
    try {
        const respuesta = await fetch('https://tesis-iot-ambiental.onrender.com/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: correo, password: password })
      });

      if (!respuesta.ok) {
        throw new Error('Credenciales incorrectas. Acceso denegado.');
      }

      const datos = await respuesta.json();
      
      // 1. Guardamos el token en la memoria del navegador
      localStorage.setItem('token', datos.access_token);
      setError('');
      alert('¡Autenticación exitosa!');
      
      // 2. EL TRUCO: Forzamos una recarga completa hacia la página principal
      window.location.href = '/'; 

    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
        <h2 style={{ textAlign: 'center', color: '#333' }}>Acceso Técnico</h2>
        
        <form onSubmit={manejarIngreso} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Correo Electrónico:</label>
            <input 
              type="email" 
              value={correo} 
              onChange={(e) => setCorreo(e.target.value)} 
              placeholder="admin@tesis.com"
              required 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Contraseña:</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="*****"
              required 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          
          <button 
            type="submit" 
            style={{ padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Ingresar al Sistema
          </button>
        </form>

        {error && (
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '4px', textAlign: 'center' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
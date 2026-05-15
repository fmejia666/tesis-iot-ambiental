import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, AlertCircle } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // IMPORTANTE: Esta URL debe ser la de tu Render
      const response = await fetch("https://tesis-iot-ambiental.onrender.com/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,       // El backend espera "email"
          password: password  // El backend espera "password"
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Guardamos el token que configuramos en FastAPI
        localStorage.setItem('token', data.token);
        // Redirigimos al Dashboard
        navigate('/');
      } else {
        setError(data.detail || 'Acceso denegado. Revisa tus credenciales.');
      }
    } catch (err) {
      setError('Error de conexión con el servidor. ¿Está Render activo?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 border border-gray-100">
        <div className="text-center mb-10">
          <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="text-blue-600" size={32} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter">ACCESO TÉCNICO</h2>
          <p className="text-gray-400 font-bold text-sm uppercase mt-1">Panel de Control HealthIoT</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <Mail className="absolute left-4 top-4 text-gray-400" size={20} />
            <input
              type="email"
              placeholder="Correo electrónico"
              className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl p-4 pl-12 outline-none font-bold transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-4 text-gray-400" size={20} />
            <input
              type="password"
              placeholder="Contraseña"
              className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl p-4 pl-12 outline-none font-bold transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-shake">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black shadow-lg shadow-blue-100 transition-all flex justify-center items-center"
          >
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'INICIAR SESIÓN'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
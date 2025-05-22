/**
 * auth.js
 * Maneja la autenticación del usuario (login, logout) y el estado de sesión.
 */

// Constantes para las claves de localStorage (ayuda a evitar errores tipográficos)
const AUTH_TOKEN_KEY = 'authToken';
const USERNAME_KEY = 'username';
const IS_LOGGED_IN_KEY = 'isLoggedIn';

/**
 * Simula el proceso de login.
 * En una aplicación real, esto implicaría una llamada a un backend.
 * @param {string} username El nombre de usuario ingresado.
 * @param {string} password La contraseña ingresada.
 * @returns {Promise<boolean>} True si el login es exitoso, false en caso contrario.
 */
async function loginUser(username, password) {
    // --- SIMULACIÓN DE AUTENTICACIÓN ---
    // Reemplaza esto con una llamada a tu API de backend en una aplicación real.
    // Por ahora, usaremos credenciales hardcodeadas para demostración.
    const MOCK_USERNAME = 'admin';
    const MOCK_PASSWORD = 'password123';

    return new Promise(resolve => {
        setTimeout(() => { // Simula la demora de una llamada de red
            if (username === MOCK_USERNAME && password === MOCK_PASSWORD) {
                // Login exitoso
                localStorage.setItem(AUTH_TOKEN_KEY, 'fake-jwt-token-' + Date.now()); // Simula un token
                localStorage.setItem(USERNAME_KEY, username);
                localStorage.setItem(IS_LOGGED_IN_KEY, 'true');
                resolve(true);
            } else {
                // Login fallido
                resolve(false);
            }
        }, 500); // Simula 0.5 segundos de demora
    });
}

/**
 * Cierra la sesión del usuario.
 */
function logoutUser() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(IS_LOGGED_IN_KEY);
    // Redirigir a la página de login
    window.location.href = 'index.html';
}

/**
 * Verifica si el usuario está actualmente logueado.
 * @returns {boolean} True si el usuario está logueado, false en caso contrario.
 */
function isUserLoggedIn() {
    return localStorage.getItem(IS_LOGGED_IN_KEY) === 'true' && !!localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Obtiene el nombre del usuario autenticado.
 * @returns {string|null} El nombre de usuario si está logueado, o null.
 */
function getAuthenticatedUsername() {
    if (isUserLoggedIn()) {
        return localStorage.getItem(USERNAME_KEY);
    }
    return null;
}

// --- Lógica específica para la página de LOGIN (index.html) ---
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginErrorMessageDiv = document.getElementById('loginErrorMessage');

    if (loginForm) { // Asegurarse de que este código solo se ejecute si el formulario de login existe
        
        // Opcional: si el usuario ya está logueado y visita index.html, redirigir a main.html
        if (isUserLoggedIn() && window.location.pathname.includes('index.html')) {
            window.location.href = 'main.html';
            return; // Detener ejecución para evitar procesar el formulario
        }

        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevenir el envío tradicional del formulario

            const usernameInput = document.getElementById('usernameInput');
            const passwordInput = document.getElementById('passwordInput');
            
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                if (loginErrorMessageDiv) {
                    loginErrorMessageDiv.textContent = 'Por favor, ingresa usuario y contraseña.';
                    loginErrorMessageDiv.classList.remove('d-none');
                }
                return;
            }

            // Deshabilitar botón mientras se procesa para evitar múltiples envíos
            const submitButton = loginForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.disabled = true;


            try {
                const loginSuccess = await loginUser(username, password);

                if (loginSuccess) {
                    window.location.href = 'main.html'; // Redirigir a la página principal
                } else {
                    if (loginErrorMessageDiv) {
                        loginErrorMessageDiv.textContent = 'Usuario o contraseña incorrectos.';
                        loginErrorMessageDiv.classList.remove('d-none');
                    }
                    // Limpiar campo de contraseña por seguridad
                    if (passwordInput) passwordInput.value = ''; 
                }
            } catch (error) {
                console.error('Error durante el login:', error);
                if (loginErrorMessageDiv) {
                    loginErrorMessageDiv.textContent = 'Ocurrió un error al intentar iniciar sesión. Inténtalo de nuevo.';
                    loginErrorMessageDiv.classList.remove('d-none');
                }
            } finally {
                 if (submitButton) submitButton.disabled = false; // Rehabilitar el botón
            }
        });
    }

    // Nota: La lógica para el botón de logout y la protección de rutas
    // generalmente se maneja en app.js (para main.html) o en la parte superior
    // de los scripts de las páginas protegidas.
    // El botón de logout en main.html llamará a `logoutUser()`.
});
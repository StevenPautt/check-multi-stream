// js/auth.js

const AUTH_TOKEN_KEY = 'authToken';
const USERNAME_KEY = 'username';
const IS_LOGGED_IN_KEY = 'isLoggedIn';

async function loginUser(username, password) {
    const MOCK_USERNAME = 'admin';
    const MOCK_PASSWORD = 'password123';

    return new Promise(resolve => {
        setTimeout(() => {
            if (username === MOCK_USERNAME && password === MOCK_PASSWORD) {
                localStorage.setItem(AUTH_TOKEN_KEY, 'fake-jwt-token-' + Date.now());
                localStorage.setItem(USERNAME_KEY, username);
                localStorage.setItem(IS_LOGGED_IN_KEY, 'true');
                resolve(true);
            } else {
                resolve(false);
            }
        }, 500);
    });
}

function logoutUser() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(IS_LOGGED_IN_KEY);
    window.location.href = 'index.html';
}

function isUserLoggedIn() {
    return localStorage.getItem(IS_LOGGED_IN_KEY) === 'true' && !!localStorage.getItem(AUTH_TOKEN_KEY);
}

function getAuthenticatedUsername() {
    if (isUserLoggedIn()) {
        return localStorage.getItem(USERNAME_KEY);
    }
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginErrorMessageDiv = document.getElementById('loginErrorMessage');

    if (loginForm) {
        if (isUserLoggedIn() && (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/'))) {
            window.location.href = 'main.html';
            return; 
        }

        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const usernameInput = document.getElementById('usernameInput');
            const passwordInput = document.getElementById('passwordInput');
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (loginErrorMessageDiv) loginErrorMessageDiv.classList.add('d-none'); // Hide previous error

            if (!username || !password) {
                if (loginErrorMessageDiv) {
                    loginErrorMessageDiv.textContent = 'Please enter both username and password.'; // English
                    loginErrorMessageDiv.classList.remove('d-none');
                }
                return;
            }

            const submitButton = loginForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.disabled = true;

            try {
                const loginSuccess = await loginUser(username, password);
                if (loginSuccess) {
                    window.location.href = 'main.html';
                } else {
                    if (loginErrorMessageDiv) {
                        loginErrorMessageDiv.textContent = 'Incorrect username or password.'; // English
                        loginErrorMessageDiv.classList.remove('d-none');
                    }
                    if (passwordInput) passwordInput.value = '';
                }
            } catch (error) {
                console.error('Login error:', error);
                if (loginErrorMessageDiv) {
                    loginErrorMessageDiv.textContent = 'An error occurred during login. Please try again.'; // English
                    loginErrorMessageDiv.classList.remove('d-none');
                }
            } finally {
                 if (submitButton) submitButton.disabled = false;
            }
        });
    }
});
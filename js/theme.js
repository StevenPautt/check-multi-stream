/**
 * theme.js
 * Maneja la lógica para cambiar entre tema claro y oscuro.
 * Persiste la preferencia del usuario en localStorage.
 */

document.addEventListener('DOMContentLoaded', () => {
    const themeToggleCheckbox = document.getElementById('themeToggleCheckbox');
    const currentTheme = localStorage.getItem('theme');

    // Función para aplicar el tema y actualizar el estado del checkbox
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (themeToggleCheckbox) {
            themeToggleCheckbox.checked = theme === 'dark';
        }
    }

    // Función para establecer y guardar el tema
    function setTheme(theme) {
        applyTheme(theme);
        localStorage.setItem('theme', theme);
    }

    // Al cargar la página, aplicar el tema guardado o el preferido por el sistema
    if (currentTheme) {
        applyTheme(currentTheme);
    } else {
        // Si no hay tema guardado, intentar detectar la preferencia del sistema
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light'); // Establece y guarda el tema detectado o el claro por defecto
    }

    // Event listener para el interruptor de tema
    if (themeToggleCheckbox) {
        themeToggleCheckbox.addEventListener('change', function() {
            setTheme(this.checked ? 'dark' : 'light');
        });
    }

    // Opcional: Escuchar cambios en la preferencia del sistema operativo mientras la página está abierta
    // Esto es más avanzado y podría no ser necesario para todos los casos de uso.
    /*
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        // Solo cambiar si no hay una preferencia explícita guardada por el usuario
        if (!localStorage.getItem('theme_explicitly_set')) { // Necesitarías una bandera extra
             setTheme(event.matches ? 'dark' : 'light');
        }
    });
    */
});
// js/config.js (actualizado)
const CONFIG = {
    // URL de tu Web App de Google Apps Script
    API_URL: 'https://script.google.com/macros/s/TU_ID_APP_SCRIPT/exec',
    
    // Clave pública de MercadoPago
    MP_PUBLIC_KEY: 'TEST-xxxx-xxxx-xxxx-xxxx',
    
    // URLs de las páginas
    URLS: {
        SUCCESS: 'https://tusuario.github.io/run4paz/exito.html',
        FAILURE: 'https://tusuario.github.io/run4paz/fallo.html',
        PENDING: 'https://tusuario.github.io/run4paz/pendiente.html'
    }
};

// Configuración de donaciones
const DONATION_CONFIG = {
    MIN_AMOUNT: 10,
    MAX_AMOUNT: 10000,
    GOAL: 100000,
    CAUSES: {
        VISUAL_AID: 'Apoyo a niños con discapacidad visual',
        SPORTS_EQUIPMENT: 'Equipo y materiales deportivos',
        EVENT_OPERATION: 'Operación del evento',
        ADMIN: 'Gastos administrativos'
    }
};
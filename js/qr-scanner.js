// js/qr-scanner.js
// Librería para escanear códigos QR en la entrada del evento

class QRScanner {
    constructor() {
        this.scanner = null;
        this.isScanning = false;
        this.onSuccessCallback = null;
        this.onErrorCallback = null;
    }

    /**
     * Inicializa el escáner QR
     * @param {string} elementId - ID del elemento contenedor
     * @param {object} callbacks - Funciones callback
     */
    async init(elementId, callbacks = {}) {
        this.onSuccessCallback = callbacks.onSuccess;
        this.onErrorCallback = callbacks.onError;
        
        // Verificar si el navegador soporta la cámara
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('Tu navegador no soporta acceso a la cámara');
            return false;
        }

        try {
            // Solicitar permiso de cámara
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            
            // Crear instancia de Html5Qrcode
            this.scanner = new Html5Qrcode(elementId);
            return true;
        } catch (error) {
            this.showError('No se pudo acceder a la cámara');
            console.error('Error accessing camera:', error);
            return false;
        }
    }

    /**
     * Inicia el escaneo
     */
    async startScanning() {
        if (!this.scanner || this.isScanning) return;
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };
        
        try {
            await this.scanner.start(
                { facingMode: "environment" },
                config,
                (decodedText) => this.onScanSuccess(decodedText),
                (errorMessage) => this.onScanError(errorMessage)
            );
            this.isScanning = true;
            this.showStatus('📷 Escaneando... Apunta al código QR', 'info');
        } catch (error) {
            console.error('Error starting scanner:', error);
            this.showError('No se pudo iniciar el escáner');
        }
    }

    /**
     * Detiene el escaneo
     */
    async stopScanning() {
        if (this.scanner && this.isScanning) {
            try {
                await this.scanner.stop();
                this.isScanning = false;
                this.showStatus('Escáner detenido', 'info');
            } catch (error) {
                console.error('Error stopping scanner:', error);
            }
        }
    }

    /**
     * Callback cuando se escanea un código exitosamente
     */
    async onScanSuccess(decodedText) {
        try {
            // Detener escaneo temporalmente
            await this.stopScanning();
            
            // Reproducir sonido de éxito
            this.playBeep();
            
            // Parsear el QR
            let qrData;
            try {
                qrData = JSON.parse(decodedText);
            } catch (e) {
                // Si no es JSON, intentar como URL
                qrData = { url: decodedText };
            }
            
            // Validar el código con el servidor
            const validation = await this.validateQR(qrData);
            
            if (validation.valid) {
                this.showSuccess(`✅ Acceso autorizado - ${validation.nombre}`);
                if (this.onSuccessCallback) {
                    this.onSuccessCallback(validation);
                }
                // Registrar entrada
                await this.registerCheckin(qrData.folio || qrData.folio);
            } else {
                this.showError(`❌ Acceso denegado: ${validation.message || 'QR inválido'}`);
                if (this.onErrorCallback) {
                    this.onErrorCallback(validation);
                }
            }
            
            // Reactivar escaneo después de 3 segundos
            setTimeout(() => {
                this.startScanning();
            }, 3000);
            
        } catch (error) {
            console.error('Error processing QR:', error);
            this.showError('Error al procesar el código QR');
            setTimeout(() => this.startScanning(), 3000);
        }
    }

    /**
     * Callback cuando hay error en el escaneo
     */
    onScanError(errorMessage) {
        // No mostrar todos los errores para no saturar
        if (errorMessage.includes('No QR code found')) return;
        console.warn('Scan error:', errorMessage);
    }

    /**
     * Valida el QR con el backend
     */
    async validateQR(qrData) {
        try {
            const response = await fetch(`${CONFIG.API_URL}?action=validateQR`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(qrData)
            });
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error validating QR:', error);
            return { valid: false, message: 'Error de conexión' };
        }
    }

    /**
     * Registra el check-in del participante
     */
    async registerCheckin(folio) {
        try {
            await fetch(`${CONFIG.API_URL}?action=checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    folio: folio,
                    timestamp: new Date().toISOString(),
                    device: navigator.userAgent
                })
            });
        } catch (error) {
            console.error('Error registering checkin:', error);
        }
    }

    /**
     * Reproduce sonido de éxito
     */
    playBeep() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 880;
            gainNode.gain.value = 0.3;
            
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            // Fallback: beep con Audio
            const audio = new Audio('data:audio/wav;base64,U3RlYWx0aCBzb3VuZA==');
            audio.play().catch(e => console.log('Audio not supported'));
        }
    }

    /**
     * Muestra mensaje de estado
     */
    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('scanner-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `scanner-status scanner-${type}`;
        }
    }

    showSuccess(message) {
        this.showStatus(message, 'success');
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showStatus(message, 'error');
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        if (window.app && window.app.showNotification) {
            window.app.showNotification(message, type);
        } else {
            alert(message);
        }
    }

    /**
     * Destruye el escáner
     */
    async destroy() {
        await this.stopScanning();
        if (this.scanner) {
            await this.scanner.clear();
            this.scanner = null;
        }
    }
}

// Página de validación para el evento
class EventValidationPage {
    constructor() {
        this.scanner = new QRScanner();
        this.validatedCount = 0;
        this.init();
    }

    async init() {
        // Crear UI de validación
        this.createUI();
        
        // Inicializar escáner
        const success = await this.scanner.init('qr-reader', {
            onSuccess: (data) => this.handleValidation(data),
            onError: (error) => this.handleError(error)
        });
        
        if (success) {
            await this.scanner.startScanning();
            this.updateStats();
        }
    }

    createUI() {
        const container = document.createElement('div');
        container.className = 'validation-container';
        container.innerHTML = `
            <div class="validation-header">
                <h1>🎫 Validación de accesos RUN4PAZ</h1>
                <p>Escanee el código QR de los participantes</p>
            </div>
            
            <div class="validation-stats">
                <div class="stat-card">
                    <div class="stat-number" id="validated-count">0</div>
                    <div class="stat-label">Accesos registrados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="total-inscritos">-</div>
                    <div class="stat-label">Total inscritos</div>
                </div>
            </div>
            
            <div class="scanner-container">
                <div id="qr-reader" class="qr-reader"></div>
                <div id="scanner-status" class="scanner-status">Iniciando escáner...</div>
            </div>
            
            <div class="last-validations">
                <h3>Últimos accesos</h3>
                <div id="validations-list" class="validations-list"></div>
            </div>
            
            <button class="btn-secondary" onclick="location.reload()">Reiniciar escáner</button>
        `;
        
        document.body.appendChild(container);
        
        // Agregar estilos
        this.addStyles();
    }

    async handleValidation(data) {
        // Mostrar información del participante
        const validationList = document.getElementById('validations-list');
        const validationItem = document.createElement('div');
        validationItem.className = 'validation-item success';
        validationItem.innerHTML = `
            <span class="time">${new Date().toLocaleTimeString()}</span>
            <span class="name">${data.nombre}</span>
            <span class="folio">${data.folio}</span>
            <span class="status">✅ Acceso autorizado</span>
        `;
        
        validationList.insertBefore(validationItem, validationList.firstChild);
        
        this.validatedCount++;
        document.getElementById('validated-count').textContent = this.validatedCount;
        
        // Limitar lista a 10 items
        while (validationList.children.length > 10) {
            validationList.removeChild(validationList.lastChild);
        }
    }

    handleError(error) {
        const validationList = document.getElementById('validations-list');
        const validationItem = document.createElement('div');
        validationItem.className = 'validation-item error';
        validationItem.innerHTML = `
            <span class="time">${new Date().toLocaleTimeString()}</span>
            <span class="name">Intento inválido</span>
            <span class="status">❌ ${error.message || 'Acceso denegado'}</span>
        `;
        
        validationList.insertBefore(validationItem, validationList.firstChild);
    }

    async updateStats() {
        try {
            const response = await fetch(`${CONFIG.API_URL}?action=getStats`);
            const stats = await response.json();
            document.getElementById('total-inscritos').textContent = stats.total_inscritos || 0;
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .validation-container {
                max-width: 800px;
                margin: 0 auto;
                padding: 2rem;
                font-family: 'Poppins', sans-serif;
            }
            .validation-header {
                text-align: center;
                margin-bottom: 2rem;
            }
            .validation-stats {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1rem;
                margin-bottom: 2rem;
            }
            .stat-card {
                background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
                color: white;
                padding: 1.5rem;
                border-radius: var(--border-radius);
                text-align: center;
            }
            .stat-number {
                font-size: 2.5rem;
                font-weight: 700;
            }
            .scanner-container {
                background: black;
                border-radius: var(--border-radius);
                overflow: hidden;
                margin-bottom: 2rem;
            }
            .qr-reader {
                width: 100%;
                min-height: 400px;
            }
            .scanner-status {
                padding: 1rem;
                text-align: center;
                background: var(--bg-gray);
            }
            .scanner-success {
                background: var(--success);
                color: white;
            }
            .scanner-error {
                background: var(--error);
                color: white;
            }
            .validations-list {
                max-height: 300px;
                overflow-y: auto;
                margin: 1rem 0;
            }
            .validation-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.75rem;
                margin: 0.5rem 0;
                background: var(--bg-light);
                border-radius: var(--border-radius);
                border-left: 4px solid;
            }
            .validation-item.success {
                border-left-color: var(--success);
            }
            .validation-item.error {
                border-left-color: var(--error);
            }
            .validation-item .time {
                font-size: 0.8rem;
                color: var(--text-light);
            }
            .validation-item .name {
                font-weight: 600;
            }
            .validation-item .folio {
                font-family: monospace;
                font-size: 0.85rem;
            }
        `;
        document.head.appendChild(style);
    }
}

// Inicializar si estamos en la página de validación
if (window.location.pathname.includes('validar.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        new EventValidationPage();
    });
}
// js/app.js - Versión COMPLETA con Firestore
class Run4PazApp {
    constructor() {
        this.currentUser = null;
        this.currentStep = 1;
        this.registrationData = {};
        this.init();
    }
    
    async init() {
        // Esperar autenticación
        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                this.loadDistances();
                this.loadExtras();
                this.startRealTimeStats();
                this.setupEventListeners();
                this.checkFolioInURL();
            } else if (!window.location.pathname.includes('login.html') && 
                       !window.location.pathname.includes('register.html')) {
                // Si no está logueado y no está en login/register, redirigir
                window.location.href = 'login.html';
            }
        });
    }
    
    async loadDistances() {
        try {
            const snapshot = await db.collection('distancias').where('activo', '==', true).get();
            const distances = [];
            snapshot.forEach(doc => distances.push({ id: doc.id, ...doc.data() }));
            this.renderDistances(distances);
        } catch (error) {
            console.error('Error cargando distancias:', error);
            this.showNotification('Error al cargar distancias', 'error');
        }
    }
    
    async loadExtras() {
        try {
            const snapshot = await db.collection('extras').where('activo', '==', true).get();
            const extras = [];
            snapshot.forEach(doc => extras.push({ id: doc.id, ...doc.data() }));
            this.renderExtras(extras);
        } catch (error) {
            console.error('Error cargando extras:', error);
            this.showNotification('Error al cargar extras', 'error');
        }
    }
    
    renderDistances(distances) {
        const container = document.getElementById('distance-options');
        if (!container) return;
        
        container.innerHTML = distances.map(dist => `
            <div class="distance-card" data-id="${dist.id}" data-price="${dist.precio}" data-name="${dist.nombre}">
                <h3>${dist.nombre}</h3>
                <p class="price">$${dist.precio} MXN</p>
                <p class="description">${dist.descripcion || ''}</p>
                <button class="btn-select-distance">Seleccionar</button>
            </div>
        `).join('');
        
        document.querySelectorAll('.btn-select-distance').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.distance-card');
                this.selectDistance(
                    card.dataset.id,
                    card.dataset.name,
                    card.dataset.price
                );
            });
        });
    }
    
    renderExtras(extras) {
        const container = document.getElementById('extras-grid');
        if (!container) return;
        
        container.innerHTML = extras.map(extra => `
            <label class="extra-card">
                <input type="checkbox" name="extra" value="${extra.id}" 
                       data-name="${extra.nombre}" data-price="${extra.precio}">
                <div class="extra-content">
                    <h3>${extra.nombre}</h3>
                    <p class="price">$${extra.precio} MXN</p>
                    <p class="description">${extra.descripcion || ''}</p>
                </div>
            </label>
        `).join('');
    }
    
    selectDistance(id, name, price) {
        this.registrationData.distancia_id = id;
        this.registrationData.distancia_nombre = name;
        this.registrationData.distancia_precio = parseInt(price);
        this.goToStep(2);
    }
    
    async submitRegistration(formData) {
        if (!this.currentUser) {
            this.showNotification('Debes iniciar sesión primero', 'error');
            window.location.href = 'login.html';
            return;
        }
        
        if (!this.validateForm(formData)) {
            this.showNotification('Por favor, completa todos los campos requeridos', 'error');
            return;
        }
        
        this.showLoading();
        
        try {
            // Generar folio único
            const folio = `RUN4PAZ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            
            // Calcular total
            const total = this.calculateTotal();
            
            // Guardar inscripción en Firestore
            const inscripcion = {
                userId: this.currentUser.uid,
                folio: folio,
                nombre: formData.nombre,
                email: formData.email,
                genero: formData.genero || '',
                telefono: formData.telefono,
                pais: formData.pais || 'México',
                talla: formData.talla || 'M',
                distanciaId: this.registrationData.distancia_id,
                distanciaNombre: this.registrationData.distancia_nombre,
                distanciaPrecio: this.registrationData.distancia_precio,
                extras: this.getSelectedExtras(),
                emergencyContact: {
                    nombre: formData.emergency_contact?.nombre || '',
                    telefono: formData.emergency_contact?.telefono || '',
                    pais: formData.emergency_contact?.pais || 'México'
                },
                pagoStatus: 'pending',
                total: total,
                fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('inscripciones').add(inscripcion);
            
            // Actualizar usuario
            await db.collection('users').doc(this.currentUser.uid).set({
                nombre: formData.nombre,
                email: formData.email,
                telefono: formData.telefono,
                talla: formData.talla,
                tieneInscripcion: true,
                folioActual: folio,
                ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            this.showNotification('¡Inscripción registrada! Procede al pago', 'success');
            
            // Guardar en localStorage y redirigir
            localStorage.setItem('run4paz_folio', folio);
            localStorage.setItem('run4paz_total', total);
            window.location.href = `pago.html?folio=${folio}&total=${total}`;
            
        } catch (error) {
            console.error('Error en registro:', error);
            this.showNotification('Error al procesar la inscripción: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    async loadParticipantData(folio) {
        this.showLoading();
        
        try {
            const snapshot = await db.collection('inscripciones')
                .where('folio', '==', folio)
                .limit(1)
                .get();
            
            if (snapshot.empty) {
                this.showNotification('No se encontró la inscripción', 'error');
                return;
            }
            
            const participant = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            this.renderParticipantPanel(participant);
            
        } catch (error) {
            console.error('Error cargando datos:', error);
            this.showNotification('Error al cargar tus datos', 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    renderParticipantPanel(participant) {
        // Actualizar elementos del panel
        const folioSpan = document.getElementById('folio');
        if (folioSpan) folioSpan.textContent = participant.folio || '-';
        
        const nombreSpan = document.getElementById('nombre-participante');
        if (nombreSpan) nombreSpan.textContent = participant.nombre || '-';
        
        const emailSpan = document.getElementById('email-participante');
        if (emailSpan) emailSpan.textContent = participant.email || '-';
        
        const telefonoSpan = document.getElementById('telefono-participante');
        if (telefonoSpan) telefonoSpan.textContent = participant.telefono || '-';
        
        const distanciaSpan = document.getElementById('distancia-participante');
        if (distanciaSpan) distanciaSpan.textContent = participant.distanciaNombre || '-';
        
        const tallaSpan = document.getElementById('talla-participante');
        if (tallaSpan) tallaSpan.textContent = participant.talla || '-';
        
        const totalSpan = document.getElementById('total-pagado');
        if (totalSpan) totalSpan.textContent = `$${participant.total || 0} MXN`;
        
        // Estado de pago
        const statusElement = document.getElementById('payment-status');
        if (statusElement) {
            if (participant.pagoStatus === 'paid') {
                statusElement.innerHTML = '✅ Pago confirmado';
                statusElement.className = 'status-paid';
                const kitRetiro = document.getElementById('kit-retiro');
                if (kitRetiro) kitRetiro.style.display = 'block';
            } else {
                statusElement.innerHTML = '⏳ Pendiente de pago';
                statusElement.className = 'status-pending';
            }
        }
        
        // Contacto de emergencia
        const emergenciaInfo = document.getElementById('emergencia-info');
        if (emergenciaInfo && participant.emergencyContact) {
            emergenciaInfo.innerHTML = `
                <p><strong>Contacto:</strong> ${participant.emergencyContact.nombre || '-'}</p>
                <p><strong>Teléfono:</strong> ${participant.emergencyContact.telefono || '-'}</p>
                <p><strong>País:</strong> ${participant.emergencyContact.pais || '-'}</p>
            `;
        }
        
        // Extras
        const extrasList = document.getElementById('extras-list');
        if (extrasList && participant.extras && participant.extras.length > 0) {
            extrasList.innerHTML = participant.extras.map(extra => `
                <li>${extra.name} - $${extra.price} MXN</li>
            `).join('');
        }
        
        // QR Code (simulado por ahora)
        const qrContainer = document.getElementById('qr-code');
        if (qrContainer) {
            qrContainer.innerHTML = `
                <div style="text-align: center;">
                    <div style="width: 200px; height: 200px; background: #f0f4f8; display: flex; align-items: center; justify-content: center; margin: 0 auto; border-radius: 10px;">
                        📱 Código QR<br>${participant.folio}
                    </div>
                    <button class="btn-secondary" style="margin-top: 1rem;" onclick="window.app.downloadQR()">Descargar QR</button>
                </div>
            `;
        }
    }
    
    async startRealTimeStats() {
        // Escuchar cambios en tiempo real
        db.collection('inscripciones')
            .where('pagoStatus', '==', 'paid')
            .onSnapshot((snapshot) => {
                const totalInscritos = snapshot.size;
                let totalRecaudado = 0;
                snapshot.forEach(doc => {
                    totalRecaudado += doc.data().distanciaPrecio || 0;
                });
                
                const counterEl = document.getElementById('counter');
                if (counterEl) counterEl.innerText = `${totalInscritos} inscritos`;
                
                const progressFill = document.getElementById('progress-fill');
                if (progressFill) {
                    const porcentaje = (totalRecaudado / 100000) * 100;
                    progressFill.style.width = `${Math.min(porcentaje, 100)}%`;
                }
                
                const recaudadoEl = document.getElementById('recaudado');
                if (recaudadoEl) recaudadoEl.innerText = `$${totalRecaudado.toLocaleString()} recaudados`;
            }, (error) => {
                console.error('Error en estadísticas:', error);
            });
    }
    
    calculateTotal() {
        let total = this.registrationData.distancia_precio || 0;
        const extras = this.getSelectedExtras();
        extras.forEach(extra => {
            total += extra.price;
        });
        return total;
    }
    
    getSelectedExtras() {
        const extras = [];
        document.querySelectorAll('input[name="extra"]:checked').forEach(checkbox => {
            extras.push({
                id: checkbox.value,
                name: checkbox.dataset.name,
                price: parseFloat(checkbox.dataset.price)
            });
        });
        return extras;
    }
    
    validateForm(data) {
        const required = ['nombre', 'email', 'telefono'];
        for (let field of required) {
            if (!data[field]) return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) return false;
        
        return true;
    }
    
    goToStep(step) {
        document.querySelectorAll('.step-section').forEach(section => {
            section.classList.remove('active');
            section.style.display = 'none';
        });
        
        const currentSection = document.getElementById(`step-${step}`);
        if (currentSection) {
            currentSection.style.display = 'block';
            currentSection.classList.add('active');
        }
        
        this.currentStep = step;
        
        const progress = (step / 4) * 100;
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) progressBar.style.width = `${progress}%`;
        
        // Actualizar clases de los steps
        document.querySelectorAll('.step').forEach((stepEl, idx) => {
            if (idx + 1 < step) {
                stepEl.classList.add('completed');
                stepEl.classList.remove('active');
            } else if (idx + 1 === step) {
                stepEl.classList.add('active');
                stepEl.classList.remove('completed');
            } else {
                stepEl.classList.remove('active', 'completed');
            }
        });
        
        if (step === 4) this.updateResumen();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    updateResumen() {
        const container = document.getElementById('resumen-content');
        if (!container) return;
        
        const totalDistance = this.registrationData.distancia_precio || 0;
        const extras = this.getSelectedExtras();
        const totalExtras = extras.reduce((sum, e) => sum + e.price, 0);
        const total = totalDistance + totalExtras;
        
        container.innerHTML = `
            <div class="resumen-item">
                <span>${this.registrationData.distancia_nombre || 'No seleccionada'}</span>
                <span>$${totalDistance} MXN</span>
            </div>
            ${extras.map(extra => `
                <div class="resumen-item">
                    <span>${extra.name}</span>
                    <span>$${extra.price} MXN</span>
                </div>
            `).join('')}
            <div class="resumen-total">
                <strong>Total a pagar</strong>
                <strong>$${total} MXN</strong>
            </div>
        `;
    }
    
    checkFolioInURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const folio = urlParams.get('folio');
        
        if (folio && window.location.pathname.includes('panel.html')) {
            this.loadParticipantData(folio);
        } else if (folio && window.location.pathname.includes('pago.html')) {
            const total = urlParams.get('total');
            const montoEl = document.getElementById('monto-pagar');
            if (montoEl) montoEl.textContent = `$${total} MXN`;
            const folioInput = document.getElementById('folio-pago');
            if (folioInput) folioInput.value = folio;
        }
    }
    
    setupEventListeners() {
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = {
                    nombre: document.getElementById('nombre')?.value,
                    email: document.getElementById('email')?.value,
                    genero: document.getElementById('genero')?.value,
                    telefono: document.getElementById('telefono')?.value,
                    pais: document.getElementById('pais')?.value,
                    talla: document.getElementById('talla')?.value,
                    emergency_contact: {
                        nombre: document.getElementById('emergency-nombre')?.value,
                        telefono: document.getElementById('emergency-telefono')?.value,
                        pais: document.getElementById('emergency-pais')?.value
                    }
                };
                this.submitRegistration(formData);
            });
        }
        
        const confirmBtn = document.getElementById('confirm-registration');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (!document.getElementById('accept-terms')?.checked) {
                    this.showNotification('Debes aceptar los términos y condiciones', 'error');
                    return;
                }
                
                if (!this.registrationData.distancia_id) {
                    this.showNotification('Por favor selecciona una distancia', 'error');
                    this.goToStep(1);
                    return;
                }
                
                const formData = {
                    nombre: document.getElementById('nombre')?.value,
                    email: document.getElementById('email')?.value,
                    genero: document.getElementById('genero')?.value,
                    telefono: document.getElementById('telefono')?.value,
                    pais: document.getElementById('pais')?.value,
                    talla: document.getElementById('talla')?.value,
                    emergency_contact: {
                        nombre: document.getElementById('emergency-nombre')?.value,
                        telefono: document.getElementById('emergency-telefono')?.value,
                        pais: document.getElementById('emergency-pais')?.value
                    }
                };
                this.submitRegistration(formData);
            });
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `<span>${message}</span>`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#4299e1'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            font-size: 0.9rem;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }
    
    showLoading() {
        let loader = document.getElementById('loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'loader';
            loader.innerHTML = '<div class="spinner"></div>';
            loader.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            `;
            document.body.appendChild(loader);
        }
        loader.style.display = 'flex';
    }
    
    hideLoading() {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
    }
    
    downloadQR() {
        const folio = document.getElementById('folio')?.textContent;
        if (folio) {
            this.showNotification(`QR generado para folio: ${folio}`, 'success');
        }
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.app = new Run4PazApp();
});
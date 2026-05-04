// js/carrito.js
class CarritoCompras {
    constructor() {
        this.items = [];
        this.total = 0;
        this.carritoId = null;
    }
    
    async agregarInscripcion(inscripcionData) {
        const folio = `RUN4PAZ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const inscripcion = {
            ...inscripcionData,
            folio: folio,
            estadoPago: 'pending_payment',
            carritoActivo: true,
            carritoId: this.carritoId || `CART-${Date.now()}`,
            pendingSince: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await db.collection('inscripciones').add(inscripcion);
        this.items.push({ id: docRef.id, ...inscripcion });
        this.calcularTotal();
        return docRef.id;
    }
    
    calcularTotal() {
        this.total = this.items.reduce((sum, item) => sum + item.total, 0);
    }
    
    async eliminarDelCarrito(index) {
        const item = this.items[index];
        await db.collection('inscripciones').doc(item.id).delete();
        this.items.splice(index, 1);
        this.calcularTotal();
    }
    
    async finalizarCompra() {
        // Actualizar todas las inscripciones del carrito
        for (const item of this.items) {
            await db.collection('inscripciones').doc(item.id).update({
                carritoActivo: false,
                estadoPago: 'pending_payment'
            });
        }
        // Redirigir a pago con total acumulado
        window.location.href = `pago.html?carrito=${this.carritoId}&total=${this.total}`;
    }
}
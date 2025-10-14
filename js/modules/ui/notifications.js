// js/modules/ui/notifications.js
/**
Módulo responsável por exibir notificações (toasts) na interface do usuário.
*/
// --- Seleção de Elementos do DOM ---
const notificationContainer = document.getElementById('notification-container');
/**
Exibe uma notificação "toast" na tela.
@param {string} message - A mensagem a ser exibida.
@param {string} [type='success'] - O tipo da notificação ('success' or 'error').
*/
export function showNotification(message, type = 'success') {
if (!notificationContainer) {
console.error("Elemento 'notification-container' não encontrado no DOM.");
return;
}
const toast = document.createElement('div');
toast.classList.add('toast', type);
toast.textContent = message;
notificationContainer.appendChild(toast);
// Adiciona a animação de entrada
// Usar um pequeno timeout garante que a transição/animação CSS seja aplicada corretamente.
setTimeout(() => {
toast.classList.add('show');
}, 10);
// Configura a remoção do toast
setTimeout(() => {
toast.classList.remove('show');
// Espera a animação de saída terminar para remover o elemento do DOM.
toast.addEventListener('transitionend', () => toast.remove());
}, 3000);
}

// Importa as funções de autenticação.
import { registerUser, loginUser, logoutUser, monitorAuthState } from './modules/auth.js';
// Importa as funções de transações.
import { addTransaction, getTransactions, deleteTransaction, updateTransaction } from './modules/transactions.js';
// Importa a função de categorias.
import { getCategories } from './modules/categories.js';
// Importa as funções de cartão de crédito.
import { addCreditCard, getCreditCards, deleteCreditCard } from './modules/creditCard.js';
// Importa as funções de faturas.
import { getInvoices, getInvoiceTransactions, payInvoice, closeOverdueInvoices } from './modules/invoices.js';

// --- Variáveis de Estado ---
let currentUser = null;
let userCreditCards = []; 
let selectedCardForInvoiceView = null;
let currentCardInvoices = [];

// --- Seleção de Elementos do DOM ---
const loadingDiv = document.getElementById('loading');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginSection = document.getElementById('login-form');
const registerSection = document.getElementById('register-form');
const loginForm = loginSection.querySelector('form');
const registerForm = registerSection.querySelector('form');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');
const showRegisterLink = document.getElementById('show-register-link');
const showLoginLink = document.getElementById('show-login-link');
const logoutButton = document.getElementById('logout-button');
const addTransactionForm = document.getElementById('add-transaction-form');
const transactionDescriptionInput = document.getElementById('transaction-description');
const transactionAmountInput = document.getElementById('transaction-amount');
const transactionTypeRadios = document.querySelectorAll('input[name="transaction-type"]');
const transactionCategorySelect = document.getElementById('transaction-category');
const newCategoryWrapper = document.getElementById('new-category-wrapper');
const newCategoryInput = document.getElementById('new-transaction-category');
const paymentMethodSelect = document.getElementById('payment-method');
const creditCardWrapper = document.getElementById('credit-card-wrapper');
const creditCardSelect = document.getElementById('credit-card-select');
const totalRevenueEl = document.getElementById('total-revenue');
const totalExpensesEl = document.getElementById('total-expenses');
const finalBalanceEl = document.getElementById('final-balance');
const transactionsListEl = document.getElementById('transactions-list');
const notificationContainer = document.getElementById('notification-container');
const editModal = document.getElementById('edit-modal');
const closeButton = document.querySelector('.close-button');
const editTransactionForm = document.getElementById('edit-transaction-form');
const editTransactionIdInput = document.getElementById('edit-transaction-id');
const editTransactionDescriptionInput = document.getElementById('edit-transaction-description');
const editTransactionAmountInput = document.getElementById('edit-transaction-amount');
const editTransactionTypeRadios = document.querySelectorAll('input[name="edit-transaction-type"]');
const editTransactionCategorySelect = document.getElementById('edit-transaction-category');
const editPaymentMethodSelect = document.getElementById('edit-payment-method');
const editCreditCardWrapper = document.getElementById('edit-credit-card-wrapper');
const manageCardsButton = document.getElementById('manage-cards-button');
const creditCardModal = document.getElementById('credit-card-modal');
const closeCardModalButton = document.querySelector('.close-card-modal-button');
const creditCardList = document.getElementById('credit-card-list');
const addCreditCardForm = document.getElementById('add-credit-card-form');
const cardNameInput = document.getElementById('card-name');
const cardClosingDayInput = document.getElementById('card-closing-day');
const cardDueDayInput = document.getElementById('card-due-day');
const cardManagementView = document.getElementById('card-management-view');
const invoiceDetailsView = document.getElementById('invoice-details-view');
const backToCardsButton = document.getElementById('back-to-cards-button');
const invoiceCardName = document.getElementById('invoice-card-name');
const invoicePeriodSelect = document.getElementById('invoice-period-select');
const invoiceTotalAmount = document.getElementById('invoice-total-amount');
const invoiceDueDate = document.getElementById('invoice-due-date');
const invoiceStatus = document.getElementById('invoice-status');
const invoiceTransactionsList = document.getElementById('invoice-transactions-list');
const payInvoiceButton = document.getElementById('pay-invoice-button');

// --- Funções de Manipulação da UI ---

/** Popula um elemento <select> com as categorias apropriadas. */
function populateCategories(type, selectElement, isEditForm = false) {
    const categories = getCategories(type);
    selectElement.innerHTML = '';

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        selectElement.appendChild(option);
    });

    if (!isEditForm) {
        const otherOption = document.createElement('option');
        otherOption.value = 'outra';
        otherOption.textContent = 'Outra...';
        selectElement.appendChild(otherOption);
    }
}

/** Popula os <select> de cartão de crédito com os cartões do usuário. */
function populateCreditCardSelects() {
    creditCardSelect.innerHTML = '';
    const editCreditCardSelect = document.getElementById('edit-credit-card-select');
    editCreditCardSelect.innerHTML = '';

    if (userCreditCards.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'Nenhum cartão cadastrado';
        option.disabled = true;
        creditCardSelect.appendChild(option);
        editCreditCardSelect.appendChild(option.cloneNode(true));
    } else {
        userCreditCards.forEach(card => {
            const option = document.createElement('option');
            option.value = card.id;
            option.textContent = card.name;
            creditCardSelect.appendChild(option.cloneNode(true));
            editCreditCardSelect.appendChild(option.cloneNode(true));
        });
    }
}

/** Exibe os detalhes de uma fatura selecionada. */
async function displayInvoiceDetails(invoice) {
    invoiceTotalAmount.textContent = formatCurrency(invoice.totalAmount);
    invoiceDueDate.textContent = invoice.dueDate.toLocaleDateString('pt-BR');
    
    invoiceStatus.textContent = invoice.status;
    invoiceStatus.className = 'status-badge';
    invoiceStatus.classList.add(invoice.status);

    payInvoiceButton.disabled = invoice.status !== 'closed';

    invoiceTransactionsList.innerHTML = '<li>Carregando...</li>';
    try {
        const transactions = await getInvoiceTransactions(invoice.id);
        invoiceTransactionsList.innerHTML = '';
        if (transactions.length === 0) {
            invoiceTransactionsList.innerHTML = '<li>Nenhum lançamento nesta fatura.</li>';
        } else {
            transactions.forEach(tx => {
                const li = document.createElement('li');
                const descriptionSpan = document.createElement('span');
                descriptionSpan.textContent = tx.description;
                const amountSpan = document.createElement('span');
                amountSpan.textContent = formatCurrency(tx.amount);
                li.appendChild(descriptionSpan);
                li.appendChild(amountSpan);
                invoiceTransactionsList.appendChild(li);
            });
        }
    } catch (error) {
        showNotification(error.message, 'error');
        invoiceTransactionsList.innerHTML = '<li>Erro ao carregar lançamentos.</li>';
    }
}

/** Carrega as faturas de um cartão e popula o dropdown de seleção. */
async function loadAndDisplayInvoices(card) {
    invoicePeriodSelect.innerHTML = '<option>Carregando faturas...</option>';
    try {
        currentCardInvoices = await getInvoices(card.id);
        invoicePeriodSelect.innerHTML = '';

        if (currentCardInvoices.length === 0) {
            invoicePeriodSelect.innerHTML = '<option>Nenhuma fatura encontrada</option>';
            invoiceTotalAmount.textContent = formatCurrency(0);
            invoiceDueDate.textContent = '--/--/----';
            invoiceStatus.textContent = '--';
            invoiceStatus.className = 'status-badge';
            invoiceTransactionsList.innerHTML = '<li>Nenhum lançamento.</li>';
            payInvoiceButton.disabled = true;
        } else {
            currentCardInvoices.forEach(invoice => {
                const option = document.createElement('option');
                option.value = invoice.id;
                option.textContent = `${invoice.month.toString().padStart(2, '0')}/${invoice.year} (${invoice.status})`;
                invoicePeriodSelect.appendChild(option);
            });
            displayInvoiceDetails(currentCardInvoices[0]);
        }
    } catch (error) {
        showNotification(error.message, 'error');
        invoicePeriodSelect.innerHTML = '<option>Erro ao carregar faturas</option>';
    }
}

/** Troca a visão no modal para a de detalhes da fatura e inicia o carregamento. */
function showInvoiceDetailsView(card) {
    selectedCardForInvoiceView = card;
    invoiceCardName.textContent = `Faturas - ${card.name}`;
    loadAndDisplayInvoices(card);
    cardManagementView.style.display = 'none';
    invoiceDetailsView.style.display = 'block';
}

/** Troca a visão no modal de volta para a lista de cartões. */
function showCardManagementView() {
    selectedCardForInvoiceView = null;
    currentCardInvoices = [];
    cardManagementView.style.display = 'block';
    invoiceDetailsView.style.display = 'none';
}

/** Renderiza a lista de cartões no modal, adicionando eventos de clique para ver faturas e excluir. */
function renderCreditCardList() {
    creditCardList.innerHTML = '';
    if (userCreditCards.length === 0) {
        creditCardList.innerHTML = '<li>Nenhum cartão cadastrado.</li>';
    } else {
        userCreditCards.forEach(card => {
            const li = document.createElement('li');

            const cardInfo = document.createElement('div');
            cardInfo.className = 'card-info';
            cardInfo.textContent = `${card.name} (Fecha dia ${card.closingDay}, Vence dia ${card.dueDay})`;
            cardInfo.addEventListener('click', () => showInvoiceDetailsView(card));

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '&times;';
            deleteButton.classList.add('action-btn', 'delete-btn');
            deleteButton.title = 'Excluir cartão';
            deleteButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Tem certeza que deseja excluir o cartão "${card.name}"? Esta ação não pode ser desfeita.`)) {
                    try {
                        await deleteCreditCard(card.id);
                        showNotification('Cartão excluído com sucesso!');
                        loadUserCreditCards();
                    } catch (error) {
                        showNotification(error.message, 'error');
                    }
                }
            });

            li.appendChild(cardInfo);
            li.appendChild(deleteButton);
            creditCardList.appendChild(li);
        });
    }
}

/** Exibe uma notificação "toast" na tela. */
function showNotification(message, type = 'success') {
    const toast = document.createElement('div');
    toast.classList.add('toast', type);
    toast.textContent = message;
    notificationContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

/** Abre e preenche o modal de edição com os dados da transação. */
function openEditModal(transaction) {
    editTransactionIdInput.value = transaction.id;
    editTransactionDescriptionInput.value = transaction.description;
    editTransactionAmountInput.value = transaction.amount;
    document.querySelector(`input[name="edit-transaction-type"][value="${transaction.type}"]`).checked = true;
    
    populateCategories(transaction.type, editTransactionCategorySelect, true);
    editTransactionCategorySelect.value = transaction.category;

    editPaymentMethodSelect.value = transaction.paymentMethod;
    editCreditCardWrapper.style.display = transaction.paymentMethod === 'credit_card' ? 'block' : 'none';

    editModal.style.display = 'flex';
}

/** Fecha o modal de edição. */
function closeEditModal() {
    editModal.style.display = 'none';
}

/** Abre o modal de gerenciamento de cartões e verifica faturas vencidas. */
async function openCardModal() {
    if (currentUser) {
        await closeOverdueInvoices(currentUser.uid);
        if (selectedCardForInvoiceView) {
            await loadAndDisplayInvoices(selectedCardForInvoiceView);
        }
    }
    showCardManagementView();
    creditCardModal.style.display = 'flex';
}

/** Fecha o modal de gerenciamento de cartões. */
function closeCardModal() {
    creditCardModal.style.display = 'none';
}

/** Formata um número para o padrão de moeda BRL. */
function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Renderiza o dashboard: calcula totais e exibe a lista de transações. */
function updateDashboard(transactions) {
    let totalRevenue = 0;
    let totalExpenses = 0;
    transactionsListEl.innerHTML = '';

    if (transactions.length === 0) {
        transactionsListEl.innerHTML = '<li>Nenhuma transação registrada.</li>';
    } else {
        transactions.forEach(transaction => {
            if (transaction.type === 'revenue') {
                totalRevenue += transaction.amount;
            } else {
                totalExpenses += transaction.amount;
            }

            const li = document.createElement('li');
            li.classList.add(transaction.type);
            
            const transactionInfo = document.createElement('div');
            transactionInfo.style.textAlign = 'left';

            const descriptionSpan = document.createElement('span');
            descriptionSpan.className = 'transaction-description';
            descriptionSpan.textContent = transaction.description;
            
            const categorySpan = document.createElement('span');
            categorySpan.style.display = 'block';
            categorySpan.style.fontSize = '0.8rem';
            categorySpan.style.color = '#7f8c8d';
            categorySpan.textContent = `${transaction.category || ''} • ${transaction.paymentMethod || ''}`;
            
            const rightSide = document.createElement('div');
            rightSide.style.display = 'flex';
            rightSide.style.alignItems = 'center';
            rightSide.style.gap = '1rem';
            
            const amountSpan = document.createElement('span');
            amountSpan.className = 'transaction-amount';
            amountSpan.textContent = formatCurrency(transaction.amount);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'transaction-actions';
            
            const editButton = document.createElement('button');
            editButton.innerHTML = '&#9998;';
            editButton.classList.add('action-btn', 'edit-btn');
            editButton.onclick = () => openEditModal(transaction);
            
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '&times;';
            deleteButton.classList.add('action-btn', 'delete-btn');
            deleteButton.onclick = async () => {
                if (confirm(`Tem certeza que deseja excluir a transação "${transaction.description}"?`)) {
                    try {
                        await deleteTransaction(transaction.id);
                        showNotification('Transação excluída com sucesso!');
                        loadUserDashboard();
                    } catch (error) {
                        showNotification(error.message, 'error');
                    }
                }
            };

            transactionInfo.appendChild(descriptionSpan);
            transactionInfo.appendChild(categorySpan);
            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);
            rightSide.appendChild(amountSpan);
            rightSide.appendChild(actionsDiv);
            li.appendChild(transactionInfo);
            li.appendChild(rightSide);
            transactionsListEl.appendChild(li);
        });
    }

    const finalBalance = totalRevenue - totalExpenses;
    totalRevenueEl.textContent = formatCurrency(totalRevenue);
    totalExpensesEl.textContent = formatCurrency(totalExpenses);
    finalBalanceEl.textContent = formatCurrency(finalBalance);
}

/** Busca os dados do usuário e chama a função para atualizar o dashboard. */
async function loadUserDashboard() {
    if (!currentUser) return;
    transactionsListEl.innerHTML = '<li>Carregando transações...</li>';
    try {
        const transactions = await getTransactions(currentUser.uid);
        updateDashboard(transactions);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/** Busca os cartões de crédito do usuário e atualiza a UI. */
async function loadUserCreditCards() {
    if (!currentUser) return;
    try {
        userCreditCards = await getCreditCards(currentUser.uid);
        populateCreditCardSelects();
        renderCreditCardList();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function showLoading() { loadingDiv.style.display = 'block'; authContainer.style.display = 'none'; appContainer.style.display = 'none'; }
function showAuthForms() { loadingDiv.style.display = 'none'; authContainer.style.display = 'block'; loginSection.style.display = 'block'; registerSection.style.display = 'none';}
function showApp() { loadingDiv.style.display = 'none'; authContainer.style.display = 'none'; appContainer.style.display = 'block'; }
function toggleAuthForms(showRegister) { if (showRegister) { loginSection.style.display = 'none'; registerSection.style.display = 'block'; } else { loginSection.style.display = 'block'; registerSection.style.display = 'none'; } }

// --- Lógica de Negócios e Eventos ---

showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(true); });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(false); });
logoutButton.addEventListener('click', () => { logoutUser().catch(error => showNotification(error.message, 'error')); });
closeButton.addEventListener('click', closeEditModal);
window.addEventListener('click', (event) => { if (event.target == editModal) { closeEditModal(); } });

manageCardsButton.addEventListener('click', openCardModal);
closeCardModalButton.addEventListener('click', closeCardModal);
window.addEventListener('click', (event) => { if (event.target == creditCardModal) { closeCardModal(); } });
backToCardsButton.addEventListener('click', showCardManagementView);

invoicePeriodSelect.addEventListener('change', (e) => {
    const selectedInvoiceId = e.target.value;
    const selectedInvoice = currentCardInvoices.find(inv => inv.id === selectedInvoiceId);
    if (selectedInvoice) {
        displayInvoiceDetails(selectedInvoice);
    }
});

payInvoiceButton.addEventListener('click', async () => {
    const selectedInvoiceId = invoicePeriodSelect.value;
    const selectedInvoice = currentCardInvoices.find(inv => inv.id === selectedInvoiceId);

    if (selectedInvoice && selectedCardForInvoiceView) {
        if (confirm(`Confirma o pagamento da fatura de ${formatCurrency(selectedInvoice.totalAmount)}?`)) {
            try {
                await payInvoice(selectedInvoice, selectedCardForInvoiceView);
                showNotification("Fatura paga com sucesso!");
                loadAndDisplayInvoices(selectedCardForInvoiceView);
                loadUserDashboard();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }
    }
});

transactionTypeRadios.forEach(radio => { radio.addEventListener('change', (e) => populateCategories(e.target.value, transactionCategorySelect)); });
transactionCategorySelect.addEventListener('change', (e) => { newCategoryWrapper.style.display = e.target.value === 'outra' ? 'block' : 'none'; });
paymentMethodSelect.addEventListener('change', (e) => { creditCardWrapper.style.display = e.target.value === 'credit_card' ? 'block' : 'none'; });
editPaymentMethodSelect.addEventListener('change', (e) => { editCreditCardWrapper.style.display = e.target.value === 'credit_card' ? 'block' : 'none'; });

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await loginUser(loginEmailInput.value, loginPasswordInput.value);
        loginForm.reset();
    } catch (error) {
        showNotification(error.message, 'error');
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await registerUser(registerEmailInput.value, registerPasswordInput.value);
        registerForm.reset();
    } catch (error) {
        showNotification(error.message, 'error');
    }
});

addTransactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = addTransactionForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';

    if (!currentUser) {
        showNotification("Você precisa estar logado.", 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar';
        return;
    }
    
    let category = transactionCategorySelect.value;
    if (category === 'outra') {
        category = newCategoryInput.value.trim();
        if (!category) {
            showNotification("Por favor, informe o nome da nova categoria.", 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Adicionar';
            return;
        }
    }

    const transactionData = {
        description: transactionDescriptionInput.value,
        amount: parseFloat(transactionAmountInput.value),
        type: document.querySelector('input[name="transaction-type"]:checked').value,
        category: category,
        paymentMethod: paymentMethodSelect.value,
        userId: currentUser.uid
    };

    let cardData = null;
    if (transactionData.paymentMethod === 'credit_card') {
        const cardId = creditCardSelect.value;
        if (!cardId || creditCardSelect.disabled) {
            showNotification("Por favor, selecione um cartão de crédito válido.", 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Adicionar';
            return;
        }
        transactionData.cardId = cardId;
        cardData = userCreditCards.find(card => card.id === cardId);
    }
    
    try {
        await addTransaction(transactionData, cardData);
        showNotification("Transação adicionada com sucesso!");
        addTransactionForm.reset();
        newCategoryWrapper.style.display = 'none';
        creditCardWrapper.style.display = 'none';
        populateCategories('expense', transactionCategorySelect);
        
        if (transactionData.paymentMethod !== 'credit_card') {
            loadUserDashboard();
        }
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar';
    }
});

editTransactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = editTransactionForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';

    const transactionId = editTransactionIdInput.value;
    const updatedData = {
        description: editTransactionDescriptionInput.value,
        amount: parseFloat(editTransactionAmountInput.value),
        type: document.querySelector('input[name="edit-transaction-type"]:checked').value,
        category: editTransactionCategorySelect.value,
        paymentMethod: editPaymentMethodSelect.value,
    };
    try {
        await updateTransaction(transactionId, updatedData);
        showNotification('Transação atualizada com sucesso!');
        closeEditModal();
        loadUserDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar Alterações';
    }
});

addCreditCardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = addCreditCardForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Adicionando...';

    if (!currentUser) {
        showNotification("Você precisa estar logado.", 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar Cartão';
        return;
    }

    const cardData = {
        name: cardNameInput.value,
        closingDay: parseInt(cardClosingDayInput.value),
        dueDay: parseInt(cardDueDayInput.value),
        userId: currentUser.uid
    };

    try {
        await addCreditCard(cardData);
        showNotification("Cartão adicionado com sucesso!");
        addCreditCardForm.reset();
        await loadUserCreditCards();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar Cartão';
    }
});

// --- Ponto de Entrada da Aplicação ---
function initializeApp() {
    showLoading();
    monitorAuthState(async (user) => {
        if (user) {
            currentUser = user;
            showApp();
            
            await closeOverdueInvoices(user.uid);

            populateCategories('expense', transactionCategorySelect);
            await Promise.all([
                loadUserDashboard(),
                loadUserCreditCards()
            ]);
        } else {
            currentUser = null;
            userCreditCards = [];
            showAuthForms();
        }
    });
}

initializeApp();

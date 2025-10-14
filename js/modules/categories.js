// Importa a instância do Firestore e funções necessárias.
import { db } from '../firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    doc,
    deleteDoc,
    writeBatch,
    orderBy
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const CATEGORIES_COLLECTION = 'categories';

// Lista de categorias padrão para novos usuários.
const defaultCategories = {
    revenue: [
        'Salário', 'Vendas', 'Investimentos', 'Freelance', 'Presente'
    ],
    expense: [
        'Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação',
        'Lazer', 'Impostos', 'Vestuário', 'Supermercado', 'Fatura de Cartão'
    ]
};

/**
 * Cria as categorias padrão para um novo usuário no Firestore.
 * @param {string} userId - O ID do usuário para o qual as categorias serão criadas.
 * @returns {Promise<void>}
 */
async function createDefaultCategoriesForUser(userId) {
    const batch = writeBatch(db);
    const categoriesRef = collection(db, CATEGORIES_COLLECTION);

    defaultCategories.revenue.forEach(categoryName => {
        const newCategoryRef = doc(categoriesRef);
        batch.set(newCategoryRef, {
            userId: userId,
            name: categoryName,
            type: 'revenue'
        });
    });

    defaultCategories.expense.forEach(categoryName => {
        const newCategoryRef = doc(categoriesRef);
        batch.set(newCategoryRef, {
            userId: userId,
            name: categoryName,
            type: 'expense'
        });
    });

    try {
        await batch.commit();
        console.log("Categorias padrão criadas para o usuário:", userId);
    } catch (error) {
        console.error("Erro ao criar categorias padrão:", error);
        // Não lançamos erro para o usuário, é uma operação de fundo.
    }
}

/**
 * Busca todas as categorias personalizadas de um usuário no Firestore.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<Array<object>>} Uma lista de objetos de categoria.
 */
async function getCategories(userId) {
    try {
        const categoriesRef = collection(db, CATEGORIES_COLLECTION);
        const q = query(
            categoriesRef,
            where("userId", "==", userId),
            orderBy("name") // Ordena por nome para manter a lista consistente
        );
        const querySnapshot = await getDocs(q);
        const categories = [];
        querySnapshot.forEach((doc) => {
            categories.push({
                id: doc.id,
                ...doc.data()
            });
        });
        return categories;
    } catch (error) {
        console.error("Erro ao buscar categorias:", error);
        throw new Error("Não foi possível carregar suas categorias.");
    }
}

/**
 * Adiciona uma nova categoria para um usuário no Firestore.
 * @param {object} categoryData - Dados da categoria.
 * @param {string} categoryData.name - Nome da categoria.
 * @param {string} categoryData.type - Tipo ('revenue' ou 'expense').
 * @param {string} categoryData.userId - ID do usuário.
 * @returns {Promise<DocumentReference>}
 */
async function addCategory(categoryData) {
    try {
        const categoriesRef = collection(db, CATEGORIES_COLLECTION);
        const docRef = await addDoc(categoriesRef, categoryData);
        return docRef;
    } catch (error) {
        console.error("Erro ao adicionar categoria:", error);
        throw new Error("Não foi possível salvar a nova categoria.");
    }
}

/**
 * Exclui uma categoria do Firestore.
 * @param {string} categoryId - O ID do documento da categoria.
 * @returns {Promise<void>}
 */
async function deleteCategory(categoryId) {
    try {
        const categoryDocRef = doc(db, CATEGORIES_COLLECTION, categoryId);
        await deleteDoc(categoryDocRef);
    } catch (error) {
        console.error("Erro ao excluir categoria:", error);
        throw new Error("Não foi possível excluir a categoria.");
    }
}

// Exporta as funções para serem utilizadas em outros módulos.
export { getCategories, addCategory, deleteCategory, createDefaultCategoriesForUser };

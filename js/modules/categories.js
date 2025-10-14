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
    orderBy,
    // INÍCIO DA ALTERAÇÃO
    updateDoc,
    arrayUnion,
    arrayRemove
    // FIM DA ALTERAÇÃO
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const CATEGORIES_COLLECTION = 'categories';

// INÍCIO DA ALTERAÇÃO - Atualiza as categorias padrão para incluir subcategorias
const defaultCategories = {
    revenue: [
        { name: 'Salário', subcategories: [] },
        { name: 'Vendas', subcategories: [] },
        { name: 'Investimentos', subcategories: ['Dividendos', 'Juros'] },
        { name: 'Freelance', subcategories: [] },
        { name: 'Presente', subcategories: [] }
    ],
    expense: [
        { name: 'Alimentação', subcategories: ['Supermercado', 'Restaurante', 'Delivery'] },
        { name: 'Moradia', subcategories: ['Aluguel', 'Condomínio', 'Contas de Consumo', 'Manutenção'] },
        { name: 'Transporte', subcategories: ['Combustível', 'Transporte Público', 'App de Transporte'] },
        { name: 'Saúde', subcategories: ['Farmácia', 'Consulta', 'Plano de Saúde'] },
        { name: 'Educação', subcategories: ['Cursos', 'Livros'] },
        { name: 'Lazer', subcategories: ['Cinema', 'Viagem', 'Streaming'] },
        { name: 'Impostos', subcategories: [] },
        { name: 'Vestuário', subcategories: ['Roupas', 'Calçados'] },
        { name: 'Fatura de Cartão', subcategories: [] }
    ]
};
// FIM DA ALTERAÇÃO

/**
 * Cria as categorias padrão para um novo usuário no Firestore.
 * @param {string} userId - O ID do usuário para o qual as categorias serão criadas.
 * @returns {Promise<void>}
 */
async function createDefaultCategoriesForUser(userId) {
    const batch = writeBatch(db);
    const categoriesRef = collection(db, CATEGORIES_COLLECTION);

    // INÍCIO DA ALTERAÇÃO - Lógica atualizada para o novo formato de objeto
    defaultCategories.revenue.forEach(category => {
        const newCategoryRef = doc(categoriesRef);
        batch.set(newCategoryRef, {
            userId: userId,
            name: category.name,
            subcategories: category.subcategories,
            type: 'revenue'
        });
    });

    defaultCategories.expense.forEach(category => {
        const newCategoryRef = doc(categoriesRef);
        batch.set(newCategoryRef, {
            userId: userId,
            name: category.name,
            subcategories: category.subcategories,
            type: 'expense'
        });
    });
    // FIM DA ALTERAÇÃO

    try {
        await batch.commit();
        console.log("Categorias padrão criadas para o usuário:", userId);
    } catch (error) {
        console.error("Erro ao criar categorias padrão:", error);
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
            orderBy("name")
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
 * @returns {Promise<DocumentReference>}
 */
async function addCategory(categoryData) {
    try {
        const categoriesRef = collection(db, CATEGORIES_COLLECTION);
        // INÍCIO DA ALTERAÇÃO - Adiciona o campo de subcategorias vazio
        const dataToSave = {
            ...categoryData,
            subcategories: []
        };
        const docRef = await addDoc(categoriesRef, dataToSave);
        // FIM DA ALTERAÇÃO
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

// INÍCIO DA ALTERAÇÃO - Novas funções para gerenciar subcategorias

/**
 * Adiciona uma nova subcategoria a uma categoria existente.
 * @param {string} categoryId - O ID da categoria pai.
 * @param {string} subcategoryName - O nome da nova subcategoria.
 * @returns {Promise<void>}
 */
async function addSubcategory(categoryId, subcategoryName) {
    const trimmedName = subcategoryName.trim();
    if (!trimmedName) return;

    try {
        const categoryDocRef = doc(db, CATEGORIES_COLLECTION, categoryId);
        await updateDoc(categoryDocRef, {
            subcategories: arrayUnion(trimmedName)
        });
    } catch (error) {
        console.error("Erro ao adicionar subcategoria:", error);
        throw new Error("Não foi possível adicionar a subcategoria.");
    }
}

/**
 * Exclui uma subcategoria de uma categoria existente.
 * @param {string} categoryId - O ID da categoria pai.
 * @param {string} subcategoryName - O nome da subcategoria a ser removida.
 * @returns {Promise<void>}
 */
async function deleteSubcategory(categoryId, subcategoryName) {
    try {
        const categoryDocRef = doc(db, CATEGORIES_COLLECTION, categoryId);
        await updateDoc(categoryDocRef, {
            subcategories: arrayRemove(subcategoryName)
        });
    } catch (error) {
        console.error("Erro ao excluir subcategoria:", error);
        throw new Error("Não foi possível excluir a subcategoria.");
    }
}
// FIM DA ALTERAÇÃO


export { getCategories, addCategory, deleteCategory, createDefaultCategoriesForUser, addSubcategory, deleteSubcategory };

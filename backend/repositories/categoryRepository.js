const db = require('../config/db');

const findAll = async () => {
    const [rows] = await db.query('SELECT * FROM categories ORDER BY type, name');
    return rows;
};

const findById = async (id) => {
    const [rows] = await db.query('SELECT id FROM categories WHERE id = ?', [id]);
    return rows[0];
};

const create = async (category) => {
    const [result] = await db.query('INSERT INTO categories (name, type) VALUES (?, ?)', [category.name, category.type]);
    return result;
};

const update = async (id, category) => {
    const [result] = await db.query('UPDATE categories SET name = ?, type = ? WHERE id = ?', [category.name, category.type, id]);
    return result;
};

const remove = async (id) => {
    const [result] = await db.query('DELETE FROM categories WHERE id = ?', [id]);
    return result;
};

module.exports = {
    findAll,
    findById,
    create,
    update,
    remove
};


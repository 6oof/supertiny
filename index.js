"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const crypto_1 = __importDefault(require("crypto"));
class Dumpster {
    constructor(dbName) {
        this.db = new better_sqlite3_1.default(dbName);
        this.db.pragma('journal_mode = WAL');
        this.init();
        this.ensureDefaultUser();
    }
    init() {
        // Create a table named "data_entries" with the specified schema
        const createDataEntriesTableSQL = `
            CREATE TABLE IF NOT EXISTS data_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cat TEXT NOT NULL,
                value JSON,
                owner_id INTEGER NOT NULL,
                related_to INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        this.db.exec(createDataEntriesTableSQL);
        // Create a table named "users" with the specified schema
        const createUsersTableSQL = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE,
                password TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        this.db.exec(createUsersTableSQL);
    }
    ensureDefaultUser() {
        // Check if a user with ID 1 exists
        const existingUser = this.db.prepare('SELECT * FROM users WHERE id = ?').get(1);
        if (!existingUser) {
            // Create a default user with ID 1 (e.g., "glob") and a hashed password
            const defaultUsername = 'glob';
            const hashedPassword = crypto_1.default.randomUUID(); // Replace with the actual hashed password
            const createUserSQL = `
                INSERT INTO users (id, username, password)
                VALUES (1, ?, ?)
            `;
            this.db.prepare(createUserSQL).run(defaultUsername, hashedPassword);
        }
    }
    store(cat, value, ownerId = 1, relatedTo = null) {
        const val = this.resolveValue(value);
        let createDataEntrySQL;
        if (relatedTo != null) {
            createDataEntrySQL = this.db.prepare('INSERT INTO data_entries (cat, value, owner_id, related_to) VALUES (?, ?, ?, ?)');
            return createDataEntrySQL.run(cat, value, ownerId, relatedTo);
        }
        else {
            createDataEntrySQL = this.db.prepare('INSERT INTO data_entries (cat, value, owner_id) VALUES (?, ?, ?)');
            return createDataEntrySQL.run(cat, val, ownerId);
        }
    }
    find(qa) {
        const qB = {
            id: qa.id || "*",
            cat: qa.cat || "*",
            value: qa.value || null,
            owner_id: qa.owner_id || "*",
            related_to: qa.related_to || "*",
            limit: qa.limit || null,
            orderBy: qa.orderBy || null,
            order: qa.order || null,
        };
        let findAllDataEntriesSQL = `
    SELECT * FROM data_entries WHERE 1`; // Always true condition
        const params = [];
        if (qB.id !== "*") {
            findAllDataEntriesSQL += ` AND id = ?`;
            params.push(qB.id);
        }
        if (qB.cat !== "*") {
            findAllDataEntriesSQL += ` AND cat = ?`;
            params.push(qB.cat);
        }
        if (qB.value !== null) {
            findAllDataEntriesSQL += ` AND json_extract(value, ?) = ?`;
            params.push(`$.${qB.value[0]}`);
            params.push(qB.value[1]);
        }
        if (qB.owner_id !== "*") {
            findAllDataEntriesSQL += ` AND owner_id = ?`;
            params.push(qB.owner_id);
        }
        if (qB.related_to !== "*") {
            findAllDataEntriesSQL += ` AND related_to = ?`;
            params.push(qB.related_to);
        }
        if (qB.orderBy) {
            findAllDataEntriesSQL += ` ORDER BY ${qB.orderBy}`;
        }
        if (qB.order) {
            findAllDataEntriesSQL += ` ${qB.order}`;
        }
        if (qB.limit) {
            findAllDataEntriesSQL += ` LIMIT ${qB.limit}`;
        }
        return this.db.prepare(findAllDataEntriesSQL).all(...params);
    }
    resolveValue(value) {
        let val = value;
        try {
            JSON.parse(value);
        }
        catch (e) {
            try {
                val = JSON.stringify(value);
            }
            catch (e) {
                throw new Error('value must be a valid JSON or a stringifiable object');
            }
        }
        return val;
    }
}
const tst = new Dumpster('foobar.db');
for (let i = 0; i < 100000; i++) {
    tst.store('auto', { foo: 'baz' + i });
    console.log('foo stored, iteration: ' + i);
}
const res = tst.find({ owner_id: 1, orderBy: "id", order: "desc", limit: 10 });
console.log(res);

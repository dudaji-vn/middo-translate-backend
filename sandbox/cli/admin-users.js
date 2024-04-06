/* eslint-disable no-undef */
const { MongoClient } = require('mongodb');
const Table = require('cli-table');
require('dotenv').config();
const url = process.env.DATABASE_URI;
const dbName = process.env.DATABASE_NAME;

async function _getUsers(client) {
    await client.connect();
    const db = client.db(dbName);
    const c = db.collection('users');
    const r = await c.find({}).toArray();

    var table = new Table({
        head: ['Name', 'Email', 'CreatedAt'],
    });

    r.forEach((item) => {
        const row = [item.name, item.email, item.createdAt.toISOString()];
        table.push(row);
    });
    console.log(table.toString());
    return true;
}

function getUsers() {
    const client = new MongoClient(url);
    _getUsers(client)
        .catch(console.error)
        .finally(() => client.close());
}

module.exports = {
    getUsers
}
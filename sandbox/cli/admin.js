/* eslint-disable no-undef */
const { MongoClient } = require('mongodb');
const Table = require('cli-table');
require('dotenv').config()
const url = process.env.DATABASE_URI;
const dbName = process.env.DATABASE_NAME;

async function _getDailyMsgStat(client) {
    await client.connect();
    const db = client.db(dbName);

    const c = db.collection('messages');

    const pipeline = [
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: -1 } }
    ];

    const cursor = await c.aggregate(pipeline);

    var table = new Table({
        head: ['Date', 'Count'],
    });

    for await (const item of cursor) {
        const row = [item._id, item.count];
        table.push(row);
    }
    console.log(table.toString());
    return true;
}


function getDailyMsgStat() {
    const client = new MongoClient(url);
    _getDailyMsgStat(client)
        .catch(console.error)
        .finally(() => client.close());
}

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
    getDailyMsgStat,
    getUsers,
}
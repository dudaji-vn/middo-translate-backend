/* eslint-disable no-undef */
"use strict";

const { io } = require("socket.io-client");

const commander = require("commander");
const { exec } = require("child_process");
const fs = require("fs");
const program = new commander.Command();

const { signIn, getRooms, postMsg } = require('./user-all.js');
const { getUsers } = require('./admin-users.js');
const { getDailyMsgStat } = require('./admin-msgs.js');

const logger = require('./logger.js');

program.name('middo-cli').description('CLI for middo').version('0.0.1');

program.command('get-users').description('Get users').action(function () { getUsers(); });

program.command('get-daily-msg-stat').description('Get daily msg stat').action(function () { getDailyMsgStat(); });

program.command('get-google-stat')
    .description('Get google api call stat')
    .action(async function () {
        const url = `http://${process.env.BACKEND_ADDRESS}/api/google-api-stat`
        const res = await fetch(url).then(res => res.json());
        logger.info(res);
    });

program.command('sign-in')
    .description('Sign in')
    .option('-e, --email <type>', 'email address')
    .option('-p, --password <type>', 'password')
    .action(async function (options) {
        const { email, password } = options
        const { token, userId } = await signIn(email, password);
        await exec(`echo ${token} > .${email}.token`);
        await exec(`echo ${userId} > .${email}.id`);
    });

program.command('get-rooms')
    .description('get rooms')
    .option('-e, --email <type>', 'email address')
    .action(async function (options) {
        const { email } = options
        const filename = `.${email}.token`;
        const token = fs.readFileSync(filename, 'utf8').trim();
        const rooms = await getRooms(token);
        const summary = rooms.map((item) => {
            return { roomId: item._id, lastMessage: item.lastMessage.contentEnglish };
        });
        logger.info(summary);
    });

program.command('set-target-room')
    .description('set target room')
    .option('-r, --room <type>', 'room id')
    .action(async function (options) {
        const { room } = options
        const filename = `.room.id`;
        await exec(`echo ${room} > ${filename}`);
    });

program.command('post-msg')
    .description('post msg')
    .option('-e, --email <type>', 'email')
    .option('-m, --msg <type>', 'msg')
    .action(async function (options) {
        const { email, msg } = options;
        const filename = `.${email}.token`;
        const token = fs.readFileSync(filename, 'utf8').trim();
        const roomId = fs.readFileSync('.room.id', 'utf8').trim();

        const response = await postMsg(token, roomId, msg);

        logger.info(response);
    });

async function connectSocket(email) {
    const socket = io(`http://${process.env.BACKEND_ADDRESS}`);
    socket.on('connect', () => {
        const userId = fs.readFileSync(`.${email}.id`, 'utf8').trim();
        logger.info('connect', userId);
        socket.emit('client.join', userId);
    })

    socket.on('disconnect', () => {
        logger.info('disconnect');
    })

    socket.on("connect_error", (error) => {
        logger.info(error.message);
    });

    socket.on("client.list", (data) => {
        logger.info("on(client.list)", data);
    });

    socket.on("message.new", (data) => {
        logger.info("on(message.new)", data);
    });
    socket.connect();
    return socket;
}

program.command('socket-connect')
    .description('socket connect')
    .option('-e, --email <type>', 'email')
    .option('-p, --port <type>', 'listen port for get command')
    .action(async function (options) {
        const { email, port } = options;
        const socket = await connectSocket(email);
        const express = require('express');
        const bodyParser = require('body-parser');
        const app = express();

        app.use(bodyParser.json());

        app.listen(port, () => {
            logger.info(`Server is running on port ${port}`);
        });

        app.post('/join', (req, res) => {
            logger.info('join', req.body);
            const { room } = req.body;
            socket.emit('chat.join', { roomId: room, notifyToken: '' });
            res.json({});
        });
    });

program.command('socket-join')
    .description('socket join')
    .option('-e, --email <type>', 'email')
    .option('-r, --room <type>', 'room id')
    .option('-p, --port <type>', 'listen port for get command')
    .action(async function (options) {
        const { email, port, room } = options;
        const body = { email, room };
        const url = `http://localhost:${port}/join`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        }).then((res) => res.json());
        return response;
    });

program.parse();

/* eslint-disable no-undef */
"use strict";

const commander = require("commander");
const { exec } = require("child_process");
const fs = require("fs");
const program = new commander.Command();

const { signIn, getRooms, postMsg } = require('./user-all.js');
const { getUsers } = require('./admin-users.js');
const { getDailyMsgStat } = require('./admin-msgs.js');

program.name('middo-cli').description('CLI for middo').version('0.0.1');

program
    .command('get-users')
    .description('Get users')
    .action(function () {
        getUsers();
    });

program.command('get-daily-msg-stat')
    .description('Get daily msg stat')
    .action(function () {
        getDailyMsgStat();
    });

program.command('get-google-stat')
    .description('Get google api call stat')
    .action(async function () {
        const url = `http://${process.env.BACKEND_ADDRESS}/api/google-api-stat`
        const res = await fetch(url).then(res => res.json());
        console.log(res);
    });

program.command('sign-in')
    .description('Sign in')
    .option('-e, --email <type>', 'email address')
    .option('-p, --password <type>', 'password')
    .action(async function (options) {
        const { email, password } = options
        const token = await signIn(email, password);
        await exec(`echo ${token} > .${email}.token`);
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
        console.log(summary);
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
        const { email, msg } = options
        const filename = `.${email}.token`;
        const token = fs.readFileSync(filename, 'utf8').trim();
        const roomId = fs.readFileSync('.room.id', 'utf8').trim();

        const response = await postMsg(token, roomId, msg);

        console.log(response);
    });

program.parse();

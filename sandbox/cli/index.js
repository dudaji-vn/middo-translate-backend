"use strict";

const commander = require("commander");
const program = new commander.Command();

const { getUsers } = require('./users.js');
const { getDailyMsgStat } = require('./msgs.js');
const { get } = require("http");

program
    .name('middo-cli')
    .description('CLI for middo')
    .version('0.0.1');

program.command('get-users')
    .description('Get users')
    .action(function () {
        getUsers();
    });

program.command('get-daily-msg-stat')
    .description('Get daily msg stat')
    .action(function () {
        getDailyMsgStat();
    });

program.parse();

// program.command('split')
//     .description('Split a string into substrings and display as an array')
//     .argument('<string>', 'string to split')
//     .option('--first', 'display just the first substring')
//     .option('-s, --separator <char>', 'separator character', ',')
//     .action(function (str, options) {
//         var limit = options.first ? 1 : undefined;
//         console.log(str.split(options.separator, limit));
//     });
/* eslint-disable no-undef */
const winston = require('winston');
const { format, transports } = require('winston');
const path = require('path');
const PROJECT_ROOT = path.join(__dirname);

const logger = winston.createLogger({
    format: format.combine(
        format.timestamp(),
        format.colorize(),
        format.simple(),
    ),
    transports: [
        new winston.transports.File({
            format: format.combine(
                format.timestamp(),
                format.uncolorize(),
                format.prettyPrint()
            ),
            filename: 'cli.log'
        }),
        new transports.Console()
    ]
})

logger.stream = {
    write: function (message) {
        logger.info(message)
    }
}

// A custom logger interface that wraps winston, making it easy to instrument
// code and still possible to replace winston in the future.

module.exports.debug = module.exports.log = function () {
    logger.debug(formatLogArguments(arguments))
}

module.exports.info = function () {
    logger.info(formatLogArguments(arguments))
}

module.exports.warn = function () {
    logger.warn(formatLogArguments(arguments))
}

module.exports.error = function () {
    logger.error(formatLogArguments(arguments))
}

module.exports.stream = logger.stream

/**
 * Attempts to add file and line number info to the given log arguments.
 */
function formatLogArguments(args) {
    args = Array.prototype.slice.call(args);
    var stackInfo = getStackInfo(1)

    if (stackInfo) {
        // get file path relative to project root
        var calleeStr = '(' + stackInfo.relativePath + ':' + stackInfo.line + ')'
        args.unshift(calleeStr);
        // if (typeof args[0] === 'string') {
        //     args[0] = calleeStr + ' ' + args[0];
        //     // args[0] = `log${arrow} ${args[0]}`;
        // } else {
        //     // const logging = highlight('Logging below\u2B07 ');
        //     // console.log(calleeStrHl, logging);
        //     // console.log(JSON.stringify(args, null, 2));
        // }
    }
    return args
}

/**
 * Parses and returns info about the call stack at the given index.
 */
function getStackInfo(stackIndex) {
    // get call stack, and analyze it
    // get all file, method, and line numbers
    var stacklist = (new Error()).stack.split('\n').slice(3)

    // stack trace format:
    // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
    // do not remove the regex expresses to outside of this method (due to a BUG in node.js)
    var stackReg = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi
    var stackReg2 = /at\s+()(.*):(\d*):(\d*)/gi

    var s = stacklist[stackIndex] || stacklist[0]
    var sp = stackReg.exec(s) || stackReg2.exec(s)

    if (sp && sp.length === 5) {
        return {
            method: sp[1],
            relativePath: path.relative(PROJECT_ROOT, sp[2]),
            line: sp[3],
            pos: sp[4],
            file: path.basename(sp[2]),
            stack: stacklist.join('\n')
        }
    }
}

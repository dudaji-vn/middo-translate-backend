/* eslint-disable no-undef */
const winston = require('winston');
const { format, transports } = require('winston');
const path = require('path');
const PROJECT_ROOT = path.join(__dirname);

const popLocationInfoItShouldCalledOnedInGlobalFormatter = format(function (info) {
    const location = info.message.shift();
    info.location = location;
    return info;
});

const dudajiFormat = format.printf(function (info) {
    const { timestamp, label, level, location, message } = info;
    return `${timestamp} [${location}] ${label} ${level}: ${message}`;
});

const timezoned = () => {
    return new Date().toLocaleString();
}

const getLabelLogger = function (label) {
    const _l = winston.createLogger({
        format: format.combine(
            popLocationInfoItShouldCalledOnedInGlobalFormatter()
        ),
        transports: [
            new winston.transports.File({
                level: 'debug',
                format: format.combine(
                    format.label({ label }),
                    format.timestamp({ format: timezoned }),
                    format.splat(),
                    format.prettyPrint()
                ),
                filename: path.join(PROJECT_ROOT, 'cli.log')
            }),
            new transports.Console({
                level: 'info',
                format: format.combine(
                    format.label({ label }),
                    format.timestamp({ format: timezoned }),
                    format.colorize(),
                    dudajiFormat,
                ),
            })
        ]
    })

    _l.stream = {
        write: function (message) {
            _l.info(message)
        }
    }

    const l = { _logger: _l };

    l.debug = l.log = function () {
        _l.debug(pushLocationInfo(arguments));
    }

    l.info = function () {
        _l.info(pushLocationInfo(arguments));
    }

    l.warn = function () {
        _l.warn(pushLocationInfo(arguments));
    }

    l.error = function () {
        _l.error(pushLocationInfo(arguments));
    }
    l.stream = _l.stream;

    return l;
}

const logger = getLabelLogger('');

module.exports = {
    logger,
    getLabelLogger,
};

/**
 * Attempts to add file and line number info to the given log arguments.
 */
function pushLocationInfo(args) {
    args = Array.prototype.slice.call(args);
    var stackInfo = getStackInfo(1)

    if (stackInfo) {
        var calleeStr = stackInfo.relativePath + ':' + stackInfo.line;
        args.unshift(calleeStr);
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

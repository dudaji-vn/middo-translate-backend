import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import * as path from 'path';
const PROJECT_ROOT = path.join(__dirname, '../../..');

const popLocationInfoItShouldCalledOnceInGlobalFormatter = format(function (
  info: any,
) {
  const location: string = info.message.shift();
  info.location = location;
  return info;
});

const dudajiFormat = format.printf(function (info: any) {
  const { timestamp, label, level, location, message } = info;
  if (label) {
    return `${timestamp} [${location}] ${label} ${level}: ${message}`;
  } else {
    return `${timestamp} [${location}] ${level}: ${message}`;
  }
});

const timezoned = (): string => {
  return new Date().toLocaleString();
};

const getLabelLogger = function (label: string): Logger {
  const _l: Logger = createLogger({
    format: format.combine(
      popLocationInfoItShouldCalledOnceInGlobalFormatter(),
    ),
    transports: [
      new transports.File({
        level: 'debug',
        format: format.combine(
          format.label({ label }),
          format.timestamp({ format: timezoned }),
          format.splat(),
          format.prettyPrint(),
        ),
        filename: path.join(PROJECT_ROOT, `backend.${label}.log`),
      }),
      new transports.Console({
        level: 'info',
        format: format.combine(
          format.label({ label }),
          format.timestamp({ format: timezoned }),
          format.colorize(),
          dudajiFormat,
        ),
      }),
    ],
  });

  const l: any = { _logger: _l };

  l.debug = function (...args: any[]) {
    _l.debug(pushLocationInfo(args));
  };

  l.info = function (...args: any[]) {
    _l.info(pushLocationInfo(args));
  };

  l.warn = function (...args: any[]) {
    _l.warn(pushLocationInfo(args));
  };

  l.error = function (...args: any[]) {
    _l.error(pushLocationInfo(args));
  };

  return l;
};

const logger: Logger = getLabelLogger('main');

export { logger, getLabelLogger };

/**
 * Attempts to add file and line number info to the given log arguments.
 */
function pushLocationInfo(args: any[]): any[] {
  args = Array.prototype.slice.call(args);
  const stackInfo = getStackInfo(1);

  if (stackInfo) {
    const calleeStr = stackInfo.relativePath + ':' + stackInfo.line;
    args.unshift(calleeStr);
  }
  return args;
}

// const s = (new Error()).stack?.split('\n').slice(3);
const getStackInfo = (stackIndex: number) => {
  // get call stack, and analyze it
  // get all file, method, and line numbers
  const stacklist = new Error().stack?.split('\n').slice(3);
  if (!stacklist) return undefined;
  // stack trace format:
  // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
  // do not remove the regex expresses to outside of this method (due to a BUG in node.js)
  const stackReg = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi;
  const stackReg2 = /at\s+()(.*):(\d*):(\d*)/gi;

  const s = stacklist[stackIndex] || stacklist[0];
  const sp = stackReg.exec(s) || stackReg2.exec(s);

  if (sp && sp.length === 5) {
    // console.log(PROJECT_ROOT, sp[2]);
    return {
      method: sp[1],
      relativePath: path.relative(PROJECT_ROOT, sp[2]),
      line: sp[3],
      pos: sp[4],
      file: path.basename(sp[2]),
      stack: stacklist.join('\n'),
    };
  }
};

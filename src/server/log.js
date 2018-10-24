/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const fs = require('fs');
const logFile = require('./config').logFile;
const LogEmail = require('./models/LogEmail');

/**
 * Represents the importance of a message to be logged
 */
class LogLevel {
	/**
	 * Create a new LogLevel
	 * @param name the name of this LogLevel
	 * @param priority the priority of this LogLevel. Lower numbers are more important.
	 */
	constructor(name, priority) {
		this.name = name;
		this.priority = priority;
	}
}

LogLevel.DEBUG = new LogLevel('DEBUG', 40);
LogLevel.INFO = new LogLevel('INFO', 30);
LogLevel.WARN = new LogLevel('WARN', 20);
LogLevel.ERROR = new LogLevel('ERROR', 10);
LogLevel.SILENT = new LogLevel('SILENT', Number.NEGATIVE_INFINITY);


class Logger {

	constructor(logFilePath) {
		this.level = LogLevel.INFO;
		this.emailLevel = LogLevel.ERROR;
		this.logToFile = true;
		this.logToConsole = true;
		this.logFile = logFilePath;
	}

	/**
	 * Log using a custom LogLevel.
	 *
	 * A convenience method such as info() or error() is likely to be more convenient than this.
	 * @param {LogLevel} level the level to log at
	 * @param {String} message the message to log
	 * @param {Error?} error An optional error object to provide a stacktrace
	 * @param {boolean?} skipMail Don't e-mail this message even if we would normally emit an e-mail for this level.
	 */
	log(level, message, error = null, skipMail = false) {
		// Only log if given a high enough priority level.
		if (level.priority <= this.level.priority && !skipMail) {
			let messageToLog = `[${level.name}@${new Date(Date.now()).toISOString()}] ${message}\n`;

			// Add a stacktrace to the message if one was provided
			if (error !== null) {
				if (error.stack) {
					messageToLog += `Stacktrace: \n${error.stack}\n`;
				} else {
					// It's possible someone passed in an error that isn't actually an Error object
					// because javascript lets you throw anything. In that case, the error won't have
					// a stack.

					// So we just try to convert whatever we got to a string and include it. It's better
					// than nothing.
					messageToLog += `An error was included, but it was not an Error object:\n${error}`;
				}
			}
			if (this.logToConsole) {
				if (level.priority >= LogLevel.WARN.priority) {
					// tslint:disable-next-line no-console
					console.error(messageToLog);
				} else {
					// tslint:disable-next-line no-console
					console.log(messageToLog);
				}
			}
			if (this.logToFile) {
				fs.appendFile(logFile, messageToLog, err => {
					if (err) {
						console.error(`Failed to write to log file: ${err}`); // tslint:disable-line no-console
					}
				});
			}
		}

		// Only send an e-mail if given a high enough priority level.
		if (level.priority <= this.emailLevel.priority) {
			let messageToMail = `At ${new Date(Date.now()).toISOString()}, an ${level.name} event occurred.\n`;
			messageToMail += `${message}\n`;
			const logEmail = new LogEmail(undefined, messageToMail);
			(async () => {
				try {
					await logEmail.insert();
				} catch (err) {
					console.error(`Error while inserting log mail ${err}`); // tslint:disable-line no-console
				}
			})();
		}
	}

	/**
	 * Log the given message at the DEBUG level
	 * @param {String} message the message to log
	 * @param {Error?} error An optional error object to include information about
	 * @param {boolean?} skipMail Don't e-mail this message even if we would normally emit an e-mail for this level.
	 */
	debug(message, error = null, skipMail = false) {
		this.log(LogLevel.DEBUG, message, error, skipMail);
	}

	/**
	 * Log the given message at the INFO level
	 * @param {String} message the message to log
	 * @param {Error?} error An optional error object to include information about
	 * @param {boolean?} skipMail Don't e-mail this message even if we would normally emit an e-mail for this level.
	 */
	info(message, error = null, skipMail = false) {
		this.log(LogLevel.INFO, message, error, skipMail);
	}

	/**
	 * Log the given message at the WARN level
	 * @param {String} message the message to log
	 * @param {Error?} error An optional error object to include information about
	 * @param {boolean?} skipMail Don't e-mail this message even if we would normally emit an e-mail for this level.
	 */
	warn(message, error = null, skipMail = false) {
		this.log(LogLevel.WARN, message, error, skipMail);
	}

	/**
	 * Log the given message at the ERROR level
	 * @param {String} message the message to log
	 * @param {Error?} error An optional error object to include information about
	 * @param {boolean?} skipMail Don't e-mail this message even if we would normally emit an e-mail for this level.
	 */
	error(message, error = null, skipMail = false) {
		this.log(LogLevel.ERROR, message, error, skipMail);
	}

}


const defaultLogger = new Logger(logFile);

defaultLogger.logToFile = true;
defaultLogger.logToConsole = true;
defaultLogger.level = LogLevel.DEBUG;

/**
 * @type {{log: Logger, LogLevel: LogLevel}}
 */
module.exports = { log: defaultLogger, LogLevel };

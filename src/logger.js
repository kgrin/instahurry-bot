const colors = require('colors');
const utils = require('./utils');

class Logger {
    getDateTime() {
        return `[${utils.getDateTime()}]`.bold;
    }

    info(message) {
        console.log(`${this.getDateTime()} ${message.green}`);
    }

    warning(message) {
        console.log(`${this.getDateTime()} ${message.yellow}`);
    }

    error(message) {
        console.log(`${this.getDateTime()} ${message.red}`);
    }
}

let logger = new Logger();

module.exports = logger;
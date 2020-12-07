const mysql = require('mysql');
const config = require('./config');

let main = mysql.createPool({
    host: config.db.main.host,
    port: config.db.main.port,
    user: config.db.main.user,
    password: config.db.main.password,
    database: config.db.main.database,
    timezone: 'utc',
    acquireTimeout: 60000,
    supportBigNumbers: true,
    bigNumberStrings: true,
});

let bot = mysql.createPool({
    host: config.db.bot.host,
    port: config.db.bot.port,
    user: config.db.bot.user,
    password: config.db.bot.password,
    database: config.db.bot.database,
    timezone: 'utc',
    acquireTimeout: 60000,
    supportBigNumbers: true,
    bigNumberStrings: true,
});

let query = (db, sql) => {
    return new Promise((resolve, reject) => {
        db.query(sql, (e, response, fields) => {
            if (e) {
                reject(e);
            } else {
                resolve(response);
            }
        })
    });
};

module.exports = {
    main,
    bot,
    query,
};
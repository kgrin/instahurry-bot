const moment = require('moment');

module.exports = {
    getDateTime: (format = 'YYYY-MM-DD HH:mm:ss') => {
        return moment().format(format);
    },
    getDateTimeFromUnix: (unix, format = 'YYYY-MM-DD HH:mm:ss') => {
        return moment.unix(unix).format(format);
    },
    sleep: async (seconds) => {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    },
};
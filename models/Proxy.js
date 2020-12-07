const axios = require('axios');

/**
 * @property {number} id
 * @property {string} url
 */
class Proxy {
    constructor(id, url) {
        this.id = id;
        this.url = url;
    }

    async check(url = 'https://www.instagram.com?v=1') {
        let response = await axios.get(url, {
            http_proxy: this.url,
        });

        return response.status === 200;
    }
}

module.exports = Proxy;
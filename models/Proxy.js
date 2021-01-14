const _ = require('lodash');
const axios = require('axios');
const HttpProxyAgent = require('http-proxy-agent');
const HttpsProxyAgent = require('https-proxy-agent');
const db = require('../src/db');
const logger = require('../src/logger');
const utils = require('../src/utils');

/**
 * @property {number} id
 * @property {string} url
 */
class Proxy {
    constructor(id, url) {
        this.id = id;
        this.url = url;
    }

    static async checkProvider(providerId, url = 'https://www.instagram.com?v=1', timeout = 5) {
        try {
            logger.info(`[PROXY] checkProvider() [providerId = ${providerId}] [url = ${url}] [timeout = ${timeout}]`);

            let proxies = await db.query(
                db.main,
                `select
                    id,
                    url
                from
                    ih_proxies
                where
                     provider_id = ${providerId}
                 and is_deleted = 0`
            );

            let chunks = _.chunk(proxies, 100);

            for (let chunk of chunks) {
                let promises = chunk.map(async (proxy) => {
                    proxy = new Proxy(proxy.id, proxy.url);

                    try {
                        let check = await proxy.check(url, timeout);
                        if (check) {
                            await proxy.enable();
                        } else {
                            await proxy.disable();
                        }
                    } catch (e) {
                        await proxy.disable();
                    }
                });

                await Promise.all(promises);

                await utils.sleep(5);
            }

            return true;
        } catch (e) {
            logger.error(`[PROXY] checkProvider() [providerId = ${providerId}] [url = ${url}]\n${e.message}`);
        }
    }

    async check(url = 'https://www.instagram.com?v=1', timeout = 5) {
        try {
            logger.info(`[PROXY] check() [id = ${this.id}]`);

            let response = null;
            let source = axios.CancelToken.source();

            setTimeout(() => {
                if (response === null) {
                    source.cancel();
                }
            }, timeout * 1000);

            response = await axios.get(url, {
                cancelToken: source.token,
                httpAgent: new HttpProxyAgent(this.url),
                httpsAgent: new HttpsProxyAgent(this.url),
                proxy: false,
                timeout: timeout * 1000,
            });

            return response && response.status === 200;
        } catch (e) {
            if (axios.isCancel(e)) {
                logger.error(`[PROXY] check() [id = ${this.id}] canceled`);
            } else {
                logger.error(`[PROXY] check() [id = ${this.id}]\n${e.message}`);
            }

            return false;
        }
    }

    async disable() {
        try {
            logger.info(`[PROXY] disable() [id = ${this.id}]`);

            await db.query(
                db.main,
                `update
                    ih_proxies
                set
                    status_id = 0
                where
                    id = ${this.id}`
            );
        } catch (e) {
            logger.error(`[PROXY] disable()\n${e.message}`);
        }
    }

    async enable() {
        try {
            logger.info(`[PROXY] enable() [id = ${this.id}]`);

            await db.query(
                db.main,
                `update
                    ih_proxies
                set
                    status_id = 1
                where
                    id = ${this.id}`
            );
        } catch (e) {
            logger.error(`[PROXY] enable()\n${e.message}`);
        }
    }
}

module.exports = Proxy;
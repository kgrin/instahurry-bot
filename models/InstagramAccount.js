const crypto = require('crypto');
const db = require('../src/db');
const logger = require('../src/logger');
const Bot = require('./Bot');
const Proxy = require('./Proxy');

/**
 * @property {number} id
 * @property {string} username
 * @property {string} password
 * @property {number} status
 * @property {Proxy} proxy
 * @property {Bot} bot
 */
class InstagramAccount {
    constructor(id, username, passwordEncrypted, proxyId, proxyUrl) {
        this.id = parseInt(id);
        this.username = username.trim();
        this.password = this.decryptPassword(passwordEncrypted.trim());
        this.status = 0;

        this.proxy = new Proxy(proxyId, proxyUrl);
        this.bot = new Bot(this);
    }

    decryptPassword(passwordEncrypted) {
        let key = crypto.createHash('sha256').update('derparol2018ihig', 'utf8').digest();
        let iv = Buffer.from([0xb3, 0xf8, 0x26, 0x40, 0x18, 0x5b, 0x00, 0xfe, 0x1e, 0xe0, 0x5a, 0x87, 0xd4, 0x82, 0x16, 0x44]);
        let decipheriv = crypto.createDecipheriv('aes-256-ctr', key, iv);
        return decipheriv.update(passwordEncrypted, 'base64', 'utf8');
    }

    static async getAccount(id) {
        try {
            let t = await db.query(
                db.main,
                `select
                    ia.id id,
                    ia.login username,
                    ia.password_encrypted password_encrypted,
                    p.id proxy_id,
                    p.url proxy_url
                from
                    ih_accounts a
                        left join ih_instagram_accounts ia on ia.id = a.instagram_account_id
                        left join ih_proxies p on p.id = a.proxy_id
                where
                      ia.id = ${id}
                  and a.is_deleted = 0
                  and ia.is_deleted = 0
                  and p.is_deleted = 0
                limit 1`
            );

            if (t.length) {
                t = t[0];
                return new InstagramAccount(t.id, t.username, t.password_encrypted, t.proxy_id, t.proxy_url);
            }
        } catch (e) {
            logger.error('getAccount() error\n' + e.message);
        }

        return null;
    }

    static async getAccounts() {
        try {
            return await db.query(
                db.main,
                `select
                    ia.id id,
                    ia.login username,
                    ia.password_encrypted password_encrypted,
                    p.id proxy_id,
                    p.url proxy_url
                from
                    ih_accounts a
                        left join ih_instagram_accounts ia on ia.id = a.instagram_account_id
                        left join ih_proxies p on p.id = a.proxy_id
                where
                      a.status_id = 1
                  and a.is_deleted = 0
                  and ia.status_id = 1
                  and ia.is_deleted = 0
                  and p.status_id = 1
                  and p.is_deleted = 0`
            );
        } catch (e) {
            logger.error('getAccounts() error\n' + e.message);
            return [];
        }
    }

    async updateStatus() {
        let result = await db.query(
            db.main,
            `select
                status_id status
            from
                ih_accounts
            where
                  instagram_account_id = ${this.id}
              and is_deleted = 0
            limit 1`
        );

        if (result.length) {
            if (this.status && result[0].status !== 1) {
                await this.bot.stop();
            } else if (!this.status && result[0].status === 1) {
                await this.bot.login();
            }
        }
    }
}

module.exports = InstagramAccount;
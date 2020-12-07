const db = require('../src/db');
const utils = require('../src/utils');
const Bot = require('./Bot');

/**
 * @property {number} taken_at
 * @property {string} pk
 * @property {string} id
 * @property {number} media_type
 * @property {string} code
 * @property {number} lat
 * @property {number} lng
 * @property {number} comment_count
 * @property {number} like_count
 * @property {boolean} has_liked
 * @property {object} user
 */
class Media {
    constructor(pk) {
        this.pk = pk;
    }

    /**
     * @param {Bot} bot
     * @returns {Promise<void>}
     */
    async getInfo(bot) {
        let mediaInfo = (await bot.ig.media.info(this.pk)).items[0];

        [
            'taken_at',
            'pk',
            'id',
            'media_type',
            'code',
            'lat',
            'lng',
            'comment_count',
            'like_count',
            'has_liked',
            'user',
        ].forEach(v => {
            this[v] = mediaInfo[v];
        });
    }

    async existsInDb() {
        let t = await db.query(
            db.bot,
            `select
                id
            from
                ih_internal_media
            where
                media_id = ${this.pk}
            limit 1`
        );

        return t.length > 0;
    }

    async save() {
        let instagramAccountId = await db.query(
            db.main,
            `select
                id
            from
                ih_instagram_accounts
            where
                instagram_user_id = ${this.user.pk}
            limit 1`
        );
        instagramAccountId = instagramAccountId.length ? instagramAccountId[0].id : null;

        if (instagramAccountId) {
            await db.query(
                db.bot,
                `insert into
                    ih_internal_media
                set
                    instagram_account_id = ${instagramAccountId},
                    author_id = ${this.user.pk},
                    media_id = '${this.pk}',
                    web_link = 'https://www.instagram.com/p/${this.code}/',
                    master_bot_id = 1,
                    taken_time = '${utils.getDateTimeFromUnix(this.taken_at)}',
                    created_at = '${utils.getDateTime()}',
                    updated_at = '${utils.getDateTime()}',
                    status_id = 1`
            );
        }
    }
}

module.exports = Media;
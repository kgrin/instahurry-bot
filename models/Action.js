const db = require('../src/db');
const utils = require('../src/utils');

/**
 * @property {number} actionType
 * @property {InstagramAccount} instagramAccount
 * @property {Media} media
 * @property {string} commentText
 */
class Action {
    constructor(actionType, instagramAccount, media, commentText = '') {
        this.actionType = actionType;
        this.instagramAccount = instagramAccount;
        this.media = media;
        this.commentText = commentText;
    }

    async save() {
        await db.query(
            db.bot,
            `insert into
                    ih_actions
            set
                action_type = ${this.actionType},
                instagram_account_id = ${this.instagramAccount.id},
                instagram_user_id = ${this.instagramAccount.bot.auth.pk},
                ig_media_id = ${this.media.pk},
                ig_media_shortcode = '${this.media.code}',
                ig_author_id = ${this.media.user.pk},
                ig_author_name = '${this.media.user.username}',
                master_bot_id = 1,
                proxy_id = ${this.instagramAccount.proxy.id},
                data_source_type = 5,
                data_source_id = 1,
                action_text = '${this.commentText}',
                create_date = '${utils.getDateTime('YYYY-MM-DD')}',
                created_at = '${utils.getDateTime()}',
                updated_at = '${utils.getDateTime()}'`
        );
    }
}

module.exports = Action;
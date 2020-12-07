const _ = require('lodash');
const {IgActionSpamError} = require('instagram-private-api');
const db = require('../src/db');
const logger = require('../src/logger');
const utils = require('../src/utils');
const Action = require('./Action');
const InstagramAccount = require('./InstagramAccount');
const Media = require('./Media');

/**
 * @property {number} id
 * @property {number} actionType
 * @property {InstagramAccount} instagramAccount
 * @property {Media} media
 * @property {string} commentText
 */
class Task {
    constructor(id, actionType, instagramAccount, media, commentText = '') {
        this.id = id;
        this.actionType = actionType;
        this.instagramAccount = instagramAccount;
        this.media = media;
        this.commentText = commentText.trim();
    }

    async run() {
        try {
            let result = null;
            switch (this.actionType) {
                case 1:
                    result = await this.like();
                    break;
                case 2:
                    result = await this.comment();
                    break;
                case 14:
                    result = await this.viewStory();
                    break;
            }

            if (result && result.status === 'ok') {
                await this.updateTaskStatus(1);

                let action = new Action(this.actionType, this.instagramAccount, this.media, this.commentText);
                await action.save();

                logger.info(`[${this.instagramAccount.username}] task [id = ${this.id}] done`);
            } else {
                logger.info(`[${this.instagramAccount.username}] task [id = ${this.id}] error [result = ${JSON.stringify(result)}]`);
            }
        } catch (e) {
            logger.error(`[${this.instagramAccount.username}] ${e.message}`);

            await this.incrementTriesCount();

            switch (true) {
                case e instanceof IgActionSpamError:
                    await this.handleActionBlock();
                    break;
                default:
                    break;
            }
        }
    }

    async like() {
        logger.info(`[${this.instagramAccount.username}] like()`);

        if (!this.media.has_liked) {
            return await this.instagramAccount.bot.ig.media.like({
                mediaId: this.media.id,
                moduleInfo: {
                    module_name: 'profile',
                    user_id: this.instagramAccount.bot.auth.pk,
                    username: this.instagramAccount.bot.auth.username,
                },
                d: _.sample([0, 1]),
            });
        } else {
            logger.info(`[${this.instagramAccount.username}] task [id = ${this.id}] canceled, media [id = ${this.media.pk}] [has_liked = true]`);
            await this.updateTaskStatus(2);

            return {
                status: 'ok',
            };
        }
    }

    async comment() {
        logger.info(`[${this.instagramAccount.username}] comment()`);

        return await this.instagramAccount.bot.ig.media.comment({
            mediaId: this.media.id,
            text: this.commentText,
        });
    }

    async viewStory(count = 10) {
        logger.info(`[${this.instagramAccount.username}] viewStory()`);

        let reelsFeed = this.instagramAccount.bot.ig.feed.reelsMedia({
            userIds: [this.media.user.pk],
        });

        let storyItems = (await reelsFeed.items()).slice(0, count);

        return await this.instagramAccount.bot.ig.story.seen(storyItems);
    }

    async updateTaskStatus(status) {
        await db.query(db.bot, `update ih_tasks set status_id = ${status} where id = ${this.id}`);
    }

    async incrementTriesCount() {
        await db.query(db.bot, `update ih_tasks set tries_count = tries_count + 1 where id = ${this.id}`);
    }

    async handleActionBlock() {
        let field = null;
        switch (this.actionType) {
            case 1:
                field = 'likes_block_date';
                break;
            case 2:
                field = 'comments_block_date';
                break;
            case 14:
                field = 'view_story_block_date';
                break;
        }

        if (field) {
            await db.query(
                db.main,
                `update
                    ih_stats_common
                set
                    ${field} = ${utils.getDateTime()}
                where
                    instagram_account_id = ${this.instagramAccount.id}`
            );

            await db.query(
                db.bot,
                `update
                    ih_tasks
                set
                    is_deleted = 1
                where
                    instagram_account_id = ${this.instagramAccount.id}
                and action_type = ${this.actionType}
                and status_id = 0`
            );
        }
    }
}

module.exports = Task;
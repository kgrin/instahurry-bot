const fs = require('fs');
const {
    AccountRepositoryLoginResponseLogged_in_user,
    IgApiClient,
    IgChallengeWrongCodeError,
    IgCheckpointError,
    IgLoginBadPasswordError,
    IgLoginInvalidUserError,
} = require('instagram-private-api');
const db = require('../src/db');
const logger = require('../src/logger');
const utils = require('../src/utils');
const Incident = require('./Incident');
const InstagramAccount = require('./InstagramAccount');
const Media = require('./Media');
const Task = require('./Task');

/**
 * @property {IgApiClient} ig
 * @property {AccountRepositoryLoginResponseLogged_in_user} auth
 * @property {InstagramAccount} instagramAccount
 * @property {Task[]} tasks
 */
class Bot {
    constructor(instagramAccount) {
        this.instagramAccount = instagramAccount;
        this.auth = null;
        this.doTimeout = 0;

        this.ig = new IgApiClient();
        this.ig.state.generateDevice(this.instagramAccount.username);
        this.ig.state.proxyUrl = this.instagramAccount.proxy.url;
        this.ig.request.end$.subscribe(async () => {
            let serialized = await this.ig.state.serialize();
            delete serialized.constants;
            this.saveState(serialized);
        });
    }

    async init() {
        logger.info(`[${this.instagramAccount.username}] init()`);

        let state = this.getState();
        if (state) {
            await this.ig.state.deserialize(state);
        } else {
            await this.ig.simulate.preLoginFlow();
        }
    }

    async start() {
        logger.info(`[${this.instagramAccount.username}] start()`);

        this.instagramAccount.status = 1;

        this.doTimeout = setTimeout(() => {
            this.do();
        }, 60000);
    }

    async stop() {
        logger.info(`[${this.instagramAccount.username}] stop()`);

        this.instagramAccount.status = 0;

        clearTimeout(this.doTimeout);
    }

    async login() {
        try {
            logger.info(`[${this.instagramAccount.username}] login()`);

            await this.stop();

            this.auth = await this.ig.account.login(this.instagramAccount.username, this.instagramAccount.password);
            await this.ig.simulate.postLoginFlow();

            await this.loggedIn();

            await this.start();

            return 0;
        } catch (e) {
            switch (true) {
                case e instanceof IgLoginInvalidUserError:
                case e instanceof IgLoginBadPasswordError:
                    logger.error(`[${this.instagramAccount.username}] invalid password`);

                    await db.query(db.main, `update ih_stats_common set last_login_result = 21 where instagram_account_id = ${this.instagramAccount.id}`);

                    return 21;
                case e instanceof IgCheckpointError:
                    logger.error(`[${this.instagramAccount.username}] verification`);

                    await this.ig.challenge.auto(true);

                    await db.query(db.main, `update ih_stats_common set last_login_result = 22 where instagram_account_id = ${this.instagramAccount.id}`);

                    return 22;
                default:
                    logger.error(`[${this.instagramAccount.username}] ${e.message}`);

                    await db.query(db.main, `update ih_stats_common set last_login_result = 1 where instagram_account_id = ${this.instagramAccount.id}`);

                    return 1;
            }
        }
    }

    async challenge(verificationCode) {
        try {
            logger.info(`[${this.instagramAccount.username}] challenge() [verificationCode = ${verificationCode}]`);

            let response = await this.ig.challenge.sendSecurityCode(verificationCode);
            this.auth = response.logged_in_user;

            await this.ig.simulate.postLoginFlow();

            await this.loggedIn();

            await this.start();

            return 0;
        } catch (e) {
            switch (true) {
                case e instanceof IgChallengeWrongCodeError:
                    logger.error(`[${this.instagramAccount.username}] wrong [verificationCode = ${verificationCode}]`);

                    return 2;
                default:
                    logger.error(`[${this.instagramAccount.username}]\n${e.message}`);

                    return 1;
            }
        }
    }

    async loggedIn() {
        logger.info(`[${this.instagramAccount.username}] loggedIn()`);

        let incident = new Incident(6, 11, this.instagramAccount);
        await incident.save();

        await db.query(db.main, `update ih_stats_common set last_login_result = 0 where instagram_account_id = ${this.instagramAccount.id}`);
    }

    getStateFilePath() {
        return './_bot/' + this.instagramAccount.id + '.json';
    }

    getState() {
        return fs.existsSync(this.getStateFilePath()) ? fs.readFileSync(this.getStateFilePath(), 'utf-8') : null;
    }

    saveState(data) {
        fs.writeFileSync(this.getStateFilePath(), JSON.stringify(data), 'utf-8');
    }

    async do() {
        try {
            logger.info(`[${this.instagramAccount.username}] do()`);

            let task = await this.getTask();
            if (task) {
                logger.info(`[${this.instagramAccount.username}] found new task [id = ${task.id}]`);
                await task.run();
            } else {
                logger.info(`[${this.instagramAccount.username}] no new tasks, checking for new medias/stories`);
                await this.updateMedias();
                await this.updateStories();
            }

            if (this.instagramAccount.status === 1) { // status check is duplicated because bot can be disabled while performing task.run() or this.updateMedias()
                this.doTimeout = setTimeout(() => {
                    this.do();
                }, 60000);
            }
        } catch (e) {
            logger.error(`[${this.instagramAccount.username}] do() error\n${e.message}`);
        }
    }

    async getTask() {
        logger.info(`[${this.instagramAccount.username}] getTask()`);

        let taskInfo = await db.query(
            db.bot,
            `select
                id,
                media_id
            from
                ih_tasks
            where
                  instagram_account_id = ${this.instagramAccount.id}
              and action_type = 1
              and status_id = 0
              and is_deleted = 0
              and tries_count < max_tries_count
              and scheduled_time < '${utils.getDateTime()}'
              and expiration_time > '${utils.getDateTime()}'
            order by expiration_time
            limit 1`
        );

        if (taskInfo.length) {
            let media = new Media(taskInfo[0].media_id);
            await media.getInfo(this);

            return new Task(taskInfo[0].id, this.instagramAccount, media);
        }

        return null;
    }

    async updateMedias(count = 10) {
        try {
            logger.info(`[${this.instagramAccount.username}] updateMedias()`);

            let feed = this.ig.feed.user(this.auth.pk);
            let posts = (await feed.items()).slice(0, count);

            for (let post of posts) {
                let media = new Media(post.pk);
                await media.getInfo(this);

                let exists = await media.existsInDb();
                if (!exists) {
                    logger.info(`[${this.instagramAccount.username}] found new media [id = ${media.pk}]`);
                    await media.save();
                }
            }
        } catch (e) {
            logger.error(`[${this.instagramAccount.username}] updateMedias() error\n${e.message}]`);
        }
    }

    async updateStories() {
        try {
            logger.info(`[${this.instagramAccount.username}] updateStories()`);

            let feed = this.ig.feed.userStory(this.auth.pk);
            let stories = await feed.items();

            let lastStory = stories.pop();

            if (lastStory) {
                let takenAtDateTime = utils.getDateTimeFromUnix(lastStory.taken_at);

                await db.query(
                    db.bot,
                    `insert into
                        ih_internal_stories
                    set
                        instagram_account_id = ${this.instagramAccount.id},
                        last_media_added_at = '${takenAtDateTime}'
                    on duplicate key update
                        last_media_added_at = '${takenAtDateTime}'`
                );
            }
        } catch (e) {
            logger.error(`[${this.instagramAccount.username}] updateStories() error\n${e.message}]`);
        }
    }
}

module.exports = Bot;
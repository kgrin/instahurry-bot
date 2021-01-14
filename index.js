// https://github.com/dilame/instagram-private-api

const express = require('express');
const logger = require('./src/logger');
const utils = require('./src/utils');
const InstagramAccount = require('./models/InstagramAccount');
const Proxy = require('./models/Proxy');

(async () => {
    try {
        let app = express().use(express.json());
        app.listen(16512, () => {
            logger.warning(`[SERVER] listening [port = 16512]`);
        });

        let accounts = [];
        let t = await InstagramAccount.getAccounts();
        if (t.length) {
            for (let v of t) {
                let instagramAccount = new InstagramAccount(v.id, v.username, v.password_encrypted, v.proxy_id, v.proxy_url);
                accounts[instagramAccount.id] = instagramAccount;

                setTimeout(async () => {
                    await instagramAccount.bot.init();
                    await instagramAccount.bot.login();
                }, 100);
            }
        }

        app.get('/startBot', async (request, response) => {
            let instagramAccountId = request.query.instagram_account_id;
            if (instagramAccountId) {
                logger.warning(`[SERVER] startBot [instagram_account_id = ${instagramAccountId}]`);

                let instagramAccount = accounts[instagramAccountId];
                if (instagramAccount) {
                    if (instagramAccount.status !== 1) {
                        await instagramAccount.bot.login();
                    } else {
                        logger.warning(`[SERVER] startBot [instagram_account_id = ${instagramAccountId}] - ignored [instagramAccount.status = 1]`);
                    }
                } else {
                     instagramAccount = await InstagramAccount.getAccount(instagramAccountId);
                     if (instagramAccount) {
                         accounts[instagramAccount.id] = instagramAccount;

                         await instagramAccount.bot.init();
                         await instagramAccount.bot.login();
                     }
                }

                response.send({
                    status: instagramAccount ? 'ok' : 'error',
                });
            } else {
                response.send({
                    status: 'error',
                    message: 'no [instagram_account_id]',
                });
            }
        });

        app.get('/restartBot', async (request, response) => {
            let instagramAccountId = request.query.instagram_account_id;
            if (instagramAccountId) {
                logger.warning(`[SERVER] restartBot [instagram_account_id = ${instagramAccountId}]`);

                let instagramAccount = accounts[instagramAccountId];
                if (instagramAccount && instagramAccount.status === 1) {
                    await instagramAccount.bot.stop();
                    await utils.sleep(5);
                }

                let loginResult = 1;
                instagramAccount = await InstagramAccount.getAccount(instagramAccountId);
                if (instagramAccount) {
                    accounts[instagramAccountId] = instagramAccount;

                    await instagramAccount.bot.init();
                    loginResult = await instagramAccount.bot.login();
                }

                response.send({
                    status: instagramAccount ? 'ok' : 'error',
                    code: loginResult,
                });
            } else {
                response.send({
                    status: 'error',
                    message: 'no [instagram_account_id]',
                });
            }
        });

        app.get('/stopBot', async (request, response) => {
            let instagramAccountId = request.query.instagram_account_id;
            if (instagramAccountId) {
                logger.warning(`[SERVER] stopBot [instagram_account_id = ${instagramAccountId}]`);

                let instagramAccount = accounts[instagramAccountId];
                if (instagramAccount) {
                    await instagramAccount.bot.stop();
                }

                response.send({
                    status: instagramAccount ? 'ok' : 'error',
                });
            } else {
                response.send({
                    status: 'error',
                    message: 'no [instagram_account_id]',
                });
            }
        });

        app.get('/verificationCode', async (request, response) => {
            let instagramAccountId = request.query.instagram_account_id;
            let verificationCode = request.query.verification_code.trim();

            if (instagramAccountId && verificationCode) {
                logger.warning(`[SERVER] verificationCode [instagram_account_id = ${instagramAccountId}] [verificationCode = ${verificationCode}]`);

                let challengeResult = 1;
                let instagramAccount = accounts[instagramAccountId];
                if (instagramAccount) {
                    challengeResult = await instagramAccount.bot.challenge(verificationCode);
                }

                response.send({
                    status: instagramAccount ? 'ok' : 'error',
                    code: challengeResult,
                });
            } else {
                response.send({
                    status: 'error',
                    message: 'no [instagram_account_id] and/or [verificationCode]',
                });
            }
        });

        app.get('/updateBotState', async (request, response) => {
            let instagramAccountId = request.query.instagram_account_id;
            if (instagramAccountId) {
                logger.warning(`[SERVER] updateBotState [instagram_account_id = ${instagramAccountId}]`);

                let instagramAccount = accounts[instagramAccountId] || await InstagramAccount.getAccount(instagramAccountId);
                if (instagramAccount) {
                    await instagramAccount.updateStatus();
                }

                response.send({
                    status: instagramAccount ? 'ok' : 'error',
                });
            } else {
                response.send({
                    status: 'error',
                    message: 'no [instagram_account_id]',
                });
            }
        });

        app.get('/checkProxy', async (request, response) => {
            let proxyUrl = request.query.proxyURL;
            let url = request.query.url;

            if (proxyUrl && url) {
                logger.warning(`[SERVER] checkProxy [proxyUrl = ${proxyUrl}] [url = ${url}]`);

                let proxy = new Proxy(0, proxyUrl);
                let result = await proxy.check(url);

                response.send({
                    status: 'ok',
                    masterBots: [
                        {
                            id: 1,
                            code: result ? 0 : 1, // non-zero => error
                        },
                    ],
                });
            } else {
                response.send({
                    status: 'error',
                    message: 'no [proxyUrl] and/or [url]',
                });
            }
        });

        app.get('/checkProxyProvider', async (request, response) => {
            let providerId = request.query.provider_id;
            let url = request.query.url;
            let timeout = request.query.timeout;

            if (providerId && url && timeout) {
                logger.warning(`[SERVER] checkProxyProvider [providerId = ${providerId}] [url = ${url}] [timeout = ${timeout}]`);

                await Proxy.checkProvider(providerId, url, timeout);

                response.send({
                    status: 'ok',
                });
            } else {
                response.send({
                    status: 'error',
                    message: 'no [providerId] and/or [url] and/or [timeout]',
                });
            }
        });
    } catch (e) {
        logger.error(e.message);
    }
})();
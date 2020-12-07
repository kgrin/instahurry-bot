const db = require('../src/db');
const utils = require('../src/utils');

/**
 * @property {number} actionType
 * @property {number} incidentType
 * @property {InstagramAccount} instagramAccount
 */
class Incident {
    constructor(actionType, incidentType, instagramAccount) {
        this.actionType = actionType;
        this.incidentType = incidentType;
        this.instagramAccount = instagramAccount;
    }

    async save() {
        await db.query(
            db.bot,
            `insert into
                    ih_incident_log
            set
                instagram_account_id = ${this.instagramAccount.id},
                instagram_user_id = ${this.instagramAccount.bot.auth.pk},
                master_bot_id = 1,
                worker_type_id = 2,
                proxy_id = ${this.instagramAccount.proxy.id},
                incident_type = ${this.incidentType},
                action_type = ${this.actionType},
                create_date = '${utils.getDateTime('YYYY-MM-DD')}',
                created_at = '${utils.getDateTime()}',
                updated_at = '${utils.getDateTime()}'`
        );
    }
}

module.exports = Incident;
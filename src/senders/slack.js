var request = require('request');

module.exports = function (message,cb) {
    request.post(process.env.SLACK_WEBHOOK, cb).form({
        payload: JSON.stringify(message)
    });
};

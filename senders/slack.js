var request = require('request');

module.exports = function (message,cb) {
	var options = {
		uri: process.env.SLACK_WEBHOOK,
		method: 'POST',
		json: message
	};

    request(options, cb);
};

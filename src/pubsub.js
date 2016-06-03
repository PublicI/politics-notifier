var PGPubsub = require('pg-pubsub');

function PubSub() {
    var pubsubInstance = new PGPubsub(process.env.DB_DRIVER + '://' +
        process.env.DB_USER + ':' + process.env.DB_PASS + '@' +
        process.env.DB_HOST + ':' + process.env.DB_PORT + '/' +
        process.env.DB_NAME);

    this.subscribe = function (channel) {
        pubsubInstance.addChannel(channel);
    };

    this.on = function (channel,cb) {
        pubsubInstance.on(channel,cb);
    };

    this.once = function (channel,cb) {
        pubsubInstance.once(channel,cb);
    };

    this.emit = function (channel,payload) {
        pubsubInstance.publish(channel, payload);
    };
}

module.exports = new PubSub();

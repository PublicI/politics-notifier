
module.exports = function (message,cb) {
    console.log('sending: ',JSON.stringify(message, null, 2));

    cb();
};

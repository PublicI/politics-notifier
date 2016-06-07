var nodemailer = require('nodemailer'),
    sesTransport = require('nodemailer-ses-transport');

var transport = nodemailer.createTransport(sesTransport({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    rateLimit: 5 // do not send more than 5 messages in a second 
}));

module.exports = function (message,cb) {
    transporter.sendMail(message, cb);
};

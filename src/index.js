var fs = require('fs'),
    Handlebars = require('handlebars'),
    HandlebarsIntl = require('handlebars-intl'),
    PGPubsub = require('pg-pubsub'),
    yaml = require('js-yaml');

HandlebarsIntl.registerWith(Handlebars);

function readDir(dir,ext) {
    dir = __dirname + '/' + dir;

    var files = fs.readdirSync(dir);

    return files.filter(function (file) {
        return file.indexOf('.' + ext) !== -1;
    }).map(function (file) {
        return dir + '/' + file;
    });
}

function renderMessage(template,payload) {
    var templateOpts = {
        data: {
            intl: {
                locales: 'en-US'
            }
        }
    };
    
    var message = {};

    Object.keys(payload).forEach(function (key) {
        if (key.indexOf('date') !== -1) {
            payload[key] = new Date(payload[key]);
        }
    });

    Object.keys(template.message).forEach(function(key) {
        var compiled = Handlebars.compile(template.message[key].trim());

        message[key] = compiled(payload,templateOpts);
    });

    return message;
}

function messageSent(sender,err) {
    if (err) {
        console.error('error sending message to ' + sender + ' ',err);
        return;
    }

    console.log('message sent to ' + sender);
}

function sendMessage(senders,template,payload) {
    if (template.senders) {
        template.senders.forEach(function (sender) {
            if (sender in senders) {
                senders[sender](renderMessage(template,payload),messageSent.bind(this,sender));
            }
        });
    }
}

function init() {
    var pubsub = new PGPubsub(process.env.DB_DRIVER + '://' +
        process.env.DB_USER + ':' + process.env.DB_PASS + '@' +
        process.env.DB_HOST + ':' + process.env.DB_PORT + '/' +
        process.env.DB_NAME);

    var templates = [],
        senders = {},
        channels = [];

    templates = readDir('templates','yaml').map(function (file) {
        return yaml.safeLoad(fs.readFileSync(file,'utf8'));
    });

    readDir('senders','js').forEach(function (file) {
        senders[file.split('/').pop().replace('.js','')] = require(file);
    });

    templates.forEach(function (template) {
        if (template.channels) {
            template.channels.forEach(function (channel) {
                channel = channel.toLowerCase();

                if (channels.indexOf(channel) === -1) {
                    pubsub.addChannel(channel);
                }

                pubsub.on(channel,function (payload) {
                    sendMessage(senders,template,payload);
                });
            });
        }
    });
}

init();

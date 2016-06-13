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
        return file.indexOf('.' + ext) === file.length-ext.length-1;
    }).map(function (file) {
        return dir + '/' + file;
    });
}

function mapRecursive(fn,obj) {
    if (Array.isArray(obj)) {
        return obj.map(mapRecursive.bind(this,fn));
    }
    else if (obj === null) {
        return null;
    }
    else if (typeof obj == 'object') {
        var newObj = {};

        Object.keys(obj).forEach(function(key) {
            newObj[key] = mapRecursive(fn,obj[key]);
        });

        return newObj;
    }
    
    return fn(obj);
}

function renderMessage(template,payload) {
    var templateOpts = {
        data: {
            intl: {
                locales: 'en-US'
            }
        }
    };

    payload = mapRecursive(function (value) {
        /*
        if (key.indexOf('date') !== -1) {
            payload[key] = new Date(payload[key]);
        }*/
        if ((value - parseFloat(value) + 1) >= 0) { // isNumeric
            value = parseFloat(value);
        }

        return value;
    },payload);

    var message = mapRecursive(function(value) {
        if (typeof value == 'string') {
            var compiled = Handlebars.compile(value.trim());

            return compiled(payload,templateOpts);
        }

        return value;
    },template.message);

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

    templates = readDir('templates','yml').map(function (file) {
        return yaml.safeLoad(fs.readFileSync(file,'utf8'));
    });

    readDir('senders','js').forEach(function (file) {
        senders[file.split('/').pop().replace('.js','')] = require(file);
    });

    var committees = fs.readFileSync(__dirname + '/../committees.txt','utf8').split('\n');

    templates.forEach(function (template) {
        if (template.channels) {
            template.channels.forEach(function (channel) {
                channel = channel.toLowerCase();

                if (channels.indexOf(channel) === -1) {
                    pubsub.addChannel(channel);
                }

                pubsub.on(channel,function (payload) {
                    if (payload.filer_committee_id_number &&
                        committees.indexOf(payload.filer_committee_id_number) !== -1) {
                        sendMessage(senders,template,payload);
                    }
                });
            });
        }
    });
}

init();

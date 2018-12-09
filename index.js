const fs = require('fs'),
    Handlebars = require('handlebars'),
    HandlebarsIntl = require('handlebars-intl'),
    pg = require('pg'),
    PGPubsub = require('pg-pubsub'),
    yaml = require('js-yaml');

HandlebarsIntl.registerWith(Handlebars);

function readDir(dir, ext) {
    dir = `${__dirname}/${dir}`;

    const files = fs.readdirSync(dir);

    return files
        .filter(
            file => file.indexOf(`.${ext}`) === file.length - ext.length - 1
        )
        .map(file => `${dir}/${file}`);
}

function mapRecursive(fn, obj) {
    if (Array.isArray(obj)) {
        return obj.map(mapRecursive.bind(this, fn));
    } else if (obj === null) {
        return null;
    } else if (typeof obj == 'object') {
        const newObj = {};

        Object.keys(obj).forEach(key => {
            newObj[key] = mapRecursive(fn, obj[key]);
        });

        return newObj;
    }

    return fn(obj);
}

function renderMessage(template, payload) {
    const templateOpts = {
        data: {
            intl: {
                locales: 'en-US'
            }
        }
    };

    payload = mapRecursive(value => {
        /*
        if (key.indexOf('date') !== -1) {
            payload[key] = new Date(payload[key]);
        }*/
        if (value - parseFloat(value) + 1 >= 0) {
            // isNumeric
            value = parseFloat(value);
        }

        return value;
    }, payload);

    const message = mapRecursive(value => {
        if (typeof value == 'string') {
            const compiled = Handlebars.compile(value.trim());

            return compiled(payload, templateOpts);
        }

        return value;
    }, template.message);

    return message;
}

function messageSent(sender, err) {
    if (err) {
        console.error(`error sending message to ${sender} `, err);
        return;
    }

    console.log(`message sent to ${sender}`);
}

function sendMessage(senders, template, payload) {
    if (template.senders) {
        template.senders.forEach(function(sender) {
            if (sender in senders) {
                senders[sender](
                    renderMessage(template, payload),
                    messageSent.bind(this, sender)
                );
            }
        });
    }
}

function init() {
    const pubsub = new PGPubsub(
        `${process.env.DB_DRIVER}://${process.env.DB_USER}:${
            process.env.DB_PASS
        }@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
    );

    const pool = new pg.Pool({
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME
    });

    let templates = [];
    const senders = {};
    const channels = [];

    templates = readDir('templates', 'yml').map(file =>
        yaml.safeLoad(fs.readFileSync(file, 'utf8'))
    );

    readDir('senders', 'js').forEach(file => {
        senders[
            file
                .split('/')
                .pop()
                .replace('.js', '')
        ] = require(file);
    });

    templates.forEach(template => {
        if (template.channels) {
            template.channels.forEach(channel => {
                channel = channel.toLowerCase();

                if (!channels.includes(channel)) {
                    pubsub.addChannel(channel);
                }

                pubsub.on(channel, payload => {
                    if (payload.filer_committee_id_number) {
                        pool.query(
                            'SELECT * FROM cpi_watchlist WHERE fec_filer_id = $1;',
                            [payload.filer_committee_id_number],
                            (err, result) => {
                                if (err) {
                                    console.error(err);
                                }

                                if (
                                    typeof result !== 'undefined' &&
                                    result &&
                                    result.rows &&
                                    result.rows.length > 0
                                ) {
                                    sendMessage(senders, template, payload);
                                }
                            }
                        );
                    }
                });
            });
        }
    });
}

init();

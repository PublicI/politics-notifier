var fs = require('fs'),
    slack = require('@slack/client'),
    moment = require('moment'),
    PGPubsub = require('pg-pubsub');

var committees = fs.readFileSync(__dirname + '/../committees.txt','utf8').split('\n');

var RtmClient = slack.RtmClient;

var rtm = new RtmClient(process.env.SLACK_TOKEN);

var RTM_CLIENT_EVENTS = slack.CLIENT_EVENTS.RTM;

var filing_lookup = {};

var pubsub = new PGPubsub(process.env.DB_DRIVER + '://' +
    process.env.DB_USER + ':' + process.env.DB_PASS + '@' +
    process.env.DB_HOST + ':' + process.env.DB_PORT + '/' +
    process.env.DB_NAME);

rtm.on(RTM_CLIENT_EVENTS.RTM_CONNECTION_OPENED, function () {
    pubsub.addChannel('fecimportstart',function (filing) {
        if (!(filing.filing_id in filing_lookup) &&
            committees.indexOf(filing.filer_committee_id_number) !== -1) {

            filing_lookup[filing.filing_id] = true;

            var url = 'http://docquery.fec.gov/cgi-bin/forms/' +
                            filing.filer_committee_id_number + '/' +
                            filing.filing_id + '/';

            var message = filing.committee_name +
                            ' (' + filing.filer_committee_id_number + ') filed a ' +
                            filing.form_type + ' for the period ending ' +
                            moment(new Date(filing.coverage_through_date)).add(1,'day').format('M/D/YYYY') + ' ' +
                            url;

            rtm.sendMessage(message, process.env.SLACK_CHANNEL, function (err) {
                if (err) {
                    console.error(err);
                }

                console.log(message);
            });
        }
    });
});

rtm.start();

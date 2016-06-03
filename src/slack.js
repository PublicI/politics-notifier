var fs = require('fs'),
    slack = require('@slack/client'),
    moment = require('moment'),
    pubsub = require('./pubsub');

var committees = fs.readFileSync(__dirname + '/../committees.txt').split('\n');

var RtmClient = slack.RtmClient;

var rtm = new RtmClient(process.env.SLACK_TOKEN, {logLevel: 'debug'});

var RTM_CLIENT_EVENTS = slack.CLIENT_EVENTS.RTM;

var filing_lookup = {};

pubsub.subscribe('fec:importStart');

rtm.on(RTM_CLIENT_EVENTS.RTM_CONNECTION_OPENED, function () {
    pubsub.on('fec:importStart',function (filing) {

        console.log(filing);

        if (!(filing.filing_id in filing_lookup) &&
            committees.indexOf(filing.filer_committee_id_number) !== -1) {

            filing_lookup[filing.filing_id] = true;

            var url = 'http://docquery.fec.gov/cgi-bin/forms/' +
                            filing.filer_committee_id_number + '/' +
                            filing.filing_id + '/';

            var message = filing.committee_name +
                            ' (' + filing.filer_committee_id_number + ') filed a ' +
                            filing.form_type + ' for the period ending ' +
                            moment(new Date(filing.coverage_through_date)).add(1,'day').format('M/D/YYYY') +
                            url;

            rtm.sendMessage(message, process.env.SLACK_CHANNEL, function () {
                console.log(message);
            });
        }
    });
});

rtm.start();

var fs = require('fs'),
    request = require('request'),
    moment = require('moment'),
    PGPubsub = require('pg-pubsub');

var committees = fs.readFileSync(__dirname + '/../committees.txt','utf8').split('\n');

var filing_lookup = {};

var pubsub = new PGPubsub(process.env.DB_DRIVER + '://' +
    process.env.DB_USER + ':' + process.env.DB_PASS + '@' +
    process.env.DB_HOST + ':' + process.env.DB_PORT + '/' +
    process.env.DB_NAME);

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
                        moment(new Date(filing.coverage_through_date)).add(1,'day').format('M/D/YYYY') + ' <' +
                        url + '>';

        var options = {
            text: message
        };

        request.post(process.env.SLACK_WEBHOOK, function(err, res, body) {
            if (err) {
                console.error(err);
            }

            console.log(message);
        }).form({ payload: JSON.stringify(options) });
    }
});

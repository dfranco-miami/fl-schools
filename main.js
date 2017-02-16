//var nodemailer = require('nodemailer');
var async = require('async');

console.log('florida school programs ' + Date());

async.series(
    [
        function(callback) {
            doFlScraper(callback);
        }
    ],
    function(err, response) {
        if (err) {
            console.log(err); 
            doEmail(String(err));
        }
        console.log('ended');
        
        //process.exit();
        
    }
);

function doFlScraper(callback) {
    console.log('fl scraper');
    
    var FlScraper = require('./fl-scraper');
    
    FlScraper.run(function(err){
        if (err) {console.log(err);doEmail('fl-scraper:'+err);}//send email
        callback(null, 'Fl-Scraper');
    });
}

function doEmail(body) {
    console.log('sending email');
    var transporter = nodemailer.createTransport({host: 'smtp.usa.pc-depot.com', tls: { rejectUnauthorized: false }});
    nodemailer.createTransport(transporter).sendMail({from: 'dfranco@pc-depot.com', to: 'dfranco.miami@gmail.com', subject: 'Schools Error', text: JSON.stringify(body)}, function(err, info){
        return true;
    });
    
}

var helpers = {
    removeDuplicates: function(arr, prop) {
        var new_arr = [];
        var lookup  = {};
     
        for (var i in arr) {
            if (arr[i].hasOwnProperty(prop)) {
                lookup[arr[i][prop].trim()] = arr[i];
            }
        }
     
        for (i in lookup) {
            new_arr.push(lookup[i]);
        }
     
        return new_arr;
    },

    doEmail: function(body) {
        console.log('sending email');
        var transporter = nodemailer.createTransport({host: 'smtp.usa.pc-depot.com', tls: { rejectUnauthorized: false }});
        nodemailer.createTransport(transporter).sendMail({from: 'dfranco@pc-depot.com', to: 'dfranco.miami@gmail.com', subject: 'Schools Error', text: JSON.stringify(body)}, function(err, info){
            return true;
        });

    }
};

module.exports = helpers;
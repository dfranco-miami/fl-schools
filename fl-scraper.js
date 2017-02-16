"use strict";

var request = require('request');
var async = require('async');
var fs = require('fs');
var JSFtp = require("jsftp");
var mongo = require('mongodb').MongoClient;

var config = require("./config");
var helpers = require("./helpers");

var FlScraper = exports = {
    run: function(cb) {
        async.waterfall([
            utils.getZipCodes,
            utils.getSchoolJsons,
            utils.addToDb,
        ],
        function(err, results){
            if (err) {
                if (cb) {  cb(err); }
                else {
                    console.log(err);
                }
            } else { //no error
                if (cb) { cb(null); }
            }
            
            console.log('end');
        });
    }//run
};//export

var utils = exports.utils = {       
    
    getSchoolJsons: function(zipcodes, cb) {
        var mainJsonArr = [];
        var zipCount = zipcodes.length;

        async.forEachLimit(zipcodes, 1, function(zip, callback) {
            setTimeout(function() {
                utils.getJson(zip, function (err, result){
                    if (err) {return callback(err);}
                    
                    if (result) mainJsonArr  = mainJsonArr.concat(result);
                    
                    callback(null);
                });
            }, 3000);
        },
        function(err){
            if (err) {return cb(err);}
            
            console.log('done scraping');
            //elimate duplicats
            mainJsonArr = helpers.removeDuplicates(mainJsonArr, 'ProviderNumber');
            
            cb(null, mainJsonArr);
        });
    },
    
    getJson: function(zip, cb) {
        var schoolArr = [];
            
        var options = {
            url: 'https://cares.myflfamilies.com/PublicSearch/Search?dcfSearchBox='+zip,
            timeout: 240000,
            form: {}
        }

        request(options, function (err, response, body) {
            if (err) {console.log(err + ' ' + options.url); }
            
            if (!err && response.statusCode == 200) {
                var startPos = body.indexOf('{"Data":[{"');
                var endPos = body.indexOf('},"detailTemplate":');
                
                if (startPos>0 && endPos>0) {
                    
                    var mainSchoolJson = JSON.parse(body.substring(startPos,endPos));
                    
                    var propDel = ['VPKCurriculum', 'VPKClass', 'VPKAccreditation', 'VpkStatusID', 'DBAName', 'DisplayPhoneOnWeb', 'DisplayAddressOnWeb', 'ExtraSecondaryDesignatorSuffix', 'ExtraSecondaryDesignatorPrefix', 'SecondaryDesignatorSuffix', 'SecondaryDesignatorPrefix', 'StreetPostDirection', 'StreetSuffix', 'StreetName', 'StreetPreDirection', 'StreetNumber', 'AddressID', 'GoldSealStatusID'];
 
                    for (var i = 0, schoolCount = mainSchoolJson.Data.length; i < schoolCount; i++) { 
                        //delete some properties
                        for (var j = 0,  count = propDel.length; j < count; j++) {
                            delete mainSchoolJson.Data[i].Provider[propDel[j]];
                        }
                        //add to school array
                        if (mainSchoolJson.Data[i].Provider !== undefined) {
                            
                            //make services an array
                            if (mainSchoolJson.Data[i].Provider.Services) mainSchoolJson.Data[i].Provider.Services = mainSchoolJson.Data[i].Provider.Services.split(';');
                            
                            //remove spaces - trim providednumber
                            mainSchoolJson.Data[i].Provider.ProviderNumber = mainSchoolJson.Data[i].Provider.ProviderNumber.trim();
                            
                            schoolArr.push(mainSchoolJson.Data[i].Provider);
                        }
                    }
                }
    
            }

            cb(null, schoolArr);
        });//request
    },
    
    
    getZipCodes: function(cb) {
        mongo.connect(config.dbUrl, function (err, db) {
            if (err) { return cb(err);} 

            var collection = db.collection('Zipcodes');
            collection.distinct( "zipcode", {"Abbreviation" : 'FL'}, function (err, result) {

                if (err) {return cb(err);} 

                db.close();

                //return cb(null, result);
                return cb(null, result.slice(1,10));//result;

            });
        });
    },
    /* insert shcool
        if err duplicate key
            update main docuemnt (not embeded)
        for every inspection if it doesnt exist, insert
    */
    addToDb: function(schoolsJson, cb){

        var collection;
        var database;
        
        async.series([
            function(callback) {
                mongo.connect(config.dbUrl, function (err, db) {
                    if (err) { return callback(err);} 
                    database = db;
                    collection = db.collection('schools');
                    
                    callback(null);
                });
            },
            function(callback) {
                async.forEachLimit(schoolsJson, 1, function(schoolJson, next) {
                    //console.log(schoolJson.ProviderID);

                    collection.insert(schoolJson,  function (err, result) {
                        //all good
                        if (!err) {
                            console.log('finished inserting %d school', schoolJson.ProviderID);
                            return next(null);
                        } 
                        // error, not dup
                        if (err && err.code !== 11000) {return next(err);} 
                        
                        //dup error, do update
                        if (err && err.code === 11000) {
                            
                            collection.update(
                                {'ProviderID':schoolJson.ProviderID}, 
                                { $set : {'ProviderNumber':schoolJson.ProviderNumber, 'Name':schoolJson.Name, 'Capacity':schoolJson.Capacity, 'LicenseExpirationDate':schoolJson.LicenseExpirationDate, 'IsReligiousExempt':schoolJson.IsReligiousExempt, 'IsFaithBased':schoolJson.IsFaithBased, 'IsHeadStart':schoolJson.IsFaithBased, 'IsOfferingSchoolReadiness':schoolJson.IsOfferingSchoolReadiness, 'IsPublicSchool':schoolJson.IsPublicSchool, 'OriginationDate':schoolJson.OriginationDate, 'City':schoolJson.City, 'County':schoolJson.County, 'State':schoolJson.State, 'ZipCode':schoolJson.ZipCode, 'ZipPlus4':schoolJson.ZipPlus4, 'Latitude':schoolJson.Latitude, 'Longitude':schoolJson.Longitude, 'PhoneNumber':schoolJson.PhoneNumber, 'ProgramType':schoolJson.ProgramType, 'Status':schoolJson.Status, 'Services':schoolJson.Services, 'FullAddress':schoolJson.FullAddress, 'GoldSealAccreditingAgency':schoolJson.GoldSealAccreditingAgency, 'GoldSealEffectiveDate':schoolJson.GoldSealEffectiveDate, 'GoldSealExpirationDate':schoolJson.GoldSealExpirationDate, 'MondayHours':schoolJson.MondayHours, 'TuesdayHours':schoolJson.TuesdayHours, 'WednesdayHours':schoolJson.WednesdayHours, 'ThursdayHours':schoolJson.ThursdayHours, 'FridayHours':schoolJson.FridayHours, 'SaturdayHours':schoolJson.SaturdayHours, 'SundayHours':schoolJson.SundayHours, 'LicenseStatus':schoolJson.LicenseStatus, 'IsVPK':schoolJson.IsVPK}}, function (err, result) {
                                
                                if (err) {return next(err);}
                                
                                //do inspections
                                async.each(schoolJson.Inspections, function(inspection, prox) {
                                    if (err) {return prox(err);}
                                    
                                    collection.update(
                                        {'ProviderID':schoolJson.ProviderID, "Inspections.InspectionID": { $ne: inspection.InspectionID } },
                                        { $push: { "Inspections": inspection } }, function (err, result) {
                                
                                        if (err) {return prox(err);}
                                            
                                        return prox(null);
                                    })
                                    
                                }, function(err){
                                    if (err) {return next(err);}
                                    
                                    console.log('finished updating %d school', schoolJson.ProviderID);
                                

                                    return next(null);

                                });
                                
                            });
                        }
                        else {

                            console.log('Inserted %d school', schoolJson.ProviderID);

                            return next(null);
                        }
                    });

                }, function(err){
                    if (err) {return callback(err);}

                    callback(null);

                });
            }
            
        ], 
        function(err, results) {
            if (err) { return cb(err); }
            
            database.close();

            console.log('done updating db');

            cb(null);
    
        })
    }
};




 module.exports = exports;

if (!module.parent) {
    FlScraper.run();
}


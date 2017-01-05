/*!
 * tcmb-doviz-kuru <https://github.com/gdoslu/tcmb-doviz-kuru.git>
 *
 * Copyright (c) 2016, Gokhan Doslu.
 * Licensed under the MIT License.
 */

'use strict';
var request = require('request');
var parseString = require('xml2js').parseString;

/**
 * Converts first letter of the given parameter to lowercase
 * @param string
 * @returns {string}
 */
function lowerCaseFirstLetter(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
}

/**
 * Converts first letter of the given parameter to lowercase, then removes '_' and converts it to camel case
 * @param name
 * @returns {XML|string|void|*}
 */
function prettyName(name){
    return lowerCaseFirstLetter(name).replace(/[-_]+(.)?/g, function (g) { return g[1].toUpperCase(); });
}

/**
 * Checks value is parsable to float and return float if
 * @param val
 * @returns {*}
 */
function valueProcessors(val) {
    if (val) {
        var floatVal = parseFloat(val);
        if(isNaN(floatVal)) return val;
        return floatVal;
    }
}


module.exports = function(cb, dataSourceURL = 'http://www.tcmb.gov.tr/kurlar/today.xml') { // XML Source for Indicative Exchange Rates Announced by the Central Bank of Turkey

    return request(dataSourceURL, (error, response, xml) => {
        if (error) {
            return cb(error, null);
        }
        if (response.statusCode != 200) {
            return cb('Response code is: ' + response.statusCode, null);
        }
        if (!xml || xml.search('Tarih_Date') === -1) {
            return cb('Invalid xml', null);
        }
        // converts xml to json
        parseString(xml, {
                attrkey: 'attributes',
                tagNameProcessors: [prettyName],
                attrNameProcessors: [prettyName],
                valueProcessors: [valueProcessors],
                trim: true,
                explicitArray: false,
                emptyTag: null
            },
            function (err, result) {
                cb(err, result);
            });
    });
};
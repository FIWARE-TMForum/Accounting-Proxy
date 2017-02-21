/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the Accounting Proxy
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var config = require('./config');

var db = require(config.database.type);

/**
 * Makes the accounting for the specified unit and accounting function.
 *
 * @param  {string}   apiKey        Purchase identifier.
 * @param  {string}   unit          Accounting unit.
 * @param  {Object}   countInfo     Information for calculate the accounting value.
 * @param  {string}   countFunction Name of the count function in the accounting module.
 */
var count = function (apiKey, unit, countInfo, countFunction, callback) {
    var accountingModules = require('./server').getAccountingModules();

    if (accountingModules[unit] === undefined) {
        return callback({
            code: 'invalidUnit',
            msg: 'Invalid accounting unit "' + unit + '"'
        });

    } else if (accountingModules[unit][countFunction] === undefined) {
        return callback({
            code: 'invalidFunction',
            msg: 'Invalid count function "' + countFunction + '" for unit "' + unit + '"'
        });

    } else {

        accountingModules[unit][countFunction](countInfo, function (err, amount) {

            if (err) {
                return callback ({
                    code: 'functionError',
                    msg: err
                });

            } else {
                db.makeAccounting(apiKey, amount, function (err) {

                    if (err) {
                        return callback({
                            code: 'dbError',
                            msg: err
                        });
                    } else {
                        return callback(null);
                    }
                });
            }
        });
    }
};

exports.count = count;
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

var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    async = require('async'),
    sinon = require('sinon'),
    data = require('../data');

var getAccounter = function (implementations) {
    return proxyquire('../../lib/accounter', {
        './../server': implementations.server,
        './../config': implementations.config
    });
};

describe('Testing "Accounter"', function () {

    describe('Function "count"', function () {

        var testCount = function (accUnit, accFunction, countErr, makeAccountingErr, done) {

            var unit = accUnit ? accUnit : data.DEFAULT_UNIT;
            var apiKey = data.DEFAULT_API_KEYS[0];
            var countFunction = 'count';
            var amount = 2.369;
            var countInfo = {};

            var count = function (countInfo, callback) {
                return callback(countErr, amount);
            };

            var db = {
                makeAccounting: function (apiKey, amount, callback) {
                    return callback(makeAccountingErr);
                }
            };

            var accountingModules = {};
            accountingModules[data.DEFAULT_UNIT] = {};
            accountingModules[data.DEFAULT_UNIT][countFunction] = count;

            var config = {
                database: {
                    type: './lib/db/db'
                },
                getDatabase: function () {
                    return db;
                }
            };

            var server = {
                getAccountingModules: function () {
                    return accountingModules;
                }
            };

            if (!accUnit) {
                var countSpy = sinon.spy(accountingModules[data.DEFAULT_UNIT], countFunction);
            }

            var makeAccountingpy = sinon.spy(db, 'makeAccounting');
            var getAccModulesSpy = sinon.spy(server, 'getAccountingModules');

            var implementations = {
                db: db,
                server: server,
                config: config
            };

            var accounter = getAccounter(implementations);

            accounter.count(apiKey, unit, countInfo, accFunction, function (error) {

                assert(getAccModulesSpy.calledOnce);

                if (accUnit) {
                    assert.equal(error.code, 'invalidUnit');
                    assert.equal(error.msg, 'Invalid accounting unit "' + unit + '"');

                } else if (accFunction !== countFunction) {
                    assert(error.code, 'invalidFunction');
                    assert(error.msg, 'Invalid count function "' + countFunction + '" for unit "' + unit + '"');

                } else {

                    assert(countSpy.calledWith(countInfo));

                    if (countErr) {
                        assert.equal(error.code, 'functionError');
                        assert.equal(error.msg, countErr);

                    } else {

                        assert(makeAccountingpy.calledWith(apiKey, amount));

                        var errorExpected = makeAccountingErr ? {code: 'dbError', msg: makeAccountingErr} : null ;

                        assert.deepEqual(error, errorExpected);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when the accounting unit is not valid', function (done) {
            testCount('wrong', 'count', 'Error', null, done);
        });

        it('should call the callback with error when the accounting function is not defined for the accounting unit', function (done) {
            testCount(null, 'wrong', 'Error', null, done);
        });

        it('should call the callback with error when the accounting module fails', function (done) {
            testCount(null, 'count', 'Error', null, done);
        });

        it('should call the callback with error when db fails making the accounting', function (done) {
           testCount(null, 'count', null, 'Error', done); 
        });

        it('should call the callback without error when the db makes the accounting', function (done) {
            testCount(null, 'count', null, null, done);
        });
    });
});
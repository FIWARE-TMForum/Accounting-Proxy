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

var assert = require('assert'),
    proxyquire = require('proxyquire').noCallThru(),
    usageAPIMock = require('./test_endpoint'),
    async = require('async'),
    testConfig = require('../config_tests').integration,
    data = require('../data'),
    util = require('../util');

var server, db;
var databaseName = 'testDB_usageAPI.sqlite';

var configMock = util.getConfigMock(false, false);

// Necessary in order to avoid ERRADDRINUSE when call listening more than once
var appMock = {
    listen: function (port) {},
    use: function (middleware) {},
    set: function (property) {},
    get: function (path, middleware, handler) {},
    post: function (path, middleware, handler)  {}
};

var mocker = function (database, done) {

    var notifierMock;
    configMock.getConfigPath = require('../../config').getConfigPath;

    if (database === 'sql') {

        configMock.database.type = './lib/db/db';
        configMock.database.name = databaseName;

        db = proxyquire('../../lib/db/db', {
            './../../config': configMock
        });

    } else {

        var redis_host = testConfig.redis_host;
        var redis_port = testConfig.redis_port;

        if (! redis_host || ! redis_port) {
            return done('Variable "redis_host" or "redis_port" are not defined in "config_tests.js".')
        } else {

            configMock.database.type = './lib/db/db_Redis';
            configMock.database.name = testConfig.redis_database;
            configMock.database.redis_host = redis_host;
            configMock.database.redis_port = redis_port;

            db = proxyquire('../../lib/db/db_Redis', {
                './../../config': configMock
            });
        }
    }

    configMock.getDatabase = function () {
        return db;
    };

    notifierMock = proxyquire('../../lib/notifier', {
        './../config': configMock,
        'winston': util.logMock
    });

    server = proxyquire('../../server', {
        express: function () {
            return appMock;
        },
        './config': configMock,
        './lib/notifier': notifierMock
    });

    db.init(done);
};

// Start the endpoint for testing
before(function () {
    usageAPIMock.run();
});

// Delete testing database
after(function (done) {
    this.timeout(5000);

    usageAPIMock.stop(function (err) {
        if (err) {
            done(err);
        } else {
            util.removeDatabase(databaseName, done);
        }
    });
});

describe('Testing the usage notifier', function () {

    async.eachSeries(testConfig.databases, function (database, taskCallback) {

        describe('with database ' + database, function () {

            this.timeout(4000);

            // Clear the database and mock dependencies
            beforeEach(function (done) {
                this.timeout(5000);

                util.clearDatabase(database, databaseName, function (err) {
                    if (err) {
                        done(err);
                    } else {
                        mocker(database, done);
                    }
                });
            });

            // Restore the default configMock values
            afterEach(function () {
                configMock.usageAPI = {
                    host: 'localhost',
                    port: testConfig.test_endpoint_port,
                    path: ''
                };
            });

            after(function () {
                taskCallback();
            });

            it('should not send notifications when there is no API Key for notifications available', function (done) {

                var units = ['call', 'megabyte'];
                var hrefs = [null, null];

                configMock.modules = {
                    accounting: units
                };

                server.init(function (err) {

                    db.getHref('call', function (err, href) {
                        if (err) {
                            done(err);
                        } else {
                            assert.equal(href, null);
                            assert.equal(err, null);

                            done();
                        }
                    });
                });
            });

            it('should call the callback with error when there is an error notifying specifications', function (done) {

                var unit = data.DEFAULT_UNIT;
                var token = data.DEFAULT_TOKEN;

                configMock.modules = {
                    accounting: [unit]
                };

                configMock.usageAPI = {
                    host: 'wrong',
                    port: '',
                    path: ''
                };

                var apiKey = data.DEFAULT_API_KEYS[0];
                var service = data.DEFAULT_SERVICES_LIST[0];
                var buy = data.DEFAULT_BUY_INFORMATION[0];
                var accounting = {
                    apiKey: apiKey,
                    value: 2
                };

                util.addToDatabase(db, [service], [buy], [], [], [accounting], [], token, function (err) {
                    if (err) {
                        done(err);
                    } else {
                        server.init(function (err) {
                            assert.equal(err, 'Error starting the accounting-proxy. Error sending the Specification: ENOTFOUND');
                            done();
                        });
                    }
                });
            });

            it('should notify the usage specifications and the usage when they have not been notified and there is an available token', function (done) {

                var token = data.DEFAULT_TOKEN;
                var apiKey = data.DEFAULT_API_KEYS[0];
                var units = [data.DEFAULT_UNIT];
                var hrefs = [data.DEFAULT_HREFS[1]];

                configMock.modules = {
                    accounting: units
                };

                var service = data.DEFAULT_SERVICES_LIST[0];
                var buy = data.DEFAULT_BUY_INFORMATION[0];
                var accounting = {
                    apiKey: apiKey,
                    value: 2
                };

                util.addToDatabase(db, [service], [buy], [], [], [accounting], [], token, function (err) {
                    if (err) {
                        done(err);
                    } else {

                        server.init(function (err) {
                            assert.equal(err, null);

                            async.series([
                                function (callback) {
                                    util.checkUsageSpecifications(db, units, hrefs, callback);
                                },
                                function (callback) {
                                    db.getAllNotificationInfo(function (err, notificationInfo) {
                                        if (err) {
                                            callback(err);
                                        } else {
                                            assert.equal(notificationInfo, null);
                                            callback();
                                        }
                                    });
                                }
                            ], done);
                        });
                    }
                });
            });
        });
    });
});
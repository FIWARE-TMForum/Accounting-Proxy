var request = require('supertest'),
    assert = require('assert'),
    proxyquire = require('proxyquire'),
    test_config = require('../config_tests').integration,
    util = require('../util'),
    async = require('async'),
    redis = require('redis'),
    data = require('../data');

var server, db;
var databaseName = 'testDB_administration.sqlite';

var configMock = util.getConfigMock(false);

var userProfile = data.DEFAULT_USER_PROFILE;
userProfile.token = data.DEFAULT_TOKEN;

var FIWAREStrategyMock = util.getStrategyMock(userProfile);

var mocker = function (database, done) {

    var authentication, apiServer;

    if (database === 'sql') {

        configMock.database.type = './db';
        configMock.database.name = databaseName;

        db = proxyquire('../../db', {
            './config': configMock
        });

        authentication = proxyquire('../../OAuth2_authentication', {
            'passport-fiware-oauth': FIWAREStrategyMock,
            './config': configMock,
            'winston': util.logMock,
            './db': db
        });

        apiServer = proxyquire('../../APIServer', {
            './config': configMock,
            './db': db
        });

        server = proxyquire('../../server', {
            './config': configMock,
            './APIServer': apiServer,
            './OAuth2_authentication': authentication
        });
    } else {

        var redis_host = test_config.redis_host;
        var redis_port = test_config.redis_port;

        if (! redis_host || ! redis_port) {
            done('Variable "redis_host" or "redis_port" are not defined in "config_tests.js".');
        } else {

            configMock.database.type = './db_Redis';
            configMock.database.name = test_config.redis_database;
            configMock.database.redis_host = redis_host;
            configMock.database.redis_port = redis_port;

            db = proxyquire('../../db_Redis', {
                './config': configMock
            });

            authentication = proxyquire('../../OAuth2_authentication', {
                'passport-fiware-oauth': FIWAREStrategyMock,
                './config': configMock,
                'winston': util.logMock,
                './db_Redis': db
            });

            apiServer = proxyquire('../../APIServer', {
                './config': configMock,
                './db_Redis': db
            });

            server = proxyquire('../../server', {
                './config': configMock,
                './APIServer': apiServer,
                './OAuth2_authentication': authentication
            });
        }
    }

    db.init(done);
}

// Delete testing database
after(function (done) {
    this.timeout(5000);
    util.removeDatabase(databaseName, done);
});

describe('Testing the administration API', function (done) {

    var testAuthentication = function (path, method, token, statusCode, response, done) {

        if (!token) {

            request(server.app)
                [method](configMock.api.administration_paths[path])
                .expect(statusCode, response, done);

        } else {

            request(server.app)
                [method](configMock.api.administration_paths[path])
                .set('authorization', token)
                .expect(statusCode, response, done);
        }
    };

    var testBody = function (path, contentType, body, statusCode, response, done) {
        request(server.app)
            .post(configMock.api.administration_paths[path])
            .set('content-type', contentType)
            .set('authorization', 'bearer ' + userProfile.token)
            .send(body)
            .expect(statusCode, response, done);
    };

    async.eachSeries(test_config.databases, function (database, taskCallback) {

        describe('with database: ' + database, function () {

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

            after(function () {
                taskCallback();
            });


            describe('[GET:' + configMock.api.administration_paths.units + '] accounting units request', function () {

                it('should return all the accounting units (200) when the request is correct', function (done) {
                    request(server.app)
                        .get(configMock.api.administration_paths.units)
                        .expect(200, {units: configMock.modules.accounting}, done);
                });
            });

            describe('[GET:' +  configMock.api.administration_paths.keys + '] user api-keys request', function () {

                var path = 'keys';

                it('should return 401 when there is no authentication header', function (done) {
                    var expectedResp = {error: 'Auth-token not found in request headers'};

                    testAuthentication(path, 'get', undefined, 401, expectedResp, done);
                });

                it('should return 401 when the access token is not valid', function (done) {
                    var type = 'wrong';
                    var token = type + ' ' + userProfile.token;
                    var expectedResp = {error: 'Invalid Auth-Token type (' + type + ')'};

                    testAuthentication(path, 'get', token, 401, expectedResp, done);
                });

                it('should return 200 when there is no API key avilable', function (done) {
                    var token = 'bearer ' + userProfile.token;

                    testAuthentication(path, 'get', token, 200, [], done);
                });

                var testGetApiKeys = function (numApiKeys, done) {

                    var services = [ data.DEFAULT_SERVICES[0] ];
                    var buyInfos = [ data.DEFAULT_BUY_INFORMATION[0] ];

                    if (numApiKeys === 2) {
                        services.push(data.DEFAULT_SERVICES[1]);
                        buyInfos.push(data.DEFAULT_BUY_INFORMATION[1]);
                    }

                    util.addToDatabase(db, services, buyInfos, [], [], [], [], [], function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request(server.app)
                                .get('/accounting_proxy/keys')
                                .set('authorization', 'bearer ' + userProfile.token)
                                .expect(200)
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {
                                        assert.deepEqual(res.body[0], { apiKey: buyInfos[0].apiKey, productId: buyInfos[0].productId, orderId: buyInfos[0].orderId });
                                        if (numApiKeys === 2) {
                                            assert.deepEqual(res.body[1], { apiKey: buyInfos[1].apiKey, productId: buyInfos[1].productId, orderId: buyInfos[1].orderId });
                                        }
                                        done();
                                    }
                                });
                        }
                    });
                };

                it('should return the API key when the request is correct (1 API key)', function (done) {
                    testGetApiKeys(1, done);
                });

                it('should return the API keys when the request is correct (2 API keys)', function (done) {
                    testGetApiKeys(2, done);
                });
            });

            describe('[POST:' + configMock.api.administration_paths.checkURL +'] checkURL request', function () {

                var path = 'checkURL';

                it('should return 401 when there is no authentication header', function (done) {
                    var expectedResp = {error: 'Auth-token not found in request headers'};

                    testAuthentication(path, 'post', undefined, 401, expectedResp, done);
                });

                it('should return 401 when the access token is not valid', function (done) {
                    var type = 'wrong';
                    var token = type + ' ' + userProfile.token;
                    var expectedResp = {error: 'Invalid Auth-Token type (' + type + ')'};

                    testAuthentication(path, 'post', token, 401, expectedResp, done);
                });

                it('should return 415 when the content-type is not "application/json"', function (done) {
                    var expectedResp = {error: 'Content-Type must be "application/json"'};

                    testBody(path, 'text/html', '', 415, expectedResp, done);
                });

                it('should return 422 when the body body is not correct', function (done) {
                    var expectedResp = {error: 'Missing URL'};

                    testBody(path, 'application/json', {}, 422, expectedResp, done);
                });

                it('should return 401 when the user is not an admin of the service', function (done) {
                    var url = 'http://localhost:9000/wrong_path';
                    var expectedResp = {error: 'Access restricted to administrators of the service only'};

                    testBody(path, 'application/json', {url: url}, 401, expectedResp, done);
                });

                it('should return 200 and update the token when the request is correct', function (done) {

                    var oldToken = 'oldToken';
                    var newToken = data.DEFAULT_TOKEN;
                    var service = data.DEFAULT_SERVICES[0];
                    var admin = {idAdmin: userProfile.id, publicPath: service.publicPath};
                    var url = 'http://localhost' + service.publicPath;

                    util.addToDatabase(db, [service], [], [], [admin], [], [], oldToken, function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request(server.app)
                                .post(configMock.api.administration_paths.checkURL)
                                .set('content-type', 'application/json')
                                .set('authorization', 'bearer ' + userProfile.token)
                                .set('X-API-KEY', newToken)
                                .send({url: url})
                                .expect(200)
                                .end(function (err, res) {
                                    if (err) {
                                        return done(err);
                                    } else {
                                        db.getToken(function (err, token) {
                                            if (err) {
                                                done(err);
                                            } else {
                                                assert.equal(token, newToken);
                                                done();
                                            }
                                        })
                                    }
                                });
                        }
                    });
                });
            });

            describe('[POST:' + configMock.api.administration_paths.newBuy +'] new buy request', function () {

                var path = 'newBuy';

                it('should return 415 when the content-type is not "application/json"', function (done) {
                    var expectedResp = {error: 'Content-Type must be "application/json"'};

                    testBody(path, 'text/html', '', 415, expectedResp, done);
                });

                it('should return 400 when the JSON format is not valid', function (done) {
                    var expectedResp = {error: 'Invalid json. "orderId" is required'};

                    testBody(path, 'application/json', {}, 400, expectedResp, done);
                });

                it('should save the buy information when the request is correct', function (done) {

                    var expectedApiKey = '829d47524220aa859d5e8c683a22035df1bc44ea';
                    var service = data.DEFAULT_SERVICES[0];
                    var buy = {
                        orderId: data.DEFAULT_ORDER_IDS[0],
                        productId: data.DEFAULT_PRODUCT_IDS[0],
                        customer: data.DEFAULT_USER_ID,
                        productSpecification: {
                            url: 'http://localhost' + service.publicPath,
                            unit: data.DEFAULT_UNIT,
                            recordType: data.DEFAULT_RECORD_TYPE,
                        }
                    };

                    util.addToDatabase(db, [service], [], [], [], [], [], null, function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request(server.app)
                                .post(configMock.api.administration_paths.newBuy)
                                .set('content-type', 'application/json')
                                .send(buy)
                                .expect(201, {'API-KEY': expectedApiKey})
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {
                                        db.getAccountingInfo(expectedApiKey, function (err, res) {
                                            assert.equal(err, null);
                                            assert.deepEqual(res, { unit: buy.productSpecification.unit,
                                            url: service.url});
                                            done();
                                        });
                                    }
                                });
                        }
                    });
                });
            });
        });
    });
});
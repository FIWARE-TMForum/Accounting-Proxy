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
    sinon = require('sinon'),
    async = require('async'),
    data = require('../data'),
    util = require('../util');

var mocker = function(implementations, callback) {

    util.getSpies(implementations, function (spies) {

        var config = implementations.config ? implementations.config : {};
        config.database = {
            type: './lib/db/db'
        };
        config.getDatabase = function () {
            return implementations.db ? implementations.db : {};
        };

        var api_server = proxyquire('../../APIServer', {
            './config': config,
            url: implementations.url ? implementations.url : {},
            winston: implementations.logger ? implementations.logger : {},
            './lib/schema/validation': implementations.validation ? implementations.validation : {},
            './lib/notifier': implementations.notifier ? implementations.notifier : {},
            'crypto': implementations.crypto ? implementations.crypto : {},
            './orion_context_broker/cbHandler': implementations.cbHandler ? implementations.cbHandler : {}
        });

        return callback(api_server, spies);
    });
};

describe('Testing APIServer', function() {

    describe('Function "getUnits"', function() {

        it('should return 200 when the response contains the accounting units supported', function(done) {

            var modules = ['call', 'megabyte'];

            var implementations = {
                res: {
                    status: function(code) {
                        return this;
                    },
                    json: function(body) {}
                },
                config: {
                    modules: {
                        accounting: modules
                    }
                }
            };

            mocker(implementations, function (api, spies) {

                api.getUnits({}, implementations.res);

                assert(spies.res.status.calledWith(200));
                assert(spies.res.json.calledWith({units: modules}));

                done();
            });
        });
    });

    describe('Function "getApiKeys"', function() {

        var hostName = 'localhost';
        var port = 9000;

        var testGetApiKeys = function (error, apiKeysInfo, result, done) {

            var user = data.DEFAULT_USER_ID;

            var implementations = {
                req: {
                    user: {
                        id: user
                    },
                    hostname: hostName
                },
                res: {
                    status: function(code) {
                        return this;
                    },
                    send: function () {},
                    json: function (msg) {}
                },
                db: {
                    getApiKeys: function (user, callback) {
                        return callback(error, apiKeysInfo);
                    }
                },
                config: {
                    accounting_proxy: {
                        https: {
                            enabled: true
                        },
                        port: port
                    }
                }
            };

            mocker(implementations, function (api, spies) {

                api.getApiKeys(implementations.req, implementations.res);

                assert(spies.db.getApiKeys.calledWith(user));

                if (error) {

                    assert(spies.res.status.calledWith(500));
                    assert(spies.res.send.calledOnce);

                } else {

                    assert(spies.res.status.calledWith(200));
                    assert(spies.res.json.calledWith(result));

                }

                done();
            });
        };

        it('should return 500 when db fails getting the API keys', function(done) {
            testGetApiKeys(true, null, null, done);
        });

        it('should return 404 when there is not API keys for the user specified', function(done) {
            testGetApiKeys(false, [], [], done);
        });

        it('should return 200 when the response contains the user API keys', function(done) {
            var apiKeysInfo = [{
                apiKey: data.DEFAULT_API_KEYS[0],
                productId: data.DEFAULT_PRODUCT_IDS[0],
                orderId: data.DEFAULT_ORDER_IDS[0],
                publicPath: data.DEFAULT_PUBLIC_PATHS[0]
            }];

            var result = [{
                apiKey: data.DEFAULT_API_KEYS[0],
                productId: data.DEFAULT_PRODUCT_IDS[0],
                orderId: data.DEFAULT_ORDER_IDS[0],
                url: 'https://' + hostName + ':' + port + data.DEFAULT_PUBLIC_PATHS[0]
            }];

            testGetApiKeys(false, apiKeysInfo, result, done);
        });
    });

    describe('Function "checkURL"', function() {

        var testcheckURL = function (body, userId, getAdminsErr, admins, token, addTokenErr, done) {

            var path = '/path';

            var implementations = {
                req: {
                    setEncoding: function (encoding) {},
                    get: function (header) {
                        if (token) {
                            return token;
                        } else {
                            return undefined;
                        }
                    },
                    body: body,
                    user: {
                        id: userId
                    }
                },
                res: {
                    status: function (status) {
                        return this;
                    },
                    json: function (msg) {},
                    send: function () {}
                },
                db: {
                    addToken: function (token, callback) {
                        return callback(addTokenErr);
                    },
                    getAdmins: function (path, callback) {
                        return callback(getAdminsErr, admins)
                    }
                },
                url: {
                    parse: function(url) {
                        return {
                            path: path
                        }
                    }
                },
                logger: {
                    error: function (msg) {}
                }
            };

            mocker(implementations, function (api, spies) {

                api.checkURL(implementations.req, implementations.res);

                if (!body.url) {

                    assert(spies.res.status.calledWith(422));
                    assert(spies.res.json.calledWith({error: 'Missing URL'}));

                } else {

                    assert(spies.db.getAdmins.calledWith(path));
                    assert(spies.url.parse.calledWith(body.url));

                    if (getAdminsErr) {

                        assert(spies.res.status.calledWith(500));
                        assert(spies.res.json.calledWith({error: getAdminsErr}));

                    } else if (!admins || admins.indexOf(userId) < 0) {

                        assert(spies.res.status.calledWith(401));
                        assert(spies.res.json.calledWith({error: 'Access restricted to administrators of the service only'}));

                    } else {

                        if (token) {

                            assert(spies.db.addToken.calledWith(token));

                            if (addTokenErr) {
                                assert(spies.logger.error.calledWith(addTokenErr));
                            }
                        }

                        assert(spies.res.status.calledWith(200));
                        assert(spies.res.send.calledOnce);
                    }
                }

                done();
            });

        };

        it('should return 422 when the body is not valid', function (done) {
            testcheckURL({}, null, null, null, false, false, done);
        });

        it('should return 500 when db fails getting the admins', function (done) {
            testcheckURL({url: data.DEFAULT_URLS[0]}, null, 'Error', null, false, false, done);
        });

        it('should return 401 when there is no admins for the service', function (done) {
            testcheckURL({url: data.DEFAULT_URLS[0]}, data.DEFAULT_USER_ID, false, null, false, false, done);
        });

        it('should return 401 when the user is not an admin', function (done) {
            testcheckURL({url: data.DEFAULT_URLS[0]}, 'wrong', false, [data.DEFAULT_USER_ID], false, false, done);
        });

        it('should return 200 when the URL is valid', function (done) {
            testcheckURL({url: data.DEFAULT_URLS[0]}, data.DEFAULT_USER_ID, false, [data.DEFAULT_USER_ID], null, false, done);
        });

        it('should return 200 and log the error when the URL is valid but db fails adding the token', function (done) {
            testcheckURL({url: data.DEFAULT_URLS[0]}, data.DEFAULT_USER_ID, false, [data.DEFAULT_USER_ID], data.DEFAULT_TOKEN, true, done);
        });
    });

    describe('Function "newBuy"', function() {

        var testNewBuy = function (validateErr, newBuyErr, done) {

            var apiKey = data.DEFAULT_API_KEYS[0];
            var body = data.DEFAULT_BUY_INFORMATION;
            var path = data.DEFAULT_PUBLIC_PATHS[0];
            body.productSpecification = {
                url: data.DEFAULT_URLS[0],
                recordType: data.DEFAULT_RECORD_TYPE
            };

            var implementations = {
                req: {
                    setEncoding: function (encoding) {},
                    body: body
                },
                res: {
                    status: function (status) {
                        return this;
                    },
                    json: function (msg) {},
                    send: function () {}
                },
                validation: {
                    validate: function (schema, body, callback) {
                        return callback(validateErr);
                    }
                },
                db: {
                    newBuy: function (buy, callback) {
                        return callback(newBuyErr);
                    }
                },
                url: {
                    parse: function (url) {
                        return {
                            pathname: path
                        };
                    }
                },
                crypto: {
                    createHash: function (type) {
                        return this;
                    },
                    update: function (seed) {},
                    digest: function (type) {
                        return apiKey
                    }
                }
            };

            mocker(implementations, function (api, spies) {

                api.newBuy(implementations.req, implementations.res);

                if (validateErr) {

                    assert(spies.res.status.calledWith(422));
                    assert(spies.res.json.calledWith({error: 'Invalid json: ' + validateErr}));

                } else {
                
                    assert(spies.crypto.createHash.calledWith('sha1'));
                    assert(spies.crypto.update.calledWith(body.productId + body.orderId + body.customer));
                    assert(spies.crypto.digest.calledWith('hex'));

                    if (newBuyErr) {

                        assert(spies.res.status.calledWith(500));
                        assert(spies.res.send.calledOnce);

                    } else {

                        assert(spies.res.status.calledWith(201));
                        assert(spies.res.json.calledWith({'API-KEY': apiKey}));

                    }
                }

                done();
            });
        };

        it('should return 422 when the JSON is not valid', function(done) {
            testNewBuy(true, false, done);
        });

        it('should return 500 when db fails adding the new buy', function(done) {
            testNewBuy(false, true, done);
        });

        it('should return 201 when the new buy is correct', function(done) {
            testNewBuy(false, false, done);
        });
    });
    
    describe('Function "deleteBuy"', function () {

        var testCancelSubscriptions = function (getSubscriptionsErr, getSubscriptionErr, cancelSubsErr, done) {

            var apiKey = data.DEFAULT_API_KEYS[0];
            var body = data.DEFAULT_DELETE_BUY_INFORMATION[0];
            var subscriptions = [{subscriptionId: 'subs1'}, {subscriptionId: 'subs2'}];
            var subscriptionsInfo = {};
            subscriptionsInfo[subscriptions[0].subscriptionId] = data.DEFAULT_SUBSCRIPTION_v1;
            subscriptionsInfo[subscriptions[1].subscriptionId] = data.DEFAULT_SUBSCRIPTION_v1;

            var implementations = {
                config: {
                    resources: {
                        contextBroker: true
                    }
                },
                req: {
                    body: body
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    json: function (json) {},
                    send: function () {}
                },
                validation: {
                    validate: function (schema, json, callback) {
                        return callback(null);
                    }
                },
                notifier: {
                    notifyUsage: function (apiKey, callback) {
                        return callback(null);
                    }
                },
                db: {
                    deleteBuy: function (apiKey, callback) {
                        return callback(null);
                    },
                    getCBSubscriptions: function (apiKey, callback) {
                        return callback(getSubscriptionsErr, subscriptions);
                    },
                    getCBSubscription: function (subscriptionId, callback) {
                        return callback(getSubscriptionErr, subscriptionsInfo[subscriptionId]);
                    }
                },
                logger: {
                    error: function (msg) {}
                },
                crypto: {
                    createHash: function (type) {
                        return this;
                    },
                    update: function (seed) {},
                    digest: function (type) {
                        return apiKey
                    }
                },
                cbHandler: {
                    cancelSubscription: function (subsInfo, callback) {
                        return callback(cancelSubsErr);
                    }
                },
                url: {
                    parse: function(url) {
                        return {
                            path: data.DEFAULT_PUBLIC_PATHS[0]
                        }
                    }
                }
            };

            mocker(implementations, function (api, spies) {

                api.deleteBuy(implementations.req, implementations.res);

                setTimeout(function() {

                    assert(spies.url.parse.calledWith(body.productSpecification.url));
                    assert(spies.validation.validate.calledWith('deleteBuy', body));
                    assert(spies.db.getCBSubscriptions.calledWith(apiKey));

                    if (getSubscriptionsErr) {
                        assert(spies.res.status.calledWith(500));
                        assert(spies.res.send.calledOnce);

                    } else {
                        assert(spies.db.getCBSubscription.calledWith(subscriptions[0].subscriptionId));

                        if (getSubscriptionErr) {
                            assert(spies.res.status.calledWith(500));
                            assert(spies.res.send.calledOnce);

                        } else {
                            async.eachSeries(subscriptions, function (subscription, taskCallback) {
                                assert(spies.db.getCBSubscription.calledWith(subscription.subscriptionId));
                                assert(spies.cbHandler.cancelSubscription.calledWith(subscriptionsInfo[subscription.subscriptionId]));
                            });

                            if (cancelSubsErr) {
                                assert(spies.res.status.calledWith(500));
                                assert(spies.res.send.calledOnce);

                            }
                        }
                    }

                    done();
                }, 200);
            });
        };

        it('should return 500 when there is an error getting all the subscriptions', function (done) {
            testCancelSubscriptions(true, false, false, done);
        });

        it('should return 500 when there is an error getting the information of a subscription', function (done) {
            testCancelSubscriptions(false, true, false, done);
        });

        it('should return 500 when there is an error cancelling the subscription', function (done) {
            testCancelSubscriptions(false, false, true, done);
        });

        var testDeleteBuy = function (validateErr, notifyErr, deleteBuyErr, done) {

            var apiKey = data.DEFAULT_API_KEYS[0];
            var body = data.DEFAULT_DELETE_BUY_INFORMATION[0];
            var publicPath = data.DEFAULT_PUBLIC_PATHS[0];

            var implementations = {
                config: {
                    resources: {
                        contextBroker: false
                    }
                },
                req: {
                    body: body
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    json: function (json) {},
                    send: function () {}
                },
                validation: {
                    validate: function (schema, json, callback) {
                        return callback(validateErr);
                    }
                },
                notifier: {
                    notifyUsage: function (apiKey, callback) {
                        return callback(notifyErr);
                    }
                },
                db: {
                    deleteBuy: function (apiKey, callback) {
                        return callback(deleteBuyErr);
                    }
                },
                logger: {
                    error: function (msg) {}
                },
                crypto: {
                    createHash: function (type) {
                        return this;
                    },
                    update: function (seed) {},
                    digest: function (type) {
                        return apiKey
                    }
                },
                url: {
                    parse: function(url) {
                        return {
                            path: publicPath
                        }
                    }
                }
            };

            mocker(implementations, function (api, spies) {

                api.deleteBuy(implementations.req, implementations.res);

                setTimeout(function () {
                    assert(spies.validation.validate.calledWith('deleteBuy', implementations.req.body));

                    if (validateErr) {
                        assert(spies.res.status.calledWith(422));
                        assert(spies.res.json.calledWith({error: 'Invalid json: ' + validateErr}));

                    } else {

                        assert(spies.url.parse.calledWith(body.productSpecification.url));
                        assert(spies.crypto.createHash.calledWith('sha1'));
                        assert(spies.crypto.update.calledWith(body.productId + body.orderId + body.customer + publicPath));
                        assert(spies.crypto.digest.calledWith('hex'));

                        assert(spies.notifier.notifyUsage.calledWith(apiKey));

                        if (notifyErr) {
                            assert(spies.logger.error.calledWith(notifyErr));
                            assert(spies.res.status.calledWith(500));
                            assert(spies.res.send.calledOnce);

                        } else {

                            assert(spies.db.deleteBuy.calledWith(apiKey));

                            if (deleteBuyErr) {
                                assert(spies.logger.error.calledWith(deleteBuyErr));
                                assert(spies.res.status.calledWith(500));
                                assert(spies.res.send.calledOnce);

                            } else {
                                assert(spies.res.status.calledWith(204));
                                assert(spies.res.send.calledOnce);

                            }
                        }
                    }

                    done();
                }, 200);
            });
        };

        it('should return 422 when the request body is not valid', function (done) {
            testDeleteBuy(true, false, false, done);
        });

        it('should return 500 when there is an error notifying the usage to Usage Management API', function (done) {
            testDeleteBuy(false, true, false, done);
        });

        it('should return 500 when db fails deleting the buy', function (done) {
            testDeleteBuy(false, false, true, done);
        });

        it('should return 204 when there is no error deleting the buy', function (done) {
            testDeleteBuy(false, false, false, done);
        });
    });
    
    describe('Function "isJSON"', function() {

        var testCheckIsJSON = function (isJSON, done) {

            var implementations = {
                req: {
                    is: function(type) {
                        return isJSON;
                    }
                },
                res: {
                    status: function(statusCode) {
                        return this;
                    },
                    json: function(msg) {}
                }
            };

            var next = sinon.stub();

            mocker(implementations, function (api, spies) {

                api.checkIsJSON(implementations.req, implementations.res, next);

                if (!isJSON) {

                    assert(spies.res.status.calledWith(415));
                    assert(spies.res.json.calledWith({error: 'Content-Type must be "application/json"'}));

                } else {

                    assert(next.calledOnce);

                }

                done();
            });
        };

        it('should return 415 when the content-type is not "application/json"', function(done) {
            testCheckIsJSON(false, done);
        });

        it('should call the callback without error when the content-type is "application/json"', function(done) {
            testCheckIsJSON(true, done);
        });
    });
});
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
	data = require('../data'),
	util = require('../util');

var mocker = function (implementations, callback) {

	util.getSpies(implementations, function (spies) {

		var config = implementations.config ? implementations.config : {};
        config.database = {
            type: './db'
        };
        config.resources = {
            notification_port: data.DEFAULT_PORT
        };

        var orionModule = proxyquire('../../orion_context_broker/orionModule_v1', {
        	'request': implementations.requester ? implementations.requester.request : {},
        	'../config': config,
        	'../accounter': implementations.accounter ? implementations.accounter : {},
        	'.././db': implementations.db ? implementations.db : {},
            'url': implementations.url ? implementations.url : {}
        });

        return callback(orionModule, spies);
	});
};

describe('Testing orionModule_v1', function () {

	describe('Function "subscribe"', function () {

		var testSubscribe = function (requestErr, subsRes, addCBSubsErr, done) {

            var apiKey = data.DEFAULT_API_KEYS[0];
            var options = {};
            var url = data.DEFAULT_URLS[0];
            var resp = {
                statusCode: 200,
                headers: {
                    header1: 'header1'
                }
            };
            var unit = data.DEFAULT_UNIT;

            var implementations = {
                req: {
                    body: {
                        reference: url
                    },
                    get: function (header) {
                        return apiKey;
                    }
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    send: function (body) {},
                    setHeader: function (header, value) {}
                },
                requester: {
                    request: function (options, callback) {
                        return callback(requestErr, resp, subsRes)
                    }
                },
                db: {
                    addCBSubscription: function (apiKey, subsId, ref, version, callback) {
                        return callback(addCBSubsErr);
                    }
                }
            };

            mocker(implementations, function (orionModule, spies) {

                orionModule.subscribe(implementations.req, implementations.res, unit, options, function (err, response) {

                    assert(spies.requester.request.calledWith(options));

                    if (requestErr) {
                        assert.equal(err, 'Error sending the subscription to the CB');
                        assert.deepEqual(response, {status: 504, body: ''});

                    } else if (!subsRes.subscribeResponse) {

                        assert.equal(err, null);
                        assert.deepEqual(response, {status: resp.statusCode, body: {}});

                    } else {

                        assert.deepEqual(response, {status: resp.statusCode, body: subsRes});
                        for (var header in resp.headers) {
                            assert(spies.res.setHeader.calledWith(header, resp.headers[header]));
                        }
                        assert(spies.req.get.calledWith('X-API-KEY'));
                        assert(spies.db.addCBSubscription.calledWith(apiKey, subsRes.subscribeResponse.subscriptionId, url, 'v1'));

                        if (addCBSubsErr) {
                            assert.equal(err, addCBSubsErr);
                        } else {
                            assert.equal(err, null);
                        }
                    }

                    done();
                });
            });
        };

        it('should call the callback with error when sending the request to CB fails', function (done) {
            testSubscribe(true, null, false, done);
        });

        it('should redirect the CB response and call the callback without error when the subscription is not valid', function (done) {
            testSubscribe(false, {}, false, done);
        });

        it('should call the callback with error when db fails adding the subscription', function (done) {
            testSubscribe(false, data.DEFAULT_SUBS_RESPONSE, 'Error', done);
        });

        it('should call the callback without error when there is no error making the accounting for subscription', function (done) {
            testSubscribe(false, data.DEFAULT_SUBS_RESPONSE, false, done);
        });
	});

	describe('Function "unsubscribe"', function () {

		var testUnsubscribe = function (method, subsId, respBody, requestErr, deleteCBSubsErr, done) {

            var resp = {
                statusCode: 200,
                headers: {
                    header1: 'header1'
                }
            };
            var options = {};
            var unit = data.DEFAULT_UNIT;

            var implementations = {
                req: {
                    path: data.DEFAULT_UNSUBS_PATH + '/' + subsId,
                    method: method,
                    body: {
                        subscriptionId: subsId
                    }
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    send: function (body) {},
                    setHeader: function (header, value) {}
                },
                requester: {
                    request: function (options, callback) {
                        return callback(requestErr, resp, respBody);
                    }
                },
                db: {
                    deleteCBSubscription: function (subsId, callback) {
                        return callback(deleteCBSubsErr);
                    }
                }
            };

            mocker(implementations, function (orionModule, spies) {

                orionModule.unsubscribe(implementations.req, implementations.res, options, function (err, response) {

                    assert(spies.requester.request.calledWith(options));

                    if (requestErr) {
                        assert.equal(err, 'Error sending the unsubscription to the CB');
                        assert.deepEqual(response, {status: 504, body: ''})

                    } else {

                        assert.deepEqual(response, {status: resp.statusCode, body: respBody});
                        for (var key in resp.headers) {
                            assert(spies.res.setHeader.calledWith(key, resp.headers[key]));
                        }

                        if (respBody.orionError) {
                            assert.equal(err, null);

                        } else {

                            assert(spies.db.deleteCBSubscription.calledWith(subsId));

                            deleteCBSubsErr ? assert.equal(err, deleteCBSubsErr) : assert.equal(err, null);
                        }
                    }

                    done();
                });
            });
        };

        it('should call the callback with error when there is an error sending the request to CB', function (done) {
            testUnsubscribe('POST', data.DEFAULT_SUBS_ID, {}, true, false, done);
        });

        it('should call the callback without error and redirect the response when CB response status is not 200', function (done) {
           testUnsubscribe('DELETE', data.DEFAULT_SUBS_ID, {orionError: 'Error'}, false, false, done);
        });

        it('should call the callback with error when db fails deleting the subscription', function (done) {
           testUnsubscribe('DELETE', data.DEFAULT_SUBS_ID, {}, false, true, done);
        });

        it('should call the callback without error when the unsubscription is correct', function (done) {
           testUnsubscribe('DELETE', data.DEFAULT_SUBS_ID, {}, false, null, done); 
        });
	});

	describe('Function "updateSubscription"', function () {

		var testUpdateSubscription = function (requestErr, done) {

            var subsId = data.DEFAULT_SUBS_ID;
            var options = {};
            var apiKey = data.DEFAULT_API_KEYS[0];
            var unit = data.DEFAULT_UNIT;
            var subsInfo = subsInfo ? data.DEFAULT_SUBSCRIPTION_v1 : null;
            var updateResp = updateResp ? data.DEFAULT_SUBS_RESPONSE : {};
            var body = {
                subscriptionId: subsId
            };
            var resp = {
                statusCode: 200,
                headers: {
                    header1: 'header1'
                }
            };

            var implementations = {
                req: {
                    body: body,
                    get: function (header) {
                        return apiKey;
                    }
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    send: function (body) {},
                    setHeader: function (header, value) {}
                },
                requester: {
                    request: function (options, callback) {
                        return callback(requestErr, resp, updateResp)
                    }
                }
            };

            mocker(implementations, function (orionModule, spies) {

                orionModule.updateSubscription(implementations.req, implementations.res, options, function (err, response) {

                	assert(spies.requester.request.calledWith(options));

                	if (requestErr) {
                        assert.equal(err, 'Error sending the subscription to the CB');
                        assert.deepEqual(response, {status: 504, body: ''});

                	} else {
                        assert.equal(err, null);
                        assert.deepEqual(response, {status: resp.statusCode, body: updateResp});
                    }

                    assert(spies.res.setHeader.calledWith('header1', resp.headers.header1));

                    done();
                });
            });
        };

        it('should call the callback with error when there is an error making the request to CB', function (done) {
            testUpdateSubscription(true, done);
        });

        it('should call the callback without error when there is no error updating the subscription', function (done) {
            testUpdateSubscription(false, done);
        });
	});

    describe('Function "cancelSubscription"', function () {

        var testCancelSubscription = function (error, statusCode, done) {

            var protocol = 'http';
            var host = 'localhost:9000';
            var subsId = data.DEFAULT_SUBS_ID;
            var body = {
                'subscriptionId': subsId
            };
            var subscriptionInfo = {
                url: data.DEFAULT_URLS[0],
                subscriptionId: subsId
            };
            var errorMsg = 'Error cancelling the subscription with Id: ' + subsId;

            var options = {
                url: protocol + '//' + host + '/v1/unsubscribeContext',
                method: 'POST',
                json: true, 
                body: body
            };

            var implementations = {
                requester: {
                    request: function (options, callback) {
                        return callback(error, {}, {statusCode: {code: statusCode}}); 
                    }
                },
                url: {
                    parse: function (url) {
                        return {
                            protocol: protocol,
                            host: host
                        };
                    }
                }
            };

            mocker(implementations, function (orionModule, spies) {

                orionModule.cancelSubscription(subscriptionInfo, function (err) {

                    assert(spies.requester.request.calledWith(options));
                    assert(spies.url.parse.calledWith(subscriptionInfo.url));

                    var result = error ? errorMsg : null;
                    assert.equal(err,  result);

                    done();
                });
            });
        };

        it('should call the callback with error when there is an error sending the request to Context Broker', function (done) {
            testCancelSubscription(true, null, done);
        });

        it('should call the callback with error when there is an error cancelling the subscription in Context Broker', function (done) {
            testCancelSubscription(true, 400, done);
        });

        it('should call the callback without error when there is no error sending the request to the Context Broker', function (done) {
            testCancelSubscription(false, 200, done);
        });
    });
});
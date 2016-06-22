var request = require('request'),
    config = require('../config'),
    accounter = require('../accounter'),
    async = require('async');

var db = require('../' + config.database.type);

/**
 * Save the subscription in the db and redirect the response to the user.
 * If the accounting unit is millisecond, extract the subscription duration
 * and make the accounting.
 *
 * @param  {Object}   req      Incoming request.
 * @param  {Object}   res      Outgoing response.
 * @param  {string}   unit     Accounting unit.
 * @param  {Object}   options  Context Broker request options.
 */
exports.subscribe = function (req, res, unit, options, callback) {

    var reqBody = req.body;
    var referenceUrl = reqBody.reference;
    var response = {};

    // Change the notification endpoint to accounting endpoint
    reqBody.reference = 'http://localhost:' + config.resources.notification_port + '/subscriptions';
    options.body = reqBody;

    // Send the request to the CB and redirect the response to the subscriber
    request(options, function (err, resp, body) {

        if (err) {
            response = {
                status: 504,
                body: ''
            };
            return callback('Error sending the subscription to the CB', response);

        } else if (body.subscribeResponse) {

            var subscriptionId = body.subscribeResponse.subscriptionId;
            var duration = body.subscribeResponse.duration;

            async.forEachOf(resp.headers, function (header, key, taskCallback) {
                res.setHeader(key, header);
                taskCallback();
            }, function () {

                response.status = resp.statusCode;
                response.body = body;
                var apiKey = req.get('X-API-KEY');

                // Store the endpoint information of the subscriber to be notified
                db.addCBSubscription(apiKey, subscriptionId, referenceUrl, '', function (err) {

                    if (err) {
                        return callback(err, response);
                    } else {

                        accounter.count(apiKey, unit, {request: { duration: duration}}, 'subscriptionCount', function (err) {
                            if (err && err.code !== 'invalidFunction') {
                                return callback(err.msg, response);
                            } else {
                                return callback(null, response);
                            }
                        });
                    }
                });
            });

        } else {
            response = {
                status: resp.statusCode,
                body: body
            };
            return callback(null, response);
        }
    });
};

/**
 * Delete the subscription from the database and redirect the response
 * to the user.
 *
 * @param  {Object}   req      Incoming object.
 * @param  {Object}   res      Outgoing object.
 * @param  {Object}   options  Context Broker request options.
 */
exports.unsubscribe = function (req, res, options, callback) {

    var subscriptionId = '';
    var response = {};

    if (req.method === 'POST') {
        subscriptionId = req.body.subscriptionId;
    } else if (req.method === 'DELETE') {
        subscriptionId = req.path.substr(req.path.lastIndexOf('/') + 1);
    }

    options.body = req.body;

    // Sends the request to the CB and redirect the response to the subscriber
    request(options, function (err, resp, body) {

        if (err) {
            response = {
                status: 504,
                body: ''
            };
            return callback('Error sending the unsubscription to the CB', response);

        } else {

            response = {
                status: resp.statusCode,
                body: body
            };

            async.forEachOf(resp.headers, function (header, key, taskCallback) {
                res.setHeader(key, header);
                taskCallback();
            }, function () {

                if (!body.orionError) {

                    db.deleteCBSubscription(subscriptionId, function (err) {
                        if (err) {
                            return callback(err, response);
                        } else {
                            return callback(null, response);
                        }
                    });

                } else {
                    return callback(null, response);
                }
            });
        }
    });
};

/**
 * Update the subscription and redirect the response to the client.
 * If the accounting unit is millisecond, the accounting value will be 
 * increased according the new subscription duration.
 *
 * @param  {Object}   req      Incoming request.
 * @param  {Object}   res      Outgoing response.
 * @param  {Object}   options  Context Broker request options.
 */
exports.updateSubscription = function (req, res, options, callback) {

    options.body = req.body;
    var subscriptionId = req.body.subscriptionId;
    var response = {};

    request(options, function (err, resp, body) {

        if (err) {
            response = {
                status: 504,
                body: ''
            };
            return callback('Error sending the subscription to the CB', response);

        } else if (body.subscribeResponse) {

            var subscriptionId = body.subscribeResponse.subscriptionId;
            var duration = body.subscribeResponse.duration;

            async.forEachOf(resp.headers, function (header, key, taskCallback) {
                res.setHeader(key, header);
                taskCallback();
            }, function () {

                response.status = resp.statusCode;
                response.body = body;
                var apiKey = req.get('X-API-KEY');

                db.getCBSubscription(subscriptionId, function (err, subscriptionInfo) {

                    if (err) {
                        return callback(err, response);
                    } else if (!subscriptionInfo) {
                        return callback('Subscription "' + subscriptionId + '" not in database.', response)
                    } else {

                        accounter.count(apiKey, subscriptionInfo.unit, {request: { duration: duration}}, 'subscriptionCount', function (err) {
                            if (err && err.code !== 'invalidFunction') {
                                return callback(err, response);
                            } else {
                                return callback(null, response);
                            }
                        });
                    }
                });
            });

        } else {
            response = {
                status: resp.statusCode,
                body: body
            };
            return callback(null, response);
        }
    });
};
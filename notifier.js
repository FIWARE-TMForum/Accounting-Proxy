var config = require('./config'),
    async = require('async'),
    request = require('request'),
    logger = require('winston');

var db = require(config.database.type);
var acc_modules = {};

/**
 * Send the usage specification for the unit passed to the Usage Managament API.
 *
 * @param  {string}   unit     Accounting unit.
 */
var sendSpecification = function (unit, callback) {
    acc_modules[unit].getSpecification(function (specification) {
        db.getToken(function (err, token) {
            var options = {
                url: 'http://' + config.usageAPI.host + ':' + config.usageAPI.port + config.usageAPI.path + '/usageSpecification',
                json: true,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    authorization: token
                },
                body: specification
            };

            request(options, function (err, resp, body) {
                if (err || resp.statusCode !== 201) {
                    return callback('Error sending the Specification. ' + resp.statusCode + ' ' + resp.statusMessage);
                } else {
                    db.addSpecificationRef(unit, body.href, function (err) {
                        if (err) {
                            return callback(err);
                        } else {
                            return callback(null);
                        }
                    });
                }
            });
        });
    });
};

/**
 * Send the accounting information to the usage API.
 *
 * @param  {Object}   accInfo  Accounting information to notify.
 */
var sendUsage = function (accInfo, callback) {
    db.getHref(accInfo.unit, function (err, href) {
        if (err) {
            return callback(err);
        } else {
            var body = {
                date: (new Date()).toISOString(),
                type: accInfo.recordType,
                status: 'Received',
                usageSpecification: {
                    href: href,
                    name: accInfo.unit
                },
                usageCharacteristic: [
                    {
                        name: 'orderId',
                        value: accInfo.orderId
                    }, {
                        name: 'productId',
                        value: accInfo.productId
                    }, {
                        name: 'correlationNumber',
                        value: accInfo.correlationNumber
                    }, {
                        name: 'unit',
                        value: accInfo.unit
                    }, {
                        name: 'value',
                        value: accInfo.value
                    }
                ],
                relatedParty: [{
                    role: 'customer',
                    id: accInfo.customer,
                    href: 'http://' + config.usageAPI.host + ':' + config.usageAPI.port +
                        '/partyManagement/individual/' + accInfo.customer
                }]
            };

            db.getToken(function (err, token) {
                if (err) {
                    return callback('Error obteining the token');
                } else {
                    var options = {
                        url: 'http://' + config.usageAPI.host + ':' + config.usageAPI.port + config.usageAPI.path + '/usage',
                        json: true,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            authorization: token
                        },
                        body: body
                    };
                    request(options, function (err, resp, body) {
                        if (err || resp.statusCode !== 201) {
                            return callback('Error sending the usage. ' + resp.statusCode + ' ' + resp.statusMessage);
                        } else {
                            db.resetAccounting(accInfo.apiKey, function (err) {
                                if (err) {
                                    return callback('Error while reseting the accounting after notify the usage');
                                } else {
                                    return callback(null);
                                }
                            });
                        }
                    });
                }
            });
        }
    });
};

/**
 * Notify the usage specification for all the accounting units supported by the proxy.
 *
 */
var notifyUsageSpecification = function (callback) {
    var units = config.modules.accounting;

    async.each(units, function (unit, task_callback) {
        acc_modules[unit] = require('./acc_modules/' + unit);
        db.getHref(unit, function (err, href) {
            if (err) {
                task_callback(err);
            } else if (href !== null) {
                task_callback(null);
            } else {
                sendSpecification(unit, task_callback);
            }
        });
    }, callback);
};

/**
 * Notify the accounting value.
 *
 */
var notifyUsage = function (callback) {
    db.getNotificationInfo(function (err, notificationInfo) {
        if (err) {
            return callback(err);
        } else if (notificationInfo === null) { // no info to notify
            return callback(null);
        } else {
            logger.info('Notifying the accounting...');
            async.each(notificationInfo, function (info, task_callback) {
                sendUsage(info, function (err) {
                    if (err) {
                        task_callback(err);
                    } else {
                        task_callback(null);
                    }
                });
            }, callback);
        }
    });
};

exports.notifyUsageSpecification = notifyUsageSpecification;
exports.notifyUsage = notifyUsage;
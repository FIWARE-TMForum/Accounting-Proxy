var config = require('./config'),
    async = require('async'),
    request = require('request'),
    logger = require('winston');

var db = require(config.database.type);

/**
 * Send the usage specification for the unit passed to the Usage Managament API.
 *
 * @param  {string}   unit     Accounting unit.
 */
var sendSpecification = function (token, unit, callback) {
    var accountingModules = require('./server').accountingModules;

    if (accountingModules[unit].getSpecification === undefined) {
        return callback('Error, function getSpecification undefined for unit ' + unit);
    } else {

        var specification = accountingModules[unit].getSpecification();

        if (specification === undefined) {
            return callback('Error, specification no available for unit ' + unit);

        } else {

            var options = {
                url: 'http://' + config.usageAPI.host + ':' + 
                config.usageAPI.port + config.usageAPI.path + '/usageSpecification',
                json: true,
                method: 'POST',
                headers: {
                    'X-API-KEY': token
                },
                body: specification
            };

            logger.info('Sending specification for unit: ' + unit);
            request(options, function (err, resp, body) {

                if (err) {
                    return callback('Error sending the Specification: ' + err.code);

                } else if (resp.statusCode !== 201) {

                    return callback('Error, ' + resp.statusCode + ' ' + resp.statusMessage);

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
        }
    }
};

/**
 * Send the accounting information to the usage API.
 *
 * @param  {Object}   accInfo  Accounting information to notify.
 */
var sendUsage = function (token, accInfo, callback) {

    logger.info('Notifying the accounting...');

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

            var options = {
                url: 'http://' + config.usageAPI.host + ':' + config.usageAPI.port + config.usageAPI.path + '/usage',
                json: true,
                method: 'POST',
                headers: {
                    'X-API-KEY': token
                },
                body: body
            };

            // Notify usage to the Usage Management API
            request(options, function (err, resp, body) {

                if (err) {
                    return callback('Error notifying usage to the Usage Management API: ' + err.code);
                } else if (resp.statusCode !== 201){
                    return callback('Error notifying usage to the Usage Management API: ' + resp.statusCode + ' ' + resp.statusMessage);
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
};

/**
 * Notify the usage specification for all the accounting units supported by the proxy.
 *
 */
var notifyUsageSpecification = function (token, callback) {
    var units = config.modules.accounting;

    async.each(units, function (unit, task_callback) {

        db.getHref(unit, function (err, href) {
            if (err) {
                task_callback(err);
            } else if (href !== null) {
                task_callback(null);
            } else {
                sendSpecification(token, unit, task_callback);
            }
        });
    }, callback);
};

/**
 * Notify the accounting value.
 *
 */
var notifyUsage = function (callback) {

    db.getToken(function (err, token) {
        if (err) {
            return callback(err);
        } else if (!token) {
            return callback(null);
        } else {

            db.getNotificationInfo(function (err, notificationInfo) {

                if (err) {
                    return callback(err);
                } else if (notificationInfo === null) { // no info to notify
                    return callback(null);
                } else {

                    // First, Notify the usage specifications
                    notifyUsageSpecification(token, function (err) {

                        if (err) {
                            return callback(err);

                        } else {
                            // Then, notify the usage
                            async.each(notificationInfo, function (info, task_callback) {
                                sendUsage(token, info, function (err) {
                                    if (err) {
                                        task_callback(err);
                                    } else {
                                        task_callback(null);
                                    }
                                });
                            }, callback);
                        }
                    });
                }
            });
        }
    });
};

exports.notifyUsage = notifyUsage;
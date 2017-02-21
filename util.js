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

var async = require('async'),
    config = require('./config');

var pathRegExp = /^\/([\w#!:.?+=&%@!\-\/])/;
var invalidPathError = 'Invalid path format.';
var admin_paths = config.api.administration_paths;

exports.administrationPath = function (path, callback) {
    var is_admin_path = false;

    async.forEachOf(admin_paths, function(admin_path, key, taskCallback) {
        if (path === admin_path  && ! is_admin_path) {
            is_admin_path = true;
        }
        taskCallback();
    }, function() {
        return callback(is_admin_path);
    });
};

/**
 * Middleware that reads the data stream and stores in the body property of the request.
 *
 * @param  {Object}   req  Incoming request.
 * @param  {Object}   res  Outgoing response.
 */
exports.getBody = function (req, res, next) {
    req.body = '';

    req.on('data', function (chunk) {
        req.body += chunk;
    });

    req.on('end', function () {
        next();
    });
};

/**
 * Middleware that verifies the client certificate.
 *
 * @param      {Object}    req     Incoming request.
 * @param      {Object}    res     Outgoing response.
 */
exports.validateCert = function (req, res, next) {
    if (config.accounting_proxy.https.enabled && !req.client.authorized) {
        res.status(401).json({error: 'Unauthorized: Client certificate required ' + req.client.authorizationError});
    } else {
        next();
    }
};

exports.pathRegExp = pathRegExp;
exports.invalidPathError = invalidPathError;
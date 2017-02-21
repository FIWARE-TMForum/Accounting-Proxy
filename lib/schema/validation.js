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

var Joi = require('joi'),
    fs = require('fs'),
    schemas = require('./schemas');

"use strict"

// Validate if the body is correct for each type of request
exports.validate = function(type, body, callback) {

    var validationSchema = schemas[type];

    Joi.validate(body, validationSchema, function(err, data) {
        if (err) {
            return callback(err.details[0].message);
        } else {
            return callback(null);
        }
    });
};
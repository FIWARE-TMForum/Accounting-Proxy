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

var mkdirp = require('mkdirp'),
    server = require('./server'),
    logger = require('./lib/log');

// Create directory ./log if not exists
mkdirp('./log', function (err) {
    if (err) {
        logger.error('Error creating "./log" path');
    }
});

// Start the accounting proxy
server.init(function (err) {
    if (err) {
        logger.error(err);
        process.exit(1);
    }
});
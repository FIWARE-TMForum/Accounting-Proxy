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

var proxyquire = require('proxyquire'),
	assert = require('assert'),
	sinon = require('sinon'),
	data = require('../data');

describe('Testing util', function () {

	describe('Function administrationPath', function () {

		var testAdministrationPath = function (path, isAdminPath, done) {

		    var configMock = {
				api: {
					administration_paths: data.DEFAULT_ADMINISTRATION_PATHS
				}
			};

			var util = proxyquire('../../lib/util', {
				'./../config': configMock
			});

			util.administrationPath(path, function (res) {
				assert.equal(res, isAdminPath);
				done();
			});
		};


		it('should return call the callback with true when the path passed is an administration path', function (done) {
			testAdministrationPath('/accounting_proxy/units', true, done);
		});

		it('should return call the callback with false when the path passed is not an administration path', function (done) {
			testAdministrationPath('/noAdminPath', false, done);
		});
	});

	describe('Function getBody', function () {

		it('should read the data stream and stores in the request object', function (done) {

			var reqMock = {
				on: function (eventType, callback) {
					if (eventType === 'data') {
						return callback('chunk');
					} else {
						return callback();
					}
				}
			};

			var onSpy = sinon.spy(reqMock, 'on');

			var util = require('../../lib/util');

			util.getBody(reqMock, {}, function () {
				assert(onSpy.calledWith('data'));
				assert(onSpy.calledWith('end'));
				assert.equal(reqMock.body, 'chunk');
				done();
			});
		});

	});

	describe('Function validCert', function () {

		var testValidateCert = function (enableHttps, authorized, done) {

			var configMock = {
				accounting_proxy: {
					https: enableHttps ? {enabled: true} : {}
				}
			};

			var req = {
				client: {
					authorized: authorized,
					authorizationError: 'authorization error'
				}
			};

			var res = {
				status: function (statusCode) {
					return this;
				},
				json: function (json) {}
			};

			var statusSpy = sinon.spy(res, 'status');
			var jsonSpy = sinon.spy(res, 'json');
			var next = sinon.stub();

			var util = proxyquire('../../lib/util', {
				'./../config': configMock
			});

			util.validateCert(req, res, next);

			if (enableHttps && !authorized) {
				assert(statusSpy.calledWith(401));
				assert(jsonSpy.calledWith({error: 'Unauthorized: Client certificate required ' + req.client.authorizationError}));
			} else {
				assert(next.calledOnce);
			}

			done();
		};

		it('should call the callback when the https is disabled', function (done) {
			testValidateCert(false, true, done);
		});

		it('should return 401 when the request cert is not valid and https is enabled', function (done) {
			testValidateCert(true, false, done);
		});
	});
});
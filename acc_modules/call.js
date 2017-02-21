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

/** Accounting module for unit: CALL */

var specification = {
    name: 'call',
    description: 'Spec for call usage',
    usageSpecCharacteristic: [{
        name: 'orderId',
        description: 'Order identifier',
        configurable: false,
        usageSpecCharacteristicValue: [{
            valueType: 'string',
            default: false,
            value: '',
            valueFrom: '',
            valueTo: ''
        }]
    }, {
        name: 'productId',
        description: 'Product identifier',
        configurable: false,
        usageSpecCharacteristicValue: [{
            valueType: 'string',
            default: false,
            value: '',
            valueFrom: '',
            valueTo: ''
        }]
    }, {
        name: 'correlationNumber',
        description: 'Accounting correlation number',
        configurable: false,
        usageSpecCharacteristicValue: [{
            valueType: 'number',
            default: false,
            value: '',
            valueFrom: '0',
            valueTo: ''
        }]
    }, {
        name: 'unit',
        description: 'Accounting unit',
        configurable: false,
        usageSpecCharacteristicValue: [{
            valueType: 'string',
            default: true,
            value: 'call',
            valueFrom: '',
            valueTo: ''
        }]
    }, {
        name: 'value',
        description: 'Accounting value',
        configurable: false,
        usageSpecCharacteristicValue: [{
            valueType: 'number',
            default: false,
            value: '',
            valueFrom: '0',
            valueTo: ''
        }]
    }]
};

var count = function (countInfo, callback) {
    return callback(null, 1);
};

var getSpecification = function () {
    return specification;
};

exports.count = count;
exports.getSpecification = getSpecification;
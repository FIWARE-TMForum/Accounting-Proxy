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

/*
* Define the json in order to validate the administration requests
*/
var Joi = require('joi'),
    config = require('./../../config');

var schemas = {};

schemas.newBuy = {
    orderId: Joi.string().min(1).required(),
    productId: Joi.string().min(1).required(),
    customer: Joi.string().min(1).required(),
    productSpecification: Joi.object().keys({
        url: Joi.string().min(1).required(),
        unit: Joi.any().valid(config.modules.accounting),
        recordType: Joi.string().min(1).required()
    })
};

schemas.deleteBuy = {
    orderId: Joi.string().min(1).required(),
    productId: Joi.string().min(1).required(),
    customer: Joi.string().min(1).required(),
    productSpecification: Joi.object().keys({
        url: Joi.string().min(1).required()
    })
};

module.exports = schemas;
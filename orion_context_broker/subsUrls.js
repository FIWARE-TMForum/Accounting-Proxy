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

/**
 * Operation identification table. Each row of the table contains a Context Broker subscribe or delete operations with two fields:
 * the method of the operation and a regular expression to identify the URL.
 */
 module.exports = [

    /* Standard NGSI operations */
    ['POST', /\/(v1\/registry|ngsi9)\/subscribecontextavailability$/, 'create'],
    ['POST', /\/(v1\/registry|ngsi9)\/deletecontextavailability$/, 'delete'],
    ['POST', /\/(v1|ngsi10)\/subscribecontext$/, 'create'],
    ['POST', /\/(v1|ngsi10)\/unsubscribecontext$/, 'delete'],
    ['POST', /\/(v1\/registry|ngsi9)\/updatecontextavailabilitysubscription$/, 'update'],
    ['POST', /\/(v1|ngsi10)\/updatecontextsubscription$/, 'update'],

    /* "Classic" NGSI9 operations */
    ['POST', /^\/(ngsi9|v1\/registry)\/contextavailabilitysubscriptions$/, 'create'],
    ['DELETE', /^\/(ngsi9|v1\/registry)\/contextavailabilitysubscriptions\/.+/, 'delete'],

    /* "Classic" NGSI10 operations */
    ['POST', /^\/(ngsi10|v1)\/contextsubscriptions$/, 'create'],
    ['DELETE', /^\/(ngsi10|v1)\/contextsubscriptions\/.+/, 'delete'],

    /* V2 Operations */
    ['POST', /^\/v2\/subscriptions$/, 'create'],
    ['PATCH', /^\/v2\/subscriptions\/.+/, 'update'],
    ['DELETE', /^\/v2\/subscriptions\/.+/, 'delete']
];
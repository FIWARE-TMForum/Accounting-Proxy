var config = {};

// Accounting proxy configuration.
//--------------------------------------------------
// Configures the address and ports for the accounting proxy.
config.accounting_proxy = {

    /**
     * Port where the accounting proxy server is listening.
     */
    port: 9000
};

// Accounting database configuration.
//--------------------------------------------------
config.database = {

    /**
     * Select the database. Possible optrions are:
     *     './db_Redis': redis database.
     *     './db': sqlite database.
     */
    type: "./db_Redis",

    /**
     * Database name. If the database type selected is './db_Redis',
     *  then name must be a number (0 by default, and 15 is reserved to test by default).
     */
    name: 0,//'accountingDB.sqlite',

    redis_host: 'localhost',

    redis_name: 6379

};

// Accouning Modules configuration.
//--------------------------------------------------
// Configures the accounting modules used by the accounting proxy.
config.modules = {

    accounting: ['millisecond', 'call', 'megabyte']

};


// WStore sonfiguration.
//--------------------------------------------------
// Configures the usage managemnt API url.
config.usageAPI = {

    /**
     * Usage Management API host.
     */
    host: 'localhost',

    /**
     * Port where the Usage Management API is running.
     */
    port: 8080,

    /**
     * Usage Management API.
     */
    path: '/DSUsageManagement/api/usageManagement/v2'
};

// Resource configuration.
//--------------------------------------------------
// Configures the resources accounted by the proxy.
config.resources = {

    /**
     * Enabled if the resource accounted is Orion Context Broker.
     */
    contextBroker: true,

    /**
     * Port where the accounting proxy server is listening to subscription notifications.
     */
    notification_port: 9002

};

// Administration API configuration.
//--------------------------------------------------
// Configures the administration paths for the administration API used by the WStore.
config.api = {

    administration_paths: {
        keys: '/accounting_proxy/keys',
        units: '/accounting_proxy/units',
        newBuy: '/accounting_proxy/buys',
        checkUrl: '/accounting_proxy/urls'
    }
};

// OAuth2 configuration.
//--------------------------------------------------
// Configures the OAuth2  parameters.
config.oauth2 = {
    roles: {
        admin: '106',
        customer: '',
        seller: ''
    }
};

// Logger configuration
config.log = {

    file: './log/all-log'
};
module.exports = config;
# Accounting-Proxy
## Index
* [Deployment](#deployment)
	* [Software requiremnts](#softwarerequirements)
	* [Installation](#installation)
* [Configuration](#configuration)
* [Authentication](#authentication)
* [Authorization](#authorization)
	* [Administrators](#administrators)
* [Accounting](#accounting)
* [Running](#running)
* [Proxy API](#proxyapi)
* [Development](#development)
	* [Accounting module](#accountingmodule)
	* [Testing](#tests)
* [License](#license)

## <a name="deployment"/> Deployment

### <a name="softwarerequirements"/> Software Requirements:
 - NodeJS: [Homepage](http://nodejs.org/).
 - Redis: [Homepage](http://redis.io/).

### <a name="installation"/> Installation:


To install NodeJS dependencies, execute in the accounting-proxy folder:
```
npm install
```


## <a name="configuration"/> Configuration

All the Accounting Proxy configuration is stored in the `config.js` file in the root of the project folder.

* `config.accounting_proxy`: Basic information of the accounting proxy setup.
	- `https`: HTTPS configuration. Leave this param as undefined if you want to deploy the proxy in HTTP
        - `enabled`: Whether HTTPS is enabled. It also activates the certificate validation for some administration requests (see [Proxy API](#proxyapi)).
        - `certFile`: Path to the server certificate in PEM format.
        - `keyFile`: Path to the private key of the server.
        - `caFile`: Path to the CA file.
	
 - `port`: Port where the accounting proxy server is going to listen.
```
{
	https: {
        enabled: true,
        certFile: 'ssl/server1.pem',
        keyFile: 'ssl/server1.key',
        caFile: 'ssl/fake_ca.pem'
    },
	port: 9000
}
```

* `config.database`: Database configuration.
 - `type`: Database type. Two possible options: `./lib/db/db` (sqlite database) or `./lib/db/db_Redis` (redis database).
 - `name`: Database name. If the database type select is redis, then this field select the database (0 to 14; 15 is reserved for testing).
 - `redis_host`: Redis database host (Only needed for redis database).
 - `redis_port`: Redis database port (Only needed for redis database).
```
{
	type: './lib/db/db_Redis',
    name: 5,
    redis_host: 'localhost',
    redis_port: 6379
}
```

* `config.modules`:  Array of supported accounting modules for accounting different data. Possible options are:
	- `call`: Accounts the number of calls to the protected service
	- `megabyte`: Accounts the amount of data (in megabytes) send of read from the protected service.
	- `millisecond`: Accounts the requests duration (in milliseconds). In particular, the time between the request is sent to the service and the response is received
```
{
	accounting: [ 'call', 'megabyte', 'millisecond']
}
```
Other accounting modules can be implemented and included in the proxy (see  [Accounting module](#accountingmodule) ).

* `config.usageAPI`: Information of the usage management API where the usage specifications and the accounting information will be sent.
	- `host`: API host.
	- `port`: API port.
	- `path`: Path for the usage management API.
	- `schedule`: Daemon service schedule to notify the usage accounting info. The format is similar to the cron tab format:  "MINUTE HOUR DAY_OF_MONTH MONTH_OF_YEAR DAY_OF_WEEK YEAR (optional)". By the default, the usage notifications will be sent every day at 00:00.
```
{
	host: 'localhost',
    port: 8080,
    path: '/DSUsageManagement/api/usageManagement/v2',
    schedule: '00 00 * * *'
}
```

* `config.resources`: Configuration of the services accounted by the proxy. Despite the Accounting Proxy can be used to
  monitor any API service, it has native support for monitoring an instance of Context Broker with
  ([API v1](https://fiware-orion.readthedocs.io/en/develop/index.html) and [API v2](https://fiware-orion.readthedocs.io/en/develop/index.html))
  in order to support the accounting of subscription notifications.
	- `contextBroker`: Whether the resource accounted is an Orion Context Broker.  False by default
	- `notification_port`: Port where the accounting proxy is listening to subscription notifications from the Orion 
	Context Broker (port 9002 by default). This field is only used when the proxy is used for monitoring a Context Broker
	instance.
```
{
	contextBroker: false,
	notification_port: 9002
}
```

* `config.api.administration_paths`: Configuration of the administration paths. Default accounting paths are:
```
{
	api: {
    	administration_paths: {
            keys: '/accounting_proxy/keys',
            units: '/accounting_proxy/units',
            newBuy: '/accounting_proxy/newBuy',
            checkURL: '/accounting_proxy/urls',
            deleteBuy: '/accounting_proxy/deleteBuy'
    	}
    }
}
```
* `config.oauth2.roles`: Configuration of the OAuth2 roles. Default roles are:
```
{
	oauth2: {
    	roles: {
            admin: '106',
            customer: '',
            seller: ''
        }
    }
}
```

## <a name="authentication"/> Authentication
The authentication process is based on OAuth2 v2 tokens. The Accounting-Proxy expects that all the requests have a 
header `x-auth-token`  or `Authorization`  containing `bearer "token"` both containing a valid access token 
provided by the FIWARE IdM

## <a name="authorization"/> Authorization
If the authentication process success, the Accounting-Proxy check the authorization. The Accounting-Proxy expects that
all the requests have a header `X-API-KEY` containing a valid API-KEY corresponding to the requested service. This
header is used by the Accounting Proxy in order to determine the particular acquisition and the involved pricing 
(monitored unit)

### <a name="administrators"/> Administrators
If the user is an administrator of the service, the administrator request must omit the "X-API-KEY" header. After the
administrator request is authenticated, the request will be redirected to the service and no accounting will be made.

## <a name="accounting"/> Accounting
The accounting proxy supports accounting based on different units and there is a module for each accounting unit.
Developers can implement their own accounting modules (see section [Development](#development)). By default, all
Accounting Proxy instances have three accounting modules:
* `call`: The accounting value is incremented in one for each call to the service. If the Context Broker option is enabled,
  the accounting value will be also incremented in one for each Context Broker notification.
* `megabyte`: The accounting value is incremented based on the amount of data (in megabytes) retrieved from the service.
  If Context Broker option is enabled, the accounting value will be also incremented based on the amount of data 
  (in megabytes) sent in Context Broker notifications.
* `millisecond`: The accounting value is incremented based on the request time (in milliseconds). If Context Broker 
  option is enabled, the accounting value will be also incremented based on the notification time (in milliseconds).

## <a name="running"/> Running
After [installation](#installation), just execute:
```
node accounting-proxy
```

## <a name="cli"/> CLI

In order to manage services, the 'cli' tool has been provided. The available commands are:

* `./cli addService [-c] <publicPath> <url> <appId> <httpMethod> [otherHttpMethods...]`: binds the public path with the 
  url specified, the application ID (all request with an access token from a different application will be rejected) 
  and the http method(s) specified. The public path valid patterns are the following:
	-	`/publicPath`: only the first part of the path.
	-	`/this/is/the/final/resource/path?color=Blue&shape=rectangular`: the complete resource path (absolute path). In this case, the proxy will use this path to make the request. Use this type of public paths to register URLs with query strings.
For instance, a public path such as `/public/path` is not valid.

	- Options:
		- `-c, --context-broker`: the service is an Orion Context broker service (`config.contextBroker` must be set to `true` in `config.js`).

* `./cli getService [-p <publicPath>]`: returns the URL, the application ID and the type (Context Broker or not) of all registered services.
	- Options:
		- `-p, --publicPath <path>`: only displays the information of the service specified.

* `./cli deleteService <publicPath>`: deletes the service associated with the public path.
* `./cli addAdmin <userId>`: adds a new administrator.
* `./cli deleteAdmin <userId>`: deletes the specified admin.
* `./cli bindAdmin <userId> <publicPath>`: adds the specified administrator to the service specified by the public path.
* `./cli unbindAdmin <userId> <publicPath>`: deletes the specified administrator for the specified service by its public path.
* `./cli unbindAdmin <userId> <publicPath>`: deletes the specified administrator for the specified service by its public path.
* `./cli getAdmins <publicPath>`: displays all the administrators for the specified service.

To display brief information: `./cli -h` or `./cli --help`. In order to get information for a specific command type: `./cli help [cmd]`.

## <a name="proxyapi"/> Proxy API

Proxy's api is in port **9000** by default and root path **/accounting_proxy/..**.

### POST .../newBuy

Used by the store to notify a new buy. If the accounting proxy has been started over HTTPS, these requests should be signed with the Store cert; otherwise, they will be rejected.
```json
{
 "orderId": "...",
 "productId": "...",
 "customer": "...",
 "productSpecification": {
	"url": "...",
	"unit": "...",
	"recordType": "..."
 }
}
```
* `orderId`: order identifier.
* `productId`: product identifier.
* `customer`: customer id.
* `url`: base url of the service.
* `unit`: accounting unit (`megabyte`, `call`, ...).
* `recordType`: type of accounting.

### POST .../deleteBuy

Used by the store to notify a deleted buy. If the accounting proxy has been started over HTTPS, these requests should be signed with the Store cert; otherwise, they will be rejected.
```json
{
 "orderId": "...",
 "productId": "...",
 "customer": "...",
 "productSpecification": {
     "url": "..."
 }
}
```
* `orderId`: order identifier.
* `productId`: product identifier.
* `customer`: customer id.
* `url`: base url of the service.

### POST .../urls

Used by the store to check if an URL is valid. This requests require the "authorization" header with a valid access token from the IdM and the user must be an administrator of the service. If the accounting proxy has been started over HTTPS, these requests should be signed with the Store cert; otherwise, they will be rejected.
```json
{
 "url": "..."
}
```

### GET .../keys

Retrieve the user's API_KEYs in a json. This requests require the "authorization" header with a valid access token from the IdM.

```json
[
	{
    	"apiKey": "...",
        "productId": "...",
        "orderId": "...",
        "url": "..."
    },
    {
    	"apiKey": "...",
        "productId": "...",
        "orderId": "...",
        "url": "..."
    }
]
```

### GET .../units

Retrieve the supported accounting units by the accounting proxy in a JSON. This requests require the "authorization" header with a valid access token from the IdM.
```json
{
	"units": ["..."]
}
```

## <a name="development"/> Development

### <a name="accountingmodule"/> Accounting module

Accounting modules in the *acc_modules* folder should be implemented following the next code:

```javascript
/** Accounting module for unit: XXXXXX */

var count = function (countInfo, callback) {
    // Code to do the accounting goes here
    // .....

    return callback(error, amount);
}

var getSpecification = function () {
	return specification;
}
```

The function `count` receives two parameters:
- `countInfo`: object with the following information:
```
{
	request: { // Request object used by the proxy to make the request to the service.
    	headers: {
        
        },
        body: {
        
        },
        ...
    
    },
    response: { // Response object received from the service.
    	headers: {
        
        },
        body: {
        
        },
        elapsedTime: , // Response time
        ...
    }
}
```
- `callback`: function, which is use to retrieve the accounting value or the error message. The function has 2 parameters:
  + `error`: string with a description of the error if there is one. Otherwise, `null`.
  + `ammount`: number with the amount to add to the accounting.

The function `getSpecification` should return a javascript object with the usage specification for the accounting unit according to the TMF635 usage management API ([TMF635 usage Management API](https://www.tmforum.org/resources/standard/tmf635-usage-management-api-rest-specification-r14-5-0/)).

Finally, add the name of the developed accounting module to the `config.modules` array in the `config.js` file (the accounting module name is the name of the file, e.g. `megabyte` and `megabyte.js`) and restart the Accounting Proxy.

### <a name="tests"/> Testing
To run tests type:
```
npm test
```
File `test/config_tests.js` contains the configuration for the integration tests:
* `databases`: defines databases used by integration tests. Possible options are: `redis` and `sql`.
* `redis_database`: by default integration tests use 15.
* `redis_host`: redis host for testing.
* `redis_port`: redis port for testing.
* `accounting_proxy_port`: port where the accounting proxy will run for testing.
* `test_endpoint_port`: port where the mock services will run for testing.

```
{
	databases: ['sql', 'redis'],
    redis_database: 15,
    redis_host: 'local_host',
    redis_port: 6379,
    
    accounting_proxy_port: 9010,
    
    test_endpoint_port: 9020
}
```

Test reporter generates a directory `./coverage` with all the coverage information (coverage reporter is generated by Istanbul) and a xunit.xml file in the root directory of the project.

## <a name="license"/> License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details.

---
Last updated: _21/02/2017

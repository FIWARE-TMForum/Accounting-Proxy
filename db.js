var sqlite = require('sqlite3').verbose(), // Debug enable
    TransactionDatabase = require('sqlite3-transactions').TransactionDatabase,
    config = require('./config'),
    async = require('async');

"use strict"

var db = new TransactionDatabase (
        new sqlite.Database(config.database.name, sqlite.OPEN_READWRITE | sqlite.OPEN_CREATE));


/*
* Initialize the database and creates the necessary tables.
*/
exports.init = function (callback) {

    async.series([
        function (callback) {
            db.run('PRAGMA foreign_keys = 1;', callback);
        },
        function (callback) {
            db.run('PRAGMA encoding = "UTF-8";', callback);
        },
        function (callback) {
            db.run('CREATE TABLE IF NOT EXISTS token ( \
                    token               TEXT, \
                    PRIMARY KEY (token) \
            )', callback);
        },
        function (callback) {
            db.run('CREATE TABLE IF NOT EXISTS units ( \
                    unit                TEXT, \
                    href                TEXT, \
                    PRIMARY KEY (unit) \
            )', callback);
        },
        function (callback) {
            db.run('CREATE TABLE IF NOT EXISTS services ( \
                    publicPath          TEXT, \
                    url                 TEXT, \
                    appId               TEXT, \
                    PRIMARY KEY (publicPath) \
            )', callback);
        },
        function (callback) {
            db.run('CREATE TABLE IF NOT EXISTS accounting ( \
                    apiKey              TEXT, \
                    publicPath          TEXT, \
                    orderId             TEXT, \
                    productId           TEXT, \
                    customer            TEXT, \
                    unit                TEXT, \
                    value               INT, \
                    recordType          TEXT, \
                    correlationNumber   TEXT, \
                    PRIMARY KEY (apiKey), \
                    FOREIGN KEY (publicPath) REFERENCES services (publicPath) ON DELETE CASCADE\
            )', callback);
        },
        function (callback) {
            db.run('CREATE TABLE IF NOT EXISTS subscriptions ( \
                    subscriptionId      TEXT, \
                    apiKey              TEXT, \
                    notificationUrl     TEXT, \
                    expires             TEXT, \
                    PRIMARY KEY (subscriptionId), \
                    FOREIGN KEY (apiKey) REFERENCES accounting (apiKey) ON DELETE CASCADE\
            )', callback);
        },
        function (callback) {
            db.run('CREATE TABLE IF NOT EXISTS admins ( \
                    idAdmin             TEXT, \
                    PRIMARY KEY (idAdmin)\
            )', callback);
        },
        function (callback) {
            db.run('CREATE TABLE IF NOT EXISTS administer ( \
                    idAdmin             TEXT, \
                    publicPath          TEXT, \
                    PRIMARY KEY (idAdmin, publicPath), \
                    FOREIGN KEY (publicPath) REFERENCES services (publicPath) ON DELETE CASCADE, \
                    FOREIGN KEY (idAdmin) REFERENCES admins (idAdmin) ON DELETE CASCADE\
            )', callback);
        }
    ], callback);
};

/**
 * Save the token to notify the WStore.
 */
exports.addToken = function (token, callback) {
    var error = 'Error adding the acces token "' + token + '" .';

    db.run('DELETE FROM token', function (err) {
        if (err) {
            return callback(error);
        } else {
            db.run('INSERT INTO token \
                VALUES ($token)',
                {
                    $token: token
                }, function (err) {
                    if (err) {  
                        return callback(error);
                    } else {
                        return callback(null);
                    }
                });
        }
    });
};

/**
 * Return the token to notify the WStore.
 */
exports.getToken = function (callback) {
    db.get('SELECT * \
            FROM token', 
        function (err, token) {
            if (err) {
                return callback('Error getting the access token.', null);
            } else if (!token) {
                return callback(null, null);
            } else {
                return callback(null, token.token);
            }
    });
};

/**
 * Bind the unit with the usage specification URL.
 *
 * @param {string}   unit     Accounting unit.
 * @param {string}   href     Usage specification URL.
 */
exports.addSpecificationRef = function (unit, href, callback) {
    db.run('INSERT OR REPLACE INTO units \
            VALUES ($unit, $href)', 
            {
                $unit: unit,
                $href: href
            }, function (err) {
                if (err) {
                    return callback('Error adding the href specification: "' + href + '" to unit "' + unit + '" .');
                } else {
                    return callback(null);
                }
    });
};

/**
 * Return the href binded to the specified. Otherwise return null.
 *
 * @param  {string}   unit     Accounting unit
 */
exports.getHref = function (unit, callback) {
    db.get('SELECT href \
            FROM units \
            WHERE $unit=unit' ,
            {
                $unit: unit
            }, function(err, href) {
                if (err) {
                    return callback('Error getting the href for unit "' + unit + '" .', null);
                } else if (!href) {
                    return callback(null, null);
                } else {
                    return callback(null, href.href);
                }
    });
};

/**
 * Map the publicPath with the endpoint url.
 *
 * @param  {string} publicPath      Service public path.
 * @param  {string} url             Endpoint url.
 */
exports.newService = function (publicPath, url, appId, callback) {
    db.run('INSERT OR REPLACE INTO services \
            VALUES ($path, $url, $appId)',
        {
            $path: publicPath,
            $url: url,
            $appId: appId
        }, function (err) {
            if (err) {
                return callback('Error in database adding the new service.');
            } else {
                return callback(null);
            }
    });
};

/**
 * Delete the service.
 *
 * @param  {string} publicPath      Service public path.
 */
exports.deleteService = function (publicPath, callback) {
    db.run('DELETE FROM services \
            WHERE publicPath=$path',
        {
            $path: publicPath
        }, function (err) {
        if (err) {
            return callback('Error in database deleting the service.');
        } else {
            return callback(null);
        }
    });
};

/**
 * Return the service, the public path and the endpoint url associated with the path-
 *
 * @param  {string} publicPath      Service public path.
 */
exports.getService = function (publicPath, callback) {
    db.get('SELECT url, appId \
            FROM services \
            WHERE publicPath=$path', {
                $path: publicPath
            }, function (err, service) {
                if (err) {
                    return callback('Error in database getting the service.', null);
                } else if (!service) {
                    return callback(null, null);
                } else {
                    return callback(null, service);
                }
    });
};

/**
 * Return all the registered services.
 */
exports.getAllServices = function (callback) {
    db.all('SELECT * \
            FROM services', function (err, services) {
                if (err) {
                    return callback('Error in database getting the services.', null);
                } else {
                    return callback(null, services);
                }
    });
};

/**
 * Return the appId associated with the specified service by its public path.
 *
 * @param  {string}   publicPath Service public path.
 */
exports.getAppId = function (publicPath, callback) {
    db.get('SELECT appId \
            FROM services \
            WHERE $publicPath=publicPath',
            {
                $publicPath: publicPath
            }, function (err, appId) {
                if (err) {
                    return callback('Error in database getting the appId.', null);
                } else if (!appId) {
                    return callback(null, null);
                } else {
                    return callback(null, appId.appId);
                }
    });
};

/**
 * Add a new administrator.
 *
 * @param {string}   idAdmin      Administrator user name.
 */
exports.addAdmin = function (idAdmin, callback) {
    db.run('INSERT OR REPLACE INTO admins \
            VALUES ($idAdmin)',
            {
                $idAdmin: idAdmin
            }, function (err) {
                if (err) {
                    return callback('Error in database adding admin: "' + idAdmin + '" .');
                } else {
                    return callback(null);
                }
    });
};

/**
 * Delete the specified administrator.
 *
 * @param  {string}   idAdmin  Administrator identifier.
 */
exports.deleteAdmin = function (idAdmin, callback) {
    db.run('DELETE FROM admins \
            WHERE $idAdmin=idAdmin',
            {
                $idAdmin: idAdmin
            }, function (err) {
                if (err) {
                    return callback('Error in database removing admin: "' + idAdmin + '" .');
                } else {
                    return callback(null);
                }
    });
};

/**
 * Bind the administrator to the service.
 *
 * @param  {string}   idAdmin    Administrator identifier.
 * @param  {string}   publicPath Service public path.
 */
exports.bindAdmin = function (idAdmin, publicPath, callback) {
    db.run('INSERT OR REPLACE INTO administer \
            VALUES ($idAdmin, $publicPath)',
            {
                $idAdmin: idAdmin,
                $publicPath: publicPath
            }, function (err) {
                if (err) {
                    return callback('Error in database binding the admin to the service.');
                } else {
                    return callback(null);
                }
    });
};

/**
 * Unbind the specified admin for the specified service by its public path.
 *
 * @param  {string}   admin      Administrator user name.
 * @param  {string}   publicPath Public path of the service.
 */
exports.unbindAdmin = function (idAdmin, publicPath, callback) {
    db.run('DELETE FROM administer \
            WHERE idAdmin=$idAdmin AND publicPath=$publicPath',
            {
                $idAdmin: idAdmin,
                $publicPath: publicPath
            }, function (err) {
                if (err) {
                    return callback('Error in database unbinding the administrator "' + idAdmin + '".');
                } else {
                    return callback(null);
                }
    });
};

/**
 * Return all the administrators for the service specified by its public path.
 *
 * @param  {string}   publicPath Public path of the service.
 */
exports.getAdmins = function (publicPath, callback) {
    db.all('SELECT idAdmin \
            FROM administer \
            WHERE $publicPath=publicPath',
            {
                $publicPath: publicPath
            }, function (err, admins) {
                if (err) {
                    return callback('Error in database getting the administrators.', null);
                } else {
                    async.map(admins, function(admin, taskCallback) {
                        taskCallback(null, admin.idAdmin)
                    }, callback);
                }
    });
};

/**
 * Return the endpoint url if the user is an administrator of the service; otherwise return null.
 *
 * @param  {string}   idAdmin    Administrator identifier.
 * @param  {string}   publicPath Public path of the service.
 */
exports.getAdminURL = function (idAdmin, publicPath, callback) {
    db.get('SELECT services.url \
            FROM administer, services \
            WHERE administer.publicPath=services.publicPath AND \
                administer.idAdmin=$idAdmin AND services.publicPath=$publicPath',
            {
                $idAdmin: idAdmin,
                $publicPath: publicPath
            }, function (err, result) {
                if (err) {
                    return callback('Error getting the admin url.', null);
                } else if (!result) {
                    return callback(null, null);
                } else {
                    return callback(null, result.url);
                }
    });
};

/**
 * Check if the publicPath passed as argument is associated with a service (return true) or not (return false).
 *
 * @param  {string} publicPath         Path to check.
 */
exports.checkPath = function (publicPath, callback) {
    db.get('SELECT * \
            FROM services \
            WHERE publicPath=$publicPath', {
                $publicPath: publicPath
            }, function (err, service) {
                if (err) {
                    return callback('Error checking the path.', false);
                } else if (!service) {
                    return callback(null, false);
                } else {
                    return callback(null, true);
                }
    });
};

/**
 * Add the new buy information to the database.
 *
 * @param  {object} buyInformation      Information received from the WStore.  
 */
exports.newBuy = function (buyInformation, callback) {
    db.run('INSERT OR REPLACE INTO accounting \
        VALUES ($apiKey, $publicPath, $orderId, $productId, $customer, $unit, $value, $recordType, $correlationNumber)',
        {
            $apiKey: buyInformation.apiKey,
            $publicPath: buyInformation.publicPath,
            $orderId: buyInformation.orderId,
            $productId: buyInformation.productId,
            $customer: buyInformation.customer,
            $unit: buyInformation.unit,
            $value: 0,
            $recordType: buyInformation.recordType,
            $correlationNumber: 0
        }, function (err) {
            if (err) {
                return callback('Error in database adding the new buy.');
            } else {
                return callback(null);
            }
        });
};

/**
 * Return the api-keys, productId and orderId associated with the user passed as argument.
 *
 * @param  {string}   user     Customer identifier.
 */
exports.getApiKeys = function (user, callback) {
    db.all('SELECT apiKey, productId, orderId \
            FROM accounting \
            WHERE customer=$user',
            {
                $user: user
            }, function (err, apiKeys) {
                if (err) {
                    return callback('Error in databse getting api-keys.', null);
                } else {
                    return callback(null, apiKeys);
                }
    });
};

/**
 * Check if the user is associated with the apiKey (return true) or not (return false).
 *
 * @param  {string} customer    User identifier.
 * @param  {string} apiKey      Identifies the product.
 */
exports.checkRequest = function (customer, apiKey, publicPath, callback) {
    db.get('SELECT customer \
            FROM accounting \
            WHERE apiKey=$apiKey AND publicPath=$publicPath',
            {
                $apiKey: apiKey,
                $publicPath: publicPath
            }, function (err, user) {
                if (err) {
                    return callback('Error in database checking the request.', false);
                } else if (!user) {
                    return callback(null, false);
                } else if (user.customer !== customer) {
                    return callback(null, false);
                } else {
                    return callback(null, true);
                }
    });
};

/**
 * Return the url, unit and publicPath associated with the apiKey passed as argument.
 *
 * @param  {string}   apiKey   Product identifier.
 */
exports.getAccountingInfo = function (apiKey, callback) {
    db.get('SELECT accounting.unit, services.url \
            FROM accounting , services \
            WHERE accounting.publicPath=services.publicPath AND apiKey=$apiKey', 
            {
                $apiKey: apiKey
            }, function (err, accountingInfo) {
                if (err) {
                    return callback('Error in database getting the accounting info.', null);
                } else if (!accountingInfo) {
                    return callback(null, null);
                } else {
                    return callback(null, accountingInfo);
                }
    });
};

/**
 * Return the necessary information to notify the WStore (accounting value).
 *
 */
exports.getNotificationInfo = function (callback) {
    db.all('SELECT apiKey, orderId, productId, customer, value, correlationNumber, recordType, unit \
            FROM accounting \
            WHERE value!=0', 
            function (err, notificationInfo) {
                if (err) {
                    return callback('Error in database getting the notification information.', null);
                } else if (notificationInfo.length === 0) {
                    return callback(null, null);
                } else {
                    return callback(null, notificationInfo);
                }
    });
};

/**
 * Add the amount passed as argument to the actual amount of the user
 *
 * @param  {string} apiKey      Idenfies the product.
 * @param  {float} amount       Amount to account.
 */
exports.makeAccounting = function (apiKey, amount, callback) {
    if (amount < 0) {
        return callback('The aomunt must be greater than 0.');
    } else {
        db.beginTransaction(function (err, transaction) {
            if (err) {
                return callback('Error making the accounting.');
            } else {
                transaction.run(
                    'UPDATE accounting \
                    SET value=value+$amount \
                    WHERE apiKey=$apiKey',
                    {
                        $apiKey: apiKey,
                        $amount: amount
                    }, function (err) {
                        if (err) {
                            transaction.rollback();
                            return callback('Error making the accounting.');
                        } else {
                            transaction.commit(function (err) {
                                if (err) {
                                    return callback('Error making the accounting.');    
                                } else {
                                    return callback(null);
                                }
                                
                            });
                        }
                });
            }
        });
    }
};

/**
 * Reset the accounting for the product identifies by the apiKey and increment the correlation number.
 *
 * @param  {string} apiKey      Idenfies the product.
 */
exports.resetAccounting = function (apiKey, callback) {
    db.beginTransaction(function (err, transaction) {
        if (err) {
            return callback('Error reseting the accounting.');
        } else {
            transaction.run(
                'UPDATE accounting \
                SET value=0, correlationNumber=correlationNumber+1 \
                WHERE apiKey=$apiKey',
                {
                    $apiKey: apiKey
                }, function (err) {
                    if (err) {
                        transaction.rollback();
                        return callback('Error reseting the accounting.');
                    } else {
                        transaction.commit(function (err) {
                            if (err) {
                                return callback('Error reseting the accounting.');
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
 * Add new Context Broker subscription (apiKey and notificationUrl associated).
 *
 * @param {string} apiKey           Identifies the product.
 * @param {string} subscriptionId   Identifies the subscription.
 * @param {string} notificationUrl  Url for notifies the user when receive new notifications.
 * @param {string} expires          Subscription expiration date (ISO8601).
 */
exports.addCBSubscription = function (apiKey, subscriptionId, notificationUrl, expires, callback) {
    db.run('INSERT OR REPLACE INTO subscriptions \
        VALUES ($subscriptionId, $apiKey, $notificationUrl, $expires)',
        {
            $subscriptionId: subscriptionId,
            $apiKey: apiKey,
            $notificationUrl: notificationUrl,
            $expires: expires
        }, function (err) {
            if (err) {
                return callback('Error in database adding the subscription "' + subscriptionId + '" .');
            } else {
                return callback(null);
            }
        });
};

/**
 * Return the apiKey and notification url associated with the subscriptionId.
 *
 * @param  {string} subscriptionId      Identifies the subscription.
 */
exports.getCBSubscription = function (subscriptionId, callback) {
    db.get('SELECT subscriptions.apiKey, subscriptions.notificationUrl, subscriptions.expires, accounting.unit \
            FROM subscriptions , accounting\
            WHERE subscriptions.apiKey=accounting.apiKey AND subscriptionId=$subscriptionId',
            {
                $subscriptionId: subscriptionId
            }, function (err, subscriptionInfo) {
                if (err) {
                    return callback('Error getting the subscription.', null);
                } else if (!subscriptionInfo) {
                    return callback(null, null);
                } else {
                    return callback(null, subscriptionInfo);
                }
    });
};

/**
 * Replace the notification URL with the URL passed as argument.
 *
 * @param  {String}   subscriptionId  Subscription identifier.
 * @param  {String}   notificationUrl New notification URL.
 */
exports.updateNotificationUrl = function (subscriptionId, notificationUrl, callback) {
    db.run('UPDATE subscriptions \
            SET notificationUrl=$notificationUrl \
            WHERE subscriptionId=$subscriptionId',
            {
                $subscriptionId: subscriptionId,
                $notificationUrl: notificationUrl
            }, function (err) {
                if (err) {
                    return callback('Error in database updating the notificationURL');
                } else {
                    return callback(null);
                }
    });
};

/**
 * Replace the expiration date with the new expiration date passed as argument.
 *
 * @param  {String}   subscriptionId  Subscription identifier.
 * @param  {String}   expires         New expiration date (ISO8601).
 */
exports.updateExpirationDate = function (subscriptionId, expires, callback) {
    db.run('UPDATE subscriptions \
            SET expires=$expires \
            WHERE subscriptionId=$subscriptionId',
            {
                $subscriptionId: subscriptionId,
                $expires: expires
            }, function (err) {
                if (err) {
                    return callback('Error in database updating the expiration date')
                } else {
                    return callback(null);
                }
    });
};

/**
 * Delete the subscription identified by the subscriptionId. 
 *
 * @param  {string} subscriptionId      Identifies the subscription.
 */
exports.deleteCBSubscription = function (subscriptionId, callback) {
    db.run('DELETE FROM subscriptions \
            WHERE subscriptionId=$subscriptionId',
            {
                $subscriptionId: subscriptionId
            }, function (err) {
                if (err) {
                    return callback('Error deleting the subscription "' + subscriptionId + '" .');
                } else {
                    return callback(null);
                }
    });
};
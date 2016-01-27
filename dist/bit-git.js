(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Client side uhttp
 */
(function (root, factory) {
    if (typeof module !== 'undefined') {
        module.exports = factory();
    } else {
        root.uhttp = factory(root);
    }
})(this, function () {

    'use strict';

    var thisWindow = window;

    /**
     * A basic cache that stores requests and responses. Supports timeouts as well
     * */
    function Cache(name, options) {
        this.name = name;
        this.data = {};
        if (!options) {
            options = {};
        }
        this.timeout = options.timeout || 0;
    }

    Cache.prototype.remove = function (key) {
        delete this.data[key];
    };
    Cache.prototype.clear = function () {
        this.data = {};
    };
    Cache.prototype.set = function (key, value, options) {
        this.data[key] = value;
        if (!options) {
            options = {};
        }
        if ((options.timeout || this.timeout) > 0) {
            var cache = this;
            setTimeout(function () {
                cache.remove(key);
            }, (options.timeout || this.timeout));
        }
    };
    Cache.prototype.get = function (key) {
        return this.data[key];
    };

    /**
     * The public factory that allows users to create their own caches (useful for manually manipulating cached data)
     */
    var CacheFactory = (function () {
        var instance = null;

        function init() {
            var caches = {__default: new Cache('__default')};
            return {
                get: function (key, options) {
                    if (caches[key]) {
                        return caches[key];
                    } else {
                        var newCache = new Cache(key, options);
                        caches[key] = newCache;
                        return newCache;
                    }
                }
            };
        }

        return {
            getFactory: function () {
                if (!instance) {
                    instance = init();
                }
                return instance;
            }
        };
    })();
    var thisCacheFactory = CacheFactory.getFactory();

    /**
     * Helper functions to determine request/response type
     */
    //Parse json responses
    function isObject(value) {
        return value !== null && typeof value === 'object';
    }

    function isString(value) {
        return value !== null && typeof value === 'string';
    }

    var toString = Object.prototype.toString;

    function isFile(obj) {
        return toString.call(obj) === '[object File]';
    }

    function isBlob(obj) {
        return toString.call(obj) === '[object Blob]';
    }

    function isFormData(obj) {
        return toString.call(obj) === '[object FormData]';
    }

    /**
     * Default transforming of requests and responses (can be overrided by setting individual request options or uhttp globalOptions)
     */
    function transformRequest(config) {
        return config;
    }

    function transformResponse(xhr) {
        return xhr;
    }

    function transformRequestData(d) {
        if (isObject(d) && !isFile(d) && !isBlob(d) && !isFormData(d)) {
            return JSON.stringify(d);
        } else {
            return d;
        }
    }

    function transformResponseData(req) {
        var result;
        var d = req.responseText;
        try {
            result = JSON.parse(d);
        } catch (e) {
            result = d;
        }
        return result;
    }

    /**
     * Check if url is same origin (see: https://github.com/angular/angular.js/blob/master/src/ng/urlUtils.js)
     * Used for XSRF Token handling
     */
    var urlParsingNode = document.createElement('a');

    function urlResolve(url) {
        var href = url;

        //documentMode is IE only property - (see: https://github.com/angular/angular.js/blob/master/src/Angular.js)
        var msie = document.documentMode;
        if (msie) {
            // Normalize before parse.  Refer Implementation Notes on why this is
            // done in two steps on IE.
            urlParsingNode.setAttribute('href', href);
            href = urlParsingNode.href;
        }

        urlParsingNode.setAttribute('href', href);

        // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
        return {
            href: urlParsingNode.href,
            protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
            host: urlParsingNode.host,
            search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
            hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
            hostname: urlParsingNode.hostname,
            port: urlParsingNode.port,
            pathname: (urlParsingNode.pathname.charAt(0) === '/') ? urlParsingNode.pathname : '/' + urlParsingNode.pathname
        };
    }

    var originUrl = urlResolve(thisWindow.location.href);

    function urlIsSameOrigin(requestUrl) {
        var parsed = (isString(requestUrl)) ? urlResolve(requestUrl) : requestUrl;
        return (parsed.protocol === originUrl.protocol &&
        parsed.host === originUrl.host);
    }

    /**
     * A function to get a cookie from the browser. Used when passing the XSRF-Cookie
     * Obtained from here: http://www.w3schools.com/js/js_cookies.asp
     * @param cname
     * @returns {string}
     */
    function getCookie(cname) {
        if (cname) {
            var name = cname + '=';
            var ca = document.cookie.split(';');
            for (var i = 0; i < ca.length; i++) {
                var c = ca[i];
                while (c.charAt(0) === ' ') {
                    c = c.substring(1);
                }
                if (c.indexOf(name) === 0) {
                    return c.substring(name.length, c.length);
                }
            }
            return '';
        } else {
            return document.cookie;
        }
    }

    /**
     * A function to set a cookie from the browser.
     * Obtained from here: http://www.w3schools.com/js/js_cookies.asp
     * @param cname
     * @param cvalue
     * @param exdays
     */
    function setCookie(cname, cvalue, exdays) {
        if (exdays) {
            var d = new Date();
            d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
            var expires = 'expires=' + d.toUTCString();
            document.cookie = cname + '=' + cvalue + '; ' + expires + '; path=/';
        } else {
            document.cookie = cname + '=' + cvalue + '; path=/';
        }
    }

    /**
     * Function to set cookie from a string (useful on server)
     * @param cookieString
     */
    function setCookieFromString(cookieString) {
        document.cookie = cookieString;
    }

    /**
     * A function to delete a cookie from the browser
     */
    function deleteCookie(name, path) {
        if(path) {
            document.cookie = name + '=; path=' + path + '; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        } else {
            document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        }
    }

    /**
     * Default options
     */
    var defaultOptions = {
        transformRequest: transformRequest,
        transformResponse: transformResponse,
        transformRequestData: transformRequestData,
        transformResponseData: transformResponseData,
        xsrfCookieName: 'XSRF-TOKEN',
        xsrfHeaderName: 'X-XSRF-TOKEN'
    };

    /**
     * Getters and Setters for global uhttp options (overwrites default options, can be overwritten by passing [,options] to individual requests
     */
    var globalOptions = {
        headers: {},
        timeout: 0,
        withCredentials: false
    };

    function setGlobalOptions(optionsObject) {
        globalOptions = optionsObject;
        if (!globalOptions.headers || !isObject(globalOptions.headers)) {
            globalOptions.headers = {};
        }
    }

    function getGlobalOptions() {
        return globalOptions;
    }

    /**
     * A function to merge header objects together (into a single dictionary that will be passed to setXHRHeaders)
     */
    function mergeHeaders(mergedHeaders, addHeaders) {
        for (var h in addHeaders) {
            if (addHeaders.hasOwnProperty(h)) {
                mergedHeaders[h] = addHeaders[h];
            }
        }
    }

    /**
     * A function to set headers on a xhr request object
     * @param request
     * @param headerObject
     */
    function setXHRHeaders(request, headerObject) {
        for (var h in headerObject) {
            if (headerObject.hasOwnProperty(h)) {
                request.setRequestHeader(h, headerObject[h]);
            }
        }
    }

    /**
     * Handle jsonp requests. See https://github.com/angular/angular.js/blob/master/src/ng/httpBackend.js
     * Also see: https://github.com/lhorie/mithril.js/blob/next/mithril.js
     * Returns Promise
     * @param url - the jsonp url
     * @param [options] - options supported: {timeout: int}
     */
    function jsonp(url) {

        var methods = {
            then: function () {
            },
            'catch': function () {
            },
            'finally': function () {
            }
        };

        var callbacks = {
            then: function (callback) {
                methods.then = callback;
                return callbacks;
            },
            'catch': function (callback) {
                methods['catch'] = callback;
                return callbacks;
            },
            'finally': function (callback) {
                methods['finally'] = callback;
                return callback;
            }
        };

        //Creating a callback function and a script element
        var callbackId = 'uhttp_callback_' + new Date().getTime() + '_' + Math.round(Math.random() * 1e16).toString(36);
        var script = document.createElement('script');

        //Success callback
        thisWindow[callbackId] = function (res) {
            script.parentNode.removeChild(script);
            thisWindow[callbackId] = undefined;
            script = null;
            callbackId = null;
            methods.then.call(methods, res);
            methods['finally'].call(methods, res);
            methods = null;
        };

        //Error callback
        script.onerror = function (e) {
            script.parentNode.removeChild(script);
            thisWindow[callbackId] = undefined;
            script = null;
            callbackId = null;
            methods['catch'].call(methods, e);
            methods['finally'].call(methods, e);
            methods = null;
        };

        //Find JSON_CALLBACK in url & replace w/ callbackId function
        script.src = url.replace('JSON_CALLBACK', callbackId);

        //Appending the script element to the document
        document.body.appendChild(script);

        return callbacks;
    }

    /**
     * Constant for JSON content
     * @type {string}
     */
    var JSON_CONTENT_TYPE_HEADER = 'application/json;charset=utf-8';

    /**
     * XHR Request Handling - returns Promise
     * @param type
     * @param url
     * @param [options]
     * @param data
     */
    function xhr(type, url, options, data) {
        if (!options) {
            options = {};
        }

        var methods = {
            first: function() {},
            then: function () {
            },
            'catch': function () {
            },
            'finally': function () {
            }
        };

        var callbacks = {
            first: function(callback) {
                methods.first = callback;
                return callbacks;
            },
            then: function (callback) {
                methods.then = callback;
                return callbacks;
            },
            'catch': function (callback) {
                methods['catch'] = callback;
                return callbacks;
            },
            'finally': function (callback) {
                methods['finally'] = callback;
                return callback;
            }
        };

        //Iterate headers and add to xhr
        //Order of precedence: Options, Global, Default
        var mergedHeaders = {};

        //Default headers set to reasonable defaults (cannot be modified by user - see globalOptions & options for mutable options)
        mergeHeaders(mergedHeaders, {'Accept': 'application/json, text/plain, */*'});
        if (type === 'POST' || type === 'PUT' || type === 'PATCH') {
            if (isObject(data) && !isFile(data) && !isBlob(data)) {
                if (!isFormData(data)) {
                    mergeHeaders(mergedHeaders, {'Content-Type': JSON_CONTENT_TYPE_HEADER});
                }
            }
        }

        mergeHeaders(mergedHeaders, globalOptions.headers);
        if (isObject(options.headers)) {
            mergeHeaders(mergedHeaders, options.headers);
        }

        //If same domain, set XSRF-Header to XSRF-Cookie
        if (urlIsSameOrigin(url)) {
            var xsrfHeader = {};
            var xsrfValue = getCookie((options.xsrfCookieName || globalOptions.xsrfCookieName || defaultOptions.xsrfCookieName));
            if (xsrfValue) {
                xsrfHeader[(options.xsrfHeaderName || globalOptions.xsrfHeaderName || defaultOptions.xsrfHeaderName)] = xsrfValue;
                mergeHeaders(mergedHeaders, xsrfHeader);
            }
        }

        //Merge options together: Order of precedence is same as headers: Options, Global, Default
        var mergedOptions = {
            timeout: (options.timeout || globalOptions.timeout),
            cache: (options.cache || globalOptions.cache),
            withCredentials: (options.withCredentials || globalOptions.withCredentials),
            progressHandler: (options.progressHandler || globalOptions.progressHandler),
            transformRequest: (options.transformRequest || globalOptions.transformRequest || defaultOptions.transformRequest),
            transformResponse: (options.transformResponse || globalOptions.transformResponse || defaultOptions.transformResponse),
            transformRequestData: (options.transformRequestData || globalOptions.transformRequestData || defaultOptions.transformRequestData),
            transformResponseData: (options.transformResponseData || globalOptions.transformResponseData || defaultOptions.transformResponseData)
        };

        //A config object that can be modified by the user via a transformRequest function (globally or per request)
        //Note that no xhr request has been created yet
        var config = {
            headers: mergedHeaders,
            options: mergedOptions,
            type: type,
            url: url
        };

        mergedOptions.transformRequest(config);

        var cache = config.options.cache;
        if (config.type === 'GET' && cache) {
            var parsedResponse;
            if (typeof cache === 'boolean') {
                parsedResponse = thisCacheFactory.get('__default').get(url);
            } else {
                if (cache.constructor.name === 'Cache') {
                    parsedResponse = cache.get(url);
                } else {
                    parsedResponse = cache.cache.get(url);
                }
            }
            if (parsedResponse) {
                //Need to have a timeout in order to return then go to callback. I think that setIntermediate is supposed to solve this problem
                //Note that apparently real promises have a similar issue
                setTimeout(function () {
                    methods.first.call(methods, parsedResponse);
                    methods.then.call(methods, parsedResponse);
                }, 1);
                return callbacks;
            }
        }

        //Create XHR request
        var XHR = thisWindow.XMLHttpRequest || ActiveXObject;
        var request = new XHR('MSXML2.XMLHTTP.3.0');

        //Set progress handler (must be done before calling request.open)
        if (config.options.progressHandler && request.upload) {
            request.upload.onprogress = config.options.progressHandler;
        }

        request.open(config.type, config.url, true);

        //Set headers (must be done after request.open)
        setXHRHeaders(request, config.headers);

        //Set withCredentials option
        if (config.options.withCredentials) {
            request.withCredentials = true;
        }

        //The event listener for when the xhr request changes state (readyState = 4 means completed - either successfully or w/ an error)
        request.onreadystatechange = function () {
            if (request.readyState === 4) {
                config.options.transformResponse(request);
                var parsedResponse = config.options.transformResponseData(request);
                if ((request.status >= 200 && request.status < 300) || request.status === 304) {
                    if (type === 'GET' && cache) {
                        if (typeof cache === 'boolean') {
                            thisCacheFactory.get('__default').set(url, parsedResponse);
                        } else {
                            if (cache.constructor.name === 'Cache') {
                                cache.set(url, parsedResponse);
                            } else {
                                cache.cache.set(url, parsedResponse, cache.options);
                            }
                        }
                    }
                    methods.first.call(methods, parsedResponse, request.status, request);
                    methods.then.call(methods, parsedResponse, request.status, request);
                } else {
                    methods['catch'].call(methods, parsedResponse, request.status, request);
                }
                methods['finally'].call(methods, parsedResponse, request.status, request);
                config = null;
                methods = null;
                request = null;
                parsedResponse = null;
            }
        };

        //Send any data (only valid for POST, PUT, PATCH)
        request.send(config.options.transformRequestData(data));

        //Timeout handling (abort request after timeout time in milliseconds)
        if (config.options.timeout > 0) {
            setTimeout(function () {
                if (request) {
                    request.abort();
                }
            }, config.options.timeout);
        }

        return callbacks;
    }

    /**
     * Executes requests in parallel and returns responses in a single then.catch clause
     * @param requestArray
     * @param callback
     */
    function parallel(requestArray, callback) {
        var doneCounter = 0;
        var responseArray = [];
        var errArray = null;
        var l = requestArray.length;

        function closure(index, request) {
            request.then(function(res) {
                responseArray[index] = res;
                doneCounter++;

                if(doneCounter === l) {
                    callback(errArray, responseArray);
                }
            }).catch(function(err) {
                responseArray[index] = null;
                if(!errArray) {
                    errArray = [err];
                } else {
                    errArray.push(err);
                }
                doneCounter++;

                if(doneCounter === l) {
                    callback(errArray, responseArray);
                }
            });
        }

        for(var i = 0; i < l; i++) {
            var req = requestArray[i];
            responseArray.push(null);
            closure(i, req);
        }

    }

    /**
     * Executes requests in parallel but does not require that all requests complete successfully, returnArray in callback is an object that has a state which tells whether the request was fulfilled or rejected
     * @param requestArray
     * @param callback
     */
    function settle(requestArray, callback) {
        var doneCounter = 0;
        var responseArray = [];
        var l = requestArray.length;

        function closure(index, request) {
            request.then(function(res) {
                responseArray[index] = {state: 'fulfilled', res: res, err: null};
                doneCounter++;

                if(doneCounter === l) {
                    callback(responseArray);
                }
            }).catch(function(err) {
                responseArray[index] = {state: 'rejected', res: null, err: err};
                doneCounter++;

                if(doneCounter === l) {
                    callback(responseArray);
                }
            });
        }

        for(var i = 0; i < l; i++) {
            var req = requestArray[i];
            responseArray.push(null);
            closure(i, req);
        }
    }

    /**
     * Exporting public functions to user
     */
    var exports = {};

    //Getter/Setter for Global options (across all uhttp requests on a single page)
    exports.setGlobalOptions = setGlobalOptions;
    exports.getGlobalOptions = getGlobalOptions;

    //Export CacheFactory to allow user more control over caches
    exports.CacheFactory = thisCacheFactory;

    //Export get/setCookie because they are helper functions used by uhttp and could be useful for a user
    exports.getCookie = getCookie;
    exports.setCookie = setCookie;
    exports.setCookieFromString = setCookieFromString;
    exports.deleteCookie = deleteCookie;

    //Export parallel and settle helper functions
    exports.parallel = parallel;
    exports.settle = settle;

    //Export actual ajax request methods
    exports.get = function (src, options) {
        return xhr('GET', src, options);
    };

    exports.head = function (src, options) {
        return xhr('HEAD', src, options);
    };

    exports.put = function (src, options, data) {
        if (!data) {
            data = options;
            options = null;
        }
        return xhr('PUT', src, options, data);
    };

    exports.patch = function (src, options, data) {
        if (!data) {
            data = options;
            options = null;
        }
        return xhr('PATCH', src, options, data);
    };

    exports.post = function (src, options, data) {
        if (!data) {
            data = options;
            options = null;
        }
        return xhr('POST', src, options, data);
    };

    exports['delete'] = function (src, options) {
        return xhr('DELETE', src, options);
    };

    //Jsonp method is unique from the rest (doesn't use xhr, creates a script element)
    exports.jsonp = function (src) {
        return jsonp(src);
    };

    return exports;
});
},{}],2:[function(require,module,exports){
/*!
 *
 * bit-get 1.0.0
 *
 */

( function( window, factory ) {
  'use strict';
  // universal module definition

  if ( typeof define == 'function' && define.amd ) {
    // AMD
    define( [
        '../node_modules/uhttp/src/uhttp',
      ],
      function( uhttp ) {
        return factory( window, uhttp );
      });
  } else if ( typeof exports == 'object' ) {
    // CommonJS
    module.exports = factory(
      window,
      require('../node_modules/uhttp/src/uhttp')
    );
  } else {
    // browser global
    window.bitGet = factory(
      window,
      window.uhttp
    );
  }

}( window, function factory( window, uhttp ) {

'use strict';

// -------------------------- vars -------------------------- //
var searchUrl = "//api.bandsintown.com/events/search?";

// -------------------------- helpers -------------------------- //
  //the protected parameters set
  //these are always added to the query string
  var protectedParams = {
    "api_version":"2.0",
      //default 2.0
      //REQUIRED cannot be changed
    "format":"json",
      //REQUIRED cannot be changed
      //default JSON_CALLBACK
    "callback":"JSON_CALLBACK"
      //REQUIRED cannot be changed
      //default JSON_CALLBACK
  }

  //allowedParams that a user may decide to set
  //we remove any other params
  var allowedParams = [
    "app_id",
      //REQUIRED - the app_id default empty string
    "artists",
      //REQUIRED - default empty array
    "per_page",
      //default 50
    "page",
      //default 1
    "date",
      //yyyy-mm-dd
      //yyyy-mm-dd,yyyy-mm-dd (inclusive range)
      //upcoming
      //all
    "location",
      //default is empty - not sent
      //city,state (US or CA)
      //city,country
      //lat,lon
      //ip address
      //use_geoip (will use the ip the request came from)
    "radius",
      //default 50
      //max 150
  ];

  //the default parameter set that is used for making api requests.
  //these values can be set, updated, unset
  var defaultParams = {
    "app_id":"",
    "artists":[]
  }

  //The actual parameter set used
  //Created with buildParams
  var params = {};

  //set a group of parameters
  function setParams( obj ){
    for( var key in obj ){
      defaultParams[key] = obj[key];
    }
    mergeParams();
  }

  //set a single parameter
  //useful for setting things like location & radius
  function setParam( key, value ){
    defaultParams[key] = value;
    mergeParams();
  }

  //unset a param if it is set
  function unsetParam( key ){
    if( defaultParams.hasOwnProperty(key) ){
      delete defaultParams[key];
    }
  }

  // Utility method to extend properties of an object
  function extendProperties( source, properties ) {
    for (var property in properties) {
      if (properties.hasOwnProperty(property)) {
        source[property] = properties[property];
      }
    }
    return source;
  }

  //merge defaults and protected parameters
  //called after params are updated or set
  function mergeParams(){
    params = extendProperties( defaultParams, protectedParams );
  }

  //serialize the param string
  //checking for arrays
  function serialize( obj ) {
    var str = [];
    for(var p in obj)
      if (obj.hasOwnProperty(p)) {
        //if the value is an array
        //create a string with values like //key[]=value
        if( {}.toString.call( obj[p] ) === "[object Array]"){
          for(var i in obj[p] ){
            str.push(p + "[]=" + obj[p][i]);
          }
        }else if ( p === "artists" ) {
          str.push(p + "[]=" + obj[p]);
        }else{
          str.push(p + "=" + obj[p]);
        }
      }
    return str.join("&");
  }

  //make the call for events from the api
  //return the appropriate callback or errorback
  function getEvents( callback, errorback ){
    var url = searchUrl + serialize( params );

    bitGet.uhttp.jsonp(url)
      .then( function(res){
        if( res.errors === undefined )
          return callback(res);

        console.log("getEvents Errors: " + res.errors);
        return errorback(res);

      }).catch(function(err){
        console.log( "getEvents failed!" );
        console.log( err );
      });
  }

// -------------------------- bitGet Definition -------------------------- //
  var bitGet = {};

  //give it it's own instance of uhttp for making requests
  bitGet.uhttp = uhttp;

  bitGet.getEvents = function( callback, errorback ){
    return getEvents( callback, errorback );
  };

  bitGet.setParams = function( obj ){
    return setParams( obj );
  }

  bitGet.setParam = function( key, value ){
    return setParam( key, value );
  }

  bitGet.getParams = function(){
    return defaultParams;
  }

  bitGet.unsetParam = function( key ){
    return unsetParam( key );
  }

  return bitGet;

}));

},{"../node_modules/uhttp/src/uhttp":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvdWh0dHAvc3JjL3VodHRwLmpzIiwic3JjL2JpdC1nZXQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcHJCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBDbGllbnQgc2lkZSB1aHR0cFxuICovXG4oZnVuY3Rpb24gKHJvb3QsIGZhY3RvcnkpIHtcbiAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcm9vdC51aHR0cCA9IGZhY3Rvcnkocm9vdCk7XG4gICAgfVxufSkodGhpcywgZnVuY3Rpb24gKCkge1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHRoaXNXaW5kb3cgPSB3aW5kb3c7XG5cbiAgICAvKipcbiAgICAgKiBBIGJhc2ljIGNhY2hlIHRoYXQgc3RvcmVzIHJlcXVlc3RzIGFuZCByZXNwb25zZXMuIFN1cHBvcnRzIHRpbWVvdXRzIGFzIHdlbGxcbiAgICAgKiAqL1xuICAgIGZ1bmN0aW9uIENhY2hlKG5hbWUsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgICAgdGhpcy5kYXRhID0ge307XG4gICAgICAgIGlmICghb3B0aW9ucykge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGltZW91dCA9IG9wdGlvbnMudGltZW91dCB8fCAwO1xuICAgIH1cblxuICAgIENhY2hlLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmRhdGFba2V5XTtcbiAgICB9O1xuICAgIENhY2hlLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5kYXRhID0ge307XG4gICAgfTtcbiAgICBDYWNoZS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5kYXRhW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgaWYgKCFvcHRpb25zKSB7XG4gICAgICAgICAgICBvcHRpb25zID0ge307XG4gICAgICAgIH1cbiAgICAgICAgaWYgKChvcHRpb25zLnRpbWVvdXQgfHwgdGhpcy50aW1lb3V0KSA+IDApIHtcbiAgICAgICAgICAgIHZhciBjYWNoZSA9IHRoaXM7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBjYWNoZS5yZW1vdmUoa2V5KTtcbiAgICAgICAgICAgIH0sIChvcHRpb25zLnRpbWVvdXQgfHwgdGhpcy50aW1lb3V0KSk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIENhY2hlLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFba2V5XTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGhlIHB1YmxpYyBmYWN0b3J5IHRoYXQgYWxsb3dzIHVzZXJzIHRvIGNyZWF0ZSB0aGVpciBvd24gY2FjaGVzICh1c2VmdWwgZm9yIG1hbnVhbGx5IG1hbmlwdWxhdGluZyBjYWNoZWQgZGF0YSlcbiAgICAgKi9cbiAgICB2YXIgQ2FjaGVGYWN0b3J5ID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGluc3RhbmNlID0gbnVsbDtcblxuICAgICAgICBmdW5jdGlvbiBpbml0KCkge1xuICAgICAgICAgICAgdmFyIGNhY2hlcyA9IHtfX2RlZmF1bHQ6IG5ldyBDYWNoZSgnX19kZWZhdWx0Jyl9O1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uIChrZXksIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhY2hlc1trZXldKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FjaGVzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3Q2FjaGUgPSBuZXcgQ2FjaGUoa2V5LCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlc1trZXldID0gbmV3Q2FjaGU7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3Q2FjaGU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGdldEZhY3Rvcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGluc3RhbmNlID0gaW5pdCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfSkoKTtcbiAgICB2YXIgdGhpc0NhY2hlRmFjdG9yeSA9IENhY2hlRmFjdG9yeS5nZXRGYWN0b3J5KCk7XG5cbiAgICAvKipcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb25zIHRvIGRldGVybWluZSByZXF1ZXN0L3Jlc3BvbnNlIHR5cGVcbiAgICAgKi9cbiAgICAvL1BhcnNlIGpzb24gcmVzcG9uc2VzXG4gICAgZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICE9PSBudWxsICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNTdHJpbmcodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICE9PSBudWxsICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZyc7XG4gICAgfVxuXG4gICAgdmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuICAgIGZ1bmN0aW9uIGlzRmlsZShvYmopIHtcbiAgICAgICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgRmlsZV0nO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzQmxvYihvYmopIHtcbiAgICAgICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQmxvYl0nO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzRm9ybURhdGEob2JqKSB7XG4gICAgICAgIHJldHVybiB0b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEZvcm1EYXRhXSc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVmYXVsdCB0cmFuc2Zvcm1pbmcgb2YgcmVxdWVzdHMgYW5kIHJlc3BvbnNlcyAoY2FuIGJlIG92ZXJyaWRlZCBieSBzZXR0aW5nIGluZGl2aWR1YWwgcmVxdWVzdCBvcHRpb25zIG9yIHVodHRwIGdsb2JhbE9wdGlvbnMpXG4gICAgICovXG4gICAgZnVuY3Rpb24gdHJhbnNmb3JtUmVxdWVzdChjb25maWcpIHtcbiAgICAgICAgcmV0dXJuIGNvbmZpZztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0cmFuc2Zvcm1SZXNwb25zZSh4aHIpIHtcbiAgICAgICAgcmV0dXJuIHhocjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0cmFuc2Zvcm1SZXF1ZXN0RGF0YShkKSB7XG4gICAgICAgIGlmIChpc09iamVjdChkKSAmJiAhaXNGaWxlKGQpICYmICFpc0Jsb2IoZCkgJiYgIWlzRm9ybURhdGEoZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdHJhbnNmb3JtUmVzcG9uc2VEYXRhKHJlcSkge1xuICAgICAgICB2YXIgcmVzdWx0O1xuICAgICAgICB2YXIgZCA9IHJlcS5yZXNwb25zZVRleHQ7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXN1bHQgPSBKU09OLnBhcnNlKGQpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgdXJsIGlzIHNhbWUgb3JpZ2luIChzZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIuanMvYmxvYi9tYXN0ZXIvc3JjL25nL3VybFV0aWxzLmpzKVxuICAgICAqIFVzZWQgZm9yIFhTUkYgVG9rZW4gaGFuZGxpbmdcbiAgICAgKi9cbiAgICB2YXIgdXJsUGFyc2luZ05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG5cbiAgICBmdW5jdGlvbiB1cmxSZXNvbHZlKHVybCkge1xuICAgICAgICB2YXIgaHJlZiA9IHVybDtcblxuICAgICAgICAvL2RvY3VtZW50TW9kZSBpcyBJRSBvbmx5IHByb3BlcnR5IC0gKHNlZTogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci5qcy9ibG9iL21hc3Rlci9zcmMvQW5ndWxhci5qcylcbiAgICAgICAgdmFyIG1zaWUgPSBkb2N1bWVudC5kb2N1bWVudE1vZGU7XG4gICAgICAgIGlmIChtc2llKSB7XG4gICAgICAgICAgICAvLyBOb3JtYWxpemUgYmVmb3JlIHBhcnNlLiAgUmVmZXIgSW1wbGVtZW50YXRpb24gTm90ZXMgb24gd2h5IHRoaXMgaXNcbiAgICAgICAgICAgIC8vIGRvbmUgaW4gdHdvIHN0ZXBzIG9uIElFLlxuICAgICAgICAgICAgdXJsUGFyc2luZ05vZGUuc2V0QXR0cmlidXRlKCdocmVmJywgaHJlZik7XG4gICAgICAgICAgICBocmVmID0gdXJsUGFyc2luZ05vZGUuaHJlZjtcbiAgICAgICAgfVxuXG4gICAgICAgIHVybFBhcnNpbmdOb2RlLnNldEF0dHJpYnV0ZSgnaHJlZicsIGhyZWYpO1xuXG4gICAgICAgIC8vIHVybFBhcnNpbmdOb2RlIHByb3ZpZGVzIHRoZSBVcmxVdGlscyBpbnRlcmZhY2UgLSBodHRwOi8vdXJsLnNwZWMud2hhdHdnLm9yZy8jdXJsdXRpbHNcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGhyZWY6IHVybFBhcnNpbmdOb2RlLmhyZWYsXG4gICAgICAgICAgICBwcm90b2NvbDogdXJsUGFyc2luZ05vZGUucHJvdG9jb2wgPyB1cmxQYXJzaW5nTm9kZS5wcm90b2NvbC5yZXBsYWNlKC86JC8sICcnKSA6ICcnLFxuICAgICAgICAgICAgaG9zdDogdXJsUGFyc2luZ05vZGUuaG9zdCxcbiAgICAgICAgICAgIHNlYXJjaDogdXJsUGFyc2luZ05vZGUuc2VhcmNoID8gdXJsUGFyc2luZ05vZGUuc2VhcmNoLnJlcGxhY2UoL15cXD8vLCAnJykgOiAnJyxcbiAgICAgICAgICAgIGhhc2g6IHVybFBhcnNpbmdOb2RlLmhhc2ggPyB1cmxQYXJzaW5nTm9kZS5oYXNoLnJlcGxhY2UoL14jLywgJycpIDogJycsXG4gICAgICAgICAgICBob3N0bmFtZTogdXJsUGFyc2luZ05vZGUuaG9zdG5hbWUsXG4gICAgICAgICAgICBwb3J0OiB1cmxQYXJzaW5nTm9kZS5wb3J0LFxuICAgICAgICAgICAgcGF0aG5hbWU6ICh1cmxQYXJzaW5nTm9kZS5wYXRobmFtZS5jaGFyQXQoMCkgPT09ICcvJykgPyB1cmxQYXJzaW5nTm9kZS5wYXRobmFtZSA6ICcvJyArIHVybFBhcnNpbmdOb2RlLnBhdGhuYW1lXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIG9yaWdpblVybCA9IHVybFJlc29sdmUodGhpc1dpbmRvdy5sb2NhdGlvbi5ocmVmKTtcblxuICAgIGZ1bmN0aW9uIHVybElzU2FtZU9yaWdpbihyZXF1ZXN0VXJsKSB7XG4gICAgICAgIHZhciBwYXJzZWQgPSAoaXNTdHJpbmcocmVxdWVzdFVybCkpID8gdXJsUmVzb2x2ZShyZXF1ZXN0VXJsKSA6IHJlcXVlc3RVcmw7XG4gICAgICAgIHJldHVybiAocGFyc2VkLnByb3RvY29sID09PSBvcmlnaW5VcmwucHJvdG9jb2wgJiZcbiAgICAgICAgcGFyc2VkLmhvc3QgPT09IG9yaWdpblVybC5ob3N0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGZ1bmN0aW9uIHRvIGdldCBhIGNvb2tpZSBmcm9tIHRoZSBicm93c2VyLiBVc2VkIHdoZW4gcGFzc2luZyB0aGUgWFNSRi1Db29raWVcbiAgICAgKiBPYnRhaW5lZCBmcm9tIGhlcmU6IGh0dHA6Ly93d3cudzNzY2hvb2xzLmNvbS9qcy9qc19jb29raWVzLmFzcFxuICAgICAqIEBwYXJhbSBjbmFtZVxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2V0Q29va2llKGNuYW1lKSB7XG4gICAgICAgIGlmIChjbmFtZSkge1xuICAgICAgICAgICAgdmFyIG5hbWUgPSBjbmFtZSArICc9JztcbiAgICAgICAgICAgIHZhciBjYSA9IGRvY3VtZW50LmNvb2tpZS5zcGxpdCgnOycpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBjID0gY2FbaV07XG4gICAgICAgICAgICAgICAgd2hpbGUgKGMuY2hhckF0KDApID09PSAnICcpIHtcbiAgICAgICAgICAgICAgICAgICAgYyA9IGMuc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoYy5pbmRleE9mKG5hbWUpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjLnN1YnN0cmluZyhuYW1lLmxlbmd0aCwgYy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBkb2N1bWVudC5jb29raWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGZ1bmN0aW9uIHRvIHNldCBhIGNvb2tpZSBmcm9tIHRoZSBicm93c2VyLlxuICAgICAqIE9idGFpbmVkIGZyb20gaGVyZTogaHR0cDovL3d3dy53M3NjaG9vbHMuY29tL2pzL2pzX2Nvb2tpZXMuYXNwXG4gICAgICogQHBhcmFtIGNuYW1lXG4gICAgICogQHBhcmFtIGN2YWx1ZVxuICAgICAqIEBwYXJhbSBleGRheXNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBzZXRDb29raWUoY25hbWUsIGN2YWx1ZSwgZXhkYXlzKSB7XG4gICAgICAgIGlmIChleGRheXMpIHtcbiAgICAgICAgICAgIHZhciBkID0gbmV3IERhdGUoKTtcbiAgICAgICAgICAgIGQuc2V0VGltZShkLmdldFRpbWUoKSArIChleGRheXMgKiAyNCAqIDYwICogNjAgKiAxMDAwKSk7XG4gICAgICAgICAgICB2YXIgZXhwaXJlcyA9ICdleHBpcmVzPScgKyBkLnRvVVRDU3RyaW5nKCk7XG4gICAgICAgICAgICBkb2N1bWVudC5jb29raWUgPSBjbmFtZSArICc9JyArIGN2YWx1ZSArICc7ICcgKyBleHBpcmVzICsgJzsgcGF0aD0vJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmNvb2tpZSA9IGNuYW1lICsgJz0nICsgY3ZhbHVlICsgJzsgcGF0aD0vJztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZ1bmN0aW9uIHRvIHNldCBjb29raWUgZnJvbSBhIHN0cmluZyAodXNlZnVsIG9uIHNlcnZlcilcbiAgICAgKiBAcGFyYW0gY29va2llU3RyaW5nXG4gICAgICovXG4gICAgZnVuY3Rpb24gc2V0Q29va2llRnJvbVN0cmluZyhjb29raWVTdHJpbmcpIHtcbiAgICAgICAgZG9jdW1lbnQuY29va2llID0gY29va2llU3RyaW5nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZnVuY3Rpb24gdG8gZGVsZXRlIGEgY29va2llIGZyb20gdGhlIGJyb3dzZXJcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBkZWxldGVDb29raWUobmFtZSwgcGF0aCkge1xuICAgICAgICBpZihwYXRoKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5jb29raWUgPSBuYW1lICsgJz07IHBhdGg9JyArIHBhdGggKyAnOyBleHBpcmVzPVRodSwgMDEgSmFuIDE5NzAgMDA6MDA6MDEgR01UOyc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkb2N1bWVudC5jb29raWUgPSBuYW1lICsgJz07IGV4cGlyZXM9VGh1LCAwMSBKYW4gMTk3MCAwMDowMDowMSBHTVQ7JztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlZmF1bHQgb3B0aW9uc1xuICAgICAqL1xuICAgIHZhciBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgICAgdHJhbnNmb3JtUmVxdWVzdDogdHJhbnNmb3JtUmVxdWVzdCxcbiAgICAgICAgdHJhbnNmb3JtUmVzcG9uc2U6IHRyYW5zZm9ybVJlc3BvbnNlLFxuICAgICAgICB0cmFuc2Zvcm1SZXF1ZXN0RGF0YTogdHJhbnNmb3JtUmVxdWVzdERhdGEsXG4gICAgICAgIHRyYW5zZm9ybVJlc3BvbnNlRGF0YTogdHJhbnNmb3JtUmVzcG9uc2VEYXRhLFxuICAgICAgICB4c3JmQ29va2llTmFtZTogJ1hTUkYtVE9LRU4nLFxuICAgICAgICB4c3JmSGVhZGVyTmFtZTogJ1gtWFNSRi1UT0tFTidcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogR2V0dGVycyBhbmQgU2V0dGVycyBmb3IgZ2xvYmFsIHVodHRwIG9wdGlvbnMgKG92ZXJ3cml0ZXMgZGVmYXVsdCBvcHRpb25zLCBjYW4gYmUgb3ZlcndyaXR0ZW4gYnkgcGFzc2luZyBbLG9wdGlvbnNdIHRvIGluZGl2aWR1YWwgcmVxdWVzdHNcbiAgICAgKi9cbiAgICB2YXIgZ2xvYmFsT3B0aW9ucyA9IHtcbiAgICAgICAgaGVhZGVyczoge30sXG4gICAgICAgIHRpbWVvdXQ6IDAsXG4gICAgICAgIHdpdGhDcmVkZW50aWFsczogZmFsc2VcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gc2V0R2xvYmFsT3B0aW9ucyhvcHRpb25zT2JqZWN0KSB7XG4gICAgICAgIGdsb2JhbE9wdGlvbnMgPSBvcHRpb25zT2JqZWN0O1xuICAgICAgICBpZiAoIWdsb2JhbE9wdGlvbnMuaGVhZGVycyB8fCAhaXNPYmplY3QoZ2xvYmFsT3B0aW9ucy5oZWFkZXJzKSkge1xuICAgICAgICAgICAgZ2xvYmFsT3B0aW9ucy5oZWFkZXJzID0ge307XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRHbG9iYWxPcHRpb25zKCkge1xuICAgICAgICByZXR1cm4gZ2xvYmFsT3B0aW9ucztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGZ1bmN0aW9uIHRvIG1lcmdlIGhlYWRlciBvYmplY3RzIHRvZ2V0aGVyIChpbnRvIGEgc2luZ2xlIGRpY3Rpb25hcnkgdGhhdCB3aWxsIGJlIHBhc3NlZCB0byBzZXRYSFJIZWFkZXJzKVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIG1lcmdlSGVhZGVycyhtZXJnZWRIZWFkZXJzLCBhZGRIZWFkZXJzKSB7XG4gICAgICAgIGZvciAodmFyIGggaW4gYWRkSGVhZGVycykge1xuICAgICAgICAgICAgaWYgKGFkZEhlYWRlcnMuaGFzT3duUHJvcGVydHkoaCkpIHtcbiAgICAgICAgICAgICAgICBtZXJnZWRIZWFkZXJzW2hdID0gYWRkSGVhZGVyc1toXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZnVuY3Rpb24gdG8gc2V0IGhlYWRlcnMgb24gYSB4aHIgcmVxdWVzdCBvYmplY3RcbiAgICAgKiBAcGFyYW0gcmVxdWVzdFxuICAgICAqIEBwYXJhbSBoZWFkZXJPYmplY3RcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBzZXRYSFJIZWFkZXJzKHJlcXVlc3QsIGhlYWRlck9iamVjdCkge1xuICAgICAgICBmb3IgKHZhciBoIGluIGhlYWRlck9iamVjdCkge1xuICAgICAgICAgICAgaWYgKGhlYWRlck9iamVjdC5oYXNPd25Qcm9wZXJ0eShoKSkge1xuICAgICAgICAgICAgICAgIHJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcihoLCBoZWFkZXJPYmplY3RbaF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGFuZGxlIGpzb25wIHJlcXVlc3RzLiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci5qcy9ibG9iL21hc3Rlci9zcmMvbmcvaHR0cEJhY2tlbmQuanNcbiAgICAgKiBBbHNvIHNlZTogaHR0cHM6Ly9naXRodWIuY29tL2xob3JpZS9taXRocmlsLmpzL2Jsb2IvbmV4dC9taXRocmlsLmpzXG4gICAgICogUmV0dXJucyBQcm9taXNlXG4gICAgICogQHBhcmFtIHVybCAtIHRoZSBqc29ucCB1cmxcbiAgICAgKiBAcGFyYW0gW29wdGlvbnNdIC0gb3B0aW9ucyBzdXBwb3J0ZWQ6IHt0aW1lb3V0OiBpbnR9XG4gICAgICovXG4gICAgZnVuY3Rpb24ganNvbnAodXJsKSB7XG5cbiAgICAgICAgdmFyIG1ldGhvZHMgPSB7XG4gICAgICAgICAgICB0aGVuOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJ2NhdGNoJzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICdmaW5hbGx5JzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBjYWxsYmFja3MgPSB7XG4gICAgICAgICAgICB0aGVuOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBtZXRob2RzLnRoZW4gPSBjYWxsYmFjaztcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2tzO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICdjYXRjaCc6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIG1ldGhvZHNbJ2NhdGNoJ10gPSBjYWxsYmFjaztcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2tzO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICdmaW5hbGx5JzogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgbWV0aG9kc1snZmluYWxseSddID0gY2FsbGJhY2s7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vQ3JlYXRpbmcgYSBjYWxsYmFjayBmdW5jdGlvbiBhbmQgYSBzY3JpcHQgZWxlbWVudFxuICAgICAgICB2YXIgY2FsbGJhY2tJZCA9ICd1aHR0cF9jYWxsYmFja18nICsgbmV3IERhdGUoKS5nZXRUaW1lKCkgKyAnXycgKyBNYXRoLnJvdW5kKE1hdGgucmFuZG9tKCkgKiAxZTE2KS50b1N0cmluZygzNik7XG4gICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcblxuICAgICAgICAvL1N1Y2Nlc3MgY2FsbGJhY2tcbiAgICAgICAgdGhpc1dpbmRvd1tjYWxsYmFja0lkXSA9IGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgICAgIHNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdCk7XG4gICAgICAgICAgICB0aGlzV2luZG93W2NhbGxiYWNrSWRdID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgc2NyaXB0ID0gbnVsbDtcbiAgICAgICAgICAgIGNhbGxiYWNrSWQgPSBudWxsO1xuICAgICAgICAgICAgbWV0aG9kcy50aGVuLmNhbGwobWV0aG9kcywgcmVzKTtcbiAgICAgICAgICAgIG1ldGhvZHNbJ2ZpbmFsbHknXS5jYWxsKG1ldGhvZHMsIHJlcyk7XG4gICAgICAgICAgICBtZXRob2RzID0gbnVsbDtcbiAgICAgICAgfTtcblxuICAgICAgICAvL0Vycm9yIGNhbGxiYWNrXG4gICAgICAgIHNjcmlwdC5vbmVycm9yID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIHNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdCk7XG4gICAgICAgICAgICB0aGlzV2luZG93W2NhbGxiYWNrSWRdID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgc2NyaXB0ID0gbnVsbDtcbiAgICAgICAgICAgIGNhbGxiYWNrSWQgPSBudWxsO1xuICAgICAgICAgICAgbWV0aG9kc1snY2F0Y2gnXS5jYWxsKG1ldGhvZHMsIGUpO1xuICAgICAgICAgICAgbWV0aG9kc1snZmluYWxseSddLmNhbGwobWV0aG9kcywgZSk7XG4gICAgICAgICAgICBtZXRob2RzID0gbnVsbDtcbiAgICAgICAgfTtcblxuICAgICAgICAvL0ZpbmQgSlNPTl9DQUxMQkFDSyBpbiB1cmwgJiByZXBsYWNlIHcvIGNhbGxiYWNrSWQgZnVuY3Rpb25cbiAgICAgICAgc2NyaXB0LnNyYyA9IHVybC5yZXBsYWNlKCdKU09OX0NBTExCQUNLJywgY2FsbGJhY2tJZCk7XG5cbiAgICAgICAgLy9BcHBlbmRpbmcgdGhlIHNjcmlwdCBlbGVtZW50IHRvIHRoZSBkb2N1bWVudFxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHNjcmlwdCk7XG5cbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25zdGFudCBmb3IgSlNPTiBjb250ZW50XG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICB2YXIgSlNPTl9DT05URU5UX1RZUEVfSEVBREVSID0gJ2FwcGxpY2F0aW9uL2pzb247Y2hhcnNldD11dGYtOCc7XG5cbiAgICAvKipcbiAgICAgKiBYSFIgUmVxdWVzdCBIYW5kbGluZyAtIHJldHVybnMgUHJvbWlzZVxuICAgICAqIEBwYXJhbSB0eXBlXG4gICAgICogQHBhcmFtIHVybFxuICAgICAqIEBwYXJhbSBbb3B0aW9uc11cbiAgICAgKiBAcGFyYW0gZGF0YVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHhocih0eXBlLCB1cmwsIG9wdGlvbnMsIGRhdGEpIHtcbiAgICAgICAgaWYgKCFvcHRpb25zKSB7XG4gICAgICAgICAgICBvcHRpb25zID0ge307XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbWV0aG9kcyA9IHtcbiAgICAgICAgICAgIGZpcnN0OiBmdW5jdGlvbigpIHt9LFxuICAgICAgICAgICAgdGhlbjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICdjYXRjaCc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnZmluYWxseSc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgY2FsbGJhY2tzID0ge1xuICAgICAgICAgICAgZmlyc3Q6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgbWV0aG9kcy5maXJzdCA9IGNhbGxiYWNrO1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFja3M7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGhlbjogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgbWV0aG9kcy50aGVuID0gY2FsbGJhY2s7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrcztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnY2F0Y2gnOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBtZXRob2RzWydjYXRjaCddID0gY2FsbGJhY2s7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrcztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnZmluYWxseSc6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIG1ldGhvZHNbJ2ZpbmFsbHknXSA9IGNhbGxiYWNrO1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICAvL0l0ZXJhdGUgaGVhZGVycyBhbmQgYWRkIHRvIHhoclxuICAgICAgICAvL09yZGVyIG9mIHByZWNlZGVuY2U6IE9wdGlvbnMsIEdsb2JhbCwgRGVmYXVsdFxuICAgICAgICB2YXIgbWVyZ2VkSGVhZGVycyA9IHt9O1xuXG4gICAgICAgIC8vRGVmYXVsdCBoZWFkZXJzIHNldCB0byByZWFzb25hYmxlIGRlZmF1bHRzIChjYW5ub3QgYmUgbW9kaWZpZWQgYnkgdXNlciAtIHNlZSBnbG9iYWxPcHRpb25zICYgb3B0aW9ucyBmb3IgbXV0YWJsZSBvcHRpb25zKVxuICAgICAgICBtZXJnZUhlYWRlcnMobWVyZ2VkSGVhZGVycywgeydBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbiwgdGV4dC9wbGFpbiwgKi8qJ30pO1xuICAgICAgICBpZiAodHlwZSA9PT0gJ1BPU1QnIHx8IHR5cGUgPT09ICdQVVQnIHx8IHR5cGUgPT09ICdQQVRDSCcpIHtcbiAgICAgICAgICAgIGlmIChpc09iamVjdChkYXRhKSAmJiAhaXNGaWxlKGRhdGEpICYmICFpc0Jsb2IoZGF0YSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzRm9ybURhdGEoZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVyZ2VIZWFkZXJzKG1lcmdlZEhlYWRlcnMsIHsnQ29udGVudC1UeXBlJzogSlNPTl9DT05URU5UX1RZUEVfSEVBREVSfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbWVyZ2VIZWFkZXJzKG1lcmdlZEhlYWRlcnMsIGdsb2JhbE9wdGlvbnMuaGVhZGVycyk7XG4gICAgICAgIGlmIChpc09iamVjdChvcHRpb25zLmhlYWRlcnMpKSB7XG4gICAgICAgICAgICBtZXJnZUhlYWRlcnMobWVyZ2VkSGVhZGVycywgb3B0aW9ucy5oZWFkZXJzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vSWYgc2FtZSBkb21haW4sIHNldCBYU1JGLUhlYWRlciB0byBYU1JGLUNvb2tpZVxuICAgICAgICBpZiAodXJsSXNTYW1lT3JpZ2luKHVybCkpIHtcbiAgICAgICAgICAgIHZhciB4c3JmSGVhZGVyID0ge307XG4gICAgICAgICAgICB2YXIgeHNyZlZhbHVlID0gZ2V0Q29va2llKChvcHRpb25zLnhzcmZDb29raWVOYW1lIHx8IGdsb2JhbE9wdGlvbnMueHNyZkNvb2tpZU5hbWUgfHwgZGVmYXVsdE9wdGlvbnMueHNyZkNvb2tpZU5hbWUpKTtcbiAgICAgICAgICAgIGlmICh4c3JmVmFsdWUpIHtcbiAgICAgICAgICAgICAgICB4c3JmSGVhZGVyWyhvcHRpb25zLnhzcmZIZWFkZXJOYW1lIHx8IGdsb2JhbE9wdGlvbnMueHNyZkhlYWRlck5hbWUgfHwgZGVmYXVsdE9wdGlvbnMueHNyZkhlYWRlck5hbWUpXSA9IHhzcmZWYWx1ZTtcbiAgICAgICAgICAgICAgICBtZXJnZUhlYWRlcnMobWVyZ2VkSGVhZGVycywgeHNyZkhlYWRlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvL01lcmdlIG9wdGlvbnMgdG9nZXRoZXI6IE9yZGVyIG9mIHByZWNlZGVuY2UgaXMgc2FtZSBhcyBoZWFkZXJzOiBPcHRpb25zLCBHbG9iYWwsIERlZmF1bHRcbiAgICAgICAgdmFyIG1lcmdlZE9wdGlvbnMgPSB7XG4gICAgICAgICAgICB0aW1lb3V0OiAob3B0aW9ucy50aW1lb3V0IHx8IGdsb2JhbE9wdGlvbnMudGltZW91dCksXG4gICAgICAgICAgICBjYWNoZTogKG9wdGlvbnMuY2FjaGUgfHwgZ2xvYmFsT3B0aW9ucy5jYWNoZSksXG4gICAgICAgICAgICB3aXRoQ3JlZGVudGlhbHM6IChvcHRpb25zLndpdGhDcmVkZW50aWFscyB8fCBnbG9iYWxPcHRpb25zLndpdGhDcmVkZW50aWFscyksXG4gICAgICAgICAgICBwcm9ncmVzc0hhbmRsZXI6IChvcHRpb25zLnByb2dyZXNzSGFuZGxlciB8fCBnbG9iYWxPcHRpb25zLnByb2dyZXNzSGFuZGxlciksXG4gICAgICAgICAgICB0cmFuc2Zvcm1SZXF1ZXN0OiAob3B0aW9ucy50cmFuc2Zvcm1SZXF1ZXN0IHx8IGdsb2JhbE9wdGlvbnMudHJhbnNmb3JtUmVxdWVzdCB8fCBkZWZhdWx0T3B0aW9ucy50cmFuc2Zvcm1SZXF1ZXN0KSxcbiAgICAgICAgICAgIHRyYW5zZm9ybVJlc3BvbnNlOiAob3B0aW9ucy50cmFuc2Zvcm1SZXNwb25zZSB8fCBnbG9iYWxPcHRpb25zLnRyYW5zZm9ybVJlc3BvbnNlIHx8IGRlZmF1bHRPcHRpb25zLnRyYW5zZm9ybVJlc3BvbnNlKSxcbiAgICAgICAgICAgIHRyYW5zZm9ybVJlcXVlc3REYXRhOiAob3B0aW9ucy50cmFuc2Zvcm1SZXF1ZXN0RGF0YSB8fCBnbG9iYWxPcHRpb25zLnRyYW5zZm9ybVJlcXVlc3REYXRhIHx8IGRlZmF1bHRPcHRpb25zLnRyYW5zZm9ybVJlcXVlc3REYXRhKSxcbiAgICAgICAgICAgIHRyYW5zZm9ybVJlc3BvbnNlRGF0YTogKG9wdGlvbnMudHJhbnNmb3JtUmVzcG9uc2VEYXRhIHx8IGdsb2JhbE9wdGlvbnMudHJhbnNmb3JtUmVzcG9uc2VEYXRhIHx8IGRlZmF1bHRPcHRpb25zLnRyYW5zZm9ybVJlc3BvbnNlRGF0YSlcbiAgICAgICAgfTtcblxuICAgICAgICAvL0EgY29uZmlnIG9iamVjdCB0aGF0IGNhbiBiZSBtb2RpZmllZCBieSB0aGUgdXNlciB2aWEgYSB0cmFuc2Zvcm1SZXF1ZXN0IGZ1bmN0aW9uIChnbG9iYWxseSBvciBwZXIgcmVxdWVzdClcbiAgICAgICAgLy9Ob3RlIHRoYXQgbm8geGhyIHJlcXVlc3QgaGFzIGJlZW4gY3JlYXRlZCB5ZXRcbiAgICAgICAgdmFyIGNvbmZpZyA9IHtcbiAgICAgICAgICAgIGhlYWRlcnM6IG1lcmdlZEhlYWRlcnMsXG4gICAgICAgICAgICBvcHRpb25zOiBtZXJnZWRPcHRpb25zLFxuICAgICAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAgICAgIHVybDogdXJsXG4gICAgICAgIH07XG5cbiAgICAgICAgbWVyZ2VkT3B0aW9ucy50cmFuc2Zvcm1SZXF1ZXN0KGNvbmZpZyk7XG5cbiAgICAgICAgdmFyIGNhY2hlID0gY29uZmlnLm9wdGlvbnMuY2FjaGU7XG4gICAgICAgIGlmIChjb25maWcudHlwZSA9PT0gJ0dFVCcgJiYgY2FjaGUpIHtcbiAgICAgICAgICAgIHZhciBwYXJzZWRSZXNwb25zZTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2FjaGUgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgICAgIHBhcnNlZFJlc3BvbnNlID0gdGhpc0NhY2hlRmFjdG9yeS5nZXQoJ19fZGVmYXVsdCcpLmdldCh1cmwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FjaGUuY29uc3RydWN0b3IubmFtZSA9PT0gJ0NhY2hlJykge1xuICAgICAgICAgICAgICAgICAgICBwYXJzZWRSZXNwb25zZSA9IGNhY2hlLmdldCh1cmwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcnNlZFJlc3BvbnNlID0gY2FjaGUuY2FjaGUuZ2V0KHVybCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHBhcnNlZFJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgLy9OZWVkIHRvIGhhdmUgYSB0aW1lb3V0IGluIG9yZGVyIHRvIHJldHVybiB0aGVuIGdvIHRvIGNhbGxiYWNrLiBJIHRoaW5rIHRoYXQgc2V0SW50ZXJtZWRpYXRlIGlzIHN1cHBvc2VkIHRvIHNvbHZlIHRoaXMgcHJvYmxlbVxuICAgICAgICAgICAgICAgIC8vTm90ZSB0aGF0IGFwcGFyZW50bHkgcmVhbCBwcm9taXNlcyBoYXZlIGEgc2ltaWxhciBpc3N1ZVxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2RzLmZpcnN0LmNhbGwobWV0aG9kcywgcGFyc2VkUmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICBtZXRob2RzLnRoZW4uY2FsbChtZXRob2RzLCBwYXJzZWRSZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgfSwgMSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vQ3JlYXRlIFhIUiByZXF1ZXN0XG4gICAgICAgIHZhciBYSFIgPSB0aGlzV2luZG93LlhNTEh0dHBSZXF1ZXN0IHx8IEFjdGl2ZVhPYmplY3Q7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IFhIUignTVNYTUwyLlhNTEhUVFAuMy4wJyk7XG5cbiAgICAgICAgLy9TZXQgcHJvZ3Jlc3MgaGFuZGxlciAobXVzdCBiZSBkb25lIGJlZm9yZSBjYWxsaW5nIHJlcXVlc3Qub3BlbilcbiAgICAgICAgaWYgKGNvbmZpZy5vcHRpb25zLnByb2dyZXNzSGFuZGxlciAmJiByZXF1ZXN0LnVwbG9hZCkge1xuICAgICAgICAgICAgcmVxdWVzdC51cGxvYWQub25wcm9ncmVzcyA9IGNvbmZpZy5vcHRpb25zLnByb2dyZXNzSGFuZGxlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcXVlc3Qub3Blbihjb25maWcudHlwZSwgY29uZmlnLnVybCwgdHJ1ZSk7XG5cbiAgICAgICAgLy9TZXQgaGVhZGVycyAobXVzdCBiZSBkb25lIGFmdGVyIHJlcXVlc3Qub3BlbilcbiAgICAgICAgc2V0WEhSSGVhZGVycyhyZXF1ZXN0LCBjb25maWcuaGVhZGVycyk7XG5cbiAgICAgICAgLy9TZXQgd2l0aENyZWRlbnRpYWxzIG9wdGlvblxuICAgICAgICBpZiAoY29uZmlnLm9wdGlvbnMud2l0aENyZWRlbnRpYWxzKSB7XG4gICAgICAgICAgICByZXF1ZXN0LndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvL1RoZSBldmVudCBsaXN0ZW5lciBmb3Igd2hlbiB0aGUgeGhyIHJlcXVlc3QgY2hhbmdlcyBzdGF0ZSAocmVhZHlTdGF0ZSA9IDQgbWVhbnMgY29tcGxldGVkIC0gZWl0aGVyIHN1Y2Nlc3NmdWxseSBvciB3LyBhbiBlcnJvcilcbiAgICAgICAgcmVxdWVzdC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAocmVxdWVzdC5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICAgICAgY29uZmlnLm9wdGlvbnMudHJhbnNmb3JtUmVzcG9uc2UocmVxdWVzdCk7XG4gICAgICAgICAgICAgICAgdmFyIHBhcnNlZFJlc3BvbnNlID0gY29uZmlnLm9wdGlvbnMudHJhbnNmb3JtUmVzcG9uc2VEYXRhKHJlcXVlc3QpO1xuICAgICAgICAgICAgICAgIGlmICgocmVxdWVzdC5zdGF0dXMgPj0gMjAwICYmIHJlcXVlc3Quc3RhdHVzIDwgMzAwKSB8fCByZXF1ZXN0LnN0YXR1cyA9PT0gMzA0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlID09PSAnR0VUJyAmJiBjYWNoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjYWNoZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpc0NhY2hlRmFjdG9yeS5nZXQoJ19fZGVmYXVsdCcpLnNldCh1cmwsIHBhcnNlZFJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhY2hlLmNvbnN0cnVjdG9yLm5hbWUgPT09ICdDYWNoZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGUuc2V0KHVybCwgcGFyc2VkUmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlLmNhY2hlLnNldCh1cmwsIHBhcnNlZFJlc3BvbnNlLCBjYWNoZS5vcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kcy5maXJzdC5jYWxsKG1ldGhvZHMsIHBhcnNlZFJlc3BvbnNlLCByZXF1ZXN0LnN0YXR1cywgcmVxdWVzdCk7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZHMudGhlbi5jYWxsKG1ldGhvZHMsIHBhcnNlZFJlc3BvbnNlLCByZXF1ZXN0LnN0YXR1cywgcmVxdWVzdCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kc1snY2F0Y2gnXS5jYWxsKG1ldGhvZHMsIHBhcnNlZFJlc3BvbnNlLCByZXF1ZXN0LnN0YXR1cywgcmVxdWVzdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1ldGhvZHNbJ2ZpbmFsbHknXS5jYWxsKG1ldGhvZHMsIHBhcnNlZFJlc3BvbnNlLCByZXF1ZXN0LnN0YXR1cywgcmVxdWVzdCk7XG4gICAgICAgICAgICAgICAgY29uZmlnID0gbnVsbDtcbiAgICAgICAgICAgICAgICBtZXRob2RzID0gbnVsbDtcbiAgICAgICAgICAgICAgICByZXF1ZXN0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICBwYXJzZWRSZXNwb25zZSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgLy9TZW5kIGFueSBkYXRhIChvbmx5IHZhbGlkIGZvciBQT1NULCBQVVQsIFBBVENIKVxuICAgICAgICByZXF1ZXN0LnNlbmQoY29uZmlnLm9wdGlvbnMudHJhbnNmb3JtUmVxdWVzdERhdGEoZGF0YSkpO1xuXG4gICAgICAgIC8vVGltZW91dCBoYW5kbGluZyAoYWJvcnQgcmVxdWVzdCBhZnRlciB0aW1lb3V0IHRpbWUgaW4gbWlsbGlzZWNvbmRzKVxuICAgICAgICBpZiAoY29uZmlnLm9wdGlvbnMudGltZW91dCA+IDApIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGlmIChyZXF1ZXN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuYWJvcnQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBjb25maWcub3B0aW9ucy50aW1lb3V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjYWxsYmFja3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXhlY3V0ZXMgcmVxdWVzdHMgaW4gcGFyYWxsZWwgYW5kIHJldHVybnMgcmVzcG9uc2VzIGluIGEgc2luZ2xlIHRoZW4uY2F0Y2ggY2xhdXNlXG4gICAgICogQHBhcmFtIHJlcXVlc3RBcnJheVxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIHBhcmFsbGVsKHJlcXVlc3RBcnJheSwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRvbmVDb3VudGVyID0gMDtcbiAgICAgICAgdmFyIHJlc3BvbnNlQXJyYXkgPSBbXTtcbiAgICAgICAgdmFyIGVyckFycmF5ID0gbnVsbDtcbiAgICAgICAgdmFyIGwgPSByZXF1ZXN0QXJyYXkubGVuZ3RoO1xuXG4gICAgICAgIGZ1bmN0aW9uIGNsb3N1cmUoaW5kZXgsIHJlcXVlc3QpIHtcbiAgICAgICAgICAgIHJlcXVlc3QudGhlbihmdW5jdGlvbihyZXMpIHtcbiAgICAgICAgICAgICAgICByZXNwb25zZUFycmF5W2luZGV4XSA9IHJlcztcbiAgICAgICAgICAgICAgICBkb25lQ291bnRlcisrO1xuXG4gICAgICAgICAgICAgICAgaWYoZG9uZUNvdW50ZXIgPT09IGwpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyQXJyYXksIHJlc3BvbnNlQXJyYXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlQXJyYXlbaW5kZXhdID0gbnVsbDtcbiAgICAgICAgICAgICAgICBpZighZXJyQXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyQXJyYXkgPSBbZXJyXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlcnJBcnJheS5wdXNoKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRvbmVDb3VudGVyKys7XG5cbiAgICAgICAgICAgICAgICBpZihkb25lQ291bnRlciA9PT0gbCkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnJBcnJheSwgcmVzcG9uc2VBcnJheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcmVxID0gcmVxdWVzdEFycmF5W2ldO1xuICAgICAgICAgICAgcmVzcG9uc2VBcnJheS5wdXNoKG51bGwpO1xuICAgICAgICAgICAgY2xvc3VyZShpLCByZXEpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeGVjdXRlcyByZXF1ZXN0cyBpbiBwYXJhbGxlbCBidXQgZG9lcyBub3QgcmVxdWlyZSB0aGF0IGFsbCByZXF1ZXN0cyBjb21wbGV0ZSBzdWNjZXNzZnVsbHksIHJldHVybkFycmF5IGluIGNhbGxiYWNrIGlzIGFuIG9iamVjdCB0aGF0IGhhcyBhIHN0YXRlIHdoaWNoIHRlbGxzIHdoZXRoZXIgdGhlIHJlcXVlc3Qgd2FzIGZ1bGZpbGxlZCBvciByZWplY3RlZFxuICAgICAqIEBwYXJhbSByZXF1ZXN0QXJyYXlcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2tcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBzZXR0bGUocmVxdWVzdEFycmF5LCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgZG9uZUNvdW50ZXIgPSAwO1xuICAgICAgICB2YXIgcmVzcG9uc2VBcnJheSA9IFtdO1xuICAgICAgICB2YXIgbCA9IHJlcXVlc3RBcnJheS5sZW5ndGg7XG5cbiAgICAgICAgZnVuY3Rpb24gY2xvc3VyZShpbmRleCwgcmVxdWVzdCkge1xuICAgICAgICAgICAgcmVxdWVzdC50aGVuKGZ1bmN0aW9uKHJlcykge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlQXJyYXlbaW5kZXhdID0ge3N0YXRlOiAnZnVsZmlsbGVkJywgcmVzOiByZXMsIGVycjogbnVsbH07XG4gICAgICAgICAgICAgICAgZG9uZUNvdW50ZXIrKztcblxuICAgICAgICAgICAgICAgIGlmKGRvbmVDb3VudGVyID09PSBsKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHJlc3BvbnNlQXJyYXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlQXJyYXlbaW5kZXhdID0ge3N0YXRlOiAncmVqZWN0ZWQnLCByZXM6IG51bGwsIGVycjogZXJyfTtcbiAgICAgICAgICAgICAgICBkb25lQ291bnRlcisrO1xuXG4gICAgICAgICAgICAgICAgaWYoZG9uZUNvdW50ZXIgPT09IGwpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2socmVzcG9uc2VBcnJheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcmVxID0gcmVxdWVzdEFycmF5W2ldO1xuICAgICAgICAgICAgcmVzcG9uc2VBcnJheS5wdXNoKG51bGwpO1xuICAgICAgICAgICAgY2xvc3VyZShpLCByZXEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXhwb3J0aW5nIHB1YmxpYyBmdW5jdGlvbnMgdG8gdXNlclxuICAgICAqL1xuICAgIHZhciBleHBvcnRzID0ge307XG5cbiAgICAvL0dldHRlci9TZXR0ZXIgZm9yIEdsb2JhbCBvcHRpb25zIChhY3Jvc3MgYWxsIHVodHRwIHJlcXVlc3RzIG9uIGEgc2luZ2xlIHBhZ2UpXG4gICAgZXhwb3J0cy5zZXRHbG9iYWxPcHRpb25zID0gc2V0R2xvYmFsT3B0aW9ucztcbiAgICBleHBvcnRzLmdldEdsb2JhbE9wdGlvbnMgPSBnZXRHbG9iYWxPcHRpb25zO1xuXG4gICAgLy9FeHBvcnQgQ2FjaGVGYWN0b3J5IHRvIGFsbG93IHVzZXIgbW9yZSBjb250cm9sIG92ZXIgY2FjaGVzXG4gICAgZXhwb3J0cy5DYWNoZUZhY3RvcnkgPSB0aGlzQ2FjaGVGYWN0b3J5O1xuXG4gICAgLy9FeHBvcnQgZ2V0L3NldENvb2tpZSBiZWNhdXNlIHRoZXkgYXJlIGhlbHBlciBmdW5jdGlvbnMgdXNlZCBieSB1aHR0cCBhbmQgY291bGQgYmUgdXNlZnVsIGZvciBhIHVzZXJcbiAgICBleHBvcnRzLmdldENvb2tpZSA9IGdldENvb2tpZTtcbiAgICBleHBvcnRzLnNldENvb2tpZSA9IHNldENvb2tpZTtcbiAgICBleHBvcnRzLnNldENvb2tpZUZyb21TdHJpbmcgPSBzZXRDb29raWVGcm9tU3RyaW5nO1xuICAgIGV4cG9ydHMuZGVsZXRlQ29va2llID0gZGVsZXRlQ29va2llO1xuXG4gICAgLy9FeHBvcnQgcGFyYWxsZWwgYW5kIHNldHRsZSBoZWxwZXIgZnVuY3Rpb25zXG4gICAgZXhwb3J0cy5wYXJhbGxlbCA9IHBhcmFsbGVsO1xuICAgIGV4cG9ydHMuc2V0dGxlID0gc2V0dGxlO1xuXG4gICAgLy9FeHBvcnQgYWN0dWFsIGFqYXggcmVxdWVzdCBtZXRob2RzXG4gICAgZXhwb3J0cy5nZXQgPSBmdW5jdGlvbiAoc3JjLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB4aHIoJ0dFVCcsIHNyYywgb3B0aW9ucyk7XG4gICAgfTtcblxuICAgIGV4cG9ydHMuaGVhZCA9IGZ1bmN0aW9uIChzcmMsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHhocignSEVBRCcsIHNyYywgb3B0aW9ucyk7XG4gICAgfTtcblxuICAgIGV4cG9ydHMucHV0ID0gZnVuY3Rpb24gKHNyYywgb3B0aW9ucywgZGF0YSkge1xuICAgICAgICBpZiAoIWRhdGEpIHtcbiAgICAgICAgICAgIGRhdGEgPSBvcHRpb25zO1xuICAgICAgICAgICAgb3B0aW9ucyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHhocignUFVUJywgc3JjLCBvcHRpb25zLCBkYXRhKTtcbiAgICB9O1xuXG4gICAgZXhwb3J0cy5wYXRjaCA9IGZ1bmN0aW9uIChzcmMsIG9wdGlvbnMsIGRhdGEpIHtcbiAgICAgICAgaWYgKCFkYXRhKSB7XG4gICAgICAgICAgICBkYXRhID0gb3B0aW9ucztcbiAgICAgICAgICAgIG9wdGlvbnMgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB4aHIoJ1BBVENIJywgc3JjLCBvcHRpb25zLCBkYXRhKTtcbiAgICB9O1xuXG4gICAgZXhwb3J0cy5wb3N0ID0gZnVuY3Rpb24gKHNyYywgb3B0aW9ucywgZGF0YSkge1xuICAgICAgICBpZiAoIWRhdGEpIHtcbiAgICAgICAgICAgIGRhdGEgPSBvcHRpb25zO1xuICAgICAgICAgICAgb3B0aW9ucyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHhocignUE9TVCcsIHNyYywgb3B0aW9ucywgZGF0YSk7XG4gICAgfTtcblxuICAgIGV4cG9ydHNbJ2RlbGV0ZSddID0gZnVuY3Rpb24gKHNyYywgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4geGhyKCdERUxFVEUnLCBzcmMsIG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICAvL0pzb25wIG1ldGhvZCBpcyB1bmlxdWUgZnJvbSB0aGUgcmVzdCAoZG9lc24ndCB1c2UgeGhyLCBjcmVhdGVzIGEgc2NyaXB0IGVsZW1lbnQpXG4gICAgZXhwb3J0cy5qc29ucCA9IGZ1bmN0aW9uIChzcmMpIHtcbiAgICAgICAgcmV0dXJuIGpzb25wKHNyYyk7XG4gICAgfTtcblxuICAgIHJldHVybiBleHBvcnRzO1xufSk7IiwiLyohXG4gKlxuICogYml0LWdldCAxLjAuMFxuICpcbiAqL1xuXG4oIGZ1bmN0aW9uKCB3aW5kb3csIGZhY3RvcnkgKSB7XG4gICd1c2Ugc3RyaWN0JztcbiAgLy8gdW5pdmVyc2FsIG1vZHVsZSBkZWZpbml0aW9uXG5cbiAgaWYgKCB0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCApIHtcbiAgICAvLyBBTURcbiAgICBkZWZpbmUoIFtcbiAgICAgICAgJy4uL25vZGVfbW9kdWxlcy91aHR0cC9zcmMvdWh0dHAnLFxuICAgICAgXSxcbiAgICAgIGZ1bmN0aW9uKCB1aHR0cCApIHtcbiAgICAgICAgcmV0dXJuIGZhY3RvcnkoIHdpbmRvdywgdWh0dHAgKTtcbiAgICAgIH0pO1xuICB9IGVsc2UgaWYgKCB0eXBlb2YgZXhwb3J0cyA9PSAnb2JqZWN0JyApIHtcbiAgICAvLyBDb21tb25KU1xuICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShcbiAgICAgIHdpbmRvdyxcbiAgICAgIHJlcXVpcmUoJy4uL25vZGVfbW9kdWxlcy91aHR0cC9zcmMvdWh0dHAnKVxuICAgICk7XG4gIH0gZWxzZSB7XG4gICAgLy8gYnJvd3NlciBnbG9iYWxcbiAgICB3aW5kb3cuYml0R2V0ID0gZmFjdG9yeShcbiAgICAgIHdpbmRvdyxcbiAgICAgIHdpbmRvdy51aHR0cFxuICAgICk7XG4gIH1cblxufSggd2luZG93LCBmdW5jdGlvbiBmYWN0b3J5KCB3aW5kb3csIHVodHRwICkge1xuXG4ndXNlIHN0cmljdCc7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIHZhcnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cbnZhciBzZWFyY2hVcmwgPSBcIi8vYXBpLmJhbmRzaW50b3duLmNvbS9ldmVudHMvc2VhcmNoP1wiO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBoZWxwZXJzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG4gIC8vdGhlIHByb3RlY3RlZCBwYXJhbWV0ZXJzIHNldFxuICAvL3RoZXNlIGFyZSBhbHdheXMgYWRkZWQgdG8gdGhlIHF1ZXJ5IHN0cmluZ1xuICB2YXIgcHJvdGVjdGVkUGFyYW1zID0ge1xuICAgIFwiYXBpX3ZlcnNpb25cIjpcIjIuMFwiLFxuICAgICAgLy9kZWZhdWx0IDIuMFxuICAgICAgLy9SRVFVSVJFRCBjYW5ub3QgYmUgY2hhbmdlZFxuICAgIFwiZm9ybWF0XCI6XCJqc29uXCIsXG4gICAgICAvL1JFUVVJUkVEIGNhbm5vdCBiZSBjaGFuZ2VkXG4gICAgICAvL2RlZmF1bHQgSlNPTl9DQUxMQkFDS1xuICAgIFwiY2FsbGJhY2tcIjpcIkpTT05fQ0FMTEJBQ0tcIlxuICAgICAgLy9SRVFVSVJFRCBjYW5ub3QgYmUgY2hhbmdlZFxuICAgICAgLy9kZWZhdWx0IEpTT05fQ0FMTEJBQ0tcbiAgfVxuXG4gIC8vYWxsb3dlZFBhcmFtcyB0aGF0IGEgdXNlciBtYXkgZGVjaWRlIHRvIHNldFxuICAvL3dlIHJlbW92ZSBhbnkgb3RoZXIgcGFyYW1zXG4gIHZhciBhbGxvd2VkUGFyYW1zID0gW1xuICAgIFwiYXBwX2lkXCIsXG4gICAgICAvL1JFUVVJUkVEIC0gdGhlIGFwcF9pZCBkZWZhdWx0IGVtcHR5IHN0cmluZ1xuICAgIFwiYXJ0aXN0c1wiLFxuICAgICAgLy9SRVFVSVJFRCAtIGRlZmF1bHQgZW1wdHkgYXJyYXlcbiAgICBcInBlcl9wYWdlXCIsXG4gICAgICAvL2RlZmF1bHQgNTBcbiAgICBcInBhZ2VcIixcbiAgICAgIC8vZGVmYXVsdCAxXG4gICAgXCJkYXRlXCIsXG4gICAgICAvL3l5eXktbW0tZGRcbiAgICAgIC8veXl5eS1tbS1kZCx5eXl5LW1tLWRkIChpbmNsdXNpdmUgcmFuZ2UpXG4gICAgICAvL3VwY29taW5nXG4gICAgICAvL2FsbFxuICAgIFwibG9jYXRpb25cIixcbiAgICAgIC8vZGVmYXVsdCBpcyBlbXB0eSAtIG5vdCBzZW50XG4gICAgICAvL2NpdHksc3RhdGUgKFVTIG9yIENBKVxuICAgICAgLy9jaXR5LGNvdW50cnlcbiAgICAgIC8vbGF0LGxvblxuICAgICAgLy9pcCBhZGRyZXNzXG4gICAgICAvL3VzZV9nZW9pcCAod2lsbCB1c2UgdGhlIGlwIHRoZSByZXF1ZXN0IGNhbWUgZnJvbSlcbiAgICBcInJhZGl1c1wiLFxuICAgICAgLy9kZWZhdWx0IDUwXG4gICAgICAvL21heCAxNTBcbiAgXTtcblxuICAvL3RoZSBkZWZhdWx0IHBhcmFtZXRlciBzZXQgdGhhdCBpcyB1c2VkIGZvciBtYWtpbmcgYXBpIHJlcXVlc3RzLlxuICAvL3RoZXNlIHZhbHVlcyBjYW4gYmUgc2V0LCB1cGRhdGVkLCB1bnNldFxuICB2YXIgZGVmYXVsdFBhcmFtcyA9IHtcbiAgICBcImFwcF9pZFwiOlwiXCIsXG4gICAgXCJhcnRpc3RzXCI6W11cbiAgfVxuXG4gIC8vVGhlIGFjdHVhbCBwYXJhbWV0ZXIgc2V0IHVzZWRcbiAgLy9DcmVhdGVkIHdpdGggYnVpbGRQYXJhbXNcbiAgdmFyIHBhcmFtcyA9IHt9O1xuXG4gIC8vc2V0IGEgZ3JvdXAgb2YgcGFyYW1ldGVyc1xuICBmdW5jdGlvbiBzZXRQYXJhbXMoIG9iaiApe1xuICAgIGZvciggdmFyIGtleSBpbiBvYmogKXtcbiAgICAgIGRlZmF1bHRQYXJhbXNba2V5XSA9IG9ialtrZXldO1xuICAgIH1cbiAgICBtZXJnZVBhcmFtcygpO1xuICB9XG5cbiAgLy9zZXQgYSBzaW5nbGUgcGFyYW1ldGVyXG4gIC8vdXNlZnVsIGZvciBzZXR0aW5nIHRoaW5ncyBsaWtlIGxvY2F0aW9uICYgcmFkaXVzXG4gIGZ1bmN0aW9uIHNldFBhcmFtKCBrZXksIHZhbHVlICl7XG4gICAgZGVmYXVsdFBhcmFtc1trZXldID0gdmFsdWU7XG4gICAgbWVyZ2VQYXJhbXMoKTtcbiAgfVxuXG4gIC8vdW5zZXQgYSBwYXJhbSBpZiBpdCBpcyBzZXRcbiAgZnVuY3Rpb24gdW5zZXRQYXJhbSgga2V5ICl7XG4gICAgaWYoIGRlZmF1bHRQYXJhbXMuaGFzT3duUHJvcGVydHkoa2V5KSApe1xuICAgICAgZGVsZXRlIGRlZmF1bHRQYXJhbXNba2V5XTtcbiAgICB9XG4gIH1cblxuICAvLyBVdGlsaXR5IG1ldGhvZCB0byBleHRlbmQgcHJvcGVydGllcyBvZiBhbiBvYmplY3RcbiAgZnVuY3Rpb24gZXh0ZW5kUHJvcGVydGllcyggc291cmNlLCBwcm9wZXJ0aWVzICkge1xuICAgIGZvciAodmFyIHByb3BlcnR5IGluIHByb3BlcnRpZXMpIHtcbiAgICAgIGlmIChwcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xuICAgICAgICBzb3VyY2VbcHJvcGVydHldID0gcHJvcGVydGllc1twcm9wZXJ0eV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzb3VyY2U7XG4gIH1cblxuICAvL21lcmdlIGRlZmF1bHRzIGFuZCBwcm90ZWN0ZWQgcGFyYW1ldGVyc1xuICAvL2NhbGxlZCBhZnRlciBwYXJhbXMgYXJlIHVwZGF0ZWQgb3Igc2V0XG4gIGZ1bmN0aW9uIG1lcmdlUGFyYW1zKCl7XG4gICAgcGFyYW1zID0gZXh0ZW5kUHJvcGVydGllcyggZGVmYXVsdFBhcmFtcywgcHJvdGVjdGVkUGFyYW1zICk7XG4gIH1cblxuICAvL3NlcmlhbGl6ZSB0aGUgcGFyYW0gc3RyaW5nXG4gIC8vY2hlY2tpbmcgZm9yIGFycmF5c1xuICBmdW5jdGlvbiBzZXJpYWxpemUoIG9iaiApIHtcbiAgICB2YXIgc3RyID0gW107XG4gICAgZm9yKHZhciBwIGluIG9iailcbiAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkocCkpIHtcbiAgICAgICAgLy9pZiB0aGUgdmFsdWUgaXMgYW4gYXJyYXlcbiAgICAgICAgLy9jcmVhdGUgYSBzdHJpbmcgd2l0aCB2YWx1ZXMgbGlrZSAvL2tleVtdPXZhbHVlXG4gICAgICAgIGlmKCB7fS50b1N0cmluZy5jYWxsKCBvYmpbcF0gKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiKXtcbiAgICAgICAgICBmb3IodmFyIGkgaW4gb2JqW3BdICl7XG4gICAgICAgICAgICBzdHIucHVzaChwICsgXCJbXT1cIiArIG9ialtwXVtpXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9ZWxzZSBpZiAoIHAgPT09IFwiYXJ0aXN0c1wiICkge1xuICAgICAgICAgIHN0ci5wdXNoKHAgKyBcIltdPVwiICsgb2JqW3BdKTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgc3RyLnB1c2gocCArIFwiPVwiICsgb2JqW3BdKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIHJldHVybiBzdHIuam9pbihcIiZcIik7XG4gIH1cblxuICAvL21ha2UgdGhlIGNhbGwgZm9yIGV2ZW50cyBmcm9tIHRoZSBhcGlcbiAgLy9yZXR1cm4gdGhlIGFwcHJvcHJpYXRlIGNhbGxiYWNrIG9yIGVycm9yYmFja1xuICBmdW5jdGlvbiBnZXRFdmVudHMoIGNhbGxiYWNrLCBlcnJvcmJhY2sgKXtcbiAgICB2YXIgdXJsID0gc2VhcmNoVXJsICsgc2VyaWFsaXplKCBwYXJhbXMgKTtcblxuICAgIGJpdEdldC51aHR0cC5qc29ucCh1cmwpXG4gICAgICAudGhlbiggZnVuY3Rpb24ocmVzKXtcbiAgICAgICAgaWYoIHJlcy5lcnJvcnMgPT09IHVuZGVmaW5lZCApXG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKHJlcyk7XG5cbiAgICAgICAgY29uc29sZS5sb2coXCJnZXRFdmVudHMgRXJyb3JzOiBcIiArIHJlcy5lcnJvcnMpO1xuICAgICAgICByZXR1cm4gZXJyb3JiYWNrKHJlcyk7XG5cbiAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycil7XG4gICAgICAgIGNvbnNvbGUubG9nKCBcImdldEV2ZW50cyBmYWlsZWQhXCIgKTtcbiAgICAgICAgY29uc29sZS5sb2coIGVyciApO1xuICAgICAgfSk7XG4gIH1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gYml0R2V0IERlZmluaXRpb24gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cbiAgdmFyIGJpdEdldCA9IHt9O1xuXG4gIC8vZ2l2ZSBpdCBpdCdzIG93biBpbnN0YW5jZSBvZiB1aHR0cCBmb3IgbWFraW5nIHJlcXVlc3RzXG4gIGJpdEdldC51aHR0cCA9IHVodHRwO1xuXG4gIGJpdEdldC5nZXRFdmVudHMgPSBmdW5jdGlvbiggY2FsbGJhY2ssIGVycm9yYmFjayApe1xuICAgIHJldHVybiBnZXRFdmVudHMoIGNhbGxiYWNrLCBlcnJvcmJhY2sgKTtcbiAgfTtcblxuICBiaXRHZXQuc2V0UGFyYW1zID0gZnVuY3Rpb24oIG9iaiApe1xuICAgIHJldHVybiBzZXRQYXJhbXMoIG9iaiApO1xuICB9XG5cbiAgYml0R2V0LnNldFBhcmFtID0gZnVuY3Rpb24oIGtleSwgdmFsdWUgKXtcbiAgICByZXR1cm4gc2V0UGFyYW0oIGtleSwgdmFsdWUgKTtcbiAgfVxuXG4gIGJpdEdldC5nZXRQYXJhbXMgPSBmdW5jdGlvbigpe1xuICAgIHJldHVybiBkZWZhdWx0UGFyYW1zO1xuICB9XG5cbiAgYml0R2V0LnVuc2V0UGFyYW0gPSBmdW5jdGlvbigga2V5ICl7XG4gICAgcmV0dXJuIHVuc2V0UGFyYW0oIGtleSApO1xuICB9XG5cbiAgcmV0dXJuIGJpdEdldDtcblxufSkpO1xuIl19

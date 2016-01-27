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

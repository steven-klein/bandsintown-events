# Bit Get
A simple wrapper for the Bands In Town Events Search JS API.

### Basic Usage

```
var bitGet = new bitGet();

//set options for bitGet
//app_id and artists are required
bitGet.setParams({
  "app_id":"myappname", //can be anything
  "artists":[ //accepts string for single artist or an array of artist names
    "Wilco",
    "Yeah Yeah Yeahs"
  ]
});

//get your events with success and error callbacks
bitGet.getEvents(function( events ){
  console.log(events);
},function( errors ){
  console.log(errors);
});

```

### Additional Methods

```
//setParams - set a group of parameters as an object
//these will merge with the currently set params
bitGet.setParams( obj );

//setParam - set a new single parameter as key, value pair
bitGet.setParam( key, value );

//getParams - get the currently set parameters
var params = bitGet.getParams();
console.log(params);

//unsetParam - unset a parameter that you previously set by key
bitGet.unsetParam(key);
```

### Use with Browserify

Install as a node module.
```
npm install bit-get
```

Use in your app.
```
var bitGet = require( 'bitGet' );
```

### Parameters

These are the only required parameters by BandsInTown documentation.
```
{
  "app_id"  : "MyAppId",
  "artists" : "Wilco"
}
```

The full list of parameters can be found on the [BandsInTown API page.](https://www.bandsintown.com/api/requests#artists-event-search)

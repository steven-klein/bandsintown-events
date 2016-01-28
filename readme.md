# Bit Get
A simple wrapper for the Bands In Town Events Search JS API.

### Basic Usage

Include the compressed version in your project.

```
<script src="./../dist/bit-get.min.js"></script>
```

Create an instance, set your parameters, and get some events.

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
  for(var i = 0; i < events.length; i++){
    console.log( events[i].venue.city + ", " + events[i].venue.region );
  }
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

Use in your app.
```
var bitGet = require( 'bitGet' );
```

**The main bundle is wrapped in a UML, so you should be able to consume the bundle with alternative environments.**

### Parameters

These are the only required parameters by BandsInTown documentation.
```
{
  "app_id"  : "MyAppId",
  "artists" : "Wilco"
}
```

The full list of parameters can be found on the [BandsInTown API page.](https://www.bandsintown.com/api/requests#artists-event-search)

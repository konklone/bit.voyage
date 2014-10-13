/**
  Taken from https://github.com/mapbox/frameup/blob/master/index.html
  released by Mapbox under an ISC license
**/

// Parse an encoded params string and set params from it.
var params = {};
function setParams(encoded) {
  var pairs = encoded.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var key = pairs[i].substr(0, pairs[i].indexOf('='));
    var val = pairs[i].substr(pairs[i].indexOf('=') + 1);
    params[key] = val;
  }
};
if (location.hash) setParams(location.hash.replace('#', ''));

module.exports = params;

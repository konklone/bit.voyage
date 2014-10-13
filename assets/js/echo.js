var Writable = require('stream').Writable;

var createEcho = function(delay) {
  var echo = new Writable({
    highWaterMark: 4194304
  });

  echo._write = function (chunk, encoding, next) {
    console.log("chunk received. " + chunk.length);
    setTimeout(next, delay);
  };

  return echo;
}

module.exports = createEcho;

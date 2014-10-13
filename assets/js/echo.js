var Writable = require('stream').Writable;

var newEcho = function() {
  var echo = new Writable({
    highWaterMark: 4194304
  });

  echo._write = function (chunk, encoding, next) {
    console.log("chunk received. " + chunk.length);
    setTimeout(next, 1000);
  };

  return echo;
}

module.exports = newEcho;


/**
  Taken from https://github.com/mapbox/frameup/blob/master/index.html
  copyright Mapbox
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

/** end Mapbox copyright **/

/**
  basic drag and drop event-ery
  adapted from https://github.com/mikolalysenko/drag-and-drop-files
  so this is under an MIT license
**/
function handleDrop(callback, event) {
  event.stopPropagation();
  event.preventDefault();
  callback(Array.prototype.slice.call(event.dataTransfer.files))
}

// indicate it's active
function onDragEnter(event) {
  event.stopPropagation();
  event.preventDefault();
  window.event = event;
  return false;
}

// don't do anything while dragging
function onDragOver(event) {
  event.stopPropagation();
  event.preventDefault();
  return false;
}

// set up callbacks on element
function drop(element, callback) {
  element.addEventListener("dragenter", onDragEnter, false);
  element.addEventListener("dragover", onDragOver, false);
  element.addEventListener("drop", handleDrop.bind(undefined, callback), false);
}
/** end MIT licensed modifications **/


// thank you @maxogden
var createReadStream = require('filereader-stream');


/** AWS **/
// See the Configuring section to configure credentials in the SDK
AWS.config.update({
  accessKeyId: params.key,
  secretAccessKey: params.secret_key
});
var bucket = new AWS.S3({params: {
  Bucket: params.bucket
}});

var params = {Key: 'test.txt', Body: "testing 1-2-3"};
var uploadId;
var initialize = function(file, callback) {
  bucket.createMultipartUpload(
    {Key: file.name},
    function(err, data) {
      if (err) return console.log(err);

      uploadId = data.uploadId;
      callback(data.uploadId);
    }
  )
};

/**

// begin the upload
bucket.createMultipartUpload({
  Key: 'test-multi.txt'
}, function(err, data) {
  window.args = arguments}
);


// send a part
bucket.uploadPart({
  Key: 'test-multi.txt',
  PartNumber: 1,
  UploadId: id,
  Body: 'Whatever'
}, function() {window.args=arguments; console.log("done")
})


// end the upload
bucket.completeMultipartUpload({
  Key: 'test-multi.txt',
  UploadId: id,
  MultipartUpload: {Parts: [{
    ETag: "3a45da0d5405623c2443e30e0bc76939", PartNumber: 1
  }]}},
  function() {window.args=arguments; console.log("done")
})

**/

var s3upload = function(uploadId, data) {
  console.log("Would upload " + data + " with " + uploadId);
};

/** various progress functions **/

// counter of MBs
var mbs = 1;
var printMegabytes = function(progress) {
  if (progress > (mbs * 1000 * 1000)) {
    console.log("MBs: " + mbs);
    mbs += 1;
  }
}



/** drop target **/

var target = document.getElementById("drop-here");
drop(target, function(files) {
  var first = files[0];

  // less 1/128th of the bytes
  var adjust = function(x) {return x - (x/128)};

  var stream = createReadStream(first, {
    output: "binary",
    // chunkSize: adjust(8 * 1024)
    chunkSize: adjust(6 * 1024 * 1024) // 6MB
  });

  stream.on('progress', Megabytes);

  stream.on('end', function(size) {
    console.log("Done: " + size);
  });

  console.log(first.name +  ": embarking on a " + first.size + "-byte journey.");

  initialize(first, function(uploadId) {
    stream.pipe({write: function(data) {
      s3upload(data, uploadId);
    }});
  })

});

console.log("Drop target armed.")

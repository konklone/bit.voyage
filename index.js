// drop target
var target = document.getElementById("drop-here");

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


// used for debugging
var concat = require('concat-stream');

// thank you @maxogden
var createReadStream = require('filereader-stream');

// counter of MBs
var mbs = 1;


drop(target, function(files) {
  var first = files[0];
  var stream = createReadStream(first, {
    output: "binary",
    chunkSize: 8128 // default
  });

  stream.on('progress', function(progress) {
    if (progress > (mbs * 1000 * 1000)) {
      console.log("MBs: " + mbs);
      mbs += 1;
    }

    // console.log("Made it: " + progress);
  });

  stream.on('end', function(size) {
    console.log("Done: " + size);
  });

  console.log(first.name +  ": embarking on a " + first.size + "-byte journey.");

  stream.pipe({write: function(data) {
    // console.log(data);
    // do nothing with the data
  }});

});

console.log("Drop target armed.")

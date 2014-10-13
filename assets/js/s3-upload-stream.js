var Writable = require('stream').Writable,
    events = require("events");

// hack by Eric
(function (global, undefined) {
    "use strict";

    if (global.setImmediate) {
        return;
    }

    var nextHandle = 1; // Spec says greater than zero
    var tasksByHandle = {};
    var currentlyRunningATask = false;
    var doc = global.document;
    var setImmediate;

    function addFromSetImmediateArguments(args) {
        tasksByHandle[nextHandle] = partiallyApplied.apply(undefined, args);
        return nextHandle++;
    }

    // This function accepts the same arguments as setImmediate, but
    // returns a function that requires no arguments.
    function partiallyApplied(handler) {
        var args = [].slice.call(arguments, 1);
        return function() {
            if (typeof handler === "function") {
                handler.apply(undefined, args);
            } else {
                (new Function("" + handler))();
            }
        };
    }

    function runIfPresent(handle) {
        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
        // So if we're currently running a task, we'll need to delay this invocation.
        if (currentlyRunningATask) {
            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
            // "too much recursion" error.
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
        } else {
            var task = tasksByHandle[handle];
            if (task) {
                currentlyRunningATask = true;
                try {
                    task();
                } finally {
                    clearImmediate(handle);
                    currentlyRunningATask = false;
                }
            }
        }
    }

    function clearImmediate(handle) {
        delete tasksByHandle[handle];
    }

    function installNextTickImplementation() {
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            process.nextTick(partiallyApplied(runIfPresent, handle));
            return handle;
        };
    }

    function canUsePostMessage() {
        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
        // where `global.postMessage` means something completely different and can't be used for this purpose.
        if (global.postMessage && !global.importScripts) {
            var postMessageIsAsynchronous = true;
            var oldOnMessage = global.onmessage;
            global.onmessage = function() {
                postMessageIsAsynchronous = false;
            };
            global.postMessage("", "*");
            global.onmessage = oldOnMessage;
            return postMessageIsAsynchronous;
        }
    }

    function installPostMessageImplementation() {
        // Installs an event handler on `global` for the `message` event: see
        // * https://developer.mozilla.org/en/DOM/window.postMessage
        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

        var messagePrefix = "setImmediate$" + Math.random() + "$";
        var onGlobalMessage = function(event) {
            if (event.source === global &&
                typeof event.data === "string" &&
                event.data.indexOf(messagePrefix) === 0) {
                runIfPresent(+event.data.slice(messagePrefix.length));
            }
        };

        if (global.addEventListener) {
            global.addEventListener("message", onGlobalMessage, false);
        } else {
            global.attachEvent("onmessage", onGlobalMessage);
        }

        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            global.postMessage(messagePrefix + handle, "*");
            return handle;
        };
    }

    function installMessageChannelImplementation() {
        var channel = new MessageChannel();
        channel.port1.onmessage = function(event) {
            var handle = event.data;
            runIfPresent(handle);
        };

        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            channel.port2.postMessage(handle);
            return handle;
        };
    }

    function installReadyStateChangeImplementation() {
        var html = doc.documentElement;
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
            var script = doc.createElement("script");
            script.onreadystatechange = function () {
                runIfPresent(handle);
                script.onreadystatechange = null;
                html.removeChild(script);
                script = null;
            };
            html.appendChild(script);
            return handle;
        };
    }

    function installSetTimeoutImplementation() {
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
            return handle;
        };
    }

    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

    // Don't get fooled by e.g. browserify environments.
    if ({}.toString.call(global.process) === "[object process]") {
        // For Node.js before 0.9
        installNextTickImplementation();

    } else if (canUsePostMessage()) {
        // For non-IE10 modern browsers
        installPostMessageImplementation();

    } else if (global.MessageChannel) {
        // For web workers, where supported
        installMessageChannelImplementation();

    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
        // For IE 6–8
        installReadyStateChangeImplementation();

    } else {
        // For older browsers
        installSetTimeoutImplementation();
    }

    attachTo.setImmediate = setImmediate;
    attachTo.clearImmediate = clearImmediate;
}(new Function("return this")()));

var cachedClient;

module.exports = {
  // Set the S3 client to be used for this upload.
  client: function (client) {
    cachedClient = client;
  },

  // Generate a writeable stream which uploads to a file on S3.
  upload: function (destinationDetails) {
    var e = new events.EventEmitter();

    // Create the writeable stream interface.
    var ws = new Writable({
      highWaterMark: 4194304 // 4 MB
    });

    // Data pertaining to the overall upload
    var multipartUploadID;
    var partNumber = 1;
    var partIds = [];
    var receivedSize = 0;
    var uploadedSize = 0;

    // Parts which need to be uploaded to S3.
    var pendingParts = 0;
    var concurrentPartThreshold = 1;
    var ready = false; // Initial ready state is false.

    // Data pertaining to buffers we have received
    var receivedBuffers = [];
    var receivedBuffersLength = 0;
    var partSizeThreshold = 6242880;

    // Set the maximum amount of data that we will keep in memory before flushing it to S3 as a part
    // of the multipart upload
    ws.maxPartSize = function (partSize) {
      if (partSize < 5242880)
        partSize = 5242880;

      partSizeThreshold = partSize;
      return ws;
    };

    ws.getMaxPartSize = function () {
      return partSizeThreshold;
    };

    // Set the maximum amount of data that we will keep in memory before flushing it to S3 as a part
    // of the multipart upload
    ws.concurrentParts = function (parts) {
      if (parts < 1)
        parts = 1;

      concurrentPartThreshold = parts;
      return ws;
    };

    ws.getConcurrentParts = function () {
      return concurrentPartThreshold;
    };

    // Handler to receive data and upload it to S3.
    ws._write = function (incomingBuffer, enc, next) {
      absorbBuffer(incomingBuffer);

      if (receivedBuffersLength < partSizeThreshold)
        return next(); // Ready to receive more data in _write.

      // We need to upload some data
      uploadHandler(next);
    };

    // Concurrenly upload parts to S3.
    var uploadHandler = function (next) {
      if (pendingParts < concurrentPartThreshold) {
        // We need to upload some of the data we've received
        if (ready)
          upload(); // Upload the part immeadiately.
        else
          e.once('ready', upload); // Wait until multipart upload is initialized.
      }
      else {
        // Block uploading (and receiving of more data) until we upload
        // some of the pending parts
        e.once('part', upload);
      }

      function upload() {
        pendingParts++;
        flushPart(function (partDetails) {
          --pendingParts;
          e.emit('part'); // Internal event
          ws.emit('part', partDetails); // External event
        });
        next();
      }
    };

    // Absorb an incoming buffer from _write into a buffer queue
    var absorbBuffer = function (incomingBuffer) {
      receivedBuffers.push(incomingBuffer);
      receivedBuffersLength += incomingBuffer.length;
    };

    // Take a list of received buffers and return a combined buffer that is exactly
    // partSizeThreshold in size.
    var preparePartBuffer = function () {
      // Combine the buffers we've received and reset the list of buffers.
      var combinedBuffer = Buffer.concat(receivedBuffers, receivedBuffersLength);
      receivedBuffers.length = 0; // Trick to reset the array while keeping the original reference
      receivedBuffersLength = 0;

      if (combinedBuffer.length > partSizeThreshold) {
        // The combined buffer is too big, so slice off the end and put it back in the array.
        var remainder = new Buffer(combinedBuffer.length - partSizeThreshold);
        combinedBuffer.copy(remainder, 0, partSizeThreshold);
        receivedBuffers.push(remainder);
        receivedBuffersLength = remainder.length;

        // Return the original buffer.
        return combinedBuffer.slice(0, partSizeThreshold);
      }
      else {
        // It just happened to be perfectly sized, so return it.
        return combinedBuffer;
      }
    };

    // Flush a part out to S3.
    var flushPart = function (callback) {
      var partBuffer = preparePartBuffer();

      var localPartNumber = partNumber;
      partNumber++;
      receivedSize += partBuffer.length;
      cachedClient.uploadPart(
        {
          Body: partBuffer,
          Bucket: destinationDetails.Bucket,
          Key: destinationDetails.Key,
          UploadId: multipartUploadID,
          PartNumber: localPartNumber
        },
        function (err, result) {
          if (err)
            abortUpload('Failed to upload a part to S3: ' + JSON.stringify(err));
          else {
            uploadedSize += partBuffer.length;
            partIds[localPartNumber - 1] = {
              ETag: result.ETag,
              PartNumber: localPartNumber
            };

            callback({
              ETag: result.ETag,
              PartNumber: localPartNumber,
              receivedSize: receivedSize,
              uploadedSize: uploadedSize
            });
          }
        }
      );
    };

    // Overwrite the end method so that we can hijack it to flush the last part and then complete
    // the multipart upload
    ws.originalEnd = ws.end;
    ws.end = function (Part, encoding, callback) {
      ws.originalEnd(Part, encoding, function afterDoneWithOriginalEnd() {
        if (Part)
          absorbBuffer(Part);

        // Upload any remaining data
        var uploadRemainingData = function () {
          if (receivedBuffersLength > 0) {
            uploadHandler(uploadRemainingData);
            return;
          }

          if (pendingParts > 0) {
            setTimeout(uploadRemainingData, 50); // Wait 50 ms for the pending uploads to finish before trying again.
            return;
          }

          completeUpload();
        };

        uploadRemainingData();

        if (typeof callback == 'function')
          callback();
      });
    };

    // Turn all the individual parts we uploaded to S3 into a finalized upload.
    var completeUpload = function () {
      cachedClient.completeMultipartUpload(
        {
          Bucket: destinationDetails.Bucket,
          Key: destinationDetails.Key,
          UploadId: multipartUploadID,
          MultipartUpload: {
            Parts: partIds
          }
        },
        function (err, result) {
          if (err)
            abortUpload('Failed to complete the multipart upload on S3: ' + JSON.stringify(err));
          else {
            // Emit both events for backwards compatability, and to follow the spec.
            ws.emit('uploaded', result);
            ws.emit('finish', result);
          }
        }
      );
    };

    // When a fatal error occurs abort the multipart upload
    var abortUpload = function (rootError) {
      cachedClient.abortMultipartUpload(
        {
          Bucket: destinationDetails.Bucket,
          Key: destinationDetails.Key,
          UploadId: multipartUploadID
        },
        function (abortError) {
          if (abortError)
            ws.emit('error', rootError + '\n Additionally failed to abort the multipart upload on S3: ' + abortError);
          else
            ws.emit('error', rootError);
        }
      );
    };

    if (!cachedClient) {
      throw new Error('Must configure an S3 client before attempting to create an S3 upload stream.');
    }
    else {
      // Ensure that the writable stream is returned before we actually attempt to create the MPU.
      setImmediate(function () {
        cachedClient.createMultipartUpload(
          destinationDetails,
          function (err, data) {
            if (err)
              ws.emit('error', 'Failed to create a multipart upload on S3: ' + JSON.stringify(err));
            else {
              multipartUploadID = data.UploadId;
              ready = true;
              ws.emit('ready');
              e.emit('ready'); // Internal event
            }
          }
        );
      });
    }

    return ws;
  }
};

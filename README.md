## Bit Voyage

**Vision:** Allow anyone with a modern browser to drag, drop, and stream a 1GB, 10GB, or 1TB file over the Internet to a happy home.

**Requirements:** Files should never be read entirely into memory at any stage. File progress should be real-time and clear. Uploads should be resumable and pause-able at any time.

**Implementation:**

* Use the [Drag and Drop API](http://blog.teamtreehouse.com/implementing-native-drag-and-drop), available [in modern desktop browsers](http://caniuse.com/#feat=dragndrop), to let anyone drag a file into their browser
* Use the [File API](http://docs.webplatform.org/wiki/apis/file), available [in modern browsers](http://caniuse.com/#feat=fileapi), to chunk and stream file objects in-browser
* Use the [FileReader object](https://developer.mozilla.org/en-US/docs/Web/API/FileReader), available [in modern browsers](http://caniuse.com/#feat=filereader), to read the contents of chunks into memory

**Goals:**

* **Short-term:** Use the [S3 Multipart Upload API](http://docs.aws.amazon.com/AmazonS3/latest/dev/UsingRESTAPImpUpload.html) to allow users to upload files of any size directly to S3.
* **Long-term:** Allow upload to servers which support the Amazon S3 API but provide their own layer of authentication. Example: [The Internet Archive](https://archive.org/help/abouts3.txt).
* **Longest-term:** Instead of S3, allow users to stream files directly to other users over WebRTC, in the style of [Sharefest.me](https://www.sharefest.me/), as long as their browser tab is open.

### Work in progress

Work is in progress on the short-term goal: upload files to Amazon's S3 storage service. S3 access credentials will either be entered by users in text fields, or bookmarked in the URL's hash fragment.

### Credits

Created by [Eric Mill](https://twitter.com/konklone).

Builds on work by [Brian Brennan](https://github.com/brianloveswords/fileliststream), [Max](https://github.com/maxogden/filereader-stream) [Ogden](https://github.com/DamonOehlman/filestream/issues/9#issuecomment-58468336), [Derrick Parkhurst](https://github.com/thirtysixthspan/waterunderice), and [Young Hahn](https://github.com/mapbox/frameup).

### Public domain

This project is [dedicated to the public domain](LICENSE). As spelled out in [CONTRIBUTING](CONTRIBUTING.md):

> The project is in the public domain within the United States, and copyright and related rights in the work worldwide are waived through the [CC0 1.0 Universal public domain dedication](https://creativecommons.org/publicdomain/zero/1.0/).

> All contributions to this project will be released under the CC0 dedication. By submitting a pull request, you are agreeing to comply with this waiver of copyright interest.

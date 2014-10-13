require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js":[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (this.length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if(!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  if (end < start) throw new TypeError('sourceEnd < sourceStart')
  if (target_start < 0 || target_start >= target.length)
    throw new TypeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new TypeError('sourceStart out of bounds')
  if (end < 0 || end > source.length) throw new TypeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new TypeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new TypeError('start out of bounds')
  if (end < 0 || end > this.length) throw new TypeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js","ieee754":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js","is-array":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/node_modules/is-array/index.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js":[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js":[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/node_modules/is-array/index.js":[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js":[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/isarray/index.js":[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js":[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/duplex.js":[function(require,module,exports){
module.exports = require("./lib/_stream_duplex.js")

},{"./lib/_stream_duplex.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_duplex.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_duplex.js":[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

module.exports = Duplex;

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}
/*</replacement>*/


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

forEach(objectKeys(Writable.prototype), function(method) {
  if (!Duplex.prototype[method])
    Duplex.prototype[method] = Writable.prototype[method];
});

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  process.nextTick(this.end.bind(this));
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

}).call(this,require('_process'))
},{"./_stream_readable":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_readable.js","./_stream_writable":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_writable.js","_process":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","core-util-is":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/node_modules/core-util-is/lib/util.js","inherits":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_passthrough.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./_stream_transform":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_transform.js","core-util-is":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/node_modules/core-util-is/lib/util.js","inherits":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_readable.js":[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events').EventEmitter;

/*<replacement>*/
if (!EE.listenerCount) EE.listenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

var Stream = require('stream');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var StringDecoder;

util.inherits(Readable, Stream);

function ReadableState(options, stream) {
  options = options || {};

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = false;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // In streams that never have any data, and do push(null) right away,
  // the consumer can miss the 'end' event if they do some I/O before
  // consuming the stream.  So, we don't emit('end') until some reading
  // happens.
  this.calledRead = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;


  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (typeof chunk === 'string' && !state.objectMode) {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null || chunk === undefined) {
    state.reading = false;
    if (!state.ended)
      onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      // update the buffer info.
      state.length += state.objectMode ? 1 : chunk.length;
      if (addToFront) {
        state.buffer.unshift(chunk);
      } else {
        state.reading = false;
        state.buffer.push(chunk);
      }

      if (state.needReadable)
        emitReadable(stream);

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}



// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
};

// Don't raise the hwm > 128MB
var MAX_HWM = 0x800000;
function roundUpToNextPowerOf2(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (n === null || isNaN(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = roundUpToNextPowerOf2(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else
      return state.length;
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  var state = this._readableState;
  state.calledRead = true;
  var nOrig = n;
  var ret;

  if (typeof n !== 'number' || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    ret = null;

    // In cases where the decoder did not receive enough data
    // to produce a full chunk, then immediately received an
    // EOF, state.buffer will contain [<Buffer >, <Buffer 00 ...>].
    // howMuchToRead will see this and coerce the amount to
    // read to zero (because it's looking at the length of the
    // first <Buffer > in state.buffer), and we'll end up here.
    //
    // This can only happen via state.decoder -- no other venue
    // exists for pushing a zero-length chunk into state.buffer
    // and triggering this behavior. In this case, we return our
    // remaining data and end the stream, if appropriate.
    if (state.length > 0 && state.decoder) {
      ret = fromList(n, state);
      state.length -= ret.length;
    }

    if (state.length === 0)
      endReadable(this);

    return ret;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;

  // if we currently have less than the highWaterMark, then also read some
  if (state.length - n <= state.highWaterMark)
    doRead = true;

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading)
    doRead = false;

  if (doRead) {
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read called its callback synchronously, then `reading`
  // will be false, and we need to re-evaluate how much data we
  // can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we happened to read() exactly the remaining amount in the
  // buffer, and the EOF has been seen at this point, then make sure
  // that we emit 'end' on the very next tick.
  if (state.ended && !state.endEmitted && state.length === 0)
    endReadable(this);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.decoder && !state.ended) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // if we've ended and we have some data left, then emit
  // 'readable' now to make sure it gets picked up.
  if (state.length > 0)
    emitReadable(stream);
  else
    endReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (state.emittedReadable)
    return;

  state.emittedReadable = true;
  if (state.sync)
    process.nextTick(function() {
      emitReadable_(stream);
    });
  else
    emitReadable_(stream);
}

function emitReadable_(stream) {
  stream.emit('readable');
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    process.nextTick(function() {
      maybeReadMore_(stream, state);
    });
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    process.nextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    if (readable !== src) return;
    cleanup();
  }

  function onend() {
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (!dest._writableState || dest._writableState.needDrain)
      ondrain();
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    unpipe();
    dest.removeListener('error', onerror);
    if (EE.listenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];



  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    // the handler that waits for readable events after all
    // the data gets sucked out in flow.
    // This would be easier to follow with a .once() handler
    // in flow(), but that is too slow.
    this.on('readable', pipeOnReadable);

    state.flowing = true;
    process.nextTick(function() {
      flow(src);
    });
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var dest = this;
    var state = src._readableState;
    state.awaitDrain--;
    if (state.awaitDrain === 0)
      flow(src);
  };
}

function flow(src) {
  var state = src._readableState;
  var chunk;
  state.awaitDrain = 0;

  function write(dest, i, list) {
    var written = dest.write(chunk);
    if (false === written) {
      state.awaitDrain++;
    }
  }

  while (state.pipesCount && null !== (chunk = src.read())) {

    if (state.pipesCount === 1)
      write(state.pipes, 0, null);
    else
      forEach(state.pipes, write);

    src.emit('data', chunk);

    // if anyone needs a drain, then we have to wait for that.
    if (state.awaitDrain > 0)
      return;
  }

  // if every destination was unpiped, either before entering this
  // function, or in the while loop, then stop flowing.
  //
  // NB: This is a pretty rare edge case.
  if (state.pipesCount === 0) {
    state.flowing = false;

    // if there were data event listeners added, then switch to old mode.
    if (EE.listenerCount(src, 'data') > 0)
      emitDataEvents(src);
    return;
  }

  // at this point, no one needed a drain, so we just ran out of data
  // on the next readable event, start it over again.
  state.ranOut = true;
}

function pipeOnReadable() {
  if (this._readableState.ranOut) {
    this._readableState.ranOut = false;
    flow(this);
  }
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data' && !this._readableState.flowing)
    emitDataEvents(this);

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        this.read(0);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  emitDataEvents(this);
  this.read(0);
  this.emit('resume');
};

Readable.prototype.pause = function() {
  emitDataEvents(this, true);
  this.emit('pause');
};

function emitDataEvents(stream, startPaused) {
  var state = stream._readableState;

  if (state.flowing) {
    // https://github.com/isaacs/readable-stream/issues/16
    throw new Error('Cannot switch to old mode now.');
  }

  var paused = startPaused || false;
  var readable = false;

  // convert to an old-style stream.
  stream.readable = true;
  stream.pipe = Stream.prototype.pipe;
  stream.on = stream.addListener = Stream.prototype.on;

  stream.on('readable', function() {
    readable = true;

    var c;
    while (!paused && (null !== (c = stream.read())))
      stream.emit('data', c);

    if (c === null) {
      readable = false;
      stream._readableState.needReadable = true;
    }
  });

  stream.pause = function() {
    paused = true;
    this.emit('pause');
  };

  stream.resume = function() {
    paused = false;
    if (readable)
      process.nextTick(function() {
        stream.emit('readable');
      });
    else
      this.read(0);
    this.emit('resume');
  };

  // now make it start, just in case it hadn't already.
  stream.emit('readable');
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    if (state.decoder)
      chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    //if (state.objectMode && util.isNullOrUndefined(chunk))
    if (state.objectMode && (chunk === null || chunk === undefined))
      return;
    else if (!state.objectMode && (!chunk || !chunk.length))
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (typeof stream[i] === 'function' &&
        typeof this[i] === 'undefined') {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }}(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};



// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted && state.calledRead) {
    state.ended = true;
    process.nextTick(function() {
      // Check that we didn't get one last unshift.
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit('end');
      }
    });
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require('_process'))
},{"_process":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","buffer":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","core-util-is":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/node_modules/core-util-is/lib/util.js","events":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","inherits":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js","isarray":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/isarray/index.js","stream":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js","string_decoder/":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/string_decoder/index.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_transform.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.


// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(options, stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined)
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  var ts = this._transformState = new TransformState(options, this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  this.once('finish', function() {
    if ('function' === typeof this._flush)
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var rs = stream._readableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_duplex.js","core-util-is":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/node_modules/core-util-is/lib/util.js","inherits":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_writable.js":[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

module.exports = Writable;

/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Stream = require('stream');

util.inherits(Writable, Stream);

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
}

function WritableState(options, stream) {
  options = options || {};

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.buffer = [];

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

function Writable(options) {
  var Duplex = require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, state, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  process.nextTick(function() {
    cb(er);
  });
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    process.nextTick(function() {
      cb(er);
    });
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (typeof cb !== 'function')
    cb = function() {};

  if (state.ended)
    writeAfterEnd(this, state, cb);
  else if (validChunk(this, state, chunk, cb))
    ret = writeOrBuffer(this, state, chunk, encoding, cb);

  return ret;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      typeof chunk === 'string') {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);
  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing)
    state.buffer.push(new WriteReq(chunk, encoding, cb));
  else
    doWrite(stream, state, len, chunk, encoding, cb);

  return ret;
}

function doWrite(stream, state, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  if (sync)
    process.nextTick(function() {
      cb(er);
    });
  else
    cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(stream, state);

    if (!finished && !state.bufferProcessing && state.buffer.length)
      clearBuffer(stream, state);

    if (sync) {
      process.nextTick(function() {
        afterWrite(stream, state, finished, cb);
      });
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  cb();
  if (finished)
    finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;

  for (var c = 0; c < state.buffer.length; c++) {
    var entry = state.buffer[c];
    var chunk = entry.chunk;
    var encoding = entry.encoding;
    var cb = entry.callback;
    var len = state.objectMode ? 1 : chunk.length;

    doWrite(stream, state, len, chunk, encoding, cb);

    // if we didn't call the onwrite immediately, then
    // it means that we need to wait until it does.
    // also, that means that the chunk and cb are currently
    // being processed, so move the buffer counter past them.
    if (state.writing) {
      c++;
      break;
    }
  }

  state.bufferProcessing = false;
  if (c < state.buffer.length)
    state.buffer = state.buffer.slice(c);
  else
    state.buffer.length = 0;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (typeof chunk !== 'undefined' && chunk !== null)
    this.write(chunk, encoding);

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(stream, state) {
  return (state.ending &&
          state.length === 0 &&
          !state.finished &&
          !state.writing);
}

function finishMaybe(stream, state) {
  var need = needFinish(stream, state);
  if (need) {
    state.finished = true;
    stream.emit('finish');
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      process.nextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

}).call(this,require('_process'))
},{"./_stream_duplex":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_duplex.js","_process":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","buffer":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","core-util-is":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/node_modules/core-util-is/lib/util.js","inherits":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js","stream":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/node_modules/core-util-is/lib/util.js":[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

function isBuffer(arg) {
  return Buffer.isBuffer(arg);
}
exports.isBuffer = isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}
}).call(this,require("buffer").Buffer)
},{"buffer":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/passthrough.js":[function(require,module,exports){
module.exports = require("./lib/_stream_passthrough.js")

},{"./lib/_stream_passthrough.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_passthrough.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/readable.js":[function(require,module,exports){
require('stream'); // hack to fix a circular dependency issue when used with browserify
exports = module.exports = require('./lib/_stream_readable.js');
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_duplex.js","./lib/_stream_passthrough.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_passthrough.js","./lib/_stream_readable.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_readable.js","./lib/_stream_transform.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_transform.js","./lib/_stream_writable.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_writable.js","stream":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/transform.js":[function(require,module,exports){
module.exports = require("./lib/_stream_transform.js")

},{"./lib/_stream_transform.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_transform.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/writable.js":[function(require,module,exports){
module.exports = require("./lib/_stream_writable.js")

},{"./lib/_stream_writable.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_writable.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","inherits":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js","readable-stream/duplex.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/duplex.js","readable-stream/passthrough.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/passthrough.js","readable-stream/readable.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/readable.js","readable-stream/transform.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/transform.js","readable-stream/writable.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/writable.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/string_decoder/index.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/util/support/isBufferBrowser.js":[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js":[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/util/support/isBufferBrowser.js","_process":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","inherits":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js"}],"/home/eric/bulk/upload-anything/node_modules/filereader-stream/node_modules/inherits/inherits.js":[function(require,module,exports){
module.exports = inherits

function inherits (c, p, proto) {
  proto = proto || {}
  var e = {}
  ;[c.prototype, proto].forEach(function (s) {
    Object.getOwnPropertyNames(s).forEach(function (k) {
      e[k] = Object.getOwnPropertyDescriptor(s, k)
    })
  })
  c.prototype = Object.create(p.prototype, e)
  c.super = p
}

//function Child () {
//  Child.super.call(this)
//  console.error([this
//                ,this.constructor
//                ,this.constructor === Child
//                ,this.constructor.super === Parent
//                ,Object.getPrototypeOf(this) === Child.prototype
//                ,Object.getPrototypeOf(Object.getPrototypeOf(this))
//                 === Parent.prototype
//                ,this instanceof Child
//                ,this instanceof Parent])
//}
//function Parent () {}
//inherits(Child, Parent)
//new Child

},{}],"/home/eric/bulk/upload-anything/node_modules/s3-upload-stream/node_modules/setimmediate/setImmediate.js":[function(require,module,exports){
(function (process){
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

}).call(this,require('_process'))
},{"_process":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js"}],"/home/eric/bulk/upload-anything/node_modules/through2/node_modules/readable-stream/transform.js":[function(require,module,exports){
module.exports=require("/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/transform.js")
},{"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/transform.js":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/transform.js"}],"/home/eric/bulk/upload-anything/node_modules/through2/node_modules/xtend/immutable.js":[function(require,module,exports){
module.exports = extend

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],"aws-sdk":[function(require,module,exports){
// AWS SDK for JavaScript v2.0.19
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// License at https://sdk.amazonaws.com/js/BUNDLE_LICENSE.txt
(function e(t,r,n){function i(a,o){if(!r[a]){if(!t[a]){var u=typeof require=="function"&&require;if(!o&&u)return u(a,!0);if(s)return s(a,!0);throw new Error("Cannot find module '"+a+"'")}var c=r[a]={exports:{}};t[a][0].call(c.exports,function(e){var r=t[a][1][e];return i(r?r:e)},c,c.exports,e,t,r,n)}return r[a].exports}var s=typeof require=="function"&&require;for(var a=0;a<n.length;a++)i(n[a]);return i})({1:[function(e,t,r){var n=e("base64-js");var i=e("ieee754");r.Buffer=s;r.SlowBuffer=s;r.INSPECT_MAX_BYTES=50;s.poolSize=8192;s._useTypedArrays=function(){try{var e=new ArrayBuffer(0);var t=new Uint8Array(e);t.foo=function(){return 42};return 42===t.foo()&&typeof t.subarray==="function"}catch(r){return false}}();function s(e,t,r){if(!(this instanceof s))return new s(e,t,r);var n=typeof e;if(t==="base64"&&n==="string"){e=I(e);while(e.length%4!==0){e=e+"="}}var i;if(n==="number")i=j(e);else if(n==="string")i=s.byteLength(e,t);else if(n==="object")i=j(e.length);else throw new Error("First argument needs to be a number, array or string.");var a;if(s._useTypedArrays){a=s._augment(new Uint8Array(i))}else{a=this;a.length=i;a._isBuffer=true}var o;if(s._useTypedArrays&&typeof e.byteLength==="number"){a._set(e)}else if(O(e)){for(o=0;o<i;o++){if(s.isBuffer(e))a[o]=e.readUInt8(o);else a[o]=e[o]}}else if(n==="string"){a.write(e,0,t)}else if(n==="number"&&!s._useTypedArrays&&!r){for(o=0;o<i;o++){a[o]=0}}return a}s.isEncoding=function(e){switch(String(e).toLowerCase()){case"hex":case"utf8":case"utf-8":case"ascii":case"binary":case"base64":case"raw":case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return true;default:return false}};s.isBuffer=function(e){return!!(e!==null&&e!==undefined&&e._isBuffer)};s.byteLength=function(e,t){var r;e=e+"";switch(t||"utf8"){case"hex":r=e.length/2;break;case"utf8":case"utf-8":r=D(e).length;break;case"ascii":case"binary":case"raw":r=e.length;break;case"base64":r=H(e).length;break;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":r=e.length*2;break;default:throw new Error("Unknown encoding")}return r};s.concat=function(e,t){W(k(e),"Usage: Buffer.concat(list, [totalLength])\n"+"list should be an Array.");if(e.length===0){return new s(0)}else if(e.length===1){return e[0]}var r;if(typeof t!=="number"){t=0;for(r=0;r<e.length;r++){t+=e[r].length}}var n=new s(t);var i=0;for(r=0;r<e.length;r++){var a=e[r];a.copy(n,i);i+=a.length}return n};function a(e,t,r,n){r=Number(r)||0;var i=e.length-r;if(!n){n=i}else{n=Number(n);if(n>i){n=i}}var a=t.length;W(a%2===0,"Invalid hex string");if(n>a/2){n=a/2}for(var o=0;o<n;o++){var u=parseInt(t.substr(o*2,2),16);W(!isNaN(u),"Invalid hex string");e[r+o]=u}s._charsWritten=o*2;return o}function o(e,t,r,n){var i=s._charsWritten=M(D(t),e,r,n);return i}function u(e,t,r,n){var i=s._charsWritten=M(B(t),e,r,n);return i}function c(e,t,r,n){return u(e,t,r,n)}function f(e,t,r,n){var i=s._charsWritten=M(H(t),e,r,n);return i}function l(e,t,r,n){var i=s._charsWritten=M(U(t),e,r,n);return i}s.prototype.write=function(e,t,r,n){if(isFinite(t)){if(!isFinite(r)){n=r;r=undefined}}else{var i=n;n=t;t=r;r=i}t=Number(t)||0;var s=this.length-t;if(!r){r=s}else{r=Number(r);if(r>s){r=s}}n=String(n||"utf8").toLowerCase();var h;switch(n){case"hex":h=a(this,e,t,r);break;case"utf8":case"utf-8":h=o(this,e,t,r);break;case"ascii":h=u(this,e,t,r);break;case"binary":h=c(this,e,t,r);break;case"base64":h=f(this,e,t,r);break;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":h=l(this,e,t,r);break;default:throw new Error("Unknown encoding")}return h};s.prototype.toString=function(e,t,r){var n=this;e=String(e||"utf8").toLowerCase();t=Number(t)||0;r=r!==undefined?Number(r):r=n.length;if(r===t)return"";var i;switch(e){case"hex":i=m(n,t,r);break;case"utf8":case"utf-8":i=p(n,t,r);break;case"ascii":i=d(n,t,r);break;case"binary":i=v(n,t,r);break;case"base64":i=h(n,t,r);break;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":i=g(n,t,r);break;default:throw new Error("Unknown encoding")}return i};s.prototype.toJSON=function(){return{type:"Buffer",data:Array.prototype.slice.call(this._arr||this,0)}};s.prototype.copy=function(e,t,r,n){var i=this;if(!r)r=0;if(!n&&n!==0)n=this.length;if(!t)t=0;if(n===r)return;if(e.length===0||i.length===0)return;W(n>=r,"sourceEnd < sourceStart");W(t>=0&&t<e.length,"targetStart out of bounds");W(r>=0&&r<i.length,"sourceStart out of bounds");W(n>=0&&n<=i.length,"sourceEnd out of bounds");if(n>this.length)n=this.length;if(e.length-t<n-r)n=e.length-t+r;var a=n-r;if(a<100||!s._useTypedArrays){for(var o=0;o<a;o++)e[o+t]=this[o+r]}else{e._set(this.subarray(r,r+a),t)}};function h(e,t,r){if(t===0&&r===e.length){return n.fromByteArray(e)}else{return n.fromByteArray(e.slice(t,r))}}function p(e,t,r){var n="";var i="";r=Math.min(e.length,r);for(var s=t;s<r;s++){if(e[s]<=127){n+=z(i)+String.fromCharCode(e[s]);i=""}else{i+="%"+e[s].toString(16)}}return n+z(i)}function d(e,t,r){var n="";r=Math.min(e.length,r);for(var i=t;i<r;i++)n+=String.fromCharCode(e[i]);return n}function v(e,t,r){return d(e,t,r)}function m(e,t,r){var n=e.length;if(!t||t<0)t=0;if(!r||r<0||r>n)r=n;var i="";for(var s=t;s<r;s++){i+=N(e[s])}return i}function g(e,t,r){var n=e.slice(t,r);var i="";for(var s=0;s<n.length;s+=2){i+=String.fromCharCode(n[s]+n[s+1]*256)}return i}s.prototype.slice=function(e,t){var r=this.length;e=P(e,r,0);t=P(t,r,r);if(s._useTypedArrays){return s._augment(this.subarray(e,t))}else{var n=t-e;var i=new s(n,undefined,true);for(var a=0;a<n;a++){i[a]=this[a+e]}return i}};s.prototype.get=function(e){console.log(".get() is deprecated. Access using array indexes instead.");return this.readUInt8(e)};s.prototype.set=function(e,t){console.log(".set() is deprecated. Access using array indexes instead.");return this.writeUInt8(e,t)};s.prototype.readUInt8=function(e,t){if(!t){W(e!==undefined&&e!==null,"missing offset");W(e<this.length,"Trying to read beyond buffer length")}if(e>=this.length)return;return this[e]};function y(e,t,r,n){if(!n){W(typeof r==="boolean","missing or invalid endian");W(t!==undefined&&t!==null,"missing offset");W(t+1<e.length,"Trying to read beyond buffer length")}var i=e.length;if(t>=i)return;var s;if(r){s=e[t];if(t+1<i)s|=e[t+1]<<8}else{s=e[t]<<8;if(t+1<i)s|=e[t+1]}return s}s.prototype.readUInt16LE=function(e,t){return y(this,e,true,t)};s.prototype.readUInt16BE=function(e,t){return y(this,e,false,t)};function b(e,t,r,n){if(!n){W(typeof r==="boolean","missing or invalid endian");W(t!==undefined&&t!==null,"missing offset");W(t+3<e.length,"Trying to read beyond buffer length")}var i=e.length;if(t>=i)return;var s;if(r){if(t+2<i)s=e[t+2]<<16;if(t+1<i)s|=e[t+1]<<8;s|=e[t];if(t+3<i)s=s+(e[t+3]<<24>>>0)}else{if(t+1<i)s=e[t+1]<<16;if(t+2<i)s|=e[t+2]<<8;if(t+3<i)s|=e[t+3];s=s+(e[t]<<24>>>0)}return s}s.prototype.readUInt32LE=function(e,t){return b(this,e,true,t)};s.prototype.readUInt32BE=function(e,t){return b(this,e,false,t)};s.prototype.readInt8=function(e,t){if(!t){W(e!==undefined&&e!==null,"missing offset");W(e<this.length,"Trying to read beyond buffer length")}if(e>=this.length)return;var r=this[e]&128;if(r)return(255-this[e]+1)*-1;else return this[e]};function w(e,t,r,n){if(!n){W(typeof r==="boolean","missing or invalid endian");W(t!==undefined&&t!==null,"missing offset");W(t+1<e.length,"Trying to read beyond buffer length")}var i=e.length;if(t>=i)return;var s=y(e,t,r,true);var a=s&32768;if(a)return(65535-s+1)*-1;else return s}s.prototype.readInt16LE=function(e,t){return w(this,e,true,t)};s.prototype.readInt16BE=function(e,t){return w(this,e,false,t)};function E(e,t,r,n){if(!n){W(typeof r==="boolean","missing or invalid endian");W(t!==undefined&&t!==null,"missing offset");W(t+3<e.length,"Trying to read beyond buffer length")}var i=e.length;if(t>=i)return;var s=b(e,t,r,true);var a=s&2147483648;if(a)return(4294967295-s+1)*-1;else return s}s.prototype.readInt32LE=function(e,t){return E(this,e,true,t)};s.prototype.readInt32BE=function(e,t){return E(this,e,false,t)};function S(e,t,r,n){if(!n){W(typeof r==="boolean","missing or invalid endian");W(t+3<e.length,"Trying to read beyond buffer length")}return i.read(e,t,r,23,4)}s.prototype.readFloatLE=function(e,t){return S(this,e,true,t)};s.prototype.readFloatBE=function(e,t){return S(this,e,false,t)};function x(e,t,r,n){if(!n){W(typeof r==="boolean","missing or invalid endian");W(t+7<e.length,"Trying to read beyond buffer length")}return i.read(e,t,r,52,8)}s.prototype.readDoubleLE=function(e,t){return x(this,e,true,t)};s.prototype.readDoubleBE=function(e,t){return x(this,e,false,t)};s.prototype.writeUInt8=function(e,t,r){if(!r){W(e!==undefined&&e!==null,"missing value");W(t!==undefined&&t!==null,"missing offset");W(t<this.length,"trying to write beyond buffer length");V(e,255)}if(t>=this.length)return;this[t]=e};function R(e,t,r,n,i){if(!i){W(t!==undefined&&t!==null,"missing value");W(typeof n==="boolean","missing or invalid endian");W(r!==undefined&&r!==null,"missing offset");W(r+1<e.length,"trying to write beyond buffer length");V(t,65535)}var s=e.length;if(r>=s)return;for(var a=0,o=Math.min(s-r,2);a<o;a++){e[r+a]=(t&255<<8*(n?a:1-a))>>>(n?a:1-a)*8}}s.prototype.writeUInt16LE=function(e,t,r){R(this,e,t,true,r)};s.prototype.writeUInt16BE=function(e,t,r){R(this,e,t,false,r)};function A(e,t,r,n,i){if(!i){W(t!==undefined&&t!==null,"missing value");W(typeof n==="boolean","missing or invalid endian");W(r!==undefined&&r!==null,"missing offset");W(r+3<e.length,"trying to write beyond buffer length");V(t,4294967295)}var s=e.length;if(r>=s)return;for(var a=0,o=Math.min(s-r,4);a<o;a++){e[r+a]=t>>>(n?a:3-a)*8&255}}s.prototype.writeUInt32LE=function(e,t,r){A(this,e,t,true,r)};s.prototype.writeUInt32BE=function(e,t,r){A(this,e,t,false,r)};s.prototype.writeInt8=function(e,t,r){if(!r){W(e!==undefined&&e!==null,"missing value");W(t!==undefined&&t!==null,"missing offset");W(t<this.length,"Trying to write beyond buffer length");F(e,127,-128)}if(t>=this.length)return;if(e>=0)this.writeUInt8(e,t,r);else this.writeUInt8(255+e+1,t,r)};function C(e,t,r,n,i){if(!i){W(t!==undefined&&t!==null,"missing value");W(typeof n==="boolean","missing or invalid endian");W(r!==undefined&&r!==null,"missing offset");W(r+1<e.length,"Trying to write beyond buffer length");F(t,32767,-32768)}var s=e.length;if(r>=s)return;if(t>=0)R(e,t,r,n,i);else R(e,65535+t+1,r,n,i)}s.prototype.writeInt16LE=function(e,t,r){C(this,e,t,true,r)};s.prototype.writeInt16BE=function(e,t,r){C(this,e,t,false,r)};function T(e,t,r,n,i){if(!i){W(t!==undefined&&t!==null,"missing value");W(typeof n==="boolean","missing or invalid endian");W(r!==undefined&&r!==null,"missing offset");W(r+3<e.length,"Trying to write beyond buffer length");F(t,2147483647,-2147483648)}var s=e.length;if(r>=s)return;if(t>=0)A(e,t,r,n,i);else A(e,4294967295+t+1,r,n,i)}s.prototype.writeInt32LE=function(e,t,r){T(this,e,t,true,r)};s.prototype.writeInt32BE=function(e,t,r){T(this,e,t,false,r)};function q(e,t,r,n,s){if(!s){W(t!==undefined&&t!==null,"missing value");W(typeof n==="boolean","missing or invalid endian");W(r!==undefined&&r!==null,"missing offset");W(r+3<e.length,"Trying to write beyond buffer length");X(t,3.4028234663852886e38,-3.4028234663852886e38)}var a=e.length;if(r>=a)return;i.write(e,t,r,n,23,4)}s.prototype.writeFloatLE=function(e,t,r){q(this,e,t,true,r)};s.prototype.writeFloatBE=function(e,t,r){q(this,e,t,false,r)};function _(e,t,r,n,s){if(!s){W(t!==undefined&&t!==null,"missing value");W(typeof n==="boolean","missing or invalid endian");W(r!==undefined&&r!==null,"missing offset");W(r+7<e.length,"Trying to write beyond buffer length");X(t,1.7976931348623157e308,-1.7976931348623157e308)}var a=e.length;if(r>=a)return;i.write(e,t,r,n,52,8)}s.prototype.writeDoubleLE=function(e,t,r){_(this,e,t,true,r)};s.prototype.writeDoubleBE=function(e,t,r){_(this,e,t,false,r)};s.prototype.fill=function(e,t,r){if(!e)e=0;if(!t)t=0;if(!r)r=this.length;if(typeof e==="string"){e=e.charCodeAt(0)}W(typeof e==="number"&&!isNaN(e),"value is not a number");W(r>=t,"end < start");if(r===t)return;if(this.length===0)return;W(t>=0&&t<this.length,"start out of bounds");W(r>=0&&r<=this.length,"end out of bounds");for(var n=t;n<r;n++){this[n]=e}};s.prototype.inspect=function(){var e=[];var t=this.length;for(var n=0;n<t;n++){e[n]=N(this[n]);if(n===r.INSPECT_MAX_BYTES){e[n+1]="...";break}}return"<Buffer "+e.join(" ")+">"};s.prototype.toArrayBuffer=function(){if(typeof Uint8Array!=="undefined"){if(s._useTypedArrays){return new s(this).buffer}else{var e=new Uint8Array(this.length);for(var t=0,r=e.length;t<r;t+=1)e[t]=this[t];return e.buffer}}else{throw new Error("Buffer.toArrayBuffer not supported in this browser")}};function I(e){if(e.trim)return e.trim();return e.replace(/^\s+|\s+$/g,"")}var L=s.prototype;s._augment=function(e){e._isBuffer=true;e._get=e.get;e._set=e.set;e.get=L.get;e.set=L.set;e.write=L.write;e.toString=L.toString;e.toLocaleString=L.toString;e.toJSON=L.toJSON;e.copy=L.copy;e.slice=L.slice;e.readUInt8=L.readUInt8;e.readUInt16LE=L.readUInt16LE;e.readUInt16BE=L.readUInt16BE;e.readUInt32LE=L.readUInt32LE;e.readUInt32BE=L.readUInt32BE;e.readInt8=L.readInt8;e.readInt16LE=L.readInt16LE;e.readInt16BE=L.readInt16BE;e.readInt32LE=L.readInt32LE;e.readInt32BE=L.readInt32BE;e.readFloatLE=L.readFloatLE;e.readFloatBE=L.readFloatBE;e.readDoubleLE=L.readDoubleLE;e.readDoubleBE=L.readDoubleBE;e.writeUInt8=L.writeUInt8;e.writeUInt16LE=L.writeUInt16LE;e.writeUInt16BE=L.writeUInt16BE;e.writeUInt32LE=L.writeUInt32LE;e.writeUInt32BE=L.writeUInt32BE;e.writeInt8=L.writeInt8;e.writeInt16LE=L.writeInt16LE;e.writeInt16BE=L.writeInt16BE;e.writeInt32LE=L.writeInt32LE;e.writeInt32BE=L.writeInt32BE;e.writeFloatLE=L.writeFloatLE;e.writeFloatBE=L.writeFloatBE;e.writeDoubleLE=L.writeDoubleLE;e.writeDoubleBE=L.writeDoubleBE;e.fill=L.fill;e.inspect=L.inspect;e.toArrayBuffer=L.toArrayBuffer;return e};function P(e,t,r){if(typeof e!=="number")return r;e=~~e;if(e>=t)return t;if(e>=0)return e;e+=t;if(e>=0)return e;return 0}function j(e){e=~~Math.ceil(+e);return e<0?0:e}function k(e){return(Array.isArray||function(e){return Object.prototype.toString.call(e)==="[object Array]"})(e)}function O(e){return k(e)||s.isBuffer(e)||e&&typeof e==="object"&&typeof e.length==="number"}function N(e){if(e<16)return"0"+e.toString(16);return e.toString(16)}function D(e){var t=[];for(var r=0;r<e.length;r++){var n=e.charCodeAt(r);if(n<=127)t.push(e.charCodeAt(r));else{var i=r;if(n>=55296&&n<=57343)r++;var s=encodeURIComponent(e.slice(i,r+1)).substr(1).split("%");for(var a=0;a<s.length;a++)t.push(parseInt(s[a],16))}}return t}function B(e){var t=[];for(var r=0;r<e.length;r++){t.push(e.charCodeAt(r)&255)}return t}function U(e){var t,r,n;var i=[];for(var s=0;s<e.length;s++){t=e.charCodeAt(s);r=t>>8;n=t%256;i.push(n);i.push(r)}return i}function H(e){return n.toByteArray(e)}function M(e,t,r,n){var i;for(var s=0;s<n;s++){if(s+r>=t.length||s>=e.length)break;t[s+r]=e[s]}return s}function z(e){try{return decodeURIComponent(e)}catch(t){return String.fromCharCode(65533)}}function V(e,t){W(typeof e==="number","cannot write a non-number as a number");W(e>=0,"specified a negative value for writing an unsigned value");W(e<=t,"value is larger than maximum value for type");W(Math.floor(e)===e,"value has a fractional component")}function F(e,t,r){W(typeof e==="number","cannot write a non-number as a number");W(e<=t,"value larger than maximum allowed value");W(e>=r,"value smaller than minimum allowed value");W(Math.floor(e)===e,"value has a fractional component")}function X(e,t,r){W(typeof e==="number","cannot write a non-number as a number");W(e<=t,"value larger than maximum allowed value");W(e>=r,"value smaller than minimum allowed value")}function W(e,t){if(!e)throw new Error(t||"Failed assertion")}},{"base64-js":2,ieee754:3}],2:[function(e,t,r){var n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";(function(e){"use strict";var t=typeof Uint8Array!=="undefined"?Uint8Array:Array;var r="+".charCodeAt(0);var i="/".charCodeAt(0);var s="0".charCodeAt(0);var a="a".charCodeAt(0);var o="A".charCodeAt(0);function u(e){var t=e.charCodeAt(0);if(t===r)return 62;if(t===i)return 63;if(t<s)return-1;if(t<s+10)return t-s+26+26;if(t<o+26)return t-o;if(t<a+26)return t-a+26}function c(e){var r,n,i,s,a,o;if(e.length%4>0){throw new Error("Invalid string. Length must be a multiple of 4")}var c=e.length;a="="===e.charAt(c-2)?2:"="===e.charAt(c-1)?1:0;o=new t(e.length*3/4-a);i=a>0?e.length-4:e.length;var f=0;function l(e){o[f++]=e}for(r=0,n=0;r<i;r+=4,n+=3){s=u(e.charAt(r))<<18|u(e.charAt(r+1))<<12|u(e.charAt(r+2))<<6|u(e.charAt(r+3));l((s&16711680)>>16);l((s&65280)>>8);l(s&255)}if(a===2){s=u(e.charAt(r))<<2|u(e.charAt(r+1))>>4;l(s&255)}else if(a===1){s=u(e.charAt(r))<<10|u(e.charAt(r+1))<<4|u(e.charAt(r+2))>>2;l(s>>8&255);l(s&255)}return o}function f(e){var t,r=e.length%3,i="",s,a;function o(e){return n.charAt(e)}function u(e){return o(e>>18&63)+o(e>>12&63)+o(e>>6&63)+o(e&63)}for(t=0,a=e.length-r;t<a;t+=3){s=(e[t]<<16)+(e[t+1]<<8)+e[t+2];i+=u(s)}switch(r){case 1:s=e[e.length-1];i+=o(s>>2);i+=o(s<<4&63);i+="==";break;case 2:s=(e[e.length-2]<<8)+e[e.length-1];i+=o(s>>10);i+=o(s>>4&63);i+=o(s<<2&63);i+="=";break}return i}e.toByteArray=c;e.fromByteArray=f})(typeof r==="undefined"?this.base64js={}:r)},{}],3:[function(e,t,r){r.read=function(e,t,r,n,i){var s,a,o=i*8-n-1,u=(1<<o)-1,c=u>>1,f=-7,l=r?i-1:0,h=r?-1:1,p=e[t+l];l+=h;s=p&(1<<-f)-1;p>>=-f;f+=o;for(;f>0;s=s*256+e[t+l],l+=h,f-=8);a=s&(1<<-f)-1;s>>=-f;f+=n;for(;f>0;a=a*256+e[t+l],l+=h,f-=8);if(s===0){s=1-c}else if(s===u){return a?NaN:(p?-1:1)*Infinity}else{a=a+Math.pow(2,n);s=s-c}return(p?-1:1)*a*Math.pow(2,s-n)};r.write=function(e,t,r,n,i,s){var a,o,u,c=s*8-i-1,f=(1<<c)-1,l=f>>1,h=i===23?Math.pow(2,-24)-Math.pow(2,-77):0,p=n?0:s-1,d=n?1:-1,v=t<0||t===0&&1/t<0?1:0;t=Math.abs(t);if(isNaN(t)||t===Infinity){o=isNaN(t)?1:0;a=f}else{a=Math.floor(Math.log(t)/Math.LN2);if(t*(u=Math.pow(2,-a))<1){a--;u*=2}if(a+l>=1){t+=h/u}else{t+=h*Math.pow(2,1-l)}if(t*u>=2){a++;u/=2}if(a+l>=f){o=0;a=f}else if(a+l>=1){o=(t*u-1)*Math.pow(2,i);a=a+l}else{o=t*Math.pow(2,l-1)*Math.pow(2,i);a=0}}for(;i>=8;e[r+p]=o&255,p+=d,o/=256,i-=8);a=a<<i|o;c+=i;for(;c>0;e[r+p]=a&255,p+=d,a/=256,c-=8);e[r+p-d]|=v*128}},{}],4:[function(e,t,r){var n=e("buffer").Buffer;var i=4;var s=new n(i);s.fill(0);var a=8;function o(e,t){if(e.length%i!==0){var r=e.length+(i-e.length%i);e=n.concat([e,s],r)}var a=[];var o=t?e.readInt32BE:e.readInt32LE;for(var u=0;u<e.length;u+=i){a.push(o.call(e,u))}return a}function u(e,t,r){var i=new n(t);var s=r?i.writeInt32BE:i.writeInt32LE;for(var a=0;a<e.length;a++){s.call(i,e[a],a*4,true)}return i}function c(e,t,r,i){if(!n.isBuffer(e))e=new n(e);var s=t(o(e,i),e.length*a);return u(s,r,i)}t.exports={hash:c}},{buffer:1}],5:[function(e,t,r){var n=e("buffer").Buffer;var i=e("./sha");var s=e("./sha256");var a=e("./rng");var o=e("./md5");var u={sha1:i,sha256:s,md5:o};var c=64;var f=new n(c);f.fill(0);function l(e,t,r){if(!n.isBuffer(t))t=new n(t);if(!n.isBuffer(r))r=new n(r);if(t.length>c){t=e(t)}else if(t.length<c){t=n.concat([t,f],c)}var i=new n(c),s=new n(c);for(var a=0;a<c;a++){i[a]=t[a]^54;s[a]=t[a]^92}var o=e(n.concat([i,r]));return e(n.concat([s,o]))}function h(e,t){e=e||"sha1";var r=u[e];var i=[];var s=0;if(!r)p("algorithm:",e,"is not yet supported");return{update:function(e){if(!n.isBuffer(e))e=new n(e);i.push(e);s+=e.length;return this},digest:function(e){var s=n.concat(i);var a=t?l(r,t,s):r(s);i=null;return e?a.toString(e):a}}}function p(){var e=[].slice.call(arguments).join(" ");throw new Error([e,"we accept pull requests","http://github.com/dominictarr/crypto-browserify"].join("\n"))}r.createHash=function(e){return h(e)};r.createHmac=function(e,t){return h(e,t)};r.randomBytes=function(e,t){if(t&&t.call){try{t.call(this,undefined,new n(a(e)))}catch(r){t(r)}}else{return new n(a(e))}};function d(e,t){for(var r in e)t(e[r],r)}d(["createCredentials","createCipher","createCipheriv","createDecipher","createDecipheriv","createSign","createVerify","createDiffieHellman","pbkdf2"],function(e){r[e]=function(){p("sorry,",e,"is not implemented yet")}})},{"./md5":6,"./rng":7,"./sha":8,"./sha256":9,buffer:1}],6:[function(e,t,r){var n=e("./helpers");function i(){return hex_md5("abc")=="900150983cd24fb0d6963f7d28e17f72"}function s(e,t){e[t>>5]|=128<<t%32;e[(t+64>>>9<<4)+14]=t;var r=1732584193;var n=-271733879;var i=-1732584194;var s=271733878;for(var a=0;a<e.length;a+=16){var h=r;var p=n;var d=i;var v=s;r=o(r,n,i,s,e[a+0],7,-680876936);s=o(s,r,n,i,e[a+1],12,-389564586);i=o(i,s,r,n,e[a+2],17,606105819);n=o(n,i,s,r,e[a+3],22,-1044525330);r=o(r,n,i,s,e[a+4],7,-176418897);s=o(s,r,n,i,e[a+5],12,1200080426);i=o(i,s,r,n,e[a+6],17,-1473231341);n=o(n,i,s,r,e[a+7],22,-45705983);r=o(r,n,i,s,e[a+8],7,1770035416);s=o(s,r,n,i,e[a+9],12,-1958414417);i=o(i,s,r,n,e[a+10],17,-42063);n=o(n,i,s,r,e[a+11],22,-1990404162);r=o(r,n,i,s,e[a+12],7,1804603682);s=o(s,r,n,i,e[a+13],12,-40341101);i=o(i,s,r,n,e[a+14],17,-1502002290);n=o(n,i,s,r,e[a+15],22,1236535329);r=u(r,n,i,s,e[a+1],5,-165796510);s=u(s,r,n,i,e[a+6],9,-1069501632);i=u(i,s,r,n,e[a+11],14,643717713);n=u(n,i,s,r,e[a+0],20,-373897302);r=u(r,n,i,s,e[a+5],5,-701558691);s=u(s,r,n,i,e[a+10],9,38016083);i=u(i,s,r,n,e[a+15],14,-660478335);n=u(n,i,s,r,e[a+4],20,-405537848);r=u(r,n,i,s,e[a+9],5,568446438);s=u(s,r,n,i,e[a+14],9,-1019803690);i=u(i,s,r,n,e[a+3],14,-187363961);n=u(n,i,s,r,e[a+8],20,1163531501);r=u(r,n,i,s,e[a+13],5,-1444681467);s=u(s,r,n,i,e[a+2],9,-51403784);i=u(i,s,r,n,e[a+7],14,1735328473);n=u(n,i,s,r,e[a+12],20,-1926607734);r=c(r,n,i,s,e[a+5],4,-378558);s=c(s,r,n,i,e[a+8],11,-2022574463);i=c(i,s,r,n,e[a+11],16,1839030562);n=c(n,i,s,r,e[a+14],23,-35309556);r=c(r,n,i,s,e[a+1],4,-1530992060);s=c(s,r,n,i,e[a+4],11,1272893353);i=c(i,s,r,n,e[a+7],16,-155497632);n=c(n,i,s,r,e[a+10],23,-1094730640);r=c(r,n,i,s,e[a+13],4,681279174);s=c(s,r,n,i,e[a+0],11,-358537222);i=c(i,s,r,n,e[a+3],16,-722521979);n=c(n,i,s,r,e[a+6],23,76029189);r=c(r,n,i,s,e[a+9],4,-640364487);s=c(s,r,n,i,e[a+12],11,-421815835);i=c(i,s,r,n,e[a+15],16,530742520);n=c(n,i,s,r,e[a+2],23,-995338651);r=f(r,n,i,s,e[a+0],6,-198630844);s=f(s,r,n,i,e[a+7],10,1126891415);i=f(i,s,r,n,e[a+14],15,-1416354905);n=f(n,i,s,r,e[a+5],21,-57434055);r=f(r,n,i,s,e[a+12],6,1700485571);s=f(s,r,n,i,e[a+3],10,-1894986606);i=f(i,s,r,n,e[a+10],15,-1051523);n=f(n,i,s,r,e[a+1],21,-2054922799);r=f(r,n,i,s,e[a+8],6,1873313359);s=f(s,r,n,i,e[a+15],10,-30611744);i=f(i,s,r,n,e[a+6],15,-1560198380);n=f(n,i,s,r,e[a+13],21,1309151649);r=f(r,n,i,s,e[a+4],6,-145523070);s=f(s,r,n,i,e[a+11],10,-1120210379);i=f(i,s,r,n,e[a+2],15,718787259);n=f(n,i,s,r,e[a+9],21,-343485551);r=l(r,h);n=l(n,p);i=l(i,d);s=l(s,v)}return Array(r,n,i,s)}function a(e,t,r,n,i,s){return l(h(l(l(t,e),l(n,s)),i),r)}function o(e,t,r,n,i,s,o){return a(t&r|~t&n,e,t,i,s,o)}function u(e,t,r,n,i,s,o){return a(t&n|r&~n,e,t,i,s,o)}function c(e,t,r,n,i,s,o){return a(t^r^n,e,t,i,s,o)}function f(e,t,r,n,i,s,o){return a(r^(t|~n),e,t,i,s,o)}function l(e,t){var r=(e&65535)+(t&65535);var n=(e>>16)+(t>>16)+(r>>16);return n<<16|r&65535}function h(e,t){return e<<t|e>>>32-t}t.exports=function p(e){return n.hash(e,s,16)}},{"./helpers":4}],7:[function(e,t,r){(function(){var e=this;var r,n;r=function(e){var t=new Array(e);var r;for(var n=0,r;n<e;n++){if((n&3)==0)r=Math.random()*4294967296;t[n]=r>>>((n&3)<<3)&255}return t};if(e.crypto&&crypto.getRandomValues){n=function(e){var t=new Uint8Array(e);crypto.getRandomValues(t);return t}}t.exports=n||r})()},{}],8:[function(e,t,r){var n=e("./helpers");function i(e,t){e[t>>5]|=128<<24-t%32;e[(t+64>>9<<4)+15]=t;var r=Array(80);var n=1732584193;var i=-271733879;var c=-1732584194;var f=271733878;var l=-1009589776;for(var h=0;h<e.length;h+=16){var p=n;var d=i;var v=c;var m=f;var g=l;for(var y=0;y<80;y++){if(y<16)r[y]=e[h+y];else r[y]=u(r[y-3]^r[y-8]^r[y-14]^r[y-16],1);var b=o(o(u(n,5),s(y,i,c,f)),o(o(l,r[y]),a(y)));l=f;f=c;c=u(i,30);i=n;n=b}n=o(n,p);i=o(i,d);c=o(c,v);f=o(f,m);l=o(l,g)}return Array(n,i,c,f,l)}function s(e,t,r,n){if(e<20)return t&r|~t&n;if(e<40)return t^r^n;if(e<60)return t&r|t&n|r&n;return t^r^n}function a(e){return e<20?1518500249:e<40?1859775393:e<60?-1894007588:-899497514}function o(e,t){var r=(e&65535)+(t&65535);var n=(e>>16)+(t>>16)+(r>>16);return n<<16|r&65535}function u(e,t){return e<<t|e>>>32-t}t.exports=function c(e){return n.hash(e,i,20,true)}},{"./helpers":4}],9:[function(e,t,r){var n=e("./helpers");var i=function(e,t){var r=(e&65535)+(t&65535);var n=(e>>16)+(t>>16)+(r>>16);return n<<16|r&65535};var s=function(e,t){return e>>>t|e<<32-t};var a=function(e,t){return e>>>t};var o=function(e,t,r){return e&t^~e&r};var u=function(e,t,r){return e&t^e&r^t&r};var c=function(e){return s(e,2)^s(e,13)^s(e,22)};var f=function(e){return s(e,6)^s(e,11)^s(e,25)};var l=function(e){return s(e,7)^s(e,18)^a(e,3)};var h=function(e){return s(e,17)^s(e,19)^a(e,10)};var p=function(e,t){var r=new Array(1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298);var n=new Array(1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225);var s=new Array(64);var a,p,d,v,m,g,y,b,w,E;var S,x;e[t>>5]|=128<<24-t%32;e[(t+64>>9<<4)+15]=t;for(var w=0;w<e.length;w+=16){a=n[0];p=n[1];d=n[2];v=n[3];m=n[4];g=n[5];y=n[6];b=n[7];for(var E=0;E<64;E++){if(E<16){s[E]=e[E+w]}else{s[E]=i(i(i(h(s[E-2]),s[E-7]),l(s[E-15])),s[E-16])}S=i(i(i(i(b,f(m)),o(m,g,y)),r[E]),s[E]);x=i(c(a),u(a,p,d));b=y;y=g;g=m;m=i(v,S);v=d;d=p;p=a;a=i(S,x)}n[0]=i(a,n[0]);n[1]=i(p,n[1]);n[2]=i(d,n[2]);n[3]=i(v,n[3]);n[4]=i(m,n[4]);n[5]=i(g,n[5]);n[6]=i(y,n[6]);n[7]=i(b,n[7])}return n};t.exports=function d(e){return n.hash(e,p,32,true)}},{"./helpers":4}],10:[function(e,t,r){function n(){this._events=this._events||{};this._maxListeners=this._maxListeners||undefined}t.exports=n;n.EventEmitter=n;n.prototype._events=undefined;n.prototype._maxListeners=undefined;n.defaultMaxListeners=10;n.prototype.setMaxListeners=function(e){if(!s(e)||e<0||isNaN(e))throw TypeError("n must be a positive number");this._maxListeners=e;return this};n.prototype.emit=function(e){var t,r,n,s,u,c;if(!this._events)this._events={};if(e==="error"){if(!this._events.error||a(this._events.error)&&!this._events.error.length){t=arguments[1];if(t instanceof Error){throw t}else{throw TypeError('Uncaught, unspecified "error" event.')}return false}}r=this._events[e];if(o(r))return false;if(i(r)){switch(arguments.length){case 1:r.call(this);break;case 2:r.call(this,arguments[1]);break;case 3:r.call(this,arguments[1],arguments[2]);break;default:n=arguments.length;s=new Array(n-1);for(u=1;u<n;u++)s[u-1]=arguments[u];r.apply(this,s)}}else if(a(r)){n=arguments.length;s=new Array(n-1);for(u=1;u<n;u++)s[u-1]=arguments[u];c=r.slice();n=c.length;for(u=0;u<n;u++)c[u].apply(this,s)}return true};n.prototype.addListener=function(e,t){var r;if(!i(t))throw TypeError("listener must be a function");if(!this._events)this._events={};if(this._events.newListener)this.emit("newListener",e,i(t.listener)?t.listener:t);if(!this._events[e])this._events[e]=t;else if(a(this._events[e]))this._events[e].push(t);else this._events[e]=[this._events[e],t];if(a(this._events[e])&&!this._events[e].warned){var r;if(!o(this._maxListeners)){r=this._maxListeners}else{r=n.defaultMaxListeners}if(r&&r>0&&this._events[e].length>r){this._events[e].warned=true;console.error("(node) warning: possible EventEmitter memory "+"leak detected. %d listeners added. "+"Use emitter.setMaxListeners() to increase limit.",this._events[e].length);if(typeof console.trace==="function"){console.trace()}}}return this};n.prototype.on=n.prototype.addListener;n.prototype.once=function(e,t){if(!i(t))throw TypeError("listener must be a function");var r=false;function n(){this.removeListener(e,n);if(!r){r=true;t.apply(this,arguments)}}n.listener=t;this.on(e,n);return this};n.prototype.removeListener=function(e,t){var r,n,s,o;if(!i(t))throw TypeError("listener must be a function");if(!this._events||!this._events[e])return this;r=this._events[e];s=r.length;n=-1;if(r===t||i(r.listener)&&r.listener===t){delete this._events[e];if(this._events.removeListener)this.emit("removeListener",e,t)}else if(a(r)){for(o=s;o-->0;){if(r[o]===t||r[o].listener&&r[o].listener===t){n=o;break}}if(n<0)return this;if(r.length===1){r.length=0;delete this._events[e]}else{r.splice(n,1)}if(this._events.removeListener)this.emit("removeListener",e,t)}return this};n.prototype.removeAllListeners=function(e){var t,r;if(!this._events)return this;if(!this._events.removeListener){if(arguments.length===0)this._events={};else if(this._events[e])delete this._events[e];return this}if(arguments.length===0){for(t in this._events){if(t==="removeListener")continue;this.removeAllListeners(t)}this.removeAllListeners("removeListener");this._events={};return this}r=this._events[e];if(i(r)){this.removeListener(e,r)}else{while(r.length)this.removeListener(e,r[r.length-1])}delete this._events[e];return this};n.prototype.listeners=function(e){var t;if(!this._events||!this._events[e])t=[];else if(i(this._events[e]))t=[this._events[e]];else t=this._events[e].slice();return t};n.listenerCount=function(e,t){var r;if(!e._events||!e._events[t])r=0;else if(i(e._events[t]))r=1;else r=e._events[t].length;return r};function i(e){return typeof e==="function"}function s(e){return typeof e==="number"}function a(e){return typeof e==="object"&&e!==null}function o(e){return e===void 0}},{}],11:[function(e,t,r){if(typeof Object.create==="function"){t.exports=function n(e,t){e.super_=t;e.prototype=Object.create(t.prototype,{constructor:{value:e,enumerable:false,writable:true,configurable:true}})}}else{t.exports=function i(e,t){e.super_=t;var r=function(){};r.prototype=t.prototype;e.prototype=new r;e.prototype.constructor=e}}},{}],12:[function(e,t,r){var n=t.exports={};n.nextTick=function(){var e=typeof window!=="undefined"&&window.setImmediate;var t=typeof window!=="undefined"&&window.postMessage&&window.addEventListener;if(e){return function(e){return window.setImmediate(e)}}if(t){var r=[];window.addEventListener("message",function(e){var t=e.source;if((t===window||t===null)&&e.data==="process-tick"){e.stopPropagation();if(r.length>0){var n=r.shift();n()}}},true);return function n(e){r.push(e);window.postMessage("process-tick","*")}}return function i(e){setTimeout(e,0)}}();n.title="browser";n.browser=true;n.env={};n.argv=[];function i(){}n.on=i;n.addListener=i;n.once=i;n.off=i;n.removeListener=i;n.removeAllListeners=i;n.emit=i;n.binding=function(e){throw new Error("process.binding is not supported")};n.cwd=function(){return"/"};n.chdir=function(e){throw new Error("process.chdir is not supported")}},{}],13:[function(e,t,r){(function(e){(function(n){var i=typeof r=="object"&&r;var s=typeof t=="object"&&t&&t.exports==i&&t;var a=typeof e=="object"&&e;if(a.global===a||a.window===a){n=a}var o,u=2147483647,c=36,f=1,l=26,h=38,p=700,d=72,v=128,m="-",g=/^xn--/,y=/[^ -~]/,b=/\x2E|\u3002|\uFF0E|\uFF61/g,w={overflow:"Overflow: input needs wider integers to process","not-basic":"Illegal input >= 0x80 (not a basic code point)","invalid-input":"Invalid input"},E=c-f,S=Math.floor,x=String.fromCharCode,R;function A(e){throw RangeError(w[e])}function C(e,t){var r=e.length;while(r--){e[r]=t(e[r])}return e}function T(e,t){return C(e.split(b),t).join(".")}function q(e){var t=[],r=0,n=e.length,i,s;while(r<n){i=e.charCodeAt(r++);if(i>=55296&&i<=56319&&r<n){s=e.charCodeAt(r++);if((s&64512)==56320){t.push(((i&1023)<<10)+(s&1023)+65536)}else{t.push(i);r--}}else{t.push(i)
}}return t}function _(e){return C(e,function(e){var t="";if(e>65535){e-=65536;t+=x(e>>>10&1023|55296);e=56320|e&1023}t+=x(e);return t}).join("")}function I(e){if(e-48<10){return e-22}if(e-65<26){return e-65}if(e-97<26){return e-97}return c}function L(e,t){return e+22+75*(e<26)-((t!=0)<<5)}function P(e,t,r){var n=0;e=r?S(e/p):e>>1;e+=S(e/t);for(;e>E*l>>1;n+=c){e=S(e/E)}return S(n+(E+1)*e/(e+h))}function j(e){var t=[],r=e.length,n,i=0,s=v,a=d,o,h,p,g,y,b,w,E,x;o=e.lastIndexOf(m);if(o<0){o=0}for(h=0;h<o;++h){if(e.charCodeAt(h)>=128){A("not-basic")}t.push(e.charCodeAt(h))}for(p=o>0?o+1:0;p<r;){for(g=i,y=1,b=c;;b+=c){if(p>=r){A("invalid-input")}w=I(e.charCodeAt(p++));if(w>=c||w>S((u-i)/y)){A("overflow")}i+=w*y;E=b<=a?f:b>=a+l?l:b-a;if(w<E){break}x=c-E;if(y>S(u/x)){A("overflow")}y*=x}n=t.length+1;a=P(i-g,n,g==0);if(S(i/n)>u-s){A("overflow")}s+=S(i/n);i%=n;t.splice(i++,0,s)}return _(t)}function k(e){var t,r,n,i,s,a,o,h,p,g,y,b=[],w,E,R,C;e=q(e);w=e.length;t=v;r=0;s=d;for(a=0;a<w;++a){y=e[a];if(y<128){b.push(x(y))}}n=i=b.length;if(i){b.push(m)}while(n<w){for(o=u,a=0;a<w;++a){y=e[a];if(y>=t&&y<o){o=y}}E=n+1;if(o-t>S((u-r)/E)){A("overflow")}r+=(o-t)*E;t=o;for(a=0;a<w;++a){y=e[a];if(y<t&&++r>u){A("overflow")}if(y==t){for(h=r,p=c;;p+=c){g=p<=s?f:p>=s+l?l:p-s;if(h<g){break}C=h-g;R=c-g;b.push(x(L(g+C%R,0)));h=S(C/R)}b.push(x(L(h,0)));s=P(r,E,n==i);r=0;++n}}++r;++t}return b.join("")}function O(e){return T(e,function(e){return g.test(e)?j(e.slice(4).toLowerCase()):e})}function N(e){return T(e,function(e){return y.test(e)?"xn--"+k(e):e})}o={version:"1.2.4",ucs2:{decode:q,encode:_},decode:j,encode:k,toASCII:N,toUnicode:O};if(typeof define=="function"&&typeof define.amd=="object"&&define.amd){define("punycode",function(){return o})}else if(i&&!i.nodeType){if(s){s.exports=o}else{for(R in o){o.hasOwnProperty(R)&&(i[R]=o[R])}}}else{n.punycode=o}})(this)}).call(this,typeof self!=="undefined"?self:typeof window!=="undefined"?window:{})},{}],14:[function(e,t,r){"use strict";function n(e,t){return Object.prototype.hasOwnProperty.call(e,t)}t.exports=function(e,t,r,s){t=t||"&";r=r||"=";var a={};if(typeof e!=="string"||e.length===0){return a}var o=/\+/g;e=e.split(t);var u=1e3;if(s&&typeof s.maxKeys==="number"){u=s.maxKeys}var c=e.length;if(u>0&&c>u){c=u}for(var f=0;f<c;++f){var l=e[f].replace(o,"%20"),h=l.indexOf(r),p,d,v,m;if(h>=0){p=l.substr(0,h);d=l.substr(h+1)}else{p=l;d=""}v=decodeURIComponent(p);m=decodeURIComponent(d);if(!n(a,v)){a[v]=m}else if(i(a[v])){a[v].push(m)}else{a[v]=[a[v],m]}}return a};var i=Array.isArray||function(e){return Object.prototype.toString.call(e)==="[object Array]"}},{}],15:[function(e,t,r){"use strict";var n=function(e){switch(typeof e){case"string":return e;case"boolean":return e?"true":"false";case"number":return isFinite(e)?e:"";default:return""}};t.exports=function(e,t,r,o){t=t||"&";r=r||"=";if(e===null){e=undefined}if(typeof e==="object"){return s(a(e),function(s){var a=encodeURIComponent(n(s))+r;if(i(e[s])){return e[s].map(function(e){return a+encodeURIComponent(n(e))}).join(t)}else{return a+encodeURIComponent(n(e[s]))}}).join(t)}if(!o)return"";return encodeURIComponent(n(o))+r+encodeURIComponent(n(e))};var i=Array.isArray||function(e){return Object.prototype.toString.call(e)==="[object Array]"};function s(e,t){if(e.map)return e.map(t);var r=[];for(var n=0;n<e.length;n++){r.push(t(e[n],n))}return r}var a=Object.keys||function(e){var t=[];for(var r in e){if(Object.prototype.hasOwnProperty.call(e,r))t.push(r)}return t}},{}],16:[function(e,t,r){"use strict";r.decode=r.parse=e("./decode");r.encode=r.stringify=e("./encode")},{"./decode":14,"./encode":15}],17:[function(e,t,r){var n=e("punycode");r.parse=b;r.resolve=E;r.resolveObject=S;r.format=w;r.Url=i;function i(){this.protocol=null;this.slashes=null;this.auth=null;this.host=null;this.port=null;this.hostname=null;this.hash=null;this.search=null;this.query=null;this.pathname=null;this.path=null;this.href=null}var s=/^([a-z0-9.+-]+:)/i,a=/:[0-9]*$/,o=["<",">",'"',"`"," ","\r","\n","	"],u=["{","}","|","\\","^","`"].concat(o),c=["'"].concat(u),f=["%","/","?",";","#"].concat(c),l=["/","?","#"],h=255,p=/^[a-z0-9A-Z_-]{0,63}$/,d=/^([a-z0-9A-Z_-]{0,63})(.*)$/,v={javascript:true,"javascript:":true},m={javascript:true,"javascript:":true},g={http:true,https:true,ftp:true,gopher:true,file:true,"http:":true,"https:":true,"ftp:":true,"gopher:":true,"file:":true},y=e("querystring");function b(e,t,r){if(e&&R(e)&&e instanceof i)return e;var n=new i;n.parse(e,t,r);return n}i.prototype.parse=function(e,t,r){if(!x(e)){throw new TypeError("Parameter 'url' must be a string, not "+typeof e)}var i=e;i=i.trim();var a=s.exec(i);if(a){a=a[0];var o=a.toLowerCase();this.protocol=o;i=i.substr(a.length)}if(r||a||i.match(/^\/\/[^@\/]+@[^@\/]+/)){var u=i.substr(0,2)==="//";if(u&&!(a&&m[a])){i=i.substr(2);this.slashes=true}}if(!m[a]&&(u||a&&!g[a])){var b=-1;for(var w=0;w<l.length;w++){var E=i.indexOf(l[w]);if(E!==-1&&(b===-1||E<b))b=E}var S,R;if(b===-1){R=i.lastIndexOf("@")}else{R=i.lastIndexOf("@",b)}if(R!==-1){S=i.slice(0,R);i=i.slice(R+1);this.auth=decodeURIComponent(S)}b=-1;for(var w=0;w<f.length;w++){var E=i.indexOf(f[w]);if(E!==-1&&(b===-1||E<b))b=E}if(b===-1)b=i.length;this.host=i.slice(0,b);i=i.slice(b);this.parseHost();this.hostname=this.hostname||"";var A=this.hostname[0]==="["&&this.hostname[this.hostname.length-1]==="]";if(!A){var C=this.hostname.split(/\./);for(var w=0,T=C.length;w<T;w++){var q=C[w];if(!q)continue;if(!q.match(p)){var _="";for(var I=0,L=q.length;I<L;I++){if(q.charCodeAt(I)>127){_+="x"}else{_+=q[I]}}if(!_.match(p)){var P=C.slice(0,w);var j=C.slice(w+1);var k=q.match(d);if(k){P.push(k[1]);j.unshift(k[2])}if(j.length){i="/"+j.join(".")+i}this.hostname=P.join(".");break}}}}if(this.hostname.length>h){this.hostname=""}else{this.hostname=this.hostname.toLowerCase()}if(!A){var O=this.hostname.split(".");var N=[];for(var w=0;w<O.length;++w){var D=O[w];N.push(D.match(/[^A-Za-z0-9_-]/)?"xn--"+n.encode(D):D)}this.hostname=N.join(".")}var B=this.port?":"+this.port:"";var U=this.hostname||"";this.host=U+B;this.href+=this.host;if(A){this.hostname=this.hostname.substr(1,this.hostname.length-2);if(i[0]!=="/"){i="/"+i}}}if(!v[o]){for(var w=0,T=c.length;w<T;w++){var H=c[w];var M=encodeURIComponent(H);if(M===H){M=escape(H)}i=i.split(H).join(M)}}var z=i.indexOf("#");if(z!==-1){this.hash=i.substr(z);i=i.slice(0,z)}var V=i.indexOf("?");if(V!==-1){this.search=i.substr(V);this.query=i.substr(V+1);if(t){this.query=y.parse(this.query)}i=i.slice(0,V)}else if(t){this.search="";this.query={}}if(i)this.pathname=i;if(g[o]&&this.hostname&&!this.pathname){this.pathname="/"}if(this.pathname||this.search){var B=this.pathname||"";var D=this.search||"";this.path=B+D}this.href=this.format();return this};function w(e){if(x(e))e=b(e);if(!(e instanceof i))return i.prototype.format.call(e);return e.format()}i.prototype.format=function(){var e=this.auth||"";if(e){e=encodeURIComponent(e);e=e.replace(/%3A/i,":");e+="@"}var t=this.protocol||"",r=this.pathname||"",n=this.hash||"",i=false,s="";if(this.host){i=e+this.host}else if(this.hostname){i=e+(this.hostname.indexOf(":")===-1?this.hostname:"["+this.hostname+"]");if(this.port){i+=":"+this.port}}if(this.query&&R(this.query)&&Object.keys(this.query).length){s=y.stringify(this.query)}var a=this.search||s&&"?"+s||"";if(t&&t.substr(-1)!==":")t+=":";if(this.slashes||(!t||g[t])&&i!==false){i="//"+(i||"");if(r&&r.charAt(0)!=="/")r="/"+r}else if(!i){i=""}if(n&&n.charAt(0)!=="#")n="#"+n;if(a&&a.charAt(0)!=="?")a="?"+a;r=r.replace(/[?#]/g,function(e){return encodeURIComponent(e)});a=a.replace("#","%23");return t+i+r+a+n};function E(e,t){return b(e,false,true).resolve(t)}i.prototype.resolve=function(e){return this.resolveObject(b(e,false,true)).format()};function S(e,t){if(!e)return t;return b(e,false,true).resolveObject(t)}i.prototype.resolveObject=function(e){if(x(e)){var t=new i;t.parse(e,false,true);e=t}var r=new i;Object.keys(this).forEach(function(e){r[e]=this[e]},this);r.hash=e.hash;if(e.href===""){r.href=r.format();return r}if(e.slashes&&!e.protocol){Object.keys(e).forEach(function(t){if(t!=="protocol")r[t]=e[t]});if(g[r.protocol]&&r.hostname&&!r.pathname){r.path=r.pathname="/"}r.href=r.format();return r}if(e.protocol&&e.protocol!==r.protocol){if(!g[e.protocol]){Object.keys(e).forEach(function(t){r[t]=e[t]});r.href=r.format();return r}r.protocol=e.protocol;if(!e.host&&!m[e.protocol]){var n=(e.pathname||"").split("/");while(n.length&&!(e.host=n.shift()));if(!e.host)e.host="";if(!e.hostname)e.hostname="";if(n[0]!=="")n.unshift("");if(n.length<2)n.unshift("");r.pathname=n.join("/")}else{r.pathname=e.pathname}r.search=e.search;r.query=e.query;r.host=e.host||"";r.auth=e.auth;r.hostname=e.hostname||e.host;r.port=e.port;if(r.pathname||r.search){var s=r.pathname||"";var a=r.search||"";r.path=s+a}r.slashes=r.slashes||e.slashes;r.href=r.format();return r}var o=r.pathname&&r.pathname.charAt(0)==="/",u=e.host||e.pathname&&e.pathname.charAt(0)==="/",c=u||o||r.host&&e.pathname,f=c,l=r.pathname&&r.pathname.split("/")||[],n=e.pathname&&e.pathname.split("/")||[],h=r.protocol&&!g[r.protocol];if(h){r.hostname="";r.port=null;if(r.host){if(l[0]==="")l[0]=r.host;else l.unshift(r.host)}r.host="";if(e.protocol){e.hostname=null;e.port=null;if(e.host){if(n[0]==="")n[0]=e.host;else n.unshift(e.host)}e.host=null}c=c&&(n[0]===""||l[0]==="")}if(u){r.host=e.host||e.host===""?e.host:r.host;r.hostname=e.hostname||e.hostname===""?e.hostname:r.hostname;r.search=e.search;r.query=e.query;l=n}else if(n.length){if(!l)l=[];l.pop();l=l.concat(n);r.search=e.search;r.query=e.query}else if(!C(e.search)){if(h){r.hostname=r.host=l.shift();var p=r.host&&r.host.indexOf("@")>0?r.host.split("@"):false;if(p){r.auth=p.shift();r.host=r.hostname=p.shift()}}r.search=e.search;r.query=e.query;if(!A(r.pathname)||!A(r.search)){r.path=(r.pathname?r.pathname:"")+(r.search?r.search:"")}r.href=r.format();return r}if(!l.length){r.pathname=null;if(r.search){r.path="/"+r.search}else{r.path=null}r.href=r.format();return r}var d=l.slice(-1)[0];var v=(r.host||e.host)&&(d==="."||d==="..")||d==="";var y=0;for(var b=l.length;b>=0;b--){d=l[b];if(d=="."){l.splice(b,1)}else if(d===".."){l.splice(b,1);y++}else if(y){l.splice(b,1);y--}}if(!c&&!f){for(;y--;y){l.unshift("..")}}if(c&&l[0]!==""&&(!l[0]||l[0].charAt(0)!=="/")){l.unshift("")}if(v&&l.join("/").substr(-1)!=="/"){l.push("")}var w=l[0]===""||l[0]&&l[0].charAt(0)==="/";if(h){r.hostname=r.host=w?"":l.length?l.shift():"";var p=r.host&&r.host.indexOf("@")>0?r.host.split("@"):false;if(p){r.auth=p.shift();r.host=r.hostname=p.shift()}}c=c||r.host&&l.length;if(c&&!w){l.unshift("")}if(!l.length){r.pathname=null;r.path=null}else{r.pathname=l.join("/")}if(!A(r.pathname)||!A(r.search)){r.path=(r.pathname?r.pathname:"")+(r.search?r.search:"")}r.auth=e.auth||r.auth;r.slashes=r.slashes||e.slashes;r.href=r.format();return r};i.prototype.parseHost=function(){var e=this.host;var t=a.exec(e);if(t){t=t[0];if(t!==":"){this.port=t.substr(1)}e=e.substr(0,e.length-t.length)}if(e)this.hostname=e};function x(e){return typeof e==="string"}function R(e){return typeof e==="object"&&e!==null}function A(e){return e===null}function C(e){return e==null}},{punycode:13,querystring:16}],18:[function(e,t,r){t.exports=function n(e){return e&&typeof e==="object"&&typeof e.copy==="function"&&typeof e.fill==="function"&&typeof e.readUInt8==="function"}},{}],19:[function(e,t,r){(function(t,n){var i=/%[sdj%]/g;r.format=function(e){if(!S(e)){var t=[];for(var r=0;r<arguments.length;r++){t.push(o(arguments[r]))}return t.join(" ")}var r=1;var n=arguments;var s=n.length;var a=String(e).replace(i,function(e){if(e==="%")return"%";if(r>=s)return e;switch(e){case"%s":return String(n[r++]);case"%d":return Number(n[r++]);case"%j":try{return JSON.stringify(n[r++])}catch(t){return"[Circular]"}default:return e}});for(var u=n[r];r<s;u=n[++r]){if(b(u)||!C(u)){a+=" "+u}else{a+=" "+o(u)}}return a};r.deprecate=function(e,i){if(R(n.process)){return function(){return r.deprecate(e,i).apply(this,arguments)}}if(t.noDeprecation===true){return e}var s=false;function a(){if(!s){if(t.throwDeprecation){throw new Error(i)}else if(t.traceDeprecation){console.trace(i)}else{console.error(i)}s=true}return e.apply(this,arguments)}return a};var s={};var a;r.debuglog=function(e){if(R(a))a=t.env.NODE_DEBUG||"";e=e.toUpperCase();if(!s[e]){if(new RegExp("\\b"+e+"\\b","i").test(a)){var n=t.pid;s[e]=function(){var t=r.format.apply(r,arguments);console.error("%s %d: %s",e,n,t)}}else{s[e]=function(){}}}return s[e]};function o(e,t){var n={seen:[],stylize:c};if(arguments.length>=3)n.depth=arguments[2];if(arguments.length>=4)n.colors=arguments[3];if(y(t)){n.showHidden=t}else if(t){r._extend(n,t)}if(R(n.showHidden))n.showHidden=false;if(R(n.depth))n.depth=2;if(R(n.colors))n.colors=false;if(R(n.customInspect))n.customInspect=true;if(n.colors)n.stylize=u;return l(n,e,n.depth)}r.inspect=o;o.colors={bold:[1,22],italic:[3,23],underline:[4,24],inverse:[7,27],white:[37,39],grey:[90,39],black:[30,39],blue:[34,39],cyan:[36,39],green:[32,39],magenta:[35,39],red:[31,39],yellow:[33,39]};o.styles={special:"cyan",number:"yellow","boolean":"yellow",undefined:"grey","null":"bold",string:"green",date:"magenta",regexp:"red"};function u(e,t){var r=o.styles[t];if(r){return"["+o.colors[r][0]+"m"+e+"["+o.colors[r][1]+"m"}else{return e}}function c(e,t){return e}function f(e){var t={};e.forEach(function(e,r){t[e]=true});return t}function l(e,t,n){if(e.customInspect&&t&&_(t.inspect)&&t.inspect!==r.inspect&&!(t.constructor&&t.constructor.prototype===t)){var i=t.inspect(n,e);if(!S(i)){i=l(e,i,n)}return i}var s=h(e,t);if(s){return s}var a=Object.keys(t);var o=f(a);if(e.showHidden){a=Object.getOwnPropertyNames(t)}if(q(t)&&(a.indexOf("message")>=0||a.indexOf("description")>=0)){return p(t)}if(a.length===0){if(_(t)){var u=t.name?": "+t.name:"";return e.stylize("[Function"+u+"]","special")}if(A(t)){return e.stylize(RegExp.prototype.toString.call(t),"regexp")}if(T(t)){return e.stylize(Date.prototype.toString.call(t),"date")}if(q(t)){return p(t)}}var c="",y=false,b=["{","}"];if(g(t)){y=true;b=["[","]"]}if(_(t)){var w=t.name?": "+t.name:"";c=" [Function"+w+"]"}if(A(t)){c=" "+RegExp.prototype.toString.call(t)}if(T(t)){c=" "+Date.prototype.toUTCString.call(t)}if(q(t)){c=" "+p(t)}if(a.length===0&&(!y||t.length==0)){return b[0]+c+b[1]}if(n<0){if(A(t)){return e.stylize(RegExp.prototype.toString.call(t),"regexp")}else{return e.stylize("[Object]","special")}}e.seen.push(t);var E;if(y){E=d(e,t,n,o,a)}else{E=a.map(function(r){return v(e,t,n,o,r,y)})}e.seen.pop();return m(E,c,b)}function h(e,t){if(R(t))return e.stylize("undefined","undefined");if(S(t)){var r="'"+JSON.stringify(t).replace(/^"|"$/g,"").replace(/'/g,"\\'").replace(/\\"/g,'"')+"'";return e.stylize(r,"string")}if(E(t))return e.stylize(""+t,"number");if(y(t))return e.stylize(""+t,"boolean");if(b(t))return e.stylize("null","null")}function p(e){return"["+Error.prototype.toString.call(e)+"]"}function d(e,t,r,n,i){var s=[];for(var a=0,o=t.length;a<o;++a){if(O(t,String(a))){s.push(v(e,t,r,n,String(a),true))}else{s.push("")}}i.forEach(function(i){if(!i.match(/^\d+$/)){s.push(v(e,t,r,n,i,true))}});return s}function v(e,t,r,n,i,s){var a,o,u;u=Object.getOwnPropertyDescriptor(t,i)||{value:t[i]};if(u.get){if(u.set){o=e.stylize("[Getter/Setter]","special")}else{o=e.stylize("[Getter]","special")}}else{if(u.set){o=e.stylize("[Setter]","special")}}if(!O(n,i)){a="["+i+"]"}if(!o){if(e.seen.indexOf(u.value)<0){if(b(r)){o=l(e,u.value,null)}else{o=l(e,u.value,r-1)}if(o.indexOf("\n")>-1){if(s){o=o.split("\n").map(function(e){return"  "+e}).join("\n").substr(2)}else{o="\n"+o.split("\n").map(function(e){return"   "+e}).join("\n")}}}else{o=e.stylize("[Circular]","special")}}if(R(a)){if(s&&i.match(/^\d+$/)){return o}a=JSON.stringify(""+i);if(a.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)){a=a.substr(1,a.length-2);a=e.stylize(a,"name")}else{a=a.replace(/'/g,"\\'").replace(/\\"/g,'"').replace(/(^"|"$)/g,"'");a=e.stylize(a,"string")}}return a+": "+o}function m(e,t,r){var n=0;var i=e.reduce(function(e,t){n++;if(t.indexOf("\n")>=0)n++;return e+t.replace(/\u001b\[\d\d?m/g,"").length+1},0);if(i>60){return r[0]+(t===""?"":t+"\n ")+" "+e.join(",\n  ")+" "+r[1]}return r[0]+t+" "+e.join(", ")+" "+r[1]}function g(e){return Array.isArray(e)}r.isArray=g;function y(e){return typeof e==="boolean"}r.isBoolean=y;function b(e){return e===null}r.isNull=b;function w(e){return e==null}r.isNullOrUndefined=w;function E(e){return typeof e==="number"}r.isNumber=E;function S(e){return typeof e==="string"}r.isString=S;function x(e){return typeof e==="symbol"}r.isSymbol=x;function R(e){return e===void 0}r.isUndefined=R;function A(e){return C(e)&&L(e)==="[object RegExp]"}r.isRegExp=A;function C(e){return typeof e==="object"&&e!==null}r.isObject=C;function T(e){return C(e)&&L(e)==="[object Date]"}r.isDate=T;function q(e){return C(e)&&(L(e)==="[object Error]"||e instanceof Error)}r.isError=q;function _(e){return typeof e==="function"}r.isFunction=_;function I(e){return e===null||typeof e==="boolean"||typeof e==="number"||typeof e==="string"||typeof e==="symbol"||typeof e==="undefined"}r.isPrimitive=I;r.isBuffer=e("./support/isBuffer");function L(e){return Object.prototype.toString.call(e)}function P(e){return e<10?"0"+e.toString(10):e.toString(10)}var j=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];function k(){var e=new Date;var t=[P(e.getHours()),P(e.getMinutes()),P(e.getSeconds())].join(":");return[e.getDate(),j[e.getMonth()],t].join(" ")}r.log=function(){console.log("%s - %s",k(),r.format.apply(r,arguments))};r.inherits=e("inherits");r._extend=function(e,t){if(!t||!C(t))return e;var r=Object.keys(t);var n=r.length;while(n--){e[r[n]]=t[r[n]]}return e};function O(e,t){return Object.prototype.hasOwnProperty.call(e,t)}}).call(this,e("G+mPsH"),typeof self!=="undefined"?self:typeof window!=="undefined"?window:{})},{"./support/isBuffer":18,"G+mPsH":12,inherits:11}],20:[function(e,t,r){var n=e("./core");n.XML.Parser=e("./xml/browser_parser");e("./http/xhr");if(typeof window!=="undefined")window.AWS=n},{"./core":22,"./http/xhr":31,"./xml/browser_parser":63}],21:[function(e,t,r){var n=e("./core");e("./credentials");e("./credentials/credential_provider_chain");n.Config=n.util.inherit({constructor:function i(e){if(e===undefined)e={};e=this.extractCredentials(e);n.util.each.call(this,this.keys,function(t,r){this.set(t,e[t],r)})},update:function s(e,t){t=t||false;e=this.extractCredentials(e);n.util.each.call(this,e,function(e,r){if(t||this.keys.hasOwnProperty(e))this[e]=r})},getCredentials:function a(e){var t=this;function r(r){e(r,r?null:t.credentials)}function i(e,t){return new n.util.error(t||new Error,{code:"CredentialsError",message:e})}function s(){t.credentials.get(function(e){if(e){var n="Could not load credentials from "+t.credentials.constructor.name;e=i(n,e)}r(e)})}function a(){var e=null;if(!t.credentials.accessKeyId||!t.credentials.secretAccessKey){e=i("Missing credentials")}r(e)}if(t.credentials){if(typeof t.credentials.get==="function"){s()}else{a()}}else if(t.credentialProvider){t.credentialProvider.resolve(function(e,n){if(e){e=i("Could not load credentials from any providers",e)}t.credentials=n;r(e)})}else{r(i("No credentials to load"))}},loadFromPath:function o(e){this.clear();var t=JSON.parse(n.util.readFileSync(e));var r=new n.FileSystemCredentials(e);var i=new n.CredentialProviderChain;i.providers.unshift(r);i.resolve(function(e,r){if(e)throw e;else t.credentials=r});this.constructor(t);return this},clear:function u(){n.util.each.call(this,this.keys,function(e){delete this[e]});this.set("credentials",undefined);this.set("credentialProvider",undefined)},set:function c(e,t,r){if(t===undefined){if(r===undefined){r=this.keys[e]}if(typeof r==="function"){this[e]=r.call(this)}else{this[e]=r}}else{this[e]=t}},keys:{credentials:null,credentialProvider:null,region:null,logger:null,apiVersions:{},apiVersion:null,endpoint:undefined,httpOptions:{},maxRetries:undefined,maxRedirects:10,paramValidation:true,sslEnabled:true,s3ForcePathStyle:false,computeChecksums:true,convertResponseTypes:true,dynamoDbCrc32:true,signatureVersion:null},extractCredentials:function f(e){if(e.accessKeyId&&e.secretAccessKey){e=n.util.copy(e);e.credentials=new n.Credentials(e)}return e}});n.config=new n.Config},{"./core":22,"./credentials":23,"./credentials/credential_provider_chain":25}],22:[function(e,t,r){var n={util:e("./util")};var i={};i.toString();t.exports=n;n.util.update(n,{VERSION:"2.0.19",Signers:{},Protocol:{Json:e("./protocol/json"),Query:e("./protocol/query"),Rest:e("./protocol/rest"),RestJson:e("./protocol/rest_json"),RestXml:e("./protocol/rest_xml")},XML:{Builder:e("./xml/builder"),Parser:null},JSON:{Builder:e("./json/builder"),Parser:e("./json/parser")},Model:{Api:e("./model/api"),Operation:e("./model/operation"),Shape:e("./model/shape"),Paginator:e("./model/paginator"),ResourceWaiter:e("./model/resource_waiter")},util:e("./util")});e("./service");e("./credentials");e("./credentials/credential_provider_chain");e("./credentials/temporary_credentials");e("./credentials/web_identity_credentials");e("./credentials/cognito_identity_credentials");e("./credentials/saml_credentials");e("./config");e("./http");e("./sequential_executor");e("./event_listeners");e("./request");e("./response");e("./resource_waiter");e("./signers/request_signer");e("./param_validator");n.events=new n.SequentialExecutor},{"./config":21,"./credentials":23,"./credentials/cognito_identity_credentials":24,"./credentials/credential_provider_chain":25,"./credentials/saml_credentials":26,"./credentials/temporary_credentials":27,"./credentials/web_identity_credentials":28,"./event_listeners":29,"./http":30,"./json/builder":32,"./json/parser":33,"./model/api":34,"./model/operation":36,"./model/paginator":37,"./model/resource_waiter":38,"./model/shape":39,"./param_validator":40,"./protocol/json":41,"./protocol/query":42,"./protocol/rest":43,"./protocol/rest_json":44,"./protocol/rest_xml":45,"./request":49,"./resource_waiter":50,"./response":51,"./sequential_executor":52,"./service":53,"./signers/request_signer":55,"./util":62,"./xml/builder":64}],23:[function(e,t,r){var n=e("./core");n.Credentials=n.util.inherit({constructor:function i(){n.util.hideProperties(this,["secretAccessKey"]);this.expired=false;this.expireTime=null;if(arguments.length===1&&typeof arguments[0]==="object"){var e=arguments[0].credentials||arguments[0];this.accessKeyId=e.accessKeyId;this.secretAccessKey=e.secretAccessKey;this.sessionToken=e.sessionToken}else{this.accessKeyId=arguments[0];this.secretAccessKey=arguments[1];this.sessionToken=arguments[2]}},expiryWindow:15,needsRefresh:function s(){var e=n.util.date.getDate().getTime();var t=new Date(e+this.expiryWindow*1e3);if(this.expireTime&&t>this.expireTime){return true}else{return this.expired||!this.accessKeyId||!this.secretAccessKey}},get:function a(e){var t=this;if(this.needsRefresh()){this.refresh(function(r){if(!r)t.expired=false;if(e)e(r)})}else if(e){e()}},refresh:function o(e){this.expired=false;e()}})},{"./core":22}],24:[function(e,t,r){var n=e("../core");n.CognitoIdentityCredentials=n.util.inherit(n.Credentials,{localStorageKey:{id:"aws.cognito.identity-id.",providers:"aws.cognito.identity-providers."},constructor:function i(e){n.Credentials.call(this);this.expired=true;this.webIdentityCredentials=new n.WebIdentityCredentials(e);this.cognito=new n.CognitoIdentity({params:e});this.sts=new n.STS;this.params=e;this.data=null;this.identityId=null;this.loadCachedId()},refresh:function s(e){var t=this;t.data=null;t.identityId=null;t.getId(function(r){if(!r){t.cognito.getOpenIdToken(function(r,n){if(!r){t.cacheId(n);t.params.WebIdentityToken=n.Token;t.webIdentityCredentials.refresh(function(r){if(!r){t.data=t.webIdentityCredentials.data;t.sts.credentialsFrom(t.data,t)}else{t.clearCachedId()}e(r)})}else{t.clearCachedId();e(r)}})}else{t.clearCachedId();e(r)}})},clearCachedId:function a(){var e=this.params.IdentityPoolId;delete this.storage[this.localStorageKey.id+e];delete this.storage[this.localStorageKey.providers+e]},getId:function o(e){var t=this;if(typeof t.params.IdentityId==="string"){return e(null,t.params.IdentityId)}t.cognito.getId(function(r,n){if(!r&&n.IdentityId){t.params.IdentityId=n.IdentityId;e(null,n.IdentityId)}else{e(r)}})},loadCachedId:function u(){var e=this;if(n.util.isBrowser()&&!e.params.IdentityId){var t=e.getStorage("id");if(t&&e.params.Logins){var r=Object.keys(e.params.Logins);var i=(e.getStorage("providers")||"").split(",");var s=i.filter(function(e){return r.indexOf(e)!==-1});if(s.length!==0){e.params.IdentityId=t}}else if(t){e.params.IdentityId=t}}},cacheId:function c(e){this.identityId=e.IdentityId;this.params.IdentityId=this.identityId;if(n.util.isBrowser()){this.setStorage("id",e.IdentityId);if(this.params.Logins){this.setStorage("providers",Object.keys(this.params.Logins).join(","))}}},getStorage:function f(e){return this.storage[this.localStorageKey[e]+this.params.IdentityPoolId]},setStorage:function l(e,t){this.storage[this.localStorageKey[e]+this.params.IdentityPoolId]=t},storage:function(){try{return n.util.isBrowser()?window.localStorage:{}}catch(e){return{}}}()})},{"../core":22}],25:[function(e,t,r){var n=e("../core");n.CredentialProviderChain=n.util.inherit(n.Credentials,{constructor:function i(e){if(e){this.providers=e}else{this.providers=n.CredentialProviderChain.defaultProviders.slice(0)}},resolve:function s(e){if(this.providers.length===0){e(new Error("No providers"));return this}var t=0;var r=this.providers.slice(0);function n(i,s){if(!i&&s||t===r.length){e(i,s);return}var a=r[t++];if(typeof a==="function"){s=a.call()}else{s=a}if(s.get){s.get(function(e){n(e,e?null:s)})}else{n(null,s)}}n();return this}});n.CredentialProviderChain.defaultProviders=[]},{"../core":22}],26:[function(e,t,r){var n=e("../core");n.SAMLCredentials=n.util.inherit(n.Credentials,{constructor:function i(e){n.Credentials.call(this);this.expired=true;this.params=e;this.service=new n.STS({params:this.params})},refresh:function s(e){var t=this;if(!e)e=function(e){if(e)throw e};t.service.assumeRoleWithSAML(function(r,n){if(!r){t.service.credentialsFrom(n,t)}e(r)})}})},{"../core":22}],27:[function(e,t,r){var n=e("../core");n.TemporaryCredentials=n.util.inherit(n.Credentials,{constructor:function i(e){n.Credentials.call(this);this.loadMasterCredentials();this.expired=true;this.params=e||{};if(this.params.RoleArn){this.params.RoleSessionName=this.params.RoleSessionName||"temporary-credentials"}this.service=new n.STS({params:this.params})},refresh:function s(e){var t=this;if(!e)e=function(e){if(e)throw e};t.service.config.credentials=t.masterCredentials;var r=t.params.RoleArn?t.service.assumeRole:t.service.getSessionToken;r.call(t.service,function(r,n){if(!r){t.service.credentialsFrom(n,t)}e(r)})},loadMasterCredentials:function a(){this.masterCredentials=n.config.credentials;while(this.masterCredentials.masterCredentials){this.masterCredentials=this.masterCredentials.masterCredentials}}})},{"../core":22}],28:[function(e,t,r){var n=e("../core");n.WebIdentityCredentials=n.util.inherit(n.Credentials,{constructor:function i(e){n.Credentials.call(this);this.expired=true;this.params=e;this.params.RoleSessionName=this.params.RoleSessionName||"web-identity";this.service=new n.STS({params:this.params});this.data=null},refresh:function s(e){var t=this;if(!e)e=function(e){if(e)throw e};t.service.assumeRoleWithWebIdentity(function(r,n){t.data=null;if(!r){t.data=n;t.service.credentialsFrom(n,t)}e(r)})}})},{"../core":22}],29:[function(e,t,r){var n=e("./core");var i=e("./sequential_executor");n.EventListeners={Core:{}};n.EventListeners={Core:(new i).addNamedListeners(function(e,t){t("VALIDATE_CREDENTIALS","validate",function r(e,t){if(!e.service.api.signatureVersion)return t();e.service.config.getCredentials(function(r){if(r){e.response.error=n.util.error(r,{code:"CredentialsError",message:"Missing credentials in config"})}t()})});e("VALIDATE_REGION","validate",function i(e){if(!e.service.config.region&&!e.service.isGlobalEndpoint){e.response.error=n.util.error(new Error,{code:"ConfigError",message:"Missing region in config"})}});e("VALIDATE_PARAMETERS","validate",function s(e){var t=e.service.api.operations[e.operation].input;(new n.ParamValidator).validate(t,e.params)});e("SET_CONTENT_LENGTH","afterBuild",function a(e){if(e.httpRequest.headers["Content-Length"]===undefined){var t=n.util.string.byteLength(e.httpRequest.body);e.httpRequest.headers["Content-Length"]=t}});e("SET_HTTP_HOST","afterBuild",function o(e){e.httpRequest.headers["Host"]=e.httpRequest.endpoint.host});e("RESTART","restart",function u(){var e=this.response.error;if(!e||!e.retryable)return;if(this.response.retryCount<this.service.config.maxRetries){this.response.retryCount++}else{this.response.error=null}});t("SIGN","sign",function c(e,t){if(!e.service.api.signatureVersion)return t();e.service.config.getCredentials(function(r,i){if(r){e.response.error=r;return t()}try{var s=n.util.date.getDate();var a=e.service.getSignerClass(e);var o=new a(e.httpRequest,e.service.api.signingName||e.service.api.endpointPrefix);delete e.httpRequest.headers["Authorization"];delete e.httpRequest.headers["Date"];delete e.httpRequest.headers["X-Amz-Date"];o.addAuthorization(i,s);e.signedAt=s}catch(u){e.response.error=u}t()})});e("VALIDATE_RESPONSE","validateResponse",function f(e){if(this.service.successfulResponse(e,this)){e.data={};e.error=null}else{e.data=null;e.error=n.util.error(new Error,{code:"UnknownError",message:"An unknown error occurred."})}});t("SEND","send",function l(e,t){e.httpResponse._abortCallback=t;e.error=null;e.data=null;function r(r){e.httpResponse.stream=r;r.on("headers",function i(t,s){e.request.emit("httpHeaders",[t,s,e]);if(!e.httpResponse.streaming){if(n.HttpClient.streamsApiVersion===2){r.on("readable",function a(){var t=r.read();if(t!==null){e.request.emit("httpData",[t,e])}})}else{r.on("data",function o(t){e.request.emit("httpData",[t,e])})}}});r.on("end",function s(){e.request.emit("httpDone");t()})}function i(t){t.on("sendProgress",function r(t){e.request.emit("httpUploadProgress",[t,e])});t.on("receiveProgress",function n(t){e.request.emit("httpDownloadProgress",[t,e])})}function s(r){e.error=n.util.error(r,{code:"NetworkingError",region:e.request.httpRequest.region,hostname:e.request.httpRequest.endpoint.hostname,retryable:true});e.request.emit("httpError",[e.error,e],function(){t()})}function a(){var t=n.HttpClient.getInstance();var a=e.request.service.config.httpOptions||{};try{var o=t.handleRequest(e.request.httpRequest,a,r,s);i(o)}catch(u){s(u)}}var o=(n.util.date.getDate()-this.signedAt)/1e3;if(o>=60*10){this.emit("sign",[this],function(e){if(e)t(e);else a()})}else{a()}});e("HTTP_HEADERS","httpHeaders",function h(e,t,r){r.httpResponse.statusCode=e;r.httpResponse.headers=t;r.httpResponse.body=new n.util.Buffer("");r.httpResponse.buffers=[];r.httpResponse.numBytes=0});e("HTTP_DATA","httpData",function p(e,t){if(e){if(n.util.isNode()){t.httpResponse.numBytes+=e.length;var r=t.httpResponse.headers["content-length"];var i={loaded:t.httpResponse.numBytes,total:r};t.request.emit("httpDownloadProgress",[i,t])}t.httpResponse.buffers.push(new n.util.Buffer(e))}});e("HTTP_DONE","httpDone",function d(e){if(e.httpResponse.buffers&&e.httpResponse.buffers.length>0){var t=n.util.buffer.concat(e.httpResponse.buffers);e.httpResponse.body=t}delete e.httpResponse.numBytes;delete e.httpResponse.buffers});e("FINALIZE_ERROR","retry",function v(e){if(e.httpResponse.statusCode){e.error.statusCode=e.httpResponse.statusCode;if(e.error.retryable===undefined){e.error.retryable=this.service.retryableError(e.error,this)}}});e("INVALIDATE_CREDENTIALS","retry",function m(e){if(!e.error)return;switch(e.error.code){case"RequestExpired":case"ExpiredTokenException":case"ExpiredToken":e.error.retryable=true;e.request.service.config.credentials.expired=true}});e("REDIRECT","retry",function g(e){if(e.error&&e.error.statusCode>=300&&e.error.statusCode<400&&e.httpResponse.headers["location"]){this.httpRequest.endpoint=new n.Endpoint(e.httpResponse.headers["location"]);
e.error.redirect=true;e.error.retryable=true}});e("RETRY_CHECK","retry",function y(e){if(e.error){if(e.error.redirect&&e.redirectCount<e.maxRedirects){e.error.retryDelay=0}else if(e.error.retryable&&e.retryCount<e.maxRetries){var t=this.service.retryDelays();e.error.retryDelay=t[e.retryCount]||0}}});t("RESET_RETRY_STATE","afterRetry",function b(e,t){var r,n=false;if(e.error){r=e.error.retryDelay||0;if(e.error.retryable&&e.retryCount<e.maxRetries){e.retryCount++;n=true}else if(e.error.redirect&&e.redirectCount<e.maxRedirects){e.redirectCount++;n=true}}if(n){e.error=null;setTimeout(t,r)}else{t()}})}),CorePost:(new i).addNamedListeners(function(e){e("EXTRACT_REQUEST_ID","extractData",function t(e){e.requestId=e.httpResponse.headers["x-amz-request-id"]||e.httpResponse.headers["x-amzn-requestid"];if(!e.requestId&&e.data&&e.data.ResponseMetadata){e.requestId=e.data.ResponseMetadata.RequestId}})}),Logger:(new i).addNamedListeners(function(t){t("LOG_REQUEST","complete",function r(t){var r=t.request;var i=r.service.config.logger;if(!i)return;function s(){var s=n.util.date.getDate().getTime();var a=(s-r.startTime.getTime())/1e3;var o=i.isTTY?true:false;var u=t.httpResponse.statusCode;var c=e("util").inspect(r.params,true,true);var f="";if(o)f+="[33m";f+="[AWS "+r.service.serviceIdentifier+" "+u;f+=" "+a.toString()+"s "+t.retryCount+" retries]";if(o)f+="[0;1m";f+=" "+n.util.string.lowerFirst(r.operation);f+="("+c+")";if(o)f+="[0m";return f}var a=s();if(typeof i.log==="function"){i.log(a)}else if(typeof i.write==="function"){i.write(a+"\n")}})}),Json:(new i).addNamedListeners(function(t){var r=e("./protocol/json");t("BUILD","build",r.buildRequest);t("EXTRACT_DATA","extractData",r.extractData);t("EXTRACT_ERROR","extractError",r.extractError)}),Rest:(new i).addNamedListeners(function(t){var r=e("./protocol/rest");t("BUILD","build",r.buildRequest);t("EXTRACT_DATA","extractData",r.extractData);t("EXTRACT_ERROR","extractError",r.extractError)}),RestJson:(new i).addNamedListeners(function(t){var r=e("./protocol/rest_json");t("BUILD","build",r.buildRequest);t("EXTRACT_DATA","extractData",r.extractData);t("EXTRACT_ERROR","extractError",r.extractError)}),RestXml:(new i).addNamedListeners(function(t){var r=e("./protocol/rest_xml");t("BUILD","build",r.buildRequest);t("EXTRACT_DATA","extractData",r.extractData);t("EXTRACT_ERROR","extractError",r.extractError)}),Query:(new i).addNamedListeners(function(t){var r=e("./protocol/query");t("BUILD","build",r.buildRequest);t("EXTRACT_DATA","extractData",r.extractData);t("EXTRACT_ERROR","extractError",r.extractError)})}},{"./core":22,"./protocol/json":41,"./protocol/query":42,"./protocol/rest":43,"./protocol/rest_json":44,"./protocol/rest_xml":45,"./sequential_executor":52,util:19}],30:[function(e,t,r){var n=e("./core");var i=n.util.inherit;n.Endpoint=i({constructor:function s(e,t){n.util.hideProperties(this,["slashes","auth","hash","search","query"]);if(typeof e==="undefined"||e===null){throw new Error("Invalid endpoint: "+e)}else if(typeof e!=="string"){return n.util.copy(e)}if(!e.match(/^http/)){var r=t&&t.sslEnabled!==undefined?t.sslEnabled:n.config.sslEnabled;e=(r?"https":"http")+"://"+e}n.util.update(this,n.util.urlParse(e));if(this.port){this.port=parseInt(this.port,10)}else{this.port=this.protocol==="https:"?443:80}}});n.HttpRequest=i({constructor:function a(e,t){e=new n.Endpoint(e);this.method="POST";this.path=e.path||"/";this.headers={};this.body="";this.endpoint=e;this.region=t;this.setUserAgent()},setUserAgent:function o(){var e=n.util.isBrowser()?"X-Amz-":"";this.headers[e+"User-Agent"]=n.util.userAgent()},pathname:function u(){return this.path.split("?",1)[0]},search:function c(){var e=this.path.split("?",2)[1];if(e){return e.split("&").sort(function(e,t){return e.split("=")[0]>t.split("=")[0]?1:-1}).join("&")}return""}});n.HttpResponse=i({constructor:function f(){this.statusCode=undefined;this.headers={};this.body=undefined;this.streaming=false;this.stream=null},createUnbufferedStream:function l(){this.streaming=true;return this.stream}});n.HttpClient=i({});n.HttpClient.getInstance=function h(){if(this.singleton===undefined){this.singleton=new this}return this.singleton}},{"./core":22}],31:[function(e,t,r){var n=e("../core");var i=e("events").EventEmitter;e("../http");n.XHRClient=n.util.inherit({handleRequest:function s(e,t,r,a){var o=this;var u=e.endpoint;var c=new i;var f=u.protocol+"//"+u.hostname;if(u.port!==80&&u.port!==443){f+=":"+u.port}f+=e.path;var l=new XMLHttpRequest,h=false;e.stream=l;l.addEventListener("readystatechange",function(){try{if(l.status===0)return}catch(e){return}if(this.readyState>=this.HEADERS_RECEIVED&&!h){try{l.responseType="arraybuffer"}catch(e){}c.statusCode=l.status;c.headers=o.parseHeaders(l.getAllResponseHeaders());c.emit("headers",c.statusCode,c.headers);h=true}if(this.readyState===this.DONE){o.finishRequest(l,c)}},false);l.upload.addEventListener("progress",function(e){c.emit("sendProgress",e)});l.addEventListener("progress",function(e){c.emit("receiveProgress",e)},false);l.addEventListener("timeout",function(){a(n.util.error(new Error("Timeout"),{code:"TimeoutError"}))},false);l.addEventListener("error",function(){a(n.util.error(new Error("Network Failure"),{code:"NetworkingError"}))},false);r(c);l.open(e.method,f,t.xhrAsync!==false);n.util.each(e.headers,function(e,t){if(e!=="Content-Length"&&e!=="User-Agent"&&e!=="Host"){l.setRequestHeader(e,t)}});if(t.timeout){l.timeout=t.timeout}if(t.xhrWithCredentials){l.withCredentials=true}if(e.body&&typeof e.body.buffer==="object"){l.send(e.body.buffer)}else{l.send(e.body)}return c},parseHeaders:function a(e){var t={};n.util.arrayEach(e.split(/\r?\n/),function(e){var r=e.split(":",1)[0];var n=e.substring(r.length+2);if(r.length>0)t[r]=n});return t},finishRequest:function o(e,t){var r;if(e.responseType==="arraybuffer"&&e.response){var i=e.response;r=new n.util.Buffer(i.byteLength);var s=new Uint8Array(i);for(var a=0;a<r.length;++a){r[a]=s[a]}}try{if(!r&&typeof e.responseText==="string"){r=new n.util.Buffer(e.responseText)}}catch(o){}if(r)t.emit("data",r);t.emit("end")}});n.HttpClient.prototype=n.XHRClient.prototype;n.HttpClient.streamsApiVersion=1},{"../core":22,"../http":30,events:10}],32:[function(e,t,r){var n=e("../util");function i(){}i.prototype.build=function(e,t){return JSON.stringify(s(e,t))};function s(e,t){if(!t||e===undefined||e===null)return undefined;switch(t.type){case"structure":return a(e,t);case"map":return u(e,t);case"list":return o(e,t);default:return c(e,t)}}function a(e,t){var r={};n.each(e,function(e,n){var i=t.members[e];if(i){if(i.location!=="body")return;var a=s(n,i);if(a!==undefined)r[e]=a}});return r}function o(e,t){var r=[];n.arrayEach(e,function(e){var n=s(e,t.member);if(n!==undefined)r.push(n)});return r}function u(e,t){var r={};n.each(e,function(e,n){var i=s(n,t.value);if(i!==undefined)r[e]=i});return r}function c(e,t){return t.toWireFormat(e)}t.exports=i},{"../util":62}],33:[function(e,t,r){var n=e("../util");function i(){}i.prototype.parse=function(e,t){return s(JSON.parse(e),t)};function s(e,t){if(!t||e===undefined||e===null)return undefined;switch(t.type){case"structure":return a(e,t);case"map":return u(e,t);case"list":return o(e,t);default:return c(e,t)}}function a(e,t){var r={};n.each(e,function(e,n){var i=t.members[e];if(i){var a=s(n,i);if(a!==undefined)r[e]=a}});return r}function o(e,t){var r=[];n.arrayEach(e,function(e){var n=s(e,t.member);if(n!==undefined)r.push(n)});return r}function u(e,t){var r={};n.each(e,function(e,n){var i=s(n,t.value);if(i!==undefined)r[e]=i});return r}function c(e,t){return t.toType(e)}t.exports=i},{"../util":62}],34:[function(e,t,r){var n=e("./collection");var i=e("./operation");var s=e("./shape");var a=e("./paginator");var o=e("./resource_waiter");var u=e("../util");var c=u.property;var f=u.memoizedProperty;function l(e,t){e=e||{};t=t||{};t.api=this;e.metadata=e.metadata||{};c(this,"isApi",true,false);c(this,"apiVersion",e.metadata.apiVersion);c(this,"endpointPrefix",e.metadata.endpointPrefix);c(this,"signingName",e.metadata.signingName);c(this,"globalEndpoint",e.metadata.globalEndpoint);c(this,"signatureVersion",e.metadata.signatureVersion);c(this,"jsonVersion",e.metadata.jsonVersion);c(this,"targetPrefix",e.metadata.targetPrefix);c(this,"protocol",e.metadata.protocol);c(this,"timestampFormat",e.metadata.timestampFormat);c(this,"xmlNamespaceUri",e.metadata.xmlNamespace);c(this,"abbreviation",e.metadata.serviceAbbreviation);c(this,"fullName",e.metadata.serviceFullName);f(this,"className",function(){var t=e.metadata.serviceAbbreviation||e.metadata.serviceFullName;if(!t)return null;t=t.replace(/^Amazon|AWS\s*|\(.*|\s+|\W+/g,"");if(t==="ElasticLoadBalancing")t="ELB";return t});c(this,"operations",new n(e.operations,t,function(e,r){return new i(e,r,t)},u.string.lowerFirst));c(this,"shapes",new n(e.shapes,t,function(e,r){return s.create(r,t)}));c(this,"paginators",new n(e.paginators,t,function(e,r){return new a(e,r,t)}));c(this,"waiters",new n(e.waiters,t,function(e,r){return new o(e,r,t)},u.string.lowerFirst));if(t.documentation){c(this,"documentation",e.documentation);c(this,"documentationUrl",e.documentationUrl)}}t.exports=l},{"../util":62,"./collection":35,"./operation":36,"./paginator":37,"./resource_waiter":38,"./shape":39}],35:[function(e,t,r){var n=e("../util").memoizedProperty;function i(e,t,r,i){n(this,i(e),function(){return r(e,t)})}function s(e,t,r,n){n=n||String;var s=this;for(var a in e){if(e.hasOwnProperty(a)){i.call(s,a,e[a],r,n)}}}t.exports=s},{"../util":62}],36:[function(e,t,r){var n=e("./shape");var i=e("../util");var s=i.property;var a=i.memoizedProperty;function o(e,t,r){r=r||{};s(this,"name",e);s(this,"api",r.api,false);t.http=t.http||{};s(this,"httpMethod",t.http.method||"POST");s(this,"httpPath",t.http.requestUri||"/");a(this,"input",function(){if(!t.input){return new n.create({type:"structure"},r)}return n.create(t.input,r)});a(this,"output",function(){if(!t.output){return new n.create({type:"structure"},r)}return n.create(t.output,r)});a(this,"errors",function(){var e=[];if(!t.errors)return null;for(var i=0;i<t.errors.length;i++){e.push(n.create(t.errors[i],r))}return e});a(this,"paginator",function(){return r.api.paginators[e]});if(r.documentation){s(this,"documentation",t.documentation);s(this,"documentationUrl",t.documentationUrl)}}t.exports=o},{"../util":62,"./shape":39}],37:[function(e,t,r){var n=e("../util").property;function i(e,t){n(this,"inputToken",t.input_token);n(this,"limitKey",t.limit_key);n(this,"moreResults",t.more_results);n(this,"outputToken",t.output_token);n(this,"resultKey",t.result_key)}t.exports=i},{"../util":62}],38:[function(e,t,r){var n=e("../util");var i=n.property;function s(e,t,r){r=r||{};function s(){i(this,"name",e);i(this,"api",r.api,false);if(t.operation){i(this,"operation",n.string.lowerFirst(t.operation))}var s=this,a={ignoreErrors:"ignore_errors",successType:"success_type",successValue:"success_value",successPath:"success_path",acceptorType:"acceptor_type",acceptorValue:"acceptor_value",acceptorPath:"acceptor_path",failureType:"failure_type",failureValue:"failure_value",failurePath:"success_path",interval:"interval",maxAttempts:"max_attempts"};Object.keys(a).forEach(function(e){var r=t[a[e]];if(r)i(s,e,r)})}if(r.api){var a=null;if(t["extends"]){a=r.api.waiters[t["extends"]]}else if(e!=="__default__"){a=r.api.waiters["__default__"]}if(a)s.prototype=a}return new s}t.exports=s},{"../util":62}],39:[function(e,t,r){var n=e("./collection");var i=e("../util");function s(e,t,r){if(r!==null&&r!==undefined){i.property.apply(this,arguments)}}function a(e,t){if(!e.constructor.prototype[t]){i.memoizedProperty.apply(this,arguments)}}function o(e,t,r){t=t||{};s(this,"shape",e.shape);s(this,"api",t.api,false);s(this,"type",e.type);s(this,"location",e.location||"body");s(this,"name",this.name||e.xmlName||e.locationName||r);s(this,"isStreaming",e.streaming||false);s(this,"isComposite",e.isComposite||false);s(this,"isShape",true,false);if(t.documentation){s(this,"documentation",e.documentation);s(this,"documentationUrl",e.documentationUrl)}if(e.xmlAttribute){s(this,"isXmlAttribute",e.xmlAttribute||false)}s(this,"defaultValue",null);this.toWireFormat=function(e){if(e===null||e===undefined)return"";return e};this.toType=function(e){return e}}o.normalizedTypes={character:"string","double":"float","long":"integer","short":"integer",biginteger:"integer",bigdecimal:"float",blob:"binary"};o.types={structure:c,list:f,map:l,"boolean":y,timestamp:h,"float":d,integer:v,string:p,base64:g,binary:m};o.resolve=function b(e,t){if(e.shape){var r=t.api.shapes[e.shape];if(!r){throw new Error("Cannot find shape reference: "+e.shape)}return r}else{return null}};o.create=function w(e,t,r){if(e.isShape)return e;var n=o.resolve(e,t);if(n){var i=Object.keys(e);if(!t.documentation){i=i.filter(function(e){return!e.match(/documentation/)})}if(i===["shape"]){return n}var s=function(){n.constructor.call(this,e,t,r)};s.prototype=n;return new s}else{if(!e.type){if(e.members)e.type="structure";else if(e.member)e.type="list";else if(e.key)e.type="map";else e.type="string"}var a=e.type;if(o.normalizedTypes[e.type]){e.type=o.normalizedTypes[e.type]}if(o.types[e.type]){return new o.types[e.type](e,t,r)}else{throw new Error("Unrecognized shape type: "+a)}}};function u(e){o.apply(this,arguments);s(this,"isComposite",true);if(e.flattened){s(this,"flattened",e.flattened||false)}}function c(e,t){var r=null,i=!this.isShape;u.apply(this,arguments);if(i){s(this,"defaultValue",function(){return{}});s(this,"members",{});s(this,"memberNames",[]);s(this,"required",[]);s(this,"isRequired",function(){return false})}if(e.members){s(this,"members",new n(e.members,t,function(e,r){return o.create(r,t,e)}));a(this,"memberNames",function(){return e.xmlOrder||Object.keys(e.members)})}if(e.required){s(this,"required",e.required);s(this,"isRequired",function(t){if(!r){r={};for(var n=0;n<e.required.length;n++){r[e.required[n]]=true}}return r[t]},false,true)}s(this,"resultWrapper",e.resultWrapper||null);if(e.payload){s(this,"payload",e.payload)}if(typeof e.xmlNamespace==="string"){s(this,"xmlNamespaceUri",e.xmlNamespace)}else if(typeof e.xmlNamespace==="object"){s(this,"xmlNamespacePrefix",e.xmlNamespace.prefix);s(this,"xmlNamespaceUri",e.xmlNamespace.uri)}}function f(e,t){var r=this,n=!this.isShape;u.apply(this,arguments);if(n){s(this,"defaultValue",function(){return[]})}if(e.member){a(this,"member",function(){return o.create(e.member,t)})}if(this.flattened){var i=this.name;a(this,"name",function(){return r.member.name||i})}}function l(e,t){var r=!this.isShape;u.apply(this,arguments);if(r){s(this,"defaultValue",function(){return{}});s(this,"key",o.create({type:"string"},t));s(this,"value",o.create({type:"string"},t))}if(e.key){a(this,"key",function(){return o.create(e.key,t)})}if(e.value){a(this,"value",function(){return o.create(e.value,t)})}}function h(e){var t=this;o.apply(this,arguments);if(this.location==="header"){s(this,"timestampFormat","rfc822")}else if(e.timestampFormat){s(this,"timestampFormat",e.timestampFormat)}else if(this.api){if(this.api.timestampFormat){s(this,"timestampFormat",this.api.timestampFormat)}else{switch(this.api.protocol){case"json":case"rest-json":s(this,"timestampFormat","unixTimestamp");break;case"rest-xml":case"query":s(this,"timestampFormat","iso8601");break}}}this.toType=function(e){if(e===null||e===undefined)return null;if(typeof e.toUTCString==="function")return e;return typeof e==="string"||typeof e==="number"?i.date.parseTimestamp(e):null};this.toWireFormat=function(e){return i.date.format(e,t.timestampFormat)}}function p(){o.apply(this,arguments);if(this.api){switch(this.api.protocol){case"rest-xml":case"query":this.toType=function(e){return e||""}}}}function d(){o.apply(this,arguments);this.toType=function(e){if(e===null||e===undefined)return null;return parseFloat(e)};this.toWireFormat=this.toType}function v(){o.apply(this,arguments);this.toType=function(e){if(e===null||e===undefined)return null;return parseInt(e,10)};this.toWireFormat=this.toType}function m(){o.apply(this,arguments);this.toType=i.base64.decode;this.toWireFormat=i.base64.encode}function g(){m.apply(this,arguments)}function y(){o.apply(this,arguments);this.toType=function(e){if(typeof e==="boolean")return e;if(e===null||e===undefined)return null;return e==="true"}}o.shapes={StructureShape:c,ListShape:f,MapShape:l,StringShape:p,BooleanShape:y,Base64Shape:g};t.exports=o},{"../util":62,"./collection":35}],40:[function(e,t,r){var n=e("./core");n.ParamValidator=n.util.inherit({validate:function i(e,t,r){this.errors=[];this.validateMember(e,t||{},r||"params");if(this.errors.length>1){var i=this.errors.join("\n* ");if(this.errors.length>1){i="There were "+this.errors.length+" validation errors:\n* "+i;throw n.util.error(new Error(i),{code:"MultipleValidationErrors",errors:this.errors})}}else if(this.errors.length===1){throw this.errors[0]}else{return true}},validateStructure:function s(e,t,r){this.validateType(r,t,["object"],"structure");var n;for(var i=0;e.required&&i<e.required.length;i++){n=e.required[i];var s=t[n];if(s===undefined||s===null){this.fail("MissingRequiredParameter","Missing required key '"+n+"' in "+r)}}for(n in t){if(!t.hasOwnProperty(n))continue;var a=t[n],o=e.members[n];if(o!==undefined){var u=[r,n].join(".");this.validateMember(o,a,u)}else{this.fail("UnexpectedParameter","Unexpected key '"+n+"' found in "+r)}}return true},validateMember:function a(e,t,r){switch(e.type){case"structure":return this.validateStructure(e,t,r);case"list":return this.validateList(e,t,r);case"map":return this.validateMap(e,t,r);default:return this.validateScalar(e,t,r)}},validateList:function o(e,t,r){this.validateType(r,t,[Array]);for(var n=0;n<t.length;n++){this.validateMember(e.member,t[n],r+"["+n+"]")}},validateMap:function u(e,t,r){this.validateType(r,t,["object"],"map");for(var n in t){if(!t.hasOwnProperty(n))continue;this.validateMember(e.value,t[n],r+"['"+n+"']")}},validateScalar:function c(e,t,r){switch(e.type){case null:case undefined:case"string":return this.validateType(r,t,["string"]);case"base64":case"binary":return this.validatePayload(r,t);case"integer":case"float":return this.validateNumber(r,t);case"boolean":return this.validateType(r,t,["boolean"]);case"timestamp":return this.validateType(r,t,[Date,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,"number"],"Date object, ISO-8601 string, or a UNIX timestamp");default:return this.fail("UnkownType","Unhandled type "+e.type+" for "+r)}},fail:function f(e,t){this.errors.push(n.util.error(new Error(t),{code:e}))},validateType:function l(e,t,r,i){if(t===null||t===undefined)return;var s=false;for(var a=0;a<r.length;a++){if(typeof r[a]==="string"){if(typeof t===r[a])return}else if(r[a]instanceof RegExp){if((t||"").toString().match(r[a]))return}else{if(t instanceof r[a])return;if(n.util.isType(t,r[a]))return;if(!i&&!s)r=r.slice();r[a]=n.util.typeName(r[a])}s=true}var o=i;if(!o){o=r.join(", ").replace(/,([^,]+)$/,", or$1")}var u=o.match(/^[aeiou]/i)?"n":"";this.fail("InvalidParameterType","Expected "+e+" to be a"+u+" "+o)},validateNumber:function h(e,t){if(t===null||t===undefined)return;if(typeof t==="string"){var r=parseFloat(t);if(r.toString()===t)t=r}this.validateType(e,t,["number"])},validatePayload:function p(e,t){if(t===null||t===undefined)return;if(typeof t==="string")return;if(t&&typeof t.byteLength==="number")return;if(n.util.isNode()){var r=n.util.nodeRequire("stream").Stream;if(n.util.Buffer.isBuffer(t)||t instanceof r)return}var i=["Buffer","Stream","File","Blob","ArrayBuffer","DataView"];if(t){for(var s=0;s<i.length;s++){if(n.util.isType(t,i[s]))return;if(n.util.typeName(t.constructor)===i[s])return}}this.fail("InvalidParameterType","Expected "+e+" to be a "+"string, Buffer, Stream, Blob, or typed array object")}})},{"./core":22}],41:[function(e,t,r){var n=e("../util");var i=e("../json/builder");var s=e("../json/parser");function a(e){var t=e.httpRequest;var r=e.service.api;var n=r.targetPrefix+"."+r.operations[e.operation].name;var s=r.jsonVersion||"1.0";var a=r.operations[e.operation].input;var o=new i;if(s===1)s="1.0";t.body=o.build(e.params||{},a);t.headers["Content-Type"]="application/x-amz-json-"+s;t.headers["X-Amz-Target"]=n}function o(e){var t={};var r=e.httpResponse;if(r.body.length>0){var i=JSON.parse(r.body.toString());if(i.__type||i.code){t.code=(i.__type||i.code).split("#").pop()}else{t.code="UnknownError"}if(t.code==="RequestEntityTooLarge"){t.message="Request body must be less than 1 MB"}else{t.message=i.message||i.Message||null}}else{t.code=r.statusCode;t.message=null}e.error=n.error(new Error,t)}function u(e){var t=e.httpResponse.body.toString()||"{}";if(e.request.service.config.convertResponseTypes===false){e.data=JSON.parse(t)}else{var r=e.request.service.api.operations[e.request.operation];var n=r.output||{};var i=new s;e.data=i.parse(t,n)}}t.exports={buildRequest:a,extractError:o,extractData:u}},{"../json/builder":32,"../json/parser":33,"../util":62}],42:[function(e,t,r){var n=e("../core");var i=e("../util");var s=e("../query/query_param_serializer");var a=e("../model/shape");function o(e){var t=e.service.api.operations[e.operation];var r=e.httpRequest;r.headers["Content-Type"]="application/x-www-form-urlencoded; charset=utf-8";r.params={Version:e.service.api.apiVersion,Action:t.name};var n=new s;n.serialize(e.params,t.input,function(e,t){r.params[e]=t});r.body=i.queryParamsToString(r.params)}function u(e){var t,r=e.httpResponse.body.toString();if(r.match("<UnknownOperationException")){t={Code:"UnknownOperation",Message:"Unknown operation "+e.request.operation}}else{t=(new n.XML.Parser).parse(r)}if(t.Errors)t=t.Errors;if(t.Error)t=t.Error;if(t.Code){e.error=i.error(new Error,{code:t.Code,message:t.Message})}else{e.error=i.error(new Error,{code:e.httpResponse.statusCode,message:null})}}function c(e){var t=e.request;var r=t.service.api.operations[t.operation];var s=r.output||{};var o=s;if(o.resultWrapper){var u=a.create({type:"structure"});u.members[o.resultWrapper]=s;u.memberNames=[o.resultWrapper];i.property(s,"name",s.resultWrapper);s=u}var c=new n.XML.Parser;var f=c.parse(e.httpResponse.body.toString(),s);if(o.resultWrapper){if(f[o.resultWrapper]){i.update(f,f[o.resultWrapper]);delete f[o.resultWrapper]}}e.data=f}t.exports={buildRequest:o,extractError:u,extractData:c}},{"../core":22,"../model/shape":39,"../query/query_param_serializer":46,"../util":62}],43:[function(e,t,r){var n=e("../util");function i(e){e.httpRequest.method=e.service.api.operations[e.operation].httpMethod}function s(e){var t=e.service.api.operations[e.operation];var r=t.input;var i=[e.httpRequest.endpoint.path,t.httpPath].join("/");i=i.replace(/\/+/g,"/");var s=e.service.escapePathParam||a;var u=e.service.escapeQuerystringParam||o;var c={},f=false;n.each(r.members,function(t,r){var n=e.params[t];if(n===null||n===undefined)return;if(r.location==="uri"){i=i.replace("{"+r.name+"}",s(n))}else if(r.location==="querystring"){f=true;c[r.name]=u(n)}});if(f){i+=i.indexOf("?")>=0?"&":"?";var l=[];n.arrayEach(Object.keys(c).sort(),function(e){l.push(o(e)+"="+c[e])});i+=l.join("&")}e.httpRequest.path=i}function a(e){return n.uriEscape(String(e))}function o(e){return n.uriEscape(String(e))}function u(e){var t=e.service.api.operations[e.operation];n.each(t.input.members,function(t,r){var i=e.params[t];if(i===null||i===undefined)return;if(r.location==="headers"&&r.type==="map"){n.each(i,function(t,n){e.httpRequest.headers[r.name+t]=n})}else if(r.location==="header"){i=r.toWireFormat(i).toString();e.httpRequest.headers[r.name]=i}})}function c(e){i(e);s(e);u(e)}function f(){}function l(e){var t=e.request;var r={};var i=e.httpResponse;var s=t.service.api.operations[t.operation];var a=s.output;var o={};n.each(i.headers,function(e,t){o[e.toLowerCase()]=t});n.each(a.members,function(e,t){var s=(t.name||e).toLowerCase();if(t.location==="headers"&&t.type==="map"){r[e]={};n.each(i.headers,function(n,i){var s=n.match(new RegExp("^"+t.name+"(.+)","i"));if(s!==null){r[e][s[1]]=i}})}else if(t.location==="header"){if(o[s]!==undefined){r[e]=o[s]}}else if(t.location==="status"){r[e]=parseInt(i.statusCode,10)}});e.data=r}t.exports={buildRequest:c,extractError:f,extractData:l}},{"../util":62}],44:[function(e,t,r){var n=e("../util");var i=e("./rest");var s=e("./json");var a=e("../json/builder");function o(e){var t=new a;var r=e.service.api.operations[e.operation].input;if(r.payload){var n={};var i=r.members[r.payload];n=e.params[r.payload];if(n===undefined)return;if(i.type==="structure"){e.httpRequest.body=t.build(n,i)}else{e.httpRequest.body=n}}else{e.httpRequest.body=t.build(e.params,r)}}function u(e){i.buildRequest(e);if(["GET","HEAD"].indexOf(e.httpRequest.method)<0){o(e)}}function c(e){s.extractError(e)}function f(e){i.extractData(e);var t=e.request;var r=t.service.api.operations[t.operation].output||{};if(r.payload){var a=r.members[r.payload];if(a.isStreaming){e.data[r.payload]=e.httpResponse.body}else if(a.type==="structure"){s.extractData(e)}else{e.data[r.payload]=e.httpResponse.body.toString()}}else{var o=e.data;s.extractData(e);e.data=n.merge(o,e.data)}}t.exports={buildRequest:u,extractError:c,extractData:f}},{"../json/builder":32,"../util":62,"./json":41,"./rest":43}],45:[function(e,t,r){var n=e("../core");var i=e("../util");var s=e("./rest");function a(e){var t=e.service.api.operations[e.operation].input;var r=new n.XML.Builder;var s=e.params;var a=t.payload;if(a){var o=t.members[a];s=s[a];if(s===undefined)return;if(o.type==="structure"){var u=o.name;e.httpRequest.body=r.toXML(s,o,u)}else{e.httpRequest.body=s}}else{e.httpRequest.body=r.toXML(s,t,t.shape||i.string.upperFirst(e.operation)+"Request")}}function o(e){s.buildRequest(e);if(["GET","HEAD"].indexOf(e.httpRequest.method)<0){a(e)}}function u(e){s.extractError(e);var t=(new n.XML.Parser).parse(e.httpResponse.body.toString());if(t.Errors)t=t.Errors;if(t.Error)t=t.Error;if(t.Code){e.error=i.error(new Error,{code:t.Code,message:t.Message})}else{e.error=i.error(new Error,{code:e.httpResponse.statusCode,message:null})}}function c(e){s.extractData(e);var t;var r=e.request;var a=e.httpResponse.body;var o=r.service.api.operations[r.operation];var u=o.output;var c=u.payload;if(c){var f=u.members[c];if(f.isStreaming){e.data[c]=a}else if(f.type==="structure"){t=new n.XML.Parser;i.update(e.data,t.parse(a.toString(),f))}else{e.data[c]=a.toString()}}else if(a.length>0){t=new n.XML.Parser;var l=t.parse(a.toString(),u);i.update(e.data,l)}}t.exports={buildRequest:o,extractError:u,extractData:c}},{"../core":22,"../util":62,"./rest":43}],46:[function(e,t,r){var n=e("../util");function i(){}i.prototype.serialize=function(e,t,r){s("",e,t,r)};function s(e,t,r,i){n.each(r.members,function(r,n){var s=t[r];if(s===null||s===undefined)return;var a=e?e+"."+n.name:n.name;u(a,s,n,i)})}function a(e,t,r,i){var s=1;n.each(t,function(t,n){var a=r.flattened?".":".entry.";var o=a+s++ +".";var c=o+(r.key.name||"key");var f=o+(r.value.name||"value");u(e+c,t,r.key,i);u(e+f,n,r.value,i)})}function o(e,t,r,i){var s=r.member||{};if(t.length===0){i.call(this,e,null);return}n.arrayEach(t,function(t,n){var a="."+(n+1);if(r.flattened){if(s.name){var o=e.split(".");o.pop();o.push(s.name);e=o.join(".")}}else{a=".member"+a}u(e+a,t,s,i)})}function u(e,t,r,n){if(t===null||t===undefined)return;if(r.type==="structure"){s(e,t,r,n)}else if(r.type==="list"){o(e,t,r,n)}else if(r.type==="map"){a(e,t,r,n)}else{n(e,r.toWireFormat(t).toString())}}t.exports=i},{"../util":62}],47:[function(e,t,r){var n=e("./util");var i=e("./region_config.json");function s(e){var t=e.serviceIdentifier||"";var r=e.config.region||"";var s={};i.forEach(function(i){(i.regions||[]).forEach(function(a){if(r.match(new RegExp("^"+a.replace("*",".*")+"$"))){(i.serviceConfigs||[]).forEach(function(r){(r.services||[]).forEach(function(i){if(t.match(new RegExp("^"+i.replace("*",".*")+"$"))){n.update(s,r.config);e.isGlobalEndpoint=!!r.globalEndpoint}})})}})});n.each(s,function(t,r){if(e.config[t]===undefined||e.config[t]===null){e.config[t]=r}})}t.exports=s},{"./region_config.json":48,"./util":62}],48:[function(e,t,r){t.exports=[{regions:["*"],serviceConfigs:[{services:["*"],config:{endpoint:"{service}.{region}.amazonaws.com"}},{services:["cloudfront","iam","importexport","sts"],config:{endpoint:"{service}.amazonaws.com"},globalEndpoint:true},{services:["s3"],config:{endpoint:"{service}-{region}.amazonaws.com"}},{services:["route53"],config:{endpoint:"https://{service}.amazonaws.com"},globalEndpoint:true}]},{regions:["us-east-1"],serviceConfigs:[{services:["s3","simpledb"],config:{endpoint:"{service}.amazonaws.com"}}]},{regions:["cn-*"],serviceConfigs:[{services:["*"],config:{endpoint:"{service}.{region}.amazonaws.com.cn",signatureVersion:"v4"}}]}]},{}],49:[function(e,t,r){(function(t){var r=e("./core");var n=e("./state_machine");var i=r.util.inherit;var s={success:1,error:1,complete:1};function a(e){return s.hasOwnProperty(e._asm.currentState)}var o=new n;o.setupStates=function(){var e=function(e,t){try{var n=this;n.emit(n._asm.currentState,function(){var r=n.response.error;if(r&&r!==e&&a(n)){throw r}t(r)})}catch(i){if(i!==e&&a(n)){r.SequentialExecutor.prototype.unhandledErrorCallback.call(this,i);t()}else{t(i)}}};this.addState("validate","build","error",e);this.addState("build","afterBuild","restart",e);this.addState("afterBuild","sign","restart",e);this.addState("sign","send","retry",e);this.addState("retry","afterRetry","afterRetry",e);this.addState("afterRetry","sign","error",e);this.addState("send","validateResponse","retry",e);this.addState("validateResponse","extractData","extractError",e);this.addState("extractError","extractData","retry",e);this.addState("extractData","success","retry",e);this.addState("restart","build","error",e);this.addState("success","complete","complete",e);this.addState("error","complete","complete",e);this.addState("complete",null,null,e)};o.setupStates();r.Request=i({constructor:function u(e,t,i){var s=e.endpoint;var a=e.config.region;if(e.isGlobalEndpoint)a="us-east-1";this.service=e;this.operation=t;this.params=i||{};this.httpRequest=new r.HttpRequest(s,a);this.startTime=r.util.date.getDate();this.response=new r.Response(this);this._asm=new n(o.states,"validate");r.SequentialExecutor.call(this);this.emit=this.emitEvent},send:function c(e){if(e){this.on("complete",function(t){e.call(t,t.error,t.data)})}this.runTo();return this.response},build:function f(e){return this.runTo("send",e)},runTo:function l(e,t){this._asm.runTo(e,t,this);return this},abort:function h(){this.removeAllListeners("validateResponse");this.removeAllListeners("extractError");this.on("validateResponse",function e(t){t.error=r.util.error(new Error("Request aborted by user"),{code:"RequestAbortedError",retryable:false})});if(this.httpRequest.stream){this.httpRequest.stream.abort();if(this.httpRequest._abortCallback){this.httpRequest._abortCallback()}else{this.removeAllListeners("send")}}return this},eachPage:function p(e){e=r.util.fn.makeAsync(e,3);function t(n){e.call(n,n.error,n.data,function(i){if(i===false)return;if(n.hasNextPage()){n.nextPage().on("complete",t).send()}else{e.call(n,null,null,r.util.fn.noop)}})}this.on("complete",t).send()},eachItem:function d(e){var t=this;function n(n,i){if(n)return e(n,null);if(i===null)return e(null,null);var s=t.service.paginationConfig(t.operation);var a=s.resultKey;if(Array.isArray(a))a=a[0];var o=r.util.jamespath.query(a,i);r.util.arrayEach(o,function(t){r.util.arrayEach(t,function(t){e(null,t)})})}this.eachPage(n)},isPageable:function v(){return this.service.paginationConfig(this.operation)?true:false},createReadStream:function m(){var e=r.util.nodeRequire("stream");var n=this;var i=null;var s=false;if(r.HttpClient.streamsApiVersion===2){i=new e.Readable;i._read=function(){}}else{i=new e.Stream;i.readable=true}i.sent=false;i.on("newListener",function(e){if(!i.sent&&(e==="data"||e==="readable")){if(e==="data")s=true;i.sent=true;t.nextTick(function(){n.send(function(){})})}});this.on("httpHeaders",function a(e,t,o){if(e<300){n.removeListener("httpData",r.EventListeners.Core.HTTP_DATA);
n.removeListener("httpError",r.EventListeners.Core.HTTP_ERROR);n.on("httpError",function c(e,t){t.error=e;t.error.retryable=false});var u=o.httpResponse.createUnbufferedStream();if(s){u.on("data",function(e){i.emit("data",e)});u.on("end",function(){i.emit("end")})}else{u.on("readable",function(){var e;do{e=u.read();if(e!==null)i.push(e)}while(e!==null);i.read(0)});u.on("end",function(){i.push(null)})}u.on("error",function(e){i.emit("error",e)})}});this.on("error",function(e){i.emit("error",e)});return i},emitEvent:function g(e,t,n){if(typeof t==="function"){n=t;t=null}if(!n)n=this.unhandledErrorCallback;if(!t)t=this.eventParameters(e,this.response);var i=r.SequentialExecutor.prototype.emit;i.call(this,e,t,function(e){if(e)this.response.error=e;n.call(this,e)})},eventParameters:function y(e){switch(e){case"restart":case"validate":case"sign":case"build":case"afterValidate":case"afterBuild":return[this];case"error":return[this.response.error,this.response];default:return[this.response]}},presign:function b(e,t){if(!t&&typeof e==="function"){t=e;e=null}return(new r.Signers.Presign).sign(this.toGet(),e,t)},toUnauthenticated:function w(){this.removeListener("validate",r.EventListeners.Core.VALIDATE_CREDENTIALS);this.removeListener("sign",r.EventListeners.Core.SIGN);return this.toGet()},toGet:function E(){if(this.service.api.protocol==="query"){this.removeListener("build",this.buildAsGet);this.addListener("build",this.buildAsGet)}return this},buildAsGet:function S(e){e.httpRequest.method="GET";e.httpRequest.path=e.service.endpoint.path+"?"+e.httpRequest.body;e.httpRequest.body="";delete e.httpRequest.headers["Content-Length"];delete e.httpRequest.headers["Content-Type"]}});r.util.mixin(r.Request,r.SequentialExecutor)}).call(this,e("G+mPsH"))},{"./core":22,"./state_machine":61,"G+mPsH":12}],50:[function(e,t,r){var n=e("./core");var i=n.util.inherit;n.ResourceWaiter=i({constructor:function s(e,t){this.service=e;this.state=t;if(typeof this.state==="object"){n.util.each.call(this,this.state,function(e,t){this.state=e;this.expectedValue=t})}this.loadWaiterConfig(this.state);if(!this.expectedValue){this.expectedValue=this.config.successValue}},service:null,state:null,expectedValue:null,config:null,waitDone:false,Listeners:{retry:(new n.SequentialExecutor).addNamedListeners(function(e){e("RETRY_CHECK","retry",function(e){var t=e.request._waiter;if(e.error&&e.error.code==="ResourceNotReady"){e.error.retryDelay=t.config.interval*1e3}})}),output:(new n.SequentialExecutor).addNamedListeners(function(e){e("CHECK_OUT_ERROR","extractError",function t(e){if(e.error){e.request._waiter.setError(e,true)}});e("CHECK_OUTPUT","extractData",function r(e){var t=e.request._waiter;var r=t.checkSuccess(e);if(!r){t.setError(e,r===null?false:true)}else{e.error=null}})}),error:(new n.SequentialExecutor).addNamedListeners(function(e){e("CHECK_ERROR","extractError",function t(e){var t=e.request._waiter;var r=t.checkError(e);if(!r){t.setError(e,r===null?false:true)}else{e.error=null;e.request.removeAllListeners("extractData")}});e("CHECK_ERR_OUTPUT","extractData",function r(e){e.request._waiter.setError(e,true)})})},wait:function a(e,t){if(typeof e==="function"){t=e;e=undefined}var r=this.service.makeRequest(this.config.operation,e);var n=this.Listeners[this.config.successType];r._waiter=this;r.response.maxRetries=this.config.maxAttempts;r.addListeners(this.Listeners.retry);if(n)r.addListeners(n);if(t)r.send(t);return r},setError:function o(e,t){e.data=null;e.error=n.util.error(e.error||new Error,{code:"ResourceNotReady",message:"Resource is not in the state "+this.state,retryable:t})},checkSuccess:function u(e){if(!this.config.successPath){return e.httpResponse.statusCode<300}var t=n.util.jamespath.find(this.config.successPath,e.data);if(this.config.failureValue&&this.config.failureValue.indexOf(t)>=0){return null}if(this.expectedValue){return t===this.expectedValue}else{return t?true:false}},checkError:function c(e){var t=this.config.successValue;if(typeof t==="number"){return e.httpResponse.statusCode===t}else{return e.error&&e.error.code===t}},loadWaiterConfig:function f(e,t){if(!this.service.api.waiters[e]){if(t)return;throw new n.util.error(new Error,{code:"StateNotFoundError",message:"State "+e+" not found."})}this.config=this.service.api.waiters[e];var r=this.config;(function(){r.successType=r.successType||r.acceptorType;r.successPath=r.successPath||r.acceptorPath;r.successValue=r.successValue||r.acceptorValue;r.failureType=r.failureType||r.acceptorType;r.failurePath=r.failurePath||r.acceptorPath;r.failureValue=r.failureValue||r.acceptorValue})()}})},{"./core":22}],51:[function(e,t,r){var n=e("./core");var i=n.util.inherit;n.Response=i({constructor:function s(e){this.request=e;this.data=null;this.error=null;this.retryCount=0;this.redirectCount=0;this.httpResponse=new n.HttpResponse;if(e){this.maxRetries=e.service.numRetries();this.maxRedirects=e.service.config.maxRedirects}},nextPage:function a(e){var t;var r=this.request.service;var i=this.request.operation;try{t=r.paginationConfig(i,true)}catch(s){this.error=s}if(!this.hasNextPage()){if(e)e(this.error,null);else if(this.error)throw this.error;return null}var a=n.util.copy(this.request.params);if(!this.nextPageTokens){return e?e(null,null):null}else{var o=t.inputToken;if(typeof o==="string")o=[o];for(var u=0;u<o.length;u++){a[o[u]]=this.nextPageTokens[u]}return r.makeRequest(this.request.operation,a,e)}},hasNextPage:function o(){this.cacheNextPageTokens();if(this.nextPageTokens)return true;if(this.nextPageTokens===undefined)return undefined;else return false},cacheNextPageTokens:function u(){if(this.hasOwnProperty("nextPageTokens"))return this.nextPageTokens;this.nextPageTokens=undefined;var e=this.request.service.paginationConfig(this.request.operation);if(!e)return this.nextPageTokens;this.nextPageTokens=null;if(e.moreResults){if(!n.util.jamespath.find(e.moreResults,this.data)){return this.nextPageTokens}}var t=e.outputToken;if(typeof t==="string")t=[t];n.util.arrayEach.call(this,t,function(e){var t=n.util.jamespath.find(e,this.data);if(t){this.nextPageTokens=this.nextPageTokens||[];this.nextPageTokens.push(t)}});return this.nextPageTokens}})},{"./core":22}],52:[function(e,t,r){var n=e("./core");var i=n.util.nodeRequire("domain");n.SequentialExecutor=n.util.inherit({constructor:function s(){this.domain=i&&i.active;this._events={}},listeners:function a(e){return this._events[e]?this._events[e].slice(0):[]},on:function o(e,t){if(this._events[e]){this._events[e].push(t)}else{this._events[e]=[t]}return this},onAsync:function u(e,t){t._isAsync=true;return this.on(e,t)},removeListener:function c(e,t){var r=this._events[e];if(r){var n=r.length;var i=-1;for(var s=0;s<n;++s){if(r[s]===t){i=s}}if(i>-1){r.splice(i,1)}}return this},removeAllListeners:function f(e){if(e){delete this._events[e]}else{this._events={}}return this},emit:function l(e,t,r){if(!r)r=this.unhandledErrorCallback;var n=this.listeners(e);var i=n.length;this.callListeners(n,t,r);return i>0},callListeners:function h(e,t,r){if(e.length===0){r.call(this);return}var n=this,i=e.shift();if(i._isAsync){var s=function(i){if(i){r.call(n,i)}else{n.callListeners(e,t,r)}};i.apply(n,t.concat([s]))}else{try{i.apply(n,t);n.callListeners(e,t,r)}catch(a){r.call(n,a)}}},addListeners:function p(e){var t=this;if(e._events)e=e._events;n.util.each(e,function(e,r){if(typeof r==="function")r=[r];n.util.arrayEach(r,function(r){t.on(e,r)})});return t},addNamedListener:function d(e,t,r){this[e]=r;this.addListener(t,r);return this},addNamedAsyncListener:function v(e,t,r){r._isAsync=true;return this.addNamedListener(e,t,r)},addNamedListeners:function m(e){var t=this;e(function(){t.addNamedListener.apply(t,arguments)},function(){t.addNamedAsyncListener.apply(t,arguments)});return this},unhandledErrorCallback:function g(e){if(e){if(i&&this.domain instanceof i.Domain){e.domainEmitter=this;e.domain=this.domain;e.domainThrown=false;this.domain.emit("error",e)}else{throw e}}}});n.SequentialExecutor.prototype.addListener=n.SequentialExecutor.prototype.on;t.exports=n.SequentialExecutor},{"./core":22}],53:[function(e,t,r){var n=e("./core");var i=e("./model/api");var s=e("./region_config");var a=n.util.inherit;n.Service=a({constructor:function o(e){if(!this.loadServiceClass){throw n.util.error(new Error,"Service must be constructed with `new' operator")}var t=this.loadServiceClass(e||{});if(t)return new t(e);this.initialize(e)},initialize:function u(e){this.config=new n.Config(n.config);if(e)this.config.update(e,true);this.validateService();s(this);this.config.endpoint=this.endpointFromTemplate(this.config.endpoint);this.setEndpoint(this.config.endpoint)},validateService:function c(){},loadServiceClass:function f(e){var t=e;if(!n.util.isEmpty(this.api)){return null}else if(t.apiConfig){return n.Service.defineServiceApi(this.constructor,t.apiConfig)}else if(!this.constructor.services){return null}else{t=new n.Config(n.config);t.update(e,true);var r=t.apiVersions[this.constructor.serviceIdentifier];r=r||t.apiVersion;return this.getLatestServiceClass(r)}},getLatestServiceClass:function l(e){e=this.getLatestServiceVersion(e);if(this.constructor.services[e]===null){n.Service.defineServiceApi(this.constructor,e)}return this.constructor.services[e]},getLatestServiceVersion:function h(e){if(!this.constructor.services||this.constructor.services.length===0){throw new Error("No services defined on "+this.constructor.serviceIdentifier)}if(!e){e="latest"}else if(n.util.isType(e,Date)){e=n.util.date.iso8601(e).split("T")[0]}if(Object.hasOwnProperty(this.constructor.services,e)){return e}var t=Object.keys(this.constructor.services).sort();var r=null;for(var i=t.length-1;i>=0;i--){if(t[i][t[i].length-1]!=="*"){r=t[i]}if(t[i].substr(0,10)<=e){return r}}throw new Error("Could not find "+this.constructor.serviceIdentifier+" API to satisfy version constraint `"+e+"'")},api:{},defaultRetryCount:3,makeRequest:function p(e,t,r){if(typeof t==="function"){r=t;t=null}t=t||{};if(this.config.params){var i=this.api.operations[e];if(i){t=n.util.copy(t);n.util.each(this.config.params,function(e,r){if(i.input.members[e]){if(t[e]===undefined||t[e]===null){t[e]=r}}})}}var s=new n.Request(this,e,t);this.addAllRequestListeners(s);if(r)s.send(r);return s},makeUnauthenticatedRequest:function d(e,t,r){if(typeof t==="function"){r=t;t={}}var n=this.makeRequest(e,t).toUnauthenticated();return r?n.send(r):n},waitFor:function v(e,t,r){var i=new n.ResourceWaiter(this,e);return i.wait(t,r)},addAllRequestListeners:function m(e){var t=[n.events,n.EventListeners.Core,this.serviceInterface(),n.EventListeners.CorePost];for(var r=0;r<t.length;r++){if(t[r])e.addListeners(t[r])}if(!this.config.paramValidation){e.removeListener("validate",n.EventListeners.Core.VALIDATE_PARAMETERS)}if(this.config.logger){e.addListeners(n.EventListeners.Logger)}this.setupRequestListeners(e)},setupRequestListeners:function g(){},getSignerClass:function y(){var e;if(this.config.signatureVersion){e=this.config.signatureVersion}else{e=this.api.signatureVersion}return n.Signers.RequestSigner.getVersion(e)},serviceInterface:function b(){switch(this.api.protocol){case"query":return n.EventListeners.Query;case"json":return n.EventListeners.Json;case"rest-json":return n.EventListeners.RestJson;case"rest-xml":return n.EventListeners.RestXml}if(this.api.protocol){throw new Error("Invalid service `protocol' "+this.api.protocol+" in API config")}},successfulResponse:function w(e){return e.httpResponse.statusCode<300},numRetries:function E(){if(this.config.maxRetries!==undefined){return this.config.maxRetries}else{return this.defaultRetryCount}},retryDelays:function S(){var e=this.numRetries();var t=[];for(var r=0;r<e;++r){t[r]=Math.pow(2,r)*30}return t},retryableError:function x(e){if(this.networkingError(e))return true;if(this.expiredCredentialsError(e))return true;if(this.throttledError(e))return true;if(e.statusCode>=500)return true;return false},networkingError:function R(e){return e.code==="NetworkingError"},expiredCredentialsError:function A(e){return e.code==="ExpiredTokenException"},throttledError:function C(e){return e.code==="ProvisionedThroughputExceededException"},endpointFromTemplate:function T(e){if(typeof e!=="string")return e;var t=e;t=t.replace(/\{service\}/g,this.api.endpointPrefix);t=t.replace(/\{region\}/g,this.config.region);t=t.replace(/\{scheme\}/g,this.config.sslEnabled?"https":"http");return t},setEndpoint:function q(e){this.endpoint=new n.Endpoint(e,this.config)},paginationConfig:function _(e,t){var r=this.api.operations[e].paginator;if(!r){if(t){var i=new Error;throw n.util.error(i,"No pagination configuration for "+e)}return null}return r}});n.util.update(n.Service,{defineMethods:function I(e){n.util.each(e.prototype.api.operations,function t(r){if(e.prototype[r])return;e.prototype[r]=function(e,t){return this.makeRequest(r,e,t)}})},defineService:function L(e,t,r){if(!Array.isArray(t)){r=t;t=[]}var i=a(n.Service,r||{});if(typeof e==="string"){n.Service.addVersions(i,t);var s=i.serviceIdentifier||e;i.serviceIdentifier=s}else{i.prototype.api=e;n.Service.defineMethods(i)}return i},addVersions:function P(e,t){if(!Array.isArray(t))t=[t];e.services=e.services||{};for(var r=0;r<t.length;r++){if(e.services[t[r]]===undefined){e.services[t[r]]=null}}e.apiVersions=Object.keys(e.services).sort()},defineServiceApi:function j(e,t,r){var s=a(e,{serviceIdentifier:e.serviceIdentifier});function o(e){if(e.isApi){s.prototype.api=e}else{s.prototype.api=new i(e)}}if(typeof t==="string"){if(r){o(r)}else{try{var u=n.util.nodeRequire("aws-sdk-apis");o(u.load(e.serviceIdentifier,t))}catch(c){throw n.util.error(c,{message:"Could not find API configuration "+e.serviceIdentifier+"-"+t})}}if(!e.services.hasOwnProperty(t)){e.apiVersions=e.apiVersions.concat(t).sort()}e.services[t]=s}else{o(t)}n.Service.defineMethods(s);return s}})},{"./core":22,"./model/api":34,"./region_config":47}],54:[function(e,t,r){var n=e("../core");var i=n.util.inherit;var s="presigned-expires";function a(e){var t=e.httpRequest.headers[s];delete e.httpRequest.headers["User-Agent"];delete e.httpRequest.headers["X-Amz-User-Agent"];if(e.service.getSignerClass()===n.Signers.V4){if(t>604800){var r="Presigning does not support expiry time greater "+"than a week with SigV4 signing.";throw n.util.error(new Error,{code:"InvalidExpiryTime",message:r,retryable:false})}e.httpRequest.headers[s]=t}else if(e.service.getSignerClass()===n.Signers.S3){e.httpRequest.headers[s]=parseInt(n.util.date.unixTimestamp()+t,10).toString()}else{throw n.util.error(new Error,{message:"Presigning only supports S3 or SigV4 signing.",code:"UnsupportedSigner",retryable:false})}}function o(e){var t=e.httpRequest.endpoint;var r=n.util.urlParse(e.httpRequest.path);var i={};if(r.search){i=n.util.queryStringParse(r.search.substr(1))}n.util.each(e.httpRequest.headers,function(e,t){if(e===s)e="Expires";i[e]=t});delete e.httpRequest.headers[s];var a=i["Authorization"].split(" ");if(a[0]==="AWS"){a=a[1].split(":");i["AWSAccessKeyId"]=a[0];i["Signature"]=a[1]}else if(a[0]==="AWS4-HMAC-SHA256"){a.shift();var o=a.join(" ");var u=o.match(/Signature=(.*?)(?:,|\s|\r?\n|$)/)[1];i["X-Amz-Signature"]=u;delete i["Expires"]}delete i["Authorization"];delete i["Host"];t.pathname=r.pathname;t.search=n.util.queryParamsToString(i)}n.Signers.Presign=i({sign:function u(e,t,r){e.httpRequest.headers[s]=t||3600;e.on("build",a);e.on("sign",o);e.removeListener("afterBuild",n.EventListeners.Core.SET_CONTENT_LENGTH);e.emit("beforePresign",[e]);if(r){e.build(function(){if(this.response.error)r(this.response.error);else{r(null,n.util.urlFormat(e.httpRequest.endpoint))}})}else{e.build();return n.util.urlFormat(e.httpRequest.endpoint)}}});t.exports=n.Signers.Presign},{"../core":22}],55:[function(e,t,r){var n=e("../core");var i=n.util.inherit;n.Signers.RequestSigner=i({constructor:function s(e){this.request=e}});n.Signers.RequestSigner.getVersion=function a(e){switch(e){case"v2":return n.Signers.V2;case"v3":return n.Signers.V3;case"v4":return n.Signers.V4;case"s3":return n.Signers.S3;case"v3https":return n.Signers.V3Https}throw new Error("Unknown signing version "+e)};e("./v2");e("./v3");e("./v3https");e("./v4");e("./s3");e("./presign")},{"../core":22,"./presign":54,"./s3":56,"./v2":57,"./v3":58,"./v3https":59,"./v4":60}],56:[function(e,t,r){var n=e("../core");var i=n.util.inherit;n.Signers.S3=i(n.Signers.RequestSigner,{subResources:{acl:1,cors:1,lifecycle:1,"delete":1,location:1,logging:1,notification:1,partNumber:1,policy:1,requestPayment:1,restore:1,tagging:1,torrent:1,uploadId:1,uploads:1,versionId:1,versioning:1,versions:1,website:1},responseHeaders:{"response-content-type":1,"response-content-language":1,"response-expires":1,"response-cache-control":1,"response-content-disposition":1,"response-content-encoding":1},addAuthorization:function s(e,t){if(!this.request.headers["presigned-expires"]){this.request.headers["X-Amz-Date"]=n.util.date.rfc822(t)}if(e.sessionToken){this.request.headers["x-amz-security-token"]=e.sessionToken}var r=this.sign(e.secretAccessKey,this.stringToSign());var i="AWS "+e.accessKeyId+":"+r;this.request.headers["Authorization"]=i},stringToSign:function a(){var e=this.request;var t=[];t.push(e.method);t.push(e.headers["Content-MD5"]||"");t.push(e.headers["Content-Type"]||"");t.push(e.headers["presigned-expires"]||"");var r=this.canonicalizedAmzHeaders();if(r)t.push(r);t.push(this.canonicalizedResource());return t.join("\n")},canonicalizedAmzHeaders:function o(){var e=[];n.util.each(this.request.headers,function(t){if(t.match(/^x-amz-/i))e.push(t)});e.sort(function(e,t){return e.toLowerCase()<t.toLowerCase()?-1:1});var t=[];n.util.arrayEach.call(this,e,function(e){t.push(e.toLowerCase()+":"+String(this.request.headers[e]))});return t.join("\n")},canonicalizedResource:function u(){var e=this.request;var t=e.path.split("?");var r=t[0];var i=t[1];var s="";if(e.virtualHostedBucket)s+="/"+e.virtualHostedBucket;s+=r;if(i){var a=[];n.util.arrayEach.call(this,i.split("&"),function(e){var t=e.split("=")[0];var r=e.split("=")[1];if(this.subResources[t]||this.responseHeaders[t]){var n={name:t};if(r!==undefined){if(this.subResources[t]){n.value=r}else{n.value=decodeURIComponent(r)}}a.push(n)}});a.sort(function(e,t){return e.name<t.name?-1:1});if(a.length){i=[];n.util.arrayEach(a,function(e){if(e.value===undefined)i.push(e.name);else i.push(e.name+"="+e.value)});s+="?"+i.join("&")}}return s},sign:function c(e,t){return n.util.crypto.hmac(e,t,"base64","sha1")}});t.exports=n.Signers.S3},{"../core":22}],57:[function(e,t,r){var n=e("../core");var i=n.util.inherit;n.Signers.V2=i(n.Signers.RequestSigner,{addAuthorization:function s(e,t){if(!t)t=n.util.date.getDate();var r=this.request;r.params.Timestamp=n.util.date.iso8601(t);r.params.SignatureVersion="2";r.params.SignatureMethod="HmacSHA256";r.params.AWSAccessKeyId=e.accessKeyId;if(e.sessionToken){r.params.SecurityToken=e.sessionToken}delete r.params.Signature;r.params.Signature=this.signature(e);r.body=n.util.queryParamsToString(r.params);r.headers["Content-Length"]=r.body.length},signature:function a(e){return n.util.crypto.hmac(e.secretAccessKey,this.stringToSign(),"base64")},stringToSign:function o(){var e=[];e.push(this.request.method);e.push(this.request.endpoint.host.toLowerCase());e.push(this.request.pathname());e.push(n.util.queryParamsToString(this.request.params));return e.join("\n")}});t.exports=n.Signers.V2},{"../core":22}],58:[function(e,t,r){var n=e("../core");var i=n.util.inherit;n.Signers.V3=i(n.Signers.RequestSigner,{addAuthorization:function s(e,t){var r=n.util.date.rfc822(t);this.request.headers["X-Amz-Date"]=r;if(e.sessionToken){this.request.headers["x-amz-security-token"]=e.sessionToken}this.request.headers["X-Amzn-Authorization"]=this.authorization(e,r)},authorization:function a(e){return"AWS3 "+"AWSAccessKeyId="+e.accessKeyId+","+"Algorithm=HmacSHA256,"+"SignedHeaders="+this.signedHeaders()+","+"Signature="+this.signature(e)},signedHeaders:function o(){var e=[];n.util.arrayEach(this.headersToSign(),function t(r){e.push(r.toLowerCase())});return e.sort().join(";")},canonicalHeaders:function u(){var e=this.request.headers;var t=[];n.util.arrayEach(this.headersToSign(),function r(n){t.push(n.toLowerCase().trim()+":"+String(e[n]).trim())});return t.sort().join("\n")+"\n"},headersToSign:function c(){var e=[];n.util.each(this.request.headers,function t(r){if(r==="Host"||r==="Content-Encoding"||r.match(/^X-Amz/i)){e.push(r)}});return e},signature:function f(e){return n.util.crypto.hmac(e.secretAccessKey,this.stringToSign(),"base64")},stringToSign:function l(){var e=[];e.push(this.request.method);e.push("/");e.push("");e.push(this.canonicalHeaders());e.push(this.request.body);return n.util.crypto.sha256(e.join("\n"))}});t.exports=n.Signers.V3},{"../core":22}],59:[function(e,t,r){var n=e("../core");var i=n.util.inherit;e("./v3");n.Signers.V3Https=i(n.Signers.V3,{authorization:function s(e){return"AWS3-HTTPS "+"AWSAccessKeyId="+e.accessKeyId+","+"Algorithm=HmacSHA256,"+"Signature="+this.signature(e)},stringToSign:function a(){return this.request.headers["X-Amz-Date"]}});t.exports=n.Signers.V3Https},{"../core":22,"./v3":58}],60:[function(e,t,r){var n=e("../core");var i=n.util.inherit;var s={};var a="presigned-expires";n.Signers.V4=i(n.Signers.RequestSigner,{constructor:function o(e,t){n.Signers.RequestSigner.call(this,e);this.serviceName=t},algorithm:"AWS4-HMAC-SHA256",addAuthorization:function u(e,t){var r=n.util.date.iso8601(t).replace(/[:\-]|\.\d{3}/g,"");if(this.isPresigned()){this.updateForPresigned(e,r)}else{this.addHeaders(e,r);this.updateBody(e)}this.request.headers["Authorization"]=this.authorization(e,r)},addHeaders:function c(e,t){this.request.headers["X-Amz-Date"]=t;if(e.sessionToken){this.request.headers["x-amz-security-token"]=e.sessionToken}},updateBody:function f(e){if(this.request.params){this.request.params.AWSAccessKeyId=e.accessKeyId;if(e.sessionToken){this.request.params.SecurityToken=e.sessionToken}this.request.body=n.util.queryParamsToString(this.request.params);this.request.headers["Content-Length"]=this.request.body.length}},updateForPresigned:function l(e,t){var r=this.credentialString(t);var i={"X-Amz-Date":t,"X-Amz-Algorithm":this.algorithm,"X-Amz-Credential":e.accessKeyId+"/"+r,"X-Amz-Expires":this.request.headers[a],"X-Amz-SignedHeaders":this.signedHeaders()};if(e.sessionToken){i["X-Amz-Security-Token"]=e.sessionToken}if(this.request.headers["Content-Type"]){i["Content-Type"]=this.request.headers["Content-Type"]}n.util.each.call(this,this.request.headers,function(e,t){if(e===a)return;if(this.isSignableHeader(e)&&e.toLowerCase().indexOf("x-amz-")===0){i[e]=t}});var s=this.request.path.indexOf("?")>=0?"&":"?";this.request.path+=s+n.util.queryParamsToString(i)},authorization:function h(e,t){var r=[];var n=this.credentialString(t);r.push(this.algorithm+" Credential="+e.accessKeyId+"/"+n);r.push("SignedHeaders="+this.signedHeaders());r.push("Signature="+this.signature(e,t));return r.join(", ")},signature:function p(e,t){var r=s[this.serviceName];var i=t.substr(0,8);if(!r||r.akid!==e.accessKeyId||r.region!==this.request.region||r.date!==i){var a=e.secretAccessKey;var o=n.util.crypto.hmac("AWS4"+a,i,"buffer");var u=n.util.crypto.hmac(o,this.request.region,"buffer");var c=n.util.crypto.hmac(u,this.serviceName,"buffer");var f=n.util.crypto.hmac(c,"aws4_request","buffer");s[this.serviceName]={region:this.request.region,date:i,key:f,akid:e.accessKeyId}}var l=s[this.serviceName].key;return n.util.crypto.hmac(l,this.stringToSign(t),"hex")},stringToSign:function d(e){var t=[];t.push("AWS4-HMAC-SHA256");t.push(e);t.push(this.credentialString(e));t.push(this.hexEncodedHash(this.canonicalString()));return t.join("\n")},canonicalString:function v(){var e=[],t=this.request.pathname();if(this.serviceName!=="s3")t=n.util.uriEscapePath(t);e.push(this.request.method);e.push(t);e.push(this.request.search());e.push(this.canonicalHeaders()+"\n");e.push(this.signedHeaders());e.push(this.hexEncodedBodyHash());return e.join("\n")},canonicalHeaders:function m(){var e=[];n.util.each.call(this,this.request.headers,function(t,r){e.push([t,r])});e.sort(function(e,t){return e[0].toLowerCase()<t[0].toLowerCase()?-1:1});var t=[];n.util.arrayEach.call(this,e,function(e){var r=e[0].toLowerCase();if(this.isSignableHeader(r)){t.push(r+":"+this.canonicalHeaderValues(e[1].toString()))}});return t.join("\n")},canonicalHeaderValues:function g(e){return e.replace(/\s+/g," ").replace(/^\s+|\s+$/g,"")},signedHeaders:function y(){var e=[];n.util.each.call(this,this.request.headers,function(t){t=t.toLowerCase();if(this.isSignableHeader(t))e.push(t)});return e.sort().join(";")},credentialString:function b(e){var t=[];t.push(e.substr(0,8));t.push(this.request.region);t.push(this.serviceName);t.push("aws4_request");return t.join("/")},hexEncodedHash:function w(e){return n.util.crypto.sha256(e,"hex")},hexEncodedBodyHash:function E(){if(this.isPresigned()&&this.serviceName==="s3"){return"UNSIGNED-PAYLOAD"}else if(this.request.headers["X-Amz-Content-Sha256"]){return this.request.headers["X-Amz-Content-Sha256"]}else{return this.hexEncodedHash(this.request.body||"")}},unsignableHeaders:["authorization","content-type","content-length","user-agent",a],isSignableHeader:function S(e){if(e.toLowerCase().indexOf("x-amz-")===0)return true;return this.unsignableHeaders.indexOf(e)<0},isPresigned:function x(){return this.request.headers[a]?true:false}});t.exports=n.Signers.V4},{"../core":22}],61:[function(e,t,r){function n(e,t){this.currentState=t||null;this.states=e||{}}n.prototype.runTo=function i(e,t,r,n){if(typeof e==="function"){n=r;r=t;t=e;e=null}var i=this;var s=i.states[i.currentState];s.fn.call(r||i,n,function(n){if(n){if(s.fail)i.currentState=s.fail;else return t?t.call(r,n):null}else{if(s.accept)i.currentState=s.accept;else return t?t.call(r):null}if(i.currentState===e){return t?t.call(r,n):null}i.runTo(e,t,r,n)})};n.prototype.addState=function s(e,t,r,n){if(typeof t==="function"){n=t;t=null;r=null}else if(typeof r==="function"){n=r;r=null}if(!this.currentState)this.currentState=e;this.states[e]={accept:t,fail:r,fn:n};return this};t.exports=n},{}],62:[function(e,t,r){(function(r){var n=e("crypto");var i=e("buffer").Buffer;var s={engine:function a(){if(s.isBrowser()&&typeof navigator!=="undefined"){return navigator.userAgent}else{return r.platform+"/"+r.version}},userAgent:function o(){var t=s.isBrowser()?"js":"nodejs";var r="aws-sdk-"+t+"/"+e("./core").VERSION;if(t==="nodejs")r+=" "+s.engine();return r},isBrowser:function u(){return r&&r.browser},isNode:function c(){return!s.isBrowser()},nodeRequire:function f(t){if(s.isNode())return e(t)},multiRequire:function l(t,r){return e(s.isNode()?t:r)},uriEscape:function h(e){var t=encodeURIComponent(e);t=t.replace(/[^A-Za-z0-9_.~\-%]+/g,escape);t=t.replace(/[*]/g,function(e){return"%"+e.charCodeAt(0).toString(16).toUpperCase()});return t},uriEscapePath:function p(e){var t=[];s.arrayEach(e.split("/"),function(e){t.push(s.uriEscape(e))});return t.join("/")},urlParse:function d(t){return e("url").parse(t)},urlFormat:function v(t){return e("url").format(t)},queryStringParse:function m(t){return e("querystring").parse(t)},queryParamsToString:function g(e){var t=[];var r=s.uriEscape;var n=Object.keys(e).sort();s.arrayEach(n,function(n){var i=e[n];var a=r(n);var o=a+"=";if(Array.isArray(i)){var u=[];s.arrayEach(i,function(e){u.push(r(e))});o=a+"="+u.sort().join("&"+a+"=")}else if(i!==undefined&&i!==null){o=a+"="+r(i)}t.push(o)});return t.join("&")},readFileSync:function y(e){if(typeof window!=="undefined")return null;return s.nodeRequire("fs").readFileSync(e,"utf-8")},base64:{encode:function b(e){return new i(e).toString("base64")},decode:function w(e){return new i(e,"base64")}},Buffer:i,buffer:{concat:function(e){var t=0,r=0,n=null,s;for(s=0;s<e.length;s++){t+=e[s].length}n=new i(t);for(s=0;s<e.length;s++){e[s].copy(n,r);r+=e[s].length}return n}},string:{byteLength:function E(e){if(e===null||e===undefined)return 0;if(typeof e==="string")e=new i(e);if(typeof e.byteLength==="number"){return e.byteLength}else if(typeof e.length==="number"){return e.length}else if(typeof e.size==="number"){return e.size}else if(typeof e.path==="string"){return s.nodeRequire("fs").lstatSync(e.path).size}else{throw s.error(new Error("Cannot determine length of "+e),{object:e})}},upperFirst:function S(e){return e[0].toUpperCase()+e.substr(1)},lowerFirst:function x(e){return e[0].toLowerCase()+e.substr(1)}},ini:{parse:function R(e){var t,r={};s.arrayEach(e.split(/\r?\n/),function(e){e=e.split(/(^|\s);/)[0];var n=e.match(/^\s*\[([^\[\]]+)\]\s*$/);if(n){t=n[1]}else if(t){var i=e.match(/^\s*(.+?)\s*=\s*(.+)\s*$/);if(i){r[t]=r[t]||{};r[t][i[1]]=i[2]}}});return r}},fn:{noop:function(){},makeAsync:function A(e,t){if(t&&t<=e.length){return e}return function(){var t=Array.prototype.slice.call(arguments,0);var r=t.pop();var n=e.apply(null,t);r(n)}}},jamespath:{query:function C(e,t){if(!t)return[];var r=[];var n=e.split(/\s+or\s+/);s.arrayEach.call(this,n,function(e){var n=[t];var i=e.split(".");s.arrayEach.call(this,i,function(e){var t=e.match("^(.+?)(?:\\[(-?\\d+|\\*|)\\])?$");var r=[];s.arrayEach.call(this,n,function(e){if(t[1]==="*"){s.arrayEach.call(this,e,function(e){r.push(e)})}else if(e.hasOwnProperty(t[1])){r.push(e[t[1]])}});n=r;if(t[2]!==undefined){r=[];s.arrayEach.call(this,n,function(e){if(Array.isArray(e)){if(t[2]==="*"||t[2]===""){r=r.concat(e)}else{var n=parseInt(t[2],10);if(n<0)n=e.length+n;r.push(e[n])}}});n=r}if(n.length===0)return s.abort});if(n.length>0){r=n;return s.abort}});return r},find:function T(e,t){return s.jamespath.query(e,t)[0]}},date:{getDate:function q(){return new Date},iso8601:function _(e){if(e===undefined){e=s.date.getDate()}return e.toISOString()},rfc822:function I(e){if(e===undefined){e=s.date.getDate()}return e.toUTCString()},unixTimestamp:function L(e){if(e===undefined){e=s.date.getDate()}return e.getTime()/1e3},from:function P(e){if(typeof e==="number"){return new Date(e*1e3)}else{return new Date(e)}},format:function j(e,t){if(!t)t="iso8601";return s.date[t](s.date.from(e))},parseTimestamp:function k(e){if(typeof e==="number"){return new Date(e*1e3)}else if(e.match(/^\d+$/)){return new Date(e*1e3)}else if(e.match(/^\d{4}/)){return new Date(e)}else if(e.match(/^\w{3},/)){return new Date(e)}else{throw s.error(new Error("unhandled timestamp format: "+e),{code:"TimestampParserError"})}}},crypto:{crc32Table:[0,1996959894,3993919788,2567524794,124634137,1886057615,3915621685,2657392035,249268274,2044508324,3772115230,2547177864,162941995,2125561021,3887607047,2428444049,498536548,1789927666,4089016648,2227061214,450548861,1843258603,4107580753,2211677639,325883990,1684777152,4251122042,2321926636,335633487,1661365465,4195302755,2366115317,997073096,1281953886,3579855332,2724688242,1006888145,1258607687,3524101629,2768942443,901097722,1119000684,3686517206,2898065728,853044451,1172266101,3705015759,2882616665,651767980,1373503546,3369554304,3218104598,565507253,1454621731,3485111705,3099436303,671266974,1594198024,3322730930,2970347812,795835527,1483230225,3244367275,3060149565,1994146192,31158534,2563907772,4023717930,1907459465,112637215,2680153253,3904427059,2013776290,251722036,2517215374,3775830040,2137656763,141376813,2439277719,3865271297,1802195444,476864866,2238001368,4066508878,1812370925,453092731,2181625025,4111451223,1706088902,314042704,2344532202,4240017532,1658658271,366619977,2362670323,4224994405,1303535960,984961486,2747007092,3569037538,1256170817,1037604311,2765210733,3554079995,1131014506,879679996,2909243462,3663771856,1141124467,855842277,2852801631,3708648649,1342533948,654459306,3188396048,3373015174,1466479909,544179635,3110523913,3462522015,1591671054,702138776,2966460450,3352799412,1504918807,783551873,3082640443,3233442989,3988292384,2596254646,62317068,1957810842,3939845945,2647816111,81470997,1943803523,3814918930,2489596804,225274430,2053790376,3826175755,2466906013,167816743,2097651377,4027552580,2265490386,503444072,1762050814,4150417245,2154129355,426522225,1852507879,4275313526,2312317920,282753626,1742555852,4189708143,2394877945,397917763,1622183637,3604390888,2714866558,953729732,1340076626,3518719985,2797360999,1068828381,1219638859,3624741850,2936675148,906185462,1090812512,3747672003,2825379669,829329135,1181335161,3412177804,3160834842,628085408,1382605366,3423369109,3138078467,570562233,1426400815,3317316542,2998733608,733239954,1555261956,3268935591,3050360625,752459403,1541320221,2607071920,3965973030,1969922972,40735498,2617837225,3943577151,1913087877,83908371,2512341634,3803740692,2075208622,213261112,2463272603,3855990285,2094854071,198958881,2262029012,4057260610,1759359992,534414190,2176718541,4139329115,1873836001,414664567,2282248934,4279200368,1711684554,285281116,2405801727,4167216745,1634467795,376229701,2685067896,3608007406,1308918612,956543938,2808555105,3495958263,1231636301,1047427035,2932959818,3654703836,1088359270,936918e3,2847714899,3736837829,1202900863,817233897,3183342108,3401237130,1404277552,615818150,3134207493,3453421203,1423857449,601450431,3009837614,3294710456,1567103746,711928724,3020668471,3272380065,1510334235,755167117],crc32:function O(e){var t=s.crypto.crc32Table;
var r=0^-1;if(typeof e==="string"){e=new i(e)}for(var n=0;n<e.length;n++){var a=e.readUInt8(n);r=r>>>8^t[(r^a)&255]}return(r^-1)>>>0},hmac:function N(e,t,r,s){if(!r)r="binary";if(r==="buffer"){r=undefined}if(!s)s="sha256";if(typeof t==="string")t=new i(t);return n.createHmac(s,e).update(t).digest(r)},md5:function D(e,t){if(!t){t="binary"}if(t==="buffer"){t=undefined}if(typeof e==="string")e=new i(e);return s.crypto.createHash("md5").update(e).digest(t)},sha256:function B(e,t){if(!t){t="binary"}if(t==="buffer"){t=undefined}if(typeof e==="string")e=new i(e);return s.crypto.createHash("sha256").update(e).digest(t)},toHex:function U(e){var t=[];for(var r=0;r<e.length;r++){t.push(("0"+e.charCodeAt(r).toString(16)).substr(-2,2))}return t.join("")},createHash:function H(e){return n.createHash(e)}},abort:{},each:function M(e,t){for(var r in e){if(e.hasOwnProperty(r)){var n=t.call(this,r,e[r]);if(n===s.abort)break}}},arrayEach:function z(e,t){for(var r in e){if(e.hasOwnProperty(r)){var n=t.call(this,e[r],parseInt(r,10));if(n===s.abort)break}}},update:function V(e,t){s.each(t,function r(t,n){e[t]=n});return e},merge:function F(e,t){return s.update(s.copy(e),t)},copy:function X(e){if(e===null||e===undefined)return e;var t={};for(var r in e){t[r]=e[r]}return t},isEmpty:function W(e){for(var t in e){if(e.hasOwnProperty(t)){return false}}return true},isType:function K(e,t){if(typeof t==="function")t=s.typeName(t);return Object.prototype.toString.call(e)==="[object "+t+"]"},typeName:function G(e){if(e.hasOwnProperty("name"))return e.name;var t=e.toString();var r=t.match(/^\s*function (.+)\(/);return r?r[1]:t},error:function J(e,t){var r=null;if(typeof e.message==="string"&&e.message!==""){if(typeof t==="string"||t&&t.message){r=s.copy(e);r.message=e.message}}e.message=e.message||null;if(typeof t==="string"){e.message=t}else{s.update(e,t)}if(typeof Object.defineProperty==="function"){Object.defineProperty(e,"name",{writable:true,enumerable:false});Object.defineProperty(e,"message",{enumerable:true})}e.name=e.name||e.code||"Error";e.time=new Date;if(r)e.originalError=r;return e},inherit:function $(e,t){var r=null;if(t===undefined){t=e;e=Object;r={}}else{var n=function i(){};n.prototype=e.prototype;r=new n}if(t.constructor===Object){t.constructor=function(){if(e!==Object){return e.apply(this,arguments)}}}t.constructor.prototype=r;s.update(t.constructor.prototype,t);t.constructor.__super__=e;return t.constructor},mixin:function Y(){var e=arguments[0];for(var t=1;t<arguments.length;t++){for(var r in arguments[t].prototype){var n=arguments[t].prototype[r];if(r!=="constructor"){e.prototype[r]=n}}}return e},hideProperties:function Z(e,t){if(typeof Object.defineProperty!=="function")return;s.arrayEach(t,function(t){Object.defineProperty(e,t,{enumerable:false,writable:true,configurable:true})})},property:function Q(e,t,r,n,i){var s={configurable:true,enumerable:n!==undefined?n:true};if(typeof r==="function"&&!i){s.get=r}else{s.value=r;s.writable=true}Object.defineProperty(e,t,s)},memoizedProperty:function et(e,t,r,n){var i=null;s.property(e,t,function(){if(i===null){i=r()}return i},n)}};t.exports=s}).call(this,e("G+mPsH"))},{"./core":22,"G+mPsH":12,buffer:1,crypto:5,querystring:16,url:17}],63:[function(e,t,r){var n=e("../util");var i=e("../model/shape");function s(){}s.prototype.parse=function(e,t){if(e.replace(/^\s+/,"")==="")return{};var r,i;try{if(window.DOMParser){try{var s=new DOMParser;r=s.parseFromString(e,"text/xml")}catch(o){throw n.error(new Error("Parse error in document"),{originalError:o})}if(r.documentElement===null){throw new Error("Cannot parse empty document.")}var u=r.getElementsByTagName("parsererror")[0];if(u&&(u.parentNode===r||u.parentNode.nodeName==="body")){throw new Error(u.getElementsByTagName("div")[0].textContent)}}else if(window.ActiveXObject){r=new window.ActiveXObject("Microsoft.XMLDOM");r.async=false;if(!r.loadXML(e)){throw new Error("Parse error in document")}}else{throw new Error("Cannot load XML parser")}}catch(c){i=c}if(r&&r.documentElement&&!i){var f=a(r.documentElement,t);var l=r.getElementsByTagName("ResponseMetadata")[0];if(l){f.ResponseMetadata=a(l,{})}return f}else if(i){throw n.error(i||new Error,{code:"XMLParserError"})}else{return{}}};function a(e,t){if(!t)t={};switch(t.type){case"structure":return o(e,t);case"map":return u(e,t);case"list":return c(e,t);case undefined:case null:return l(e);default:return f(e,t)}}function o(e,t){var r={};if(e===null)return r;n.each(t.members,function(t,n){if(n.isXmlAttribute){if(e.attributes.hasOwnProperty(n.name)){var i=e.attributes[n.name].value;r[t]=a({textContent:i},n)}}else{var s=n.flattened?e:e.getElementsByTagName(n.name)[0];if(s){r[t]=a(s,n)}else if(!n.flattened&&n.type==="list"){r[t]=n.defaultValue}}});return r}function u(e,t){var r={};var n=t.key.name||"key";var i=t.value.name||"value";var s=t.flattened?t.name:"entry";var o=e.firstElementChild;while(o){if(o.nodeName===s){var u=o.getElementsByTagName(n)[0].textContent;var c=o.getElementsByTagName(i)[0];r[u]=a(c,t.value)}o=o.nextElementSibling}return r}function c(e,t){var r=[];var n=t.flattened?t.name:t.member.name||"member";var i=e.firstElementChild;while(i){if(i.nodeName===n){r.push(a(i,t.member))}i=i.nextElementSibling}return r}function f(e,t){if(e.getAttribute){var r=e.getAttribute("encoding");if(r==="base64"){t=new i.create({type:r})}}var n=e.textContent;if(n==="")n=null;if(typeof t.toType==="function"){return t.toType(n)}else{return n}}function l(e){if(e===undefined||e===null)return"";if(!e.firstElementChild){if(e.parentNode.parentNode===null)return{};if(e.childNodes.length===0)return"";else return e.textContent}var t={type:"structure",members:{}};var r=e.firstElementChild;while(r){var n=r.nodeName;if(t.members.hasOwnProperty(n)){t.members[n].type="list"}else{t.members[n]={name:n}}r=r.nextElementSibling}return o(e,t)}t.exports=s},{"../model/shape":39,"../util":62}],64:[function(e,t,r){var n=e("../util");var i=e("xmlbuilder");function s(){}s.prototype.toXML=function(e,t,r){var n=i.create(r);l(n,t);a(n,e,t);return n.children.length===0?"":n.root().toString()};function a(e,t,r){switch(r.type){case"structure":return o(e,t,r);case"map":return u(e,t,r);case"list":return c(e,t,r);default:return f(e,t,r)}}function o(e,t,r){n.arrayEach(r.memberNames,function(n){var i=r.members[n];if(i.location!=="body")return;var s=t[n];var o=i.name;if(s!==undefined&&s!==null){if(i.isXmlAttribute){e.att(o,s)}else if(i.flattened){a(e,s,i)}else{var u=e.ele(o);l(u,i);a(u,s,i)}}})}function u(e,t,r){var i=r.key.name||"key";var s=r.value.name||"value";n.each(t,function(t,n){var o=e.ele(r.flattened?r.name:"entry");a(o.ele(i),t,r.key);a(o.ele(s),n,r.value)})}function c(e,t,r){if(r.flattened){n.arrayEach(t,function(t){var n=r.member.name||r.name;var i=e.ele(n);a(i,t,r.member)})}else{n.arrayEach(t,function(t){var n=r.member.name||"member";var i=e.ele(n);a(i,t,r.member)})}}function f(e,t,r){e.txt(r.toWireFormat(t))}function l(e,t){var r,n="xmlns";if(t.xmlNamespaceUri){r=t.xmlNamespaceUri;if(t.xmlNamespacePrefix)n+=":"+t.xmlNamespacePrefix}else if(e.isRoot&&t.api.xmlNamespaceUri){r=t.api.xmlNamespaceUri}if(r)e.att(n,r)}t.exports=s},{"../util":62,xmlbuilder:67}],65:[function(e,t,r){(function(){var r,n;n=e("./XMLFragment");r=function(){function e(e,t,r){var i,s,a;this.children=[];this.rootObject=null;if(this.is(e,"Object")){a=[e,t],t=a[0],r=a[1];e=null}if(e!=null){e=""+e||"";if(t==null){t={version:"1.0"}}}if(t!=null&&!(t.version!=null)){throw new Error("Version number is required")}if(t!=null){t.version=""+t.version||"";if(!t.version.match(/1\.[0-9]+/)){throw new Error("Invalid version number: "+t.version)}i={version:t.version};if(t.encoding!=null){t.encoding=""+t.encoding||"";if(!t.encoding.match(/[A-Za-z](?:[A-Za-z0-9._-]|-)*/)){throw new Error("Invalid encoding: "+t.encoding)}i.encoding=t.encoding}if(t.standalone!=null){i.standalone=t.standalone?"yes":"no"}s=new n(this,"?xml",i);this.children.push(s)}if(r!=null){i={};if(e!=null){i.name=e}if(r.ext!=null){r.ext=""+r.ext||"";i.ext=r.ext}s=new n(this,"!DOCTYPE",i);this.children.push(s)}if(e!=null){this.begin(e)}}e.prototype.begin=function(t,r,i){var s,a;if(!(t!=null)){throw new Error("Root element needs a name")}if(this.rootObject){this.children=[];this.rootObject=null}if(r!=null){s=new e(t,r,i);return s.root()}t=""+t||"";a=new n(this,t,{});a.isRoot=true;a.documentObject=this;this.children.push(a);this.rootObject=a;return a};e.prototype.root=function(){return this.rootObject};e.prototype.end=function(e){return toString(e)};e.prototype.toString=function(e){var t,r,n,i,s;r="";s=this.children;for(n=0,i=s.length;n<i;n++){t=s[n];r+=t.toString(e)}return r};e.prototype.is=function(e,t){var r;r=Object.prototype.toString.call(e).slice(8,-1);return e!=null&&r===t};return e}();t.exports=r}).call(this)},{"./XMLFragment":66}],66:[function(e,t,r){(function(){var e,r={}.hasOwnProperty;e=function(){function e(e,t,r,n){this.isRoot=false;this.documentObject=null;this.parent=e;this.name=t;this.attributes=r;this.value=n;this.children=[]}e.prototype.element=function(t,n,i){var s,a,o,u,c;if(!(t!=null)){throw new Error("Missing element name")}t=""+t||"";this.assertLegalChar(t);if(n==null){n={}}if(this.is(n,"String")&&this.is(i,"Object")){u=[i,n],n=u[0],i=u[1]}else if(this.is(n,"String")){c=[{},n],n=c[0],i=c[1]}for(a in n){if(!r.call(n,a))continue;o=n[a];o=""+o||"";n[a]=this.escape(o)}s=new e(this,t,n);if(i!=null){i=""+i||"";i=this.escape(i);this.assertLegalChar(i);s.raw(i)}this.children.push(s);return s};e.prototype.insertBefore=function(t,n,i){var s,a,o,u,c,f;if(this.isRoot){throw new Error("Cannot insert elements at root level")}if(!(t!=null)){throw new Error("Missing element name")}t=""+t||"";this.assertLegalChar(t);if(n==null){n={}}if(this.is(n,"String")&&this.is(i,"Object")){c=[i,n],n=c[0],i=c[1]}else if(this.is(n,"String")){f=[{},n],n=f[0],i=f[1]}for(o in n){if(!r.call(n,o))continue;u=n[o];u=""+u||"";n[o]=this.escape(u)}s=new e(this.parent,t,n);if(i!=null){i=""+i||"";i=this.escape(i);this.assertLegalChar(i);s.raw(i)}a=this.parent.children.indexOf(this);this.parent.children.splice(a,0,s);return s};e.prototype.insertAfter=function(t,n,i){var s,a,o,u,c,f;if(this.isRoot){throw new Error("Cannot insert elements at root level")}if(!(t!=null)){throw new Error("Missing element name")}t=""+t||"";this.assertLegalChar(t);if(n==null){n={}}if(this.is(n,"String")&&this.is(i,"Object")){c=[i,n],n=c[0],i=c[1]}else if(this.is(n,"String")){f=[{},n],n=f[0],i=f[1]}for(o in n){if(!r.call(n,o))continue;u=n[o];u=""+u||"";n[o]=this.escape(u)}s=new e(this.parent,t,n);if(i!=null){i=""+i||"";i=this.escape(i);this.assertLegalChar(i);s.raw(i)}a=this.parent.children.indexOf(this);this.parent.children.splice(a+1,0,s);return s};e.prototype.remove=function(){var e,t;if(this.isRoot){throw new Error("Cannot remove the root element")}e=this.parent.children.indexOf(this);[].splice.apply(this.parent.children,[e,e-e+1].concat(t=[])),t;return this.parent};e.prototype.text=function(t){var r;if(!(t!=null)){throw new Error("Missing element text")}t=""+t||"";t=this.escape(t);this.assertLegalChar(t);r=new e(this,"",{},t);this.children.push(r);return this};e.prototype.cdata=function(t){var r;if(!(t!=null)){throw new Error("Missing CDATA text")}t=""+t||"";this.assertLegalChar(t);if(t.match(/]]>/)){throw new Error("Invalid CDATA text: "+t)}r=new e(this,"",{},"<![CDATA["+t+"]]>");this.children.push(r);return this};e.prototype.comment=function(t){var r;if(!(t!=null)){throw new Error("Missing comment text")}t=""+t||"";t=this.escape(t);this.assertLegalChar(t);if(t.match(/--/)){throw new Error("Comment text cannot contain double-hypen: "+t)}r=new e(this,"",{},"<!-- "+t+" -->");this.children.push(r);return this};e.prototype.raw=function(t){var r;if(!(t!=null)){throw new Error("Missing raw text")}t=""+t||"";r=new e(this,"",{},t);this.children.push(r);return this};e.prototype.up=function(){if(this.isRoot){throw new Error("This node has no parent. Use doc() if you need to get the document object.")}return this.parent};e.prototype.root=function(){var e;if(this.isRoot){return this}e=this.parent;while(!e.isRoot){e=e.parent}return e};e.prototype.document=function(){return this.root().documentObject};e.prototype.end=function(e){return this.document().toString(e)};e.prototype.prev=function(){var e;if(this.isRoot){throw new Error("Root node has no siblings")}e=this.parent.children.indexOf(this);if(e<1){throw new Error("Already at the first node")}return this.parent.children[e-1]};e.prototype.next=function(){var e;if(this.isRoot){throw new Error("Root node has no siblings")}e=this.parent.children.indexOf(this);if(e===-1||e===this.parent.children.length-1){throw new Error("Already at the last node")}return this.parent.children[e+1]};e.prototype.clone=function(t){var r;r=new e(this.parent,this.name,this.attributes,this.value);if(t){this.children.forEach(function(e){var n;n=e.clone(t);n.parent=r;return r.children.push(n)})}return r};e.prototype.importXMLBuilder=function(e){var t;t=e.root().clone(true);t.parent=this;this.children.push(t);t.isRoot=false;return this};e.prototype.attribute=function(e,t){var r;if(!(e!=null)){throw new Error("Missing attribute name")}if(!(t!=null)){throw new Error("Missing attribute value")}e=""+e||"";t=""+t||"";if((r=this.attributes)==null){this.attributes={}}this.attributes[e]=this.escape(t);return this};e.prototype.removeAttribute=function(e){if(!(e!=null)){throw new Error("Missing attribute name")}e=""+e||"";delete this.attributes[e];return this};e.prototype.toString=function(e,t){var r,n,i,s,a,o,u,c,f,l,h,p;o=e!=null&&e.pretty||false;s=e!=null&&e.indent||"  ";a=e!=null&&e.newline||"\n";t||(t=0);c=new Array(t+1).join(s);u="";if(o){u+=c}if(!(this.value!=null)){u+="<"+this.name}else{u+=""+this.value}h=this.attributes;for(r in h){n=h[r];if(this.name==="!DOCTYPE"){u+=" "+n}else{u+=" "+r+'="'+n+'"'}}if(this.children.length===0){if(!(this.value!=null)){u+=this.name==="?xml"?"?>":this.name==="!DOCTYPE"?">":"/>"}if(o){u+=a}}else if(o&&this.children.length===1&&this.children[0].value){u+=">";u+=this.children[0].value;u+="</"+this.name+">";u+=a}else{u+=">";if(o){u+=a}p=this.children;for(f=0,l=p.length;f<l;f++){i=p[f];u+=i.toString(e,t+1)}if(o){u+=c}u+="</"+this.name+">";if(o){u+=a}}return u};e.prototype.escape=function(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/'/g,"&apos;").replace(/"/g,"&quot;")};e.prototype.assertLegalChar=function(e){var t,r;t=/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE-\uFFFF]/;r=e.match(t);if(r){throw new Error("Invalid character ("+r+") in string: "+e)}};e.prototype.is=function(e,t){var r;r=Object.prototype.toString.call(e).slice(8,-1);return e!=null&&r===t};e.prototype.ele=function(e,t,r){return this.element(e,t,r)};e.prototype.txt=function(e){return this.text(e)};e.prototype.dat=function(e){return this.cdata(e)};e.prototype.att=function(e,t){return this.attribute(e,t)};e.prototype.com=function(e){return this.comment(e)};e.prototype.doc=function(){return this.document()};e.prototype.e=function(e,t,r){return this.element(e,t,r)};e.prototype.t=function(e){return this.text(e)};e.prototype.d=function(e){return this.cdata(e)};e.prototype.a=function(e,t){return this.attribute(e,t)};e.prototype.c=function(e){return this.comment(e)};e.prototype.r=function(e){return this.raw(e)};e.prototype.u=function(){return this.up()};return e}();t.exports=e}).call(this)},{}],67:[function(e,t,r){(function(){var r;r=e("./XMLBuilder");t.exports.create=function(e,t,n){if(e!=null){return new r(e,t,n).root()}else{return new r}}}).call(this)},{"./XMLBuilder":65}]},{},[20]);;AWS.CloudWatch=AWS.Service.defineService("cloudwatch");
AWS.Service.defineServiceApi(AWS.CloudWatch, "2010-08-01", {"metadata":{"apiVersion":"2010-08-01","endpointPrefix":"monitoring","serviceAbbreviation":"CloudWatch","serviceFullName":"Amazon CloudWatch","signatureVersion":"v4","xmlNamespace":"http://monitoring.amazonaws.com/doc/2010-08-01/","protocol":"query"},"operations":{"DeleteAlarms":{"input":{"type":"structure","required":["AlarmNames"],"members":{"AlarmNames":{"shape":"S2"}}}},"DescribeAlarmHistory":{"input":{"type":"structure","members":{"AlarmName":{},"HistoryItemType":{},"StartDate":{"type":"timestamp"},"EndDate":{"type":"timestamp"},"MaxRecords":{"type":"integer"},"NextToken":{}}},"output":{"resultWrapper":"DescribeAlarmHistoryResult","type":"structure","members":{"AlarmHistoryItems":{"type":"list","member":{"type":"structure","members":{"AlarmName":{},"Timestamp":{"type":"timestamp"},"HistoryItemType":{},"HistorySummary":{},"HistoryData":{}}}},"NextToken":{}}}},"DescribeAlarms":{"input":{"type":"structure","members":{"AlarmNames":{"shape":"S2"},"AlarmNamePrefix":{},"StateValue":{},"ActionPrefix":{},"MaxRecords":{"type":"integer"},"NextToken":{}}},"output":{"resultWrapper":"DescribeAlarmsResult","type":"structure","members":{"MetricAlarms":{"shape":"Sj"},"NextToken":{}}}},"DescribeAlarmsForMetric":{"input":{"type":"structure","required":["MetricName","Namespace"],"members":{"MetricName":{},"Namespace":{},"Statistic":{},"Dimensions":{"shape":"Sv"},"Period":{"type":"integer"},"Unit":{}}},"output":{"resultWrapper":"DescribeAlarmsForMetricResult","type":"structure","members":{"MetricAlarms":{"shape":"Sj"}}}},"DisableAlarmActions":{"input":{"type":"structure","required":["AlarmNames"],"members":{"AlarmNames":{"shape":"S2"}}}},"EnableAlarmActions":{"input":{"type":"structure","required":["AlarmNames"],"members":{"AlarmNames":{"shape":"S2"}}}},"GetMetricStatistics":{"input":{"type":"structure","required":["Namespace","MetricName","StartTime","EndTime","Period","Statistics"],"members":{"Namespace":{},"MetricName":{},"Dimensions":{"shape":"Sv"},"StartTime":{"type":"timestamp"},"EndTime":{"type":"timestamp"},"Period":{"type":"integer"},"Statistics":{"type":"list","member":{}},"Unit":{}}},"output":{"resultWrapper":"GetMetricStatisticsResult","type":"structure","members":{"Label":{},"Datapoints":{"type":"list","member":{"type":"structure","members":{"Timestamp":{"type":"timestamp"},"SampleCount":{"type":"double"},"Average":{"type":"double"},"Sum":{"type":"double"},"Minimum":{"type":"double"},"Maximum":{"type":"double"},"Unit":{}},"xmlOrder":["Timestamp","SampleCount","Average","Sum","Minimum","Maximum","Unit"]}}}}},"ListMetrics":{"input":{"type":"structure","members":{"Namespace":{},"MetricName":{},"Dimensions":{"type":"list","member":{"type":"structure","required":["Name"],"members":{"Name":{},"Value":{}}}},"NextToken":{}}},"output":{"xmlOrder":["Metrics","NextToken"],"resultWrapper":"ListMetricsResult","type":"structure","members":{"Metrics":{"type":"list","member":{"type":"structure","members":{"Namespace":{},"MetricName":{},"Dimensions":{"shape":"Sv"}},"xmlOrder":["Namespace","MetricName","Dimensions"]}},"NextToken":{}}}},"PutMetricAlarm":{"input":{"type":"structure","required":["AlarmName","MetricName","Namespace","Statistic","Period","EvaluationPeriods","Threshold","ComparisonOperator"],"members":{"AlarmName":{},"AlarmDescription":{},"ActionsEnabled":{"type":"boolean"},"OKActions":{"shape":"So"},"AlarmActions":{"shape":"So"},"InsufficientDataActions":{"shape":"So"},"MetricName":{},"Namespace":{},"Statistic":{},"Dimensions":{"shape":"Sv"},"Period":{"type":"integer"},"Unit":{},"EvaluationPeriods":{"type":"integer"},"Threshold":{"type":"double"},"ComparisonOperator":{}}}},"PutMetricData":{"input":{"type":"structure","required":["Namespace","MetricData"],"members":{"Namespace":{},"MetricData":{"type":"list","member":{"type":"structure","required":["MetricName"],"members":{"MetricName":{},"Dimensions":{"shape":"Sv"},"Timestamp":{"type":"timestamp"},"Value":{"type":"double"},"StatisticValues":{"type":"structure","required":["SampleCount","Sum","Minimum","Maximum"],"members":{"SampleCount":{"type":"double"},"Sum":{"type":"double"},"Minimum":{"type":"double"},"Maximum":{"type":"double"}}},"Unit":{}}}}}}},"SetAlarmState":{"input":{"type":"structure","required":["AlarmName","StateValue","StateReason"],"members":{"AlarmName":{},"StateValue":{},"StateReason":{},"StateReasonData":{}}}}},"shapes":{"S2":{"type":"list","member":{}},"Sj":{"type":"list","member":{"type":"structure","members":{"AlarmName":{},"AlarmArn":{},"AlarmDescription":{},"AlarmConfigurationUpdatedTimestamp":{"type":"timestamp"},"ActionsEnabled":{"type":"boolean"},"OKActions":{"shape":"So"},"AlarmActions":{"shape":"So"},"InsufficientDataActions":{"shape":"So"},"StateValue":{},"StateReason":{},"StateReasonData":{},"StateUpdatedTimestamp":{"type":"timestamp"},"MetricName":{},"Namespace":{},"Statistic":{},"Dimensions":{"shape":"Sv"},"Period":{"type":"integer"},"Unit":{},"EvaluationPeriods":{"type":"integer"},"Threshold":{"type":"double"},"ComparisonOperator":{}},"xmlOrder":["AlarmName","AlarmArn","AlarmDescription","AlarmConfigurationUpdatedTimestamp","ActionsEnabled","OKActions","AlarmActions","InsufficientDataActions","StateValue","StateReason","StateReasonData","StateUpdatedTimestamp","MetricName","Namespace","Statistic","Dimensions","Period","Unit","EvaluationPeriods","Threshold","ComparisonOperator"]}},"So":{"type":"list","member":{}},"Sv":{"type":"list","member":{"type":"structure","required":["Name","Value"],"members":{"Name":{},"Value":{}},"xmlOrder":["Name","Value"]}}},"paginators":{"DescribeAlarmHistory":{"input_token":"NextToken","output_token":"NextToken","limit_key":"MaxRecords","result_key":"AlarmHistoryItems"},"DescribeAlarms":{"input_token":"NextToken","output_token":"NextToken","limit_key":"MaxRecords","result_key":"MetricAlarms"},"DescribeAlarmsForMetric":{"result_key":"MetricAlarms"},"ListMetrics":{"input_token":"NextToken","output_token":"NextToken","result_key":"Metrics"}}});
AWS.CognitoIdentity=AWS.Service.defineService("cognitoidentity");AWS.util.update(AWS.CognitoIdentity.prototype,{getOpenIdToken:function e(t,n){return this.makeUnauthenticatedRequest("getOpenIdToken",t,n)},getId:function t(e,n){return this.makeUnauthenticatedRequest("getId",e,n)}});
AWS.Service.defineServiceApi(AWS.CognitoIdentity, "2014-06-30", {"metadata":{"apiVersion":"2014-06-30","endpointPrefix":"cognito-identity","jsonVersion":"1.1","serviceFullName":"Amazon Cognito Identity","signatureVersion":"v4","targetPrefix":"AWSCognitoIdentityService","protocol":"json"},"operations":{"CreateIdentityPool":{"input":{"type":"structure","required":["IdentityPoolName","AllowUnauthenticatedIdentities"],"members":{"IdentityPoolName":{},"AllowUnauthenticatedIdentities":{"type":"boolean"},"SupportedLoginProviders":{"shape":"S4"},"DeveloperProviderName":{}}},"output":{"shape":"S8"}},"DeleteIdentityPool":{"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{}}}},"DescribeIdentityPool":{"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{}}},"output":{"shape":"S8"}},"GetId":{"input":{"type":"structure","required":["AccountId","IdentityPoolId"],"members":{"AccountId":{},"IdentityPoolId":{},"Logins":{"shape":"Se"}}},"output":{"type":"structure","members":{"IdentityId":{}}}},"GetOpenIdToken":{"input":{"type":"structure","required":["IdentityId"],"members":{"IdentityId":{},"Logins":{"shape":"Se"}}},"output":{"type":"structure","members":{"IdentityId":{},"Token":{}}}},"GetOpenIdTokenForDeveloperIdentity":{"input":{"type":"structure","required":["IdentityPoolId","Logins"],"members":{"IdentityPoolId":{},"IdentityId":{},"Logins":{"shape":"Se"},"TokenDuration":{"type":"long"}}},"output":{"type":"structure","members":{"IdentityId":{},"Token":{}}}},"ListIdentities":{"input":{"type":"structure","required":["IdentityPoolId","MaxResults"],"members":{"IdentityPoolId":{},"MaxResults":{"type":"integer"},"NextToken":{}}},"output":{"type":"structure","members":{"IdentityPoolId":{},"Identities":{"type":"list","member":{"type":"structure","members":{"IdentityId":{},"Logins":{"shape":"Su"}}}},"NextToken":{}}}},"ListIdentityPools":{"input":{"type":"structure","required":["MaxResults"],"members":{"MaxResults":{"type":"integer"},"NextToken":{}}},"output":{"type":"structure","members":{"IdentityPools":{"type":"list","member":{"type":"structure","members":{"IdentityPoolId":{},"IdentityPoolName":{}}}},"NextToken":{}}}},"LookupDeveloperIdentity":{"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{},"IdentityId":{},"DeveloperUserIdentifier":{},"MaxResults":{"type":"integer"},"NextToken":{}}},"output":{"type":"structure","members":{"IdentityId":{},"DeveloperUserIdentifierList":{"type":"list","member":{}},"NextToken":{}}}},"MergeDeveloperIdentities":{"input":{"type":"structure","required":["SourceUserIdentifier","DestinationUserIdentifier","DeveloperProviderName","IdentityPoolId"],"members":{"SourceUserIdentifier":{},"DestinationUserIdentifier":{},"DeveloperProviderName":{},"IdentityPoolId":{}}},"output":{"type":"structure","members":{"IdentityId":{}}}},"UnlinkDeveloperIdentity":{"input":{"type":"structure","required":["IdentityId","IdentityPoolId","DeveloperProviderName","DeveloperUserIdentifier"],"members":{"IdentityId":{},"IdentityPoolId":{},"DeveloperProviderName":{},"DeveloperUserIdentifier":{}}}},"UnlinkIdentity":{"input":{"type":"structure","required":["IdentityId","Logins","LoginsToRemove"],"members":{"IdentityId":{},"Logins":{"shape":"Se"},"LoginsToRemove":{"shape":"Su"}}}},"UpdateIdentityPool":{"input":{"shape":"S8"},"output":{"shape":"S8"}}},"shapes":{"S4":{"type":"map","key":{},"value":{}},"S8":{"type":"structure","required":["IdentityPoolId","IdentityPoolName","AllowUnauthenticatedIdentities"],"members":{"IdentityPoolId":{},"IdentityPoolName":{},"AllowUnauthenticatedIdentities":{"type":"boolean"},"SupportedLoginProviders":{"shape":"S4"},"DeveloperProviderName":{}}},"Se":{"type":"map","key":{},"value":{}},"Su":{"type":"list","member":{}}}});
AWS.CognitoSync=AWS.Service.defineService("cognitosync");
AWS.Service.defineServiceApi(AWS.CognitoSync, "2014-06-30", {"metadata":{"apiVersion":"2014-06-30","endpointPrefix":"cognito-sync","jsonVersion":"1.1","serviceFullName":"Amazon Cognito Sync","signatureVersion":"v4","protocol":"rest-json"},"operations":{"DeleteDataset":{"http":{"method":"DELETE","requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}/datasets/{DatasetName}","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","IdentityId","DatasetName"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"},"DatasetName":{"location":"uri","locationName":"DatasetName"}}},"output":{"type":"structure","members":{"Dataset":{"shape":"S6"}}}},"DescribeDataset":{"http":{"method":"GET","requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}/datasets/{DatasetName}","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","IdentityId","DatasetName"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"},"DatasetName":{"location":"uri","locationName":"DatasetName"}}},"output":{"type":"structure","members":{"Dataset":{"shape":"S6"}}}},"DescribeIdentityPoolUsage":{"http":{"method":"GET","requestUri":"/identitypools/{IdentityPoolId}","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"}}},"output":{"type":"structure","members":{"IdentityPoolUsage":{"shape":"Se"}}}},"DescribeIdentityUsage":{"http":{"method":"GET","requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","IdentityId"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"}}},"output":{"type":"structure","members":{"IdentityUsage":{"type":"structure","members":{"IdentityId":{},"IdentityPoolId":{},"LastModifiedDate":{"type":"timestamp"},"DatasetCount":{"type":"integer"},"DataStorage":{"type":"long"}}}}}},"ListDatasets":{"http":{"method":"GET","requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}/datasets","responseCode":200},"input":{"type":"structure","required":["IdentityId","IdentityPoolId"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"},"NextToken":{"location":"querystring","locationName":"nextToken"},"MaxResults":{"location":"querystring","locationName":"maxResults","type":"integer"}}},"output":{"type":"structure","members":{"Datasets":{"type":"list","member":{"shape":"S6"}},"Count":{"type":"integer"},"NextToken":{}}}},"ListIdentityPoolUsage":{"http":{"method":"GET","requestUri":"/identitypools","responseCode":200},"input":{"type":"structure","members":{"NextToken":{"location":"querystring","locationName":"nextToken"},"MaxResults":{"location":"querystring","locationName":"maxResults","type":"integer"}}},"output":{"type":"structure","members":{"IdentityPoolUsages":{"type":"list","member":{"shape":"Se"}},"MaxResults":{"type":"integer"},"Count":{"type":"integer"},"NextToken":{}}}},"ListRecords":{"http":{"method":"GET","requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}/datasets/{DatasetName}/records","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","IdentityId","DatasetName"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"},"DatasetName":{"location":"uri","locationName":"DatasetName"},"LastSyncCount":{"location":"querystring","locationName":"lastSyncCount","type":"long"},"NextToken":{"location":"querystring","locationName":"nextToken"},"MaxResults":{"location":"querystring","locationName":"maxResults","type":"integer"},"SyncSessionToken":{"location":"querystring","locationName":"syncSessionToken"}}},"output":{"type":"structure","members":{"Records":{"shape":"St"},"NextToken":{},"Count":{"type":"integer"},"DatasetSyncCount":{"type":"long"},"LastModifiedBy":{},"MergedDatasetNames":{"type":"list","member":{}},"DatasetExists":{"type":"boolean"},"DatasetDeletedAfterRequestedSyncCount":{"type":"boolean"},"SyncSessionToken":{}}}},"UpdateRecords":{"http":{"requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}/datasets/{DatasetName}","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","IdentityId","DatasetName","SyncSessionToken"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"},"DatasetName":{"location":"uri","locationName":"DatasetName"},"RecordPatches":{"type":"list","member":{"type":"structure","required":["Op","Key","SyncCount"],"members":{"Op":{},"Key":{},"Value":{},"SyncCount":{"type":"long"},"DeviceLastModifiedDate":{"type":"timestamp"}}}},"SyncSessionToken":{},"ClientContext":{"location":"header","locationName":"x-amz-Client-Context"}}},"output":{"type":"structure","members":{"Records":{"shape":"St"}}}}},"shapes":{"S6":{"type":"structure","members":{"IdentityId":{},"DatasetName":{},"CreationDate":{"type":"timestamp"},"LastModifiedDate":{"type":"timestamp"},"LastModifiedBy":{},"DataStorage":{"type":"long"},"NumRecords":{"type":"long"}}},"Se":{"type":"structure","members":{"IdentityPoolId":{},"SyncSessionsCount":{"type":"long"},"DataStorage":{"type":"long"},"LastModifiedDate":{"type":"timestamp"}}},"St":{"type":"list","member":{"type":"structure","members":{"Key":{},"Value":{},"SyncCount":{"type":"long"},"LastModifiedDate":{"type":"timestamp"},"LastModifiedBy":{},"DeviceLastModifiedDate":{"type":"timestamp"}}}}}});
AWS.DynamoDB=AWS.Service.defineService("dynamodb");AWS.util.update(AWS.DynamoDB.prototype,{setupRequestListeners:function e(r){if(r.service.config.dynamoDbCrc32){r.addListener("extractData",this.checkCrc32)}},checkCrc32:function r(e){if(!e.request.service.crc32IsValid(e)){e.error=AWS.util.error(new Error,{code:"CRC32CheckFailed",message:"CRC32 integrity check failed",retryable:true})}},crc32IsValid:function t(e){var r=e.httpResponse.headers["x-amz-crc32"];if(!r)return true;return parseInt(r,10)===AWS.util.crypto.crc32(e.httpResponse.body)},defaultRetryCount:10,retryDelays:function c(){var e=this.numRetries();var r=[];for(var t=0;t<e;++t){if(t===0){r.push(0)}else{r.push(50*Math.pow(2,t-1))}}return r}});
AWS.Service.defineServiceApi(AWS.DynamoDB, "2012-08-10", {"metadata":{"apiVersion":"2012-08-10","endpointPrefix":"dynamodb","jsonVersion":"1.0","serviceAbbreviation":"DynamoDB","serviceFullName":"Amazon DynamoDB","signatureVersion":"v4","targetPrefix":"DynamoDB_20120810","protocol":"json"},"operations":{"BatchGetItem":{"input":{"type":"structure","required":["RequestItems"],"members":{"RequestItems":{"shape":"S2"},"ReturnConsumedCapacity":{}}},"output":{"type":"structure","members":{"Responses":{"type":"map","key":{},"value":{"shape":"Sr"}},"UnprocessedKeys":{"shape":"S2"},"ConsumedCapacity":{"shape":"St"}}}},"BatchWriteItem":{"input":{"type":"structure","required":["RequestItems"],"members":{"RequestItems":{"shape":"S10"},"ReturnConsumedCapacity":{},"ReturnItemCollectionMetrics":{}}},"output":{"type":"structure","members":{"UnprocessedItems":{"shape":"S10"},"ItemCollectionMetrics":{"type":"map","key":{},"value":{"type":"list","member":{"shape":"S1a"}}},"ConsumedCapacity":{"shape":"St"}}}},"CreateTable":{"input":{"type":"structure","required":["AttributeDefinitions","TableName","KeySchema","ProvisionedThroughput"],"members":{"AttributeDefinitions":{"shape":"S1f"},"TableName":{},"KeySchema":{"shape":"S1j"},"LocalSecondaryIndexes":{"type":"list","member":{"type":"structure","required":["IndexName","KeySchema","Projection"],"members":{"IndexName":{},"KeySchema":{"shape":"S1j"},"Projection":{"shape":"S1o"}}}},"GlobalSecondaryIndexes":{"type":"list","member":{"type":"structure","required":["IndexName","KeySchema","Projection","ProvisionedThroughput"],"members":{"IndexName":{},"KeySchema":{"shape":"S1j"},"Projection":{"shape":"S1o"},"ProvisionedThroughput":{"shape":"S1u"}}}},"ProvisionedThroughput":{"shape":"S1u"}}},"output":{"type":"structure","members":{"TableDescription":{"shape":"S1x"}}}},"DeleteItem":{"input":{"type":"structure","required":["TableName","Key"],"members":{"TableName":{},"Key":{"shape":"S6"},"Expected":{"shape":"S28"},"ConditionalOperator":{},"ReturnValues":{},"ReturnConsumedCapacity":{},"ReturnItemCollectionMetrics":{},"ConditionExpression":{},"ExpressionAttributeNames":{"shape":"Sm"},"ExpressionAttributeValues":{"shape":"S2g"}}},"output":{"type":"structure","members":{"Attributes":{"shape":"Ss"},"ConsumedCapacity":{"shape":"Su"},"ItemCollectionMetrics":{"shape":"S1a"}}}},"DeleteTable":{"input":{"type":"structure","required":["TableName"],"members":{"TableName":{}}},"output":{"type":"structure","members":{"TableDescription":{"shape":"S1x"}}}},"DescribeTable":{"input":{"type":"structure","required":["TableName"],"members":{"TableName":{}}},"output":{"type":"structure","members":{"Table":{"shape":"S1x"}}}},"GetItem":{"input":{"type":"structure","required":["TableName","Key"],"members":{"TableName":{},"Key":{"shape":"S6"},"AttributesToGet":{"shape":"Sj"},"ConsistentRead":{"type":"boolean"},"ReturnConsumedCapacity":{},"ProjectionExpression":{},"ExpressionAttributeNames":{"shape":"Sm"}}},"output":{"type":"structure","members":{"Item":{"shape":"Ss"},"ConsumedCapacity":{"shape":"Su"}}}},"ListTables":{"input":{"type":"structure","members":{"ExclusiveStartTableName":{},"Limit":{"type":"integer"}}},"output":{"type":"structure","members":{"TableNames":{"type":"list","member":{}},"LastEvaluatedTableName":{}}}},"PutItem":{"input":{"type":"structure","required":["TableName","Item"],"members":{"TableName":{},"Item":{"shape":"S14"},"Expected":{"shape":"S28"},"ReturnValues":{},"ReturnConsumedCapacity":{},"ReturnItemCollectionMetrics":{},"ConditionalOperator":{},"ConditionExpression":{},"ExpressionAttributeNames":{"shape":"Sm"},"ExpressionAttributeValues":{"shape":"S2g"}}},"output":{"type":"structure","members":{"Attributes":{"shape":"Ss"},"ConsumedCapacity":{"shape":"Su"},"ItemCollectionMetrics":{"shape":"S1a"}}}},"Query":{"input":{"type":"structure","required":["TableName","KeyConditions"],"members":{"TableName":{},"IndexName":{},"Select":{},"AttributesToGet":{"shape":"Sj"},"Limit":{"type":"integer"},"ConsistentRead":{"type":"boolean"},"KeyConditions":{"type":"map","key":{},"value":{"shape":"S2z"}},"QueryFilter":{"shape":"S30"},"ConditionalOperator":{},"ScanIndexForward":{"type":"boolean"},"ExclusiveStartKey":{"shape":"S6"},"ReturnConsumedCapacity":{},"ProjectionExpression":{},"FilterExpression":{},"ExpressionAttributeNames":{"shape":"Sm"},"ExpressionAttributeValues":{"shape":"S2g"}}},"output":{"type":"structure","members":{"Items":{"shape":"Sr"},"Count":{"type":"integer"},"ScannedCount":{"type":"integer"},"LastEvaluatedKey":{"shape":"S6"},"ConsumedCapacity":{"shape":"Su"}}}},"Scan":{"input":{"type":"structure","required":["TableName"],"members":{"TableName":{},"AttributesToGet":{"shape":"Sj"},"Limit":{"type":"integer"},"Select":{},"ScanFilter":{"shape":"S30"},"ConditionalOperator":{},"ExclusiveStartKey":{"shape":"S6"},"ReturnConsumedCapacity":{},"TotalSegments":{"type":"integer"},"Segment":{"type":"integer"},"ProjectionExpression":{},"FilterExpression":{},"ExpressionAttributeNames":{"shape":"Sm"},"ExpressionAttributeValues":{"shape":"S2g"}}},"output":{"type":"structure","members":{"Items":{"shape":"Sr"},"Count":{"type":"integer"},"ScannedCount":{"type":"integer"},"LastEvaluatedKey":{"shape":"S6"},"ConsumedCapacity":{"shape":"Su"}}}},"UpdateItem":{"input":{"type":"structure","required":["TableName","Key"],"members":{"TableName":{},"Key":{"shape":"S6"},"AttributeUpdates":{"type":"map","key":{},"value":{"type":"structure","members":{"Value":{"shape":"S8"},"Action":{}}}},"Expected":{"shape":"S28"},"ConditionalOperator":{},"ReturnValues":{},"ReturnConsumedCapacity":{},"ReturnItemCollectionMetrics":{},"UpdateExpression":{},"ConditionExpression":{},"ExpressionAttributeNames":{"shape":"Sm"},"ExpressionAttributeValues":{"shape":"S2g"}}},"output":{"type":"structure","members":{"Attributes":{"shape":"Ss"},"ConsumedCapacity":{"shape":"Su"},"ItemCollectionMetrics":{"shape":"S1a"}}}},"UpdateTable":{"input":{"type":"structure","required":["TableName"],"members":{"TableName":{},"ProvisionedThroughput":{"shape":"S1u"},"GlobalSecondaryIndexUpdates":{"type":"list","member":{"type":"structure","members":{"Update":{"type":"structure","required":["IndexName","ProvisionedThroughput"],"members":{"IndexName":{},"ProvisionedThroughput":{"shape":"S1u"}}}}}}}},"output":{"type":"structure","members":{"TableDescription":{"shape":"S1x"}}}}},"shapes":{"S2":{"type":"map","key":{},"value":{"type":"structure","required":["Keys"],"members":{"Keys":{"type":"list","member":{"shape":"S6"}},"AttributesToGet":{"shape":"Sj"},"ConsistentRead":{"type":"boolean"},"ProjectionExpression":{},"ExpressionAttributeNames":{"shape":"Sm"}}}},"S6":{"type":"map","key":{},"value":{"shape":"S8"}},"S8":{"type":"structure","members":{"S":{},"N":{},"B":{"type":"blob"},"SS":{"type":"list","member":{}},"NS":{"type":"list","member":{}},"BS":{"type":"list","member":{"type":"blob"}},"M":{"type":"map","key":{},"value":{"shape":"S8"}},"L":{"type":"list","member":{"shape":"S8"}},"NULL":{"type":"boolean"},"BOOL":{"type":"boolean"}}},"Sj":{"type":"list","member":{}},"Sm":{"type":"map","key":{},"value":{}},"Sr":{"type":"list","member":{"shape":"Ss"}},"Ss":{"type":"map","key":{},"value":{"shape":"S8"}},"St":{"type":"list","member":{"shape":"Su"}},"Su":{"type":"structure","members":{"TableName":{},"CapacityUnits":{"type":"double"},"Table":{"shape":"Sw"},"LocalSecondaryIndexes":{"shape":"Sx"},"GlobalSecondaryIndexes":{"shape":"Sx"}}},"Sw":{"type":"structure","members":{"CapacityUnits":{"type":"double"}}},"Sx":{"type":"map","key":{},"value":{"shape":"Sw"}},"S10":{"type":"map","key":{},"value":{"type":"list","member":{"type":"structure","members":{"PutRequest":{"type":"structure","required":["Item"],"members":{"Item":{"shape":"S14"}}},"DeleteRequest":{"type":"structure","required":["Key"],"members":{"Key":{"shape":"S6"}}}}}}},"S14":{"type":"map","key":{},"value":{"shape":"S8"}},"S1a":{"type":"structure","members":{"ItemCollectionKey":{"type":"map","key":{},"value":{"shape":"S8"}},"SizeEstimateRangeGB":{"type":"list","member":{"type":"double"}}}},"S1f":{"type":"list","member":{"type":"structure","required":["AttributeName","AttributeType"],"members":{"AttributeName":{},"AttributeType":{}}}},"S1j":{"type":"list","member":{"type":"structure","required":["AttributeName","KeyType"],"members":{"AttributeName":{},"KeyType":{}}}},"S1o":{"type":"structure","members":{"ProjectionType":{},"NonKeyAttributes":{"type":"list","member":{}}}},"S1u":{"type":"structure","required":["ReadCapacityUnits","WriteCapacityUnits"],"members":{"ReadCapacityUnits":{"type":"long"},"WriteCapacityUnits":{"type":"long"}}},"S1x":{"type":"structure","members":{"AttributeDefinitions":{"shape":"S1f"},"TableName":{},"KeySchema":{"shape":"S1j"},"TableStatus":{},"CreationDateTime":{"type":"timestamp"},"ProvisionedThroughput":{"shape":"S20"},"TableSizeBytes":{"type":"long"},"ItemCount":{"type":"long"},"LocalSecondaryIndexes":{"type":"list","member":{"type":"structure","members":{"IndexName":{},"KeySchema":{"shape":"S1j"},"Projection":{"shape":"S1o"},"IndexSizeBytes":{"type":"long"},"ItemCount":{"type":"long"}}}},"GlobalSecondaryIndexes":{"type":"list","member":{"type":"structure","members":{"IndexName":{},"KeySchema":{"shape":"S1j"},"Projection":{"shape":"S1o"},"IndexStatus":{},"ProvisionedThroughput":{"shape":"S20"},"IndexSizeBytes":{"type":"long"},"ItemCount":{"type":"long"}}}}}},"S20":{"type":"structure","members":{"LastIncreaseDateTime":{"type":"timestamp"},"LastDecreaseDateTime":{"type":"timestamp"},"NumberOfDecreasesToday":{"type":"long"},"ReadCapacityUnits":{"type":"long"},"WriteCapacityUnits":{"type":"long"}}},"S28":{"type":"map","key":{},"value":{"type":"structure","members":{"Value":{"shape":"S8"},"Exists":{"type":"boolean"},"ComparisonOperator":{},"AttributeValueList":{"shape":"S2c"}}}},"S2c":{"type":"list","member":{"shape":"S8"}},"S2g":{"type":"map","key":{},"value":{"shape":"S8"}},"S2z":{"type":"structure","required":["ComparisonOperator"],"members":{"AttributeValueList":{"shape":"S2c"},"ComparisonOperator":{}}},"S30":{"type":"map","key":{},"value":{"shape":"S2z"}}},"paginators":{"BatchGetItem":{"input_token":"RequestItems","output_token":"UnprocessedKeys"},"ListTables":{"input_token":"ExclusiveStartTableName","output_token":"LastEvaluatedTableName","limit_key":"Limit","result_key":"TableNames"},"Query":{"input_token":"ExclusiveStartKey","output_token":"LastEvaluatedKey","limit_key":"Limit","result_key":"Items"},"Scan":{"input_token":"ExclusiveStartKey","output_token":"LastEvaluatedKey","limit_key":"Limit","result_key":"Items"}},"waiters":{"__default__":{"interval":20,"max_attempts":25},"__TableState":{"operation":"DescribeTable"},"TableExists":{"extends":"__TableState","ignore_errors":["ResourceNotFoundException"],"success_type":"output","success_path":"Table.TableStatus","success_value":"ACTIVE"},"TableNotExists":{"extends":"__TableState","success_type":"error","success_value":"ResourceNotFoundException"}}});
AWS.ElasticTranscoder=AWS.Service.defineService("elastictranscoder");AWS.util.update(AWS.ElasticTranscoder.prototype,{setupRequestListeners:function r(e){e.addListener("extractError",this.extractErrorCode)},extractErrorCode:function e(r){var e=r.httpResponse.headers["x-amzn-errortype"];if(!e)e="UnknownError";r.error.name=r.error.code=e.split(":")[0]}});
AWS.Service.defineServiceApi(AWS.ElasticTranscoder, "2012-09-25", {"metadata":{"apiVersion":"2012-09-25","endpointPrefix":"elastictranscoder","serviceFullName":"Amazon Elastic Transcoder","signatureVersion":"v4","protocol":"rest-json"},"operations":{"CancelJob":{"http":{"method":"DELETE","requestUri":"/2012-09-25/jobs/{Id}","responseCode":202},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"}}},"output":{"type":"structure","members":{}}},"CreateJob":{"http":{"requestUri":"/2012-09-25/jobs","responseCode":201},"input":{"type":"structure","required":["PipelineId","Input"],"members":{"PipelineId":{},"Input":{"shape":"S5"},"Output":{"shape":"Sc"},"Outputs":{"type":"list","member":{"shape":"Sc"}},"OutputKeyPrefix":{},"Playlists":{"type":"list","member":{"type":"structure","members":{"Name":{},"Format":{},"OutputKeys":{"shape":"S1b"}}}}}},"output":{"type":"structure","members":{"Job":{"shape":"S1d"}}}},"CreatePipeline":{"http":{"requestUri":"/2012-09-25/pipelines","responseCode":201},"input":{"type":"structure","required":["Name","InputBucket","Role"],"members":{"Name":{},"InputBucket":{},"OutputBucket":{},"Role":{},"Notifications":{"shape":"S1q"},"ContentConfig":{"shape":"S1s"},"ThumbnailConfig":{"shape":"S1s"}}},"output":{"type":"structure","members":{"Pipeline":{"shape":"S21"}}}},"CreatePreset":{"http":{"requestUri":"/2012-09-25/presets","responseCode":201},"input":{"type":"structure","required":["Name","Container"],"members":{"Name":{},"Description":{},"Container":{},"Video":{"shape":"S25"},"Audio":{"shape":"S2l"},"Thumbnails":{"shape":"S2s"}}},"output":{"type":"structure","members":{"Preset":{"shape":"S2w"},"Warning":{}}}},"DeletePipeline":{"http":{"method":"DELETE","requestUri":"/2012-09-25/pipelines/{Id}","responseCode":202},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"}}},"output":{"type":"structure","members":{}}},"DeletePreset":{"http":{"method":"DELETE","requestUri":"/2012-09-25/presets/{Id}","responseCode":202},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"}}},"output":{"type":"structure","members":{}}},"ListJobsByPipeline":{"http":{"method":"GET","requestUri":"/2012-09-25/jobsByPipeline/{PipelineId}"},"input":{"type":"structure","required":["PipelineId"],"members":{"PipelineId":{"location":"uri","locationName":"PipelineId"},"Ascending":{"location":"querystring","locationName":"Ascending"},"PageToken":{"location":"querystring","locationName":"PageToken"}}},"output":{"type":"structure","members":{"Jobs":{"shape":"S35"},"NextPageToken":{}}}},"ListJobsByStatus":{"http":{"method":"GET","requestUri":"/2012-09-25/jobsByStatus/{Status}"},"input":{"type":"structure","required":["Status"],"members":{"Status":{"location":"uri","locationName":"Status"},"Ascending":{"location":"querystring","locationName":"Ascending"},"PageToken":{"location":"querystring","locationName":"PageToken"}}},"output":{"type":"structure","members":{"Jobs":{"shape":"S35"},"NextPageToken":{}}}},"ListPipelines":{"http":{"method":"GET","requestUri":"/2012-09-25/pipelines"},"input":{"type":"structure","members":{"Ascending":{"location":"querystring","locationName":"Ascending"},"PageToken":{"location":"querystring","locationName":"PageToken"}}},"output":{"type":"structure","members":{"Pipelines":{"type":"list","member":{"shape":"S21"}},"NextPageToken":{}}}},"ListPresets":{"http":{"method":"GET","requestUri":"/2012-09-25/presets"},"input":{"type":"structure","members":{"Ascending":{"location":"querystring","locationName":"Ascending"},"PageToken":{"location":"querystring","locationName":"PageToken"}}},"output":{"type":"structure","members":{"Presets":{"type":"list","member":{"shape":"S2w"}},"NextPageToken":{}}}},"ReadJob":{"http":{"method":"GET","requestUri":"/2012-09-25/jobs/{Id}"},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"}}},"output":{"type":"structure","members":{"Job":{"shape":"S1d"}}}},"ReadPipeline":{"http":{"method":"GET","requestUri":"/2012-09-25/pipelines/{Id}"},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"}}},"output":{"type":"structure","members":{"Pipeline":{"shape":"S21"}}}},"ReadPreset":{"http":{"method":"GET","requestUri":"/2012-09-25/presets/{Id}"},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"}}},"output":{"type":"structure","members":{"Preset":{"shape":"S2w"}}}},"TestRole":{"http":{"requestUri":"/2012-09-25/roleTests","responseCode":200},"input":{"type":"structure","required":["Role","InputBucket","OutputBucket","Topics"],"members":{"Role":{},"InputBucket":{},"OutputBucket":{},"Topics":{"type":"list","member":{}}}},"output":{"type":"structure","members":{"Success":{},"Messages":{"type":"list","member":{}}}}},"UpdatePipeline":{"http":{"method":"PUT","requestUri":"/2012-09-25/pipelines/{Id}","responseCode":200},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"},"Name":{},"InputBucket":{},"Role":{},"Notifications":{"shape":"S1q"},"ContentConfig":{"shape":"S1s"},"ThumbnailConfig":{"shape":"S1s"}}},"output":{"type":"structure","members":{"Pipeline":{"shape":"S21"}}}},"UpdatePipelineNotifications":{"http":{"requestUri":"/2012-09-25/pipelines/{Id}/notifications"},"input":{"type":"structure","required":["Id","Notifications"],"members":{"Id":{"location":"uri","locationName":"Id"},"Notifications":{"shape":"S1q"}}},"output":{"type":"structure","members":{"Pipeline":{"shape":"S21"}}}},"UpdatePipelineStatus":{"http":{"requestUri":"/2012-09-25/pipelines/{Id}/status"},"input":{"type":"structure","required":["Id","Status"],"members":{"Id":{"location":"uri","locationName":"Id"},"Status":{}}},"output":{"type":"structure","members":{"Pipeline":{"shape":"S21"}}}}},"shapes":{"S5":{"type":"structure","members":{"Key":{},"FrameRate":{},"Resolution":{},"AspectRatio":{},"Interlaced":{},"Container":{}}},"Sc":{"type":"structure","members":{"Key":{},"ThumbnailPattern":{},"Rotate":{},"PresetId":{},"SegmentDuration":{},"Watermarks":{"shape":"Sg"},"AlbumArt":{"shape":"Sk"},"Composition":{"shape":"Ss"},"Captions":{"shape":"Sw"}}},"Sg":{"type":"list","member":{"type":"structure","members":{"PresetWatermarkId":{},"InputKey":{}}}},"Sk":{"type":"structure","members":{"MergePolicy":{},"Artwork":{"type":"list","member":{"type":"structure","members":{"InputKey":{},"MaxWidth":{},"MaxHeight":{},"SizingPolicy":{},"PaddingPolicy":{},"AlbumArtFormat":{}}}}}},"Ss":{"type":"list","member":{"type":"structure","members":{"TimeSpan":{"type":"structure","members":{"StartTime":{},"Duration":{}}}}}},"Sw":{"type":"structure","members":{"MergePolicy":{},"CaptionSources":{"type":"list","member":{"type":"structure","members":{"Key":{},"Language":{},"TimeOffset":{},"Label":{}}}},"CaptionFormats":{"type":"list","member":{"type":"structure","members":{"Format":{},"Pattern":{}}}}}},"S1b":{"type":"list","member":{}},"S1d":{"type":"structure","members":{"Id":{},"Arn":{},"PipelineId":{},"Input":{"shape":"S5"},"Output":{"shape":"S1f"},"Outputs":{"type":"list","member":{"shape":"S1f"}},"OutputKeyPrefix":{},"Playlists":{"type":"list","member":{"type":"structure","members":{"Name":{},"Format":{},"OutputKeys":{"shape":"S1b"},"Status":{},"StatusDetail":{}}}},"Status":{}}},"S1f":{"type":"structure","members":{"Id":{},"Key":{},"ThumbnailPattern":{},"Rotate":{},"PresetId":{},"SegmentDuration":{},"Status":{},"StatusDetail":{},"Duration":{"type":"long"},"Width":{"type":"integer"},"Height":{"type":"integer"},"Watermarks":{"shape":"Sg"},"AlbumArt":{"shape":"Sk"},"Composition":{"shape":"Ss"},"Captions":{"shape":"Sw"}}},"S1q":{"type":"structure","members":{"Progressing":{},"Completed":{},"Warning":{},"Error":{}}},"S1s":{"type":"structure","members":{"Bucket":{},"StorageClass":{},"Permissions":{"type":"list","member":{"type":"structure","members":{"GranteeType":{},"Grantee":{},"Access":{"type":"list","member":{}}}}}}},"S21":{"type":"structure","members":{"Id":{},"Arn":{},"Name":{},"Status":{},"InputBucket":{},"OutputBucket":{},"Role":{},"Notifications":{"shape":"S1q"},"ContentConfig":{"shape":"S1s"},"ThumbnailConfig":{"shape":"S1s"}}},"S25":{"type":"structure","members":{"Codec":{},"CodecOptions":{"type":"map","key":{},"value":{}},"KeyframesMaxDist":{},"FixedGOP":{},"BitRate":{},"FrameRate":{},"MaxFrameRate":{},"Resolution":{},"AspectRatio":{},"MaxWidth":{},"MaxHeight":{},"DisplayAspectRatio":{},"SizingPolicy":{},"PaddingPolicy":{},"Watermarks":{"type":"list","member":{"type":"structure","members":{"Id":{},"MaxWidth":{},"MaxHeight":{},"SizingPolicy":{},"HorizontalAlign":{},"HorizontalOffset":{},"VerticalAlign":{},"VerticalOffset":{},"Opacity":{},"Target":{}}}}}},"S2l":{"type":"structure","members":{"Codec":{},"SampleRate":{},"BitRate":{},"Channels":{},"CodecOptions":{"type":"structure","members":{"Profile":{}}}}},"S2s":{"type":"structure","members":{"Format":{},"Interval":{},"Resolution":{},"AspectRatio":{},"MaxWidth":{},"MaxHeight":{},"SizingPolicy":{},"PaddingPolicy":{}}},"S2w":{"type":"structure","members":{"Id":{},"Arn":{},"Name":{},"Description":{},"Container":{},"Audio":{"shape":"S2l"},"Video":{"shape":"S25"},"Thumbnails":{"shape":"S2s"},"Type":{}}},"S35":{"type":"list","member":{"shape":"S1d"}}},"paginators":{"ListJobsByPipeline":{"input_token":"PageToken","output_token":"NextPageToken","result_key":"Jobs"},"ListJobsByStatus":{"input_token":"PageToken","output_token":"NextPageToken","result_key":"Jobs"},"ListPipelines":{"input_token":"PageToken","output_token":"NextPageToken","result_key":"Pipelines"},"ListPresets":{"input_token":"PageToken","output_token":"NextPageToken","result_key":"Presets"}},"waiters":{"JobComplete":{"operation":"ReadJob","success_type":"output","success_path":"Job.Status","interval":30,"max_attempts":120,"success_value":"Complete","failure_value":["Canceled","Error"]}}});
AWS.Kinesis=AWS.Service.defineService("kinesis");
AWS.Service.defineServiceApi(AWS.Kinesis, "2013-12-02", {"metadata":{"apiVersion":"2013-12-02","endpointPrefix":"kinesis","jsonVersion":"1.1","serviceAbbreviation":"Kinesis","serviceFullName":"Amazon Kinesis","signatureVersion":"v4","targetPrefix":"Kinesis_20131202","protocol":"json"},"operations":{"AddTagsToStream":{"input":{"type":"structure","required":["StreamName","Tags"],"members":{"StreamName":{},"Tags":{"type":"map","key":{},"value":{}}}}},"CreateStream":{"input":{"type":"structure","required":["StreamName","ShardCount"],"members":{"StreamName":{},"ShardCount":{"type":"integer"}}}},"DeleteStream":{"input":{"type":"structure","required":["StreamName"],"members":{"StreamName":{}}}},"DescribeStream":{"input":{"type":"structure","required":["StreamName"],"members":{"StreamName":{},"Limit":{"type":"integer"},"ExclusiveStartShardId":{}}},"output":{"type":"structure","required":["StreamDescription"],"members":{"StreamDescription":{"type":"structure","required":["StreamName","StreamARN","StreamStatus","Shards","HasMoreShards"],"members":{"StreamName":{},"StreamARN":{},"StreamStatus":{},"Shards":{"type":"list","member":{"type":"structure","required":["ShardId","HashKeyRange","SequenceNumberRange"],"members":{"ShardId":{},"ParentShardId":{},"AdjacentParentShardId":{},"HashKeyRange":{"type":"structure","required":["StartingHashKey","EndingHashKey"],"members":{"StartingHashKey":{},"EndingHashKey":{}}},"SequenceNumberRange":{"type":"structure","required":["StartingSequenceNumber"],"members":{"StartingSequenceNumber":{},"EndingSequenceNumber":{}}}}}},"HasMoreShards":{"type":"boolean"}}}}}},"GetRecords":{"input":{"type":"structure","required":["ShardIterator"],"members":{"ShardIterator":{},"Limit":{"type":"integer"}}},"output":{"type":"structure","required":["Records"],"members":{"Records":{"type":"list","member":{"type":"structure","required":["SequenceNumber","Data","PartitionKey"],"members":{"SequenceNumber":{},"Data":{"type":"blob"},"PartitionKey":{}}}},"NextShardIterator":{}}}},"GetShardIterator":{"input":{"type":"structure","required":["StreamName","ShardId","ShardIteratorType"],"members":{"StreamName":{},"ShardId":{},"ShardIteratorType":{},"StartingSequenceNumber":{}}},"output":{"type":"structure","members":{"ShardIterator":{}}}},"ListStreams":{"input":{"type":"structure","members":{"Limit":{"type":"integer"},"ExclusiveStartStreamName":{}}},"output":{"type":"structure","required":["StreamNames","HasMoreStreams"],"members":{"StreamNames":{"type":"list","member":{}},"HasMoreStreams":{"type":"boolean"}}}},"ListTagsForStream":{"input":{"type":"structure","required":["StreamName"],"members":{"StreamName":{},"ExclusiveStartTagKey":{},"Limit":{"type":"integer"}}},"output":{"type":"structure","required":["Tags","HasMoreTags"],"members":{"Tags":{"type":"list","member":{"type":"structure","required":["Key"],"members":{"Key":{},"Value":{}}}},"HasMoreTags":{"type":"boolean"}}}},"MergeShards":{"input":{"type":"structure","required":["StreamName","ShardToMerge","AdjacentShardToMerge"],"members":{"StreamName":{},"ShardToMerge":{},"AdjacentShardToMerge":{}}}},"PutRecord":{"input":{"type":"structure","required":["StreamName","Data","PartitionKey"],"members":{"StreamName":{},"Data":{"type":"blob"},"PartitionKey":{},"ExplicitHashKey":{},"SequenceNumberForOrdering":{}}},"output":{"type":"structure","required":["ShardId","SequenceNumber"],"members":{"ShardId":{},"SequenceNumber":{}}}},"RemoveTagsFromStream":{"input":{"type":"structure","required":["StreamName","TagKeys"],"members":{"StreamName":{},"TagKeys":{"type":"list","member":{}}}}},"SplitShard":{"input":{"type":"structure","required":["StreamName","ShardToSplit","NewStartingHashKey"],"members":{"StreamName":{},"ShardToSplit":{},"NewStartingHashKey":{}}}}},"shapes":{},"paginators":{"DescribeStream":{"input_token":"ExclusiveStartShardId","limit_key":"Limit","more_results":"StreamDescription.HasMoreShards","output_token":"StreamDescription.Shards[-1].ShardId","result_key":"StreamDescription.Shards"},"ListStreams":{"input_token":"ExclusiveStartStreamName","limit_key":"Limit","more_results":"HasMoreStreams","output_token":"StreamNames[-1]","result_key":"StreamNames"}}});
AWS.S3=AWS.Service.defineService("s3");AWS.util.update(AWS.S3.prototype,{validateService:function e(){if(!this.config.region)this.config.region="us-east-1"},setupRequestListeners:function t(e){e.addListener("validate",this.validateScheme);e.addListener("build",this.addContentType);e.addListener("build",this.populateURI);e.addListener("build",this.computeContentMd5);e.addListener("build",this.computeSha256);e.addListener("build",this.computeSseCustomerKeyMd5);e.removeListener("validate",AWS.EventListeners.Core.VALIDATE_REGION);e.addListener("extractError",this.extractError);e.addListener("extractData",this.extractData);e.addListener("beforePresign",this.prepareSignedUrl)},validateScheme:function(e){var t=e.params,r=e.httpRequest.endpoint.protocol,n=t.SSECustomerKey||t.CopySourceSSECustomerKey;if(n&&r!=="https:"){var o="Cannot send SSE keys over HTTP. Set 'sslEnabled'"+"to 'true' in your configuration";throw AWS.util.error(new Error,{code:"ConfigError",message:o})}},populateURI:function r(e){var t=e.httpRequest;var r=e.params.Bucket;if(r){if(!e.service.pathStyleBucketName(r)){t.endpoint.hostname=r+"."+t.endpoint.hostname;var n=t.endpoint.port;if(n!==80&&n!==443){t.endpoint.host=t.endpoint.hostname+":"+t.endpoint.port}else{t.endpoint.host=t.endpoint.hostname}t.virtualHostedBucket=r;t.path=t.path.replace(new RegExp("/"+r),"");if(t.path[0]!=="/"){t.path="/"+t.path}}}},addContentType:function n(e){var t=e.httpRequest;if(t.method==="GET"||t.method==="HEAD"){delete t.headers["Content-Type"];return}if(!t.headers["Content-Type"]){t.headers["Content-Type"]="application/octet-stream"}var r=t.headers["Content-Type"];if(AWS.util.isBrowser()){if(typeof t.body==="string"&&!r.match(/;\s*charset=/)){var n="; charset=UTF-8";t.headers["Content-Type"]+=n}else{var o=function(e,t,r){return t+r.toUpperCase()};t.headers["Content-Type"]=r.replace(/(;\s*charset=)(.+)$/,o)}}},computableChecksumOperations:{putBucketCors:true,putBucketLifecycle:true,putBucketTagging:true,deleteObjects:true},willComputeChecksums:function o(e){if(this.computableChecksumOperations[e.operation])return true;if(!this.config.computeChecksums)return false;if(!AWS.util.Buffer.isBuffer(e.httpRequest.body)&&typeof e.httpRequest.body!=="string"){return false}var t=e.service.api.operations[e.operation].input.members;if(e.service.getSignerClass(e)===AWS.Signers.V4){if(t.ContentMD5&&!t.ContentMD5.required)return false}if(t.ContentMD5&&!e.params.ContentMD5)return true},computeContentMd5:function i(e){if(e.service.willComputeChecksums(e)){var t=AWS.util.crypto.md5(e.httpRequest.body,"base64");e.httpRequest.headers["Content-MD5"]=t}},computeSha256:function a(e){if(e.service.getSignerClass(e)===AWS.Signers.V4){e.httpRequest.headers["X-Amz-Content-Sha256"]=AWS.util.crypto.sha256(e.httpRequest.body||"","hex")}},computeSseCustomerKeyMd5:function s(e){var t=["x-amz-server-side-encryption-customer-key","x-amz-copy-source-server-side-encryption-customer-key"];AWS.util.arrayEach(t,function(t){if(e.httpRequest.headers[t]){var r=e.httpRequest.headers[t];var n=t+"-MD5";e.httpRequest.headers[t]=AWS.util.base64.encode(r);if(!e.httpRequest.headers[n]){var o=AWS.util.crypto.md5(r,"base64");e.httpRequest.headers[n]=AWS.util.base64.encode(o)}}})},pathStyleBucketName:function u(e){if(this.config.s3ForcePathStyle)return true;if(this.dnsCompatibleBucketName(e)){return this.config.sslEnabled&&e.match(/\./)?true:false}else{return true}},dnsCompatibleBucketName:function p(e){var t=e;var r=new RegExp(/^[a-z0-9][a-z0-9\.\-]{1,61}[a-z0-9]$/);var n=new RegExp(/(\d+\.){3}\d+/);var o=new RegExp(/\.\./);return t.match(r)&&!t.match(n)&&!t.match(o)?true:false},escapePathParam:function c(e){return AWS.util.uriEscapePath(String(e))},successfulResponse:function d(e){var t=e.request;var r=e.httpResponse;if(t.operation==="completeMultipartUpload"&&r.body.toString().match("<Error>"))return false;else return r.statusCode<300},retryableError:function h(e,t){if(t.operation==="completeMultipartUpload"&&e.statusCode===200){return true}else if(e&&e.code==="RequestTimeout"){return true}else{var r=AWS.Service.prototype.retryableError;return r.call(this,e,t)}},extractData:function l(e){var t=e.request;if(t.operation==="getBucketLocation"){var r=e.httpResponse.body.toString().match(/>(.+)<\/Location/);if(r){delete e.data["_"];e.data.LocationConstraint=r[1]}}},extractError:function f(e){var t={304:"NotModified",403:"Forbidden",400:"BadRequest",404:"NotFound"};var r=e.httpResponse.statusCode;var n=e.httpResponse.body;if(t[r]&&n.length===0){e.error=AWS.util.error(new Error,{code:t[e.httpResponse.statusCode],message:null})}else{var o=(new AWS.XML.Parser).parse(n.toString());e.error=AWS.util.error(new Error,{code:o.Code||r,message:o.Message||null})}},getSignedUrl:function m(e,t,r){t=AWS.util.copy(t||{});var n=t.Expires||900;delete t.Expires;var o=this.makeRequest(e,t);return o.presign(n,r)},prepareSignedUrl:function S(e){e.removeListener("build",e.service.addContentType);if(!e.params.Body){e.removeListener("build",e.service.computeContentMd5);e.removeListener("build",e.service.computeSha256)}},createBucket:function v(e,t){if(!e)e={};var r=this.endpoint.hostname;if(r!==this.api.globalEndpoint&&!e.CreateBucketConfiguration){e.CreateBucketConfiguration={LocationConstraint:this.config.region}}return this.makeRequest("createBucket",e,t)}});
AWS.Service.defineServiceApi(AWS.S3, "2006-03-01", {"metadata":{"apiVersion":"2006-03-01","checksumFormat":"md5","endpointPrefix":"s3","globalEndpoint":"s3.amazonaws.com","serviceAbbreviation":"Amazon S3","serviceFullName":"Amazon Simple Storage Service","signatureVersion":"s3","timestampFormat":"rfc822","protocol":"rest-xml"},"operations":{"AbortMultipartUpload":{"http":{"method":"DELETE","requestUri":"/{Bucket}/{Key}"},"input":{"type":"structure","required":["Bucket","Key","UploadId"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"},"UploadId":{"location":"querystring","locationName":"uploadId"}}}},"CompleteMultipartUpload":{"http":{"requestUri":"/{Bucket}/{Key}"},"input":{"type":"structure","required":["Bucket","Key","UploadId"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"},"MultipartUpload":{"locationName":"CompleteMultipartUpload","xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","type":"structure","members":{"Parts":{"locationName":"Part","type":"list","member":{"type":"structure","members":{"ETag":{},"PartNumber":{"type":"integer"}}},"flattened":true}}},"UploadId":{"location":"querystring","locationName":"uploadId"}},"payload":"MultipartUpload"},"output":{"type":"structure","members":{"Location":{},"Bucket":{},"Key":{},"Expiration":{"location":"header","locationName":"x-amz-expiration","type":"timestamp"},"ETag":{},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"VersionId":{"location":"header","locationName":"x-amz-version-id"}}}},"CopyObject":{"http":{"method":"PUT","requestUri":"/{Bucket}/{Key}"},"input":{"type":"structure","required":["Bucket","CopySource","Key"],"members":{"ACL":{"location":"header","locationName":"x-amz-acl"},"Bucket":{"location":"uri","locationName":"Bucket"},"CacheControl":{"location":"header","locationName":"Cache-Control"},"ContentDisposition":{"location":"header","locationName":"Content-Disposition"},"ContentEncoding":{"location":"header","locationName":"Content-Encoding"},"ContentLanguage":{"location":"header","locationName":"Content-Language"},"ContentType":{"location":"header","locationName":"Content-Type"},"CopySource":{"location":"header","locationName":"x-amz-copy-source"},"CopySourceIfMatch":{"location":"header","locationName":"x-amz-copy-source-if-match"},"CopySourceIfModifiedSince":{"location":"header","locationName":"x-amz-copy-source-if-modified-since","type":"timestamp"},"CopySourceIfNoneMatch":{"location":"header","locationName":"x-amz-copy-source-if-none-match"},"CopySourceIfUnmodifiedSince":{"location":"header","locationName":"x-amz-copy-source-if-unmodified-since","type":"timestamp"},"Expires":{"location":"header","locationName":"Expires","type":"timestamp"},"GrantFullControl":{"location":"header","locationName":"x-amz-grant-full-control"},"GrantRead":{"location":"header","locationName":"x-amz-grant-read"},"GrantReadACP":{"location":"header","locationName":"x-amz-grant-read-acp"},"GrantWriteACP":{"location":"header","locationName":"x-amz-grant-write-acp"},"Key":{"location":"uri","locationName":"Key"},"Metadata":{"shape":"Sx","location":"headers","locationName":"x-amz-meta-"},"MetadataDirective":{"location":"header","locationName":"x-amz-metadata-directive"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"StorageClass":{"location":"header","locationName":"x-amz-storage-class"},"WebsiteRedirectLocation":{"location":"header","locationName":"x-amz-website-redirect-location"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"CopySourceSSECustomerAlgorithm":{"location":"header","locationName":"x-amz-copy-source-server-side-encryption-customer-algorithm"},"CopySourceSSECustomerKey":{"location":"header","locationName":"x-amz-copy-source-server-side-encryption-customer-key"},"CopySourceSSECustomerKeyMD5":{"location":"header","locationName":"x-amz-copy-source-server-side-encryption-customer-key-MD5"}}},"output":{"type":"structure","members":{"CopyObjectResult":{"type":"structure","members":{"ETag":{},"LastModified":{"type":"timestamp"}}},"Expiration":{"location":"header","locationName":"x-amz-expiration","type":"timestamp"},"CopySourceVersionId":{"location":"header","locationName":"x-amz-copy-source-version-id"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"}},"payload":"CopyObjectResult"},"alias":"PutObjectCopy"},"CreateBucket":{"http":{"method":"PUT","requestUri":"/{Bucket}"},"input":{"type":"structure","required":["Bucket"],"members":{"ACL":{"location":"header","locationName":"x-amz-acl"},"Bucket":{"location":"uri","locationName":"Bucket"},"CreateBucketConfiguration":{"xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"CreateBucketConfiguration","type":"structure","members":{"LocationConstraint":{}}},"GrantFullControl":{"location":"header","locationName":"x-amz-grant-full-control"},"GrantRead":{"location":"header","locationName":"x-amz-grant-read"},"GrantReadACP":{"location":"header","locationName":"x-amz-grant-read-acp"},"GrantWrite":{"location":"header","locationName":"x-amz-grant-write"},"GrantWriteACP":{"location":"header","locationName":"x-amz-grant-write-acp"}},"payload":"CreateBucketConfiguration"},"output":{"type":"structure","members":{"Location":{"location":"header","locationName":"Location"}}},"alias":"PutBucket"},"CreateMultipartUpload":{"http":{"requestUri":"/{Bucket}/{Key}?uploads"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"ACL":{"location":"header","locationName":"x-amz-acl"},"Bucket":{"location":"uri","locationName":"Bucket"},"CacheControl":{"location":"header","locationName":"Cache-Control"},"ContentDisposition":{"location":"header","locationName":"Content-Disposition"},"ContentEncoding":{"location":"header","locationName":"Content-Encoding"},"ContentLanguage":{"location":"header","locationName":"Content-Language"},"ContentType":{"location":"header","locationName":"Content-Type"},"Expires":{"location":"header","locationName":"Expires","type":"timestamp"},"GrantFullControl":{"location":"header","locationName":"x-amz-grant-full-control"},"GrantRead":{"location":"header","locationName":"x-amz-grant-read"},"GrantReadACP":{"location":"header","locationName":"x-amz-grant-read-acp"},"GrantWriteACP":{"location":"header","locationName":"x-amz-grant-write-acp"},"Key":{"location":"uri","locationName":"Key"},"Metadata":{"shape":"Sx","location":"headers","locationName":"x-amz-meta-"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"StorageClass":{"location":"header","locationName":"x-amz-storage-class"},"WebsiteRedirectLocation":{"location":"header","locationName":"x-amz-website-redirect-location"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"}}},"output":{"type":"structure","members":{"Bucket":{"locationName":"Bucket"},"Key":{},"UploadId":{},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"}}},"alias":"InitiateMultipartUpload"},"DeleteBucket":{"http":{"method":"DELETE","requestUri":"/{Bucket}"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"DeleteBucketCors":{"http":{"method":"DELETE","requestUri":"/{Bucket}?cors"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"DeleteBucketLifecycle":{"http":{"method":"DELETE","requestUri":"/{Bucket}?lifecycle"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"DeleteBucketPolicy":{"http":{"method":"DELETE","requestUri":"/{Bucket}?policy"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"DeleteBucketTagging":{"http":{"method":"DELETE","requestUri":"/{Bucket}?tagging"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"DeleteBucketWebsite":{"http":{"method":"DELETE","requestUri":"/{Bucket}?website"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"DeleteObject":{"http":{"method":"DELETE","requestUri":"/{Bucket}/{Key}"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"},"MFA":{"location":"header","locationName":"x-amz-mfa"},"VersionId":{"location":"querystring","locationName":"versionId"}}},"output":{"type":"structure","members":{"DeleteMarker":{"location":"header","locationName":"x-amz-delete-marker","type":"boolean"},"VersionId":{"location":"header","locationName":"x-amz-version-id"}}}},"DeleteObjects":{"http":{"requestUri":"/{Bucket}?delete"},"input":{"type":"structure","required":["Bucket","Delete"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Delete":{"xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"Delete","type":"structure","required":["Objects"],"members":{"Objects":{"locationName":"Object","type":"list","member":{"type":"structure","required":["Key"],"members":{"Key":{},"VersionId":{}}},"flattened":true},"Quiet":{"type":"boolean"}}},"MFA":{"location":"header","locationName":"x-amz-mfa"}},"payload":"Delete"},"output":{"type":"structure","members":{"Deleted":{"type":"list","member":{"type":"structure","members":{"Key":{},"VersionId":{},"DeleteMarker":{"type":"boolean"},"DeleteMarkerVersionId":{}}},"flattened":true},"Errors":{"locationName":"Error","type":"list","member":{"type":"structure","members":{"Key":{},"VersionId":{},"Code":{},"Message":{}}},"flattened":true}}},"alias":"DeleteMultipleObjects"},"GetBucketAcl":{"http":{"method":"GET","requestUri":"/{Bucket}?acl"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"Owner":{"shape":"S2a"},"Grants":{"shape":"S2d","locationName":"AccessControlList"}}}},"GetBucketCors":{"http":{"method":"GET","requestUri":"/{Bucket}?cors"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"CORSRules":{"shape":"S2m","locationName":"CORSRule"}}}},"GetBucketLifecycle":{"http":{"method":"GET","requestUri":"/{Bucket}?lifecycle"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"Rules":{"shape":"S2z","locationName":"Rule"}}}},"GetBucketLocation":{"http":{"method":"GET","requestUri":"/{Bucket}?location"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"LocationConstraint":{}}}},"GetBucketLogging":{"http":{"method":"GET","requestUri":"/{Bucket}?logging"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"LoggingEnabled":{"shape":"S3e"}}}},"GetBucketNotification":{"http":{"method":"GET","requestUri":"/{Bucket}?notification"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"TopicConfiguration":{"shape":"S3m"}}}},"GetBucketPolicy":{"http":{"method":"GET","requestUri":"/{Bucket}?policy"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"Policy":{}},"payload":"Policy"}},"GetBucketRequestPayment":{"http":{"method":"GET","requestUri":"/{Bucket}?requestPayment"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"Payer":{}}}},"GetBucketTagging":{"http":{"method":"GET","requestUri":"/{Bucket}?tagging"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","required":["TagSet"],"members":{"TagSet":{"shape":"S3x"}}}},"GetBucketVersioning":{"http":{"method":"GET","requestUri":"/{Bucket}?versioning"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"Status":{},"MFADelete":{"locationName":"MfaDelete"}}}},"GetBucketWebsite":{"http":{"method":"GET","requestUri":"/{Bucket}?website"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"RedirectAllRequestsTo":{"shape":"S46"},"IndexDocument":{"shape":"S49"},"ErrorDocument":{"shape":"S4b"},"RoutingRules":{"shape":"S4c"}}}},"GetObject":{"http":{"method":"GET","requestUri":"/{Bucket}/{Key}"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"IfMatch":{"location":"header","locationName":"If-Match"},"IfModifiedSince":{"location":"header","locationName":"If-Modified-Since","type":"timestamp"},"IfNoneMatch":{"location":"header","locationName":"If-None-Match"},"IfUnmodifiedSince":{"location":"header","locationName":"If-Unmodified-Since","type":"timestamp"},"Key":{"location":"uri","locationName":"Key"},"Range":{"location":"header","locationName":"Range"},"ResponseCacheControl":{"location":"querystring","locationName":"response-cache-control"},"ResponseContentDisposition":{"location":"querystring","locationName":"response-content-disposition"},"ResponseContentEncoding":{"location":"querystring","locationName":"response-content-encoding"},"ResponseContentLanguage":{"location":"querystring","locationName":"response-content-language"},"ResponseContentType":{"location":"querystring","locationName":"response-content-type"},"ResponseExpires":{"location":"querystring","locationName":"response-expires","type":"timestamp"},"VersionId":{"location":"querystring","locationName":"versionId"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"}}},"output":{"type":"structure","members":{"Body":{"streaming":true,"type":"blob"},"DeleteMarker":{"location":"header","locationName":"x-amz-delete-marker","type":"boolean"},"AcceptRanges":{"location":"header","locationName":"accept-ranges"},"Expiration":{"location":"header","locationName":"x-amz-expiration","type":"timestamp"},"Restore":{"location":"header","locationName":"x-amz-restore"},"LastModified":{"location":"header","locationName":"Last-Modified","type":"timestamp"},"ContentLength":{"location":"header","locationName":"Content-Length","type":"integer"},"ETag":{"location":"header","locationName":"ETag"},"MissingMeta":{"location":"header","locationName":"x-amz-missing-meta","type":"integer"},"VersionId":{"location":"header","locationName":"x-amz-version-id"},"CacheControl":{"location":"header","locationName":"Cache-Control"},"ContentDisposition":{"location":"header","locationName":"Content-Disposition"},"ContentEncoding":{"location":"header","locationName":"Content-Encoding"},"ContentLanguage":{"location":"header","locationName":"Content-Language"},"ContentType":{"location":"header","locationName":"Content-Type"},"Expires":{"location":"header","locationName":"Expires","type":"timestamp"},"WebsiteRedirectLocation":{"location":"header","locationName":"x-amz-website-redirect-location"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"Metadata":{"shape":"Sx","location":"headers","locationName":"x-amz-meta-"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"}},"payload":"Body"}},"GetObjectAcl":{"http":{"method":"GET","requestUri":"/{Bucket}/{Key}?acl"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"},"VersionId":{"location":"querystring","locationName":"versionId"}}},"output":{"type":"structure","members":{"Owner":{"shape":"S2a"},"Grants":{"shape":"S2d","locationName":"AccessControlList"}}}},"GetObjectTorrent":{"http":{"method":"GET","requestUri":"/{Bucket}/{Key}?torrent"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"}}},"output":{"type":"structure","members":{"Body":{"streaming":true,"type":"blob"}},"payload":"Body"}},"HeadBucket":{"http":{"method":"HEAD","requestUri":"/{Bucket}"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"HeadObject":{"http":{"method":"HEAD","requestUri":"/{Bucket}/{Key}"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"IfMatch":{"location":"header","locationName":"If-Match"},"IfModifiedSince":{"location":"header","locationName":"If-Modified-Since","type":"timestamp"},"IfNoneMatch":{"location":"header","locationName":"If-None-Match"},"IfUnmodifiedSince":{"location":"header","locationName":"If-Unmodified-Since","type":"timestamp"},"Key":{"location":"uri","locationName":"Key"},"Range":{"location":"header","locationName":"Range"},"VersionId":{"location":"querystring","locationName":"versionId"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"}}},"output":{"type":"structure","members":{"DeleteMarker":{"location":"header","locationName":"x-amz-delete-marker","type":"boolean"},"AcceptRanges":{"location":"header","locationName":"accept-ranges"},"Expiration":{"location":"header","locationName":"x-amz-expiration","type":"timestamp"},"Restore":{"location":"header","locationName":"x-amz-restore"},"LastModified":{"location":"header","locationName":"Last-Modified","type":"timestamp"},"ContentLength":{"location":"header","locationName":"Content-Length","type":"integer"},"ETag":{"location":"header","locationName":"ETag"},"MissingMeta":{"location":"header","locationName":"x-amz-missing-meta","type":"integer"},"VersionId":{"location":"header","locationName":"x-amz-version-id"},"CacheControl":{"location":"header","locationName":"Cache-Control"},"ContentDisposition":{"location":"header","locationName":"Content-Disposition"},"ContentEncoding":{"location":"header","locationName":"Content-Encoding"},"ContentLanguage":{"location":"header","locationName":"Content-Language"},"ContentType":{"location":"header","locationName":"Content-Type"},"Expires":{"location":"header","locationName":"Expires","type":"timestamp"},"WebsiteRedirectLocation":{"location":"header","locationName":"x-amz-website-redirect-location"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"Metadata":{"shape":"Sx","location":"headers","locationName":"x-amz-meta-"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"}}}},"ListBuckets":{"http":{"method":"GET"},"output":{"type":"structure","members":{"Buckets":{"type":"list","member":{"locationName":"Bucket","type":"structure","members":{"Name":{},"CreationDate":{"type":"timestamp"}}}},"Owner":{"shape":"S2a"}}},"alias":"GetService"},"ListMultipartUploads":{"http":{"method":"GET","requestUri":"/{Bucket}?uploads"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Delimiter":{"location":"querystring","locationName":"delimiter"},"EncodingType":{"location":"querystring","locationName":"encoding-type"},"KeyMarker":{"location":"querystring","locationName":"key-marker"},"MaxUploads":{"location":"querystring","locationName":"max-uploads","type":"integer"},"Prefix":{"location":"querystring","locationName":"prefix"},"UploadIdMarker":{"location":"querystring","locationName":"upload-id-marker"}}},"output":{"type":"structure","members":{"Bucket":{},"KeyMarker":{},"UploadIdMarker":{},"NextKeyMarker":{},"Prefix":{},"NextUploadIdMarker":{},"MaxUploads":{"type":"integer"},"IsTruncated":{"type":"boolean"},"Uploads":{"locationName":"Upload","type":"list","member":{"type":"structure","members":{"UploadId":{},"Key":{},"Initiated":{"type":"timestamp"},"StorageClass":{},"Owner":{"shape":"S2a"},"Initiator":{"shape":"S5r"}}},"flattened":true},"CommonPrefixes":{"shape":"S5s"},"EncodingType":{}}}},"ListObjectVersions":{"http":{"method":"GET","requestUri":"/{Bucket}?versions"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Delimiter":{"location":"querystring","locationName":"delimiter"},"EncodingType":{"location":"querystring","locationName":"encoding-type"},"KeyMarker":{"location":"querystring","locationName":"key-marker"},"MaxKeys":{"location":"querystring","locationName":"max-keys","type":"integer"},"Prefix":{"location":"querystring","locationName":"prefix"},"VersionIdMarker":{"location":"querystring","locationName":"version-id-marker"}}},"output":{"type":"structure","members":{"IsTruncated":{"type":"boolean"},"KeyMarker":{},"VersionIdMarker":{},"NextKeyMarker":{},"NextVersionIdMarker":{},"Versions":{"locationName":"Version","type":"list","member":{"type":"structure","members":{"ETag":{},"Size":{"type":"integer"},"StorageClass":{},"Key":{},"VersionId":{},"IsLatest":{"type":"boolean"},"LastModified":{"type":"timestamp"},"Owner":{"shape":"S2a"}}},"flattened":true},"DeleteMarkers":{"locationName":"DeleteMarker","type":"list","member":{"type":"structure","members":{"Owner":{"shape":"S2a"},"Key":{},"VersionId":{},"IsLatest":{"type":"boolean"},"LastModified":{"type":"timestamp"}}},"flattened":true},"Name":{},"Prefix":{},"MaxKeys":{"type":"integer"},"CommonPrefixes":{"shape":"S5s"},"EncodingType":{}}},"alias":"GetBucketObjectVersions"},"ListObjects":{"http":{"method":"GET","requestUri":"/{Bucket}"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Delimiter":{"location":"querystring","locationName":"delimiter"},"EncodingType":{"location":"querystring","locationName":"encoding-type"},"Marker":{"location":"querystring","locationName":"marker"},"MaxKeys":{"location":"querystring","locationName":"max-keys","type":"integer"},"Prefix":{"location":"querystring","locationName":"prefix"}}},"output":{"type":"structure","members":{"IsTruncated":{"type":"boolean"},"Marker":{},"NextMarker":{},"Contents":{"type":"list","member":{"type":"structure","members":{"Key":{},"LastModified":{"type":"timestamp"},"ETag":{},"Size":{"type":"integer"},"StorageClass":{},"Owner":{"shape":"S2a"}}},"flattened":true},"Name":{},"Prefix":{},"MaxKeys":{"type":"integer"},"CommonPrefixes":{"shape":"S5s"},"EncodingType":{}}},"alias":"GetBucket"},"ListParts":{"http":{"method":"GET","requestUri":"/{Bucket}/{Key}"},"input":{"type":"structure","required":["Bucket","Key","UploadId"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"},"MaxParts":{"location":"querystring","locationName":"max-parts","type":"integer"},"PartNumberMarker":{"location":"querystring","locationName":"part-number-marker","type":"integer"},"UploadId":{"location":"querystring","locationName":"uploadId"}}},"output":{"type":"structure","members":{"Bucket":{},"Key":{},"UploadId":{},"PartNumberMarker":{"type":"integer"},"NextPartNumberMarker":{"type":"integer"},"MaxParts":{"type":"integer"},"IsTruncated":{"type":"boolean"},"Parts":{"locationName":"Part","type":"list","member":{"type":"structure","members":{"PartNumber":{"type":"integer"},"LastModified":{"type":"timestamp"},"ETag":{},"Size":{"type":"integer"}}},"flattened":true},"Initiator":{"shape":"S5r"},"Owner":{"shape":"S2a"},"StorageClass":{}}}},"PutBucketAcl":{"http":{"method":"PUT","requestUri":"/{Bucket}?acl"},"input":{"type":"structure","required":["Bucket"],"members":{"ACL":{"location":"header","locationName":"x-amz-acl"},"AccessControlPolicy":{"shape":"S6l","xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"AccessControlPolicy"},"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"GrantFullControl":{"location":"header","locationName":"x-amz-grant-full-control"},"GrantRead":{"location":"header","locationName":"x-amz-grant-read"},"GrantReadACP":{"location":"header","locationName":"x-amz-grant-read-acp"},"GrantWrite":{"location":"header","locationName":"x-amz-grant-write"},"GrantWriteACP":{"location":"header","locationName":"x-amz-grant-write-acp"}},"payload":"AccessControlPolicy"}},"PutBucketCors":{"http":{"method":"PUT","requestUri":"/{Bucket}?cors"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"CORSConfiguration":{"xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"CORSConfiguration","type":"structure","members":{"CORSRules":{"shape":"S2m","locationName":"CORSRule"}}},"ContentMD5":{"location":"header","locationName":"Content-MD5"}},"payload":"CORSConfiguration"}},"PutBucketLifecycle":{"http":{"method":"PUT","requestUri":"/{Bucket}?lifecycle"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"LifecycleConfiguration":{"xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"LifecycleConfiguration","type":"structure","required":["Rules"],"members":{"Rules":{"shape":"S2z","locationName":"Rule"}}}},"payload":"LifecycleConfiguration"}},"PutBucketLogging":{"http":{"method":"PUT","requestUri":"/{Bucket}?logging"},"input":{"type":"structure","required":["Bucket","BucketLoggingStatus"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"BucketLoggingStatus":{"xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"BucketLoggingStatus","type":"structure","members":{"LoggingEnabled":{"shape":"S3e"}}},"ContentMD5":{"location":"header","locationName":"Content-MD5"}},"payload":"BucketLoggingStatus"}},"PutBucketNotification":{"http":{"method":"PUT","requestUri":"/{Bucket}?notification"},"input":{"type":"structure","required":["Bucket","NotificationConfiguration"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"NotificationConfiguration":{"xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"NotificationConfiguration","type":"structure","required":["TopicConfiguration"],"members":{"TopicConfiguration":{"shape":"S3m"}}}},"payload":"NotificationConfiguration"}},"PutBucketPolicy":{"http":{"method":"PUT","requestUri":"/{Bucket}?policy"},"input":{"xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"PutBucketPolicyRequest","type":"structure","required":["Bucket","Policy"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"Policy":{}},"payload":"Policy"}},"PutBucketRequestPayment":{"http":{"method":"PUT","requestUri":"/{Bucket}?requestPayment"},"input":{"type":"structure","required":["Bucket","RequestPaymentConfiguration"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"RequestPaymentConfiguration":{"xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"RequestPaymentConfiguration","type":"structure","required":["Payer"],"members":{"Payer":{}}}},"payload":"RequestPaymentConfiguration"}},"PutBucketTagging":{"http":{"method":"PUT","requestUri":"/{Bucket}?tagging"},"input":{"type":"structure","required":["Bucket","Tagging"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"Tagging":{"xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"Tagging","type":"structure","required":["TagSet"],"members":{"TagSet":{"shape":"S3x"}}}},"payload":"Tagging"}},"PutBucketVersioning":{"http":{"method":"PUT","requestUri":"/{Bucket}?versioning"},"input":{"type":"structure","required":["Bucket","VersioningConfiguration"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"MFA":{"location":"header","locationName":"x-amz-mfa"},"VersioningConfiguration":{"xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"VersioningConfiguration","type":"structure","members":{"MFADelete":{"locationName":"MfaDelete"},"Status":{}}}},"payload":"VersioningConfiguration"}},"PutBucketWebsite":{"http":{"method":"PUT","requestUri":"/{Bucket}?website"},"input":{"type":"structure","required":["Bucket","WebsiteConfiguration"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"WebsiteConfiguration":{"xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"WebsiteConfiguration","type":"structure","members":{"ErrorDocument":{"shape":"S4b"},"IndexDocument":{"shape":"S49"},"RedirectAllRequestsTo":{"shape":"S46"},"RoutingRules":{"shape":"S4c"}}}},"payload":"WebsiteConfiguration"}},"PutObject":{"http":{"method":"PUT","requestUri":"/{Bucket}/{Key}"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"ACL":{"location":"header","locationName":"x-amz-acl"},"Body":{"streaming":true,"type":"blob"},"Bucket":{"location":"uri","locationName":"Bucket"},"CacheControl":{"location":"header","locationName":"Cache-Control"},"ContentDisposition":{"location":"header","locationName":"Content-Disposition"},"ContentEncoding":{"location":"header","locationName":"Content-Encoding"},"ContentLanguage":{"location":"header","locationName":"Content-Language"},"ContentLength":{"location":"header","locationName":"Content-Length","type":"integer"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"ContentType":{"location":"header","locationName":"Content-Type"},"Expires":{"location":"header","locationName":"Expires","type":"timestamp"},"GrantFullControl":{"location":"header","locationName":"x-amz-grant-full-control"},"GrantRead":{"location":"header","locationName":"x-amz-grant-read"},"GrantReadACP":{"location":"header","locationName":"x-amz-grant-read-acp"},"GrantWriteACP":{"location":"header","locationName":"x-amz-grant-write-acp"},"Key":{"location":"uri","locationName":"Key"},"Metadata":{"shape":"Sx","location":"headers","locationName":"x-amz-meta-"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"StorageClass":{"location":"header","locationName":"x-amz-storage-class"},"WebsiteRedirectLocation":{"location":"header","locationName":"x-amz-website-redirect-location"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"}},"payload":"Body"},"output":{"type":"structure","members":{"Expiration":{"location":"header","locationName":"x-amz-expiration","type":"timestamp"},"ETag":{"location":"header","locationName":"ETag"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"VersionId":{"location":"header","locationName":"x-amz-version-id"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"}}}},"PutObjectAcl":{"http":{"method":"PUT","requestUri":"/{Bucket}/{Key}?acl"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"ACL":{"location":"header","locationName":"x-amz-acl"},"AccessControlPolicy":{"shape":"S6l","xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"AccessControlPolicy"},"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"GrantFullControl":{"location":"header","locationName":"x-amz-grant-full-control"},"GrantRead":{"location":"header","locationName":"x-amz-grant-read"},"GrantReadACP":{"location":"header","locationName":"x-amz-grant-read-acp"},"GrantWrite":{"location":"header","locationName":"x-amz-grant-write"},"GrantWriteACP":{"location":"header","locationName":"x-amz-grant-write-acp"},"Key":{"location":"uri","locationName":"Key"}},"payload":"AccessControlPolicy"}},"RestoreObject":{"http":{"requestUri":"/{Bucket}/{Key}?restore"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"},"VersionId":{"location":"querystring","locationName":"versionId"},"RestoreRequest":{"xmlNamespace":"http://s3.amazonaws.com/doc/2006-03-01/","locationName":"RestoreRequest","type":"structure","required":["Days"],"members":{"Days":{"type":"integer"}}}},"payload":"RestoreRequest"},"alias":"PostObjectRestore"},"UploadPart":{"http":{"method":"PUT","requestUri":"/{Bucket}/{Key}"},"input":{"type":"structure","required":["Bucket","Key","PartNumber","UploadId"],"members":{"Body":{"streaming":true,"type":"blob"},"Bucket":{"location":"uri","locationName":"Bucket"},"ContentLength":{"location":"header","locationName":"Content-Length","type":"integer"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"Key":{"location":"uri","locationName":"Key"},"PartNumber":{"location":"querystring","locationName":"partNumber","type":"integer"},"UploadId":{"location":"querystring","locationName":"uploadId"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"}},"payload":"Body"},"output":{"type":"structure","members":{"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"ETag":{"location":"header","locationName":"ETag"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"}}}},"UploadPartCopy":{"http":{"method":"PUT","requestUri":"/{Bucket}/{Key}"},"input":{"type":"structure","required":["Bucket","CopySource","Key","PartNumber","UploadId"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"CopySource":{"location":"header","locationName":"x-amz-copy-source"},"CopySourceIfMatch":{"location":"header","locationName":"x-amz-copy-source-if-match"},"CopySourceIfModifiedSince":{"location":"header","locationName":"x-amz-copy-source-if-modified-since","type":"timestamp"},"CopySourceIfNoneMatch":{"location":"header","locationName":"x-amz-copy-source-if-none-match"},"CopySourceIfUnmodifiedSince":{"location":"header","locationName":"x-amz-copy-source-if-unmodified-since","type":"timestamp"},"CopySourceRange":{"location":"header","locationName":"x-amz-copy-source-range"},"Key":{"location":"uri","locationName":"Key"},"PartNumber":{"location":"querystring","locationName":"partNumber","type":"integer"},"UploadId":{"location":"querystring","locationName":"uploadId"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"CopySourceSSECustomerAlgorithm":{"location":"header","locationName":"x-amz-copy-source-server-side-encryption-customer-algorithm"},"CopySourceSSECustomerKey":{"location":"header","locationName":"x-amz-copy-source-server-side-encryption-customer-key"},"CopySourceSSECustomerKeyMD5":{"location":"header","locationName":"x-amz-copy-source-server-side-encryption-customer-key-MD5"}}},"output":{"type":"structure","members":{"CopySourceVersionId":{"location":"header","locationName":"x-amz-copy-source-version-id"},"CopyPartResult":{"type":"structure","members":{"ETag":{},"LastModified":{"type":"timestamp"}}},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"}},"payload":"CopyPartResult"}}},"shapes":{"Sx":{"type":"map","key":{},"value":{}},"S2a":{"type":"structure","members":{"DisplayName":{},"ID":{}}},"S2d":{"type":"list","member":{"locationName":"Grant","type":"structure","members":{"Grantee":{"shape":"S2f"},"Permission":{}}}},"S2f":{"type":"structure","required":["Type"],"members":{"DisplayName":{},"EmailAddress":{},"ID":{},"Type":{"type":"string","xmlAttribute":true,"locationName":"xsi:type"},"URI":{}},"xmlNamespace":{"prefix":"xsi","uri":"http://www.w3.org/2001/XMLSchema-instance"}},"S2m":{"type":"list","member":{"type":"structure","members":{"AllowedHeaders":{"locationName":"AllowedHeader","type":"list","member":{},"flattened":true},"AllowedMethods":{"locationName":"AllowedMethod","type":"list","member":{},"flattened":true},"AllowedOrigins":{"locationName":"AllowedOrigin","type":"list","member":{},"flattened":true},"ExposeHeaders":{"locationName":"ExposeHeader","type":"list","member":{},"flattened":true},"MaxAgeSeconds":{"type":"integer"}}},"flattened":true},"S2z":{"type":"list","member":{"type":"structure","required":["Prefix","Status"],"members":{"Expiration":{"type":"structure","members":{"Date":{"shape":"S32"},"Days":{"type":"integer"}}},"ID":{},"Prefix":{},"Status":{},"Transition":{"type":"structure","members":{"Date":{"shape":"S32"},"Days":{"type":"integer"},"StorageClass":{}}},"NoncurrentVersionTransition":{"type":"structure","members":{"NoncurrentDays":{"type":"integer"},"StorageClass":{}}},"NoncurrentVersionExpiration":{"type":"structure","members":{"NoncurrentDays":{"type":"integer"}}}}},"flattened":true},"S32":{"type":"timestamp","timestampFormat":"iso8601"},"S3e":{"type":"structure","members":{"TargetBucket":{},"TargetGrants":{"type":"list","member":{"locationName":"Grant","type":"structure","members":{"Grantee":{"shape":"S2f"},"Permission":{}}}},"TargetPrefix":{}}},"S3m":{"type":"structure","members":{"Event":{},"Topic":{}}},"S3x":{"type":"list","member":{"locationName":"Tag","type":"structure","required":["Key","Value"],"members":{"Key":{},"Value":{}}}},"S46":{"type":"structure","required":["HostName"],"members":{"HostName":{},"Protocol":{}}},"S49":{"type":"structure","required":["Suffix"],"members":{"Suffix":{}}},"S4b":{"type":"structure","required":["Key"],"members":{"Key":{}}},"S4c":{"type":"list","member":{"locationName":"RoutingRule","type":"structure","required":["Redirect"],"members":{"Condition":{"type":"structure","members":{"HttpErrorCodeReturnedEquals":{},"KeyPrefixEquals":{}}},"Redirect":{"type":"structure","members":{"HostName":{},"HttpRedirectCode":{},"Protocol":{},"ReplaceKeyPrefixWith":{},"ReplaceKeyWith":{}}}}}},"S5r":{"type":"structure","members":{"ID":{},"DisplayName":{}}},"S5s":{"type":"list","member":{"type":"structure","members":{"Prefix":{}}},"flattened":true},"S6l":{"type":"structure","members":{"Grants":{"shape":"S2d","locationName":"AccessControlList"},"Owner":{"shape":"S2a"}}}},"paginators":{"ListBuckets":{"result_key":"Buckets"},"ListMultipartUploads":{"limit_key":"MaxUploads","more_results":"IsTruncated","output_token":["NextKeyMarker","NextUploadIdMarker"],"input_token":["KeyMarker","UploadIdMarker"],"result_key":["Uploads","CommonPrefixes"]},"ListObjectVersions":{"more_results":"IsTruncated","limit_key":"MaxKeys","output_token":["NextKeyMarker","NextVersionIdMarker"],"input_token":["KeyMarker","VersionIdMarker"],"result_key":["Versions","DeleteMarkers","CommonPrefixes"]},"ListObjects":{"more_results":"IsTruncated","limit_key":"MaxKeys","output_token":"NextMarker or Contents[-1].Key","input_token":"Marker","result_key":["Contents","CommonPrefixes"]},"ListParts":{"more_results":"IsTruncated","limit_key":"MaxParts","output_token":"NextPartNumberMarker","input_token":"PartNumberMarker","result_key":"Parts"}},"waiters":{"__default__":{"interval":5,"max_attempts":20},"BucketExists":{"operation":"HeadBucket","ignore_errors":[404],"success_type":"output"},"BucketNotExists":{"operation":"HeadBucket","success_type":"error","success_value":404},"ObjectExists":{"operation":"HeadObject","ignore_errors":[404],"success_type":"output"},"ObjectNotExists":{"operation":"HeadObject","success_type":"error","success_value":404}}});
AWS.SNS=AWS.Service.defineService("sns");
AWS.Service.defineServiceApi(AWS.SNS, "2010-03-31", {"metadata":{"apiVersion":"2010-03-31","endpointPrefix":"sns","serviceAbbreviation":"Amazon SNS","serviceFullName":"Amazon Simple Notification Service","signatureVersion":"v4","xmlNamespace":"http://sns.amazonaws.com/doc/2010-03-31/","protocol":"query"},"operations":{"AddPermission":{"input":{"type":"structure","required":["TopicArn","Label","AWSAccountId","ActionName"],"members":{"TopicArn":{},"Label":{},"AWSAccountId":{"type":"list","member":{}},"ActionName":{"type":"list","member":{}}}}},"ConfirmSubscription":{"input":{"type":"structure","required":["TopicArn","Token"],"members":{"TopicArn":{},"Token":{},"AuthenticateOnUnsubscribe":{}}},"output":{"resultWrapper":"ConfirmSubscriptionResult","type":"structure","members":{"SubscriptionArn":{}}}},"CreatePlatformApplication":{"input":{"type":"structure","required":["Name","Platform","Attributes"],"members":{"Name":{},"Platform":{},"Attributes":{"shape":"Sf"}}},"output":{"resultWrapper":"CreatePlatformApplicationResult","type":"structure","members":{"PlatformApplicationArn":{}}}},"CreatePlatformEndpoint":{"input":{"type":"structure","required":["PlatformApplicationArn","Token"],"members":{"PlatformApplicationArn":{},"Token":{},"CustomUserData":{},"Attributes":{"shape":"Sf"}}},"output":{"resultWrapper":"CreatePlatformEndpointResult","type":"structure","members":{"EndpointArn":{}}}},"CreateTopic":{"input":{"type":"structure","required":["Name"],"members":{"Name":{}}},"output":{"resultWrapper":"CreateTopicResult","type":"structure","members":{"TopicArn":{}}}},"DeleteEndpoint":{"input":{"type":"structure","required":["EndpointArn"],"members":{"EndpointArn":{}}}},"DeletePlatformApplication":{"input":{"type":"structure","required":["PlatformApplicationArn"],"members":{"PlatformApplicationArn":{}}}},"DeleteTopic":{"input":{"type":"structure","required":["TopicArn"],"members":{"TopicArn":{}}}},"GetEndpointAttributes":{"input":{"type":"structure","required":["EndpointArn"],"members":{"EndpointArn":{}}},"output":{"resultWrapper":"GetEndpointAttributesResult","type":"structure","members":{"Attributes":{"shape":"Sf"}}}},"GetPlatformApplicationAttributes":{"input":{"type":"structure","required":["PlatformApplicationArn"],"members":{"PlatformApplicationArn":{}}},"output":{"resultWrapper":"GetPlatformApplicationAttributesResult","type":"structure","members":{"Attributes":{"shape":"Sf"}}}},"GetSubscriptionAttributes":{"input":{"type":"structure","required":["SubscriptionArn"],"members":{"SubscriptionArn":{}}},"output":{"resultWrapper":"GetSubscriptionAttributesResult","type":"structure","members":{"Attributes":{"type":"map","key":{},"value":{}}}}},"GetTopicAttributes":{"input":{"type":"structure","required":["TopicArn"],"members":{"TopicArn":{}}},"output":{"resultWrapper":"GetTopicAttributesResult","type":"structure","members":{"Attributes":{"type":"map","key":{},"value":{}}}}},"ListEndpointsByPlatformApplication":{"input":{"type":"structure","required":["PlatformApplicationArn"],"members":{"PlatformApplicationArn":{},"NextToken":{}}},"output":{"resultWrapper":"ListEndpointsByPlatformApplicationResult","type":"structure","members":{"Endpoints":{"type":"list","member":{"type":"structure","members":{"EndpointArn":{},"Attributes":{"shape":"Sf"}}}},"NextToken":{}}}},"ListPlatformApplications":{"input":{"type":"structure","members":{"NextToken":{}}},"output":{"resultWrapper":"ListPlatformApplicationsResult","type":"structure","members":{"PlatformApplications":{"type":"list","member":{"type":"structure","members":{"PlatformApplicationArn":{},"Attributes":{"shape":"Sf"}}}},"NextToken":{}}}},"ListSubscriptions":{"input":{"type":"structure","members":{"NextToken":{}}},"output":{"resultWrapper":"ListSubscriptionsResult","type":"structure","members":{"Subscriptions":{"shape":"S1c"},"NextToken":{}}}},"ListSubscriptionsByTopic":{"input":{"type":"structure","required":["TopicArn"],"members":{"TopicArn":{},"NextToken":{}}},"output":{"resultWrapper":"ListSubscriptionsByTopicResult","type":"structure","members":{"Subscriptions":{"shape":"S1c"},"NextToken":{}}}},"ListTopics":{"input":{"type":"structure","members":{"NextToken":{}}},"output":{"resultWrapper":"ListTopicsResult","type":"structure","members":{"Topics":{"type":"list","member":{"type":"structure","members":{"TopicArn":{}}}},"NextToken":{}}}},"Publish":{"input":{"type":"structure","required":["Message"],"members":{"TopicArn":{},"TargetArn":{},"Message":{},"Subject":{},"MessageStructure":{},"MessageAttributes":{"type":"map","key":{"locationName":"Name"},"value":{"locationName":"Value","type":"structure","required":["DataType"],"members":{"DataType":{},"StringValue":{},"BinaryValue":{"type":"blob"}}}}}},"output":{"resultWrapper":"PublishResult","type":"structure","members":{"MessageId":{}}}},"RemovePermission":{"input":{"type":"structure","required":["TopicArn","Label"],"members":{"TopicArn":{},"Label":{}}}},"SetEndpointAttributes":{"input":{"type":"structure","required":["EndpointArn","Attributes"],"members":{"EndpointArn":{},"Attributes":{"shape":"Sf"}}}},"SetPlatformApplicationAttributes":{"input":{"type":"structure","required":["PlatformApplicationArn","Attributes"],"members":{"PlatformApplicationArn":{},"Attributes":{"shape":"Sf"}}}},"SetSubscriptionAttributes":{"input":{"type":"structure","required":["SubscriptionArn","AttributeName"],"members":{"SubscriptionArn":{},"AttributeName":{},"AttributeValue":{}}}},"SetTopicAttributes":{"input":{"type":"structure","required":["TopicArn","AttributeName"],"members":{"TopicArn":{},"AttributeName":{},"AttributeValue":{}}}},"Subscribe":{"input":{"type":"structure","required":["TopicArn","Protocol"],"members":{"TopicArn":{},"Protocol":{},"Endpoint":{}}},"output":{"resultWrapper":"SubscribeResult","type":"structure","members":{"SubscriptionArn":{}}}},"Unsubscribe":{"input":{"type":"structure","required":["SubscriptionArn"],"members":{"SubscriptionArn":{}}}}},"shapes":{"Sf":{"type":"map","key":{},"value":{}},"S1c":{"type":"list","member":{"type":"structure","members":{"SubscriptionArn":{},"Owner":{},"Protocol":{},"Endpoint":{},"TopicArn":{}}}}},"paginators":{"ListEndpointsByPlatformApplication":{"input_token":"NextToken","output_token":"NextToken","result_key":"Endpoints"},"ListPlatformApplications":{"input_token":"NextToken","output_token":"NextToken","result_key":"PlatformApplications"},"ListSubscriptions":{"input_token":"NextToken","output_token":"NextToken","result_key":"Subscriptions"},"ListSubscriptionsByTopic":{"input_token":"NextToken","output_token":"NextToken","result_key":"Subscriptions"},"ListTopics":{"input_token":"NextToken","output_token":"NextToken","result_key":"Topics"}}});
AWS.SQS=AWS.Service.defineService("sqs");AWS.util.update(AWS.SQS.prototype,{setupRequestListeners:function e(s){s.addListener("build",this.buildEndpoint);if(s.service.config.computeChecksums){if(s.operation==="sendMessage"){s.addListener("extractData",this.verifySendMessageChecksum)}else if(s.operation==="sendMessageBatch"){s.addListener("extractData",this.verifySendMessageBatchChecksum)}else if(s.operation==="receiveMessage"){s.addListener("extractData",this.verifyReceiveMessageChecksum)}}},verifySendMessageChecksum:function s(e){if(!e.data)return;var s=e.data.MD5OfMessageBody;var a=this.params.MessageBody;var t=this.service.calculateChecksum(a);if(t!==s){var i='Got "'+e.data.MD5OfMessageBody+'", expecting "'+t+'".';this.service.throwInvalidChecksumError(e,[e.data.MessageId],i)}},verifySendMessageBatchChecksum:function a(e){if(!e.data)return;var s=this.service;var a={};var t=[];var i=[];AWS.util.arrayEach(e.data.Successful,function(e){a[e.Id]=e});AWS.util.arrayEach(this.params.Entries,function(e){if(a[e.Id]){var r=a[e.Id].MD5OfMessageBody;var n=e.MessageBody;if(!s.isChecksumValid(r,n)){t.push(e.Id);i.push(a[e.Id].MessageId)}}});if(t.length>0){s.throwInvalidChecksumError(e,i,"Invalid messages: "+t.join(", "))}},verifyReceiveMessageChecksum:function t(e){if(!e.data)return;var s=this.service;var a=[];AWS.util.arrayEach(e.data.Messages,function(e){var t=e.MD5OfBody;var i=e.Body;if(!s.isChecksumValid(t,i)){a.push(e.MessageId)}});if(a.length>0){s.throwInvalidChecksumError(e,a,"Invalid messages: "+a.join(", "))}},throwInvalidChecksumError:function i(e,s,a){e.error=AWS.util.error(new Error,{retryable:true,code:"InvalidChecksum",messageIds:s,message:e.request.operation+" returned an invalid MD5 response. "+a})},isChecksumValid:function r(e,s){return this.calculateChecksum(s)===e},calculateChecksum:function n(e){return AWS.util.crypto.md5(e,"hex")},buildEndpoint:function u(e){var s=e.httpRequest.params.QueueUrl;if(s){e.httpRequest.endpoint=new AWS.Endpoint(s);var a=e.httpRequest.endpoint.host.match(/^sqs\.(.+?)\./);if(a)e.httpRequest.region=a[1]}}});
AWS.Service.defineServiceApi(AWS.SQS, "2012-11-05", {"metadata":{"apiVersion":"2012-11-05","endpointPrefix":"sqs","serviceAbbreviation":"Amazon SQS","serviceFullName":"Amazon Simple Queue Service","signatureVersion":"v4","xmlNamespace":"http://queue.amazonaws.com/doc/2012-11-05/","protocol":"query"},"operations":{"AddPermission":{"input":{"type":"structure","required":["QueueUrl","Label","AWSAccountIds","Actions"],"members":{"QueueUrl":{},"Label":{},"AWSAccountIds":{"type":"list","member":{"locationName":"AWSAccountId"},"flattened":true},"Actions":{"type":"list","member":{"locationName":"ActionName"},"flattened":true}}}},"ChangeMessageVisibility":{"input":{"type":"structure","required":["QueueUrl","ReceiptHandle","VisibilityTimeout"],"members":{"QueueUrl":{},"ReceiptHandle":{},"VisibilityTimeout":{"type":"integer"}}}},"ChangeMessageVisibilityBatch":{"input":{"type":"structure","required":["QueueUrl","Entries"],"members":{"QueueUrl":{},"Entries":{"type":"list","member":{"locationName":"ChangeMessageVisibilityBatchRequestEntry","type":"structure","required":["Id","ReceiptHandle"],"members":{"Id":{},"ReceiptHandle":{},"VisibilityTimeout":{"type":"integer"}}},"flattened":true}}},"output":{"resultWrapper":"ChangeMessageVisibilityBatchResult","type":"structure","required":["Successful","Failed"],"members":{"Successful":{"type":"list","member":{"locationName":"ChangeMessageVisibilityBatchResultEntry","type":"structure","required":["Id"],"members":{"Id":{}}},"flattened":true},"Failed":{"shape":"Sd"}}}},"CreateQueue":{"input":{"type":"structure","required":["QueueName"],"members":{"QueueName":{},"Attributes":{"shape":"Sh","locationName":"Attribute"}}},"output":{"resultWrapper":"CreateQueueResult","type":"structure","members":{"QueueUrl":{}}}},"DeleteMessage":{"input":{"type":"structure","required":["QueueUrl","ReceiptHandle"],"members":{"QueueUrl":{},"ReceiptHandle":{}}}},"DeleteMessageBatch":{"input":{"type":"structure","required":["QueueUrl","Entries"],"members":{"QueueUrl":{},"Entries":{"type":"list","member":{"locationName":"DeleteMessageBatchRequestEntry","type":"structure","required":["Id","ReceiptHandle"],"members":{"Id":{},"ReceiptHandle":{}}},"flattened":true}}},"output":{"resultWrapper":"DeleteMessageBatchResult","type":"structure","required":["Successful","Failed"],"members":{"Successful":{"type":"list","member":{"locationName":"DeleteMessageBatchResultEntry","type":"structure","required":["Id"],"members":{"Id":{}}},"flattened":true},"Failed":{"shape":"Sd"}}}},"DeleteQueue":{"input":{"type":"structure","required":["QueueUrl"],"members":{"QueueUrl":{}}}},"GetQueueAttributes":{"input":{"type":"structure","required":["QueueUrl"],"members":{"QueueUrl":{},"AttributeNames":{"shape":"St"}}},"output":{"resultWrapper":"GetQueueAttributesResult","type":"structure","members":{"Attributes":{"shape":"Sh","locationName":"Attribute"}}}},"GetQueueUrl":{"input":{"type":"structure","required":["QueueName"],"members":{"QueueName":{},"QueueOwnerAWSAccountId":{}}},"output":{"resultWrapper":"GetQueueUrlResult","type":"structure","members":{"QueueUrl":{}}}},"ListDeadLetterSourceQueues":{"input":{"type":"structure","required":["QueueUrl"],"members":{"QueueUrl":{}}},"output":{"resultWrapper":"ListDeadLetterSourceQueuesResult","type":"structure","required":["queueUrls"],"members":{"queueUrls":{"shape":"Sz"}}}},"ListQueues":{"input":{"type":"structure","members":{"QueueNamePrefix":{}}},"output":{"resultWrapper":"ListQueuesResult","type":"structure","members":{"QueueUrls":{"shape":"Sz"}}}},"ReceiveMessage":{"input":{"type":"structure","required":["QueueUrl"],"members":{"QueueUrl":{},"AttributeNames":{"shape":"St"},"MessageAttributeNames":{"type":"list","member":{"locationName":"MessageAttributeName"},"flattened":true},"MaxNumberOfMessages":{"type":"integer"},"VisibilityTimeout":{"type":"integer"},"WaitTimeSeconds":{"type":"integer"}}},"output":{"resultWrapper":"ReceiveMessageResult","type":"structure","members":{"Messages":{"type":"list","member":{"locationName":"Message","type":"structure","members":{"MessageId":{},"ReceiptHandle":{},"MD5OfBody":{},"Body":{},"Attributes":{"shape":"Sh","locationName":"Attribute"},"MD5OfMessageAttributes":{},"MessageAttributes":{"shape":"S18","locationName":"MessageAttribute"}}},"flattened":true}}}},"RemovePermission":{"input":{"type":"structure","required":["QueueUrl","Label"],"members":{"QueueUrl":{},"Label":{}}}},"SendMessage":{"input":{"type":"structure","required":["QueueUrl","MessageBody"],"members":{"QueueUrl":{},"MessageBody":{},"DelaySeconds":{"type":"integer"},"MessageAttributes":{"shape":"S18","locationName":"MessageAttribute"}}},"output":{"resultWrapper":"SendMessageResult","type":"structure","members":{"MD5OfMessageBody":{},"MD5OfMessageAttributes":{},"MessageId":{}}}},"SendMessageBatch":{"input":{"type":"structure","required":["QueueUrl","Entries"],"members":{"QueueUrl":{},"Entries":{"type":"list","member":{"locationName":"SendMessageBatchRequestEntry","type":"structure","required":["Id","MessageBody"],"members":{"Id":{},"MessageBody":{},"DelaySeconds":{"type":"integer"},"MessageAttributes":{"shape":"S18","locationName":"MessageAttribute"}}},"flattened":true}}},"output":{"resultWrapper":"SendMessageBatchResult","type":"structure","required":["Successful","Failed"],"members":{"Successful":{"type":"list","member":{"locationName":"SendMessageBatchResultEntry","type":"structure","required":["Id","MessageId","MD5OfMessageBody"],"members":{"Id":{},"MessageId":{},"MD5OfMessageBody":{},"MD5OfMessageAttributes":{}}},"flattened":true},"Failed":{"shape":"Sd"}}}},"SetQueueAttributes":{"input":{"type":"structure","required":["QueueUrl","Attributes"],"members":{"QueueUrl":{},"Attributes":{"shape":"Sh","locationName":"Attribute"}}}}},"shapes":{"Sd":{"type":"list","member":{"locationName":"BatchResultErrorEntry","type":"structure","required":["Id","SenderFault","Code"],"members":{"Id":{},"SenderFault":{"type":"boolean"},"Code":{},"Message":{}}},"flattened":true},"Sh":{"type":"map","key":{"locationName":"Name"},"value":{"locationName":"Value"},"flattened":true,"locationName":"Attribute"},"St":{"type":"list","member":{"locationName":"AttributeName"},"flattened":true},"Sz":{"type":"list","member":{"locationName":"QueueUrl"},"flattened":true},"S18":{"type":"map","key":{"locationName":"Name"},"value":{"locationName":"Value","type":"structure","required":["DataType"],"members":{"StringValue":{},"BinaryValue":{"type":"blob"},"StringListValues":{"flattened":true,"locationName":"StringListValue","type":"list","member":{"locationName":"StringListValue"}},"BinaryListValues":{"flattened":true,"locationName":"BinaryListValue","type":"list","member":{"locationName":"BinaryListValue","type":"blob"}},"DataType":{}}},"flattened":true}},"paginators":{"ListQueues":{"result_key":"QueueUrls"}}});
AWS.STS=AWS.Service.defineService("sts");AWS.util.update(AWS.STS.prototype,{credentialsFrom:function e(t,s){if(!t)return null;if(!s)s=new AWS.TemporaryCredentials;s.expired=false;s.accessKeyId=t.Credentials.AccessKeyId;s.secretAccessKey=t.Credentials.SecretAccessKey;s.sessionToken=t.Credentials.SessionToken;s.expireTime=t.Credentials.Expiration;return s},assumeRoleWithWebIdentity:function t(e,s){return this.makeUnauthenticatedRequest("assumeRoleWithWebIdentity",e,s)},assumeRoleWithSAML:function s(e,t){return this.makeUnauthenticatedRequest("assumeRoleWithSAML",e,t)}});
AWS.Service.defineServiceApi(AWS.STS, "2011-06-15", {"metadata":{"apiVersion":"2011-06-15","endpointPrefix":"sts","globalEndpoint":"sts.amazonaws.com","serviceAbbreviation":"AWS STS","serviceFullName":"AWS Security Token Service","signatureVersion":"v4","xmlNamespace":"https://sts.amazonaws.com/doc/2011-06-15/","protocol":"query"},"operations":{"AssumeRole":{"input":{"type":"structure","required":["RoleArn","RoleSessionName"],"members":{"RoleArn":{},"RoleSessionName":{},"Policy":{},"DurationSeconds":{"type":"integer"},"ExternalId":{},"SerialNumber":{},"TokenCode":{}}},"output":{"resultWrapper":"AssumeRoleResult","type":"structure","members":{"Credentials":{"shape":"Sa"},"AssumedRoleUser":{"shape":"Sf"},"PackedPolicySize":{"type":"integer"}}}},"AssumeRoleWithSAML":{"input":{"type":"structure","required":["RoleArn","PrincipalArn","SAMLAssertion"],"members":{"RoleArn":{},"PrincipalArn":{},"SAMLAssertion":{},"Policy":{},"DurationSeconds":{"type":"integer"}}},"output":{"resultWrapper":"AssumeRoleWithSAMLResult","type":"structure","members":{"Credentials":{"shape":"Sa"},"AssumedRoleUser":{"shape":"Sf"},"PackedPolicySize":{"type":"integer"},"Subject":{},"SubjectType":{},"Issuer":{},"Audience":{},"NameQualifier":{}}}},"AssumeRoleWithWebIdentity":{"input":{"type":"structure","required":["RoleArn","RoleSessionName","WebIdentityToken"],"members":{"RoleArn":{},"RoleSessionName":{},"WebIdentityToken":{},"ProviderId":{},"Policy":{},"DurationSeconds":{"type":"integer"}}},"output":{"resultWrapper":"AssumeRoleWithWebIdentityResult","type":"structure","members":{"Credentials":{"shape":"Sa"},"SubjectFromWebIdentityToken":{},"AssumedRoleUser":{"shape":"Sf"},"PackedPolicySize":{"type":"integer"},"Provider":{},"Audience":{}}}},"DecodeAuthorizationMessage":{"input":{"type":"structure","required":["EncodedMessage"],"members":{"EncodedMessage":{}}},"output":{"resultWrapper":"DecodeAuthorizationMessageResult","type":"structure","members":{"DecodedMessage":{}}}},"GetFederationToken":{"input":{"type":"structure","required":["Name"],"members":{"Name":{},"Policy":{},"DurationSeconds":{"type":"integer"}}},"output":{"resultWrapper":"GetFederationTokenResult","type":"structure","members":{"Credentials":{"shape":"Sa"},"FederatedUser":{"type":"structure","required":["FederatedUserId","Arn"],"members":{"FederatedUserId":{},"Arn":{}}},"PackedPolicySize":{"type":"integer"}}}},"GetSessionToken":{"input":{"type":"structure","members":{"DurationSeconds":{"type":"integer"},"SerialNumber":{},"TokenCode":{}}},"output":{"resultWrapper":"GetSessionTokenResult","type":"structure","members":{"Credentials":{"shape":"Sa"}}}}},"shapes":{"Sa":{"type":"structure","required":["AccessKeyId","SecretAccessKey","SessionToken","Expiration"],"members":{"AccessKeyId":{},"SecretAccessKey":{},"SessionToken":{},"Expiration":{"type":"timestamp"}}},"Sf":{"type":"structure","required":["AssumedRoleId","Arn"],"members":{"AssumedRoleId":{},"Arn":{}}}}});

module.exports = window.AWS;

},{}],"drop.js":[function(require,module,exports){
/**
  basic drag and drop event-ery
  adapted from https://github.com/mikolalysenko/drag-and-drop-files
  so this is under an MIT license
**/

function handleDrop(callback, event) {
  event.stopPropagation();
  event.preventDefault();
  hideTarget();
  // console.log("drop!")
  callback(Array.prototype.slice.call(event.dataTransfer.files))
}

// indicate it's active
function onDragEnter(event) {
  event.stopPropagation();
  event.preventDefault();
  showTarget();
  // console.log("enter!")
  return false;
}

function onDragLeave(event) {
  event.stopPropagation();
  event.preventDefault();
  // hideTarget();
  // console.log("leave!")
  return false;
}

// don't do anything while dragging
function onDragOver(event) {
  event.stopPropagation();
  event.preventDefault();
  // showTarget();
  // console.log("over!")
  return false;
}

var showTarget = function() {
  document.getElementById("dragging").style.display = "block";
};

var hideTarget = function() {
  document.getElementById("dragging").style.display = "none";
};

// set up callbacks on element
function drop(element, callback, enter, over) {
  element.addEventListener("dragenter", onDragEnter, false);
  element.addEventListener("dragleave", onDragLeave, false);
  element.addEventListener("dragover", onDragOver, false);
  element.addEventListener("drop", handleDrop.bind(undefined, callback), false);
}

module.exports = drop;

},{}],"echo.js":[function(require,module,exports){
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

},{"stream":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"filereader-stream":[function(require,module,exports){
(function (Buffer){
var inherits = require('inherits')
var EventEmitter = require('events').EventEmitter

module.exports = FileStream

function FileStream(file, options) {
  if (!(this instanceof FileStream))
    return new FileStream(file, options)
  options = options || {}
  options.output = options.output || 'arraybuffer'
  this.options = options
  this._file = file
  this.readable = true
  this.offset = options.offset || 0
  this.paused = false
  this.chunkSize = this.options.chunkSize || 8128

  var tags = ['name','size','type','lastModifiedDate']
  tags.forEach(function (thing) {
     this[thing] = file[thing]
   }, this)
}


FileStream.prototype._FileReader = function() {
  var self = this
  var reader = new FileReader()
  const outputType = this.options.output

  reader.onloadend = function loaded(event) {
    var data = event.target.result
    if (data instanceof ArrayBuffer)
      data = new Buffer(new Uint8Array(event.target.result))

    var ok = self.dest.write(data);
    if (!ok) {
      self.pause();
      self.dest.once("drain", self.resume.bind(self))
    }

    if (self.offset < self._file.size) {
      self.emit('progress', self.offset)
      !self.paused && self.readChunk(outputType)
      return
    }
    self._end()
  }
  reader.onerror = function(e) {
    self.emit('error', e.target.error)
  }

  return reader
}

FileStream.prototype.readChunk = function(outputType) {
  var end = this.offset + this.chunkSize
  var slice = this._file.slice(this.offset, end)
  this.offset = end
  if (outputType === 'binary')
    this.reader.readAsBinaryString(slice)
  else if (outputType === 'dataurl')
    this.reader.readAsDataURL(slice)
  else if (outputType === 'arraybuffer')
    this.reader.readAsArrayBuffer(slice)
  else if (outputType === 'text')
    this.reader.readAsText(slice)
}

FileStream.prototype._end = function() {
  if (this.dest !== console && (!this.options || this.options.end !== false)) {
    this.dest.end && this.dest.end()
    this.dest.close && this.dest.close()
    this.emit('end', this._file.size)
  }
}

FileStream.prototype.pipe = function pipe(dest, options) {
  this.reader = this._FileReader()
  this.readChunk(this.options.output)
  this.dest = dest
  return dest
}

FileStream.prototype.pause = function() {
  this.paused = true
  this.emit("pause", this.offset)
  return this.offset
}

FileStream.prototype.resume = function() {
  this.paused = false
  this.emit("resume", this.offset)
  this.readChunk(this.options.output)
}

FileStream.prototype.abort = function() {
  this.paused = true
  this.reader.abort()
  this._end()
  return this.offset
}

inherits(FileStream, EventEmitter)

}).call(this,require("buffer").Buffer)
},{"buffer":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","events":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","inherits":"/home/eric/bulk/upload-anything/node_modules/filereader-stream/node_modules/inherits/inherits.js"}],"log.js":[function(require,module,exports){

module.exports = function(id) {
  var elem = document.getElementById(id);

  return function(msg) {
    elem.innerHTML += (msg + "<br/>");
    elem.scrollTop = elem.scrollHeight;
  }
}

},{}],"params.js":[function(require,module,exports){
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

},{}],"s3-upload-stream":[function(require,module,exports){
(function (Buffer){
var Writable = require('stream').Writable,
    events = require("events");

require("setimmediate");

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

}).call(this,require("buffer").Buffer)
},{"buffer":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","events":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","setimmediate":"/home/eric/bulk/upload-anything/node_modules/s3-upload-stream/node_modules/setimmediate/setImmediate.js","stream":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"through2":[function(require,module,exports){
(function (process){
var Transform = require('readable-stream/transform')
  , inherits  = require('util').inherits
  , xtend     = require('xtend')

function DestroyableTransform(opts) {
  Transform.call(this, opts)
  this._destroyed = false
}

inherits(DestroyableTransform, Transform)

DestroyableTransform.prototype.destroy = function(err) {
  if (this._destroyed) return
  this._destroyed = true
  
  var self = this
  process.nextTick(function() {
    if (err)
      self.emit('error', err)
    self.emit('close')
  })
}

// a noop _transform function
function noop (chunk, enc, callback) {
  callback(null, chunk)
}


// create a new export function, used by both the main export and
// the .ctor export, contains common logic for dealing with arguments
function through2 (construct) {
  return function (options, transform, flush) {
    if (typeof options == 'function') {
      flush     = transform
      transform = options
      options   = {}
    }

    if (typeof transform != 'function')
      transform = noop

    if (typeof flush != 'function')
      flush = null

    return construct(options, transform, flush)
  }
}


// main export, just make me a transform stream!
module.exports = through2(function (options, transform, flush) {
  var t2 = new DestroyableTransform(options)

  t2._transform = transform

  if (flush)
    t2._flush = flush

  return t2
})


// make me a reusable prototype that I can `new`, or implicitly `new`
// with a constructor call
module.exports.ctor = through2(function (options, transform, flush) {
  function Through2 (override) {
    if (!(this instanceof Through2))
      return new Through2(override)

    this.options = xtend(options, override)

    DestroyableTransform.call(this, this.options)
  }

  inherits(Through2, DestroyableTransform)

  Through2.prototype._transform = transform

  if (flush)
    Through2.prototype._flush = flush

  return Through2
})


module.exports.obj = through2(function (options, transform, flush) {
  var t2 = new DestroyableTransform(xtend({ objectMode: true, highWaterMark: 16 }, options))

  t2._transform = transform

  if (flush)
    t2._flush = flush

  return t2
})

}).call(this,require('_process'))
},{"_process":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","readable-stream/transform":"/home/eric/bulk/upload-anything/node_modules/through2/node_modules/readable-stream/transform.js","util":"/home/eric/.nvm/v0.10.32/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js","xtend":"/home/eric/bulk/upload-anything/node_modules/through2/node_modules/xtend/immutable.js"}]},{},[]);

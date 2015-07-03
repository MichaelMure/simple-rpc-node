var net = require('net');
var url = require('url');
var i64 = require('node-int64');
var util = require('util');
var events = require('events');

var proto = require('./protocol');


function Client (address) {
  events.EventEmitter.call(this);

  this._address = url.parse(address);
  this._connected = false;
  this._connectCb = Function();

  this._nextId = 0;
  this._mcalls = {};

  this._socket = new net.Socket();
  this._socket.on('data', this._handleData.bind(this));
  this._socket.on('error', this._handleError.bind(this));

  this._data = new Buffer(1024*1024);
  this._dataTmp = new Buffer(1024*1024);
  this._dataEnd = 0;
}

// Client emits: ['error', 'connect']
util.inherits(Client, events.EventEmitter);

Client.prototype.connect = function() {
  var self = this;

  this._connectCb = function () {
    self._connected = true;
    self.emit('connect');
  };

  var addr = this._address;
  this._socket.connect(addr.port, addr.hostname);
  this._socket.once('connect', this._connectCb);
};

Client.prototype.call = function(name, payload, callback) {
  if(!this._connected) {
    var err = new Error('srpc: not conencted');
    callback(err);
    return;
  }

  var id = this._nextId++;
  var req = new proto.Request(id, name, payload);
  var messageBuffer = req.toBuffer();
  var sizeBuffer = new i64(messageBuffer.length).toBuffer();
  this._socket.write(sizeBuffer);
  this._socket.write(messageBuffer);
  this._mcalls[id] = callback;
};

Client.prototype._handleData = function(data) {
  // grow the buffer if we need more space
  var newSize = this._dataEnd + data.length;
  var buffer = this._data;
  if(buffer.length < newSize) {
    this._growBuffer(newSize);
  }

  data.copy(buffer, this._dataEnd);
  this._dataEnd = newSize;

  var startOffset = 0;

  while(true) {
    var messageStart = startOffset+8;

    if(messageStart > this._dataEnd) {
      // can't read next message size
      // wait untill next 'data' event
      break;
    }

    var sizeBuffer = buffer.slice(startOffset, messageStart);
    var messageSize = new i64(sizeBuffer).toNumber();
    var nextOffset = messageStart+messageSize;

    if(nextOffset > this._dataEnd) {
      // can't fully read next message
      // wait until next 'data' event
      break;
    }

    var messageBuffer = buffer.slice(messageStart, nextOffset);
    this._handleResponse(proto.Response.decode(messageBuffer));
    startOffset = nextOffset;
  }

  // set remaining data as this._data
  buffer.copy(this._dataTmp, 0, startOffset, this._dataEnd);
  this._dataEnd = this._dataEnd - startOffset;

  // swap buffers
  var tmpBuff = this._data;
  this._data = this._dataTmp;
  this._dataTmp = tmpBuff;
};

Client.prototype._growBuffer = function(size) {
  var buff = new Buffer(size);
  this._data.copy(buff);
  this._data = buff;
};

Client.prototype._handleResponse = function(res) {
  var err = res.error === '' ? null : new Error(res.error);
  var pld = res.payload.toBuffer();
  var id = new i64(res.id.high, res.id.low).toNumber();
  var callback = this._mcalls[id];
  delete this._mcalls[id];
  callback(err, pld);
};

Client.prototype._handleError = function(err) {
  var self = this;
  this._connected = false;
  this._socket.removeListener('connect', this._connectCb);

  this.emit('error', err);
};

module.exports = Client;

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

  this._nextId = 0;
  this._mcalls = {};
  this._socket = new net.Socket();

  this.__ondata = this._ondata.bind(this);
  this.__onerror = this._onerror.bind(this);
  this.__onclose = this._onclose.bind(this);

  this._data = new Buffer(1024*1024);
  this._dataTmp = new Buffer(1024*1024);
  this._dataEnd = 0;
}

// Client emits: ['close', 'connect', 'error']
util.inherits(Client, events.EventEmitter);

Client.prototype.connect = function(callback) {
  var self = this;
  callback = callback || Function();

  function onConnect () {
    self._connected = true;
    self._socket.removeListener('error', onError);
    self._socket.on('data', self.__ondata);
    self._socket.on('error', self.__onerror);
    self._socket.on('close', self.__onclose);
    self.emit('connect');
    callback();
  }

  function onError (err) {
    self._socket.removeListener('connect', onConnect);
    callback(err);
  }

  self._socket.removeListener('data', self.__ondata);
  self._socket.removeListener('error', self.__onerror);
  self._socket.removeListener('close', self.__onclose);
  this._socket.once('connect', onConnect);
  this._socket.once('error', onError);

  var addr = this._address;
  this._socket.connect(addr.port, addr.hostname);
};

Client.prototype.call = function(name, payload, callback) {
  if(!this._connected) {
    var err = new Error('srpc: not connected');
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

Client.prototype._ondata = function(data) {
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
    var message = proto.Response.decode(messageBuffer);
    startOffset = nextOffset;

    var err = null;
    if(message.error !== '') {
      err = new Error(message.error);
    }

    var pld = message.payload.toBuffer();
    var id = new i64(message.id.high, message.id.low).toNumber();
    var callback = this._getCallback(id);
    callback(err, pld);
  }

  // set remaining data as this._data
  buffer.copy(this._dataTmp, 0, startOffset, this._dataEnd);
  this._dataEnd = this._dataEnd - startOffset;

  // swap buffers
  var tmpBuff = this._data;
  this._data = this._dataTmp;
  this._dataTmp = tmpBuff;
};

Client.prototype._onerror = function(err) {
  this.emit('error', err);
};

Client.prototype._onclose = function(err) {
  this._connected = false;
  this.emit('close');
  var err = new Error('connection lost');

  var calls = this._mcalls;
  this._mcalls = {};

  for(var id in calls) {
    callback = calls[id];
    callback(err);
  }
};

Client.prototype._growBuffer = function(size) {
  var buff = new Buffer(size);
  this._data.copy(buff);
  this._data = buff;
};

Client.prototype._getCallback = function(id) {
  var callback = this._mcalls[id];
  delete this._mcalls[id];
  return callback || Function();
};

module.exports = Client;

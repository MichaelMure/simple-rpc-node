var net = require('net');
var url = require('url');
var util = require('util');
var events = require('events');
var proto = require('./protocol');

function Session(socket) {
  events.EventEmitter.call(this);

  this._connected = false;
  this._socket = socket;
  this._nextId = 0;
  this._inflight = {};
  this._handlers = {};

  // reusable buffers for reading data
  this._data = new Buffer(1024*1024);
  this._dataTmp = new Buffer(1024*1024);
  this._dataEnd = 0;

  this.__ondata = this._ondata.bind(this);
  this.__onerror = this._onerror.bind(this);
  this.__onclose = this._onclose.bind(this);
}

// Session emits: ['close', 'error'] events
util.inherits(Session, events.EventEmitter);

Session.prototype.call = function(name, payload, callback) {
  if(!this._connected) {
    var err = new Error('srpc: not connected');
    callback(err);
    return;
  }

  var id = this._nextId++;
  var req = new proto.Request(id, name, payload);
  var msg = new proto.Message(req);

  var messageBuffer = msg.toBuffer();
  var sizeBuffer = new Buffer(4);
  sizeBuffer.writeUInt32LE(messageBuffer.length, 0);

  this._socket.write(sizeBuffer);
  this._socket.write(messageBuffer);
  this._inflight[id] = callback;
};

Session.prototype._ondata = function(data) {
  // grow the buffer if we need more space
  var newSize = this._dataEnd + data.length;
  if(this._data.length < newSize) {
    this._growBuffer(newSize);
  }

  data.copy(this._data, this._dataEnd);
  var buffer = this._data.slice(0, newSize);

  var startOffset = 0;

  while(true) {
    var messageStart = startOffset+4;

    if(messageStart > buffer.length) {
      // can't read next message size
      // wait untill next 'data' event
      break;
    }

    var messageSize = buffer.readUInt32LE(startOffset);
    var nextOffset = messageStart+messageSize;

    if(nextOffset > buffer.length) {
      // can't fully read next message
      // wait until next 'data' event
      break;
    }

    var messageBuffer = buffer.slice(messageStart, nextOffset);
    var message = proto.Message.decode(messageBuffer);
    startOffset = nextOffset;

    if(message.request) {
      this._handleRequest(message.request);
    }

    if (message.response) {
      this._handleResponse(message.response);
    }
  }

  // set remaining data as this._data
  buffer.copy(this._dataTmp, 0, startOffset);
  this._dataEnd = buffer.length - startOffset;

  // swap buffers
  var tmpBuff = this._data;
  this._data = this._dataTmp;
  this._dataTmp = tmpBuff;
};

Session.prototype.close = function() {
  this._connected = false;
  this._socket.end();
};

Session.prototype._handleRequest = function(req) {
  // TODO: implement
};

Session.prototype._handleResponse = function(res) {
  var err = null;
  if(res.error) {
    err = new Error(res.error);
  }

  var pld = res.payload.toBuffer();
  var callback = this._getCallback(res.id);
  callback(err, pld);
};

Session.prototype._onerror = function(err) {
  this.emit('error', err);
};

Session.prototype._onclose = function(err) {
  this._connected = false;
  this.emit('close');

  var calls = this._inflight;
  this._inflight = {};

  for(var id in calls) {
    callback = calls[id];
    callback(err);
  }
};

Session.prototype._growBuffer = function(size) {
  var buff = new Buffer(size);
  this._data.copy(buff);
  this._data = buff;
};

Session.prototype._getCallback = function(id) {
  var callback = this._inflight[id];
  delete this._inflight[id];
  return callback || Function();
};

Session.prototype._bindEvents = function() {
  this._socket.on('data', this.__ondata);
  this._socket.on('error', this.__onerror);
  this._socket.on('close', this.__onclose);
};

module.exports = Session;

module.exports.dial = function (address, callback) {
  var socket = new net.Socket();
  var session = new Session(socket);

  function onConnect () {
    socket.removeListener('error', onError);
    session._connected = true;
    session._bindEvents();
    callback(null, session);
  }

  function onError (err) {
    socket.removeListener('connect', onConnect);
    callback(err);
  }

  address = url.parse(address);
  socket.once('connect', onConnect);
  socket.once('error', onError);
  socket.connect(address.port, address.hostname);
};

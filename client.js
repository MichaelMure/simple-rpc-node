var net = require('net');
var url = require('url');
var i64 = require('node-int64');
var proto = require('./protocol');


function Client (address) {
  this.address = url.parse(address);
  this._data = new Buffer(0);
  this._nextId = 0;
  this._mcalls = {};
  this.__ondata = this._ondata.bind(this);
  this.__onerror = this._onerror.bind(this);
  this._reconnectTimeout = 1000;
}

Client.prototype.connect = function(callback) {
  console.log('SRPC: Connecting');
  this.socket = new net.Socket();
  this.socket.connect(
    this.address.port,
    this.address.hostname,
    callback
  );

  this.socket.on('data', this.__ondata);
  this.socket.on('error', this.__onerror);
};

Client.prototype.call = function(name, payload, callback) {
  var id = this._nextId++;
  var req = new proto.Request(id, name, payload);
  var mbuf = req.toBuffer();
  var sbuf = new i64(mbuf.length).toBuffer(true);
  this.socket.write(sbuf);
  this.socket.write(mbuf);
  this._mcalls[id] = callback;
};

Client.prototype._ondata = function(data) {
  this._data = Buffer.concat([this._data, data]);

  while(this._data.length >= 8) {
    var sbuf = this._data.slice(0, 8);
    var sz = new i64(sbuf);
    var msize = sz.toNumber();
    var dsize = msize + 8;

    if(this._data.length < dsize) {
      break;
    }

    var mbuf = this._data.slice(8, dsize);
    this._data = this._data.slice(dsize);

    var res = proto.Response.decode(mbuf);
    var err = res.error === '' ? null : new Error(res.error);
    var id = new i64(res.id.high, res.id.low).toNumber();
    var callback = this._mcalls[id];
    callback(err, res.payload.toBuffer());
  }
};

Client.prototype._onerror = function(err) {
  var self = this;
  this.socket.removeListener('data', this.__ondata);
  this.socket.removeListener('error', this.__onerror);

  setTimeout(function () {
    self.connect(Function.prototype);
  }, this._reconnectTimeout);
};

module.exports = Client;

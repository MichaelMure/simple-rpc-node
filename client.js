var events = require('events');
var util = require('util');
var Session = require('./session');


function Client (address) {
  events.EventEmitter.call(this);

  this._address = address;
  this._session = null;

  this.__onerror = this._onerror.bind(this);
  this.__onclose = this._onclose.bind(this);
}

// Client emits: ['close', 'error'] events
util.inherits(Client, events.EventEmitter);

Client.prototype.connect = function(callback) {
  var self = this;
  callback = callback || Function();

  Session.dial(this._address, function(err, session) {
    if(err) {
      callback(err);
      return;
    }

    self._session = session;
    self._session.on('error', self.__onerror);
    self._session.on('close', self.__onclose);
    callback(null);
  });
};

Client.prototype.call = function(name, payload, callback) {
  this._session.call(name, payload, callback);
};

Client.prototype.close = function() {
  this._session.close();
};

Client.prototype._onerror = function(err) {
  this.emit('error', err);
};

Client.prototype._onclose = function(err) {
  this.emit('close');
};


module.exports = Client;

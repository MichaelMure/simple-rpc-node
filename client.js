import EventEmitter from 'events'
import { Session } from './session'

export class Client extends EventEmitter {
  constructor(address) {
    super()
    this._address = address
    this._session = null
  }

  connect(callback) {
    callback = callback || Function()

    Session.dial(this._address, (err, session) => {
      if (err) {
        callback(err)
        return
      }

      this._session = session
      this._session.on('error', this._onerror)
      this._session.on('close', this._onclose)
      callback(null)
    })
  }

  call(name, payload, callback) {
    this._session.call(name, payload, callback)
  }

  close() {
    this._session.close()
  }

  _onerror(err) {
    this.emit('error', err)
  }

  _onclose(err) {
    this.emit('close')
  }
}

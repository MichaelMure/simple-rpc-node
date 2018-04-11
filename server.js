import EventEmitter from 'events'
import { Session } from './session'

export class Server extends EventEmitter {

  constructor(port, address) {
    super()
    this._port    = port
    this._address = address
    this._session = null
  }

  listen(callback) {
    Session.listen(this._port, this._address, (err, session) => {
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

  setHandler(name, handler) {
    this._session.setHandler(name, handler)
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

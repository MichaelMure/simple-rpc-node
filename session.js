import EventEmitter from 'events'
import url from 'url'
import net from 'net'
import proto from './protocol'

export class Session extends EventEmitter {
  constructor(socket) {
    super()

    this._connected = false
    this._socket = socket
    this._nextId = 0
    this._inflight = {}
    this._handlers = {}

    // reusable buffers for reading data
    this._data = new Buffer(1024 * 1024)
    this._dataTmp = new Buffer(1024 * 1024)
    this._dataEnd = 0
  }

  static listen(address, callback) {
    const socket = new net.Socket()
    socket.listen()
    const session = new Session(socket)


  }

  static dial(address, callback) {
    const socket = new net.Socket()
    const session = new Session(socket)

    function onConnect() {
      socket.removeListener('error', onError)
      session._connected = true
      session._bindEvents()
      callback(null, session)
    }

    function onError(err) {
      socket.removeListener('connect', onConnect)
      callback(err)
    }

    address = url.parse(address)
    socket.once('connect', onConnect)
    socket.once('error', onError)
    socket.connect(address.port, address.hostname)
  }

  setHandler(name, handler) {
    this._handlers[name] = handler
  }

  call(name, payload, callback) {
    if (!this._connected) {
      const err = new Error('srpc: not connected')
      callback(err)
      return
    }

    const id = this._nextId++
    const req = new proto.Request(id, name, payload)
    const msg = new proto.Message(req)

    const messageBuffer = msg.toBuffer()
    const sizeBuffer = new Buffer(4)
    sizeBuffer.writeUInt32LE(messageBuffer.length, 0)

    this._socket.write(sizeBuffer)
    this._socket.write(messageBuffer)
    this._inflight[id] = callback
  }

  close() {
    this._connected = false
    this._socket.end()
  }

  _ondata(data) {
    // grow the buffer if we need more space
    const newSize = this._dataEnd + data.length
    if (this._data.length < newSize) {
      this._growBuffer(newSize)
    }

    data.copy(this._data, this._dataEnd)
    const buffer = this._data.slice(0, newSize)

    let startOffset = 0

    while (true) {
      const messageStart = startOffset + 4

      if (messageStart > buffer.length) {
        // can't read next message size
        // wait untill next 'data' event
        break
      }

      const messageSize = buffer.readUInt32LE(startOffset)
      const nextOffset = messageStart + messageSize

      if (nextOffset > buffer.length) {
        // can't fully read next message
        // wait until next 'data' event
        break
      }

      const messageBuffer = buffer.slice(messageStart, nextOffset)
      const message = proto.Message.decode(messageBuffer)
      startOffset = nextOffset

      if (message.request) {
        this._handleRequest(message.request)
      }

      if (message.response) {
        this._handleResponse(message.response)
      }
    }

    // set remaining data as this._data
    buffer.copy(this._dataTmp, 0, startOffset)
    this._dataEnd = buffer.length - startOffset

    // swap buffers
    const tmpBuff = this._data
    this._data = this._dataTmp
    this._dataTmp = tmpBuff
  }

  _handleRequest(req) {
    // TODO: implement
  }

  _handleResponse(res) {
    let err = null
    if (res.error) {
      err = new Error(res.error)
    }

    const pld = res.payload.toBuffer()
    const callback = this._getCallback(res.id)
    callback(err, pld)
  }

  _onerror(err) {
    this.emit('error', err)
  }

  _onclose(err) {
    this._connected = false
    this.emit('close')

    const calls = this._inflight
    this._inflight = {}

    for (const id in calls) {
      callback = calls[id]
      callback(err)
    }
  }

  _growBuffer(size) {
    const buff = new Buffer(size)
    this._data.copy(buff)
    this._data = buff
  }

  _getCallback(id) {
    const callback = this._inflight[id]
    delete this._inflight[id]
    return callback || Function()
  }

  _bindEvents() {
    this._socket.on('data', this._ondata)
    this._socket.on('error', this._onerror)
    this._socket.on('close', this._onclose)
  }
}

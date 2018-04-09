import { Server } from '../../'

const address = 'srpc://localhost:12345'

const server = new Server(address)

server.on('error', err => {
  console.error('error: ', err)
})

server.once('close', errd => {
  const code = errd ? 1 : 0
  console.log('server terminated with code', code)
})

server.listen(err => {
  if (err) {
    console.error('srpc: listen failed:', err)
    return
  }

  server.setHandler('echo', handleEcho)
})

function handleEcho(request) {

}

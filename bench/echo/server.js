import { Server } from '../../'

const port = 12345
const address = 'localhost'

const server = new Server(port, address)

server.on('error', err => {
  console.error('error: ', err)
})

server.once('close', errd => {
  const code = errd ? 1 : 0
  console.log('server terminated with code', code)
})

server.listen(err => {
  if (err) {
    console.error('Listen failed:', err)
    return
  }

  console.log('new incoming connection handled')
  server.setHandler('echo', handleEcho)
})

console.log('Starting listening ...')

function handleEcho(request) {
  console.log('handle echo')
}

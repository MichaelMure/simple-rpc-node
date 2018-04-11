import { Client } from '../../'

const payload = new Buffer(1024)
const concurrency = 1 //8
const port = 12345
const address = 'localhost'

for (let i = 0; i < concurrency; ++i) {
  start()
}

function start() {
  const client = new Client(port, address)

  client.on('error', err => {
    console.error('error: ', err)
  })

  client.once('close', errd => {
    const code = errd ? 1 : 0
    console.log('client terminated with code', code)
  })

  client.connect(function (err) {
    if (err) {
      console.error('srpc: connect failed:', err)
      return
    }

    echo(client)
  })
}

function echo(client) {
  client.call('echo', payload, function (err, res) {
    if (err) {
      console.error('method error: ', err)
    } else if (!payload.equals(res)) {
      console.error('invalid response')
    } else {
      echo(client)
    }
  })
}

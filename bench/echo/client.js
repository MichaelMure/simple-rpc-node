var Client = require('../../').Client;
var payload = new Buffer(1024);
var concurrency = 8;
var address = 'srpc://localhost:12345';

for(var i=0; i<concurrency; ++i) {
  start();
}

function start() {
  var client = new Client(address);

  client.once('error', function (err) {
    console.error('error: ', err);
  });

  client.once('close', function (errd) {
    var code = errd ? 1 : 0;
  });

  client.connect(function (err) {
    if(err) {
      console.error('srpc: connect failed:', err);
      return;
    }

    echo(client);
  });
}

function echo(client) {
  client.call('echo', payload, function (err, res) {
    if(err) {
      console.error('method error: ', err);
    } else if(!payload.equals(res)) {
      console.error('invalid response');
    } else {
      echo(client);
    }
  });
}

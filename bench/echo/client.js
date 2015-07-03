var Client = require('../../').Client;
var client = new Client('srpc://localhost:12345');
var payload = new Buffer(1024);

client.once('error', function (err) {
  console.error('srpc error: ', err);
});

client.once('close', function (errd) {
  var code = errd ? 1 : 0;
  process.exit(code);
});

client.connect(function (err) {
  if(err) {
    console.error('srpc: connect failed:', err);
    return;
  }

  echo();
});

function echo () {
  client.call('echo', payload, function (err, res) {
    if(err) {
      console.error('method error: ', err);
    } else if(!payload.equals(res)) {
      console.error('invalid response');
    } else {
      echo();
    }
  });
}

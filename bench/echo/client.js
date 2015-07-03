var Client = require('../../').Client;
var client = new Client('srpc://localhost:12345');
var payload = new Buffer(1024);

client.on('error', function (err) {
  console.error(err);
  process.exit(0);
});

client.connect(function (err) {
  if(err) {
    console.error(err);
    return;
  }

  function call () {
    client.call('echo', payload, function (err, res) {
      if(err) {
        console.error(err);
        return;
      }

      if(!payload.equals(res)) {
        console.error('invalid response');
        return;
      }

      call();
    });
  }

  call();
});

var Client = require('../../').Client;
var client = new Client('srpc://localhost:12345');
var payload = new Buffer(1024);

client.connect(function () {
  function call () {
    client.call('echo', payload, function (err, res) {
      if(!payload.equals(res)) {
        console.error('invalid response');
        return;
      }

      call();
    });
  }

  call();
});

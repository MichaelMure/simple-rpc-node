var Client = require('../../').Client;
var client = new Client('srpc://localhost:12345');
var payload = new Buffer(1024);

client.once('error', exit);
client.once('connect', echo);
client.connect();

function echo () {
  client.call('echo', payload, function (err, res) {
    if(err) {
      console.error(err);
    } else if(!payload.equals(res)) {
      console.error('invalid response');
    } else {
      echo();
    }
  });
}

function exit (err) {
  console.error(err);
  process.exit(1);
}

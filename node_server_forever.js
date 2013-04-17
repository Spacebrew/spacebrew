var	forever = require('forever-monitor');
var argv = process.argv;
var restarts = 0;
var date = Date.parse(new Date);;

var server = new (forever.Monitor)('node_server.js', {
	'silent': false
	, 'options': argv.splice(2, argv.length)
	, 'uid': 'spacebrew'
	, 'pid': './data/'
	, 'outFile': './data/log/spacebrew_log_' + date + '.dat'
});

server.on('exit', function () {
	console.log('[Exit] the spacebrew server will no longer be restarted');
});

server.on('restart', function () {
	restarts += 1;
	console.log('[Restart] the spacebrew server has been restarted ' + restarts + ' time');
});

server.start();

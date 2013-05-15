var	forever = require('forever-monitor')
	, fs = require('fs')
	, argv = process.argv.splice(2, process.argv.length)
	, restarts = 0
	, date = Date.parse(new Date)
	;

/**
 * Parses CLI arguments to confirm if there are any commands that need to occur before 
 * the app is launched in forever mode
 */
var processArguments = function(){
	for(var i = 0; i < argv.length; i++){
        switch(argv[i]){
            case "-x":
            case "--cleanstart":
            	try {
					fs.unlinkSync('./data/routes/live/live_persist_config.json');
            	}
            	catch (e) {
            		console.log("[processArguments] not able to delete /data/routes/live/live_persist_config.json")
            	}
            	break;
        }
	}	
}

/**
 * Forever server configurations for launching the spacebrew server in forever mode
 * @type {forever.Monitor}
 */
var server = new (forever.Monitor)('node_server.js', {
	'silent': false
	, 'options': argv
	, 'uid': 'spacebrew'
	, 'pid': './data/'
	, 'logFile': './data/log/spacebrew_forever_' + date + '.log'
   	, 'outFile': './data/log/spacebrew_info_' + date + '.log'
	, 'errFile': './data/log/spacebrew_error_' + date + '.log'
});

/**
 * Register event handler for application exit events
 * @return {[type]} [description]
 */
server.on('exit', function () {
	console.log('[Exit] the spacebrew server will no longer be restarted');
});

/**
 * Register event handler for spacebrew server restart events, due to app crashing
 * @return {[type]} [description]
 */
server.on('restart', function () {
	restarts += 1;
	date = Date.parse(new Date);
	console.log('[Restart] the spacebrew server has been restarted ' + restarts + ' time');
});

processArguments();
server.start();

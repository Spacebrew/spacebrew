var logger = exports;

logger.debugLevel = 'debug';

logger.log = function(level, message) {
	var levels = ['error', 'warn', 'debug', 'info'];
	if (levels.indexOf(level) <= levels.indexOf(logger.debugLevel) ) {
		if (typeof message !== 'string') {
			message = JSON.stringify(message);
		};
		console.log(level+': '+message);
	}
}
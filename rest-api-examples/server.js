// Initialize the Twitter client
var Twitter = require('twit');
var config  = require('./config');
var twitter = new Twitter(config);

// Initialize the app
var express = require('express');
var app     = express();
app.use(express.static(__dirname + '/public'));

// Proxy requests to Twitter API, to work around CORS
app.get('/proxy', function(req, res){
	var method = req.query.method;
	var endpoint = req.query.endpoint;
	var params = req.query.params;
	console.log('/proxy', method, endpoint, JSON.stringify(params));
	twitter[method](endpoint, params, function(err, data) {
		if (err) {
			console.log('ERROR: ', err, JSON.stringify(err, null, 2));
			res.end();
		}
		var stringifyData = JSON.stringify(data);
		console.log(' => ', stringifyData)
		res.setHeader('Content-Type', 'application/json');
		res.write(stringifyData);
		res.end();
	});
});

// Start the server
var server = app.listen(3003, function() {
  console.log('Listening on port %d', server.address().port);
});

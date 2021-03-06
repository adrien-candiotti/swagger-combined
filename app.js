var config = require('config');
var httpProxy = require('http-proxy');
var request = require('request');
var q = require('q');
var express = require('express');
var app = express();
var https = require('https');
var http = require('http');
var url = require('url');

function addHost(config) {
  var hostURL = process.env.HOST_URL;
  
  if (hostURL) {
    config.list_url.forEach(function(url_definition) {
      url_definition.docs = hostURL + url_definition.docs;
      url_definition.base_path = hostURL + url_definition.base_path;
    });

    config.basePath = hostURL;
    config.host = hostURL.split('/')[2];
  }
  return (config);
}

// We update the configuration based on the host found
// in configuration or in the env variables
config = addHost(config);

var util = require('util');
console.log(util.inspect(config, null, 4));

// cross origin
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// list all swagger document urls
var listUrl = config.get("list_url");

function addBasePath(definition) {
  for (key in definition.paths) {
    definition.paths[definition.basePath + key] = definition.paths[key];
    delete definition.paths[key];
  }
  return definition;
}

function extractTag(definition) {
	var tag = definition.basePath.slice(1);
	return {
		"name": tag,
		"description": definition.info.title
	};
}

function addTag(definition) {
	var tag = definition.basePath.slice(1);
  for (key in definition.paths) {
    for (method in definition.paths[key]) {
			definition.paths[key][method].tags = [tag];
		}
  }
  return definition;
}

// general infor of your application
var info = config.get("info");
app.get('/docs', function(req, res) {
    var schemes = [ req.protocol ];
    if (config.has('schemes')) {
        schemes = config.get('schemes', false);
    }

    getApis(listUrl).then(function(data){
        data = data.map(addBasePath);
				data = data.map(addTag);

				var tags = data.map(extractTag);

        var ret = data.reduce(function(previous, current){
            if (!previous) {
                previous = current;
            }
            else{
                // combines paths
                for (key in current.paths){
                    previous.paths[key] = current.paths[key];
                }
                // combines definitions
                for (key in current.definitions){
                    previous.definitions[key] = current.definitions[key];
                }
            }
            return previous;
        }, false);
        ret.tags = tags;
        ret.info = info;
        ret.host = process.env.HOST || config.get("host");
        ret.basePath = null;
        ret.schemes = schemes;
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(ret));
    })
    .catch(console.error); 
});
var proxy = httpProxy.createProxyServer();

listUrl.forEach(function(url){
    url.route_match.forEach(function(r){
        // GET proxy
        app.get(r, function(req, res){ 
            doForward(req, res, url.base_path, proxy);
        });
        // POST proxy
        app.post(r, function(req, res){ 
            doForward(req, res, url.base_path, proxy);
        });
        // PUT proxy
        app.put(r, function(req, res){ 
            doForward(req, res, url.base_path, proxy);
        });
        // DELETE proxy
        app.delete(r, function(req, res){ 
            doForward(req, res, url.base_path, proxy);
        });
        // OPTIONS proxy
        app.options(r, function(req, res){ 
            doForward(req, res, url.base_path, proxy);
        });
    });
});

var doForward = function(req, res, baseUrl, p) {
    try {
        console.log('doForward %s', baseUrl);
        if (url.parse(baseUrl).protocol === 'https:') {
            p.web(req, res, { 
                target: baseUrl, 
                agent : https.globalAgent ,
                headers: {
                    host: url.parse(baseUrl).hostname
                }
            });
        } else {
            p.web(req, res, { 
                target: baseUrl,
                agent : http.globalAgent ,
                headers: {
                    host: url.parse(baseUrl).hostname
                }
            });
        }
    } catch (e) {
        console.log(e);
    }
}


// redirect page
app.use('/', express.static(__dirname + '/template'));

// addon swagger page
app.use('/s', express.static(__dirname + '/node_modules/swagger-ui/dist'));

// Start web server at port 3000
var port = config.get("port");
var server = app.listen(port, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Combines swaggers http://%s:%s', host, port);
});

// get swagger json data from urls
var getApis = function(urls){
    var the_promises = [];
    urls.forEach(function(url){
        var def = q.defer();
        console.log('Starting : ', url.base_path);
        request(url.docs, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                body = JSON.parse(body);
                console.log('Finished : ', url.base_path);
                def.resolve(body);
            }
            else {
              console.log('Failed : ', url.base_path);
              def.reject(body);
            }
        });
        the_promises.push(def.promise);
    });
    return q.all(the_promises);
}

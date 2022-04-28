var PouchDB = require('pouchdb');
var express = require('express');
var path = require("path");

var app = express();

var dataDir = path.resolve(process.env.DATA || "./data");
console.log(dataDir)
var staticDir = path.resolve(process.env.STATIC || ".");
console.log(staticDir)

var pdb = PouchDB.defaults({prefix: dataDir});

app.use('/db', require('express-pouchdb')(pdb));
app.use(express.static(staticDir))
var myPouch = new pdb('cards');

//app.listen(3000);



var fs = require('fs');
var http = require('http');
var https = require('https');
var privateKey  = fs.readFileSync(process.env.KEY, 'utf8');
var certificate = fs.readFileSync(process.env.CERT, 'utf8');
var credentials = {key: privateKey, cert: certificate};


var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

//httpServer.listen(8080);
httpsServer.listen(443);

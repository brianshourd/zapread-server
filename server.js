// Ok, so the server should take a post request with a picture, run the
// pic through ocr, send the text to AlchemyAPI, get the result, process
// it to json, send it back.
var request = require('request');
var express = require('express');
var nodecr = require('nodecr');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
_.str = require('underscore.string');
// Mixin underscore.string
_.mixin(_.str.exports());
_.str.include('Underscore.string', 'string');

// Secret! Dont' tell anyone!
var apiKey = fs.readFileSync('./apikey.txt', { encoding: 'utf8' });
apiKey = _.lines(apiKey)[0];
//console.log(apiKey);


// This should take the text and keywords, and return a much nicer
// array, with each entry a paragraph without newlines
function processText(text) {
    text = _.chain(text)
            .words("\n\n")
            .map(function(par) {
                // Replace newlines with spaces
                return par.replace(/(\r\n|\n|\r)/gm," ");
            })
            .value();
    //console.log(text);
    return JSON.stringify(text);
}

// Callback should be of form
// callback(error, response, body)
function alchemyText(text, callback) {
    var details = {
        url: 'http://access.alchemyapi.com/calls/text/TextGetRankedNamedEntities' + '?apikey=' + apiKey + '&text=' + encodeURI(text) + '&outputMode=json',
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
        }
    };
    request(details, callback);
}

// Process an image
// callback(error, response, body, text)
function processImage(filename, callback) {
    nodecr.process(filename, function(err, text) {
        if (err) { console.error(err); }
        else {
            alchemyText(text, function(error, response, body) {
                callback(error, response, body, text);
            });
        }
    });
};

/*
nodecr.process(__dirname + '/test2.jpg', function(err, text) {
    if (err) { console.error(err); }
    else {
        console.log(processText(text));
    }
});
*/

/*
var processed = "";
processImage(__dirname + '/test.jpg', function(error, response, body, text) {
    processed = body;
    console.log(processText(text));
    console.log(body);
});
*/

// Set up the server
// Should accept an image through POST, then save the image, run it
// through processImage, then delete the image
var app = express();
app.use(express.logger("dev"));

app.use(express.bodyParser({
    uploadDir: __dirname + '/uploads',
    keepExtensions: true
}));

app.use(express.methodOverride());
app.use(app.router);
app.use('/', express.static(__dirname + '/www'));
var port = process.env.PORT || 3000;

function addImage(req, res, next) {
    console.log("upload");
    //console.log(req);
    var file = req.files.file,
        filePath = file.path,
        /*
        lastIndex = filePath.lastIndexOf("/"),
        tmpFileName = filePath.substr(lastIndex + 1),
        */
        image = req.body;

    console.log(filePath);
    //image.fileName = tmpFileName;

    //Run it through processImage
    processImage(filePath, function(error, response, body, text) {
        //Want to return some json
        //{ paragraphs: [string], keywords: [string] }
        body = JSON.parse(body);
        var keywords = _.map(body.entities, function(entity) {
            return entity.text;
        });
        var json = JSON.stringify({
            paragraphs: processText(text),
            keywords: keywords
        });
        var headers = {
            'Content-Type': 'application/json',
            'Content-Length': json.length
        };
        res.write(json);
        res.end();
    });
};

app.post('/images', addImage);

/*
app.get('/images', function(req, res){
  res.send('<form method="post" enctype="multipart/form-data">'
    + '<p>Image: <input type="file" name="image" /></p>'
    + '<p><input type="submit" value="Upload" /></p>'
    + '</form>');
});
*/

app.listen(port, function() {
    console.log('Server listening on port ' + port);
});


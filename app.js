var http = require('http');
var sys = require('sys');
var zlib = require('zlib');
var tar = require('tar');
var fs = require('fs');
var spawn = require('child_process').spawn;

function startServer(vlc_path) {
  var server = new http.Server();
  server.on('request',function(request, response){
    if(request.method == 'HEAD') {
      var vlc_proc = spawn(vlc_path, [
          '-vvv',
          '-I dummy',
          'file:///Users/Simon/Desktop/big_buck_bunny_480p_h264.mov',
          '--loop',
          '--sout=#standard{access=http,mux=ts,dst=:6363}'
        ]);

      vlc_proc.stdout.on('data', function (data) {
        console.log(''+data);
      });

      vlc_proc.stderr.on('data', function (data) {
        console.log(''+data);
      });

      vlc_proc.on('close', function (code) {
        console.log('VLC exited with code ' + code);
      });


      response.writeHead(200,{
        'Content-type': 'application/octet-stream'
      })
      response.end();
    } else {
      //Passthrough VLC video stream
      var proxy_request = http.request({
        hostname: 'localhost',
        method: request.method,
        port: 6363
      }, function (proxy_response) {
        proxy_response.setEncoding('binary');
        proxy_response.on('data', function(chunk) {
          response.write(chunk,'binary');
        });
        proxy_response.on('end', function() {
          response.end();
        });
        response.writeHead(proxy_response.statusCode, proxy_response.headers);
      });

      proxy_request.on('error',function(){
        console.log('Could not connect to VLC stream');
        response.end();
      });
      
      proxy_request.end();

      request.on('close',function(){
        console.log('request.close');
        proxy_request.abort();
      }); 
    }
  });

  server.listen(9898);

  console.log("Server started on port 9898");
}

//If build
//Get VLC.tar.gz from compiled package
var nexeres = require("nexeres");
var stream = require('stream');
var bufferStream = new stream.PassThrough();
bufferStream.end(nexeres.get("VLC.tar.gz"));

//Extract VLC.app to temp folder
var extract = tar.Extract({ path: process.env.TMPDIR });
extract.on('finish', function() {
  //Start server when extraction is finished
  startServer();
})
bufferStream.pipe(zlib.Gunzip()).pipe(extract);
var vlc_path = process.env.TMPDIR + '/VLC.app/Contents/MacOS/VLC';
console.log(vlc_path);

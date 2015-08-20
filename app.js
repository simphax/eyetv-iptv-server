var http = require('http');
var sys = require('sys');
var zlib = require('zlib');
var tar = require('tar');
var fs = require('fs');
var async = require('async');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

var nexeres = require("nexeres");
var stream = require('stream');

function startServer(vlc_path) {
  var server = new http.Server();
  server.on('request',function(request, response){
    if(request.method == 'HEAD') {

      async.series([
        function(callback){
          async.parallel([
            function(callback){ //Kill VLC and wait for it to close
              exec('pgrep -o -x VLC', function (error, stdout, stderr) {
                console.log('VLC:'+stdout);
                var vlc_pid = stdout;
                exec('kill '+vlc_pid, function (error, stdout, stderr) {
                });
                exec('wait '+vlc_pid, function (error, stdout, stderr) {

                  callback();
                });
              });
            },
            function(callback){ //Launch EyeTV and wait for it to open
              async.series([
                function(callback){
                  exec('pgrep -o -x EyeTV', function (error, stdout, stderr) {
                    console.log('EyeTV:'+stdout);
                    var eyetv_pid = stdout;
                    if(eyetv_pid) {//If it's already running, continue
                      callback();
                    } else {
                      exec('osascript -e \'tell application "EyeTV" to launch with server mode\'', function (error, stdout, stderr) {
                        setTimeout(function(){
                          callback()
                        },4000);
                      });
                    }
                  });
                },
                function(callback){
                  http.get('http://localhost:2170/live/tuneto/1/320/AAAAAOgAAALwBaVQGAAPsQAAAAA=',function(res) {
                    console.log("Changed channel: " + res.statusCode);
                    callback();
                  }).on('error', function(e) {
                    console.log("Got error: " + e.message);
                    callback();
                  });
                },
                function(callback){ //Call EyeTV service and wait for it to finish changing channel
                  var changingChannelDone = false;
                  var retries = 0;

                  async.whilst(
                    function () { return !changingChannelDone && retries < 10; },
                    function (callback) {
                      retries++;
                      var eyetv_request = http.request({
                        hostname: 'localhost',
                        path: 'live/ready',
                        method: 'GET',
                        port: 2170
                      }, function (response) {
                        var jsonstr = '';
                        var gunzip = zlib.Gunzip();
                        gunzip.on('data',function(data){
                          jsonstr += data
                        });
                        gunzip.on('finish',function(){
                          var obj = JSON.parse(jsonstr);
                          console.log(obj);
                          changingChannelDone = obj.doneEncoding > 0;
                          setTimeout(callback,1000);
                        });
                        response.on('data', function(chunk) {
                          console.log('data');
                          gunzip.write(chunk,'binary');
                        });
                        response.on('end', function() {
                          console.log('end');
                          gunzip.end();
                        });
                      });

                      eyetv_request.on('error',function(){
                        console.log('Could not connect to EyeTV Service');
                      });
                      
                      eyetv_request.end();
                    },
                    function (err) {
                      //changingChannelDone == true
                      callback();
                    }
                  );
                  
                }
              ],
              function(err, results){
                callback();
              });
            }
          ],
          function(err, results){
            //VLC is closed and EyeTV is open and changed channel.
            //Start VLC streaming
            /*var vlc_proc = spawn(vlc_path, [
              '-vvv',
              '-I dummy',
              'eyetv://',
              '--loop',
              '--sout=#standard{access=http,mux=ts,dst=:6363}'
            ],{
              detached: true,
              stdio: [ 'ignore', 'ignore', 'ignore' ]
            });*/
/*
            vlc_proc.stdout.on('data', function (data) {
              console.log(''+data);
            });

            vlc_proc.stderr.on('data', function (data) {
              console.log(''+data);
            });

            vlc_proc.on('close', function (code) {
              console.log('VLC exited with code ' + code);
            });
*/
            callback();

/*
            exec(vlc_path + '-vvv -I dummy eyetv:// --loop --sout=#standard{access=http,mux=ts,dst=:6363} > /dev/null 2>&1 & echo $!', function (error, stdout, stderr) {
              console.log('VLC PID:'+stdout);
              callback();
            });*/
          });
        },
        function(callback){
          callback();
        }
      ],
      function(err, results){
        response.writeHead(200,{
          'Content-type': 'application/octet-stream'
        })
        response.end();
      });
    } else {
      //Poll EyeTV to keep the tuner alive
      setInterval(function(){
        http.get('http://localhost:2170/live/ready',function(res) {
          console.log('Polled EyeTV');
        }).on('error', function(e) {
          console.log('Error polling EyeTV');
        });
      },5000);

      var vlc_proc = spawn(vlc_path, [
        '-vvv',
        '-I dummy',
        'eyetv://',
        '--loop',
        '--sout=#standard{access=http,mux=ts,dst=:6363}'
      ]);
      setTimeout(function(){
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
          exec('killall VLC');
          proxy_request.abort();
        });
      },1000);
    }
  });

  server.listen(9898);

  console.log("Server started on port 9898");
}

//If build
//Get VLC.tar.gz from compiled package
var vlc_path = process.env.TMPDIR + '/VLC.app/Contents/MacOS/VLC';

var bufferStream = new stream.PassThrough();
bufferStream.end(nexeres.get("VLC.tar.gz"));

//Extract VLC.app to temp folder
console.log("Extracting VLC.app to " + process.env.TMPDIR);
var extract = tar.Extract({ path: process.env.TMPDIR });
extract.on('finish', function() {
  //Start server when extraction is finished
  startServer(vlc_path);
})
bufferStream.pipe(zlib.Gunzip()).pipe(extract);

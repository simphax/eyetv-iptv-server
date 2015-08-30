var http = require('http');
var sys = require('sys');
var zlib = require('zlib');
var tar = require('tar');
var fs = require('fs');
var async = require('async');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var url = require('url');
var stream = require('stream');

var argv = require('minimist')(process.argv.slice(2));
console.log('EyeTV IPTV server v1.0.1');
console.log('Arguments: ', argv);

var PORT = argv['port'] || '9898';
var HOST = argv['host'] || undefined;
var VLC_PORT = argv['vlc-port'] || '9897';
var VLC_DST = argv['vlc-dst'] || 'localhost';
var TMP_DIR = argv['tmp-dir'] || process.env.TMPDIR;
var VLC_PATH = argv['vlc-path'] || TMP_DIR + 'VLC.app/Contents/MacOS/VLC';
var EYETV_HOST = argv['eyetv-host'] || 'localhost';
var EYETV_PORT = argv['eyetv-port'] || '2170';

if(!argv['vlc-path']) {
  
  var nexeres = require("nexeres");
  //Get VLC.tar.gz from compiled package
  var bufferStream = new stream.PassThrough();
  bufferStream.end(nexeres.get("VLC.tar.gz"));

  //Extract VLC.app to temp folder
  console.log("Extracting VLC.app to " + TMP_DIR);
  var extract = tar.Extract({ path: TMP_DIR });
  extract.on('finish', function() {
    //Start server when extraction is finished
    startServer(VLC_PATH);
  })
  bufferStream.pipe(zlib.Gunzip()).pipe(extract);
} else {
  startServer(VLC_PATH);
}

function startServer(vlc_path) {
  var server = new http.Server();
  server.on('request',function(request, response){

    var url_components = url.parse(request.url, true);

    if(url_components.pathname == '/live' && url_components.query.serviceID) {
      
      var pollInterval,vlc_proc;
      var serviceID = url_components.query.serviceID;

      if(request.method == 'HEAD') {
          response.writeHead(200,{
            'Content-type': 'application/octet-stream'
          })
          response.end();
      } else {
        async.series([
          function(callback){
            async.parallel([
              function(callback){ //Kill VLC and wait for it to close
                exec('ps aux | grep '+VLC_PATH+' | grep -v grep | grep -v vlc-path | awk \'{print $2}\'', function (error, stdout, stderr) {
                  console.log('VLC:'+stdout);
                  var vlc_pid = stdout;
                  exec('kill '+vlc_pid, function (error, stdout, stderr) {
                  });
                  exec('while [ -e /proc/'+vlc_pid+' ]; do sleep 0.1; done', function (error, stdout, stderr) {
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
                        //For some reason we have to run the launch applescript command two times. First time will give an error (-2741)
                        exec('osascript -e \'tell application "EyeTV" to launch with server mode\'; osascript -e \'tell application "EyeTV" to launch with server mode\'', function (error, stdout, stderr) {
                          var eyeTVStarted = false;
                          var retries = 0;
                          async.whilst(
                            function () { return !eyeTVStarted && retries < 10; },
                            function (callback) {
                              retries++;
                              console.log('Waiting for EyeTV to launch');
                              setTimeout(function(){
                                var eyetv_request = http.request({
                                  hostname: EYETV_HOST,
                                  path: 'live/status',
                                  method: 'GET',
                                  port: EYETV_PORT
                                }, function (eyetv_response) {
                                  var jsonstr = '';
                                  var gunzip = zlib.Gunzip();
                                  gunzip.on('data',function(data){
                                    jsonstr += data
                                  });
                                  gunzip.on('finish',function(){
                                    var obj = JSON.parse(jsonstr);
                                    console.log(obj);
                                    eyeTVStarted = obj.isUp;
                                    callback();
                                  });
                                  eyetv_response.on('data', function(chunk) {
                                    gunzip.write(chunk,'binary');
                                  });
                                  eyetv_response.on('end', function() {
                                    gunzip.end();
                                  });
                                });

                                eyetv_request.on('error',function(){
                                  console.log('Could not connect to EyeTV Service');
                                });
                                
                                eyetv_request.end();
                              },1000);
                            },
                            function (err) {
                              //eyeTVStarted == true
                              console.log('EyeTV is launched');
                              callback();
                            }
                          );
                        });
                      }
                    });
                  },
                  function(callback){ //Set EyeTV channel to serviceID
                    var changingChannelReady = false;
                    var retries = 0;

                    async.doDuring(
                      function (callback) {
                        retries++;
                        var eyetv_request = http.request({
                          hostname: EYETV_HOST,
                          path: 'live/tuneto/1/320/' + serviceID,
                          method: 'GET',
                          port: EYETV_PORT
                        }, function (eyetv_response) {
                          var jsonstr = '';
                          var gunzip = zlib.Gunzip();
                          gunzip.on('data',function(data){
                            jsonstr += data
                          });
                          gunzip.on('finish',function(){
                            var obj = JSON.parse(jsonstr);
                            console.log(obj);
                            changingChannelReady = obj.success;
                            callback();
                          });
                          eyetv_response.on('data', function(chunk) {
                            gunzip.write(chunk,'binary');
                          });
                          eyetv_response.on('end', function() {
                            gunzip.end();
                          });
                        });

                        eyetv_request.on('error',function(){
                          console.log('Could not connect to EyeTV Service');
                        });
                        
                        eyetv_request.end();
                      },
                      function (callback) {
                        if(!changingChannelReady && retries < 10) {
                          setTimeout(function(){ //Try again in 0.5s
                            callback(null,true);
                          },500);
                        } else {
                          callback(null,false);
                        }
                      },
                      function (err) {
                        //changingChannelReady == true
                        callback();
                      }
                    );
                  },
                  function(callback){ //Call EyeTV service and wait for it to finish changing channel
                    var changingChannelDone = false;
                    var retries = 0;

                    async.doDuring(
                      function (callback) {
                        retries++;
                        var eyetv_request = http.request({
                          hostname: EYETV_HOST,
                          path: 'live/ready',
                          method: 'GET',
                          port: EYETV_PORT
                        }, function (eyetv_response) {
                          var jsonstr = '';
                          var gunzip = zlib.Gunzip();
                          gunzip.on('data',function(data){
                            jsonstr += data
                          });
                          gunzip.on('finish',function(){
                            var obj = JSON.parse(jsonstr);
                            console.log(obj);
                            changingChannelDone = obj.doneEncoding > 0;
                            callback();
                          });
                          eyetv_response.on('data', function(chunk) {
                            gunzip.write(chunk,'binary');
                          });
                          eyetv_response.on('end', function() {
                            gunzip.end();
                          });
                        });

                        eyetv_request.on('error',function(){
                          console.log('Could not connect to EyeTV Service');
                        });
                        
                        eyetv_request.end();
                      },
                      function (callback) {
                        if(!changingChannelDone && retries < 10) {
                          setTimeout(function(){ //Try again in 0.5s
                            callback(null,true);
                          },500);
                        } else {
                          callback(null,false);
                        }
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
              //VLC is closed and EyeTV is open and have changed channel.
              callback();
            });
          },
          function(callback){
            //Poll EyeTV to keep the tuner alive
            pollInterval = setInterval(function(){
              http.get('http://' + EYETV_HOST + ':' + EYETV_PORT + '/live/ready',function(res) {
                console.log('Polled EyeTV');
              }).on('error', function(e) {
                console.log('Error polling EyeTV');
              });
            },5000);
            callback();
          },
          function(callback){
            var streamingStarted = false;
            //Start VLC streaming
            vlc_proc = spawn(vlc_path, [
              '-vvv',
              '-I dummy',
              'eyetv://',
              '--loop',
              '--sout=#standard{access=http,mux=ts,dst=' + VLC_DST + ':' + VLC_PORT + '}'
            ]);

            vlc_proc.stderr.on('data', function (data) {
              var str = ''+data;
              if(str.indexOf('net: listening to ') > -1){
                console.log('VLC streaming has started');
              }
              if(str.indexOf('Decoder wait done') > -1){
                console.log('VLC is done buffering');
                if(!streamingStarted) { //Callback only once
                  streamingStarted = true;
                  callback();
                }
              }
              //console.log(str);
            });

//          vlc_proc.stdout.on('data', function (data) {
//            var str = ''+data;
//            console.log(str);
//          });

            vlc_proc.on('close', function (code) {
              console.log('VLC exited with code ' + code);
            });
          }
        ],
        function(err, results){
          //Passthrough VLC video stream
          console.log('Passthrough VLC stream');
          var vlc_request = http.request({
            hostname: 'localhost',
            method: request.method,
            port: VLC_PORT
          }, function (vlc_response) {
            console.log('connected to VLC stream');
            vlc_response.setEncoding('binary');
            vlc_response.on('data', function(chunk) {
              response.write(chunk,'binary');
            });
            vlc_response.on('end', function() {
              console.log('vlc_response.end');
              response.end();
            });
            response.writeHead(vlc_response.statusCode, vlc_response.headers);
          });

          response.on('close',function(){
            console.log('response.close');
            clearInterval(pollInterval);
            vlc_proc.kill('SIGINT');
          });

          response.on('finish',function(){
            console.log('response.finish');
            clearInterval(pollInterval);
            vlc_proc.kill('SIGINT');
          });

          vlc_request.on('error',function(){
            console.log('Could not connect to VLC stream');
            response.end();
          });
          
          vlc_request.end();

          request.on('close',function(){
            console.log('request.close');
            vlc_request.abort();
          });
        });
      }
    } else if(url_components.pathname == '/playlist.m3u8') {
      async.series([
        function(callback){ //Launch EyeTV and wait for it to open
          exec('pgrep -o -x EyeTV', function (error, stdout, stderr) {
            console.log('EyeTV:'+stdout);
            var eyetv_pid = stdout;
            if(eyetv_pid) {//If it's already running, continue
              callback();
            } else {
              //For some reason we have to run the launch applescript command two times. First time will give an error (-2741)
              exec('osascript -e \'tell application "EyeTV" to launch with server mode\'; osascript -e \'tell application "EyeTV" to launch with server mode\'', function (error, stdout, stderr) {
                var eyeTVStarted = false;
                var retries = 0;
                async.whilst(
                  function () { return !eyeTVStarted && retries < 10; },
                  function (callback) {
                    retries++;
                    console.log('Waiting for EyeTV to launch');
                    setTimeout(function(){
                      var eyetv_request = http.request({
                        hostname: EYETV_HOST,
                        path: 'live/status',
                        method: 'GET',
                        port: EYETV_PORT
                      }, function (eyetv_response) {
                        var jsonstr = '';
                        var gunzip = zlib.Gunzip();
                        gunzip.on('data',function(data){
                          jsonstr += data
                        });
                        gunzip.on('finish',function(){
                          var obj = JSON.parse(jsonstr);
                          console.log(obj);
                          eyeTVStarted = obj.isUp;
                          callback();
                        });
                        eyetv_response.on('data', function(chunk) {
                          gunzip.write(chunk,'binary');
                        });
                        eyetv_response.on('end', function() {
                          gunzip.end();
                        });
                      });

                      eyetv_request.on('error',function(){
                        console.log('Could not connect to EyeTV Service');
                      });
                      
                      eyetv_request.end();
                    },1000);
                  },
                  function (err) {
                    //eyeTVStarted == true
                    console.log('EyeTV is launched');
                    callback();
                  }
                );
              });
            }
          });
        },
        function(callback){
          response.write('#EXTM3U');
          var eyetv_request = http.request({
            hostname: 'localhost',
            path: 'live/channels',
            method: 'GET',
            port: 2170
          }, function (eyetv_response) {
            var jsonstr = '';
            var gunzip = zlib.Gunzip();
            gunzip.on('data',function(data){
              jsonstr += data
            });
            gunzip.on('finish',function(){
              var channels = JSON.parse(jsonstr);
              console.log(channels);
              channels.channelList.forEach(function(channel) {
                response.write('\n\n');
                response.write('#EXTINF:-1, ' + channel.name + '\n');
                response.write('http://' + request.headers.host + '/live?serviceID=' + channel.serviceID);
              });
              response.end();
            });
            eyetv_response.on('data', function(chunk) {
              console.log('data');
              gunzip.write(chunk, 'binary');
            });
            eyetv_response.on('end', function() {
              console.log('end');
              gunzip.end();
            });
          });

          eyetv_request.on('error',function(){
            console.log('Could not connect to EyeTV Service');
          });
          
          eyetv_request.end('\n');
        }],
        function(err, results){
          eyetv_request.end('\n');
        }
      );
    } else {
      response.writeHead(400);
      response.end('/live/[serviceID] or /playlist.m3u8');
    }
  });
  server.listen(PORT,HOST);

  console.log("Server started on port " + PORT);
}



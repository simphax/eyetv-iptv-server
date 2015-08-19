var http = require('http');
var fs = require('fs');

var server = new http.Server();

server.on('request',function(request, response){
  console.log(request.method);

  if(request.method == 'HEAD') {
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
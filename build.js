var nexe = require('nexe');

nexe.compile({
    input: './app.js',
    output: 'build/eyetv-iptv-server',
    nodeVersion: '0.12.7',
    nodeTempDir: 'build/tmp',
    python: '/usr/bin/python',
    resourceFiles: [  ],
    flags: true,
    framework: "nodejs"
}, function(err) {
    console.log(err);
});
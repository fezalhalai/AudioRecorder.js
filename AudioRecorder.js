(function () {
    var params = {},
        r = /([^&=]+)=?([^&]*)/g;

    function d(s) {
        return decodeURIComponent(s.replace(/\+/g, ' '));
    }

    var match, search = window.location.search;
    while (match = r.exec(search.substring(1))) {
        params[d(match[1])] = d(match[2]);

        if (d(match[2]) === 'true' || d(match[2]) === 'false') {
            params[d(match[1])] = d(match[2]) === 'true' ? true : false;
        }
    }

    window.params = params;
})();

function addStreamStopListener(stream, callback) {
    var streamEndedEvent = 'ended';

    if ('oninactive' in stream) {
        streamEndedEvent = 'inactive';
    }

    stream.addEventListener(streamEndedEvent, function () {
        callback();
        callback = function () { };
    }, false);

    stream.getAudioTracks().forEach(function (track) {
        track.addEventListener(streamEndedEvent, function () {
            callback();
            callback = function () { };
        }, false);
    });

    stream.getVideoTracks().forEach(function (track) {
        track.addEventListener(streamEndedEvent, function () {
            callback();
            callback = function () { };
        }, false);
    });
}

var recordingPlayer = document.querySelector('#recording-player');

var mediaContainerFormat = document.querySelector('.media-container-format');
var mimeType = 'audio/wav';
var fileExtension = 'wav';
var type = 'audio';
var recorderType;
var defaultWidth;
var defaultHeight;

function StartRecording() {
    var button = document.querySelector('#btn-start-recording');
    
    if (button.innerHTML === 'Stop Recording') {

        button.disabled = true;
        button.disableStateWaiting = true;
        setTimeout(function () {
            button.disabled = false;
            button.disableStateWaiting = false;
        }, 2000);

        button.innerHTML = 'Star Recording';

        function stopStream() {
            if (button.stream && button.stream.stop) {
                button.stream.stop();
                button.stream = null;
            }

            if (button.stream instanceof Array) {
                button.stream.forEach(function (stream) {
                    stream.stop();
                });
                button.stream = null;
            }


        }

        if (button.recordRTC) {
            
            if (button.recordRTC.length) {

                button.recordRTC[0].stopRecording(function (url) {
                    if (!button.recordRTC[1]) {
                        button.recordingEndedCallback(url);
                        stopStream();
                        saveToDiskOrOpenNewTab(button.recordRTC);
                        return;
                    }

                    button.recordRTC[1].stopRecording(function (url) {
                        button.recordingEndedCallback(url);
                        stopStream();
                    });
                });
            }
            else {
                button.recordRTC.stopRecording(function (url) {
                    button.recordingEndedCallback(url);
                    stopStream();
                    saveToDiskOrOpenNewTab(button.recordRTC);
                });
            }
        }

        return;
    }

    button.disabled = true;

    var commonConfig = {
        onMediaCaptured: function (stream) {
            button.stream = stream;
            if (button.mediaCapturedCallback) {
                button.mediaCapturedCallback();
            }

            button.innerHTML = 'Stop Recording';
            button.disabled = false;
        },
        onMediaStopped: function () {
            button.innerHTML = 'Start Recording';
            if (!button.disableStateWaiting) {
                button.disabled = false;
            }
        },
        onMediaCapturingFailed: function (error) {

        }
    };

    mimeType = 'audio/wav';
    fileExtension = 'wav'; // ogg or webm?
    recorderType = null;
    type = 'audio';
    captureAudio(commonConfig);
    button.mediaCapturedCallback = function () {
        var options = {
            type: type,
            mimeType: mimeType,
            leftChannel: params.leftChannel || false,
            disableLogs: params.disableLogs || false
        };

        if (params.sampleRate) {
            options.sampleRate = parseInt(params.sampleRate);
        }

        if (params.bufferSize) {
            options.bufferSize = parseInt(params.bufferSize);
        }


        if (webrtcDetectedBrowser === 'edge') {
            options.numberOfAudioChannels = 1;
        }

        button.recordRTC = RecordRTC(button.stream, options);

        button.recordingEndedCallback = function (url) {
            setVideoURL(url);
        };

        button.recordRTC.startRecording();

    };
};


function captureAudio(config) {
    captureUserMedia({ audio: true }, function (audioStream) {
        config.onMediaCaptured(audioStream);

        addStreamStopListener(audioStream, function () {
            config.onMediaStopped();
        });
    }, function (error) {
        config.onMediaCapturingFailed(error);
    });
}


function addEventListenerToUploadLocalStorageItem(selector, arr, callback) {
    arr.forEach(function (event) {
        document.querySelector(selector).addEventListener(event, callback, false);
    });
}

function captureUserMedia(mediaConstraints, successCallback, errorCallback) {
    if (mediaConstraints.video == true) {
        mediaConstraints.video = {};
    }
    navigator.mediaDevices.getUserMedia(mediaConstraints).then(function (stream) {
        successCallback(stream);
        setVideoURL(stream, true);
    }).catch(function (error) {
        if (error && error.name === 'ConstraintNotSatisfiedError') {
            alert('Your camera or browser does NOT supports selected resolutions or frame-rates. \n\nPlease select "default" resolutions.');
        }
        errorCallback(error);
    });
}
function uploadToPHPServer(fileName, recordRTC, callback) {
    
    var blob = recordRTC instanceof Blob ? recordRTC : recordRTC.getBlob();

    blob = new File([blob], 'RecordRTC-' + (new Date).toISOString().replace(/:|\./g, '-') + '.' + fileExtension, {
        type: mimeType
    });

    var checkin_id = localStorage.getItem('checkin_id');
    var Tran_Type = localStorage.getItem('Tran_Type');

    // create FormData
    var fileType = 'audio'; // or "audio"
    var fileName = checkin_id + '.wav';  // or "wav"

    var formDatas = new FormData();
    formDatas.append(fileType + '-filename', fileName);
    formDatas.append(fileType + '-blob', blob);
    formDatas.append('tran_id', checkin_id);
    formDatas.append('recordedby', $('#hdnUserId').val());
    formDatas.append('Tran_Type', Tran_Type);
    callback('Uploading recorded-file to server.');
    makeXMLHttpRequest('Service/srvcTranscription.asmx/SetCICOData', formDatas, function (progress) {
        if (progress !== 'upload-ended') {
            callback(progress);
            return;
        }
        //callback('ended', 'Service/srvcTranscription.asmx/SetCICOData' + fileName);
    });
}

function makeXMLHttpRequest(url, data, callback) {
    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (request.readyState == 4 && request.status == 200) {
            $("#divLoading").removeClass('show');
            callback('upload-ended');
        }
    };
    request.open('POST', url);
    request.send(data);
}
function getURL(arg) {
    var url = arg;

    if (arg instanceof Blob || arg instanceof File) {
        url = URL.createObjectURL(arg);
    }

    if (arg instanceof RecordRTC || arg.getBlob) {
        url = URL.createObjectURL(arg.getBlob());
    }

    if (arg instanceof MediaStream || arg.getTracks || arg.getVideoTracks) {
        url = URL.createObjectURL(arg);
    }

    return url;
}

function setVideoURL(arg, forceNonImage) {
    var url = getURL(arg);

    //var parentNode = recordingPlayer.parentNode;
    //parentNode.removeChild(recordingPlayer);
    //parentNode.innerHTML = '';

    var elem = 'video';

    if (type == 'audio') {
        elem = 'audio';
    }

    recordingPlayer = document.createElement(elem);

    if (arg instanceof MediaStream) {
        recordingPlayer.muted = true;
    }

    recordingPlayer.addEventListener('loadedmetadata', function () {
        if (navigator.userAgent.toLowerCase().indexOf('android') == -1) return;

        // android
        setTimeout(function () {
            if (typeof recordingPlayer.play === 'function') {
                recordingPlayer.play();
            }
        }, 2000);
    }, false);

    recordingPlayer.poster = '';
    recordingPlayer.src = url;

    if (typeof recordingPlayer.play === 'function') {
        var button = document.querySelector('#btn-start-recording');

        if (button.innerHTML === 'Stop Recording') {
            recordingPlayer.play();
        }
    }

    recordingPlayer.addEventListener('ended', function () {
        url = getURL(arg);
        recordingPlayer.src = url;
    });

    recordingPlayer.controls = true;
    //   parentNode.appendChild(recordingPlayer);
}



function saveToDiskOrOpenNewTab(recordRTC) {
    var fileName = 'RecordRTC-' + (new Date).toISOString().replace(/:|\./g, '-') + '.' + fileExtension;
    uploadToPHPServer(fileName, recordRTC, function (progress, fileURL) {
        if (progress === 'ended') {

        }
    });
}

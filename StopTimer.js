
function pad(number, length) {
    var str = '' + number;
    while (str.length < length) { str = '0' + str; }
    return str;
}
function formatTime(time) {
    var min = parseInt(time / 6000),
        sec = parseInt(time / 100) - (min * 60),
        hundredths = pad(time - (sec * 100) - (min * 6000), 2);
    return (min > 0 ? pad(min, 2) : "00") + ":" + pad(sec, 2);
    //return (min > 0 ? pad(min, 2) : "00") + ":" + pad(sec, 2) + ":" + hundredths;
}
var Example1 = function () {
    var $stopwatch,
 incrementTime = 70,
 currentTime = 0;
    var HealthCareExt = { 
        updateTimer: function () {           
            $stopwatch.html(formatTime(currentTime));
            currentTime += incrementTime / 10;
        },
        init : function (value) {
            debugger
            $stopwatch = value;
            Example1.Timer = $.timer(Example1.updateTimer, incrementTime, true);
            Example1.Timer.toggle();
        },
        resetStopwatch : function () {
            currentTime = 0;
            this.Timer.stop().once();
        }    
    }
    return HealthCareExt;
}();
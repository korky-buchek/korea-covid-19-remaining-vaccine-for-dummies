import {WebContents} from "electron";

function log(wc : WebContents, ...msgs : any[]){
    for(var i = 0; i < msgs.length; i++)
        wc.send('console', '<p>' + String(msgs[i])) + '<p>';
}
function event(wc : WebContents, ...msgs : any[]){
    for(var i = 0; i < msgs.length; i++)
        wc.send('console', '<p class="event">' + String(msgs[i]) + '<p>');
}

function error(wc : WebContents, ...msgs : any[]){
    for(var i = 0; i < msgs.length; i++)
        wc.send('console', '<p class="error">' + String(msgs[i]) +'<p>');
}

export default {
    log,
    error,
    event
}
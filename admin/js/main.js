$(window).bind('load', function(){
    $(document).ready(function(){
        jsPlumb.ready(function(){
            setupPlumbing();
            setupWebsocket();
            setupUserEvents();
            setupLinks();
        });
    });
});

var NONE_SELECTED = {},
    PUB_SELECTED = {},
    SUB_SELECTED = {};
var currState = NONE_SELECTED;

var setupLinks = function() {
	$(".about-link").on("click", function(event) {
        window.open("http://docs.spacebrew.cc");
        return false;		
	})
	$(".contact-link").on("click", function(event) {
        window.open("http://docs.spacebrew.cc/contact/");
        return false;		
	})
	$(".lab-link").on("click", function(event) {
        window.open("http://www.rockwellgroup.com/lab");
        return false;		
	})
}

var dorouteradio = function(e){
    if (e){e.preventDefault();};
    var selectedPub = $("input[name=pub]:radio:checked").val();
    var selectedSub = $("input[name=sub]:radio:checked").val();
    if (selectedPub && selectedSub){
        selectedPub = selectedPub.split('_').map(Unsafetify);
        selectedSub = selectedSub.split('_').map(Unsafetify);
        if (selectedPub.length == 4 && selectedSub.length == 4){
            ws.send(JSON.stringify({
                route:{type:'add',
                        publisher:{clientName:selectedPub[0],
                                    name:selectedPub[2],
                                    type:selectedPub[3],
                                    remoteAddress:selectedPub[1]},
                        subscriber:{clientName:selectedSub[0],
                                    name:selectedSub[2],
                                    type:selectedSub[3],
                                    remoteAddress:selectedSub[1]}}
            }));
        }
    }
};

var changeRoute = function(changeType, fromId, toId){
    var selectedPub = fromId.split('_').map(Unsafetify);
    var selectedSub = toId.split('_').map(Unsafetify);
    var clientName = 1, 
        remoteAddress = clientName + 1, 
        name = remoteAddress + 1, 
        type = name + 1;
    if (selectedPub.length == type + 1 && selectedSub.length == type + 1){
        var m = {
            route:{type:changeType,
                    publisher:{clientName:selectedPub[clientName],
                                name:selectedPub[name],
                                type:selectedPub[type],
                                remoteAddress:selectedPub[remoteAddress]},
                    subscriber:{clientName:selectedSub[clientName],
                                name:selectedSub[name],
                                type:selectedSub[type],
                                remoteAddress:selectedSub[remoteAddress]}}
        };
        if (debug) console.log(m);
        ws.send(JSON.stringify(m));
    }
}

var addRoute = function(fromId, toId){
    changeRoute("add", fromId, toId);
}

var removeRoute = function(fromId, toId){
    changeRoute("remove", fromId, toId);
}

var dorouteremove = function(index){
    if (index >= 0 && index < routes.length){
        var toRemove = routes.splice(index, 1);
        if (toRemove.length > 0){
            toRemove = toRemove[0];
            ws.send(JSON.stringify({
                route:{type:'remove',
                        publisher:toRemove.publisher,
                        subscriber:toRemove.subscriber}
            }));
        }
    }
};
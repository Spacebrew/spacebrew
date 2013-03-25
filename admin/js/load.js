//including custom css-loading function
//because requirejs does not support loading css
function loadCSS(url){
    var link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = url;
    document.getElementsByTagName("head")[0].appendChild(link);
    return link;
};

loadCSS("css/reset.css");
loadCSS("css/style.css");

require(["handlebars-1.0.0.beta.6",
		"jsplumb/jsPlumb-util-1.3.13-RC1",
		"jsplumb/jsPlumb-dom-adapter-1.3.13-RC1",
		"jquery/jquery-1.7.1-min"],function(){
		//handlebars, jquery, jsplumbutil, jsplumbadapter is loaded
	require(["jsplumb/jsPlumb-1.3.13-RC1",
			"utils"],function(){
				require([
				"jsplumb/jsPlumb-renderers-svg-1.3.13-RC1"],function(){
		//now jsPlumb is loaded
		require(["jsplumb/jquery.jsPlumb-1.3.13-RC1",
				"jsplumb/jsPlumb-connectors-statemachine-1.3.13-RC1",
				"jsplumb/jsPlumb-defaults-1.3.13-RC1",
				"jsplumb/jsPlumb-drag-1.3.13-RC1",
				"jsplumb/jsPlumb-overlays-guidelines-1.3.13-RC1"/*,
				//"jsplumb/jsPlumb-renderers-canvas-1.3.13-RC1",/*,
				"jsplumb/jsPlumb-renderers-vml-1.3.13-RC1"*/],function(){
			require(["plumbing",
					"wsevents",
					"userevents"],function(){
				require(["main"],function(){
				});
			});
		});
		});
	});
});

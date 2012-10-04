//including custom css-loading function
//because requirejs does not support loading css
function loadCSS(url){
    var link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = url;
    document.getElementsByTagName("head")[0].appendChild(link);
};

loadCSS("css/reset.css");
loadCSS("css/main.css");
loadCSS("css/bootstrap.css");
loadCSS("css/bootstrap-responsive.css");
loadCSS("css/style.css");
require(["jsplumb/jsPlumb-util-1.3.13-RC1",
		"jsplumb/jsPlumb-dom-adapter-1.3.13-RC1",
		"jquery/jquery-1.7.1-min"],function(){
	//now jQuery, jsPlumbUtil, and jsPlumbAdapter is loaded
	require(["jquery/jquery.ui.touch-punch.min",
			"jquery/jquery-ui-1.8.16-min"], function(){
		//now JQueryUI is loaded
		require(["jsplumb/jsPlumb-1.3.13-RC1", 
				"utils"],function(){
			//now jsPlumb is loaded
			require(["jsplumb/jquery.jsPlumb-1.3.13-RC1",
					"jsplumb/jsPlumb-connectors-statemachine-1.3.13-RC1",
					"jsplumb/jsPlumb-defaults-1.3.13-RC1",
					"jsplumb/jsPlumb-drag-1.3.13-RC1",
					"jsplumb/jsPlumb-overlays-guidelines-1.3.13-RC1",
					"jsplumb/jsPlumb-renderers-canvas-1.3.13-RC1",
					"jsplumb/jsPlumb-renderers-svg-1.3.13-RC1",
					"jsplumb/jsPlumb-renderers-vml-1.3.13-RC1",
					//"main",
					//"flowchartConnectorsDemo",
					"pmain",
					"handlews"], function(){
				require(["commander"],function(){
				});
			});
		});
	});
});
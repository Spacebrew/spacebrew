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
		"jquery/jquery-1.8.3"],function(){
		//handlebars, jquery is loaded
	require(["jquery/jquery-ui-1.9.2.custom",
			"utils"],function(){
		require(["plumbing",
				"wsevents",
				"userevents"],function(){
			require(["main"],function(){
			});
		});
	});
});

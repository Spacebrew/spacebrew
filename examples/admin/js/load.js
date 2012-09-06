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
loadCSS("css/bootstrap.css");
loadCSS("css/bootstrap-responsive.css");
loadCSS("css/style.css");
require(["jquery/jq",
		"utils"],function(){
	//now jQuery is loaded
	require(["main"],function(){
	});
});